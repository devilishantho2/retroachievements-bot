import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import {
  loadDB,
  saveDB,
  setLastAchievement,
  setAotwUnlocked,
  resetAotwUnlocked,
  setAotmUnlocked,
  resetAotmUnlocked,
  incrementApiCallCount,
  addToHistory,
  changeLatestMaster,
  updateStats_Points,
  updateStats_Master
} from './db.js';
import {
  buildAuthorization,
  getUserSummary,
  getAchievementOfTheWeek,
} from '@retroachievements/api';
import { generateAchievementImage } from './generateImage.js';
import { t } from './locales.js';
import { consoleTable } from './consoleTable.js';
import { retry, log, getPointsEmoji } from './utils.js';

config();

// 🔹 Capture des erreurs globales pour éviter les crashs
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
});

const CHECK_INTERVAL_COURT = 3 * 60 * 1000; // 3 minutes
const CHECK_INTERVAL_MOYEN = 6 * 60 * 1000; // 6 minutes
const CHECK_INTERVAL_LONG = 30 * 6 * 1000;  // 30 minutes
const userCheckState = {}; // { discordId: { lastactivity, nextCheckTime } }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();
global.clientRef = client;

const commandsPath = path.join('./commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = (await import(`./commands/${file}`)).default;
  client.commands.set(command.data.name, command);
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    await log('❌ Erreur lors de la commande : ' + error);
    await interaction.reply({ content: 'Erreur pendant l’exécution.', ephemeral: true });
  }
});

function updatePresence(client) {
  const usersDB = loadDB('usersdb');
  const userCount = Object.keys(usersDB).length;
  const guildsDB = loadDB('guildsdb');
  const guildCount = Object.keys(guildsDB).length;

  client.user.setActivity(`the cheevos of ${userCount} gamer${userCount > 1 ? 's' : ''}, in ${guildCount} server${guildCount > 1 ? 's' : ''}`, {
    type: ActivityType.Watching
  });
};

async function fetchAndStoreAotw() {
  const authorization = buildAuthorization({ username: process.env.RA_USERNAME, webApiKey: process.env.RA_API_KEY });
  try {
    const response = await retry(
      () => getAchievementOfTheWeek(authorization),
      { retries: 3, delay: 500 }
    );    
    const aotw = {
      id: parseInt(response.achievement.id),
      title: response.achievement.title,
      description: response.achievement.description,
      points: parseInt(response.achievement.points),
      gameTitle: response.game.title,
      dateCreated: response.achievement.dateCreated,
      gameid: response.game.id,
    };
    saveDB(aotw, 'aotwdb');
    resetAotwUnlocked();
    log('📌 AOTW mis à jour : ' + aotw.title);
  } catch (err) {
    log('❌ Erreur fetch AOTW (après retry) : ' + (err.message || err));
  }
}

async function checkOneUser(discordId) {

  const user = loadDB('usersdb')[discordId];
  const guildsDB = loadDB('guildsdb');
  const aotw = loadDB('aotwdb');
  const aotm = loadDB('aotmdb');

  const newAchievements = [];

  const authorization = buildAuthorization({
      username: user.ulid,
      webApiKey: user.raApiKey
  });

  // ------ Étape 1 : collecte ------
  let summary;
  summary = await retry(
      () => getUserSummary(authorization, { username: user.ulid, recentGamesCount: 3 }),
      { retries: 3, delay: 500, userLabel: user.ulid }
  );
  incrementApiCallCount();
  const lastActivityStr = summary.recentlyPlayed[0].lastPlayed;
  userCheckState[discordId].lastActivity = new Date(lastActivityStr.replace(' ', 'T')).getTime() + 60*60*1000;

  // ------ Étape 2 : traitement ------
  const recentAchievements = Object.values(summary.recentAchievements)
    .flatMap(game => Object.values(game))
    .sort((a, b) => new Date(b.dateAwarded) - new Date(a.dateAwarded));

  if (recentAchievements.length === 0) return;

  const lastAchievementDate = new Date(user.lastAchievement[1]);
  const lastAchievementId = user.lastAchievement[0];

  for (const achievement of recentAchievements) {
    const achievementDate = new Date(achievement.dateAwarded);

    if (achievement.id === lastAchievementId || achievementDate <= lastAchievementDate) {
      continue;
    }

    newAchievements.push(achievement);
  }

  if (newAchievements.length === 0) return;

  newAchievements.reverse();

  const lastNew = newAchievements[newAchievements.length - 1];
  setLastAchievement(discordId, [lastNew.id, lastNew.dateAwarded]);

  const achievementsOffset = {};
  for (const ach of newAchievements) {
      const id = ach.gameId;
      achievementsOffset[id] = (achievementsOffset[id] || 0) + 1;
  };

  const gamesWithNewAchievements = new Set(
    newAchievements.map(ach => String(ach.gameId))
  );
  
  var gameProgress = {};
  for (const [gameId, gameAward] of Object.entries(summary.awarded || {})) {
    if (!gamesWithNewAchievements.has(gameId)) continue;
  
    gameProgress[gameId] = {
      achieved: gameAward.numAchieved,
      achievedH: gameAward.numAchievedHardcore,
      offset: (achievementsOffset[gameId] || 1) - 1,
      total: gameAward.numPossibleAchievements || 1
    };
  }

  var gameConsole = {};
  for (const game of Object.values(summary.recentlyPlayed || [])) {
    gameConsole[game.gameId] = consoleTable[game.consoleName];
  }
  

  // ------ Étape 3 : Préparation notifications succès ------
  const notifications = [];
  for (const achievement of newAchievements) {

    if (gameProgress[achievement.gameId].total <= 1) continue;

    const percent = Math.min(100, Math.ceil(((gameProgress[achievement.gameId].achieved - gameProgress[achievement.gameId].offset) / gameProgress[achievement.gameId].total) * 100));
    gameProgress[achievement.gameId].offset -= 1;

    const achievementData = {
      id: achievement.id,
      title: achievement.title,
      points: achievement.points,
      description: achievement.description,
      gameTitle: achievement.gameTitle,
      badgeUrl: `/Badge/${achievement.badgeName}.png`,
      progressPercent: percent,
      hardcore: achievement.hardcoreAchieved,
      consoleicon: gameConsole[achievement.gameId]
    }

    if (percent > 0) {
    notifications.push({
      type: "achievement",
      achievementData
    });

    addToHistory(discordId, achievementData);
    updateStats_Points(achievement.points,achievement.hardcoreAchieved);

    log(`✅ ${summary.user} → ${achievement.id} (${percent}% ${achievement.hardcoreAchieved ? 'H' : 'S'} ${getPointsEmoji(achievement.points)})`);
    }
  };
  
  // ------ Étape 4 : Préparation notifications aotw/aotm ------
  for (const achievement of newAchievements) {
    if (aotw?.id && parseInt(achievement.id) === aotw.id && !user.aotwUnlocked) {
    setAotwUnlocked(discordId, true);
    notifications.push({
        type: "aotw",
        title: aotw.title,
        boxArt: aotw.game.boxArt
    });
    log(`🏆 AOTW ${aotw.title} notifié pour ${summary.user}`);
    }

    if (aotm?.id && parseInt(achievement.id) === aotm.id && !user.aotmUnlocked) {
    setAotmUnlocked(discordId, true);
    notifications.push({
        type: "aotm",
        title: aotm.title,
        boxArt: aotm.game.boxArt
    });
    log(`🏅 AOTM ${aotm.title} notifié pour ${summary.user}`);
    }
  }

  // ------ Étape 5 : Préparation notifications mastery/completion ------
  for (const [gameId] of Object.entries(gameProgress)) {
    const total = gameProgress[gameId].total || 0;
    const hardcore = gameProgress[gameId].achievedH|| 0;
    const softcore = gameProgress[gameId].achieved|| 0;
    const gameInfo = summary.recentlyPlayed?.find(g => g.gameId.toString() === gameId);

    if (gameProgress[gameId].total > 0 && gameProgress[gameId].achievedH === gameProgress[gameId].total) {
    notifications.push({
        type: "masteryHardcore",
        gameTitle: gameInfo?.title,
        consoleName: gameInfo?.consoleName,
        boxArt: gameInfo?.imageBoxArt,
        total, hardcore
    });
    changeLatestMaster(discordId,[gameInfo?.imageIcon, true]);
    updateStats_Master("mastery");
    log(`🏅 ${summary.user} a masterisé ${gameInfo?.title}`);
    } else if (gameProgress[gameId].total > 0 && gameProgress[gameId].achieved === gameProgress[gameId].total) {
    notifications.push({
        type: "masterySoftcore",
        gameTitle: gameInfo?.title,
        consoleName: gameInfo?.consoleName,
        boxArt: gameInfo?.imageBoxArt,
        total, softcore
    });
    changeLatestMaster(discordId,[gameInfo?.imageIcon, false]);
    updateStats_Master("completion");
    log(`🏅 ${summary.user} a terminé ${gameInfo?.title}`);
    }
  }

  // ------ Étape 6 : Envoie des notifications ------
  const achievementImageCache = new Map();

  for (const [guildId, guildData] of Object.entries(guildsDB)) {

    if (!guildData.channel || guildData.channel === null) continue;    //Skip si channel pas défini

    const lang = guildData.lang || 'en';
    const channel = await retry(() => client.channels.fetch(guildData.channel.toString()),{ retries: 3, delay: 500 });

    if (!guildData.users.includes(discordId) && guildData.global_notifications) {   //Envoie seulement les notifs globales si pas dans le serveur et notifications activées

      for (const notif of notifications) {

        switch (notif.type) {

          case "achievement":

            if (notif.achievementData.points == 100) {
              const cacheKey = `${notif.achievementData.id}_${lang}`;
              let imageBuffer = achievementImageCache.get(cacheKey);

              if (!imageBuffer) {
                var imageData = notif.achievementData;
                imageData["username"] = summary.user;
                imageData["backgroundImage"] = user.background;
                imageData["textColor"] = user.color;
                imageData["lang"] = lang;
                imageBuffer = await generateAchievementImage(imageData);
                achievementImageCache.set(cacheKey, imageBuffer);
              }

              await channel.send({
                content: t(lang, "globalNotif100points", {username : summary.user}),
                files: [{ attachment: imageBuffer, name: 'achievement.png' }]
              });

            }
        }
      } 
    }            

    else if (guildData.users.includes(discordId)) {                                                  //Envoie des notifs normales
      for (const notif of notifications) {
        switch (notif.type) {
  
          case "achievement":
            const cacheKey = `${notif.achievementData.id}_${lang}`;
            let imageBuffer = achievementImageCache.get(cacheKey);
  
            if (!imageBuffer) {
              var imageData = notif.achievementData;
              imageData["username"] = summary.user;
              imageData["backgroundImage"] = user.background;
              imageData["textColor"] = user.color;
              imageData["lang"] = lang;
              imageBuffer = await generateAchievementImage(imageData);
              achievementImageCache.set(cacheKey, imageBuffer);
            }
  
            await channel.send({
              files: [{ attachment: imageBuffer, name: 'achievement.png' }]
            });
  
            break;
  
          case "aotw":
            await channel.send({
              embeds: [{
                title: t(lang, 'aotwUnlockedTitle'),
                description: t(lang, 'aotwUnlockedDesc', { username: summary.user, title: notif.title }),
                color: 0x2ecc71,
                thumbnail: { url: `https://media.retroachievements.org${notif.boxArt}` },
              }]
            });
            break;
  
          case "aotm":
            await channel.send({
              embeds: [{
                title: t(lang, 'aotmUnlockedTitle'),
                description: t(lang, 'aotmUnlockedDesc', { username: summary.user, title: notif.title }),
                color: 0x3498db,
                thumbnail: { url: `https://media.retroachievements.org${notif.boxArt}` },
              }]
            });
            break;
  
          case "masteryHardcore":
            await channel.send({
              embeds: [{
                title: t(lang, 'gameMasteredTitle'),
                description: t(lang, 'gameMasteredDesc', { username: summary.user, gameTitle: notif.gameTitle, consoleName: notif.consoleName }),
                color: 0xf1c40f,
                footer: { text: t(lang, 'gameMasteredFooter', { hardcore: notif.hardcore, total: notif.total }) },
                timestamp: new Date(),
                image: notif.boxArt ? { url: `https://retroachievements.org${notif.boxArt}` } : undefined,
              }]
            });
            break;
  
          case "masterySoftcore":
            await channel.send({
              embeds: [{
                title: t(lang, 'gameMasteredSoftcoreTitle'),
                description: t(lang, 'gameMasteredSoftcoreDesc', { username: summary.user, gameTitle: notif.gameTitle, consoleName: notif.consoleName }),
                color: 0x8400ff,
                footer: { text: t(lang, 'gameMasteredSoftcoreFooter', { softcore: notif.softcore, total: notif.total }) },
                timestamp: new Date(),
                image: notif.boxArt ? { url: `https://retroachievements.org${notif.boxArt}` } : undefined,
              }]
            });
            break;
        }
      }
    }
  }
}

const userLocks = new Set();

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);

  updatePresence(client);
  setInterval(() => updatePresence(client), 10 * 60 * 1000);

  // Cron toutes les 10 secondes
  cron.schedule('*/10 * * * * *', async () => {
    const usersDB = loadDB('usersdb');
    const now = Date.now();

    for (const [discordId, user] of Object.entries(usersDB)) {
      if (!userCheckState[discordId]) {
        // premier passage → répartir un peu au hasard dans les 3min
        userCheckState[discordId] = {
          lastActivity: 0,
          nextCheckTime: now + Math.floor(Math.random() * CHECK_INTERVAL_COURT)
        };
      }

      if (now >= userCheckState[discordId].nextCheckTime) {
        if (userLocks.has(discordId)) {
          continue;
        }

        userLocks.add(discordId);
        try {
          await checkOneUser(discordId);
        } catch (err) {
          console.error(`❌ Erreur check ${discordId}:`, err);
        } finally {
          userLocks.delete(discordId);
        }

        //Replanification
        if (now - userCheckState[discordId].lastActivity > 48*60*60*1000) {       //Déco depuis 48h -> Replanifie dans 30min
          userCheckState[discordId].nextCheckTime = now + CHECK_INTERVAL_LONG;
        }
        else if (now - userCheckState[discordId].lastActivity > 10*60*1000) {      //Déco depuis 5min -> Replanifie dans 10min
          userCheckState[discordId].nextCheckTime = now + CHECK_INTERVAL_MOYEN;
        }
        else {                                                                    //Déco depuis moins de 5min (ou entrain de jouer) -> Replanifie dans 3min
          userCheckState[discordId].nextCheckTime = now + CHECK_INTERVAL_COURT;
        }
      }
    }
  });

  // Cron hebdo pour AOTW
  cron.schedule('30 1 * * 1', async () => {
    try {
      log('⏰ Lancement du cron hebdo pour mise à jour AOTW');
      await fetchAndStoreAotw();
    } catch (err) {
      console.error('❌ Erreur cron AOTW:', err);
    }
  });

  // Cron mensuel pour AOTM
  cron.schedule('30 1 1-7 * 1', async () => {
    try {
      log('⏰ Lancement du cron mensuel pour mise à jour AOTM');
      resetAotmUnlocked();
    } catch (err) {
      console.error('❌ Erreur cron AOTM:', err);
    }
  });
});

// Quand le bot rejoint un serveur
client.on('guildCreate', guild => {
  const guildsDB = loadDB('guildsdb');

  if (!guildsDB[guild.id]) {
    guildsDB[guild.id] = {
      channel: null,
      lang: "en",
      global_notifications: true,
      users: []
    };
    saveDB(guildsDB, 'guildsdb');
    log(`➕ Ajouté au serveur : ${guild.name} (${guild.id})`);
  }
});

// Quand un membre quitte un serveur
client.on('guildMemberRemove', member => {
  const guildId = member.guild.id;
  const userId = member.user.id;

  const guildsDB = loadDB('guildsdb');
  const guildData = guildsDB[guildId];

  if (!guildData || !Array.isArray(guildData.users)) return;
  guildData.users = guildData.users.filter(id => id !== userId);

  console.log(`👋 ${member.user.tag} a quitté ${member.guild.name}`);

  const userStillInAnyGuild = Object.values(guildsDB).some(guild =>
    Array.isArray(guild.users) && guild.users.includes(userId)
  );

  if (!userStillInAnyGuild) {
    const usersDB = loadDB('usersdb');
    delete usersDB[userId];
    saveDB(usersDB, 'usersdb');

    console.log(`👋 ${member.user.tag} n'est plus dans aucun serveur`);
  }

  saveDB(guildsDB, 'guildsdb');
});

client.login(process.env.DISCORD_TOKEN);