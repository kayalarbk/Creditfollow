import { Store } from '../../core/store.js';
import { AutoBackup } from '../../core/autobackup.js';
import { byId } from '../../utils/dom.js';
import { fmtDate } from '../../utils/format.js';

export function renderSettings() {
  byId('thresholdInput').value = Store.data.settings.notificationThresholdDays;
  const last = Store.data.settings.lastExport;
  byId('lastBackup').textContent = last
    ? 'Son yedek: ' + fmtDate.format(new Date(last))
    : 'Henüz yedek alınmadı.';
  renderAutoBackup();
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
