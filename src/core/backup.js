import { Store } from './store.js';
import { Theme } from './theme.js';
import { renderAll } from '../ui/router.js';
import { renderSettings } from '../ui/views/settings.js';
import { toast } from '../ui/toast.js';

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

        Store.data = Object.assign(Store.defaults(), parsed);
        Store.data.settings = Object.assign(Store.defaults().settings, parsed.settings || {});
        if (!Store.save()) return;

        Theme.apply(Store.data.settings.theme);
        renderAll();
        renderSettings();
        toast('Yedek başarıyla geri yüklendi.');
      } catch (e) {
        toast('Dosya okunamadı: geçerli bir KartPanel yedeği değil.', 'danger');
      }
    };
    reader.onerror = () => toast('Dosya okunurken hata oluştu.', 'danger');
    reader.readAsText(file);
  }
};
