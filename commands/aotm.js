import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { getUsers, getAotmInfo } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aotm')
    .setDescription('Affiche le succès Achievement of the Month (AOTM) du mois'),

  async execute(interaction) {
    const aotm = getAotmInfo();

    if (!aotm || !aotm.id) {
      return interaction.reply({
        content: '❌ Aucune information sur l’AOTM actuellement.',
        ephemeral: true,
      });
    }

    const users = getUsers();
    const user = users.find(u => u.discordId === interaction.user.id);

    const unlocked = user ? user.aotmUnlocked : false;

    const color = unlocked ? 0x2ecc71 : 0xe74c3c;
    const statusEmoji = unlocked ? '✅' : '❌';
    const statusText = unlocked ? 'Débloqué' : 'Pas débloqué';

    const embed = {
      title: `🎯 Achievement of the Month : ${aotm.title}`,
      description: `${statusEmoji} **${statusText}**\n\n[${aotm.description}](https://retroachievements.org/achievement/${aotm.id})`,
      color,
      fields: [
        { name: 'Points', value: `${aotm.points}`, inline: true },
        { name: 'Jeu', value: `[${aotm.gameTitle}](https://retroachievements.org/game/${aotm.game.id})` || 'N/A', inline: true },
      ],
      timestamp: new Date(),
      footer: {
        text: 'Achievement of the Month',
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
