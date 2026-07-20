import { Store } from './store.js';
import { Charts } from '../ui/charts.js';

/**
 * Açık/koyu tema. Chart.js renkleri seçenek nesnesine gömüldüğü için
 * tema değişiminde grafikler yıkılıp yeniden kurulur.
 */
export const Theme = {
  apply(theme) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    Store.data.settings.theme = theme;
    Charts.destroy();
    if (Store.data.cards.length) {
      Charts.renderDonut();
      Charts.renderTrend();
      Charts.renderCategory();
      Charts.renderCardBreakdown();
    }
  },

  toggle() {
    this.apply(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
    Store.save();
  }
};
