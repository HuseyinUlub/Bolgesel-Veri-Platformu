/**
 * Ana sayfanın uluslararası karşılaştırma görselleri (SVG, d3).
 *
 *   avrupaHaritasi(svg, ipucu).ciz({ nuts, ulkeler, degerler: Map, renk: kod => renk, etiket: kod => html })
 *   trHaritasi(svg, ipucu).ciz({ geo, degerler, renk, etiket })
 *   dagilim(svg, ipucu).ciz({ noktalar:[{x,y,ad,vurgu?,etiket?}], xEtiket, yEtiket, xLog?, egilim? })
 *   satirlar(svg, ipucu).ciz({ satirlar:[{ad, a?, b, vurgu?}], aEtiket, bEtiket, bicim, sifir? })   // dambıl ya da çubuk
 *   serit(svg, ipucu).ciz({ gruplar:[{ad, degerler:[{v, ad}], ort?, vurgu?}], bicim, xEtiket, sifir? })
 *   ayristirma(svg, ipucu).ciz({ satirlar:[{ad, parcalar:[v1, v2], toplam, ipucu, vurgu?}], parcaAdlari, renkler, bicim, xEtiket })
 *
 * Kurallar (dataviz): tek eksen; ince işaretler; Türkiye kiremit, diğerleri gri; kimlik yalnız renge bağlı
 * kalmasın diye Türkiye satırları kalın yazılır; her işaretin üzerine gelince ipucu.
 */
import { select } from 'd3-selection';
import { geoIdentity, geoMercator, geoPath } from 'd3-geo';
import { scaleLinear, scaleLog, scaleBand } from 'd3-scale';

const NS = 'http://www.w3.org/2000/svg';
export const RENK = { tr: '#c24a28', gri: '#b9b6ad', griKoyu: '#8c8a83', metin: '#2f2f2f', soluk: '#8c8c8c', izgara: '#e7e5de', ort: '#2f2f2f' };

function boyut(svg) {
  const r = svg.parentElement.getBoundingClientRect();
  return [Math.max(300, r.width), Math.max(240, r.height)];
}
function ipucuGoster(ipucu, svg, e, html) {
  const r = svg.parentElement.getBoundingClientRect();
  ipucu.innerHTML = html;
  ipucu.style.left = `${e.clientX - r.left}px`;
  ipucu.style.top = `${e.clientY - r.top}px`;
  ipucu.style.opacity = 1;
}
const ipucuGizle = (ipucu) => (ipucu.style.opacity = 0);

function temizle(svg) {
  const s = select(svg);
  s.selectAll('*').remove();
  const [w, h] = boyut(svg);
  s.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
  return [s, w, h];
}

/* ------------------------------------------------------------------ Avrupa haritası (EPSG:3035) */
const CERCEVE = { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[2500000, 1350000], [7400000, 5450000]] } };
export function avrupaHaritasi(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const proj = geoIdentity().reflectY(true).fitExtent([[4, 4], [w - 4, h - 4]], CERCEVE);
    const yol = geoPath(proj);
    s.append('defs').append('clipPath').attr('id', 'avrupa-kes').append('rect').attr('width', w).attr('height', h);
    const g = s.append('g').attr('clip-path', 'url(#avrupa-kes)');
    g.append('rect').attr('width', w).attr('height', h).attr('fill', '#eef1f2');
    g.append('g').selectAll('path').data(o.ulkeler.features).join('path')
      .attr('d', yol).attr('fill', '#f4f3ef').attr('stroke', '#d6d4cc').attr('stroke-width', 0.5);
    g.append('g').selectAll('path').data(o.nuts.features).join('path')
      .attr('d', yol)
      .attr('fill', (f) => (o.degerler.has(f.id) ? o.renk(o.degerler.get(f.id)) : '#e6e4dd'))
      .attr('stroke', (f) => (f.id.startsWith('TR') ? '#6b6b66' : '#ffffff'))
      .attr('stroke-width', (f) => (f.id.startsWith('TR') ? 0.7 : 0.35))
      .on('mousemove', (e, f) => ipucuGoster(ipucu, svg, e, o.etiket(f.id)))
      .on('mouseleave', () => ipucuGizle(ipucu));
    // Türkiye'nin dış sınırı: bölgeler bir araya gelince okunsun
    const tr = o.ulkeler.features.find((f) => f.id === 'TR');
    if (tr) g.append('path').attr('d', yol(tr)).attr('fill', 'none').attr('stroke', RENK.metin).attr('stroke-width', 1.1).attr('pointer-events', 'none');
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}

/* ------------------------------------------------------------------ Türkiye haritası (Düzey 2) */
export function trHaritasi(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const proj = geoMercator().fitExtent([[6, 6], [w - 6, h - 6]], o.geo);
    const yol = geoPath(proj);
    s.append('g').selectAll('path').data(o.geo.features).join('path')
      .attr('d', yol)
      .attr('fill', (f) => (o.degerler.has(f.id) ? o.renk(o.degerler.get(f.id)) : '#e6e4dd'))
      .attr('stroke', '#fff').attr('stroke-width', 0.8)
      .on('mousemove', (e, f) => ipucuGoster(ipucu, svg, e, o.etiket(f.id)))
      .on('mouseleave', () => ipucuGizle(ipucu));
    s.append('g').selectAll('text').data(o.geo.features).join('text')
      .attr('transform', (f) => `translate(${yol.centroid(f)})`)
      .attr('text-anchor', 'middle').attr('dy', '0.35em')
      .attr('class', 'harita-etiket').text((f) => f.id);
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}

/* ------------------------------------------------------------------ eksen yardımcıları */
function xEkseni(g, x, h, bicim, sayi = 5) {
  const t = x.ticks ? x.ticks(sayi) : [];
  const e = g.append('g').attr('class', 'eksen');
  e.selectAll('line').data(t).join('line').attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', h).attr('stroke', RENK.izgara);
  e.selectAll('text').data(t).join('text').attr('x', x).attr('y', h + 16).attr('text-anchor', 'middle').text(bicim);
  return e;
}
function yEkseni(g, y, w, bicim, sayi = 5) {
  const t = y.ticks(sayi);
  const e = g.append('g').attr('class', 'eksen');
  e.selectAll('line').data(t).join('line').attr('x1', 0).attr('x2', w).attr('y1', y).attr('y2', y).attr('stroke', RENK.izgara);
  e.selectAll('text').data(t).join('text').attr('x', -8).attr('y', y).attr('dy', '0.32em').attr('text-anchor', 'end').text(bicim);
}

/* ------------------------------------------------------------------ dağılım */
export function dagilim(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const m = { l: 52, r: 16, t: 14, b: 44 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const xs = o.noktalar.map((d) => d.x);
    const ys = o.noktalar.map((d) => d.y);
    const x = (o.xLog ? scaleLog() : scaleLinear()).domain([Math.min(...xs) * 0.92, Math.max(...xs) * 1.06]).range([0, iw]);
    const pay = (Math.max(...ys) - Math.min(...ys)) * 0.08;
    const y = scaleLinear().domain([Math.min(...ys) - pay, Math.max(...ys) + pay]).nice().range([ih, 0]);
    const g = s.append('g').attr('transform', `translate(${m.l},${m.t})`);
    yEkseni(g, y, iw, o.yBicim);
    const xt = o.xLog ? [5000, 10000, 20000, 40000].filter((v) => v >= x.domain()[0] && v <= x.domain()[1]) : x.ticks(5);
    const e = g.append('g').attr('class', 'eksen');
    e.selectAll('text').data(xt).join('text').attr('x', x).attr('y', ih + 18).attr('text-anchor', 'middle').text(o.xBicim);
    e.append('line').attr('x1', 0).attr('x2', iw).attr('y1', ih).attr('y2', ih).attr('stroke', '#cfcdc6');
    g.append('text').attr('class', 'eksen-baslik').attr('x', iw).attr('y', ih + 36).attr('text-anchor', 'end').text(o.xEtiket);
    g.append('text').attr('class', 'eksen-baslik').attr('x', 0).attr('y', -2).text(o.yEtiket);
    if (o.egilim) {
      // en küçük kareler (x logaritmik ise log x üzerinden)
      const tx = (v) => (o.xLog ? Math.log(v) : v);
      const n = xs.length;
      const mx = xs.reduce((a, v) => a + tx(v), 0) / n;
      const my = ys.reduce((a, v) => a + v, 0) / n;
      const b = xs.reduce((a, v, i) => a + (tx(v) - mx) * (ys[i] - my), 0) / xs.reduce((a, v) => a + (tx(v) - mx) ** 2, 0);
      const [x0, x1] = x.domain();
      const yy = (v) => my + b * (tx(v) - mx);
      g.append('line').attr('x1', x(x0)).attr('x2', x(x1)).attr('y1', y(yy(x0))).attr('y2', y(yy(x1)))
        .attr('stroke', RENK.metin).attr('stroke-width', 1.2).attr('stroke-dasharray', '5 4');
    }
    g.append('g').selectAll('circle').data(o.noktalar).join('circle')
      .attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', (d) => (d.vurgu ? 6 : 4.5))
      .attr('fill', (d) => (d.vurgu ? RENK.tr : '#6f8fa8')).attr('fill-opacity', 0.85)
      .attr('stroke', '#fff').attr('stroke-width', 1.2)
      .on('mousemove', (ev, d) => ipucuGoster(ipucu, svg, ev, d.ipucu))
      .on('mouseleave', () => ipucuGizle(ipucu));
    g.append('g').selectAll('text').data(o.noktalar.filter((d) => d.etiket)).join('text')
      .attr('class', 'nokta-etiket').attr('x', (d) => x(d.x) + 8).attr('y', (d) => y(d.y)).attr('dy', '0.32em').text((d) => d.etiket);
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}

/* ------------------------------------------------------------------ satırlar: dambıl ya da çubuk */
export function satirlar(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const m = { l: Math.min(o.solBosluk ?? 128, w * 0.36), r: 44, t: 26, b: 30 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const deg = o.satirlar.flatMap((d) => [d.a, d.b]).filter((v) => v != null);
    const min = o.sifir ? Math.min(0, ...deg) : Math.min(...deg);
    const max = Math.max(...deg, o.sifir ? 0 : -Infinity);
    const x = scaleLinear().domain([min, max]).nice().range([0, iw]);
    const y = scaleBand().domain(o.satirlar.map((d) => d.ad)).range([0, ih]).padding(0.35);
    const g = s.append('g').attr('transform', `translate(${m.l},${m.t})`);
    xEkseni(g, x, ih, o.bicim);
    if (o.referans != null) {
      g.append('line').attr('x1', x(o.referans)).attr('x2', x(o.referans)).attr('y1', -8).attr('y2', ih).attr('stroke', RENK.metin).attr('stroke-dasharray', '4 3');
      g.append('text').attr('class', 'eksen-baslik').attr('x', x(o.referans) + 4).attr('y', -12).text(o.referansEtiket ?? '');
    }
    const satir = g.append('g').selectAll('g').data(o.satirlar).join('g').attr('transform', (d) => `translate(0,${y(d.ad) + y.bandwidth() / 2})`);
    satir.append('text').attr('class', (d) => `satir-ad${d.vurgu ? ' vurgu' : ''}`).attr('x', -10).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => d.ad);
    const cubuk = o.tur === 'cubuk';
    if (cubuk) {
      satir.append('rect').attr('x', (d) => x(Math.min(0, d.b))).attr('y', -Math.min(9, y.bandwidth() / 2)).attr('height', Math.min(18, y.bandwidth()))
        .attr('width', (d) => Math.abs(x(d.b) - x(0))).attr('rx', 2)
        .attr('fill', (d) => (d.vurgu ? RENK.tr : RENK.gri));
      if (o.isaret) satir.filter((d) => d.a != null).append('line').attr('x1', (d) => x(d.a)).attr('x2', (d) => x(d.a))
        .attr('y1', -Math.min(11, y.bandwidth() / 2 + 2)).attr('y2', Math.min(11, y.bandwidth() / 2 + 2)).attr('stroke', RENK.metin).attr('stroke-width', 2);
    } else {
      satir.filter((d) => d.a != null).append('line').attr('x1', (d) => x(d.a)).attr('x2', (d) => x(d.b))
        .attr('stroke', (d) => (d.vurgu ? RENK.tr : RENK.gri)).attr('stroke-width', 2);
      satir.filter((d) => d.a != null).append('circle').attr('cx', (d) => x(d.a)).attr('r', 4.5).attr('fill', '#fff')
        .attr('stroke', (d) => (d.vurgu ? RENK.tr : RENK.griKoyu)).attr('stroke-width', 1.6);
      satir.append('circle').attr('cx', (d) => x(d.b)).attr('r', 5).attr('fill', (d) => (d.vurgu ? RENK.tr : RENK.griKoyu));
    }
    satir.append('text').attr('class', 'satir-deger').attr('x', (d) => Math.max(x(d.b), d.a != null && !cubuk ? x(d.a) : -Infinity, cubuk ? x(Math.max(0, d.b)) : -Infinity) + 9)
      .attr('dy', '0.32em').text((d) => o.bicim(d.b));
    satir.append('rect').attr('x', -m.l).attr('y', -y.step() / 2).attr('width', w).attr('height', y.step()).attr('fill', 'transparent')
      .on('mousemove', (e, d) => ipucuGoster(ipucu, svg, e, d.ipucu ?? `<strong>${d.ad}</strong><br>${o.bEtiket}: ${o.bicim(d.b)}${d.a != null ? `<br>${o.aEtiket}: ${o.bicim(d.a)}` : ''}`))
      .on('mouseleave', () => ipucuGizle(ipucu));
    if (!cubuk || o.isaret) {
      const l = s.append('g').attr('class', 'lejant-svg').attr('transform', `translate(${m.l},12)`);
      if (!cubuk) {
        l.append('circle').attr('cx', 4).attr('r', 4).attr('fill', '#fff').attr('stroke', RENK.griKoyu).attr('stroke-width', 1.6);
        l.append('text').attr('x', 14).attr('dy', '0.32em').text(o.aEtiket);
        const x2 = 30 + o.aEtiket.length * 7;
        l.append('circle').attr('cx', x2 + 4).attr('r', 4.5).attr('fill', RENK.griKoyu);
        l.append('text').attr('x', x2 + 14).attr('dy', '0.32em').text(o.bEtiket);
      } else {
        l.append('rect').attr('y', -5).attr('width', 14).attr('height', 10).attr('fill', RENK.gri);
        l.append('text').attr('x', 20).attr('dy', '0.32em').text(o.bEtiket);
        const x2 = 36 + o.bEtiket.length * 7;
        l.append('line').attr('x1', x2).attr('x2', x2).attr('y1', -6).attr('y2', 6).attr('stroke', RENK.metin).attr('stroke-width', 2);
        l.append('text').attr('x', x2 + 8).attr('dy', '0.32em').text(o.aEtiket);
      }
    }
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}

/* ------------------------------------------------------------------ şerit: ülke satırları, bölge noktaları */
export function serit(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const m = { l: Math.min(128, w * 0.28), r: 20, t: 24, b: 34 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const tum = o.gruplar.flatMap((g) => g.degerler.map((d) => d.v));
    const x = scaleLinear().domain([Math.min(...tum, o.sifir ? 0 : Infinity), Math.max(...tum)]).nice().range([0, iw]);
    const y = scaleBand().domain(o.gruplar.map((g) => g.ad)).range([0, ih]).padding(0.2);
    const g = s.append('g').attr('transform', `translate(${m.l},${m.t})`);
    xEkseni(g, x, ih, o.bicim);
    if (o.sifir && x.domain()[0] < 0) g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', ih).attr('stroke', '#9d9b94');
    g.append('text').attr('class', 'eksen-baslik').attr('x', iw).attr('y', -10).attr('text-anchor', 'end').text(o.xEtiket);
    const satir = g.append('g').selectAll('g').data(o.gruplar).join('g').attr('transform', (d) => `translate(0,${y(d.ad) + y.bandwidth() / 2})`);
    satir.filter((d) => d.vurgu).append('rect').attr('x', -m.l).attr('y', -y.step() / 2).attr('width', w).attr('height', y.step()).attr('fill', '#f6e3da');
    satir.append('text').attr('class', (d) => `satir-ad${d.vurgu ? ' vurgu' : ''}`).attr('x', -10).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => d.ad);
    satir.append('line').attr('x1', 0).attr('x2', iw).attr('stroke', '#efede7');
    satir.each(function (grp) {
      select(this).selectAll('circle').data(grp.degerler).join('circle')
        .attr('cx', (d) => x(d.v)).attr('r', grp.vurgu ? 5 : 3.8)
        .attr('fill', grp.vurgu ? RENK.tr : '#8fa6b8').attr('fill-opacity', grp.vurgu ? 0.9 : 0.7)
        .attr('stroke', '#fff').attr('stroke-width', 0.8)
        .on('mousemove', (e, d) => ipucuGoster(ipucu, svg, e, `<strong>${d.ad}</strong> (${grp.ad})<br>${o.bicim(d.v)}${o.birim ? ` ${o.birim}` : ''}`))
        .on('mouseleave', () => ipucuGizle(ipucu));
      if (grp.ort != null) select(this).append('line').attr('x1', x(grp.ort)).attr('x2', x(grp.ort)).attr('y1', -8).attr('y2', 8).attr('stroke', RENK.ort).attr('stroke-width', 2);
    });
    const l = s.append('g').attr('class', 'lejant-svg').attr('transform', `translate(${m.l},${h - 8})`);
    l.append('circle').attr('cx', 4).attr('r', 3.8).attr('fill', '#8fa6b8');
    l.append('text').attr('x', 12).attr('dy', '0.32em').text('bölge');
    l.append('circle').attr('cx', 64).attr('r', 4.5).attr('fill', RENK.tr);
    const dar = w < 520;
    l.append('text').attr('x', 72).attr('dy', '0.32em').text(dar ? 'Türkiye' : 'Türkiye\'nin bölgeleri');
    const ox = dar ? 146 : 238;
    if (o.gruplar.some((gr) => gr.ort != null)) {
      l.append('line').attr('x1', ox).attr('x2', ox).attr('y1', -6).attr('y2', 6).attr('stroke', RENK.ort).attr('stroke-width', 2);
      l.append('text').attr('x', ox + 8).attr('dy', '0.32em').text(o.ortEtiket ?? 'ülke değeri');
    }
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}

/* ------------------------------------------------------------------ ayrıştırma: yığılmış çubuk + toplam işareti */
export function ayristirma(svg, ipucu) {
  let son = null;
  const ciz = (o) => {
    son = o;
    const [s, w, h] = temizle(svg);
    const m = { l: Math.min(118, w * 0.3), r: 56, t: w < 520 ? 52 : 40, b: 40 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    // her satırda pozitif parçalar sıfırdan sağa, negatifler sola yığılır
    const uclar = o.satirlar.flatMap((d) => [
      d.parcalar.filter((v) => v > 0).reduce((a, v) => a + v, 0),
      d.parcalar.filter((v) => v < 0).reduce((a, v) => a + v, 0), d.toplam]);
    const x = scaleLinear().domain([Math.min(0, ...uclar), Math.max(0, ...uclar)]).nice().range([0, iw]);
    const y = scaleBand().domain(o.satirlar.map((d) => d.ad)).range([0, ih]).padding(0.38);
    const g = s.append('g').attr('transform', `translate(${m.l},${m.t})`);
    xEkseni(g, x, ih, o.bicim);
    g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', ih).attr('stroke', '#9d9b94');
    g.append('text').attr('class', 'eksen-baslik').attr('x', iw).attr('y', ih + 34).attr('text-anchor', 'end').text(o.xEtiket);
    const bh = Math.min(26, y.bandwidth());
    const satir = g.append('g').selectAll('g').data(o.satirlar).join('g').attr('transform', (d) => `translate(0,${y(d.ad) + y.bandwidth() / 2})`);
    satir.append('text').attr('class', (d) => `satir-ad${d.vurgu ? ' vurgu' : ''}`).attr('x', -10).attr('dy', '0.32em').attr('text-anchor', 'end').text((d) => d.ad);
    satir.each(function (d) {
      let pos = 0;
      let neg = 0;
      d.parcalar.forEach((v, i) => {
        const a = v >= 0 ? pos : neg + v;
        if (v >= 0) pos += v; else neg += v;
        select(this).append('rect').attr('x', x(a)).attr('width', Math.max(0, Math.abs(x(a + Math.abs(v)) - x(a)) - 2))
          .attr('y', -bh / 2).attr('height', bh).attr('rx', 2).attr('fill', o.renkler[i]);
      });
      select(this).append('line').attr('x1', x(d.toplam)).attr('x2', x(d.toplam)).attr('y1', -bh / 2 - 5).attr('y2', bh / 2 + 5)
        .attr('stroke', RENK.metin).attr('stroke-width', 2.5);
    });
    satir.append('text').attr('class', 'satir-deger').attr('x', (d) => x(Math.max(d.toplam, d.parcalar.filter((v) => v > 0).reduce((a, v) => a + v, 0))) + 8)
      .attr('dy', '0.32em').text((d) => o.bicim(d.toplam));
    satir.append('rect').attr('x', -m.l).attr('y', -y.step() / 2).attr('width', w).attr('height', y.step()).attr('fill', 'transparent')
      .on('mousemove', (e, d) => ipucuGoster(ipucu, svg, e, d.ipucu))
      .on('mouseleave', () => ipucuGizle(ipucu));
    // lejant: sığmazsa alt satıra geçer
    const l = s.append('g').attr('class', 'lejant-svg').attr('transform', `translate(${Math.min(m.l, 8 + (w < 520 ? 0 : m.l))},12)`);
    const lw = w - 16;
    let lx = 0;
    let ly = 0;
    const yer = (gen) => {
      if (lx > 0 && lx + gen > lw) { lx = 0; ly += 17; }
      const x0 = lx;
      lx += gen;
      return x0;
    };
    o.parcaAdlari.forEach((ad, i) => {
      const x0 = yer(34 + ad.length * 6.6);
      l.append('rect').attr('x', x0).attr('y', ly - 5).attr('width', 14).attr('height', 10).attr('rx', 2).attr('fill', o.renkler[i]);
      l.append('text').attr('x', x0 + 20).attr('y', ly).attr('dy', '0.32em').text(ad);
    });
    const tAd = o.toplamAdi ?? 'toplam';
    const x0 = yer(14 + tAd.length * 6.6);
    l.append('line').attr('x1', x0 + 2).attr('x2', x0 + 2).attr('y1', ly - 7).attr('y2', ly + 7).attr('stroke', RENK.metin).attr('stroke-width', 2.5);
    l.append('text').attr('x', x0 + 10).attr('y', ly).attr('dy', '0.32em').text(tAd);
  };
  return { ciz, yenidenCiz: () => son && ciz(son) };
}
