import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { fmtTL, parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

/** Türkçe biçimli tutarı düzenleme alanına yazmak için ("1250.5" -> "1250,5"). */
function amountValue(n) {
  return typeof n === 'number' ? String(n).replace('.', ',') : '';
}

/**
 * Kart ekleme ve düzenleme modalı.
 * editId verilirse mevcut kart düzenlenir; borç alanı düzenlemede gösterilmez
 * çünkü güncel borç işlemlerden türetilir (bkz. Store.recalcCard).
 */
export function newCardModal(editId) {
  const editing = editId ? Store.data.cards.find(c => c.id === editId) : null;
  if (editId && !editing) { toast('Kart bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box,
      editing ? 'Kartı düzenle' : 'Yeni kart ekle',
      editing ? 'İşlem geçmişiniz korunur.' : 'Kart bilgilerini girin, panel otomatik güncellenir.');
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
    // Yüzde olarak girilir, oran olarak saklanır (2,5 -> 0.025)
    const interest = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 4,25' });
    interest.value = String(
      Math.round((editing ? editing.interestRate : CONFIG.defaultInterestRate) * 10000) / 100
    ).replace('.', ',');

    /* Asgari ödeme oranı seçimi */
    const rateWrap = el('div', 'grid grid-cols-2 gap-2');
    let selectedRate = editing ? editing.minPaymentRate : CONFIG.minPaymentRates[0];
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

    /* Düzenlemede mevcut değerler yüklenir */
    if (editing) {
      const known = CONFIG.banks.includes(editing.bankName);
      bank.value = known ? editing.bankName : 'Diğer';
      if (!known) {
        bankCustom.value = editing.bankName;
        bankCustom.classList.remove('hidden');
      }
      label.value = editing.cardLabel || '';
      limit.value = amountValue(editing.limit);
      stDay.value = String(editing.statementDay);
      duDay.value = String(editing.dueDay);
    }

    const dayGrid = el('div', 'grid grid-cols-2 gap-3');
    dayGrid.append(
      field('Hesap kesim günü', stDay, 'err-st'),
      field('Son ödeme günü', duDay, 'err-du')
    );

    const debtField = field('Mevcut borç (₺)', debt, 'err-debt');
    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'Kartı ekle');

    body.append(
      field('Banka', bankWrap, 'err-bank'),
      field('Kart etiketi', label),
      field('Kart limiti (₺)', limit, 'err-limit')
    );
    // Borç yalnızca kart eklenirken sorulur; sonrasında işlemlerden hesaplanır
    if (!editing) body.appendChild(debtField);
    const interestField = field('Aylık akdi faiz oranı (%)', interest, 'err-int');
    interestField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5',
      'Borcunuzu asgari ödeseniz ne olurdu hesabı için kullanılır. Bilmiyorsanız olduğu gibi bırakın; 0 yazarsanız hesap gösterilmez.'));

    body.append(dayGrid, field('Asgari ödeme oranı', rateWrap), interestField, submit);

    if (editing) {
      body.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 text-center',
        'Güncel borç işlemlerinizden hesaplanır. Ekstrenizle uyuşmuyorsa kart detayındaki "Borcu düzelt"i kullanın.'));
    }
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const bankV = bank.value === 'Diğer' ? bankCustom.value.trim() : bank.value;
      const limitV = parseAmount(limit.value);
      const stV = parseInt(stDay.value, 10);
      const duV = parseInt(duDay.value, 10);

      if (!bankV) { showErr('err-bank', bank.value === 'Diğer' ? 'Banka adını yazın.' : 'Listeden bir banka seçin.'); valid = false; }
      if (isNaN(limitV) || limitV <= 0) { showErr('err-limit', 'Geçerli, pozitif bir limit girin.'); valid = false; }
      if (isNaN(stV) || stV < 1 || stV > 31) { showErr('err-st', '1–31 arası bir gün girin.'); valid = false; }
      if (isNaN(duV) || duV < 1 || duV > 31) { showErr('err-du', '1–31 arası bir gün girin.'); valid = false; }

      const intPct = interest.value.trim() === '' ? 0 : parseAmount(interest.value);
      if (isNaN(intPct) || intPct < 0 || intPct > 100) { showErr('err-int', '0–100 arası bir oran girin.'); valid = false; }

      let debtV = 0;
      if (!editing) {
        debtV = debt.value.trim() === '' ? 0 : parseAmount(debt.value);
        if (isNaN(debtV) || debtV < 0) { showErr('err-debt', 'Geçerli bir tutar girin (boş bırakılırsa 0).'); valid = false; }
        if (!isNaN(limitV) && !isNaN(debtV) && debtV > limitV) { showErr('err-debt', 'Mevcut borç limiti aşamaz.'); valid = false; }
      } else if (!isNaN(limitV) && limitV < editing.currentDebt) {
        // Limit düşürülürken mevcut borcun altına inilemez
        showErr('err-limit', 'Limit güncel borcun (' + fmtTL.format(editing.currentDebt) + ') altına indirilemez.');
        valid = false;
      }
      if (!valid) return;

      const saved = editing
        ? Store.updateCard(editing.id, {
            bankName: bankV,
            cardLabel: label.value.trim(),
            limit: limitV,
            statementDay: stV,
            dueDay: duV,
            minPaymentRate: selectedRate,
            interestRate: intPct / 100
          })
        : Store.addCard({
            bankName: bankV,
            cardLabel: label.value.trim(),
            limit: limitV,
            currentDebt: debtV,
            statementDay: stV,
            dueDay: duV,
            minPaymentRate: selectedRate,
            interestRate: intPct / 100
          });
      if (!saved) return;

      closeModal();
      renderAll();
      toast(editing ? 'Kart bilgileri güncellendi.' : bankV + ' kartı eklendi.');
    });
  });
}
