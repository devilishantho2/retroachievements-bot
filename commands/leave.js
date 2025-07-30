import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB, saveDB } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription("Se retirer du serveur ou complètement du bot")
    .addStringOption(option =>
      option.setName('type')
        .setDescription("Cible de la suppression")
        .setRequired(true)
        .addChoices(
          { name: 'server', value: 'server' },
          { name: 'bot', value: 'bot' }
        )
    ),

  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const discordId = interaction.user.id;
    const type = interaction.options.getString('type');

    if (!guildId) {
      return interaction.reply({
        content: '❌ Cette commande doit être utilisée dans un serveur.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const guilds = loadDB('guildsdb');
    const users = loadDB('usersdb');

    if (type === 'server') {
      if (!guilds[guildId] || !guilds[guildId].users.includes(discordId)) {
        return interaction.reply({
          content: "ℹ️ Tu n'es pas enregistré sur ce serveur.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Retirer l'utilisateur de la liste
      guilds[guildId].users = guilds[guildId].users.filter(id => id !== discordId);
      saveDB(guilds, 'guildsdb');

      return interaction.reply({
        content: '✅ Tu as été retiré de ce serveur.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (type === 'bot') {
      if (!users[discordId]) {
        return interaction.reply({
          content: "ℹ️ Tu n'es pas enregistré dans le bot.",
          flags: MessageFlags.Ephemeral,
        });
      }

      // Supprimer l'utilisateur global
      delete users[discordId];
      saveDB(users, 'usersdb');

      // Retirer son ID de tous les serveurs
      for (const gid in guilds) {
        guilds[gid].users = guilds[gid].users.filter(id => id !== discordId);
      }
      saveDB(guilds, 'guildsdb');

      return interaction.reply({
        content: '✅ Tu as été supprimé complètement du bot.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
