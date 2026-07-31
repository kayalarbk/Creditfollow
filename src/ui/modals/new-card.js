import { CONFIG } from '../../config.js';
import { Store } from '../../core/store.js';
import { Calc } from '../../core/calc.js';
import { el } from '../../utils/dom.js';
import { fmtTL, parseAmount } from '../../utils/format.js';
import { openModal, closeModal, modalHeader, field, input, select, primaryButton, showErr, clearErrs } from '../modal.js';
import { bankSelect } from '../bank-select.js';
import { renderAll } from '../router.js';
import { toast } from '../toast.js';
import { warnExceededGroups } from './limit-groups.js';

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

    const bank = bankSelect(editing ? editing.bankId : null);

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

    /*
     * Ortak limit havuzu seçimi.
     * Havuz tek bankaya ait olduğu için seçenekler seçili bankaya göre süzülür;
     * banka değişince seçim sıfırlanır. Yeni havuz, modal değiştirmeden
     * (form verisi kaybolmasın diye) buradaki iki alanla oluşturulur.
     */
    const NEW_GROUP = '__newgroup__';
    const groupSel = select();
    const newGroupWrap = el('div', 'space-y-2 hidden');
    const newGroupName = input({ type: 'text', placeholder: 'Havuz adı, örn. Ortak limit', maxlength: '40' });
    const newGroupLimit = input({ type: 'text', inputmode: 'decimal', placeholder: 'Ortak limit (₺), örn. 100.000' });
    newGroupWrap.append(newGroupName, newGroupLimit);
    const groupHint = el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5');

    const bankSelEl = bank.wrap.querySelector('select');
    const currentBankId = () => (bankSelEl.value && bankSelEl.value !== '__new__' ? bankSelEl.value : null);

    const paintGroupState = () => {
      const isNew = groupSel.value === NEW_GROUP;
      const picked = isNew ? null : Store.limitGroup(groupSel.value);
      newGroupWrap.classList.toggle('hidden', !isNew);

      // Havuzdaki kartın limiti havuzdan gelir; kendi limiti saklanır ama kullanılmaz
      const pooled = isNew || !!picked;
      limit.disabled = pooled;
      limit.classList.toggle('opacity-60', pooled);
      groupHint.textContent = picked
        ? 'Bu kart "' + picked.name + '" havuzunu kullanıyor: ortak limit ' + fmtTL.format(picked.sharedLimit) + '.'
        : isNew
          ? 'Yeni havuz oluşturulacak ve bu kart havuza alınacak.'
          : 'Kart kendi limitini kullanır. Aynı bankanın kartları tek limiti paylaşıyorsa havuz seçin.';
    };

    const paintGroups = (preferred) => {
      groupSel.textContent = '';
      const none = el('option', '', 'Havuz yok — kart kendi limitini kullanır');
      none.value = '';
      groupSel.appendChild(none);

      const bankId = currentBankId();
      Store.data.limitGroups
        .filter(g => g.bankId === bankId)
        .forEach(g => {
          const o = el('option', '', g.name + ' · ' + fmtTL.format(g.sharedLimit));
          o.value = g.id;
          groupSel.appendChild(o);
        });

      if (bankId) {
        const add = el('option', '', '+ Yeni havuz oluştur…');
        add.value = NEW_GROUP;
        groupSel.appendChild(add);
      }

      const exists = preferred && [...groupSel.options].some(o => o.value === preferred);
      groupSel.value = exists ? preferred : '';
      paintGroupState();
    };

    groupSel.addEventListener('change', paintGroupState);
    bankSelEl.addEventListener('change', () => paintGroups(null));
    paintGroups(editing ? editing.limitGroupId : null);

    /* Düzenlemede mevcut değerler yüklenir */
    if (editing) {
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

    const bankField = field('Banka', bank.wrap, 'err-bank');
    if (bank.hint) bankField.appendChild(el('p', 'text-xs text-gray-400 dark:text-gray-500 mt-1.5', bank.hint));

    const groupWrap = el('div', 'space-y-2');
    groupWrap.append(groupSel, newGroupWrap);
    const groupField = field('Limit havuzu', groupWrap, 'err-group');
    groupField.appendChild(groupHint);

    body.append(
      bankField,
      field('Kart etiketi', label),
      groupField,
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

      const bankV = bank.resolve();
      const stV = parseInt(stDay.value, 10);
      const duV = parseInt(duDay.value, 10);

      /* Havuz seçimi: mevcut havuz, yeni havuz ya da havuz yok */
      const wantsNewGroup = groupSel.value === NEW_GROUP;
      const pickedGroup = !wantsNewGroup && groupSel.value ? Store.limitGroup(groupSel.value) : null;
      const pooled = wantsNewGroup || !!pickedGroup;

      let newGroupLimitV = NaN;
      if (wantsNewGroup) {
        newGroupLimitV = parseAmount(newGroupLimit.value);
        if (!newGroupName.value.trim()) { showErr('err-group', 'Yeni havuza bir ad verin.'); valid = false; }
        else if (isNaN(newGroupLimitV) || newGroupLimitV <= 0) { showErr('err-group', 'Havuz için geçerli, pozitif bir ortak limit girin.'); valid = false; }
      }
      if (pickedGroup && pickedGroup.bankId !== bankV) {
        showErr('err-group', 'Seçilen havuz başka bir bankaya ait. Havuzu yeniden seçin.');
        valid = false;
      }

      // Havuzdaki kart kendi limitini kullanmaz; alan boşsa havuz limiti saklanır
      const poolLimit = wantsNewGroup ? newGroupLimitV : (pickedGroup ? pickedGroup.sharedLimit : NaN);
      const limitRaw = limit.value.trim();
      const limitV = pooled && limitRaw === '' ? poolLimit : parseAmount(limitRaw);

      if (!bankV) { showErr('err-bank', 'Bir banka seçin veya yeni banka adını yazın.'); valid = false; }
      if (isNaN(limitV) || limitV <= 0) {
        if (!pooled || !isNaN(poolLimit)) { showErr('err-limit', 'Geçerli, pozitif bir limit girin.'); valid = false; }
      }
      if (isNaN(stV) || stV < 1 || stV > 31) { showErr('err-st', '1–31 arası bir gün girin.'); valid = false; }
      if (isNaN(duV) || duV < 1 || duV > 31) { showErr('err-du', '1–31 arası bir gün girin.'); valid = false; }

      const intPct = interest.value.trim() === '' ? 0 : parseAmount(interest.value);
      if (isNaN(intPct) || intPct < 0 || intPct > 100) { showErr('err-int', '0–100 arası bir oran girin.'); valid = false; }

      let debtV = 0;
      if (!editing) {
        debtV = debt.value.trim() === '' ? 0 : parseAmount(debt.value);
        if (isNaN(debtV) || debtV < 0) { showErr('err-debt', 'Geçerli bir tutar girin (boş bırakılırsa 0).'); valid = false; }
      }
      const cardDebt = editing ? editing.currentDebt : debtV;

      if (pooled) {
        /*
         * Havuzda limit kontrolü kart bazında değil havuz bazında yapılır:
         * bu kartın borcu, havuzdaki diğer kartların borcuyla birlikte ortak limiti aşamaz.
         */
        const inSameGroup = editing && pickedGroup && editing.limitGroupId === pickedGroup.id;
        const othersDebt = pickedGroup
          ? Calc.groupDebt(pickedGroup.id) - (inSameGroup ? editing.currentDebt : 0)
          : 0;
        if (!isNaN(poolLimit) && !isNaN(cardDebt) && cardDebt + othersDebt > poolLimit) {
          showErr('err-group', 'Bu kartla birlikte havuzun borcu ' + fmtTL.format(cardDebt + othersDebt) +
            ' olur; ortak limit ' + fmtTL.format(poolLimit) + '. Havuz limitini yükseltin.');
          valid = false;
        }
      } else if (!editing) {
        if (!isNaN(limitV) && !isNaN(debtV) && debtV > limitV) { showErr('err-debt', 'Mevcut borç limiti aşamaz.'); valid = false; }
      } else if (!isNaN(limitV) && limitV < editing.currentDebt) {
        // Limit düşürülürken mevcut borcun altına inilemez
        showErr('err-limit', 'Limit güncel borcun (' + fmtTL.format(editing.currentDebt) + ') altına indirilemez.');
        valid = false;
      }
      if (!valid) return;

      /* Havuz kaydı karttan önce oluşturulur; kart doğrudan havuza bağlanabilsin diye */
      let groupId = pickedGroup ? pickedGroup.id : null;
      if (wantsNewGroup) {
        const created = Store.addLimitGroup({ bankId: bankV, name: newGroupName.value.trim(), sharedLimit: newGroupLimitV });
        if (!created) { showErr('err-group', 'Havuz oluşturulamadı.'); return; }
        groupId = created.id;
      }

      const saved = editing
        ? Store.updateCard(editing.id, {
            bankId: bankV,
            cardLabel: label.value.trim(),
            limit: limitV,
            limitGroupId: groupId,
            statementDay: stV,
            dueDay: duV,
            minPaymentRate: selectedRate,
            interestRate: intPct / 100
          })
        : Store.addCard({
            bankId: bankV,
            cardLabel: label.value.trim(),
            limit: limitV,
            limitGroupId: groupId,
            currentDebt: debtV,
            statementDay: stV,
            dueDay: duV,
            minPaymentRate: selectedRate,
            interestRate: intPct / 100
          });
      if (!saved) return;

      closeModal();
      renderAll();
      toast(editing ? 'Kart bilgileri güncellendi.' : Store.bankName(bankV) + ' kartı eklendi.');
      // Kartın borcu havuz kullanımına anında yansır; limit aşıldıysa hemen bildirilir
      warnExceededGroups();
    });
  });
}
