// commands/setchannel.js
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { loadDB, saveDB } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Définit ce salon comme salon des notifications de succès RetroAchievements.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    // Charger la DB des guildes
    const guildsDB = loadDB('guildsdb');

    // Créer la guilde si elle n'existe pas
    if (!guildsDB[guildId]) {
      guildsDB[guildId] = {
        channel: channelId,
        users: []
      };
    } else {
      guildsDB[guildId].channel = channelId;
    }

    // Sauvegarder
    saveDB(guildsDB, 'guildsdb');

    await interaction.reply({
      content: `✅ Salon défini avec succès. Les succès seront désormais envoyés ici.`,
      flags: MessageFlags.Ephemeral
    });
  }
};
