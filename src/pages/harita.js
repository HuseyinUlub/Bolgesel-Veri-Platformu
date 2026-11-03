/**
 * Harita Oluşturma: ilçe, il, Düzey 2 ve Düzey 1 haritaları tek sayfada.
 * Veri sitenin veritabanından (public/veri) gelir; istenirse kullanıcı kendi verisini yapıştırır.
 * Harita tek bir SVG'dir (başlık, lejant ve kaynak dahil); PNG/SVG olarak olduğu gibi indirilir.
 */
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '../styles/hikaye.css';
import '../styles/arac.css';

import { geoMercator, geoPath } from 'd3-geo';
import { interpolateRgbBasis } from 'd3-interpolate';
import { SITE } from '../site.config.js';
import { araclarMenusu } from '../lib/menu.js';
import { manifest, kapsamliYillar } from '../lib/data.js';
import { sayi, esc } from '../lib/format.js';

import {
  kategoriSecenekleri, ARAC_DUZEYLERI, birimler, birimAdi, altinda, kategoriler, gostergeler, degerler, turkiye, geo,
  secenekler, gostergeSecenekleri, kapsamSecenekleri, indir, csv, dosyaAdi, kendiVerisi, gorunenAd,
} from '../lib/arac.js';

const $ = (id) => document.getElementById(id);
// indirme: artifact görünümünde izleyiciden kaydetme onayı istenir; sonuç durum satırına yazılır
const indirB = (...a) => indir(...a).then((r) => { if (r === 'iptal') $('durum').textContent = 'İndirme iptal edildi.'; })
  .catch((e) => { console.error(e); $('durum').textContent = `İndirilemedi: ${e.message}`; });
const NS = 'http://www.w3.org/2000/svg';

/** Paletler: tek tonlu olanlar açıktan koyuya; "iki yönlü" Türkiye değerinin iki yanını ayırır */
const PALETLER = {
  toprak: { ad: 'Toprak', renkler: ['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a'] },
  mavi: { ad: 'Mavi', renkler: ['#eef4fa', '#bcd3e8', '#7fa9cf', '#3f7cb0', '#1f4e79'] },
  yesil: { ad: 'Yeşil', renkler: ['#eef6ee', '#c0dfc2', '#86bf8b', '#4a9656', '#23622f'] },
  mor: { ad: 'Mor', renkler: ['#f3eff8', '#d3c7e6', '#a894cc', '#7560a8', '#4b3a78'] },
  gri: { ad: 'Gri', renkler: ['#f2f2f0', '#cfcfcb', '#a3a39e', '#6f6f6a', '#3a3a37'] },
  ikiyon: { ad: 'İki yönlü', renkler: ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'], ikiYon: true },
  ozel: { ad: 'Özel', renkler: null },
};
const BOS = '#e6e5df';
const UST = { ilce: 'il', il: 'duzey2', duzey2: 'duzey1' };

const durum = {
  duzey: 'il', kategori: 'Nüfus', gosterge: 'toplam-nufus', yil: null, kapsam: 'TR',
  palet: 'toprak', kendi: null, kendiBaslik: '',
};
let B; // birimler
let M;
let son = null; // son çizim: { satirlar, g, yil, baslik }

// ------------------------------------------------------------------ başlangıç
async function init() {
  $('site-baslik').textContent = SITE.baslik;
  araclarMenusu($('araclar'));
  const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
  document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));

  const p = new URLSearchParams(location.search);
  for (const k of ['duzey', 'kategori', 'gosterge', 'kapsam']) if (p.get(k)) durum[k] = p.get(k);
  if (p.get('yil')) durum.yil = p.get('yil');
  if (!ARAC_DUZEYLERI[durum.duzey] || durum.duzey === 'tr') durum.duzey = 'il';

  [M, B] = await Promise.all([manifest(), birimler()]);
  paletleriKur();
  olaylariKur();
  await duzeyDegisti();
}

function paletleriKur() {
  $('palet').innerHTML = Object.entries(PALETLER)
    .map(([k, p]) => {
      const r = p.renkler ?? [$('renk1').value, $('renk2').value];
      return `<button type="button" role="radio" data-palet="${k}" title="${p.ad}" aria-label="${p.ad}">
        <span style="background:linear-gradient(90deg,${r.join(',')})"></span>${p.ad}</button>`;
    })
    .join('');
  paletSec(durum.palet);
}
function paletSec(k) {
  durum.palet = k;
  $('palet').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.palet === k)));
  $('ozel-renk').hidden = k !== 'ozel';
}

function olaylariKur() {
  $('duzey').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-duzey]');
    if (!b || b.dataset.duzey === durum.duzey) return;
    durum.duzey = b.dataset.duzey;
    durum.kendi = null;
    kendiDurum('');
    await duzeyDegisti();
  });
  $('kategori').addEventListener('change', async (e) => {
    durum.kategori = e.target.value;
    durum.gosterge = null;
    await kategoriDegisti();
  });
  $('gosterge').addEventListener('change', async (e) => {
    durum.gosterge = e.target.value;
    $('baslik').value = '';
    await gostergeDegisti();
  });
  $('yil').addEventListener('change', (e) => { durum.yil = e.target.value; ciz(); });
  $('kapsam').addEventListener('change', (e) => { durum.kapsam = e.target.value; ciz(); });
  for (const id of ['siniflama', 'sinif', 'lejant', 'sinir', 'etiket-ad', 'etiket-deger', 'ust-sinir', 'renk1', 'renk2']) {
    $(id).addEventListener(id.startsWith('renk') ? 'input' : 'change', () => {
      if (id.startsWith('renk')) paletleriKur();
      ciz();
    });
  }
  $('siniflama').addEventListener('change', () => ($('sinif').disabled = $('siniflama').value === 'surekli'));
  let zaman;
  $('baslik').addEventListener('input', () => { clearTimeout(zaman); zaman = setTimeout(ciz, 250); });
  $('palet').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-palet]');
    if (b) { paletSec(b.dataset.palet); ciz(); }
  });
  $('kendi-dosya').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const buf = await f.arrayBuffer();
    let metin;
    try {
      metin = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    } catch {
      metin = new TextDecoder('windows-1254').decode(buf); // Excel'in Türkçe CSV'si
    }
    $('kendi-metin').value = metin;
    durum.kendiBaslik = f.name.replace(/\.[^.]+$/, '');
  });
  $('kendi-uygula').addEventListener('click', kendiUygula);
  $('indir-png').addEventListener('click', pngIndir);
  $('indir-svg').addEventListener('click', svgIndir);
  $('indir-csv').addEventListener('click', csvIndir);
  window.addEventListener('resize', () => { clearTimeout(zaman); zaman = setTimeout(ciz, 200); });
}

// ------------------------------------------------------------------ seçim zinciri
async function duzeyDegisti() {
  $('duzey').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.duzey === durum.duzey)));
  const ks = await kategoriler(durum.duzey);
  if (!ks.includes(durum.kategori)) durum.kategori = ks[0];
  kategoriSecenekleri($('kategori'), ks, durum.kategori);
  await kapsamSecenekleri($('kapsam'), durum.duzey, durum.kapsam);
  durum.kapsam = $('kapsam').value;
  $('ust-sinir').closest('label').hidden = !UST[durum.duzey];
  await kategoriDegisti();
}

async function kategoriDegisti() {
  const gs = await gostergeler(durum.kategori, durum.duzey);
  if (!gs.some((g) => g.id === durum.gosterge)) durum.gosterge = SITE.varsayilanGosterge[durum.kategori] && gs.some((g) => g.id === SITE.varsayilanGosterge[durum.kategori]) ? SITE.varsayilanGosterge[durum.kategori] : gs[0]?.id;
  gostergeSecenekleri($('gosterge'), gs, durum.gosterge);
  await gostergeDegisti();
}

let veri = null; // { yıl: { kod: değer } } seçili gösterge + düzey
let trVeri = {};
async function gostergeDegisti() {
  durumYaz('Yükleniyor…');
  [veri, trVeri] = await Promise.all([
    degerler(durum.kategori, durum.gosterge, durum.duzey),
    durum.duzey === 'ilce' ? {} : turkiye(durum.kategori, durum.gosterge),
  ]);
  const hedef = ARAC_DUZEYLERI[durum.duzey].veri;
  const ys = kapsamliYillar(veri, (k) => (B[k]?.duzey ?? (k.startsWith('ILCE') ? 'district' : '')) === hedef).reverse();
  if (!ys.includes(String(durum.yil))) durum.yil = ys[0];
  secenekler($('yil'), ys.map((y) => [y, y]), durum.yil);
  await ciz();
}

function adresiGuncelle() {
  const p = new URLSearchParams({ duzey: durum.duzey, kategori: durum.kategori, gosterge: durum.gosterge ?? '', yil: durum.yil ?? '' });
  if (durum.kapsam !== 'TR') p.set('kapsam', durum.kapsam);
  history.replaceState(null, '', `?${p}`);
}

// ------------------------------------------------------------------ kendi verisi
function kendiDurum(m) { $('kendi-durum').textContent = m; }
function kendiUygula() {
  const metin = $('kendi-metin').value.trim();
  if (!metin) {
    durum.kendi = null;
    kendiDurum('');
    ['gosterge', 'yil', 'kategori'].forEach((id) => ($(id).disabled = false));
    ciz();
    return;
  }
  const { degerler: d, eslesmeyen, baslik } = kendiVerisi(metin, B, ARAC_DUZEYLERI[durum.duzey].veri);
  if (!d.size) {
    kendiDurum(`Hiçbir satır ${ARAC_DUZEYLERI[durum.duzey].etiket.toLocaleLowerCase('tr')} düzeyindeki birimlerle eşleşmedi. Düzeyi doğru seçtiğinizden emin olun.`);
    return;
  }
  durum.kendi = d;
  if (baslik && !durum.kendiBaslik) durum.kendiBaslik = baslik;
  ['gosterge', 'yil', 'kategori'].forEach((id) => ($(id).disabled = true));
  kendiDurum(`${d.size} birim eşleşti.` + (eslesmeyen.length ? ` Eşleşmeyen ${eslesmeyen.length}: ${eslesmeyen.slice(0, 6).join(', ')}${eslesmeyen.length > 6 ? '…' : ''}` : '') + ' Veritabanına dönmek için kutuyu boşaltıp Uygula\'ya basın.');
  ciz();
}

// ------------------------------------------------------------------ renk ve sınıflar
function renkRampasi() {
  const p = PALETLER[durum.palet];
  return interpolateRgbBasis(p.renkler ?? [$('renk1').value, $('renk2').value]);
}

/** @returns {{ renk:(v)=>string, lejant:{tur:'sinif'|'surekli', siniflar?, min?, max?, rampa?} }} */
function olcek(vals, ortaDeger) {
  const rampa = renkRampasi();
  const sirali = [...vals].sort((a, b) => a - b);
  const min = sirali[0];
  const max = sirali.at(-1);
  const tur = $('siniflama').value;
  const ikiYon = PALETLER[durum.palet].ikiYon;
  if (tur === 'surekli' || new Set(sirali).size < 3) {
    let t;
    let orta = null;
    if (ikiYon && max > min) {
      // Orta nokta: Türkiye değeri birimlerin aralığındaysa o (oranlar), değilse medyan (toplamlar)
      const trIcinde = ortaDeger != null && min < ortaDeger && ortaDeger < max;
      orta = { deger: trIcinde ? ortaDeger : sirali[Math.floor(sirali.length / 2)], etiket: trIcinde ? 'TR' : 'Medyan' };
      const gen = Math.max(orta.deger - min, max - orta.deger);
      t = (v) => 0.5 + (v - orta.deger) / (2 * gen);
    } else t = (v) => (max === min ? 0.5 : (v - min) / (max - min));
    return { renk: (v) => rampa(Math.max(0, Math.min(1, t(v)))), lejant: { tur: 'surekli', min, max, rampa, orta, t } };
  }
  const k = Math.min(Number($('sinif').value), new Set(sirali).size);
  let esikler;
  if (tur === 'esit') esikler = Array.from({ length: k - 1 }, (_, i) => min + ((i + 1) * (max - min)) / k);
  else esikler = Array.from({ length: k - 1 }, (_, i) => sirali[Math.floor(((i + 1) * sirali.length) / k)]);
  esikler = [...new Set(esikler)];
  const n = esikler.length + 1;
  const renkler = Array.from({ length: n }, (_, i) => rampa(n === 1 ? 0.5 : 0.04 + (i / (n - 1)) * 0.96));
  const sinifi = (v) => { let i = 0; while (i < esikler.length && v >= esikler[i]) i++; return i; };
  const sinirlar = [min, ...esikler, max];
  const siniflar = renkler.map((r, i) => ({ renk: r, alt: sinirlar[i], ust: sinirlar[i + 1], adet: vals.filter((v) => sinifi(v) === i).length }));
  return { renk: (v) => renkler[sinifi(v)], lejant: { tur: 'sinif', siniflar } };
}

// ------------------------------------------------------------------ çizim
function durumYaz(m) { $('durum').textContent = m; }
function el(ad, attrs = {}, ebeveyn) {
  const e = document.createElementNS(NS, ad);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (ebeveyn) ebeveyn.appendChild(e);
  return e;
}

let cizimNo = 0;
async function ciz() {
  if (!veri && !durum.kendi) return;
  const benim = ++cizimNo;
  const duzey = durum.duzey;
  const [G, Gust] = await Promise.all([geo(duzey), UST[duzey] && $('ust-sinir').checked ? geo(UST[duzey]) : null]);
  if (benim !== cizimNo) return;
  adresiGuncelle();

  const g = durum.kendi ? { ad: durum.kendiBaslik || 'Yüklenen veri', ondalik: null, birim: '', kaynak: 'Kullanıcı verisi' } : M.gostergeById.get(durum.gosterge);
  const yil = durum.kendi ? null : durum.yil;
  const d = durum.kendi ?? new Map(Object.entries(veri?.[yil] ?? {}));
  const kapsamda = (kod) => altinda(B, kod, durum.kapsam);
  const feats = G.features.filter((f) => kapsamda(f.id));
  const vals = feats.map((f) => d.get(f.id)).filter((v) => Number.isFinite(v));
  const ondalik = g.ondalik ?? (vals.every(Number.isInteger) ? 0 : 2);
  const f = (v) => sayi(v, ondalik);
  const trDeger = durum.kendi ? null : trVeri[yil] ?? null;
  const O = vals.length ? olcek(vals, trDeger) : { renk: () => BOS, lejant: null };

  // Yerleşim
  const svg = $('harita');
  svg.innerHTML = '';
  const W = 1200;
  const PAD = 28;
  const ustBosluk = 96;
  const altBosluk = 56;
  const projeksiyon = geoMercator();
  const fc = { type: 'FeatureCollection', features: feats };
  projeksiyon.fitWidth(W - 2 * PAD, fc);
  const yol = geoPath(projeksiyon);
  const [[x0, y0], [, y1]] = yol.bounds(fc);
  let mapH = y1 - y0;
  const enFazla = 760;
  if (mapH > enFazla) { projeksiyon.fitSize([W - 2 * PAD, enFazla], fc); mapH = enFazla; }
  const b2 = yol.bounds(fc);
  const dx = (W - (b2[1][0] - b2[0][0])) / 2 - b2[0][0];
  const dy = ustBosluk - b2[0][1];
  const lej = $('lejant').value;
  const lejantAlti = lej === 'alt' && O.lejant; // lejant haritanın altında ayrı bir şeritte
  const H = Math.round(ustBosluk + (b2[1][1] - b2[0][1]) + (lejantAlti ? 64 : 0) + altBosluk);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);
  svg.setAttribute('font-family', "'Source Sans 3', 'Segoe UI', Arial, sans-serif");
  el('rect', { width: W, height: H, fill: '#ffffff' }, svg);

  // Başlık
  const { baslik: gAd, ek: gEk } = gorunenAd(g.ad);
  const baslik = $('baslik').value.trim() || (yil ? `${gAd}, ${yil}` : gAd);
  const altBaslik = `${gEk ? `${gEk} · ` : ''}${ARAC_DUZEYLERI[duzey].cogul}${durum.kapsam !== 'TR' ? ` · ${birimAdi(B, durum.kapsam)}` : ''}${g.birim ? ` · ${g.birim}` : ''}`;
  metinSar(el('text', { x: PAD, y: 40, 'font-size': 26, 'font-weight': 600, fill: '#1f1f1f' }, svg), baslik, W - 2 * PAD, 26);
  el('text', { x: PAD, y: 72, 'font-size': 15, fill: '#6b6b6b' }, svg).textContent = altBaslik;

  // Birimler
  const gHarita = el('g', { transform: `translate(${dx},${dy})` }, svg);
  const sinirRenk = $('sinir').value;
  const ince = feats.length > 300 ? 0.35 : feats.length > 90 ? 0.6 : 1;
  const ipucu = $('ipucu');
  for (const ft of feats) {
    const v = d.get(ft.id);
    const p = el('path', { d: yol(ft), fill: Number.isFinite(v) ? O.renk(v) : BOS, stroke: sinirRenk, 'stroke-width': ince, 'stroke-linejoin': 'round' }, gHarita);
    p.dataset.kod = ft.id;
  }
  gHarita.onmousemove = (e) => {
    const kod = e.target.dataset?.kod;
    if (!kod) { ipucu.hidden = true; return; }
    const v = d.get(kod);
    ipucu.innerHTML = `<strong>${esc(birimAdi(B, kod))}</strong><br>${Number.isFinite(v) ? f(v) : 'Veri yok'}${g.birim && Number.isFinite(v) ? ` <span>${esc(g.birim)}</span>` : ''}`;
    const r = svg.parentElement.getBoundingClientRect();
    ipucu.style.left = `${e.clientX - r.left + 14}px`;
    ipucu.style.top = `${e.clientY - r.top + 14}px`;
    ipucu.hidden = false;
  };
  gHarita.onmouseleave = () => (ipucu.hidden = true);

  // Üst birim sınırları (ilçede il, ilde Düzey 2, Düzey 2'de Düzey 1)
  if (Gust) {
    const gUst = el('g', { transform: `translate(${dx},${dy})`, fill: 'none', stroke: sinirRenk === '#2f2f2f' ? '#000' : '#4a4a4a', 'stroke-width': 1.1, 'pointer-events': 'none' }, svg);
    for (const ft of Gust.features) if (durum.kapsam === 'TR' || altinda(B, ft.id, durum.kapsam) || altinda(B, durum.kapsam, ft.id)) el('path', { d: yol(ft) }, gUst);
  }

  // Etiketler
  const adGoster = $('etiket-ad').checked;
  const degerGoster = $('etiket-deger').checked;
  if (adGoster || degerGoster) {
    const boyut = feats.length > 300 ? 7 : feats.length > 90 ? 9 : feats.length > 30 ? 11 : 13;
    const gE = el('g', { transform: `translate(${dx},${dy})`, 'font-size': boyut, 'text-anchor': 'middle', fill: '#1f1f1f', 'pointer-events': 'none', 'paint-order': 'stroke', stroke: 'rgba(255,255,255,0.85)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, svg);
    for (const ft of feats) {
      const [cx, cy] = yol.centroid(ft);
      if (!Number.isFinite(cx)) continue;
      const v = d.get(ft.id);
      const satirlar = [];
      if (adGoster) satirlar.push(birimAdi(B, ft.id, { kisa: true }));
      if (degerGoster && Number.isFinite(v)) satirlar.push(f(v));
      satirlar.forEach((s, i) => {
        const t = el('text', { x: cx.toFixed(1), y: (cy + (i - (satirlar.length - 1) / 2) * boyut * 1.1 + boyut * 0.35).toFixed(1), 'font-weight': i === 0 && adGoster ? 600 : 400 }, gE);
        t.textContent = s;
      });
    }
  }

  // Lejant
  if (lej !== 'yok' && O.lejant) {
    const lx = lejantAlti ? PAD : lej === 'sol-alt' ? PAD : W - PAD - 280;
    const ly = lejantAlti ? H - altBosluk - 56 : lej === 'sag-ust' ? ustBosluk + 4 : H - altBosluk - lejantYuksekligi(O.lejant, vals.length < feats.length);
    lejantCiz(svg, O.lejant, lx, ly, f, vals.length < feats.length, lejantAlti);
  }

  // Kaynak
  const kaynak = durum.kendi ? 'Kaynak: kullanıcı verisi' : `Kaynak: ${g.kaynak ?? 'TÜİK'}`;
  el('line', { x1: PAD, x2: W - PAD, y1: H - 38, y2: H - 38, stroke: '#e3e3e0' }, svg);
  el('text', { x: PAD, y: H - 16, 'font-size': 13, fill: '#6b6b6b' }, svg).textContent = kaynak;
  el('text', { x: W - PAD, y: H - 16, 'font-size': 13, fill: '#9a9a9a', 'text-anchor': 'end' }, svg).textContent = SITE.baslik;

  // Tablo
  const satirlar = feats
    .filter((ft) => Number.isFinite(d.get(ft.id)))
    .map((ft) => ({ kod: ft.id, ad: birimAdi(B, ft.id), deger: d.get(ft.id) }))
    .sort((a, b) => b.deger - a.deger);
  son = { satirlar, g, yil, baslik, trDeger, f };
  tabloYaz();
  durumYaz(vals.length ? `${vals.length} / ${feats.length} birimde veri var.` : 'Seçilen yıl ve alanda veri yok.');
}

function lejantYuksekligi(L, bosVar) {
  if (L.tur === 'surekli') return 70 + (bosVar ? 22 : 0);
  return 30 + L.siniflar.length * 24 + (bosVar ? 24 : 0);
}

function lejantCiz(svg, L, x, y, f, bosVar, yatay) {
  const g = el('g', { transform: `translate(${x},${y})`, 'font-size': 15, fill: '#3a3a3a' }, svg);
  if (L.tur === 'surekli') {
    const id = `rampa${Math.random().toString(36).slice(2, 7)}`;
    const defs = el('defs', {}, g);
    const lg = el('linearGradient', { id }, defs);
    for (let i = 0; i <= 10; i++) el('stop', { offset: `${i * 10}%`, 'stop-color': L.rampa(i / 10) }, lg);
    el('rect', { x: 0, y: 6, width: 260, height: 14, fill: `url(#${id})`, rx: 2 }, g);
    el('text', { x: 0, y: 38 }, g).textContent = f(L.min);
    el('text', { x: 260, y: 38, 'text-anchor': 'end' }, g).textContent = f(L.max);
    if (L.orta) {
      const t = Math.max(0, Math.min(1, L.t(L.orta.deger)));
      el('line', { x1: 260 * t, x2: 260 * t, y1: 2, y2: 24, stroke: '#3a3a3a' }, g);
      el('text', { x: 260 * t, y: 38, 'text-anchor': 'middle' }, g).textContent = `${L.orta.etiket} ${f(L.orta.deger)}`;
    }
    if (bosVar) { el('rect', { x: yatay ? 300 : 0, y: yatay ? 6 : 50, width: 20, height: 14, fill: BOS }, g); el('text', { x: yatay ? 328 : 28, y: yatay ? 19 : 62 }, g).textContent = 'Veri yok'; }
    return;
  }
  const kutular = [...L.siniflar.map((s) => [s.renk, `${f(s.alt)} – ${f(s.ust)}`, s.adet]), ...(bosVar ? [[BOS, 'Veri yok', null]] : [])];
  if (yatay) {
    let cx = 0;
    kutular.forEach(([r, t]) => {
      el('rect', { x: cx, y: 6, width: 22, height: 16, fill: r, rx: 2 }, g);
      const e = el('text', { x: cx + 30, y: 20 }, g);
      e.textContent = t;
      cx += 46 + t.length * 7.6;
    });
    return;
  }
  kutular.forEach(([r, t, n], i) => {
    el('rect', { x: 0, y: 6 + i * 24, width: 20, height: 16, fill: r, rx: 2 }, g);
    el('text', { x: 28, y: 20 + i * 24 }, g).textContent = t;
  });
}

/** Uzun başlığı iki satıra böler (SVG'de otomatik satır kaydırma yok) */
function metinSar(t, metin, genislik, boyut) {
  const enFazla = Math.floor(genislik / (boyut * 0.5));
  if (metin.length <= enFazla) { t.textContent = metin; return; }
  const kes = metin.lastIndexOf(' ', enFazla);
  t.setAttribute('font-size', boyut * 0.82);
  t.setAttribute('y', 32);
  const a = el('tspan', { x: t.getAttribute('x') }, t);
  a.textContent = metin.slice(0, kes);
  const b = el('tspan', { x: t.getAttribute('x'), dy: boyut * 0.95 }, t);
  b.textContent = metin.slice(kes + 1);
}

function tabloYaz() {
  const { satirlar, g, yil, trDeger, f } = son;
  const tr = trDeger != null && durum.kapsam === 'TR' ? `<tr class="tr-satir"><td></td><td>Türkiye</td><td>${f(trDeger)}</td></tr>` : '';
  $('tablo').innerHTML = `<caption>${esc(g.ad)}${yil ? `, ${yil}` : ''}</caption>
    <thead><tr><th>Sıra</th><th>Birim</th><th>Değer${g.birim ? ` (${esc(g.birim)})` : ''}</th></tr></thead>
    <tbody>${tr}${satirlar.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.ad)}</td><td>${f(s.deger)}</td></tr>`).join('')}</tbody>`;
}

// ------------------------------------------------------------------ indirme
function svgMetni() {
  const kopya = $('harita').cloneNode(true);
  kopya.setAttribute('xmlns', NS);
  return new XMLSerializer().serializeToString(kopya);
}
function dosyaKoku() {
  return dosyaAdi(`${son?.baslik ?? 'harita'}${durum.kapsam !== 'TR' ? `-${durum.kapsam}` : ''}`);
}
function svgIndir() { indirB(`${dosyaKoku()}.svg`, svgMetni(), 'image/svg+xml'); }
async function pngIndir() {
  const svg = $('harita');
  const W = Number(svg.getAttribute('width'));
  const H = Number(svg.getAttribute('height'));
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMetni())}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, W, H);
  c.toBlob((b) => indirB(`${dosyaKoku()}.png`, b), 'image/png');
}
function csvIndir() {
  if (!son) return;
  const { satirlar, g, yil } = son;
  indirB(`${dosyaKoku()}.csv`, csv([
    ['kod', 'birim', 'yıl', `${g.ad}`],
    ...satirlar.map((s) => [s.kod, s.ad, yil ?? '', s.deger]),
  ]), 'text/csv');
}

init().catch((e) => {
  console.error(e);
  durumYaz(`Veri yüklenemedi: ${e.message}`);
});
