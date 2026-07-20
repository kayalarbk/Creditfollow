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

  runRecurring();
  initAutoBackup();
}

/** Vadesi gelmiş tekrarlayan işlemleri kaydeder ve kullanıcıyı bilgilendirir. */
function runRecurring() {
  const created = Store.runRecurring();
  if (created === 0) return;
  renderAll();
  toast(created + ' tekrarlayan işlem otomatik kaydedildi.', 'warn');
}

/** Otomatik yedek dosyası varsa bağlan; tarayıcı verisi boşsa dosyadan geri yükle. */
async function initAutoBackup() {
  const result = await AutoBackup.init();
  if (result === 'needs-permission') {
    toast('Otomatik yedek dosyanıza erişim izni gerekiyor. Ayarlar → "Yedek dosyasına bağlan" düğmesine tıklayın.', 'warn');
  } else if (result && applyAutoRestore(result)) {
    // Geri yüklenen veri kümesi için tekrarlayanlar henüz değerlendirilmedi
    runRecurring();
  } else if (result) {
    // Geri yükleme gerekmedi: dosyayı güncel tarayıcı verisiyle eşitle
    AutoBackup.schedule(Store.data);
  }
  renderSettings();
}

// type="module" script'leri defer edilir; DOM hazırsa doğrudan çalıştır
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
