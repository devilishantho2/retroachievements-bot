import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';
import { getUserData, guildLang } from '../db_v2.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aotw')
    .setDescription('Show this week’s Achievement (AOTW)'),

  async execute(interaction) {

    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const lang = guildLang(guildId);

    const aotw = loadDB('aotwdb');

    if (!aotw || !aotw.id) {
      return interaction.reply({content: t(lang, "noAotw"), ephemeral: true});
    }

    const user = getUserData(userId);

    const unlocked = user ? user.aotw_unlocked : false;

    const color = unlocked ? 0x2ecc71 : 0xe74c3c;
    const statusEmoji = unlocked ? '✅' : '❌';
    const statusText = unlocked ? t(lang, "aotUnlocked") : t(lang, "aotNotUnlocked");

    const embed = {
      title: `🎯 Achievement of the Week : ${aotw.title}`,
      description: `${statusEmoji} **${statusText}**\n\n[${aotw.description}](https://retroachievements.org/achievement/${aotw.id})`,
      color,
      fields: [
        { name: 'Points', value: `${aotw.points}`, inline: true },
        { name: t(lang, "aotGame"), value: aotw.gameTitle ? `[${aotw.gameTitle}](https://retroachievements.org/game/${aotw.gameid})` : 'N/A', inline: true },
      ],
      timestamp: new Date(),
      footer: {
        text: 'Achievement of the Week',
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
