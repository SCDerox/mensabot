import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMenu } from '../src/parse.js';

const groups = parseMenu(readFileSync(new URL('./fixture.html', import.meta.url), 'utf8'));

test('groups dishes by category', () => {
  assert.deepEqual(groups.map(g => g.category), ['Suppen', 'Hauptgerichte', 'Beilagen', 'Nachspeisen']);
});

test('parses name, allergens, tags and prices', () => {
  const d = groups[0].dishes[0];
  assert.equal(d.name, 'Leberknödelsuppe');
  assert.equal(d.allergens, 'AA,C,I');
  assert.deepEqual(d.tags, ['Schwein']);
  assert.deepEqual(d.prices, ['0,80 €', '1,00 €', '1,50 €']);
  assert.equal(d.imageUrl, null);
});

test('resolves image urls to absolute', () => {
  assert.equal(groups[0].dishes[1].imageUrl, 'https://stwno.de/infomax/Bilder/3808.JPG');
});
