import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { resetAotwUnlocked, resetAotmUnlocked } from '../db.js';
import { config } from 'dotenv';

config(); // Pour charger OWNER_ID depuis .env

export default {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Réinitialise les données AOTW ou AOTM pour tous les utilisateurs (propriétaire uniquement).')
    .addStringOption(option =>
      option
        .setName('quoi')
        .setDescription('Choix de la donnée à réinitialiser')
        .setRequired(true)
        .addChoices(
          { name: 'AOTW', value: 'aotw' },
          { name: 'AOTM', value: 'aotm' },
        )
    ),

  async execute(interaction) {
    const ownerId = process.env.OWNER_ID;
    const userId = interaction.user.id;

    if (userId !== ownerId) {
      return interaction.reply({ content: '❌ Tu n’as pas la permission d’utiliser cette commande.', flags: MessageFlags.Ephemeral });
    }

    const quoi = interaction.options.getString('quoi');

    try {
      if (quoi === 'aotw') {
        resetAotwUnlocked();
        console.log(`🚫 Tous les flags AOTW ont été réinitialisés.`);
        await interaction.reply('✅ Tous les flags AOTW ont été réinitialisés.');
      } else if (quoi === 'aotm') {
        resetAotmUnlocked();
        console.log(`🚫 Tous les flags AOTM ont été réinitialisés.`);
        await interaction.reply('✅ Tous les flags AOTM ont été réinitialisés.');
      } else {
        await interaction.reply('❌ Option inconnue.');
      }
    } catch (error) {
      console.error('❌ Erreur dans /reset :', error);
      await interaction.reply({ content: 'Erreur lors de la réinitialisation.', flags: MessageFlags.Ephemeral });
    }
  },
};
