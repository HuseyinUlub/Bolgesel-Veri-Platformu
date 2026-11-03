/**
 * Hakkında sayfası: metin hakkinda.html içinde. Burada üst çubuk,
 * İBBS haritası/tablosu ve alt başlık menüsünün vurgusu kurulur.
 */
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '../styles/hikaye.css';
import '../styles/hakkinda.css';

import { geoMercator, geoPath } from 'd3-geo';
import { araclarMenusu } from '../lib/menu.js';
import { SITE } from '../site.config.js';
import { esc } from '../lib/format.js';
import { geometri, kategoriVerisi } from '../lib/data.js';
import { TOPRAK } from '../lib/motifler.js';
import { AJANSLAR, DUZEY1, d1Kodu } from '../lib/ajanslar.js';

const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const RENKLER = [TOPRAK.kiremit, TOPRAK.hardal, TOPRAK.adacayi, TOPRAK.ismavi];

$('#site-baslik').textContent = SITE.baslik;
araclarMenusu($('#araclar'));



// Düzey 1 renkleri: aynı Düzey 1'deki Düzey 2 bölgeleri aynı renk, ikincisi açık tonda
const d1ler = Object.keys(DUZEY1);
const renk = (d2) => RENKLER[d1ler.indexOf(d1Kodu(d2)) % RENKLER.length];
const acik = (d2) => Object.keys(AJANSLAR).filter((k) => d1Kodu(k) === d1Kodu(d2)).indexOf(d2) % 2 === 1;

// Tablo
$('#ibbs-satirlar').innerHTML = Object.entries(AJANSLAR)
  .map(([k, [ajans, iller]], i, a) => {
    const d1 = d1Kodu(k);
    const ilk = i === 0 || d1Kodu(a[i - 1][0]) !== d1;
    const say = a.filter(([x]) => d1Kodu(x) === d1).length;
    return `<tr>${ilk ? `<td rowspan="${say}"><span class="kod">${d1}</span> ${esc(DUZEY1[d1])}</td>` : ''}
      <td><span class="renk" style="background:${renk(k)};opacity:${acik(k) ? 0.62 : 0.95}"></span><span class="kod">${k}</span></td>
      <td>${esc(iller)}</td><td>${esc(ajans)}</td></tr>`;
  })
  .join('');

// Harita
let geo = null;
async function harita() {
  const svg = $('#ibbs-harita');
  geo ??= await geometri('region26');
  const W = svg.clientWidth || 700;
  const H = Math.round(W * 0.46);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;
  svg.replaceChildren();
  const yol = geoPath(geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], geo));
  const bilgi = $('#ibbs-bilgi');
  const varsayilan = bilgi.textContent;
  for (const f of geo.features) {
    const [ajans, iller] = AJANSLAR[f.id] ?? ['', ''];
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', yol(f));
    p.setAttribute('fill', renk(f.id));
    p.setAttribute('fill-opacity', acik(f.id) ? 0.62 : 0.95);
    p.setAttribute('class', 'ibbs-bolge');
    p.setAttribute('tabindex', '0');
    p.setAttribute('aria-label', `${f.id} ${ajans}: ${iller}`);
    const goster = () => {
      bilgi.innerHTML = `<span class="kod">${f.id}</span> <b>${esc(ajans)}</b> · ${esc(iller)}
        <span class="soluk">(${esc(DUZEY1[d1Kodu(f.id)])})</span>`;
    };
    p.addEventListener('mouseenter', () => {
      svg.appendChild(p); // kenar çizgisi komşuların altında kalmasın
      goster();
    });
    p.addEventListener('focus', goster);
    p.addEventListener('mouseleave', () => (bilgi.textContent = varsayilan));
    svg.appendChild(p);
  }
}
harita().catch((e) => console.warn('İBBS haritası çizilemedi', e));

// İşlevsel kentsel alanlar (OECD FUA): il sınırları zeminde, FUA'lar üstte
const sayi = (x) => Math.round(x).toLocaleString('tr-TR');
let fuaVeri = null;
async function fuaHarita() {
  const svg = $('#fua-harita');
  if (!svg) return;
  fuaVeri ??= await Promise.all([geometri('province'), geometri('fua'), kategoriVerisi('Kentler (OECD)').catch(() => ({}))]);
  const [iller, fua, kentler] = fuaVeri;
  const nufusSeri = kentler['kent-nufusu-oecd'] ?? {};
  const sonYil = Object.keys(nufusSeri).sort().at(-1);
  const nufus = nufusSeri[sonYil] ?? {};
  const W = svg.clientWidth || 700;
  const H = Math.round(W * 0.46);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;
  svg.replaceChildren();
  const yol = geoPath(geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], iller));
  for (const f of iller.features) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', yol(f));
    p.setAttribute('class', 'fua-zemin');
    svg.appendChild(p);
  }
  const bilgi = $('#fua-bilgi');
  const varsayilan = bilgi.textContent;
  for (const f of fua.features) {
    const ad = f.properties?.ad ?? f.id;
    const n = nufus[f.id];
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', yol(f));
    p.setAttribute('class', 'fua-alan');
    p.setAttribute('tabindex', '0');
    p.setAttribute('aria-label', `${ad} işlevsel kentsel alanı${n ? `, ${sayi(n)} kişi` : ''}`);
    const goster = () => {
      bilgi.innerHTML = `<b>${esc(ad)}</b> işlevsel kentsel alanı${n ? ` · ${sayi(n)} kişi <span class="soluk">(${sonYil})</span>` : ''}`;
    };
    p.addEventListener('mouseenter', () => { svg.appendChild(p); goster(); });
    p.addEventListener('focus', goster);
    p.addEventListener('mouseleave', () => (bilgi.textContent = varsayilan));
    svg.appendChild(p);
  }
}
fuaHarita().catch((e) => console.warn('FUA haritası çizilemedi', e));

// Kent-kır sınıflaması (TÜİK 2022): mahalle ve köyler, il zemininde; üzerine gelinen ilin nüfus ve alan payları
let kkVeri = null;
async function kentKirHarita() {
  const svg = $('#kent-kir-harita');
  if (!svg) return;
  kkVeri ??= await Promise.all([geometri('province'), geometri('kent-kir'), kategoriVerisi('Nüfus').catch(() => ({}))]);
  const [iller, kk, nufus] = kkVeri;
  const son = (id) => {
    const s = nufus[id] ?? {};
    const y = Object.keys(s).sort().at(-1);
    return [s[y] ?? {}, y];
  };
  const [nY, yil] = son('yogun-kent-nufus-orani');
  const [nO] = son('orta-yogun-kent-nufus-orani');
  const [nK] = son('kir-nufus-orani');
  const [aY] = son('yogun-kent-alan-payi');
  const [aO] = son('orta-yogun-kent-alan-payi');
  const W = svg.clientWidth || 700;
  const H = Math.round(W * 0.46);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;
  svg.replaceChildren();
  const yol = geoPath(geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], iller));
  const ciz = (d, sinif) => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('class', sinif);
    svg.appendChild(p);
    return p;
  };
  const zemin = iller.features.map((f) => [f, ciz(yol(f), 'kk-il')]);
  for (const f of kk.features) ciz(yol(f), `kk-alan kk-${f.id}`);
  const vurgu = ciz('', 'kk-vurgu');
  const bilgi = $('#kent-kir-bilgi');
  const varsayilan = bilgi.innerHTML;
  const yz = (v) => (v == null ? '–' : `%${v.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`);
  for (const [f, p] of zemin) {
    const ad = f.properties?.ad ?? f.id;
    p.setAttribute('tabindex', '0');
    p.setAttribute('aria-label', `${ad}: nüfusun ${yz(nY[f.id])} yoğun kentte`);
    const goster = () => {
      vurgu.setAttribute('d', p.getAttribute('d'));
      bilgi.innerHTML = `<b>${esc(ad)}</b> · nüfus (${yil}): yoğun kent ${yz(nY[f.id])}, orta yoğun ${yz(nO[f.id])}, kır ${yz(nK[f.id])}`
        + `<br><span class="soluk">Yüzölçümü payı (2022): yoğun kent ${yz(aY[f.id])}, orta yoğun ${yz(aO[f.id])}</span>`;
    };
    p.addEventListener('mouseenter', goster);
    p.addEventListener('focus', goster);
    p.addEventListener('mouseleave', () => { bilgi.innerHTML = varsayilan; vurgu.setAttribute('d', ''); });
  }
}
kentKirHarita().catch((e) => console.warn('Kent-kır haritası çizilemedi', e));

let t;
window.addEventListener('resize', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    harita();
    fuaHarita();
    kentKirHarita();
  }, 200);
});

// Alt başlık menüsü: okunan bölümü vurgula
const baglar = new Map([...document.querySelectorAll('.hakkinda-icindekiler a')].map((a) => [a.hash.slice(1), a]));
const gozlem = new IntersectionObserver(
  (girdiler) => {
    for (const g of girdiler) {
      if (!g.isIntersecting) continue;
      for (const a of baglar.values()) a.removeAttribute('aria-current');
      baglar.get(g.target.id)?.setAttribute('aria-current', 'true');
    }
  },
  { rootMargin: '-30% 0px -60% 0px' },
);
for (const id of baglar.keys()) {
  const s = document.getElementById(id);
  if (s) gozlem.observe(s);
}
