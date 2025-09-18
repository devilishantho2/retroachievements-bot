import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDB } from '../db.js';
import { generateLatestImage } from '../generateLatestImage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  data: new SlashCommandBuilder()
    .setName('latestcheevos')
    .setDescription('Affiche les derniers succès RetroAchievements d’un utilisateur')
    .addUserOption(option =>
      option.setName('cible')
        .setDescription('Utilisateur dont tu veux voir les succès')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('cible') || interaction.user; // 🎯 si pas choisi → l’auteur
    const usersDB = loadDB('usersdb');
    const user = usersDB[targetUser.id];

    if (!user) {
      return interaction.reply({
        content: `Utilisateur non enregistré.`
      });
    }

    await interaction.deferReply();

    try {
      const pages = [];

      // 🖼️ Page principale générée
      const mainImage = await generateLatestImage(targetUser.id);
      const mainBuffer = mainImage?.data ? Buffer.from(mainImage.data) : mainImage;
      pages.push({ buffer: mainBuffer, name: 'latestcheevos.png' });

      // 🖼️ Pages suivantes = images sauvegardées dans l’historique
      if (user.history && user.history.length > 0) {
        for (let i = user.history.length - 1; i >= 0; i--) {
          const [filePath , , ] = user.history[i];
          const imagePath = path.join(__dirname, '..', 'data', 'images', targetUser.id, filePath);
          if (filePath && fs.existsSync(imagePath)) {
            pages.push({ buffer: fs.readFileSync(imagePath), name: `history_${i + 1}.png` });
          }
        }
      }
      
      let currentPage = 0;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('prev')
          .setLabel('​◀️​')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('▶️​')
          .setStyle(ButtonStyle.Secondary)
      );

      const message = await interaction.editReply({
        files: [{ attachment: pages[currentPage].buffer, name: pages[currentPage].name }],
        components: pages.length > 1 ? [row] : []
      });

      if (pages.length > 1) {
        const collector = message.createMessageComponentCollector({
          time: 60_000
        });

        collector.on('collect', async i => {
          if (i.customId === 'prev') {
            currentPage = (currentPage - 1 + pages.length) % pages.length;
          } else if (i.customId === 'next') {
            currentPage = (currentPage + 1) % pages.length;
          }

          await i.update({
            files: [{ attachment: pages[currentPage].buffer, name: pages[currentPage].name }]
          });
        });

        collector.on('end', async () => {
          await message.edit({ components: [] });
        });
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply({
        content: 'Impossible de générer les derniers succès.'
      });
    }
  },
};
