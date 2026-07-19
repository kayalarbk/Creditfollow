import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { fmtTL, parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';
import { newCardModal } from './new-card.js';

export function newTransactionModal(presetCardId) {
  if (Store.data.cards.length === 0) {
    toast('Önce bir kart eklemelisiniz.', 'warn');
    newCardModal();
    return;
  }

  openModal(box => {
    modalHeader(box, 'Harcama / ödeme ekle', 'İşlem, kartın güncel borcuna anında yansır.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const cardSelect = select();
    Store.data.cards.forEach(c => {
      const o = el('option', '', c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''));
      o.value = c.id;
      if (c.id === presetCardId) o.selected = true;
      cardSelect.appendChild(o);
    });

    /* İşlem türü seçici */
    let txType = 'expense';
    const typeWrap = el('div', 'grid grid-cols-2 gap-2');
    const mkType = (val, labelTxt, icon) => {
      const b = el('button');
      b.type = 'button';
      b.append(el('i', 'fa-solid ' + icon + ' mr-1.5'), document.createTextNode(labelTxt));
      b._val = val;
      b.addEventListener('click', () => { txType = val; paintTypes(); });
      return b;
    };
    const tExp = mkType('expense', 'Harcama', 'fa-cart-shopping');
    const tPay = mkType('payment', 'Ödeme yapıldı', 'fa-circle-check');
    const paintTypes = () => [tExp, tPay].forEach(b => {
      const on = b._val === txType;
      b.className = 'h-11 rounded-xl text-sm font-semibold transition-colors ' +
        (on ? (txType === 'expense' ? 'bg-danger text-white' : 'bg-ok text-white') : 'bg-black/5 dark:bg-white/10');
    });
    typeWrap.append(tExp, tPay);
    paintTypes();

    const amount = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 1.250,50' });
    const desc = input({ type: 'text', placeholder: 'örn. Market alışverişi (opsiyonel)', maxlength: '60' });
    const dateI = input({ type: 'date' });
    dateI.value = new Date().toISOString().slice(0, 10);

    const submit = primaryButton('İşlemi kaydet');
    body.append(
      field('Kart', cardSelect),
      field('İşlem türü', typeWrap),
      field('Tutar (₺)', amount, 'err-amt'),
      field('Açıklama', desc),
      field('Tarih', dateI, 'err-date'),
      submit
    );
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      const amtV = parseAmount(amount.value);
      if (isNaN(amtV) || amtV <= 0) { showErr('err-amt', 'Geçerli, pozitif bir tutar girin.'); return; }
      if (!dateI.value) { showErr('err-date', 'Tarih seçin.'); return; }

      const card = Store.data.cards.find(c => c.id === cardSelect.value);
      if (txType === 'expense' && card && card.currentDebt + amtV > card.limit) {
        showErr('err-amt', 'Bu harcama kart limitini aşıyor (kalan: ' + fmtTL.format(card.limit - card.currentDebt) + ').');
        return;
      }

      const saved = Store.addTransaction({
        cardId: cardSelect.value,
        type: txType,
        amount: amtV,
        description: desc.value.trim(),
        // Öğlen saati: saat dilimi kaymalarında günün değişmesini önler
        date: new Date(dateI.value + 'T12:00:00').toISOString()
      });
      if (!saved) return;

      closeModal();
      renderAll();
      toast(txType === 'expense' ? 'Harcama kaydedildi.' : 'Ödeme kaydedildi, borç güncellendi.');
    });
  });
}
