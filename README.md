# KartPanel

Kredi kartı borçlarını, limit kullanımını ve ödeme tarihlerini tek ekranda toplayan,
tamamen tarayıcıda çalışan panel. Sunucu, hesap veya kurulum gerektirmez —
tüm veriler `localStorage` içinde, yalnızca kullanıcının cihazında durur.

## Özellikler

- **Panel** — toplam borç/limit donutu, borç seyri grafiği, yaklaşan ödeme ve asgari ödeme özetleri
- **Kartlar** — banka, limit, hesap kesim/son ödeme günü ve asgari ödeme oranı ile kart yönetimi
- **İşlemler** — harcama ve ödeme kaydı; kart borcuna anında yansır
- **Takvim** — ay görünümünde hesap kesim ve son ödeme günleri
- **Bildirimler** — son ödeme tarihine N gün kala uyarı (eşik ayarlanabilir)
- **Yedekleme** — JSON dışa/içe aktarma
- **Koyu tema** — sistem tercihine göre otomatik, elle değiştirilebilir

## Çalıştırma

ES modülleri kullanıldığı için dosyayı çift tıklayarak (`file://`) açmak yeterli değildir;
basit bir statik sunucu gerekir:

```bash
npm run dev          # http://localhost:5173
# veya
python -m http.server 5173
```

## Dizin yapısı

```
.
├── index.html                  # Yalnızca işaretleme (markup) — mantık içermez
├── assets/
│   ├── css/app.css             # Tailwind ile ifade edilemeyen özel stiller
│   └── js/
│       ├── theme-boot.js       # Render öncesi tema uygulaması (flash önleme)
│       └── tailwind.config.js  # Tailwind CDN yapılandırması
└── src/
    ├── main.js                 # Giriş noktası (init)
    ├── config.js               # Sabitler: eşikler, renkler, banka listesi
    ├── events.js               # Tüm DOM olay bağlantıları
    ├── core/                   # DOM'dan bağımsız iş katmanı
    │   ├── store.js            # localStorage CRUD — tek veri kaynağı
    │   ├── calc.js             # Tarih ve finans hesapları (saf fonksiyonlar)
    │   ├── theme.js            # Açık/koyu tema
    │   └── backup.js           # JSON dışa/içe aktarma
    ├── ui/                     # Render katmanı
    │   ├── router.js           # Görünüm geçişi + renderAll()
    │   ├── charts.js           # Chart.js donut ve trend grafikleri
    │   ├── toast.js            # Geçici bildirimler
    │   ├── notifications.js    # Bildirim çanı
    │   ├── modal.js            # Modal kabuğu ve form yapı taşları
    │   ├── modals/             # new-card · new-transaction · card-detail
    │   └── views/              # dashboard · calendar · settings
    └── utils/
        ├── dom.js              # el() / byId() / clear()
        └── format.js           # Para-tarih biçimleri, tutar ayrıştırma
```

### Katman kuralları

- `core/` DOM'a dokunmaz (tek istisna: `toast` ile kullanıcıya hata bildirimi).
- `ui/` veriyi yalnızca `Store` ve `Calc` üzerinden okur; hesap yapmaz.
- Veri değişiminden sonra `renderAll()` çağrılır — kısmi güncelleme yoktur.
- Yeni sabit mi eklenecek? Kod içine değil, `src/config.js` içine.

## Bilinen sınırlar

- Tailwind CDN üzerinden yüklenir; üretim için Tailwind CLI ile derlenmesi önerilir.
- Veriler yalnızca tek tarayıcıda tutulur — cihazlar arası senkronizasyon yoktur,
  bu yüzden düzenli JSON yedeği alınmalıdır.

## Lisans

MIT
