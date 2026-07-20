import { CONFIG } from '../config.js';
import { Calc } from '../core/calc.js';
import { el, byId, clear } from '../utils/dom.js';
import { fmtTL, fmtTL0, fmtDateShort } from '../utils/format.js';

/* Chart.js CDN üzerinden global olarak yüklenir */
const Chart = window.Chart;

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(20,20,22,.92)', padding: 10, cornerRadius: 10,
  titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter', weight: '600' }
};

const isDark = () => document.documentElement.classList.contains('dark');

export const Charts = {
  donut: null,
  trend: null,
  category: null,
  cardBreakdown: null,
  trendRange: 30,
  categoryRange: 30,

  /** Tema değişiminde grafikler renk paletiyle birlikte yeniden kurulur. */
  destroy() {
    if (this.donut) { this.donut.destroy(); this.donut = null; }
    if (this.trend) { this.trend.destroy(); this.trend = null; }
    if (this.category) { this.category.destroy(); this.category = null; }
    if (this.cardBreakdown) { this.cardBreakdown.destroy(); this.cardBreakdown = null; }
  },

  renderTrend() {
    const ctx = byId('trendChart');
    if (!ctx) return;
    const dark = isDark();
    const { labels, values } = Calc.debtSeries(this.trendRange);

    this._paintRangeButtons(dark);
    this._renderTrendSummary(values);

    const gridColor = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)';
    const tickColor = dark ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)';
    const dispLabels = labels.map(d => fmtDateShort.format(d));

    const dataset = {
      data: values,
      borderColor: CONFIG.accent,
      borderWidth: 2.5,
      pointRadius: values.length > 40 ? 0 : 3,
      pointHoverRadius: 5,
      pointBackgroundColor: CONFIG.accent,
      tension: 0.35,
      fill: true,
      backgroundColor: c => {
        const chart = c.chart;
        if (!chart.chartArea) return 'rgba(10,132,255,.08)';
        const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom);
        g.addColorStop(0, 'rgba(10,132,255,.22)');
        g.addColorStop(1, 'rgba(10,132,255,0)');
        return g;
      }
    };

    if (this.trend) {
      this.trend.data.labels = dispLabels;
      this.trend.data.datasets[0] = Object.assign(this.trend.data.datasets[0], dataset);
      this.trend.options.scales.x.ticks.color = tickColor;
      this.trend.options.scales.y.ticks.color = tickColor;
      this.trend.options.scales.y.grid.color = gridColor;
      this.trend.update();
      return;
    }

    this.trend = new Chart(ctx, {
      type: 'line',
      data: { labels: dispLabels, datasets: [dataset] },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({ callbacks: { label: c => ' Toplam borç: ' + fmtTL.format(c.parsed.y) } }, TOOLTIP_STYLE)
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, maxTicksLimit: 8, font: { family: 'Inter', size: 11 } } },
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: tickColor, font: { family: 'Inter', size: 11 }, callback: v => fmtTL0.format(v) }
          }
        }
      }
    });
  },

  renderDonut() {
    const ctx = byId('donutChart');
    if (!ctx) return;
    const t = Calc.totals();
    const debtColor = Calc.usageColor(t.usage);
    const trackColor = isDark() ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
    const split = t.debt > 0 && t.available > 0;

    const data = {
      labels: ['Güncel borç', 'Kullanılabilir limit'],
      datasets: [{
        data: t.limit > 0 ? [t.debt, t.available] : [0, 1],
        backgroundColor: [debtColor, trackColor],
        borderWidth: 0,
        borderRadius: split ? 10 : 0,
        spacing: split ? 3 : 0
      }]
    };

    if (this.donut) {
      this.donut.data = data;
      this.donut.update();
    } else {
      this.donut = new Chart(ctx, {
        type: 'doughnut',
        data,
        options: {
          cutout: '76%',
          maintainAspectRatio: false,
          animation: { duration: 700, easing: 'easeOutQuart' },
          plugins: {
            legend: { display: false },
            tooltip: Object.assign({ callbacks: { label: c => ' ' + c.label + ': ' + fmtTL.format(c.parsed) } }, TOOLTIP_STYLE)
          }
        }
      });
    }

    byId('donutCenter').textContent = fmtTL0.format(t.debt);
    byId('donutSub').textContent = 'Toplam limit ' + fmtTL0.format(t.limit) + ' · Kalan ' + fmtTL0.format(t.available);
  },

  renderCategory() {
    const ctx = byId('categoryChart');
    if (!ctx) return;
    const { items, total } = Calc.categoryBreakdown(this.categoryRange);

    this._paintCatRangeButtons(isDark());
    byId('categorySub').textContent = total > 0
      ? 'Toplam ' + fmtTL0.format(total) + ' · ' + items.length + ' kategori'
      : 'Bu aralıkta harcama yok.';

    this._renderSimpleLegend('categoryLegend', items,
      'Harcama ekledikçe kategori dağılımınız burada görünür.');

    const data = {
      labels: items.map(i => i.label),
      datasets: [{
        data: items.map(i => i.amount),
        backgroundColor: items.map(i => i.color),
        borderWidth: 0,
        borderRadius: items.length > 1 ? 6 : 0,
        spacing: items.length > 1 ? 2 : 0
      }]
    };

    // Veri yokken boş halka: Chart.js boş dataset'te hiçbir şey çizmez
    if (items.length === 0) {
      data.labels = ['Harcama yok'];
      data.datasets[0].data = [1];
      data.datasets[0].backgroundColor = [isDark() ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'];
    }

    if (this.category) {
      this.category.data = data;
      this.category.update();
      return;
    }

    this.category = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        cutout: '62%',
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({
            callbacks: {
              label: c => {
                const { items: cur, total: t } = Calc.categoryBreakdown(this.categoryRange);
                if (!cur.length) return ' Harcama yok';
                const pct = t > 0 ? Math.round((c.parsed / t) * 100) : 0;
                return ' ' + c.label + ': ' + fmtTL.format(c.parsed) + ' (%' + pct + ')';
              }
            }
          }, TOOLTIP_STYLE)
        }
      }
    });
  },

  renderCardBreakdown() {
    const ctx = byId('cardBreakdownChart');
    if (!ctx) return;
    const { items, total } = Calc.cardBreakdown();

    byId('cardBreakdownSub').textContent = total > 0
      ? 'Toplam ' + fmtTL0.format(total) + ' · ' + items.length + ' kartta borç var'
      : 'Hiçbir kartınızda borç yok. 🎉';

    this._renderSimpleLegend('cardBreakdownLegend', items,
      'Borcu olan kartlarınız burada listelenir.');

    const empty = items.length === 0;
    const data = {
      labels: empty ? ['Borç yok'] : items.map(i => i.label),
      datasets: [{
        data: empty ? [1] : items.map(i => i.amount),
        backgroundColor: empty
          ? [isDark() ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)']
          : items.map(i => i.color),
        borderWidth: 0,
        borderRadius: items.length > 1 ? 6 : 0,
        spacing: items.length > 1 ? 2 : 0
      }]
    };

    if (this.cardBreakdown) {
      this.cardBreakdown.data = data;
      this.cardBreakdown.update();
      return;
    }

    this.cardBreakdown = new Chart(ctx, {
      type: 'doughnut',
      data,
      options: {
        cutout: '62%',
        maintainAspectRatio: false,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: Object.assign({
            callbacks: {
              label: c => {
                const { total: t } = Calc.cardBreakdown();
                if (t <= 0) return ' Borç yok';
                const pct = Math.round((c.parsed / t) * 100);
                return ' ' + c.label + ': ' + fmtTL.format(c.parsed) + ' (%' + pct + ')';
              }
            }
          }, TOOLTIP_STYLE)
        }
      }
    });
  },

  /* ---------- yardımcılar ---------- */

  _paintCatRangeButtons(dark) {
    document.querySelectorAll('.cat-range-btn').forEach(b => {
      const on = parseInt(b.dataset.catrange, 10) === this.categoryRange;
      b.classList.toggle('bg-surface-light', on && !dark);
      b.classList.toggle('dark:bg-surface-dark', on);
      b.classList.toggle('shadow-card', on);
      b.classList.toggle('text-accent', on);
      b.classList.toggle('text-gray-500', !on);
      b.classList.toggle('dark:text-gray-400', !on);
    });
  },

  /**
   * Halka grafiğin yanındaki renk noktalı liste — pay oranıyla birlikte.
   * items: [{ label, amount, color, share }]
   */
  _renderSimpleLegend(boxId, items, emptyText) {
    const box = clear(byId(boxId));
    if (!items.length) {
      box.appendChild(el('p', 'text-sm text-gray-400 dark:text-gray-500', emptyText));
      return;
    }

    items.forEach(i => {
      const row = el('div', 'flex items-center gap-2.5');
      const dot = el('span', 'w-2.5 h-2.5 rounded-full shrink-0');
      dot.style.backgroundColor = i.color;

      const label = el('span', 'text-sm flex-1 min-w-0 truncate', i.label);
      const val = el('span', 'text-sm font-semibold num shrink-0', fmtTL0.format(i.amount));
      const pct = el('span', 'text-xs text-gray-500 dark:text-gray-400 num shrink-0 w-10 text-right',
        '%' + Math.round(i.share * 100));

      row.append(dot, label, val, pct);
      box.appendChild(row);
    });
  },

  _paintRangeButtons(dark) {
    document.querySelectorAll('.range-btn').forEach(b => {
      const on = parseInt(b.dataset.range, 10) === this.trendRange;
      b.classList.toggle('bg-surface-light', on && !dark);
      b.classList.toggle('dark:bg-surface-dark', on);
      b.classList.toggle('shadow-card', on);
      b.classList.toggle('text-accent', on);
      b.classList.toggle('text-gray-500', !on);
      b.classList.toggle('dark:text-gray-400', !on);
    });
  },

  /** Grafik altındaki "bu dönemde borcunuz …" özeti. */
  _renderTrendSummary(values) {
    const sub = byId('trendSub');
    if (!sub) return;
    if (values.length < 2) { sub.textContent = ''; return; }

    const diff = values[values.length - 1] - values[0];
    if (Math.abs(diff) < 0.01) sub.textContent = 'Bu dönemde borcunuz değişmedi.';
    else sub.textContent = diff > 0
      ? 'Bu dönemde borcunuz ' + fmtTL0.format(diff) + ' arttı.'
      : 'Bu dönemde borcunuzu ' + fmtTL0.format(-diff) + ' azalttınız. 👏';
    sub.classList.toggle('text-ok', diff < -0.01);
    sub.classList.toggle('text-danger', diff > 0.01);
  }
};
