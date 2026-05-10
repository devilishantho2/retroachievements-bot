import path from 'path';
import sharp from "sharp";
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { consoleTable } from './consoleTable.js';
import { codeBlock } from 'discord.js';
import { t } from './locales.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration des Polices ---
const fonts = [
    { file: 'fonts/PixelOperatorHB.ttf', family: 'Pixel Operator HB Normal' },
    { file: 'fonts/PixelOperator-Bold.ttf', family: 'Pixel Operator Gras' },
    { file: 'fonts/NotoColorEmoji-Regular.ttf', family: 'Noto Color Emoji' }
];
fonts.forEach(f => registerFont(path.join(__dirname, f.file), { family: f.family }));

const ASSOMBRISSEMENT = 50;
const DEFAULT_BG = "data/backgrounds/default_background.png";
const RA_BASE_URL = "https://media.retroachievements.org";

// --- Utilitaires Graphiques ---

function roundRect(ctx, x, y, width, height, radius = 12, fill = true, stroke = false) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius); // Utilisation de la méthode native moderne
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function drawStyledRect(ctx, x, y, width, height, radius, fillColor, strokeColor, lineWidth = 2) {
    ctx.save();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    
    // 1. On remplit d'abord (le fond semi-transparent)
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    }
    
    // 2. On dessine la bordure par-dessus
    if (strokeColor) {
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
    }

    ctx.restore()
}

function getPointsStyle(ctx, pts, x, y, size) {
    const p = parseInt(pts);
    if (p === 100) {
        const grad = ctx.createLinearGradient(x, y, x + size, y + size);
        ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#9400D3"]
            .forEach((color, i, arr) => grad.addColorStop(i / (arr.length - 1), color));
        return grad;
    }
    if (p >= 1 && p <= 4) return '#E2DE00';
    if (p >= 5 && p <= 9) return '#00A700';
    
    const colors = { 10: '#005DBB', 25: '#BB0000', 50: '#850085' };
    return colors[p] || '#646464';
}

function drawDynamicProgressBar(ctx, x, y, width, height, percent, color1, color2) {
    const radius = height / 2;
    const safePercent = Math.min(Math.max(percent, 0), 100);
    const progressWidth = (width * safePercent) / 100;

    ctx.save();
    // Fond
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, x, y, width, height, radius);

    if (safePercent > 0) {
        const grad = ctx.createLinearGradient(x, y, x + progressWidth, y);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        roundRect(ctx, x, y, progressWidth, height, radius);
    }
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, width, height, radius, false, true);
    ctx.restore();
}

function wrapAchievement(ctx, title, points, x, y, maxWidth, lineHeight, hardcore) {
    const pointsText = `(${points})${hardcore ? ' 🌟' : ''}`;
    let words = title.split(' '), line = '', offsetY = 0;

    for (let word of words) {
        let testLine = line + word + ' ';
        if (ctx.measureText(testLine).width > maxWidth) {
            ctx.fillText(line, x, y + offsetY);
            line = word + ' ';
            offsetY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y + offsetY);

    const lastWidth = ctx.measureText(line).width;
    ctx.fillStyle = 'yellow';
    if (lastWidth + ctx.measureText(pointsText).width > maxWidth) {
        ctx.fillText(pointsText, x, y + offsetY + lineHeight);
    } else {
        ctx.fillText(pointsText, x + lastWidth, y + offsetY);
    }
}

function fillSmartText(ctx, text, x, y, maxWidth, baseSize, minSize, lineHeight, fontName, align = 'left') {
    let fontSize = baseSize;
    ctx.font = `${fontSize}px "${fontName}"`;

    // 1. Réduction de la taille de police si le texte (entier) dépasse
    // Note : On vérifie ici si le texte tient sur une seule ligne à baseSize
    while (ctx.measureText(text).width > maxWidth && fontSize > minSize) {
        fontSize--;
        ctx.font = `${fontSize}px "${fontName}"`;
    }

    const words = text.split(' ');
    let lines = [];
    let currentLine = '';

    // 2. Découpage dynamique en n lignes
    for (let n = 0; n < words.length; n++) {
        let testLine = currentLine + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && n > 0) {
            lines.push(currentLine.trim());
            currentLine = words[n] + ' ';
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine.trim()); // Ajout de la dernière ligne

    // 3. Dessin des lignes
    const oldAlign = ctx.textAlign;
    ctx.textAlign = align;

    lines.forEach((line, index) => {
        // La première ligne (index 0) sera à 'y'
        // Les suivantes descendront de 'lineHeight' à chaque fois
        ctx.fillText(line, x, y + (index * lineHeight));
    });

    ctx.textAlign = oldAlign;
}

function fillWrappedMasteryTitle(ctx, text, x, y, maxWidth, maxHeight, baseSize, fontName) {
    let fontSize = baseSize;
    let lines = [];
    let totalHeight = 0;
    const lineHeightMultiplier = 1.2;

    // Boucle de réduction de taille
    while (fontSize > 10) {
        ctx.font = `${fontSize}px "${fontName}"`;
        lines = [];
        const words = text.split(' ');
        let currentLine = '';

        // Simulation du wrap pour calculer la hauteur
        for (let word of words) {
            let testLine = currentLine + word + ' ';
            if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine.trim());

        totalHeight = lines.length * (fontSize * lineHeightMultiplier);

        // Si la hauteur totale est correcte, on arrête de réduire
        if (totalHeight <= maxHeight) break;
        fontSize--;
    }

    // Dessin effectif du texte centré
    const oldAlign = ctx.textAlign;
    ctx.textAlign = 'center';
    
    // On centre le bloc de texte verticalement sur le point Y de départ
    let startY = y - (totalHeight / 2) + (fontSize);

    for (let line of lines) {
        ctx.fillText(line, x, startY);
        startY += (fontSize * lineHeightMultiplier);
    }

    ctx.textAlign = oldAlign;
}

// --- Fonction Principale ---

export async function generateProfileImage(backgroundImage, color, data, data2, data3, data4, data5,lang = 'en') {

    const canvas = createCanvas(800, 1100);
    const ctx = canvas.getContext('2d');
    const primaryColor = color || '#ffffff';
    const bgPath = backgroundImage ? `data/backgrounds/${backgroundImage}` : DEFAULT_BG;
    ctx.textDrawingMode = "glyph"

    // 1. Fond & Effets
    try {
        const baseBg = await loadImage(bgPath);
        ctx.drawImage(baseBg, 0, 0, 800, 250);
        const blurredBuffer = await sharp(bgPath).blur(15).toBuffer();
        const blurredBg = await loadImage(blurredBuffer);
        ctx.drawImage(blurredBg, 0, 250, 800, 950);
    } catch {
        ctx.fillStyle = '#444444';
        ctx.fillRect(0, 0, 800, 1200);
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${ASSOMBRISSEMENT / 100})`;
    ctx.fillRect(0, 0, 800, 1200);

    // 2. Header (Profil)
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 794, 244);

    ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
    
    const profilePic = await loadImage(`${RA_BASE_URL}${data.userPic}`);
    ctx.drawImage(profilePic, 40, 61, 128, 128);

    ctx.textDrawingMode = "path";
    ctx.fillStyle = primaryColor;
    ctx.font = '45px "Pixel Operator HB Normal"';
    ctx.fillText(data.user, 200, 60);
    ctx.font = '23px "Pixel Operator HB Normal"';
    ctx.fillText(data.motto, 200, 90);
    ctx.font = '25px "Pixel Operator HB Normal"';
    ctx.fillText(`Mastery ......................... ${data2.masteryAwardsCount}\nCompletion ...................... ${data2.completionAwardsCount}\nPoints ........................... ${data.totalPoints} (${data.totalTruePoints})\nRank ............................. #${data.rank}/${data.totalRanked}`, 200, 130);

    // 3. Dernier Jeu
    ctx.textDrawingMode = "glyph";
    ctx.font = '25px "Pixel Operator HB Normal"';
    ctx.fillText(t(lang,"lastGame"), 15, 280);

    ctx.textDrawingMode = "path";
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    drawStyledRect(ctx, 15, 295, 770, 140, 6, 'rgba(255, 255, 255, 0.2)', primaryColor, 2);

    if (data.recentlyPlayed.length > 0) {
        const lastGame = data.recentlyPlayed[0];
        const gameIcon = await loadImage(`${RA_BASE_URL}${lastGame.imageIcon}`);
        ctx.drawImage(gameIcon, 30, 315, 100, 100);

        const sysIcon = await loadImage(`images/systems/${consoleTable[lastGame.consoleName]}.png`);
        ctx.drawImage(sysIcon, 100, 385, 40, 40);

        ctx.fillStyle = primaryColor;
        ctx.font = '30px "Pixel Operator HB Normal"';
        fillSmartText(ctx, lastGame.title, 150, 335, 620, 30, 14, 18, "Pixel Operator HB Normal");
        ctx.font = '17px "Pixel Operator HB Normal"';
        fillSmartText(ctx, `>> ${data.richPresenceMsg}`, 150, 360, 620, 17, 14, 18, "Pixel Operator HB Normal");

        const stats = data.awarded[lastGame.gameId];
        const percent = Math.ceil((stats.numAchievedHardcore / stats.numPossibleAchievements) * 100);
        const barColors = percent < 30 ? ['#A10000', '#FF0000'] : (percent < 70 ? ['#FF9100', '#FFD000'] : ['#009200', '#00FF00']);
        
        drawDynamicProgressBar(ctx, 150, 385, 200, 15, percent, barColors[0], barColors[1]);
        ctx.fillText(`${stats.numAchievedHardcore}/${stats.numPossibleAchievements} (${percent}%)`, 370, 398);
    }

    // 4. Succès Récents (Optimisé avec Promise.all)
    ctx.textDrawingMode = "glyph";
    ctx.font = '25px "Pixel Operator HB Normal"';
    ctx.fillStyle = primaryColor;
    ctx.fillText(t(lang,"lastRewards"), 15, 470);
    drawStyledRect(ctx, 15, 490, 540, 400, 6, 'rgba(255, 255, 255, 0.2)', primaryColor, 2);
    drawStyledRect(ctx, 570, 490, 215, 400, 6, 'rgba(255, 255, 255, 0.2)', primaryColor, 2);

    if (data.recentAchievements) {
        const recentList = Object.values(data.recentAchievements).flatMap(g => Object.values(g))
            .sort((a, b) => new Date(b.dateAwarded) - new Date(a.dateAwarded)).slice(0, 10);

        const badgeImages = await Promise.all(recentList.map(a => loadImage(`${RA_BASE_URL}/Badge/${a.badgeName}.png`)));

        recentList.forEach((achiev, i) => {
            const col = i < 5 ? 0 : 1;
            const row = i % 5;
            const x = 24 + (col * 276);
            const y = 500 + row * 77.7;

            ctx.drawImage(badgeImages[i], x, y, 70, 70);
            ctx.lineWidth = 3;
            ctx.strokeStyle = getPointsStyle(ctx, achiev.points, x, y, 70);
            ctx.strokeRect(x, y, 70, 70);

            ctx.fillStyle = primaryColor;
            ctx.font = '15px "Pixel Operator HB Normal"';
            wrapAchievement(ctx, achiev.title, achiev.points, x + 85, y + 20, 160, 15, achiev.hardcoreAchieved);
        });
    }

    // 5. Dernière Maîtrise
    const latestMastery = data2.visibleUserAwards
        .filter(a => a.awardType === "Mastery/Completion")
        .sort((a, b) => new Date(b.awardedAt) - new Date(a.awardedAt))[0];

    if (latestMastery) {
        const awardImg = await loadImage(`${RA_BASE_URL}${latestMastery.imageIcon}`);
        const masterConsoleIcon = await loadImage(`images/systems/${consoleTable[latestMastery.consoleName]}.png`);
        const centerX = 677.5;
        
        ctx.drawImage(awardImg, centerX - 50, 520, 100, 100);

        if (latestMastery.awardDataExtra === 1) {
            ctx.save();
            ctx.strokeStyle = 'yellow'; 
            ctx.lineWidth = 3;
            ctx.strokeRect(centerX - 50, 520, 100, 100);
            ctx.restore();
        }

        ctx.drawImage(masterConsoleIcon, centerX + 30, 600, 40, 40);
        
        ctx.fillStyle = primaryColor;
        ctx.textDrawingMode = 'path';
        fillWrappedMasteryTitle(ctx, latestMastery.title, centerX, 670, 195, 70, 25, "Pixel Operator HB Normal");

        ctx.textAlign = "center";
        const achievementsList = Object.values(data3.achievements);
        var pointstotal = 0;
        const repartition = achievementsList.reduce((acc, ach) => {
            const p = ach.points;
            pointstotal += p;
            let label;

            if (p >= 1 && p <= 4) {
                label = "p14";
            } else if (p >= 5 && p <= 9) {
                label = "p59";
            } else {
                label = `p${p}`;
            }

            acc[label] = (acc[label] || 0) + 1;
            return acc;
        }, {});

        ctx.fillText(t(lang, "profileMasterPoints", {number:data3.numAchievements}),centerX,740);
        ctx.fillText(`${pointstotal} points`,centerX,760);
        ctx.font = '20px "Pixel Operator HB Normal"';
        ctx.fillText(latestMastery.awardedAt.split('T')[0],centerX,850)
        ctx.textDrawingMode = 'glyph';

        ctx.font = '13px "Pixel Operator HB Normal"';
        ctx.fillText(`🟨 ${repartition.p14 ? repartition.p14 : "0"} 🟩 ${repartition.p59 ? repartition.p59 : "0"} 🟦 ${repartition.p10 ? repartition.p10 : "0"} 🟥 ${repartition.p25 ? repartition.p25 : "0"} 🟪 ${repartition.p50 ? repartition.p50 : "0"} 🏳️‍🌈 ${repartition.p100 ? repartition.p100 : "0"}`,centerX,800);
        
    }

    // 6. Favoris game
    ctx.textDrawingMode = "glyph";
    ctx.textAlign = "left";
    ctx.font = '25px "Pixel Operator HB Normal"';
    ctx.fillStyle = primaryColor;
    ctx.fillText(t(lang,"profileFavorites"), 15, 920);
    drawStyledRect(ctx, 15, 940, 377.5, 150, 6, 'rgba(255, 255, 255, 0.2)', primaryColor, 2);
    drawStyledRect(ctx, 405, 940, 377.5, 150, 6, 'rgba(255, 255, 255, 0.2)', primaryColor, 2);

    if (data5) {
        ctx.textDrawingMode = "path";
        const favGameImg = await loadImage(data5.attributes.badgeUrl);
        ctx.drawImage(favGameImg, 30, 964, 100, 100);
        fillSmartText(ctx,data5.attributes.title,260,980,250,25,19,14,"Pixel Operator HB Normal","center");
        ctx.textAlign = "center";
        ctx.fillText(t(lang, "profileMasterPoints", {number:data5.attributes.achievementsPublished}),250, 1030);
        ctx.fillText(`${data5.attributes.pointsTotal}(${data5.attributes.pointsWeighted}) points`,250, 1050);
    }

    //7. Favoris ach
    if (data4) {
        const favAchievementImg = await loadImage(data4.attributes.badgeUrl);
        ctx.drawImage(favAchievementImg, 420, 964, 100, 100);
        fillSmartText(ctx,`${data4.attributes.title} (${data4.attributes.points})`,650,980,250,25,19,14,"Pixel Operator HB Normal","center");
        fillSmartText(ctx,data4.attributes.description,650,1030,250,25,14,14,"Pixel Operator HB Normal","center");
    }

    return canvas.toBuffer('image/png');
}