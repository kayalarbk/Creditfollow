import { el, byId } from '../utils/dom.js';

const COLORS = {
  ok: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900',
  warn: 'bg-warn text-gray-900',
  danger: 'bg-danger text-white'
};
const ICONS = { ok: 'fa-circle-check', warn: 'fa-triangle-exclamation', danger: 'fa-circle-xmark' };
const ACTION_COLORS = {
  ok: 'text-white/90 dark:text-gray-900/80 hover:text-white dark:hover:text-gray-900',
  warn: 'text-gray-900/80 hover:text-gray-900',
  danger: 'text-white/90 hover:text-white'
};

const DEFAULT_MS = 3600;

/**
 * Ekranın altında geçici bildirim gösterir.
 * Store gibi alt katmanlar da çağırdığı için ayrı modülde tutulur (döngüsel bağımlılık olmaz).
 *
 * opts.action: { label, onClick } — bildirime tıklanabilir bir eylem ekler (ör. "Geri al").
 * opts.duration: görünme süresi (ms).
 */
export function toast(msg, type = 'ok', opts = {}) {
  const wrap = byId('toastWrap');
  if (!wrap) return;

  const t = el('div', 'toast-enter flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-pop text-sm font-medium ' + COLORS[type]);
  t.append(el('i', 'fa-solid ' + ICONS[type] + ' mt-0.5'), el('span', 'flex-1', msg));

  let timer = null;
  const dismiss = () => {
    clearTimeout(timer);
    t.style.transition = 'opacity .3s';
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 320);
  };

  if (opts.action && typeof opts.action.onClick === 'function') {
    const btn = el('button', 'shrink-0 font-bold underline underline-offset-2 transition-colors ' + ACTION_COLORS[type],
      opts.action.label || 'Geri al');
    btn.addEventListener('click', () => {
      dismiss();
      opts.action.onClick();
    });
    t.appendChild(btn);
  }

  wrap.appendChild(t);
  timer = setTimeout(dismiss, opts.duration || DEFAULT_MS);
}
