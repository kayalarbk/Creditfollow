import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtTL0, parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, input } from '../modal.js';
import { overdraftModal } from './new-overdraft.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

/** Avans hesap detayı: bakiye, limit kullanımı, faiz maliyeti ve hızlı ödeme. */
export function overdraftDetailModal(id) {
  const od = Store.data.overdrafts.find(o => o.id === id);
  if (!od) return;

  openModal(box => {
    modalHeader(box, od.bankName, od.label + ' · Avans hesap');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const ratio = Calc.overdraftUsage(od);
    const color = Calc.usageColor(ratio);

    const stat = (l, v) => {
      const d = el('div');
      d.append(el('p', 'text-xs text-gray-500 dark:text-gray-400', l), el('p', 'font-bold num', v));
      return d;
    };
    const summary = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 grid grid-cols-2 gap-3 text-sm');
    summary.append(
      stat('Kullanılan', fmtTL.format(od.currentDebt)),
      stat('Limit', fmtTL0.format(od.limit)),
      stat('Kullanılabilir', fmtTL0.format(Math.max(od.limit - od.currentDebt, 0))),
      stat('Aylık faiz', '%' + String(Math.round(od.interestRate * 10000) / 100).replace('.', ','))
    );
    body.appendChild(summary);

    const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
    const fill = el('div', 'progress-fill h-full rounded-full');
    fill.style.width = Math.min(ratio * 100, 100) + '%';
    fill.style.backgroundColor = color;
    track.appendChild(fill);
    body.append(el('p', 'text-xs text-gray-500 dark:text-gray-400', 'Limit kullanımı: %' + Math.round(ratio * 100)), track);

    /* Faiz maliyeti: avans hesap günlük işlediği için kullanıcı çoğu zaman aylık yükü görmez */
    if (od.currentDebt > 0 && od.interestRate > 0) {
      const monthlyCost = od.currentDebt * od.interestRate;
      const warnBox = el('div', 'rounded-xl border border-warn/30 bg-warn/[.07] p-4 space-y-1');
      warnBox.append(
        el('p', 'text-xs font-semibold text-yellow-700 dark:text-warn uppercase tracking-wider', 'Faiz maliyeti'),
        el('p', 'text-sm num', 'Bu bakiye kapatılmazsa aylık yaklaşık ' + fmtTL.format(monthlyCost) + ' faiz işler.'),
        el('p', 'text-[11px] text-gray-500 dark:text-gray-400',
          'Vergiler (BSMV/KKDF) hariç kaba hesaptır. Bilgi amaçlıdır, finans tavsiyesi değildir.')
      );
      body.appendChild(warnBox);
    }

    /* Hızlı bakiye güncelleme — avans hesapta işlem defteri tutulmaz */
    const quick = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 space-y-2');
    quick.appendChild(el('p', 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', 'Bakiyeyi güncelle'));
    const amount = input({ type: 'text', inputmode: 'decimal', placeholder: 'Tutar' });
    const err = el('p', 'hidden text-xs text-danger font-medium');

    const apply = (delta, okMsg) => {
      err.classList.add('hidden');
      const v = parseAmount(amount.value);
      if (isNaN(v) || v <= 0) {
        err.textContent = 'Geçerli, pozitif bir tutar girin.';
        err.classList.remove('hidden');
        return;
      }
      const next = Math.max(0, Math.round((od.currentDebt + delta * v) * 100) / 100);
      if (next > od.limit) {
        err.textContent = 'Yeni bakiye limiti (' + fmtTL.format(od.limit) + ') aşıyor.';
        err.classList.remove('hidden');
        return;
      }
      const snap = Store.snapshot();
      Store.updateOverdraft(od.id, { currentDebt: next });
      closeModal();
      renderAll();
      toast(okMsg + ' Yeni bakiye: ' + fmtTL.format(next), 'ok', {
        duration: 7000,
        action: {
          label: 'Geri al',
          onClick: () => { Store.restore(snap); renderAll(); toast('Bakiye geri alındı.'); }
        }
      });
    };

    const btn = (cls, text, onClick) => {
      const b = el('button', 'h-11 rounded-xl font-semibold text-sm transition-colors ' + cls, text);
      b.addEventListener('click', onClick);
      return b;
    };
    const grid = el('div', 'grid grid-cols-2 gap-2');
    grid.append(
      btn('bg-ok/15 text-ok hover:bg-ok/25', 'Ödeme yaptım', () => apply(-1, 'Ödeme işlendi.')),
      btn('bg-danger/10 text-danger hover:bg-danger/20', 'Kullanım ekle', () => apply(1, 'Kullanım eklendi.'))
    );
    quick.append(amount, err, grid);
    body.appendChild(quick);

    /* Aksiyonlar */
    const secondary = 'h-11 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 font-semibold text-sm transition-colors';
    const edit = el('button', secondary, 'Hesabı düzenle');
    edit.addEventListener('click', () => { closeModal(); overdraftModal(od.id); });

    const del = el('button', 'h-11 rounded-xl bg-danger/10 hover:bg-danger/20 text-danger font-semibold text-sm transition-colors', 'Hesabı sil');
    del.addEventListener('click', () => {
      if (!confirm(od.bankName + ' avans hesabı silinecek. Emin misiniz?')) return;
      const snap = Store.snapshot();
      Store.deleteOverdraft(od.id);
      closeModal();
      renderAll();
      toast('Avans hesap silindi.', 'warn', {
        duration: 8000,
        action: {
          label: 'Geri al',
          onClick: () => { Store.restore(snap); renderAll(); toast('Avans hesap geri getirildi.'); }
        }
      });
    });

    const actions = el('div', 'grid grid-cols-2 gap-3 pt-2');
    actions.append(edit, del);
    body.appendChild(actions);
    box.appendChild(body);
  });
}
