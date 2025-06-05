// db.js
import fs from 'fs';

const DB_FILE = './db.json';
const AOTW_FILE = './aotw.json';

// Chargement des utilisateurs
function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB_FILE));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// AOTW
function loadAotw() {
  if (!fs.existsSync(AOTW_FILE)) fs.writeFileSync(AOTW_FILE, JSON.stringify(null));
  return JSON.parse(fs.readFileSync(AOTW_FILE));
}

function saveAotw(aotw) {
  fs.writeFileSync(AOTW_FILE, JSON.stringify(aotw, null, 2));
}

// Utilisateurs
export function getUsers() {
  return loadDB();
}

export function addUser(user) {
  const db = loadDB();
  if (!db.find(u => u.discordId === user.discordId)) {
    db.push({ ...user, aotwUnlocked: false }); // on initialise le champ ici
    saveDB(db);
  }
}

export function setLastAchievement(discordId, achievementId) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.lastAchievement = achievementId;
    saveDB(db);
  }
}

export function setUserColor(discordId, color) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.color = color;
    saveDB(db);
  }
}

// AOTW
export function setAotwUnlocked(discordId, value = true) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.aotwUnlocked = value;
    saveDB(db);
  }
}

export function resetAotwUnlocked() {
  const db = loadDB();
  for (const user of db) {
    user.aotwUnlocked = false;
  }
  saveDB(db);
}

export function getAotwInfo() {
  return loadAotw();
}

export function setAotwInfo(aotw) {
  saveAotw(aotw);
}
