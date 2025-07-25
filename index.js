// index.js
import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import cron from 'node-cron';
import {
  getUsers,
  setLastAchievement,
  setAotwUnlocked,
  resetAotwUnlocked,
  setAotwInfo,
  getAotwInfo,
  setAotmUnlocked,
  resetAotmUnlocked,
  getAotmInfo,
} from './db.js';
import {
  buildAuthorization,
  getUserRecentAchievements,
  getUserSummary,
  getAchievementOfTheWeek,
} from '@retroachievements/api';

config();

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
    log('❌ Erreur lors de la commande : ' + error);
    await interaction.reply({ content: 'Erreur pendant l’exécution.', ephemeral: true });
  }
});

let logChannel = null;
async function log(message) {
  console.log(message);
  try {
    if (!logChannel) {
      const guild = await client.guilds.fetch(process.env.LOG_GUILD_ID);
      logChannel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID);
    }
    const finalMessage = typeof message === 'string'
      ? message
      : '📝 Log : ' + (message instanceof Error ? message.stack : JSON.stringify(message));
    await logChannel.send(finalMessage.slice(0, 2000));
  } catch (err) {
    console.error('❌ Erreur log Discord :', err);
  }
}

// 🔁 Retry avec backoff exponentiel
async function retry(fn, retries = 3, delay = 500, userLabel = '') {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) {
        log(`❌ Échec après ${retries} tentatives${userLabel ? ` pour ${userLabel}` : ''} : ${err.message || err}`);
        throw err;
      }
      log(`⏳ Tentative ${attempt}/${retries} échouée${userLabel ? ` pour ${userLabel}` : ''}, nouvelle tentative dans ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

async function fetchAndStoreAotw() {
  const authorization = buildAuthorization({ username: process.env.RA_USERNAME, webApiKey: process.env.RA_API_KEY });
  try {
    const response = await retry(() => getAchievementOfTheWeek(authorization), 3, 500);
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

async function checkAllUsers() {
  const users = getUsers();
  const aotw = getAotwInfo();
  const aotm = getAotmInfo();
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  for (const user of users) {
    const authorization = buildAuthorization({ username: user.raUsername, webApiKey: user.raApiKey });

    let allRecent, summary;
    try {
      allRecent = await retry(() =>
        getUserRecentAchievements(authorization, { username: user.raUsername }),
        3, 500, user.raUsername
      );
      summary = await retry(() =>
        getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
        3, 500, user.raUsername
      );
    } catch (err) {
      continue; // erreur déjà loguée, on passe au suivant
    }

    if (!allRecent || allRecent.length === 0) continue;

    const newAchievements = [];
    for (const achievement of allRecent) {
      if (achievement.achievementId === user.lastAchievement) break;
      newAchievements.push(achievement);
    }
    if (newAchievements.length === 0) continue;

    newAchievements.reverse();

    for (const achievement of newAchievements) {
      const gameAward = summary.awarded?.[achievement.gameId];
      const num = gameAward?.numAchieved || 0;
      const total = gameAward?.numPossibleAchievements || 1;
      const percent = Math.min(100, Math.ceil((num / total) * 100));
      const progressImage = `https://raw.githubusercontent.com/devilishantho2/retroachievements-bot/refs/heads/main/sprites/${percent}.png`;

      const embed = {
        title: `🏆 ${achievement.title} (${achievement.points})`,
        description: `**${user.raUsername}** a débloqué :\n*[${achievement.description}](https://retroachievements.org/achievement/${achievement.achievementId})*`,
        color: parseInt(user.color?.replace('#', '') || '3498db', 16),
        thumbnail: { url: `https://media.retroachievements.org${achievement.badgeUrl}` },
        image: { url: progressImage },
        footer: {
          text: `Jeu : ${achievement.gameTitle} | ${num}/${total} succès`,
        },
        timestamp: new Date(achievement.date),
      };

      await channel.send({ embeds: [embed] });
      log(`✅ ${user.raUsername} → succès ${achievement.achievementId} (${percent}%)`);

      if (aotw?.id && parseInt(achievement.achievementId) === aotw.id && !user.aotwUnlocked) {
        setAotwUnlocked(user.discordId, true);
        await channel.send({
          embeds: [{
            title: `🎉 AOTW débloqué !`,
            description: `**${user.raUsername}** a débloqué le succès de la semaine : **${aotw.title}** !`,
            color: 0x2ecc71,
            thumbnail: { url: `https://media.retroachievements.org${achievement.badgeUrl}` },
            footer: { text: `Félicitations !` },
            timestamp: new Date(),
          }],
        });
        log(`🏅 ${user.raUsername} a débloqué l'AOTW !`);
      }

      if (aotm?.id && parseInt(achievement.achievementId) === aotm.id && !user.aotmUnlocked) {
        setAotmUnlocked(user.discordId, true);
        await channel.send({
          embeds: [{
            title: `🎉 AOTM débloqué !`,
            description: `**${user.raUsername}** a débloqué le succès du mois : **${aotm.title}** !`,
            color: 0x3498db,
            thumbnail: { url: `https://media.retroachievements.org${achievement.badgeUrl}` },
            footer: { text: `Bravo !` },
            timestamp: new Date(),
          }],
        });
        log(`🏅 ${user.raUsername} a débloqué l'AOTM !`);
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

      if (hardcore === total && total > 0) {
        const gameInfo = summary.recentlyPlayed?.find(g => g.gameId.toString() === gameId);
        const gameTitle = gameInfo?.title || `Jeu ${gameId}`;
        const consoleName = gameInfo?.consoleName || '';
        const boxArtUrl = gameInfo?.imageBoxArt ? `https://retroachievements.org${gameInfo.imageBoxArt}` : null;

        await channel.send({
          embeds: [{
            title: `🎮 Jeu masterisé !`,
            description: `**${user.raUsername}** a masterisé le jeu **${gameTitle}** ${consoleName ? `(${consoleName})` : ''}`,
            color: 0xf1c40f,
            footer: { text: `Jeu : ${gameTitle} | Masterisé avec ${hardcore}/${total} succès` },
            timestamp: new Date(),
            image: { url: boxArtUrl },
          }],
        });

        log(`🏅 ${user.raUsername} a masterisé ${gameTitle}`);
      }
    }

    setLastAchievement(user.discordId, newAchievements.at(-1).achievementId);
  }
}

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);
  const users = getUsers();
  client.user.setPresence({
    activities: [{ name: `les succès de ${users.length} joueur${users.length > 1 ? 's' : ''}.`, type: ActivityType.Watching }],
    status: 'online',
  });

  cron.schedule('0 5 * * 1', async () => {
    log('🕔 Mise à jour hebdo AOTW...');
    await fetchAndStoreAotw();
  });

  setInterval(async () => {
    try {
      await checkAllUsers();
    } catch (err) {
      log(`❌ Erreur dans checkAllUsers : ${err.message || err}`);
    }
  }, 30 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
