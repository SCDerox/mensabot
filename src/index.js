import { fetchMenuHtml } from './fetch.js';
import { parseMenu } from './parse.js';
import { buildMessages, postMessages } from './discord.js';

const webhook = process.env.DISCORD_WEBHOOK_URL;
if (!webhook) {
  console.error('DISCORD_WEBHOOK_URL is not set');
  process.exit(1);
}

const date = process.env.DATE ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
const title = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T12:00:00Z`));

const EXCLUDED_CATEGORIES = new Set(['Suppen']);
const EXCLUDED_DISHES = /^salat\s*(buffet|bar)/i; // always available, so just noise

const groups = parseMenu(await fetchMenuHtml(date))
  .filter(g => !EXCLUDED_CATEGORIES.has(g.category))
  .map(g => ({ ...g, dishes: g.dishes.filter(d => !EXCLUDED_DISHES.test(d.name)) }))
  .filter(g => g.dishes.length);
if (!groups.length) {
  console.log(`No menu for ${date}, nothing to post.`);
  process.exit(0);
}

const payloads = buildMessages(groups, title);
await postMessages(webhook, payloads);
console.log(`Posted ${payloads.length} message(s) for ${date}.`);
