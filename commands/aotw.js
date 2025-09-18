import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';

export default {
  data: new SlashCommandBuilder()
    .setName('aotw')
    .setDescription('Show this week’s Achievement (AOTW)'),

  async execute(interaction) {

    const guildId = interaction.guild?.id;
    const guildsDB = loadDB('guildsdb');
    const lang = guildsDB[guildId]?.lang || 'en';

    const aotw = loadDB('aotwdb');

    if (!aotw || !aotw.id) {
      return interaction.reply({
        content: t(lang, "noAotw"),
        ephemeral: true,
      });
    }

    const usersDB = loadDB('usersdb');
    const user = usersDB[interaction.user.id]; // accès direct via clé discordId

    const unlocked = user ? user.aotwUnlocked : false;

    const color = unlocked ? 0x2ecc71 : 0xe74c3c;
    const statusEmoji = unlocked ? '✅' : '❌';
    const statusText = unlocked ? t(lang, "aotUnlocked") : t(lang, "aotNotUnlocked");

    const embed = {
      title: `🎯 Achievement of the Week : ${aotw.title}`,
      description: `${statusEmoji} **${statusText}**\n\n[${aotw.description}](https://retroachievements.org/achievement/${aotw.id})`,
      color,
      fields: [
        { name: 'Points', value: `${aotw.points}`, inline: true },
        { name: t(lang, "aotGame"), value: aotw.gameTitle ? `[${aotw.gameTitle}](https://retroachievements.org/game/${aotw.game.id})` : 'N/A', inline: true },
      ],
      timestamp: new Date(),
      footer: {
        text: 'Achievement of the Week',
      },
    };

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
