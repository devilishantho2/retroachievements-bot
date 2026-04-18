import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';
import { getUserData, guildLang } from '../db_v2.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aotm')
    .setDescription('Show this month’s Achievement (AOTM)'),

  async execute(interaction) {

    const guildId = interaction.guild?.id;
    const userId = interaction.user.id;
    const lang = guildLang(guildId);

    const aotm = loadDB('aotmdb');

    if (!aotm || !aotm.id) {
      return interaction.reply({content: t(lang, "noAotm"), ephemeral: true});
    }

    const user = getUserData(userId);

    const unlocked = user ? user.aotm_unlocked : false;

    const color = unlocked ? 0x2ecc71 : 0xe74c3c;
    const statusEmoji = unlocked ? '✅' : '❌';
    const statusText = unlocked ? t(lang, "aotUnlocked") : t(lang, "aotNotUnlocked");

    const embed = {
      title: `🎯 Achievement of the Month : ${aotm.title}`,
      description: `${statusEmoji} **${statusText}**\n\n[${aotm.description}](https://retroachievements.org/achievement/${aotm.id})`,
      color,
      fields: [
        { name: 'Points', value: `${aotm.points}`, inline: true },
        { name: t(lang, "aotGame"), value: aotm.gameTitle ? `[${aotm.gameTitle}](https://retroachievements.org/game/${aotm.gameid})` : 'N/A', inline: true },
      ],
      timestamp: new Date(),
      footer: {
        text: 'Achievement of the Month',
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
