import { SlashCommandBuilder } from 'discord.js';
import { buildAuthorization, getUserSummary } from '@retroachievements/api';
import { getUsers } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('lastseen')
    .setDescription("Affiche les infos du dernier jeu joué par un utilisateur RA.")
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription("Pseudo RetroAchievements (sinon utilise ton compte enregistré)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const inputUsername = interaction.options.getString('username');
    const discordId = interaction.user.id;

    const user = getUsers().find(u => u.discordId === discordId);
    const raUsername = inputUsername || user?.raUsername;
    const raApiKey = user?.raApiKey;

    if (!raUsername || !raApiKey) {
      return interaction.reply({
        content: '❌ Impossible de déterminer le pseudo RetroAchievements. Utilise `/register` ou spécifie un nom d’utilisateur.',
        ephemeral: true,
      });
    }

    try {
      const auth = buildAuthorization({ username: raUsername, webApiKey: raApiKey });

      const summary = await getUserSummary(auth, {
        username: raUsername,
        recentGamesCount: 1,
        recentAchievementsCount: 2,
      });

      const lastGame = summary.lastGame;
      const richPresence = summary.richPresenceMsg;
      const userPic = summary.userPic;
      const totalPoints = summary.totalPoints;

      if (!lastGame || !lastGame.title) {
        return interaction.reply(`❌ Aucune activité récente trouvée pour **${raUsername}**.`);
      }

      const embed = {
        title: `🎮 Dernière activité de ${raUsername}`,
        description: `**[${lastGame.title}](http://retroachievements.org/game/${summary.lastGameId})**\n${richPresence || 'Aucune activité visible.'}`,
        color: 0x00b0f4,
        thumbnail: {
          url: `https://retroachievements.org${userPic}`,
        },
        image: {
          url: `https://retroachievements.org${lastGame.imageBoxArt}`,
        },
        footer: {
          text: `Points totaux : ${totalPoints}`,
        },
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Erreur /lastseen :', error);
      await interaction.reply(`❌ Une erreur est survenue lors de la récupération des données pour **${raUsername}**.`);
    }
  },
};
