import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtTL0, fmtDate, fmtDateShort, dateSort } from '../../utils/format.js';
import { openModal, closeModal, modalHeader } from '../modal.js';
import { buildTxRow } from '../tx-row.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';
import { newTransactionModal } from './new-transaction.js';

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
    summary.append(
      stat('Güncel borç', fmtTL.format(card.currentDebt)),
      stat('Limit', fmtTL0.format(card.limit)),
      stat('Asgari ödeme', fmtTL.format(Calc.minPayment(card))),
      stat('Son ödeme', fmtDate.format(Calc.nextOccurrence(card.dueDay)))
    );
    body.appendChild(summary);

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
    const actions = el('div', 'grid grid-cols-2 gap-3 pt-2');
    const addTx = el('button', 'h-11 rounded-xl bg-accent hover:bg-blue-600 text-white font-semibold text-sm transition-colors', 'İşlem ekle');
    addTx.addEventListener('click', () => { closeModal(); newTransactionModal(cardId); });

    const del = el('button', 'h-11 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger font-semibold text-sm transition-colors', 'Kartı sil');
    del.addEventListener('click', () => {
      if (!confirm(card.bankName + ' kartı ve tüm işlemleri silinecek. Emin misiniz?')) return;
      Store.deleteCard(cardId);
      closeModal();
      renderAll();
      toast('Kart silindi.', 'warn');
    });

    actions.append(addTx, del);
    body.appendChild(actions);
    box.appendChild(body);
  });
}
