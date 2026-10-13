import { BASE } from './fetch.js';

const ENTITIES = { euro: '€', auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', amp: '&', nbsp: ' ', quot: '"' };
const decode = s => s.replace(/&(\w+);/g, (m, e) => ENTITIES[e] ?? m);

/** @returns {{category: string, dishes: Dish[]}[]} categories that contain at least one dish */
export function parseMenu(html) {
  const groups = [];
  for (const [, kind, body] of html.matchAll(/<tr class='(gruppenkopf|essenzeile)'>([\s\S]*?)<\/tr>/g)) {
    if (kind === 'gruppenkopf') {
      groups.push({ category: decode(body.match(/class='gk bold'>(.*?)<\/td>/)[1]).trim(), dishes: [] });
      continue;
    }
    const cell = body.match(/class='cell1'[^>]*>([\s\S]*?)<\/td>/)?.[1];
    if (!cell || !groups.length) continue;
    const img = body.match(/<img src='([^']*Bilder\/[^']+)'/);
    groups.at(-1).dishes.push({
      name: decode(cell.replace(/<sup>[\s\S]*?<\/sup>/g, '').replace(/<[^>]+>/g, '')).trim(),
      allergens: cell.match(/<sup>\((.*?)\)<\/sup>/)?.[1] ?? '',
      tags: [...body.matchAll(/class='icon' alt='([^']*)'/g)].map(m => decode(m[1])),
      prices: [...body.matchAll(/class='preis'[^>]*>(.*?)<\/td>/g)].map(m => decode(m[1]).trim()),
      imageUrl: img ? new URL(img[1], BASE).href : null,
    });
  }
  return groups.filter(g => g.dishes.length);
}
