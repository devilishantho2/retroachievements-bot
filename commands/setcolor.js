import { SlashCommandBuilder,MessageFlags } from 'discord.js';
import { setUserColor } from '../db.js'; // adapte le chemin selon ta structure

export default {
  data: new SlashCommandBuilder()
    .setName('setcolor')
    .setDescription('Définir la couleur de ton embed (format hex, ex: #ff0000)')
    .addStringOption(option =>
      option
        .setName('couleur')
        .setDescription('Couleur en hexadécimal (#RRGGBB)')
        .setRequired(true)
    ),

  async execute(interaction) {
    const color = interaction.options.getString('couleur');

    // Vérification du format hexadécimal #RRGGBB ou RRGGBB
    if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) {
      return interaction.reply({
        content: '❌ Format invalide. Utilise un code hex comme #ff0000',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Mise à jour dans la base
    setUserColor(interaction.user.id, color);

    await interaction.reply({
      content: `✅ Couleur définie sur \`${color}\``,
      flags: MessageFlags.Ephemeral,
    });
  },
};
