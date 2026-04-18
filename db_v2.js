import Database from "better-sqlite3"; 
import sharp from "sharp";

const db = new Database('./data/bot_database.db');
db.pragma('foreign_keys = ON');

// Retourne True si l'utilisateur est enregistré, False sinon
export function isUserRegistered(discordId) {
    return !!db.prepare('SELECT 1 FROM users WHERE discord_id = ?').get(discordId)
}

// Retourne True si l'utilisateur est enregistré sur le serveur, False sinon
export function isUserInGuild(guildId,discordId) {
    return !!db.prepare('SELECT 1 FROM guild_members WHERE guild_id = ? AND user_id = ?').get(guildId,discordId)
}

// Retourne True si la guild est setup
export function isGuildSetup(guildId) {
    return !!db.prepare('SELECT 1 FROM guilds WHERE id = ?').get(guildId)
}

// Retourne la langue du serveur
export function guildLang(guildId) {
    const guildData = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId)
    return guildData ? guildData.lang : 'en'
}

// Supprime un utilisateur du bot
export function deleteUserFromBot(discordId) {
    const deleteOp = db.transaction((id) => {
        db.prepare('DELETE FROM guild_members WHERE user_id = ?').run(id);
        db.prepare('DELETE FROM users WHERE discord_id = ?').run(id);
    });
    deleteOp(discordId);
}

// Supprime un utilisteur d'un serveur, puis du bot si il n'est plus dans aucun serveur
export function deleteUserFromServer(guildId, discordId) {
    const deleteOp = db.transaction((gId, uId) => {
        db.prepare('DELETE FROM guild_members WHERE guild_id = ? AND user_id = ?').run(gId, uId);
        if (!db.prepare('SELECT 1 FROM guild_members WHERE user_id = ?').get(uId)) {
            db.prepare('DELETE FROM users WHERE discord_id = ?').run(uId);
        }
    });
    return deleteOp(guildId, discordId);
}

// Ajoute un utilisateur
export function addUser(discordId,ulid,raApiKey,lastAchievement,lastAchievementDate,lastMaster,lastMasterDate,history) {
    db.prepare(`
        INSERT INTO users (discord_id, ulid, ra_api_key, background, color, last_achievement_id, last_achievement_time, aotw_unlocked, aotm_unlocked, last_master_id, last_master_hardcore, history) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (discord_id) DO UPDATE SET ulid = excluded.ulid, ra_api_key = excluded.ra_api_key
        `)
        .run(discordId, ulid, raApiKey, null, null, lastAchievement, lastAchievementDate, 0, 0, lastMaster, lastMasterDate, JSON.stringify(history))
}

// Ajoute un utilisateur à un serveur
export function addUserToGuild(guildId, discordId) {
    db.prepare('INSERT INTO guild_members (guild_id, user_id) VALUES (?,?)').run(guildId, discordId)
}

// Ajoute un serveur
export function addGuild(guildId,channelId) {
    db.prepare(`
        INSERT INTO guilds (id,channel_id,lang,global_notifications) 
        VALUES (?,?,?,?)
        ON CONFLICT (id) DO UPDATE SET channel_id = excluded.channel_id
        `)
        .run(guildId, channelId, 'en', 1)
}

// Retourne le nombre d'utilisateurs
export function getUserCount() {
    const row = db.prepare('SELECT COUNT(*) as total FROM users').get();
    return row.total;
}

// Retourne le nombre de serveurs
export function getGuildCount() {
    const row = db.prepare('SELECT COUNT(*) as total FROM guilds').get();
    return row.total;
}

// Change la couleur d'un utilisateur
export function setUserColor(discordId,color) {
    db.prepare('UPDATE users SET color = ? WHERE discord_id = ?').run(color,discordId)
}

// Change la langue d'un serveur
export function setGuildLang(guildId,lang) {
    db.prepare('UPDATE guilds SET lang = ? WHERE id = ?').run(lang,guildId)
}

// Change le parametre global notifications d'un serveur
export function setGuildGlobalNotifications(guildId,value) {
    db.prepare('UPDATE guilds SET global_notifications = ? WHERE id = ?').run(value,guildId)
}

// Change le background d'un utilisateur
export async function setUserBackground(discordId,url) {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Échec du téléchargement de l'image: ${res.statusText}`);
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      const filepath = `data/backgrounds/background_${discordId}.png`;
      await sharp(buffer)
        .resize({
          width: 800,
          height: 250,
          fit: 'inside',
          withoutEnlargement: true
        })
        .png()
        .toFile(filepath);

    db.prepare('UPDATE users SET background = ? WHERE discord_id = ?').run(`background_${discordId}.png`,discordId)
}

// Retourne toutes les données d'un utilisateur
export function getUserData(discordId) {
    const rows = db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
    return rows;
}

// Retourne toutes les données d'un serveur
export function getGuildData(guildId) {
    const rows = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
    return rows;
}

// Retourne les serveurs dans lequel l'utilisateur est
export function getGuildsWithUser(discordId) {
    const rows = db.prepare('SELECT guild_id FROM guild_members WHERE user_id = ?').all(discordId);
    return rows.map(row => row.guild_id);
}

// Retourne les serveurs dans lequel l'utilisateur n'est pas
export function getGuildsWithoutUser(discordId) {
    const rows = db.prepare(`SELECT id FROM guilds WHERE id NOT IN (SELECT guild_id FROM guild_members WHERE user_id = ?)`).all(discordId);
    return rows.map(row => row.id);
}

// Retourne tout les utilisateurs
export function getAllUsers() {
    const rows = db.prepare('SELECT discord_id FROM users').all()
    return rows.map(row => row.discord_id);
}

// Retourne tout les utilisateurs d'un serveur
export function getAllUsersInServer(guildId) {
    const rows = db.prepare('SELECT user_id FROM guild_members WHERE guild_id = ?').all(guildId);
    return rows.map(row => row.user_id);
}

// Change les informations du dernier succès d'un utilisateur
export function setUserLastAchievement(discordId,achievementId,achievementDate) {
    db.prepare('UPDATE users SET last_achievement_id = ?, last_achievement_time = ? WHERE discord_id = ?').run(achievementId,achievementDate,discordId)
}

// Change les informations du dernier master d'un utilisateur
export function setUserLastMaster(discordId,masterId,hardcore) {
    db.prepare('UPDATE users SET last_master_id = ?, last_master_hardcore = ? WHERE discord_id = ?').run(masterId,hardcore,discordId)
}

// Ajoute un succès à l'historique d'un joueur
export function addToUserHistory(discordId,achievementData) {
    const row = db.prepare('SELECT history FROM users WHERE discord_id = ?').get(discordId);
    let history = JSON.parse(row.history || "[]");
    if (history.length >= 10) { history.shift() };
    history.push(achievementData);
    db.prepare('UPDATE users SET history = ? WHERE discord_id = ?').run(JSON.stringify(history), discordId)
}

// Remet à false le satut de l'aotw pour tout le monde
export function resetAotwUnlocked() {
    db.prepare('UPDATE users SET aotw_unlocked = 0').run()
}

// Remet à false le satut de l'aotm pour tout le monde
export function resetAotmUnlocked() {
    db.prepare('UPDATE users SET aotm_unlocked = 0').run()
}

// Change le statut de l'aotw pour un joueur
export function setUserAotw(discordId,value) {
    db.prepare('UPDATE users SET aotw_unlocked = ? WHERE discord_id = ?').run(value,discordId)
}

// Change le statut de l'aotm pour un joueur
export function setUserAotm(discordId,value) {
    db.prepare('UPDATE users SET aotm_unlocked = ? WHERE discord_id = ?').run(value,discordId)
}