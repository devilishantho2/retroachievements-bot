import fs from 'fs';
import sharp from "sharp";

const DB = {
  "usersdb": "./data/users.json",
  "aotwdb": "./data/aotw.json",
  "aotmdb": "./data/aotm.json",
  "apidb": "./data/api.json",
  "statsdb": "./data/stats.json",
  "bandb": "./data/blacklist.json"
};

// --- Fonctions existantes, à garder intactes ---
export function loadDB(db_name) {
  if (!fs.existsSync(DB[db_name])) fs.writeFileSync(DB[db_name], JSON.stringify([]));
  return JSON.parse(fs.readFileSync(DB[db_name]));
}

export function saveDB(db, db_name) {
  fs.writeFileSync(DB[db_name], JSON.stringify(db, null, 2));
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