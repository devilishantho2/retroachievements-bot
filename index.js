import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import {
  loadDB,
  saveDB,
  incrementApiCallCount,
  updateStats_Points,
  updateStats_Master
} from './db.js';
import { buildAuthorization, getUserSummary, getAchievementOfTheWeek } from '@retroachievements/api';
import { generateAchievementImage } from './generateImage.js';
import { t } from './locales.js';
import { consoleTable } from './consoleTable.js';
import { retry, log, getPointsEmoji } from './utils.js';
import { addToUserHistory, getAllUsers, getGuildCount, getGuildData, getGuildsWithoutUser, getGuildsWithUser, getUserCount, getUserData, setUserLastAchievement, setUserLastMaster, resetAotmUnlocked, resetAotwUnlocked, setUserAotw, setUserAotm } from './db_v2.js'

config();

// 🔹 Capture des erreurs globales pour éviter les crashs
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
});

const CHECK_INTERVAL_COURT = 10 * 1000; // 3 minutes
const CHECK_INTERVAL_MOYEN = 10 * 1000; // 6 minutes
const CHECK_INTERVAL_LONG = 10 * 1000;  // 30 minutes
const userCheckState = {}; // { discordId: { lastactivity, nextCheckTime } }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
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
  const userCount = getUserCount();
  const guildCount = getGuildCount();

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

  const blacklist = loadDB('bandb')

  const user = getUserData(discordId);
  const aotw = loadDB('aotwdb');
  const aotm = loadDB('aotmdb');

  const guildsWithUser = getGuildsWithUser(discordId);
  const guildsWithoutUser = getGuildsWithoutUser(discordId);
  
  const newAchievements = [];

  const authorization = buildAuthorization({
      username: user.ulid,
      webApiKey: user.ra_api_key
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

  const lastAchievementDate = new Date(user.last_achievement_time);
  const lastAchievementId = user.last_achievement_id;

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
  setUserLastAchievement(discordId, lastNew.id, lastNew.dateAwarded);

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
  const notificationsGlobal = [];
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
      badgeUrl: `/${achievement.badgeName}.png`,
      progressPercent: percent,
      hardcore: achievement.hardcoreAchieved,
      consoleicon: gameConsole[achievement.gameId]
    }

    if (percent > 0) {

      if (achievementData.points == 100) {
        notificationsGlobal.push({type: "achievement100",achievementData})
      };

      notifications.push({type: "achievement",achievementData});

      addToUserHistory(discordId, achievementData);
      updateStats_Points(achievement.points,achievement.hardcoreAchieved);

      log(`✅ ${summary.user} → ${achievement.id} (${percent}% ${achievement.hardcoreAchieved ? 'H' : 'S'} ${getPointsEmoji(achievement.points)})`);
    }
  };
  
  // ------ Étape 4 : Préparation notifications aotw/aotm ------
  for (const achievement of newAchievements) {
    if (aotw?.id && parseInt(achievement.id) === aotw.id && !user.aotw_unlocked) {
    setUserAotw(discordId, 1);
    notifications.push({
        type: "aotw",
        title: aotw.title
    });
    log(`🏆 AOTW ${aotw.title} notifié pour ${summary.user}`);
    }

    if (aotm?.id && parseInt(achievement.id) === aotm.id && !user.aotm_unlocked) {
    setUserAotm(discordId, 1);
    notifications.push({
        type: "aotm",
        title: aotm.title
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
    setUserLastMaster(discordId,gameInfo?.imageIcon?.replace('/Images/', ''), 1);
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
    setUserLastMaster(discordId,gameInfo?.imageIcon?.replace('/Images/', ''), 0);
    updateStats_Master("completion");
    log(`🏅 ${summary.user} a terminé ${gameInfo?.title}`);
    }
  }

  if (blacklist.includes(discordId)) return;

  // ------ Étape 6 : Envoie des notifications normales ------
  const achievementImageCache = new Map();

  for (const guildId of guildsWithUser) {
    const guildData = getGuildData(guildId);
    if (guildData.channel_id === null) continue;    //Skip si channel pas défini

    const lang = guildData.lang || 'en';
    const channel = await retry(() => client.channels.fetch(guildData.channel_id.toString()),{ retries: 3, delay: 500 });           

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
              color: 0x2ecc71
            }]
          });
          break;

        case "aotm":
          await channel.send({
            embeds: [{
              title: t(lang, 'aotmUnlockedTitle'),
              description: t(lang, 'aotmUnlockedDesc', { username: summary.user, title: notif.title }),
              color: 0x3498db
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

  // ------ Étape 6 : Envoie des notifications globales ------
  if (notificationsGlobal.length === 0) return;
  for (const guildId of guildsWithoutUser) {
    const guildData = getGuildData(guildId);
    if (notificationsGlobal.length === 0) continue;
    if (!guildData.channel || guildData.channel === null) continue;     //Skip si channel pas défini
    if (!guildData.global_notifications) continue;                      //Skip si guild a les notifs globales désactivées

    const lang = guildData.lang || 'en';
    const channel = await retry(() => client.channels.fetch(guildData.channel.toString()),{ retries: 3, delay: 500 });

    for (const notif of notificationsGlobal) {
      switch (notif.type) {

        case "achievement100":
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

          break;
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
    const now = Date.now();

    const userIds = getAllUsers();
    for (const discordId of userIds) {
      if (!userCheckState[discordId]) {
        // premier passage → répartir un peu au hasard dans les 6min
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
        else if (now - userCheckState[discordId].lastActivity > 10*60*1000) {      //Déco depuis 10min -> Replanifie dans 6min
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

client.login(process.env.DISCORD_TOKEN);