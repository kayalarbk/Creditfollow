/**
 * KartPanel service worker — çevrimdışı çalışma ve hızlı açılış.
 *
 * Stratejiler:
 *  - Navigasyon (HTML): network-first → çevrimdışıysa önbellekteki index.html
 *  - Aynı kaynaktan varlık (js/css/png/svg): stale-while-revalidate
 *  - CDN (Tailwind, Font Awesome, Chart.js, Google Fonts): cache-first
 *    (opaque yanıtlar da saklanır; sürüm atlandığında CACHE adı değişince temizlenir)
 *
 * Kullanıcı verisi localStorage'dadır; SW hiçbir veriyi ağa göndermez.
 * Sürüm arttırıldığında eski önbellekler activate sırasında silinir.
 */
const VERSION = 'v1.0.1';
const SHELL_CACHE = `kartpanel-shell-${VERSION}`;
const RUNTIME_CACHE = `kartpanel-runtime-${VERSION}`;

/** Kurulumda önbelleğe alınan uygulama kabuğu (scope'a göreli). */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/theme-boot.js',
  './assets/js/tailwind.config.js',
  './assets/icons/logo.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './src/main.js',
  './src/config.js',
  './src/events.js',
  './src/core/store.js',
  './src/core/calc.js',
  './src/core/interest.js',
  './src/core/backup.js',
  './src/core/autobackup.js',
  './src/core/theme.js',
  './src/core/pwa.js',
  './src/ui/router.js',
  './src/ui/modal.js',
  './src/ui/bank-select.js',
  './src/ui/charts.js',
  './src/ui/tx-row.js',
  './src/ui/notifications.js',
  './src/ui/toast.js',
  './src/ui/rate-fields.js',
  './src/ui/disclaimer.js',
  './src/ui/splash.js',
  './src/ui/views/dashboard.js',
  './src/ui/views/transactions.js',
  './src/ui/views/calendar.js',
  './src/ui/views/settings.js',
  './src/ui/modals/banks.js',
  './src/ui/modals/limit-groups.js',
  './src/ui/modals/new-card.js',
  './src/ui/modals/card-detail.js',
  './src/ui/modals/new-overdraft.js',
  './src/ui/modals/overdraft-detail.js',
  './src/ui/modals/new-loan.js',
  './src/ui/modals/loan-detail.js',
  './src/ui/modals/new-transaction.js',
  './src/ui/modals/reconcile-debt.js',
  './src/ui/modals/recurring.js',
  './src/utils/dom.js',
  './src/utils/format.js'
];

/** Çevrimdışı kullanılabilirlik için önbelleğe alınan dış kaynaklar. */
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(fillShell());
});

/**
 * Kabuk önbelleğindeki eksikleri tamamlar.
 * Tek bir dosya 404 verirse kurulum tümden düşmesin diye teker teker eklenir.
 * Kurulum ağın kötü olduğu (ya da yayının henüz yayılmadığı) bir anda yapıldıysa
 * önbellek yarım kalır; bu yüzden activate'te ve sayfanın isteğiyle tekrar çalışır.
 */
async function fillShell() {
  const cache = await caches.open(SHELL_CACHE);
  const missing = [];
  for (const url of SHELL) {
    if (!(await cache.match(url))) missing.push(url);
  }
  await Promise.all(missing.map((url) =>
    cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
  ));
  return missing.length;
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('kartpanel-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    await fillShell();   // önceki kurulumdan eksik kalan varsa tamamla
  })());
});

// Sayfa "hemen güncelle" dediğinde bekleyen sürüm devreye girer
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
  // Sayfa açılışta "kabuk tam mı?" diye sorar; eksikse çevrimiçiyken tamamlanır
  if (event.data === 'refresh-shell') event.waitUntil(fillShell());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (req.mode === 'navigate') {
    event.respondWith(networkFirstPage(req));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
});

/** HTML: önce ağ (yeni sürüm gelsin), olmazsa önbellekteki kabuk. */
async function networkFirstPage(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    cache.put('./index.html', fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(req)) ||
           (await cache.match('./index.html')) ||
           (await cache.match('./')) ||
           new Response('Çevrimdışısınız.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

/** Aynı kaynak varlıklar: önbellekten anında ver, arka planda tazele. */
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return hit || (await network) || new Response('', { status: 504 });
}

/** CDN: bir kez indir, sonra önbellekten ver. */
async function cacheFirst(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    // opaque (no-cors) yanıtlar da saklanır: font/script çevrimdışı da çalışsın
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 504 });
  }
}
