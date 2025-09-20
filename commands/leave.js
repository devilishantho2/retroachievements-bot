import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB, saveDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription("Unregister from the server or from the bot entirely")
    .addStringOption(option =>
      option.setName('type')
        .setDescription("Target")
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
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    if (!guildId) {
      return interaction.reply({
        content: t(lang, "notInDM"),
        flags: MessageFlags.Ephemeral,
      });
    }

    const guilds = loadDB('guildsdb');
    const users = loadDB('usersdb');

    if (type === 'server') {
      if (!guilds[guildId] || !guilds[guildId].users.includes(discordId)) {
        return interaction.reply({
          content: t(lang, "leaveNotInGuild"),
          flags: MessageFlags.Ephemeral,
        });
      }

      // Retirer l'utilisateur de la liste
      guilds[guildId].users = guilds[guildId].users.filter(id => id !== discordId);
      saveDB(guilds, 'guildsdb');

      return interaction.reply({
        content: t(lang, "leaveGuildSuccess"),
        flags: MessageFlags.Ephemeral,
      });
    }

    if (type === 'bot') {
      if (!users[discordId]) {
        return interaction.reply({
          content: t(lang, "leaveNotInBot"),
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
        content: t(lang, "leaveBotSuccess"),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
