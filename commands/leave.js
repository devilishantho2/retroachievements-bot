import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { t } from '../locales.js';
import { isUserRegistered, isUserInGuild, guildLang, deleteUserFromBot, deleteUserFromServer } from '../db_v2.js'; 

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
    const lang = guildLang(guildId);
    
    //Arrete tout si commande en MP
    if (!guildId) {
      return interaction.reply({content: t(lang, "notInDM"), flags: MessageFlags.Ephemeral});
    }

    if (type === 'server') {
      if (!isUserInGuild(guildId,discordId)) {
        return interaction.reply({content: t(lang, "leaveNotInGuild"), flags: MessageFlags.Ephemeral});
      }
      deleteUserFromServer(guildId,discordId)
      return interaction.reply({content: t(lang, "leaveGuildSuccess"), flags: MessageFlags.Ephemeral,});
    }

    if (type === 'bot') {
      if (!isUserRegistered(discordId)) {
        return interaction.reply({content: t(lang, "leaveNotInBot"), flags: MessageFlags.Ephemeral});
      }
      deleteUserFromBot(discordId);
      return interaction.reply({content: t(lang, "leaveBotSuccess"), flags: MessageFlags.Ephemeral});
    }
  }
};
