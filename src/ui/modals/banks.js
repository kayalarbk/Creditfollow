import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { el } from '../../utils/dom.js';
import { bankIcon } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, input, primaryButton } from '../modal.js';
import { renderAll } from '../router.js';
import { renderSettings } from '../views/settings.js';
import { toast } from '../toast.js';

/**
 * "Bankalarım" seçim modalı.
 *
 * Kart, avans hesap ve kredi eklerken banka listesi uzun olmasın diye kullanıcı
 * çalıştığı bankaları önceden işaretler. Ürünü olan bankalar seçimden çıkarılamaz;
 * çıkarılsaydı o ürünler sahipsiz kalırdı.
 */
export function banksModal() {
  openModal(box => {
    modalHeader(box, 'Bankalarım',
      'Çalıştığınız bankaları seçin; kart, avans hesap ve kredi eklerken yalnızca bunlar listelenir.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    // Hazır liste + kullanıcının elle eklediği bankalar birlikte gösterilir
    const known = new Set(CONFIG.banks.filter(b => b !== 'Diğer'));
    Store.data.banks.forEach(b => known.add(b.name));

    const selected = new Set(Store.data.banks.map(b => b.name));
    const locked = new Set(
      Store.data.banks.filter(b => Store.bankProductCount(b.id) > 0).map(b => b.name)
    );

    const search = input({ type: 'search', placeholder: 'Banka ara…' });
    const list = el('div', 'max-h-72 overflow-y-auto space-y-1 -mx-1 px-1');
    const count = el('p', 'text-xs text-gray-500 dark:text-gray-400');

    const paintCount = () => {
      count.textContent = selected.size === 0
        ? 'Henüz banka seçilmedi.'
        : selected.size + ' banka seçili';
    };

    const paintList = () => {
      list.textContent = '';
      const q = search.value.trim().toLocaleLowerCase('tr-TR');
      const names = [...known]
        .filter(n => !q || n.toLocaleLowerCase('tr-TR').includes(q))
        .sort((a, b) => a.localeCompare(b, 'tr'));

      if (names.length === 0) {
        list.appendChild(el('p', 'text-sm text-gray-400 dark:text-gray-500 py-3 text-center',
          'Eşleşen banka yok. Aşağıdan elle ekleyebilirsiniz.'));
        return;
      }

      names.forEach(name => {
        const isLocked = locked.has(name);
        const row = el('label', 'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors');

        const cb = el('input');
        cb.type = 'checkbox';
        cb.className = 'w-4 h-4 rounded accent-accent shrink-0';
        cb.checked = selected.has(name);
        cb.disabled = isLocked;
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(name); else selected.delete(name);
          paintCount();
        });

        const ic = el('div', 'w-8 h-8 rounded-lg bg-black/5 dark:bg-white/10 grid place-items-center shrink-0 text-gray-500 dark:text-gray-400');
        ic.appendChild(el('i', 'fa-solid ' + bankIcon(name) + ' text-xs'));

        const text = el('div', 'min-w-0 flex-1');
        text.appendChild(el('p', 'text-sm font-medium truncate', name));
        if (isLocked) {
          row.classList.add('cursor-not-allowed');
          text.appendChild(el('p', 'text-[11px] text-gray-400 dark:text-gray-500',
            'Bu bankada kayıtlı ürününüz var, çıkarılamaz'));
        }

        row.append(cb, ic, text);
        list.appendChild(row);
      });
    };

    search.addEventListener('input', paintList);

    /* Listede olmayan banka: yazıp ekle */
    const customWrap = el('div', 'flex gap-2');
    const custom = input({ type: 'text', placeholder: 'Listede yok — banka adı yazın', maxlength: '40' });
    const addBtn = el('button', 'h-11 px-4 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 font-semibold text-sm transition-colors shrink-0', 'Ekle');
    addBtn.addEventListener('click', () => {
      const name = custom.value.trim();
      if (!name) return;
      known.add(name);
      selected.add(name);
      custom.value = '';
      search.value = '';
      paintList();
      paintCount();
    });
    custom.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); }
    });
    customWrap.append(custom, addBtn);

    const save = primaryButton('Seçimi kaydet');
    save.addEventListener('click', () => {
      const { kept } = Store.syncBanks([...selected]);
      closeModal();
      renderAll();
      renderSettings();
      toast(kept.length > 0
        ? 'Bankalarınız kaydedildi. Ürünü olduğu için korunanlar: ' + kept.join(', ')
        : 'Bankalarınız kaydedildi.');
    });

    paintList();
    paintCount();
    body.append(search, count, list, customWrap, save);
    box.appendChild(body);
  });
}
