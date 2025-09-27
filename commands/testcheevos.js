import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { generateAchievementImage } from '../generateImage.js';
import { t } from '../locales.js';

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
    const usersDB = loadDB('usersdb');
    const user = usersDB[interaction.user.id];

    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    if (!user) {
      return interaction.reply({
        content: t(lang, "testNotRegistered"),
        ephemeral: true
      });
    }

    const points = interaction.options.getInteger('points');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const imageBuffer = await generateAchievementImage({
      title: 'League Champion',
      points,
      username: user.raUsername,
      description: 'Defeat the current champion and become the Pokémon League Champion',
      gameTitle: 'Pokémon Emerald Version',
      badgeUrl: '/Badge/315508.png',
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
