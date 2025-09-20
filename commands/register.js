import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { addUser, loadDB } from '../db.js';
import { t } from '../locales.js';
import dotenv from 'dotenv';
import { buildAuthorization, getUserProfile } from "@retroachievements/api";

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

    // ✅ Vérification API RetroAchievements
    try {
      const authorization = buildAuthorization({
        username: raUsername,
        webApiKey: raApiKey
      });

      // Essaye de récupérer le profil
      await getUserProfile(authorization, { username: raUsername });

      // Si OK → on sauvegarde
      addUser(discordId, guildId, {
        raUsername,
        raApiKey,
        background: "data/backgrounds/default_background.png",
        color: "#ffffff",
        lastAchievement: null,
        aotwUnlocked: false,
        aotmUnlocked: false,
        latestMaster : [],
        history : []
      });

      const logMessage = `🕹️ ${raUsername} vient de s'enregistrer`;
      console.log(logMessage);

      try {
        const logChannel = await interaction.client.channels.fetch(process.env.LOG_CHANNEL_ID);
        if (logChannel) {
          await logChannel.send(logMessage);
        }
      } catch (err) {
        console.error("❌ Erreur envoi log Discord :", err);
      }

      await interaction.reply({
        content: t(lang, "registerSuccess", { username: raUsername }),
        flags: MessageFlags.Ephemeral,
      });

    } catch (err) {
      console.error("❌ Erreur RA API :", err);

      await interaction.reply({
        content: t(lang, "registerError", { username: raUsername }),
        flags: MessageFlags.Ephemeral,
      });
    }
  }
};
