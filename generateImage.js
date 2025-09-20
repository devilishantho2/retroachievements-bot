  import path from 'path';
  import { fileURLToPath } from 'url';
  import { createCanvas, loadImage, registerFont } from 'canvas';
  import { incrementImagesGenerated } from './db.js';
  import { t } from './locales.js';

  // Pour __dirname compatible ES modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 📌 Enregistrer la police Ginto  
  registerFont(path.join(__dirname, 'fonts/PixelOperatorHB.ttf'), {
    family: 'Pixel Operator HB Normal',
  });
  
  registerFont(path.join(__dirname, 'fonts/PixelOperator-Bold.ttf'), {
    family: 'Pixel Operator Gras',
  });

  const assombrissement = 50;
  const default_background = "data/backgrounds/default_background.png";

  export async function generateAchievementImage({
    title,
    points,
    username,
    description,
    gameTitle,
    badgeUrl,
    progressPercent,
    backgroundImage,
    textColor,
    hardcore = false,
    lang = "en",
    consoleicon = `unknown`
  }) {
    const width = 800;
    const height = 250;
    const canvas = createCanvas(width, height); 
    const ctx = canvas.getContext('2d');

    // 🖼️ Fond
    let background;
    try {
      background = await loadImage(backgroundImage === 0 ? default_background : backgroundImage);
      ctx.drawImage(background, 0, 0, width, height);
    } catch (err) {
      ctx.fillStyle = '#444444';
      ctx.fillRect(0, 0, width, height);
    }

    // 🕶️ Assombrissement
    if (assombrissement > 0) {
      ctx.globalAlpha = Math.min(1, assombrissement / 100);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }
  
    // Appliquer l’ombre portée noire
    ctx.shadowColor = 'black';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    ctx.shadowBlur = 4;

    // 🏆 Image trophée
    try {
      const trophy = await loadImage(`images/trophy.png`);
      ctx.drawImage(trophy, 20, 15, 40, 40); // X, Y, width, height
      const cicon = await loadImage(`images/systems/${consoleicon}.png`);
      ctx.drawImage(cicon, 20, height - 43, 32, 32);
    } catch (e) {
      // ne rien faire si échec
    }

    // Texte
    ctx.fillStyle = textColor;
    ctx.font = '35px "Pixel Operator Gras"';
    const titleText = ` ${title} (${points})`;
    const titleX = 60;
    const titleY = 45;
    
    // 🎨 Choisir la couleur selon les points
    let bgColor;
    if (points >= 1 && points <= 4) bgColor = 'rgb(143, 140, 0)';       // Jaune
    else if (points >= 5 && points <= 9) bgColor = 'rgba(0, 127, 0, 1)';     // Vert
    else if (points === 10) bgColor = 'rgb(0, 67, 134)'; // Bleu
    else if (points === 25) bgColor = 'rgba(127, 0, 0, 1)';   // Rouge
    else if (points === 50) bgColor = 'rgb(97, 0, 97)'; // Violet
    else bgColor = 'rgb(100, 100, 100)'; // Neutre
    
    // 📏 Mesurer le texte
    const metrics = ctx.measureText(titleText);
    const textWidth = metrics.width;
    const fontSize = 35; // utilisé pour centrer verticalement
    
    // 🔲 Dimensions du fond
    const paddingX = 0;
    const paddingY = 0;
    const rectX = titleX - paddingX + 5;
    const rectY = titleY - fontSize + (fontSize * 0.2) - paddingY;
    const rectWidth = textWidth + paddingX * 2;
    const rectHeight = fontSize + paddingY * 1.5;
    
    // 🟦 Dessiner un rectangle arrondi
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
    
    // 🖌️ Remplir le fond arrondi
    ctx.fillStyle = bgColor;
    roundRect(ctx, rectX, rectY, rectWidth, rectHeight, 6);
    
    // ✍️ Écrire le texte par-dessus
    ctx.fillStyle = textColor;
    ctx.fillText(titleText, titleX, titleY);
    
    ctx.font = '24px "Pixel Operator HB Normal"';
    ctx.fillText(t(lang, 'unlockHeader', { username: username }), 20, 90);

    ctx.font = '20px "Pixel Operator HB Normal"';
    wrapTextSkewed(ctx, `« ${description} »`, 20, 130, width - 40 - 160, 26, -0.2);

    ctx.font = '22px "Pixel Operator HB Normal"';
    ctx.fillText(`${gameTitle} | ${progressPercent}%`, 60, height - 20);

    // 🎖️ Badge + barre de progression
    try {
      if (badgeUrl) {
        const badgeImage = await loadImage(`https://media.retroachievements.org${badgeUrl}`);
        const badgeSize = 128;
        const badgeX = width - badgeSize - 20;
        const badgeY = height / 2 - badgeSize / 2;
        ctx.drawImage(badgeImage, badgeX, badgeY, badgeSize, badgeSize);
  
        // ⭐ Contour jaune si hardcore
        if (hardcore) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#FFD700'; // or 'yellow'
          ctx.strokeRect(badgeX, badgeY, badgeSize, badgeSize);
        }
  
        if (progressPercent !== undefined && progressPercent !== null) {
          const progressImg = await loadImage(`images/progress_bar/${Math.min(Math.ceil(progressPercent), 100)}.png`);
          const progressWidth = 100;
          const progressHeight = 11;
          const progressX = badgeX + (badgeSize / 2) - (progressWidth / 2);
          const progressY = badgeY + badgeSize + 10;
          ctx.drawImage(progressImg, progressX, progressY, progressWidth, progressHeight);
        }
      }
    } catch {
      // on ignore les erreurs d'image
    }

    // Désactiver l’ombre après
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;

    const buffer = canvas.toBuffer('image/png');
    incrementImagesGenerated(buffer.length);
    return buffer;
  }

  // Fonction d’habillage de texte (multiligne)
  function wrapTextSkewed(ctx, text, x, y, maxWidth, lineHeight, skewX = 0) {
    const words = text.split(' ');
    let line = '';
    let offsetY = 0;

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > maxWidth && n > 0) {
            const offsetX = skewX * (y + offsetY); // décalage à gauche pour compenser
            ctx.setTransform(1, 0, skewX, 1, -offsetX, 0);
            ctx.fillText(line, x, y + offsetY);
            offsetY += lineHeight;
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }

    const offsetX = skewX * (y + offsetY);
    ctx.setTransform(1, 0, skewX, 1, -offsetX, 0);
    ctx.fillText(line, x, y + offsetY);

    // Réinitialise les transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0);
}
