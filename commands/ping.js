import { SlashCommandBuilder, MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Renvoie le temps de réponse du bot'),

  async execute(interaction) {
    // On defer la réponse en mode éphemère (visible que par l'utilisateur)
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // On calcule la latence : temps actuel - timestamp de la requête
    const latency = Date.now() - interaction.createdTimestamp;

    // On édite la réponse avec la latence calculée
    await interaction.editReply(`Pong ! 🏓 Temps de réponse : ${latency} ms`);
  },
};
