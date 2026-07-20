import { Store } from '../core/store.js';
import { byId } from '../utils/dom.js';
import { Charts } from './charts.js';
import { renderBell } from './notifications.js';
import { renderWidgets, renderCards, renderTransactions } from './views/dashboard.js';
import { renderCalendar } from './views/calendar.js';
import { renderTransactionsView } from './views/transactions.js';
import { renderSettings } from './views/settings.js';

/** Aktif görünüm: 'dashboard' | 'transactions' | 'calendar' | 'settings' */
export let currentView = 'dashboard';

export function switchView(name) {
  currentView = name;

  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  byId('view-' + name).classList.remove('hidden');

  const dark = document.documentElement.classList.contains('dark');
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.view === name;
    b.classList.toggle('bg-black/5', active && !dark);
    b.classList.toggle('dark:bg-white/10', active);
    b.classList.toggle('text-accent', active);
    b.classList.toggle('text-gray-600', !active);
    b.classList.toggle('dark:text-gray-300', !active);
  });

  if (name === 'transactions') renderTransactionsView();
  if (name === 'calendar') renderCalendar();
  if (name === 'settings') renderSettings();
}

/** Veri değiştiğinde çağrılan tam yeniden çizim. */
export function renderAll() {
  const has = Store.data.cards.length > 0;
  byId('emptyState').classList.toggle('hidden', has);
  byId('dashContent').classList.toggle('hidden', !has);

  if (has) {
    Charts.renderDonut();
    Charts.renderTrend();
    Charts.renderCategory();
    renderWidgets();
    renderCards();
    renderTransactions();
  }

  renderBell();
  if (currentView === 'transactions') renderTransactionsView();
  if (currentView === 'calendar') renderCalendar();
}
