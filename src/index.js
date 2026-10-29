import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchMenuHtml } from './fetch.js';
import { parseMenu } from './parse.js';
import { mergeMenus } from './merge.js';
import { buildMessages, postMessages, syncMessages } from './discord.js';

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.error('DISCORD_WEBHOOK_URL is not set');
  process.exit(1);
}

const now = new Date();
const date = process.env.DATE || new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now);
const title = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));
const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(now);

// Optional: remembers what was posted so later runs on the same day edit that message instead of posting again.
const STATE_FILE = process.env.STATE_FILE;
let state = STATE_FILE && existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : null;
if (state?.date !== date) state = null;

const EXCLUDED_CATEGORIES = new Set(['Suppen']);
// The Mensa publishes the categories one after another, so the first post of a day waits until all of these
// exist (otherwise the rest would trail in as extra messages). Past FALLBACK_HOUR it posts whatever there is,
// e.g. on days without desserts. A run with an explicit DATE never waits.
const REQUIRED_CATEGORIES = ['Hauptgerichte', 'Beilagen', 'Nachspeisen'];
const FALLBACK_HOUR = 12;
const EXCLUDED_DISHES = /^salat\s*(buffet|bar)/i; // always available, so just noise

const groups = parseMenu(await fetchMenuHtml(date))
  .filter(g => !EXCLUDED_CATEGORIES.has(g.category))
  .map(g => ({ ...g, dishes: g.dishes.filter(d => !EXCLUDED_DISHES.test(d.name)) }))
  .filter(g => g.dishes.length);
if (!groups.length) {
  // Never strike through a whole posted menu because the site returned nothing for a moment.
  console.log(`No menu for ${date}, nothing to ${state ? 'update' : 'post'}.`);
  process.exit(0);
}

if (!state && !process.env.DATE) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Berlin' }).format(now));
  const missing = REQUIRED_CATEGORIES.filter(c => !groups.some(g => g.category === c));
  if (missing.length && hour < FALLBACK_HOUR) {
    console.log(`Menu for ${date} incomplete (missing ${missing.join(', ')}), waiting.`);
    process.exit(0);
  }
}

const menu = mergeMenus(state?.menu, groups);
const payloads = buildMessages(menu, title);
const hash = createHash('sha256').update(JSON.stringify(payloads)).digest('hex'); // before the "Aktualisiert" stamp
if (state?.hash === hash) {
  console.log(`Menu for ${date} unchanged.`);
  process.exit(0);
}

let ids;
if (state) {
  ids = await syncMessages(webhook, buildMessages(menu, title, time), state.ids);
  console.log(`Updated ${ids.length} message(s) for ${date}.`);
} else {
  ids = await postMessages(webhook, payloads);
  console.log(`Posted ${ids.length} message(s) for ${date}.`);
}

if (STATE_FILE) {
  writeFileSync(STATE_FILE, JSON.stringify({ date, menu, hash, ids }));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'changed=true\n');
}
