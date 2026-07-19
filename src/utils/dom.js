/** Kısa element fabrikası: el('div', 'sınıflar', 'metin') */
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** document.getElementById kısayolu. */
export function byId(id) {
  return document.getElementById(id);
}

/** Elemanın tüm çocuklarını temizler. */
export function clear(node) {
  node.textContent = '';
  return node;
}
