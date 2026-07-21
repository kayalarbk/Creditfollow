import { Calc } from '../core/calc.js';
import { el, byId, clear } from '../utils/dom.js';
import { fmtTL, fmtDate } from '../utils/format.js';
import { cardDetailModal } from './modals/card-detail.js';
import { loanDetailModal } from './modals/loan-detail.js';

/** Üst bardaki bildirim çanı: rozet + açılır liste. */
export function renderBell() {
  const notifs = Calc.notifications();
  const badge = byId('bellBadge');
  const list = clear(byId('bellList'));

  // Rozet acil olanları sayar; liste bekleyen tüm ekstreleri gösterir
  const urgent = notifs.filter(n => n.urgent).length;
  badge.classList.toggle('hidden', urgent === 0);
  badge.textContent = urgent;

  if (notifs.length === 0) {
    const ok = el('div', 'px-4 py-8 text-center');
    ok.append(
      el('i', 'fa-solid fa-circle-check text-ok text-2xl mb-2'),
      el('p', 'text-sm text-gray-500 dark:text-gray-400', 'Bekleyen ödeme yok. Her şey yolunda!')
    );
    list.appendChild(ok);
    return;
  }

  notifs.forEach(n => {
    const overdue = n.overdue;
    const row = el('button', 'w-full text-left px-4 py-3 flex items-start gap-3 border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/5 dark:hover:bg-white/5 transition-colors');
    row.addEventListener('click', () => {
      byId('bellPanel').classList.add('hidden');
      if (n.kind === 'loan') loanDetailModal(n.id); else cardDetailModal(n.id);
    });
    // Acil olmayanlar (kesilmiş ama son ödemesi uzak) daha sönük bir noktayla ayrılır
    const dot = el('div', 'mt-1 w-2.5 h-2.5 rounded-full shrink-0 ' + (
      overdue || n.days <= 1 ? 'bg-danger' : n.urgent ? 'bg-warn' : 'bg-gray-300 dark:bg-gray-600'
    ));

    const isLoan = n.kind === 'loan';
    const gecikme = -n.days;
    const suffix = overdue ? ' — ' + gecikme + ' GÜN GECİKTİ'
      : n.days === 0 ? (isLoan ? ' — taksit bugün' : ' — son ödeme bugün')
      : ' — ' + (isLoan ? 'taksite ' : 'son ödemeye ') + n.days + ' gün';
    const title = el('p', 'text-sm font-semibold truncate', n.title + suffix);
    if (overdue) title.classList.add('text-danger');

    const box = el('div', 'min-w-0');
    box.append(
      title,
      el('p', 'text-xs text-gray-500 dark:text-gray-400 num',
        (isLoan ? 'Taksit: ' : 'Kalan asgari: ') + fmtTL.format(n.amount) +
        ' · ' + (isLoan ? 'Kalan borç: ' : 'Toplam borç: ') + fmtTL.format(n.totalDebt)),
      el('p', 'text-[11px] text-gray-400 dark:text-gray-500', fmtDate.format(n.due))
    );

    row.append(dot, box);
    list.appendChild(row);
  });
}
