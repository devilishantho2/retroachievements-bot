import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadDB } from '../db.js';
import { generateLatestImage } from '../generateLatestImage.js';
import { generateAchievementImage } from '../generateImage.js';
import { buildAuthorization, getUserProfile } from "@retroachievements/api";
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('latestcheevos')
    .setDescription('Display a user’s latest achievements')
    .addUserOption(option =>
      option.setName('cible')
        .setDescription('User whose achievements you want to see')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('cible') || interaction.user;
    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';
    const usersDB = loadDB('usersdb');
    const user = usersDB[targetUser.id];

    if (!user) {
      return interaction.reply({
        content: t(lang, "userNotRegistered", { userId : targetUser.id })
      });
    }

    const ulid = user.ulid;
    const raApiKey = user.raApiKey

    await interaction.deferReply();

    try {

      const authorization = buildAuthorization({
        username: ulid,
        webApiKey: raApiKey
      });

      let profile;
      profile = await getUserProfile(authorization, { username: ulid });
      const username = profile.user

      const pages = [];

      // 🖼️ Page principale : derniers succès
      const mainImage = await generateLatestImage(targetUser.id, lang, username);
      const mainBuffer = mainImage?.data ? Buffer.from(mainImage.data) : mainImage;
      pages.push({ buffer: mainBuffer, name: 'latestcheevos.png' });

      // 🖼️ Pages suivantes = génération à partir de l’historique
      if (user.history && user.history.length > 0) {
        const userBackground = user.background;
        const userColor = user.color;
        user
        for (let i = user.history.length - 1; i >= 0; i--) {
          const entry = user.history[i];
          entry.backgroundImage = userBackground;
          entry.textColor = userColor;
          entry.lang = lang;
          entry.username = username;
          const historyBuffer = await generateAchievementImage(entry);
          pages.push({ buffer: historyBuffer, name: `history_${i + 1}.png` });
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
        content: t(lang, "errorLatestCheevos")
      });
    }
  },
};
