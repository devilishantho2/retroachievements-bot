import fs from 'fs';
import path from 'path';

const DB = {
  "usersdb": "./data/users.json",
  "guildsdb": "./data/guilds.json",
  "aotwdb": "./data/aotw.json",
  "aotmdb": "./data/aotm.json",
  "apidb": "./data/api.json",
  "statsdb": "./data/stats.json"
};

// --- Fonctions existantes, à garder intactes ---
export function loadDB(db_name) {
  if (!fs.existsSync(DB[db_name])) fs.writeFileSync(DB[db_name], JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB[db_name]));
}

export function saveDB(db, db_name) {
  fs.writeFileSync(DB[db_name], JSON.stringify(db, null, 2));
}

// Ajouter ou mettre à jour un user
export function addUser(discordId, guildId, data) {
  // Chargement des DB
  const usersDB = loadDB('usersdb');
  const guildsDB = loadDB('guildsdb');

  // Ajout ou mise à jour dans users.json
  if (!usersDB[discordId]) {
    usersDB[discordId] = data;
  } else {
    // On met à jour les champs sensibles
    usersDB[discordId].raUsername = data.raUsername;
    usersDB[discordId].raApiKey   = data.raApiKey;
  }
  saveDB(usersDB, 'usersdb');

  // Gestion guilds.json
  if (!guildsDB[guildId]) {
    guildsDB[guildId] = {
      channel: 0,
      lang: "en",
      users: []
    };
  }

  if (!guildsDB[guildId].users.includes(discordId)) {
    guildsDB[guildId].users.push(discordId);
    saveDB(guildsDB, 'guildsdb');
  }
}


// Exemple : mise à jour lastAchievement
export function setLastAchievement(discordId, achievementId) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.lastAchievement = achievementId;
    saveDB(usersDB, 'usersdb');
  }
}

// --- Fonctions existantes pour la couleur utilisateur (exemple) ---
export function setUserColor(discordId, color) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.color = color;
    saveDB(usersDB, 'usersdb');
  }
}

export function getUserColor(discordId) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  return user?.color ?? null;
}

// --- Fonctions AOTW ---
export function setAotwUnlocked(discordId, value = true) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.aotwUnlocked = value;
    saveDB(usersDB, 'usersdb');
  }
}

export function resetAotwUnlocked() {
  const usersDB = loadDB('usersdb');
  for (const discordId in usersDB) {
    if (Object.hasOwn(usersDB, discordId)) {
      usersDB[discordId].aotwUnlocked = false;
    }
  }
  saveDB(usersDB, 'usersdb');
}

// --- Fonctions AOTM (à ajouter) ---
export function setAotmUnlocked(discordId, value = true) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.aotmUnlocked = value;
    saveDB(usersDB, 'usersdb');
  }
}

export function resetAotmUnlocked() {
  const usersDB = loadDB('usersdb');
  for (const discordId in usersDB) {
    if (Object.hasOwn(usersDB, discordId)) {
      usersDB[discordId].aotmUnlocked = false;
    }
  }
  saveDB(usersDB, 'usersdb');
}

export function setUserBackground(discordId, background) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.background = background;
    saveDB(usersDB, 'usersdb');
  }
}

export function getUserBackground(discordId) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  return user?.background ?? 0;
}

export function incrementApiCallCount() {
  const now = new Date();
  const day = now.toLocaleDateString('fr-FR'); // e.g. "30/07/2025"
  const hour = `${now.getHours()}h`; // e.g. "17h"

  const data = loadDB('apidb');

  if (!data[day]) data[day] = {};
  if (!data[day][hour]) data[day][hour] = 0;

  data[day][hour] += 1;

  saveDB(data, 'apidb')
}

export function addToHistory(discordId,url,hardcore,buffer) {
  const usersDB = loadDB('usersdb');
  const raUsername = usersDB[discordId].raUsername;
  const history = usersDB[discordId].history;

  //Si déja 10 succès récents
  if (history.length === 10) {
    const older = history[0];
    fs.unlink(`./data/images/${discordId}${older[0]}`, (err) => {
      if (err) {
        console.error(`Erreur suppression ${older[0]}:`, err);
      } else {
        console.log(`✅ Fichier ${older[0]} supprimé`);
      }
    });
    history.splice(0,1);
  };

  //Sauvegarde du succès
  const dir = path.join('./data/images', discordId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, url);
  fs.writeFileSync(filePath, buffer);

  history.push([url,hardcore]);
  usersDB[discordId].history = history;
  saveDB(usersDB, 'usersdb');
}

export function changeLatestMaster(discordId,master) {
  const usersDB = loadDB('usersdb');
  usersDB[discordId].latestMaster = master;
  saveDB(usersDB, 'usersdb');
}

export function updateStats(points) {
  const statsDB = loadDB('statsdb');
  statsDB.totalCheevos += 1;
  statsDB.totalPoints += points;
  if (points === 0) statsDB.total0 += 1;
  else if (points >= 1 && points <= 4) statsDB.total1_4 += 1;
  else if (points >= 5 && points <= 9) statsDB.total5_9 += 1;
  else if (points === 10) statsDB.total10 += 1;
  else if (points === 25) statsDB.total25 += 1;
  else if (points === 50) statsDB.total50 += 1;
  saveDB(statsDB, 'statsdb');
}