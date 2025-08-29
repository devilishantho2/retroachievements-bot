import { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Show links to vote and leave a review for the bot'),

  async execute(interaction) {
    // Réponse éphémère (visible seulement par l'utilisateur)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lang = loadDB("guildsdb")[interaction.guildId]?.lang || 'en';

    // Création de l'embed
    const embed = new EmbedBuilder()
      .setTitle(t(lang, "voteTitle"))
      .setDescription(t(lang, "voteDesc"))
      .setColor(0x5865F2);

    // Création des boutons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('📢 Vote')
        .setStyle(ButtonStyle.Link)
        .setURL('https://top.gg/bot/1378808458110963903/vote'),
      new ButtonBuilder()
        .setLabel(t(lang, "voteReview"))
        .setStyle(ButtonStyle.Link)
        .setURL('https://top.gg/bot/1378808458110963903#reviews')
    );

    // Envoi de la réponse
    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
