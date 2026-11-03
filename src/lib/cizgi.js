/**
 * Zaman serisi çizgi / yığılmış alan grafiği (Chart.js).
 *
 * Kurallar (dataviz): tek eksen, 2px çizgi, sabit sırayla atanan renkler, ≥2 seride lejant +
 * seri sonunda doğrudan etiket, dikey imleç + tüm serileri gösteren ipucu, silik ızgara.
 */
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  Filler,
  Legend,
  Tooltip,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { sayi } from './format.js';

Chart.register(LineController, LineElement, PointElement, Filler, Legend, Tooltip, CategoryScale, LinearScale);

/** Kategorik sıra (doğrulandı: scripts/validate_palette.js, açık zemin) */
/** Toprak paletinden, renk körlüğü denetiminden geçmiş seri renkleri: kiremit, is mavisi, hardal, mürdüm */
export const SERI_RENKLERI = ['#c24a28', '#2e6e9e', '#a87812', '#6d5a9e'];

/** Son noktaya seri adı yazar (lejanta ek olarak; kimlik yalnızca renge bağlı kalmasın) */
const dogrudanEtiket = {
  id: 'dogrudanEtiket',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.font = `600 12px ${Chart.defaults.font.family}`;
    ctx.fillStyle = '#334155';
    ctx.textBaseline = 'middle';
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || !ds.kisaAd) return;
      const son = [...meta.data].reverse().find((p) => !p.skip);
      if (son) ctx.fillText(ds.kisaAd, son.x + 6, son.y);
    });
    ctx.restore();
  },
};

/** Yatay başvuru çizgisi (örn. "Türkiye ortalaması = 1") */
const basvuru = {
  id: 'basvuru',
  afterDraw(chart, _args, opts) {
    if (opts?.deger == null) return;
    const { ctx, chartArea, scales } = chart;
    const y = scales.y.getPixelForValue(opts.deger);
    if (y < chartArea.top || y > chartArea.bottom) return;
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartArea.left, y);
    ctx.lineTo(chartArea.right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${Chart.defaults.font.family}`;
    ctx.textAlign = 'right';
    ctx.fillText(opts.etiket ?? '', chartArea.right - 4, y - 6);
    ctx.restore();
  },
};

/** renkler: seri renkleri (varsayılan SERI_RENKLERI) */
export function cizgiGrafik(canvas, { renkler = SERI_RENKLERI } = {}) {
  let chart = null;
  return {
    /**
     * @param {{ yillar:string[], seriler:Array<{ad:string, kisaAd?:string, veri:Object<string,number>}>,
     *           ondalik?:number, birim?:string, yigilmis?:boolean, basvuru?:{deger:number, etiket:string} }} o
     */
    ciz({ yillar, seriler, ondalik = 2, birim = '', yigilmis = false, basvuru: bv = null }) {
      const datasets = seriler.map((s, i) => ({
        label: s.ad,
        kisaAd: seriler.length > 1 ? s.kisaAd : null,
        data: yillar.map((y) => s.veri[y] ?? null),
        borderColor: renkler[i % renkler.length],
        backgroundColor: yigilmis ? `${renkler[i % renkler.length]}55` : renkler[i % renkler.length],
        fill: yigilmis ? (i === 0 ? 'origin' : '-1') : false,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBorderColor: '#fff',
        tension: 0.25,
        spanGaps: true,
      }));
      if (chart) chart.destroy();
      chart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: yillar, datasets },
        plugins: [dogrudanEtiket, basvuru],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 400 },
          layout: { padding: { right: seriler.length > 1 ? 70 : 12, top: 8 } },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            basvuru: bv,
            legend: {
              display: seriler.length > 1,
              position: 'top',
              align: 'start',
              labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 18, color: '#334155', font: { size: 12 } },
            },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.9)',
              padding: 10,
              callbacks: {
                label: (c) => ` ${c.dataset.label}: ${sayi(c.raw, ondalik)}${birim ? ` ${birim}` : ''}`,
              },
            },
          },
          scales: {
            y: {
              stacked: yigilmis,
              beginAtZero: yigilmis,
              grid: { color: 'rgba(0,0,0,0.06)' },
              border: { display: false },
              ticks: { color: '#64748b', callback: (v) => sayi(v, ondalik) },
            },
            x: {
              grid: { display: false },
              ticks: { color: '#64748b', maxRotation: 0, autoSkip: true, maxTicksLimit: 9 },
            },
          },
        },
      });
      return chart;
    },
  };
}
