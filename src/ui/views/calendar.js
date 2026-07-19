import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el, byId, clear } from '../../utils/dom.js';
import { fmtTL, fmtDate } from '../../utils/format.js';

/** Görüntülenen ay (takvim gezinmesi bunu değiştirir). */
export const calCursor = (() => {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
})();

export function moveMonth(delta) {
  calCursor.m += delta;
  if (calCursor.m < 0) { calCursor.m = 11; calCursor.y -= 1; }
  if (calCursor.m > 11) { calCursor.m = 0; calCursor.y += 1; }
  renderCalendar();
}

export function renderCalendar() {
  const { y, m } = calCursor;
  byId('calTitle').textContent = CONFIG.monthNames[m] + ' ' + y;
  const grid = clear(byId('calGrid'));
  byId('calDetail').classList.add('hidden');

  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Pazartesi başlangıç
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = Calc.today();
  const events = collectEvents(y, m);

  for (let i = 0; i < startOffset; i++) grid.appendChild(el('div'));

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(y, m, d);
    const isToday = cellDate.getTime() === today.getTime();
    const evs = events[d] || [];

    const tone = isToday
      ? 'bg-accent text-white shadow-card'
      : evs.length
        ? 'bg-black/[.04] dark:bg-white/[.06] hover:bg-black/10 dark:hover:bg-white/10'
        : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-600 dark:text-gray-300';

    const cell = el('button', 'relative aspect-square sm:aspect-[4/3] rounded-xl text-sm font-medium flex flex-col items-center justify-center gap-1 transition-colors ' + tone);
    cell.appendChild(el('span', 'num', d));

    if (evs.length) {
      cell.appendChild(buildDots(evs, isToday));
      cell.addEventListener('click', () => renderCalDetail(evs, cellDate));
    }
    grid.appendChild(cell);
  }
}

/** gün -> [{type:'statement'|'due', card}] haritası. */
function collectEvents(y, m) {
  const events = {};
  Store.data.cards.forEach(card => {
    const sd = Calc.clampDay(y, m, card.statementDay);
    const dd = Calc.clampDay(y, m, card.dueDay);
    (events[sd] = events[sd] || []).push({ type: 'statement', card });
    (events[dd] = events[dd] || []).push({ type: 'due', card });
  });
  return events;
}

function buildDots(evs, isToday) {
  const dots = el('div', 'flex items-center gap-0.5');
  const counts = [
    { n: evs.filter(e => e.type === 'statement').length, dot: 'bg-warn', text: isToday ? 'text-white/90' : 'text-yellow-600 dark:text-warn' },
    { n: evs.filter(e => e.type === 'due').length, dot: 'bg-danger', text: isToday ? 'text-white/90' : 'text-danger' }
  ];
  counts.forEach(({ n, dot, text }) => {
    if (!n) return;
    dots.appendChild(el('span', 'cal-dot ' + dot));
    if (n > 1) dots.appendChild(el('span', 'text-[9px] font-bold num ' + text, n));
  });
  return dots;
}

/** Seçilen günün altındaki detay paneli. */
function renderCalDetail(evs, date) {
  const panel = clear(byId('calDetail'));
  panel.classList.remove('hidden');
  panel.appendChild(el('h3', 'font-bold mb-3', fmtDate.format(date)));

  evs.forEach(ev => {
    const isDue = ev.type === 'due';
    const row = el('div', 'flex items-center gap-3 py-2.5 border-b border-black/5 dark:border-white/5 last:border-0');
    const box = el('div', 'flex-1 min-w-0');
    box.append(
      el('p', 'text-sm font-semibold truncate', ev.card.bankName + ' — ' + (isDue ? 'Son ödeme günü' : 'Hesap kesim günü')),
      isDue
        ? el('p', 'text-xs text-gray-500 dark:text-gray-400 num',
            'Toplam borç: ' + fmtTL.format(ev.card.currentDebt) + ' · Asgari: ' + fmtTL.format(Calc.minPayment(ev.card)))
        : el('p', 'text-xs text-gray-500 dark:text-gray-400', 'Bu tarihte dönem borcu hesaplanır.')
    );
    row.append(el('span', 'cal-dot shrink-0 ' + (isDue ? 'bg-danger' : 'bg-warn')), box);
    panel.appendChild(row);
  });

  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
