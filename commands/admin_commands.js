import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { t } from '../locales.js';
import { isUserInGuild, guildLang, deleteUserFromServer, isGuildSetup, addGuild, setGuildLang, setGuildGlobalNotifications, getAllUsersInServer } from '../db_v2.js'; 

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
    const lang = guildLang(guildId);

    // ✅ Vérification : interdit en MP
    if (!guildId) {
      return interaction.reply({content: t(lang, "notInDM"), flags: MessageFlags.Ephemeral});
    }

    const subcommand = interaction.options.getSubcommand();

  // === /admin setchannel ===
  if (subcommand === 'setchannel') {
    const channelId = interaction.channelId;
    const channel = interaction.guild.channels.cache.get(channelId);

    if (!channel) {
      return interaction.reply({content: t(lang, "salonIntrouvable"), flags: MessageFlags.Ephemeral});
    }

    const botMember = interaction.guild.members.me;
    const permissions = channel.permissionsFor(botMember);
    if (!permissions.has(["ViewChannel", "SendMessages", "AttachFiles"])) {
      return interaction.reply({content: t(lang, "botPasPermissions", { channel: channel.name }), flags: MessageFlags.Ephemeral});
    }

    addGuild(guildId,channelId)

    return interaction.reply({content: t(lang, "salonDefiniSuccess"), flags: MessageFlags.Ephemeral});
  }

    // === /admin remove ===
    if (subcommand === 'remove') {
      const userId = interaction.options.getString('user');

      if (!isUserInGuild(guildId,userId)) {
        return interaction.reply({content: t(lang, "userNotRegistered", {userId: userId}), flags: MessageFlags.Ephemeral});
      }

      deleteUserFromServer(guildId,userId)

      return interaction.reply({content: t(lang, "userRemoved", {uderId : userId}), flags: MessageFlags.Ephemeral});
    }

// === /admin clean ===
if (subcommand === 'clean') {
    const users = getAllUsersInServer(guildId);

    if (users.length === 0) {
        return interaction.reply({ content: t(lang, "noUser"), flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }); // On prévient Discord que ça peut être long

    const removed = [];

    // 2. On boucle sur les résultats
    for (const userId of users) {
        try {
            await interaction.guild.members.fetch(userId);
        } catch (error) {
            deleteUserFromServer(guildId, userId);
            removed.push(userId);
        }
    }

    return interaction.editReply({ 
        content: t(lang, "cleanComplete", { number: removed.length }) 
    });
}

    // === /admin language ===
    if (subcommand === 'language') {
      const language = interaction.options.getString('language');

      if (!isGuildSetup(guildId)) {
        await interaction.reply({content: t(lang, "guildNotSetup"), flags: MessageFlags.Ephemeral});
        return;
      } else {
        setGuildLang(guildId,language)
      }

      return interaction.reply({content: t(language, "langSuccess"), flags: MessageFlags.Ephemeral});
    }

    // === /admin notifications ===
    if (subcommand === 'notifications') {
      const value = interaction.options.getBoolean('value');

      if (!isGuildSetup(guildId)) {
        await interaction.reply({content: t(lang, "guildNotSetup"), flags: MessageFlags.Ephemeral});
        return;
      } else {
        setGuildGlobalNotifications(guildId, value ? 1 : 0)
      }

      return interaction.reply({content: t(lang, "notifSuccess", { value : value }), flags: MessageFlags.Ephemeral});
    }
  }
};
