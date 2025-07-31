import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charge la police personnalisée
registerFont(path.join(__dirname, '..', 'fonts', 'PixelOperatorHB.ttf'), {
  family: 'Pixel Operator HB Normal',
});

export default {
  data: new SlashCommandBuilder()
    .setName('apigraph')
    .setDescription("Affiche un graphique des requêtes API")
    .addStringOption(option =>
      option.setName('type')
        .setDescription("Afficher les requêtes du 'jour' ou du 'mois'")
        .setRequired(true)
        .addChoices(
          { name: 'jour', value: 'jour' },
          { name: 'mois', value: 'mois' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const type = interaction.options.getString('type');
    const filePath = path.join('data', 'api.json');

    if (!fs.existsSync(filePath)) {
      return interaction.editReply("❌ Fichier `api.json` introuvable.");
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const apiData = JSON.parse(rawData);
    const now = new Date();

    const width = 1100;
    const height = 600;
    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      backgroundColour: 'black',
      chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = 'Pixel Operator HB Normal';
        ChartJS.defaults.font.size = 14;
      }
    });

    let labels = [];
    let values = [];
    let chartTitle = '';

    if (type === 'jour') {
      const todayKey = now.toLocaleDateString('fr-FR'); // ex: "31/07/2025"
      const currentHour = now.getHours();
      const todayData = apiData[todayKey] ?? {};

      labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
      values = labels.map((hour, i) => {
        // Inclure jusqu'à l'heure en cours (y compris)
        return i <= currentHour ? todayData[hour] ?? null : null;
      });

      if (values.every(v => v === null)) {
        return interaction.editReply("📉 Aucune donnée disponible pour aujourd’hui.");
      }

      chartTitle = `Requêtes API aujourd’hui (${todayKey})`;
    }

    if (type === 'mois') {
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-based
      const monthStr = `${String(month + 1).padStart(2, '0')}/${year}`;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      labels = Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`);
      values = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dayKey = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
        const dayData = apiData[dayKey];

        if (dayData) {
          const total = Object.values(dayData).reduce((sum, val) => sum + val, 0);
          values.push(total);
        } else {
          values.push(null); // Trou vide dans la courbe
        }
      }

      chartTitle = `Requêtes API en ${monthStr}`;
    }

    const configuration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: values,
          borderColor: '#CC9900',
          backgroundColor: 'rgba(204, 153, 0, 0.3)',
          fill: true,
          spanGaps: false,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        layout: {
          padding: {
            top: 10,
            bottom: 25,
            left: 25,
            right: 25
          }
        },
        scales: {
          x: {
            ticks: { color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            title: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: 'white' },
            grid: { color: 'rgba(255,255,255,0.1)' },
            title: { display: false }
          }
        },
        plugins: {
          title: {
            display: true,
            text: chartTitle,
            color: 'white',
            font: {
              size: 20,
              family: 'Pixel Operator HB Normal'
            }
          },
          legend: {
            display: false
          }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const attachment = new AttachmentBuilder(buffer, { name: 'api_graph.png' });

    await interaction.editReply({ files: [attachment] });
  }
};
