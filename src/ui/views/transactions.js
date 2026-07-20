import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el, byId, clear } from '../../utils/dom.js';
import { fmtTL, dateSort, safeDate } from '../../utils/format.js';
import { buildTxRow } from '../tx-row.js';

/** Aktif filtreler — görünüm değişse de korunur. */
const filters = { search: '', cardId: '', type: '', category: '', range: '' };

/** Seçili aralığın başlangıç tarihi; '' ise sınır yok. */
function rangeStart() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (filters.range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (filters.range === 'year') return new Date(now.getFullYear(), 0, 1);
  if (filters.range === '90') {
    const d = new Date(now);
    d.setDate(d.getDate() - 89);
    return d;
  }
  return null;
}

/** Filtre kutularını doldurur ve olaylara bağlar (bir kez, açılışta). */
export function bindTransactionFilters() {
  const search = byId('txSearch');
  const card = byId('txFilterCard');
  const type = byId('txFilterType');
  const cat = byId('txFilterCat');
  const range = byId('txFilterRange');

  const catPlaceholder = el('option', '', 'Tüm kategoriler');
  catPlaceholder.value = '';
  cat.appendChild(catPlaceholder);
  CONFIG.categories.forEach(c => {
    const o = el('option', '', c.label);
    o.value = c.id;
    cat.appendChild(o);
  });

  search.addEventListener('input', () => { filters.search = search.value.trim(); renderTransactionsView(); });
  card.addEventListener('change', () => { filters.cardId = card.value; renderTransactionsView(); });
  type.addEventListener('change', () => { filters.type = type.value; renderTransactionsView(); });
  cat.addEventListener('change', () => { filters.category = cat.value; renderTransactionsView(); });
  range.addEventListener('change', () => { filters.range = range.value; renderTransactionsView(); });

  byId('txClearFilters').addEventListener('click', () => {
    filters.search = filters.cardId = filters.type = filters.category = filters.range = '';
    search.value = ''; card.value = ''; type.value = ''; cat.value = ''; range.value = '';
    renderTransactionsView();
  });
}

/** Kart listesi değişebildiği için kart filtresi her render'da tazelenir. */
function syncCardOptions() {
  const sel = byId('txFilterCard');
  const previous = filters.cardId;
  clear(sel);

  const ph = el('option', '', 'Tüm kartlar');
  ph.value = '';
  sel.appendChild(ph);
  Store.data.cards.forEach(c => {
    const o = el('option', '', c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''));
    o.value = c.id;
    sel.appendChild(o);
  });

  // Filtrelenen kart silinmişse filtre düşer
  if (previous && !Store.data.cards.some(c => c.id === previous)) filters.cardId = '';
  sel.value = filters.cardId;
}

function applyFilters() {
  const q = filters.search.toLocaleLowerCase('tr-TR');
  const from = rangeStart();

  return Store.data.transactions.filter(t => {
    if (filters.cardId && t.cardId !== filters.cardId) return false;
    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && (t.category || 'diger') !== filters.category) return false;
    if (q && !(t.description || '').toLocaleLowerCase('tr-TR').includes(q)) return false;
    if (from) {
      const d = safeDate(t.date);
      // Tarihsiz kayıtlar bir aralığa yerleştirilemez
      if (!d || d < from) return false;
    }
    return true;
  }).sort((a, b) => dateSort(b.date) - dateSort(a.date));
}

/** Aktif filtrelerle eşleşen işlemler — CSV dışa aktarma için. */
export function getFilteredTransactions() {
  return applyFilters();
}

export function renderTransactionsView() {
  syncCardOptions();

  const list = clear(byId('txAllList'));
  const txs = applyFilters();
  const total = Store.data.transactions.length;

  const spent = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const paid = txs.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);

  const summary = clear(byId('txSummary'));
  summary.append(
    el('span', '', txs.length + ' / ' + total + ' işlem'),
    el('span', 'text-danger font-semibold', 'Harcama: ' + fmtTL.format(spent)),
    el('span', 'text-ok font-semibold', 'Ödeme: ' + fmtTL.format(paid))
  );

  if (txs.length === 0) {
    list.appendChild(el('p', 'px-5 py-12 text-sm text-gray-400 dark:text-gray-500 text-center',
      total === 0
        ? 'Henüz işlem yok. "+ Ekle" ile ilk harcama veya ödemenizi kaydedin.'
        : 'Bu filtrelere uyan işlem bulunamadı.'));
    return;
  }

  txs.forEach(tx => list.appendChild(buildTxRow(tx, { onChange: renderTransactionsView })));
}
