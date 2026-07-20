import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { renderAll } from '../router.js';
import { renderSettings } from '../views/settings.js';
import { toast } from '../toast.js';

/** Tekrarlayan işlem şablonu ekleme/düzenleme modalı. */
export function recurringModal(editId) {
  if (Store.data.cards.length === 0) {
    toast('Önce bir kart eklemelisiniz.', 'warn');
    return;
  }

  const editing = editId ? Store.data.recurring.find(r => r.id === editId) : null;
  if (editId && !editing) { toast('Kayıt bulunamadı.', 'danger'); return; }

  openModal(box => {
    modalHeader(box,
      editing ? 'Tekrarlayan işlemi düzenle' : 'Tekrarlayan işlem ekle',
      'Her ay belirlediğiniz günde otomatik harcama kaydedilir.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const cardSelect = select();
    Store.data.cards.forEach(c => {
      const o = el('option', '', c.bankName + (c.cardLabel ? ' — ' + c.cardLabel : ''));
      o.value = c.id;
      if (editing && c.id === editing.cardId) o.selected = true;
      cardSelect.appendChild(o);
    });

    const catSelect = select();
    CONFIG.categories.forEach(c => {
      const o = el('option', '', c.label);
      o.value = c.id;
      if (c.id === (editing ? editing.category : 'fatura')) o.selected = true;
      catSelect.appendChild(o);
    });

    const desc = input({ type: 'text', placeholder: 'örn. Netflix aboneliği', maxlength: '60' });
    const amount = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 229,99' });
    const dayI = input({ type: 'number', min: '1', max: '31', placeholder: '1–31' });

    if (editing) {
      desc.value = editing.description;
      amount.value = String(editing.amount).replace('.', ',');
      dayI.value = String(editing.dayOfMonth);
    } else {
      dayI.value = '1';
    }

    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'Kaydet');
    body.append(
      field('Kart', cardSelect),
      field('Açıklama', desc, 'err-desc'),
      field('Tutar (₺)', amount, 'err-amt'),
      field('Kategori', catSelect),
      field('Ayın kaçında', dayI, 'err-day'),
      submit
    );
    body.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500',
      'Ayın 29–31\'i kısa aylarda ayın son gününe kaydırılır. Geçmiş aylar için kayıt oluşturulmaz.'));
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const descV = desc.value.trim();
      const amtV = parseAmount(amount.value);
      const dayV = parseInt(dayI.value, 10);

      if (!descV) { showErr('err-desc', 'Bir açıklama girin.'); valid = false; }
      if (isNaN(amtV) || amtV <= 0) { showErr('err-amt', 'Geçerli, pozitif bir tutar girin.'); valid = false; }
      if (isNaN(dayV) || dayV < 1 || dayV > 31) { showErr('err-day', '1–31 arası bir gün girin.'); valid = false; }
      if (!valid) return;

      const payload = {
        cardId: cardSelect.value,
        description: descV,
        amount: amtV,
        category: catSelect.value,
        dayOfMonth: dayV
      };

      const saved = editing
        ? Store.updateRecurring(editing.id, payload)
        : Store.addRecurring(payload);
      if (!saved) return;

      // Yeni kayıt bu ayın gününü çoktan geçtiyse hemen işlensin
      const created = Store.runRecurring();
      closeModal();
      renderAll();
      renderSettings();
      toast(editing
        ? 'Tekrarlayan işlem güncellendi.'
        : 'Tekrarlayan işlem eklendi.' + (created > 0 ? ' Bu ayın kaydı oluşturuldu.' : ''));
    });
  });
}
