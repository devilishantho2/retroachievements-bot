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
    const usersDB = loadDB('usersdb');

    const userCount = Object.keys(usersDB).length;
    const guildCount = Object.keys(guildsDB).length;

    var imagesSize = statsDB.imagessize;
    var imageOctet = "o"
    if (imagesSize >= 1073741824) {
      imagesSize = (imagesSize/1073741824).toFixed(2);
      imageOctet = "Go";
    } else if (imagesSize >= 1048576) {
      imagesSize = (imagesSize/1048576).toFixed(2);
      imageOctet = "Mo";
    } else if (imagesSize >= 1024) {
      imagesSize = (imagesSize/1024).toFixed(2);
      imageOctet = "Ko";
    }

    const color = 0xe74c3c;

    const embed = {
      title: t(lang, "statsTitle"),
      color,
      fields: [
        {
          name: "🔢 Cheevos (H/S)",
          value:
          "```" +     
          `🏅 Total Cheevos : ${statsDB.totalCheevos_h+statsDB.totalCheevos_s} (${statsDB.totalCheevos_h}/${statsDB.totalCheevos_s})\n` +
          `💯 Total Points  : ${statsDB.totalPoints_h+statsDB.totalPoints_s} (${statsDB.totalPoints_h}/${statsDB.totalPoints_s})\n\n` +
          "```",
          inline: false,
        },
        {
            name: t(lang, "statsTotal"),
            value:
            "```" +
            `⬜ 0     : ${statsDB.total0_h+statsDB.total0_s} (${statsDB.total0_h}/${statsDB.total0_s})\n` +
            `🟨 1–4   : ${statsDB.total1_4_h+statsDB.total1_4_s} (${statsDB.total1_4_h}/${statsDB.total1_4_s})\n` +
            `🟩 5–9   : ${statsDB.total5_9_h+statsDB.total5_9_s} (${statsDB.total5_9_h}/${statsDB.total5_9_s})\n` +
            `🟦 10    : ${statsDB.total10_h+statsDB.total10_s} (${statsDB.total10_h}/${statsDB.total10_s})\n` +
            `🟥 25    : ${statsDB.total25_h+statsDB.total25_s} (${statsDB.total25_h}/${statsDB.total25_s})\n` +
            `🟪 50    : ${statsDB.total50_h+statsDB.total50_s} (${statsDB.total50_h}/${statsDB.total50_s})\n` +
            `🏳️‍🌈 100    : ${statsDB.total100_h+statsDB.total100_s} (${statsDB.total100_h}/${statsDB.total100_s})\n` +
            "```",
            inline: false,
          },
          {
            name: t(lang, "statsRewards"),
            value:
            "```" +
            `🌟 Mastery     : ${statsDB.mastery}\n` +
            `⭐ Completion  : ${statsDB.completion}\n` +
            "```",
            inline: false,
          },
          {
            name: "🗂️ Miscs",
            value:
            "```" +
            t(lang, "usersStats") + `${userCount}\n` +
            t(lang, "guildsStats") + `${guildCount}\n` +
            t(lang, "apiStats") + `${statsDB.apicalls}\n` +
            t(lang, "imagesStats") + `${statsDB.images} (${imagesSize}${imageOctet})\n` +
            "```",
            inline: false,
          }
      ],
      footer: {
        text: t(lang, "statsRequested", { username : interaction.user.username }),
        icon_url: interaction.user.displayAvatarURL(),
      },
      timestamp: new Date(),
    };

    await interaction.reply({ embeds: [embed] });
  },
};
