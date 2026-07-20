import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtTL0, fmtDate, fmtDateShort, dateSort } from '../../utils/format.js';
import { openModal, closeModal, modalHeader } from '../modal.js';
import { buildTxRow } from '../tx-row.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';
import { newTransactionModal } from './new-transaction.js';
import { newCardModal } from './new-card.js';
import { reconcileDebtModal } from './reconcile-debt.js';

export function cardDetailModal(cardId) {
  const card = Store.data.cards.find(c => c.id === cardId);
  if (!card) return;

  openModal(box => {
    modalHeader(box, card.bankName, card.cardLabel || 'Kart detayı');
    const body = el('div', 'px-6 pb-6 space-y-4');

    /* Özet ızgarası */
    const summary = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 grid grid-cols-2 gap-3 text-sm');
    const stat = (l, v) => {
      const d = el('div');
      d.append(el('p', 'text-xs text-gray-500 dark:text-gray-400', l), el('p', 'font-bold num', v));
      return d;
    };
    const st = Calc.statementSummary(card);
    summary.append(
      stat('Güncel borç', fmtTL.format(card.currentDebt)),
      stat('Limit', fmtTL0.format(card.limit)),
      stat('Kalan asgari', st.hasStatement ? fmtTL.format(st.remainingMin) : '—'),
      stat('Son ödeme', st.hasStatement
        ? fmtDate.format(st.dueDate)
        : fmtDate.format(Calc.nextOccurrence(card.dueDay)))
    );
    body.appendChild(summary);

    /* Kesilmiş ekstre: asgari bu tutar üzerinden sabitlenir, ödendikçe azalır */
    const stBox = el('div', 'rounded-xl p-4 space-y-2 ' + (
      !st.hasStatement ? 'bg-black/[.03] dark:bg-white/5'
        : st.isMinPaid ? 'border border-ok/30 bg-ok/[.07]'
        : 'border border-warn/30 bg-warn/[.07]'
    ));
    const stRow = (label, value, cls) => {
      const r = el('div', 'flex items-center justify-between text-sm gap-3');
      r.append(el('span', 'text-gray-600 dark:text-gray-300', label),
        el('span', 'font-semibold num text-right ' + (cls || ''), value));
      return r;
    };

    stBox.appendChild(el('p', 'text-xs font-semibold uppercase tracking-wider ' + (
      !st.hasStatement ? 'text-gray-500 dark:text-gray-400'
        : st.isMinPaid ? 'text-ok' : 'text-yellow-700 dark:text-warn'
    ), 'Kesilmiş ekstre'));

    if (!st.hasStatement) {
      stBox.appendChild(el('p', 'text-sm text-gray-500 dark:text-gray-400',
        'Bu kartın ödenmesi gereken kesilmiş ekstresi yok. Bir sonraki kesim: ' +
        fmtDate.format(Calc.nextOccurrence(card.statementDay)) + '.'));
    } else {
      stBox.append(
        el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
          fmtDateShort.format(st.cutoff) + ' kesimi · son ödeme ' + fmtDate.format(st.dueDate)),
        stRow('Ekstre borcu', fmtTL.format(st.balance)),
        stRow('Asgari ödeme (%' + Math.round(card.minPaymentRate * 100) + ')', fmtTL.format(st.minPayment)),
        stRow('Kesimden beri ödenen', fmtTL.format(st.paidSince), 'text-ok')
      );

      // Taksitliler yüzünden güncel borç ekstre borcundan büyük olabilir
      if (card.currentDebt - st.remainingAll > 0.5) {
        stBox.appendChild(el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
          'Güncel borcun ' + fmtTL.format(card.currentDebt - st.remainingAll) +
          '’lik kısmı henüz ekstreye yansımadı (kesim sonrası harcamalar ve gelecek taksitler).'));
      }

      if (st.isFullPaid) {
        stBox.appendChild(el('p', 'text-sm font-bold text-ok', '✓ Ekstre borcunun tamamı ödendi.'));
      } else if (st.isMinPaid) {
        stBox.append(
          el('p', 'text-sm font-bold text-ok', '✓ Asgari ödeme karşılandı.'),
          el('p', 'text-xs text-gray-500 dark:text-gray-400',
            'Kalan ' + fmtTL.format(st.remainingAll) + ' için faiz işleyebilir.')
        );
      } else {
        stBox.appendChild(stRow('Kalan asgari', fmtTL.format(st.remainingMin), 'text-danger font-bold'));
      }
    }
    body.appendChild(stBox);

    /* Bu ekstre dönemi */
    const period = Calc.periodActivity(card);
    const periodBox = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 space-y-2');
    periodBox.append(
      el('p', 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', 'Bu ekstre dönemi'),
      el('p', 'text-[11px] text-gray-400 dark:text-gray-500',
        fmtDateShort.format(period.start) + ' – ' + fmtDateShort.format(period.end) + ' (kesim gününde ekstreye yansır)')
    );
    const periodRow = (label, value, cls) => {
      const r = el('div', 'flex items-center justify-between text-sm');
      r.append(el('span', 'text-gray-600 dark:text-gray-300', label),
        el('span', 'font-semibold num ' + (cls || ''), value));
      return r;
    };
    periodBox.append(
      periodRow('Dönem harcaması', fmtTL.format(period.spent), 'text-danger'),
      periodRow('Dönem ödemesi', fmtTL.format(period.paid), 'text-ok')
    );

    const inst = Calc.installmentLoad(card);
    if (inst.activePlans > 0) {
      periodBox.append(
        el('div', 'border-t border-black/5 dark:border-white/10 pt-2 mt-1'),
        periodRow('Aylık taksit yükü', fmtTL.format(inst.monthly)),
        periodRow('Kalan taksit borcu', fmtTL.format(inst.remaining)),
        el('p', 'text-[11px] text-gray-400 dark:text-gray-500',
          inst.activePlans + ' devam eden taksitli harcama')
      );
    }
    body.appendChild(periodBox);

    /* Sadece asgari ödenirse ne olur */
    const proj = Calc.payoffProjection(card);
    if (proj) {
      const projBox = el('div', 'rounded-xl border border-warn/30 bg-warn/[.07] p-4 space-y-1.5');
      projBox.appendChild(el('p', 'text-xs font-semibold text-yellow-700 dark:text-warn uppercase tracking-wider',
        'Yalnızca asgari ödersen'));

      if (proj.neverEnds) {
        projBox.appendChild(el('p', 'text-sm font-medium',
          'Bu borç asgari ödemeyle hiç kapanmaz — aylık faiz, asgari ödemeden büyük. Borcunuz her ay büyür.'));
      } else {
        const years = Math.floor(proj.months / 12);
        const rest = proj.months % 12;
        const sure = years > 0
          ? years + ' yıl' + (rest > 0 ? ' ' + rest + ' ay' : '')
          : proj.months + ' ay';

        projBox.append(
          el('p', 'text-sm', 'Borcun kapanması: ' + (proj.capped ? '30 yıldan uzun' : sure)),
          el('p', 'text-sm', 'Ödenecek toplam faiz: ' + fmtTL.format(proj.totalInterest)),
          el('p', 'text-sm font-semibold', 'Toplamda ödersin: ' + fmtTL.format(proj.totalPaid))
        );
      }
      projBox.appendChild(el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
        'Aylık %' + String(Math.round(card.interestRate * 10000) / 100).replace('.', ',') +
        ' faiz ve yeni harcama yapılmadığı varsayımıyla. Bilgi amaçlıdır, yatırım veya finans tavsiyesi değildir.'));
      body.appendChild(projBox);
    }

    /* Bu karta ait son işlemler */
    const txs = Store.data.transactions
      .filter(x => x.cardId === cardId)
      .sort((a, b) => dateSort(b.date) - dateSort(a.date))
      .slice(0, 6);

    if (txs.length) {
      body.appendChild(el('p', 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', 'Son işlemler'));
      const list = el('div', '-mx-2');
      // Düzenleme/silme sonrası modal yeniden açılır ki özet ve liste güncel kalsın
      txs.forEach(tx => list.appendChild(buildTxRow(tx, { onChange: () => cardDetailModal(cardId) })));
      body.appendChild(list);
    }

    /* Aksiyonlar */
    const secondary = 'h-11 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 font-semibold text-sm transition-colors';

    const addTx = el('button', 'h-11 rounded-xl bg-accent hover:bg-blue-600 text-white font-semibold text-sm transition-colors', 'İşlem ekle');
    addTx.addEventListener('click', () => { closeModal(); newTransactionModal(cardId); });

    const edit = el('button', secondary, 'Kartı düzenle');
    edit.addEventListener('click', () => { closeModal(); newCardModal(cardId); });

    const reconcile = el('button', secondary, 'Borcu düzelt');
    reconcile.addEventListener('click', () => { closeModal(); reconcileDebtModal(cardId); });

    const del = el('button', 'h-11 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger font-semibold text-sm transition-colors', 'Kartı sil');
    del.addEventListener('click', () => {
      const txCount = Store.data.transactions.filter(t => t.cardId === cardId).length;
      if (!confirm(card.bankName + ' kartı ve ' + txCount + ' işlemi silinecek. Emin misiniz?')) return;

      const snap = Store.snapshot();
      Store.deleteCard(cardId);
      closeModal();
      renderAll();

      toast(card.bankName + ' kartı silindi.', 'warn', {
        duration: 8000,
        action: {
          label: 'Geri al',
          onClick: () => { Store.restore(snap); renderAll(); toast('Kart ve işlemleri geri getirildi.'); }
        }
      });
    });

    const actions = el('div', 'grid grid-cols-2 gap-3 pt-2');
    actions.append(addTx, edit, reconcile, del);
    body.appendChild(actions);
    box.appendChild(body);
  });
}
