import { CONFIG } from '../config.js';
import { Store } from './store.js';

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

  totals() {
    const cards = Store.data.cards;
    const limit = cards.reduce((s, c) => s + c.limit, 0);
    const debt = cards.reduce((s, c) => s + c.currentDebt, 0);
    const minPay = cards.reduce((s, c) => s + this.minPayment(c), 0);
    return { limit, debt, available: Math.max(limit - debt, 0), minPay, usage: limit > 0 ? debt / limit : 0 };
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
        ...txs.map(t => new Date(t.date)),
        ...Store.data.cards.map(c => new Date(c.createdAt))
      ].filter(d => !isNaN(d));
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
        if (new Date(t.date) > endOfDay) return s + (t.type === 'expense' ? t.amount : -t.amount);
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
