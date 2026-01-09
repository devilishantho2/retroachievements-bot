export async function log(message) {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const prefix = `${time} - `;
    const fullMessage = typeof message === 'string'
      ? `${prefix}${message}`
      : `${prefix}📝 Log : ${message instanceof Error ? message.stack : JSON.stringify(message)}`;
  
    console.log(fullMessage);
  
    try {
      const guild = await retry(
        () => global.clientRef.guilds.fetch(process.env.LOG_GUILD_ID),
        { retries: 3, delay: 500 }
      );
      const channel = await retry(
        () => guild.channels.fetch(process.env.LOG_CHANNEL_ID),
        { retries: 3, delay: 500 }
      );
      await retry(
        () => channel.send(fullMessage.slice(0, 2000)),
        { retries: 3, delay: 500 }
      );    
    } catch (err) {
      if (err.code === 'EAI_AGAIN' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
        console.warn(`${prefix}⚠️ Discord inaccessible, log ignoré (erreur réseau temporaire).`);
      } else {
        console.error(`${prefix}❌ Erreur log Discord :`, err);
      }
    }
  }

export async function retry(fn, {
    retries = 3,
    delay = 500,
    userLabel = '',
    errorFilter = null
  } = {}) {
    let attempt = 0;
    while (attempt < retries) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        const shouldRetry = !errorFilter || errorFilter(err);
  
        if (!shouldRetry || attempt >= retries) {
          console.error(`❌ Échec après ${retries} tentatives${userLabel ? ` pour ${userLabel}` : ''} : ${err.message || err}`);
          throw err;
        }
  
        console.warn(`⏳ Tentative ${attempt}/${retries} échouée${userLabel ? ` pour ${userLabel}` : ''}, nouvelle tentative dans ${delay}ms...`);
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
      }
    }
  }

// Fonction pour obtenir l'emoji selon les points
export function getPointsEmoji(points) {
  if (points === 0) return '⬜';
  if (points >= 1 && points <= 4) return '🟨';
  if (points >= 5 && points <= 9) return '🟩';
  if (points === 10) return '🟦';
  if (points === 25) return '🟥';
  if (points === 50) return '🟪';
  if (points === 100) return '🏳️‍🌈';
  return ''; // fallback
}