import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, fmtTL0, parseAmount, bankIcon } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, primaryButton, showErr, clearErrs } from '../modal.js';
import { bankSelect } from '../bank-select.js';
import { renderAll } from '../router.js';
import { renderSettings } from '../views/settings.js';
import { toast } from '../toast.js';

/** Türkçe biçimli tutarı düzenleme alanına yazmak için ("1250.5" -> "1250,5"). */
function amountValue(n) {
  return typeof n === 'number' && n > 0 ? String(n).replace('.', ',') : '';
}

/**
 * Limiti aşan havuzlar için uyarı.
 * Havuz limiti kart eklerken değil, sonradan yapılan harcamalarla aşılır;
 * bu yüzden uyarı işlem kaydeden akışların sonunda çağrılır.
 */
export function warnExceededGroups() {
  const over = Calc.exceededLimitGroups();
  if (over.length === 0) return;

  const msg = over.length === 1
    ? '"' + over[0].group.name + '" havuzunun limiti aşıldı: ' +
      fmtTL.format(over[0].debt) + ' / ' + fmtTL.format(over[0].limit)
    : over.length + ' limit havuzunda limit aşıldı.';
  toast(msg, 'danger', { duration: 7000 });
}

/**
 * Ortak limit havuzları yönetimi.
 *
 * Aynı bankanın birden fazla kartı, hesap kesim tarihleri farklı olsa bile tek bir
 * limiti paylaşabilir. Havuz yalnızca limiti ortaklaştırır; her kartın ekstresi,
 * kesim ve son ödeme tarihi kendine aittir.
 */
export function limitGroupsModal() {
  openModal(box => {
    modalHeader(box, 'Ortak limit havuzları',
      'Aynı bankanın tek limiti paylaşan kartlarını bir havuzda toplayın. Ekstre tarihleri ayrı kalır.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const list = el('div', 'space-y-2');
    const groups = Store.data.limitGroups;

    if (groups.length === 0) {
      list.appendChild(el('p', 'text-sm text-gray-400 dark:text-gray-500 py-4 text-center',
        'Henüz havuz yok. Birden fazla kartınız aynı limiti paylaşıyorsa "Yeni havuz" ile tanımlayın.'));
    } else {
      groups
        .map(g => Calc.groupUtilization(g.id))
        .filter(Boolean)
        .sort((a, b) => b.limit - a.limit)
        .forEach(u => list.appendChild(buildGroupRow(u)));
    }

    const addBtn = primaryButton('+ Yeni havuz');
    addBtn.addEventListener('click', () => { closeModal(); limitGroupFormModal(); });

    body.append(list, addBtn);
    body.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500',
      'Havuzdaki kartın kendi limiti saklanır; havuzdan çıkarıldığında kart eski limitine döner.'));
    box.appendChild(body);
  });
}

/** Havuz listesindeki tek satır: doluluk, kart sayısı ve düzenle/sil düğmeleri. */
function buildGroupRow(u) {
  const row = el('div', 'rounded-xl bg-black/[.03] dark:bg-white/5 p-3 space-y-2');

  const head = el('div', 'flex items-center gap-3');
  const ic = el('div', 'w-9 h-9 rounded-xl bg-accent/10 text-accent grid place-items-center shrink-0');
  ic.appendChild(el('i', 'fa-solid ' + bankIcon(Store.bankName(u.group.bankId)) + ' text-sm'));

  const mid = el('div', 'min-w-0 flex-1');
  mid.append(
    el('p', 'text-sm font-semibold truncate', u.group.name),
    el('p', 'text-xs text-gray-500 dark:text-gray-400 truncate',
      Store.bankName(u.group.bankId) + ' · ' + u.cards.length + ' kart · ortak limit ' + fmtTL0.format(u.limit))
  );

  const actions = el('div', 'flex items-center gap-1 shrink-0');
  actions.append(
    iconBtn('fa-pen', 'Düzenle', () => { closeModal(); limitGroupFormModal(u.group.id); }),
    iconBtn('fa-trash-can', 'Sil', () => deleteGroup(u.group))
  );
  head.append(ic, mid, actions);

  const track = el('div', 'h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden');
  const fill = el('div', 'progress-fill h-full rounded-full');
  fill.style.width = Math.min(u.ratio * 100, 100) + '%';
  fill.style.backgroundColor = Calc.usageColor(u.ratio);
  track.appendChild(fill);

  const foot = el('div', 'flex justify-between text-xs');
  foot.append(
    el('span', 'text-gray-500 dark:text-gray-400',
      'Kullanılan ' + fmtTL0.format(u.debt) + ' · %' + Math.round(u.ratio * 100)),
    el('span', 'font-semibold num', 'Kullanılabilir ' + fmtTL0.format(u.available))
  );

  row.append(head, track, foot);

  if (u.cards.length === 0) {
    row.appendChild(el('p', 'text-xs text-warn font-semibold',
      'Bu havuzda kart yok; toplam limite katkı vermiyor.'));
  }
  if (u.over) {
    row.appendChild(el('p', 'text-xs text-danger font-semibold',
      'Havuz limiti ' + fmtTL0.format(u.debt - u.limit) + ' aşıldı.'));
  }
  return row;
}

function iconBtn(icon, label, onClick) {
  const b = el('button', 'w-8 h-8 rounded-lg grid place-items-center text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-accent transition-colors');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.setAttribute('title', label);
  b.appendChild(el('i', 'fa-solid ' + icon + ' text-xs'));
  b.addEventListener('click', onClick);
  return b;
}

function deleteGroup(group) {
  const snap = Store.snapshot();
  const count = Store.limitGroupCards(group.id).length;
  Store.deleteLimitGroup(group.id);
  closeModal();
  renderAll();
  renderSettings();

  toast('"' + group.name + '" havuzu silindi.' + (count > 0 ? ' Kartlar kendi limitlerine döndü.' : ''), 'warn', {
    duration: 8000,
    action: {
      label: 'Geri al',
      onClick: () => {
        Store.restore(snap);
        renderAll();
        renderSettings();
        toast('Havuz geri getirildi.');
      }
    }
  });
}

/**
 * Havuz ekleme/düzenleme formu.
 * opts.bankId verilirse banka sabitlenir (kart formundan açıldığında),
 * opts.onDone(group) kaydedilen havuzu çağırana bildirir.
 */
export function limitGroupFormModal(editId, opts = {}) {
  const editing = editId ? Store.limitGroup(editId) : null;
  if (editId && !editing) { toast('Havuz bulunamadı.', 'danger'); return; }
  const inline = typeof opts.onDone === 'function';

  openModal(box => {
    modalHeader(box,
      editing ? 'Havuzu düzenle' : 'Yeni limit havuzu',
      'Havuz tek bankaya aittir; yalnızca o bankanın kartları havuza alınabilir.');
    const body = el('div', 'px-6 pb-6 space-y-4');

    const lockedBankId = opts.bankId || (editing ? editing.bankId : null);
    const bank = bankSelect(lockedBankId);
    const name = input({ type: 'text', placeholder: 'örn. Ortak limit — Bonus', maxlength: '40' });
    const limit = input({ type: 'text', inputmode: 'decimal', placeholder: 'örn. 100.000' });

    if (editing) {
      name.value = editing.name;
      limit.value = amountValue(editing.sharedLimit);
    }

    /* Havuzdaki kartlar: yalnızca seçili bankanın kartları listelenir */
    const selected = new Set(editing ? Store.limitGroupCards(editing.id).map(c => c.id) : []);
    const cardList = el('div', 'space-y-1 max-h-56 overflow-y-auto -mx-1 px-1');

    const currentBankId = () => {
      const sel = bank.wrap.querySelector('select');
      return sel && sel.value && sel.value !== '__new__' ? sel.value : null;
    };

    const paintCards = () => {
      cardList.textContent = '';
      const bankId = currentBankId();
      const cards = bankId ? Store.data.cards.filter(c => c.bankId === bankId) : [];

      if (cards.length === 0) {
        cardList.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 py-3 text-center',
          bankId ? 'Bu bankada kayıtlı kart yok.' : 'Kartları görmek için önce banka seçin.'));
        return;
      }

      cards.forEach(c => {
        const other = c.limitGroupId && c.limitGroupId !== (editing ? editing.id : null)
          ? Store.limitGroup(c.limitGroupId)
          : null;

        const row = el('label', 'flex items-center gap-3 p-2.5 rounded-xl cursor-pointer hover:bg-black/5 dark:hover:bg-white/10 transition-colors');
        const cb = el('input');
        cb.type = 'checkbox';
        cb.className = 'w-4 h-4 rounded accent-accent shrink-0';
        cb.checked = selected.has(c.id);
        cb.addEventListener('change', () => {
          if (cb.checked) selected.add(c.id); else selected.delete(c.id);
        });

        const text = el('div', 'min-w-0 flex-1');
        text.appendChild(el('p', 'text-sm font-medium truncate',
          (c.cardLabel || 'Kart') + ' · ' + fmtTL0.format(c.currentDebt) + ' borç'));
        text.appendChild(el('p', 'text-[11px] text-gray-400 dark:text-gray-500 truncate',
          other
            ? 'Şu an "' + other.name + '" havuzunda; işaretlerseniz bu havuza taşınır'
            : 'Kendi limiti: ' + fmtTL0.format(c.limit)));

        row.append(cb, text);
        cardList.appendChild(row);
      });
    };

    const bankSel = bank.wrap.querySelector('select');
    bankSel.addEventListener('change', () => { selected.clear(); paintCards(); });
    if (lockedBankId) {
      bankSel.disabled = true;
      bankSel.classList.add('opacity-60', 'cursor-not-allowed');
    }
    paintCards();

    const bankField = field('Banka', bank.wrap, 'err-bank');
    if (lockedBankId) {
      bankField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5',
        'Havuzun bankası kartın bankasıyla aynı olmalıdır.'));
    }

    const limitField = field('Ortak limit (₺)', limit, 'err-limit');
    limitField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5',
      'Havuzdaki tüm kartların birlikte kullanabildiği toplam limit.'));

    const submit = primaryButton(editing ? 'Değişikliği kaydet' : 'Havuzu oluştur');

    body.append(
      bankField,
      field('Havuz adı', name, 'err-name'),
      limitField,
      field('Havuzdaki kartlar', cardList, 'err-cards'),
      submit
    );
    box.appendChild(body);

    submit.addEventListener('click', () => {
      clearErrs(box);
      let valid = true;

      const bankV = lockedBankId || bank.resolve();
      const limitV = parseAmount(limit.value);
      const nameV = name.value.trim();
      const picked = Store.data.cards.filter(c => selected.has(c.id) && c.bankId === bankV);
      const pickedDebt = picked.reduce((s, c) => s + c.currentDebt, 0);

      if (!bankV) { showErr('err-bank', 'Bir banka seçin.'); valid = false; }
      if (!nameV) { showErr('err-name', 'Havuza bir ad verin.'); valid = false; }
      if (isNaN(limitV) || limitV <= 0) { showErr('err-limit', 'Geçerli, pozitif bir limit girin.'); valid = false; }
      // Havuz limiti, havuza girecek kartların mevcut borcunun altına indirilemez
      else if (limitV < pickedDebt) {
        showErr('err-limit', 'Havuzdaki kartların güncel borcu ' + fmtTL.format(pickedDebt) +
          '; ortak limit bunun altına indirilemez.');
        valid = false;
      }
      if (!valid) return;

      let group = editing;
      if (editing) {
        if (!Store.updateLimitGroup(editing.id, { bankId: bankV, name: nameV, sharedLimit: limitV })) return;
      } else {
        group = Store.addLimitGroup({ bankId: bankV, name: nameV, sharedLimit: limitV });
        if (!group) return;
      }

      // Kart bağları: işaretliler havuza alınır, işareti kalkanlar kendi limitine döner
      Store.data.cards.forEach(c => {
        const shouldBeIn = selected.has(c.id) && c.bankId === bankV;
        if (shouldBeIn && c.limitGroupId !== group.id) Store.setCardLimitGroup(c.id, group.id);
        else if (!shouldBeIn && c.limitGroupId === group.id) Store.setCardLimitGroup(c.id, null);
      });

      closeModal();
      renderAll();
      renderSettings();
      toast(editing ? 'Havuz güncellendi.' : '"' + nameV + '" havuzu oluşturuldu.');
      warnExceededGroups();

      if (inline) opts.onDone(group);
      else if (!editing) limitGroupsModal();
    });
  });
}
