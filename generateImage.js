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

  registerFont(path.join(__dirname, 'fonts/NotoColorEmoji-Regular.ttf'), {
    family: 'Noto Color Emoji',
  });

  const assombrissement = 50;
  const default_background = "data/backgrounds/default_background.png";

  // Fonction pour dessiner un rectangle arrondi
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

  function drawDynamicProgressBar(ctx, x, y, width, height, percent, color = '#00FF00', color2 = '#00FF00') {
    const radius = height / 2;
    const safePercent = Math.min(Math.max(percent, 0), 100);
    
    // Calcul de la largeur de la barre de progression (minimum 1px pour la visibilité)
    const progressWidth = (width * safePercent) / 100;
  
    // --- 1. FOND DE LA BARRE (La piste) ---
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; // Très léger pour laisser voir le fond
    roundRect(ctx, x, y, width, height, radius);
    ctx.fill();
  
    // --- 2. REMPLISSAGE (La progression) ---
    if (safePercent > 0) {
      ctx.save();
      
      // Création d'un dégradé qui s'adapte à la largeur actuelle
      // On commence à la couleur choisie et on finit un peu plus clair
      const grad = ctx.createLinearGradient(x, y, x + progressWidth, y);
      grad.addColorStop(0, color);
      grad.addColorStop(0.5, color2); // Éclat blanc au bout de la progression
  
      ctx.fillStyle = grad;
      
      // TRÈS IMPORTANT : On dessine ET on remplit
      roundRect(ctx, x, y, progressWidth, height, radius);
      ctx.fill(); 
      
      ctx.restore();
    }
  
    ctx.shadowColor = 'transparent';
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowBlur = 0;

    // --- 3. CONTOUR JAUNE (Par-dessus tout) ---
    ctx.beginPath(); // On repart sur un tracé propre
    roundRect(ctx, x, y, width, height, radius);
    
    ctx.strokeStyle = '#FFD700'; // Jaune doré
    ctx.lineWidth = 1;
    ctx.stroke();

  }

  function createRainbowStroke(ctx, width, height) {
    // Dégradé diagonal 45° du coin haut-gauche au coin bas-droit
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0.00, "#FF0000");
    gradient.addColorStop(0.17, "#FF7F00");
    gradient.addColorStop(0.33, "#FFFF00");
    gradient.addColorStop(0.50, "#00FF00");
    gradient.addColorStop(0.67, "#0000FF");
    gradient.addColorStop(0.83, "#4B0082");
    gradient.addColorStop(1.00, "#9400D3");
    return gradient;
  }

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

    // 🏆 Affichage de l'emoji Trophée
    ctx.font = '34px "serif"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle'

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText('🏆', 42, 39); 

    // 🏆 Affichage de l'emoji Trophée
    ctx.font = '34px "Noto Color Emoji"';
    ctx.textDrawingMode = "glyph"

    ctx.fillText('🏆', 40, 37); 

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Chargement de l'icône console qui est dynamique
    try {
      const cicon = await loadImage(`images/systems/${consoleicon}.png`);
      ctx.drawImage(cicon, 20, height - 43, 32, 32);
    } catch (e) {
    }

    // Texte
    ctx.fillStyle = textColor;
    ctx.font = '35px "Pixel Operator Gras"';
    if (title.length > 42) {
      title = title.slice(0,31);
      title = title + '[…]';
    }
    var titleText = ` ${title} (${points})`;

    const titleX = 60;
    const titleY = 45;
    
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
    
    let bgColor = null;
    let fillStyle = null;
    
    // Dégradé arc-en-ciel pour les 100 points
    if (points === 100) {
      const rainbow = ctx.createLinearGradient(rectX, rectY, rectX + rectWidth, rectY);
      rainbow.addColorStop(0.00, "#FF0000");
      rainbow.addColorStop(0.17, "#FF7F00");
      rainbow.addColorStop(0.33, "#FFFF00");
      rainbow.addColorStop(0.50, "#00FF00");
      rainbow.addColorStop(0.67, "#0000FF");
      rainbow.addColorStop(0.83, "#4B0082");
      rainbow.addColorStop(1.00, "#9400D3");
      fillStyle = rainbow;
    } else {
      if (points >= 1 && points <= 4) bgColor = 'rgb(143, 140, 0)';
      else if (points >= 5 && points <= 9) bgColor = 'rgba(0, 127, 0, 1)';
      else if (points === 10) bgColor = 'rgb(0, 67, 134)';
      else if (points === 25) bgColor = 'rgba(127, 0, 0, 1)';
      else if (points === 50) bgColor = 'rgb(97, 0, 97)';
      else bgColor = 'rgb(100, 100, 100)';
    
      fillStyle = bgColor;
    } 
    
    // 🖌️ Remplir le fond arrondi
    ctx.fillStyle = fillStyle;
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
        const badgeImage = await loadImage(`https://media.retroachievements.org/Badge${badgeUrl}`);
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
          const progressWidth = 120; // Un peu plus large que le badge
          const progressHeight = 8;
          const progressX = badgeX + (badgeSize / 2) - (progressWidth / 2);
          const progressY = badgeY + badgeSize + 12;

          // Déterminer la couleur selon la progression
          let barColor = 'rgb(0, 146, 0)'
          let barColor2 = 'rgb(0, 255, 0)';
          if (progressPercent < 30) {
            barColor = 'rgb(161, 0, 0)',
            barColor2 = 'rgb(255, 0, 0)'
          }// Rouge
          else if (progressPercent < 70) {
            barColor = 'rgb(255, 145, 0)',
            barColor2 = 'rgb(255, 208, 0)'
          }; // Orange/Jaune

          drawDynamicProgressBar(ctx, progressX, progressY, progressWidth, progressHeight, progressPercent, barColor,barColor2);
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

    if (points === 100) {
      // 🔹 Bordure arc-en-ciel autour de l'image
      const borderWidth = 6; // épaisseur de la bordure
      ctx.lineWidth = borderWidth;
      ctx.strokeStyle = createRainbowStroke(ctx, width, height);
      ctx.strokeRect(borderWidth / 2, borderWidth / 2, width - borderWidth, height - borderWidth);
    }


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
