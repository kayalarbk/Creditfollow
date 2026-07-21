import { CONFIG } from '../config.js';
import { Store } from '../core/store.js';
import { el } from '../utils/dom.js';
import { input, select } from './modal.js';

const NEW = '__new__';

/**
 * Kart, avans hesap ve kredi modallarının ortak banka seçicisi.
 *
 * Öncelik kullanıcının Ayarlar'da seçtiği bankalardır; listede olmayan bir banka
 * gerektiğinde ürünü eklemek için ayarlara dönmek zorunda kalmasın diye
 * buradan da eklenebilir ve seçim anında kalıcı banka listesine girer.
 *
 * Dönüş: { wrap, resolve } — resolve() banka id'si döner, geçersizse null.
 */
export function bankSelect(selectedId) {
  const wrap = el('div', 'space-y-2');
  const sel = select();

  const ph = el('option', '', 'Banka seçin…');
  ph.value = ''; ph.disabled = true; ph.selected = true;
  sel.appendChild(ph);

  Store.data.banks.forEach(b => {
    const o = el('option', '', b.name);
    o.value = b.id;
    sel.appendChild(o);
  });

  const addOpt = el('option', '', '+ Listede yok, yeni banka ekle…');
  addOpt.value = NEW;
  sel.appendChild(addOpt);

  /* Yeni banka: bilinen bankalar için datalist, tamamen serbest metne de izin verilir */
  const custom = input({ type: 'text', placeholder: 'Banka adı', maxlength: '40', list: 'bankNameList' });
  custom.classList.add('hidden');

  if (!document.getElementById('bankNameList')) {
    const dl = el('datalist');
    dl.id = 'bankNameList';
    CONFIG.banks.forEach(name => {
      const o = el('option');
      o.value = name;
      dl.appendChild(o);
    });
    document.body.appendChild(dl);
  }

  sel.addEventListener('change', () => {
    const isNew = sel.value === NEW;
    custom.classList.toggle('hidden', !isNew);
    if (isNew) custom.focus();
  });

  if (selectedId && Store.data.banks.some(b => b.id === selectedId)) sel.value = selectedId;

  wrap.append(sel, custom);

  return {
    wrap,
    hint: Store.data.banks.length === 0
      ? 'Henüz banka eklemediniz. Ayarlar → Bankalarım\'dan toplu seçebilir veya buradan tek tek ekleyebilirsiniz.'
      : null,
    resolve() {
      if (sel.value === NEW) {
        const bank = Store.ensureBank(custom.value);
        return bank ? bank.id : null;
      }
      return sel.value || null;
    }
  };
}
