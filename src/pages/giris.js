/**
 * Ana sayfa: Türkiye'nin bölgelerini OECD ve AB ülkelerinin bölgeleriyle karşılaştıran kaydırmalı anlatı.
 *
 * Solda yapışkan görsel, sağda adım kartları. Her adım { baslik, metin(v) → html, gorsel(v) } şeklindedir;
 * gorsel(v) figürün başlığını, alt başlığını, lejantını ve kaynağını ayarlayıp ilgili çiziciyi çağırır.
 * Son adımdan sonra "geçiş" bölümü gelir: okur kaydırmayı sürdürdükçe dolan bir çubuk,
 * dolunca Analiz Masası'na geçer; yukarı kaydırılırsa geçiş iptal olur.
 *
 * Veri: public/veri/giris.json (tools/uluslararasi/giris_verisi.py), Avrupa NUTS 2 geometrisi
 * (Eurostat/GISCO, EPSG:3035) ve sitenin Düzey 2 geometrisi.
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
import '../styles/vitrin.css';
import '../styles/avrupa-sahne.css';

import { Chart } from 'chart.js';
import { araclarMenusu } from '../lib/menu.js';
import { SITE } from '../site.config.js';
import { geometri, kategoriVerisi, manifest } from '../lib/data.js';
import { kolaj } from '../lib/kolaj.js';
import { esitsizlikVerisi } from './esitsizlik.js';
import { cizgiGrafik } from '../lib/cizgi.js';
import { sayi, esc } from '../lib/format.js';
import { pasta, birinci, sege, profil, yuzKisi, suru } from '../lib/vitrin.js';
import { avrupaHaritasi, trHaritasi, dagilim, satirlar, serit, ayristirma } from '../lib/giris-gorsel.js';
import { sahneIskeleti, avrupaSahne } from '../lib/avrupa-sahne.js';
import { esitsizlikIskeleti, esitsizlikSahne } from '../lib/esitsizlik-sahne.js';
import { demografiSahne } from '../lib/demografi-sahne.js';
import { atlasDoldur, atlasMenusu, atlasKapak, atlasKartGorselleri } from '../lib/atlas.js';

/** Uluslararası karşılaştırma: 'sahne' (tek sahneli 8 adım) ya da 'adimlar' (eski 17 grafiklik anlatı) */
const SAHNE = (SITE.karsilastirma ?? 'sahne') === 'sahne';

Chart.defaults.font.family = "'Source Sans 3', 'Segoe UI', sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = '#5f5f5f';

const $ = (s, el = document) => el.querySelector(s);
const VERI = `${import.meta.env.BASE_URL}veri/`;
const json = (p) => fetch(VERI + p).then((r) => {
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
});

/* ------------------------------------------------------------------ renk sınıfları (dataviz: doğrulanmış rampalar) */
const IKI_YON = ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'];
const TOPRAK = ['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a'];
const esikRenk = (esikler, renkler) => (v) => {
  let i = 0;
  while (i < esikler.length && v >= esikler[i]) i++;
  return renkler[i];
};

/** Eşikli lejant: renk kutuları ve aralık etiketleri; iki uca açıklama yazılabilir */
function esikLejant(esikler, renkler, bicim, uclar) {
  const etiket = renkler.map((_, i) =>
    i === 0 ? `< ${bicim(esikler[0])}` : i === renkler.length - 1 ? `≥ ${bicim(esikler.at(-1))}` : `${bicim(esikler[i - 1])}–${bicim(esikler[i])}`);
  return `<div class="esik-lejant">${renkler.map((r, i) => `<span><i style="background:${r}"></i>${etiket[i]}</span>`).join('')}</div>
    ${uclar ? `<div class="lejant-etiket ikincil"><span>← ${esc(uclar[0])}</span><span>${esc(uclar[1])} →</span></div>` : ''}`;
}

/* ------------------------------------------------------------------ yardımcılar */
let V; // giris.json
let GEO; // { nuts, ulkeler, d2 }
const ulkeAdi = (k) => V.ulkeAdlari[k] ?? k;
function bolgeAdi(kod) {
  if (kod === 'EU27_2020') return 'AB-27';
  if (kod.length === 2) return ulkeAdi(kod);
  if (kod.startsWith('TR')) return GEO.d2Ad[kod] ?? kod;
  return `${V.bolgeAdlari[kod] ?? kod} (${ulkeAdi(kod.slice(0, 2))})`;
}
const b0 = (v) => sayi(v, 0);
/** Üzerine gelince (dokunmatikte dokununca) açıklama kutusu açan terim */
let terimNo = 0;
const terim = (kelime, aciklama) => {
  const id = `terim-${++terimNo}`;
  return `<span class="terim" tabindex="0" aria-describedby="${id}">${kelime}<span class="terim-kutu" role="tooltip" id="${id}">${aciklama}</span></span>`;
};
const SGP_ACIKLAMA = `<b>Satın alma gücü paritesi (SGP)</b> ülkeler arasındaki fiyat düzeyi farkını ortadan kaldıran ortak bir
  para birimidir (Eurostat'ta "satın alma gücü standardı", PPS). Böylece GSYH, aynı mal ve hizmet sepetinin her ülkede
  ne kadar tuttuğuna göre karşılaştırılır.
  <span class="terim-ayrac">Veri:</span> Eurostat bölgesel hesaplar, <i>nama_10r_2gdp</i> tablosu, "kişi başına GSYH, SGP,
  AB-27 ortalaması = 100" birimi. Türkiye'nin Düzey 2 değerleri TÜİK'in bölgesel GSYH'sinden Eurostat tarafından aynı
  yöntemle hesaplanır.
  <span class="terim-ayrac">Yöntem:</span> Platform ek bir hesap yapmaz; değerler Eurostat'ın yayımladığı endekstir. 100 AB
  ortalamasıdır; 50, ortalamanın yarısı demektir. SGP ülke düzeyinde hesaplandığı için bir ülkenin bütün bölgelerine aynı
  fiyat düzeyi uygulanır; ülke içindeki bölgesel fiyat farkları bu değerlere yansımaz.`;
const b1 = (v) => sayi(v, 1);
const b2 = (v) => sayi(v, 2);
const isaretli = (v, d = 1) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${sayi(Math.abs(v), d)}`;
const TR_D2 = () => Object.keys(GEO.d2Ad).sort();
/** 2 harfli ülke kodundan 3 harfliye, Türkçe ad üzerinden (OECD tablolarıyla eşleşmek için) */
function uc(k2) {
  const ad = ulkeAdi(k2);
  return Object.keys(V.ulkeAdlari).find((k) => k.length === 3 && V.ulkeAdlari[k] === ad);
}

/** Bir bölge ölçüsünü ülke satırlarına böler (şerit grafiği). Yalnızca en az `enAz` bölgesi olan ülkeler. */
function ulkeGruplari(kodDegerleri, ulkeDegeri, { enAz = 2, sirala = 'ort' } = {}) {
  const g = new Map();
  for (const [kod, v] of kodDegerleri) {
    if (v == null || !Number.isFinite(v)) continue;
    const u = kod.slice(0, 2);
    if (!g.has(u)) g.set(u, []);
    g.get(u).push({ v, ad: bolgeAdi(kod) });
  }
  const gruplar = [...g.entries()]
    .filter(([u, d]) => d.length >= enAz || u === 'TR')
    .map(([u, d]) => ({ ad: ulkeAdi(u), kod: u, degerler: d, ort: ulkeDegeri(u), vurgu: u === 'TR' }));
  const anahtar = (x) => x.ort ?? x.degerler.reduce((a, d) => a + d.v, 0) / x.degerler.length;
  return gruplar.sort((a, b) => (sirala === 'ort' ? anahtar(b) - anahtar(a) : 0));
}

/* ------------------------------------------------------------------ figür */
const F = {}; // figür elemanları ve çiziciler
function figur({ baslik, alt, lejant = '', kaynak, yontem = '', tur = 'svg', uzun = false }) {
  F.fig.dataset.tur = tur;
  F.fig.classList.toggle('uzun', uzun); // çok satırlı grafikler: dar ekranda daha yüksek alan
  F.baslik.textContent = baslik;
  F.alt.textContent = alt ?? '';
  F.lejant.innerHTML = lejant;
  F.kaynak.textContent = kaynak ? `Kaynak: ${kaynak}` : '';
  F.yontem.hidden = !yontem;
  F.yontemMetin.innerHTML = yontem;
}


/* Grafiklerin "Veri ve yöntem" kutuları: kaynak tablo, kapsam ve platformun yaptığı hesap */
const EU_GSYH = `<p><b>Veri:</b> Eurostat bölgesel hesaplar, <i>nama_10r_2gdp</i> tablosu, "kişi başına GSYH, satın alma gücü
  standardı (SGP), AB-27 ortalamasına göre (%)" birimi. Türkiye'nin Düzey 2 değerleri TÜİK'in bölgesel GSYH'sinden
  Eurostat tarafından aynı yöntemle hesaplanır.</p>`;
const OECD_TL3 = `<b>Veri:</b> OECD Regional Database (<i>DF_GDP</i>), küçük bölgeler (TL3; Türkiye'de il), GSYH ve nüfus.`;
const Y = {
  gsyhHarita: `${EU_GSYH}<p><b>Yöntem:</b> Platform hesap yapmaz; harita Eurostat'ın yayımladığı endeksi gösterir. 100 AB-27
    ortalamasıdır. Renk sınıfları 60, 85, 115 ve 150 eşikleriyle ayrılır. SGP ülke düzeyinde hesaplandığı için ülke içindeki
    bölgesel fiyat farkları değerlere yansımaz.</p>`,
  gsyhSeri: `${EU_GSYH}<p><b>Yöntem:</b> Türkiye, İstanbul (TR10) ve Şanlıurfa-Diyarbakır (TRC2) için Eurostat'ın yıllık
    değerleri olduğu gibi çizilir; hesap yapılmaz. Kesikli çizgi AB-27 ortalamasıdır (100).</p>`,
  gsyhSerit: `${EU_GSYH}<p><b>Yöntem:</b> 26 Düzey 2 bölgesinin 2004 ve son yıl değerleri yan yana gösterilir; sıralama son
    yıla göredir. Metindeki "puan" farkı iki yılın endeks değerleri arasındaki farktır.</p>`,
  yakinsama: `<p>${OECD_TL3} Kişi başı GSYH sabit fiyatlarla (2020 referans yılı), SGP ABD doları; 2000 ve 2023.</p>
    <p><b>Yöntem:</b> Yatay eksen her ilin 2000'deki kişi başı GSYH'si (logaritmik ölçek). Dikey eksen 2000–2023 yıllık
    ortalama büyüme: (GSYH<sub>2023</sub> / GSYH<sub>2000</sub>)<sup>1/23</sup> − 1. Eğilim çizgisi, büyümenin 2000 değerinin
    logaritmasına en küçük kareler regresyonudur; eğim negatifse yoksul iller daha hızlı büyümüştür (β-yakınsama).
    Hesap platforma aittir.</p>`,
  theilTr: `<p>${OECD_TL3} Cari fiyatlarla ulusal para birimiyle GSYH ve nüfus, 2000–2023; il (TL3) ve Düzey 2 (TL2).</p>
    <p><b>Yöntem:</b> Theil endeksi T = Σ s<sub>i</sub> · ln(s<sub>i</sub> / p<sub>i</sub>); s<sub>i</sub> bölgenin ülke
    GSYH'sindeki payı, p<sub>i</sub> nüfus payı. Bütün bölgelerde kişi başı GSYH aynıysa T = 0'dır. OECD Regional Outlook
    2023'teki yöntemle platform hesaplamıştır; il ve Düzey 2 serileri ayrı hesaplanır.</p>`,
  theilUlke: `<p>${OECD_TL3} Her ülkenin küçük bölgeleri (Meksika ve Kolombiya'da TL3 verisi olmadığı için TL2); ülkenin
    verisi olan ilk ve son yıl.</p><p><b>Yöntem:</b> Theil endeksi T = Σ s<sub>i</sub> · ln(s<sub>i</sub> / p<sub>i</sub>)
    (s: GSYH payı, p: nüfus payı), her ülke ve yıl için ayrı. Bölge sayısı ülkeden ülkeye değiştiği için değerler bölge
    ölçeğinden etkilenir. Hesap platforma aittir.</p>`,
  gini: `<p>${OECD_TL3} Theil grafiğiyle aynı veri.</p><p><b>Yöntem:</b> Nüfus ağırlıklı Gini katsayısı: bölgeler kişi başı
    GSYH'ye göre sıralanır, nüfus payları ile GSYH paylarının birikimli eğrisinden (Lorenz eğrisi) hesaplanır. 0 tam eşitlik,
    1 bütün üretimin tek bölgede olmasıdır. Çubuk son yıl, çizgi ilk yıl. Hesap platforma aittir.</p>`,
  ust10: `<p>${OECD_TL3} Son yıl.</p><p><b>Yöntem:</b> Her ülkede bölgeler kişi başı GSYH'ye göre sıralanır; en üstteki
    %10'u (bölge sayısının %10'u) seçilir. Çubuk bu bölgelerin ülke GSYH'sindeki, siyah çizgi ülke nüfusundaki payıdır.
    İkisi arasındaki fark üretimin nüfusa göre ne kadar yoğunlaştığını gösterir. Hesap platforma aittir.</p>`,
  ropi: `<p><b>Veri:</b> OECD Regional Database: bölgesel deflatörlerle reel GSYH (<i>DF_GDP_ROPI</i>) ve ulusal deflatörle
    reel GSYH (<i>DF_GDP</i>), Düzey 2 (TL2), kişi başı, 2020 fiyatlarıyla SGP ABD doları.</p><p><b>Yöntem:</b> Her ülkede
    bölgeler kişi başı GSYH'ye göre sıralanır; nüfusun en zengin %20'sinin yaşadığı bölgelerin kişi başı GSYH'si en yoksul
    %20'ninkine bölünür (nüfus ağırlıklı). Oran ulusal ve bölgesel deflatörle ayrı ayrı hesaplanır. Bu oranlar OECD
    verisinden platform tarafından hesaplanmıştır (Regions and Cities at a Glance 2024'ün ölçüsü).</p>`,
  ropiTr: `<p><b>Veri:</b> OECD <i>DF_GDP_ROPI</i> ve <i>DF_GDP</i>, Türkiye'nin 26 Düzey 2 bölgesi, kişi başı reel GSYH,
    2001–2022.</p><p><b>Yöntem:</b> Her bölge için 2001–2022 yıllık ortalama reel büyüme iki kez hesaplanır: bölgenin kendi
    fiyat endeksiyle (bölgesel deflatör) ve Türkiye geneli fiyat endeksiyle (ulusal deflatör). Haritadaki değer ikisinin
    farkıdır (puan): pozitifse bölgede fiyatlar ülke ortalamasından yavaş artmış, reel büyüme daha yüksek çıkmıştır.</p>`,
  yasli: `<p><b>Veri:</b> Eurostat <i>demo_r_pjanind2</i>, yaşlı bağımlılık oranı, NUTS 2 ve Türkiye'nin Düzey 2 bölgeleri
    (Türkiye değerleri TÜİK'in nüfus verisinden).</p><p><b>Yöntem:</b> Oran = 65 yaş ve üstü nüfus / 15–64 yaş nüfus × 100;
    değer Eurostat'tan olduğu gibi alınır.</p>`,
  nufus: `<p><b>Veri:</b> Eurostat <i>demo_r_d2jan</i>, 1 Ocak nüfusu, NUTS 2 ve Türkiye'nin Düzey 2 bölgeleri.</p>
    <p><b>Yöntem:</b> Yıllık ortalama değişim = (N<sub>2025</sub> / N<sub>2008</sub>)<sup>1/17</sup> − 1. Serisi 2008'den
    sonra başlayan bölgelerde ilk yıl esas alınır. Hesap platforma aittir.</p>`,
  kadin: `<p><b>Veri:</b> Eurostat <i>lfst_r_lfe2emprt</i>, 20–64 yaş kadınların istihdam oranı (%), NUTS 2 ve Türkiye'nin
    Düzey 2 bölgeleri (Türkiye değerleri TÜİK Hanehalkı İşgücü Anketi'nden).</p><p><b>Yöntem:</b> Değerler olduğu gibi
    alınır; her satır bir ülkenin bölgelerinin dağılımını gösterir.</p>`,
  kadinFark: `<p><b>Veri:</b> Eurostat <i>lfst_r_lfe2emprt</i>, 20–64 yaş kadın istihdam oranı, 2019 ve 2024.</p>
    <p><b>Yöntem:</b> Fark = 2024 oranı − 2019 oranı (yüzde puan). Hesap platforma aittir.</p>`,
  atik: `<p><b>Veri:</b> OECD Regional Database (<i>DF_WASTE</i>), kişi başı belediye atığı (kg), Düzey 2 (TL2); ilk yıl
    2010–2014 arasındaki ilk değer, son yıl 2018–2023 arasındaki son değer.</p><p><b>Yöntem:</b> Değişim = (son yıl / ilk yıl
    − 1) × 100. Hesap platforma aittir.</p>`,
  verimlilik: `<p><b>Veri:</b> TÜİK bölgesel hesaplar, gayri safi katma değer zincirlenmiş hacim (2009=100); TÜİK Hanehalkı
    İşgücü Anketi, 15 yaş ve üstü istihdam (ikamete göre); 26 Düzey 2 bölgesi, 2018 ve 2024.</p><p><b>Yöntem:</b> OECD
    <i>Regions and Cities at a Glance 2026</i> Şekil 1.1 ile aynı: çalışan başına reel GSKD'nin yıllık bileşik büyümesi,
    ((GSKD₂₀₂₄ / istihdam₂₀₂₄) / (GSKD₂₀₁₈ / istihdam₂₀₁₈))^(1/6) − 1. OECD istihdamı iş yerine göre sayar; TÜİK'in bölge
    istihdamı ikamete göre olduğu için değerler rapordan biraz farklı olabilir. Hesap platforma aittir.</p>`,
  goreli: `<p><b>Veri:</b> TÜİK bölgesel hesaplar, GSYH zincirlenmiş hacim (2009=100), 26 Düzey 2 bölgesi ve 81 il; TÜİK ADNKS
    yıl sonu nüfusu; 2018 ve 2024.</p><p><b>Yöntem:</b> OECD <i>Regions and Cities at a Glance 2026</i> Şekil 1.4–1.5 ile aynı.
    Her bölge için reel kişi başı GSYH'nin 2018–2024 yıllık bileşik büyümesi hesaplanır, Türkiye'nin büyümesi çıkarılır ve
    bölge büyümelerinin standart sapmasına bölünür. OECD reel GSYH'yi bölgesel deflatörle (ROPI = cari GSYH / zincirlenmiş
    hacim) bulur; TÜİK'in zincirlenmiş hacim serisi aynı sonucu verir. Renk sınıfları −1, 0 ve +1 standart sapma. Nüfus payları
    2024 nüfusuyla. OECD yıl ortası nüfus kullandığı için değerler raporla küçük farklar gösterebilir. Hesap platforma aittir.</p>`,
  ayristirma: `<p><b>Veri:</b> TÜİK GSYH zincirlenmiş hacim (2009=100), ADNKS yıl sonu nüfusu, Hanehalkı İşgücü Anketi istihdamı
    (15+ yaş, ikamete göre) ve 15–64 yaş nüfusu; 26 Düzey 2 bölgesi, 2018–2024.</p><p><b>Yöntem:</b> OECD <i>Regions and
    Cities at a Glance 2026</i> Şekil 1.3 ile aynı. Bölgeler 2018–2024 ortalama reel kişi başı GSYH'ye göre sıralanır; en
    yoksuldan başlayarak nüfusun %20'sine ulaşana kadar alınan bölgeler "en alt %20", en zenginden başlayarak alınanlar "en üst
    %20", kalanlar "orta %60" olur. Grubun kişi başı GSYH'si = (GSYH / istihdam) × (istihdam / nüfus). Yıllık bileşik büyüme
    bu iki çarpanın logaritmik büyümesi oranında verimliliğe ve emek kullanımına bölünür; iki parçanın toplamı çizgiyle
    gösterilen toplam büyümeye eşittir. İstihdam oranı = istihdam / 15–64 yaş nüfus (2024). Hesap platforma aittir.</p>`,
};

/* ------------------------------------------------------------------ adımlar */
const ADIMLAR = [
  {
    bolum: 'Gelir düzeyi',
    baslik: 'Avrupa Bölgeleri İçinde Türkiye\'nin Gelir Düzeyi',
    metin: (v) => {
      const tr = TR_D2().map((k) => [k, v.gsyh.deger[k]]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
      const tum = Object.values(v.gsyh.deger).filter((x) => x != null).sort((a, b) => b - a);
      const sira = tum.indexOf(tr[0][1]) + 1;
      return `<p>${terim('Satın alma gücü paritesiyle', SGP_ACIKLAMA)} kişi başına GSYH, AB-27 ortalaması 100 kabul edildiğinde
        ${v.gsyh.yil} yılında Türkiye genelinde <strong>${b0(v.gsyh.ulke.TR)}</strong> düzeyindedir.</p>
        <p>${esc(bolgeAdi(tr[0][0]))} bölgesi ${b0(tr[0][1])} değeriyle Avrupa'daki ${tum.length} bölge arasında ${sira}. sırada yer almakta
        ve AB ortalamasının üzerinde bulunmaktadır. En düşük değere sahip ${esc(bolgeAdi(tr.at(-1)[0]))} bölgesi ise ${b0(tr.at(-1)[1])}
        düzeyiyle AB ortalamasının üçte birinin altında kalmaktadır.</p>`;
    },
    gorsel: (v) => {
      const es = [60, 85, 115, 150];
      const renk = esikRenk(es, IKI_YON);
      const d = new Map(Object.entries(v.gsyh.deger).filter(([, x]) => x != null));
      figur({ yontem: Y.gsyhHarita,
        baslik: 'Kişi başına GSYH (SGP), AB-27 = 100',
        alt: `Avrupa ve Türkiye'nin Düzey 2 bölgeleri, ${v.gsyh.yil}`,
        lejant: esikLejant(es, IKI_YON, b0, ['ortalamanın altında', 'üstünde']),
        kaynak: 'Eurostat',
      });
      F.avrupa.ciz({ nuts: GEO.nuts, ulkeler: GEO.ulkeler, degerler: d, renk,
        etiket: (k) => `<strong>${esc(bolgeAdi(k))}</strong><br>${d.has(k) ? `AB-27 = 100 iken ${b0(d.get(k))}` : 'Veri yok'}` });
    },
  },
  {
    baslik: 'AB Ortalamasına Yakınsama, 2000–2024',
    metin: (v) => {
      const s = v.gsyh.trSeri;
      const i0 = s.yillar[0];
      const son = s.yillar.at(-1);
      return `<p>AB-27 ortalaması 100 kabul edildiğinde, Türkiye'nin kişi başına GSYH düzeyi ${i0} yılında
        <strong>${b0(s.seri.TR[0])}</strong> iken ${son} yılında <strong>${b0(s.seri.TR.at(-1))}</strong> düzeyine yükselmiştir.</p>
        <p>Aynı dönemde İstanbul bölgesinin değeri ${s.seri.TR10[0]} düzeyinden ${s.seri.TR10.at(-1)} düzeyine çıkarak AB ortalamasını aşmıştır.
        Kişi başına geliri en düşük bölge olan Şanlıurfa, Diyarbakır bölgesinde ise değer ${s.seri.TRC2[0]} düzeyinden ${s.seri.TRC2.at(-1)}
        düzeyine yükselmiştir. Bu bölgede önemli bir ilerleme kaydedilmekle birlikte AB ortalamasıyla arasındaki fark büyüklüğünü korumaktadır.</p>`;
    },
    gorsel: (v) => {
      const s = v.gsyh.trSeri;
      const seri = (k) => Object.fromEntries(s.yillar.map((y, i) => [y, s.seri[k][i]]));
      figur({ yontem: Y.gsyhSeri, tur: 'cizgi', baslik: 'Kişi başına GSYH (SGP), AB-27 = 100', alt: `${s.yillar[0]}–${s.yillar.at(-1)}`, kaynak: 'Eurostat' });
      F.cizgi.ciz({
        yillar: s.yillar.map(String),
        seriler: [
          { ad: 'İstanbul (TR10)', kisaAd: 'İstanbul', veri: seri('TR10') },
          { ad: 'Türkiye', kisaAd: 'Türkiye', veri: seri('TR') },
          { ad: 'Şanlıurfa, Diyarbakır (TRC2)', kisaAd: 'TRC2', veri: seri('TRC2') },
        ],
        ondalik: 0,
        basvuru: { deger: 100, etiket: 'AB-27 ortalaması = 100' },
      });
    },
  },
  {
    baslik: 'Tüm Bölgelerde Gelir Düzeyinin Artışı',
    metin: (v) => {
      const r = TR_D2().map((k) => ({ k, a: v.gsyh.d2004[k], b: v.gsyh.deger[k] })).filter((x) => x.a && x.b);
      const art = r.map((x) => ({ ...x, f: x.b - x.a })).sort((a, b) => b.f - a.f);
      return `<p>2004–${v.gsyh.yil} döneminde 26 Düzey 2 bölgesinin tamamı AB-27 ortalamasına yaklaşmıştır. En fazla puan artışı
        ${esc(bolgeAdi(art[0].k))} bölgesinde (${isaretli(art[0].f, 0)} puan), en az artış ise ${esc(bolgeAdi(art.at(-1).k))} bölgesinde
        (${isaretli(art.at(-1).f, 0)} puan) gerçekleşmiştir.</p>
        <p>Bununla birlikte bölgelerin sıralamasında önemli bir değişiklik olmamıştır. Batıdaki sanayi ve hizmet merkezleri üst sıralardaki
        yerini korurken Doğu ve Güneydoğu Anadolu bölgeleri AB ortalamasının yarısının altında kalmaya devam etmektedir.</p>`;
    },
    gorsel: (v) => {
      const r = TR_D2().map((k) => ({ ad: GEO.d2Ad[k], kod: k, a: v.gsyh.d2004[k], b: v.gsyh.deger[k] }))
        .filter((x) => x.b != null).sort((a, b) => b.b - a.b);
      figur({ yontem: Y.gsyhSerit, baslik: 'Kişi başına GSYH (SGP), AB-27 = 100', alt: `Türkiye'nin 26 Düzey 2 bölgesi, 2004 → ${v.gsyh.yil}`, kaynak: 'Eurostat', uzun: true });
      F.satir.ciz({ satirlar: r.map((x) => ({ ...x, ad: kisalt(x.ad) , ipucu: `<strong>${esc(x.ad)}</strong><br>2004: ${b0(x.a)}<br>${v.gsyh.yil}: ${b0(x.b)}` })),
        aEtiket: '2004', bEtiket: String(v.gsyh.yil), bicim: b0, referans: 100, referansEtiket: 'AB-27 = 100', solBosluk: 150 });
    },
  },
  {
    baslik: 'İller Arasında Gelir Yakınsaması',
    metin: (v) => {
      const s = [...v.yakinsama].sort((a, b) => b.buyume - a.buyume);
      return `<p>Grafik, OECD'nin <em>Regional Outlook 2023</em> raporunda yer alan yakınsama analizinin Türkiye için güncellenmiş hâlidir.
        Her nokta bir ili temsil etmektedir. Yatay eksen 2000 yılındaki kişi başına reel GSYH'yi, dikey eksen ise 2000–2023 dönemindeki
        yıllık ortalama büyüme hızını göstermektedir.</p>
        <p>Eğilim çizgisinin negatif eğimi, başlangıçta kişi başına geliri düşük olan illerin ortalamada daha hızlı büyüdüğüne işaret etmektedir.
        En yüksek büyüme hızı <strong>${esc(s[0].ad)}</strong> ilinde (yıllık %${b2(s[0].buyume)}), en düşük büyüme hızı ise ${esc(s.at(-1).ad)}
        ilinde (yıllık %${b2(s.at(-1).buyume)}) gerçekleşmiştir. Noktaların eğilim çizgisi etrafındaki geniş dağılımı, yakınsamanın
        tüm illerde aynı ölçüde gerçekleşmediğini göstermektedir.</p>`;
    },
    gorsel: (v) => {
      const s = [...v.yakinsama].sort((a, b) => b.buyume - a.buyume);
      const etiketli = new Set([s[0].kod, s.at(-1).kod, 'TR100', 'TR421', 'TRC21']);
      figur({ yontem: Y.yakinsama, baslik: 'İllerde kişi başı GSYH yakınsaması', alt: '81 il, sabit fiyatlı SGP ABD doları, 2000 → 2023', kaynak: 'OECD Regional Database, Hesaplama: Platform' });
      F.dagilim.ciz({
        noktalar: v.yakinsama.map((d) => ({
          x: d.y2000, y: d.buyume, ad: d.ad, vurgu: etiketli.has(d.kod), etiket: etiketli.has(d.kod) ? d.ad : null,
          ipucu: `<strong>${esc(d.ad)}</strong><br>2000: ${b0(d.y2000)} $<br>2023: ${b0(d.y2023)} $<br>Yıllık büyüme: %${b2(d.buyume)}`,
        })),
        xLog: true, egilim: true, xEtiket: 'Kişi başı GSYH, 2000 (SGP $, log ölçek)', yEtiket: 'Yıllık ortalama büyüme, 2000–2023 (%)',
        xBicim: (x) => `${b0(x / 1000)} bin`, yBicim: b1,
      });
    },
  },
  {
    bolum: 'Eşitsizlik',
    baslik: 'OECD Ülkeleri Arasında Bölgesel Eşitsizlik',
    metin: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.theil - a.theil);
      const i = u.findIndex((x) => x.ulke === 'TUR') + 1;
      const azalan = u.filter((x) => x.theil < x.theilIlk).length;
      return `<p>Theil endeksi, kişi başına gelirin bölgeler arasındaki dağılımındaki eşitsizliği nüfus ağırlıklı olarak ölçmektedir.
        Endeksin sıfır olması tam eşitliği ifade etmektedir.</p>
        <p>Bu ölçüte göre ${u.length} OECD ülkesi karşılaştırıldığında Türkiye, bölgeler arası eşitsizliğin en yüksek olduğu
        <strong>${i}.</strong> ülkedir. Türkiye'den önce ${u.slice(0, i - 1).map((x) => esc(x.ad)).join(', ')} yer almaktadır.</p>
        <p>Grafikte içi boş daireler ilk yılı, dolu daireler son yılı göstermektedir. Karşılaştırılan ülkelerden yalnızca ${azalan}
        tanesinde eşitsizlik azalmış olup Türkiye de bu ülkeler arasındadır.</p>`;
    },
    gorsel: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.theil - a.theil);
      figur({ yontem: Y.theilUlke, baslik: 'Kişi başı GSYH\'de bölgeler arası Theil endeksi', alt: `${u.length} ülke, küçük bölgeler (TL3; Meksika ve Kolombiya TL2), ilk yıl → son yıl`, kaynak: 'OECD Regional Database, Hesaplama: Platform', uzun: true });
      F.satir.ciz({
        satirlar: u.map((x) => ({ ad: x.ad, a: x.theilIlk, b: x.theil, vurgu: x.ulke === 'TUR',
          ipucu: `<strong>${esc(x.ad)}</strong> (${x.duzey}, ${x.n} bölge)<br>${x.ilkYil}: ${sayi(x.theilIlk, 3)}<br>${x.sonYil}: ${sayi(x.theil, 3)}` })),
        aEtiket: 'ilk yıl', bEtiket: 'son yıl', bicim: (x) => sayi(x, 2), solBosluk: 120,
      });
    },
  },
  {
    baslik: 'Gini Katsayısına Göre Bölgesel Eşitsizlik',
    metin: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.gini - a.gini);
      const i = u.findIndex((x) => x.ulke === 'TUR') + 1;
      const tr = u[i - 1];
      return `<p><em>Regional Outlook 2023</em> raporunda kullanılan mekânsal Gini katsayısı da benzer bir tablo ortaya koymaktadır.
        Türkiye ${sayi(tr.gini, 3)} değeriyle ${u.length} ülke arasında <strong>${i}.</strong> sırada yer almaktadır.</p>
        <p>Grafikteki siyah çizgi ilk yıla ait değeri göstermektedir. Türkiye'de Gini katsayısı ${tr.ilkYil} yılındaki ${sayi(tr.giniIlk, 3)}
        düzeyinden gerilemiştir.</p>`;
    },
    gorsel: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.gini - a.gini);
      figur({ yontem: Y.gini, baslik: 'Kişi başı GSYH\'de bölgeler arası Gini katsayısı', alt: `${u.length} ülke, son yıl (çizgi: ilk yıl)`, kaynak: 'OECD Regional Database, Hesaplama: Platform', uzun: true });
      F.satir.ciz({ tur: 'cubuk', isaret: true, sifir: true,
        satirlar: u.map((x) => ({ ad: x.ad, a: x.giniIlk, b: x.gini, vurgu: x.ulke === 'TUR',
          ipucu: `<strong>${esc(x.ad)}</strong><br>${x.ilkYil}: ${sayi(x.giniIlk, 3)}<br>${x.sonYil}: ${sayi(x.gini, 3)}` })),
        aEtiket: 'ilk yıl', bEtiket: 'son yıl', bicim: (x) => sayi(x, 2), solBosluk: 120 });
    },
  },
  {
    baslik: 'Ekonomik Faaliyetin Bölgesel Yoğunlaşması',
    metin: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.gsyhPay - a.gsyhPay);
      const tr = u.find((x) => x.ulke === 'TUR');
      return `<p>Türkiye'de kişi başına geliri en yüksek yüzde onluk dilimdeki illerin ülke GSYH'si içindeki payı
        <strong>%${b1(tr.gsyhPay)}</strong>, bu illerin nüfus payı ise %${b1(tr.nufusPay)} düzeyindedir.</p>
        <p>Türkiye, bu yoğunlaşma oranı bakımından ${u.length} ülke arasında ${u.indexOf(tr) + 1}. sırada yer almaktadır. Çubuk ile siyah
        çizgi arasındaki fark, ekonomik faaliyetin nüfusa kıyasla hangi ölçüde yoğunlaştığını göstermektedir.</p>`;
    },
    gorsel: (v) => {
      const u = [...v.ulkeEsitsizlik].sort((a, b) => b.gsyhPay - a.gsyhPay);
      figur({ yontem: Y.ust10, baslik: 'Kişi başı geliri en yüksek %10\'luk bölgelerin payı', alt: `${u.length} ülke, son yıl (%)`, kaynak: 'OECD Regional Database, Hesaplama: Platform', uzun: true });
      F.satir.ciz({ tur: 'cubuk', isaret: true, sifir: true,
        satirlar: u.map((x) => ({ ad: x.ad, a: x.nufusPay, b: x.gsyhPay, vurgu: x.ulke === 'TUR',
          ipucu: `<strong>${esc(x.ad)}</strong> (${x.sonYil})<br>GSYH payı: %${b1(x.gsyhPay)}<br>Nüfus payı: %${b1(x.nufusPay)}` })),
        aEtiket: 'nüfus payı', bEtiket: 'GSYH payı', bicim: b0, solBosluk: 120 });
    },
  },
  {
    bolum: 'Fiyat farkları',
    baslik: 'Bölgesel Fiyat Farklılıklarının Etkisi',
    metin: (v) => {
      const tr = v.ropi.ulkeler.find((x) => x.ulke === 'TUR');
      return `<p><em>Regions and Cities at a Glance 2024</em> raporunda gelirler, her bölgenin kendi fiyat düzeyini yansıtan bölgesel
        deflatörle düzeltilmektedir. Kullanılan ölçüt, kişi başına GSYH'si en yüksek yüzde yirmilik dilimdeki bölgelerin, en düşük yüzde
        yirmilik dilimdeki bölgelere oranıdır.</p>
        <p>Türkiye'de ${tr.y0} yılında ulusal deflatörle ${b2(tr.ulusal0)} olarak hesaplanan oran, bölgesel fiyatlar dikkate alındığında
        ${b2(tr.bolgesel0)} düzeyine gerilemektedir. ${tr.y1} yılında ise durum tersine dönmüştür: oran ulusal deflatörle ${b2(tr.ulusal1)},
        bölgesel deflatörle <strong>${b2(tr.bolgesel1)}</strong> olarak hesaplanmaktadır. Bu değişim, dönem boyunca fiyatların yüksek
        gelirli bölgelerde ülke ortalamasından daha yavaş artmasından kaynaklanmaktadır; bu nedenle bölgesel fiyatlar dikkate alındığında
        bölgeler arasındaki fark daralmamakta, aksine bir miktar genişlemektedir.</p>`;
    },
    gorsel: (v) => {
      const u = [...v.ropi.ulkeler].sort((a, b) => b.bolgesel1 - a.bolgesel1);
      figur({ yontem: Y.ropi, baslik: 'En yüksek / en düşük %20\'lik bölgelerin kişi başı GSYH oranı', alt: `${u.length} ülke, Düzey 2 (TL2), ${u[0].y1}: ulusal ve bölgesel deflatörle`, kaynak: 'OECD Regional Database, Hesaplama: Platform', uzun: true });
      F.satir.ciz({ satirlar: u.map((x) => ({ ad: x.ad, a: x.ulusal1, b: x.bolgesel1, vurgu: x.ulke === 'TUR',
        ipucu: `<strong>${esc(x.ad)}</strong><br>${x.y0}: ulusal ${b2(x.ulusal0)}, bölgesel ${b2(x.bolgesel0)}<br>${x.y1}: ulusal ${b2(x.ulusal1)}, bölgesel ${b2(x.bolgesel1)}` })),
        aEtiket: 'ulusal deflatörle', bEtiket: 'bölgesel deflatörle', bicim: b1, solBosluk: 120 });
    },
  },
  {
    baslik: 'Bölgesel Deflatörün Reel Büyümeye Etkisi',
    metin: (v) => {
      const r = v.ropi.tr.map((x) => ({ ...x, f: x.bolgesel - x.ulusal })).sort((a, b) => b.f - a.f);
      return `<p>Harita, 2001–2022 dönemindeki yıllık reel büyüme hızının bölgesel deflatörle hesaplandığında ulusal deflatörle
        hesaplanan değere göre kaç puan farklılaştığını göstermektedir.</p>
        <p>Mavi renkli bölgelerde fiyatlar ülke ortalamasından daha yavaş arttığından reel büyüme daha yüksek hesaplanmaktadır; bu
        farkın en büyük olduğu bölge ${esc(r[0].ad)} bölgesidir (${isaretli(r[0].f, 2)} puan). Kahverengi bölgelerde ise durum tersidir;
        farkın en büyük olduğu bölge ${esc(r.at(-1).ad)} bölgesidir (${isaretli(r.at(-1).f, 2)} puan).</p>`;
    },
    gorsel: (v) => {
      const es = [-0.6, -0.2, 0.2, 0.6];
      const renk = esikRenk(es, IKI_YON);
      const d = new Map(v.ropi.tr.map((x) => [x.kod, x.bolgesel - x.ulusal]));
      const r = new Map(v.ropi.tr.map((x) => [x.kod, x]));
      figur({ yontem: Y.ropiTr, baslik: 'Bölgesel deflatörün yıllık reel büyümeye etkisi (puan)', alt: 'Türkiye, 26 Düzey 2 bölgesi, 2001–2022',
        lejant: esikLejant(es, IKI_YON, (x) => isaretli(x, 1), ['büyüme daha düşük', 'daha yüksek']), kaynak: 'OECD Regional Database, Hesaplama: Platform' });
      F.tr.ciz({ geo: GEO.d2, degerler: d, renk,
        etiket: (k) => (r.has(k) ? `<strong>${esc(GEO.d2Ad[k])}</strong><br>Ulusal deflatörle: %${b2(r.get(k).ulusal)}<br>Bölgesel deflatörle: %${b2(r.get(k).bolgesel)}<br>Fark: ${isaretli(d.get(k), 2)} puan` : esc(GEO.d2Ad[k] ?? k)) });
    },
  },
  {
    bolum: 'Büyüme, 2018–2024',
    baslik: 'Bölgelerin Türkiye Ortalamasına Göre Büyüme Performansı',
    metin: (v) => {
      const b = v.buyume;
      const r = [...b.d2.bolgeler].sort((x, y) => y.z - x.z);
      const hizli = r.filter((x) => x.z >= 1).map((x) => esc(x.ad));
      const yavas = r.filter((x) => x.z <= -1).reverse().map((x) => esc(x.ad));
      return `<p>Türkiye'de reel kişi başına GSYH ${b.yillar[0]}–${b.yillar[1]} döneminde yıllık ortalama <strong>%${b2(b.trBuyume)}</strong>
        oranında artmıştır. OECD'nin <em>Regions and Cities at a Glance 2026</em> raporunda her bölgenin büyüme performansı, ülke
        ortalamasından sapmasıyla ve standart sapma (SS) cinsinden ölçülmektedir. Türkiye'de bir standart sapma ${b2(b.d2.ss)} puana karşılık gelmektedir.</p>
        <p>Ortalamanın en az 1 SS üzerinde büyüyen bölgeler: ${hizli.join('; ')}. Ortalamanın en az 1 SS altında kalan bölgeler: ${yavas.join('; ')}.
        Nüfusun <strong>%${b1(b.d2.alt)}</strong> kadarı ortalamanın gerisinde kalan, %${b1(b.d2.ust)} kadarı ise ortalamanın üzerinde büyüyen
        bölgelerde yaşamaktadır (il düzeyinde sırasıyla %${b1(b.il.alt)} ve %${b1(b.il.ust)}). Rapora göre OECD genelinde bu oranlar sırasıyla %12 ve %13'tür.</p>`;
    },
    gorsel: (v) => {
      const b = v.buyume;
      const RENKLER = ['#8a5a0e', '#d9b36b', '#9ab8cf', '#2e6e9e'];
      const renk = esikRenk([-1, 0, 1], RENKLER);
      const r = new Map(b.d2.bolgeler.map((x) => [x.kod, x]));
      figur({ yontem: Y.goreli, baslik: 'Reel kişi başı GSYH büyümesinin Türkiye ortalamasından sapması (SS)',
        alt: `Türkiye, 26 Düzey 2 bölgesi, ${b.yillar[0]}–${b.yillar[1]} yıllık ortalama`,
        lejant: `<div class="esik-lejant">${['≤ −1 SS', '−1 – 0 SS', '0 – +1 SS', '≥ +1 SS'].map((t, i) => `<span><i style="background:${RENKLER[i]}"></i>${t}</span>`).join('')}</div>
          <div class="lejant-etiket ikincil"><span>← ortalamadan yavaş</span><span>hızlı →</span></div>`,
        kaynak: 'TÜİK, Hesaplama: Platform' });
      F.tr.ciz({ geo: GEO.d2, degerler: new Map(b.d2.bolgeler.map((x) => [x.kod, x.z])), renk,
        etiket: (k) => (r.has(k) ? `<strong>${esc(GEO.d2Ad[k])}</strong><br>Yıllık reel büyüme: %${b2(r.get(k).buyume)} (Türkiye %${b2(b.trBuyume)})<br>Sapma: ${isaretli(r.get(k).z, 2)} SS` : esc(GEO.d2Ad[k] ?? k)) });
    },
  },
  {
    baslik: 'Çalışan Başına Katma Değerde Bölgesel Farklılaşma',
    metin: (v) => {
      const p = v.buyume.verimlilik;
      const b = p.bolgeler;
      const negatif = b.filter((x) => x.buyume < 0).map((x) => esc(x.ad));
      return `<p>OECD'ye göre verimlilik, bölgelerin gelişmiş bölgelere yetişme sürecini belirleyen temel etkendir. Türkiye'de çalışan başına
        reel katma değer ${v.buyume.yillar[0]}–${v.buyume.yillar[1]} döneminde yıllık ortalama <strong>%${b2(p.tr)}</strong> oranında artmıştır.</p>
        <p>En yüksek artış ${esc(b[0].ad)} bölgesinde (yıllık %${b2(b[0].buyume)}), en düşük değer ise ${esc(b.at(-1).ad)} bölgesinde
        (${b.at(-1).buyume < 0 ? `yıllık %${b2(-b.at(-1).buyume)} düşüş` : `yıllık %${b2(b.at(-1).buyume)}`}) gerçekleşmiş olup iki bölge arasındaki fark
        ${b1(b[0].buyume - b.at(-1).buyume)} puandır.${negatif.length ? ` ${negatif.join(' ve ')} bölgelerinde verimlilik gerilemiştir.` : ''}
        İstanbul bölgesi yıllık %${b2(b.find((x) => x.kod === 'TR10')?.buyume ?? 0)} artışla Türkiye ortalamasının bir miktar üzerindedir.</p>`;
    },
    gorsel: (v) => {
      const p = v.buyume.verimlilik;
      figur({ yontem: Y.verimlilik, baslik: 'Çalışan başına reel katma değerin yıllık büyümesi (%)',
        alt: `Türkiye, 26 Düzey 2 bölgesi, ${v.buyume.yillar[0]}–${v.buyume.yillar[1]}`, kaynak: 'TÜİK, Hesaplama: Platform', uzun: true });
      F.satir.ciz({ tur: 'cubuk', sifir: true, referans: p.tr, referansEtiket: `Türkiye %${b2(p.tr)}`,
        satirlar: p.bolgeler.map((x) => ({ ad: kisalt(x.ad), b: x.buyume, ipucu: `<strong>${esc(x.ad)}</strong><br>Yıllık büyüme: %${b2(x.buyume)}<br>Türkiye: %${b2(p.tr)}` })),
        bEtiket: 'yıllık büyüme', bicim: b1, solBosluk: 150 });
    },
  },
  {
    baslik: 'Büyümenin Kaynakları: Verimlilik ve İstihdam',
    metin: (v) => {
      const a = Object.fromEntries(v.buyume.ayristirma.map((x) => [x.grup, x]));
      const alt = a['En alt %20'];
      const ust = a['En üst %20'];
      return `<p>Kişi başına geliri en düşük ${alt.bolgeler.length} bölgede (nüfusun yaklaşık %${b0(alt.nufusPay)} kadarı) kişi başına GSYH
        yıllık ortalama <strong>%${b2(alt.kbGsyh)}</strong> oranında artarken, en yüksek gelirli ${ust.bolgeler.map(esc).join(' ve ')} bölgelerinde
        bu oran %${b2(ust.kbGsyh)} olmuştur.${alt.kbGsyh > ust.kbGsyh ? ' Bu sonuç, iki grup arasındaki gelir farkının daraldığını göstermektedir.' : ''}</p>
        <p>Alt gruptaki büyümenin ${b1(alt.verimlilik)} puanı çalışan başına üretimdeki artıştan (verimlilik), ${b1(alt.emek)} puanı ise
        çalışan sayısının nüfusa oranındaki artıştan (emek kullanımı) kaynaklanmaktadır. Buna karşın bu bölgelerde istihdam oranı ülke
        ortalamasının <strong>${b1(-alt.istFark)} puan altındadır</strong> (%${b1(alt.istOrani)}; Türkiye %${b1(a['Türkiye'].istOrani)}).
        İstihdamın artırılmasına yönelik potansiyel yüksek olmakla birlikte, büyüme ağırlıklı olarak verimlilik artışından kaynaklanmıştır.</p>`;
    },
    gorsel: (v) => {
      const RENKLER = ['#2e6e9e', '#d9b36b'];
      figur({ yontem: Y.ayristirma, baslik: 'Kişi başı GSYH büyümesinin kaynakları (yıllık, %)',
        alt: `Türkiye, gelir düzeyine göre Düzey 2 bölge grupları, ${v.buyume.yillar[0]}–${v.buyume.yillar[1]}`,
        kaynak: 'TÜİK, Hesaplama: Platform' });
      F.ayristirma.ciz({
        satirlar: v.buyume.ayristirma.map((x) => ({ ad: x.grup, parcalar: [x.verimlilik, x.emek], toplam: x.kbGsyh, vurgu: x.grup === 'Türkiye',
          ipucu: `<strong>${esc(x.grup)}</strong>${x.grup === 'Türkiye' ? '' : ` (nüfusun %${b0(x.nufusPay)}'i)`}<br>Kişi başı GSYH: %${b2(x.kbGsyh)}<br>Verimlilik: ${b2(x.verimlilik)} puan<br>Emek kullanımı: ${b2(x.emek)} puan<br>İstihdam oranı 2024: %${b1(x.istOrani)}${x.grup === 'Türkiye' ? '' : ` (${isaretli(x.istFark, 1)} puan)`}${x.bolgeler.length <= 7 && x.grup !== 'Türkiye' ? `<br><span class="ikincil">${x.bolgeler.map(esc).join('<br>')}</span>` : ''}` })),
        parcaAdlari: ['verimlilik', 'emek kullanımı'], renkler: RENKLER, toplamAdi: 'kişi başı GSYH', bicim: b1, xEtiket: 'Yıllık büyüme (%)' });
    },
  },
  {
    bolum: 'Nüfus',
    baslik: 'Yaşlı Bağımlılık Oranı: Avrupa ile Karşılaştırma',
    metin: (v) => {
      const y = v.yasli.deger;
      const tr = TR_D2().filter((k) => y[k] != null).sort((a, b) => y[a] - y[b]);
      const genc = Object.entries(y).filter(([k]) => k.length === 4).sort((a, b) => a[1] - b[1]).slice(0, 10);
      const trSay = genc.filter(([k]) => k.startsWith('TR')).length;
      return `<p>Yaşlı bağımlılık oranı, 65 ve daha yukarı yaştaki nüfusun 15–64 yaş grubundaki nüfusa oranını ifade etmektedir. Bu oran
        ${v.yasli.yil} yılında AB-27'de <strong>${b1(v.yasli.ab)}</strong>, Türkiye'de <strong>${b1(y.TR)}</strong> düzeyindedir.</p>
        <p>Avrupa'da yaşlı bağımlılık oranının en düşük olduğu on bölgenin ${trSay} tanesi Türkiye'de bulunmaktadır. ${esc(bolgeAdi(tr[0]))}
        bölgesi ${b1(y[tr[0]])} değeriyle Türkiye'nin en genç nüfus yapısına sahip bölgesi iken ${esc(bolgeAdi(tr.at(-1)))} bölgesi
        ${b1(y[tr.at(-1)])} değeriyle en yaşlı nüfus yapısına sahip bölgedir.</p>`;
    },
    gorsel: (v) => {
      const es = [20, 27, 33, 40];
      const d = new Map(Object.entries(v.yasli.deger).filter(([k, x]) => k.length === 4 && x != null));
      figur({ yontem: Y.yasli, baslik: 'Yaşlı bağımlılık oranı (65+ / 15–64, %)', alt: `Avrupa ve Türkiye'nin Düzey 2 bölgeleri, ${v.yasli.yil}`,
        lejant: esikLejant(es, TOPRAK, b0), kaynak: 'Eurostat' });
      F.avrupa.ciz({ nuts: GEO.nuts, ulkeler: GEO.ulkeler, degerler: d, renk: esikRenk(es, TOPRAK),
        etiket: (k) => `<strong>${esc(bolgeAdi(k))}</strong><br>${d.has(k) ? `%${b1(d.get(k))}` : 'Veri yok'}` });
    },
  },
  {
    baslik: 'Bölgesel Nüfus Değişimi, 2008–2025',
    metin: (v) => {
      const n = v.nufus;
      const bolge = Object.entries(n).filter(([k]) => k.length === 4);
      const azalan = bolge.filter(([, x]) => x.g < 0).length;
      const trAz = TR_D2().filter((k) => n[k]?.g < 0);
      return `<p>Harita, 2008–2025 dönemindeki yıllık ortalama nüfus değişimini göstermektedir. Bu dönemde Avrupa'daki ${bolge.length}
        bölgenin ${azalan} tanesinde nüfus azalmış, AB-27 genelinde ise nüfus yıllık ortalama yalnızca %${b2(n.EU27_2020.g)} oranında artmıştır.</p>
        <p>Türkiye'de nüfus aynı dönemde yıllık ortalama <strong>%${b2(n.TR.g)}</strong> oranında artmıştır. ${trAz.length
          ? `Nüfusu azalan bölgeler yalnızca ${trAz.map((k) => esc(bolgeAdi(k))).join(' ve ')} bölgeleridir.`
          : 'Türkiye\'de nüfusu azalan bölge bulunmamaktadır.'}</p>`;
    },
    gorsel: (v) => {
      const es = [-0.5, -0.1, 0.1, 0.5];
      const d = new Map(Object.entries(v.nufus).filter(([k]) => k.length === 4).map(([k, x]) => [k, x.g]));
      figur({ yontem: Y.nufus, baslik: 'Yıllık ortalama nüfus değişimi (%)', alt: 'Avrupa ve Türkiye\'nin Düzey 2 bölgeleri, 2008–2025',
        lejant: esikLejant(es, IKI_YON, (x) => isaretli(x, 1), ['azalış', 'artış']), kaynak: 'Eurostat, Hesaplama: Platform' });
      F.avrupa.ciz({ nuts: GEO.nuts, ulkeler: GEO.ulkeler, degerler: d, renk: esikRenk(es, IKI_YON),
        etiket: (k) => `<strong>${esc(bolgeAdi(k))}</strong><br>${d.has(k) ? `yılda %${isaretli(d.get(k), 2)} (${v.nufus[k].y0}–2025)` : 'Veri yok'}` });
    },
  },
  {
    bolum: 'İstihdam',
    baslik: 'Kadın İstihdam Oranı',
    metin: (v) => {
      const k = v.kadin;
      const tr = TR_D2().filter((x) => k[x]?.[1] != null).sort((a, b) => k[a][1] - k[b][1]);
      const dus = Object.entries(k).filter(([x, d]) => x.length === 4 && d[1] != null).sort((a, b) => a[1][1] - b[1][1]).slice(0, 10);
      return `<p>2024 yılında 20–64 yaş grubundaki kadınların istihdam oranı AB-27'de <strong>%${b1(k.EU27_2020[1])}</strong>,
        Türkiye'de <strong>%${b1(k.TR[1])}</strong> düzeyindedir.</p>
        <p>Avrupa'da kadın istihdam oranının en düşük olduğu on bölgenin ${dus.filter(([x]) => x.startsWith('TR')).length} tanesi
        Türkiye'de bulunmaktadır. En düşük oran %${b1(k[tr[0]][1])} ile ${esc(bolgeAdi(tr[0]))} bölgesindedir. Türkiye'de oranın en yüksek
        olduğu ${esc(bolgeAdi(tr.at(-1)))} bölgesi (%${b1(k[tr.at(-1)][1])}) dahi Avrupa'daki bölgelerin büyük çoğunluğunun altında kalmaktadır.</p>`;
    },
    gorsel: (v) => {
      const k = v.kadin;
      const gr = ulkeGruplari(Object.entries(k).filter(([x]) => x.length === 4).map(([x, d]) => [x, d[1]]), (u) => k[u]?.[1]);
      figur({ yontem: Y.kadin, baslik: 'Kadın istihdam oranı (20–64 yaş, %)', alt: 'Ülkelere göre Düzey 2 bölgeleri, 2024', kaynak: 'Eurostat', uzun: true });
      F.serit.ciz({ gruplar: gr, bicim: b0, birim: '%', xEtiket: 'Kadın istihdam oranı (%)', ortEtiket: 'ülke ortalaması' });
    },
  },
  {
    baslik: 'Kadın İstihdam Oranındaki Değişim, 2019–2024',
    metin: (v) => {
      const k = v.kadin;
      const f = (x) => k[x][1] - k[x][0];
      const tr = TR_D2().filter((x) => k[x]?.[0] != null && k[x]?.[1] != null).sort((a, b) => f(b) - f(a));
      return `<p><em>Regions and Cities at a Glance 2024</em> raporundaki yaklaşımla 2019 yılı esas alındığında, Türkiye'de kadın istihdam
        oranındaki değişim <strong>${isaretli(f('TR'))} puan</strong> olmuştur. Aynı dönemde AB-27'deki değişim ${isaretli(f('EU27_2020'))} puandır.</p>
        <p>En büyük artış ${esc(bolgeAdi(tr[0]))} bölgesinde (${isaretli(f(tr[0]))} puan) gerçekleşmiştir.${tr.filter((x) => f(x) < 0).length
          ? ` ${tr.filter((x) => f(x) < 0).length} bölgede ise oran gerilemiştir.` : ''} Türkiye, bölgeler arasındaki değişimin
        farklılaşması bakımından Avrupa'da en geniş dağılımı gösteren ülkeler arasındadır.</p>`;
    },
    gorsel: (v) => {
      const k = v.kadin;
      const ok = (x) => k[x]?.[0] != null && k[x]?.[1] != null;
      const gr = ulkeGruplari(Object.keys(k).filter((x) => x.length === 4 && ok(x)).map((x) => [x, k[x][1] - k[x][0]]), (u) => (ok(u) ? k[u][1] - k[u][0] : null));
      figur({ yontem: Y.kadinFark, baslik: 'Kadın istihdam oranındaki değişim, 2019 → 2024 (puan)', alt: 'Ülkelere göre Düzey 2 bölgeleri, 2019 → 2024', kaynak: 'Eurostat, Hesaplama: Platform', uzun: true });
      F.serit.ciz({ gruplar: gr, bicim: (x) => isaretli(x, 0), birim: 'puan', xEtiket: 'Değişim (yüzde puan)', sifir: true, ortEtiket: 'ülke geneli' });
    },
  },
  {
    bolum: 'Çevre',
    baslik: 'Kişi Başına Belediye Atığı',
    metin: (v) => {
      const a = v.atik;
      const trU = a.ulkeler.find((x) => x.kod === 'TUR');
      const trB = a.bolgeler.filter((x) => x.ulke === 'TR');
      const azalan = trB.filter((x) => x.son < x.ilk).length;
      return `<p>Türkiye'de kişi başına belediye atığı ${trU.ilkYil} yılında ${b0(trU.ilk)} kg iken ${trU.sonYil} yılında
        <strong>${b0(trU.son)} kg</strong> olmuştur (%${isaretli((trU.son / trU.ilk - 1) * 100, 0)} değişim).</p>
        <p>Düzey 2 bölgelerinin ${azalan} tanesinde kişi başına atık miktarı azalmıştır. Buna karşın birçok Avrupa ülkesinde kişi başına
        atık miktarı artmıştır.</p>`;
    },
    gorsel: (v) => {
      const a = v.atik;
      const ulke = new Map(a.ulkeler.map((x) => [x.kod, x]));
      const deg = (x) => (x.son / x.ilk - 1) * 100;
      const gr = ulkeGruplari(a.bolgeler.map((x) => [x.kod, deg(x)]), (u) => { const x = ulke.get(uc(u)); return x ? deg(x) : null; }, { enAz: 2 });
      figur({ yontem: Y.atik, baslik: 'Kişi başı belediye atığındaki değişim (%)', alt: 'Ülkelere göre Düzey 2 (TL2) bölgeleri, 2010 → son yıl', kaynak: 'OECD Regional Database, Hesaplama: Platform', uzun: true });
      F.serit.ciz({ gruplar: gr, bicim: (x) => isaretli(x, 0), birim: '%', xEtiket: 'Değişim (%)', sifir: true, ortEtiket: 'ülke geneli' });
    },
  },
];

/** Uzun Düzey 2 adlarını satır etiketine sığdır: "Trabzon, Ordu, …" */
function kisalt(ad) {
  const p = ad.split(', ');
  return p.length > 2 ? `${p[0]}, ${p[1]}…` : ad;
}

/* ------------------------------------------------------------------ yerleşim */
function sayfayiKur() {
  const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
  document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));
  $('#site-baslik').textContent = SITE.baslik;
  araclarMenusu($('#araclar'));

  const kap = $('#bolumler');
  let bolumNo = 0;
  kap.innerHTML = `${SAHNE ? `
    <section class="avrupa-sahne" id="avrupa-sahne">${sahneIskeleti()}
      <details class="yontem as-yontem"><summary>Veri ve Yöntem</summary><div class="yontem-metin">
        <p><b>Veri:</b> Eurostat ve TÜİK; Düzey 2 (NUTS 2) bölgeleri. Satın alma gücü paritesine göre kişi başına GSYH, AB-27 = 100
          (2004 ve 2024; nama_10r_2gdp); yaşlı bağımlılık oranı, 65+ / 15–64 (2024; demo_r_pjanind2); yıllık ortalama nüfus değişimi,
          2008–2025 (demo_r_d2jan); 20–64 yaş kadın istihdam oranı (2019 ve 2024; lfst_r_lfe2emprt).</p>
        <p><b>Kapsam:</b> Gösterimdeki 291 bölge AB-27, EFTA ve aday ülkeleri kapsar. Kanarya Adaları, Azorlar, Madeira ve Fransa'nın
          denizaşırı bölgeleri gösterimden çıkarılmıştır. Bir göstergede verisi bulunmayan bölge o adımda gösterilmez. Kıbrıs'a ilişkin
          Eurostat verileri yalnızca Güney Kıbrıs Rum Yönetimi'nin (GKRY) denetimindeki alanı kapsar. Kuzey Kıbrıs Türk Cumhuriyeti (KKTC)
          bu bölge sınıflamalarında yer almadığından veri noktası bulunmamakta, sınırları harita adımlarında ayrıca gösterilmektedir
          (Natural Earth 1:10m).</p>
        <p><b>Gelir ikizi:</b> Her Türkiye bölgesi için 2024 yılı kişi başı GSYH düzeyi en yakın Avrupa bölgesi seçilmiştir (Ceuta ve
          Melilla hariç). İkiz bölgeler gelirde benzer olsa da yaş yapısı ve kadın istihdamında ayrışabilmektedir.</p>
        <p><b>Kaynak:</b> Eurostat, TÜİK, Natural Earth; Hesaplama: Platform.</p>
      </div></details>
    </section>
    <section class="avrupa-sahne tr-esitsizlik" id="tr-esitsizlik">
      <div class="es-giris">
        <p class="vt-no">2.2</p>
        <h3 class="es-giris-baslik">2000'den Bu Yana İller Arası Gelir Farkının Seyri</h3>
        <p class="giris">İller arasındaki kişi başı gelir farkı 2000'den bu yana daralıyor. Aşağıdaki adımlar bu değişimi tek bir grafik üzerinde, adım adım göstermektedir.</p>
      </div>
      ${esitsizlikIskeleti()}
    </section>` : `
    <section class="bolum" id="karsilastirma">
      <div class="scrolly">
        <figure class="gorsel" aria-live="polite">
          <figcaption><h3 class="gorsel-baslik"></h3><p class="gorsel-alt"></p></figcaption>
          <div class="gorsel-alan">
            <svg class="harita" role="img"></svg>
            <div class="ipucu"></div>
            <div class="cizgi-kap"><canvas></canvas></div>
          </div>
          <div class="lejant"></div>
          <p class="kaynak"></p>
          <details class="yontem" hidden><summary>Veri ve Yöntem</summary><div class="yontem-metin"></div></details>
        </figure>
        <div class="adimlar">
          ${ADIMLAR.map((a, j) => `
            ${a.bolum ? `<p class="adim-bolum">${String(++bolumNo).padStart(2, '0')} · ${esc(a.bolum)}</p>` : ''}
            <article class="adim" data-adim="${j}">
              <p class="adim-no">${j + 1} / ${ADIMLAR.length}</p>
              <h4>${esc(a.baslik)}</h4>
              <div class="adim-metin"><p class="yukleniyor">Yükleniyor…</p></div>
            </article>`).join('')}
        </div>
      </div>
    </section>`}
    <section class="gecis" id="gecis">
      <div class="gecis-ic">
        <p class="ust-etiket">Devam</p>
        <h2>Bütün göstergeler Analiz Masası'nda</h2>
        <p>İller, Düzey 1 ve Düzey 2 bölgeleri ile OECD kentleri için 2.400'ü aşkın gösterge; harita, sıralama, zaman serisi ve veriden hesaplanan bulgularla.</p>
        <div class="gecis-cubuk" role="progressbar" aria-label="Analiz Masası'na geçiş" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <p class="gecis-not">Kaydırmaya devam edildiğinde Analiz Masası açılacaktır.</p>
        <a class="kesfet gecis-dugme" href="analiz.html">Analiz Masası'na git →</a>
      </div>
    </section>`;

  // atlas: Türkiye içi eşitsizlik anlatısı 2. bölüme (Bölgesel Farklar) taşınır; Avrupa anlatısı 5. bölüme aittir
  const yer = $('#yer-esitsizlik'), es = $('#tr-esitsizlik');
  if (yer && es) yer.replaceWith(es);
  $('#avrupa-sahne')?.setAttribute('data-bolum', 'bolum-avrupa');
  atlasMenusu();
  if (SAHNE) return;
  const sec = $('#karsilastirma');
  F.fig = $('.gorsel', sec);
  F.baslik = $('.gorsel-baslik', sec);
  F.alt = $('.gorsel-alt', sec);
  F.lejant = $('.lejant', sec);
  F.kaynak = $('.kaynak', sec);
  F.yontem = $('.yontem', sec);
  F.yontemMetin = $('.yontem-metin', sec);
  const svg = $('svg.harita', sec);
  const ipucu = $('.ipucu', sec);
  F.avrupa = avrupaHaritasi(svg, ipucu);
  F.tr = trHaritasi(svg, ipucu);
  F.dagilim = dagilim(svg, ipucu);
  F.satir = satirlar(svg, ipucu);
  F.serit = serit(svg, ipucu);
  F.ayristirma = ayristirma(svg, ipucu);
  F.cizgi = cizgiGrafik($('.cizgi-kap canvas', sec));
}

/* ------------------------------------------------------------------ kaydırma */
let aktif = -1;
function adimiCiz(j) {
  if (aktif === j || !V) return;
  aktif = j;
  document.querySelectorAll('#karsilastirma .adim').forEach((x) => x.classList.toggle('aktif', +x.dataset.adim === j));
  try {
    ADIMLAR[j].gorsel(V);
  } catch (e) {
    console.error(`adım ${j}:`, e);
  }
}

function izle() {
  const gozlemci = new IntersectionObserver(
    (girdiler) => girdiler.forEach((g) => g.isIntersecting && adimiCiz(+g.target.dataset.adim)),
    // Geniş ekranda adım, metnin üst kenarı ekranın ortasını geçip üstten %48 çizgisine varınca değişir
    // (daha erken değişirse görsel, metin henüz ekranın altındayken yenileniyor).
    { rootMargin: matchMedia('(max-width: 900px)').matches ? '-70% 0px -25% 0px' : '-46% 0px -52% 0px' },
  );
  document.querySelectorAll('#karsilastirma .adim').forEach((el) => gozlemci.observe(el));

  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const j = aktif;
      aktif = -1;
      if (j >= 0) adimiCiz(j);
    }, 200);
  });
}

/**
 * Geçiş: sayfanın son bölümünde kaydırma ilerledikçe çubuk dolar; sayfa sonuna varılınca
 * kısa bir beklemeden sonra Analiz Masası açılır. Bekleme sırasında yukarı kaydırılırsa iptal.
 * Geri tuşuyla dönüldüğünde sayfa en altta açılırsa, okur biraz yukarı çıkana kadar geçiş kurulmaz.
 */
function gecis() {
  const bol = $('#gecis');
  const dolgu = $('.gecis-cubuk span', bol);
  const cubuk = $('.gecis-cubuk', bol);
  const not = $('.gecis-not', bol);
  let zamanlayici = null;
  let kurulu = false;
  const oran = () => {
    const bas = bol.offsetTop - window.innerHeight * 0.35;
    const son = document.documentElement.scrollHeight - window.innerHeight;
    if (son <= bas) return 0;
    return Math.min(1, Math.max(0, (window.scrollY - bas) / (son - bas)));
  };
  const guncelle = () => {
    const p = oran();
    if (p < 0.85) kurulu = true;
    dolgu.style.transform = `scaleX(${p})`;
    cubuk.setAttribute('aria-valuenow', Math.round(p * 100));
    if (p >= 0.995 && kurulu && !zamanlayici) {
      bol.classList.add('gidiyor');
      not.textContent = 'Analiz Masası açılıyor…';
      zamanlayici = setTimeout(() => (window.location.href = 'analiz.html'), 700);
    } else if (p < 0.97 && zamanlayici) {
      clearTimeout(zamanlayici);
      zamanlayici = null;
      bol.classList.remove('gidiyor');
      not.textContent = 'Kaydırmaya devam edin, Analiz Masası açılacak.';
    }
  };
  window.addEventListener('scroll', guncelle, { passive: true });
  window.addEventListener('pageshow', () => {
    kurulu = oran() < 0.85;
    clearTimeout(zamanlayici);
    zamanlayici = null;
    bol.classList.remove('gidiyor');
    guncelle();
  });
  guncelle();
}

/* ------------------------------------------------------------------ vitrin (giriş bölümü) */
const VITRIN = [];
async function vitrin() {
  try {
    const V = await json('vitrin.json');
    const yedek = (p) => p.catch(() => null);
    try { demografiSahne($('#dm-donusum'), V); } catch (e) { console.error('demografi', e); $('#dm-donusum')?.remove(); }
    Promise.all([yedek(json('esitsizlik.json')), yedek(geometri('province')), yedek(json('avrupa-sahne.json'))]).then(([E, geo, AV]) => {
      atlasDoldur(V, E);
      atlasKapak(V, geo);
      atlasKartGorselleri(V, E, AV);
    });
    const o = V.ozet;
    const rakam = (etiket, deger, alt) => `<div><dt>${etiket}</dt><dd>${deger}<small>${alt}</small></dd></div>`;
    $('#vt-rakamlar').innerHTML = [
      rakam('Nüfus', sayi(o.nufus.deger / 1e6, 1), `milyon kişi · ${o.nufus.yil} · 81 il, ${o.ilce} ilçe`),
      rakam('GSYH', sayi(o.gsyh.deger / 1e9, 1), `trilyon TL · ${o.gsyh.yil} · cari fiyatlarla`),
      rakam('Kişi başı GSYH', sayi(o.kbGsyhDolar.deger, 0), `ABD doları · ${o.kbGsyhDolar.yil}`),
      rakam('Ortanca yaş', sayi(o.ortancaYas.deger, 1), `yaş · ${o.ortancaYas.yil}`),
      o.ihracat ? rakam('İhracat', sayi(o.ihracat.deger / 1e6, 1), `milyar ABD doları · ${o.ihracat.yil}`) : '',
    ].join('');
    for (const [id, f] of [['vt-pasta', pasta], ['vt-birinci', birinci], ['vt-sege', sege], ['vt-profil', profil], ['vt-yuz', yuzKisi], ['vt-suru', suru]]) {
      try {
        VITRIN.push(f($(`#${id}`), V));
      } catch (e) {
        console.error(id, e);
      }
    }
    let t;
    let sonGen = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === sonGen) return; // mobilde adres çubuğu yüksekliği değişince yeniden çizme
      sonGen = window.innerWidth;
      clearTimeout(t);
      t = setTimeout(() => VITRIN.forEach((v) => v.yenidenCiz()), 200);
    });
  } catch (e) {
    console.error('vitrin', e);
    $('#vitrin')?.remove();
  }
}

/** Giriş şeridi: site.config.js'teki seçime göre resim ya da veri kolajı */
function girisSeridi() {
  const kap = $('#giris-gorsel');
  if (!kap) return;
  if (kap.classList.contains('atlas-hero')) {
    // atlas kapağı: koyu zemin üzerinde saydam üst çubuk, kapak geçilince dolu
  } else if (SITE.girisSeridi === 'kolaj') {
    kap.classList.add('kolaj-modu');
    document.body.classList.remove('ana-sayfa');
    kap.querySelector('.giris-resim')?.remove();
    $('#kolaj').hidden = false;
    kolajiCiz();
  } else {
    kap.querySelector('#kolaj')?.remove();
    const resim = SITE.girisResmi || 'img/giris-serit';
    kap.querySelector('source').srcset = `${resim}.webp`;
    kap.querySelector('img').src = `${resim}.jpg`;
  }
  const cubuk = document.querySelector('.ust-cubuk');
  const guncelle = () => cubuk.classList.toggle('dolu', window.scrollY > kap.offsetHeight - cubuk.offsetHeight);
  guncelle();
  window.addEventListener('scroll', guncelle, { passive: true });
}

async function kolajiCiz() {
  const svg = $('#kolaj');
  try {
    const [esit, nufus, demografi, geoIl, geoD1, geoD2] = await Promise.all([
      esitsizlikVerisi(), kategoriVerisi('Nüfus'), kategoriVerisi('Demografi'),
      geometri('province'), geometri('region12'), geometri('region26'),
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
    sayfayiKur();
    girisSeridi();
    gecis();
    vitrin();
    if (SAHNE) {
      avrupaSahne($('#avrupa-sahne'), await json('avrupa-sahne.json'));
      Promise.all([esitsizlikVerisi(), manifest()])
        .then(([E, Mf]) => esitsizlikSahne($('#tr-esitsizlik'), E, Mf))
        .catch((e) => { console.warn('Eşitsizlik bölümü yüklenemedi:', e); $('#tr-esitsizlik')?.remove(); });
      return;
    }
    const [v, nuts, ulkeler, d2] = await Promise.all([
      json('giris.json'), json('geo/avrupa-nuts2.json'), json('geo/avrupa-ulkeler.json'), geometri('region26'),
    ]);
    V = v;
    GEO = { nuts, ulkeler, d2, d2Ad: Object.fromEntries(d2.features.map((f) => [f.id, f.properties?.ad ?? f.id])) };
    document.querySelectorAll('#karsilastirma .adim').forEach((el) => {
      try {
        $('.adim-metin', el).innerHTML = ADIMLAR[+el.dataset.adim].metin(V);
      } catch (e) {
        console.error(`adım ${el.dataset.adim}:`, e);
        $('.adim-metin', el).innerHTML = '<p>Bu adımın verisi yüklenemedi.</p>';
      }
    });
    izle();
    adimiCiz(0);
  } catch (e) {
    if (ayriliyor) return; // sayfadan çıkılırken yarıda kesilen istekler hata değildir
    console.error(e);
    $('#bolumler').innerHTML = `<p class="hata">Veri yüklenemedi: ${esc(e.message)}</p>`;
  }
}
let ayriliyor = false;
window.addEventListener('beforeunload', () => (ayriliyor = true));
window.addEventListener('pagehide', () => (ayriliyor = true));
init();
