import fs from 'fs';
import path from 'path';

const USERS_FILE = './data/users.json';
const GUILDS_FILE = './data/guilds.json';
const AOTW_FILE = './data/aotw.json';
const AOTM_FILE = './data/aotm.json';
const apiFile = path.resolve('./data/api.json');

// --- Fonctions existantes, à garder intactes ---
// Exemple : chargement DB
export function loadDB(db_name) {
  if (db_name === 'usersdb') {
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(USERS_FILE));
  }
  else if (db_name === 'guildsdb') {
    if (!fs.existsSync(GUILDS_FILE)) fs.writeFileSync(GUILDS_FILE, JSON.stringify([]));
    return JSON.parse(fs.readFileSync(GUILDS_FILE));
  }
}

// Exemple : sauvegarde DB
export function saveDB(db, db_name) {
  if (db_name === 'usersdb') {
    fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
  }
  else if (db_name === 'guildsdb') {
    fs.writeFileSync(GUILDS_FILE, JSON.stringify(db, null, 2));
  }
}

// Ajouter un user si il existe pas
export function addUser(discordId, guildId, data) {
  // Chargement des DB
  const usersDB = loadDB('usersdb');
  const guildsDB = loadDB('guildsdb');

  // Ajout dans users.json si inexistant
  if (!usersDB[discordId]) {
    usersDB[discordId] = data;
    saveDB(usersDB, 'usersdb');
  }

  // Gestion guilds.json
  if (!guildsDB[guildId]) {
    // Création d'une nouvelle guilde
    guildsDB[guildId] = {
      channel: 0,
      users: []
    };
  }

  // Ajout de l'utilisateur dans la liste users si pas déjà dedans
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
export function getAotwInfo() {
  if (!fs.existsSync(AOTW_FILE)) return null;
  return JSON.parse(fs.readFileSync(AOTW_FILE));
}

export function setAotwInfo(aotw) {
  fs.writeFileSync(AOTW_FILE, JSON.stringify(aotw, null, 2));
}

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
export function getAotmInfo() {
  if (!fs.existsSync(AOTM_FILE)) return null;
  return JSON.parse(fs.readFileSync(AOTM_FILE));
}

export function setAotmInfo(aotm) {
  fs.writeFileSync(AOTM_FILE, JSON.stringify(aotm, null, 2));
}

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

  let data = {};
  if (fs.existsSync(apiFile)) {
    try {
      data = JSON.parse(fs.readFileSync(apiFile, 'utf8'));
    } catch (err) {
      console.error('❌ Erreur lecture api.json :', err);
    }
  }

  if (!data[day]) data[day] = {};
  if (!data[day][hour]) data[day][hour] = 0;

  data[day][hour] += 1;

  try {
    fs.writeFileSync(apiFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Erreur écriture api.json :', err);
  }
}