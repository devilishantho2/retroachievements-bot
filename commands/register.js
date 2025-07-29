import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { addUser, setAotwUnlocked } from '../db.js';

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
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: '❌ Cette commande doit être utilisée dans un serveur Discord, pas en message privé.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const discordId = interaction.user.id;
    const raUsername = interaction.options.getString('username');
    const raApiKey = interaction.options.getString('apikey');

    addUser(discordId, guildId, {
      raUsername,
      raApiKey,
      lastAchievement: null,
      color: "#ffffff",
      aotwUnlocked: false,
      aotmUnlocked: false,
      background: "https://raw.githubusercontent.com/devilishantho2/devilishantho2.github.io/refs/heads/main/default_background.png"
    });

    console.log(`🕹️ ${raUsername} vient de s'enregistrer`);

    await interaction.reply({
      content: `✅ Ton compte **${raUsername}** a bien été enregistré !`,
      flags: MessageFlags.Ephemeral,
    });
  }
};
