import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { setUserBackground } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setbackground')
    .setDescription("Définit l'image de fond personnalisée pour tes images de succès")
    .addStringOption(option =>
      option.setName('url')
        .setDescription("Lien direct vers l'image (JPG/PNG)")
        .setRequired(true)
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const url = interaction.options.getString('url');

    // Vérification simple de l'URL
    if (!/^https?:\/\/.+\.(jpg|jpeg|png)$/i.test(url)) {
      await interaction.reply({
        content: "❌ L'URL doit être un lien direct vers une image (.jpg, .jpeg ou .png).",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    setUserBackground(discordId, url);

    console.log(`🖼️ Fond personnalisé mis à jour pour ${interaction.user.username}`);

    await interaction.reply({
      content: "✅ Ton image de fond a bien été mise à jour !",
      flags: MessageFlags.Ephemeral
    });
  }
};
