import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { registerFont } from 'canvas';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Résolution __dirname dans module ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Police depuis root/fonts (hors dossier commands)
registerFont(path.join(__dirname, '..', 'fonts', 'PixelOperatorHB.ttf'), {
  family: 'Pixel Operator HB Normal',
});

export default {
  data: new SlashCommandBuilder()
    .setName('apigraph')
    .setDescription("Affiche un graphique des requêtes API dans la journée"),

  async execute(interaction) {
    await interaction.deferReply();

    const filePath = path.join('data', 'api.json');
    if (!fs.existsSync(filePath)) {
      return interaction.editReply("❌ Fichier de données `api.json` introuvable.");
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const apiData = JSON.parse(rawData);

    const today = new Date();
    const key = today.toLocaleDateString('fr-FR'); // ex: "30/07/2025"
    const hours = Array.from({ length: 24 }, (_, i) => `${i}h`);

    if (!apiData[key]) {
      return interaction.editReply(`📉 Aucune donnée trouvée pour aujourd’hui (${key}).`);
    }

    const todayData = apiData[key];
    const labels = [];
    const values = [];

    for (let i = 0; i < 24; i++) {
      const hour = `${i}h`;
      labels.push(hour);
      values.push(todayData[hour] ?? null);
    }

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
            top: 0,
            bottom: 25,
            left: 25,
            right: 25
          }
        },
        scales: {
          x: {
            ticks: { color: 'white' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            title: { display: false }
          },
          y: {
            beginAtZero: true,
            ticks: { color: 'white' },
            grid: { color: 'rgba(255, 255, 255, 0.1)' },
            title: { display: false }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `Requêtes API (${key})`,
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

    const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const attachment = new AttachmentBuilder(imageBuffer, { name: 'api_graph.png' });

    await interaction.editReply({ files: [attachment] });
  }
};
