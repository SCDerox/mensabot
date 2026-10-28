import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeMenus } from '../src/merge.js';

const dish = (name, extra = {}) => ({ name, allergens: '', tags: [], prices: ['1 €'], imageUrl: null, ...extra });
const names = (groups, category) => groups.find(g => g.category === category).dishes.map(d => d.name);

test('without a previous menu the current one is returned unchanged', () => {
  const current = [{ category: 'Hauptgerichte', dishes: [dish('A')] }];
  assert.deepEqual(mergeMenus(null, current), current);
});

test('a dish that disappeared stays in place and is marked removed', () => {
  const prev = [{ category: 'Hauptgerichte', dishes: [dish('A'), dish('B'), dish('C')] }];
  const current = [{ category: 'Hauptgerichte', dishes: [dish('A'), dish('C')] }];
  const merged = mergeMenus(prev, current);
  assert.deepEqual(names(merged, 'Hauptgerichte'), ['A', 'B', 'C']);
  assert.deepEqual(merged[0].dishes.map(d => !!d.removed), [false, true, false]);
});

test('a new dish is appended to its category and marked added', () => {
  const prev = [{ category: 'Hauptgerichte', dishes: [dish('A')] }];
  const current = [{ category: 'Hauptgerichte', dishes: [dish('A'), dish('B')] }];
  const merged = mergeMenus(prev, current);
  assert.deepEqual(names(merged, 'Hauptgerichte'), ['A', 'B']);
  assert.deepEqual(merged[0].dishes.map(d => !!d.added), [false, true]);
});

test('a new category is appended, an added dish stays marked on later runs', () => {
  const first = mergeMenus([{ category: 'Hauptgerichte', dishes: [dish('A')] }], [
    { category: 'Hauptgerichte', dishes: [dish('A'), dish('B')] },
    { category: 'Nachspeisen', dishes: [dish('N')] },
  ]);
  assert.deepEqual(first.map(g => g.category), ['Hauptgerichte', 'Nachspeisen']);
  const second = mergeMenus(first, [
    { category: 'Hauptgerichte', dishes: [dish('A'), dish('B')] },
    { category: 'Nachspeisen', dishes: [dish('N')] },
  ]);
  assert.equal(second[0].dishes[1].added, true);
});

test('a removed dish that comes back is no longer removed', () => {
  const prev = [{ category: 'Hauptgerichte', dishes: [dish('A', { removed: true })] }];
  const merged = mergeMenus(prev, [{ category: 'Hauptgerichte', dishes: [dish('A')] }]);
  assert.equal(merged[0].dishes[0].removed, false);
});

test('current data wins for dishes that are still on the menu', () => {
  const prev = [{ category: 'Hauptgerichte', dishes: [dish('A', { prices: ['1 €'] })] }];
  const merged = mergeMenus(prev, [{ category: 'Hauptgerichte', dishes: [dish('A', { prices: ['2 €'] })] }]);
  assert.deepEqual(merged[0].dishes[0].prices, ['2 €']);
});
