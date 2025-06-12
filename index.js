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
  getAchievementOfTheWeek,
  getRecentGameAwards,
} from '@retroachievements/api';

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

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

// Logger dans console + salon distant
let logChannel = null;
async function log(message) {
  console.log(message);

  try {
    if (!logChannel) {
      const guild = await client.guilds.fetch(process.env.LOG_GUILD_ID);
      logChannel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID);
    }
    await logChannel.send(typeof message === 'string' ? message : '📝 Log : ' + JSON.stringify(message));
  } catch (err) {
    console.error('❌ Erreur lors de l’envoi du log dans le salon Discord :', err);
  }
}

async function fetchAndStoreAotw() {
  const authorization = buildAuthorization({
    username: process.env.RA_USERNAME,
    webApiKey: process.env.RA_API_KEY,
  });

  try {
    const response = await getAchievementOfTheWeek(authorization);
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
    log('📌 AOTW mis à jour avec succès : ' + aotw.title);
  } catch (err) {
    log('❌ Impossible de récupérer l’AOTW : ' + err);
  }
}

async function checkAllUsers() {
  const users = getUsers();
  const aotw = getAotwInfo();
  const aotm = getAotmInfo();
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  for (const user of users) {
    const allRecent = await getUserRecentAchievements(
      buildAuthorization({ username: user.raUsername, webApiKey: user.raApiKey }),
      { username: user.raUsername }
    );

    if (!allRecent || allRecent.length === 0) continue;

    const newAchievements = [];

    for (const achievement of allRecent) {
      if (achievement.achievementId === user.lastAchievement) break;
      newAchievements.push(achievement);
    }

    if (newAchievements.length === 0) continue;

    newAchievements.reverse();

    for (const achievement of newAchievements) {
      const embed = {
        title: `🏆 ${achievement.title} (${achievement.points})`,
        description: `**${user.raUsername}** a débloqué :\n*[${achievement.description}](https://retroachievements.org/achievement/${achievement.achievementId})*`,
        color: parseInt(user.color?.replace('#', '') || '3498db', 16),
        thumbnail: {
          url: `https://media.retroachievements.org${achievement.badgeUrl}`,
        },
        footer: {
          text: `Jeu : ${achievement.gameTitle} | ID: ${achievement.achievementId}`,
        },
        timestamp: new Date(achievement.date),
      };

      await channel.send({ embeds: [embed] });
      log(`✅ ${user.raUsername} → succès ${achievement.achievementId}`);

      if (
        aotw?.id &&
        parseInt(achievement.achievementId) === aotw.id &&
        !user.aotwUnlocked
      ) {
        setAotwUnlocked(user.discordId, true);

        const congratsEmbed = {
          title: `🎉 AOTW débloqué !`,
          description: `**${user.raUsername}** a débloqué le succès de la semaine : **${aotw.title}** !`,
          color: 0x2ecc71,
          thumbnail: {
            url: `https://media.retroachievements.org${achievement.badgeUrl}`,
          },
          footer: {
            text: `Félicitations !`,
          },
          timestamp: new Date(),
        };

        await channel.send({ embeds: [congratsEmbed] });
        log(`🏅 ${user.raUsername} a débloqué l'AOTW !`);
      }

      if (
        aotm?.id &&
        parseInt(achievement.achievementId) === aotm.id &&
        !user.aotmUnlocked
      ) {
        setAotmUnlocked(user.discordId, true);

        const congratsEmbed = {
          title: `🎉 AOTM débloqué !`,
          description: `**${user.raUsername}** a débloqué le succès du mois : **${aotm.title}** !`,
          color: 0x3498db,
          thumbnail: {
            url: `https://media.retroachievements.org${achievement.badgeUrl}`,
          },
          footer: {
            text: `Bravo !`,
          },
          timestamp: new Date(),
        };

        await channel.send({ embeds: [congratsEmbed] });
        log(`🏅 ${user.raUsername} a débloqué l'AOTM !`);
      }
    }

    setLastAchievement(user.discordId, newAchievements[newAchievements.length - 1].achievementId);
  }
}

let lastAwardUser = null;

async function checkRecentGameAwards() {
  const authorization = buildAuthorization({
    username: process.env.RA_USERNAME,
    webApiKey: process.env.RA_API_KEY,
  });

  try {
    const { results } = await getRecentGameAwards(authorization);
    if (!results || results.length === 0) return;

    const latest = results[0];
    const users = getUsers();
    const channel = await client.channels.fetch(process.env.CHANNEL_ID);

    const matched = users.find(u => u.raUsername.toLowerCase() === latest.user.toLowerCase());
    if (!matched) return;

    if (lastAwardUser === `${latest.user}_${latest.gameId}_${latest.awardKind}`) return;
    lastAwardUser = `${latest.user}_${latest.gameId}_${latest.awardKind}`;

    const embed = {
      title: `🎮 ${latest.awardKind === 'mastered' ? 'Jeu masterisé !' : 'Jeu terminé !'}`,
      description: `**${matched.raUsername}** a ${latest.awardKind === 'mastered' ? 'masterisé' : 'terminé'} le jeu **${latest.gameTitle}** (${latest.consoleName})`,
      color: latest.awardKind === 'mastered' ? 0xf1c40f : 0xffe370,
      footer: {
        text: `Jeu : ${latest.gameTitle} | Type : ${latest.awardKind}`,
      },
      timestamp: new Date(latest.awardDate),
    };

    await channel.send({ embeds: [embed] });
    log(`🏅 ${matched.raUsername} a ${latest.awardKind} ${latest.gameTitle}`);
  } catch (err) {
    log('❌ Erreur lors du check des récompenses de jeu : ' + err);
  }
}

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);

  const users = getUsers();
  client.user.setPresence({
    activities: [
      {
        name: `les succès de ${users.length} joueur${users.length > 1 ? 's' : ''}.`,
        type: ActivityType.Watching,
      },
    ],
    status: 'online',
  });

  cron.schedule('0 5 * * 1', async () => {
    log('🕔 Mise à jour hebdomadaire de l’AOTW...');
    await fetchAndStoreAotw();
  });

  setInterval(async () => {
    await checkAllUsers();
    await checkRecentGameAwards();
  }, 30 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
