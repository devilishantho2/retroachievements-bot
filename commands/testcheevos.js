import { SlashCommandBuilder,MessageFlags, Message } from 'discord.js';
import { getUsers } from '../db.js';
import { generateAchievementImage } from '../generateImage.js';

export default {
  data: new SlashCommandBuilder()
    .setName('testcheevos')
    .setDescription('Affiche un succès pour tester les personnalisations'),

  async execute(interaction) {
    const users = getUsers();
    const user = users.find(u => u.discordId === interaction.user.id);

    if (!user) {
      return interaction.reply({
        content: 'Utilisateur non enregistré.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Indique à Discord qu'on répondra plus tard
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const imageBuffer = await generateAchievementImage({
      title: 'League Champion',
      points: 25,
      username: user.raUsername,
      description: 'Defeat the current champion and become the Pokémon League Champion',
      gameTitle: 'Pokémon Emerald Version',
      badgeUrl: '/Badge/315508.png',
      progressPercent: 50,
      backgroundImage: user.background,
      textColor: user.color
    });

    // Envoie dans le salon
    await interaction.channel.send({
      files: [{ attachment: imageBuffer, name: 'achievement.png' }]
    });

    // Finalise l'interaction sans message
    await interaction.deleteReply();
  },
};
