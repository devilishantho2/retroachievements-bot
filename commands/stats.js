import { SlashCommandBuilder } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Shows the stats of the bot'),

  async execute(interaction) {
    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const statsDB = loadDB('statsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    const color = 0xe74c3c;

    const embed = {
      title: t(lang, "statsTitle"),
      color,
      fields: [
        {
          name: "🔢 Totals",
          value:
          "```" +     
          `🏅 Total Cheevos : ${statsDB.totalCheevos}\n` +
          `💯 Total Points  : ${statsDB.totalPoints}\n\n` +
          "```",
          inline: false,
        },
        {
            name: t(lang, "statsTotal"),
            value:
            "```" +
            `🟨 1–4  : ${statsDB.total1_4}\n` +
            `🟩 5–9  : ${statsDB.total5_9}\n` +
            `🟦 10   : ${statsDB.total10}\n` +
            `🟥 25   : ${statsDB.total25}\n` +
            `🟪 50   : ${statsDB.total50}` +
            "```",
            inline: false,
          },
          {
            name: "🏆 Rewards",
            value:
            "```" +
            `🌟 Mastery     : ${statsDB.mastery}\n` +
            `⭐ Completion  : ${statsDB.completion}\n` +
            "```",
            inline: false,
          },
      ],
      footer: {
        text: `Requested by ${interaction.user.username}`,
        icon_url: interaction.user.displayAvatarURL(),
      },
      timestamp: new Date(),
    };

    await interaction.reply({ embeds: [embed] });
  },
};
