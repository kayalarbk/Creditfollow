/**
 * Faiz motoru — ürün türüne göre ayrı hesap mantığı.
 *
 * Saf fonksiyonlar: DOM, Store veya CONFIG bilmez. Oranlar ve tarihler dışarıdan
 * verilir; varsayılanları seçmek çağıranın (calc.js) işidir. Böylece hem birim
 * testi yazılabilir hem de oran değişiklikleri koda gömülmemiş olur.
 *
 * Kart, avans hesap ve kredi aynı formülü paylaşamaz:
 *   - kredi kartında faiz ekstre dönemi bazında işler,
 *   - avans hesapta günlük işler ve dönem sonunda anaparaya eklenir,
 *   - ihtiyaç kredisinde eşit taksitli (annüite) amortisman vardır.
 */

const round2 = v => Math.round(v * 100) / 100;

/** Gün farkı: saat/yaz saati kaymalarından etkilenmesin diye UTC gün başlarından hesaplanır. */
export function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b - a) / 86400000);
}

/** Aylık oranı yıllığa çevirir (basit; bankalar aylık oranı 12 ile çarparak ilan eder). */
export function monthlyToAnnual(monthlyRate) {
  return monthlyRate * 12;
}

/**
 * Faiz üzerinden alınan vergiler (KKDF, BSMV).
 * Oranlar mevzuatla değiştiği için varsayılan bile burada tutulmaz; çağıran verir.
 * Kalemler ayrı döner ki kullanıcı ekstresiyle satır satır karşılaştırabilsin.
 */
export function taxesOn(interest, rates = {}) {
  const base = Math.max(interest, 0);
  const kkdf = round2(base * (rates.kkdf || 0));
  const bsmv = round2(base * (rates.bsmv || 0));
  return { kkdf, bsmv, total: round2(kkdf + bsmv) };
}

/* ============================ KREDİ KARTI ============================ */

/**
 * Bir ekstre döneminin faiz ve vergi yükü.
 *
 * Kurallar:
 *   - Ekstrenin tamamı ödenirse alışverişlere faiz işlemez.
 *   - Asgari ve üzeri ama tamamı değilse: kalan bakiyeye akdi faiz.
 *   - Asgari ödenmezse: ödenmeyen asgari kısma gecikme faizi, kalanına akdi faiz.
 *
 * Dönüş: { contractual, overdue, interest, taxes, total, remaining, isFullPaid, isMinPaid }
 *   contractual — akdi faiz, overdue — gecikme faizi, total — faiz + vergi
 */
export function cardStatementInterest({
  statementBalance = 0,
  paid = 0,
  minPayment = 0,
  monthlyRate = 0,
  overdueRate = null,
  taxRates = {}
} = {}) {
  const balance = Math.max(statementBalance, 0);
  const paidAmount = Math.max(paid, 0);
  const remaining = round2(Math.max(balance - paidAmount, 0));
  const isFullPaid = balance > 0 && remaining <= 0;
  const isMinPaid = paidAmount + 0.005 >= Math.min(minPayment, balance);

  if (balance <= 0 || isFullPaid || monthlyRate <= 0) {
    return {
      contractual: 0, overdue: 0, interest: 0,
      taxes: taxesOn(0, taxRates), total: 0,
      remaining, isFullPaid, isMinPaid
    };
  }

  // Ödenmeyen asgari kısım gecikme faizine, bakiyenin geri kalanı akdi faize tabidir
  const unpaidMin = isMinPaid ? 0 : round2(Math.max(Math.min(minPayment, balance) - paidAmount, 0));
  const contractualBase = round2(Math.max(remaining - unpaidMin, 0));
  const lateRate = overdueRate == null ? monthlyRate : overdueRate;

  const contractual = round2(contractualBase * monthlyRate);
  const overdue = round2(unpaidMin * lateRate);
  const interest = round2(contractual + overdue);
  const taxes = taxesOn(interest, taxRates);

  return {
    contractual, overdue, interest, taxes,
    total: round2(interest + taxes.total),
    remaining, isFullPaid, isMinPaid
  };
}

/**
 * Nakit avansta faiz, ekstreyi beklemeden işlem tarihinden itibaren yürür.
 * days verilmezse tarihlerden hesaplanır.
 */
export function cashAdvanceInterest({
  amount = 0,
  monthlyRate = 0,
  from = null,
  to = null,
  days = null,
  taxRates = {}
} = {}) {
  const n = days != null ? days : (from && to ? daysBetween(from, to) : 0);
  const spanned = Math.max(n, 0);
  const dailyRate = monthlyToAnnual(monthlyRate) / 365;
  const interest = round2(Math.max(amount, 0) * dailyRate * spanned);
  const taxes = taxesOn(interest, taxRates);
  return { days: spanned, interest, taxes, total: round2(interest + taxes.total) };
}

/**
 * Yalnızca asgari ödenirse borcun kapanma projeksiyonu.
 * Her ay: faiz (+vergi) işler, ardından oluşan bakiyenin asgari oranı ödenir.
 * Ödeme faizi karşılamıyorsa borç hiç kapanmaz; bu durum ayrıca bildirilir.
 */
export function cardPayoffProjection({
  balance = 0,
  monthlyRate = 0,
  minPaymentRate = 0.2,
  taxRates = {},
  maxMonths = 360
} = {}) {
  if (balance <= 0 || monthlyRate <= 0) return null;

  let debt = balance;
  let totalInterest = 0, totalTax = 0, months = 0;

  while (debt > 0.5 && months < maxMonths) {
    const interest = debt * monthlyRate;
    const tax = taxesOn(interest, taxRates).total;
    const withCost = debt + interest + tax;
    const payment = withCost * minPaymentRate;

    // Ödeme, dönemin faiz + vergi yükünü karşılamıyorsa borç her ay büyür
    if (payment <= interest + tax + 0.005) {
      return {
        months: null, totalInterest: null, totalTax: null, totalPaid: null,
        neverEnds: true, capped: false,
        firstPayment: round2(payment)
      };
    }

    totalInterest += interest;
    totalTax += tax;
    debt = withCost - payment;
    months += 1;
  }

  return {
    months,
    totalInterest: round2(totalInterest),
    totalTax: round2(totalTax),
    totalPaid: round2(balance + totalInterest + totalTax),
    neverEnds: false,
    capped: months >= maxMonths
  };
}

/* ====================== AVANS HESAP (KREDİLİ MEVDUAT) ====================== */

/** Günlük işleyen faiz: kullanılan tutar × (yıllık oran / 365) × gün sayısı. */
export function dailyInterest(balance, annualRate, days) {
  if (!(balance > 0) || !(annualRate > 0) || !(days > 0)) return 0;
  return round2(balance * (annualRate / 365) * days);
}

/**
 * Bakiye kırılım noktaları: her hareket bakiyeyi değiştirir, faiz o günden
 * itibaren yeni bakiye üzerinden işler.
 *
 * changes: [{ date, delta }] — kullanım pozitif, ödeme negatif.
 * Dönüş: [{ from, to, days, balance }] (bakiyesi 0 olan aralıklar da döner)
 */
export function balanceSegments({ startBalance = 0, changes = [], from, to } = {}) {
  if (!from || !to || daysBetween(from, to) <= 0) return [];

  const sorted = [...changes]
    .filter(c => c && c.date && daysBetween(from, c.date) >= 0 && daysBetween(c.date, to) > 0)
    .sort((a, b) => a.date - b.date);

  const segments = [];
  let cursor = from;
  let balance = startBalance;

  sorted.forEach(c => {
    const days = daysBetween(cursor, c.date);
    if (days > 0) segments.push({ from: cursor, to: c.date, days, balance: round2(balance) });
    // Aynı güne düşen birden fazla hareket tek kırılım noktasında toplanır
    balance = Math.max(0, balance + c.delta);
    cursor = c.date;
  });

  const lastDays = daysBetween(cursor, to);
  if (lastDays > 0) segments.push({ from: cursor, to, days: lastDays, balance: round2(balance) });

  return segments;
}

/**
 * Bir dönemin faiz tahakkuku: her bakiye aralığı için günlük faiz toplanır.
 * Dönüş: { interest, taxes, total, segments, endBalance }
 * endBalance — dönem sonunda faiz ve vergi anaparaya eklenmiş bakiye (bileşik).
 */
export function overdraftPeriodAccrual({
  startBalance = 0,
  changes = [],
  from,
  to,
  annualRate = 0,
  taxRates = {}
} = {}) {
  const segments = balanceSegments({ startBalance, changes, from, to })
    .map(s => Object.assign({}, s, { interest: dailyInterest(s.balance, annualRate, s.days) }));

  const interest = round2(segments.reduce((sum, s) => sum + s.interest, 0));
  const taxes = taxesOn(interest, taxRates);
  const closing = segments.length ? segments[segments.length - 1].balance : round2(startBalance);

  return {
    segments,
    interest,
    taxes,
    total: round2(interest + taxes.total),
    // Tahakkuk eden faiz dönem sonunda anaparaya eklenir; sonraki dönem bunun üzerine işler
    endBalance: round2(closing + interest + taxes.total)
  };
}

/**
 * Bakiye sabit kalırsa N dönem boyunca bileşik faiz projeksiyonu.
 * Dönüş: { periods: [{ no, opening, interest, taxes, closing }], interest, taxes, closing }
 */
export function overdraftCompound({
  balance = 0,
  annualRate = 0,
  periods = 12,
  daysPerPeriod = 30,
  taxRates = {}
} = {}) {
  const rows = [];
  let current = balance;
  let interestSum = 0, taxSum = 0;

  for (let no = 1; no <= periods; no += 1) {
    const interest = dailyInterest(current, annualRate, daysPerPeriod);
    const tax = taxesOn(interest, taxRates).total;
    const closing = round2(current + interest + tax);
    rows.push({ no, opening: round2(current), interest, taxes: tax, closing });
    interestSum += interest;
    taxSum += tax;
    current = closing;
  }

  return {
    periods: rows,
    interest: round2(interestSum),
    taxes: round2(taxSum),
    closing: round2(current)
  };
}

/* ============================ İHTİYAÇ KREDİSİ ============================ */

/** Annüite (eşit) taksit tutarı. Oran 0 ise anapara taksite bölünür. */
export function annuityPayment(principal, monthlyRate, months) {
  if (!(months > 0)) return 0;
  if (!(monthlyRate > 0)) return round2(principal / months);
  const f = Math.pow(1 + monthlyRate, months);
  return round2(principal * monthlyRate * f / (f - 1));
}

/**
 * Taksit, anapara ve vade biliniyorsa örtük aylık faiz oranı.
 *
 * Veri modelinde kredinin faiz oranı tutulmuyor (kullanıcı taksiti biliyor, oranı
 * çoğu zaman bilmiyor). Oran, annüite formülünün tersinden ikili aramayla bulunur;
 * kapalı çözümü olmadığı için sayısal yöntem tek yol.
 */
export function impliedMonthlyRate({ principal = 0, payment = 0, months = 0 } = {}) {
  if (!(principal > 0) || !(payment > 0) || !(months > 0)) return 0;
  // Toplam geri ödeme anaparayı aşmıyorsa faizsiz kabul edilir
  if (payment * months <= principal + 0.01) return 0;

  let lo = 0, hi = 1; // aylık %100 üst sınır; gerçekçi tüm oranları kapsar
  for (let i = 0; i < 200; i += 1) {
    const mid = (lo + hi) / 2;
    if (annuityPayment(principal, mid, months) > payment) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Annüite amortisman tablosu.
 *
 * monthlyRate verilmezse taksit/anapara/vadeden türetilir. Son taksitte yuvarlama
 * artıkları kapatılır ki anapara sütununun toplamı çekilen tutara eşit olsun.
 *
 * Vergi burada faizin ÜSTÜNE eklenmez, faizin İÇİNDEN ayrıştırılır: bankanın
 * ilan ettiği taksit vergi dahil tutardır, taksitten türetilen oran da vergiyi
 * içerir. Üstüne eklemek çift sayım olurdu. (Kart ve avansta oran vergisiz
 * ilan edildiği için orada vergi faizin üstüne eklenir.)
 *
 * Dönüş: { rows: [{ no, date, payment, principal, interest, taxes, balance }],
 *          monthlyRate, totalPayment, totalInterest, totalTax }
 */
export function amortizationSchedule({
  principal = 0,
  payment = 0,
  months = 0,
  monthlyRate = null,
  firstPaymentDate = null,
  taxRates = {}
} = {}) {
  if (!(principal > 0) || !(months > 0)) {
    return { rows: [], monthlyRate: 0, totalPayment: 0, totalInterest: 0, totalTax: 0 };
  }

  const rate = monthlyRate == null ? impliedMonthlyRate({ principal, payment, months }) : monthlyRate;
  const inst = payment > 0 ? payment : annuityPayment(principal, rate, months);

  // Vergi dahil faizin içinden vergisiz faizi ayırmak için bölen
  const taxDivisor = 1 + (taxRates.kkdf || 0) + (taxRates.bsmv || 0);

  const rows = [];
  let balance = principal;
  let totalInterest = 0, totalTax = 0, totalPayment = 0;

  for (let no = 1; no <= months; no += 1) {
    const cost = round2(balance * rate); // faiz + vergi
    const interest = round2(cost / taxDivisor);
    const tax = round2(cost - interest);
    let principalPart = round2(inst - cost);
    let paymentPart = inst;

    // Son taksit: yuvarlama artığı burada kapanır, kalan anapara tam sıfırlanır
    if (no === months || principalPart >= balance) {
      principalPart = round2(balance);
      paymentPart = round2(principalPart + cost);
    }

    balance = round2(balance - principalPart);
    totalInterest += interest;
    totalTax += tax;
    totalPayment += paymentPart;

    rows.push({
      no,
      date: firstPaymentDate ? addMonthsSafe(firstPaymentDate, no - 1) : null,
      payment: round2(paymentPart),
      principal: principalPart,
      interest,
      taxes: tax,
      balance: Math.max(balance, 0)
    });

    if (balance <= 0) break;
  }

  return {
    rows,
    monthlyRate: rate,
    totalPayment: round2(totalPayment),
    totalInterest: round2(totalInterest),
    totalTax: round2(totalTax)
  };
}

/** Ödenen taksit sayısına göre kalan anapara (erken kapama tutarının çekirdeği). */
export function remainingPrincipal(schedule, paidCount) {
  const rows = schedule.rows || [];
  if (rows.length === 0) return 0;
  if (paidCount <= 0) return round2(rows[0].principal + rows[0].balance);
  const idx = Math.min(paidCount, rows.length) - 1;
  return rows[idx].balance;
}

/**
 * Erken kapama tutarı: kalan anapara + içinde bulunulan döneme ait işlemiş faiz.
 * Bankalar erken kapamada kalan taksitlerin faizini almaz; yalnızca anapara ve
 * son ödemeden bu yana işleyen faiz istenir.
 */
export function earlyPayoffAmount({ schedule, paidCount = 0, accruedDays = 0, taxRates = {} } = {}) {
  const remaining = remainingPrincipal(schedule, paidCount);
  const rate = schedule.monthlyRate || 0;
  // Kredide oran vergi dahildir; maliyet faiz ve vergi olarak ayrıştırılır
  const divisor = 1 + (taxRates.kkdf || 0) + (taxRates.bsmv || 0);
  const cost = round2(remaining * rate * (Math.max(accruedDays, 0) / 30));
  const interest = round2(cost / divisor);

  return {
    principal: remaining,
    interest,
    taxes: {
      kkdf: round2(interest * (taxRates.kkdf || 0)),
      bsmv: round2(interest * (taxRates.bsmv || 0)),
      total: round2(cost - interest)
    },
    total: round2(remaining + cost)
  };
}

/** Tarihe ay ekler; ayın gün sayısını aşan günler son güne sabitlenir (31 Ocak + 1 ay = 28/29 Şubat). */
function addMonthsSafe(date, months) {
  const base = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const last = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return new Date(base.getFullYear(), base.getMonth(), Math.min(date.getDate(), last));
}

export const Interest = {
  daysBetween,
  monthlyToAnnual,
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
};
