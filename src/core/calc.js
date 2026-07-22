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

  /** Tarihe ay ekler; ayın gün sayısını aşan günler son güne sabitlenir (31 Ocak + 1 ay = 28/29 Şubat). */
  addMonths(date, months) {
    // Önce ayın 1'ine gidilir; doğrudan gün eklenirse 31 Ocak + 1 ay 3 Mart'a taşar
    const base = new Date(date.getFullYear(), date.getMonth() + months, 1);
    const y = base.getFullYear(), m = base.getMonth();
    return new Date(y, m, this.clampDay(y, m, date.getDate()));
  },

  /** Verilen ay-günün bugünden önceki en son gerçekleşme tarihi. */
  lastOccurrence(dayOfMonth, from = this.today()) {
    const y = from.getFullYear(), m = from.getMonth();
    let d = new Date(y, m, this.clampDay(y, m, dayOfMonth));
    if (d > from) {
      const pm = m - 1 < 0 ? 11 : m - 1;
      const py = m - 1 < 0 ? y - 1 : y;
      d = new Date(py, pm, this.clampDay(py, pm, dayOfMonth));
    }
    return d;
  },

  /**
   * Gecikmiş ödeme bilgisi.
   * nextOccurrence her zaman ileri bir tarih döndürdüğü için gecikme ondan anlaşılamaz;
   * son ödeme günü geçmiş ve o günden bu yana hiç ödeme yapılmamışsa gecikme sayılır.
   * Dönüş: null (gecikme yok) | { due, days }
   */
  overdueInfo(card) {
    if (card.currentDebt <= 0) return null;

    const st = this.statementSummary(card);
    const today = this.today();

    // Ekstre yoksa ya da asgari karşılandıysa gecikme yoktur
    if (!st.hasStatement || st.isMinPaid) return null;
    if (st.dueDate >= today) return null; // son ödeme günü henüz gelmedi/bugün

    return {
      due: st.dueDate,
      days: Math.round((today - st.dueDate) / 86400000),
      amount: st.remainingMin
    };
  },

  /**
   * Verilen ay kaymasındaki (0 = bu ay, -1 = geçen ay) takvim ayının harcama toplamı.
   * toDay verilirse yalnızca ayın ilk toDay günü sayılır — ay ortasında
   * geçen ayla adil karşılaştırma için. Mutabakat düzeltmeleri harcama değildir.
   */
  monthlySpend(offset = 0, toDay = null) {
    const now = this.today();
    const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);

    return Store.data.transactions.reduce((sum, t) => {
      if (t.type !== 'expense' || t.isAdjustment) return sum;
      const d = safeDate(t.date);
      if (!d || d < start || d >= end) return sum;
      if (toDay !== null && d.getDate() > toDay) return sum;
      return sum + t.amount;
    }, 0);
  },

  /**
   * Bir harcamanın verilen kesim tarihine kadar ekstreye yansımış tutarı.
   *
   * Taksitli harcamada limitin tamamı anında bloke olur (güncel borç),
   * ancak ekstreye her dönem yalnızca bir taksit yansır. İlk taksit,
   * harcamadan sonraki ilk kesimde ekstreye girer.
   */
  billedAmount(tx, card, cutoff) {
    const n = tx.installments || 1;
    if (n <= 1) return tx.amount;

    const d = safeDate(tx.date);
    if (!d) return 0;

    const firstBilling = this.nextOccurrence(card.statementDay, d);
    const monthsBilled =
      (cutoff.getFullYear() - firstBilling.getFullYear()) * 12 +
      (cutoff.getMonth() - firstBilling.getMonth()) + 1;

    const billed = Math.min(Math.max(monthsBilled, 0), n);
    return Math.round((tx.amount / n) * billed * 100) / 100;
  },

  /**
   * Kesilmiş son ekstrenin özeti.
   *
   * Asgari ödeme, kartın anlık borcunun değil ekstre kesiminde donmuş
   * dönem borcunun yüzdesidir: kesimden sonra yapılan harcamalar bu ayın
   * asgarisini artırmaz, yapılan ödemeler ise kalan asgariyi azaltır.
   *
   * Dönüş:
   *   hasStatement  — kesilmiş ve tutarı olan bir ekstre var mı
   *   cutoff        — son hesap kesim tarihi
   *   dueDate       — bu ekstrenin son ödeme tarihi
   *   balance       — ekstre borcu (kesim anındaki bakiye)
   *   minPayment    — ekstre borcunun asgarisi
   *   paidSince     — kesimden sonra yapılan ödemeler toplamı
   *   remainingMin  — kalan asgari (0 ise asgari karşılanmış)
   *   remainingAll  — ekstre borcunun ödenmemiş kısmı
   *   isMinPaid     — asgari karşılandı mı
   *   isFullPaid    — ekstrenin tamamı ödendi mi
   *   preCard       — dönem, kart panele eklenmeden önce kapandığı için atlandı
   */
  statementSummary(card) {
    const cutoff = this.lastOccurrence(card.statementDay);
    const endOfCutoff = new Date(cutoff);
    endOfCutoff.setHours(23, 59, 59, 999);

    let balance = card.openingDebt || 0;
    let paidSince = 0;

    Store.data.transactions.forEach(t => {
      if (t.cardId !== card.id) return;
      const d = safeDate(t.date);
      if (!d) return;
      if (d <= endOfCutoff) {
        // Taksitli harcamanın yalnızca ekstreye yansımış taksitleri borca girer
        balance += t.type === 'expense' ? this.billedAmount(t, card, cutoff) : -t.amount;
      } else if (t.type === 'payment') {
        paidSince += t.amount;
      }
    });

    const round = v => Math.round(v * 100) / 100;
    balance = round(Math.max(balance, 0));
    paidSince = round(paidSince);

    const minPayment = round(balance * card.minPaymentRate);
    const remainingMin = round(Math.max(minPayment - paidSince, 0));
    const remainingAll = round(Math.max(balance - paidSince, 0));

    // Son ödeme tarihi, kesimden sonraki ilk ödeme günüdür
    const dueDate = this.nextOccurrence(card.dueDay, cutoff);

    /*
     * Geçmişe dönük borçla eklenen kart: son ödeme günü kart sisteme
     * girilmeden önce geçmişse o ekstre kullanıcı için "kaçırılmış" değildir,
     * girilen borç zaten devreden bakiyedir. Bu ekstre için uyarı üretilmez,
     * bir sonraki dönem beklenir.
     */
    if (this.isPreCardStatement(card, dueDate)) {
      return {
        hasStatement: false,
        cutoff,
        dueDate: this.nextOccurrence(card.dueDay),
        balance, paidSince,
        // Ödenecek bir ekstre olmadığı için asgari yükümlülük de yoktur
        minPayment: 0, remainingMin: 0, remainingAll: 0,
        isMinPaid: false,
        isFullPaid: false,
        preCard: true
      };
    }

    return {
      hasStatement: balance > 0,
      cutoff, dueDate, balance, minPayment, paidSince,
      remainingMin, remainingAll,
      isMinPaid: balance > 0 && remainingMin <= 0,
      isFullPaid: balance > 0 && remainingAll <= 0
    };
  },

  /**
   * Verilen son ödeme tarihi, kartın panele eklendiği günden önce mi?
   * Kart eklenmeden kapanmış bir dönem için gecikme/uyarı üretilmemelidir.
   */
  isPreCardStatement(card, dueDate) {
    const created = safeDate(card.createdAt);
    if (!created) return false;
    const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    return dueDate < createdDay;
  },

  /**
   * Ödenmesi gereken kalan asgari tutar.
   * Ekstre kesilmemişse veya asgari zaten ödenmişse 0 döner.
   */
  minPayment(card) {
    return this.statementSummary(card).remainingMin;
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

  /**
   * Bir ihtiyaç kredisinin durumu.
   *
   * Kalan borç, kalan taksitlerin toplamıdır: kredi faizi taksite zaten gömülü
   * olduğu için anaparadan ayrı bir faiz projeksiyonu yapılmaz.
   *
   * Dönüş:
   *   remainingCount — ödenmemiş taksit sayısı
   *   remainingDebt  — kalan taksitlerin toplamı
   *   totalPayback   — kredinin toplam geri ödemesi
   *   totalInterest  — toplam geri ödeme − çekilen tutar
   *   nextDue        — sıradan taksitin tarihi (bitmişse null)
   *   lastDue        — son taksitin tarihi
   *   overdueDays    — sıradaki taksitin gecikme günü (yoksa 0)
   *   progress       — ödenen taksit oranı
   */
  loanSummary(loan) {
    const first = safeDate(loan.firstPaymentDate) || this.today();
    const remainingCount = Math.max(loan.totalInstallments - loan.paidInstallments, 0);
    const totalPayback = loan.monthlyPayment * loan.totalInstallments;

    const nextDue = remainingCount > 0 ? this.addMonths(first, loan.paidInstallments) : null;
    const overdueDays = nextDue && nextDue < this.today()
      ? Math.round((this.today() - nextDue) / 86400000)
      : 0;

    return {
      remainingCount,
      remainingDebt: Math.round(loan.monthlyPayment * remainingCount * 100) / 100,
      totalPayback: Math.round(totalPayback * 100) / 100,
      totalInterest: Math.round(Math.max(totalPayback - loan.principal, 0) * 100) / 100,
      nextDue,
      lastDue: this.addMonths(first, loan.totalInstallments - 1),
      overdueDays,
      isFinished: remainingCount === 0,
      progress: loan.totalInstallments > 0 ? loan.paidInstallments / loan.totalInstallments : 0
    };
  },

  /** Avans hesabın limit kullanım oranı. */
  overdraftUsage(od) {
    return od.limit > 0 ? od.currentDebt / od.limit : 0;
  },

  /**
   * Banka bazında gruplanmış ürünler (borcu büyük banka üstte).
   * Panel bu listeyi doğrudan çizer; ürünü olmayan bankalar gösterilmez.
   */
  bankGroups() {
    return Store.data.banks
      .map(bank => {
        const cards = Store.data.cards.filter(c => c.bankId === bank.id);
        const overdrafts = Store.data.overdrafts.filter(o => o.bankId === bank.id);
        const loans = Store.data.loans.filter(l => l.bankId === bank.id);

        const cardDebt = cards.reduce((s, c) => s + c.currentDebt, 0);
        const odDebt = overdrafts.reduce((s, o) => s + o.currentDebt, 0);
        const loanDebt = loans.reduce((s, l) => s + this.loanSummary(l).remainingDebt, 0);
        const limit = cards.reduce((s, c) => s + c.limit, 0) + overdrafts.reduce((s, o) => s + o.limit, 0);
        const revolvingDebt = cardDebt + odDebt;

        return {
          bank, cards, overdrafts, loans,
          count: cards.length + overdrafts.length + loans.length,
          cardDebt, odDebt,
          loanDebt: Math.round(loanDebt * 100) / 100,
          debt: Math.round((revolvingDebt + loanDebt) * 100) / 100,
          limit,
          available: Math.max(limit - revolvingDebt, 0),
          usage: limit > 0 ? revolvingDebt / limit : 0
        };
      })
      .filter(g => g.count > 0)
      .sort((a, b) => b.debt - a.debt);
  },

  /** Kredilerin toplam kalan borcu ve aylık taksit yükü. */
  loanTotals() {
    let remainingDebt = 0, monthly = 0, active = 0;
    Store.data.loans.forEach(l => {
      const s = this.loanSummary(l);
      if (s.isFinished) return;
      remainingDebt += s.remainingDebt;
      monthly += l.monthlyPayment;
      active += 1;
    });
    return {
      remainingDebt: Math.round(remainingDebt * 100) / 100,
      monthly: Math.round(monthly * 100) / 100,
      active
    };
  },

  totals() {
    const cards = Store.data.cards;
    const overdrafts = Store.data.overdrafts;

    const cardLimit = cards.reduce((s, c) => s + c.limit, 0);
    const cardDebt = cards.reduce((s, c) => s + c.currentDebt, 0);
    const odLimit = overdrafts.reduce((s, o) => s + o.limit, 0);
    const odDebt = overdrafts.reduce((s, o) => s + o.currentDebt, 0);

    // Limit kullanımı yalnızca rotatif ürünler içindir; kredinin limiti yoktur
    const limit = cardLimit + odLimit;
    const debt = cardDebt + odDebt;
    const loans = this.loanTotals();

    // Yalnızca ekstresi kesilmiş ve asgarisi henüz karşılanmamış kartlar
    let minPay = 0, minPayCards = 0;
    cards.forEach(c => {
      const remaining = this.statementSummary(c).remainingMin;
      if (remaining > 0) { minPay += remaining; minPayCards += 1; }
    });

    return {
      limit, debt, cardLimit, cardDebt, odLimit, odDebt,
      loanDebt: loans.remainingDebt,
      loanMonthly: loans.monthly,
      totalDebt: Math.round((debt + loans.remainingDebt) * 100) / 100,
      available: Math.max(limit - debt, 0),
      minPay: Math.round(minPay * 100) / 100,
      minPayCards,
      usage: limit > 0 ? debt / limit : 0
    };
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
      // Düzeltme kayıtları gerçek harcama değildir, dağılımı çarpıtmasın
      if (t.type !== 'expense' || t.isAdjustment) return;
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

  /** Ürün bazlı borç dağılımı: kartlar, avans hesaplar ve krediler (büyükten küçüğe). */
  cardBreakdown() {
    const items = [
      ...Store.data.cards
        .filter(c => c.currentDebt > 0)
        .map(c => ({
          id: c.id, kind: 'card',
          label: c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''),
          amount: c.currentDebt,
          color: c.color[1]
        })),
      ...Store.data.overdrafts
        .filter(o => o.currentDebt > 0)
        .map(o => ({
          id: o.id, kind: 'overdraft',
          label: o.bankName + ' — ' + o.label,
          amount: o.currentDebt,
          color: o.color[1]
        })),
      ...Store.data.loans
        .map(l => ({ loan: l, s: this.loanSummary(l) }))
        .filter(x => x.s.remainingDebt > 0)
        .map(x => ({
          id: x.loan.id, kind: 'loan',
          label: x.loan.bankName + ' — ' + x.loan.label,
          amount: x.s.remainingDebt,
          color: x.loan.color[1]
        }))
    ].sort((a, b) => b.amount - a.amount);

    const total = items.reduce((s, i) => s + i.amount, 0);
    items.forEach(i => { i.share = total > 0 ? i.amount / total : 0; });
    return { items, total: Math.round(total * 100) / 100 };
  },

  /**
   * Yalnızca asgari ödeme yapılırsa borcun kapanma projeksiyonu.
   * Her ay: faiz işler, ardından kalan borcun asgari oranı ödenir.
   * Asgari ödeme faizi karşılamıyorsa borç büyür; bu durum ayrıca bildirilir.
   */
  payoffProjection(card, maxMonths = 360) {
    const rate = card.interestRate;
    if (!rate || rate <= 0 || card.currentDebt <= 0) return null;

    let balance = card.currentDebt;
    let totalInterest = 0;
    let months = 0;

    while (balance > 0.5 && months < maxMonths) {
      const interest = balance * rate;
      const withInterest = balance + interest;
      const payment = withInterest * card.minPaymentRate;

      // Ödeme faizi karşılamıyorsa borç hiç kapanmaz
      if (payment <= interest + 0.005) {
        return { months: null, totalInterest: null, neverEnds: true, firstPayment: Math.round(payment * 100) / 100 };
      }

      totalInterest += interest;
      balance = withInterest - payment;
      months += 1;
    }

    return {
      months,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPaid: Math.round((card.currentDebt + totalInterest) * 100) / 100,
      neverEnds: false,
      capped: months >= maxMonths
    };
  },

  /**
   * Bildirim listesi: gecikmiş ödemeler ve eşik içinde yaklaşan son ödemeler.
   * Gecikmişler negatif gün değeriyle en üstte sıralanır.
   */
  notifications() {
    const threshold = Store.data.settings.notificationThresholdDays;

    const cardItems = Store.data.cards
      .map(c => {
        const st = this.statementSummary(c);
        // Ekstre kesilmediyse ya da asgari ödendiyse hatırlatılacak bir şey yok
        if (!st.hasStatement || st.isMinPaid) return null;

        const overdue = this.overdueInfo(c);
        const days = overdue ? -overdue.days : this.daysUntil(st.dueDate);
        return {
          kind: 'card',
          id: c.id,
          card: c,
          title: c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''),
          amount: st.remainingMin,
          totalDebt: c.currentDebt,
          due: overdue ? overdue.due : st.dueDate,
          days,
          overdue: !!overdue,
          // Rozet yalnızca acil olanları sayar; kesilmiş ekstreler listede yine görünür
          urgent: !!overdue || days <= threshold
        };
      })
      .filter(Boolean);

    /* Krediler: sıradaki taksit eşiğe girdiyse ya da geciktiyse hatırlatılır */
    const loanItems = Store.data.loans
      .map(l => {
        const s = this.loanSummary(l);
        if (s.isFinished || !s.nextDue) return null;

        const days = s.overdueDays > 0 ? -s.overdueDays : this.daysUntil(s.nextDue);
        if (days > threshold) return null;
        return {
          kind: 'loan',
          id: l.id,
          loan: l,
          title: l.bankName + ' — ' + l.label,
          amount: l.monthlyPayment,
          totalDebt: s.remainingDebt,
          due: s.nextDue,
          days,
          overdue: s.overdueDays > 0,
          urgent: true
        };
      })
      .filter(Boolean);

    return [...cardItems, ...loanItems].sort((a, b) => a.days - b.days);
  },

  /**
   * Yaklaşan ödemeler: ekstresi kesilmiş ve asgarisi ödenmemiş kartlar
   * ile taksit tarihi yaklaşan krediler.
   */
  upcomingPayments(withinDays = 7) {
    const cards = Store.data.cards.map(c => {
      const st = this.statementSummary(c);
      if (!st.hasStatement || st.isMinPaid) return null;
      return {
        kind: 'card', card: c,
        title: c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''),
        due: st.dueDate, days: this.daysUntil(st.dueDate), amount: st.remainingMin, statement: st
      };
    });

    const loans = Store.data.loans.map(l => {
      const s = this.loanSummary(l);
      if (s.isFinished || !s.nextDue) return null;
      return {
        kind: 'loan', loan: l,
        title: l.bankName + ' — ' + l.label,
        due: s.nextDue, days: this.daysUntil(s.nextDue), amount: l.monthlyPayment
      };
    });

    return [...cards, ...loans]
      .filter(n => n && n.days >= 0 && n.days <= withinDays)
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
    /*
     * Avans ve kredi borçlarının işlem geçmişi yoktur; günlük seyirleri türetilemez.
     * Grafik toplam borcu göstermeye devam etsin diye bugünkü tutarları sabit taban
     * olarak eklenir — eğri yalnızca kart hareketleriyle şekillenir.
     */
    const baseline = Store.data.overdrafts.reduce((s, o) => s + o.currentDebt, 0)
      + this.loanTotals().remainingDebt;
    const totalNow = Store.data.cards.reduce((s, c) => s + c.currentDebt, 0) + baseline;
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
