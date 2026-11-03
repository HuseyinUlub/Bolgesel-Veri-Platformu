/**
 * Analiz Masası: il göstergelerinin haritası ve veriden hesaplanan bulgular.
 *
 * Üç sekme:
 *   Gösterge — il haritası (düzey · değişim · kümeler), bölgelere göre dağılım ve bulgu kartları:
 *              özet ve eşitsizlik (Gini), coğrafi kümelenme (Moran I, yerel Moran/LISA), bölge ve kentsel–kırsal
 *              farkları, iller arası farkın zaman içindeki seyri; değişim görünümünde yakınsama ve sıra değişimi.
 *   İlişki   — iki göstergenin 81 il dağılım grafiği, sade dilde ilişki değerlendirmesi, eğilimden ayrışan iller,
 *              seçilen gösterge ile birlikte en çok değişen göstergeler (Spearman).
 *   Yer      — bir ilin bütün göstergelerdeki değeri, sırası, 81 il içindeki konumu, 5 yıllık sıra değişimi;
 *              güçlü ve zayıf yanlar, benzer iller.
 *
 * Veri: public/veri/analiz.json (tools/analiz/analiz_verisi.py) ve il sınırları (veri/geo/province.json).
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
import '../styles/analiz.css';

import { select } from 'd3-selection';
import { scaleLinear, scaleLog } from 'd3-scale';
import { ascending, deviation, extent, groups, max, mean, min, quantileSorted, range, shuffle, sum } from 'd3-array';
import { geoMercator, geoPath } from 'd3-geo';
import { line } from 'd3-shape';
import { precisionFixed } from 'd3-format';
import { araclarMenusu } from '../lib/menu.js';
import { SITE } from '../site.config.js';
import '../styles/radar.css';
import { geometri, manifest, kategoriVerisi, turkiyeSerisi, yillar, ilTipolojisi, DUZEYLER } from '../lib/data.js';
import { ustBasliklar, kaynaksizAd, seciciOgeleri, ustBul } from '../lib/basliklar.js';
import { gostergeSecici } from '../lib/gosterge-secici.js';
import { bolgeRadari, komsular } from '../lib/radar.js';
import { indir, csv, dosyaAdi } from '../lib/arac.js';
import { SIRALI, IKI_YONLU, NOKTA_PALET, renkler as paletRenk, lejantOku, pngYap, bulgularMetni } from '../lib/analiz-disa.js';

const d3 = { select, scaleLinear, scaleLog, ascending, deviation, extent, groups, max, mean, min, quantileSorted, range, shuffle, sum, geoMercator, geoPath, line, precisionFixed };

const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));
document.getElementById('site-baslik').textContent = SITE.baslik;
araclarMenusu(document.getElementById('araclar'));

let ayriliyor = false;
window.addEventListener('beforeunload', () => (ayriliyor = true));
window.addEventListener('pagehide', () => (ayriliyor = true));

async function yukle() {
  const [V, M] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}veri/analiz.json`).then((r) => { if (!r.ok) throw new Error(`analiz.json: ${r.status}`); return r.json(); }),
    manifest(),
  ]);
  return { V, M };
}

function baslat({ V, M }) {
  const IL = V.iller, N = IL.length;
  // GA: bütün analiz göstergeleri; G: il değeri olanlar (Yer sekmesi ve il analizi). Yalnızca Düzey 2'de yayımlananların yillar alanı boştur.
  const GA = V.gostergeler, G = GA.filter((g) => g.yillar.length), GK = new Map(GA.map((g) => [g.k, g]));
  const B2 = V.bolgeler2 ?? [], N2 = B2.length;
  const BOLGE_RENK = ['#009a8a', '#8566c4', '#d9568f', '#d6981b', '#c8473b', '#2a95d0', '#4d9a3a'];
  const OECD_RENK = ['#2a78d6', '#eb6834', '#1baf7a'];
  const TOPRAK = ['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a'];
  const IKI_YON = ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'];
  const KUME = { HH: ['#c74827', 'Yüksek–yüksek (sıcak küme)'], LL: ['#2e6e9e', 'Düşük–düşük (soğuk küme)'], HL: ['#e8b999', 'Yüksek değer, düşük komşular'], LH: ['#9ab8cf', 'Düşük değer, yüksek komşular'], NS: ['#ece8df', 'Anlamlı değil'] };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nf = (v, d = 0) => (v == null || !isFinite(v) ? '–' : v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const isr = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '±') + nf(Math.abs(v), d);
  const dg = (g, v, d = g.ond) => (g.birim === '%' ? `%${nf(v, d)}` : `${nf(v, d)} ${g.birim}`);
  const ilAd = (i) => IL[i].a;

  /* ---------- istatistik ---------- */
  const deger = (g, y) => (g.deger[y] || Array(N).fill(null));
  const goreli = (g, y) => { const t = g.tr[y]; return deger(g, y).map((v) => (v == null || !t ? null : (v / t) * 100)); };
  const gecerli = (a) => a.map((v, i) => [v, i]).filter(([v]) => v != null && isFinite(v));
  const ort = (a) => d3.mean(a.filter((v) => v != null));
  function gini(a) {
    const v = a.filter((x) => x != null).sort((p, q) => p - q);
    if (!v.length || v[0] < 0) return null;
    const n = v.length, s = d3.sum(v);
    return d3.sum(v, (x, i) => (2 * (i + 1) - n - 1) * x) / (n * s);
  }
  const cv = (a) => { const v = a.filter((x) => x != null); const m = d3.mean(v); return m > 0 ? d3.deviation(v) / m : null; };
  function rastgele(t) { return () => { t |= 0; t = (t + 0x6D2B79F5) | 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; }
  function moran(a, komsu) {
    const idx = a.map((v, i) => i).filter((i) => a[i] != null);
    const set = new Set(idx);
    const kom = komsu.map((k) => (k ?? []).filter((j) => set.has(j)));
    const m = d3.mean(idx, (i) => a[i]);
    const z = a.map((v) => (v == null ? null : v - m));
    const s2 = d3.sum(idx, (i) => z[i] ** 2) / idx.length;
    const lag = (zz, i) => (kom[i].length ? d3.mean(kom[i], (j) => zz[j]) : 0);
    const I = (zz) => d3.sum(idx, (i) => zz[i] * lag(zz, i)) / d3.sum(idx, (i) => zz[i] ** 2);
    const I0 = I(z);
    const rnd = rastgele(42);
    let ust = 0;
    const vals = idx.map((i) => z[i]);
    for (let p = 0; p < 499; p++) {
      const sh = d3.shuffle([...vals], 0, vals.length, rnd), zz = Array(a.length).fill(null);
      idx.forEach((i, k) => (zz[i] = sh[k]));
      if (I(zz) >= I0) ust++;
    }
    const sinif = Array(a.length).fill(null);
    idx.forEach((i) => {
      const k = kom[i].length;
      if (!k) { sinif[i] = 'NS'; return; }
      const Ii = (z[i] / s2) * lag(z, i);
      const digerleri = idx.filter((j) => j !== i).map((j) => z[j]);
      let c = 0;
      for (let p = 0; p < 499; p++) {
        let s = 0;
        for (let q = 0; q < k; q++) s += digerleri[Math.floor(rnd() * digerleri.length)];
        const Ip = (z[i] / s2) * (s / k);
        if (Ii >= 0 ? Ip >= Ii : Ip <= Ii) c++;
      }
      const p = (c + 1) / 500;
      const L = lag(z, i);
      sinif[i] = p >= 0.05 ? 'NS' : z[i] >= 0 ? (L >= 0 ? 'HH' : 'HL') : (L < 0 ? 'LL' : 'LH');
    });
    return { I: I0, p: (ust + 1) / 500, sinif };
  }
  const moranOnbellek = new Map();
  const moranAl = (anahtar, a, komsu) => { if (!moranOnbellek.has(anahtar)) moranOnbellek.set(anahtar, moran(a, komsu)); return moranOnbellek.get(anahtar); };
  function pearson(x, y) {
    const c = x.map((v, i) => [v, y[i]]).filter(([a, b]) => a != null && b != null && isFinite(a) && isFinite(b));
    if (c.length < 10) return null;
    const mx = d3.mean(c, (d) => d[0]), my = d3.mean(c, (d) => d[1]);
    let sxy = 0, sxx = 0, syy = 0;
    c.forEach(([a, b]) => { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; });
    return { r: sxy / Math.sqrt(sxx * syy), n: c.length, egim: sxy / sxx, kes: my - (sxy / sxx) * mx };
  }
  const tikB = (t) => { const d = t.length > 1 ? Math.max(0, d3.precisionFixed(Math.abs(t[1] - t[0]))) : 0; return (v) => nf(v, Math.min(d, 3)); };
  const sira = (a) => { const s = gecerli(a).sort((p, q) => q[0] - p[0]); const r = Array(a.length).fill(null); s.forEach(([, i], k) => (r[i] = k + 1)); return r; };
  const spearman = (x, y) => { const keep = x.map((v, i) => v != null && y[i] != null); const fx = x.map((v, i) => (keep[i] ? v : null)), fy = y.map((v, i) => (keep[i] ? v : null)); return pearson(sira(fx), sira(fy)); };
  const ortakYillar = (a, b) => a.yillar.filter((y) => b.yillar.includes(y));
  function siniflar(v, n = 5) { const s = v.filter((x) => x != null).sort(d3.ascending); return d3.range(1, n).map((k) => d3.quantileSorted(s, k / n)); }
  const renkSec = (esik, renkler) => (v) => { if (v == null) return 'var(--bos)'; let i = 0; while (i < esik.length && v >= esik[i]) i++; return renkler[i]; };

  const gruplar = d3.groups(G, (g) => g.grup);
  const dilim = (el, fn) => el.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; el.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); fn(b.dataset.k); });

  /* ---------- harita ---------- */
  function haritaKur(kap) {
    const W = 760, H = 360;
    const svg = d3.select(kap).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img');
    const gZemin = svg.append('g'), gBirim = svg.append('g');
    const ip = kap.querySelector('.ipucu');
    let p = gBirim.selectAll('path');
    let anahtar = null;
    return {
      kur(K) {
        const k = `${K.duzey}`;
        if (anahtar === k) return;
        anahtar = k;
        const kapsam = K.zemin ?? { type: 'FeatureCollection', features: K.features };
        const yol = d3.geoPath(d3.geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], kapsam));
        gZemin.selectAll('path').data(K.zemin ? K.zemin.features : []).join('path').attr('class', 'il-zemin').attr('d', yol);
        p = gBirim.selectAll('path').data(K.features, (f) => f.id).join('path').attr('class', 'il').attr('d', yol);
      },
      boya(renk, etiket, tik) {
        p.attr('fill', (f) => renk(f.i))
          .on('pointermove', (ev, f) => { ip.innerHTML = etiket(f.i); konum(kap, ip, ev); })
          .on('pointerleave', () => (ip.style.opacity = 0))
          .on('click', (ev, f) => tik && tik(f.i));
      },
      sec(i, komsu = []) {
        const ks = new Set(komsu);
        p.classed('secili', (f) => f.i === i).classed('komsu', (f) => ks.has(f.i));
        if (i != null) p.filter((f) => f.i === i).raise();
      },
    };
  }
  function konum(kap, ip, ev) {
    const r = kap.getBoundingClientRect();
    let x = ev.clientX - r.left + 12; const y = ev.clientY - r.top + 12;
    if (x > r.width - 240) x -= 260;
    ip.style.transform = `translate(${x}px,${y}px)`; ip.style.opacity = 1;
  }

  /* ================= GÖSTERGE (bütün göstergeler, bütün düzeyler) ================= */
  const DUZEY_SIRA = ['il', 'duzey2', 'duzey1', 'fua', 'tr'];
  const DUZEY_AD = { il: 'İl', duzey2: 'Düzey 2', duzey1: 'Düzey 1', fua: 'Kent (OECD)', tr: 'Türkiye (zaman serisi)' };
  const VERI2KEY = { province: 'il', region26: 'duzey2', region12: 'duzey1', fua: 'fua', country: 'tr' };
  const TEKIL = { il: 'il', duzey2: 'bölge', duzey1: 'bölge', fua: 'kent' };
  const COGUL = { il: 'iller', duzey2: 'bölgeler', duzey1: 'bölgeler', fua: 'kentler' };
  const BULUNMA = { il: 'ilindedir', duzey2: 'bölgesindedir', duzey1: 'bölgesindedir', fua: 'kentindedir' };
  const KUR = new Map(GA.map((g) => [g.id, g]));
  const USTLER = ustBasliklar(M);
  const tumGostergeSayisi = M.kategoriler.reduce((t, k) => t + k.gostergeler.length, 0);

  function tanim(id) {
    const m = M.gostergeById.get(id);
    const c = KUR.get(id);
    let birim = c?.birim ?? (m.birim || '');
    if (birim === m.kaynakKisa || /^(OECD|TÜİK|Eurostat)$/.test(birim)) birim = '';
    return {
      id, m, c, kat: m.kategori, ad: c?.ad ?? kaynaksizAd(m), birim, ond: c?.ond ?? m.ondalik ?? 1, yon: c?.yon ?? 0,
      nominal: birim === 'TL', duzeyler: DUZEY_SIRA.filter((d) => m.duzeyler.some((v) => VERI2KEY[v] === d)),
    };
  }

  function komsuDizin(geo, birimler) {
    const K = komsular(geo);
    const yer = new Map(birimler.map((b, i) => [b.k, i]));
    return birimler.map((b) => [...(K.get(b.k) ?? [])].map((k) => yer.get(k)).filter((j) => j != null));
  }

  const katmanlar = new Map();
  async function katman(t, duzey) {
    const anahtar = `${t.id}|${duzey}`;
    if (katmanlar.has(anahtar)) return katmanlar.get(anahtar);
    let K;
    if (duzey === 'tr') {
      const s = await turkiyeSerisi(t.kat, t.id);
      K = { duzey, seri: Object.entries(s).map(([y, v]) => [+y, v]).sort((a, b) => a[0] - b[0]) };
    } else {
      const tanimD = DUZEYLER[duzey];
      const [geo, zemin] = await Promise.all([geometri(tanimD.veri), tanimD.zemin ? geometri(tanimD.zemin) : null]);
      let birimler, features;
      if (duzey === 'il') {
        const fk = new Map(geo.features.map((f) => [f.id, f]));
        birimler = IL;
        features = IL.map((b, i) => ({ ...fk.get(b.k), i }));
      } else {
        features = geo.features.map((f, i) => ({ ...f, i }));
        birimler = features.map((f) => ({ k: f.id, a: M.bolgeler[f.id]?.ad ?? f.id }));
      }
      const komsu = duzey === 'il' ? V.komsu : duzey === 'duzey2' ? komsuDizin(geo, birimler) : null;
      const ortak = { duzey, geo, birimler, features, zemin, komsu };
      if (duzey === 'il' && t.c?.yillar.length) {
        K = { ...ortak, yillar: t.c.yillar, deger: (y) => t.c.deger[y] ?? Array(N).fill(null), tr: (y) => t.c.tr[y] ?? null };
      } else {
        const data = await kategoriVerisi(t.kat);
        const s = data[t.id] ?? {};
        const ys = (await yillar(t.kat, t.id, duzey)).sort((a, b) => a - b);
        K = { ...ortak, yillar: ys, deger: (y) => birimler.map((b) => s[y]?.[b.k] ?? null), tr: (y) => s[y]?.TR ?? null };
      }
    }
    katmanlar.set(anahtar, K);
    return K;
  }
  const goreliK = (K, y) => { const a = K.deger(y); const t = K.tr(y) ?? ort(a); return a.map((v) => (v == null || !t ? null : (v / t) * 100)); };

  const ilkKur = KUR.get(G.find((g) => g.k === 'gsyh')?.id) ?? G[0];
  const gs = { id: ilkKur.id, duzey: 'il', mod: 'duzey', yil: null, taban: null, secili: null, alt: 'bolge' };
  const gSec = document.getElementById('g-sec'), gYil = document.getElementById('g-yil'), gTaban = document.getElementById('g-taban'), gDuzey = document.getElementById('g-duzey');
  const harita = haritaKur(document.getElementById('g-harita'));
  const seritKap = document.getElementById('g-serit');
  const seritSvg = d3.select(seritKap).append('svg');
  const trendKap = document.getElementById('g-trend');
  const trendSvg = d3.select(trendKap).append('svg');
  document.getElementById('g-sayi').textContent = nf(tumGostergeSayisi);
  document.getElementById('g-sayi-analiz').textContent = G.length;
  if (document.getElementById('g-sayi-d2')) document.getElementById('g-sayi-d2').textContent = GA.filter((g) => g.d2).length;

  // bütün göstergeler: TÜİK tema başlıkları → alt başlık (kategori) → konu; arama bütün temalarda
  const TEMALAR = USTLER.map((u) => ({ id: u.id, ad: u.ad }));
  const gSecici = gostergeSecici(gSec, {
    ogeler: seciciOgeleri(USTLER, { isaret: (g) => KUR.has(g.id) }), temalar: TEMALAR, deger: gs.id,
    etiket: 'Gösterge seçin', onSec: (id) => { if (id !== gs.id) gostergeSec(id); },
  });
  function gostergeSec(id) { gs.id = id; gs.yil = null; gs.taban = null; gs.secili = null; radar.kapat(); gCiz(); }
  gDuzey.addEventListener('change', () => { gs.duzey = gDuzey.value; gs.yil = null; gs.taban = null; gs.secili = null; radar.kapat(); gCiz(); });
  gYil.addEventListener('change', () => { gs.yil = +gYil.value; gCiz(); });
  gTaban.addEventListener('change', () => { gs.taban = +gTaban.value; gCiz(); });
  dilim(document.getElementById('g-mod'), (k) => { gs.mod = k; gCiz(); });
  dilim(document.getElementById('g-alt-gorunum'), (k) => { gs.alt = k; gCiz(); });

  function yillariKur(K) {
    if (!K.yillar.includes(gs.yil)) gs.yil = K.yillar.at(-1);
    gYil.innerHTML = [...K.yillar].reverse().map((y) => `<option${y === gs.yil ? ' selected' : ''}>${y}</option>`).join('');
    const adaylar = K.yillar.filter((y) => y < gs.yil);
    gTaban.innerHTML = adaylar.map((y) => `<option>${y}</option>`).join('');
    if (!adaylar.includes(gs.taban)) gs.taban = adaylar[0] ?? null;
    if (gs.taban != null) gTaban.value = gs.taban;
    const modDugme = (k) => document.querySelector(`#g-mod [data-k="${k}"]`);
    modDugme('degisim').disabled = !adaylar.length;
    if (!adaylar.length && gs.mod === 'degisim') gs.mod = 'duzey';
  }

  /* Kaynak satırı ve notlar: OECD ve platform hesaplamaları ayrıca belirtilir */
  const KAYNAK_ETIKET = {
    'oecd-ozgun': ['OECD Verisi', 'Ulusal kaynaklarda bölge düzeyinde yayımlanmıyor.'],
    'oecd-ulusal': ['OECD Verisi', 'Ulusal karşılığı: '],
    platform: ['Platform Hesaplaması', 'Ulusal verilerden platform tarafından hesaplandı.'],
  };
  function kaynakYaz(t) {
    const m = t.m;
    const e = KAYNAK_ETIKET[m.kaynakTuru];
    const kn = SITE.kategoriNotlari?.[t.kat];
    document.getElementById('g-kaynak').innerHTML = `${m.kaynak ? `Kaynak: ${esc(m.kaynak)}` : ''}${e ? ` <span class="kaynak-etiket">${e[0]}</span> ${esc(e[1])}${m.kaynakTuru === 'oecd-ulusal' ? esc(m.kaynakAciklama ?? '') : ''}` : ''}
      ${m.not ? `<br>Not: ${esc(m.not)}` : ''}${kn ? `<br>${esc(kn)}` : ''}`;
  }

  function duzeySeciciKur(t) {
    gDuzey.innerHTML = t.duzeyler.map((d) => `<option value="${d}"${d === gs.duzey ? ' selected' : ''}>${DUZEY_AD[d]}</option>`).join('');
  }

  function adresiYaz() {
    const p = new URLSearchParams({ gosterge: gs.id, duzey: gs.duzey });
    if (gs.yil) p.set('yil', gs.yil);
    if (gs.mod !== 'duzey') p.set('gorunum', gs.mod);
    try { history.replaceState(null, '', `?${p}${location.hash}`); } catch (e) { /* önemsiz */ }
  }

  let cizNo = 0;
  async function gCiz() {
    const no = ++cizNo;
    const t = tanim(gs.id);
    if (!t.duzeyler.includes(gs.duzey)) { gs.duzey = t.duzeyler[0]; gs.secili = null; }
    duzeySeciciKur(t);
    if (gSecici.deger() !== gs.id) gSecici.deger(gs.id);
    let K;
    try {
      K = await katman(t, gs.duzey);
    } catch (e) {
      if (ayriliyor) return; // sayfadan çıkılırken yarıda kesilen istekler hata değildir
      console.error(e);
      document.getElementById('g-bulgular').innerHTML = `<div class="kart"><p>Veri yüklenemedi: ${esc(e.message)}</p></div>`;
      return;
    }
    if (no !== cizNo) return;
    kaynakYaz(t);
    const tr = gs.duzey === 'tr';
    document.getElementById('g-harita-kap').hidden = tr;
    document.getElementById('g-trend-kap').hidden = !tr;
    document.getElementById('g-mod-k').hidden = tr;
    document.getElementById('g-yil-k').hidden = tr;
    document.getElementById('g-taban-k').hidden = tr || gs.mod !== 'degisim';
    if (tr) { trCiz(t, K); adresiYaz(); return; }
    yillariKur(K);
    adresiYaz();
    duzeyCiz(t, K);
  }

  /* Türkiye düzeyi: zaman serisi ve özet */
  function trCiz(t, K) {
    const s = K.seri;
    basliklariYaz('g', `${gs.id}|tr`, `${t.ad}: Türkiye`, s.length ? `${s[0][0]}–${s.at(-1)[0]} · ${t.birim || 'değer'}` : '');
    document.getElementById('g-lejant').innerHTML = '';
    gOzelGuncelle();
    sonG = { t, ad: `${t.ad} Türkiye`, satirlar: [['Yıl', `${t.ad}${t.birim ? ` (${t.birim})` : ''}`], ...s.map(([yy, v]) => [yy, v])] };
    const W = 760, H = 340, mg = { l: 56, r: 20, t: 16, b: 30 };
    trendSvg.attr('viewBox', `0 0 ${W} ${H}`); trendSvg.selectAll('*').remove();
    if (!s.length) { document.getElementById('g-bulgular').innerHTML = '<div class="kart"><p>Bu gösterge için Türkiye değeri bulunmamaktadır.</p></div>'; return; }
    const x = d3.scaleLinear().domain(d3.extent(s, (d) => d[0])).range([mg.l, W - mg.r]);
    const ylo = d3.min(s, (d) => d[1]), yhi = d3.max(s, (d) => d[1]);
    const y = d3.scaleLinear().domain([Math.min(0, ylo), yhi === ylo ? yhi + 1 : yhi]).nice().range([H - mg.b, mg.t]);
    const ge = trendSvg.append('g').attr('class', 'eksen');
    const yt = y.ticks(5), fy = tikB(yt);
    yt.forEach((v) => { ge.append('line').attr('x1', mg.l).attr('x2', W - mg.r).attr('y1', y(v)).attr('y2', y(v)); ge.append('text').attr('x', mg.l - 6).attr('y', y(v) + 3.5).attr('text-anchor', 'end').text(fy(v)); });
    const xt = s.length <= 12 ? s.map((d) => d[0]) : x.ticks(8).filter(Number.isInteger);
    xt.forEach((v) => ge.append('text').attr('x', x(v)).attr('y', H - 10).attr('text-anchor', 'middle').text(v));
    trendSvg.append('path').attr('d', d3.line().x((d) => x(d[0])).y((d) => y(d[1]))(s)).attr('fill', 'none').attr('stroke', 'var(--vurgu)').attr('stroke-width', 2.5);
    const ip = trendKap.querySelector('.ipucu');
    trendSvg.append('g').selectAll('circle').data(s).join('circle').attr('cx', (d) => x(d[0])).attr('cy', (d) => y(d[1])).attr('r', s.length > 30 ? 2.5 : 4)
      .attr('fill', 'var(--vurgu)').attr('stroke', 'var(--zemin)')
      .on('pointermove', (ev, d) => { ip.innerHTML = `<strong>${d[0]}</strong><br>${dg(t, d[1])}`; konum(trendKap, ip, ev); })
      .on('pointerleave', () => (ip.style.opacity = 0));
    const [y0, v0] = s[0], [y1, v1] = s.at(-1);
    const deg = v0 ? ((v1 - v0) / Math.abs(v0)) * 100 : null;
    const yillik = v0 > 0 && v1 > 0 && y1 > y0 ? ((v1 / v0) ** (1 / (y1 - y0)) - 1) * 100 : null;
    const enY = s.reduce((a, b) => (b[1] > a[1] ? b : a)), enD = s.reduce((a, b) => (b[1] < a[1] ? b : a));
    document.getElementById('g-bulgular').innerHTML = `
      <div class="kart vurgulu"><h3>Özet</h3><div class="sayilar"><div><b>${nf(v0, t.ond)}</b><span>${y0}</span></div><div><b>${nf(v1, t.ond)}</b><span>${y1}</span></div>
        <div><b>${deg != null && isFinite(deg) && s.length > 1 ? `${isr(deg, 1)}%` : '–'}</b><span>değişim</span></div></div>
        <p>Türkiye'de ${esc(t.ad.toLocaleLowerCase('tr'))} ${s.length > 1 ? `${y0} yılında ${dg(t, v0)} iken ${y1} yılında ${dg(t, v1)} olmuştur.` : `${y1} yılında ${dg(t, v1)} olarak gerçekleşmiştir.`}
        ${yillik != null && isFinite(yillik) ? ` Bu dönemde yıllık ortalama değişim %${nf(yillik, 1)} düzeyindedir.` : ''}</p></div>
      ${s.length > 2 ? `<div class="kart"><h3>Dönem içindeki uç değerler</h3><div class="liste"><span>En yüksek (${enY[0]})</span><span>${dg(t, enY[1])}</span><span>En düşük (${enD[0]})</span><span>${dg(t, enD[1])}</span></div></div>` : ''}
      <div class="kart"><h3>Son yıllar</h3><div class="liste">${s.slice(-6).reverse().map(([yy, v]) => `<span>${yy}</span><span>${dg(t, v)}</span>`).join('')}</div></div>
      ${t.duzeyler.length > 1 ? `<div class="kart"><p class="not">Bu gösterge bölge düzeyinde de yayımlanmaktadır. Haritada incelemek için yukarıdaki Düzey seçiminden ${t.duzeyler.filter((d) => d !== 'tr').map((d) => DUZEY_AD[d]).join(', ')} seçilebilir.</p></div>` : ''}`;
  }

  function duzeyCiz(t, K) {
    const g = t, y = gs.yil, B = K.birimler, dz = K.duzey;
    const ad = (i) => B[i].a;
    const tek = TEKIL[dz], cogul = COGUL[dz];
    document.querySelectorAll('#g-mod button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === gs.mod));
    document.getElementById('g-taban-k').hidden = gs.mod !== 'degisim';
    document.getElementById('g-yil-lbl').textContent = gs.mod === 'degisim' ? 'Bitiş yılı' : 'Yıl';
    harita.kur(K);
    const a = K.deger(y);
    const tr = K.tr(y);
    const bul = [];
    let renk, etiket, lejant, baslik, alt, seritVeri, seritBicim, seritRef;
    const v = gecerli(a).sort((p, q) => q[0] - p[0]);
    const DO = degerOlcegi(g, a, tr);
    const degerRenk = renkSec(DO.esik, DO.renkler);

    if (!v.length) {
      document.getElementById('g-bulgular').innerHTML = '<div class="kart"><p>Seçilen düzey ve yıl için veri bulunmamaktadır.</p></div>';
      return;
    }
    if (gs.mod === 'degisim') {
      const t0 = gs.taban;
      const a0 = g.nominal ? goreliK(K, t0) : K.deger(t0), a1 = g.nominal ? goreliK(K, y) : a;
      const d = a1.map((x, i) => (x == null || a0[i] == null ? null : x - a0[i]));
      const birim = g.nominal ? 'puan (TR = 100)' : g.birim === '%' ? 'puan' : g.birim;
      const ab = d.filter((x) => x != null).map(Math.abs).sort(d3.ascending);
      const t1 = d3.quantileSorted(ab, 0.25) || 1e-9, t2 = d3.quantileSorted(ab, 0.7) || 2e-9;
      const esik = [-t2, -t1, t1, t2];
      const ikiR = IKI_YONLU[oz.g.iki].r;
      const renkler = g.yon === -1 ? [...ikiR].reverse() : ikiR;
      renk = (i) => renkSec(esik, renkler)(d[i]);
      const dd = g.nominal ? 1 : g.ond;
      etiket = (i) => `<strong>${esc(ad(i))}</strong><br>${t0} → ${y}: ${isr(d[i], dd)} ${esc(birim)}<br><small>${g.nominal ? `göreli düzey ${nf(a0[i], 0)} → ${nf(a1[i], 0)}` : `${dg(g, K.deger(t0)[i])} → ${dg(g, a[i])}`}</small>`;
      lejant = [`< ${isr(-t2, dd)}`, `${isr(-t2, dd)} – ${isr(-t1, dd)}`, 'yaklaşık sabit', `${isr(t1, dd)} – ${isr(t2, dd)}`, `> ${isr(t2, dd)}`].map((x, i) => `<span><i style="background:${renkler[i]}"></i>${x}</span>`).join('') + `<span class="not">${esc(birim)}</span>`;
      baslik = `${g.ad}: ${t0} → ${y} değişimi`;
      alt = g.nominal ? 'TL cinsinden değerler her yıl Türkiye = 100 göreli düzeye çevrilmiştir; renk göreli düzeydeki puan değişimini gösterir.' : `Değişim, ${birim}`;
      const sl = gecerli(d).sort((p, q) => q[0] - p[0]);
      if (sl.length) {
        const b = pearson(a0, d);
        const r0 = sira(a0), r1 = sira(a1);
        const sirDeg = gecerli(r0).map(([x, i]) => [r1[i] == null ? null : x - r1[i], i]).filter(([x]) => x != null).sort((p, q) => q[0] - p[0]);
        bul.push(`<div class="kart vurgulu"><h3>Değişimin özeti</h3><p>${t0}–${y} döneminde ${g.nominal ? 'Türkiye ortalamasına göre göreli düzeyi' : 'değeri'} en çok artan ${tek} <strong>${esc(ad(sl[0][1]))}</strong> (${isr(sl[0][0], dd)}), en çok azalan ${tek} <strong>${esc(ad(sl.at(-1)[1]))}</strong> (${isr(sl.at(-1)[0], dd)}) olmuştur. ${sl.filter(([x]) => x > 0).length} ${tek}de artış, ${sl.filter(([x]) => x < 0).length} ${tek}de azalış görülmüştür.</p>
          <div class="ikili"><div><div class="alt-b">En çok artan</div><div class="liste">${sl.slice(0, 5).map(([x, i]) => `<span>${esc(ad(i))}</span><span>${isr(x, dd)}</span>`).join('')}</div></div>
          <div><div class="alt-b">En çok azalan</div><div class="liste">${sl.slice(-5).reverse().map(([x, i]) => `<span>${esc(ad(i))}</span><span>${isr(x, dd)}</span>`).join('')}</div></div></div></div>`);
        if (b && sl.length >= 10) bul.push(`<div class="kart"><h3>Yakınsama</h3><p>${t0} düzeyi ile sonraki değişim arasındaki ilişki katsayısı <strong>${nf(b.r, 2)}</strong>. ${b.r < -0.3 ? `Başlangıçta düşük düzeyde olan ${cogul} daha çok artmıştır; ${cogul} birbirine yaklaşmaktadır (β-yakınsama).` : b.r > 0.3 ? `Başlangıçta yüksek düzeyde olan ${cogul} daha çok artmıştır; aradaki fark açılmaktadır (ıraksama).` : 'Başlangıç düzeyi ile değişim arasında belirgin bir ilişki bulunmamaktadır.'}</p></div>`);
        bul.push(`<div class="kart"><h3>Sıralamada en çok yer değiştirenler</h3><div class="ikili"><div><div class="alt-b">Yükselen</div><div class="liste">${sirDeg.slice(0, 5).map(([, i]) => `<span>${esc(ad(i))}</span><span>${r0[i]}. → ${r1[i]}.</span>`).join('')}</div></div>
          <div><div class="alt-b">Gerileyen</div><div class="liste">${sirDeg.slice(-5).reverse().map(([, i]) => `<span>${esc(ad(i))}</span><span>${r0[i]}. → ${r1[i]}.</span>`).join('')}</div></div></div></div>`);
      }
      seritVeri = d; seritBicim = (x) => `${isr(x, dd)}`; seritRef = 0;
      const a0h = K.deger(t0);
      sonG = { t, ad: `${g.ad} ${t0}-${y} degisim ${dz}`, satirlar: [['Kod', TEKIL[dz] === 'il' ? 'İl' : 'Birim', `${t0} değeri`, `${y} değeri`, ...(g.nominal ? [`${t0} göreli düzey (TR = 100)`, `${y} göreli düzey (TR = 100)`] : []), `Değişim, ${birim}`],
        ...gecerli(d).sort((p, q) => q[0] - p[0]).map(([x, i]) => [B[i].k, ad(i), a0h[i], a[i], ...(g.nominal ? [yuv(a0[i]), yuv(a1[i])] : []), yuv(x)])] };
    } else {
      const mo = K.komsu ? moranAl(`${g.id}|${dz}|${y}`, a, K.komsu) : null;
      renk = (i) => degerRenk(a[i]);
      lejant = DO.lejant;
      baslik = `${g.ad}, ${y}`;
      alt = `${g.birim ? `${g.birim} · ` : ''}${v.length} ${tek}${tr != null ? ` · Türkiye: ${dg(g, tr)}` : ''}`;
      etiket = (i) => `<strong>${esc(ad(i))}</strong><br>${a[i] == null ? 'veri yok' : dg(g, a[i])}<br><small>${a[i] == null ? '' : `${v.findIndex((x) => x[1] === i) + 1}. sıra / ${v.length}`}${mo?.sinif[i] && mo.sinif[i] !== 'NS' ? ` · ${KUME[mo.sinif[i]][1].toLocaleLowerCase('tr')}` : ''} · ayrıntı için tıklayın</small>`;

      const oran = v.at(-1)[0] > 0 ? v[0][0] / v.at(-1)[0] : null;
      const gi = gini(a), c = cv(a);
      bul.push(`<div class="kart vurgulu"><h3>Özet</h3><div class="sayilar"><div><b>${tr != null ? nf(tr, g.ond) : nf(ort(a), g.ond)}</b><span>${tr != null ? 'Türkiye' : `${tek} ortalaması`}${g.birim ? ` (${esc(g.birim)})` : ''}</span></div>
        <div><b>${oran ? `${nf(oran, 1)} kat` : '–'}</b><span>en yüksek / en düşük</span></div><div><b>${gi != null ? nf(gi, 2) : nf(c, 2)}</b><span>${gi != null ? 'Gini (0 = eşit)' : 'değişim katsayısı'}</span></div></div>
        <p>En yüksek değer <strong>${esc(ad(v[0][1]))}</strong> (${dg(g, v[0][0])}), en düşük değer <strong>${esc(ad(v.at(-1)[1]))}</strong> (${dg(g, v.at(-1)[0])}) ${BULUNMA[dz]}.${tr != null ? ` ${v.filter(([x]) => x > tr).length} ${tek} Türkiye değerinin üzerindedir.` : ''}</p>
        <div class="ikili"><div><div class="alt-b">En yüksek 5</div><div class="liste">${v.slice(0, 5).map(([x, i]) => `<span>${esc(ad(i))}</span><span>${nf(x, g.ond)}</span>`).join('')}</div></div>
        <div><div class="alt-b">En düşük 5</div><div class="liste">${v.slice(-5).reverse().map(([x, i]) => `<span>${esc(ad(i))}</span><span>${nf(x, g.ond)}</span>`).join('')}</div></div></div></div>`);
      if (mo) {
        const hh = mo.sinif.map((s, i) => (s === 'HH' ? i : -1)).filter((i) => i >= 0), ll = mo.sinif.map((s, i) => (s === 'LL' ? i : -1)).filter((i) => i >= 0);
        bul.push(`<div class="kart"><h3>Coğrafi kümelenme</h3><p>Moran I = <strong>${nf(mo.I, 2)}</strong> (p ${mo.p < 0.01 ? '< 0,01' : `= ${nf(mo.p, 2)}`}). ${mo.p >= 0.05 ? `Değerler haritada rastgele dağılmaktadır; komşu ${cogul} birbirine benzememektedir.` : mo.I > 0.5 ? `Güçlü bir coğrafi kümelenme vardır: benzer değerli ${cogul} yan yana yer almaktadır.` : 'Orta düzeyde bir coğrafi kümelenme vardır.'}</p>
          ${hh.length ? `<p><span class="alt-b">Sıcak küme</span><br>${hh.map(ad).join(', ')}</p>` : ''}${ll.length ? `<p><span class="alt-b">Soğuk küme</span><br>${ll.map(ad).join(', ')}</p>` : ''}</div>`);
      } else if (dz !== 'fua') {
        bul.push(`<div class="kart"><p class="not">${DUZEY_AD[dz]} düzeyinde birim sayısı az olduğundan coğrafi kümelenme hesaplanmamaktadır.</p></div>`);
      }
      if (dz === 'il') {
        const bo = V.bolgeler.map((b, k) => [b, ort(a.map((x, i) => (IL[i].b === k ? x : null)))]).filter(([, m]) => m != null).sort((p, q) => q[1] - p[1]);
        const sn = V.oecdSinif.map((s, k) => [s, ort(a.map((x, i) => (IL[i].o === k ? x : null)))]);
        if (bo.length) bul.push(`<div class="kart"><h3>Bölge ve yerleşim farkları</h3><p>Bölge ortalamaları arasında en yüksek <strong>${esc(bo[0][0])}</strong> (${nf(bo[0][1], g.ond)}), en düşük ${esc(bo.at(-1)[0])} (${nf(bo.at(-1)[1], g.ond)}) bölgesidir.
          Ağırlıklı kentsel illerin ortalaması ${nf(sn[0][1], g.ond)}, ağırlıklı kırsal illerin ortalaması ${nf(sn[2][1], g.ond)}${sn[2][1] > 0 && sn[0][1] > 0 ? ` (${nf(sn[0][1] / sn[2][1], 1)} kat)` : ''}.</p>
          <div class="liste">${sn.map(([s, m]) => `<span>${esc(s)}</span><span>${nf(m, g.ond)}</span>`).join('')}</div></div>`);
      }
      const seri = K.yillar.map((yy) => { const aa = K.deger(yy); return [yy, gini(aa) ?? cv(aa)]; }).filter(([, x]) => x != null && isFinite(x));
      if (seri.length >= 3) {
        const ilk = seri[0], son = seri.at(-1);
        const deg = (son[1] - ilk[1]) / ilk[1];
        const Ad = cogul.charAt(0).toLocaleUpperCase('tr') + cogul.slice(1);
        bul.push(`<div class="kart"><h3>${Ad} arası fark zaman içinde</h3><p>${gini(a) != null ? 'Gini katsayısı' : 'Değişim katsayısı'} ${ilk[0]} yılında ${nf(ilk[1], 2)}, ${son[0]} yılında ${nf(son[1], 2)}. ${Math.abs(deg) < 0.05 ? `${Ad} arasındaki fark büyük ölçüde aynı kalmıştır.` : deg < 0 ? `${Ad} arasındaki fark <strong>%${nf(-deg * 100, 0)} daralmıştır</strong>.` : `${Ad} arasındaki fark <strong>%${nf(deg * 100, 0)} açılmıştır</strong>.`}</p>${kivilcim(seri, y)}</div>`);
      }
      seritVeri = a; seritBicim = (x) => dg(g, x); seritRef = tr;
      const sinifNo = (x) => { let k = 0; while (k < DO.esik.length && x >= DO.esik[k]) k++; return k + 1; };
      sonG = { t, ad: `${g.ad} ${y} ${dz}`, satirlar: [['Kod', TEKIL[dz] === 'il' ? 'İl' : 'Birim', 'Yıl', `${g.ad}${g.birim ? ` (${g.birim})` : ''}`, 'Sıra', 'Harita sınıfı'],
        ...v.map(([x, i], k) => [B[i].k, ad(i), y, x, k + 1, sinifNo(x)]), ...(tr != null ? [['TR', 'Türkiye', y, tr, '', '']] : [])] };
    }
    // seçili birim kartı
    if (gs.secili != null && B[gs.secili]) {
      const i = gs.secili;
      const kom = (K.komsu?.[i] ?? []).map((j) => a[j]).filter((x) => x != null);
      bul.unshift(`<div class="kart"><h3>Seçili ${tek}</h3><p><strong>${esc(ad(i))}</strong>: ${a[i] == null ? 'veri yok' : `${dg(g, a[i])} · ${v.findIndex((x) => x[1] === i) + 1}. sıra / ${v.length}`}<br>
        ${kom.length ? `Komşuların ortalaması ${nf(d3.mean(kom), g.ond)}` : ''}${dz === 'il' ? ` · ${esc(V.bolgeler[IL[i].b])} ortalaması ${nf(ort(a.map((x, j) => (IL[j].b === IL[i].b ? x : null))), g.ond)}` : ''}</p>
        <p>${dz === 'il' ? `<button class="bag" type="button" data-yer="${i}">${esc(ad(i))} ilinin bütün göstergelerini aç</button> · ` : ''}<button class="bag" type="button" data-temizle="1">seçimi kaldır</button></p></div>`);
    }
    harita.boya(renk, etiket, (i) => birimSec(i, t, K));
    harita.sec(gs.secili, gs.secili != null ? K.komsu?.[gs.secili] ?? [] : []);
    document.getElementById('g-lejant').innerHTML = lejant;
    basliklariYaz('g', `${gs.id}|${dz}|${gs.mod}`, baslik, alt);
    gOzelGuncelle(gs.mod === 'degisim' ? '' : DO.uyari);
    document.getElementById('g-bulgular').innerHTML = bul.join('');
    // haritanın altı: il düzeyinde bölgelere göre dağılım ya da sıralama; diğer düzeylerde sıralama
    const altDugme = document.querySelector('#g-alt-gorunum [data-k="bolge"]');
    altDugme.hidden = dz !== 'il';
    const altGor = dz === 'il' ? gs.alt : 'sira';
    document.querySelectorAll('#g-alt-gorunum button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === altGor));
    document.getElementById('g-serit-baslik').textContent = altGor === 'bolge' ? 'Coğrafi bölgelere göre dağılım' : `Sıralama: ${v.length} ${tek}`;
    document.getElementById('g-serit-alt').textContent = altGor === 'bolge' ? 'Her nokta bir il · çizgi: bölge ortalaması' : gs.mod === 'degisim' ? 'Değişime göre büyükten küçüğe' : 'Büyükten küçüğe · kesikli çizgi: Türkiye';
    if (altGor === 'bolge') seritCiz(seritVeri, seritBicim, seritRef, renk, B, t, K);
    else siraCiz(seritVeri, seritBicim, seritRef, renk, B, t, K);
    radarGuncelle(t, K, a, tr, degerRenk);
  }

  /* Birim seçimi: haritada vurgulanır, bölge karşılaştırma paneli (radar) açılır */
  function birimSec(i, t, K) {
    if (gs.secili === i) { gs.secili = null; radar.kapat(); } else gs.secili = i;
    gCiz();
  }
  const radar = bolgeRadari({
    ad: (kod) => M.bolgeler[kod]?.ad ?? kod,
    onKapat: () => { if (gs.secili != null) { gs.secili = null; gCiz(); } },
    onSec: (kod) => { const K = katmanlar.get(`${gs.id}|${gs.duzey}`); const i = K?.birimler.findIndex((b) => b.k === kod); if (i >= 0) { gs.secili = i; gCiz(); } },
  });
  let radarNo = 0;
  async function radarGuncelle(t, K, a, tr, degerRenk) {
    if (gs.secili == null || a[gs.secili] == null) return;
    const no = ++radarNo;
    const kod = K.birimler[gs.secili].k;
    let data, trSeri, tipoloji;
    try {
      [data, trSeri, tipoloji] = await Promise.all([kategoriVerisi(t.kat), turkiyeSerisi(t.kat, t.id), K.duzey === 'il' ? ilTipolojisi() : null]);
    } catch (e) {
      if (!ayriliyor) console.error(e);
      return;
    }
    if (no !== radarNo) return;
    const seri = {};
    for (const yy of K.yillar) { const x = data[t.id]?.[yy]?.[kod]; if (x != null) seri[yy] = x; }
    const satirlar = gecerli(a).sort((p, q) => q[0] - p[0]).map(([x, i]) => ({ kod: K.birimler[i].k, ad: K.birimler[i].a, deger: x }));
    const geo = { type: 'FeatureCollection', features: K.geo.features };
    radar.ac({ kod, duzey: K.duzey, g: { ...t.m, ad: t.m.ad, ondalik: t.ond, birim: t.birim }, yil: gs.yil, satirlar, tr, geo, olcek: degerRenk, seri, trSeri, tipoloji });
  }

  document.getElementById('g-bulgular').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.git) { gs.mod = b.dataset.git; gCiz(); }
    if (b.dataset.temizle) { gs.secili = null; radar.kapat(); gCiz(); }
    if (b.dataset.yer != null) { ys.il = +b.dataset.yer; radar.kapat(); sekmeAc('yer'); }
  });

  function kivilcim(seri, vurguYil) {
    const W = 300, H = 56, m = 6;
    const x = d3.scaleLinear().domain(d3.extent(seri, (d) => d[0])).range([m, W - m - 34]);
    const y = d3.scaleLinear().domain(d3.extent(seri, (d) => d[1])).nice().range([H - 14, 6]);
    const yol = d3.line().x((d) => x(d[0])).y((d) => y(d[1]))(seri);
    const son = seri.at(-1);
    return `<svg viewBox="0 0 ${W} ${H}" style="max-width:320px"><path d="${yol}" fill="none" stroke="var(--vurgu)" stroke-width="2"/>
      ${seri.map((d) => `<circle cx="${x(d[0])}" cy="${y(d[1])}" r="${d[0] === vurguYil ? 3.5 : 2}" fill="${d[0] === vurguYil ? 'var(--metin)' : 'var(--vurgu)'}"/>`).join('')}
      <text class="ek" x="${x(seri[0][0])}" y="${H - 2}">${seri[0][0]}</text><text class="ek" x="${x(son[0])}" y="${H - 2}" text-anchor="end">${son[0]}</text>
      <text class="ek" x="${x(son[0]) + 6}" y="${y(son[1]) + 3}">${nf(son[1], 2)}</text></svg>`;
  }

  function seritCiz(a, bicim, ref, renk, B) {
    const W = Math.max(340, Math.round(seritKap.clientWidth || 760)), dar = W < 560, satir = 26, m = { l: dar ? 118 : 142, r: 16, t: 6, b: 24 };
    const H = m.t + satir * V.bolgeler.length + m.b;
    seritSvg.attr('viewBox', `0 0 ${W} ${H}`);
    seritSvg.selectAll('*').remove();
    const v = gecerli(a);
    if (!v.length) return;
    const x = d3.scaleLinear().domain(d3.extent(v, (d) => d[0])).nice().range([m.l, W - m.r]);
    const gx = seritSvg.append('g').attr('class', 'eksen');
    const xt = x.ticks(dar ? 4 : 6), fb = tikB(xt);
    xt.forEach((t) => { gx.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b); gx.append('text').attr('x', x(t)).attr('y', H - 8).attr('text-anchor', 'middle').text(fb(t)); });
    if (ref != null && isFinite(ref)) { const r = seritSvg.append('g').attr('class', 'ref'); r.append('line').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', m.t).attr('y2', H - m.b); }
    V.bolgeler.forEach((b, k) => {
      const yc = m.t + satir * k + satir / 2;
      seritSvg.append('text').attr('x', m.l - 10).attr('y', yc + 4).attr('text-anchor', 'end').attr('font-size', dar ? 12 : 13).text(dar ? b.replace('Güneydoğu Anadolu', 'Güneydoğu A.') : b);
      const mm = ort(a.map((x2, i) => (IL[i].b === k ? x2 : null)));
      if (mm != null) seritSvg.append('line').attr('x1', x(mm)).attr('x2', x(mm)).attr('y1', yc - 9).attr('y2', yc + 9).attr('stroke', 'var(--metin)').attr('stroke-width', 2);
    });
    const ip = seritKap.querySelector('.ipucu');
    seritSvg.selectAll('circle').data(v).join('circle')
      .attr('cx', (d) => x(d[0])).attr('cy', (d) => m.t + satir * IL[d[1]].b + satir / 2).attr('r', (d) => (d[1] === gs.secili ? 6 : 4.5))
      .attr('fill', (d) => renk(d[1])).attr('stroke', (d) => (d[1] === gs.secili ? 'var(--secili)' : 'var(--ikincil)')).attr('stroke-width', (d) => (d[1] === gs.secili ? 2 : 0.6)).attr('stroke-opacity', 0.9)
      .style('cursor', 'pointer')
      .on('pointermove', (ev, d) => { ip.innerHTML = `<strong>${esc(B[d[1]].a)}</strong><br>${bicim(d[0])}`; konum(seritKap, ip, ev); })
      .on('pointerleave', () => (ip.style.opacity = 0))
      .on('click', (ev, d) => { gs.secili = gs.secili === d[1] ? null : d[1]; gCiz(); });
  }

  /* Sıralama: bütün birimler büyükten küçüğe yatay çubuklar */
  function siraCiz(a, bicim, ref, renk, B) {
    const v = gecerli(a).sort((p, q) => q[0] - p[0]);
    const W = Math.max(340, Math.round(seritKap.clientWidth || 760)), dar = W < 560;
    const satir = 15, m = { l: dar ? 130 : 230, r: 64, t: 4, b: 22 };
    const H = m.t + satir * v.length + m.b;
    seritSvg.attr('viewBox', `0 0 ${W} ${H}`);
    seritSvg.selectAll('*').remove();
    if (!v.length) return;
    const lo = Math.min(0, d3.min(v, (d) => d[0])), hi = Math.max(0, v[0][0]);
    const x = d3.scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).nice().range([m.l, W - m.r]);
    const gx = seritSvg.append('g').attr('class', 'eksen');
    const xt = x.ticks(dar ? 3 : 6), fb = tikB(xt);
    xt.forEach((t) => { gx.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b); gx.append('text').attr('x', x(t)).attr('y', H - 6).attr('text-anchor', 'middle').text(fb(t)); });
    const kisalt = (s) => { const n = dar ? 20 : 34; return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
    const ip = seritKap.querySelector('.ipucu');
    const g = seritSvg.append('g').selectAll('g').data(v).join('g').attr('transform', (d, k) => `translate(0,${m.t + k * satir})`).style('cursor', 'pointer')
      .on('pointermove', (ev, d) => { ip.innerHTML = `<strong>${esc(B[d[1]].a)}</strong><br>${bicim(d[0])}`; konum(seritKap, ip, ev); })
      .on('pointerleave', () => (ip.style.opacity = 0))
      .on('click', (ev, d) => { gs.secili = gs.secili === d[1] ? null : d[1]; gCiz(); });
    g.append('text').attr('x', m.l - 6).attr('y', satir / 2 + 4).attr('text-anchor', 'end').attr('font-size', 11.5)
      .style('font-weight', (d) => (d[1] === gs.secili ? 700 : 400)).text((d, k) => `${k + 1}. ${kisalt(B[d[1]].a)}`);
    g.append('rect').attr('x', (d) => Math.min(x(0), x(d[0]))).attr('width', (d) => Math.max(1, Math.abs(x(d[0]) - x(0)))).attr('y', 2).attr('height', satir - 4).attr('rx', 2)
      .attr('fill', (d) => renk(d[1])).attr('stroke', (d) => (d[1] === gs.secili ? 'var(--secili)' : 'none')).attr('stroke-width', 1.5);
    g.append('text').attr('class', 'ek').attr('x', (d) => Math.max(x(0), x(d[0])) + 4).attr('y', satir / 2 + 3.5).text((d) => bicim(d[0]));
    if (ref != null && isFinite(ref)) { const r = seritSvg.append('g').attr('class', 'ref'); r.append('line').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', m.t).attr('y2', H - m.b); }
  }

  /* ================= İLİŞKİ ================= */
  // İki eksen her zaman aynı düzeydedir: il (81) ya da Düzey 2 (26 bölge). Yalnızca Düzey 2'de yayımlanan bir gösterge
  // seçilirse ekran Düzey 2'ye geçer; Düzey 2'de karşılığı olmayan bir gösterge varsa yerine varsayılan konur.
  const is = { y: 'dogurganlik', x: 'kadinuni', yil: null, renk: 'bolge', olcek: 'dog', duzey: 'il', not: '', boyut: 'nufus', capraz: true };
  const IDZ = {
    il: { n: N, tek: 'il', cogul: 'iller', yer: 'illerde', Cogul: 'İller', sayi: '81 il', varsayY: 'dogurganlik', varsayX: 'kadinuni' },
    d2: { n: N2, tek: 'bölge', cogul: 'bölgeler', yer: 'bölgelerde', Cogul: 'Bölgeler', sayi: '26 Düzey 2 bölgesi', varsayY: 'istihdam', varsayX: 'kadinuni' },
  };
  const var_ = (g, dz) => (dz === 'il' ? g.yillar.length > 0 : !!g.d2);
  const yilDz = (g, dz) => (dz === 'il' ? g.yillar : g.d2?.yillar ?? []);
  const degerDz = (g, y, dz) => (dz === 'il' ? deger(g, y) : (g.d2?.deger[y] || Array(N2).fill(null)));
  const ortakDz = (a, b, dz) => yilDz(a, dz).filter((y) => yilDz(b, dz).includes(y));
  const birimAd = (i, dz) => (dz === 'il' ? IL[i].a : `${B2[i].k}, ${B2[i].a}`);
  // Düzey 2 etiketi: bölge kodu ve kapsadığı iller (ör. "TR42, Kocaeli, Sakarya, Düzce, Bolu, Yalova")
  const birimKisa = (i, dz) => (dz === 'il' ? IL[i].a : `${B2[i].k}, ${B2[i].a}`);
  const birimBolge = (i, dz) => (dz === 'il' ? IL[i].b : B2[i].b);
  // korelasyonun anlamlılığı (Fisher z dönüşümü, iki yönlü)
  const phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const q = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - q : q; };
  const rAnlam = (r, n) => (n > 3 && Math.abs(r) < 1 ? 2 * (1 - phi(Math.abs(Math.atanh(r)) * Math.sqrt(n - 3))) : 0);
  const rEsik = (n) => Math.tanh(1.96 / Math.sqrt(n - 3));

  const iYil = document.getElementById('i-yil');
  const tema = (g) => { const kat = M.gostergeById.get(g.id)?.kategori ?? g.kat; const u = ustBul(USTLER, kat); return { kat, u }; };
  function iOgeler(dz) {
    return GA.filter((g) => dz === 'il' || g.d2).map((g) => {
      const { kat, u } = tema(g);
      return { id: g.k, ad: g.ad, tema: u?.id ?? 'diger', alt: u && u.kats.length > 1 ? kat : null, konu: null, isaret: false,
        etiket: dz === 'il' && !g.yillar.length ? 'Yalnız Düzey 2' : null, _s: USTLER.indexOf(u) };
    }).sort((a, b) => a._s - b._s);
  }
  const iTemalar = (o) => TEMALAR.filter((t) => o.some((x) => x.tema === t.id));
  const ilkO = iOgeler('il');
  const iYS = gostergeSecici(document.getElementById('i-y'), { ogeler: ilkO, temalar: iTemalar(ilkO), deger: is.y, etiket: 'Dikey eksen göstergesi', isaretNotu: '', onSec: (k) => { is.y = k; eksenDegisti(k); } });
  const iXS = gostergeSecici(document.getElementById('i-x'), { ogeler: ilkO, temalar: iTemalar(ilkO), deger: is.x, etiket: 'Yatay eksen göstergesi', isaretNotu: '', onSec: (k) => { is.x = k; eksenDegisti(k); } });
  const iDuzeyEl = document.getElementById('i-duzey');
  function duzeyAyarla(dz, not = '') {
    is.duzey = dz; is.not = not;
    iDuzeyEl?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === dz));
    const o = iOgeler(dz);
    iYS.yenile(o, iTemalar(o)); iXS.yenile(o, iTemalar(o));
    const oecd = document.querySelector('#i-renk [data-k="oecd"]');
    if (oecd) { oecd.disabled = dz === 'd2'; oecd.title = dz === 'd2' ? 'Kentsel–kırsal sınıflaması il düzeyinde tanımlıdır' : ''; }
    if (dz === 'd2' && is.renk === 'oecd') { is.renk = 'bolge'; document.querySelectorAll('#i-renk button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === 'bolge')); }
  }
  // seçilen gösterge mevcut düzeyde yoksa: il → Düzey 2'ye geç
  function eksenDegisti(k) {
    const g = GK.get(k);
    if (is.duzey === 'il' && !var_(g, 'il')) {
      const diger = GK.get(k === is.y ? is.x : is.y);
      let not = `${g.ad} il düzeyinde yayımlanmadığından karşılaştırma Düzey 2 bölgeleri üzerinden yapılmaktadır.`;
      if (!var_(diger, 'd2')) {
        const yeni = k === is.y ? (is.x = IDZ.d2.varsayX) : (is.y = k === IDZ.d2.varsayY ? 'gsyh' : IDZ.d2.varsayY);
        not += ` ${diger.ad} Düzey 2'de bulunmadığından yerine ${GK.get(yeni).ad.toLocaleLowerCase('tr')} seçilmiştir.`;
      }
      duzeyAyarla('d2', not);
    } else is.not = '';
    iCiz();
  }
  iDuzeyEl?.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.dataset.k === is.duzey) return;
    const dz = b.dataset.k, D = IDZ[dz];
    const deg = [];
    if (!var_(GK.get(is.y), dz)) { deg.push(GK.get(is.y).ad); is.y = is.x === D.varsayY ? 'gsyh' : D.varsayY; }
    if (!var_(GK.get(is.x), dz)) { deg.push(GK.get(is.x).ad); is.x = is.y === D.varsayX ? 'gsyh' : D.varsayX; }
    duzeyAyarla(dz, deg.length ? `${deg.join(' ve ')} ${dz === 'il' ? 'il düzeyinde' : 'Düzey 2\'de'} yayımlanmadığından yerine varsayılan gösterge seçilmiştir.` : '');
    iCiz();
  });
  const iKap = document.getElementById('i-grafik');
  const iSvg = d3.select(iKap).append('svg');
  iYil.addEventListener('change', () => { is.yil = +iYil.value; iCiz(true); });
  dilim(document.getElementById('i-renk'), (k) => { is.renk = k; iCiz(true); });
  dilim(document.getElementById('i-olcek'), (k) => { is.olcek = k; iCiz(true); });
  // üçüncü boyut: balon büyüklüğü (yalnız toplam/mutlak göstergeler) ve Türkiye ortalaması çizgileri
  const BOY = V.boyutlar ?? [], BOYK = new Map(BOY.map((b) => [b.k, b]));
  const iBoyut = document.getElementById('i-boyut');
  if (iBoyut) {
    iBoyut.innerHTML = '<option value="">Yok (eşit büyüklük)</option>' + BOY.map((b) => `<option value="${b.k}"${b.k === is.boyut ? ' selected' : ''}>${esc(b.ad)}</option>`).join('');
    iBoyut.addEventListener('change', () => { is.boyut = iBoyut.value; iCiz(true); });
  }
  const iCapraz = document.getElementById('i-capraz');
  if (iCapraz) dilim(iCapraz, (k) => { is.capraz = k === 'acik'; iCiz(true); });
  // seçilen yıl için büyüklük değerleri; o yıl yoksa en yakın önceki (yoksa sonraki) yıl
  // büyüklük değerlerinin okunur biçimi: "bin TL" → TL; milyar/milyon/bin kısaltması
  function buyukluk(v, birim) {
    let b = birim, x = v;
    if (/^bin /.test(b)) { x = v * 1000; b = b.slice(4); }
    const [d, e] = x >= 1e12 ? [1e12, ' trilyon'] : x >= 1e9 ? [1e9, ' milyar'] : x >= 1e6 ? [1e6, ' milyon'] : x >= 1e4 ? [1e3, ' bin'] : [1, ''];
    return `${nf(x / d, x / d < 10 && d > 1 ? 1 : 0)}${e} ${b}`;
  }
  function boyutDegeri(dz, yil) {
    const b = BOYK.get(is.boyut); if (!b) return null;
    const tab = b[dz] ?? {}; const ys = Object.keys(tab).map(Number).sort((p1, p2) => p1 - p2);
    if (!ys.length) return null;
    const y = [...ys].reverse().find((v) => v <= yil) ?? ys[0];
    return { b, y, a: tab[y] };
  }

  function iCiz(yilKoru = false) {
    const dz = is.duzey, D = IDZ[dz];
    const gy = GK.get(is.y), gx = GK.get(is.x);
    iYS.deger(is.y); iXS.deger(is.x);
    const yillar = ortakDz(gx, gy, dz);
    if (!yilKoru || !yillar.includes(is.yil)) is.yil = yillar.at(-1);
    iYil.innerHTML = yillar.map((y) => `<option${y === is.yil ? ' selected' : ''}>${y}</option>`).join('');
    const bul = [];
    const notKart = is.not ? `<div class="kart"><p class="not">${esc(is.not)}</p></div>` : '';
    if (!yillar.length || is.x === is.y) {
      iSvg.selectAll('*').remove();
      document.getElementById('i-bulgular').innerHTML = notKart + `<div class="kart"><p>${is.x === is.y ? 'İki farklı gösterge seçin.' : 'Bu iki göstergenin ortak yılı bulunmamaktadır.'}</p></div>`;
      return;
    }
    const xs = degerDz(gx, is.yil, dz), ysv = degerDz(gy, is.yil, dz);
    const logOk = is.olcek === 'log' && d3.min(xs.filter((v) => v != null)) > 0;
    const tx = (v) => (logOk ? Math.log10(v) : v);
    const nok = xs.map((v, i) => [v, ysv[i], i]).filter(([a, b]) => a != null && b != null);
    const W = 760, H = 470, m = { l: 52, r: 18, t: 22, b: 44 };
    iSvg.attr('viewBox', `0 0 ${W} ${H}`); iSvg.selectAll('*').remove();
    const x = (logOk ? d3.scaleLog() : d3.scaleLinear()).domain(d3.extent(nok, (d) => d[0])).nice().range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(d3.extent(nok, (d) => d[1])).nice().range([H - m.b, m.t]);
    const ge = iSvg.append('g').attr('class', 'eksen');
    const xt = logOk ? x.ticks(5).filter((t) => [1, 2, 5].includes(+String(t)[0])) : x.ticks(7), fx = logOk ? (v) => nf(v) : tikB(xt);
    xt.forEach((t) => { ge.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b); ge.append('text').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').text(fx(t)); });
    const yt = y.ticks(6), fy = tikB(yt);
    yt.forEach((t) => { ge.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)); ge.append('text').attr('x', m.l - 6).attr('y', y(t) + 3.5).attr('text-anchor', 'end').text(fy(t)); });
    iSvg.append('text').attr('class', 'ek').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text(`${gx.ad} (${gx.birim}${logOk ? ', log' : ''}) →`);
    iSvg.append('text').attr('class', 'ek').attr('x', m.l).attr('y', m.t - 8).text(`↑ ${gy.ad} (${gy.birim})`);
    const p = pearson(nok.map((d) => tx(d[0])), nok.map((d) => d[1]));
    const sp = spearman(xs, ysv);
    const dom = x.domain();
    const xd = d3.range(0, 41).map((k) => (logOk ? 10 ** (Math.log10(dom[0]) + (k / 40) * (Math.log10(dom[1]) - Math.log10(dom[0]))) : dom[0] + (k / 40) * (dom[1] - dom[0])));
    iSvg.append('path').attr('d', d3.line()(xd.map((v) => [x(v), y(p.kes + p.egim * tx(v))]).filter(([, yy]) => yy >= m.t && yy <= H - m.b)))
      .attr('fill', 'none').attr('stroke', 'var(--metin)').attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4');
    const art = nok.map(([a, b, i]) => [b - (p.kes + p.egim * tx(a)), i]);
    const sd = d3.deviation(art, (d) => d[0]);
    const uc = [...art].sort((a, b) => Math.abs(b[0]) - Math.abs(a[0])).slice(0, dz === 'il' ? 6 : 5);
    const ucSet = new Set(uc.map((d) => d[1]));
    const NP = NOKTA_PALET[oz.i.palet] ?? NOKTA_PALET.platform, bR = NP.bolge ?? BOLGE_RENK, oR = NP.oecd ?? OECD_RENK;
    const renk = (i) => NP.tek ?? (is.renk === 'bolge' || dz === 'd2' ? bR[birimBolge(i, dz)] : oR[IL[i].o] ?? '#999');
    const ip = iKap.querySelector('.ipucu');
    // Türkiye değerlerinden geçen çizgiler ve dört bölgedeki birim sayıları
    const trDz = (g) => (dz === 'il' ? g.tr?.[is.yil] : g.d2?.tr?.[is.yil]) ?? null;
    const trx = trDz(gx), trY = trDz(gy);
    let ceyrek = null;
    if (is.capraz && trx != null && trY != null) {
      const cx0 = x(trx), cy0 = y(trY);
      const cz = iSvg.append('g').attr('class', 'capraz');
      if (cx0 >= m.l && cx0 <= W - m.r) cz.append('line').attr('x1', cx0).attr('x2', cx0).attr('y1', m.t).attr('y2', H - m.b);
      if (cy0 >= m.t && cy0 <= H - m.b) cz.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', cy0).attr('y2', cy0);
      cz.append('text').attr('x', Math.min(Math.max(cx0, m.l), W - m.r) + 4).attr('y', m.t + 10).text('Türkiye');
      ceyrek = { us: 0, ua: 0, as: 0, aa: 0 };
      nok.forEach(([a, b]) => { ceyrek[(b >= trY ? 'u' : 'a') + (a >= trx ? 's' : 'a')]++; });
      const k4 = [['us', W - m.r - 6, m.t + 24, 'end'], ['ua', m.l + 6, m.t + 24, 'start'], ['as', W - m.r - 6, H - m.b - 8, 'end'], ['aa', m.l + 6, H - m.b - 8, 'start']];
      cz.selectAll('text.ceyrek').data(k4).join('text').attr('class', 'ceyrek').attr('x', (d) => d[1]).attr('y', (d) => d[2]).attr('text-anchor', (d) => d[3]).text((d) => `${ceyrek[d[0]]} ${D.tek}`);
    }
    // balon büyüklüğü: alan değerle orantılı (karekök ölçek)
    const BD = boyutDegeri(dz, is.yil);
    const rMax = dz === 'il' ? 26 : 32, rSabit = dz === 'il' ? 6 : 7.5;
    const bMax = BD ? d3.max(BD.a.filter((v) => v != null)) : 0;
    const yaricap = (i) => { if (!BD || !bMax) return rSabit; const v = BD.a[i]; return v == null ? 3 : Math.max(2.5, Math.sqrt(v / bMax) * rMax); };
    const sirali = [...nok].sort((p1, p2) => yaricap(p2[2]) - yaricap(p1[2]));
    iSvg.append('g').selectAll('circle').data(sirali).join('circle').attr('cx', (d) => x(d[0])).attr('cy', (d) => y(d[1])).attr('r', (d) => yaricap(d[2]))
      .attr('fill', (d) => renk(d[2])).attr('fill-opacity', BD ? 0.72 : 0.9).attr('stroke', (d) => (BD ? renk(d[2]) : 'var(--zemin)')).attr('stroke-width', BD ? 1 : 1.2).style('cursor', dz === 'il' ? 'pointer' : 'default')
      .on('pointermove', (ev, d) => { ip.innerHTML = `<strong>${esc(birimAd(d[2], dz))}</strong>${dz === 'd2' ? `<br><small>Düzey 1: ${esc(B2[d[2]].d1)}</small>` : ''}<br>${esc(gx.ad)}: ${dg(gx, d[0])}<br>${esc(gy.ad)}: ${dg(gy, d[1])}${BD && BD.a[d[2]] != null ? `<br><small>${esc(BD.b.ad)}: ${buyukluk(BD.a[d[2]], BD.b.birim)} (${BD.y})</small>` : ''}`; konum(iKap, ip, ev); })
      .on('pointerleave', () => (ip.style.opacity = 0))
      .on('click', (ev, d) => { if (dz === 'il') { ys.il = d[2]; sekmeAc('yer'); } });
    // il düzeyinde yalnız genel eğilimden en çok ayrışanlar; Düzey 2'de ayrışanlar (kalın) ve çakışmadan yerleşebilen
    // diğer bölgeler adlandırılır. Yerleşim: önce sağ, sonra sol; dolu alanla çakışan etiket atlanır.
    const fs = dz === 'il' ? 12.5 : 11.5;
    const aday = dz === 'il' ? nok.filter((d) => ucSet.has(d[2])) : [...nok].sort((p1, p2) => (ucSet.has(p2[2]) - ucSet.has(p1[2])) || (Math.abs(p2[0] - d3.mean(nok, (q) => q[0])) - Math.abs(p1[0] - d3.mean(nok, (q) => q[0]))));
    const dolu = nok.map((d) => { const r = Math.min(yaricap(d[2]), 10); return [x(d[0]) - r, y(d[1]) - r, x(d[0]) + r, y(d[1]) + r]; });
    const cak = (r) => dolu.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
    const yerlesen = [];
    for (const d of aday) {
      const t = birimKisa(d[2], dz), w = t.length * fs * 0.52, cx = x(d[0]), cy = y(d[1]);
      const ro = Math.max(10, Math.min(yaricap(d[2]), 18) + 4);
      const sec = [[cx + ro, 'start', [cx + ro, cy - 8, cx + ro + w, cy + 6]], [cx - ro, 'end', [cx - ro - w, cy - 8, cx - ro, cy + 6]]]
        .filter(([, , r]) => r[0] >= 0 && r[2] <= W).find(([, , r]) => !cak(r));
      if (!sec && !ucSet.has(d[2])) continue;
      const [lx, an, r] = sec ?? [cx + ro, 'start', [cx + ro, cy - 8, cx + ro + w, cy + 6]];
      dolu.push(r); yerlesen.push({ d, t, lx, an });
    }
    iSvg.append('g').selectAll('text').data(yerlesen).join('text')
      .attr('x', (o) => o.lx).attr('y', (o) => y(o.d[1]) + 4).attr('text-anchor', (o) => o.an)
      .attr('font-size', fs).attr('font-weight', (o) => (ucSet.has(o.d[2]) ? 600 : 400)).style('fill', (o) => (ucSet.has(o.d[2]) ? 'var(--metin)' : 'var(--ikincil)'))
      .style('paint-order', 'stroke').style('stroke', 'var(--zemin)').style('stroke-width', '3px').text((o) => o.t);
    document.getElementById('i-lejant').innerHTML = (NP.tek ? [`<span><i class="yuvarlak" style="background:${NP.tek}"></i>${D.Cogul}</span>`] : is.renk === 'bolge' || dz === 'd2' ? V.bolgeler.map((b, k) => `<span><i class="yuvarlak" style="background:${bR[k]}"></i>${b}</span>`) : V.oecdSinif.map((s2, k) => `<span><i class="yuvarlak" style="background:${oR[k]}"></i>${s2}</span>`)).join('')
      + (BD && bMax ? (() => { const ref = [bMax, bMax / 4, bMax / 16].map((v) => +v.toPrecision(1)); return `<span class="boyut-lejant"><svg width="${rMax * 2 + 4}" height="${rMax * 2 + 4}" aria-hidden="true">${ref.map((v) => { const r = Math.sqrt(v / bMax) * rMax; return `<circle cx="${rMax + 2}" cy="${rMax * 2 + 2 - r}" r="${r}"/>`; }).join('')}</svg><span class="bl-metin">Balon büyüklüğü: ${esc(BD.b.ad)} (${BD.y})<br><small>Halkalar: ${ref.map((v) => buyukluk(v, BD.b.birim)).join(' · ')}</small></span></span>`; })() : '')
      + `<span class="not">kesikli çizgi: genel eğilim${is.capraz && ceyrek ? ' · ince çizgiler: Türkiye değeri' : ''}${dz === 'd2' ? ' · renk: bölgedeki illerin çoğunun bulunduğu coğrafi bölge' : ''}</span>`;
    basliklariYaz('i', `${is.y}|${is.x}|${dz}`, `${gy.ad} ve ${gx.ad.toLocaleLowerCase('tr')}`, dz === 'il'
      ? `81 il · ${is.yil} · adı yazılan iller genel eğilimden en çok ayrışanlardır`
      : `26 Düzey 2 bölgesi · ${is.yil} · koyu yazılan bölgeler genel eğilimden en çok ayrışanlardır; bütün bölgelerin değerleri için noktaların üzerine gelin`);
    const artik = new Map(art.map(([r0, i]) => [i, r0]));
    sonI = { gx, gy, ad: `iliski ${dz} ${is.yil} ${gy.ad} ${gx.ad}`, satirlar: [['Kod', dz === 'il' ? 'İl' : 'Düzey 2 bölgesi', 'Coğrafi bölge', 'Yıl', `${gx.ad} (${gx.birim})`, `${gy.ad} (${gy.birim})`, ...(BD ? [`${BD.b.ad} (${BD.b.birim}, ${BD.y})`] : []), 'Eğilimden sapma'],
      ...nok.map(([a0, b0, i]) => [dz === 'il' ? IL[i].k : B2[i].k, dz === 'il' ? IL[i].a : B2[i].a, V.bolgeler[birimBolge(i, dz)] ?? '', is.yil, a0, b0, ...(BD ? [BD.a[i] ?? ''] : []), +artik.get(i).toFixed(6)]),
      ...(trx != null && trY != null ? [['TR', 'Türkiye', '', is.yil, trx, trY, ...(BD ? [''] : []), '']] : [])] };
    const kk = (g) => esc(g.ad.toLocaleLowerCase('tr'));
    const a = Math.abs(p.r);
    const pd = rAnlam(p.r, p.n);
    const anlamli = pd < 0.05;
    const guc = !anlamli ? null : a >= 0.7 ? 'Güçlü' : a >= 0.4 ? 'Orta düzeyde' : 'Zayıf';
    const yon = p.r > 0 ? 'aynı yönlü' : 'ters yönlü';
    const pay = Math.round(p.r * p.r * 100);
    const payMetni = pay >= 50 ? 'büyük bölümü' : pay >= 25 ? 'önemli bir kısmı' : pay >= 10 ? 'sınırlı bir kısmı' : 'çok küçük bir kısmı';
    bul.push(notKart + `<div class="kart vurgulu"><h3>İlişkinin değerlendirmesi</h3>
      <div class="iliski-guc">${guc ? `${guc}, ${yon} ilişki` : 'Belirgin bir ilişki bulunmamaktadır'}</div>
      <p>${guc
        ? `${is.yil} yılı verilerine göre ${kk(gx)} yüksek olan ${D.yer} ${kk(gy)} genel olarak ${p.r > 0 ? 'yüksek' : 'düşük'} seyretmektedir. ${D.Cogul} arasında bu göstergede görülen farklılıkların ${payMetni} (yaklaşık yüzde ${pay}) yatay eksendeki gösterge ile birlikte değişmektedir.`
        : `${is.yil} yılı verilerine göre ${kk(gx)} ile ${kk(gy)} arasında ${D.cogul} düzeyinde tutarlı bir birlikte değişim gözlenmemektedir.${a >= 0.2 ? ` Hesaplanan katsayı (${nf(p.r, 2)}), ${p.n} gözlem için istatistiksel olarak anlamlı kabul edilen ${nf(rEsik(p.n), 2)} eşiğinin altında kalmaktadır.` : ''}`}${logOk ? ' Yatay eksen logaritmik ölçekte gösterilmektedir.' : ''}</p>
      ${dz === 'd2' ? `<p class="not">Düzey 2 bölgeleri birden fazla ili kapsadığından gözlem sayısı 26 ile sınırlıdır; bu nedenle ilişkinin anlamlı sayılması için katsayının mutlak değerce yaklaşık ${nf(rEsik(p.n), 2)} düzeyini aşması gerekmektedir. Bölge ortalamaları arasında görülen ilişki, il ya da birey düzeyinde aynı biçimde geçerli olmayabilir.</p>` : ''}
      <p class="not">Bu değerlendirme iki gösterge arasında bir neden-sonuç bağı bulunduğunu göstermemektedir. Her iki gösterge de kentleşme düzeyi ve nüfusun yaş yapısı gibi ortak etkenlerden etkilenebilmektedir.</p>
      <p class="teknik">Teknik ayrıntı: Pearson r = ${nf(p.r, 2)} (p ${pd < 0.001 ? '< 0,001' : `= ${nf(pd, 3)}`}) · Spearman ρ = ${nf(sp.r, 2)} · R² = ${nf(p.r * p.r, 2)} · ${p.n} ${D.tek}${[gx, gy].filter((g) => g.turetilmis).map((g) => `<br>${esc(g.ad)}: Hesaplama: Platform (${esc(g.turetilmis)})`).join('')}</p></div>`);
    const derece = (z) => (Math.abs(z) >= 2.5 ? 'belirgin biçimde' : 'kısmen');
    bul.push(`<div class="kart"><h3>Genel eğilimden ayrışan ${D.cogul}</h3><p class="not">${esc(gx.ad)} düzeyine göre beklenenin üzerinde ya da altında ${kk(gy)} değerine sahip ${D.cogul}</p>
      <div class="liste">${uc.map(([r, i]) => `<span>${esc(birimAd(i, dz))}</span><span>${derece(r / sd)} ${r > 0 ? 'beklenenin üzerinde' : 'beklenenin altında'}</span>`).join('')}</div></div>`);
    if (ceyrek) {
      bul.push(`<div class="kart"><h3>Türkiye değerine göre konum</h3><p class="not">${is.yil} · Türkiye: ${esc(gx.ad)} ${dg(gx, trx)}, ${esc(gy.ad)} ${dg(gy, trY)}</p>
        <div class="liste"><span>Her iki göstergede Türkiye değerinin üzerinde</span><span>${ceyrek.us} ${D.tek}</span>
        <span>Yalnız ${kk(gy)} Türkiye değerinin üzerinde</span><span>${ceyrek.ua} ${D.tek}</span>
        <span>Yalnız ${kk(gx)} Türkiye değerinin üzerinde</span><span>${ceyrek.as} ${D.tek}</span>
        <span>Her iki göstergede Türkiye değerinin altında</span><span>${ceyrek.aa} ${D.tek}</span></div></div>`);
    }
    const liste = GA.filter((g) => g.k !== is.y && var_(g, dz)).map((g) => { const yy = ortakDz(g, gy, dz).at(-1); if (!yy) return null; const s2 = spearman(degerDz(g, yy, dz), degerDz(gy, yy, dz)); return s2 ? { g, r: s2.r, yy } : null; })
      .filter((o) => o && Math.abs(o.r) < 0.97 && rAnlam(o.r, D.n) < 0.05).sort((a2, b2) => Math.abs(b2.r) - Math.abs(a2.r)).slice(0, 10);
    const gucK = (r) => { const v = Math.abs(r); return v >= 0.7 ? 'güçlü' : v >= 0.4 ? 'orta' : 'zayıf'; };
    bul.push(`<div class="kart"><h3>${esc(gy.ad)} ile birlikte en çok değişen göstergeler</h3><p class="not">${D.Cogul}in iki göstergedeki sıralamalarının benzerliğine göre · aynı içeriği tekrar eden göstergeler listelenmez · seçilen gösterge yatay eksene alınır</p>
      <div class="iliskiler">${liste.length ? liste.map((o) => `<button type="button" data-x="${o.g.k}"><span>${esc(o.g.ad)}</span><span class="cubuk${o.r < 0 ? ' eksi' : ''}" style="width:${Math.abs(o.r) * 54}px"></span><span class="r">${gucK(o.r)}, ${o.r > 0 ? 'aynı' : 'ters'}</span></button>`).join('') : '<p class="not">Anlamlı düzeyde birlikte değişen gösterge bulunamamıştır.</p>'}</div></div>`);
    document.getElementById('i-bulgular').innerHTML = bul.join('');
  }
  document.getElementById('i-bulgular').addEventListener('click', (e) => { const b = e.target.closest('button[data-x]'); if (b) { is.x = b.dataset.x; is.not = ''; iCiz(); } });

  /* ================= YER ================= */
  const ys = { il: IL.findIndex((i) => i.a === 'Ankara') };
  const yIl = document.getElementById('y-il');
  yIl.innerHTML = IL.map((il, i) => [il.a, i]).sort((a, b) => a[0].localeCompare(b[0], 'tr')).map(([a, i]) => `<option value="${i}">${esc(a)}</option>`).join('');
  yIl.addEventListener('change', () => { ys.il = +yIl.value; yCiz(); });

  function yCiz() {
    const i = ys.il;
    yIl.value = i;
    document.getElementById('y-baslik').textContent = `${ilAd(i)}: bütün göstergelerde konum`;
    const satirlar = [], guclu = [], yerSatir = [];
    const bas = '<thead><tr><th>Gösterge</th><th class="say">Değer</th><th class="say">Sıra</th><th>81 il içinde</th><th class="say">Sıra değişimi</th></tr></thead><tbody>';
    let html = '';
    gruplar.forEach(([grup, l], gi) => {
      let satir = '';
      l.forEach((g) => {
        const y = g.yillar.at(-1), a = deger(g, y), r = sira(a), n = a.filter((v) => v != null).length;
        const y5 = g.yillar.filter((yy) => yy <= y - 5).at(-1);
        const r5 = y5 != null ? sira(deger(g, y5))[i] : null;
        const fark = r5 != null && r[i] != null ? r5 - r[i] : null;
        const x = d3.scaleLinear().domain(d3.extent(a.filter((v) => v != null))).range([4, 156]);
        const serit = `<svg class="serit" viewBox="0 0 160 16">${a.map((v) => (v == null ? '' : `<line x1="${x(v)}" x2="${x(v)}" y1="4" y2="12" stroke="var(--soluk)" stroke-opacity=".45"/>`)).join('')}${g.tr[y] != null ? `<line x1="${x(g.tr[y])}" x2="${x(g.tr[y])}" y1="1" y2="15" stroke="var(--ikincil)" stroke-dasharray="2 2"/>` : ''}${a[i] != null ? `<circle cx="${x(a[i])}" cy="8" r="4.5" fill="var(--vurgu)" stroke="var(--zemin)"/>` : ''}</svg>`;
        satir += `<tr><td>${esc(g.ad)} <span class="not">${y}</span></td><td class="say">${a[i] == null ? '–' : dg(g, a[i])}</td><td class="say">${r[i] ?? '–'}${r[i] ? ` / ${n}` : ''}</td><td>${serit}</td>
          <td class="say">${fark == null ? '<span class="not">–</span>' : fark === 0 ? '<span class="not">aynı</span>' : `<span class="degisim ${!g.yon ? '' : fark * g.yon > 0 ? 'art' : 'az'}">${fark > 0 ? '▲' : '▼'} ${Math.abs(fark)}</span> <span class="not">${y5} yılına göre</span>`}</td></tr>`;
        yerSatir.push([grup, g.ad, g.birim, y, a[i] ?? '', r[i] ?? '', n, g.tr[y] ?? '', y5 ?? '', r5 ?? '']);
        if (g.yon && r[i]) { const yuzde = g.yon === 1 ? 1 - (r[i] - 1) / (n - 1) : (r[i] - 1) / (n - 1); guclu.push({ g, yuzde, r: r[i], n }); }
      });
      html += `<details class="yer-grup"${gi < 2 ? ' open' : ''}><summary>${esc(grup)} <span>${l.length} gösterge</span></summary><table class="yer-tablo">${bas}${satir}</tbody></table></details>`;
    });
    document.getElementById('y-tablo').innerHTML = html;
    sonY = { ad: `${ilAd(i)} gostergeler`, satirlar: [['Tema', 'Gösterge', 'Birim', 'Yıl', ilAd(i), 'Sıra', 'Birim sayısı', 'Türkiye', 'Karşılaştırma yılı (5 yıl önce)', 'Karşılaştırma yılındaki sıra'], ...yerSatir] };
    guclu.sort((a, b) => b.yuzde - a.yuzde);
    // benzer iller: bütün göstergelerin son yılı, z-puanı uzaklığı
    const Z = G.map((g) => { const a = deger(g, g.yillar.at(-1)); const v = a.filter((x) => x != null); const m = d3.mean(v), s = d3.deviation(v); return a.map((x) => (x == null ? null : (x - m) / s)); });
    const uz = IL.map((_, j) => { if (j === i) return [Infinity, j]; let t = 0, n = 0; Z.forEach((z) => { if (z[i] != null && z[j] != null) { t += (z[i] - z[j]) ** 2; n++; } }); return [Math.sqrt(t / n), j]; }).sort((a, b) => a[0] - b[0]);
    const bul = [];
    bul.push(`<div class="kart vurgulu"><h3>Güçlü ve zayıf yanlar</h3><p class="not">İyi yönü belli olan ${guclu.length} gösterge içinde konum · sıra en iyiden başlar</p>
      <div class="ikili"><div><div class="alt-b">Öne çıktığı</div><div class="liste">${guclu.slice(0, 4).map((o) => `<span>${esc(o.g.ad)}</span><span>${o.g.yon === 1 ? o.r : o.n - o.r + 1}. / ${o.n}</span>`).join('')}</div></div>
      <div><div class="alt-b">Geride kaldığı</div><div class="liste">${guclu.slice(-4).reverse().map((o) => `<span>${esc(o.g.ad)}</span><span>${o.g.yon === 1 ? o.r : o.n - o.r + 1}. / ${o.n}</span>`).join('')}</div></div></div></div>`);
    bul.push(`<div class="kart"><h3>Benzer iller</h3><p class="not">${G.length} göstergenin tamamında en yakın profile sahip iller</p><div class="liste">${uz.slice(0, 5).map(([d, j]) => `<span><button class="bag" type="button" data-il="${j}">${esc(ilAd(j))}</button></span><span>${esc(V.bolgeler[IL[j].b])}</span>`).join('')}</div></div>`);
    bul.push(`<div class="kart"><h3>Bağlam</h3><p>${esc(ilAd(i))}, ${esc(V.bolgeler[IL[i].b])} bölgesinde yer almakta ve OECD sınıflamasında <strong>${esc(V.oecdSinif[IL[i].o] ?? '–')}</strong> iller arasında bulunmaktadır. Nüfusu ${nf(IL[i].n)} kişidir.</p></div>`);
    document.getElementById('y-bulgular').innerHTML = bul.join('');
  }
  document.getElementById('y-bulgular').addEventListener('click', (e) => { const b = e.target.closest('button[data-il]'); if (b) { ys.il = +b.dataset.il; yCiz(); } });

  /* ================= ÖZELLEŞTİRME VE İNDİRME ================= */
  // oz: kullanıcı tercihleri. Başlık ve alt başlık seçili gösterge(ler) değişene kadar korunur.
  const OZ0 = { g: { palet: 'toprak', iki: 'kahve', yontem: 'dilim', sinif: 5 }, i: { palet: 'platform' } };
  const oz = { g: { anahtar: null, baslik: '', alt: '', ...OZ0.g }, i: { anahtar: null, baslik: '', alt: '', ...OZ0.i } };
  const OTO = { g: { baslik: '', alt: '' }, i: { baslik: '', alt: '' } };
  let sonG = null, sonI = null, sonY = null;
  const $id = (x) => document.getElementById(x);
  const yuv = (x) => (x == null || !isFinite(x) ? '' : +x.toFixed(4));

  function basliklariYaz(k, anahtar, baslik, alt) {
    const o = oz[k];
    if (o.anahtar !== anahtar) { o.anahtar = anahtar; o.baslik = ''; o.alt = ''; }
    OTO[k] = { baslik, alt };
    ['baslik', 'alt'].forEach((f) => {
      const inp = $id(`${k}-o-${f}`);
      if (inp && document.activeElement !== inp) inp.value = o[f] || OTO[k][f];
      $id(`${k}-${f}`).textContent = o[f] || OTO[k][f];
    });
  }

  /* Düzey görünümü renk ölçeği: dilimler, eşit aralıklar ya da Türkiye değerine göre */
  function degerOlcegi(g, a, tr) {
    const o = oz.g;
    const v = a.filter((x) => x != null && isFinite(x)).sort(d3.ascending);
    const lo = v[0], hi = v.at(-1);
    const kutu = (r, x) => `<span><i style="background:${r}"></i>${x}</span>`;
    if (o.yontem === 'tr' && tr != null && tr > 0) {
      const esik = [0.8, 0.95, 1.05, 1.2].map((k) => k * tr);
      const r0 = IKI_YONLU[o.iki].r, renkler = g.yon === -1 ? [...r0].reverse() : [...r0];
      const ad = [`< ${nf(esik[0], g.ond)}`, `${nf(esik[0], g.ond)} – ${nf(esik[1], g.ond)}`, `${nf(esik[1], g.ond)} – ${nf(esik[2], g.ond)}`, `${nf(esik[2], g.ond)} – ${nf(esik[3], g.ond)}`, `> ${nf(esik[3], g.ond)}`];
      return { esik, renkler, uyari: '', lejant: ad.map((x, i) => kutu(renkler[i], x)).join('') + `<span class="not">Türkiye = ${esc(dg(g, tr))}; sınırlar Türkiye değerinin %80, %95, %105 ve %120 düzeyleridir</span>` };
    }
    const n = o.sinif;
    const esit = o.yontem === 'esit';
    const esik = esit ? d3.range(1, n).map((k) => lo + ((hi - lo) * k) / n) : siniflar(a, n);
    const renkler = paletRenk(SIRALI[o.palet].r, n);
    const s = [lo, ...esik, hi];
    const ad = d3.range(n).map((k) => `${k === 0 ? dg(g, s[0]) : nf(s[k], g.ond)} – ${k === n - 1 ? dg(g, s[n]) : nf(s[k + 1], g.ond)}`);
    const not = esit ? 'eşit aralıklı sınıflar' : n === 5 ? 'beşte birlik dilimler' : `${n} dilim · her sınıfta yaklaşık eşit sayıda birim`;
    return { esik, renkler, uyari: o.yontem === 'tr' ? 'Bu gösterge ve yıl için Türkiye değeri bulunmadığından dilimler kullanılmaktadır.' : '', lejant: ad.map((x, i) => kutu(renkler[i], x)).join('') + `<span class="not">${not}</span>` };
  }

  /* Gösterge özelleştirme paneli */
  const gPalet = $id('g-o-palet'), gYontem = $id('g-o-yontem'), gSinif = $id('g-o-sinif'), gPanel = $id('g-ozel');
  const onizleme = document.createElement('span'); onizleme.className = 'am-o-onizleme'; onizleme.setAttribute('aria-hidden', 'true');
  gPalet.after(onizleme);
  function gOzelGuncelle(uyari = '') {
    const tr = gs.duzey === 'tr', deg = gs.mod === 'degisim', iki = deg || oz.g.yontem === 'tr';
    gPanel.querySelectorAll('.am-o-renk').forEach((e) => (e.hidden = tr));
    gPanel.querySelectorAll('.am-o-sinif').forEach((e) => (e.hidden = tr || deg));
    gPanel.querySelector('.am-o-sayi').hidden = tr || deg || oz.g.yontem === 'tr';
    const P = iki ? IKI_YONLU : SIRALI, sec = iki ? oz.g.iki : oz.g.palet;
    gPalet.dataset.tur = iki ? 'iki' : 'sira';
    gPalet.innerHTML = Object.entries(P).map(([k, p]) => `<option value="${k}"${k === sec ? ' selected' : ''}>${p.ad}</option>`).join('');
    const r = iki ? P[sec].r : paletRenk(P[sec].r, oz.g.yontem === 'tr' ? 5 : oz.g.sinif);
    onizleme.innerHTML = r.map((c) => `<i style="background:${c}"></i>`).join('');
    gYontem.value = oz.g.yontem; gSinif.value = oz.g.sinif;
    $id('g-o-not').textContent = tr ? 'Türkiye zaman serisinde başlık ve alt başlık değiştirilebilir.' : deg ? 'Değişim görünümünde artış ve azalış iki yönlü paletle gösterilir.' : uyari;
  }
  gPalet.addEventListener('change', () => { oz.g[gPalet.dataset.tur === 'iki' ? 'iki' : 'palet'] = gPalet.value; gCiz(); });
  gYontem.addEventListener('change', () => { oz.g.yontem = gYontem.value; gCiz(); });
  gSinif.addEventListener('change', () => { oz.g.sinif = +gSinif.value; gCiz(); });
  $id('g-o-sifirla').addEventListener('click', () => { Object.assign(oz.g, OZ0.g, { baslik: '', alt: '' }); gCiz(); });

  /* İlişki özelleştirme paneli */
  const iPalet = $id('i-o-palet');
  iPalet.innerHTML = Object.entries(NOKTA_PALET).map(([k, p]) => `<option value="${k}">${p.ad}</option>`).join('');
  iPalet.addEventListener('change', () => { oz.i.palet = iPalet.value; iCiz(true); });
  $id('i-o-sifirla').addEventListener('click', () => { Object.assign(oz.i, OZ0.i, { baslik: '', alt: '' }); iPalet.value = oz.i.palet; iCiz(true); });

  ['g', 'i'].forEach((k) => {
    const ac = document.querySelector(`#${k}-arac .am-ozel-ac`), pn = $id(`${k}-ozel`);
    ac.addEventListener('click', () => { const acik = pn.hidden; pn.hidden = !acik; ac.setAttribute('aria-expanded', String(acik)); });
    ['baslik', 'alt'].forEach((f) => $id(`${k}-o-${f}`).addEventListener('input', (e) => {
      const v = e.target.value;
      oz[k][f] = v.trim() === OTO[k][f] ? '' : v;
      $id(`${k}-${f}`).textContent = oz[k][f] || OTO[k][f];
    }));
  });

  /* İndirme araç çubukları */
  const kaynakMetni = (kaynaklar) => {
    const k = [...new Set(kaynaklar.filter(Boolean))];
    return `Kaynak: ${k.length ? k.join(', ') : 'platform veritabanı'}; Hesaplama: Platform`;
  };
  const gKaynak = () => { const m = sonG?.t?.m; return kaynakMetni([m?.kaynak]) + (m?.not ? `. Not: ${m.not}` : ''); };
  const iKaynak = () => kaynakMetni([sonI?.gx.kaynak, sonI?.gy.kaynak]);
  // pano: önce Clipboard API, olmazsa (çerçeve izni yoksa) seçili metin kopyalama
  async function panoya(metin) {
    try { await navigator.clipboard.writeText(metin); return; } catch (e) { /* aşağıdaki yönteme geç */ }
    const ta = document.createElement('textarea');
    ta.value = metin; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    if (!ok) throw new Error('pano');
  }
  function aracBagla(k, f) {
    const kok = $id(`${k}-arac`), durum = kok.querySelector('.am-durum');
    let zm;
    const yaz = (m) => { durum.textContent = m; clearTimeout(zm); zm = setTimeout(() => (durum.textContent = ''), 4000); };
    const sonuc = (r, m) => yaz(r === 'iptal' ? 'İndirme iptal edildi.' : m);
    kok.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-indir]'); if (!b) return;
      const ne = b.dataset.indir;
      try {
        if (ne === 'png') {
          b.disabled = true; durum.textContent = 'Görsel hazırlanıyor…';
          const o = f.png();
          if (!o.svg) throw new Error('grafik yok');
          sonuc(await indir(`${dosyaAdi(o.baslik)}.png`, await pngYap(o)), 'PNG indirildi.');
        } else if (ne === 'csv') {
          const c = f.csv(); if (!c) throw new Error('veri yok');
          sonuc(await indir(`${dosyaAdi(c.ad)}.csv`, csv(c.satirlar), 'text/csv;charset=utf-8'), 'CSV indirildi.');
        } else {
          const t = f.txt();
          if (ne === 'txt') sonuc(await indir(`${dosyaAdi(t.ad)}-bulgular.txt`, `﻿${t.metin}`, 'text/plain;charset=utf-8'), 'Bulgular indirildi.');
          else { await panoya(t.metin); yaz('Bulgular panoya kopyalandı.'); }
        }
      } catch (err) {
        console.error(err); yaz(ne === 'kopya' ? 'Kopyalanamadı; bulguları Bulgular düğmesiyle indirebilirsiniz.' : `İndirilemedi: ${err.message || 'beklenmeyen hata'}`);
      } finally { b.disabled = false; }
    });
  }
  aracBagla('g', {
    png: () => ({ svg: gs.duzey === 'tr' ? trendSvg.node() : document.querySelector('#g-harita svg'), baslik: $id('g-baslik').textContent, alt: $id('g-alt').textContent, lejant: lejantOku($id('g-lejant')), kaynak: gKaynak() }),
    csv: () => sonG,
    txt: () => ({ ad: $id('g-baslik').textContent, metin: bulgularMetni($id('g-bulgular'), { baslik: $id('g-baslik').textContent, alt: $id('g-alt').textContent, kaynak: gKaynak() }) }),
  });
  aracBagla('i', {
    png: () => ({ svg: iSvg.node(), baslik: $id('i-baslik').textContent, alt: $id('i-alt').textContent, lejant: lejantOku($id('i-lejant')), kaynak: iKaynak() }),
    csv: () => sonI,
    txt: () => ({ ad: $id('i-baslik').textContent, metin: bulgularMetni($id('i-bulgular'), { baslik: $id('i-baslik').textContent, alt: $id('i-alt').textContent, kaynak: iKaynak() }) }),
  });
  aracBagla('y', {
    csv: () => sonY,
    txt: () => ({ ad: $id('y-baslik').textContent, metin: bulgularMetni($id('y-bulgular'), { baslik: $id('y-baslik').textContent, alt: '', kaynak: 'Kaynak: platform veritabanı; Hesaplama: Platform' }) }),
  });

  /* ---------- sekmeler ---------- */
  const SEK = { gosterge: gCiz, iliski: () => iCiz(), yer: yCiz };
  function sekmeAc(k) {
    document.querySelectorAll('.sekme').forEach((s) => s.setAttribute('aria-selected', s.id === `s-${k}`));
    document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== `p-${k}`));
    SEK[k]();
    try { history.replaceState(null, '', `${location.search}#${k}`); } catch (e) { /* önemsiz */ }
    if (k !== 'gosterge') radar.kapat();
  }
  document.querySelector('.sekmeler').addEventListener('click', (e) => { const s = e.target.closest('.sekme'); if (s) sekmeAc(s.id.slice(2)); });
  document.querySelector('.sekmeler').addEventListener('keydown', (e) => {
    const l = [...document.querySelectorAll('.sekme')], i = l.indexOf(document.activeElement);
    if (i < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const j = (i + (e.key === 'ArrowRight' ? 1 : l.length - 1)) % l.length; l[j].focus(); l[j].click();
  });

  let zt; window.addEventListener('resize', () => { clearTimeout(zt); zt = setTimeout(() => { if (!document.getElementById('p-gosterge').hidden) gCiz(); }, 200); });
  // adres: ?gosterge=<id>&duzey=il|duzey2|duzey1|fua|tr&yil=&gorunum=  (eski Veri Gezgini bağlantıları: ?kategori=&gosterge=&duzey=)
  const P = new URLSearchParams(location.search);
  const DUZEY_ESKI = { tr: 'tr', il: 'il', duzey2: 'duzey2', duzey1: 'duzey1', fua: 'fua' };
  let pid = P.get('gosterge');
  if (pid && !M.gostergeById.has(pid)) pid = null;
  if (!pid && P.get('kategori') && M.kategoriByAd.has(P.get('kategori'))) {
    const l = M.kategoriByAd.get(P.get('kategori')).gostergeler;
    pid = (l.find((g) => g.duzeyler.includes('province')) ?? l[0])?.id ?? null;
  }
  if (pid) { gs.id = pid; gSecici.deger(pid); }
  if (DUZEY_ESKI[P.get('duzey')]) gs.duzey = DUZEY_ESKI[P.get('duzey')];
  if (P.get('yil')) gs.yil = +P.get('yil');
  if (P.get('gorunum') === 'degisim') gs.mod = P.get('gorunum');
  const ilk = (location.hash || '').slice(1);
  sekmeAc(SEK[ilk] ? ilk : 'gosterge');
}

yukle().then(baslat).catch((e) => {
  if (ayriliyor) return;
  console.error(e);
  document.getElementById('g-bulgular').innerHTML = `<div class="kart"><p>Veri yüklenemedi: ${String(e.message).replace(/</g, '&lt;')}</p></div>`;
});
