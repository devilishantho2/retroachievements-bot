// index.js
import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import {
  loadDB,
  setLastAchievement,
  setAotwUnlocked,
  resetAotwUnlocked,
  setAotwInfo,
  getAotwInfo,
  setAotmUnlocked,
  getAotmInfo,
  incrementApiCallCount,
} from './db.js';
import {
  buildAuthorization,
  getUserRecentAchievements,
  getUserSummary,
  getAchievementOfTheWeek,
} from '@retroachievements/api';
import { generateAchievementImage } from './generateImage.js';
import { t } from './locales.js';

config();

// 🔹 Capture des erreurs globales pour éviter les crashs
process.on('uncaughtException', err => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', reason => {
  console.error('❌ Unhandled Rejection:', reason);
});

const CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
const userCheckState = {}; // { discordId: { nextCheckTime } }

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

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

async function log(message) {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const prefix = `${time} - `;
  const fullMessage = typeof message === 'string'
    ? `${prefix}${message}`
    : `${prefix}📝 Log : ${message instanceof Error ? message.stack : JSON.stringify(message)}`;

  console.log(fullMessage);

  try {
    const guild = await retry(
      () => client.guilds.fetch(process.env.LOG_GUILD_ID),
      { retries: 3, delay: 500 }
    );
    const channel = await retry(
      () => guild.channels.fetch(process.env.LOG_CHANNEL_ID),
      { retries: 3, delay: 500 }
    );
    await retry(
      () => channel.send(fullMessage.slice(0, 2000)),
      { retries: 3, delay: 500 }
    );    
  } catch (err) {
    if (err.code === 'EAI_AGAIN' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      console.warn(`${prefix}⚠️ Discord inaccessible, log ignoré (erreur réseau temporaire).`);
    } else {
      console.error(`${prefix}❌ Erreur log Discord :`, err);
    }
  }
}

function updatePresence(client) {
  const usersDB = loadDB('usersdb');
  const userCount = Object.keys(usersDB).length;

  client.user.setActivity(`les succès de ${userCount} personne${userCount > 1 ? 's' : ''}`, {
    type: ActivityType.Watching
  });
}

async function retry(fn, {
  retries = 3,
  delay = 500,
  userLabel = '',
  errorFilter = null
} = {}) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const shouldRetry = !errorFilter || errorFilter(err);

      if (!shouldRetry || attempt >= retries) {
        console.error(`❌ Échec après ${retries} tentatives${userLabel ? ` pour ${userLabel}` : ''} : ${err.message || err}`);
        throw err;
      }

      console.warn(`⏳ Tentative ${attempt}/${retries} échouée${userLabel ? ` pour ${userLabel}` : ''}, nouvelle tentative dans ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

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
      game: response.game,
    };
    setAotwInfo(aotw);
    resetAotwUnlocked();
    log('📌 AOTW mis à jour : ' + aotw.title);
  } catch (err) {
    log('❌ Erreur fetch AOTW (après retry) : ' + (err.message || err));
  }
}

async function checkOneUser(discordId, user) {
  const guildsDB = loadDB('guildsdb');
  const usersDB = loadDB('usersdb');
  const aotw = getAotwInfo();
  const aotm = getAotmInfo();
  const now = Date.now();

  const newAchievements = [];
  let summary;

  const authorization = buildAuthorization({
    username: user.raUsername,
    webApiKey: user.raApiKey
  });

  let allRecent;
  try {
    allRecent = await retry(
      () => getUserRecentAchievements(authorization, { username: user.raUsername }),
      { retries: 3, delay: 500, userLabel: user.raUsername }
    );    
    incrementApiCallCount();
  } catch (err) {
    return;
  }

  if (!allRecent || allRecent.length === 0) {
    return;
  }

  for (const achievement of allRecent) {
    if (achievement.achievementId === user.lastAchievement) break;
    newAchievements.push(achievement);
  }

  if (newAchievements.length === 0) {
    return;
  }
  newAchievements.reverse();

  try {
    summary = await retry(
      () => getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
      { retries: 3, delay: 500, userLabel: user.raUsername }
    );    
    incrementApiCallCount();
  } catch (err) {
    log(`⚠️ Impossible de récupérer le résumé pour ${user.raUsername}, on saute les notifs.`);
    return;
  }

  setLastAchievement(discordId, newAchievements[newAchievements.length - 1].achievementId);

  for (const [guildId, guildData] of Object.entries(guildsDB)) {
    if (!guildData.users.includes(discordId)) continue;
    if (!guildData.channel || guildData.channel === 0) continue;

    const lang = guildData.lang || 'en';
    const channel = await retry(
      () => client.channels.fetch(guildData.channel.toString()),
      { retries: 3, delay: 500 }
    );    

    const progressSimulated = {};
    for (const [gameId, gameAward] of Object.entries(summary.awarded || {})) {
      progressSimulated[gameId] = {
        achieved: gameAward.numAchieved || 0,
        total: gameAward.numPossibleAchievements || 1
      };
    }

    for (const achievement of newAchievements) {
      const gameAward = summary.awarded?.[achievement.gameId];
      const num = gameAward?.numAchieved || 0;
      const total = gameAward?.numPossibleAchievements || 1;

      const gameId = achievement.gameId;
      const gameProgress = progressSimulated[gameId] || { achieved: 0, total: 1 };

      if (gameProgress.total === 0 || gameProgress.total === 1) {
        continue;
      }

      gameProgress.achieved += 1;

      const percent = Math.min(100, Math.ceil((gameProgress.achieved / gameProgress.total) * 100));

      if (percent > 0) {
        const imageBuffer = await generateAchievementImage({
          title: achievement.title,
          points: achievement.points,
          username: user.raUsername,
          description: achievement.description,
          gameTitle: achievement.gameTitle,
          badgeUrl: achievement.badgeUrl,
          progressPercent: percent,
          backgroundImage: user.background,
          textColor: user.color,
          hardcore: achievement.hardcoreMode,
          lang: lang
        });

        await channel.send({
          files: [{ attachment: imageBuffer, name: 'achievement.png' }]
        });
      } else {
        log(`📎 ${user.raUsername} → succès ${achievement.achievementId} ignoré (0%)`);
      }

      log(`✅ ${user.raUsername} → succès ${achievement.achievementId} (${percent}%)`);

      if (aotw?.id && parseInt(achievement.achievementId) === aotw.id && !user.aotwUnlocked) {
        setAotwUnlocked(discordId, true);
        await channel.send({
          embeds: [{
            title: t(lang, 'aotwUnlockedTitle'),
            description: t(lang, 'aotwUnlockedDesc', { username: user.raUsername, title: aotw.title }),
            color: 0x2ecc71,
            thumbnail: { url: `https://media.retroachievements.org${aotw.game.boxArt}` },
          }]
        });
        log(`🏆 AOTW ${aotw.title} notifié pour ${user.raUsername}`);
      }

      if (aotm?.id && parseInt(achievement.achievementId) === aotm.id && !user.aotmUnlocked) {
        setAotmUnlocked(discordId, true);
        await channel.send({
          embeds: [{
            title: t(lang, 'aotmUnlockedTitle'),
            description: t(lang, 'aotmUnlockedDesc', { username: user.raUsername, title: aotm.title }),
            color: 0x3498db,
            thumbnail: { url: `https://media.retroachievements.org${aotm.game.boxArt}` },
          }]
        });
        log(`🏅 AOTM ${aotm.title} notifié pour ${user.raUsername}`);
      }
    }

    const achievedPerGame = {};
    for (const a of newAchievements) {
      achievedPerGame[a.gameId] = (achievedPerGame[a.gameId] || 0) + 1;
    }

    for (const [gameId, _] of Object.entries(achievedPerGame)) {
      const gameAward = summary.awarded?.[gameId];
      const total = gameAward?.numPossibleAchievements || 0;
      const hardcore = gameAward?.numAchievedHardcore || 0;
      const softcore = gameAward?.numAchieved || 0;

      if (hardcore === total && total > 0) {
        const gameInfo = summary.recentlyPlayed?.find(g => g.gameId.toString() === gameId);
        const gameTitle = gameInfo?.title || `Jeu ${gameId}`;
        const consoleName = gameInfo?.consoleName || '';
        const boxArtUrl = gameInfo?.imageBoxArt
          ? `https://retroachievements.org${gameInfo.imageBoxArt}`
          : null;

        await channel.send({
          embeds: [{
            title: t(lang, 'gameMasteredTitle'),
            description: t(lang, 'gameMasteredDesc', { username: user.raUsername, gameTitle: gameTitle, consoleName: consoleName }),
            color: 0xf1c40f,
            footer: {text : t(lang, 'gameMasteredFooter', { hardcore: hardcore, total: total })},
            timestamp: new Date(),
            image: boxArtUrl ? { url: boxArtUrl } : undefined,
          }]
        });

        log(`🏅 ${user.raUsername} a masterisé ${gameTitle}`);
      }
      else if (softcore === total && total > 0) {
        const gameInfo = summary.recentlyPlayed?.find(g => g.gameId.toString() === gameId);
        const gameTitle = gameInfo?.title || `Jeu ${gameId}`;
        const consoleName = gameInfo?.consoleName || '';
        const boxArtUrl = gameInfo?.imageBoxArt
          ? `https://retroachievements.org${gameInfo.imageBoxArt}`
          : null;

        await channel.send({
          embeds: [{
            title: t(lang, 'gameMasteredSoftcoreTitle'),
            description: t(lang, 'gameMasteredSoftcoreDesc', { username: user.raUsername, gameTitle: gameTitle, consoleName: consoleName }),
            color: 0x8400ff,
            footer: {text : t(lang, 'gameMasteredSoftcoreFooter', { softcore: softcore, total: total })},
            timestamp: new Date(),
            image: boxArtUrl ? { url: boxArtUrl } : undefined,
          }]
        });

        log(`🏅 ${user.raUsername} a masterisé ${gameTitle}`);
      }
    }
  }
}

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);

  updatePresence(client);
  setInterval(() => updatePresence(client), 10 * 60 * 1000);

  cron.schedule('*/10 * * * * *', async () => {
    const usersDB = loadDB('usersdb');
    const now = Date.now();
  
    for (const [discordId, user] of Object.entries(usersDB)) {
      if (!userCheckState[discordId]) {
        // premier passage → répartir un peu au hasard dans les 3min
        userCheckState[discordId] = {
          nextCheckTime: now + Math.floor(Math.random() * CHECK_INTERVAL)
        };
      }
  
      if (now >= userCheckState[discordId].nextCheckTime) {
        try {
          await checkOneUser(discordId, user);
        } catch (err) {
          console.error(`❌ Erreur check ${user.raUsername}:`, err);
        }
        // replanifie dans 3min
        userCheckState[discordId].nextCheckTime = now + CHECK_INTERVAL;
      }
    }
  });  

  cron.schedule('0 5 * * 1', async () => {
    try {
      log('⏰ Lancement du cron hebdo pour mise à jour AOTW');
      await fetchAndStoreAotw();
    } catch (err) {
      console.error('❌ Erreur cron AOTW:', err);
    }
  });

});

client.login(process.env.DISCORD_TOKEN);
