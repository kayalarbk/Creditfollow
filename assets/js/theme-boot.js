/**
 * Tema flash önleme: sayfa render edilmeden ÖNCE tema class'ını uygular.
 * Bu yüzden senkron çalışmalı ve modül olmamalıdır (defer edilemez).
 */
(function () {
  try {
    var raw = localStorage.getItem('kartpanel_data');
    var theme = raw ? (JSON.parse(raw).settings || {}).theme : null;
    if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (e) { /* bozuk veri: Store.load() ele alır */ }
})();
