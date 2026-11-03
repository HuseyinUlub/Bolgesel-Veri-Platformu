/**
 * Ana sayfa: kaydırmalı veri hikâyeleri.
 *
 * Her bölüm (src/hikayeler/*.js) adımlardan oluşur. Sağdaki metin kartları kaydırıldıkça,
 * soldaki yapışkan görsel alan o adımın grafiğini ya da haritasını çizer.
 *
 *   bölüm = { id, baslik, giris, yukle(): Promise<veri>, adimlar: [adım] }
 *   adım  = { baslik, metin(veri, adi) → html, gorsel, kesfet? }
 *   gorsel (çizgi)  = { tur:'cizgi', baslik, seriler:[{ad, kisaAd?, veri(v) → {yıl: değer}}], ondalik, birim?, yigilmis?, basvuru? }
 *   gorsel (harita) = { tur:'harita', baslik, duzey?, veri(v) → [yıl, {kod: değer}], ondalik, birim?, ikiYon?: {orta, altEtiket, ustEtiket} }
 */
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-ext-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import '../styles/hikaye.css';

import { araclarMenusu } from '../lib/menu.js';
import { SITE } from '../site.config.js';
import { manifest, geometri, kategoriVerisi } from '../lib/data.js';
import { kolaj } from '../lib/kolaj.js';
import { esitsizlikVerisi } from './esitsizlik.js';
import { koroplet, ikiYonluOlcek, renkOlcegi } from '../lib/map.js';
import { Chart } from 'chart.js';
import { cizgiGrafik } from '../lib/cizgi.js';
import { sayi, esc } from '../lib/format.js';
import { ESITSIZLIK } from '../hikayeler/esitsizlik.js';
import { NUFUS } from '../hikayeler/nufus.js';
import { gosterge as ortakGosterge } from '../hikayeler/ortak.js';
import { EGITIM } from '../hikayeler/egitim.js';
import { EKONOMI } from '../hikayeler/ekonomi.js';
import { SANAYI } from '../hikayeler/sanayi.js';
import { SAGLIK } from '../hikayeler/saglik.js';
import { TARIM } from '../hikayeler/tarim.js';
import { TURIZM } from '../hikayeler/turizm.js';
import { ENERJI } from '../hikayeler/enerji.js';
import { HABERLESME } from '../hikayeler/haberlesme.js';
import { REFAH } from '../hikayeler/refah.js';
import { KENTLER } from '../hikayeler/kentler.js';

Chart.defaults.font.family = "'Source Sans 3', 'Segoe UI', sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#5f5f5f';

/** Sayfadaki bölümler, sırasıyla. Yeni kategori hikâyesi buraya eklenir. */
const BOLUMLER = [ESITSIZLIK, NUFUS, EGITIM, EKONOMI, SANAYI, SAGLIK, TARIM, TURIZM, ENERJI, HABERLESME, REFAH, KENTLER];
/** Hikâyesi henüz yazılmamış ana kategoriler: içindekilerde Veri Gezgini'ne bağlanır */
const YAKINDA = SITE.anaSayfaKategorileri.filter((k) => !BOLUMLER.some((b) => b.baslik === k));

const $ = (s, el = document) => el.querySelector(s);
function gezginAdresi({ kategori, gosterge, ad, duzey = 'il' }) {
  if (!gosterge && ad) {
    try {
      gosterge = ortakGosterge(M, kategori, ad).id;
    } catch (e) {
      console.warn(e.message);
    }
  }
  return `analiz.html?${new URLSearchParams({ kategori, ...(gosterge && { gosterge }), duzey })}#gosterge`;
}

let M;
const veriler = new Map(); // bölüm id -> yüklenen veri

function adi(kod) {
  const b = M.bolgeler[kod];
  if (!b) return kod;
  if (b.duzey === 'province' || b.duzey === 'fua') return b.ad;
  return `${b.ad} (${kod})`;
}

// ------------------------------------------------------------------ yerleşim
function sayfayiKur() {
  const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
  document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));
  $('#site-baslik').textContent = SITE.baslik;
  araclarMenusu($('#araclar'));

  const icindekiler = $('#icindekiler');
  if (icindekiler) icindekiler.innerHTML =
    BOLUMLER.map(
      (b, i) =>
        `<li><a href="#bolum-${b.id}"><span class="no">${String(i + 1).padStart(2, '0')}</span>${esc(b.baslik)}</a></li>`,
    ).join('') +
    YAKINDA.map(
      (k) =>
        `<li class="yakinda"><a href="${gezginAdresi({ kategori: k })}"><span class="no">··</span>${esc(k)}<em>Veri Gezgini'nde</em></a></li>`,
    ).join('');

  const kap = $('#bolumler');
  BOLUMLER.forEach((b, i) => {
    const sec = document.createElement('section');
    sec.className = 'bolum';
    sec.id = `bolum-${b.id}`;
    sec.innerHTML = `
      <div class="scrolly">
        <figure class="gorsel" aria-live="polite">
          <figcaption>
            <h3 class="gorsel-baslik"></h3>
            <p class="gorsel-alt"></p>
          </figcaption>
          <div class="gorsel-alan">
            <svg class="harita" role="img"></svg>
            <div class="ipucu"></div>
            <div class="cizgi-kap"><canvas></canvas></div>
          </div>
          <div class="lejant"></div>
          <p class="kaynak"></p>
        </figure>
        <div class="adimlar">
          <header class="bolum-baslik">
            <p class="ust-etiket">${String(i + 1).padStart(2, '0')} · Bölüm</p>
            <h2>${esc(b.baslik)}</h2>
            <p class="giris">${esc(b.giris)}</p>
          </header>
          ${b.adimlar
            .map(
              (a, j) => `
            <article class="adim" data-bolum="${b.id}" data-adim="${j}">
              <p class="adim-no">${j + 1} / ${b.adimlar.length}</p>
              <h4>${esc(a.baslik)}</h4>
              <div class="adim-metin"><p class="yukleniyor">Yükleniyor…</p></div>
              ${a.kesfet ? `<a class="kesfet" href="${gezginAdresi(a.kesfet)}">Bu veriyi keşfet →</a>` : ''}
            </article>`,
            )
            .join('')}
        </div>
      </div>`;
    kap.appendChild(sec);
    b.el = sec;
    b.harita = koroplet($('.harita', sec), $('.ipucu', sec));
    b.cizgi = cizgiGrafik($('.cizgi-kap canvas', sec));
    b.aktif = -1;
  });

  const tum = document.createElement('section');
  tum.className = 'kapanis';
  tum.innerHTML = `
    <h2>Verinin tamamı</h2>
    <p>Hikâyelerdeki göstergeler ve daha fazlası; 24 kategoride ${sayi(M.kategoriler.reduce((a, k) => a + k.gostergeler.length, 0), 0)}
    gösterge il, Düzey 1 ve Düzey 2 bölgeleri için Veri Gezgini'nde.</p>
    <div class="kategori-listesi">${M.kategoriler
      .map((k) => `<a href="${gezginAdresi({ kategori: k.ad })}">${esc(k.ad)} <span>${k.gostergeler.length}</span></a>`)
      .join('')}</div>`;
  kap.appendChild(tum);
}

// ------------------------------------------------------------------ çizim
function lejant(el, olcek, g) {
  const birim = g.birim ? ` ${g.birim}` : '';
  if (g.ikiYon) {
    const [a, o, b] = olcek.domain();
    const renk = [0, 0.25, 0.5, 0.75, 1].map((t) => olcek(a + t * (b - a)));
    el.innerHTML = `
      <div class="lejant-cubuk" style="background:linear-gradient(90deg,${renk.join(',')})"></div>
      <div class="lejant-etiket"><span>≤ ${sayi(a, g.ondalik)}</span><span>${sayi(o, g.ondalik)}${birim}</span><span>≥ ${sayi(b, g.ondalik)}</span></div>
      <div class="lejant-etiket ikincil"><span>← ${esc(g.ikiYon.altEtiket ?? '')}</span><span>${esc(g.ikiYon.ustEtiket ?? '')} →</span></div>`;
    return;
  }
  const d = olcek.domain();
  const [min, max] = [d[0], d.at(-1)];
  const renk = [0, 0.25, 0.5, 0.75, 1].map((t) => (olcek.quantiles ? olcek(olcek.quantiles(4)[t * 4]) : olcek(min + t * (max - min))));
  const orta = olcek.quantiles ? olcek.quantiles(2)[1] : (min + max) / 2;
  el.innerHTML = `
    <div class="lejant-cubuk" style="background:linear-gradient(90deg,${renk.join(',')})"></div>
    <div class="lejant-etiket"><span>${sayi(min, g.ondalik)}</span><span>${olcek.quantiles ? 'medyan ' : ''}${sayi(orta, g.ondalik)}</span><span>${sayi(max, g.ondalik)}${birim}</span></div>`;
}

async function adimiCiz(b, j) {
  if (b.aktif === j) return;
  b.aktif = j;
  const a = b.adimlar[j];
  const g = a.gorsel;
  const v = veriler.get(b.id);
  const sec = b.el;
  sec.querySelectorAll('.adim').forEach((x) => x.classList.toggle('aktif', +x.dataset.adim === j));
  const fig = $('.gorsel', sec);
  fig.dataset.tur = g.tur;
  $('.gorsel-baslik', sec).textContent = g.baslik;
  $('.kaynak', sec).textContent = b.kaynak ? `Kaynak: ${b.kaynak}` : '';

  if (g.tur === 'cizgi') {
    const adlar = g.seriAdlari?.(v, adi);
    const seriler = g.seriler.map((s, i) => ({ ...s, ...(adlar && { ad: adlar[i], kisaAd: adlar[i] }), veri: s.veri(v) }));
    const yillar = [...new Set(seriler.flatMap((s) => Object.keys(s.veri)))].sort();
    $('.gorsel-alt', sec).textContent = `${g.altBaslik ?? 'Türkiye'}, ${yillar[0]}–${yillar.at(-1)}`;
    $('.lejant', sec).innerHTML = '';
    b.cizgi.ciz({ yillar, seriler, ondalik: g.ondalik, birim: g.birim, yigilmis: g.yigilmis, basvuru: g.basvuru });
    return;
  }
  const duzey = g.duzey ?? 'province';
  const [yil, deg] = g.veri(v);
  const [geo, zemin] = await Promise.all([geometri(duzey), duzey === 'fua' ? geometri('province') : null]);
  if (b.aktif !== j) return; // bu arada başka adıma geçildi
  const degerler = new Map(Object.entries(deg).map(([k, x]) => [k, +x]));
  const olcek = g.ikiYon ? ikiYonluOlcek([...degerler.values()], g.ikiYon.orta) : renkOlcegi([...degerler.values()]);
  $('.gorsel-alt', sec).textContent =
    `${{ province: '81 il', region26: '26 Düzey 2 bölgesi', region12: '12 Düzey 1 bölgesi', fua: 'OECD işlevsel kentsel alanları' }[duzey]}, ${yil}`;
  b.harita.ciz({
    geo,
    degerler,
    olcek,
    zemin,
    etiketsiz: true,
    etiket: (f) => f.id,
    ipucu: (f) =>
      `<strong>${esc(adi(f.id))}</strong><br>${degerler.has(f.id) ? sayi(degerler.get(f.id), g.ondalik) + (g.birim ? ` ${esc(g.birim)}` : '') : 'Veri yok'}`,
  });
  lejant($('.lejant', sec), olcek, g);
}

async function bolumuYukle(b) {
  if (veriler.has(b.id)) return;
  const v = await b.yukle();
  veriler.set(b.id, v);
  b.kaynak = v?.kaynak ?? b.kaynak ?? null;
  b.el.querySelectorAll('.adim').forEach((el) => {
    const a = b.adimlar[+el.dataset.adim];
    try {
      $('.adim-metin', el).innerHTML = a.metin(v, adi);
    } catch (e) {
      console.error(`${b.id}/${el.dataset.adim}:`, e);
      $('.adim-metin', el).innerHTML = '<p>Bu adımın verisi yüklenemedi.</p>';
    }
  });
}

// ------------------------------------------------------------------ kaydırma
function izle() {
  const gozlemci = new IntersectionObserver(
    (girdiler) => {
      for (const g of girdiler) {
        if (!g.isIntersecting) continue;
        const b = BOLUMLER.find((x) => x.id === g.target.dataset.bolum);
        bolumuYukle(b).then(() => adimiCiz(b, +g.target.dataset.adim));
      }
    },
    // Dar ekranda görsel üstte yapışık; kart ekranın alt yarısına geldiğinde adım değişir
    { rootMargin: matchMedia('(max-width: 900px)').matches ? '-70% 0px -25% 0px' : '-45% 0px -45% 0px' },
  );
  document.querySelectorAll('.adim').forEach((el) => gozlemci.observe(el));

  // Bölüme yaklaşırken verisini önceden yükle ve ilk adımı çiz (görsel alan boş görünmesin)
  const onYukle = new IntersectionObserver(
    (girdiler) => {
      for (const g of girdiler) {
        if (!g.isIntersecting) continue;
        const b = BOLUMLER.find((x) => x.el === g.target);
        bolumuYukle(b).then(() => b.aktif < 0 && adimiCiz(b, 0));
        onYukle.unobserve(g.target);
      }
    },
    { rootMargin: '0px 0px 100% 0px' },
  );
  BOLUMLER.forEach((b) => onYukle.observe(b.el));

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => BOLUMLER.forEach((b) => b.harita.yenidenCiz()), 200);
  });
}

/** Giriş şeridi: site.config.js'teki seçime göre resim ya da veri kolajı */
function girisSeridi() {
  const kap = $('#giris-gorsel');
  if (SITE.girisSeridi === 'kolaj') {
    kap.classList.add('kolaj-modu');
    document.body.classList.remove('ana-sayfa'); // kolajda üst çubuk normal (görselin üzerine binmez)
    kap.querySelector('.giris-resim')?.remove();
    $('#kolaj').hidden = false;
    kolajiCiz();
  } else {
    kap.querySelector('#kolaj')?.remove();
    const resim = SITE.girisResmi || 'img/giris-serit';
    kap.querySelector('source').srcset = `${resim}.webp`;
    kap.querySelector('img').src = `${resim}.jpg`;
  }
  // Üst çubuk görselin üzerindeyken yarı saydam, görsel geçilince dolu
  const cubuk = document.querySelector('.ust-cubuk');
  const guncelle = () => cubuk.classList.toggle('dolu', window.scrollY > kap.offsetHeight - cubuk.offsetHeight);
  guncelle();
  window.addEventListener('scroll', guncelle, { passive: true });
}

/** Açılış şeridi: hikâyelerde kullanılan verilerden küçük harita/grafik kolajı */
async function kolajiCiz() {
  const svg = $('#kolaj');
  try {
    const [esit, nufus, demografi, geoIl, geoD1, geoD2] = await Promise.all([
      esitsizlikVerisi(),
      kategoriVerisi('Nüfus'),
      kategoriVerisi('Demografi'),
      geometri('province'),
      geometri('region12'),
      geometri('region26'),
    ]);
    kolaj(svg, { esit, nufus, demografi, geoIl, geoD1, geoD2 });
    svg.classList.add('hazir');
  } catch (e) {
    console.warn('Kolaj çizilemedi:', e);
    svg.remove();
  }
}

async function init() {
  try {
    M = await manifest();
    sayfayiKur();
    izle();
    girisSeridi();
  } catch (e) {
    console.error(e);
    $('#bolumler').innerHTML = `<p class="hata">Veri yüklenemedi: ${esc(e.message)}</p>`;
  }
}
init();
