import { SlashCommandBuilder,MessageFlags } from 'discord.js';
import { addUser } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Associe ton compte RetroAchievements')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Ton pseudo RetroAchievements')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('apikey')
        .setDescription('Ta clé API RetroAchievements')
        .setRequired(true)),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const raUsername = interaction.options.getString('username');
    const raApiKey = interaction.options.getString('apikey');

    addUser({
      discordId,
      raUsername,
      raApiKey,
      lastAchievement: null,
      color: null,
    });

    await interaction.reply({
      content: `✅ Ton compte **${raUsername}** a bien été enregistré !`,
      flags: MessageFlags.Ephemeral,
    });
  }
};
