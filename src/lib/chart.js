/**
 * Sıralı çubuk grafik (Chart.js). Harita ile AYNI renk ölçeğini kullanır:
 * bir bölge haritada hangi tonla görünüyorsa grafikte de o tonla görünür.
 */
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { sayi, kisa } from './format.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);
Chart.defaults.font.family = "'Source Sans 3', 'Segoe UI', system-ui, sans-serif";

export function siraliCubuk(canvas) {
  let chart = null;
  let eksenEtiketi = kisa;

  return {
    /**
     * @param {Array<{ad:string, deger:number, kod:string}>} satirlar  büyükten küçüğe sıralı
     * @param {{ baslik:string, ondalik?:number, renk:(v:number)=>string, enFazla?:number,
     *           etiket?:(d)=>string, tamAd?:(d)=>string }} o
     *   etiket: eksende yazılacak kısa ad (örn. bölge kodu), tamAd: ipucunda görünecek ad
     */
    guncelle(satirlar, { baslik, ondalik, renk, enFazla = 15, etiket = (d) => d.ad, tamAd = (d) => d.ad }) {
      const ust = satirlar.slice(0, enFazla);
      const data = {
        labels: ust.map(etiket),
        datasets: [
          {
            label: baslik,
            data: ust.map((d) => d.deger),
            backgroundColor: ust.map((d) => renk(d.deger)),
            borderRadius: 6,
            kodlar: ust.map((d) => d.kod),
          },
        ],
      };
      const basliklar = ust.map(tamAd);
      const title = (items) => basliklar[items[0].dataIndex];
      // Grafik yeniden kullanıldığında eksen etiketi güncel ondalığı görsün (kapanış ilk çağrıya takılmasın)
      eksenEtiketi = (v) => (Math.abs(v) < 1 && v !== 0 ? sayi(v, Math.max(ondalik ?? 2, 2)) : kisa(v));
      if (chart) {
        chart.data = data;
        chart.options.plugins.tooltip.callbacks.label = (c) => sayi(c.raw, ondalik);
        chart.options.plugins.tooltip.callbacks.title = title;
        chart.update();
        return chart;
      }
      chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(0,0,0,0.8)',
              padding: 10,
              displayColors: false,
              callbacks: { label: (c) => sayi(c.raw, ondalik), title },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: { callback: (v) => eksenEtiketi(v) },
            },
            x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
          },
        },
      });
      return chart;
    },
    /** Haritada üzerine gelinen bölgeyi grafikte vurgula */
    vurgula(kod) {
      if (!chart) return;
      const ds = chart.data.datasets[0];
      ds.borderWidth = ds.kodlar.map((k) => (k === kod ? 3 : 0));
      ds.borderColor = ds.kodlar.map(() => getComputedStyle(document.documentElement).getPropertyValue('--map-highlight').trim());
      chart.update('none');
    },
    gizle(v) {
      canvas.parentElement.style.display = v ? 'none' : 'block';
    },
  };
}
