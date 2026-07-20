import { el, byId, clear } from '../utils/dom.js';

/**
 * Modal kabuğu ve form yapı taşları.
 * İçerikler src/ui/modals/ altındaki builder'larda tanımlanır.
 */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal açılmadan önce odakta olan öğe; kapanışta oraya dönülür. */
let previousFocus = null;

/**
 * Odağı modalın içinde tutar.
 * Modal açıkken arka plandaki düğmelere Tab ile ulaşılabilmesi
 * hem klavye hem ekran okuyucu kullanıcıları için kafa karıştırıcıdır.
 */
function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const box = byId('modalBox');
  const items = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null);
  if (items.length === 0) return;

  const first = items[0];
  const last = items[items.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

export function openModal(build) {
  const box = clear(byId('modalBox'));
  build(box);
  previousFocus = document.activeElement;
  byId('modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', trapFocus);

  const first = box.querySelector('input, select, button');
  if (first) first.focus();
}

export function closeModal() {
  const modal = byId('modal');
  if (modal.classList.contains('hidden')) return;

  modal.classList.add('hidden');
  document.body.style.overflow = '';
  document.removeEventListener('keydown', trapFocus);

  // Odağı modalı açan öğeye geri ver (hâlâ sayfadaysa)
  if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  previousFocus = null;
}

export function modalHeader(box, title, subtitle) {
  const h = el('div', 'px-6 pt-6 pb-4 flex items-start justify-between');
  const t = el('div');
  t.appendChild(el('h3', 'text-lg font-bold', title));
  if (subtitle) t.appendChild(el('p', 'text-xs text-gray-500 dark:text-gray-400 mt-0.5', subtitle));

  const x = el('button', 'w-8 h-8 rounded-lg grid place-items-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-gray-400');
  x.setAttribute('aria-label', 'Kapat');
  x.appendChild(el('i', 'fa-solid fa-xmark'));
  x.addEventListener('click', closeModal);

  h.append(t, x);
  box.appendChild(h);
}

/** Etiket + alan (+ opsiyonel hata satırı). errId "err-" ile başlamalıdır. */
export function field(label, inputEl, errId) {
  const w = el('div');
  w.append(el('label', 'block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5', label), inputEl);
  if (errId) {
    const err = el('p', 'hidden text-xs text-danger mt-1 font-medium');
    err.id = errId;
    w.appendChild(err);
  }
  return w;
}

export function input(attrs = {}) {
  const i = el('input', 'w-full h-11 px-3.5 rounded-xl bg-black/5 dark:bg-white/10 border-0 text-sm font-medium focus:ring-2 focus:ring-accent placeholder:text-gray-400 num');
  Object.entries(attrs).forEach(([k, v]) => i.setAttribute(k, v));
  return i;
}

export function select(cls = '') {
  return el('select', 'w-full h-11 px-3 rounded-xl bg-black/5 dark:bg-white/10 border-0 text-sm font-medium focus:ring-2 focus:ring-accent ' + cls);
}

export function primaryButton(text) {
  return el('button', 'w-full h-12 rounded-xl bg-accent hover:bg-blue-600 text-white font-bold text-sm transition-colors shadow-card', text);
}

export function showErr(id, msg) {
  const e = byId(id);
  if (e) { e.textContent = msg; e.classList.remove('hidden'); }
}

export function clearErrs(box) {
  box.querySelectorAll('[id^="err-"]').forEach(e => e.classList.add('hidden'));
}
