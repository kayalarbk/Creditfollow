import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { fmtTL, parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';

/**
 * Borç mutabakatı: uygulamadaki borç ekstredeki tutarla uyuşmadığında
 * farkı bir düzeltme işlemi olarak kaydeder.
 * Borcu doğrudan yazmak yerine işlem üretilir ki borç her zaman
 * işlemlerden türetilebilir kalsın (bkz. Store.recalcCard).
 */
export function reconcileDebtModal(cardId) {
  const card = Store.data.cards.find(c => c.id === cardId);
  if (!card) { toast('Kart bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box, 'Borcu düzelt', card.bankName + ' — ekstrenizdeki güncel borcu girin.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const current = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-4 flex items-center justify-between');
    current.append(
      el('span', 'text-sm text-gray-600 dark:text-gray-300', 'Uygulamadaki borç'),
      el('span', 'font-bold num', fmtTL.format(card.currentDebt))
    );

    const real = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 4.250,00' });
    const note = input({ type: 'text', placeholder: 'örn. Temmuz ekstresi (opsiyonel)', maxlength: '60' });

    /* Fark önizlemesi: kullanıcı yazdıkça ne kaydedileceğini gösterir */
    const preview = el('p', 'text-xs text-gray-500 dark:text-gray-400');
    const updatePreview = () => {
      const v = parseAmount(real.value);
      if (isNaN(v) || v < 0) { preview.textContent = ''; return; }
      const diff = Math.round((v - card.currentDebt) * 100) / 100;
      if (Math.abs(diff) < 0.01) {
        preview.textContent = 'Borç zaten bu tutarda; kayıt oluşturulmayacak.';
        preview.className = 'text-xs text-gray-500 dark:text-gray-400';
      } else if (diff > 0) {
        preview.textContent = fmtTL.format(diff) + ' tutarında bir düzeltme harcaması eklenecek.';
        preview.className = 'text-xs text-danger font-medium';
      } else {
        preview.textContent = fmtTL.format(-diff) + ' tutarında bir düzeltme ödemesi eklenecek.';
        preview.className = 'text-xs text-ok font-medium';
      }
    };
    real.addEventListener('input', updatePreview);

    const realField = field('Ekstredeki güncel borç (₺)', real, 'err-real');
    realField.appendChild(preview);

    const submit = primaryButton('Borcu eşitle');
    body.append(current, realField, field('Açıklama', note), submit);
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      const v = parseAmount(real.value);
      if (isNaN(v) || v < 0) { showErr('err-real', 'Geçerli bir tutar girin.'); return; }
      if (v > card.limit) { showErr('err-real', 'Borç kart limitini (' + fmtTL.format(card.limit) + ') aşamaz.'); return; }

      const diff = Math.round((v - card.currentDebt) * 100) / 100;
      if (Math.abs(diff) < 0.01) {
        closeModal();
        toast('Borç zaten bu tutarda, değişiklik yapılmadı.');
        return;
      }

      const saved = Store.addTransaction({
        cardId,
        type: diff > 0 ? 'expense' : 'payment',
        amount: Math.abs(diff),
        category: 'diger',
        installments: 1,
        isAdjustment: true,
        description: note.value.trim() || 'Borç düzeltmesi',
        date: new Date().toISOString()
      });
      if (!saved) return;

      closeModal();
      renderAll();
      toast('Borç ' + fmtTL.format(v) + ' olarak eşitlendi.');
    });
  });
}
