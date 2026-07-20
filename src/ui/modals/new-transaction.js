import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtDateSafe, parseAmount, safeDate } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';
import { newCardModal } from './new-card.js';

/** <input type="date"> yerel gün değeri (ISO'nun UTC kayması olmadan). */
function dateInputValue(value) {
  const d = safeDate(value) || new Date();
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

/** Yinelenen sayılmak için iki işlem arasındaki en fazla gün farkı. */
const DUPLICATE_DAYS = 3;

/**
 * Aynı kart, tür ve tutarda yakın tarihli bir kayıt arar.
 * Aynı harcamayı iki kez girmek kolay olduğu için kaydetmeden önce uyarılır.
 */
function findDuplicate(payload, excludeId) {
  const date = safeDate(payload.date);
  if (!date) return null;

  return Store.data.transactions.find(t => {
    if (t.id === excludeId) return false;
    if (t.cardId !== payload.cardId || t.type !== payload.type) return false;
    if (Math.abs(t.amount - payload.amount) > 0.005) return false;
    const td = safeDate(t.date);
    if (!td) return false;
    return Math.abs(td - date) <= DUPLICATE_DAYS * 86400000;
  }) || null;
}

/**
 * Harcama/ödeme ekleme ve düzenleme modalı.
 * editId verilirse mevcut işlem düzenlenir, verilmezse yeni kayıt açılır.
 */
export function newTransactionModal(presetCardId, editId) {
  if (Store.data.cards.length === 0) {
    toast('Önce bir kart eklemelisiniz.', 'warn');
    newCardModal();
    return;
  }

  const editing = editId ? Store.data.transactions.find(t => t.id === editId) : null;
  if (editId && !editing) { toast('İşlem bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box,
      editing ? 'İşlemi düzenle' : 'Harcama / ödeme ekle',
      editing ? 'Değişiklik kartın borcuna anında yansır.' : 'İşlem, kartın güncel borcuna anında yansır.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const cardSelect = select();
    Store.data.cards.forEach(c => {
      const o = el('option', '', c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''));
      o.value = c.id;
      if (c.id === (editing ? editing.cardId : presetCardId)) o.selected = true;
      cardSelect.appendChild(o);
    });

    /* İşlem türü seçici */
    let txType = editing ? editing.type : 'expense';
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
    if (editing) {
      amount.value = String(editing.amount).replace('.', ',');
      desc.value = editing.description || '';
    }
    dateI.value = dateInputValue(editing && editing.date);

    /* Kategori — yalnızca harcamada anlamlı */
    const catSelect = select();
    CONFIG.categories.forEach(c => {
      const o = el('option', '', c.label);
      o.value = c.id;
      if (c.id === (editing ? editing.category : 'diger')) o.selected = true;
      catSelect.appendChild(o);
    });

    /* Taksit — TR'de taksitli harcamada limitin tamamı düşer, ekstreye aylık taksit yansır */
    const instSelect = select();
    CONFIG.installmentOptions.forEach(n => {
      const o = el('option', '', n === 1 ? 'Tek çekim' : n + ' taksit');
      o.value = String(n);
      if (n === (editing ? editing.installments : 1)) o.selected = true;
      instSelect.appendChild(o);
    });
    const instHint = el('p', 'text-xs text-gray-500 dark:text-gray-400 mt-1.5');

    const catField = field('Kategori', catSelect);
    const instField = field('Taksit', instSelect);
    instField.appendChild(instHint);

    const updateInstHint = () => {
      const n = parseInt(instSelect.value, 10);
      const amt = parseAmount(amount.value);
      if (n > 1 && !isNaN(amt) && amt > 0) {
        instHint.textContent = 'Aylık ' + fmtTL.format(Math.round((amt / n) * 100) / 100) +
          ' · toplam tutar limitinizden hemen düşer.';
      } else {
        instHint.textContent = '';
      }
    };
    instSelect.addEventListener('change', updateInstHint);
    amount.addEventListener('input', updateInstHint);

    /* Ödemede kategori/taksit gizlenir */
    const paintExpenseOnly = () => {
      const isExp = txType === 'expense';
      catField.classList.toggle('hidden', !isExp);
      instField.classList.toggle('hidden', !isExp);
    };
    [tExp, tPay].forEach(b => b.addEventListener('click', paintExpenseOnly));

    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'İşlemi kaydet');
    body.append(
      field('Kart', cardSelect),
      field('İşlem türü', typeWrap),
      field('Tutar (₺)', amount, 'err-amt'),
      catField,
      instField,
      field('Açıklama', desc),
      field('Tarih', dateI, 'err-date'),
      submit
    );
    box.appendChild(body);
    paintExpenseOnly();
    updateInstHint();

    submit.addEventListener('click', () => {
      clearErrs(box);
      const amtV = parseAmount(amount.value);
      if (isNaN(amtV) || amtV <= 0) { showErr('err-amt', 'Geçerli, pozitif bir tutar girin.'); return; }
      if (!dateI.value) { showErr('err-date', 'Tarih seçin.'); return; }

      const card = Store.data.cards.find(c => c.id === cardSelect.value);
      if (txType === 'expense' && card) {
        // Düzenlemede işlemin kendi eski etkisi limit kontrolünden düşülmeli
        const own = editing && editing.cardId === card.id && editing.type === 'expense' ? editing.amount : 0;
        if (card.currentDebt - own + amtV > card.limit) {
          showErr('err-amt', 'Bu harcama kart limitini aşıyor (kalan: ' + fmtTL.format(card.limit - card.currentDebt + own) + ').');
          return;
        }
      }

      const payload = {
        cardId: cardSelect.value,
        type: txType,
        amount: amtV,
        category: txType === 'expense' ? catSelect.value : 'diger',
        installments: txType === 'expense' ? parseInt(instSelect.value, 10) : 1,
        description: desc.value.trim(),
        // Öğlen saati: saat dilimi kaymalarında günün değişmesini önler
        date: new Date(dateI.value + 'T12:00:00').toISOString()
      };

      const dup = findDuplicate(payload, editing && editing.id);
      if (dup) {
        const dupLabel = dup.description || (dup.type === 'expense' ? 'Harcama' : 'Ödeme');
        const ok = confirm(
          'Benzer bir kayıt zaten var:\n\n' +
          dupLabel + ' — ' + fmtTL.format(dup.amount) + ' · ' + fmtDateSafe(dup.date) + '\n\n' +
          'Aynı işlemi ikinci kez eklemek istediğinize emin misiniz?');
        if (!ok) return;
      }

      // Bütçe eşiği kayıttan önce/sonra karşılaştırılır; yalnızca eşik ilk kez aşılınca uyarılır
      const budget = Store.data.settings.monthlyBudget;
      const spentBefore = budget > 0 ? Calc.monthlySpend(0) : 0;

      const saved = editing
        ? Store.updateTransaction(editing.id, payload)
        : Store.addTransaction(payload);
      if (!saved) return;

      closeModal();
      renderAll();

      const spentAfter = budget > 0 ? Calc.monthlySpend(0) : 0;
      if (budget > 0 && spentAfter >= budget && spentBefore < budget) {
        toast('Aylık bütçeniz aşıldı: ' + fmtTL.format(spentAfter) + ' / ' + fmtTL.format(budget), 'danger', { duration: 8000 });
      } else if (budget > 0 && spentAfter >= budget * 0.8 && spentBefore < budget * 0.8) {
        toast('Aylık bütçenizin %80\'ine ulaştınız: ' + fmtTL.format(spentAfter) + ' / ' + fmtTL.format(budget), 'warn', { duration: 8000 });
      } else if (editing) {
        toast('İşlem güncellendi.');
      } else {
        toast(txType === 'expense' ? 'Harcama kaydedildi.' : 'Ödeme kaydedildi, borç güncellendi.');
      }
    });
  });
}

/**
 * İşlemi siler ve birkaç saniyelik "Geri al" seçeneği sunar.
 * Onay penceresi yerine geri alma tercih edildi: tek tıkla silmek hızlı,
 * yanlışlıkla silmek ise geri alınabilir kalıyor.
 */
export function deleteTransactionWithConfirm(id, onUndo) {
  const tx = Store.data.transactions.find(t => t.id === id);
  if (!tx) return false;

  const snap = Store.snapshot();
  const label = tx.description || (tx.type === 'expense' ? 'Harcama' : 'Ödeme');

  Store.deleteTransaction(id);
  renderAll();

  toast('"' + label + '" (' + fmtTL.format(tx.amount) + ') silindi.', 'warn', {
    duration: 7000,
    action: {
      label: 'Geri al',
      onClick: () => {
        Store.restore(snap);
        renderAll();
        if (onUndo) onUndo();
        toast('İşlem geri getirildi.');
      }
    }
  });
  return true;
}
