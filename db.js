import fs from 'fs';
import path from 'path';
import sharp from "sharp";

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
    usersDB[discordId].raApiKey   = data.raApiKey;
  }
  saveDB(usersDB, 'usersdb');

  // Gestion guilds.json
  if (!guildsDB[guildId]) {
    guildsDB[guildId] = {
      channel: null,
      lang: "en",
      global_notifications: true,
      users: []
    };
  }

  if (!guildsDB[guildId].users.includes(discordId)) {
    guildsDB[guildId].users.push(discordId);
    saveDB(guildsDB, 'guildsdb');
  }
}

// Exemple : mise à jour lastAchievement
export function setLastAchievement(discordId, achievementData) {
  const usersDB = loadDB('usersdb');
  const user = usersDB[discordId];
  if (user) {
    user.lastAchievement = achievementData;
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

export async function setUserBackground(discordId, url) {
  const usersDB = loadDB("usersdb");
  const user = usersDB[discordId];

  // Télécharge l’image
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Échec du téléchargement de l'image: ${res.statusText}`);
  }

  // Lis le contenu brut
  const buffer = Buffer.from(await res.arrayBuffer());

  const filepath = `data/backgrounds/background_${discordId}.png`;

  // Conversion et enregistrement en PNG
  await sharp(buffer)
    .png()
    .toFile(filepath);

  // Sauvegarde dans la DB
  user.background = filepath;
  usersDB[discordId] = user;
  saveDB(usersDB, "usersdb");
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
  const data2 = loadDB('statsdb');

  if (!data[day]) data[day] = {};
  if (!data[day][hour]) data[day][hour] = 0;

  data[day][hour] += 1;
  data2.apicalls += 1;

  saveDB(data, 'apidb');
  saveDB(data2, 'statsdb');
}

export function incrementImagesGenerated(size) {
  const data = loadDB("statsdb");
  data.images += 1;
  data.imagessize += size;
  saveDB(data, 'statsdb');
}

export function addToHistory(discordId, cheevosdata) {
  const usersDB = loadDB('usersdb');
  const history = usersDB[discordId].history;

  //Si déja 10 succès récents
  if (history.length === 10) {
    history.splice(0,1);
  };

  history.push(cheevosdata);
  usersDB[discordId].history = history;
  saveDB(usersDB, 'usersdb');
}

export function changeLatestMaster(discordId,master) {
  const usersDB = loadDB('usersdb');
  usersDB[discordId].latestMaster = master;
  saveDB(usersDB, 'usersdb');
}

export function updateStats_Points(points,hardcore) {
  const statsDB = loadDB('statsdb');
  if (hardcore) {
    statsDB.totalCheevos_h += 1;
    statsDB.totalPoints_h += points;
    if (points === 0) statsDB.total0_h += 1;
    else if (points >= 1 && points <= 4) statsDB.total1_4_h += 1;
    else if (points >= 5 && points <= 9) statsDB.total5_9_h += 1;
    else if (points === 10) statsDB.total10_h += 1;
    else if (points === 25) statsDB.total25_h += 1;
    else if (points === 50) statsDB.total50_h += 1;
    else if (points === 100) statsDB.total100_h += 1;
  } else {
    statsDB.totalCheevos_s += 1;
    statsDB.totalPoints_s += points;
    if (points === 0) statsDB.total0_s += 1;
    else if (points >= 1 && points <= 4) statsDB.total1_4_s += 1;
    else if (points >= 5 && points <= 9) statsDB.total5_9_s += 1;
    else if (points === 10) statsDB.total10_s += 1;
    else if (points === 25) statsDB.total25_s += 1;
    else if (points === 50) statsDB.total50_s += 1;
    else if (points === 100) statsDB.total100_s += 1;
  }
  saveDB(statsDB, 'statsdb');
}

export function updateStats_Master(type) {
  const statsDB = loadDB("statsdb");
  if (type === "mastery") {
    statsDB.mastery += 1;
  }
  else if (type === "completion") {
    statsDB.completion += 1;
  }
  saveDB(statsDB, 'statsdb');
}