/**
 * Faiz motoru birim testleri — harici bağımlılık yok.
 * Çalıştırma: npm test  (node --test)
 *
 * interest.js bilerek saf tutulduğu (DOM/Store/CONFIG bilmediği) için
 * Node altında doğrudan import edilebilir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  daysBetween,
  taxesOn,
  cardStatementInterest,
  cashAdvanceInterest,
  cardPayoffProjection,
  dailyInterest,
  balanceSegments,
  overdraftPeriodAccrual,
  overdraftCompound,
  annuityPayment,
  impliedMonthlyRate,
  amortizationSchedule,
  remainingPrincipal,
  earlyPayoffAmount
} from '../src/core/interest.js';

const d = (y, m, day) => new Date(y, m - 1, day);
/**
 * Kuruş yuvarlamaları için tolerans karşılaştırması.
 * Üçüncü argüman sayı ise tolerans, metin ise açıklamadır.
 */
const near = (actual, expected, tolOrMsg, maybeMsg) => {
  const tol = typeof tolOrMsg === 'number' ? tolOrMsg : 0.02;
  const msg = typeof tolOrMsg === 'string' ? tolOrMsg : maybeMsg;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    (msg ? msg + ': ' : '') + `${actual} ≈ ${expected} bekleniyordu`
  );
};

/* ============================ gün sayımı ============================ */

test('daysBetween — sınır durumları', () => {
  assert.equal(daysBetween(d(2026, 1, 1), d(2026, 1, 1)), 0, 'aynı gün 0');
  assert.equal(daysBetween(d(2026, 1, 1), d(2026, 1, 2)), 1);
  assert.equal(daysBetween(d(2026, 1, 2), d(2026, 1, 1)), -1, 'ters yön negatif');
  assert.equal(daysBetween(d(2026, 1, 1), d(2027, 1, 1)), 365);
  // Gün içi saat farkı gün sayısını değiştirmemeli
  assert.equal(daysBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1)), 1);
});

test('daysBetween — artık yıl', () => {
  assert.equal(daysBetween(d(2024, 2, 28), d(2024, 3, 1)), 2, '2024 artık yıl: 29 Şubat sayılır');
  assert.equal(daysBetween(d(2023, 2, 28), d(2023, 3, 1)), 1, '2023 artık yıl değil');
  assert.equal(daysBetween(d(2024, 1, 1), d(2025, 1, 1)), 366, 'artık yıl 366 gün');
});

/* ============================ günlük faiz ============================ */

test('dailyInterest — gün sayısı sınırları', () => {
  assert.equal(dailyInterest(10000, 0.365, 0), 0, '0 gün faiz üretmez');
  assert.equal(dailyInterest(10000, 0.365, -5), 0, 'negatif gün faiz üretmez');
  assert.equal(dailyInterest(0, 0.365, 30), 0, 'bakiye yoksa faiz yok');
  assert.equal(dailyInterest(10000, 0, 30), 0, 'oran yoksa faiz yok');
  near(dailyInterest(10000, 0.365, 1), 10, 'günlük %0,1');
  near(dailyInterest(10000, 0.365, 365), 3650, '365 gün = yıllık faizin tamamı');
});

test('dailyInterest — 365 gün sayımı artık yılda da sabittir', () => {
  // Bankalar artık yılda da 365 gün tabanı kullanır; 366 gün 366/365 kadar faiz üretir
  const leapDays = daysBetween(d(2024, 1, 1), d(2025, 1, 1));
  near(dailyInterest(36500, 0.365, leapDays), 36500 * 0.365 * 366 / 365, 0.05);
});

/* ============================ vergiler ============================ */

test('taxesOn — kalemler ayrı döner', () => {
  const t = taxesOn(1000, { kkdf: 0.15, bsmv: 0.10 });
  assert.equal(t.kkdf, 150);
  assert.equal(t.bsmv, 100);
  assert.equal(t.total, 250);
  assert.equal(taxesOn(1000, {}).total, 0, 'oran verilmezse vergi yok');
  assert.equal(taxesOn(-500, { kkdf: 0.15 }).total, 0, 'negatif faize vergi işlemez');
});

/* ============================ kredi kartı ============================ */

const CARD = { monthlyRate: 0.0425, overdueRate: 0.0525, taxRates: { kkdf: 0.15, bsmv: 0.10 } };

test('kart — ekstrenin tamamı ödendiğinde faiz sıfır', () => {
  const r = cardStatementInterest({
    ...CARD, statementBalance: 10000, paid: 10000, minPayment: 2000
  });
  assert.equal(r.interest, 0);
  assert.equal(r.taxes.total, 0);
  assert.equal(r.total, 0);
  assert.equal(r.isFullPaid, true);
  assert.equal(r.remaining, 0);
});

test('kart — fazla ödeme de faiz üretmez', () => {
  const r = cardStatementInterest({ ...CARD, statementBalance: 10000, paid: 12000, minPayment: 2000 });
  assert.equal(r.total, 0);
  assert.equal(r.remaining, 0);
});

test('kart — asgari ve üzeri ödendiğinde kalan bakiyeye akdi faiz', () => {
  const r = cardStatementInterest({
    ...CARD, statementBalance: 10000, paid: 3000, minPayment: 2000
  });
  assert.equal(r.isMinPaid, true);
  assert.equal(r.overdue, 0, 'gecikme faizi işlemez');
  near(r.contractual, 7000 * 0.0425);
  near(r.taxes.total, r.interest * 0.25);
  near(r.total, r.interest * 1.25);
});

test('kart — asgari altı ödemede gecikme faizi devreye girer', () => {
  const r = cardStatementInterest({
    ...CARD, statementBalance: 10000, paid: 500, minPayment: 2000
  });
  assert.equal(r.isMinPaid, false);
  // Ödenmeyen asgari 1.500 → gecikme faizi; kalan 8.000 → akdi faiz
  near(r.overdue, 1500 * 0.0525);
  near(r.contractual, 8000 * 0.0425);
  assert.ok(r.overdue > 0, 'gecikme faizi devrede');
  near(r.interest, 1500 * 0.0525 + 8000 * 0.0425);
});

test('kart — hiç ödeme yapılmazsa tüm asgari gecikmiş sayılır', () => {
  const r = cardStatementInterest({ ...CARD, statementBalance: 10000, paid: 0, minPayment: 2000 });
  near(r.overdue, 2000 * 0.0525);
  near(r.contractual, 8000 * 0.0425);
});

test('kart — gecikme oranı verilmezse akdi faiz uygulanır', () => {
  const r = cardStatementInterest({
    statementBalance: 1000, paid: 0, minPayment: 200, monthlyRate: 0.04, overdueRate: null
  });
  near(r.interest, 1000 * 0.04);
});

test('kart — oran 0 ise faiz yok', () => {
  const r = cardStatementInterest({ statementBalance: 10000, paid: 0, minPayment: 2000, monthlyRate: 0 });
  assert.equal(r.total, 0);
});

test('nakit avans — faiz işlem tarihinden itibaren yürür', () => {
  const r = cashAdvanceInterest({
    amount: 5000, monthlyRate: 0.0425, from: d(2026, 1, 1), to: d(2026, 1, 31),
    taxRates: { kkdf: 0.15, bsmv: 0.10 }
  });
  assert.equal(r.days, 30);
  near(r.interest, 5000 * (0.0425 * 12 / 365) * 30);
  near(r.total, r.interest * 1.25);
  assert.equal(cashAdvanceInterest({ amount: 5000, monthlyRate: 0.0425, days: 0 }).interest, 0);
});

test('kart projeksiyonu — asgari faizi karşılamıyorsa borç kapanmaz', () => {
  // Aylık %20 faiz + %25 vergi, asgari %20: ödeme maliyeti karşılamıyor
  const r = cardPayoffProjection({
    balance: 10000, monthlyRate: 0.20, minPaymentRate: 0.20,
    taxRates: { kkdf: 0.15, bsmv: 0.10 }
  });
  assert.equal(r.neverEnds, true);
  assert.equal(r.months, null);
});

test('kart projeksiyonu — kapanan borçta toplamlar tutarlı', () => {
  const r = cardPayoffProjection({ balance: 10000, monthlyRate: 0.02, minPaymentRate: 0.20 });
  assert.equal(r.neverEnds, false);
  assert.ok(r.months > 0 && r.months < 360);
  near(r.totalPaid, 10000 + r.totalInterest + r.totalTax, 0.5);
});

test('kart projeksiyonu — borç veya oran yoksa null', () => {
  assert.equal(cardPayoffProjection({ balance: 0, monthlyRate: 0.04 }), null);
  assert.equal(cardPayoffProjection({ balance: 1000, monthlyRate: 0 }), null);
});

/* ============================ avans hesap ============================ */

test('avans — bakiye kırılım noktaları günlük hesaplanır', () => {
  const segments = balanceSegments({
    startBalance: 10000,
    changes: [
      { date: d(2026, 1, 11), delta: 5000 },   // kullanım
      { date: d(2026, 1, 21), delta: -8000 }   // ödeme
    ],
    from: d(2026, 1, 1),
    to: d(2026, 1, 31)
  });

  assert.equal(segments.length, 3);
  assert.deepEqual(segments.map(s => [s.days, s.balance]), [[10, 10000], [10, 15000], [10, 7000]]);
});

test('avans — aynı gün birden fazla hareket tek kırılım noktasıdır', () => {
  const segments = balanceSegments({
    startBalance: 1000,
    changes: [
      { date: d(2026, 1, 10), delta: 500 },
      { date: d(2026, 1, 10), delta: 500 }
    ],
    from: d(2026, 1, 1),
    to: d(2026, 1, 20)
  });
  assert.equal(segments.length, 2);
  assert.deepEqual(segments.map(s => [s.days, s.balance]), [[9, 1000], [10, 2000]]);
});

test('avans — ödeme bakiyeyi negatife düşüremez', () => {
  const segments = balanceSegments({
    startBalance: 1000,
    changes: [{ date: d(2026, 1, 10), delta: -5000 }],
    from: d(2026, 1, 1),
    to: d(2026, 1, 20)
  });
  assert.equal(segments[1].balance, 0);
});

test('avans — dönem tahakkuku ve bileşik bakiye', () => {
  const r = overdraftPeriodAccrual({
    startBalance: 10000,
    changes: [],
    from: d(2026, 1, 1),
    to: d(2026, 1, 31),
    annualRate: 0.365,
    taxRates: { kkdf: 0.15, bsmv: 0.10 }
  });
  near(r.interest, 10000 * 0.001 * 30);
  near(r.taxes.total, r.interest * 0.25);
  // Tahakkuk eden faiz + vergi dönem sonunda anaparaya eklenir
  near(r.endBalance, 10000 + r.interest + r.taxes.total);
});

test('avans — bileşik projeksiyon her dönem büyür', () => {
  const r = overdraftCompound({ balance: 10000, annualRate: 0.365, periods: 3, daysPerPeriod: 30 });
  assert.equal(r.periods.length, 3);
  assert.ok(r.periods[1].opening > r.periods[0].opening, 'bakiye bileşik olarak büyür');
  assert.equal(r.periods[0].closing, r.periods[1].opening);
  near(r.closing, r.periods[2].closing);
});

/* ============================ ihtiyaç kredisi ============================ */

test('annüite — oran 0 ise taksit anaparanın vadeye bölümü', () => {
  assert.equal(annuityPayment(12000, 0, 12), 1000);
});

test('annüite — bilinen değerlerle taksit', () => {
  // 100.000 TL, aylık %3, 12 taksit
  near(annuityPayment(100000, 0.03, 12), 10046.21, 0.1);
});

test('örtük oran — annüite formülünün tersini bulur', () => {
  const payment = annuityPayment(100000, 0.029, 24);
  near(impliedMonthlyRate({ principal: 100000, payment, months: 24 }), 0.029, 0.0001);
});

test('örtük oran — toplam geri ödeme anaparayı aşmıyorsa 0', () => {
  assert.equal(impliedMonthlyRate({ principal: 12000, payment: 1000, months: 12 }), 0);
  assert.equal(impliedMonthlyRate({ principal: 0, payment: 100, months: 12 }), 0);
});

test('amortisman — anapara sütununun toplamı çekilen tutara eşittir', () => {
  const principal = 100000;
  const months = 24;
  const payment = annuityPayment(principal, 0.029, months);
  const s = amortizationSchedule({ principal, payment, months, taxRates: { kkdf: 0.15, bsmv: 0.10 } });

  assert.equal(s.rows.length, months);
  const principalSum = s.rows.reduce((t, r) => t + r.principal, 0);
  near(principalSum, principal, 0.05);
  assert.equal(s.rows[months - 1].balance, 0, 'son taksitte kalan anapara sıfırlanır');
});

test('amortisman — taksit toplamı anapara + faiz + vergiye eşittir', () => {
  const principal = 100000;
  const months = 24;
  const payment = annuityPayment(principal, 0.029, months);
  const s = amortizationSchedule({ principal, payment, months, taxRates: { kkdf: 0.15, bsmv: 0.10 } });

  near(s.totalPayment, principal + s.totalInterest + s.totalTax, 0.1);
  // Vergi faizin üstüne eklenmez, içinden ayrılır: toplam ödeme taksit × vade kadardır
  near(s.totalPayment, payment * months, 0.5);
  assert.ok(s.totalTax > 0, 'vergi ayrı kalem olarak görünür');
});

test('amortisman — her satırda taksit = anapara + faiz + vergi', () => {
  const s = amortizationSchedule({
    principal: 50000, payment: annuityPayment(50000, 0.025, 12), months: 12,
    taxRates: { kkdf: 0.15, bsmv: 0.10 }
  });
  s.rows.forEach(r => near(r.payment, r.principal + r.interest + r.taxes, 0.02));
});

test('amortisman — faizsiz kredide faiz ve vergi sıfır', () => {
  const s = amortizationSchedule({ principal: 12000, payment: 1000, months: 12 });
  assert.equal(s.monthlyRate, 0);
  assert.equal(s.totalInterest, 0);
  assert.equal(s.totalTax, 0);
  near(s.totalPayment, 12000);
});

test('amortisman — taksit tarihleri ay sonlarına sabitlenir', () => {
  const s = amortizationSchedule({
    principal: 30000, payment: annuityPayment(30000, 0.02, 3), months: 3,
    firstPaymentDate: d(2026, 1, 31)
  });
  assert.equal(s.rows[0].date.getMonth(), 0);
  assert.equal(s.rows[1].date.getDate(), 28, '31 Ocak + 1 ay = 28 Şubat');
  assert.equal(s.rows[2].date.getDate(), 31);
});

test('amortisman — geçersiz girdide boş tablo', () => {
  assert.deepEqual(amortizationSchedule({ principal: 0, months: 12 }).rows, []);
  assert.deepEqual(amortizationSchedule({ principal: 1000, months: 0 }).rows, []);
});

test('kalan anapara ve erken kapama', () => {
  const principal = 60000;
  const months = 12;
  const payment = annuityPayment(principal, 0.025, months);
  const s = amortizationSchedule({ principal, payment, months, taxRates: { kkdf: 0.15, bsmv: 0.10 } });

  assert.equal(remainingPrincipal(s, 0), principal, 'hiç ödenmemişse tüm anapara kalır');
  assert.equal(remainingPrincipal(s, months), 0, 'tamamı ödenmişse kalan yok');
  assert.ok(remainingPrincipal(s, 6) < remainingPrincipal(s, 3), 'ödendikçe azalır');

  const payoff = earlyPayoffAmount({ schedule: s, paidCount: 6, accruedDays: 0, taxRates: { kkdf: 0.15, bsmv: 0.10 } });
  assert.equal(payoff.interest, 0, 'gün geçmediyse faiz işlemez');
  assert.equal(payoff.total, payoff.principal);

  const withDays = earlyPayoffAmount({ schedule: s, paidCount: 6, accruedDays: 15, taxRates: { kkdf: 0.15, bsmv: 0.10 } });
  assert.ok(withDays.total > payoff.total, 'geçen gün faiz ekler');
  // Erken kapama, kalan taksitlerin toplamından ucuzdur (ileri faiz ödenmez)
  const remainingInstallments = payment * (months - 6);
  assert.ok(withDays.total < remainingInstallments);
});
