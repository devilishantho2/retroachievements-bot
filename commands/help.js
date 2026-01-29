import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, EmbedBuilder, MessageFlags, Formatters } from 'discord.js';
import { loadDB } from '../db.js';
import { t } from '../locales.js';

const BOT_VERSION = '1.2.7';

const commandText = { 
  title: {
    fr: 'Aide du Bot RetroAchievements',
    en: 'RetroAchievements Bot Help'
  },
  description: {
    fr: '🤖 Bot RetroAchievements (non officiel) - Gestion des succès et stats des joueurs.\n\nPour démarrer, définissez un salon ou seront envoyés les succès (/admin setchannel), définissez la langue de votre serveur (/admin language), et dites à vos membres de se connecter (/register)\n\nBon jeu!',
    en: '🤖 RetroAchievements Bot (unofficial) - Manages player achievements and stats.\n\nTo get started, set a channel where achievements will be sent (/admin setchannel), set your server\'s language (/admin language), and have your members register (/register)\n\nHave fun!'
  },
  footer: {
    fr: 'Sélectionne une commande dans le menu ci-dessous pour plus d\'infos.',
    en: 'Select a command from the menu below for more information.' 
  }
};

const commandsInfo = {
  register: {
    fr: {
      description: 'Enregistre l\'utilisateur sur le bot.',
      usage: '/register <username> <apikey>',
      details: 'Cette commande permet à l\'utilisateur de s\'enregistrer sur ce serveur, afin d\'envoyer ses succès récents dans le salon dédié. Prend en arguments le pseudo de l\'utilisateur sur RetroAchievements, et sa clé API (nécessaire pour récupérer les succès).'
    },
    en: {
      description: 'Registers the user on the bot.',
      usage: '/register <username> <apikey>',
      details: 'This command allows the user to register on this server in order to send their recent achievements to the dedicated channel. Takes as arguments the user\'s RetroAchievements username and their API key (required to fetch achievements).'
    }
  },
  leave: {
    fr: {
      description: 'Supprime l\'utilisateur du bot',
      usage: '/leave bot/server',
      details: 'Cette commande permet à l\'utilisateur de soit arréter les notifications sur le serveur sur lequel la commande est faite (/leave server) ou de quitter completement le bot, et donc tout les serveurs (/leave bot).'
    },
    en: {
      description: 'Removes the user from the bot.',
      usage: '/leave bot/server',
      details: 'This command allows the user to either stop notifications on the server where the command is executed (/leave server) or to completely leave the bot and all servers (/leave bot).'
    }
  },
  customize: {
    fr: {
      description: 'Permet à l\'utilisateur de customiser ses annonces.',
      usage: '/customize background/color <url>/<color>',
      details: 'Cette commande permet à l\'utilisateur de changer l\'image de fond de ses succès ainsi que la couleur du texte. Pour l\'image il faut un url valide (github ou imgur marche bien), pour la couleur il faut une couleur hexadécimal.'
    },
    en: {
      description: 'Allows the user to customize their announcements.',
      usage: '/customize background/color <url>/<color>',
      details: 'This command allows the user to change the background image of their achievements as well as the text color. For the image, a valid URL is required (GitHub or Imgur work well), and for the color, a hexadecimal color code is needed.'
    }
  },
  ping: {
    fr: {
      description: 'Renvoie le temps de réponse du bot.',
      usage: '/ping',
      details: 'Cette commande mesure la latence entre l\'envoi de la commande et la réponse du bot.'
    },
    en: {
      description: 'Returns the bot\'s response time.',
      usage: '/ping',
      details: 'This command measures the latency between sending the command and the bot\'s response.'
    }
  },
  testcheevos: {
    fr: {
      description: 'Affiche un succès pour tester les personnalisations.',
      usage: '/testcheevos <points>',
      details: 'Permet de générer une image de succès personnalisée avec le nombre de points spécifié, afin de montrer à l\'utilisateur à quoi cela ressemblera.'
    },
    en: {
      description: 'Displays an achievement to test customizations.',
      usage: '/testcheevos <points>',
      details: 'Generates a custom achievement image with the specified number of points to show the user what it will look like.'
    }
  },
  aotw: {
    fr: {
      description: 'Affiche le succès de la semaine.',
      usage: '/aotw',
      details: 'Cette commande affiche les détails du succès de la semaine.'
    },
    en: {
      description: 'Displays the achievement of the week.',
      usage: '/aotw',
      details: 'This command displays the details of the achievement of the week.'
    }
  },
  aotm: {
    fr: {
      description: 'Affiche le succès du mois.',
      usage: '/aotm',
      details: 'Cette commande affiche les détails du succès du mois.'
    },
    en: {
      description: 'Displays the achievement of the month.',
      usage: '/aotm',
      details: 'This command displays the details of the achievement of the month.'
    }
  },
  lastseen: {
    fr: {
      description: 'Affiche les dernières informations de jeu d\'un utilisateur.',
      usage: '/lastseen <username>',
      details: 'Cette commande affiche les dernieres informations de jeu d\'un utilisateur, ou les dernieres informations de jeu de l\'utilisateur si aucun pseudo est donné.'
    },
    en: {
      description: 'Displays the latest gaming information for a user.',
      usage: '/lastseen <username>',
      details: 'This command displays the latest gaming information for a specified user, or for the command sender if no username is given.'
    }
  },
  vote: {
    fr: {
      description: 'Affiche les liens pour voter pour le bot sur top.gg.',
      usage: '/vote',
      details: 'Cette commande affiche les liens pour voter pour le bot sur top.gg (vote et avis), afin d\'aider le bot à se faire connaitre'
    },
    en: {
      description: 'Displays the links to vote for the bot on top.gg.',
      usage: '/vote',
      details: 'This command shows the links to vote for the bot on top.gg (vote and review), to help the bot gain visibility.'
    }
  },
  latestcheevos: {
    fr: {
      description: 'Affiche les derniers succès d\'un utilisateur',
      usage: '/latestcheevos <username>',
      details: 'Cette commande affiche les derniers succès d\'un utilisateur, ou les derniers succès de l\'utilisateur si aucun pseudo est donné.'
    },
    en: {
      description: 'Displays a user’s latest achievements',
      usage: '/latestcheevos <username>',
      details: 'This command displays a user’s latest achievements, or your own latest achievements if no username is provided.'
    }
  }
};


export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show interactive help menu'),

  async execute(interaction) {

    const guildId = interaction.guild?.id;
    const guildsDb = loadDB('guildsdb');
    const lang = guildsDb[guildId]?.lang || 'en';
    
    
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const embed = new EmbedBuilder()
      .setTitle(commandText.title[lang])
      .setDescription(`${commandText.description[lang]}\n\n**Version :** ${BOT_VERSION}`)
      .setColor('Blue')
      .setFooter({ text: commandText.footer[lang] });

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
          .setPlaceholder(t(lang, 'chooseCommand'))
          .addOptions(options)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });

    // Récupération du message de réponse pour créer un collector
    const message = await interaction.fetchReply();

    const filter = i => i.customId === 'help_select' && i.user.id === interaction.user.id;

    const collector = message.createMessageComponentCollector({ filter, time: 60000});

    collector.on('collect', async i => {
      const cmdName = i.values[0];
      const cmdInfo = commandsInfo[cmdName][lang];

      const cmdEmbed = new EmbedBuilder()
        .setTitle(t(lang, "commandDesc", { cmdName : cmdName}))
        .setDescription(cmdInfo.details)
        .addFields(
          { name: 'Description', value: cmdInfo.description },
          { name: t(lang, 'usage'), value: cmdInfo.usage }
        )
        .setColor('Green')

      await i.update({ embeds: [cmdEmbed], components: [row] });
    });

    collector.on('end', async collected => {
      if (collected.size === 0) {
        // Timeout : désactive le menu
        const disabledRow = new ActionRowBuilder()
          .addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('help_select')
              .setPlaceholder('Timeout')
              .addOptions(options)
              .setDisabled(true)
          );

        await interaction.editReply({ components: [disabledRow] });
      }
    });
  },
};
