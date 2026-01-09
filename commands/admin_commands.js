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
    )
    .addSubcommand(sub =>
      sub
        .setName('notifications')
        .setDescription('Turn on or off the global notifications')
        .addBooleanOption(option =>
          option
            .setName('value')
            .setDescription('Enable or disable notifications')
            .setRequired(true)
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
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      return interaction.reply({
        content: t(lang, "salonIntrouvable"),
        flags: MessageFlags.Ephemeral
      });
    }

    // Vérifier les permissions du bot
    const botMember = interaction.guild.members.me; // ou guild.me pour v13
    const permissions = channel.permissionsFor(botMember);

    if (!permissions.has(["ViewChannel", "SendMessages", "AttachFiles"])) {
      return interaction.reply({
        content: t(lang, "botPasPermissions", { channel: channel.name }),
        flags: MessageFlags.Ephemeral
      });
    }

    // Mise à jour de la DB
    if (!guildsDB[guildId]) {
      guildsDB[guildId] = {
        channel: channelId,
        lang: "en",
        global_notifications: true,
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
          global_notifications: true,
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

    // === /admin notifications ===
    if (subcommand === 'notifications') {

      const value = interaction.options.getBoolean('value');

      if (!guildsDB[guildId]) {
        guildsDB[guildId] = {
          channel: null,
          lang: "en",
          global_notifications: value,
          users: []
        };
      } else {
        guildsDB[guildId].global_notifications = value;
      }

      saveDB(guildsDB, 'guildsdb');

      return interaction.reply({
        content: t(lang, "notifSuccess", { value : value }),
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
