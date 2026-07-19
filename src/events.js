import { Store } from './core/store.js';
import { Theme } from './core/theme.js';
import { Backup } from './core/backup.js';
import { byId } from './utils/dom.js';
import { Charts } from './ui/charts.js';
import { switchView, renderAll } from './ui/router.js';
import { closeModal } from './ui/modal.js';
import { newCardModal } from './ui/modals/new-card.js';
import { newTransactionModal } from './ui/modals/new-transaction.js';
import { moveMonth } from './ui/views/calendar.js';
import { renderSettings } from './ui/views/settings.js';
import { toast } from './ui/toast.js';

/** Tüm DOM olay bağlantıları tek yerde toplanır. */
export function bindEvents() {
  bindNav();
  bindMenus();
  bindModal();
  bindCharts();
  bindCalendar();
  bindSettings();
}

function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.addEventListener('click', () => switchView(b.dataset.view)));
  byId('themeBtn').addEventListener('click', () => Theme.toggle());
}

/** "+ Ekle" menüsü ve bildirim çanı — biri açılınca diğeri kapanır. */
function bindMenus() {
  const addMenu = byId('addMenu');
  const bellPanel = byId('bellPanel');

  byId('addBtn').addEventListener('click', e => {
    e.stopPropagation();
    addMenu.classList.toggle('hidden');
    bellPanel.classList.add('hidden');
  });
  byId('bellBtn').addEventListener('click', e => {
    e.stopPropagation();
    bellPanel.classList.toggle('hidden');
    addMenu.classList.add('hidden');
  });

  byId('menuNewCard').addEventListener('click', () => { addMenu.classList.add('hidden'); newCardModal(); });
  byId('menuNewTx').addEventListener('click', () => { addMenu.classList.add('hidden'); newTransactionModal(); });
  byId('emptyAddBtn').addEventListener('click', () => newCardModal());

  // Dışarı tıklayınca menüleri kapat
  document.addEventListener('click', () => {
    addMenu.classList.add('hidden');
    bellPanel.classList.add('hidden');
  });
  addMenu.addEventListener('click', e => e.stopPropagation());
  bellPanel.addEventListener('click', e => e.stopPropagation());
}

function bindModal() {
  byId('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

function bindCharts() {
  document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => {
    Charts.trendRange = parseInt(b.dataset.range, 10);
    Charts.renderTrend();
  }));
}

function bindCalendar() {
  byId('calPrev').addEventListener('click', () => moveMonth(-1));
  byId('calNext').addEventListener('click', () => moveMonth(1));
}

function bindSettings() {
  byId('exportBtn').addEventListener('click', () => Backup.exportJSON());
  byId('importBtn').addEventListener('click', () => byId('importFile').click());
  byId('importFile').addEventListener('change', e => {
    if (e.target.files[0]) Backup.importJSON(e.target.files[0]);
    e.target.value = '';
  });

  byId('thresholdSave').addEventListener('click', () => {
    const v = parseInt(byId('thresholdInput').value, 10);
    if (isNaN(v) || v < 1 || v > 15) { toast('1–15 arası bir değer girin.', 'warn'); return; }
    Store.data.settings.notificationThresholdDays = v;
    if (Store.save()) { renderAll(); toast('Bildirim ayarı güncellendi.'); }
  });

  byId('resetBtn').addEventListener('click', () => {
    if (!confirm('TÜM veriler silinecek. Emin misiniz?')) return;
    if (!confirm('Bu işlem geri alınamaz. Son kez onaylıyor musunuz?')) return;
    Store.reset();
    renderAll();
    renderSettings(); // eşik ve yedek bilgisi varsayılana döner
    toast('Tüm veriler sıfırlandı.', 'warn');
  });
}
