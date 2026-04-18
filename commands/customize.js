import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';
import { guildLang, setUserColor, setUserBackground, isUserRegistered } from '../db_v2.js';

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
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const guildId = interaction.guild?.id;
    const subcommand = interaction.options.getSubcommand();
    const value = interaction.options.getString('value');
    
    const lang = guildLang(guildId);

    if (!isUserRegistered(discordId)) {
      return interaction.reply({content: t(lang, "customNotRegistered"), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'color') {
      if (!/^#?[0-9A-Fa-f]{6}$/.test(value)) {
        return interaction.reply({content: t(lang, "customWrongColor"), flags: MessageFlags.Ephemeral});
      }

      const normalizedColor = value.startsWith('#') ? value : `#${value}`;
      setUserColor(discordId, normalizedColor);

      return interaction.reply({content: t(lang, "customColorSuccess", { color : normalizedColor }), flags: MessageFlags.Ephemeral});
    }

    if (subcommand === 'background') {
      if (!/^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(value)) {
        return interaction.reply({content: t(lang, "customWrongImage"), flags: MessageFlags.Ephemeral});
      }

      setUserBackground(discordId, value);

      return interaction.reply({content: t(lang, "customImageSuccess"), flags: MessageFlags.Ephemeral});
    }
  }
};
