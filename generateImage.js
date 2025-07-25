import { createCanvas, loadImage, registerFont } from 'canvas';

const assombrissement = 50; // 0 à 100 → 40 = 40% d’assombrissement
const default_background = "https://raw.githubusercontent.com/devilishantho2/devilishantho2.github.io/refs/heads/main/default_background.png";

export async function generateAchievementImage({
  title,
  points,
  username,
  description,
  gameTitle,
  badgeUrl,
  progressPercent,
  backgroundImage,
  textColor
}) {
  const width = 800;
  const height = 250;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // 🖼️ Chargement et affichage de l’image de fond
  let background;
  try {
    if (backgroundImage === 0) {
      background = await loadImage(default_background);
    } else {
      background = await loadImage(backgroundImage);
    }
    ctx.drawImage(background, 0, 0, width, height);
  } catch (err) {
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, width, height);
  }

  // 🕶️ Assombrissement si demandé
  if (assombrissement > 0) {
    ctx.globalAlpha = Math.min(1, assombrissement / 100);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1.0; // réinitialiser
  }

  // Texte blanc
  ctx.fillStyle = textColor;
  ctx.font = 'bold 28px Arial';
  ctx.fillText(`🏆 ${title} (${points} pts)`, 20, 50);

  ctx.font = '24px Arial';
  ctx.fillText(`${username} vient de débloquer :`, 20, 90);

  ctx.font = '20px Arial';
  wrapText(ctx, `« ${description} »`, 20, 130, width - 40 - 160, 26); // espace pour le badge

  ctx.font = '22px Arial';
  ctx.fillText(`Sur le jeu : ${gameTitle}`, 20, 200);

  // 🎖️ Badge + barre de progression
  try {
    if (badgeUrl) {
      const badgeImage = await loadImage(`https://media.retroachievements.org${badgeUrl}`);
      const badgeSize = 128;
      const badgeX = width - badgeSize - 20;
      const badgeY = height / 2 - badgeSize / 2;
      ctx.drawImage(badgeImage, badgeX, badgeY, badgeSize, badgeSize);

      if (progressPercent !== undefined && progressPercent !== null) {
        const progressImg = await loadImage(`https://raw.githubusercontent.com/devilishantho2/retroachievements-bot/refs/heads/main/sprites/${Math.min(Math.ceil(progressPercent), 100)}.png`);
        const progressWidth = 100;
        const progressHeight = 11;
        const progressX = badgeX + (badgeSize / 2) - (progressWidth / 2);
        const progressY = badgeY + badgeSize + 10;
        ctx.drawImage(progressImg, progressX, progressY, progressWidth, progressHeight);
      }
    }
  } catch {
    // ok si l’image échoue
  }

  return canvas.toBuffer('image/png');
}

// Fonction d’habillage de texte (multiligne)
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}
