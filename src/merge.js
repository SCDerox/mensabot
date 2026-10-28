/**
 * Folds the freshly fetched menu into what was already posted. Dishes that vanished from the site stay in
 * place flagged `removed`, dishes that showed up later are appended flagged `added`, so the Discord message
 * keeps a visible history of the day's changes instead of silently drifting from what people already read.
 */
export function mergeMenus(prev, current) {
  if (!prev) return current;

  const merged = prev.map(({ category, dishes }) => {
    const now = current.find(g => g.category === category)?.dishes ?? [];
    const kept = dishes.map(old => {
      const fresh = now.find(d => d.name === old.name);
      return fresh ? { ...fresh, added: old.added, removed: false } : { ...old, removed: true };
    });
    const fresh = now.filter(d => !dishes.some(old => old.name === d.name)).map(d => ({ ...d, added: true }));
    return { category, dishes: [...kept, ...fresh] };
  });

  for (const g of current) {
    if (!merged.some(m => m.category === g.category)) merged.push({ category: g.category, dishes: g.dishes.map(d => ({ ...d, added: true })) });
  }
  return merged;
}
