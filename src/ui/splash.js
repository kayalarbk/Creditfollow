/**
 * Açılış ekranı (splash) denetimi.
 *
 * Markup index.html içinde hazır bulunur (JS beklemeden boyanabilsin diye);
 * bu modül yalnızca ne kadar kalacağını ve nasıl kapanacağını yönetir.
 *
 * Kurallar:
 *  - Oturumun ilk açılışında tam animasyon (FULL_MS), aynı oturumdaki
 *    sonraki yenilemelerde kısa sürüm (SHORT_MS) — her yenilemede
 *    aynı karşılamayı izlemek yorucu olur.
 *  - Hareket azaltma tercihinde (prefers-reduced-motion) yalnızca kısa sürüm.
 *  - Tıklama, dokunma veya herhangi bir tuş ekranı hemen geçer.
 */
const FULL_MS = 2200;
const SHORT_MS = 900;
const SESSION_KEY = 'kartpanel_splash_seen';

export function initSplash() {
  const node = document.getElementById('splash');
  if (!node) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seen = sessionRead(SESSION_KEY);
  const duration = (reduced || seen) ? SHORT_MS : FULL_MS;

  node.style.setProperty('--splash-duration', duration + 'ms');
  sessionWrite(SESSION_KEY, '1');

  let done = false;
  const hide = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    node.classList.add('is-hidden');
    document.documentElement.classList.remove('splash-on');
    document.removeEventListener('keydown', hide);
    node.removeEventListener('click', hide);
    // Geçiş bittikten sonra DOM'dan çıkar: odak sırasına takılmasın
    setTimeout(() => node.remove(), 600);
  };

  const timer = setTimeout(hide, duration);
  document.addEventListener('keydown', hide);
  node.addEventListener('click', hide);
}

/** sessionStorage gizli sekmede/kısıtlı tarayıcıda hata verebilir. */
function sessionRead(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function sessionWrite(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* yok sayılır */ }
}
