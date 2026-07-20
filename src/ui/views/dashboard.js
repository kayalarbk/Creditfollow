import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el, byId, clear } from '../../utils/dom.js';
import { fmtTL, fmtTL0, fmtDateShort, dateSort, bankIcon } from '../../utils/format.js';
import { buildTxRow } from '../tx-row.js';
import { cardDetailModal } from '../modals/card-detail.js';

/** Üstteki üç özet kutusu + kullanım rozeti. */
export function renderWidgets() {
  const t = Calc.totals();
  const up = Calc.upcomingPayments(7);

  const wUp = byId('wUpcoming');
  const wUpSub = byId('wUpcomingSub');
  if (up.length === 0) {
    wUp.textContent = 'Ödeme yok';
    wUpSub.textContent = 'Önümüzdeki 7 gün temiz 🎉';
  } else {
    wUp.textContent = up.length + ' kart · ' + fmtTL0.format(up.reduce((s, n) => s + n.card.currentDebt, 0));
    const first = up[0];
    wUpSub.textContent = 'En yakın: ' + first.card.bankName + ' — ' + (first.days === 0 ? 'bugün' : first.days + ' gün sonra');
  }

  byId('wMinPay').textContent = fmtTL.format(t.minPay);

  const pct = Math.round(t.usage * 100);
  byId('wUsage').textContent = '%' + pct;
  const bar = byId('wUsageBar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.style.backgroundColor = Calc.usageColor(t.usage);

  const badge = byId('usageBadge');
  const col = Calc.usageColor(t.usage);
  badge.textContent = '%' + pct + ' kullanım';
  // Sarı zeminde okunabilirlik için koyu ton kullanılır
  badge.style.color = col === CONFIG.statusColors.warn ? '#8a6d00' : col;
  badge.style.backgroundColor = col + '22';
}

/** Kart ızgarası. */
export function renderCards() {
  const grid = clear(byId('cardsGrid'));
  byId('cardCount').textContent = Store.data.cards.length + ' kart';
  Store.data.cards.forEach(card => grid.appendChild(buildCard(card)));
}

function buildCard(card) {
  const ratio = Calc.usage(card);
  const color = Calc.usageColor(ratio);
  const statement = Calc.nextOccurrence(card.statementDay);
  const due = Calc.nextOccurrence(card.dueDay);
  const late = Calc.overdueInfo(card);
  const soon = card.currentDebt > 0 && Calc.daysUntil(due) <= Store.data.settings.notificationThresholdDays;

  const wrap = el('article', 'fade-in rounded-xl2 bg-surface-light dark:bg-surface-dark shadow-card dark:shadow-cardDark overflow-hidden hover:-translate-y-0.5 hover:shadow-pop transition-all duration-300 cursor-pointer');
  wrap.setAttribute('role', 'button');
  wrap.tabIndex = 0;
  wrap.addEventListener('click', () => cardDetailModal(card.id));
  wrap.addEventListener('keydown', e => { if (e.key === 'Enter') cardDetailModal(card.id); });

  /* Banka kartı görseli */
  const top = el('div', 'bank-card p-4 text-white');
  top.style.setProperty('--bc1', card.color[0]);
  top.style.setProperty('--bc2', card.color[1]);

  const topRow = el('div', 'flex items-center justify-between mb-5');
  const nameBox = el('div', 'min-w-0');
  nameBox.append(
    el('p', 'font-bold truncate', card.bankName),
    el('p', 'text-xs text-white/70 truncate', card.cardLabel || 'Kredi kartı')
  );
  topRow.append(nameBox, el('i', 'fa-solid ' + bankIcon(card.bankName) + ' text-xl text-white/85'));
  top.append(
    topRow,
    el('p', 'text-[11px] uppercase tracking-wider text-white/60 font-medium', 'Güncel borç'),
    el('p', 'text-2xl font-extrabold num', fmtTL.format(card.currentDebt))
  );

  /* Alt bilgi bölümü */
  const body = el('div', 'p-4 space-y-3');

  const barWrap = el('div');
  const barTop = el('div', 'flex justify-between text-xs mb-1.5');
  barTop.append(
    el('span', 'text-gray-500 dark:text-gray-400', 'Limit kullanımı'),
    el('span', 'font-semibold num', '%' + Math.round(ratio * 100))
  );
  const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
  const fill = el('div', 'progress-fill h-full rounded-full');
  fill.style.width = Math.min(ratio * 100, 100) + '%';
  fill.style.backgroundColor = color;
  track.appendChild(fill);
  barWrap.append(barTop, track);

  const stat = (label, val, extraCls) => {
    const b = el('div', 'rounded-lg bg-black/[.03] dark:bg-white/5 px-2.5 py-2');
    b.append(
      el('p', 'text-gray-500 dark:text-gray-400 mb-0.5', label),
      el('p', 'font-semibold num ' + (extraCls || ''), val)
    );
    return b;
  };
  const stats = el('div', 'grid grid-cols-2 gap-2 text-xs');
  stats.append(
    stat('Limit', fmtTL0.format(card.limit)),
    stat('Kullanılabilir', fmtTL0.format(Math.max(card.limit - card.currentDebt, 0))),
    stat('Hesap kesim', fmtDateShort.format(statement)),
    stat('Son ödeme', fmtDateShort.format(due), late || soon ? 'text-danger' : '')
  );

  if (late) {
    const warn = el('div', 'flex items-center gap-2 rounded-lg bg-danger/10 text-danger px-2.5 py-2 text-xs font-semibold');
    warn.append(
      el('i', 'fa-solid fa-triangle-exclamation'),
      el('span', '', late.days + ' gündür ödeme yapılmadı')
    );
    stats.appendChild(warn);
    warn.classList.add('col-span-2');
  }

  const minRow = el('div', 'flex items-center justify-between text-xs pt-1');
  minRow.append(
    el('span', 'text-gray-500 dark:text-gray-400', 'Asgari ödeme (%' + Math.round(card.minPaymentRate * 100) + ')'),
    el('span', 'font-bold num', fmtTL.format(Calc.minPayment(card)))
  );

  body.append(barWrap, stats, minRow);

  /* Bu dönem harcaması ve varsa aylık taksit yükü */
  const period = Calc.periodActivity(card);
  const inst = Calc.installmentLoad(card);
  if (period.spent > 0 || inst.activePlans > 0) {
    const extra = el('div', 'flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/5 mt-1');
    extra.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Bu dönem harcaması'),
      el('span', 'font-semibold num', fmtTL.format(period.spent))
    );
    body.appendChild(extra);

    if (inst.activePlans > 0) {
      const instRow = el('div', 'flex items-center justify-between text-xs');
      instRow.append(
        el('span', 'text-gray-500 dark:text-gray-400',
          'Aylık taksit (' + inst.activePlans + ' plan)'),
        el('span', 'font-semibold num', fmtTL.format(inst.monthly))
      );
      body.appendChild(instRow);
    }
  }
  wrap.append(top, body);
  return wrap;
}

/** Son 8 işlem listesi. */
export function renderTransactions() {
  const list = clear(byId('txList'));
  const txs = [...Store.data.transactions].sort((a, b) => dateSort(b.date) - dateSort(a.date)).slice(0, 8);

  if (txs.length === 0) {
    list.appendChild(el('p', 'px-5 py-8 text-sm text-gray-400 dark:text-gray-500 text-center',
      'Henüz işlem yok. "+ Ekle" ile ilk harcama veya ödemenizi kaydedin.'));
    return;
  }

  txs.forEach(tx => list.appendChild(buildTxRow(tx)));
}
