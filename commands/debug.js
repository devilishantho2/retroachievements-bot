import { SlashCommandBuilder,MessageFlags } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('debug')
    .setDescription('Commandes de test pour le bot')
    .addSubcommand(sub =>
      sub
        .setName('testsucces')
        .setDescription('Envoie un succès test (embed)')
    )
    .addSubcommand(sub =>
      sub
        .setName('testfin')
        .setDescription('Envoie un test de jeu battu ou masterisé')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('Type de récompense')
            .setRequired(true)
            .addChoices(
              { name: 'Beaten', value: 'beaten' },
              { name: 'Mastered', value: 'mastered' }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const raUsername = interaction.user.username;

    if (subcommand === 'testsucces') {
      const embed = {
        title: '🏆 Succès test',
        description: `**${raUsername}** a débloqué :\n*Test Achievement Description*`,
        color: 0x3498db,
        thumbnail: {
          url: 'https://media.retroachievements.org/Images/000001.png',
        },
        footer: {
          text: 'Jeu : Test Game | ID: 999999',
        },
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (subcommand === 'testfin') {
      const type = interaction.options.getString('type');
      const embed = {
        title: `🎮 ${type === 'mastered' ? 'Jeu masterisé !' : 'Jeu terminé !'}`,
        description: `**${raUsername}** a ${type === 'mastered' ? 'masterisé' : 'terminé'} le jeu **Test Game** (NES)`,
        color: type === 'mastered' ? 0xf1c40f : 0xffe370,
        footer: {
          text: `Jeu : Test Game | Type : ${type}`,
        },
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
};
