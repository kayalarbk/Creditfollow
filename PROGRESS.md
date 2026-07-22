# PROGRESS — Proje Hafızası

> **KALICI KURAL:** Bu dosya projenin hafızasıdır. Her güncelleme, yeni özellik,
> bug fix veya teknik karar sonrasında bu dosya GÜNCELLENMELİDİR.
> Güncelleme yapılmadan iş "bitti" sayılmaz.
>
> Ek kurallar:
> - Her oturuma başlarken önce bu dosya okunur, kalınan yerden devam edilir.
> - PROGRESS.md her güncellendiğinde, ilgili kod değişiklikleriyle **birlikte**
>   commit'lenir ve push'lanır. Commit mesajı formatı: `feat/fix/docs: kısa açıklama`
> - Push yapılmadan görev tamamlanmış sayılmaz / raporlanmaz.

Son güncelleme: 2026-07-22

---

## 1. Proje Özeti

**KartPanel** (repo: `Creditfollow`, npm adı: `kartpanel`) — kredi kartı borcu, limit
kullanımı, avans hesap ve ihtiyaç kredisi takibini tek ekranda toplayan, tamamen
tarayıcıda çalışan panel.

- **Amaç:** Kullanıcının tüm banka ürünlerinin (kart / avans hesap / ihtiyaç kredisi)
  borcunu, kesim–son ödeme tarihlerini, asgari ödemesini ve harcama alışkanlığını
  tek yerde, sunucusuz ve hesapsız biçimde göstermek.
- **Teknoloji:** Vanilla JS (ES modülleri), Tailwind CDN, Chart.js benzeri elle yazılmış
  grafik katmanı (`src/ui/charts.js`), Font Awesome ikonları. Build adımı yok.
- **Veri:** `localStorage` (`kartpanel_data` anahtarı) + isteğe bağlı File System Access
  API ile otomatik dosya yedeği. Sunucuya hiçbir veri gitmez.
- **Çalıştırma:** `npm run dev` → http://localhost:5173 (ES modülleri nedeniyle
  `file://` ile açmak çalışmaz, statik sunucu şart).

---

## 2. Tamamlanan İşler (tarihli, özellik bazında)

| Tarih | Commit | İş |
|---|---|---|
| 2026-07-13 | `5038019` | İlk repo kurulumu |
| 2026-07-15 | `d011bc0` | index.html üzerinde tek dosyalık ilk uygulama sürümü |
| 2026-07-19 | `a81fe3d` | **refactor:** tek dosyalık uygulama katmanlı dosya yapısına ayrıldı (core / ui / utils / events) |
| 2026-07-20 | `f5447c6` | **feat:** otomatik dosya yedekleme (File System Access API) |
| 2026-07-20 | `53aee72` | **feat:** işlem yönetimi, taksit, kategori ve ekstre dönemi özellikleri |
| 2026-07-20 | `1cdba1e` | **feat:** kart düzenleme, borç mutabakatı, geri alma (undo), tekrarlayan işlemler, faiz projeksiyonu |
| 2026-07-20 | `f304337` | **feat:** klavye kısayolları, gecikme tespiti, tarih aralığı filtresi, erişilebilirlik iyileştirmeleri |
| 2026-07-20 | `de5d773` | **feat:** aylık harcama bütçesi, geçen ay karşılaştırması, filtreli CSV dışa aktarma |
| 2026-07-20 | `f43c904` | **fix:** binlik ayraçlı tutar girişi (`10.000`) yanlış ayrıştırılıyordu |
| 2026-07-20 | `3da2b37` | **fix:** asgari ödeme ekstre bazlı hesaplanıyor, ödendikçe düşüyor |
| 2026-07-20 | `53f36ac` | **fix:** taksitli harcama ekstreye taksit taksit yansıyor |
| 2026-07-22 | `91ba92e` | **feat:** avans hesap (kredili mevduat) ve ihtiyaç kredisi ürünleri; ürünler banka varlığı altında gruplandı |
| 2026-07-22 | (bu commit) | **docs:** PROGRESS.md proje hafızası dosyası eklendi |
| 2026-07-22 | (bu commit) | **fix:** geçmişe dönük borçla eklenen kartta, kart eklenmeden önce son ödeme günü geçmiş ekstre için gecikme uyarısı çıkmıyor; sonraki dönem bekleniyor |

### Mevcut özellik seti
- **Panel (dashboard):** toplam borç/limit donutu, borç seyri grafiği, yaklaşan ödemeler,
  asgari ödeme özeti, aylık bütçe ilerlemesi, geçen ay karşılaştırması, kategori dağılımı
- **Bankalar:** banka ayrı bir varlık; kart / avans / kredi banka altında gruplanır
- **Ürünler:** kredi kartı, avans hesap (kredili mevduat), ihtiyaç kredisi — her biri için
  ekleme, düzenleme ve detay modal'ı
- **İşlemler:** harcama/ödeme kaydı, taksit (1–12), kategori, ekstre dönemi eşlemesi,
  düzenleme, silme + geri alma, tekrarlayan işlemler
- **Takvim:** ay görünümünde hesap kesim ve son ödeme günleri
- **Bildirimler:** son ödeme tarihine N gün kala uyarı + gecikme tespiti (eşik ayarlanabilir)
- **Faiz projeksiyonu:** kart/avans bazında akdi faiz oranı ile borç projeksiyonu
- **Dışa/içe aktarma:** JSON yedek + filtreli CSV (Excel uyumlu)
- **Otomatik yedek:** File System Access API ile seçilen dosyaya sürekli yazma, veri
  boşsa dosyadan geri yükleme
- **Tema:** sistem tercihine göre koyu/açık, elle değiştirilebilir, flash önlemeli

---

## 3. Dosya Yapısı ve Rolleri

```
Creditfollow/
├── index.html                       # Yalnızca markup — mantık içermez
├── package.json                     # dev script (npx serve), tip: module
├── PROGRESS.md                      # ← bu dosya, proje hafızası
├── assets/
│   ├── css/app.css                  # Tailwind ile ifade edilemeyen özel stiller
│   └── js/
│       ├── theme-boot.js            # Render öncesi tema uygulaması (flash önleme)
│       └── tailwind.config.js       # Tailwind CDN yapılandırması
└── src/
    ├── main.js                      # Giriş noktası: Store.load → bindEvents → render → tekrarlayanlar → otomatik yedek
    ├── config.js                    # Tüm sabitler: eşikler, renkler, banka listesi, kategoriler, ürün türleri, taksit seçenekleri
    ├── events.js                    # Tüm DOM olay bağlamaları ve klavye kısayolları
    ├── core/
    │   ├── store.js                 # Tek veri kaynağı: localStorage CRUD + normalize() ile şema göçü/onarımı
    │   ├── calc.js                  # Tüm iş hesapları: ekstre dönemi, asgari ödeme, taksit, faiz projeksiyonu, özetler
    │   ├── backup.js                # JSON dışa/içe aktarma, otomatik geri yükleme kararı
    │   ├── autobackup.js            # File System Access API sarmalayıcı (izin, debounce'lu yazma)
    │   └── theme.js                 # Koyu/açık tema durumu
    ├── ui/
    │   ├── router.js                # Görünüm değiştirme (switchView) + renderAll
    │   ├── modal.js                 # Modal iskeleti + form yardımcıları (field/input/select/showErr)
    │   ├── bank-select.js           # Banka seçici (datalist + serbest metin)
    │   ├── charts.js                # Donut / çizgi / bar grafik çizimi
    │   ├── tx-row.js                # Tek işlem satırı bileşeni
    │   ├── notifications.js         # Bildirim zili ve uyarı listesi
    │   ├── toast.js                 # Geçici bildirim (ok/warn/danger) + undo aksiyonu
    │   ├── views/
    │   │   ├── dashboard.js         # Panel: widget'lar, kart listesi, son işlemler
    │   │   ├── transactions.js      # İşlem listesi + filtreler (tarih aralığı, kategori, kart)
    │   │   ├── calendar.js          # Aylık takvim görünümü
    │   │   └── settings.js          # Ayarlar: tema, eşik, bütçe, yedekleme
    │   └── modals/
    │       ├── banks.js             # Banka yönetimi
    │       ├── new-card.js / card-detail.js
    │       ├── new-overdraft.js / overdraft-detail.js
    │       ├── new-loan.js / loan-detail.js
    │       ├── new-transaction.js   # İşlem ekleme/düzenleme + silme onayı
    │       ├── reconcile-debt.js    # Gerçek borçla mutabakat
    │       └── recurring.js         # Tekrarlayan işlem tanımları
    └── utils/
        ├── dom.js                   # el/byId/clear yardımcıları
        └── format.js                # TL/tarih biçimleme, güvenli tarih, parseAmount, kategori/banka ikonu
```

Repo dışı (üst klasör `creditfallow/`): `kartpanel-otomatik-yedek.json` — otomatik yedek
çıktısı, versiyonlanmaz.

---

## 4. Önemli Teknik Kararlar ve Gerekçeleri

1. **Build adımı yok, vanilla JS + ES modülleri.** Kullanıcı uygulamayı kendi cihazında
   açıp kullanabilsin; kurulum/derleme gerektirmesin. Bedeli: `file://` ile açılamaz,
   statik sunucu gerekir.
2. **Sunucusuz, localStorage tek kaynak.** Finansal veri cihazdan çıkmaz; hesap/giriş yok.
3. **Katmanlı yapı: core → ui → events.** Hesap mantığı (`calc.js`) ile render tamamen
   ayrı; UI hesap yapmaz, core DOM bilmez. `events.js` tek bağlama noktası.
4. **`Store.normalize()` tek onarım noktası.** Dışarıdan gelen veri (eski yedek, elle
   düzenlenmiş JSON) render sırasında değil, tek bir yerde tamamlanır/temizlenir.
   Şema göçleri burada yapılır (ör. banka varlığının sonradan eklenmesi).
5. **Banka ayrı varlık (2026-07-22).** Önce kartta serbest metindi; avans ve kredi
   eklenince aynı bankanın ürünlerini gruplamak gerekti. Eski yedeklerdeki isimlerden
   `ensureBank()` ile banka kaydı üretilir, `bankName` gösterim kopyası olarak güncel tutulur.
6. **Faiz oranı ürün bazında düzenlenebilir.** TCMB tebliğiyle değiştiği için sabit
   gömülmez; `CONFIG.defaultInterestRate` / `defaultOverdraftRate` yalnızca varsayılan.
7. **Asgari ödeme ekstre bazlı.** Toplam borç üzerinden değil, dönem ekstresi üzerinden
   hesaplanır ve ödeme yapıldıkça düşer (bkz. `3da2b37`).
8. **Taksitli harcama ekstreye taksit taksit yansır**, tek seferde değil (`53f36ac`).
8b. **Kart eklenmeden kapanmış ekstre atlanır (2026-07-22).** `statementSummary()`,
   son ödeme tarihi `card.createdAt`'ten önceye düşen dönemi `preCard: true` ile
   `hasStatement: false` döndürür. Gerekçe: geçmişe dönük borçla kart girildiğinde
   o borç devreden bakiyedir, kullanıcının kaçırdığı bir ödeme değildir — uyarı
   üretmek yanlış alarmdır. Uyarı bir sonraki kesimden itibaren başlar.
9. **Otomatik yedek File System Access API ile.** İzin kalıcı değilse kullanıcıya
   "Yedek dosyasına bağlan" uyarısı gösterilir; tarayıcı verisi boşsa dosyadan geri yüklenir.
10. **Tüm metinler Türkçe**, para/tarih biçimlemesi `Intl` ile `tr-TR`.

---

## 5. Yapılacaklar (TODO)

- [ ] `README.md` çalışma alanında silinmiş durumda (`git status` → `D README.md`).
      Karar verilmeli: geri yüklensin mi, yoksa silme commit'lensin mi?
- [ ] Test altyapısı yok — en azından `calc.js` için birim testleri (ekstre dönemi,
      asgari ödeme, taksit dağılımı, faiz projeksiyonu) eklenmeli.
- [x] ~~`refactor/proje-yapisi` dalı `main`'e merge edilmedi; main geride.~~
      2026-07-22'de `main` ileri sarıldı (fast-forward) ve push'landı; iki dal da `2e787ef`.
      Not: çalışma dalı hâlâ `refactor/proje-yapisi`; yeni işler burada yapılıp
      `main` periyodik olarak ileri sarılıyor.
- [ ] Tailwind CDN kullanılıyor — çevrimdışı çalışmayı garanti etmiyor; yerel kopya
      veya build adımı değerlendirilmeli.
- [ ] İhtiyaç kredisi için ödeme planı (amortisman tablosu) detaylandırılabilir.
- [ ] Çoklu para birimi desteği yok (`settings.currency` var ama TRY sabit gibi davranıyor).
- [ ] Otomatik yedekte sürüm/çakışma yönetimi yok; aynı dosya birden fazla sekmeden
      yazılırsa son yazan kazanır.

## 6. Bilinen Buglar

- Şu an açık kayıtlı bug yok. (Yeni bug bulunduğunda buraya tarih + belirti + etkilenen
  dosya ile yazılmalı, çözülünce §2 tablosuna fix commit'i olarak taşınmalı.)
