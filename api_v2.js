import { config } from 'dotenv';
config();

export async function getAchievementV2(achievementId) {
    const url = `https://api.retroachievements.org/v2/achievements/${achievementId}?include=games`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': process.env.RA_API_KEY,
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur API : ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return json.data;

    } catch (error) {
        console.error('❌ Erreur lors de l\'appel API v2 getAchievementV2 :', error.message);
    }
}

export async function getGameV2(gameId) {
    const url = `https://api.retroachievements.org/v2/games/${gameId}?include=system`;
    
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': process.env.RA_API_KEY,
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur API : ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        return json.data;

    } catch (error) {
        console.error('❌ Erreur lors de l\'appel API v2 getAchievementV2 :', error.message);
    }
}