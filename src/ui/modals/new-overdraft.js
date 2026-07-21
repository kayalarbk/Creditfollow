import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, primaryButton, showErr, clearErrs } from '../modal.js';
import { bankSelect } from '../bank-select.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

const amountValue = n => (typeof n === 'number' && n > 0 ? String(n).replace('.', ',') : '');

/**
 * Avans (kredili mevduat) hesabı ekleme ve düzenleme.
 *
 * Kartın aksine avans hesabın işlem defteri tutulmaz: bankadaki kullanılan tutar
 * doğrudan girilir. Harcamalar hesaba tek tek değil toplu yansıdığı için
 * kalemleri kaydetmek kullanıcıya değer katmaz, güncel bakiye yeterlidir.
 */
export function overdraftModal(editId) {
  const editing = editId ? Store.data.overdrafts.find(o => o.id === editId) : null;
  if (editId && !editing) { toast('Avans hesap bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box,
      editing ? 'Avans hesabı düzenle' : 'Avans hesap ekle',
      'Kredili mevduat (KMH) hesabınızın limitini ve kullanılan tutarı girin.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const bank = bankSelect(editing ? editing.bankId : null);
    const label = input({ type: 'text', placeholder: 'örn. Avans Hesap (opsiyonel)', maxlength: '40' });
    const limit = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 15.000' });
    const debt = input({ type: 'text', inputmode: 'decimal', placeholder: '0 (kullandığınız tutar)' });
    const interest = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 5,50' });
    interest.value = String(
      Math.round((editing ? editing.interestRate : CONFIG.defaultOverdraftRate) * 10000) / 100
    ).replace('.', ',');

    if (editing) {
      label.value = editing.label === 'Avans hesap' ? '' : editing.label;
      limit.value = amountValue(editing.limit);
      debt.value = amountValue(editing.currentDebt);
    }

    const bankField = field('Banka', bank.wrap, 'err-bank');
    if (bank.hint) bankField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5', bank.hint));

    const debtField = field('Kullanılan tutar (₺)', debt, 'err-debt');
    debtField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5',
      'Hesabınızdaki eksi bakiye. Ödeme yaptıkça bu alanı güncelleyin.'));

    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'Hesabı ekle');

    body.append(
      bankField,
      field('Hesap etiketi', label),
      field('Avans limiti (₺)', limit, 'err-limit'),
      debtField,
      field('Aylık faiz oranı (%)', interest, 'err-int'),
      submit
    );
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const bankV = bank.resolve();
      const limitV = parseAmount(limit.value);
      const debtV = debt.value.trim() === '' ? 0 : parseAmount(debt.value);
      const intPct = interest.value.trim() === '' ? 0 : parseAmount(interest.value);

      if (!bankV) { showErr('err-bank', 'Bir banka seçin veya yeni banka adını yazın.'); valid = false; }
      if (isNaN(limitV) || limitV <= 0) { showErr('err-limit', 'Geçerli, pozitif bir limit girin.'); valid = false; }
      if (isNaN(debtV) || debtV < 0) { showErr('err-debt', 'Geçerli bir tutar girin (boş bırakılırsa 0).'); valid = false; }
      if (!isNaN(limitV) && !isNaN(debtV) && debtV > limitV) { showErr('err-debt', 'Kullanılan tutar limiti aşamaz.'); valid = false; }
      if (isNaN(intPct) || intPct < 0 || intPct > 100) { showErr('err-int', '0–100 arası bir oran girin.'); valid = false; }
      if (!valid) return;

      const patch = {
        bankId: bankV,
        label: label.value.trim() || 'Avans hesap',
        limit: limitV,
        currentDebt: debtV,
        interestRate: intPct / 100
      };
      const saved = editing ? Store.updateOverdraft(editing.id, patch) : Store.addOverdraft(patch);
      if (!saved) return;

      closeModal();
      renderAll();
      toast(editing ? 'Avans hesap güncellendi.' : Store.bankName(bankV) + ' avans hesabı eklendi.');
    });
  });
}
