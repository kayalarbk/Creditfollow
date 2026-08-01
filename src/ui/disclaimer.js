import { el } from '../utils/dom.js';

const TEXT = 'Bu bir hesaplama aracıdır, finansal tavsiye değildir. ' +
  'Sözleşme faiz oranlarını bankanızın ekstresinden doğrulayın.';

/**
 * Faiz/senaryo hesabı gösteren her kutunun altına eklenen nötr uyarı.
 * Ekranlar hesaplama gösterir, tavsiye vermez; metin tek yerde tutulur ki
 * her ekranda aynı dille çıksın.
 */
export function disclaimer(extra) {
  return el('p', 'text-[11px] text-gray-500 dark:text-gray-400', extra ? extra + ' ' + TEXT : TEXT);
}
