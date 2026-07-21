import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtDate, parseAmount, safeDate } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, primaryButton, showErr, clearErrs } from '../modal.js';
import { bankSelect } from '../bank-select.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

const amountValue = n => (typeof n === 'number' && n > 0 ? String(n).replace('.', ',') : '');

/** <input type="date"> "YYYY-AA-GG" bekler; yerel saate göre üretilir ki gün kaymasın. */
function dateInputValue(value) {
  const d = safeDate(value) || new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/**
 * İhtiyaç kredisi ekleme ve düzenleme.
 *
 * Kalan borç, kalan taksitlerin toplamından türetilir; faiz taksite gömülü
 * olduğu için ayrıca sorulmaz. Sıradaki taksitin tarihi ilk ödeme tarihi ve
 * ödenen taksit sayısından hesaplanır — böylece her ay tarih güncellemek gerekmez.
 */
export function loanModal(editId) {
  const editing = editId ? Store.data.loans.find(l => l.id === editId) : null;
  if (editId && !editing) { toast('Kredi bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box,
      editing ? 'Krediyi düzenle' : 'İhtiyaç kredisi ekle',
      'Kredi sözleşmenizdeki tutar, taksit ve ödeme planı bilgilerini girin.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const bank = bankSelect(editing ? editing.bankId : null);
    const label = input({ type: 'text', placeholder: 'örn. İhtiyaç Kredisi (opsiyonel)', maxlength: '40' });
    const principal = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 120.000' });
    const monthly = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 6.450' });
    const total = input({ type: 'number', min: '1', max: '360', placeholder: 'örn. 36' });
    const paid = input({ type: 'number', min: '0', max: '360', placeholder: '0' });
    const first = input({ type: 'date' });
    first.value = dateInputValue(editing ? editing.firstPaymentDate : null);

    if (editing) {
      label.value = editing.label === 'İhtiyaç kredisi' ? '' : editing.label;
      principal.value = amountValue(editing.principal);
      monthly.value = amountValue(editing.monthlyPayment);
      total.value = String(editing.totalInstallments);
      paid.value = String(editing.paidInstallments);
    }

    const bankField = field('Banka', bank.wrap, 'err-bank');
    if (bank.hint) bankField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5', bank.hint));

    const countGrid = el('div', 'grid grid-cols-2 gap-3');
    countGrid.append(
      field('Toplam taksit', total, 'err-total'),
      field('Ödenen taksit', paid, 'err-paid')
    );

    const firstField = field('İlk taksit tarihi', first, 'err-first');
    firstField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5',
      'Sonraki ödeme tarihi bu tarihten ve ödenen taksit sayısından hesaplanır.'));

    /* Canlı özet: girilen değerlerin kalan borç ve bitiş tarihine etkisi anında görünsün */
    const preview = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 space-y-1 text-sm');
    const paintPreview = () => {
      preview.textContent = '';
      const m = parseAmount(monthly.value);
      const t = parseInt(total.value, 10);
      const p = parseInt(paid.value, 10) || 0;
      const f = safeDate(first.value);

      if (isNaN(m) || m <= 0 || isNaN(t) || t <= 0 || !f) {
        preview.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500',
          'Taksit tutarı, taksit sayısı ve ilk ödeme tarihini girin; kalan borcunuz burada görünecek.'));
        return;
      }

      const s = Calc.loanSummary({
        monthlyPayment: m, totalInstallments: t,
        paidInstallments: Math.min(Math.max(p, 0), t),
        principal: parseAmount(principal.value) || 0,
        firstPaymentDate: f.toISOString()
      });
      const row = (l, v) => {
        const r = el('div', 'flex items-center justify-between gap-3');
        r.append(el('span', 'text-gray-500 dark:text-gray-400 text-xs', l), el('span', 'font-semibold num', v));
        return r;
      };
      preview.append(
        row('Kalan borç', fmtTL.format(s.remainingDebt)),
        row('Kalan taksit', s.remainingCount + ' / ' + t),
        row('Toplam geri ödeme', fmtTL.format(s.totalPayback)),
        row('Sonraki ödeme', s.nextDue ? fmtDate.format(s.nextDue) : 'Kredi bitti'),
        row('Son taksit', fmtDate.format(s.lastDue))
      );
    };
    [monthly, total, paid, first, principal].forEach(i => i.addEventListener('input', paintPreview));
    paintPreview();

    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'Krediyi ekle');

    body.append(
      bankField,
      field('Kredi etiketi', label),
      field('Çekilen tutar (₺)', principal, 'err-principal'),
      field('Aylık taksit (₺)', monthly, 'err-monthly'),
      countGrid,
      firstField,
      preview,
      submit
    );
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const bankV = bank.resolve();
      const principalV = parseAmount(principal.value);
      const monthlyV = parseAmount(monthly.value);
      const totalV = parseInt(total.value, 10);
      const paidV = paid.value.trim() === '' ? 0 : parseInt(paid.value, 10);
      const firstV = safeDate(first.value);

      if (!bankV) { showErr('err-bank', 'Bir banka seçin veya yeni banka adını yazın.'); valid = false; }
      if (isNaN(principalV) || principalV <= 0) { showErr('err-principal', 'Geçerli, pozitif bir tutar girin.'); valid = false; }
      if (isNaN(monthlyV) || monthlyV <= 0) { showErr('err-monthly', 'Geçerli, pozitif bir taksit tutarı girin.'); valid = false; }
      if (isNaN(totalV) || totalV < 1 || totalV > 360) { showErr('err-total', '1–360 arası bir taksit sayısı girin.'); valid = false; }
      if (isNaN(paidV) || paidV < 0) { showErr('err-paid', 'Geçerli bir sayı girin (boş bırakılırsa 0).'); valid = false; }
      else if (!isNaN(totalV) && paidV > totalV) { showErr('err-paid', 'Ödenen taksit toplamı aşamaz.'); valid = false; }
      if (!firstV) { showErr('err-first', 'İlk taksit tarihini seçin.'); valid = false; }
      if (!valid) return;

      const patch = {
        bankId: bankV,
        label: label.value.trim() || 'İhtiyaç kredisi',
        principal: principalV,
        monthlyPayment: monthlyV,
        totalInstallments: totalV,
        paidInstallments: paidV,
        firstPaymentDate: firstV.toISOString()
      };
      const saved = editing ? Store.updateLoan(editing.id, patch) : Store.addLoan(patch);
      if (!saved) return;

      closeModal();
      renderAll();
      toast(editing ? 'Kredi bilgileri güncellendi.' : Store.bankName(bankV) + ' kredisi eklendi.');
    });
  });
}
