/**
 * KartPanel — uygulama giriş noktası.
 * Katmanlar: core (veri & hesap) → ui (render) → events (bağlama)
 */
import { Store } from './core/store.js';
import { AutoBackup } from './core/autobackup.js';
import { applyAutoRestore } from './core/backup.js';
import { bindEvents } from './events.js';
import { switchView, renderAll } from './ui/router.js';
import { renderSettings } from './ui/views/settings.js';
import { toast } from './ui/toast.js';

function init() {
  Store.load();
  bindEvents();
  switchView('dashboard');
  renderAll();

  if (Store.corrupt) {
    toast('Kayıtlı veriniz okunamadı. Ayarlar bölümünden yedeğinizi geri yükleyebilirsiniz.', 'danger');
  }

  initAutoBackup();
}

/** Otomatik yedek dosyası varsa bağlan; tarayıcı verisi boşsa dosyadan geri yükle. */
async function initAutoBackup() {
  const result = await AutoBackup.init();
  if (result === 'needs-permission') {
    toast('Otomatik yedek dosyanıza erişim izni gerekiyor. Ayarlar → "Yedek dosyasına bağlan" düğmesine tıklayın.', 'warn');
  } else if (result && !applyAutoRestore(result)) {
    // Geri yükleme gerekmedi: dosyayı güncel tarayıcı verisiyle eşitle
    AutoBackup.schedule(Store.data);
  }
  renderSettings();
}

// type="module" script'leri defer edilir; DOM hazırsa doğrudan çalıştır
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
