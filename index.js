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
} from './db.js';
import {
  buildAuthorization,
  getUserRecentAchievements,
  getUserSummary,
  getAchievementOfTheWeek,
} from '@retroachievements/api';
import { generateAchievementImage } from './generateImage.js';

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

function updatePresence(client) {
  const usersDB = loadDB('usersdb');
  const userCount = Object.keys(usersDB).length;

  client.user.setActivity(`les succès de ${userCount} personne${userCount > 1 ? 's' : ''}`, {
    type: ActivityType.Watching
  });
}

// 🔁 Retry avec backoff exponentiel (inchangé)
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

// *** Fonction modifiée pour gérer multi-guildes et nouvelle DB ***

async function checkAllUsers() {
  const guildsDB = loadDB('guildsdb'); // objet { guildId: { channel, users: [discordId] } }
  const usersDB = loadDB('usersdb');   // objet { discordId: { raUsername, raApiKey, lastAchievement, ... } }
  const aotw = getAotwInfo();
  const aotm = getAotmInfo();

  for (const [guildId, guildData] of Object.entries(guildsDB)) {
    if (!guildData.channel || guildData.channel === 0) {
      log(`⚠️ Guild ${guildId} sans salon défini, on skip.`);
      continue;
    }
    let channel;
    try {
      channel = await client.channels.fetch(guildData.channel.toString());
    } catch (e) {
      log(`⚠️ Impossible de récupérer le salon ${guildData.channel} pour la guild ${guildId} : ${e.message}`);
      continue;
    }

    for (const discordId of guildData.users) {
      const user = usersDB[discordId];
      if (!user) {
        log(`⚠️ Utilisateur ${discordId} listé dans guild ${guildId} mais absent de usersDB`);
        continue;
      }

      const authorization = buildAuthorization({ username: user.raUsername, webApiKey: user.raApiKey });

      let allRecent, summary;
      try {
        // On récupère les succès récents et résumé
        allRecent = await retry(() =>
          getUserRecentAchievements(authorization, { username: user.raUsername }),
          3, 500, user.raUsername
        );
        summary = await retry(() =>
          getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
          3, 500, user.raUsername
        );
      } catch (err) {
        continue; // erreur déjà loguée
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
            hardcore: achievement.hardcoreMode
          });

          await channel.send({
            files: [{ attachment: imageBuffer, name: 'achievement.png' }]
          });
        } else {
          log(`📎 ${user.raUsername} → succès ${achievement.achievementId} ignoré pour envoi (percent = 0)`);
        }

        log(`✅ ${user.raUsername} → succès ${achievement.achievementId} (${percent}%)`);

        if (aotw?.id && parseInt(achievement.achievementId) === aotw.id && !user.aotwUnlocked) {
          setAotwUnlocked(discordId, true);
          await channel.send({
            embeds: [{
              title: `🎉 AOTW débloqué !`,
              description: `**${user.raUsername}** a débloqué le succès de la semaine : **${aotw.title}** !`,
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
              title: `🏅 AOTM débloqué !`,
              description: `**${user.raUsername}** a débloqué le succès du mois : **${aotm.title}** !`,
              color: 0x3498db,
              thumbnail: { url: `https://media.retroachievements.org${aotm.game.boxArt}` },
            }]
          });
          log(`🏅 AOTM ${aotm.title} notifié pour ${user.raUsername}`);
        }

        setLastAchievement(discordId, achievement.achievementId);
      }
    }
  }
}

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);

  // Affiche la liste des guilds et leur salons pour debug
  const guildsDB = loadDB('guildsdb');

  updatePresence(client); // Mise à jour initiale

  // Met à jour la présence toutes les 5 minutes
  setInterval(() => updatePresence(client), 10 * 60 * 1000);

  // Ne pas fetch AOTW ici pour ne pas écraser la donnée actuelle
  // fetchAndStoreAotw();

  await checkAllUsers();
  cron.schedule('*/30 * * * * *', checkAllUsers);

  // Cron hebdo AOTW lundi 5h
  cron.schedule('0 5 * * 1', async () => {
    log('⏰ Lancement du cron hebdo pour mise à jour AOTW');
    await fetchAndStoreAotw();
  });
});


client.login(process.env.DISCORD_TOKEN);
