import { CONFIG } from '../config.js';
import { el } from '../utils/dom.js';
import { field, input, showErr } from './modal.js';
import { parseAmount } from '../utils/format.js';

/** Oranı yüzde metnine çevirir (0.0425 -> "4,25"). */
export function pct(rate) {
  return String(Math.round((rate || 0) * 10000) / 100).replace('.', ',');
}

/**
 * Ürün formlarının ortak "gelişmiş oranlar" bölümü: gecikme faizi ve vergi oranları.
 *
 * Oranlar mevzuatla değiştiği için koda gömülmez; CONFIG'teki değerler yalnızca
 * varsayılandır ve her ürün kendi oranını taşıyabilir. Çoğu kullanıcı bu alanlara
 * dokunmayacağı için bölüm kapalı (<details>) başlar.
 *
 * type: 'card' | 'overdraft' | 'loan'
 * Dönüş: { wrap, validate() -> boolean, values() -> { overdueRate?, kkdfRate, bsmvRate } }
 */
export function rateFields(type, product) {
  const def = CONFIG.taxRates[type] || { kkdf: 0, bsmv: 0 };
  const withOverdue = type === 'card';

  const wrap = el('details', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-3');
  const summary = el('summary', 'text-xs font-semibold text-gray-600 dark:text-gray-300 cursor-pointer select-none',
    'Gelişmiş: gecikme faizi ve vergi oranları');
  wrap.appendChild(summary);

  const body = el('div', 'pt-3 space-y-3');

  const overdue = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 5,25' });
  const kkdf = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 15' });
  const bsmv = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 10' });

  overdue.value = pct(product && product.overdueRate != null ? product.overdueRate : CONFIG.defaultOverdueRate);
  kkdf.value = pct(product && product.kkdfRate != null ? product.kkdfRate : def.kkdf);
  bsmv.value = pct(product && product.bsmvRate != null ? product.bsmvRate : def.bsmv);

  if (withOverdue) {
    const f = field('Gecikme faizi (aylık %)', overdue, 'err-overdue');
    f.appendChild(el('p', 'text-[11px] text-gray-400 dark:text-gray-500 mt-1.5',
      'Asgari ödenmediğinde yalnızca ödenmeyen asgari kısma bu oran işler.'));
    body.appendChild(f);
  }

  const taxGrid = el('div', 'grid grid-cols-2 gap-3');
  taxGrid.append(field('KKDF (%)', kkdf, 'err-kkdf'), field('BSMV (%)', bsmv, 'err-bsmv'));
  body.appendChild(taxGrid);

  body.appendChild(el('p', 'text-[11px] text-gray-400 dark:text-gray-500',
    type === 'loan'
      ? 'Kredi taksiti vergi dahil ilan edilir; bu oranlar taksitin içindeki vergiyi ayrı satırda göstermek için kullanılır.'
      : 'Faiz üzerinden alınan fon ve vergi oranları. Ekstrenizdeki oranlarla doğrulayın.'));

  wrap.appendChild(body);

  const readPct = (elm, id, label) => {
    const raw = elm.value.trim();
    const v = raw === '' ? 0 : parseAmount(raw);
    if (isNaN(v) || v < 0 || v > 100) { showErr(id, label + ' için 0–100 arası bir oran girin.'); return null; }
    return v / 100;
  };

  let parsed = null;

  return {
    wrap,
    validate() {
      const out = {};
      let ok = true;

      if (withOverdue) {
        const v = readPct(overdue, 'err-overdue', 'Gecikme faizi');
        if (v == null) ok = false; else out.overdueRate = v;
      }
      const k = readPct(kkdf, 'err-kkdf', 'KKDF');
      if (k == null) ok = false; else out.kkdfRate = k;
      const b = readPct(bsmv, 'err-bsmv', 'BSMV');
      if (b == null) ok = false; else out.bsmvRate = b;

      // Hatalı alan varsa açık olsun ki kullanıcı hatayı görebilsin
      if (!ok) wrap.open = true;
      parsed = ok ? out : null;
      return ok;
    },
    values() {
      return parsed || {};
    }
  };
}
