import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { addUser,loadDB } from '../db.js';
import { t } from '../locales.js';
import dotenv from 'dotenv';

dotenv.config();

export default {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link your RetroAchievements account')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your RetroAchievements username')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('apikey')
        .setDescription('Your RetroAchievements API key')
        .setRequired(true)),

  async execute(interaction) {

    const guildId = interaction.guildId;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    if (!guildId) {
      await interaction.reply({
        content: t(lang, "notInDM"),
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

    const logMessage = `🕹️ ${raUsername} vient de s'enregistrer`;

    // Log en console
    console.log(logMessage);

    // Envoi dans le salon de logs
    try {
      const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID);
      if (logChannel) {
        await logChannel.send(logMessage);
      } else {
        console.error("❌ Impossible de trouver le salon de logs (CHANNELID incorrect ?)");
      }
    } catch (err) {
      console.error("❌ Erreur envoi log Discord :", err);
    }

    // Réponse à l’utilisateur
    await interaction.reply({
      content: t(lang, "registerSuccess", {username: raUsername}),
      flags: MessageFlags.Ephemeral,
    });
  }
};
