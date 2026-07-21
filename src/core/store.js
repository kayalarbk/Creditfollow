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
      banks: [],
      cards: [],
      overdrafts: [],
      loans: [],
      transactions: [],
      recurring: [],
      settings: {
        theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        currency: 'TRY',
        notificationThresholdDays: CONFIG.defaultThresholdDays,
        monthlyBudget: 0,
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
    // Aylık bütçe: 0 = kapalı; bozuk/negatif değerler kapalı sayılır
    out.settings.monthlyBudget = num(out.settings.monthlyBudget) > 0 ? num(out.settings.monthlyBudget) : 0;

    out.banks = (Array.isArray(out.banks) ? out.banks : [])
      .filter(b => b && typeof b === 'object' && String(b.name || '').trim())
      .map(b => ({
        id: b.id || this.uid(),
        name: String(b.name).trim(),
        createdAt: safeDate(b.createdAt) ? b.createdAt : new Date().toISOString()
      }));

    out.cards = (Array.isArray(out.cards) ? out.cards : [])
      .filter(c => c && typeof c === 'object')
      .map((c, i) => Object.assign({}, c, {
        id: c.id || this.uid(),
        bankName: String(c.bankName || 'Bilinmeyen banka'),
        limit: num(c.limit),
        currentDebt: num(c.currentDebt),
        statementDay: day(c.statementDay),
        dueDay: day(c.dueDay),
        minPaymentRate: num(c.minPaymentRate, CONFIG.minPaymentRates[0]),
        // Aylık akdi faiz oranı; 0 = faiz projeksiyonu gösterilmez
        interestRate: Math.min(Math.max(num(c.interestRate, CONFIG.defaultInterestRate), 0), 1),
        // Renk yoksa sıraya göre dağıt; hepsine aynı gradyanı vermek kartları ayırt edilemez kılar
        color: Array.isArray(c.color) && c.color.length === 2
          ? c.color
          : CONFIG.cardGradients[i % CONFIG.cardGradients.length],
        createdAt: safeDate(c.createdAt) ? c.createdAt : new Date().toISOString()
      }));

    /*
     * Banka artık ayrı bir varlık; eski yedeklerde yalnızca kart üstünde serbest metin olarak var.
     * Kart/avans/kredi tekil bir bankaya bağlanabilsin diye adı geçen her banka burada üretilir.
     */
    const bankByName = new Map(out.banks.map(b => [b.name.toLocaleLowerCase('tr-TR'), b]));
    const ensureBank = name => {
      const clean = String(name || '').trim() || 'Bilinmeyen banka';
      const key = clean.toLocaleLowerCase('tr-TR');
      let bank = bankByName.get(key);
      if (!bank) {
        bank = { id: this.uid(), name: clean, createdAt: new Date().toISOString() };
        out.banks.push(bank);
        bankByName.set(key, bank);
      }
      return bank;
    };
    const bankIds = new Set(out.banks.map(b => b.id));

    out.cards.forEach(c => {
      const bank = bankIds.has(c.bankId) ? out.banks.find(b => b.id === c.bankId) : ensureBank(c.bankName);
      c.bankId = bank.id;
      c.bankName = bank.name; // gösterim hep banka kaydından türer, kopya güncel tutulur
    });

    out.overdrafts = (Array.isArray(out.overdrafts) ? out.overdrafts : [])
      .filter(o => o && typeof o === 'object')
      .map((o, i) => {
        const bank = bankIds.has(o.bankId) ? out.banks.find(b => b.id === o.bankId) : ensureBank(o.bankName);
        return Object.assign({}, o, {
          id: o.id || this.uid(),
          bankId: bank.id,
          bankName: bank.name,
          label: String(o.label || 'Avans hesap'),
          limit: num(o.limit),
          currentDebt: Math.max(0, num(o.currentDebt)),
          interestRate: Math.min(Math.max(num(o.interestRate, CONFIG.defaultOverdraftRate), 0), 1),
          color: Array.isArray(o.color) && o.color.length === 2
            ? o.color
            : CONFIG.cardGradients[(i + 2) % CONFIG.cardGradients.length],
          createdAt: safeDate(o.createdAt) ? o.createdAt : new Date().toISOString()
        });
      });

    out.loans = (Array.isArray(out.loans) ? out.loans : [])
      .filter(l => l && typeof l === 'object')
      .map((l, i) => {
        const bank = bankIds.has(l.bankId) ? out.banks.find(b => b.id === l.bankId) : ensureBank(l.bankName);
        const total = Math.min(Math.max(parseInt(l.totalInstallments, 10) || 1, 1), 360);
        return Object.assign({}, l, {
          id: l.id || this.uid(),
          bankId: bank.id,
          bankName: bank.name,
          label: String(l.label || 'İhtiyaç kredisi'),
          principal: num(l.principal),
          monthlyPayment: num(l.monthlyPayment),
          totalInstallments: total,
          // Ödenen taksit toplamı aşamaz; aşarsa kalan borç negatife düşerdi
          paidInstallments: Math.min(Math.max(parseInt(l.paidInstallments, 10) || 0, 0), total),
          firstPaymentDate: safeDate(l.firstPaymentDate) ? l.firstPaymentDate : new Date().toISOString(),
          color: Array.isArray(l.color) && l.color.length === 2
            ? l.color
            : CONFIG.cardGradients[(i + 4) % CONFIG.cardGradients.length],
          createdAt: safeDate(l.createdAt) ? l.createdAt : new Date().toISOString()
        });
      });

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
        // Mutabakat sırasında üretilen düzeltme kaydı
        isAdjustment: t.isAdjustment === true,
        // Tekrarlayan şablondan otomatik oluşturulmuş kayıt
        isRecurring: t.isRecurring === true,
        // Okunamayan tarih null bırakılır; UI "Tarihsiz" gösterir, hesaplar bu kaydı atlar
        date: safeDate(t.date) ? t.date : null
      }));

    out.recurring = (Array.isArray(out.recurring) ? out.recurring : [])
      .filter(r => r && typeof r === 'object' && cardIds.has(r.cardId) && num(r.amount) > 0)
      .map(r => Object.assign({}, r, {
        id: r.id || this.uid(),
        amount: num(r.amount),
        description: String(r.description || ''),
        category: CONFIG.categories.some(c => c.id === r.category) ? r.category : 'diger',
        dayOfMonth: day(r.dayOfMonth),
        // Hangi aya kadar işlendiği: "YYYY-M" biçiminde, çift işlemeyi önler
        lastRunPeriod: typeof r.lastRunPeriod === 'string' ? r.lastRunPeriod : null,
        paused: r.paused === true
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

  /* ---------- bankalar ---------- */

  bank(id) {
    return this.data.banks.find(b => b.id === id) || null;
  },

  bankName(id) {
    const b = this.bank(id);
    return b ? b.name : 'Bilinmeyen banka';
  },

  /** Ada göre bankayı bulur, yoksa ekler. Aynı banka iki kez listelenmesin diye ad karşılaştırması harf duyarsızdır. */
  ensureBank(name) {
    const clean = String(name || '').trim();
    if (!clean) return null;
    const key = clean.toLocaleLowerCase('tr-TR');
    const found = this.data.banks.find(b => b.name.toLocaleLowerCase('tr-TR') === key);
    if (found) return found;

    const bank = { id: this.uid(), name: clean, createdAt: new Date().toISOString() };
    this.data.banks.push(bank);
    return bank;
  },

  /**
   * Ayarlardaki banka listesini verilen adlarla eşitler.
   * Ürünü olan bankalar listeden çıkarılamaz; çıkarılsaydı kart ve krediler sahipsiz kalırdı.
   * Dönüş: { removed, kept } — kept, ürünü olduğu için korunan banka adları.
   */
  syncBanks(names) {
    const wanted = new Map();
    names.forEach(n => {
      const clean = String(n || '').trim();
      if (clean) wanted.set(clean.toLocaleLowerCase('tr-TR'), clean);
    });

    const kept = [];
    this.data.banks = this.data.banks.filter(b => {
      if (wanted.has(b.name.toLocaleLowerCase('tr-TR'))) return true;
      if (this.bankProductCount(b.id) > 0) { kept.push(b.name); return true; }
      return false;
    });

    const existing = new Set(this.data.banks.map(b => b.name.toLocaleLowerCase('tr-TR')));
    wanted.forEach((name, key) => {
      if (!existing.has(key)) {
        this.data.banks.push({ id: this.uid(), name, createdAt: new Date().toISOString() });
      }
    });

    return { kept, saved: this.save() };
  },

  bankProductCount(bankId) {
    return this.data.cards.filter(c => c.bankId === bankId).length
      + this.data.overdrafts.filter(o => o.bankId === bankId).length
      + this.data.loans.filter(l => l.bankId === bankId).length;
  },

  renameBank(id, name) {
    const bank = this.bank(id);
    const clean = String(name || '').trim();
    if (!bank || !clean) return false;
    bank.name = clean;
    // bankName yalnızca gösterim kopyasıdır; banka adı değişince birlikte taşınır
    [this.data.cards, this.data.overdrafts, this.data.loans].forEach(list =>
      list.forEach(p => { if (p.bankId === id) p.bankName = clean; }));
    return this.save();
  },

  /* ---------- avans (kredili mevduat) hesapları ---------- */

  addOverdraft(od) {
    od.id = this.uid();
    od.createdAt = new Date().toISOString();
    od.bankName = this.bankName(od.bankId);
    od.color = CONFIG.cardGradients[(this.data.overdrafts.length + 2) % CONFIG.cardGradients.length];
    this.data.overdrafts.push(od);
    return this.save();
  },

  updateOverdraft(id, patch) {
    const o = this.data.overdrafts.find(x => x.id === id);
    if (!o) return false;
    Object.assign(o, patch);
    if (patch.bankId) o.bankName = this.bankName(patch.bankId);
    o.currentDebt = Math.max(0, num(o.currentDebt));
    return this.save();
  },

  deleteOverdraft(id) {
    this.data.overdrafts = this.data.overdrafts.filter(o => o.id !== id);
    return this.save();
  },

  /* ---------- ihtiyaç kredileri ---------- */

  addLoan(loan) {
    loan.id = this.uid();
    loan.createdAt = new Date().toISOString();
    loan.bankName = this.bankName(loan.bankId);
    loan.color = CONFIG.cardGradients[(this.data.loans.length + 4) % CONFIG.cardGradients.length];
    this.data.loans.push(loan);
    return this.save();
  },

  updateLoan(id, patch) {
    const l = this.data.loans.find(x => x.id === id);
    if (!l) return false;
    Object.assign(l, patch);
    if (patch.bankId) l.bankName = this.bankName(patch.bankId);
    l.paidInstallments = Math.min(Math.max(parseInt(l.paidInstallments, 10) || 0, 0), l.totalInstallments);
    return this.save();
  },

  /** Bir taksiti ödenmiş işaretler (delta -1 ile geri alınır). */
  payLoanInstallment(id, delta = 1) {
    const l = this.data.loans.find(x => x.id === id);
    if (!l) return false;
    const next = l.paidInstallments + delta;
    if (next < 0 || next > l.totalInstallments) return false;
    l.paidInstallments = next;
    return this.save();
  },

  deleteLoan(id) {
    this.data.loans = this.data.loans.filter(l => l.id !== id);
    return this.save();
  },

  addCard(card) {
    card.id = this.uid();
    card.createdAt = new Date().toISOString();
    card.bankName = this.bankName(card.bankId);
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
    if (patch.bankId) c.bankName = this.bankName(patch.bankId);
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

  /* ---------- tekrarlayan işlemler ---------- */

  addRecurring(rec) {
    rec.id = this.uid();
    rec.createdAt = new Date().toISOString();
    rec.lastRunPeriod = null;
    rec.paused = false;
    this.data.recurring.push(rec);
    return this.save();
  },

  updateRecurring(id, patch) {
    const r = this.data.recurring.find(x => x.id === id);
    if (!r) return false;
    Object.assign(r, patch);
    return this.save();
  },

  deleteRecurring(id) {
    this.data.recurring = this.data.recurring.filter(r => r.id !== id);
    return this.save();
  },

  /**
   * Vadesi gelmiş tekrarlayan işlemleri kaydeder ve oluşturulan sayıyı döner.
   * lastRunPeriod ay bazında tutulduğu için uygulama gün içinde kaç kez açılırsa
   * açılsın aynı ay için ikinci kez işlem üretilmez.
   */
  runRecurring(today = new Date()) {
    const y = today.getFullYear();
    const m = today.getMonth();
    const period = y + '-' + m;
    let created = 0;

    this.data.recurring.forEach(r => {
      if (r.paused || r.lastRunPeriod === period) return;

      const lastDay = new Date(y, m + 1, 0).getDate();
      const dueDay = Math.min(r.dayOfMonth, lastDay);
      if (today.getDate() < dueDay) return; // ayın günü henüz gelmedi

      const card = this.data.cards.find(c => c.id === r.cardId);
      if (!card) return;

      this.data.transactions.push({
        id: this.uid(),
        cardId: r.cardId,
        type: 'expense',
        amount: r.amount,
        category: r.category,
        installments: 1,
        isAdjustment: false,
        isRecurring: true,
        description: r.description,
        date: new Date(y, m, dueDay, 12).toISOString(),
        createdAt: new Date().toISOString()
      });
      r.lastRunPeriod = period;
      created += 1;
    });

    if (created > 0) {
      this.data.cards.forEach(c => this.recalcCard(c));
      this.save();
    }
    return created;
  },

  reset() {
    this.data = this.defaults();
    return this.save();
  },

  /**
   * Geri alınabilir bir anlık görüntü alır.
   * Veri kümesi tarayıcıda tutulacak kadar küçük olduğu için tam kopya en güvenli yol;
   * ters işlem üretmeye çalışmak yan etkileri (borç yeniden hesabı) kaçırabilir.
   */
  snapshot() {
    return JSON.parse(JSON.stringify({
      banks: this.data.banks,
      cards: this.data.cards,
      overdrafts: this.data.overdrafts,
      loans: this.data.loans,
      transactions: this.data.transactions,
      recurring: this.data.recurring
    }));
  },

  /** snapshot() ile alınan durumu geri yükler. */
  restore(snap) {
    if (!snap) return false;
    this.data.cards = snap.cards;
    this.data.transactions = snap.transactions;
    if (snap.banks) this.data.banks = snap.banks;
    if (snap.overdrafts) this.data.overdrafts = snap.overdrafts;
    if (snap.loans) this.data.loans = snap.loans;
    if (snap.recurring) this.data.recurring = snap.recurring;
    return this.save();
  }
};
