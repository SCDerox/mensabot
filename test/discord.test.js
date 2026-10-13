import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, countComponents } from '../src/discord.js';

const dish = (i, imageUrl = 'https://example.com/a.jpg') => ({
  name: `Dish ${i}`, allergens: 'C', tags: ['vegetarisch'], prices: ['1 €', '2 €', '3 €'], imageUrl,
});
const total = msg => msg.components.reduce((n, c) => n + countComponents(c), 0);
const containers = msgs => msgs.flatMap(m => m.components).filter(c => c.type === 17);
const dishes = msgs => containers(msgs).flatMap(c => c.components).filter(c => c.type === 9);

test('small menu fits in one message with the V2 flag', () => {
  const msgs = buildMessages([{ category: 'Suppen', dishes: [dish(1), dish(2)] }], 'Dienstag');
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].flags, 1 << 15);
  assert.ok(total(msgs[0]) <= 40);
});

test('each category is its own container with its own colour', () => {
  const msgs = buildMessages([
    { category: 'Hauptgerichte', dishes: [dish(1)] },
    { category: 'Beilagen', dishes: [dish(2)] },
    { category: 'Nachspeisen', dishes: [dish(3)] },
  ], 'Dienstag');
  const colors = containers(msgs).map(c => c.accent_color);
  assert.equal(colors.length, 3);
  assert.equal(new Set(colors).size, 3);
});

test('dishes without an image get a placeholder thumbnail', () => {
  const msgs = buildMessages([{ category: 'Beilagen', dishes: [dish(1, null)] }], 'Dienstag');
  const [section] = dishes(msgs);
  assert.match(section.accessory.media.url, /^https:\/\/.+\.png$/);
});

test('whole categories are packed together instead of orphaning single dishes', () => {
  const group = (category, n) => ({ category, dishes: Array.from({ length: n }, (_, i) => dish(i)) });
  const msgs = buildMessages([group('Hauptgerichte', 5), group('Beilagen', 6), group('Nachspeisen', 4)], 'Dienstag');
  for (const m of msgs) assert.ok(total(m) <= 40);
  assert.equal(dishes(msgs).length, 15);
  assert.equal(containers(msgs).length, 3); // nothing was split
});

test('an oversized category is split, stays under the limit and keeps all dishes', () => {
  const msgs = buildMessages([{ category: 'Hauptgerichte', dishes: Array.from({ length: 25 }, (_, i) => dish(i)) }], 'Dienstag');
  assert.ok(msgs.length > 1);
  for (const m of msgs) assert.ok(total(m) <= 40);
  assert.equal(dishes(msgs).length, 25);
});
