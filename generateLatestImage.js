import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { loadDB } from './db.js'; // ta DB locale
import { t } from './locales.js';

// Pour __dirname compatible ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📌 Enregistrer les mêmes polices
registerFont(path.join(__dirname, 'fonts/PixelOperatorHB.ttf'), {
  family: 'Pixel Operator HB Normal',
});

registerFont(path.join(__dirname, 'fonts/PixelOperator-Bold.ttf'), {
  family: 'Pixel Operator Gras',
});

const assombrissement = 50;
const trophy_url = "https://raw.githubusercontent.com/devilishantho2/devilishantho2.github.io/refs/heads/main/trophy.png";

export async function generateLatestImage(discordId, lang = 'en') {
  const usersDB = loadDB('usersdb');
  const userData = usersDB[discordId];

  const width = 800;
  const height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 🖼️ Fond
  try {
    const background = await loadImage(userData.background);
    ctx.drawImage(background, 0, 0, width, height);
  } catch {
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, width, height);
  }

  // 🕶️ Assombrissement
  ctx.globalAlpha = Math.min(1, assombrissement / 100);
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1.0;

  // 🔲 Fond arrondi derrière le titre
  const header = t(lang, 'latestCheevosTitle', { username : userData.raUsername });
  ctx.font = '35px "Pixel Operator Gras"';
  const headerMetrics = ctx.measureText(header);
  const paddingX = 10;
  const paddingY = 10;
  const rectWidth = headerMetrics.width + paddingX * 2;
  const rectHeight = 35; // approximatif pour la hauteur du texte
  const rectX = width / 2 - rectWidth / 2;
  const rectY = 20;

  ctx.shadowColor = 'black';
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;
  ctx.shadowBlur = 4;
  // arrondi
  function roundRect(ctx, x, y, width, height, radius = 12) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  //ctx.fillStyle = '#FFD700';
  ctx.fillStyle = '#004386';
  roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 8);

  // ✍️ Texte du haut avec drop shadow
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(header, width / 2 - headerMetrics.width / 2, 45);
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  // Dimensions pour le bas
  const profileSize = 124;
  const margin = 30;
  const badgeSize = 64;
  const gridCols = 5;
  const gridRows = 2;
  const gridSpacing = 20;
  const gridStartX = (width - (badgeSize * gridCols + gridSpacing * (gridCols - 1))) / 2;
  const gridStartY = 85;

  // 🔲 Photo de profil avec drop shadow
  try {
    const profileImg = await loadImage(`https://media.retroachievements.org/UserPic/${userData.raUsername}.png`);
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;
    ctx.drawImage(profileImg, margin, height - profileSize - margin, profileSize, profileSize);
  } catch {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#222222';
    ctx.fillRect(margin, height - profileSize - margin, profileSize, profileSize);
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  // 🔲 Dernier jeu masterisé avec drop shadow et contour jaune si hardcore
  const latestMaster = userData.latestMaster;
  if (latestMaster) {
    const [imagePath, hardcore] = latestMaster;
    try {
      const latestImg = await loadImage(`https://media.retroachievements.org${imagePath}`);
      ctx.shadowColor = 'black';
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.shadowBlur = 4;
      ctx.drawImage(latestImg, width - profileSize - margin, height - profileSize - margin, profileSize, profileSize);

      if (hardcore) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFD700';
        ctx.strokeRect(width - profileSize - margin, height - profileSize - margin, profileSize, profileSize);
      }
    } catch {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#222222';
      ctx.fillRect(width - profileSize - margin, height - profileSize - margin, profileSize, profileSize);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#222222';
    ctx.fillRect(width - profileSize - margin, height - profileSize - margin, profileSize, profileSize);
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.shadowBlur = 0;

  // 🔲 Grille des derniers succès avec drop shadow et contour hardcore
  const history = userData.history.slice().reverse().slice(0, gridCols * gridRows);
  for (let i = 0; i < gridCols * gridRows; i++) {
    const row = Math.floor(i / gridCols);
    const col = i % gridCols;
    const x = gridStartX + col * (badgeSize + gridSpacing);
    const y = gridStartY + row * (badgeSize + gridSpacing);

    if (history[i]) {
      const badgePath = history[i].badgeUrl;
      const hardcore = history[i].hardcore;
      try {
        const badgeImg = await loadImage(`https://media.retroachievements.org${badgePath}`);
        ctx.shadowColor = 'black';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.shadowBlur = 4;
        ctx.drawImage(badgeImg, x, y, badgeSize, badgeSize);

        if (hardcore) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#FFD700';
          ctx.strokeRect(x, y, badgeSize, badgeSize);
        }
      } catch {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#222222';
        ctx.fillRect(x, y, badgeSize, badgeSize);
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#222222';
      ctx.fillRect(x, y, badgeSize, badgeSize);
      ctx.globalAlpha = 1;
    }
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;
  }

  return canvas.toBuffer('image/png');
}

