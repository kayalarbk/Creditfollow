import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

export function newCardModal() {
  openModal(box => {
    modalHeader(box, 'Yeni kart ekle', 'Kart bilgilerini girin, panel otomatik güncellenir.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    /* Banka: liste + "Diğer" için serbest metin */
    const bankWrap = el('div', 'space-y-2');
    const bank = select();
    const ph = el('option', '', 'Banka seçin…');
    ph.value = ''; ph.disabled = true; ph.selected = true;
    bank.appendChild(ph);
    CONFIG.banks.forEach(b => {
      const o = el('option', '', b);
      o.value = b;
      bank.appendChild(o);
    });
    const bankCustom = input({ type: 'text', placeholder: 'Banka adını yazın', maxlength: '40' });
    bankCustom.classList.add('hidden');
    bank.addEventListener('change', () => {
      bankCustom.classList.toggle('hidden', bank.value !== 'Diğer');
      if (bank.value === 'Diğer') bankCustom.focus();
    });
    bankWrap.append(bank, bankCustom);

    const label = input({ type: 'text', placeholder: 'örn. Bonus Platinum (opsiyonel)', maxlength: '40' });
    const limit = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 50.000' });
    const debt = input({ type: 'text', inputmode: 'decimal', placeholder: '0 (varsa mevcut borcunuz)' });
    const stDay = input({ type: 'number', min: '1', max: '31', placeholder: '1–31' });
    const duDay = input({ type: 'number', min: '1', max: '31', placeholder: '1–31' });

    /* Asgari ödeme oranı seçimi */
    const rateWrap = el('div', 'grid grid-cols-2 gap-2');
    let selectedRate = CONFIG.minPaymentRates[0];
    const rateBtns = CONFIG.minPaymentRates.map(r => {
      const b = el('button', '', '%' + Math.round(r * 100));
      b.type = 'button';
      b._rate = r;
      b.addEventListener('click', () => { selectedRate = r; paintRates(); });
      rateWrap.appendChild(b);
      return b;
    });
    const paintRates = () => rateBtns.forEach(b => {
      b.className = 'h-11 rounded-xl text-sm font-semibold transition-colors ' +
        (b._rate === selectedRate ? 'bg-accent text-white' : 'bg-black/5 dark:bg-white/10');
    });
    paintRates();

    const dayGrid = el('div', 'grid grid-cols-2 gap-3');
    dayGrid.append(
      field('Hesap kesim günü', stDay, 'err-st'),
      field('Son ödeme günü', duDay, 'err-du')
    );

    const submit = primaryButton('Kartı ekle');
    body.append(
      field('Banka', bankWrap, 'err-bank'),
      field('Kart etiketi', label),
      field('Kart limiti (₺)', limit, 'err-limit'),
      field('Mevcut borç (₺)', debt, 'err-debt'),
      dayGrid,
      field('Asgari ödeme oranı', rateWrap),
      submit
    );
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const bankV = bank.value === 'Diğer' ? bankCustom.value.trim() : bank.value;
      const limitV = parseAmount(limit.value);
      const debtV = debt.value.trim() === '' ? 0 : parseAmount(debt.value);
      const stV = parseInt(stDay.value, 10);
      const duV = parseInt(duDay.value, 10);

      if (!bankV) { showErr('err-bank', bank.value === 'Diğer' ? 'Banka adını yazın.' : 'Listeden bir banka seçin.'); valid = false; }
      if (isNaN(limitV) || limitV <= 0) { showErr('err-limit', 'Geçerli, pozitif bir limit girin.'); valid = false; }
      if (isNaN(debtV) || debtV < 0) { showErr('err-debt', 'Geçerli bir tutar girin (boş bırakılırsa 0).'); valid = false; }
      if (!isNaN(limitV) && !isNaN(debtV) && debtV > limitV) { showErr('err-debt', 'Mevcut borç limiti aşamaz.'); valid = false; }
      if (isNaN(stV) || stV < 1 || stV > 31) { showErr('err-st', '1–31 arası bir gün girin.'); valid = false; }
      if (isNaN(duV) || duV < 1 || duV > 31) { showErr('err-du', '1–31 arası bir gün girin.'); valid = false; }
      if (!valid) return;

      const added = Store.addCard({
        bankName: bankV,
        cardLabel: label.value.trim(),
        limit: limitV,
        currentDebt: debtV,
        statementDay: stV,
        dueDay: duV,
        minPaymentRate: selectedRate
      });
      if (!added) return;

      closeModal();
      renderAll();
      toast(bankV + ' kartı eklendi.');
    });
  });
}
