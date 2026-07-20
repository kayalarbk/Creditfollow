import { CONFIG } from '../config.js';

/* Para ve tarih biçimlendiricileri (tek örnek — Intl kurulumu pahalıdır) */
export const fmtTL = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
export const fmtTL0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
export const fmtDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDateShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/**
 * Geçerli bir Date döner, aksi halde null.
 * Elle düzenlenmiş veya eski formatlı yedeklerde tarih alanı bozuk olabilir;
 * ham `new Date(...)` sonucu Intl'e verilirse tüm render "Invalid time value" ile çöker.
 */
export function safeDate(value) {
  if (value instanceof Date) return isNaN(value) ? null : value;
  if (value === null || value === undefined || value === '') return null;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

/** safeDate + biçimlendirme; tarih okunamazsa fallback metni döner. */
export function fmtDateSafe(value, formatter = fmtDate, fallback = 'Tarihsiz') {
  const d = safeDate(value);
  return d ? formatter.format(d) : fallback;
}

/** Sıralama için zaman damgası; bozuk tarihler en sona düşsün diye 0. */
export function dateSort(value) {
  const d = safeDate(value);
  return d ? d.getTime() : 0;
}

/** Türkçe format ("1.250,50" veya "1250.50") tutarı sayıya çevirir. */
export function parseAmount(str) {
  if (typeof str !== 'string') return NaN;
  let s = str.trim().replace(/\s/g, '').replace(/₺/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  // Yalnızca nokta içeren "10.000" gibi girişler Türkçe binlik ayraçtır, ondalık değil
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n * 100) / 100;
}

/** Kategori id'sinden kategori tanımı; bilinmeyen id "Diğer"e düşer. */
export function category(id) {
  return CONFIG.categories.find(c => c.id === id)
    || CONFIG.categories[CONFIG.categories.length - 1];
}

/** Banka adına göre Font Awesome ikon sınıfı. */
export function bankIcon(name) {
  const lower = (name || '').toLocaleLowerCase('tr-TR');
  const found = CONFIG.bankIcons.find(b => b.match.some(m => lower.includes(m)));
  return found ? found.icon : 'fa-credit-card';
}
