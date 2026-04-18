import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { t } from '../locales.js';
import { buildAuthorization, getUserSummary, getUserAwards, getUserCompletedGames } from "@retroachievements/api";
import { log, retry } from '../utils.js';
import { consoleTable } from '../consoleTable.js';
import { guildLang, addUser, isGuildSetup, addUserToGuild, isUserInGuild } from '../db_v2.js';

export default {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link your RetroAchievements account')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your RetroAchievements username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('apikey')
        .setDescription('Your RetroAchievements API key')
        .setRequired(true)),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const guildId = interaction.guildId;
    const username = interaction.options.getString('username');
    const raApiKey = interaction.options.getString('apikey');
    const lang = guildLang(guildId)

    //Arrete tout si commande en MP
    if (!guildId) {
      await interaction.reply({content: t(lang, "notInDM"), flags: MessageFlags.Ephemeral});
      return;
    }

    // Arrete tout si serveur non setup
    if (!isGuildSetup(guildId)) {
      await interaction.reply({content: t(lang, "guildNotSetup"), flags: MessageFlags.Ephemeral});
      return;
    }

    // Vérification API RetroAchievements
    try {
      const authorization = buildAuthorization({username: username, webApiKey: raApiKey});
      const summary = await retry(()=>getUserSummary(authorization, { username: username, recentGamesCount: 3}));
      const awards = await retry(()=>getUserAwards(authorization, { username: username }));

      const recentAchievements = Object.values(summary.recentAchievements)
      .flatMap(game => Object.values(game))
      .sort((a, b) => new Date(a.dateAwarded) - new Date(b.dateAwarded));
      const lastAchievement = [recentAchievements[recentAchievements.length - 1].id,recentAchievements[recentAchievements.length - 1].dateAwarded];

      const achievementsOffset = {};
      for (const ach of recentAchievements) {
          const id = ach.gameId;
          achievementsOffset[id] = (achievementsOffset[id] || 0) + 1;
      }
    
      const gameProgress = {};
      for (const [gameId, gameAward] of Object.entries(summary.awarded || {})) {
          gameProgress[gameId] = {
          achieved: gameAward.numAchieved,
          achievedH: gameAward.numAchievedHardcore,
          offset: achievementsOffset[gameId]-1,
          total: gameAward.numPossibleAchievements || 1
        };
      }
    
      const gameConsole = {};
      for (const [gameId,game] of Object.entries(summary.recentlyPlayed || [])) {
          gameConsole[game.gameId] = consoleTable[game.consoleName];
      };

      var latestMaster = [];
      if (awards.masteryAwardsCount > 0 || awards.completionAwardsCount > 0) {
        for (const award of awards.visibleUserAwards) {
          if (award.awardType == "Mastery/Completion") {
            latestMaster = [award.imageIcon.replace('/Images/', ''), award.awardDataExtra];
            continue
          }
        }
      }

      const history = [];
      for (const achievement of recentAchievements) {

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
        };
        history.push(achievementData);
      }

      // Si OK → on sauvegarde
      addUser(discordId, summary.ulid, raApiKey, lastAchievement[0], lastAchievement[1], latestMaster[0], latestMaster[1], history);
      if (!isUserInGuild(guildId,discordId)) {
        addUserToGuild(guildId, discordId);
      }
    
      log(`🕹️ ${summary.user} vient de s'enregistrer`);

      await interaction.reply({content: t(lang, "registerSuccess", { username: summary.user }), flags: MessageFlags.Ephemeral});

    }
    catch (err) {
      console.error("❌ Erreur RA API :", err);
      await interaction.reply({content: t(lang, "registerError"), flags: MessageFlags.Ephemeral});
    }
  }
};
