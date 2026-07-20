import { Calc } from '../core/calc.js';
import { el, byId, clear } from '../utils/dom.js';
import { fmtTL, fmtDate } from '../utils/format.js';
import { cardDetailModal } from './modals/card-detail.js';

/** Üst bardaki bildirim çanı: rozet + açılır liste. */
export function renderBell() {
  const notifs = Calc.notifications();
  const badge = byId('bellBadge');
  const list = clear(byId('bellList'));

  badge.classList.toggle('hidden', notifs.length === 0);
  badge.textContent = notifs.length;

  if (notifs.length === 0) {
    const ok = el('div', 'px-4 py-8 text-center');
    ok.append(
      el('i', 'fa-solid fa-circle-check text-ok text-2xl mb-2'),
      el('p', 'text-sm text-gray-500 dark:text-gray-400', 'Yaklaşan ödeme yok. Her şey yolunda!')
    );
    list.appendChild(ok);
    return;
  }

  notifs.forEach(n => {
    const overdue = n.overdue;
    const row = el('button', 'w-full text-left px-4 py-3 flex items-start gap-3 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors');
    row.addEventListener('click', () => {
      byId('bellPanel').classList.add('hidden');
      cardDetailModal(n.card.id);
    });
    const dot = el('div', 'mt-1 w-2.5 h-2.5 rounded-full shrink-0 ' + (overdue || n.days <= 1 ? 'bg-danger' : 'bg-warn'));

    const gecikme = -n.days;
    const suffix = overdue ? ' — ' + gecikme + ' GÜN GECİKTİ'
      : n.days === 0 ? ' — son ödeme bugün'
      : ' — son ödemeye ' + n.days + ' gün';
    const title = el('p', 'text-sm font-semibold truncate', n.card.bankName + suffix);
    if (overdue) title.classList.add('text-danger');

    const box = el('div', 'min-w-0');
    box.append(
      title,
      el('p', 'text-xs text-gray-500 dark:text-gray-400 num',
        'Asgari: ' + fmtTL.format(Calc.minPayment(n.card)) + ' · Toplam: ' + fmtTL.format(n.card.currentDebt)),
      el('p', 'text-[11px] text-gray-400 dark:text-gray-500', fmtDate.format(n.due))
    );

    row.append(dot, box);
    list.appendChild(row);
  });
}
