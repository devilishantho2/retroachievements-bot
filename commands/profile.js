import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { generateProfileImage } from '../generateProfileImage.js';
import { t } from '../locales.js';
import { buildAuthorization, getUserSummary, getUserAwards, getGameExtended } from '@retroachievements/api';
import { retry } from '../utils.js';
import { guildLang, getUserData, getUserDataUlid } from '../db_v2.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Display various informations about you or any user')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription("RetroAchievements username")
        .setRequired(false)
    ),

  async execute(interaction) {
    const inputUsername = interaction.options.getString('username');
    const discordId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const user = getUserData(discordId);
    const ulid = inputUsername || user?.ulid;
    const lang = guildLang(guildId) || 'en';

    if (!user) {
      return interaction.reply({
        content: t(lang, "testNotRegistered"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const authorization = buildAuthorization({
        username: user.ulid,
        webApiKey: user.ra_api_key
    });

    let summary;
    summary = await retry(
        () => getUserSummary(authorization, { username: ulid, recentGamesCount: 3 }),
        { retries: 3, delay: 500, userLabel: user.ulid }
    );

    let awards;
    awards = await retry(
        () => getUserAwards(authorization, { username: ulid }),
        { retries: 3, delay: 500, userLabel: user.ulid }
    );

    const latestMastery = awards.visibleUserAwards
      .filter(a => a.awardType === "Mastery/Completion")
      .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))[0];

    let master;
    if (latestMastery) {
      master = await retry(
        () => getGameExtended(authorization, { gameId: latestMastery.awardData }),
        { retries: 3, delay: 500, userLabel: user.ulid }
      );
    } else {
      master = null;
    }

    let imageBuffer;
    if (inputUsername == null) {
      imageBuffer = await generateProfileImage(user.background, user.color, summary, awards, master, JSON.parse(user.favorite_achievement),JSON.parse(user.favorite_game),lang);
    }
    else {
      const target = getUserDataUlid(summary.ulid);
      if (target) {
        imageBuffer = await generateProfileImage(target.background, target.color, summary, awards, master, JSON.parse(target.favorite_achievement), JSON.parse(target.favorite_game),lang);
      }
      else {
        imageBuffer = await generateProfileImage(null, null, summary, awards, master, null, null, lang);
      }
      
    }

    await interaction.editReply({
      files: [{ attachment: imageBuffer, name: 'profile.png' }]
    });
  },
};
