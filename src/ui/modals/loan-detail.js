import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtTL0, fmtDate, fmtDateShort } from '../../utils/format.js';
import { openModal, closeModal, modalHeader } from '../modal.js';
import { pct } from '../rate-fields.js';
import { disclaimer } from '../disclaimer.js';
import { loanModal } from './new-loan.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

/** İhtiyaç kredisi detayı: ödeme planı, kalan borç ve taksit işaretleme. */
export function loanDetailModal(id) {
  const loan = Store.data.loans.find(l => l.id === id);
  if (!loan) return;

  openModal(box => {
    const s = Calc.loanSummary(loan);
    modalHeader(box, loan.bankName, loan.label + ' · İhtiyaç kredisi');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const stat = (l, v) => {
      const d = el('div');
      d.append(el('p', 'text-xs text-gray-500 dark:text-gray-400', l), el('p', 'font-bold num', v));
      return d;
    };
    const summary = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 grid grid-cols-2 gap-3 text-sm');
    summary.append(
      stat('Kalan borç', fmtTL.format(s.remainingDebt)),
      stat('Aylık taksit', fmtTL.format(loan.monthlyPayment)),
      stat('Çekilen tutar', fmtTL0.format(loan.principal)),
      stat('Toplam geri ödeme', fmtTL0.format(s.totalPayback))
    );
    body.appendChild(summary);

    /* Taksit ilerlemesi */
    const progWrap = el('div');
    const progTop = el('div', 'flex justify-between text-xs mb-1.5');
    progTop.append(
      el('span', 'text-gray-500 dark:text-gray-400', 'Ödenen taksit'),
      el('span', 'font-semibold num', loan.paidInstallments + ' / ' + loan.totalInstallments)
    );
    const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
    const fill = el('div', 'progress-fill h-full rounded-full bg-accent');
    fill.style.width = Math.round(s.progress * 100) + '%';
    track.appendChild(fill);
    progWrap.append(progTop, track);
    body.appendChild(progWrap);

    /* Ödeme planı */
    const planBox = el('div', 'rounded-xl p-4 space-y-2 ' + (
      s.isFinished ? 'border border-ok/30 bg-ok/[.07]'
        : s.overdueDays > 0 ? 'border border-danger/30 bg-danger/[.07]'
        : 'bg-black/[.03] dark:bg-white/5'
    ));
    const planRow = (label, value, cls) => {
      const r = el('div', 'flex items-center justify-between text-sm gap-3');
      r.append(el('span', 'text-gray-600 dark:text-gray-300', label),
        el('span', 'font-semibold num text-right ' + (cls || ''), value));
      return r;
    };

    planBox.appendChild(el('p', 'text-xs font-semibold uppercase tracking-wider ' + (
      s.isFinished ? 'text-ok' : s.overdueDays > 0 ? 'text-danger' : 'text-gray-500 dark:text-gray-400'
    ), 'Ödeme planı'));

    if (s.isFinished) {
      planBox.appendChild(el('p', 'text-sm font-bold text-ok', '✓ Kredinin tüm taksitleri ödendi.'));
    } else {
      planBox.append(
        planRow('Sonraki taksit', fmtDate.format(s.nextDue),
          s.overdueDays > 0 ? 'text-danger' : ''),
        planRow('Kalan taksit', s.remainingCount + ' adet'),
        planRow('Son taksit', fmtDate.format(s.lastDue)),
        planRow('Toplam faiz yükü', fmtTL.format(s.totalInterest))
      );
      if (s.overdueDays > 0) {
        planBox.appendChild(el('p', 'text-sm font-bold text-danger',
          s.overdueDays + ' gündür ödenmemiş görünüyor. Ödediyseniz aşağıdan işaretleyin.'));
      }
    }
    body.appendChild(planBox);

    /*
     * Amortisman tablosu. Kredinin faiz oranı veri modelinde tutulmaz; taksit,
     * anapara ve vadeden türetilir (bkz. Interest.impliedMonthlyRate).
     */
    const schedule = Calc.loanAmortization(loan);
    if (schedule.rows.length > 0) {
      const amortBox = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 space-y-2');
      amortBox.append(
        el('p', 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', 'Ödeme planı (amortisman)'),
        el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
          'Taksit ve vadeden hesaplanan aylık faiz oranı: %' + pct(schedule.monthlyRate) +
          ' · toplam faiz ' + fmtTL0.format(schedule.totalInterest) +
          ' · toplam vergi ' + fmtTL0.format(schedule.totalTax))
      );

      /* Uzun vadede tablo taşmasın diye kendi içinde kaydırılır */
      const scroll = el('div', 'max-h-64 overflow-y-auto overflow-x-auto -mx-1 px-1');
      const table = el('table', 'w-full text-xs num');
      const thead = el('thead', 'text-gray-500 dark:text-gray-400');
      const htr = el('tr');
      ['#', 'Tarih', 'Taksit', 'Anapara', 'Faiz', 'Vergi', 'Kalan'].forEach((h, i) => {
        const th = el('th', 'py-1 font-semibold ' + (i <= 1 ? 'text-left' : 'text-right'), h);
        th.scope = 'col';
        htr.appendChild(th);
      });
      thead.appendChild(htr);

      const tbody = el('tbody');
      schedule.rows.forEach(r => {
        const paid = r.no <= loan.paidInstallments;
        const tr = el('tr', 'border-t border-black/5 dark:border-white/5 ' +
          (paid ? 'text-gray-400 dark:text-gray-500 line-through' : ''));
        const cells = [
          String(r.no),
          r.date ? fmtDateShort.format(r.date) : '—',
          fmtTL0.format(r.payment),
          fmtTL0.format(r.principal),
          fmtTL0.format(r.interest),
          fmtTL0.format(r.taxes),
          fmtTL0.format(r.balance)
        ];
        cells.forEach((c, i) => tr.appendChild(el('td', 'py-1 ' + (i <= 1 ? 'text-left' : 'text-right'), c)));
        tbody.appendChild(tr);
      });

      table.append(thead, tbody);
      scroll.appendChild(table);
      amortBox.appendChild(scroll);

      /* Erken kapama: kalan taksitlerin toplamı değil, kalan anapara + işlemiş faiz */
      if (!s.isFinished) {
        const payoff = Calc.loanEarlyPayoff(loan);
        amortBox.append(
          el('div', 'border-t border-black/5 dark:border-white/10 pt-2 mt-1'),
          planRow('Kalan anapara', fmtTL.format(payoff.principal)),
          planRow('Erken kapama tutarı', fmtTL.format(payoff.total), 'font-bold'),
          el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
            'Kalan taksitlerin toplamı ' + fmtTL.format(s.remainingDebt) + '; bugün kapatırsanız ' +
            fmtTL.format(Math.max(s.remainingDebt - payoff.total, 0)) + ' faiz ödemezsiniz. ' +
            'Bankaların erken kapama komisyonu bu hesaba dahil değildir.')
        );
      }
      amortBox.appendChild(disclaimer());
      body.appendChild(amortBox);
    }

    /* Taksit işaretleme — kredinin işlem defteri yoktur, sayaç tek doğruluk kaynağıdır */
    const btn = (cls, text, onClick, disabled) => {
      const b = el('button', 'h-11 rounded-xl font-semibold text-sm transition-colors ' + cls, text);
      b.disabled = !!disabled;
      if (disabled) b.classList.add('opacity-40', 'cursor-not-allowed');
      else b.addEventListener('click', onClick);
      return b;
    };

    const step = (delta, msg) => {
      const snap = Store.snapshot();
      if (!Store.payLoanInstallment(loan.id, delta)) return;
      closeModal();
      renderAll();
      toast(msg, 'ok', {
        duration: 7000,
        action: {
          label: 'Geri al',
          onClick: () => { Store.restore(snap); renderAll(); toast('Taksit sayısı geri alındı.'); }
        }
      });
    };

    const payGrid = el('div', 'grid grid-cols-2 gap-2');
    payGrid.append(
      btn('bg-ok/15 text-ok hover:bg-ok/25', 'Taksit ödedim',
        () => step(1, 'Taksit ödendi olarak işaretlendi.'), s.isFinished),
      btn('bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15', 'Geri al',
        () => step(-1, 'Son taksit işareti kaldırıldı.'), loan.paidInstallments === 0)
    );
    body.appendChild(payGrid);

    /* Aksiyonlar */
    const secondary = 'h-11 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 font-semibold text-sm transition-colors';
    const edit = el('button', secondary, 'Krediyi düzenle');
    edit.addEventListener('click', () => { closeModal(); loanModal(loan.id); });

    const del = el('button', 'h-11 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger font-semibold text-sm transition-colors', 'Krediyi sil');
    del.addEventListener('click', () => {
      if (!confirm(loan.bankName + ' — ' + loan.label + ' silinecek. Emin misiniz?')) return;
      const snap = Store.snapshot();
      Store.deleteLoan(loan.id);
      closeModal();
      renderAll();
      toast('Kredi silindi.', 'warn', {
        duration: 8000,
        action: {
          label: 'Geri al',
          onClick: () => { Store.restore(snap); renderAll(); toast('Kredi geri getirildi.'); }
        }
      });
    });

    const actions = el('div', 'grid grid-cols-2 gap-3 pt-2');
    actions.append(edit, del);
    body.appendChild(actions);
    box.appendChild(body);
  });
}
