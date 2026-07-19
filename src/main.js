/**
 * KartPanel — uygulama giriş noktası.
 * Katmanlar: core (veri & hesap) → ui (render) → events (bağlama)
 */
import { Store } from './core/store.js';
import { bindEvents } from './events.js';
import { switchView, renderAll } from './ui/router.js';
import { toast } from './ui/toast.js';

function init() {
  Store.load();
  bindEvents();
  switchView('dashboard');
  renderAll();

  if (Store.corrupt) {
    toast('Kayıtlı veriniz okunamadı. Ayarlar bölümünden yedeğinizi geri yükleyebilirsiniz.', 'danger');
  }
}

// type="module" script'leri defer edilir; DOM hazırsa doğrudan çalıştır
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
