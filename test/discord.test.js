import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessages, countComponents, postMessages, syncMessages } from '../src/discord.js';

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

test('a removed dish is struck through, marked and its photo is a spoiler', () => {
  const msgs = buildMessages([{ category: 'Hauptgerichte', dishes: [{ ...dish(1), removed: true }, dish(2)] }], 'Dienstag');
  const [gone, kept] = dishes(msgs);
  assert.match(gone.components[0].content, /~~\*\*Dish 1\*\*~~/);
  assert.match(gone.components[0].content, /entfällt/i);
  assert.equal(gone.accessory.spoiler, true);
  assert.doesNotMatch(kept.components[0].content, /~~|entfällt/);
  assert.notEqual(kept.accessory.spoiler, true);
});

test('an added dish is marked as new', () => {
  const msgs = buildMessages([{ category: 'Hauptgerichte', dishes: [{ ...dish(1), added: true }, dish(2)] }], 'Dienstag');
  const [added, plain] = dishes(msgs);
  assert.match(added.components[0].content, /neu/i);
  assert.doesNotMatch(plain.components[0].content, /neu/i);
});

test('the header shows when the menu was last updated', () => {
  const msgs = buildMessages([{ category: 'Beilagen', dishes: [dish(1)] }], 'Dienstag', '11:32');
  assert.match(msgs[0].components[0].content, /Aktualisiert 11:32/);
  const plain = buildMessages([{ category: 'Beilagen', dishes: [dish(1)] }], 'Dienstag');
  assert.doesNotMatch(plain[0].components[0].content, /Aktualisiert/);
});

function stubFetch(handler) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', body: init.body && JSON.parse(init.body) });
    const { status = 200, json = {} } = handler(calls.at(-1), calls.length) ?? {};
    return { ok: status < 300, status, json: async () => json, text: async () => JSON.stringify(json) };
  };
  return calls;
}
const realFetch = globalThis.fetch;
const HOOK = 'https://discord.com/api/webhooks/1/token';
const payload = n => ({ flags: 1 << 15, components: [{ type: 10, content: `m${n}` }] });

test('postMessages returns the ids of the created messages', async () => {
  let n = 0;
  const calls = stubFetch(() => ({ json: { id: `id${++n}` } }));
  try {
    assert.deepEqual(await postMessages(HOOK, [payload(1), payload(2)]), ['id1', 'id2']);
    assert.match(calls[0].url, /wait=true/);
  } finally { globalThis.fetch = realFetch; }
});

test('syncMessages edits existing messages, posts extra ones and deletes surplus ones', async () => {
  const calls = stubFetch(() => ({ json: { id: 'new' } }));
  try {
    assert.deepEqual(await syncMessages(HOOK, [payload(1), payload(2), payload(3)], ['a', 'b']), ['a', 'b', 'new']);
    assert.deepEqual(calls.map(c => c.method), ['PATCH', 'PATCH', 'POST']);
    assert.match(calls[0].url, /\/messages\/a\?with_components=true/);

    calls.length = 0;
    assert.deepEqual(await syncMessages(HOOK, [payload(1)], ['a', 'b']), ['a']);
    assert.deepEqual(calls.map(c => c.method), ['PATCH', 'DELETE']);
    assert.match(calls[1].url, /\/messages\/b$/);
  } finally { globalThis.fetch = realFetch; }
});

test('syncMessages reposts a message that was deleted in Discord', async () => {
  const calls = stubFetch(c => (c.method === 'PATCH' ? { status: 404 } : { json: { id: 'fresh' } }));
  try {
    assert.deepEqual(await syncMessages(HOOK, [payload(1)], ['gone']), ['fresh']);
    assert.deepEqual(calls.map(c => c.method), ['PATCH', 'POST']);
  } finally { globalThis.fetch = realFetch; }
});
