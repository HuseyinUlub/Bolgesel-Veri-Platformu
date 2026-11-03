/**
 * Ana sayfa: kaydırmalı bölgesel gösterge gezgini.
 * Orijinal index.html davranışının modüler karşılığı.
 */
// Yalnızca Türkçe için gereken alt kümeler (latin + latin-ext); Kiril/Yunan dosyaları derlemeye girmez
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/source-sans-3/latin-700.css';
import '@fontsource/source-sans-3/latin-ext-700.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
// Font Awesome: sadece 'solid' ikonlar kullanılıyor
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';
import '../styles/tokens.css';
import '../styles/explorer.css';
import '../styles/components.css';
import '../styles/gezgin.css';

import { araclarMenusu as menuyuKur } from '../lib/menu.js';
import { gorunenAd } from '../lib/arac.js';
import { SITE } from '../site.config.js';
import { manifest, geometri, seri, yillar, turkiyeDegeri, turkiyeSerisi, kategoriVerisi, ilTipolojisi, DUZEYLER } from '../lib/data.js';
import { bolgeRadari, komsular } from '../lib/radar.js';
import { aramaKur } from '../lib/arama.js';
import { ustBasliklar, ustBul, skaAmaclari, skaAmaci, KATEGORI_IKON } from '../lib/basliklar.js';
import '../styles/arama.css';
import '../styles/radar.css';
import { koroplet } from '../lib/map.js';
import { siraliCubuk } from '../lib/chart.js';
import { sayi, slugify, esc } from '../lib/format.js';
import { cizgiGrafik } from '../lib/cizgi.js';
import { TOPRAK } from '../lib/motifler.js';
import { ESITSIZLIK, ADIMLAR, esitsizlikVerisi } from './esitsizlik.js';

// Mutlak adres: CSS değişkeni (--card-bg-img) içindeki göreli url(), Chrome'da değişkeni KULLANAN
// stil dosyasına (assets/) göre çözülüyor ve assets/img/... 404 veriyordu.
const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
const HAKKINDA = 'Hakkında';
const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------------ durum
const durum = {
  kategori: null,
  gosterge: null, // id
  yil: null,
  duzey: 'il',
  tercihDuzey: 'il', // kullanıcının seçtiği düzey; veri olmayan kategoriden çıkınca buna dönülür
  satirlar: [],
  secim: {}, // üst başlık id → { kategori, amac } (amac: SKA amaç no'su ya da null)
};
let M; // manifest
let ustler = []; // üst başlıklar (src/lib/basliklar.js)

/** Bölümler üst başlıklardır; veri, bölümde seçili kategoriden okunur */
const veriKategorisi = () => durum.secim[durum.kategori]?.kategori ?? null;
const ustById = (id) => ustler.find((u) => u.id === id);
let istekNo = 0; // yarış durumlarını önlemek için (hızlı kaydırmada eski istek sonucu yazmasın)

const harita = koroplet($('turkey-map'), $('map-tooltip'), {
  onHover: (kod) => grafik.vurgula(kod),
  onClick: (kod) => radarAc(kod),
  tema: 'toprak',
});
const grafik = siraliCubuk($('data-chart'));
const trend = cizgiGrafik($('trend-chart'));
/** Bölge radarı: haritada bir birime tıklayınca açılan karşılaştırma paneli */
const radar = bolgeRadari({
  ad: (kod) => adi(kod),
  onKapat: () => harita.isaretle(null),
  onSec: (kod) => radarAc(kod),
});
let sonCizim = null; // son gösterge haritasının bağlamı (radar için)
let E = null; // esitsizlik.json (yüklenemezse bölüm atlanır)
/** "Bölgesel Eşitsizlik:3" → adım 3 */
const esitsizlikAdimi = (kat) => (kat?.startsWith(`${ESITSIZLIK}:`) ? ADIMLAR[+kat.split(':')[1]] : null);

// ------------------------------------------------------------------ başlangıç
let ayriliyor = false;
window.addEventListener('beforeunload', () => (ayriliyor = true));
window.addEventListener('pagehide', () => (ayriliyor = true));
async function init() {
  $('site-baslik').textContent = SITE.baslik;
  $('site-altbaslik').textContent = SITE.altBaslik;
  document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));

  try {
    [M, E] = await Promise.all([
      manifest(),
      // Bölgesel Eşitsizlik artık ana sayfadaki hikâyede; gezginde yalnızca göstergeler
      Promise.resolve(null),
    ]);
    ustler = ustBasliklar(M);
    for (const u of ustler) {
      const kategori = u.kats[0].ad;
      // SKA: ilk açılışta varsayılan göstergenin amacı (yoksa bütün amaçlar)
      const amac = u.amaclar ? skaAmaci(u.kats[0].gostergeler.find((g) => g.id === SITE.varsayilanGosterge[kategori])?.ad)?.no ?? null : null;
      durum.secim[u.id] = { kategori, amac };
    }
    araclarMenusu();
    bolumleriKur();
    kimlikOgeleri();
    hakkindaGorseli();
    kontrolleriKur();
    gezinmeyiKur();
    aramaKur({ manifest: M, duzeyler: DUZEYLER, git: gostergeyeGit, dugmeYeri: document.querySelector('.header-titles .hikaye-donus') });
    kaydirmaIzleyici();
    await kategoriSec(HAKKINDA);
    adrestenAc();
    $('loading').style.opacity = 0;
    setTimeout(() => ($('loading').style.display = 'none'), 500);
  } catch (err) {
    if (ayriliyor) return; // sayfadan çıkılırken yarıda kesilen istekler hata değildir
    console.error('Veri yüklenemedi:', err);
    $('loading').innerHTML = `
      <h2 style="color:var(--danger)"><i class="fa fa-exclamation-triangle"></i> Veri yüklenirken hata oluştu!</h2>
      <p style="margin-top:10px">${esc(err.message)}</p>`;
  }
}

/**
 * Bir kategoriye (ve isteğe bağlı göstergeye) git: bağlı olduğu üst başlığın bölümünde kategoriyi seçer,
 * bölüme kaydırır. Zaten o bölümdeysek göstergeyi doğrudan çizer.
 */
async function kategoriyeGit(kategori, gosterge = null, { anlik = false } = {}) {
  const u = ustBul(ustler, kategori);
  if (!u) return;
  if (gosterge) SITE.varsayilanGosterge[kategori] = gosterge;
  const kat = M.kategoriByAd.get(kategori);
  const amac = u.amaclar ? skaAmaci(kat.gostergeler.find((g) => g.id === gosterge)?.ad)?.no ?? durum.secim[u.id]?.amac ?? null : null;
  durum.secim[u.id] = { kategori, amac };
  altSecimiGoster(u);
  const hedef = $(`section-${u.id}`);
  if (anlik) requestAnimationFrame(() => hedef?.scrollIntoView({ block: 'center' }));
  else hedef?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (durum.kategori === u.id) {
    // zaten bu bölümdeyiz: kaydırma bölüm değişikliği tetiklemez, göstergeyi doğrudan seç
    durum.gosterge = gosterge;
    gostergeListesi();
    await yillariGuncelle();
  }
}

/** Aramadan seçilen göstergeye git: uygun düzeyi seç, adresi güncelle */
async function gostergeyeGit({ kategori, gosterge, duzeyler }) {
  const uygun = Object.keys(DUZEYLER).filter((d) => duzeyler.includes(DUZEYLER[d].veri));
  if (uygun.length && !uygun.includes(durum.tercihDuzey)) durum.tercihDuzey = uygun[0];
  history.replaceState(null, '', `?${new URLSearchParams({ kategori, gosterge, duzey: durum.tercihDuzey })}`);
  await kategoriyeGit(kategori, gosterge);
}

/** gezgin.html?kategori=Nüfus&gosterge=toplam-nufus&duzey=il → o bölüme git, göstergeyi seç */
function adrestenAc() {
  const p = new URLSearchParams(location.search);
  const kat = p.get('kategori');
  if (!kat || !M.kategoriByAd.has(kat)) return;
  const duzey = p.get('duzey');
  if (duzey && DUZEYLER[duzey]) durum.tercihDuzey = duzey;
  kategoriyeGit(kat, p.get('gosterge'), { anlik: true });
}

// ------------------------------------------------------------------ yerleşim
function araclarMenusu() {
  menuyuKur($('tools-nav'));
}

function pill(ad, id, gri = false, etiket = null) {
  const a = document.createElement('a');
  a.href = `#${id}`;
  a.className = `nav-pill${gri ? ' nav-pill-gray' : ''}`;
  a.textContent = etiket ?? SITE.kisaAdlar?.[ad] ?? ad;
  if (a.textContent !== ad) a.title = ad;
  a.dataset.category = ad;
  a.onclick = (e) => {
    e.preventDefault();
    $(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('header-nav').classList.remove('active');
  };
  return a;
}

/** Bölüm kartlarının üst şeridi: kategoriden kategoriye dönen toprak renkleri */
const BOLUM_RENKLERI = [TOPRAK.kiremit, TOPRAK.hardal, TOPRAK.adacayi, TOPRAK.ismavi];
function kimlikOgeleri() {
  document.querySelectorAll('.topic-section').forEach((s, i) => {
    s.style.setProperty('--bolum-renk', BOLUM_RENKLERI[i % BOLUM_RENKLERI.length]);
  });
}

function bolumleriKur() {
  const kap = $('sections-container');
  const nav = $('header-nav');

  nav.appendChild(pill(HAKKINDA, 'section-hakkinda', true));
  const h = document.createElement('div');
  h.className = 'topic-section glass-card';
  h.id = 'section-hakkinda';
  h.dataset.category = HAKKINDA;
  h.style.setProperty('--card-bg-img', `url('${IMG}hakkinda.png')`);
  h.innerHTML = `
    <div class="topic-header"><h2>Veri Gezgini</h2></div>
    <p>Bu sayfada ${ustler.length} üst başlık altında toplanan ${M.kategoriler.length} kategorideki tüm göstergeler il, Düzey 1 ve Düzey 2 bölgeleri için harita ve grafikler üzerinde incelenebilir. Verilere ilişkin değerlendirmelere <a href="./">ana sayfadan</a> ulaşılabilir.</p>
    <p>Bu platform; ülkemizin sosyo-ekonomik gelişimini bölgesel bazda takip etmek ve veri odaklı politika geliştirme süreçlerine katkı sağlamak amacıyla <strong>Kalkınma Ajansları Genel Müdürlüğü</strong>'nün bir ürünü olarak hazırlanmıştır.</p>
    <p><strong>Kalkınma Ajansları</strong>; bölgeler arası gelişmişlik farklarını azaltmak, yerel potansiyeli harekete geçirmek ve sürdürülebilir kalkınmayı sağlamak vizyonuyla faaliyet gösteren kurumlardır.</p>
    <p>Sitede yer alan veriler; <strong>TÜİK (Türkiye İstatistik Kurumu)</strong>, <strong>Sanayi ve Teknoloji Bakanlığı</strong>, <strong>Sosyal Güvenlik Kurumu (SGK)</strong> ve diğer resmi kurumların güncel istatistiklerinden derlenerek elde edilmiştir.</p>
    <hr class="soft-rule">
    <h3 class="sub-heading">Platformun Kullanımı</h3>
    <p>• Sayfa <strong>aşağı kaydırılarak</strong> yedi üst başlık (Nüfus ve Toplum, Ekonomi ve Üretim, Emek ve Eğitim vb.) arasında geçiş yapılabilir. Her başlığın altındaki düğmelerle <strong>kategori</strong> seçilebilir (Sürdürülebilir Kalkınma başlığında 17 amaç yer almaktadır).</p>
    <p>• Tüm göstergeler <a href="katalog.html">Veri Kataloğu</a> sayfasında tek liste hâlinde görüntülenebilir, kaynağa ve bölge düzeyine göre süzülebilir ve CSV biçiminde indirilebilir. Belirli bir göstergeye ulaşmak için üst bölümdeki <strong>Gösterge ara</strong> düğmesi kullanılabilir.</p>
    <p>• Harita ve grafik bölümündeki menüler aracılığıyla veriler <strong>il, Düzey 1 veya Düzey 2</strong> bazında görüntülenebilir; <strong>Alt Başlık</strong> ve <strong>Yıl</strong> seçenekleri değiştirilebilir.</p>
    <p>• Türkiye haritasında <strong>ilgili il veya bölgenin üzerine gelindiğinde</strong> o birime ait değer görüntülenir.</p>
    <p>• Haritada bir <strong>il veya bölge seçildiğinde</strong> karşılaştırma paneli açılır. Panelde seçilen birimin komşularıyla karşılaştırması, Türkiye içindeki yeri, sıralaması ve zaman içindeki seyri yer almaktadır.</p>
    <div class="infographic-promo">
      <p>Ayrıntılı görseller hazırlamak için aşağıdaki uygulama kullanılabilir:</p>
      <a class="btn-green" href="infografik.html" target="_blank"><i class="fas fa-chart-pie"></i> İnfografik Uygulaması</a>
    </div>`;
  kap.appendChild(h);

  // Bölgesel Eşitsizlik: her adım ayrı kart; sağ panel adıma göre çizgi grafik ya da harita gösterir
  if (E) {
    nav.appendChild(pill(ESITSIZLIK, 'section-esitsizlik-0'));
    ADIMLAR.forEach((a, i) => {
      const sec = document.createElement('div');
      sec.className = 'topic-section glass-card esitsizlik-adim';
      sec.id = `section-esitsizlik-${i}`;
      sec.dataset.category = `${ESITSIZLIK}:${i}`;
      if (i === 0) sec.style.setProperty('--card-bg-img', `url('${IMG}bolgesel-esitsizlik.png')`);
      sec.innerHTML = `
        ${i === 0 ? `<p class="adim-ust">${esc(ESITSIZLIK)}</p>` : ''}
        <div class="topic-header"><h2>${esc(a.baslik)}</h2></div>
        <p class="adim-no">${i + 1} / ${ADIMLAR.length}</p>
        ${a.metin(E, adi)}`;
      kap.appendChild(sec);
    });
  }

  // Üst başlık bölümleri: her bölümde kategori (SKA'da amaç) seçici, özet, istatistikler ve ilk 5 tablosu
  for (const u of ustler) {
    const p = pill(u.id, `section-${u.id}`, false, u.kisa);
    p.title = u.ad;
    p.insertAdjacentHTML('afterbegin', `<i class="fas ${u.ikon}" aria-hidden="true"></i>`);
    nav.appendChild(p);
    const sec = document.createElement('div');
    sec.className = 'topic-section glass-card ust-bolum';
    sec.id = `section-${u.id}`;
    sec.dataset.category = u.id;
    sec.style.setProperty('--card-bg-img', `url('${IMG}${u.resim}.png')`);
    sec.innerHTML = `
      <div class="topic-header"><h2><i class="fas ${u.ikon}" aria-hidden="true"></i> ${esc(u.ad)}</h2></div>
      <p class="ust-aciklama">${esc(u.aciklama)} <span class="ust-sayi">${sayi(u.sayi, 0)} gösterge</span></p>
      <div class="alt-secici" id="alt-${u.id}" role="group" aria-label="${esc(u.amaclar ? 'Amaçlar' : 'Kategoriler')}"></div>
      <p id="summary-${u.id}" class="dynamic-summary">Bu bölüme geldiğinizde veriler yüklenecek.</p>
      <p class="category-note" id="not-${u.id}" hidden></p>
      <div class="stats-grid" id="stats-${u.id}"></div>
      <h3 class="sub-heading">En Yüksek 5 <span data-bolge-tipi>İl</span></h3>
      <table class="top-table"><tbody id="table-${u.id}"></tbody></table>`;
    kap.appendChild(sec);
    altSeciciKur(u);
  }
}

/** Bölümdeki kategori (SKA'da amaç) düğmeleri */
function altSeciciKur(u) {
  const kap = $(`alt-${u.id}`);
  const dugme = (veri, ikon, metin, n, baslik = metin) =>
    `<button type="button" class="alt-dugme" ${veri} title="${esc(baslik)}">` +
    `${ikon ? `<i class="fas ${ikon}" aria-hidden="true"></i>` : ''}<span class="alt-ad">${esc(metin)}</span><span class="alt-n">${sayi(n, 0)}</span></button>`;
  if (u.amaclar) {
    const k = u.kats[0];
    kap.classList.add('alt-secici--amac');
    kap.innerHTML =
      dugme('data-amac=""', null, 'Tüm amaçlar', k.gostergeler.length) +
      skaAmaclari(k).map((a) => dugme(`data-amac="${a.no}"`, null, `${+a.no}. ${a.ad}`, a.sayi, `Amaç ${+a.no}: ${a.ad}`)).join('');
  } else {
    kap.innerHTML = u.kats.map((k) => dugme(`data-kat="${esc(k.ad)}"`, KATEGORI_IKON[k.ad], k.ad, k.gostergeler.length)).join('');
  }
  kap.addEventListener('click', async (e) => {
    const b = e.target.closest('.alt-dugme');
    if (!b) return;
    const onceki = durum.secim[u.id];
    durum.secim[u.id] = u.amaclar
      ? { kategori: onceki.kategori, amac: b.dataset.amac || null }
      : { kategori: b.dataset.kat, amac: null };
    altSecimiGoster(u);
    if (durum.kategori !== u.id) {
      $(`section-${u.id}`).scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    durum.gosterge = null;
    gostergeListesi();
    await yillariGuncelle();
  });
  altSecimiGoster(u);
}

/** Seçili kategori düğmesini ve kategori notunu günceller */
function altSecimiGoster(u) {
  const { kategori, amac } = durum.secim[u.id];
  $(`alt-${u.id}`).querySelectorAll('.alt-dugme').forEach((b) => {
    const secili = u.amaclar ? (b.dataset.amac || null) === amac : b.dataset.kat === kategori;
    b.setAttribute('aria-pressed', secili);
  });
  const not = SITE.kategoriNotlari?.[kategori];
  const el = $(`not-${u.id}`);
  el.hidden = !not;
  el.innerHTML = not ? `<i class="fas fa-circle-info"></i> ${esc(not)}` : '';
}

/** Hakkında görseli üzerindeki tıklanabilir alanlar (konum: %) */
const GORSEL_ALANLARI = [
  ['Nüfus', 0, 0, 33, 45], ['Eğitim', 33, 0, 34, 40], ['Sağlık', 67, 0, 33, 45],
  ['Enerji', 0, 45, 30, 27.5], ['Sanayi', 0, 72.5, 30, 27.5], ['Ekonomi', 30, 40, 40, 35],
  ['Turizm', 30, 75, 40, 25], ['Tarım', 70, 45, 30, 55],
];
function hakkindaGorseli() {
  const kap = $('hakkinda-visual');
  for (const [ad, l, t, w, h] of GORSEL_ALANLARI) {
    const a = document.createElement('a');
    a.href = `#section-${ustBul(ustler, ad)?.id ?? ''}`;
    a.className = 'visual-link';
    Object.assign(a.style, { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%` });
    a.innerHTML = `<span class="watermark-text">${esc(ad)}</span>`;
    a.onclick = (e) => {
      e.preventDefault();
      kategoriyeGit(ad);
    };
    kap.appendChild(a);
  }
}

// ------------------------------------------------------------------ kontroller
function kontrolleriKur() {
  $('level-select').addEventListener('change', async (e) => {
    durum.duzey = durum.tercihDuzey = e.target.value;
    gostergeListesi(); // bu düzeyde verisi olmayan göstergeler listeden çıkar
    await yillariGuncelle();
  });
  $('subtopic-select').addEventListener('change', async (e) => {
    durum.gosterge = e.target.value;
    await yillariGuncelle();
  });
  $('year-select').addEventListener('change', (e) => {
    durum.yil = Number(e.target.value);
    gorunumuGuncelle();
  });
}

function secenekler(select, liste, secili) {
  select.innerHTML = liste.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (secili != null) select.value = String(secili);
}

/**
 * Gösterge listesi: "Konu: kırılım" biçimindeki adlar (TÜİK tematik tabloları) konu başlığı altında
 * <optgroup> ile toplanır; tek başına kalan adlar üstte düz seçenek olarak durur. Uzun listelerde
 * (İşgücü, Tarım, Eğitim) aranan göstergeyi bulmayı kolaylaştırır.
 */
function gostergeSecenekleri(select, liste, secili) {
  const konu = (ad) => (ad.includes(': ') ? ad.slice(0, ad.indexOf(': ')) : null);
  const sayac = new Map();
  for (const g of liste) {
    const k = konu(g.ad);
    if (k) sayac.set(k, (sayac.get(k) ?? 0) + 1);
  }
  const duz = [];
  const gruplar = new Map();
  for (const g of liste) {
    const k = konu(g.ad);
    if (k && sayac.get(k) > 1) {
      if (!gruplar.has(k)) gruplar.set(k, []);
      gruplar.get(k).push(g);
    } else duz.push(g);
  }
  const opt = (g, t) => `<option value="${esc(g.id)}" title="${esc(g.ad)}">${esc(t)}</option>`;
  select.innerHTML =
    duz.map((g) => opt(g, g.ad)).join('') +
    [...gruplar]
      .map(([k, gs]) => `<optgroup label="${esc(k)}">${gs.map((g) => opt(g, g.ad.slice(k.length + 2))).join('')}</optgroup>`)
      .join('');
  if (secili != null) select.value = String(secili);
}

async function kategoriSec(kat) {
  durum.kategori = kat;
  sonCizim = null;
  const hakkinda = kat === HAKKINDA;
  const adim = esitsizlikAdimi(kat);
  const cizgi = adim?.gorsel === 'cizgi';
  document.querySelector('.sticky-panel').dataset.mod = adim ? `esitsizlik-${adim.gorsel}` : '';
  document.querySelector('.controls-container').style.display = hakkinda || adim ? 'none' : 'flex';
  document.querySelector('.map-container').classList.toggle('hakkinda-map', hakkinda);
  document.querySelector('.map-container').hidden = cizgi;
  $('trend-panel').hidden = !cizgi;
  $('hakkinda-visual').hidden = !hakkinda;
  $('source-note').hidden = hakkinda;
  grafik.gizle(hakkinda || cizgi);

  if ((adim || hakkinda) && radar.acikMi) radar.kapat();
  if (adim) {
    ++istekNo; // bekleyen gösterge çizimleri bu görünümün üstüne yazmasın
    await esitsizlikCiz(adim);
    return;
  }

  if (hakkinda) {
    const geo = await geometri('region26');
    // Giriş haritası: Düzey 2 bölgeleri toprak tonlarının açık hâlleriyle
    const renkler = ['#f0d2c4', '#f3dcb4', '#d5ddd0', '#cfdbe3', '#e8bfae', '#ead0a3', '#c4cfbf'];
    harita.duz({
      geo,
      renkler,
      ipucu: (f) => `<div class="tooltip-soft">${esc(M.bolgeler[f.id]?.ad ?? f.id).replace(/, /g, '<br>')}</div>`,
      ipucuKonumu: egikHaritaKonumu,
    });
    return;
  }

  durum.gosterge = null;
  gostergeListesi();
  await yillariGuncelle();
}

/** Eşitsizlik adımının görselini sağ panelde çizer */
async function esitsizlikCiz(a) {
  $('source-note').textContent = `Kaynak: ${E.kaynak}`;
  if ($('gosterge-not')) $('gosterge-not').hidden = true;
  if (a.gorsel === 'cizgi') {
    const seriler = a.seriler.map((s) => ({ ...s, veri: E.seriler[s.anahtar] ?? {} }));
    const yillar = [...new Set(seriler.flatMap((s) => Object.keys(s.veri)))].sort();
    $('trend-baslik').textContent = a.grafikBaslik;
    $('trend-chart').setAttribute('aria-label', a.grafikBaslik);
    trend.ciz({ yillar, seriler, ondalik: a.ondalik, birim: a.birim, yigilmis: a.yigilmis, basvuru: a.basvuru });
    return;
  }
  const h = E.haritalar[a.harita];
  const yil = Object.keys(h).sort().at(-1);
  const benim = ++istekNo;
  const geo = await geometri(a.duzey);
  if (benim !== istekNo) return;
  const il = a.duzey === 'province';
  const degerler = new Map(Object.entries(h[yil]));
  const satirlar = [...degerler]
    .map(([kod, deger]) => ({ kod, ad: M.bolgeler[kod]?.ad ?? kod, deger }))
    .sort((x, y) => y.deger - x.deger);
  const olcek = harita.ciz({
    geo,
    degerler,
    kucukEtiket: il,
    etiket: (f) => (il ? M.bolgeler[f.id]?.ad : f.id),
    ipucu: (f) => `<div class="tooltip-body"><strong>${esc(adi(f.id))}</strong><br>${sayi(degerler.get(f.id), a.ondalik)}</div>`,
  });
  grafik.guncelle(satirlar, {
    baslik: `${a.gostergeAd}, ${yil}`,
    ondalik: a.ondalik,
    renk: olcek,
    etiket: (d) => (il ? d.ad : d.kod),
    tamAd: (d) => adi(d.kod),
  });
}

/** Seçili kategori + düzeyde verisi olan göstergeleri listeler; mevcut seçim uygunsa korunur. */
function gostergeListesi() {
  const kat0 = M.kategoriByAd.get(veriKategorisi());
  if (!kat0) return;

  // Kategoride verisi olmayan düzeyler seçilemez; tercih edilen düzey yoksa ilk uygun düzeye geçilir
  const amac0 = durum.secim[durum.kategori]?.amac;
  const havuz = amac0 ? kat0.gostergeler.filter((g) => skaAmaci(g.ad)?.no === amac0) : kat0.gostergeler;
  const varOlan = Object.keys(DUZEYLER).filter((d) => havuz.some((g) => g.duzeyler.includes(DUZEYLER[d].veri)));
  for (const opt of $('level-select').options) {
    opt.disabled = !varOlan.includes(opt.value);
    opt.title = opt.disabled ? 'Bu kategoride bu düzeyde veri yok' : '';
  }
  durum.duzey = varOlan.includes(durum.tercihDuzey) ? durum.tercihDuzey : varOlan[0] ?? durum.tercihDuzey;
  $('level-select').value = durum.duzey;

  const hedef = DUZEYLER[durum.duzey].veri;
  const amac = durum.secim[durum.kategori]?.amac;
  const liste = kat0.gostergeler.filter((g) => g.duzeyler.includes(hedef) && (!amac || skaAmaci(g.ad)?.no === amac));
  const tercih = SITE.varsayilanGosterge[veriKategorisi()];
  durum.gosterge =
    liste.find((g) => g.id === durum.gosterge)?.id ?? liste.find((g) => g.id === tercih)?.id ?? liste[0]?.id ?? null;
  gostergeSecenekleri($('subtopic-select'), liste, durum.gosterge);
  if (!liste.length) {
    const s = slugify(durum.kategori);
    $(`summary-${s}`).textContent = `Bu kategoride ${DUZEYLER[durum.duzey].etiket} düzeyinde veri bulunmuyor.`;
  }
}

async function yillariGuncelle() {
  if (!durum.gosterge || durum.kategori === HAKKINDA) return;
  const ys = await yillar(veriKategorisi(), durum.gosterge, durum.duzey);
  if (!ys.includes(durum.yil)) durum.yil = ys[0] ?? null;
  secenekler($('year-select'), ys.map((y) => [y, y]), durum.yil);
  await gorunumuGuncelle();
}

// ------------------------------------------------------------------ çizim
async function gorunumuGuncelle() {
  const { gosterge, yil, duzey } = durum;
  const kategori = veriKategorisi();
  if (!gosterge || !yil) return;
  const zaman = !!DUZEYLER[duzey].zaman;
  document.querySelector('.map-container').hidden = zaman;
  $('trend-panel').hidden = !zaman;
  grafik.gizle(zaman);
  $('year-select').disabled = zaman;
  if (zaman) {
    sonCizim = null;
    if (radar.acikMi) radar.kapat();
    return turkiyeCiz(kategori, gosterge);
  }
  const benim = ++istekNo;
  const zeminDuzeyi = DUZEYLER[duzey].zemin;
  const [satirlar, geo, tr, zemin] = await Promise.all([
    seri(kategori, gosterge, yil, duzey),
    geometri(DUZEYLER[duzey].veri),
    turkiyeDegeri(kategori, gosterge, yil),
    zeminDuzeyi ? geometri(zeminDuzeyi) : null,
  ]);
  if (benim !== istekNo) return; // bu arada başka bir seçim yapıldı
  durum.satirlar = satirlar;
  const g = M.gostergeById.get(gosterge);
  const degerler = new Map(satirlar.map((d) => [d.kod, d.deger]));

  const olcek = harita.ciz({
    geo,
    degerler,
    zemin,
    kucukEtiket: duzey === 'il' || duzey === 'fua',
    etiket: (f) => (duzey === 'il' || duzey === 'fua' ? M.bolgeler[f.id]?.ad : f.id),
    ipucu: (f) => `<div class="tooltip-body"><strong>${esc(adi(f.id))}</strong><br>${sayi(degerler.get(f.id), g.ondalik)}${g.birim && degerler.has(f.id) ? ` <span class="unit">${esc(g.birim)}</span>` : ''}${degerler.has(f.id) ? '<br><span class="tooltip-ipucu">Karşılaştırma için tıklayın</span>' : ''}</div>`,
  });
  sonCizim = { kategori, gosterge, yil, duzey, geo, olcek, satirlar, tr, g };
  if (radar.acikMi) {
    if (radar.duzey === duzey) radarAc(radar.kod);
    else radar.kapat();
  }
  grafik.guncelle(satirlar, {
    baslik: g.ad,
    ondalik: g.ondalik,
    renk: olcek,
    // Bölgelerde eksende kod (TR52), ipucunda tam ad — uzun bölge adları eksende kesiliyordu
    etiket: (d) => (duzey === 'il' || duzey === 'fua' ? d.ad : d.kod),
    tamAd: (d) => adi(d.kod),
  });
  kaynakYaz(g);
  const notEl = $('gosterge-not');
  if (notEl) { notEl.textContent = g.not ? `Not: ${g.not}` : ''; notEl.hidden = !g.not; }
  solPaneliGuncelle(g, tr);
}

/* Kaynak satırı: OECD'den alınan göstergelerde ayırt edici etiket (kaynak türü pipeline/kaynak_turu.py'de belirlenir) */
const KAYNAK_ETIKET = {
  'oecd-ozgun': ['OECD Verisi', 'Bu gösterge OECD Regional Database\'ten alındı; ulusal kaynaklarda bölge düzeyinde yayımlanmıyor.'],
  'oecd-ulusal': ['OECD Verisi', 'Bu gösterge OECD Regional Database\'ten alındı. Ulusal karşılığı: '],
  platform: ['Platform Hesaplaması', 'Bu gösterge ulusal verilerden platform tarafından hesaplandı.'],
};
function kaynakYaz(g) {
  const el = $('source-note');
  el.textContent = g.kaynak ? `Kaynak: ${g.kaynak}` : '';
  const e = KAYNAK_ETIKET[g.kaynakTuru];
  if (!e || !g.kaynak) return;
  const span = document.createElement('span');
  span.className = `kaynak-etiket kaynak-${g.kaynakTuru}`;
  span.textContent = e[0];
  span.title = e[1] + (g.kaynakTuru === 'oecd-ulusal' ? (g.kaynakAciklama ?? '') : '');
  el.append(' ', span);
  if (g.kaynakTuru !== 'platform') {
    const ac = document.createElement('span');
    ac.className = 'kaynak-aciklama';
    ac.textContent = g.kaynakTuru === 'oecd-ozgun' ? ' Ulusal kaynaklarda bölge düzeyinde yayımlanmıyor.' : ` Ulusal karşılığı: ${g.kaynakAciklama ?? ''}.`;
    el.append(ac);
  }
}

/** Haritada tıklanan birim için bölge radarını açar (ya da günceller) */
async function radarAc(kod) {
  const c = sonCizim;
  if (!c || !c.satirlar.length) return;
  if (!M.bolgeler[kod] || M.bolgeler[kod].duzey !== DUZEYLER[c.duzey].veri) return;
  const [data, trSeri, ys, tipoloji] = await Promise.all([
    kategoriVerisi(c.kategori),
    turkiyeSerisi(c.kategori, c.gosterge),
    yillar(c.kategori, c.gosterge, c.duzey),
    c.duzey === 'il' ? ilTipolojisi() : null,
  ]);
  if (c !== sonCizim) return; // bu arada başka bir çizim yapıldı
  const seriVeri = {};
  for (const y of ys) {
    const v = data[c.gosterge]?.[y]?.[kod];
    if (v != null) seriVeri[y] = v;
  }
  radar.ac({ kod, duzey: c.duzey, g: c.g, yil: c.yil, satirlar: c.satirlar, tr: c.tr, geo: c.geo, olcek: c.olcek, seri: seriVeri, trSeri, tipoloji });
  const K = c.duzey === 'fua' ? [] : [...(komsular(c.geo).get(kod) ?? [])];
  harita.isaretle(kod, K);
}

/** Türkiye düzeyi: harita yerine zaman serisi; sol panelde ilk/son yıl ve değişim */
async function turkiyeCiz(kategori, gosterge) {
  const benim = ++istekNo;
  const veri = await turkiyeSerisi(kategori, gosterge);
  if (benim !== istekNo) return;
  const g = M.gostergeById.get(gosterge);
  const ys = Object.keys(veri).sort();
  $('trend-baslik').textContent = `${gorunenAd(g.ad).baslik} — Türkiye`;
  $('trend-chart').setAttribute('aria-label', `${g.ad}, Türkiye, ${ys[0]}–${ys.at(-1)}`);
  trend.ciz({ yillar: ys, seriler: [{ ad: g.ad, veri }], ondalik: g.ondalik, birim: g.birim ?? '' });
  kaynakYaz(g);
  const notEl = $('gosterge-not');
  if (notEl) { notEl.textContent = g.not ? `Not: ${g.not}` : ''; notEl.hidden = !g.not; }

  const s = slugify(durum.kategori);
  const f = (v) => sayi(v, g.ondalik);
  $(`section-${s}`)?.querySelectorAll('[data-bolge-tipi]').forEach((el) => (el.closest('h3').innerHTML = 'Son 5 <span data-bolge-tipi>Yıl</span>'));
  if (!ys.length) {
    $(`summary-${s}`).textContent = 'Bu gösterge için Türkiye değeri bulunmuyor.';
    $(`stats-${s}`).innerHTML = '';
    $(`table-${s}`).innerHTML = '';
    return;
  }
  const [y0, y1] = [ys[0], ys.at(-1)];
  const [v0, v1] = [veri[y0], veri[y1]];
  const degisim = v0 ? ((v1 - v0) / Math.abs(v0)) * 100 : null;
  $(`summary-${s}`).innerHTML = ys.length > 1
    ? `Türkiye'de <strong>${esc(gorunenAd(g.ad).baslik)}</strong> <strong>${y0}</strong> yılında ${f(v0)} iken <strong>${y1}</strong> yılında ${f(v1)} olmuştur` +
      (degisim != null && isFinite(degisim) ? ` (${degisim >= 0 ? '+' : ''}${sayi(degisim, 1)}%).` : '.')
    : `Türkiye'de <strong>${esc(gorunenAd(g.ad).baslik)}</strong> ${y1} yılında ${f(v1)} olarak gerçekleşmiştir.`;
  $(`stats-${s}`).innerHTML = `
    <div class="stat-box"><h4>${y0}</h4><div class="stat-val">${f(v0)}</div><div class="stat-label">İlk yıl</div></div>
    <div class="stat-box"><h4>${y1}</h4><div class="stat-val">${f(v1)}</div><div class="stat-label">Son yıl</div></div>
    ${degisim != null && isFinite(degisim) && ys.length > 1 ? `<div class="stat-box stat-box--ref"><h4>Değişim</h4><div class="stat-val">${degisim >= 0 ? '+' : ''}${sayi(degisim, 1)}%</div><div class="stat-label">${y0}–${y1}</div></div>` : ''}`;
  $(`table-${s}`).innerHTML = ys.slice(-5).reverse()
    .map((y) => `<tr><td style="width:50px">${y}</td><td>Türkiye</td><td>${f(veri[y])}</td></tr>`)
    .join('');
}

function adi(kod) {
  const b = M.bolgeler[kod];
  if (!b) return kod;
  if (b.duzey === 'province') return b.ad;
  if (b.duzey === 'fua') return `${b.ad} (kent)`;
  return `${kod} (${b.ad})`;
}

function solPaneliGuncelle(g, tr) {
  const s = slugify(durum.kategori);
  const rows = durum.satirlar;
  const sec = $(`section-${s}`);
  sec?.querySelectorAll('[data-bolge-tipi]').forEach((el) => {
    el.closest('h3').innerHTML = `En Yüksek 5 <span data-bolge-tipi>${{ il: 'İl', fua: 'Kent' }[durum.duzey] ?? 'Bölge'}</span>`;
  });
  if (!rows.length) {
    $(`summary-${s}`).textContent = 'Seçilen düzey ve yıl için veri bulunmuyor.';
    $(`stats-${s}`).innerHTML = '';
    $(`table-${s}`).innerHTML = '';
    return;
  }
  const f = (v) => sayi(v, g.ondalik);
  const enY = rows[0];
  const enD = rows[rows.length - 1];
  let fark;
  if (enD.deger > 0) fark = `aradaki fark yaklaşık <strong>${sayi(enY.deger / enD.deger, 1)} kat</strong>tır.`;
  else if (enD.deger < 0) fark = 'belirgin bir uçurum ve negatif değerler göze çarpmaktadır.';
  else fark = 'en düşük bölgede sıfır değeri görülmektedir.';

  $(`summary-${s}`).innerHTML =
    `Seçilen <strong>${durum.yil}</strong> yılı <strong>${esc(gorunenAd(g.ad).baslik)}</strong> verileri incelendiğinde; ` +
    `${DUZEYLER[durum.duzey].cogul} arasında en yüksek değere sahip olan <strong>${esc(adi(enY.kod))}</strong> (${f(enY.deger)}), ` +
    `en düşük değere sahip olan <strong>${esc(adi(enD.kod))}</strong> (${f(enD.deger)}) ile kıyaslandığında ${fark}`;

  $(`stats-${s}`).innerHTML = `
    <div class="stat-box"><h4>En Yüksek</h4><div class="stat-val">${f(enY.deger)}</div><div class="stat-label">${esc(adi(enY.kod))}</div></div>
    <div class="stat-box"><h4>En Düşük</h4><div class="stat-val">${f(enD.deger)}</div><div class="stat-label">${esc(adi(enD.kod))}</div></div>
    ${tr !== null ? `<div class="stat-box stat-box--ref"><h4>Türkiye</h4><div class="stat-val">${f(tr)}</div><div class="stat-label">${durum.yil}</div></div>` : ''}`;

  $(`table-${s}`).innerHTML = rows
    .slice(0, 5)
    .map((d, i) => `<tr><td style="width:50px">#${i + 1}</td><td>${esc(adi(d.kod))}</td><td>${f(d.deger)}</td></tr>`)
    .join('');
}

/** Hakkında modundaki 3B eğik (rotateX 30°) haritada fare konumunu düzleme çevirir. */
function egikHaritaKonumu(event) {
  const kap = document.querySelector('.map-container');
  const r = kap.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const P = 1200;
  const rad = (30 * Math.PI) / 180;
  const ys = event.clientY - cy;
  const xs = event.clientX - cx;
  const yl = (ys * P) / (P * Math.cos(rad) - ys * Math.sin(rad));
  const xl = (xs * (P + yl * Math.sin(rad))) / P;
  return [xl + kap.clientWidth / 2, yl + kap.clientHeight / 2];
}

// ------------------------------------------------------------------ gezinme
function aktifBolumuBul() {
  const merkez = window.innerHeight * 0.5;
  let enIyi = null;
  let min = Infinity;
  for (const s of document.querySelectorAll('.topic-section')) {
    const r = s.getBoundingClientRect();
    const d = Math.abs(merkez - (r.top + r.height / 2));
    if (d < min) [min, enIyi] = [d, s];
  }
  return enIyi;
}

function kaydirmaIzleyici() {
  let bekliyor = false;
  const kontrol = () => {
    bekliyor = false;
    const s = aktifBolumuBul();
    if (!s || s.classList.contains('active')) return;
    document.querySelectorAll('.topic-section').forEach((x) => x.classList.toggle('active', x === s));
    document.querySelectorAll('.nav-pill').forEach((p) => p.classList.toggle('active', p.dataset.category === s.dataset.category.split(':')[0]));
    if (s.dataset.category !== durum.kategori) kategoriSec(s.dataset.category);
  };
  window.addEventListener(
    'scroll',
    () => {
      document.querySelector('header').classList.toggle('scrolled', window.scrollY > 100);
      if (!bekliyor) {
        bekliyor = true;
        requestAnimationFrame(kontrol);
      }
    },
    { passive: true },
  );
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => harita.yenidenCiz(), 200);
  });
  kontrol();
}

function gezinmeyiKur() {
  const bolumler = () => [...document.querySelectorAll('.topic-section')];
  const aktif = () => bolumler().findIndex((s) => s.classList.contains('active'));
  $('btn-top').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  $('btn-prev').onclick = () => {
    const i = aktif();
    if (i > 0) bolumler()[i - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  $('btn-next').onclick = () => {
    const i = aktif();
    const b = bolumler();
    if (i !== -1 && i < b.length - 1) b[i + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const toggle = $('mobile-menu-toggle');
  const nav = $('header-nav');
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    nav.classList.toggle('active');
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('active') && !nav.contains(e.target) && e.target !== toggle) nav.classList.remove('active');
  });
}

init();
