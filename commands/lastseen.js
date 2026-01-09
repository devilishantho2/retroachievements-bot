import { SlashCommandBuilder } from 'discord.js';
import { buildAuthorization, getUserSummary } from '@retroachievements/api';
import { loadDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lastseen')
    .setDescription("Show the last game played by a RA user.")
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription("RetroAchievements username")
        .setRequired(false)
    ),

  async execute(interaction) {
    const inputUsername = interaction.options.getString('username');
    const discordId = interaction.user.id;

    const usersDB = loadDB('usersdb');
    const user = usersDB[discordId];
    const ulid = inputUsername || user?.ulid;
    const raApiKey = user?.raApiKey;

    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    if (!ulid || !raApiKey) {
      return interaction.reply({
        content: t(lang, "lastError"),
        ephemeral: true,
      });
    }

    try {
      const auth = buildAuthorization({ username: ulid, webApiKey: raApiKey });

      const summary = await getUserSummary(auth, {
        username: ulid,
        recentGamesCount: 1,
        recentAchievementsCount: 2,
      });

      const lastGame = summary.lastGame;
      const richPresence = summary.richPresenceMsg;
      const userPic = summary.userPic;
      const totalPoints = summary.totalPoints;

      if (!lastGame || !lastGame.title) {
        return interaction.reply(t(lang, "lastNoActivity", { username : summary.user }));
      }

      const embed = {
        title: t(lang, "lastTitle", { username : summary.user }),
        description: `**[${lastGame.title}](http://retroachievements.org/game/${summary.lastGameId})**\n${richPresence || 'Rich presence error'}`,
        color: 0x00b0f4,
        thumbnail: {
          url: `https://retroachievements.org${userPic}`,
        },
        image: {
          url: `https://retroachievements.org${lastGame.imageBoxArt}`,
        },
        footer: {
          text: t(lang, "lastPoints", { points : totalPoints }),
        },
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur /lastseen :', error);
      await interaction.reply(`❌ Error`);
    }
  },
};
