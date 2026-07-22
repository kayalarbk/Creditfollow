import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el, byId, clear } from '../../utils/dom.js';
import { fmtTL, fmtTL0, fmtDateShort, dateSort, bankIcon } from '../../utils/format.js';
import { buildTxRow } from '../tx-row.js';
import { cardDetailModal } from '../modals/card-detail.js';
import { overdraftDetailModal } from '../modals/overdraft-detail.js';
import { loanDetailModal } from '../modals/loan-detail.js';

/** Üstteki üç özet kutusu + kullanım rozeti. */
export function renderWidgets() {
  const t = Calc.totals();
  const up = Calc.upcomingPayments(7);

  const wUp = byId('wUpcoming');
  const wUpSub = byId('wUpcomingSub');
  if (up.length === 0) {
    wUp.textContent = 'Ödeme yok';
    wUpSub.textContent = 'Önümüzdeki 7 gün temiz 🎉';
  } else {
    // Yaklaşan yük, kartın tüm borcu değil ödenmesi gereken kalan asgaridir
    wUp.textContent = up.length + ' ödeme · ' + fmtTL0.format(up.reduce((s, n) => s + n.amount, 0));
    const first = up[0];
    wUpSub.textContent = 'En yakın: ' + first.title + ' — ' + (first.days === 0 ? 'bugün' : first.days + ' gün sonra');
  }

  // Kart asgarisi ve kredi taksitleri aynı ayda ödenecek nakit yükünü oluşturur
  byId('wMinPay').textContent = fmtTL.format(t.minPay + t.loanMonthly);
  const minParts = [];
  if (t.minPayCards > 0) minParts.push(t.minPayCards + ' kart asgarisi');
  if (t.loanMonthly > 0) minParts.push(fmtTL0.format(t.loanMonthly) + ' kredi taksiti');
  byId('wMinPaySub').textContent = minParts.length === 0 ? 'Ödenecek asgari yok' : minParts.join(' + ');

  const pct = Math.round(t.usage * 100);
  byId('wUsage').textContent = '%' + pct;
  const bar = byId('wUsageBar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.style.backgroundColor = Calc.usageColor(t.usage);

  const badge = byId('usageBadge');
  const col = Calc.usageColor(t.usage);
  badge.textContent = '%' + pct + ' kullanım';
  // Sarı zeminde okunabilirlik için koyu ton kullanılır
  badge.style.color = col === CONFIG.statusColors.warn ? '#8a6d00' : col;
  badge.style.backgroundColor = col + '22';

  renderMonthSummary();
}

/** "Bu ayki harcama" kartı: aylık toplam, geçen ayla karşılaştırma ve bütçe çubuğu. */
function renderMonthSummary() {
  const spent = Calc.monthlySpend(0);
  byId('monthSpent').textContent = fmtTL.format(spent);

  // Adil karşılaştırma: geçen ayın yalnızca bugüne kadarki günleri sayılır
  const prev = Calc.monthlySpend(-1, new Date().getDate());
  const cmp = byId('monthCompare');
  if (spent <= 0 && prev <= 0) cmp.textContent = 'Bu ay henüz harcama yok';
  else if (prev <= 0) cmp.textContent = 'Geçen ay bu tarihte harcama yoktu';
  else {
    const diff = Math.round(((spent - prev) / prev) * 100);
    cmp.textContent = diff === 0
      ? 'Geçen ayın bu tarihiyle aynı seviyede'
      : 'Geçen ayın bu tarihine göre %' + Math.abs(diff) + (diff > 0 ? ' fazla' : ' az');
  }

  const budget = Store.data.settings.monthlyBudget;
  const wrap = byId('budgetWrap');
  wrap.classList.toggle('hidden', !(budget > 0));
  if (!(budget > 0)) return;

  const ratio = spent / budget;
  byId('budgetLabel').textContent = fmtTL0.format(spent) + ' / ' + fmtTL0.format(budget);

  const bar = byId('budgetBar');
  bar.style.width = Math.min(Math.round(ratio * 100), 100) + '%';
  bar.style.backgroundColor = ratio >= 1 ? CONFIG.statusColors.danger
    : ratio >= 0.8 ? CONFIG.statusColors.warn
    : CONFIG.statusColors.ok;

  byId('budgetHint').textContent = ratio >= 1
    ? 'Bütçe ' + fmtTL0.format(spent - budget) + ' aşıldı.'
    : 'Kalan: ' + fmtTL0.format(budget - spent) + ' · %' + Math.round(ratio * 100) + ' kullanıldı';
}

/**
 * Banka bazında gruplanmış ürün listesi.
 * Aynı bankadaki kredi kartı, avans hesap ve krediler tek blokta toplanır;
 * kullanıcı borcunu kart kart değil banka banka görmek ister.
 */
export function renderCards() {
  const wrap = clear(byId('bankGroups'));
  const groups = Calc.bankGroups();

  const totalProducts = Store.data.cards.length + Store.data.overdrafts.length + Store.data.loans.length;
  byId('cardCount').textContent = groups.length + ' banka · ' + totalProducts + ' ürün';

  if (groups.length === 0) {
    wrap.appendChild(el('p', 'text-sm text-gray-400 dark:text-gray-500 py-6 text-center',
      'Henüz ürün eklenmedi. "+ Ekle" ile kredi kartı, avans hesap veya kredi ekleyin.'));
    return;
  }

  groups.forEach(g => wrap.appendChild(buildBankGroup(g)));
}

function buildBankGroup(g) {
  const section = el('section', 'fade-in rounded-xl2 bg-surface-light dark:bg-surface-dark shadow-card dark:shadow-cardDark overflow-hidden');

  /* Banka başlığı: toplam borç ve limit kullanımı */
  const head = el('div', 'flex items-center gap-3 px-4 sm:px-5 py-4 border-b border-black/5 dark:border-white/10');
  const ic = el('div', 'w-10 h-10 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0');
  ic.appendChild(el('i', 'fa-solid ' + bankIcon(g.bank.name)));

  const info = el('div', 'min-w-0 flex-1');
  const parts = [];
  if (g.cards.length) parts.push(g.cards.length + ' kart');
  if (g.overdrafts.length) parts.push(g.overdrafts.length + ' avans');
  if (g.loans.length) parts.push(g.loans.length + ' kredi');
  info.append(
    el('p', 'font-bold truncate', g.bank.name),
    el('p', 'text-xs text-gray-500 dark:text-gray-400 truncate', parts.join(' · '))
  );

  const amountBox = el('div', 'text-right shrink-0');
  amountBox.append(
    el('p', 'text-[11px] text-gray-500 dark:text-gray-400', 'Toplam borç'),
    el('p', 'text-lg font-extrabold num', fmtTL.format(g.debt))
  );
  head.append(ic, info, amountBox);

  /* Limit kullanımı yalnızca rotatif ürünü olan bankalarda anlamlıdır */
  if (g.limit > 0) {
    const track = el('div', 'h-1 bg-black/5 dark:bg-white/10');
    const fill = el('div', 'h-full');
    fill.style.width = Math.min(g.usage * 100, 100) + '%';
    fill.style.backgroundColor = Calc.usageColor(g.usage);
    track.appendChild(fill);
    section.append(head, track);
  } else {
    section.appendChild(head);
  }

  const grid = el('div', 'p-4 sm:p-5 grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5');
  g.cards.forEach(c => grid.appendChild(buildCard(c)));
  g.overdrafts.forEach(o => grid.appendChild(buildOverdraft(o)));
  g.loans.forEach(l => grid.appendChild(buildLoan(l)));
  section.appendChild(grid);

  return section;
}

/** Ürün kutularının ortak kabuğu: tıklanabilir, üstte renkli banka görseli. */
function productShell(product, typeLabel, onOpen, debtLabel, debtValue) {
  const wrap = el('article', 'rounded-xl2 bg-black/[.02] dark:bg-white/[.03] border border-black/5 dark:border-white/10 overflow-hidden hover:-translate-y-0.5 hover:shadow-pop transition-all duration-300 cursor-pointer');
  wrap.setAttribute('role', 'button');
  wrap.tabIndex = 0;
  wrap.addEventListener('click', onOpen);
  wrap.addEventListener('keydown', e => { if (e.key === 'Enter') onOpen(); });

  const top = el('div', 'bank-card p-4 text-white');
  top.style.setProperty('--bc1', product.color[0]);
  top.style.setProperty('--bc2', product.color[1]);

  const topRow = el('div', 'flex items-center justify-between mb-5');
  const nameBox = el('div', 'min-w-0');
  nameBox.append(
    el('p', 'font-bold truncate', product.label || product.cardLabel || typeLabel.label),
    el('p', 'text-xs text-white/70 truncate', typeLabel.label)
  );
  topRow.append(nameBox, el('i', 'fa-solid ' + typeLabel.icon + ' text-xl text-white/85'));
  top.append(
    topRow,
    el('p', 'text-[11px] uppercase tracking-wider text-white/60 font-medium', debtLabel),
    el('p', 'text-2xl font-extrabold num', fmtTL.format(debtValue))
  );

  const body = el('div', 'p-4 space-y-3');
  wrap.append(top, body);
  return { wrap, body };
}

/** İki sütunlu küçük istatistik kutusu. */
function statBox(label, val, extraCls) {
  const b = el('div', 'rounded-lg bg-black/[.03] dark:bg-white/5 px-2.5 py-2');
  b.append(
    el('p', 'text-gray-500 dark:text-gray-400 mb-0.5', label),
    el('p', 'font-semibold num ' + (extraCls || ''), val)
  );
  return b;
}

/** Avans (kredili mevduat) hesap kutusu. */
function buildOverdraft(od) {
  const type = CONFIG.productTypes.overdraft;
  const ratio = Calc.overdraftUsage(od);
  const { wrap, body } = productShell(od, type, () => overdraftDetailModal(od.id), 'Kullanılan', od.currentDebt);

  const barWrap = el('div');
  const barTop = el('div', 'flex justify-between text-xs mb-1.5');
  barTop.append(
    el('span', 'text-gray-500 dark:text-gray-400', 'Limit kullanımı'),
    el('span', 'font-semibold num', '%' + Math.round(ratio * 100))
  );
  const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
  const fill = el('div', 'progress-fill h-full rounded-full');
  fill.style.width = Math.min(ratio * 100, 100) + '%';
  fill.style.backgroundColor = Calc.usageColor(ratio);
  track.appendChild(fill);
  barWrap.append(barTop, track);

  const stats = el('div', 'grid grid-cols-2 gap-2 text-xs');
  stats.append(
    statBox('Limit', fmtTL0.format(od.limit)),
    statBox('Kullanılabilir', fmtTL0.format(Math.max(od.limit - od.currentDebt, 0)))
  );

  body.append(barWrap, stats);

  // Avans faizi kart faizinden yüksektir; aylık maliyeti görünür kılmak uyarı işlevi görür
  if (od.currentDebt > 0 && od.interestRate > 0) {
    const cost = el('div', 'flex items-center justify-between text-xs pt-1');
    cost.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Aylık faiz maliyeti'),
      el('span', 'font-semibold num text-danger', fmtTL.format(od.currentDebt * od.interestRate))
    );
    body.appendChild(cost);
  }
  return wrap;
}

/** İhtiyaç kredisi kutusu. */
function buildLoan(loan) {
  const type = CONFIG.productTypes.loan;
  const s = Calc.loanSummary(loan);
  const { wrap, body } = productShell(loan, type, () => loanDetailModal(loan.id), 'Kalan borç', s.remainingDebt);

  const barWrap = el('div');
  const barTop = el('div', 'flex justify-between text-xs mb-1.5');
  barTop.append(
    el('span', 'text-gray-500 dark:text-gray-400', 'Ödenen taksit'),
    el('span', 'font-semibold num', loan.paidInstallments + ' / ' + loan.totalInstallments)
  );
  const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
  const fill = el('div', 'progress-fill h-full rounded-full bg-accent');
  fill.style.width = Math.round(s.progress * 100) + '%';
  track.appendChild(fill);
  barWrap.append(barTop, track);

  const stats = el('div', 'grid grid-cols-2 gap-2 text-xs');
  stats.append(
    statBox('Aylık taksit', fmtTL0.format(loan.monthlyPayment)),
    statBox('Kalan taksit', s.remainingCount + ' adet'),
    statBox('Sonraki ödeme', s.nextDue ? fmtDateShort.format(s.nextDue) : '—',
      s.overdueDays > 0 ? 'text-danger' : ''),
    statBox('Son taksit', fmtDateShort.format(s.lastDue))
  );

  body.append(barWrap, stats);

  if (s.isFinished) {
    const done = el('div', 'flex items-center gap-2 rounded-lg bg-ok/10 text-ok px-2.5 py-2 text-xs font-semibold');
    done.append(el('i', 'fa-solid fa-circle-check'), el('span', '', 'Kredi kapandı'));
    body.appendChild(done);
  } else if (s.overdueDays > 0) {
    const warn = el('div', 'flex items-center gap-2 rounded-lg bg-danger/10 text-danger px-2.5 py-2 text-xs font-semibold');
    warn.append(
      el('i', 'fa-solid fa-triangle-exclamation'),
      el('span', '', s.overdueDays + ' gündür taksit işaretlenmedi')
    );
    body.appendChild(warn);
  }
  return wrap;
}

function buildCard(card) {
  const ratio = Calc.usage(card);
  const color = Calc.usageColor(ratio);
  const statement = Calc.nextOccurrence(card.statementDay);
  const due = Calc.nextOccurrence(card.dueDay);
  const late = Calc.overdueInfo(card);
  const soon = card.currentDebt > 0 && Calc.daysUntil(due) <= Store.data.settings.notificationThresholdDays;

  // Banka adı grubun başlığında zaten var; kutuda kartın kendi etiketi öne çıkar
  const { wrap, body } = productShell(
    { color: card.color, label: card.cardLabel },
    CONFIG.productTypes.card,
    () => cardDetailModal(card.id),
    'Güncel borç',
    card.currentDebt
  );

  const barWrap = el('div');
  const barTop = el('div', 'flex justify-between text-xs mb-1.5');
  barTop.append(
    el('span', 'text-gray-500 dark:text-gray-400', 'Limit kullanımı'),
    el('span', 'font-semibold num', '%' + Math.round(ratio * 100))
  );
  const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
  const fill = el('div', 'progress-fill h-full rounded-full');
  fill.style.width = Math.min(ratio * 100, 100) + '%';
  fill.style.backgroundColor = color;
  track.appendChild(fill);
  barWrap.append(barTop, track);

  const stats = el('div', 'grid grid-cols-2 gap-2 text-xs');
  stats.append(
    statBox('Limit', fmtTL0.format(card.limit)),
    statBox('Kullanılabilir', fmtTL0.format(Math.max(card.limit - card.currentDebt, 0))),
    statBox('Hesap kesim', fmtDateShort.format(statement)),
    statBox('Son ödeme', fmtDateShort.format(due), late || soon ? 'text-danger' : '')
  );

  if (late) {
    const warn = el('div', 'flex items-center gap-2 rounded-lg bg-danger/10 text-danger px-2.5 py-2 text-xs font-semibold');
    warn.append(
      el('i', 'fa-solid fa-triangle-exclamation'),
      el('span', '', late.days + ' gündür ödeme yapılmadı')
    );
    stats.appendChild(warn);
    warn.classList.add('col-span-2');
  }

  /* Asgari ödeme, ekstre kesilince sabitlenir; ödendikçe azalır */
  const st = Calc.statementSummary(card);
  const minRow = el('div', 'flex items-center justify-between text-xs pt-1 gap-2');

  if (!st.hasStatement) {
    minRow.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Asgari ödeme'),
      el('span', 'font-semibold text-gray-400 dark:text-gray-500',
        st.preCard ? 'Sonraki dönem bekleniyor' : 'Ekstre kesilmedi')
    );
  } else if (st.isFullPaid) {
    minRow.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Ekstre borcu'),
      el('span', 'font-bold text-ok', '✓ Tamamı ödendi')
    );
  } else if (st.isMinPaid) {
    minRow.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Asgari ödeme'),
      el('span', 'font-bold text-ok', '✓ Ödendi')
    );
  } else {
    minRow.append(
      el('span', 'text-gray-500 dark:text-gray-400',
        'Kalan asgari (%' + Math.round(card.minPaymentRate * 100) + ')'),
      el('span', 'font-bold num', fmtTL.format(st.remainingMin))
    );
  }

  body.append(barWrap, stats, minRow);

  /* Bu dönem harcaması ve varsa aylık taksit yükü */
  const period = Calc.periodActivity(card);
  const inst = Calc.installmentLoad(card);
  if (period.spent > 0 || inst.activePlans > 0) {
    const extra = el('div', 'flex items-center justify-between text-xs pt-1 border-t border-black/5 dark:border-white/5 mt-1');
    extra.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Bu dönem harcaması'),
      el('span', 'font-semibold num', fmtTL.format(period.spent))
    );
    body.appendChild(extra);

    if (inst.activePlans > 0) {
      const instRow = el('div', 'flex items-center justify-between text-xs');
      instRow.append(
        el('span', 'text-gray-500 dark:text-gray-400',
          'Aylık taksit (' + inst.activePlans + ' plan)'),
        el('span', 'font-semibold num', fmtTL.format(inst.monthly))
      );
      body.appendChild(instRow);
    }
  }
  return wrap;
}

/** Son 8 işlem listesi. */
export function renderTransactions() {
  const list = clear(byId('txList'));
  const txs = [...Store.data.transactions].sort((a, b) => dateSort(b.date) - dateSort(a.date)).slice(0, 8);

  if (txs.length === 0) {
    list.appendChild(el('p', 'px-5 py-8 text-sm text-gray-400 dark:text-gray-500 text-center',
      'Henüz işlem yok. "+ Ekle" ile ilk harcama veya ödemenizi kaydedin.'));
    return;
  }

  txs.forEach(tx => list.appendChild(buildTxRow(tx)));
}
