import fs from 'fs';

const DB_FILE = './db.json';
const AOTW_FILE = './aotw.json';
const AOTM_FILE = './aotm.json';

// --- Fonctions existantes, à garder intactes ---
// Exemple : chargement DB
export function loadDB() {
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB_FILE));
}

// Exemple : sauvegarde DB
export function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Exemple : récupérer tous les users
export function getUsers() {
  return loadDB();
}

// Exemple : ajouter un user avec initialisation de aotwUnlocked et aotmUnlocked
export function addUser(user) {
  const db = loadDB();
  if (!db.find(u => u.discordId === user.discordId)) {
    db.push({
      ...user,
      aotwUnlocked: false,
      aotmUnlocked: false,
      // autres variables que tu utilises déjà ici
    });
    saveDB(db);
  }
}

// Exemple : mise à jour lastAchievement
export function setLastAchievement(discordId, achievementId) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.lastAchievement = achievementId;
    saveDB(db);
  }
}

// --- Fonctions existantes pour la couleur utilisateur (exemple) ---
export function setUserColor(discordId, color) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.color = color;
    saveDB(db);
  }
}

export function getUserColor(discordId) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
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

// --- Fonctions AOTM (à ajouter) ---
export function getAotmInfo() {
  if (!fs.existsSync(AOTM_FILE)) return null;
  return JSON.parse(fs.readFileSync(AOTM_FILE));
}

export function setAotmInfo(aotm) {
  fs.writeFileSync(AOTM_FILE, JSON.stringify(aotm, null, 2));
}

export function setAotmUnlocked(discordId, value = true) {
  const db = loadDB();
  const user = db.find(u => u.discordId === discordId);
  if (user) {
    user.aotmUnlocked = value;
    saveDB(db);
  }
}

export function resetAotmUnlocked() {
  const db = loadDB();
  for (const user of db) {
    user.aotmUnlocked = false;
  }
  saveDB(db);
}
