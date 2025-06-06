import { SlashCommandBuilder,MessageFlags } from 'discord.js';
import { getUsers, getAotwInfo } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aotw')
    .setDescription('Affiche le succès Achievement of the Week (AOTW) de la semaine'),

  async execute(interaction) {
    const aotw = getAotwInfo();

    if (!aotw || !aotw.id) {
      return interaction.reply({
        content: '❌ Aucune information sur l’AOTW actuellement.',
        ephemeral: true,
      });
    }

    const users = getUsers();
    const user = users.find(u => u.discordId === interaction.user.id);

    const unlocked = user ? user.aotwUnlocked : false;

    const color = unlocked ? 0x2ecc71 : 0xe74c3c;
    const statusEmoji = unlocked ? '✅' : '❌';
    const statusText = unlocked ? 'Débloqué' : 'Pas débloqué';

    const embed = {
      title: `🎯 Achievement of the Week : ${aotw.title}`,
      description: `${statusEmoji} **${statusText}**\n\n[${aotw.description}](https://retroachievements.org/achievement/${aotw.id})`,
      color,
      fields: [
        { name: 'Points', value: `${aotw.points}`, inline: true },
        { name: 'Jeu', value: `[${aotw.gameTitle}](https://retroachievements.org/game/${aotw.game.id})` || 'N/A', inline: true },
        { name: 'Créé le', value: aotw.dateCreated || 'N/A', inline: true },
      ],
      timestamp: new Date(),
      footer: {
        text: 'Achievement of the Week',
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
