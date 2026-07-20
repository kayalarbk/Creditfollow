import { Store } from './core/store.js';
import { Theme } from './core/theme.js';
import { Backup, applyAutoRestore } from './core/backup.js';
import { AutoBackup } from './core/autobackup.js';
import { byId } from './utils/dom.js';
import { Charts } from './ui/charts.js';
import { switchView, renderAll } from './ui/router.js';
import { closeModal } from './ui/modal.js';
import { newCardModal } from './ui/modals/new-card.js';
import { newTransactionModal } from './ui/modals/new-transaction.js';
import { moveMonth } from './ui/views/calendar.js';
import { bindTransactionFilters } from './ui/views/transactions.js';
import { recurringModal } from './ui/modals/recurring.js';
import { renderSettings } from './ui/views/settings.js';
import { toast } from './ui/toast.js';

/** Tüm DOM olay bağlantıları tek yerde toplanır. */
export function bindEvents() {
  bindNav();
  bindMenus();
  bindModal();
  bindCharts();
  bindCalendar();
  bindTransactionFilters();
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
  document.querySelectorAll('.cat-range-btn').forEach(b => b.addEventListener('click', () => {
    Charts.categoryRange = parseInt(b.dataset.catrange, 10);
    Charts.renderCategory();
  }));
}

function bindCalendar() {
  byId('calPrev').addEventListener('click', () => moveMonth(-1));
  byId('calNext').addEventListener('click', () => moveMonth(1));
}

function bindSettings() {
  byId('addRecurringBtn').addEventListener('click', () => recurringModal());
  byId('exportBtn').addEventListener('click', () => Backup.exportJSON());
  byId('exportCsvBtn').addEventListener('click', () => Backup.exportCSV());
  byId('importBtn').addEventListener('click', () => byId('importFile').click());
  byId('importFile').addEventListener('change', e => {
    if (e.target.files[0]) Backup.importJSON(e.target.files[0]);
    e.target.value = '';
  });

  byId('autoBackupBtn').addEventListener('click', async () => {
    if (!AutoBackup.isSupported()) return;

    if (AutoBackup.status === 'on') {
      await AutoBackup.disable();
      renderSettings();
      toast('Otomatik yedekleme kapatıldı. Yedek dosyanız diskte durmaya devam eder.', 'warn');
      return;
    }

    try {
      if (AutoBackup.status === 'needs-permission') {
        const parsed = await AutoBackup.reconnect();
        if (AutoBackup.status !== 'on') { toast('Dosya izni verilmedi.', 'warn'); return; }
        if (!applyAutoRestore(parsed)) AutoBackup.writeNow(Store.data);
        toast('Yedek dosyasına yeniden bağlanıldı.');
      } else {
        await AutoBackup.enable(Store.data);
        toast('Otomatik yedekleme açıldı: ' + AutoBackup.fileName());
      }
    } catch (e) {
      if (!e || e.name !== 'AbortError') toast('Otomatik yedekleme başlatılamadı.', 'danger');
    }
    renderSettings();
  });

  byId('thresholdSave').addEventListener('click', () => {
    const v = parseInt(byId('thresholdInput').value, 10);
    if (isNaN(v) || v < 1 || v > 15) { toast('1–15 arası bir değer girin.', 'warn'); return; }
    Store.data.settings.notificationThresholdDays = v;
    if (Store.save()) { renderAll(); toast('Bildirim ayarı güncellendi.'); }
  });

  byId('resetBtn').addEventListener('click', () => {
    if (!confirm('TÜM veriler silinecek. Emin misiniz?')) return;
    if (!confirm('Son kez onaylıyor musunuz? (Sıfırlamanın hemen ardından geri alabilirsiniz)')) return;

    const snap = Store.snapshot();
    Store.reset();
    renderAll();
    renderSettings(); // eşik ve yedek bilgisi varsayılana döner

    toast('Tüm veriler sıfırlandı.', 'warn', {
      duration: 10000,
      action: {
        label: 'Geri al',
        onClick: () => { Store.restore(snap); renderAll(); renderSettings(); toast('Verileriniz geri getirildi.'); }
      }
    });
  });
}
