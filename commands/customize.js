import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { t } from '../locales.js';
import { guildLang, setUserColor, setUserBackground, isUserRegistered, setUserFavoriteAchievement, setUserFavoriteGame } from '../db_v2.js';
import { getAchievementV2, getGameV2 } from '../api_v2.js';


export default {
  data: new SlashCommandBuilder()
    .setName('customize')
    .setDescription('Customize the background of your achievements')
    .addSubcommand(subcommand =>
      subcommand
        .setName('color')
        .setDescription("Set the color of your text (hex format, e.g. #ff0000)")
        .addStringOption(option =>
          option.setName('value')
            .setDescription('Color in hexadecimal (#RRGGBB)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('background')
        .setDescription("Set your custom background image")
        .addStringOption(option =>
          option.setName('value')
            .setDescription("Direct link to the image (.jpg/.jpeg/.png/.webp)")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('favachievement')
        .setDescription("Set your favorite achievement")
        .addStringOption(option =>
          option.setName('achievement')
            .setDescription("Achievement ID")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('favgame')
        .setDescription("Set your favorite game")
        .addStringOption(option =>
          option.setName('game')
            .setDescription("Game ID")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const subcommand = interaction.options.getSubcommand();
    
    const lang = guildLang(guildId);

    if (!isUserRegistered(discordId)) {
      return interaction.reply({content: t(lang, "customNotRegistered"), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'color') {
      const value = interaction.options.getString('value');
      if (!/^#?[0-9A-Fa-f]{6}$/.test(value)) {
        return interaction.reply({content: t(lang, "customWrongColor"), flags: MessageFlags.Ephemeral});
      }

      const normalizedColor = value.startsWith('#') ? value : `#${value}`;
      setUserColor(discordId, normalizedColor);

      return interaction.reply({content: t(lang, "customColorSuccess", { color : normalizedColor }), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'background') {
      const value = interaction.options.getString('value');
      if (!/^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(value)) {
        return interaction.reply({content: t(lang, "customWrongImage"), flags: MessageFlags.Ephemeral});
      }

      setUserBackground(discordId, value);

      return interaction.reply({content: t(lang, "customImageSuccess"), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'favachievement') {
      const achievement = interaction.options.getString('achievement');
      if (!/^\d+$/.test(achievement)) {
        return interaction.reply({content: t(lang, "customWrongFavAch"), flags: MessageFlags.Ephemeral});
      }

      const achievementData = await getAchievementV2(achievement);

      setUserFavoriteAchievement(discordId, JSON.stringify(achievementData));

      return interaction.reply({content: t(lang, "customFavAchSuccess"), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'favgame') {
      const game = interaction.options.getString('game');
      if (!/^\d+$/.test(game)) {
        return interaction.reply({content: t(lang, "customWrongFavAch"), flags: MessageFlags.Ephemeral});
      }

      const gameData = await getGameV2(game)

      setUserFavoriteGame(discordId, JSON.stringify(gameData));

      return interaction.reply({content: t(lang, "customFavGameSuccess"), flags: MessageFlags.Ephemeral});
    }
  }
};
