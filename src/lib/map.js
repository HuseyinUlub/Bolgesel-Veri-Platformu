/**
 * Koroplet harita (D3). Tüm harita sayfaları bu modülü kullanır.
 *
 *   const harita = koroplet(svgEl, tooltipEl);
 *   harita.ciz({ geo, degerler: Map<kod, sayı>, etiket: f => metin, ipucu: f => html });
 *   harita.duz({ geo, renkler });   // veri olmadan kategorik boyama (Hakkında)
 *   harita.ciz({ geo, zemin, ... });   // zemin: Türkiyeyi kaplamayan birimler (OECD kentleri) için
 *                                        gri il sınırları; harita zemine göre ölçeklenir
 *
 * Eşleştirme bölge KODU ile yapılır (isim benzetmesi yok).
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { geoMercator, geoPath } from 'd3-geo';
import { scaleSequential, scaleSequentialQuantile, scaleDiverging } from 'd3-scale';
import { interpolateRgbBasis } from 'd3-interpolate';
import { interpolateBlues } from 'd3-scale-chromatic';

/** Veri Gezgini'nin tek tonlu ölçeği: krem → kiremit (Anadolu'dakiler paleti) */
const TOPRAK_SIRALI = interpolateRgbBasis(['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a']);

/**
 * Haritanın ve grafiğin ortak renk ölçeği (aynı değer = aynı renk).
 * tema: 'toprak' (varsayılan, bütün site) ya da 'mavi' (eski görünüm)
 */
export function renkOlcegi(degerler, tema = 'toprak') {
  const v = degerler.filter((x) => Number.isFinite(x));
  const renk = tema === 'toprak' ? (t) => TOPRAK_SIRALI(0.06 + t * 0.94) : (t) => interpolateBlues(0.15 + t * 0.7);
  if (new Set(v).size > 5) return scaleSequentialQuantile(renk).domain(v);
  const min = Math.min(...v, 0);
  const max = Math.max(...v, 1);
  return scaleSequential(renk).domain([min, max]);
}

/**
 * İki yönlü (diverging) ölçek: orta noktanın altı hardal, üstü mavi, orta nokta nötr gri.
 * Aşırı uçlar rengi yutmasın diye iki taraf da kendi 95. yüzdeliğine göre kırpılır.
 */
export const IKI_YON_RENKLER = ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e']; // hardal ← nötr → is mavisi
export function ikiYonluOlcek(degerler, orta = 0) {
  const v = degerler.filter((x) => Number.isFinite(x));
  const alt = v.filter((x) => x < orta).map((x) => orta - x).sort((a, b) => a - b);
  const ust = v.filter((x) => x > orta).map((x) => x - orta).sort((a, b) => a - b);
  const q = (a) => (a.length ? a[Math.floor(0.95 * (a.length - 1))] : 1);
  const genis = Math.max(q(alt), q(ust), 1e-9);
  return scaleDiverging(interpolateRgbBasis(IKI_YON_RENKLER)).domain([orta - genis, orta, orta + genis]).clamp(true);
}

export function koroplet(svgEl, tooltipEl, { onHover, onClick, tema = 'toprak' } = {}) {
  const svg = select(svgEl);
  const tooltip = select(tooltipEl);
  const projection = geoMercator();
  const path = geoPath(projection);
  const gZemin = svg.append('g').attr('class', 'map-base');
  const gShapes = svg.append('g').attr('class', 'map-shapes');
  const gLabels = svg.append('g').attr('class', 'map-labels');
  let son = null; // son çizim argümanları (yeniden boyutlandırmada tekrar çizmek için)

  function boyutla(features) {
    const w = svgEl.parentElement.clientWidth || 960;
    const h = svgEl.parentElement.clientHeight || 450;
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'xMidYMid meet');
    projection.fitExtent([[10, 10], [w - 10, h - 10]], { type: 'FeatureCollection', features });
  }

  let konumla = null; // özel konumlandırıcı (ör. 3B eğik harita için)

  function ipucuGoster(event, html) {
    let x, y;
    if (konumla) [x, y] = konumla(event);
    else {
      const r = svgEl.getBoundingClientRect();
      [x, y] = [event.clientX - r.left, event.clientY - r.top];
    }
    tooltip.style('opacity', 1).html(html).style('left', `${x}px`).style('top', `${y - 5}px`);
  }

  function sekiller(features, fill, ipucu) {
    const sel = gShapes.selectAll('path').data(features, (f) => f.id);
    sel.exit().remove();
    sel
      .enter()
      .append('path')
      .attr('class', 'map-path')
      .attr('stroke', 'var(--map-stroke)')
      .merge(sel)
      .on('mousemove', (e, f) => {
        ipucuGoster(e, ipucu(f));
        onHover?.(f.id);
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
        onHover?.(null);
      })
      .on('click', (e, f) => onClick?.(f.id))
      .transition()
      .duration(400)
      .attr('d', path)
      .attr('fill', fill);
  }

  function etiketler(features, metin, fontSize) {
    const sel = gLabels.selectAll('text').data(features, (f) => f.id);
    sel.exit().remove();
    sel
      .enter()
      .append('text')
      .attr('class', 'map-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '.35em')
      .merge(sel)
      .style('font-size', fontSize)
      .attr('transform', (f) => {
        const c = path.centroid(f);
        return Number.isFinite(c[0]) ? `translate(${c})` : 'translate(-1000,-1000)';
      })
      .text(metin);
  }

  return {
    /** Veriye göre boya */
    ciz({ geo, degerler, etiket, ipucu, kucukEtiket = false, zemin = null, olcek: ozelOlcek = null, etiketsiz = false }) {
      son = { tur: 'ciz', args: arguments[0] };
      konumla = null;
      const features = geo.features;
      boyutla(zemin ? zemin.features : features);
      const z = gZemin.selectAll('path').data(zemin ? zemin.features : [], (f) => f.id);
      z.exit().remove();
      z.enter().append('path').attr('class', 'map-base-path').merge(z).attr('d', path);
      const olcek = ozelOlcek ?? renkOlcegi([...degerler.values()], tema);
      sekiller(features, (f) => (degerler.has(f.id) ? olcek(degerler.get(f.id)) : 'var(--map-empty)'), ipucu);
      etiketler(features, etiketsiz ? () => '' : etiket, kucukEtiket ? '9px' : '12px');
      svg.attr('data-state', 'veri');
      return olcek;
    },
    /** Kategorik (veri bağımsız) boyama */
    duz({ geo, renkler, ipucu, etiket, ipucuKonumu = null }) {
      son = { tur: 'duz', args: arguments[0] };
      konumla = ipucuKonumu;
      boyutla(geo.features);
      gZemin.selectAll('path').remove();
      sekiller(geo.features, (f, i) => renkler[i % renkler.length], ipucu);
      etiketler(geo.features, etiket ?? (() => ''), '12px');
      svg.attr('data-state', 'duz');
    },
    /** Bölge radarı: seçili birimi ve komşularını çerçevele (null → temizle) */
    isaretle(secili, komsular = []) {
      const k = new Set(komsular);
      gShapes.selectAll('path').classed('is-secili', (f) => f.id === secili).classed('is-komsu', (f) => k.has(f.id));
      gShapes.selectAll('path.is-komsu').raise();
      gShapes.selectAll('path.is-secili').raise();
    },
    vurgula(kod) {
      gShapes.selectAll('path').classed('is-highlight', (f) => f.id === kod);
    },
    yenidenCiz() {
      if (son) this[son.tur](son.args);
    },
    ipucuGoster,
    ipucuGizle: () => tooltip.style('opacity', 0),
  };
}
