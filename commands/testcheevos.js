import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { generateAchievementImage } from '../generateImage.js';
import { t } from '../locales.js';
import { guildLang,getUserData } from '../db_v2.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testcheevos')
    .setDescription('Display an achievement to test the customizations')
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('Achievement\'s points')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const user = getUserData(userId);
    const lang = guildLang(guildId);

    if (!user) {
      return interaction.reply({
        content: t(lang, "testNotRegistered"),
        ephemeral: true
      });
    }

    const points = interaction.options.getInteger('points');

    await interaction.deferReply();

    const imageBuffer = await generateAchievementImage({
      title: 'League Champion',
      points,
      username: 'Username',
      description: 'Defeat the current champion and become the Pokémon League Champion',
      gameTitle: 'Pokémon Emerald Version',
      badgeUrl: '/315508.png',
      progressPercent: 50,
      backgroundImage: user.background,
      textColor: user.color,
      hardcore: true,
      lang,
      consoleicon: "gba"
    });

    await interaction.editReply({
      files: [{ attachment: imageBuffer, name: 'achievement.png' }]
    });
  },
};
