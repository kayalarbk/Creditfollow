/**
 * PWA katmanı: service worker kaydı, güncelleme bildirimi ve "uygulamayı yükle" istemi.
 *
 * Neden ayrı modül: main.js yalnızca akışı kurar; kurulum/güncelleme durumu
 * (beforeinstallprompt olayı tek seferlik olduğu için) burada tutulur ve
 * ayarlar ekranı bu modüle sorar.
 *
 * Not: service worker yalnızca https veya localhost üzerinde çalışır;
 * file:// ile açıldığında sessizce devre dışı kalır.
 */
import { toast } from '../ui/toast.js';

let deferredPrompt = null;      // beforeinstallprompt olayı (yalnızca bir kez gelir)
let installedListeners = [];    // ayarlar ekranının yeniden çizim geri çağrıları

export const PWA = {
  /** Kurulabilir mi (tarayıcı istem verdi ve henüz kurulmadı)? */
  get canInstall() { return deferredPrompt !== null; },

  /** Uygulama ayrı pencere/ana ekran modunda mı açıldı? */
  get isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  },

  /** Kurulabilirlik değiştiğinde ayarlar ekranını tazelemek için. */
  onChange(fn) { installedListeners.push(fn); },

  /**
   * Kurulum istemini gösterir.
   * @returns {Promise<'accepted'|'dismissed'|'unavailable'>}
   */
  async promptInstall() {
    if (!deferredPrompt) return 'unavailable';
    const evt = deferredPrompt;
    deferredPrompt = null;      // istem tekrar kullanılamaz
    evt.prompt();
    const { outcome } = await evt.userChoice;
    notify();
    return outcome;
  },

  /** main.js'ten çağrılır: SW kaydı + kurulum olaylarının bağlanması. */
  init() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();       // tarayıcının kendi çubuğu yerine kendi düğmemiz
      deferredPrompt = e;
      notify();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      notify();
      toast('KartPanel cihazınıza yüklendi.');
    });

    registerServiceWorker();
  }
};

function notify() { installedListeners.forEach((fn) => fn()); }

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;

  try {
    const reg = await navigator.serviceWorker.register('sw.js', { scope: './' });

    // Zaten bekleyen bir sürüm varsa (önceki oturumdan) kullanıcıya sor
    if (reg.waiting) offerUpdate(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // controller varsa bu ilk kurulum değil → gerçek bir güncelleme
        if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
      });
    });
  } catch {
    // SW kaydı başarısız olsa da uygulama çevrimiçi çalışmaya devam eder
  }
}

/** Yeni sürüm hazır: kullanıcı onaylarsa devreye alıp sayfayı yeniler. */
function offerUpdate(worker) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  toast('Yeni sürüm hazır.', 'warn', {
    duration: 12000,
    action: { label: 'Güncelle', onClick: () => worker.postMessage('skip-waiting') }
  });
}
