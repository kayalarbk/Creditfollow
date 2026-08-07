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

Son güncelleme: 2026-08-07

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
| 2026-08-01 | `fe6d283` | **feat:** ortak limit havuzu — aynı bankanın birden fazla kartı tek limiti paylaşabiliyor (`limitGroups`, `schemaVersion: 2`, göç zinciri, havuz yönetim modalı, panelde havuz bloğu) |
| 2026-08-07 | (bu commit) | **docs:** `main` `58a2680`'e ileri sarıldı ve push'landı — site (GitHub Pages) `main`'den yayınlandığı için 08-01 işleri canlıya yansımamıştı; deploy doğrulandı |
| 2026-08-01 | (bu commit) | **feat:** ürün türüne göre ayrı faiz motoru (`core/interest.js`) + 32 birim testi; vergi oranları ürün bazında düzenlenebilir, kredi amortisman tablosu ve erken kapama |

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
- **Ortak limit havuzu:** aynı bankanın kartları tek limiti paylaşabilir; toplam limit
  havuzu bir kez sayar, kullanılabilir limit havuzun tamamından hesaplanır, kartların
  kesim/son ödeme tarihleri ayrı kalır
- **Faiz motoru:** ürün türüne göre ayrı hesap — kartta ekstre dönemi bazlı akdi/gecikme
  faizi, avans hesapta günlük işleyen ve dönem sonunda anaparaya eklenen bileşik faiz,
  kredide annüite amortisman tablosu + erken kapama. Faiz ve vergi (KKDF/BSMV) ayrı satır.
- **Dışa/içe aktarma:** JSON yedek + filtreli CSV (Excel uyumlu)
- **Otomatik yedek:** File System Access API ile seçilen dosyaya sürekli yazma, veri
  boşsa dosyadan geri yükleme
- **Tema:** sistem tercihine göre koyu/açık, elle değiştirilebilir, flash önlemeli

---

## 3. Dosya Yapısı ve Rolleri

```
Creditfollow/
├── index.html                       # Yalnızca markup — mantık içermez
├── package.json                     # dev + test script (node --test), tip: module
├── test/
│   └── interest.test.js             # Faiz motoru birim testleri — `npm test`, harici bağımlılık yok
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
    │   ├── calc.js                  # Tüm iş hesapları: ekstre dönemi, asgari ödeme, taksit, özetler
│   ├── interest.js              # Faiz motoru: kart / avans / kredi ayrı formüller + vergiler (saf, Store'suz)
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
    │   ├── rate-fields.js           # Ürün formlarının ortak "gelişmiş oranlar" bölümü (gecikme faizi, KKDF, BSMV)
    │   ├── disclaimer.js            # "Hesaplama aracıdır, tavsiye değildir" notu — tek metin, tek yer
    │   ├── views/
    │   │   ├── dashboard.js         # Panel: widget'lar, kart listesi, son işlemler
    │   │   ├── transactions.js      # İşlem listesi + filtreler (tarih aralığı, kategori, kart)
    │   │   ├── calendar.js          # Aylık takvim görünümü
    │   │   └── settings.js          # Ayarlar: tema, eşik, bütçe, yedekleme
    │   └── modals/
    │       ├── banks.js             # Banka yönetimi
│       ├── limit-groups.js      # Ortak limit havuzu yönetimi + limit aşımı uyarısı
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
11. **Şema sürümü ve göç zinciri (2026-08-01).** `CONFIG.schemaVersion` veri şemasının
    sürümüdür; `Store.migrations` sürüm sürüm adımlar içerir ve yalnızca
    `Store.runMigrations()` üzerinden, `normalize()` içinde çalışır. Gerekçe: eksik alan
    tamamlama render sırasında dağılmasın, eski yedekler tek noktadan güncel şemaya taşınsın.
12. **Ortak limit havuzu (2026-08-01).** Aynı bankanın kartları tek limiti paylaşabildiği
    için kart başına `limit` toplamı yanıltıcıydı. Yeni varlık `limitGroups`
    (`{ id, bankId, name, sharedLimit, createdAt }`) ve kartta `limitGroupId`.
    Kararlar:
    - Havuz **tek bankaya** bağlıdır; kartın bankası değişirse/silinirse bağ kopar
      (`Store.validateCardGroup`, `normalize()` ve `pruneLimitGroups()`).
    - Kartın kendi `limit` değeri havuzdayken de **saklanır**; havuzdan çıkınca
      kart eski limitine döner (veri kaybı olmasın diye alan hiç sıfırlanmaz).
    - `Calc.totalLimit()` havuz limitini bir kez sayar; panel donutu ve kullanım oranı
      kart limitlerini toplamaz. `Calc.availableLimit(cardId)` havuzdaki kart için
      havuzun tamamından havuzdaki tüm kartların borcunu düşer.
    - Limit ortaktır, **ekstre değil**: her kartın kesim ve son ödeme tarihi kendi
      satırında ayrı görünmeye devam eder.
    - Boş kalan havuz silinmez, uyarı gösterilir (kullanıcı kartı geri alabilir).
    - Harcama/mutabakat limit kontrolleri havuzdaki kart için ortak limite bakar.
13. **Faiz motoru ürün türüne göre ayrıldı (2026-08-01).** Kart, avans ve kredi aynı
    projeksiyon formülünü kullanıyordu; sapma vade uzadıkça büyüyordu. Yeni dosya
    `src/core/interest.js`:
    - **Saf ve bağımsız:** DOM, `Store` ve hatta `CONFIG` bilmez; oranlar ve tarihler
      parametre olarak gelir. Bu sayede Node altında doğrudan import edilip test edilebiliyor
      (`core/` diğer modülleri `store.js → ui/toast.js` üzerinden DOM'a bağlı).
    - **Kart:** faiz ekstre dönemi bazında işler. Tamamı ödenirse faiz yok; asgari ödenmezse
      yalnızca **ödenmeyen asgari kısma** gecikme faizi, kalanına akdi faiz. Nakit avans için
      işlem tarihinden itibaren gün bazlı faiz (`cashAdvanceInterest`).
    - **Avans hesap:** `kullanılan × (yıllık oran / 365) × gün`. Her hareket bir bakiye kırılım
      noktasıdır (`balanceSegments`); dönem sonunda tahakkuk anaparaya eklenir (bileşik).
      Saklanan oran aylıktır, günlük hesap için 12 ile çarpılıp 365'e bölünür.
    - **Kredi:** annüite amortisman tablosu. Faiz oranı veri modelinde **tutulmaz**; kullanıcı
      taksiti bilir, oranı çoğu zaman bilmez. Oran taksit/anapara/vadeden ikili aramayla
      türetilir (`impliedMonthlyRate`) — annüite formülünün kapalı tersi yoktur.
    - **Vergi yönü türe göre farklıdır:** kart ve avansta oran vergisiz ilan edildiği için
      KKDF/BSMV faizin **üstüne** eklenir; kredide taksit vergi dahil ilan edildiği için
      vergi faizin **içinden** ayrıştırılır. Aksi hâlde kredide çift sayım olurdu.
14. **Vergi oranları config'te, ürün bazında override edilebilir (2026-08-01).**
    `CONFIG.taxRates` yalnızca varsayılan; her üründe `kkdfRate`/`bsmvRate`, kartta ayrıca
    `overdueRate` alanı var ve form üzerinden değiştirilebiliyor (`ui/rate-fields.js`,
    üç formda ortak). Mevzuat değiştiğinde kod değişmesi gerekmesin diye.
    Çıktılarda faiz ve vergi ayrı satır: kullanıcı ekstresiyle karşılaştırabilsin.
15. **Ton: hesaplama, tavsiye değil (2026-08-01).** Faiz/senaryo gösteren her kutunun
    altında `ui/disclaimer.js` metni durur. Metin tek yerde tutulur ki tüm ekranlarda
    aynı dille çıksın.

---

## 5. Yapılacaklar (TODO)

- [ ] `README.md` çalışma alanında silinmiş durumda (`git status` → `D README.md`).
      Karar verilmeli: geri yüklensin mi, yoksa silme commit'lensin mi?
- [x] ~~Test altyapısı yok.~~ 2026-08-01: `npm test` (`node --test`, harici bağımlılık yok)
      ve `test/interest.test.js` eklendi — 32 test: gün sayımı sınırları, artık yıl, günlük
      faiz, annüite/amortisman tutarlılığı, ekstre tamamı ödendiğinde faiz sıfır, asgari altı
      ödemede gecikme faizi, erken kapama.
- [ ] `calc.js` hâlâ test edilemiyor: `store.js` → `ui/toast.js` üzerinden DOM'a bağlı.
      Test edilebilmesi için Store'un toast bağımlılığı enjekte edilebilir hâle gelmeli
      (ör. `Store.onError` geri çağrısı). Faiz mantığı `interest.js`'e taşındığı için
      aciliyeti azaldı.
- [ ] Ortak limit havuzu yalnızca kredi kartlarını kapsıyor; avans hesabın da aynı
      havuza girdiği bankalar var mı, kullanıcı geri bildirimiyle değerlendirilecek.
- [x] ~~`refactor/proje-yapisi` dalı `main`'e merge edilmedi; main geride.~~
      2026-07-22'de `main` ileri sarıldı (fast-forward) ve push'landı; iki dal da `2e787ef`.
      2026-08-07'de tekrar ileri sarıldı; iki dal da `58a2680`.
      Not: çalışma dalı hâlâ `refactor/proje-yapisi`; yeni işler burada yapılıp
      `main` periyodik olarak ileri sarılıyor.
      **DİKKAT — deploy kuralı:** Site GitHub Pages ile `main` dalından yayınlanıyor
      (https://kayalarbk.github.io/Creditfollow/). Çalışma dalına push etmek canlıyı
      GÜNCELLEMEZ; iş bittiğinde ayrıca
      `git push origin refactor/proje-yapisi:main` çalıştırılmalı.
      2026-08-01 işlerinin sitede görünmemesinin sebebi buydu.
- [ ] Tailwind CDN kullanılıyor — çevrimdışı çalışmayı garanti etmiyor; yerel kopya
      veya build adımı değerlendirilmeli.
- [x] ~~İhtiyaç kredisi için ödeme planı (amortisman tablosu) detaylandırılabilir.~~
      2026-08-01: kredi detayında taksit bazlı amortisman tablosu (anapara/faiz/vergi/kalan)
      ve erken kapama tutarı eklendi.
- [ ] Nakit avans faizi (`Interest.cashAdvanceInterest`) motorda var ama işlem formunda
      "nakit avans" işareti yok; işlem türüne alan eklenince bağlanacak.
- [ ] Çoklu para birimi desteği yok (`settings.currency` var ama TRY sabit gibi davranıyor).
- [ ] Otomatik yedekte sürüm/çakışma yönetimi yok; aynı dosya birden fazla sekmeden
      yazılırsa son yazan kazanır.

## 6. Bilinen Buglar

- Şu an açık kayıtlı bug yok. (Yeni bug bulunduğunda buraya tarih + belirti + etkilenen
  dosya ile yazılmalı, çözülünce §2 tablosuna fix commit'i olarak taşınmalı.)
