import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB, setUserColor, setUserBackground } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('customize')
    .setDescription('Personnalise ton image de succès')
    .addSubcommand(subcommand =>
      subcommand
        .setName('color')
        .setDescription('Définir la couleur de ton embed (format hex, ex: #ff0000)')
        .addStringOption(option =>
          option.setName('value')
            .setDescription('Couleur en hexadécimal (#RRGGBB)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('background')
        .setDescription("Définit l'image de fond personnalisée")
        .addStringOption(option =>
          option.setName('value')
            .setDescription("Lien direct vers l'image (.jpg/.jpeg/.png)")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();
    const value = interaction.options.getString('value');

    const usersDB = loadDB('usersdb');
    const user = usersDB[discordId];

    if (!user) {
      return interaction.reply({
        content: "❌ Tu dois d'abord t'enregistrer avec `/register` avant de personnaliser tes paramètres.",
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'color') {
      if (!/^#?[0-9A-Fa-f]{6}$/.test(value)) {
        return interaction.reply({
          content: '❌ Format invalide. Utilise un code hex comme `#ff0000`',
          flags: MessageFlags.Ephemeral,
        });
      }

      const normalizedColor = value.startsWith('#') ? value : `#${value}`;
      setUserColor(discordId, normalizedColor);

      return interaction.reply({
        content: `✅ Couleur définie sur \`${normalizedColor}\``,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'background') {
      if (!/^https?:\/\/.+\.(jpg|jpeg|png)$/i.test(value)) {
        return interaction.reply({
          content: "❌ L'URL doit être un lien direct vers une image (.jpg, .jpeg ou .png).",
          flags: MessageFlags.Ephemeral
        });
      }

      setUserBackground(discordId, value);

      return interaction.reply({
        content: "✅ Ton image de fond a bien été mise à jour !",
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
