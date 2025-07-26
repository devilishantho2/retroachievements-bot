  import path from 'path';
  import { fileURLToPath } from 'url';
  import { createCanvas, loadImage, registerFont } from 'canvas';

  // Pour __dirname compatible ES modules
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // 📌 Enregistrer la police Ginto  
  registerFont(path.join(__dirname, 'fonts/ggsans-Bold.ttf'), {
    family: 'gg sans Bold',
  });
  
  registerFont(path.join(__dirname, 'fonts/ggsans-Medium.ttf'), {
    family: 'gg sans Moyen',
  });
  
  registerFont(path.join(__dirname, 'fonts/ggsans-MediumItalic.ttf'), {
    family: 'gg sans Italique moyen',
  });

  const assombrissement = 50;
  const default_background = "https://raw.githubusercontent.com/devilishantho2/devilishantho2.github.io/refs/heads/main/default_background.png";
  const trophy_url = "https://raw.githubusercontent.com/devilishantho2/devilishantho2.github.io/refs/heads/main/trophy.png";

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
    hardcore = false
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
      const trophy = await loadImage(trophy_url);
      ctx.drawImage(trophy, 20, 15, 40, 40); // X, Y, width, height
    } catch (e) {
      // ne rien faire si échec
    }

    // Texte
    ctx.fillStyle = textColor;
    ctx.font = 'bold 28px "gg sans Bold"';
    ctx.fillText(` ${title} (${points} pts)`, 60, 45); // Décalage après l'image

    ctx.font = '24px "gg sans Moyen"';
    ctx.fillText(`${username} vient de débloquer :`, 20, 90);

    ctx.font = 'italic 20px "gg sans Italique moyen"';
    wrapText(ctx, `« ${description} »`, 20, 130, width - 40 - 160, 26);

    ctx.font = '22px "gg sans Moyen"';
    ctx.fillText(`Jeu : ${gameTitle} | ${progressPercent}%`, 20, height - 20);

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
          const progressImg = await loadImage(`https://raw.githubusercontent.com/devilishantho2/retroachievements-bot/refs/heads/main/sprites/${Math.min(Math.ceil(progressPercent), 100)}.png`);
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
