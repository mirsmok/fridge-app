// Heurystyczne dopasowanie tekstu (składnik / pozycja zakupów) do produktów w spiżarni.
// Uwzględnia polską odmianę przez porównanie rdzeni (obcięcie końcówki).
export function matchPantry(text, products) {
  if (!text || !Array.isArray(products)) return null;
  const t = text.toLowerCase();
  for (const p of products) {
    const words = (p.name || '').toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    for (const w of words) {
      const stem = w.slice(0, Math.max(4, w.length - 2));
      if (t.includes(stem)) return p;
    }
  }
  return null;
}
