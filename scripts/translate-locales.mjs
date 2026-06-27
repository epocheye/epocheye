/**
 * Generate src/i18n/locales/hi.json and bn.json from en.json using the Google
 * Cloud Translation API (v2). Placeholders like {{name}} are protected so they
 * survive translation. Auto-translation still needs a human review pass.
 *
 *   GOOGLE_TRANSLATE_API_KEY=xxxx node scripts/translate-locales.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
if (!KEY) {
  console.error('Set GOOGLE_TRANSLATE_API_KEY in the environment.');
  process.exit(1);
}

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
const en = JSON.parse(await fs.readFile(path.join(localesDir, 'en.json'), 'utf8'));

const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const unflatten = flat => {
  const out = {};
  for (const [key, v] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) cur[p] = v;
      else cur = cur[p] ??= {};
    });
  }
  return out;
};

// Protect {{placeholders}} from the translator, restore afterward. Each is masked
// with ONE Unicode Private-Use-Area code point (not a digit) so the translator
// passes it through untouched — bare digits collide with literal numbers and get
// converted to Devanagari/Bengali numerals in hi/bn, losing the placeholder.
const protect = s => {
  const tokens = [];
  const masked = s.replace(/\{\{[^}]+\}\}/g, m => {
    const idx = tokens.push(m) - 1;
    return String.fromCharCode(0xe010 + idx);
  });
  return {masked, tokens};
};
const restore = (s, tokens) =>
  s.replace(/[-]/g, c => tokens[c.charCodeAt(0) - 0xe010] ?? '');

async function translateBatch(texts, target) {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${KEY}`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({q: texts, source: 'en', target, format: 'text'}),
    },
  );
  if (!res.ok) {
    throw new Error(`translate ${target} HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  return data.data.translations.map(tr => tr.translatedText);
}

const flat = flatten(en);
const keys = Object.keys(flat);

for (const target of ['hi', 'bn']) {
  const out = {};
  const CHUNK = 100;
  for (let i = 0; i < keys.length; i += CHUNK) {
    const slice = keys.slice(i, i + CHUNK);
    const protectedSlice = slice.map(k => protect(String(flat[k])));
    const translated = await translateBatch(
      protectedSlice.map(p => p.masked),
      target,
    );
    translated.forEach((tr, j) => {
      out[slice[j]] = restore(tr, protectedSlice[j].tokens);
    });
  }
  const json = JSON.stringify(unflatten(out), null, 2) + '\n';
  await fs.writeFile(path.join(localesDir, `${target}.json`), json, 'utf8');
  console.log(`wrote ${target}.json (${keys.length} strings)`);
}
console.log('Done. Review hi.json / bn.json — machine translation needs a human pass.');
