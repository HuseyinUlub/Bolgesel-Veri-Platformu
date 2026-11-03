/**
 * Ana sayfa giriş şeridi: Türkiye'ye ait harita ve grafiklerden kırık camlı (Voronoi) kolaj.
 * Örnek alınan düzen: growthlab.app/best-of-2025 giriş şeridi (kesilmiş grafik parçaları, beyaz aralıklar).
 *   node tools/giris-kolaji/uret.mjs          → build/giris-kolaji.html (SVG, 3200×1000)
 *   python tools/giris-kolaji/goruntule.py    → public/img/giris-kolaj.{webp,jpg}
 * Veriler public/veri/ altındaki derlenmiş JSON'lardan okunur (önce `npm run veri`).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { geoMercator, geoPath, geoIdentity } from 'd3-geo';
import { scaleLinear, scaleQuantile, scaleSqrt, scaleLog, scaleBand } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { Delaunay } from 'd3-delaunay';

const KOK = new URL('../../', import.meta.url).pathname;
const oku = (p) => JSON.parse(readFileSync(KOK + 'public/veri/' + p, 'utf8'));
const onb = {};
const seri = (dosya, id) => ((onb[dosya] ??= oku(dosya))[id] ?? {});
const geo = (d) => (onb['geo/' + d] ??= oku(`geo/${d}.json`));
const sonYil = (s, en = 0) => Object.keys(s).filter((y) => Object.keys(s[y]).length >= en).sort().at(-1);
const IL = (k) => /^TR[0-9A-C]\d\d$/.test(k);
const D2 = (k) => /^TR[0-9A-C]\d$/.test(k);
const ilAd = Object.fromEntries(geo('province').features.map((f) => [f.id, f.properties.ad]));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const tr = new Intl.NumberFormat('tr-TR');

// ---- palet (site ile aynı aileler)
const MUREKKEP = '#2f2f2f', IKINCIL = '#6b675e', IZGARA = '#e6e1d6';
const TOPRAK = ['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a'];
const ISMAVI = ['#e7eef2', '#b9cfdc', '#86a9c0', '#5b7f95', '#2e4e63'];
const ADACAYI = ['#eef1ea', '#cdd8c8', '#a6b99f', '#7d9076', '#4f5f4a'];
const IKI_YON = ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'];
const SERI = ['#c24a28', '#2e6e9e', '#a87812', '#6d5a9e'];
const CANLI = ['#c74827', '#dd9a3a', '#2e6e9e', '#7d9076', '#6d5a9e', '#e8b999', '#5b7f95', '#a87812', '#b9cfdc', '#cdd8c8'];

const W = 3200, H = 740; // şerit oranı ~4,3:1
const ARALIK = 40;       // parçalar arası boşluk (px); sayfa zemin rengiyle doldurulur
const ZEMIN = '#f9f9f3';  // .giris-gorsel arka planı
const t = (x, y, s, cls = 'yazi', ek = '') => `<text x="${x}" y="${y}" class="${cls}" ${ek}>${esc(s)}</text>`;

// ======================================================= grafikler (w×h kutusunda, beyaz zeminde)
function ilceHaritasi(w, h) {
  const g = geo('district'); // düzlem (metre) koordinatları
  const s = oku('ilce/yasli-bagimlilik-orani.json');
  const y = sonYil(s, 900), d = s[y];
  const yol = geoPath(geoIdentity().reflectY(true).fitExtent([[-w * 0.05, h * 0.08], [w * 1.05, h * 0.95]], g));
  const renk = scaleQuantile().domain(Object.values(d)).range(TOPRAK);
  return g.features.map((f) => `<path d="${yol(f)}" fill="${d[f.id] != null ? renk(d[f.id]) : '#eee'}" stroke="#fff" stroke-width="0.7"/>`).join('')
    ;
}

function ihracatAgac(w, h) {
  const s = seri('k/dis-ticaret.json', 'faaliyet-iline-gore-ihracat-1000');
  const y = sonYil(s, 81);
  const top = Object.entries(s[y]).filter(([k]) => IL(k)).reduce((a, [, v]) => a + v, 0);
  const il = Object.entries(s[y]).filter(([k]) => IL(k)).sort((a, b) => b[1] - a[1]);
  const ust = il.slice(0, 14), diger = il.slice(14).reduce((a, [, v]) => a + v, 0);
  const ogeler = [...ust, ['diğer', diger]].map(([k, v]) => ({ k, v }));
  // basit "squarify"
  const kutular = [];
  (function yerlestir(o, x, y0, ww, hh) {
    if (!o.length) return;
    const toplam = o.reduce((a, b) => a + b.v, 0);
    const yatay = ww >= hh;
    let sira = [], en = Infinity;
    for (let i = 0; i < o.length; i++) {
      const aday = o.slice(0, i + 1), s2 = aday.reduce((a, b) => a + b.v, 0);
      const kalin = (s2 / toplam) * (yatay ? ww : hh), uzun = yatay ? hh : ww;
      const kotu = Math.max(...aday.map((a) => { const l = (a.v / s2) * uzun; return Math.max(l / kalin, kalin / l); }));
      if (kotu > en) break;
      en = kotu; sira = aday;
    }
    const s2 = sira.reduce((a, b) => a + b.v, 0), kalin = (s2 / toplam) * (yatay ? ww : hh);
    let p = 0;
    for (const a of sira) {
      const l = (a.v / s2) * (yatay ? hh : ww);
      kutular.push(yatay ? { ...a, x, y: y0 + p, w: kalin, h: l } : { ...a, x: x + p, y: y0, w: l, h: kalin });
      p += l;
    }
    const kalan = o.slice(sira.length);
    yatay ? yerlestir(kalan, x + kalin, y0, ww - kalin, hh) : yerlestir(kalan, x, y0 + kalin, ww, hh - kalin);
  })(ogeler, 0, 0, w, h);
  return kutular.map((b, i) => {
    const r = b.k === 'diğer' ? '#d9d3c4' : CANLI[i % CANLI.length];
    const pay = Math.round((100 * b.v) / top);
    const ad = b.k === 'diğer' ? 'Diğer 67 il' : ilAd[b.k];
    const buyuk = b.k !== 'diğer' && b.w * b.h > w * h * 0.15;
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${r}" stroke="#fff" stroke-width="3"/>`
      + (buyuk ? `<text x="${b.x + b.w - 24}" y="${b.y + b.h * 0.42}" class="dev" text-anchor="end" style="font-size:50px">${esc(ad)}</text>
          <text x="${b.x + b.w - 24}" y="${b.y + b.h * 0.42 + 100}" class="dev" text-anchor="end" style="font-size:96px">%${pay}</text>`
        : b.w > 110 && b.h > 70 ? `<text x="${b.x + 14}" y="${b.y + 38}" class="kutu">${esc(ad)}</text>` : '')
      + (!buyuk && b.w > 110 && b.h > 110 ? `<text x="${b.x + 14}" y="${b.y + 72}" class="kutu kucuk">%${pay}</text>` : '');
  }).join('');
}

function gsyhIstihdam(w, h) {
  const g = seri('k/ekonomi.json', 'kisi-basina-gsyh');
  const e = seri('k/isgucu.json', 'istihdam-orani-15-yas');
  const y = ['2024', '2023', '2022'].find((yy) => e[yy] && Object.keys(e[yy]).filter(IL).length === 81);
  const n = Object.keys(g[y]).filter((k) => IL(k) && e[y][k] != null).map((k) => ({ k, x: g[y][k], y: e[y][k] }));
  const x = scaleLog().domain([4000, 40000]).range([110, w - 60]);
  const yS = scaleLinear().domain([30, 62]).range([h - 110, 70]);
  const izgara = [5000, 10000, 20000, 40000].map((v) => `<line x1="${x(v)}" x2="${x(v)}" y1="60" y2="${h - 110}" class="izgara"/>${t(x(v), h - 70, tr.format(v) + ' $', 'eksen', 'text-anchor="middle"')}`).join('')
    + [35, 45, 55].map((v) => `<line x1="110" x2="${w - 60}" y1="${yS(v)}" y2="${yS(v)}" class="izgara"/>${t(96, yS(v) + 8, v, 'eksen', 'text-anchor="end"')}`).join('');
  const vurgu = new Set(['TR100', 'TR421', 'TRC33', 'TRB24', 'TR906']);
  const nokta = n.map((d) => `<circle cx="${x(d.x)}" cy="${yS(d.y)}" r="${vurgu.has(d.k) ? 11 : 8}" fill="${vurgu.has(d.k) ? '#c74827' : '#2e6e9e'}" fill-opacity="${vurgu.has(d.k) ? 1 : 0.8}"/>`
    + (vurgu.has(d.k) ? t(x(d.x) + 16, yS(d.y) + 8, ilAd[d.k], 'etiket-kirmizi') : '')).join('');
  return izgara + nokta + t(110, 44, `Kişi başı GSYH ve istihdam oranı, ${y}`, 'baslik')
    + t(30, h / 2, 'İstihdam oranı (%)', 'eksen', `transform="rotate(-90 30 ${h / 2})" text-anchor="middle"`);
}

function sektorAlan(w, h) {
  const ids = ['tarim', 'sanayi', 'hizmetler'].map((s) => seri('k/isgucu.json', `${s}-sektorunde-calisan-nufus-15-yas-1000`));
  const yillar = Object.keys(ids[0]).filter((y) => ids.every((s) => s[y]?.TR != null)).sort();
  const x = scaleLinear().domain([+yillar[0], +yillar.at(-1)]).range([100, w - 40]);
  const toplam = yillar.map((y) => ids.reduce((a, s) => a + s[y].TR, 0));
  const yS = scaleLinear().domain([0, Math.max(...toplam) * 1.05]).range([h - 90, 60]);
  const bw = (x(+yillar[1]) - x(+yillar[0])) * 0.7;
  const renk = ['#a87812', '#c24a28', '#2e6e9e'];
  let cub = '';
  yillar.forEach((y) => {
    let alt = 0;
    ids.forEach((s, j) => {
      const v = s[y].TR;
      cub += `<rect x="${x(+y) - bw / 2}" y="${yS(alt + v)}" width="${bw}" height="${yS(alt) - yS(alt + v) - 2}" rx="2" fill="${renk[j]}"/>`;
      alt += v;
    });
  });
  const ek = [10000, 20000, 30000].map((v) => `<line x1="100" x2="${w - 40}" y1="${yS(v)}" y2="${yS(v)}" class="izgara"/>${t(88, yS(v) + 8, tr.format(v / 1000) + ' mn', 'eksen', 'text-anchor="end"')}`).join('');
  const lej = ['Tarım', 'Sanayi', 'Hizmetler'].map((a, j) => `<rect x="${120 + j * 190}" y="${h - 58}" width="22" height="22" fill="${renk[j]}"/>${t(150 + j * 190, h - 40, a, 'eksen')}`).join('');
  return ek + cub + lej + t(100, 44, `Türkiye'de istihdam, ${yillar[0]}–${yillar.at(-1)}`, 'baslik');
}

function sirali(w, h) {
  const s = seri('k/nufus.json', 'ortanca-yas');
  const y = sonYil(s, 81);
  const il = Object.entries(s[y]).filter(([k]) => IL(k)).sort((a, b) => b[1] - a[1]);
  const sec = [...il.slice(0, 5), ...il.slice(-5)];
  const band = scaleBand().domain(sec.map((d) => d[0])).range([60, h - 40]).padding(0.18);
  const x = scaleLinear().domain([0, il[0][1] * 1.05]).range([0, w - 330]);
  return sec.map(([k, v], i) => `${t(250, band(k) + band.bandwidth() * 0.8, ilAd[k], 'eksen', 'text-anchor="end"')}
      <rect x="264" y="${band(k)}" width="${x(v)}" height="${band.bandwidth()}" rx="3" fill="${i < 5 ? '#7d9076' : '#dd9a3a'}"/>
      ${t(272 + x(v), band(k) + band.bandwidth() * 0.8, v.toFixed(1).replace('.', ','), 'eksen')}`).join('')
    + t(30, 40, `Ortanca yaş: en yaşlı ve en genç 5 il, ${y}`, 'baslik');
}

function fuaBalon(w, h) {
  const il = geo('province'), fua = geo('fua');
  const s = seri('k/kentler-oecd.json', 'kent-nufusu-oecd');
  const y = sonYil(s, 20);
  const yol = geoPath(geoMercator().fitExtent([[20, 60], [w - 20, h - 40]], il));
  const r = scaleSqrt().domain([0, Math.max(...Object.values(s[y]))]).range([0, Math.min(w, h) * 0.16]);
  return il.features.map((f) => `<path d="${yol(f)}" fill="#f1ede4" stroke="#fff" stroke-width="1.2"/>`).join('')
    + fua.features.map((f) => ({ f, n: s[y][f.id] ?? 0, c: yol.centroid(f) })).sort((a, b) => b.n - a.n)
      .map(({ f, n, c }) => `<circle cx="${c[0]}" cy="${c[1]}" r="${r(n)}" fill="#5b7f95" fill-opacity="0.45" stroke="#2e4e63" stroke-width="2"/>`
        + (n > 1.5e6 ? t(c[0], c[1] + 8, f.properties.ad, 'eksen koyu', 'text-anchor="middle"') : '')).join('')
    + t(30, 44, `İşlevsel kentsel alanlar, nüfus ${y}`, 'baslik');
}

function isiHaritasi(w, h) {
  const s = seri('k/nufus.json', 'yasli-bagimlilik-orani');
  const yillar = Object.keys(s).filter((y) => Object.keys(s[y]).some(D2)).sort().slice(-14);
  const son = yillar.at(-1);
  const b = Object.keys(s[son]).filter(D2).sort((p, q) => s[son][q] - s[son][p]);
  const renk = scaleQuantile().domain(b.flatMap((k) => yillar.map((y) => s[y][k]))).range(ADACAYI);
  const ux = 110, uy = 70, cw = (w - ux - 30) / yillar.length, ch = (h - uy - 50) / b.length;
  return b.flatMap((k, i) => yillar.map((y, j) => `<rect x="${ux + j * cw}" y="${uy + i * ch}" width="${cw - 3}" height="${ch - 3}" fill="${renk(s[y][k])}"/>`)).join('')
    + b.map((k, i) => (i % 3 === 0 ? t(ux - 10, uy + i * ch + ch * 0.8, k, 'eksen kucuk', 'text-anchor="end"') : '')).join('')
    + t(ux, 44, `Yaşlı bağımlılık oranı, ${yillar[0]}–${son}`, 'baslik');
}

function gocCubuk(w, h) {
  const s = seri('k/goc.json', 'net-goc-hizi-binde');
  const y = sonYil(s, 26);
  const b = Object.entries(s[y]).filter(([k]) => D2(k)).sort((p, q) => q[1] - p[1]);
  const m = Math.max(...b.map((d) => Math.abs(d[1])));
  const x = scaleLinear().domain([-m, m]).range([60, w - 60]);
  const band = scaleBand().domain(b.map((d) => d[0])).range([70, h - 40]).padding(0.2);
  return `<line x1="${x(0)}" x2="${x(0)}" y1="60" y2="${h - 30}" stroke="${MUREKKEP}" stroke-width="2"/>`
    + b.map(([k, v]) => `<rect x="${Math.min(x(0), x(v))}" y="${band(k)}" width="${Math.abs(x(v) - x(0))}" height="${band.bandwidth()}" rx="2" fill="${v < 0 ? IKI_YON[0] : IKI_YON[4]}"/>`
      + (b.findIndex((q) => q[0] === k) % 2 === 0 ? t(v < 0 ? x(0) + 10 : x(0) - 10, band(k) + band.bandwidth() * 0.9, k, 'eksen kucuk', v < 0 ? '' : 'text-anchor="end"') : '')).join('')
    + t(60, 44, `Bölgelerin net göç hızı (binde), ${y}`, 'baslik');
}

function gsyhHaritasi(w, h) {
  const g = geo('province');
  const s = seri('k/ekonomi.json', 'kisi-basina-gsyh-endeksi-turkiye-100');
  const y = sonYil(s, 81), d = s[y];
  const yol = geoPath(geoMercator().fitExtent([[-w * 0.04, 70], [w * 1.04, h - 20]], g));
  const renk = scaleQuantile().domain(Object.values(d)).range(TOPRAK);
  return g.features.map((f) => `<path d="${yol(f)}" fill="${renk(d[f.id])}" stroke="#fff" stroke-width="1.5"/>`).join('')
    + t(40, 48, `Kişi başı GSYH, Türkiye = 100, ${y}`, 'baslik');
}

function kentCizgi(w, h) {
  const s = seri('k/kentler-oecd.json', 'kent-nufusu-oecd');
  const yillar = Object.keys(s).sort();
  const kentler = [['TR003F', 'Antalya'], ['TR010F', 'Gaziantep'], ['TR001F', 'Ankara'], ['TR012F', 'İstanbul']];
  const ser = kentler.map(([k, ad]) => ({ ad, v: yillar.map((y) => [+y, (100 * s[y][k]) / s[yillar[0]][k]]) }));
  const x = scaleLinear().domain([+yillar[0], +yillar.at(-1)]).range([90, w - 200]);
  const tum = ser.flatMap((d) => d.v.map((p) => p[1]));
  const yS = scaleLinear().domain([Math.min(...tum) - 2, Math.max(...tum) + 3]).range([h - 80, 70]);
  const cz = line().x((p) => x(p[0])).y((p) => yS(p[1])).curve(curveMonotoneX);
  const alan = area().x((p) => x(p[0])).y0(yS(100)).y1((p) => yS(p[1])).curve(curveMonotoneX);
  return yS.ticks(4).map((v) => `<line x1="90" x2="${w - 200}" y1="${yS(v)}" y2="${yS(v)}" class="izgara"/>${t(80, yS(v) + 8, v, 'eksen', 'text-anchor="end"')}`).join('')
    + `<path d="${alan(ser[0].v)}" fill="#c24a28" fill-opacity="0.12"/>`
    + ser.map((d, i) => { const e = d.v.at(-1); return `<path d="${cz(d.v)}" fill="none" stroke="${SERI[i]}" stroke-width="5"/>
        <circle cx="${x(e[0])}" cy="${yS(e[1])}" r="8" fill="${SERI[i]}"/>${t(x(e[0]) + 14, yS(e[1]) + 8, d.ad, 'etiket')}`; }).join('')
    + t(90, 44, `Kent nüfusu, ${yillar[0]} = 100`, 'baslik');
}

function kirHaritasi(w, h) {
  const g = geo('province');
  const s = seri('k/nufus.json', 'kir-nufus-orani');
  const y = sonYil(s, 81), d = s[y];
  const yol = geoPath(geoMercator().fitExtent([[-w * 0.03, 70], [w * 1.03, h - 20]], g));
  const renk = scaleQuantile().domain(Object.values(d)).range(ADACAYI);
  return g.features.map((f) => `<path d="${yol(f)}" fill="${renk(d[f.id])}" stroke="#fff" stroke-width="1.5"/>`).join('')
    + t(40, 48, `Kırda yaşayanların payı, ${y}`, 'baslik');
}

function dogurganlik(w, h) {
  const s = seri('k/demografi.json', 'dogurganlik-hizi-cocuk-sayisi');
  const yillar = Object.keys(s).filter((y) => Object.keys(s[y]).some(D2)).sort();
  const x = scaleLinear().domain([+yillar[0], +yillar.at(-1)]).range([80, w - 50]);
  const yS = scaleLinear().domain([1, 4.2]).range([h - 70, 70]);
  const d2 = Object.keys(s[yillar.at(-1)]).filter(D2);
  const cz = line().x((p) => x(p[0])).y((p) => yS(p[1])).curve(curveMonotoneX);
  const cizgi = (k) => cz(yillar.filter((y) => s[y][k] != null).map((y) => [+y, s[y][k]]));
  return [1.5, 2.1, 3, 4].map((v) => `<line x1="80" x2="${w - 50}" y1="${yS(v)}" y2="${yS(v)}" class="izgara" ${v === 2.1 ? 'stroke-dasharray="8 6" stroke="#b9b2a2"' : ''}/>${t(70, yS(v) + 8, String(v).replace('.', ','), 'eksen', 'text-anchor="end"')}`).join('')
    + d2.map((k) => `<path d="${cizgi(k)}" fill="none" stroke="#9ab8cf" stroke-width="2.5"/>`).join('')
    + `<path d="${cizgi('TR')}" fill="none" stroke="#c74827" stroke-width="6"/>`
    + t(x(+yillar.at(-1)) - 10, yS(s[yillar.at(-1)].TR) - 16, 'Türkiye', 'etiket-kirmizi', 'text-anchor="end"')
    + t(80, 44, 'Toplam doğurganlık hızı, 26 bölge', 'baslik');
}

// ======================================================= Voronoi yerleşimi
// tohumlar: iki sıra, hafif düzensiz (asimetrik); dar ekranda görünen orta bölgeye güçlü parçalar
const PARCALAR = [
  [140, 300, gsyhHaritasi], [240, 800, isiHaritasi], [600, 500, gsyhIstihdam], [1010, 160, kentCizgi],
  [1060, 820, gocCubuk], [1470, 450, ilceHaritasi], [1960, 170, ihracatAgac], [1860, 810, sektorAlan],
  [2380, 500, fuaBalon], [2720, 190, dogurganlik], [2700, 790, sirali], [3080, 430, kirHaritasi],
];
const HARITALAR = new Set([ilceHaritasi, gsyhHaritasi, kirHaritasi, fuaBalon, ihracatAgac]);
const vor = Delaunay.from(PARCALAR.map((p) => [p[0], (p[1] * H) / 1000])).voronoi([0, 0, W, H]);
let govde = '', kenar = '', tanim = '';
PARCALAR.forEach(([, , fn], i) => {
  const poly = vor.cellPolygon(i);
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const d = 'M' + poly.map((p) => p.join(',')).join('L') + 'Z';
  tanim += `<clipPath id="k${i}"><path d="${d}"/></clipPath>`;
  // grafik, hücrenin iç kısmına oturan kutuda çizilir; köşeler kırpılır
  const harita = HARITALAR.has(fn);
  const ix = w * (harita ? 0.05 : 0.16), iy = h * (harita ? 0.03 : 0.13);
  govde += `<g clip-path="url(#k${i})"><rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#fff"/>
    <g transform="translate(${x0 + ix},${y0 + iy})">${fn(w - 2 * ix, h - 2 * iy)}</g></g>`;
  kenar += `<path d="${d}"/>`;
});

const font = (f) => KOK + 'node_modules/@fontsource/' + f;
const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
@font-face{font-family:'Sans';font-weight:400;src:url('file://${font('source-sans-3/files/source-sans-3-latin-ext-400-normal.woff2')}') format('woff2');}
@font-face{font-family:'Sans';font-weight:400;src:url('file://${font('source-sans-3/files/source-sans-3-latin-400-normal.woff2')}') format('woff2');}
@font-face{font-family:'Sans';font-weight:600;src:url('file://${font('source-sans-3/files/source-sans-3-latin-ext-600-normal.woff2')}') format('woff2');}
@font-face{font-family:'Sans';font-weight:600;src:url('file://${font('source-sans-3/files/source-sans-3-latin-600-normal.woff2')}') format('woff2');}
@font-face{font-family:'Sans';font-weight:700;src:url('file://${font('source-sans-3/files/source-sans-3-latin-ext-700-normal.woff2')}') format('woff2');}
@font-face{font-family:'Sans';font-weight:700;src:url('file://${font('source-sans-3/files/source-sans-3-latin-700-normal.woff2')}') format('woff2');}
html,body{margin:0;background:#fff}
text{font-family:Sans,sans-serif}
.baslik{font-size:26px;font-weight:600;fill:${MUREKKEP}}
.eksen{font-size:20px;fill:${IKINCIL}} .eksen.kucuk{font-size:17px} .eksen.koyu{fill:#fff;font-weight:600}
.etiket{font-size:24px;font-weight:600;fill:${MUREKKEP}} .etiket-kirmizi{font-size:23px;font-weight:600;fill:#c74827}
.kutu{font-size:26px;font-weight:600;fill:#fff} .kutu.kucuk{font-size:22px;font-weight:400}
.dev{font-size:92px;font-weight:700;fill:#fff}
.izgara{stroke:${IZGARA};stroke-width:1.5}
.kenar path{fill:none;stroke-linejoin:round}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>${tanim}</defs><rect width="${W}" height="${H}" fill="#fff"/>${govde}
<g class="kenar" stroke="#e4dfd3" stroke-width="${ARALIK + 3}">${kenar}</g>
<g class="kenar" stroke="${ZEMIN}" stroke-width="${ARALIK}">${kenar}</g>
<rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="${ZEMIN}" stroke-width="${ARALIK}"/>
</svg></body></html>`;
mkdirSync(KOK + 'build', { recursive: true });
writeFileSync(KOK + 'build/giris-kolaji.html', html);
console.log('yazıldı: build/giris-kolaji.html', (html.length / 1e6).toFixed(1), 'MB');
