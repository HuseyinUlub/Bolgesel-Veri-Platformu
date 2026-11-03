/**
 * Veri Kataloğu: manifestteki bütün göstergeler üst başlık → kategori → konu hiyerarşisinde.
 * Soldaki süzgeçler (arama, üst başlık, düzey, kaynak, güncellik) birlikte uygulanır; her gösterge
 * Veri Gezgini'nde açılabilir ya da CSV olarak indirilebilir. Süzgeçler adres çubuğunda tutulur
 * (katalog.html?ust=dis-ticaret&q=ihracat), böylece bir liste bağlantıyla paylaşılabilir.
 */
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '../styles/hikaye.css';
import '../styles/katalog.css';

import { araclarMenusu } from '../lib/menu.js';
import { indir } from '../lib/indir.js';
import { SITE } from '../site.config.js';
import { esc, sayi, slugify } from '../lib/format.js';
import { manifest, kategoriVerisi } from '../lib/data.js';
import { sadelestir } from '../lib/arama.js';
import { ustBasliklar, ESKI_UST, KATEGORI_IKON, konu, skaAmaci, kaynaksizAd, kisaKaynak } from '../lib/basliklar.js';

const $ = (s) => document.querySelector(s);
const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));
$('#site-baslik').textContent = SITE.baslik;
araclarMenusu($('#araclar'));

/** Bölge düzeyleri: manifest değeri → etiket ve Analiz Masası'ndaki düzey anahtarı */
const DUZEY = [
  { veri: 'province', etiket: 'İl', gezgin: 'il' },
  { veri: 'region26', etiket: 'Düzey 2', gezgin: 'duzey2' },
  { veri: 'region12', etiket: 'Düzey 1', gezgin: 'duzey1' },
  { veri: 'district', etiket: 'İlçe', gezgin: null },
  { veri: 'fua', etiket: 'Kent (OECD)', gezgin: 'fua' },
  { veri: 'country', etiket: 'Türkiye', gezgin: 'tr' },
];
const YIL_ESIK = [
  { deger: '', etiket: 'Bütün yıllar' },
  { deger: '2024', etiket: 'Son verisi 2024 ve sonrası' },
  { deger: '2020', etiket: 'Son verisi 2020 ve sonrası' },
];

const durum = { q: '', ust: '', duzey: new Set(), kaynak: new Set(), yil: '' };
let M;
let ustler = [];
let dizin = []; // { g, k, u, metin, kaynak, son }

async function init() {
  M = await manifest();
  ustler = ustBasliklar(M);
  for (const u of ustler) {
    for (const k of u.kats) {
      for (const g of k.gostergeler) {
        dizin.push({
          g, k, u,
          kaynak: kisaKaynak(g),
          son: g.yillar?.at(-1) ?? 0,
          metin: sadelestir(`${g.ad} ${k.ad} ${u.ad} ${g.not ?? ''} ${g.kaynak ?? ''}`),
        });
      }
    }
  }
  sayaclar();
  adrestenOku();
  // telefonda ikincil süzgeçler kapalı başlar (seçili süzgeç varsa açık)
  if (matchMedia('(max-width: 760px)').matches && !durum.duzey.size && !durum.kaynak.size && !durum.yil) $('#ek-suzgec').open = false;
  suzgecleriKur();
  olaylar();
  ciz();
}

function sayaclar() {
  const kaynaklar = new Set(dizin.map((d) => d.kaynak));
  const [ilk, son] = [Math.min(...dizin.map((d) => d.g.yillar?.[0] ?? 9999)), Math.max(...dizin.map((d) => d.son))];
  $('#sayaclar').innerHTML = [
    [sayi(dizin.length, 0), 'gösterge'],
    [M.kategoriler.length, 'kategori'],
    [ustler.length, 'tema'],
    [kaynaklar.size, 'kaynak kurum'],
    [`${ilk}–${son}`, 'yıl aralığı'],
  ].map(([v, e]) => `<div><dt>${e}</dt><dd>${v}</dd></div>`).join('');
}

// ------------------------------------------------------------------ süzgeçler
function suzgecleriKur() {
  const say = (f) => dizin.filter(f).length;
  $('#f-ust').innerHTML =
    secenek('radio', 'ust', '', 'Tümü', dizin.length, !durum.ust) +
    ustler.map((u) => secenek('radio', 'ust', u.id, u.ad, u.sayi, durum.ust === u.id, u.ikon)).join('');
  $('#f-duzey').innerHTML = DUZEY.map((d) =>
    secenek('checkbox', 'duzey', d.veri, d.etiket, say((x) => x.g.duzeyler.includes(d.veri)), durum.duzey.has(d.veri))).join('');
  const kaynaklar = [...new Set(dizin.map((d) => d.kaynak))]
    .map((k) => [k, say((x) => x.kaynak === k)])
    .sort((a, b) => b[1] - a[1]);
  $('#f-kaynak').innerHTML = kaynaklar.map(([k, n]) => secenek('checkbox', 'kaynak', k, k, n, durum.kaynak.has(k))).join('');
  $('#f-yil').innerHTML = YIL_ESIK.map((y) =>
    secenek('radio', 'yil', y.deger, y.etiket, y.deger ? say((x) => x.son >= +y.deger) : dizin.length, durum.yil === y.deger)).join('');
}

function secenek(tur, ad, deger, etiket, n, secili, ikon) {
  return `<label class="filtre-secenek">
    <input type="${tur}" name="${ad}" value="${esc(deger)}" ${secili ? 'checked' : ''}>
    ${ikon ? `<i class="fas ${ikon}" aria-hidden="true"></i>` : ''}<span class="fs-ad">${esc(etiket)}</span><span class="fs-n" data-n>${sayi(n, 0)}</span>
  </label>`;
}

function olaylar() {
  let t;
  const ara = $('#k-ara');
  ara.value = durum.q;
  ara.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { durum.q = ara.value; ciz(); }, 120);
  });
  document.querySelector('.filtreler').addEventListener('change', (e) => {
    const i = e.target;
    if (i.name === 'ust') durum.ust = i.value;
    else if (i.name === 'yil') durum.yil = i.value;
    else if (i.name === 'duzey' || i.name === 'kaynak') {
      const s = durum[i.name];
      i.checked ? s.add(i.value) : s.delete(i.value);
    } else return;
    ciz();
  });
  $('#f-temizle').addEventListener('click', () => {
    Object.assign(durum, { q: '', ust: '', yil: '' });
    durum.duzey.clear();
    durum.kaynak.clear();
    ara.value = '';
    suzgecleriKur();
    ciz();
  });
  $('#ust-kartlar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ust]');
    if (!b) return;
    durum.ust = b.dataset.ust;
    document.querySelector(`#f-ust input[value="${b.dataset.ust}"]`).checked = true;
    ciz();
    $('.sonuc').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#hepsini-ac').addEventListener('click', () => document.querySelectorAll('#liste details').forEach((d) => (d.open = true)));
  $('#hepsini-kapat').addEventListener('click', () => document.querySelectorAll('#liste details').forEach((d) => (d.open = false)));
  $('#liste').addEventListener('toggle', (e) => {
    const d = e.target;
    if (d.tagName === 'DETAILS' && d.open && !d.dataset.dolu) satirlariDoldur(d);
  }, true);
  $('#liste').addEventListener('click', (e) => {
    const b = e.target.closest('[data-csv]');
    if (b) csvIndir(b.dataset.csv, b);
  });
}

function suzulmus() {
  const parcalar = sadelestir(durum.q).split(' ').filter(Boolean);
  return dizin.filter((d) =>
    (!durum.ust || d.u.id === durum.ust) &&
    (!durum.duzey.size || d.g.duzeyler.some((v) => durum.duzey.has(v))) &&
    (!durum.kaynak.size || durum.kaynak.has(d.kaynak)) &&
    (!durum.yil || d.son >= +durum.yil) &&
    parcalar.every((q) => d.metin.includes(q)));
}

const suzgecVar = () => !!(durum.q.trim() || durum.ust || durum.duzey.size || durum.kaynak.size || durum.yil);

// ------------------------------------------------------------------ liste
let sonListe = new Map(); // kategori adı → [d]

function ciz() {
  adreseYaz();
  const liste = suzulmus();
  const aktif = suzgecVar();
  $('#f-temizle').hidden = !aktif;
  $('#sonuc-durum').innerHTML = aktif
    ? `<strong>${sayi(liste.length, 0)}</strong> gösterge bulundu <span>(toplam ${sayi(dizin.length, 0)})</span>`
    : `<strong>${sayi(dizin.length, 0)}</strong> gösterge, ${ustler.length} tema altında`;

  // Süzgeç yokken üst başlık kartları: genel bakış
  $('#ust-kartlar').hidden = aktif;
  if (!aktif) $('#ust-kartlar').innerHTML = ustler.map(ustKarti).join('');

  sonListe = new Map();
  for (const d of liste) {
    if (!sonListe.has(d.k.ad)) sonListe.set(d.k.ad, []);
    sonListe.get(d.k.ad).push(d);
  }
  // arama ya da az sonuç varsa kategoriler açık gelir
  const acik = aktif && (durum.q.trim() || liste.length <= 150);
  const html = ustler.map((u) => {
    const kats = u.kats.filter((k) => sonListe.has(k.ad));
    if (!kats.length) return '';
    const n = kats.reduce((t, k) => t + sonListe.get(k.ad).length, 0);
    return `<section class="ust-grup" id="u-${u.id}">
      <h2><i class="fas ${u.ikon}" aria-hidden="true"></i>${esc(u.ad)} <span class="ug-n">${sayi(n, 0)}</span></h2>
      ${kats.map((k) => `<details class="kat" data-kat="${esc(k.ad)}" ${acik ? 'open' : ''}>
        <summary><i class="fas ${KATEGORI_IKON[k.ad] ?? 'fa-table'}" aria-hidden="true"></i><span class="kat-ad">${esc(k.ad)}</span>
          <span class="kat-n">${sayi(sonListe.get(k.ad).length, 0)}${sonListe.get(k.ad).length !== k.gostergeler.length ? ` / ${sayi(k.gostergeler.length, 0)}` : ''}</span>
          <span class="kat-kaynak">${kaynakOzeti(sonListe.get(k.ad))}</span></summary>
        <div class="kat-icerik"></div>
      </details>`).join('')}
    </section>`;
  }).join('');
  $('#liste').innerHTML = html || '<p class="bos">Bu süzgeçlere uyan gösterge yok. Aramayı kısaltın ya da süzgeçleri temizleyin.</p>';
  if (acik) document.querySelectorAll('#liste details[open]').forEach(satirlariDoldur);
}

function ustKarti(u) {
  const ornek = u.kats.slice(0, 7).map((k) => `<li>${esc(k.ad)} <span>${sayi(k.gostergeler.length, 0)}</span></li>`).join('');
  return `<button type="button" class="ust-kart" data-ust="${u.id}">
    <span class="uk-ikon"><i class="fas ${u.ikon}" aria-hidden="true"></i></span>
    <span class="uk-ad">${esc(u.ad)}</span>
    <span class="uk-n">${sayi(u.sayi, 0)} gösterge</span>
    <span class="uk-aciklama">${esc(u.aciklama)}</span>
    <ul class="uk-kats">${ornek}</ul>
  </button>`;
}

function kaynakOzeti(ds) {
  const c = new Map();
  for (const d of ds) c.set(d.kaynak, (c.get(d.kaynak) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => esc(k)).join(' · ');
}

/** Kategori açılınca göstergeler konulara (SKA'da amaçlara) göre gruplanıp yazılır */
function satirlariDoldur(det) {
  const ds = sonListe.get(det.dataset.kat) ?? [];
  const parcalar = sadelestir(durum.q).split(' ').filter(Boolean);
  const grupAdi = (g) => {
    const a = skaAmaci(g.ad);
    if (a) return `Amaç ${+a.no}: ${a.ad}`;
    return konu(kaynaksizAd(g));
  };
  // tek göstergelik konular grupsuz kalır
  const sayac = new Map();
  for (const d of ds) { const k = grupAdi(d.g); if (k) sayac.set(k, (sayac.get(k) ?? 0) + 1); }
  const gruplar = new Map([['', []]]);
  for (const d of ds) {
    const k = grupAdi(d.g);
    const anahtar = k && sayac.get(k) > 1 ? k : '';
    if (!gruplar.has(anahtar)) gruplar.set(anahtar, []);
    gruplar.get(anahtar).push(d);
  }
  det.querySelector('.kat-icerik').innerHTML = [...gruplar]
    .filter(([, l]) => l.length)
    .map(([k, l]) => `${k ? `<h3 class="konu">${esc(k)} <span>${l.length}</span></h3>` : ''}
      <ul class="g-liste">${l.map((d) => satir(d, k, parcalar)).join('')}</ul>`)
    .join('');
  det.dataset.dolu = '1';
}

function satir(d, grup, parcalar) {
  const g = d.g;
  let ad = kaynaksizAd(g);
  const a = skaAmaci(ad);
  if (a) ad = ad.slice(ad.indexOf(':') + 2);
  else if (grup && ad.startsWith(`${grup}: `)) ad = ad.slice(grup.length + 2);
  const yil = g.yillar?.length ? (g.yillar.length > 1 ? `${g.yillar[0]}–${g.yillar.at(-1)}` : `${g.yillar[0]}`) : '';
  const duzeyler = DUZEY.filter((x) => g.duzeyler.includes(x.veri));
  const gez = duzeyler.find((x) => x.gezgin);
  const href = gez ? `analiz.html?${new URLSearchParams({ gosterge: g.id, duzey: gez.gezgin })}#gosterge` : null;
  const oecd = g.kaynakTuru?.startsWith('oecd');
  return `<li class="g-satir">
    <div class="g-ana">
      <span class="g-ad">${vurgula(ad, parcalar)}</span>
      ${g.birim && !ad.includes(`(${g.birim})`) ? `<span class="g-birim">${esc(g.birim)}</span>` : ''}
    </div>
    <div class="g-meta">
      <span class="g-kaynak${oecd ? ' g-kaynak--oecd' : ''}" title="${esc(g.kaynak ?? '')}">${esc(d.kaynak)}</span>
      <span class="g-duzeyler">${duzeyler.map((x) => `<span>${x.etiket}</span>`).join('')}</span>
      <span class="g-yil">${yil}</span>
      <span class="g-eylem">
        ${href ? (gez.gezgin === 'tr'
          ? `<a href="${href}" title="Veri Gezgini'nde Türkiye zaman serisi olarak aç"><i class="fas fa-chart-line" aria-hidden="true"></i> Grafikte aç</a>`
          : `<a href="${href}" title="Veri Gezgini'nde haritada aç"><i class="fas fa-map-location-dot" aria-hidden="true"></i> Haritada aç</a>`) : ''}
        <button type="button" data-csv="${esc(g.id)}" title="Bütün yıl ve bölgeleri CSV olarak indir"><i class="fas fa-download" aria-hidden="true"></i> CSV</button>
      </span>
    </div>
  </li>`;
}

function vurgula(ad, parcalar) {
  if (!parcalar.length) return esc(ad);
  const TR = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  const sade = ad.toLocaleLowerCase('tr').replace(/[çğıöşüâîû]/g, (c) => TR[c] ?? c);
  const isaret = new Array(ad.length).fill(false);
  for (const q of parcalar) {
    let i = sade.indexOf(q);
    while (i !== -1) { for (let j = i; j < i + q.length; j++) isaret[j] = true; i = sade.indexOf(q, i + q.length); }
  }
  let out = '';
  let acik = false;
  for (let i = 0; i < ad.length; i++) {
    if (isaret[i] !== acik) { out += isaret[i] ? '<mark>' : '</mark>'; acik = isaret[i]; }
    out += esc(ad[i]);
  }
  return out + (acik ? '</mark>' : '');
}

// ------------------------------------------------------------------ CSV
const DUZEY_ADI = Object.fromEntries(DUZEY.map((d) => [d.veri, d.etiket]));
async function csvIndir(id, dugme) {
  const g = M.gostergeById.get(id);
  if (!g) return;
  const eski = dugme.innerHTML;
  dugme.disabled = true;
  dugme.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Hazırlanıyor';
  try {
    const veri = (await kategoriVerisi(g.kategori))[id] ?? {};
    const sayiYaz = (v) => String(v).replace('.', ',');
    const hucre = (s) => (/[;"\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : s);
    const satirlar = [['Gösterge', 'Birim', 'Kaynak', 'Bölge kodu', 'Bölge adı', 'Düzey', 'Yıl', 'Değer']];
    const sira = Object.fromEntries(DUZEY.map((d, i) => [d.veri, i]));
    const kayit = [];
    for (const [yil, degerler] of Object.entries(veri)) {
      for (const [kod, deger] of Object.entries(degerler)) {
        if (deger == null) continue;
        const b = M.bolgeler[kod];
        kayit.push([b?.duzey, kod, b?.ad ?? kod, yil, deger]);
      }
    }
    kayit.sort((a, b) => (sira[a[0]] ?? 9) - (sira[b[0]] ?? 9) || a[1].localeCompare(b[1]) || a[3] - b[3]);
    for (const [dz, kod, ad, yil, deger] of kayit) {
      satirlar.push([kaynaksizAd(g), g.birim ?? '', g.kaynak ?? '', kod, ad, DUZEY_ADI[dz] ?? dz ?? '', yil, sayiYaz(deger)]);
    }
    const csv = '﻿' + satirlar.map((r) => r.map((c) => hucre(String(c))).join(';')).join('\r\n');
    await indir(`${slugify(kaynaksizAd(g)).slice(0, 80) || id}.csv`, csv, 'text/csv;charset=utf-8');
  } catch (err) {
    console.error(err);
    alert('Veri indirilemedi.');
  } finally {
    dugme.disabled = false;
    dugme.innerHTML = eski;
  }
}

// ------------------------------------------------------------------ adres
function adrestenOku() {
  const p = new URLSearchParams(location.search);
  durum.q = p.get('q') ?? '';
  const ust = ESKI_UST[p.get('ust')] ?? p.get('ust');
  durum.ust = ustler.some((u) => u.id === ust) ? ust : '';
  durum.yil = YIL_ESIK.some((y) => y.deger === p.get('yil')) ? p.get('yil') : '';
  for (const v of (p.get('duzey') ?? '').split(',').filter(Boolean)) durum.duzey.add(v);
  for (const v of (p.get('kaynak') ?? '').split(',').filter(Boolean)) durum.kaynak.add(v);
}

function adreseYaz() {
  const p = new URLSearchParams();
  if (durum.q.trim()) p.set('q', durum.q.trim());
  if (durum.ust) p.set('ust', durum.ust);
  if (durum.duzey.size) p.set('duzey', [...durum.duzey].join(','));
  if (durum.kaynak.size) p.set('kaynak', [...durum.kaynak].join(','));
  if (durum.yil) p.set('yil', durum.yil);
  const s = p.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname);
}

init().catch((err) => {
  console.error(err);
  $('#liste').innerHTML = `<p class="bos">Veri yüklenemedi: ${esc(err.message)}</p>`;
});
