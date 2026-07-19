/**
 * Tailwind CDN yapılandırması.
 * CDN script'inden SONRA, senkron olarak yüklenmelidir.
 * Not: CDN üretim için önerilmez; kalıcı çözüm için Tailwind CLI ile derleyin.
 */
tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'] },
      colors: {
        app: { light: '#F5F5F7', dark: '#0A0A0C' },
        surface: { light: '#FFFFFF', dark: '#1C1C1E' },
        elev: { light: '#FAFAFC', dark: '#2C2C2E' },
        ok: '#30D158', warn: '#FFD60A', danger: '#FF453A',
        accent: '#0A84FF'
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)',
        cardDark: '0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.5)',
        pop: '0 12px 40px rgba(0,0,0,.18)'
      },
      borderRadius: { xl2: '1.25rem' }
    }
  }
};
