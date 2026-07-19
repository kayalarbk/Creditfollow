import { CONFIG } from '../config.js';
import { toast } from '../ui/toast.js';

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

  load() {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) { this.data = this.defaults(); return; }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      this.data = Object.assign(this.defaults(), parsed);
      this.data.settings = Object.assign(this.defaults().settings, parsed.settings || {});
      if (!Array.isArray(this.data.cards)) this.data.cards = [];
      if (!Array.isArray(this.data.transactions)) this.data.transactions = [];
    } catch (e) {
      this.corrupt = true;
      this.data = this.defaults();
    }
  },

  save() {
    try {
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(this.data));
      return true;
    } catch (e) {
      toast('Depolama alanı dolu veya erişilemiyor. Verileriniz kaydedilemedi — yedek almayı deneyin.', 'danger');
      return false;
    }
  },

  uid() {
    return crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  },

  addCard(card) {
    card.id = this.uid();
    card.createdAt = new Date().toISOString();
    card.color = CONFIG.cardGradients[this.data.cards.length % CONFIG.cardGradients.length];
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

    if (tx.type === 'expense') {
      card.currentDebt += tx.amount;
    } else {
      card.currentDebt -= tx.amount;
      if (card.currentDebt < 0) {
        card.currentDebt = 0;
        toast('Ödeme tutarı borçtan büyüktü; borç ₺0 olarak güncellendi.', 'warn');
      }
    }
    card.currentDebt = Math.round(card.currentDebt * 100) / 100;
    return this.save();
  },

  reset() {
    this.data = this.defaults();
    return this.save();
  }
};
