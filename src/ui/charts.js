import { CONFIG } from '../config.js';
import { Calc } from '../core/calc.js';
import { byId } from '../utils/dom.js';
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
  trendRange: 30,

  /** Tema değişiminde grafikler renk paletiyle birlikte yeniden kurulur. */
  destroy() {
    if (this.donut) { this.donut.destroy(); this.donut = null; }
    if (this.trend) { this.trend.destroy(); this.trend = null; }
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

  /* ---------- yardımcılar ---------- */

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
