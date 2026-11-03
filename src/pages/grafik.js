/**
 * Grafik Oluşturma: Türkiye, Düzey 1, Düzey 2, il ve ilçe düzeyinde
 *   - sıralama (seçili yılda birimler, büyükten küçüğe)
 *   - zaman serisi (seçili birimlerin yıllara göre değeri; çizgi ya da sütun)
 * Veri sitenin veritabanından gelir. Başlık ve kaynak grafiğin içine çizilir; PNG olduğu gibi indirilir.
 */
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-ext-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import '@fontsource/source-sans-3/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '../styles/hikaye.css';
import '../styles/arac.css';

import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement,
  CategoryScale, LinearScale, Tooltip, Legend, Title, SubTitle,
} from 'chart.js';
import { SITE } from '../site.config.js';
import { araclarMenusu } from '../lib/menu.js';
import { manifest, kapsamliYillar } from '../lib/data.js';
import { sayi, kisa, esc } from '../lib/format.js';

import {
  kategoriSecenekleri, ARAC_DUZEYLERI, birimler, birimAdi, altinda, kategoriler, gostergeler, degerler, turkiye,
  secenekler, gostergeSecenekleri, kapsamSecenekleri, indir, csv, dosyaAdi, gorunenAd,
} from '../lib/arac.js';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Title, SubTitle);
Chart.defaults.font.family = "'Source Sans 3', 'Segoe UI', system-ui, sans-serif";
Chart.defaults.color = '#5f5f5f';

const $ = (id) => document.getElementById(id);
// indirme: artifact görünümünde izleyiciden kaydetme onayı istenir; sonuç durum satırına yazılır
const indirB = (...a) => indir(...a).then((r) => { if (r === 'iptal') $('durum').textContent = 'İndirme iptal edildi.'; })
  .catch((e) => { console.error(e); $('durum').textContent = `İndirilemedi: ${e.message}`; });
/** Kategorik seri renkleri: sitenin toprak paleti; 8 renk renk körlüğü denetiminden geçti (validate_palette.js, açık zemin) */
const RENKLER = ['#c24a28', '#2e6e9e', '#a87812', '#6d5a9e', '#138a6e', '#8a3b1c', '#d0508a', '#5e7f12'];
const TR_RENK = '#3a3a3a';
const CUBUK = '#d8835a';
const VURGU = '#86301a';
const VARSAYILAN_BIRIMLER = { duzey1: ['TR1', 'TR5', 'TR3'], duzey2: ['TR10', 'TR51', 'TR31'], il: ['TR100', 'TR510', 'TR310'], ilce: [] };

const durum = {
  duzey: 'il', kategori: 'Nüfus', gosterge: 'toplam-nufus', tur: 'sirali', yil: null, kapsam: 'TR',
  secili: [], // zaman serisinde birimler (sıra = renk ataması)
  renk: new Map(), // kod → renk yuvası (bir birim çıkarılınca diğerlerinin rengi değişmez)
};
let M, B, veri = {}, trVeri = {}, chart = null, son = null;

// ------------------------------------------------------------------ başlangıç
async function init() {
  $('site-baslik').textContent = SITE.baslik;
  araclarMenusu($('araclar'));
  const IMG = new URL(`${import.meta.env.BASE_URL}img/`, document.baseURI).href;
  document.querySelectorAll('img[src^="/img/"]').forEach((img) => (img.src = IMG + img.src.split('/img/')[1]));
  const p = new URLSearchParams(location.search);
  for (const k of ['duzey', 'kategori', 'gosterge', 'tur', 'kapsam', 'yil']) if (p.get(k)) durum[k] = p.get(k);
  if (p.get('birimler')) durum.secili = p.get('birimler').split(',').filter(Boolean).slice(0, 8);
  if (!ARAC_DUZEYLERI[durum.duzey]) durum.duzey = 'il';
  [M, B] = await Promise.all([manifest(), birimler()]);
  olaylariKur();
  await duzeyDegisti(!durum.secili.length);
}

function olaylariKur() {
  $('duzey').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-duzey]');
    if (!b || b.dataset.duzey === durum.duzey) return;
    durum.duzey = b.dataset.duzey;
    await duzeyDegisti(true);
  });
  $('tur').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tur]');
    if (!b || b.disabled) return;
    durum.tur = b.dataset.tur;
    turGoster();
    ciz();
  });
  $('kategori').addEventListener('change', async (e) => { durum.kategori = e.target.value; durum.gosterge = null; await kategoriDegisti(); });
  $('gosterge').addEventListener('change', async (e) => { durum.gosterge = e.target.value; $('baslik').value = ''; await gostergeDegisti(); });
  $('yil').addEventListener('change', (e) => { durum.yil = e.target.value; ciz(); });
  $('kapsam').addEventListener('change', (e) => { durum.kapsam = e.target.value; vurguListesi(); ciz(); });
  for (const id of ['adet', 'yon', 'vurgu', 'tr-cizgi', 'tr-seri', 'yil1', 'yil2', 'degerler', 'sifir']) $(id).addEventListener('change', ciz);
  let t;
  $('baslik').addEventListener('input', () => { clearTimeout(t); t = setTimeout(ciz, 250); });
  $('birim-ara').addEventListener('input', birimListesi);
  $('birim-listesi').addEventListener('change', (e) => {
    const kod = e.target.value;
    if (e.target.checked) birimEkle(kod);
    else birimCikar(kod);
  });
  $('secili-birimler').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kod]');
    if (b) birimCikar(b.dataset.kod);
  });
  $('indir-png').addEventListener('click', pngIndir);
  $('indir-csv').addEventListener('click', csvIndir);
}

// ------------------------------------------------------------------ seçim zinciri
async function duzeyDegisti(varsayilanBirimler) {
  $('duzey').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.duzey === durum.duzey)));
  if (durum.duzey === 'tr' && durum.tur === 'sirali') durum.tur = 'cizgi';
  $('tur').querySelector('[data-tur="sirali"]').disabled = durum.duzey === 'tr';
  if (varsayilanBirimler) {
    durum.secili = [...(VARSAYILAN_BIRIMLER[durum.duzey] ?? [])];
    durum.renk = new Map(durum.secili.map((k, i) => [k, i]));
  }
  turGoster();
  const ks = await kategoriler(durum.duzey);
  if (!ks.includes(durum.kategori)) durum.kategori = ks[0];
  kategoriSecenekleri($('kategori'), ks, durum.kategori);
  await kapsamSecenekleri($('kapsam'), durum.duzey, durum.kapsam);
  durum.kapsam = $('kapsam').value;
  $('birim-ara').value = '';
  $('tr-seri').closest('label').hidden = durum.duzey === 'tr';
  await kategoriDegisti();
}

function turGoster() {
  $('tur').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.tur === durum.tur)));
  document.querySelector('[data-gorunur="sirali"]').hidden = durum.tur !== 'sirali';
  document.querySelector('[data-gorunur="zaman"]').hidden = durum.tur === 'sirali';
  document.querySelector('[data-gorunur="zaman"] label').hidden = durum.duzey === 'tr';
  $('birim-listesi').hidden = durum.duzey === 'tr';
}

async function kategoriDegisti() {
  const gs = await gostergeler(durum.kategori, durum.duzey);
  const v = SITE.varsayilanGosterge[durum.kategori];
  if (!gs.some((g) => g.id === durum.gosterge)) durum.gosterge = gs.some((g) => g.id === v) ? v : gs[0]?.id;
  gostergeSecenekleri($('gosterge'), gs, durum.gosterge);
  await gostergeDegisti();
}

async function gostergeDegisti() {
  $('durum').textContent = 'Yükleniyor…';
  [veri, trVeri] = await Promise.all([
    durum.duzey === 'tr' ? {} : degerler(durum.kategori, durum.gosterge, durum.duzey),
    turkiye(durum.kategori, durum.gosterge),
  ]);
  if (durum.duzey === 'tr') veri = Object.fromEntries(Object.entries(trVeri).map(([y, v]) => [y, { TR: v }]));
  const hedef = ARAC_DUZEYLERI[durum.duzey].veri;
  const ys = kapsamliYillar(veri, (k) => B[k]?.duzey === hedef).reverse();
  if (!ys.includes(String(durum.yil))) durum.yil = ys[0];
  secenekler($('yil'), ys.map((y) => [y, y]), durum.yil);
  const tum = [...new Set([...Object.keys(veri), ...Object.keys(trVeri)])].sort();
  const y1 = $('yil1').value;
  const y2 = $('yil2').value;
  secenekler($('yil1'), tum.map((y) => [y, y]), tum.includes(y1) ? y1 : tum[0]);
  secenekler($('yil2'), tum.map((y) => [y, y]), tum.includes(y2) ? y2 : tum.at(-1));
  if (durum.duzey === 'ilce' && !durum.secili.length && ys[0]) {
    // İlçede varsayılan: seçili yılda en yüksek üç ilçe
    durum.secili = Object.entries(veri[ys[0]]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k);
    durum.renk = new Map(durum.secili.map((k, i) => [k, i]));
  }
  vurguListesi();
  birimListesi();
  seciliYaz();
  ciz();
}

function vurguListesi() {
  const kodlar = Object.keys(B).filter((k) => B[k].duzey === ARAC_DUZEYLERI[durum.duzey].veri && altinda(B, k, durum.kapsam))
    .sort((a, b) => birimAdi(B, a).localeCompare(birimAdi(B, b), 'tr'));
  const once = $('vurgu').value;
  secenekler($('vurgu'), [['', 'Yok'], ...kodlar.map((k) => [k, birimAdi(B, k)])], once);
}

// ------------------------------------------------------------------ birim seçimi (zaman serisi)
function birimListesi() {
  if (durum.duzey === 'tr') return;
  const ara = $('birim-ara').value.trim().toLocaleLowerCase('tr');
  const hedef = ARAC_DUZEYLERI[durum.duzey].veri;
  const kodlar = Object.keys(B)
    .filter((k) => B[k].duzey === hedef && (!ara || birimAdi(B, k).toLocaleLowerCase('tr').includes(ara) || k.toLowerCase().includes(ara)))
    .sort((a, b) => birimAdi(B, a).localeCompare(birimAdi(B, b), 'tr'));
  const goster = kodlar.slice(0, 120);
  $('birim-listesi').innerHTML = goster
    .map((k) => `<label class="kutu"><input type="checkbox" value="${k}" ${durum.secili.includes(k) ? 'checked' : ''} ${!durum.secili.includes(k) && durum.secili.length >= 8 ? 'disabled' : ''}> ${esc(birimAdi(B, k))}</label>`)
    .join('') + (kodlar.length > goster.length ? `<p class="ipucu" style="padding:4px 10px">${kodlar.length - goster.length} birim daha var; aramayı daraltın.</p>` : '');
}
function renkYuvasi(kod) {
  if (!durum.renk.has(kod)) {
    const dolu = new Set([...durum.renk].filter(([k]) => durum.secili.includes(k)).map(([, i]) => i));
    let i = 0;
    while (dolu.has(i)) i++;
    durum.renk.set(kod, i % RENKLER.length);
  }
  return RENKLER[durum.renk.get(kod)];
}
function birimEkle(kod) {
  if (durum.secili.includes(kod) || durum.secili.length >= 8) return;
  durum.secili.push(kod);
  durum.renk.delete(kod);
  renkYuvasi(kod);
  birimListesi();
  seciliYaz();
  ciz();
}
function birimCikar(kod) {
  durum.secili = durum.secili.filter((k) => k !== kod);
  durum.renk.delete(kod);
  birimListesi();
  seciliYaz();
  ciz();
}
function seciliYaz() {
  $('secili-birimler').innerHTML = durum.duzey === 'tr' ? '' : durum.secili
    .map((k) => `<button type="button" data-kod="${k}" title="Çıkar"><i style="background:${renkYuvasi(k)}"></i>${esc(birimAdi(B, k))} ×</button>`)
    .join('');
}

// ------------------------------------------------------------------ çizim
/** Değer etiketi, Türkiye çizgisi, beyaz zemin ve kaynak satırı (PNG'de de görünsün diye tuvale çizilir) */
const eklenti = {
  id: 'aracEk',
  beforeDraw(c) {
    const { ctx, width, height } = c;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  },
  afterDatasetsDraw(c, _a, o) {
    const { ctx, chartArea, scales } = c;
    if (o.trDeger != null) {
      const yatay = c.options.indexAxis === 'y';
      const s = yatay ? scales.x : scales.y;
      const p = s.getPixelForValue(o.trDeger);
      const ic = yatay ? p >= chartArea.left && p <= chartArea.right : p >= chartArea.top && p <= chartArea.bottom;
      if (!ic) return;
      ctx.save();
      ctx.strokeStyle = TR_RENK;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (yatay) { ctx.moveTo(p, chartArea.top); ctx.lineTo(p, chartArea.bottom); } else { ctx.moveTo(chartArea.left, p); ctx.lineTo(chartArea.right, p); }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = TR_RENK;
      ctx.font = `600 12px ${Chart.defaults.font.family}`;
      const t = `Türkiye ${o.f(o.trDeger)}`;
      if (yatay) { ctx.textAlign = 'left'; ctx.fillText(t, p + 5, chartArea.top + 10); } else { ctx.textAlign = 'right'; ctx.fillText(t, chartArea.right - 4, p - 6); }
      ctx.restore();
    }
    if (o.degerler) {
      ctx.save();
      ctx.font = `12px ${Chart.defaults.font.family}`;
      ctx.fillStyle = '#2f2f2f';
      c.data.datasets.forEach((ds, i) => {
        const meta = c.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach((el, j) => {
          const v = ds.data[j];
          if (v == null) return;
          const { x, y } = el.tooltipPosition();
          if (c.options.indexAxis === 'y') { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(o.f(v), x + 5, y); } else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(o.f(v), x, y - 4); }
        });
      });
      ctx.restore();
    }
  },
  afterDraw(c, _a, o) {
    const { ctx, width, height } = c;
    ctx.save();
    ctx.font = `12px ${Chart.defaults.font.family}`;
    ctx.fillStyle = '#6b6b6b';
    ctx.textAlign = 'left';
    ctx.fillText(o.kaynak ?? '', 4, height - 6);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#9a9a9a';
    ctx.fillText(SITE.baslik, width - 4, height - 6);
    ctx.restore();
  },
};

function ciz() {
  if (!durum.gosterge || !M) return;
  const g = M.gostergeById.get(durum.gosterge);
  const ondalik = g.ondalik ?? 2;
  const f = (v) => sayi(v, ondalik);
  const kaynak = `Kaynak: ${g.kaynak ?? 'TÜİK'}`;
  const { baslik: gAd, ek: gEk } = gorunenAd(g.ad);
  const ekOn = gEk ? `${gEk} · ` : '';
  const adres = new URLSearchParams({ duzey: durum.duzey, kategori: durum.kategori, gosterge: durum.gosterge, tur: durum.tur });
  if (durum.tur === 'sirali') { adres.set('yil', durum.yil ?? ''); if (durum.kapsam !== 'TR') adres.set('kapsam', durum.kapsam); } else if (durum.secili.length) adres.set('birimler', durum.secili.join(','));
  history.replaceState(null, '', `?${adres}`);
  if (chart) chart.destroy();
  const ctx = $('grafik').getContext('2d');
  const ortak = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
    layout: { padding: { top: 4, right: 16, bottom: 22, left: 4 } },
    plugins: {
      title: { display: true, text: '', align: 'start', color: '#1f1f1f', font: { size: 20, weight: '600' }, padding: { bottom: 2 } },
      subtitle: { display: true, text: '', align: 'start', color: '#6b6b6b', font: { size: 13 }, padding: { bottom: 14 } },
      aracEk: { kaynak, f, degerler: $('degerler').checked, trDeger: null },
      tooltip: { backgroundColor: 'rgba(31,31,31,0.92)', padding: 10, callbacks: { label: (c) => ` ${c.dataset.label}: ${f(c.raw)}${g.birim ? ` ${g.birim}` : ''}` } },
    },
  };
  const eksenBicim = (v) => (Math.abs(v) >= 10000 ? kisa(v) : sayi(v, Math.abs(v) < 10 && !Number.isInteger(v) ? Math.min(ondalik, 2) : 0));

  if (durum.tur === 'sirali') {
    const d = veri[durum.yil] ?? {};
    let satirlar = Object.entries(d)
      .filter(([k, v]) => v != null && altinda(B, k, durum.kapsam) && B[k]?.duzey === ARAC_DUZEYLERI[durum.duzey].veri)
      .map(([kod, deger]) => ({ kod, ad: birimAdi(B, kod, { kisa: durum.duzey === 'ilce' && durum.kapsam !== 'TR' && B[durum.kapsam]?.duzey === 'province' }), deger }))
      .sort((a, b) => b.deger - a.deger);
    const tumu = satirlar;
    const adet = Number($('adet').value);
    if (adet > 0) satirlar = satirlar.slice(0, adet);
    if (adet < 0) satirlar = satirlar.slice(adet);
    const vurgu = $('vurgu').value;
    if (vurgu && !satirlar.some((s) => s.kod === vurgu)) {
      const s = tumu.find((x) => x.kod === vurgu);
      if (s) satirlar = [...satirlar, s].sort((a, b) => b.deger - a.deger);
    }
    const yatay = $('yon').value === 'y';
    const trDeger = $('tr-cizgi').checked && durum.kapsam === 'TR' ? trVeri[durum.yil] ?? null : $('tr-cizgi').checked ? trVeri[durum.yil] ?? null : null;
    ortak.plugins.aracEk.trDeger = trDeger;
    ortak.plugins.title.text = $('baslik').value.trim() || `${gAd}, ${durum.yil}`;
    ortak.plugins.subtitle.text = `${ekOn}${ARAC_DUZEYLERI[durum.duzey].cogul}${durum.kapsam !== 'TR' ? ` · ${birimAdi(B, durum.kapsam)}` : ''}${adet ? ` · ${adet > 0 ? 'en yüksek' : 'en düşük'} ${Math.abs(adet)}` : ''}${g.birim ? ` · ${g.birim}` : ''}`;
    ortak.plugins.legend = { display: false };
    const eksen = { beginAtZero: $('sifir').checked, grid: { color: 'rgba(0,0,0,0.06)' }, border: { display: false }, ticks: { callback: eksenBicim } };
    const kat = { grid: { display: false }, ticks: { autoSkip: false, font: { size: satirlar.length > 40 ? 10 : 12 }, color: '#3a3a3a' } };
    $('grafik').parentElement.style.height = yatay ? `${Math.max(420, 110 + satirlar.length * (satirlar.length > 40 ? 15 : 22))}px` : '560px';
    chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: satirlar.map((s) => s.ad),
        datasets: [{ label: g.ad, data: satirlar.map((s) => s.deger), backgroundColor: satirlar.map((s) => (s.kod === vurgu ? VURGU : CUBUK)), borderRadius: 3, maxBarThickness: 36 }],
      },
      options: { ...ortak, indexAxis: yatay ? 'y' : 'x', scales: yatay ? { x: { ...eksen, position: 'top' }, y: kat } : { y: eksen, x: { ...kat, ticks: { ...kat.ticks, maxRotation: 60, minRotation: satirlar.length > 12 ? 45 : 0 } } } },
      plugins: [eklenti],
    });
    son = { tur: 'sirali', g, f, baslik: ortak.plugins.title.text, satirlar, trDeger };
    $('tablo').innerHTML = `<caption>${esc(g.ad)}, ${durum.yil}</caption><thead><tr><th>Sıra</th><th>Birim</th><th>Değer${g.birim ? ` (${esc(g.birim)})` : ''}</th></tr></thead><tbody>` +
      (trDeger != null ? `<tr class="tr-satir"><td></td><td>Türkiye</td><td>${f(trDeger)}</td></tr>` : '') +
      satirlar.map((s, i) => `<tr><td>${tumu.indexOf(s) + 1}</td><td>${esc(birimAdi(B, s.kod))}</td><td>${f(s.deger)}</td></tr>`).join('') + '</tbody>';
    $('durum').textContent = `${tumu.length} birimde veri var${satirlar.length < tumu.length ? `, ${satirlar.length} tanesi gösteriliyor` : ''}.`;
    return;
  }

  // Zaman serisi
  $('grafik').parentElement.style.height = '560px';
  const y1 = $('yil1').value;
  const y2 = $('yil2').value;
  const yillar = [...new Set([...Object.keys(veri), ...Object.keys(trVeri)])].sort().filter((y) => y >= y1 && y <= y2);
  const seriler = durum.duzey === 'tr' ? [] : durum.secili.map((k) => ({ kod: k, ad: birimAdi(B, k), renk: renkYuvasi(k), veri: yillar.map((y) => veri[y]?.[k] ?? null) }));
  if (durum.duzey === 'tr' || $('tr-seri').checked) seriler.push({ kod: 'TR', ad: 'Türkiye', renk: seriler.length ? TR_RENK : RENKLER[0], veri: yillar.map((y) => trVeri[y] ?? null), tr: true });
  const cizgi = durum.tur === 'cizgi';
  ortak.plugins.title.text = $('baslik').value.trim() || gAd;
  ortak.plugins.subtitle.text = `${ekOn}${yillar[0] ?? ''}–${yillar.at(-1) ?? ''}${g.birim ? ` · ${g.birim}` : ''}`;
  ortak.plugins.legend = { display: seriler.length > 1, position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: cizgi ? 'line' : 'rect', boxWidth: 18, color: '#3a3a3a', font: { size: 12.5 } } };
  ortak.interaction = { mode: 'index', intersect: false };
  chart = new Chart(ctx, {
    type: cizgi ? 'line' : 'bar',
    data: {
      labels: yillar,
      datasets: seriler.map((s) => ({
        label: s.ad, data: s.veri, borderColor: s.renk, backgroundColor: s.renk,
        borderWidth: 2, borderDash: s.tr && cizgi && seriler.length > 1 ? [5, 4] : undefined,
        pointRadius: cizgi ? (yillar.length > 20 ? 0 : 2.5) : undefined, pointHoverRadius: 5, tension: 0.2, spanGaps: true, borderRadius: cizgi ? undefined : 2,
      })),
    },
    options: {
      ...ortak,
      scales: {
        y: { beginAtZero: $('sifir').checked, grid: { color: 'rgba(0,0,0,0.06)' }, border: { display: false }, ticks: { callback: eksenBicim } },
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
      },
    },
    plugins: [eklenti],
  });
  son = { tur: 'zaman', g, f, baslik: ortak.plugins.title.text, yillar, seriler };
  $('tablo').innerHTML = `<caption>${esc(g.ad)}</caption><thead><tr><th>Yıl</th>${seriler.map((s) => `<th>${esc(s.ad)}</th>`).join('')}</tr></thead><tbody>` +
    yillar.map((y, i) => `<tr><td>${y}</td>${seriler.map((s) => `<td>${s.veri[i] == null ? '–' : f(s.veri[i])}</td>`).join('')}</tr>`).reverse().join('') + '</tbody>';
  $('durum').textContent = seriler.length ? '' : 'Grafik için soldan birim seçin.';
}

// ------------------------------------------------------------------ indirme
function pngIndir() {
  $('grafik').toBlob((b) => indirB(`${dosyaAdi(son?.baslik ?? 'grafik')}.png`, b), 'image/png');
}
function csvIndir() {
  if (!son) return;
  const ad = `${dosyaAdi(son.baslik)}.csv`;
  if (son.tur === 'sirali') {
    indirB(ad, csv([['kod', 'birim', 'yıl', son.g.ad], ...son.satirlar.map((s) => [s.kod, birimAdi(B, s.kod), durum.yil, s.deger])]), 'text/csv');
  } else {
    indirB(ad, csv([['yıl', ...son.seriler.map((s) => s.ad)], ...son.yillar.map((y, i) => [y, ...son.seriler.map((s) => s.veri[i] ?? '')])]), 'text/csv');
  }
}

init().catch((e) => {
  console.error(e);
  $('durum').textContent = `Veri yüklenemedi: ${e.message}`;
});
