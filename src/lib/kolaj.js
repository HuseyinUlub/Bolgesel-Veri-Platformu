/**
 * Açılış şeridi: bir kilim gibi okunur.
 *   - ortada sitenin kendi verisinden küçük harita ve grafiklerin çokgen hücrelere (Voronoi) yerleştiği kolaj,
 *     aralarında dokuma motifli hücreler,
 *   - merkezde 26 Düzey 2 bölgesini (26 kalkınma ajansı) gösteren harita panosu.
 * Growth Lab "Best of 2025" başlığından ve Anadolu'dakiler projesinin görsel dilinden esinlenildi.
 *
 *   kolaj(svgEl, veri)   veri = { esit, nufus, demografi, geoIl, geoD1, geoD2 }
 *
 * Hücre yerleşimi sabit tohumla üretilir: sayfa her açıldığında aynı kolaj görünür.
 */
import { Delaunay } from 'd3-delaunay';
import { geoMercator, geoPath } from 'd3-geo';
import { line, area } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import { ikiYonluOlcek, renkOlcegi } from './map.js';
import { kapsamliYillar } from './data.js';
import { TOPRAK, motifCiz } from './motifler.js';
import { AJANSLAR, DUZEY1 } from './ajanslar.js';

const NS = 'http://www.w3.org/2000/svg';
const MAVI = '#2e6e9e';   // is mavisi
const TURUNCU = '#c24a28'; // kiremit
const YESIL = '#a87812';   // hardal
const IZGARA = '#d6d6d2';
const ZEMIN = '#f9f9f3'; // sayfa zemini: hücre aralarındaki derzler
const ZEMINLER = ['#fffcf0', '#eef1ec', '#f8eedb', '#f6e7e0', '#fffcf0', '#eceff1'];
/** Motif hücreleri: [motif, çizgi rengi, zemin] */
const MOTIF_HUCRELERI = [
  ['elibelinde', TOPRAK.kiremit, '#f6e7e0'],
  ['hayatagaci', TOPRAK.adacayi, '#eef1ec'],
  ['goz', TOPRAK.hardal, '#fbf1dc'],
  ['kocboynuzu', TOPRAK.ismavi, '#eceff1'],
  ['yildiz', TOPRAK.kiremit, '#fffcf0'],
  ['suyolu', TOPRAK.adacayi, '#f8eedb'],
];

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}

/** Sabit tohumlu sözde rastgele sayı (her açılışta aynı yerleşim) */
function rastgele(tohum) {
  let s = tohum;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const IL = /^TR[0-9A-C]\d\d$/;
const sonYil = (o) => Object.keys(o ?? {}).sort().at(-1);
function iller(kat, id) {
  const s = kat?.[id] ?? {};
  const y = kapsamliYillar(s, (k) => IL.test(k)).at(-1);
  return Object.fromEntries(Object.entries(s[y] ?? {}).filter(([k, v]) => IL.test(k) && v != null));
}
const tr = (kat, id) =>
  Object.fromEntries(Object.entries(kat?.[id] ?? {}).filter(([, d]) => d.TR != null).map(([y, d]) => [y, d.TR]));

// ------------------------------------------------------------------ panel çizicileri
function izgara(g, { x, y, w, h }, n = 5) {
  for (let i = 1; i < n; i++) el('line', { x1: x, x2: x + w, y1: y + (h * i) / n, y2: y + (h * i) / n, stroke: IZGARA, 'stroke-width': 0.6 }, g);
}
function etiket(g, x, y, metin, renk = '#8c8c8c') {
  const t = el('text', { x, y, fill: renk, 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace' }, g);
  t.textContent = metin;
}

function haritaPaneli(geo, degerler, olcek) {
  return (g, k) => {
    const p = geoMercator().fitExtent([[k.x + 8, k.y + 8], [k.x + k.w - 8, k.y + k.h - 8]], geo);
    const yol = geoPath(p);
    for (const f of geo.features) {
      const v = degerler[f.id];
      el('path', { d: yol(f), fill: v == null ? '#e6e6e6' : olcek(v), stroke: '#fff', 'stroke-width': 0.4 }, g);
    }
  };
}

function cizgiPaneli(seriler, { basvuru = null, renkler = [MAVI, TURUNCU, YESIL] } = {}) {
  return (g, k) => {
    const yillar = [...new Set(seriler.flatMap((s) => Object.keys(s)))].sort();
    const tum = seriler.flatMap((s) => Object.values(s)).concat(basvuru ?? []);
    const x = scaleLinear().domain([+yillar[0], +yillar.at(-1)]).range([k.x + 26, k.x + k.w - 10]);
    const y = scaleLinear().domain([Math.min(...tum) * 0.95, Math.max(...tum) * 1.03]).range([k.y + k.h - 18, k.y + 14]);
    izgara(g, k);
    etiket(g, k.x + 26, k.y + k.h - 6, yillar[0]);
    etiket(g, k.x + k.w - 34, k.y + k.h - 6, yillar.at(-1));
    if (basvuru != null) el('line', { x1: k.x + 26, x2: k.x + k.w - 10, y1: y(basvuru), y2: y(basvuru), stroke: '#8c8c8c', 'stroke-dasharray': '3 3' }, g);
    seriler.forEach((s, i) => {
      const n = Object.entries(s).map(([a, b]) => [x(+a), y(b)]).sort((a, b) => a[0] - b[0]);
      el('path', { d: line()(n), fill: 'none', stroke: renkler[i], 'stroke-width': 1.8 }, g);
      const [lx, ly] = n.at(-1);
      el('circle', { cx: lx, cy: ly, r: 2.5, fill: renkler[i] }, g);
    });
  };
}

function alanPaneli(alt, ust) {
  return (g, k) => {
    const yillar = Object.keys(alt).sort();
    const x = scaleLinear().domain([+yillar[0], +yillar.at(-1)]).range([k.x + 10, k.x + k.w - 10]);
    const max = Math.max(...yillar.map((t) => alt[t] + (ust[t] ?? 0)));
    const y = scaleLinear().domain([0, max * 1.05]).range([k.y + k.h - 10, k.y + 12]);
    izgara(g, k, 4);
    const a1 = area().x((t) => x(+t)).y0(y(0)).y1((t) => y(alt[t]));
    const a2 = area().x((t) => x(+t)).y0((t) => y(alt[t])).y1((t) => y(alt[t] + (ust[t] ?? 0)));
    el('path', { d: a1(yillar), fill: MAVI, 'fill-opacity': 0.75 }, g);
    el('path', { d: a2(yillar), fill: TURUNCU, 'fill-opacity': 0.55 }, g);
  };
}

function cubukPaneli(degerler, renk = MAVI) {
  return (g, k) => {
    const v = Object.values(degerler).sort((a, b) => b - a).slice(0, 40);
    const x = scaleLinear().domain([0, v.length]).range([k.x + 8, k.x + k.w - 8]);
    const y = scaleLinear().domain([0, Math.sqrt(v[0])]).range([k.y + k.h - 8, k.y + 16]);
    izgara(g, k, 4);
    const bw = Math.max(1.5, (k.w - 16) / v.length - 1.5);
    v.forEach((d, i) =>
      el('rect', { x: x(i), y: y(Math.sqrt(d)), width: bw, height: y(0) - y(Math.sqrt(d)), fill: i < 5 ? renk : renk === MAVI ? '#9ab8cf' : '#e8b999' }, g),
    );
  };
}

function sacilimPaneli(xs, ys) {
  return (g, k) => {
    const kod = Object.keys(xs).filter((c) => ys[c] != null);
    const x = scaleLinear().domain([Math.min(...kod.map((c) => xs[c])), Math.max(...kod.map((c) => xs[c]))]).range([k.x + 16, k.x + k.w - 12]);
    const y = scaleLinear().domain([Math.min(...kod.map((c) => ys[c])), Math.max(...kod.map((c) => ys[c]))]).range([k.y + k.h - 14, k.y + 14]);
    izgara(g, k, 5);
    for (const c of kod) el('circle', { cx: x(xs[c]), cy: y(ys[c]), r: 2.6, fill: xs[c] >= 100 ? MAVI : YESIL, 'fill-opacity': 0.8 }, g);
  };
}

// ------------------------------------------------------------------ kilim parçaları
/** Motif hücresi: toprak tonlu zemin, ortada büyük dokuma motifi */
function motifPaneli([ad, renk, zemin]) {
  return (g, k, merkez) => {
    el('rect', { x: k.x, y: k.y, width: k.w, height: k.h, fill: zemin }, g);
    const b = Math.min(k.w, k.h) * 0.46;
    motifCiz(g, ad, merkez[0] - b / 2, merkez[1] - b / 2, b, renk, 5);
  };
}

/** Merkez pano: 26 Düzey 2 bölgesi, Düzey 1 gruplarına göre toprak renkleri */
function bolgePanosu(svg, geoD2, W, ust, alt) {
  const H = alt - ust;
  const pw = Math.min(460, Math.max(240, W * 0.34));
  const x0 = W / 2 - pw / 2;
  const e = Math.min(28, H * 0.16); // kenar eğimi
  const poly = [[x0 + e, ust], [x0 + pw - e, ust], [x0 + pw, ust + H / 2], [x0 + pw - e, alt], [x0 + e, alt], [x0, ust + H / 2]];
  const g = el('g', { class: 'kolaj-pano' }, svg);
  el('polygon', { points: poly.map((p) => p.join(',')).join(' '), fill: TOPRAK.krem, stroke: ZEMIN, 'stroke-width': 7, 'stroke-linejoin': 'round' }, g);
  const kucuk = W < 700;
  const yaziY = kucuk ? 0 : 16;
  const p = geoMercator().fitExtent([[x0 + e + 6, ust + 10 + yaziY], [x0 + pw - e - 6, alt - 10 - yaziY]], geoD2);
  const yol = geoPath(p);
  const renk = [TOPRAK.kiremit, TOPRAK.hardal, TOPRAK.adacayi, TOPRAK.ismavi];
  const d1ler = [...new Set(geoD2.features.map((f) => String(f.id).slice(0, 3)))].sort();
  const sayac = {};
  for (const f of geoD2.features) {
    const d1 = String(f.id).slice(0, 3);
    const n = (sayac[d1] = (sayac[d1] ?? 0) + 1);
    el('path', { d: yol(f), fill: renk[d1ler.indexOf(d1) % renk.length], 'fill-opacity': n % 2 ? 0.95 : 0.62, stroke: TOPRAK.krem, 'stroke-width': 1.1 }, g)
      .appendChild(Object.assign(document.createElementNS(NS, 'title'), {
        textContent: AJANSLAR[f.id] ? `${f.id} · ${AJANSLAR[f.id][0]}\n${AJANSLAR[f.id][1]} (${DUZEY1[String(f.id).slice(0, 3)]})` : f.id,
      }));
  }
  if (!kucuk) {
    const yazi = (x, y, metin, anchor = 'start') => {
      const t = el('text', { x, y, 'text-anchor': anchor, fill: TOPRAK.murekkep, 'font-size': 10, 'letter-spacing': '0.08em', 'font-family': 'IBM Plex Mono, monospace' }, g);
      t.textContent = metin;
    };
    yazi(W / 2, ust + 20, 'İBBS DÜZEY 2', 'middle');
    yazi(W / 2, alt - 11, '26 BÖLGE · 26 KALKINMA AJANSI', 'middle');
  }
}

// ------------------------------------------------------------------ kolaj
export function kolaj(svgEl, v) {
  const { esit, nufus, demografi, geoIl, geoD1, geoD2 } = v;
  const ys = sonYil(esit.haritalar.gsyh_endeks_il);
  const gsyh = esit.haritalar.gsyh_endeks_il[ys];
  const yas = iller(nufus, 'ortanca-yas');
  const artis = iller(nufus, 'yillik-nufus-artis-hizi-binde');
  const d1 = esit.haritalar.d1_theil[sonYil(esit.haritalar.d1_theil)];
  const s = esit.seriler;

  // Hücre sırası: harita ve grafikler dönüşümlü
  const paneller = [
    haritaPaneli(geoIl, gsyh, ikiYonluOlcek(Object.values(gsyh), 100)),
    cizgiPaneli([s.theil_il, s.theil_d2]),
    cubukPaneli(iller(nufus, 'toplam-nufus'), TURUNCU),
    haritaPaneli(geoIl, yas, renkOlcegi(Object.values(yas))),
    cizgiPaneli([tr(demografi, 'dogurganlik-hizi-cocuk-sayisi')], { basvuru: 2.1, renkler: [YESIL] }),
    sacilimPaneli(gsyh, yas),
    haritaPaneli(geoIl, artis, ikiYonluOlcek(Object.values(artis), 0)),
    alanPaneli(s.arasi, s.ici),
    cizgiPaneli([s.ust20_il, s.alt20_il], { basvuru: 1 }),
    haritaPaneli(geoD1, d1, renkOlcegi(Object.values(d1))),
    cizgiPaneli([s.maxmin_il, s.maxmin_d2]),
    cubukPaneli(iller(nufus, 'yillik-nufus-artis-hizi-binde'), MAVI),
  ];

  function ciz() {
    svgEl.replaceChildren();
    const W = svgEl.clientWidth || 1200;
    const H = svgEl.clientHeight || 280;
    svgEl.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const B = 0; // bordür kaldırıldı
    const ust = B + 4;
    const alt = H - B - 4;
    const r = rastgele(7);
    const sutun = Math.max(4, Math.round(W / 190));
    const noktalar = [];
    for (let i = 0; i < sutun; i++) {
      // Her sütunda biri üstte biri altta iki hücre, kaydırılmış: çokgenler iç içe geçer
      const x = ((i + 0.5) / sutun) * W;
      const hh = alt - ust;
      noktalar.push([x + (r() - 0.5) * 50, ust + hh * (0.18 + r() * 0.2)]);
      if (i % 2 === 0 || W > 700) noktalar.push([x + W / sutun / 2 + (r() - 0.5) * 50, ust + hh * (0.62 + r() * 0.25)]);
    }
    const vor = Delaunay.from(noktalar).voronoi([0, ust, W, alt]);
    const defs = el('defs', {}, svgEl);
    let veriSira = 0;
    let motifSira = 0;
    noktalar.forEach((m, i) => {
      const poly = vor.cellPolygon(i);
      if (!poly) return;
      const xs = poly.map((p) => p[0]);
      const ysP = poly.map((p) => p[1]);
      const k = { x: Math.min(...xs), y: Math.min(...ysP), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ysP) - Math.min(...ysP) };
      const id = `kolaj-hucre-${i}`;
      const cp = el('clipPath', { id }, defs);
      el('polygon', { points: poly.map((p) => p.join(',')).join(' ') }, cp);
      const g = el('g', { 'clip-path': `url(#${id})` }, svgEl);
      const motifMi = i % 3 === 1; // her üç hücreden biri dokuma motifi
      try {
        if (motifMi) {
          motifPaneli(MOTIF_HUCRELERI[motifSira++ % MOTIF_HUCRELERI.length])(g, k, [k.x + k.w / 2, k.y + k.h / 2]);
        } else {
          el('rect', { x: k.x, y: k.y, width: k.w, height: k.h, fill: ZEMINLER[veriSira % ZEMINLER.length] }, g);
          paneller[veriSira++ % paneller.length](g, k);
        }
      } catch (e) {
        console.warn('kolaj hücresi çizilemedi', e);
      }
    });
    // Hücreler arasındaki derzler (sayfa zemini renginde)
    el('path', { d: vor.render(), fill: 'none', stroke: ZEMIN, 'stroke-width': 6, 'stroke-linejoin': 'round' }, svgEl);
    el('rect', { x: 0, y: ust, width: W, height: alt - ust, fill: 'none', stroke: ZEMIN, 'stroke-width': 6 }, svgEl);
    if (geoD2) bolgePanosu(svgEl, geoD2, W, ust + 10, alt - 10);
  }

  ciz();
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(ciz, 250);
  });
}
