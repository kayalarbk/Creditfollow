import { CONFIG } from '../config.js';
import { toast } from '../ui/toast.js';
import { safeDate } from '../utils/format.js';
import { AutoBackup } from './autobackup.js';

const num = (v, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback);
const day = v => Math.min(Math.max(parseInt(v, 10) || 1, 1), 31);

/**
 * Tek veri kaynağı: localStorage üzerinde CRUD.
 * Tüm mutasyonlar save() ile diske yazar ve başarı durumunu döner.
 */
export const Store = {
  data: null,
  corrupt: false,

  defaults() {
    return {
      cards: [],
      transactions: [],
      settings: {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        currency: 'TRY',
        notificationThresholdDays: CONFIG.defaultThresholdDays,
        lastExport: null
      }
    };
  },

  /**
   * Dış kaynaklı veriyi (localStorage, JSON yedeği, otomatik yedek dosyası) güvenli hâle getirir.
   * Elle düzenlenmiş veya eski sürümden gelen kayıtlarda alanlar eksik/bozuk olabilir;
   * eksik alan render sırasında değil, burada tek noktada telafi edilir.
   */
  normalize(parsed) {
    const base = this.defaults();
    const out = Object.assign(base, parsed || {});
    out.settings = Object.assign(this.defaults().settings, (parsed && parsed.settings) || {});

    out.cards = (Array.isArray(out.cards) ? out.cards : [])
      .filter(c => c && typeof c === 'object')
      .map(c => Object.assign({}, c, {
        id: c.id || this.uid(),
        bankName: String(c.bankName || 'Bilinmeyen banka'),
        limit: num(c.limit),
        currentDebt: num(c.currentDebt),
        statementDay: day(c.statementDay),
        dueDay: day(c.dueDay),
        minPaymentRate: num(c.minPaymentRate, CONFIG.minPaymentRates[0]),
        color: Array.isArray(c.color) && c.color.length === 2 ? c.color : CONFIG.cardGradients[0],
        createdAt: safeDate(c.createdAt) ? c.createdAt : new Date().toISOString()
      }));

    const cardIds = new Set(out.cards.map(c => c.id));
    out.transactions = (Array.isArray(out.transactions) ? out.transactions : [])
      .filter(t => t && typeof t === 'object' && cardIds.has(t.cardId) && num(t.amount) > 0)
      .map(t => Object.assign({}, t, {
        id: t.id || this.uid(),
        type: t.type === 'payment' ? 'payment' : 'expense',
        amount: num(t.amount),
        description: String(t.description || ''),
        category: CONFIG.categories.some(c => c.id === t.category) ? t.category : 'diger',
        // Taksit yalnızca harcamada anlamlı; 1 = tek çekim
        installments: t.type === 'payment' ? 1 : Math.min(Math.max(parseInt(t.installments, 10) || 1, 1), 36),
        // Okunamayan tarih null bırakılır; UI "Tarihsiz" gösterir, hesaplar bu kaydı atlar
        date: safeDate(t.date) ? t.date : null
      }));

    // openingDebt eski yedeklerde yok: mevcut borçtan işlem etkilerini geri çıkararak türet
    out.cards.forEach(c => {
      if (typeof c.openingDebt === 'number' && isFinite(c.openingDebt)) return;
      const delta = out.transactions
        .filter(t => t.cardId === c.id)
        .reduce((s, t) => s + (t.type === 'expense' ? t.amount : -t.amount), 0);
      c.openingDebt = Math.round((c.currentDebt - delta) * 100) / 100;
    });

    return out;
  },

  load() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) { this.data = this.defaults(); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      this.data = this.normalize(parsed);
    } catch (e) {
      this.corrupt = true;
      this.data = this.defaults();
    }
  },

  save() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.data));
      AutoBackup.schedule(this.data);
      return true;
    } catch (e) {
      toast('Depolama alanı dolu veya erişilemiyor. Verileriniz kaydedilemedi — yedek almayı deneyin.', 'danger');
      return false;
    }
  },

  uid() {
    return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  },

  /** Bir işlemin borca etkisi: harcama artırır, ödeme azaltır. */
  txEffect(tx) {
    return tx.type === 'expense' ? tx.amount : -tx.amount;
  },

  /**
   * Kartın borcunu açılış borcundan ve işlemlerden yeniden hesaplar.
   * İşlem silme/düzenleme borcu geriye doğru etkilediği için tek doğru yol
   * artımlı güncelleme değil, baştan türetmedir.
   */
  recalcCard(card) {
    const delta = this.data.transactions
      .filter(t => t.cardId === card.id)
      .reduce((s, t) => s + this.txEffect(t), 0);
    const raw = num(card.openingDebt) + delta;
    card.currentDebt = Math.max(0, Math.round(raw * 100) / 100);
    return raw;
  },

  addCard(card) {
    card.id = this.uid();
    card.createdAt = new Date().toISOString();
    card.color = CONFIG.cardGradients[this.data.cards.length % CONFIG.cardGradients.length];
    // Kart eklenirken girilen mevcut borç, sonraki hesaplamaların başlangıç noktasıdır
    card.openingDebt = num(card.currentDebt);
    this.data.cards.push(card);
    return this.save();
  },

  updateCard(id, patch) {
    const c = this.data.cards.find(x => x.id === id);
    if (!c) return false;
    Object.assign(c, patch);
    return this.save();
  },

  deleteCard(id) {
    this.data.cards = this.data.cards.filter(c => c.id !== id);
    this.data.transactions = this.data.transactions.filter(t => t.cardId !== id);
    return this.save();
  },

  addTransaction(tx) {
    const card = this.data.cards.find(c => c.id === tx.cardId);
    if (!card) return false;
    tx.id = this.uid();
    tx.createdAt = new Date().toISOString();
    this.data.transactions.push(tx);

    if (this.recalcCard(card) < 0) {
      toast('Ödeme tutarı borçtan büyüktü; borç ₺0 olarak güncellendi.', 'warn');
    }
    return this.save();
  },

  updateTransaction(id, patch) {
    const tx = this.data.transactions.find(t => t.id === id);
    if (!tx) return false;
    const oldCardId = tx.cardId;

    if (patch.cardId && !this.data.cards.find(c => c.id === patch.cardId)) return false;
    Object.assign(tx, patch);

    // Kart değiştiyse eski kartın borcu da yeniden hesaplanmalı
    if (oldCardId !== tx.cardId) {
      const old = this.data.cards.find(c => c.id === oldCardId);
      if (old) this.recalcCard(old);
    }
    const card = this.data.cards.find(c => c.id === tx.cardId);
    if (card) this.recalcCard(card);
    return this.save();
  },

  deleteTransaction(id) {
    const tx = this.data.transactions.find(t => t.id === id);
    if (!tx) return false;
    this.data.transactions = this.data.transactions.filter(t => t.id !== id);

    const card = this.data.cards.find(c => c.id === tx.cardId);
    if (card) this.recalcCard(card);
    return this.save();
  },

  reset() {
    this.data = this.defaults();
    return this.save();
  }
};
