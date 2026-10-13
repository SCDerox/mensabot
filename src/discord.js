const TEXT = 10, SECTION = 9, THUMBNAIL = 11, CONTAINER = 17;
const IS_COMPONENTS_V2 = 1 << 15;
const MAX_COMPONENTS = 40; // Discord counts nested components too

const EMOJI_CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/72x72/';
const emojiUrl = code => `${EMOJI_CDN}${code}.png`;

// Per-category look. Unknown categories fall back to DEFAULT_STYLE.
const STYLES = {
  Suppen: { emoji: '🍲', color: 0xf1c40f, placeholder: '1f372' },
  Hauptgerichte: { emoji: '🍽️', color: 0xe67e22, placeholder: '1f37d' },
  Beilagen: { emoji: '🥔', color: 0x2ecc71, placeholder: '1f954' },
  Nachspeisen: { emoji: '🍮', color: 0xe91e63, placeholder: '1f36e' },
};
const DEFAULT_STYLE = { emoji: '🍴', color: 0x3498db, placeholder: '1f374' };

const TAG_EMOJI = {
  vegan: '🌱', vegetarisch: '🥕', schwein: '🐖', rind: '🐄', geflügel: '🐔', fisch: '🐟', lamm: '🐑', wild: '🦌', 'bio-gericht': '♻️',
};

const text = content => ({ type: TEXT, content });

/** Total components Discord counts for a tree (the node itself plus all descendants). */
export function countComponents(c) {
  return 1 + (c.components ?? []).reduce((n, x) => n + countComponents(x), 0) + (c.accessory ? countComponents(c.accessory) : 0);
}

function dishComponent(d, style) {
  const tags = d.tags.map(t => `${TAG_EMOJI[t.toLowerCase()] ?? '•'} ${t}`).join('  ');
  const meta = [tags, d.allergens && `Allergene: ${d.allergens}`].filter(Boolean).join('  ·  ');
  const content = [`**${d.name}**`, meta && `-# ${meta}`, d.prices[0] && `💶 **${d.prices[0]}**`].filter(Boolean).join('\n');
  // Always a Section so every row has the same layout; dishes without a photo get an emoji stand-in.
  return {
    type: SECTION,
    components: [text(content)],
    accessory: { type: THUMBNAIL, media: { url: d.imageUrl ?? emojiUrl(style.placeholder) } },
  };
}

function container(category, style, dishes) {
  return {
    type: CONTAINER,
    accent_color: style.color,
    components: [text(`### ${style.emoji} ${category}`), ...dishes],
  };
}

/**
 * Builds one or more webhook payloads. Every category is its own container with its own accent colour.
 * Whole categories are packed into messages; a category is only split (heading repeated) when it can't
 * fit in a single message on its own.
 */
export function buildMessages(groups, title) {
  const header = text(`# 🍽️ Mensa Uni Passau\n-# ${title} · Preise für Studierende`);

  const blocks = [];
  for (const g of groups) {
    const style = STYLES[g.category] ?? DEFAULT_STYLE;
    const dishes = g.dishes.map(d => dishComponent(d, style));
    const whole = container(g.category, style, dishes);
    if (countComponents(whole) <= MAX_COMPONENTS - 1) {
      blocks.push(whole);
      continue;
    }
    let chunk = [];
    let used = 2; // container + heading
    for (const dish of dishes) {
      const n = countComponents(dish);
      if (chunk.length && used + n > MAX_COMPONENTS - 1) {
        blocks.push(container(g.category, style, chunk));
        chunk = [];
        used = 2;
      }
      chunk.push(dish);
      used += n;
    }
    if (chunk.length) blocks.push(container(g.category, style, chunk));
  }

  const messages = [];
  let current = [header];
  let used = 1;
  for (const block of blocks) {
    const n = countComponents(block);
    if (current.length && used + n > MAX_COMPONENTS) {
      messages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += n;
  }
  messages.push(current);

  return messages.map(components => ({ flags: IS_COMPONENTS_V2, components }));
}

export async function postMessages(webhookUrl, payloads) {
  for (const payload of payloads) {
    const res = await fetch(`${webhookUrl}?with_components=true&wait=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Discord webhook failed: HTTP ${res.status} ${await res.text()}`);
  }
}
