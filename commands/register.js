import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { addUser, loadDB, saveDB } from '../db.js';
import { t } from '../locales.js';
import { buildAuthorization, getUserSummary, getUserAwards, getUserCompletedGames } from "@retroachievements/api";
import { log } from '../utils.js';
import { consoleTable } from '../consoleTable.js';

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
    const guildId = interaction.guildId;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    if (!guildId) {
      await interaction.reply({
        content: t(lang, "notInDM"),
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const discordId = interaction.user.id;
    const username = interaction.options.getString('username');
    const raApiKey = interaction.options.getString('apikey');

    // ✅ Vérification API RetroAchievements
    try {
      const authorization = buildAuthorization({
        username: username,
        webApiKey: raApiKey
      });

      // Essaye de récupérer le profil
      const summary = await getUserSummary(authorization, { username: username, recentGamesCount: 3});
      const awards = await getUserAwards(authorization, { username: username });

      const recentAchievements = Object.values(summary.recentAchievements)
      .flatMap(game => Object.values(game))
      .sort((a, b) => new Date(b.dateAwarded) - new Date(a.dateAwarded));

      recentAchievements.reverse()

      const achievementsOffset = {};
      for (const ach of recentAchievements) {
          const id = ach.gameId;
          achievementsOffset[id] = (achievementsOffset[id] || 0) + 1;
      }
    
      var gameProgress = {};
      for (const [gameId, gameAward] of Object.entries(summary.awarded || {})) {
          gameProgress[gameId] = {
          achieved: gameAward.numAchieved,
          achievedH: gameAward.numAchievedHardcore,
          offset: achievementsOffset[gameId]-1,
          total: gameAward.numPossibleAchievements || 1
        };
      }
    
      var gameConsole = {};
      for (const [gameId,game] of Object.entries(summary.recentlyPlayed || [])) {
          gameConsole[game.gameId] = consoleTable[game.consoleName];
      };

      var latestMaster = [];
      if (awards.masteryAwardsCount > 0 || awards.completionAwardsCount > 0) {
        for (const award of awards.visibleUserAwards) {
          if (award.awardType == "Mastery/Completion") {
            latestMaster = [award.imageIcon, award.awardDataExtra == 1];
            continue
          }
        }
      }

      var history = [];
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
          badgeUrl: `/Badge/${achievement.badgeName}.png`,
          progressPercent: percent,
          hardcore: achievement.hardcoreAchieved,
          consoleicon: gameConsole[achievement.gameId]
        };
        history.push(achievementData);
      }

      // Si OK → on sauvegarde
      addUser(discordId, guildId, {
        ulid : summary.ulid,
        raApiKey,
        background: "data/backgrounds/default_background.png",
        color: "#ffffff",
        lastAchievement: [recentAchievements[recentAchievements.length - 1].id,recentAchievements[recentAchievements.length - 1].dateAwarded] || null,
        aotwUnlocked: false,
        aotmUnlocked: false,
        latestMaster : latestMaster,
        history : history
      });

      log(`🕹️ ${summary.user} vient de s'enregistrer`);

      await interaction.reply({
        content: t(lang, "registerSuccess", { username: summary.user }),
        flags: MessageFlags.Ephemeral,
      });

    } catch (err) {
      console.error("❌ Erreur RA API :", err);

      await interaction.reply({
        content: t(lang, "registerError"),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
