import { CONFIG } from '../config.js';

/* Para ve tarih biçimlendiricileri (tek örnek — Intl kurulumu pahalıdır) */
export const fmtTL = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 });
export const fmtTL0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
export const fmtDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
export const fmtDateShort = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' });

/** Türkçe format ("1.250,50" veya "1250.50") tutarı sayıya çevirir. */
export function parseAmount(str) {
  if (typeof str !== 'string') return NaN;
  let s = str.trim().replace(/\s/g, '').replace(/₺/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : Math.round(n * 100) / 100;
}

/** Banka adına göre Font Awesome ikon sınıfı. */
export function bankIcon(name) {
  const lower = (name || '').toLocaleLowerCase('tr-TR');
  const found = CONFIG.bankIcons.find(b => b.match.some(m => lower.includes(m)));
  return found ? found.icon : 'fa-credit-card';
}
