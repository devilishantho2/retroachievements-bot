// commands/admin.js
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { loadDB, saveDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Admin commands of the bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setchannel')
        .setDescription('Set this channel as the RetroAchievements notifications channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the server')
        .addStringOption(option =>
          option
            .setName('user')
            .setDescription('Discord ID of the user to remove')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clean')
        .setDescription('Remove all users who are no longer on this server')
    )
    .addSubcommand(sub =>
      sub
        .setName('language')
        .setDescription('Set the server language')
        .addStringOption(option =>
          option
            .setName('language')
            .setDescription('Choose language')
            .setRequired(true)
            .addChoices(
              { name: 'Français', value: 'fr' },
              { name: 'English', value: 'en' }
            )
        )
    ),

  async execute(interaction) {

    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    // ✅ Vérification : interdit en MP
    if (!interaction.guildId) {
      return interaction.reply({
        content: t(lang, "notInDM"),
        flags: MessageFlags.Ephemeral,
      });
    }

    const usersDB = loadDB('usersdb');
    const subcommand = interaction.options.getSubcommand();

    // === /admin setchannel ===
    if (subcommand === 'setchannel') {
      const channelId = interaction.channelId;

      if (!guildsDB[guildId]) {
        guildsDB[guildId] = {
          channel: channelId,
          lang: "en",
          users: []
        };
      } else {
        guildsDB[guildId].channel = channelId;
      }

      saveDB(guildsDB, 'guildsdb');

      return interaction.reply({
        content: t(lang, "salonDefiniSuccess"),
        flags: MessageFlags.Ephemeral
      });
    }

    // === /admin remove ===
    if (subcommand === 'remove') {
      const userId = interaction.options.getString('user');

      if (!guildsDB[guildId]?.users.includes(userId)) {
        return interaction.reply({
          content: t(lang, "userNotRegistered", {userId: userId}),
          flags: MessageFlags.Ephemeral
        });
      }

      guildsDB[guildId].users = guildsDB[guildId].users.filter(id => id !== userId);
      saveDB(guildsDB, 'guildsdb');

      return interaction.reply({
        content: t(lang, "userRemoved", {uderId : userId}),
        flags: MessageFlags.Ephemeral
      });
    }

    // === /admin clean ===
    if (subcommand === 'clean') {
      if (!guildsDB[guildId]) {
        return interaction.reply({
          content: t(lang, "noUser"),
          flags: MessageFlags.Ephemeral
        });
      }

      const registeredUsers = guildsDB[guildId].users;
      const stillInServer = [];
      const removed = [];

      for (const userId of registeredUsers) {
        try {
          await interaction.guild.members.fetch(userId);
          stillInServer.push(userId);
        } catch (error) {
          removed.push(userId);
        }
      }

      guildsDB[guildId].users = stillInServer;
      saveDB(guildsDB, 'guildsdb');

      return interaction.reply({
        content: t(lang, "cleanComplete", {number: removed.length}),
        flags: MessageFlags.Ephemeral
      });
    }

    // === /admin language ===
    if (subcommand === 'language') {

      const language = interaction.options.getString('language');

      if (!guildsDB[guildId]) {
        guildsDB[guildId] = {
          channel: 0,
          lang: language,
          users: []
        };
      } else {
        guildsDB[guildId].lang = language;
      }

      saveDB(guildsDB, 'guildsdb');

      return interaction.reply({
        content: t(lang, "langSuccess"),
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
