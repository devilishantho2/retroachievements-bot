import fs from 'fs';
import path from 'path';

const localesDir = path.join(process.cwd(), 'locales');
const translations = {};

for (const file of fs.readdirSync(localesDir)) {
  if (file.endsWith('.json')) {
    const lang = file.slice(0, 2); // ex: 'fr', 'en'
    const content = fs.readFileSync(path.join(localesDir, file), 'utf-8');
    translations[lang] = JSON.parse(content);
  }
}

export function t(lang, key, variables = {}) {
  const langData = translations[lang] || translations['en']; // fallback en anglais
  let text = langData[key] || translations['en'][key] || key;

  // Remplacer les variables dans le texte, ex: {username}
  for (const [k, v] of Object.entries(variables)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return text;
}
