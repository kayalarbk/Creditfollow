import { Store } from './store.js';
import { Theme } from './theme.js';
import { safeDate, dateSort, category } from '../utils/format.js';
import { renderAll } from '../ui/router.js';
import { renderSettings } from '../ui/views/settings.js';
import { toast } from '../ui/toast.js';

/** Excel'in dosyayı UTF-8 olarak tanıması için gereken bayt sırası işareti. */
const BOM = '\uFEFF';

/** CSV hücresi: ayraç, tırnak veya satır sonu içeriyorsa tırnaklanır. */
function csvCell(value) {
  const s = String(value == null ? '' : value);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Otomatik yedek dosyasından okunan veriyi, yalnızca tarayıcıdaki veri boşsa uygular.
 * Tarayıcıda veri varsa dosya değil tarayıcı esas alınır (dosya bir sonraki kayıtta güncellenir).
 * Dönüş: geri yükleme yapıldıysa true.
 */
export function applyAutoRestore(parsed) {
  if (!parsed) return false;
  const filled = d => ['cards', 'overdrafts', 'loans', 'transactions']
    .some(k => Array.isArray(d[k]) && d[k].length > 0);
  const hasLocal = filled(Store.data);
  const hasFile = filled(parsed);
  if (hasLocal || !hasFile) return false;

  Store.data = Store.normalize(parsed);
  Store.save();
  Theme.apply(Store.data.settings.theme);
  renderAll();
  renderSettings();
  toast('Verileriniz otomatik yedek dosyasından geri yüklendi.');
  return true;
}

/** JSON dışa/içe aktarma. Veri yalnızca tarayıcıda durduğu için tek kurtarma yolu. */
export const Backup = {
  exportJSON() {
    Store.data.settings.lastExport = new Date().toISOString();
    Store.save();

    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kredi-karti-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);

    renderSettings();
    toast('Yedek dosyası indirildi.');
  },

  /**
   * İşlemleri Excel'in Türkçe yerel ayarıyla uyumlu CSV olarak indirir:
   * noktalı virgül ayraç, virgüllü ondalık ve UTF-8 BOM (Türkçe karakterler için).
   */
  exportCSV(list) {
    // Liste verilirse (ör. işlemler görünümündeki aktif filtreler) yalnızca o kayıtlar aktarılır
    const source = Array.isArray(list) ? list : Store.data.transactions;
    const txs = [...source].sort((a, b) => dateSort(a.date) - dateSort(b.date));
    if (txs.length === 0) { toast('Dışa aktarılacak işlem yok.', 'warn'); return; }

    const headers = ['Tarih', 'Kart', 'Tür', 'Kategori', 'Açıklama', 'Tutar', 'Taksit'];
    const rows = txs.map(t => {
      const card = Store.data.cards.find(c => c.id === t.cardId);
      const d = safeDate(t.date);
      return [
        d ? d.toLocaleDateString('tr-TR') : '',
        card ? card.bankName + (card.cardLabel ? ' — ' + card.cardLabel : '') : 'Silinmiş kart',
        t.type === 'expense' ? 'Harcama' : 'Ödeme',
        t.type === 'expense' ? category(t.category).label : '',
        t.description || '',
        // Excel tr-TR ondalık ayracı virgüldür
        t.amount.toFixed(2).replace('.', ','),
        t.installments > 1 ? String(t.installments) : '1'
      ];
    });

    const csv = [headers, ...rows]
      .map(cols => cols.map(csvCell).join(';'))
      .join('\r\n');

    // BOM (U+FEFF) olmadan Excel UTF-8'i tanımaz, Türkçe karakterler bozulur
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kartpanel-islemler-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    toast(txs.length + ' işlem CSV olarak indirildi.');
  },

  importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.cards) || !Array.isArray(parsed.transactions)) throw new Error('schema');

        // Temel şema doğrulama
        const validCards = parsed.cards.every(c => c && typeof c.bankName === 'string' && typeof c.limit === 'number');
        if (!validCards) throw new Error('schema');

        if (!confirm('Mevcut tüm veriler bu yedekle DEĞİŞTİRİLECEK. Devam edilsin mi?')) return;

        // normalize(): eksik/bozuk alanları telafi eder, sahipsiz işlemleri ayıklar
        const clean = Store.normalize(parsed);
        const dropped = parsed.transactions.length - clean.transactions.length;

        Store.data = clean;
        if (!Store.save()) return;

        Theme.apply(Store.data.settings.theme);
        renderAll();
        renderSettings();
        toast(dropped > 0
          ? 'Yedek geri yüklendi. ' + dropped + ' geçersiz işlem kaydı atlandı.'
          : 'Yedek başarıyla geri yüklendi.', dropped > 0 ? 'warn' : 'ok');
      } catch (e) {
        toast('Dosya okunamadı: geçerli bir KartPanel yedeği değil.', 'danger');
      }
    };
    reader.onerror = () => toast('Dosya okunurken hata oluştu.', 'danger');
    reader.readAsText(file);
  }
};
