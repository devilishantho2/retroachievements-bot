// index.js
import { Client, GatewayIntentBits, Collection } from 'discord.js';
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
  getAotwInfo
} from './db.js';
import {
  buildAuthorization,
  getUserRecentAchievements,
  getAchievementOfTheWeek,
  getRecentGameAwards
} from '@retroachievements/api';

config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// Chargement des commandes slash
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
    console.error('❌ Erreur lors de la commande :', error);
    await interaction.reply({ content: 'Erreur pendant l’exécution.', ephemeral: true });
  }
});

async function fetchLatestAchievement(raUsername, raApiKey) {
  const authorization = buildAuthorization({
    username: raUsername,
    webApiKey: raApiKey,
  });

  try {
    const recent = await getUserRecentAchievements(authorization, {
      username: raUsername,
    });

    return recent[0] || null;
  } catch (err) {
    console.error(`❌ Erreur API pour ${raUsername}:`, err);
    return null;
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
    };

    setAotwInfo(aotw);
    resetAotwUnlocked();
    console.log('📌 AOTW mis à jour avec succès :', aotw.title);
  } catch (err) {
    console.error('❌ Impossible de récupérer l’AOTW :', err);
  }
}

async function checkAllUsers() {
  const users = getUsers();
  const aotw = getAotwInfo();
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  for (const user of users) {
    const latest = await fetchLatestAchievement(user.raUsername, user.raApiKey);
    if (!latest) continue;

    if (user.lastAchievement === latest.achievementId) continue;

    const embed = {
      title: `🏆 ${latest.title}`,
      description: `**${user.raUsername}** a débloqué :\n*${latest.description}*`,
      color: parseInt(user.color?.replace('#', '') || '3498db', 16),
      thumbnail: {
        url: `https://media.retroachievements.org${latest.badgeUrl}`,
      },
      footer: {
        text: `Jeu : ${latest.gameTitle} | ID: ${latest.achievementId}`,
      },
      timestamp: new Date(latest.date),
    };

    await channel.send({ embeds: [embed] });
    console.log(`✅ ${user.raUsername} → succès ${latest.achievementId}`);
    setLastAchievement(user.discordId, latest.achievementId);

    if (
      aotw?.id &&
      parseInt(latest.achievementId) === aotw.id &&
      !user.aotwUnlocked
    ) {
      setAotwUnlocked(user.discordId, true);

      const congratsEmbed = {
        title: `🎉 AOTW débloqué !`,
        description: `**${user.raUsername}** a débloqué le succès de la semaine : **${aotw.title}** !`,
        color: 0x2ecc71,
        thumbnail: {
          url: `https://media.retroachievements.org${latest.badgeUrl}`,
        },
        footer: {
          text: `Félicitations !`,
        },
        timestamp: new Date(),
      };

      await channel.send({ embeds: [congratsEmbed] });
      console.log(`🏅 ${user.raUsername} a débloqué l'AOTW !`);
    }
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
    console.log(`🏅 ${matched.raUsername} a ${latest.awardKind} ${latest.gameTitle}`);
  } catch (err) {
    console.error('❌ Erreur lors du check des récompenses de jeu :', err);
  }
}

// Lancement du bot
client.once('ready', async () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  await fetchAndStoreAotw();

  cron.schedule('0 5 * * 1', async () => {
    console.log('🕔 Mise à jour hebdomadaire de l’AOTW...');
    await fetchAndStoreAotw();
  });

  setInterval(async () => {
    await checkAllUsers();
    await checkRecentGameAwards();
  }, 30 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
