import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags } from 'discord.js';

const BOT_VERSION = '1.0.0';
const BOT_DESCRIPTION = '🤖 Bot RetroAchievements - Gestion des succès et stats des joueurs.';

const commandsInfo = {
  ping: {
    description: 'Renvoie le temps de réponse du bot.',
    usage: '/ping',
    details: 'Cette commande mesure la latence entre l\'envoi de la commande et la réponse du bot.'
  },
  testcheevos: {
    description: 'Affiche un succès pour tester les personnalisations.',
    usage: '/testcheevos <points>',
    details: 'Permet de générer une image de succès personnalisée avec le nombre de points spécifié.'
  },
  help: {
    description: 'Affiche ce message d\'aide interactif.',
    usage: '/help',
    details: 'Affiche un embed avec les infos basiques du bot et un menu pour choisir une commande et en voir les détails.'
  }
};

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Affiche le menu d\'aide interactif'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setTitle('Aide du Bot RetroAchievements')
      .setDescription(`${BOT_DESCRIPTION}\n\n**Version :** ${BOT_VERSION}`)
      .setColor('Blue')
      .setFooter({ text: 'Sélectionne une commande dans le menu ci-dessous pour plus d\'infos.' });

    // Construction du menu déroulant
    const options = Object.entries(commandsInfo).map(([name, info]) => ({
      label: name,
      description: info.description,
      value: name
    }));

    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('help_select')
          .setPlaceholder('Choisis une commande...')
          .addOptions(options)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

    // Récupération du message de réponse pour créer un collector
    const message = await interaction.fetchReply();

    const filter = i => i.customId === 'help_select' && i.user.id === interaction.user.id;

    const collector = message.createMessageComponentCollector({ filter, time: 60000});

    collector.on('collect', async i => {
      const cmdName = i.values[0];
      const cmdInfo = commandsInfo[cmdName];

      const cmdEmbed = new EmbedBuilder()
        .setTitle(`Commande /${cmdName}`)
        .setDescription(cmdInfo.details)
        .addFields(
          { name: 'Description', value: cmdInfo.description },
          { name: 'Utilisation', value: cmdInfo.usage }
        )
        .setColor('Green')
        .setFooter({ text: 'Commande sélectionnée depuis le menu d\'aide' });

      await i.update({ embeds: [cmdEmbed], components: [row] });
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        // Timeout : désactive le menu
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('help_select')
              .setPlaceholder('Menu expiré')
              .addOptions(options)
              .setDisabled(true)
          );

        await interaction.editReply({ components: [disabledRow] });
      }
    });
  },
};
