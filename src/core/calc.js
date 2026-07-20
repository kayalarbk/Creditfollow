import { CONFIG } from '../config.js';
import { Store } from './store.js';
import { safeDate } from '../utils/format.js';

/** Tarih ve finans hesapları — saf fonksiyonlar, DOM'a dokunmaz. */
export const Calc = {
  today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; },

  /** Ayın gün sayısını aşan günleri (29/30/31) ayın son gününe sabitler. */
  clampDay(year, month, day) {
    const last = new Date(year, month + 1, 0).getDate();
    return Math.min(day, last);
  },

  /** Verilen ay-günün bugünden itibaren bir sonraki gerçekleşme tarihi. */
  nextOccurrence(dayOfMonth, from = this.today()) {
    let y = from.getFullYear(), m = from.getMonth();
    let d = new Date(y, m, this.clampDay(y, m, dayOfMonth));
    if (d < from) {
      m += 1; if (m > 11) { m = 0; y += 1; }
      d = new Date(y, m, this.clampDay(y, m, dayOfMonth));
    }
    return d;
  },

  daysUntil(date) {
    return Math.round((date - this.today()) / 86400000);
  },

  minPayment(card) {
    return Math.round(card.currentDebt * card.minPaymentRate * 100) / 100;
  },

  usage(card) {
    return card.limit > 0 ? card.currentDebt / card.limit : 0;
  },

  usageColor(ratio) {
    if (ratio >= CONFIG.usageThresholds.danger) return CONFIG.statusColors.danger;
    if (ratio >= CONFIG.usageThresholds.warn) return CONFIG.statusColors.warn;
    return CONFIG.statusColors.ok;
  },

  /**
   * Kartın içinde bulunduğumuz ekstre dönemi: son hesap kesiminden bir sonrakine.
   * Bu dönemde yapılan harcamalar henüz ekstreye girmemiştir, sonraki kesimde yansır.
   */
  statementPeriod(card, from = this.today()) {
    const y = from.getFullYear(), m = from.getMonth();
    let start = new Date(y, m, this.clampDay(y, m, card.statementDay));
    if (start > from) {
      // Bu ayın kesimi henüz gelmediyse dönem geçen ayın kesiminde başlamıştır
      const pm = m - 1 < 0 ? 11 : m - 1;
      const py = m - 1 < 0 ? y - 1 : y;
      start = new Date(py, pm, this.clampDay(py, pm, card.statementDay));
    }
    const nm = start.getMonth() + 1 > 11 ? 0 : start.getMonth() + 1;
    const ny = start.getMonth() + 1 > 11 ? start.getFullYear() + 1 : start.getFullYear();
    const end = new Date(ny, nm, this.clampDay(ny, nm, card.statementDay));
    return { start, end };
  },

  /** Kartın bu ekstre dönemindeki harcama ve ödeme toplamları. */
  periodActivity(card) {
    const { start, end } = this.statementPeriod(card);
    let spent = 0, paid = 0;
    Store.data.transactions.forEach(t => {
      if (t.cardId !== card.id) return;
      const d = safeDate(t.date);
      if (!d || d < start || d >= end) return;
      if (t.type === 'expense') spent += t.amount; else paid += t.amount;
    });
    return {
      start, end,
      spent: Math.round(spent * 100) / 100,
      paid: Math.round(paid * 100) / 100
    };
  },

  /**
   * Kartın aylık taksit yükü: henüz bitmemiş taksitli harcamaların aylık payları.
   * Harcamadan bu yana geçen ay sayısı kadar taksit ödenmiş sayılır.
   */
  installmentLoad(card) {
    const today = this.today();
    let monthly = 0, remaining = 0, activePlans = 0;

    Store.data.transactions.forEach(t => {
      if (t.cardId !== card.id || t.type !== 'expense') return;
      const n = t.installments || 1;
      if (n <= 1) return;
      const d = safeDate(t.date);
      if (!d) return;

      const monthsPassed = (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
      const left = n - Math.max(0, monthsPassed);
      if (left <= 0) return;

      const per = t.amount / n;
      monthly += per;
      remaining += per * left;
      activePlans += 1;
    });

    return {
      monthly: Math.round(monthly * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      activePlans
    };
  },

  totals() {
    const cards = Store.data.cards;
    const limit = cards.reduce((s, c) => s + c.limit, 0);
    const debt = cards.reduce((s, c) => s + c.currentDebt, 0);
    const minPay = cards.reduce((s, c) => s + this.minPayment(c), 0);
    return { limit, debt, available: Math.max(limit - debt, 0), minPay, usage: limit > 0 ? debt / limit : 0 };
  },

  /**
   * Kategori bazlı harcama dağılımı (yalnızca harcamalar, büyükten küçüğe).
   * rangeDays > 0 ise yalnızca son N gün; 0 ise tüm zamanlar.
   */
  categoryBreakdown(rangeDays = 0) {
    let from = null;
    if (rangeDays > 0) {
      from = new Date(this.today());
      from.setDate(from.getDate() - (rangeDays - 1));
    }

    const sums = new Map();
    Store.data.transactions.forEach(t => {
      if (t.type !== 'expense') return;
      if (from) {
        const d = safeDate(t.date);
        if (!d || d < from) return;
      }
      const id = t.category || 'diger';
      sums.set(id, (sums.get(id) || 0) + t.amount);
    });

    const total = [...sums.values()].reduce((s, v) => s + v, 0);
    const items = [...sums.entries()]
      .map(([id, amount]) => {
        const def = CONFIG.categories.find(c => c.id === id) || CONFIG.categories[CONFIG.categories.length - 1];
        return {
          id, amount: Math.round(amount * 100) / 100,
          label: def.label, color: def.color, icon: def.icon,
          share: total > 0 ? amount / total : 0
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { items, total: Math.round(total * 100) / 100 };
  },

  /** Bildirim listesi: eşik içinde son ödemesi olan borçlu kartlar. */
  notifications() {
    const threshold = Store.data.settings.notificationThresholdDays;
    return Store.data.cards
      .filter(c => c.currentDebt > 0)
      .map(c => {
        const due = this.nextOccurrence(c.dueDay);
        return { card: c, due, days: this.daysUntil(due) };
      })
      .filter(n => n.days <= threshold)
      .sort((a, b) => a.days - b.days);
  },

  upcomingPayments(withinDays = 7) {
    return Store.data.cards
      .filter(c => c.currentDebt > 0)
      .map(c => ({ card: c, due: this.nextOccurrence(c.dueDay), days: this.daysUntil(this.nextOccurrence(c.dueDay)) }))
      .filter(n => n.days >= 0 && n.days <= withinDays)
      .sort((a, b) => a.days - b.days);
  },

  /**
   * Toplam borcun günlük zaman serisi.
   * Bugünkü borçtan geriye giderek işlemler ters uygulanır:
   *   debt(gün) = güncelBorç − Σ (o günden SONRAKİ işlemlerin etkisi)
   * etki: harcama +tutar, ödeme −tutar
   */
  debtSeries(rangeDays) {
    const today = this.today();
    const totalNow = Store.data.cards.reduce((s, c) => s + c.currentDebt, 0);
    const txs = Store.data.transactions;

    // Başlangıç: aralık verildiyse o kadar gün, yoksa ilk işlemden (veya ilk karttan) bugüne
    let start;
    if (rangeDays > 0) {
      start = new Date(today); start.setDate(start.getDate() - (rangeDays - 1));
    } else {
      const firstDates = [
        ...txs.map(t => safeDate(t.date)),
        ...Store.data.cards.map(c => safeDate(c.createdAt))
      ].filter(Boolean);
      start = firstDates.length ? new Date(Math.min(...firstDates)) : new Date(today);
      start.setHours(0, 0, 0, 0);
    }
    // En az 7 günlük pencere göster ki tek noktalı düz grafik olmasın
    const minStart = new Date(today); minStart.setDate(minStart.getDate() - 6);
    if (start > minStart) start = minStart;

    const days = Math.round((today - start) / 86400000) + 1;
    // Performans: gün sayısı çoksa örneklem aralığı büyüt (maks ~120 nokta)
    const step = Math.max(1, Math.ceil(days / 120));

    const labels = [], values = [];
    for (let i = 0; i < days; i += step) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const endOfDay = new Date(d); endOfDay.setHours(23, 59, 59, 999);
      const laterEffect = txs.reduce((s, t) => {
        const td = safeDate(t.date);
        if (td && td > endOfDay) return s + (t.type === 'expense' ? t.amount : -t.amount);
        return s;
      }, 0);
      labels.push(d);
      values.push(Math.max(0, Math.round((totalNow - laterEffect) * 100) / 100));
    }
    // Son nokta her zaman bugün olsun
    if (labels.length && labels[labels.length - 1].getTime() !== today.getTime()) {
      labels.push(new Date(today));
      values.push(totalNow);
    }
    return { labels, values };
  }
};
