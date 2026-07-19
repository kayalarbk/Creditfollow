import { Store } from '../../core/store.js';
import { byId } from '../../utils/dom.js';
import { fmtDate } from '../../utils/format.js';

export function renderSettings() {
  byId('thresholdInput').value = Store.data.settings.notificationThresholdDays;
  const last = Store.data.settings.lastExport;
  byId('lastBackup').textContent = last
    ? 'Son yedek: ' + fmtDate.format(new Date(last))
    : 'Henüz yedek alınmadı.';
}
