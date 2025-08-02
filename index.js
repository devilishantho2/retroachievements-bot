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

config();

const FAST_DELAY = 30*1000;
const SLOW_DELAY = 5*60*1000;
const ONLINE_DELAY = 5*60*1000;

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

async function log(message) {
  const now = new Date();
  const time = now.toTimeString().split(' ')[0];
  const prefix = `${time} - `;
  const fullMessage = typeof message === 'string'
    ? `${prefix}${message}`
    : `${prefix}📝 Log : ${message instanceof Error ? message.stack : JSON.stringify(message)}`;

  console.log(fullMessage);

  try {
    const guild = await client.guilds.fetch(process.env.LOG_GUILD_ID);
    const channel = await guild.channels.fetch(process.env.LOG_CHANNEL_ID);
    await channel.send(fullMessage.slice(0, 2000));
  } catch (err) {
    console.error(`${prefix}❌ Erreur log Discord :`, err);
  }
}

function updatePresence(client) {
  const usersDB = loadDB('usersdb');
  const userCount = Object.keys(usersDB).length;

  client.user.setActivity(`les succès de ${userCount} personne${userCount > 1 ? 's' : ''}`, {
    type: ActivityType.Watching
  });
}

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

const userCheckState = {};

async function checkAllUsers() {
  const guildsDB = loadDB('guildsdb');
  const usersDB = loadDB('usersdb');
  const aotw = getAotwInfo();
  const aotm = getAotmInfo();
  const now = Date.now();

  for (const [guildId, guildData] of Object.entries(guildsDB)) {                                                                //FOR ALL GUILDS

    if (!guildData.channel || guildData.channel === 0) {                                                                        //CHECK SI CHANNEL DEFINI
      log(`⚠️ Guild ${guildId} sans salon défini, on skip.`);
      continue;
    }

    let channel;                                                                                                                //CHECK SI CHANNEL ACCESSIBLE
    try {
      channel = await client.channels.fetch(guildData.channel.toString());
    } catch (e) {
      log(`⚠️ Impossible de récupérer le salon ${guildData.channel} pour la guild ${guildId} : ${e.message}`);
      continue;
    }

    for (const discordId of guildData.users) {                                                                                  //FOR ALL USERS
      const newAchievements = [];
      let summary;
      const user = usersDB[discordId];
      if (!user) {
        log(`⚠️ Utilisateur ${discordId} listé dans guild ${guildId} mais absent de usersDB`);
        continue;
      }

      if (!userCheckState[discordId]) {                                                                                         //CREE DONNEES SI INEXISTANTES
        userCheckState[discordId] = {
          lastAchievementTime: 0,
          nextCheckTime: 0,
          nextOnlineCheckTime: 0,
          isFastPolling: false,
          isSummaryReady: false
        };
      }

      const nextCheck = userCheckState[discordId].nextCheckTime;                                                                //RECUPERE LES DONNEES
      const nextOnlineCheck = userCheckState[discordId].nextOnlineCheckTime;
      const fastpolling = userCheckState[discordId].isFastPolling;
      const summaryready = userCheckState[discordId].isSummaryReady;
      userCheckState[discordId].isSummaryReady = false;

      if (!fastpolling) {                                                                                                               //SI LENT
        if (now < nextCheck) continue;                                                                                          //SI PAS ENCORE BESOIN DE CHECK SKIP

        const authorization = buildAuthorization({                                                                              //BUILD AUTHORIZATION
          username: user.raUsername,
          webApiKey: user.raApiKey
        });
  
        let allRecent;                                                                                                          //GET RECENT CHEEVOS
        try {
          allRecent = await retry(() =>
            getUserRecentAchievements(authorization, { username: user.raUsername }),
            3, 500, user.raUsername
          );
          incrementApiCallCount();
        } catch (err) {
          userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
          continue;
        }
  
        if (!allRecent || allRecent.length === 0) {                                                                             //SI AUCUN RECENT SKIP
          userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
          continue;
        }

        for (const achievement of allRecent) {                                                                                  //MISE EN FORME DES CHEEVOS RECENT
          if (achievement.achievementId === user.lastAchievement) break;
          newAchievements.push(achievement);
        }
  
        if (newAchievements.length === 0) {                                                                                     //SI AUCUN NOUVEAU CHEEVOS SKIP
          userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
          continue;
        }
        newAchievements.reverse();
                                                              
        try {                                                                                                                   //GET SUMMARY             
          summary = await retry(() =>
            getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
            3, 500, user.raUsername
          );
          incrementApiCallCount();
        } catch (err) {
          log(`⚠️ Impossible de récupérer le résumé pour ${user.raUsername}, on saute les notifs.`);
          userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
          continue;
        }
  
        userCheckState[discordId].lastAchievementTime = now;                                                                    //SET DELAY (FAST)
        userCheckState[discordId].nextCheckTime = now + FAST_DELAY;
        userCheckState[discordId].nextOnlineCheckTime = now + ONLINE_DELAY;
        userCheckState[discordId].isFastPolling = true;

      }

      else if (fastpolling) {                                                                                                           //SI RAPIDE
        console.log(`${discordId} is fast polling`);
        if (now < nextCheck && now < nextOnlineCheck) continue;                                                             //SI PAS ENCORE BESOIN DE CHECK (les 2) SKIP
        console.log("let's go check en mode rapide");

        if (now >= nextOnlineCheck) {                                                                                                   //SI ONLINE CHECK

          const authorization = buildAuthorization({                                                                        //BUILD AUTHORIZATION
            username: user.raUsername,
            webApiKey: user.raApiKey
          });

          let summary;                                                                                                      //GET SUMMARY                                                                           
          try {
              summary = await retry(() =>
              getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
              3, 500, user.raUsername
              );
              incrementApiCallCount();
              userCheckState[discordId].isSummaryReady = true;                                                              //SUMMARY IS READY
              userCheckState[discordId].nextOnlineCheckTime = now + ONLINE_DELAY;
          } catch (err) {
              log(`⚠️ Impossible de récupérer le résumé pour ${user.raUsername}, on saute les notifs.`);
              userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
              userCheckState[discordId].isFastPolling = false;
              continue;
          }
          const lastPlayed = summary.recentlyPlayed?.[0]?.lastPlayed;
          const lastPlayedTime = lastPlayed ? new Date(lastPlayed + ' UTC').getTime() : 0;
          const timeSinceLastPlayed = now - lastPlayedTime;

          if (timeSinceLastPlayed >= 3 * 60 * 1000) {                                                                       //SI OFFLINE

            userCheckState[discordId].isFastPolling = false;
            console.log(`UPDATE ${discordId} is slow polling`);
            userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
            continue;

          }
  
        }

        if (now >= nextCheck) {                                                                                                             //SI CHECK

            const authorization = buildAuthorization({                                                                          //BUILD AUTHORIZATION
                username: user.raUsername,
                webApiKey: user.raApiKey
              });
        
              let allRecent;                                                                                                    //GET RECENT CHEEVOS
              try {
                allRecent = await retry(() =>
                  getUserRecentAchievements(authorization, { username: user.raUsername }),
                  3, 500, user.raUsername
                );
                incrementApiCallCount();
              } catch (err) {
                userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
                userCheckState[discordId].isFastPolling = false;
                continue;
              }
        
              if (!allRecent || allRecent.length === 0) {                                                                       //SI AUCUN RECENT SKIP
                userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
                userCheckState[discordId].isFastPolling = false;
                console.log(`UPDATE ${discordId} is slow polling`);
                continue;
              }
        
              const newAchievements = [];                                                                                       //MISE EN FORME DES CHEEVOS RECENT
              for (const achievement of allRecent) {
                if (achievement.achievementId === user.lastAchievement) break;
                newAchievements.push(achievement);
              }
        
              if (newAchievements.length === 0) {                                                                               //SI AUCUN NOUVEAU CHEEVOS SKIP
                userCheckState[discordId].nextCheckTime = now + FAST_DELAY;
                continue;
              }
              newAchievements.reverse();
      
              if (!summaryready) {

                let summary;                                                                                                      //GET SUMMARY                                                                           
                try {
                    summary = await retry(() =>
                    getUserSummary(authorization, { username: user.raUsername, recentGamesCount: 3 }),
                    3, 500, user.raUsername
                    );
                    incrementApiCallCount();
                } catch (err) {
                    log(`⚠️ Impossible de récupérer le résumé pour ${user.raUsername}, on saute les notifs.`);
                    userCheckState[discordId].nextCheckTime = now + SLOW_DELAY;
                    userCheckState[discordId].isFastPolling = false;
                    continue;
                }

              }
              userCheckState[discordId].lastAchievementTime = now;                                                              //SET DELAY (FAST)
              userCheckState[discordId].nextCheckTime = now + FAST_DELAY;
        }

      };


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
          log(`📎 ${user.raUsername} → succès ${achievement.achievementId} ignoré (0%)`);
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

      // 🔁 Vérification des jeux masterisés
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
          const boxArtUrl = gameInfo?.imageBoxArt
            ? `https://retroachievements.org${gameInfo.imageBoxArt}`
            : null;

          await channel.send({
            embeds: [{
              title: `🎮 Jeu masterisé !`,
              description: `**${user.raUsername}** a masterisé le jeu **${gameTitle}** ${consoleName ? `(${consoleName})` : ''}`,
              color: 0xf1c40f,
              footer: { text: `Masterisé avec ${hardcore}/${total} succès en mode hardcore` },
              timestamp: new Date(),
              image: boxArtUrl ? { url: boxArtUrl } : undefined,
            }]
          });

          log(`🏅 ${user.raUsername} a masterisé ${gameTitle}`);
        }
      }
    }
  }
};

client.once('ready', async () => {
  log(`🤖 Connecté en tant que ${client.user.tag}`);

  updatePresence(client);
  setInterval(() => updatePresence(client), 10 * 60 * 1000);

  await checkAllUsers();
  cron.schedule('*/10 * * * * *', checkAllUsers);

  cron.schedule('0 5 * * 1', async () => {
    log('⏰ Lancement du cron hebdo pour mise à jour AOTW');
    await fetchAndStoreAotw();
  });
});

client.login(process.env.DISCORD_TOKEN);