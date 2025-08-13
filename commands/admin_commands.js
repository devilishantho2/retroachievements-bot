// commands/admin.js
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { loadDB, saveDB } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Commandes administratives du bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('setchannel')
        .setDescription('Définit ce salon comme salon des notifications RetroAchievements.')
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Retire un utilisateur du serveur ou du bot')
        .addStringOption(option =>
          option
            .setName('scope')
            .setDescription('Portée de la suppression')
            .setRequired(true)
            .addChoices(
              { name: 'server', value: 'server' },
              { name: 'bot', value: 'bot' }
            )
        )
        .addStringOption(option =>
          option
            .setName('user')
            .setDescription('ID Discord de l’utilisateur à supprimer')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('clean')
        .setDescription('Retire tous les utilisateurs qui ne sont plus sur ce serveur.')
    )
    .addSubcommand(sub =>
      sub
        .setName('language')
        .setDescription('Définit le langage du serveur')
        .addStringOption(option =>
          option
            .setName('language')
            .setDescription('Choix du langage')
            .setRequired(true)
            .addChoices(
              { name: 'Français', value: 'fr' },
              { name: 'English', value: 'en' }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const guildsDB = loadDB('guildsdb');
    const usersDB = loadDB('usersdb');

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
        content: `✅ Salon défini avec succès. Les succès seront désormais envoyés ici.`,
        flags: MessageFlags.Ephemeral
      });
    }

    // === /admin remove ===
    if (subcommand === 'remove') {
      const scope = interaction.options.getString('scope');
      const userId = interaction.options.getString('user');

      if (scope === 'server') {
        if (!guildsDB[guildId]?.users.includes(userId)) {
          return interaction.reply({
            content: `⚠️ L'utilisateur <@${userId}> n'est pas enregistré sur ce serveur.`,
            flags: MessageFlags.Ephemeral
          });
        }

        guildsDB[guildId].users = guildsDB[guildId].users.filter(id => id !== userId);
        saveDB(guildsDB, 'guildsdb');

        return interaction.reply({
          content: `✅ Utilisateur <@${userId}> retiré du serveur.`,
          flags: MessageFlags.Ephemeral
        });
      }

      if (scope === 'bot') {
        if (!usersDB[userId]) {
          return interaction.reply({
            content: `⚠️ L'utilisateur <@${userId}> n'est pas enregistré globalement.`,
            flags: MessageFlags.Ephemeral
          });
        }

        delete usersDB[userId];
        saveDB(usersDB, 'usersdb');

        for (const gid in guildsDB) {
          guildsDB[gid].users = guildsDB[gid].users.filter(id => id !== userId);
        }
        saveDB(guildsDB, 'guildsdb');

        return interaction.reply({
          content: `✅ Utilisateur <@${userId}> supprimé globalement.`,
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // === /admin clean ===
    if (subcommand === 'clean') {
      if (!guildsDB[guildId]) {
        return interaction.reply({
          content: `⚠️ Aucun utilisateur enregistré sur ce serveur.`,
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
        content: `✅ Nettoyage effectué : ${removed.length} utilisateur(s) retiré(s) du serveur car ils n'y sont plus.`,
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
        content: `✅ Langue définie avec succès.`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
