import { Store } from '../core/store.js';
import { el } from '../utils/dom.js';
import { fmtTL, fmtDateSafe, category } from '../utils/format.js';
import { newTransactionModal, deleteTransactionWithConfirm } from './modals/new-transaction.js';

/**
 * Tek işlem satırı — panelde ve İşlemler görünümünde ortak kullanılır.
 * opts.actions: düzenle/sil düğmelerini göster (varsayılan true)
 * opts.onChange: silme/düzenleme sonrası çağrılır (liste yenilemek için)
 */
export function buildTxRow(tx, opts = {}) {
  const { actions = true, onChange } = opts;
  const card = Store.data.cards.find(c => c.id === tx.cardId);
  const isExp = tx.type === 'expense';

  const row = el('div', 'group px-5 py-3.5 flex items-center gap-3.5 border-b border-black/5 dark:border-white/5 last:border-0');

  /* Harcamada kategori ikonu ve rengi, ödemede sabit onay ikonu */
  const cat = isExp ? category(tx.category) : null;
  const ic = el('div', 'w-9 h-9 rounded-xl grid place-items-center shrink-0 ' + (isExp ? '' : 'bg-ok/10 text-ok'));
  if (cat) {
    ic.style.backgroundColor = cat.color + '1a';
    ic.style.color = cat.color;
  }
  ic.appendChild(el('i', 'fa-solid ' + (cat ? cat.icon : 'fa-arrow-down') + ' text-sm'));

  const mid = el('div', 'flex-1 min-w-0');
  const title = el('p', 'text-sm font-medium truncate', tx.description || (isExp ? cat.label : 'Ödeme'));

  const meta = el('p', 'text-xs text-gray-500 dark:text-gray-400 truncate');
  const parts = [card ? card.bankName : 'Silinmiş kart', fmtDateSafe(tx.date)];
  if (isExp) parts.splice(1, 0, cat.label);
  meta.textContent = parts.join(' · ');
  mid.append(title, meta);

  const right = el('div', 'text-right shrink-0');
  right.appendChild(el('p', 'text-sm font-bold num ' + (isExp ? 'text-danger' : 'text-ok'),
    (isExp ? '−' : '+') + fmtTL.format(tx.amount)));
  if (isExp && tx.installments > 1) {
    right.appendChild(el('p', 'text-[11px] text-gray-500 dark:text-gray-400 num',
      tx.installments + '× ' + fmtTL.format(Math.round((tx.amount / tx.installments) * 100) / 100)));
  }

  row.append(ic, mid, right);

  if (actions) {
    const wrap = el('div', 'flex items-center gap-1 shrink-0');
    wrap.append(
      iconButton('fa-pen', 'İşlemi düzenle', 'hover:text-accent',
        () => newTransactionModal(tx.cardId, tx.id)),
      iconButton('fa-trash-can', 'İşlemi sil', 'hover:text-danger',
        () => { if (deleteTransactionWithConfirm(tx.id) && onChange) onChange(); })
    );
    row.appendChild(wrap);
  }

  return row;
}

function iconButton(icon, label, hoverCls, onClick) {
  const b = el('button', 'w-8 h-8 rounded-lg grid place-items-center text-gray-400 transition-colors ' +
    'hover:bg-black/5 dark:hover:bg-white/10 ' + hoverCls +
    // Dokunmatikte hover yok: küçük ekranlarda her zaman görünür kalsın
    ' opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100');
  b.setAttribute('aria-label', label);
  b.setAttribute('title', label);
  b.appendChild(el('i', 'fa-solid ' + icon + ' text-xs'));
  b.addEventListener('click', e => { e.stopPropagation(); onClick(); });
  return b;
}
