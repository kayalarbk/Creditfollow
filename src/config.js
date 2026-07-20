/**
 * Uygulama geneli sabitler.
 * Buradaki değerler iş mantığını belirler; UI metinleri ilgili modüllerde durur.
 */
export const CONFIG = {
  storageKey: 'kartpanel_data',
  usageThresholds: { warn: 0.5, danger: 0.8 },
  statusColors: { ok: '#30D158', warn: '#FFD60A', danger: '#FF453A' },
  accent: '#0A84FF',
  defaultThresholdDays: 5,
  minPaymentRates: [0.20, 0.40],
  cardGradients: [
    ['#1e3a8a', '#3b82f6'], ['#111827', '#4b5563'], ['#7c2d12', '#ea580c'],
    ['#14532d', '#22c55e'], ['#581c87', '#a855f7'], ['#831843', '#ec4899'],
    ['#0c4a6e', '#06b6d4'], ['#3f2d0c', '#ca8a04']
  ],
  banks: [
    'Ziraat Bankası', 'Türkiye İş Bankası', 'Garanti BBVA', 'Akbank', 'Yapı Kredi',
    'Halkbank', 'VakıfBank', 'QNB', 'DenizBank', 'TEB', 'ING', 'Şekerbank',
    'Kuveyt Türk', 'Albaraka Türk', 'Türkiye Finans', 'Vakıf Katılım', 'Ziraat Katılım',
    'Emlak Katılım', 'Fibabanka', 'Odeabank', 'Anadolubank', 'Alternatif Bank',
    'Burgan Bank', 'ICBC Turkey', 'HSBC', 'Enpara.com', 'Papara', 'CEPTETEB', 'Diğer'
  ],
  bankIcons: [
    { match: ['garanti'], icon: 'fa-building-columns' },
    { match: ['ziraat'], icon: 'fa-wheat-awn' },
    { match: ['yapı', 'yapi'], icon: 'fa-building' },
    { match: ['akbank'], icon: 'fa-landmark' },
    { match: ['iş', 'is bank', 'işbank'], icon: 'fa-briefcase' },
    { match: ['qnb', 'finans'], icon: 'fa-globe' },
    { match: ['vakıf', 'vakif'], icon: 'fa-landmark-dome' },
    { match: ['halk'], icon: 'fa-people-group' },
    { match: ['deniz'], icon: 'fa-water' },
    { match: ['enpara', 'papara', 'dijital'], icon: 'fa-mobile-screen' }
  ],
  monthNames: ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'],

  /* Harcama kategorileri — id veri dosyasına yazılır, label ve renk yalnızca gösterim içindir */
  categories: [
    { id: 'market', label: 'Market', icon: 'fa-basket-shopping', color: '#30D158' },
    { id: 'yemek', label: 'Yeme & içme', icon: 'fa-utensils', color: '#FF9F0A' },
    { id: 'ulasim', label: 'Ulaşım & yakıt', icon: 'fa-car', color: '#0A84FF' },
    { id: 'fatura', label: 'Fatura & abonelik', icon: 'fa-file-invoice', color: '#5E5CE6' },
    { id: 'giyim', label: 'Giyim', icon: 'fa-shirt', color: '#FF375F' },
    { id: 'saglik', label: 'Sağlık', icon: 'fa-heart-pulse', color: '#FF453A' },
    { id: 'eglence', label: 'Eğlence', icon: 'fa-film', color: '#BF5AF2' },
    { id: 'elektronik', label: 'Elektronik', icon: 'fa-laptop', color: '#64D2FF' },
    { id: 'egitim', label: 'Eğitim', icon: 'fa-graduation-cap', color: '#FFD60A' },
    { id: 'diger', label: 'Diğer', icon: 'fa-tag', color: '#8E8E93' }
  ],

  /* Taksit seçenekleri (1 = tek çekim) */
  installmentOptions: [1, 2, 3, 6, 9, 12]
};
