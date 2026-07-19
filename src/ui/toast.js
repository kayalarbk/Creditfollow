import { el, byId } from '../utils/dom.js';

const COLORS = {
  ok: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
  warn: 'bg-warn text-gray-900',
  danger: 'bg-danger text-white'
};
const ICONS = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', danger: 'fa-circle-xmark' };

/**
 * Ekranın altında geçici bildirim gösterir.
 * Store gibi alt katmanlar da çağırdığı için ayrı modülde tutulur (döngüsel bağımlılık olmaz).
 */
export function toast(msg, type = 'ok') {
  const wrap = byId('toastWrap');
  if (!wrap) return;

  const t = el('div', 'toast-enter flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-pop text-sm font-medium ' + COLORS[type]);
  t.append(el('i', 'fa-solid ' + ICONS[type] + ' mt-0.5'), el('span', 'flex-1', msg));
  wrap.appendChild(t);

  setTimeout(() => {
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  }, 3600);
}
