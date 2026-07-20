import { Store } from '../../core/store.js';
import { AutoBackup } from '../../core/autobackup.js';
import { el, byId, clear } from '../../utils/dom.js';
import { fmtTL, fmtDate, category } from '../../utils/format.js';
import { recurringModal } from '../modals/recurring.js';
import { toast } from '../toast.js';

export function renderSettings() {
  byId('thresholdInput').value = Store.data.settings.notificationThresholdDays;
  const last = Store.data.settings.lastExport;
  byId('lastBackup').textContent = last
    ? 'Son yedek: ' + fmtDate.format(new Date(last))
    : 'Henüz yedek alınmadı.';
  renderAutoBackup();
  renderRecurring();
}

/** Tekrarlayan işlem şablonları listesi. */
function renderRecurring() {
  const box = clear(byId('recurringList'));
  const items = Store.data.recurring;

  if (items.length === 0) {
    box.appendChild(el('p', 'text-sm text-gray-400 dark:text-gray-500 py-2',
      'Henüz tekrarlayan işlem yok. Abonelik ve faturalarınızı ekleyerek her ay elle girmekten kurtulun.'));
    return;
  }

  items.forEach(r => {
    const card = Store.data.cards.find(c => c.id === r.cardId);
    const cat = category(r.category);

    const row = el('div', 'flex items-center gap-3 p-3 rounded-xl bg-black/[.03] dark:bg-white/5');

    const ic = el('div', 'w-9 h-9 rounded-xl grid place-items-center shrink-0');
    ic.style.backgroundColor = cat.color + '1a';
    ic.style.color = cat.color;
    ic.appendChild(el('i', 'fa-solid ' + cat.icon + ' text-sm'));

    const mid = el('div', 'flex-1 min-w-0');
    const title = el('p', 'text-sm font-medium truncate', r.description);
    if (r.paused) title.classList.add('line-through', 'text-gray-400');
    mid.append(title, el('p', 'text-xs text-gray-500 dark:text-gray-400 truncate',
      (card ? card.bankName : 'Silinmiş kart') + ' · her ayın ' + r.dayOfMonth + '\'i' + (r.paused ? ' · duraklatıldı' : '')));

    const amt = el('p', 'text-sm font-bold num shrink-0', fmtTL.format(r.amount));

    const actions = el('div', 'flex items-center gap-1 shrink-0');
    actions.append(
      iconBtn(r.paused ? 'fa-play' : 'fa-pause', r.paused ? 'Devam ettir' : 'Duraklat', () => {
        Store.updateRecurring(r.id, { paused: !r.paused });
        renderSettings();
        toast(r.paused ? 'Tekrarlayan işlem devam ediyor.' : 'Tekrarlayan işlem duraklatıldı.', 'warn');
      }),
      iconBtn('fa-pen', 'Düzenle', () => recurringModal(r.id)),
      iconBtn('fa-trash-can', 'Sil', () => {
        const snap = Store.snapshot();
        Store.deleteRecurring(r.id);
        renderSettings();
        toast('"' + r.description + '" silindi.', 'warn', {
          duration: 7000,
          action: {
            label: 'Geri al',
            onClick: () => { Store.restore(snap); renderSettings(); toast('Tekrarlayan işlem geri getirildi.'); }
          }
        });
      })
    );

    row.append(ic, mid, amt, actions);
    box.appendChild(row);
  });
}

function iconBtn(icon, label, onClick) {
  const b = el('button', 'w-8 h-8 rounded-lg grid place-items-center text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-accent transition-colors');
  b.setAttribute('aria-label', label);
  b.setAttribute('title', label);
  b.appendChild(el('i', 'fa-solid ' + icon + ' text-xs'));
  b.addEventListener('click', onClick);
  return b;
}

function renderAutoBackup() {
  const btn = byId('autoBackupBtn');
  const btnText = byId('autoBackupBtnText');
  const status = byId('autoBackupStatus');

  btn.disabled = !AutoBackup.isSupported();
  btn.classList.toggle('opacity-50', btn.disabled);
  btn.classList.toggle('cursor-not-allowed', btn.disabled);

  switch (AutoBackup.status) {
    case 'unsupported':
      btnText.textContent = 'Otomatik yedekleme';
      status.textContent = 'Bu tarayıcı desteklemiyor; masaüstü Chrome veya Edge kullanın.';
      break;
    case 'on':
      btnText.textContent = 'Otomatik yedeklemeyi kapat';
      status.textContent = 'Açık — "' + AutoBackup.fileName() + '" dosyasına kaydediliyor.';
      break;
    case 'needs-permission':
      btnText.textContent = 'Yedek dosyasına bağlan';
      status.textContent = 'İzin gerekli — devam etmek için bağlanın.';
      break;
    default:
      btnText.textContent = 'Otomatik yedeklemeyi aç';
      status.textContent = 'Kapalı.';
  }
}
