/**
 * Ana sayfa vitrini: Türkiye'nin 81 iline üç farklı açıdan bakan etkileşimli gösterimler.
 *
 *   pasta(kap, V)    ölçüsü değiştirilebilen ağaç haritası (Türkiye toplamındaki paylar, coğrafi bölgelere göre)
 *   birinci(kap, V)  karo harita: her ilin 81 il içinde öne çıktığı gösterge, kategori ikonlarıyla
 *   sege(kap, V)     1963–2025 gelişmişlik sıralaması: yükselen ve gerileyen iller (sıralama çizgileri)
 *   profil(kap, V)   İliniz nerede? Seçilen ilin 12 göstergede 81 il arasındaki yeri, benzer iller
 *   yuzKisi(kap, V)  Türkiye 100 kişi olsaydı: birim grafiği (nüfus ve toplum; işgücü ve gelir)
 *   zaman(kap, V)    2000–2025 zaman çizelgesi: veriden çıkarılan dönüm noktaları, her biri küçük bir seriyle
 *   suru(kap, V)     balon sürüsü: nüfusla boyutlanan iller, değiştirilebilir eksen, OECD kentsel–kırsal rengi
 *
 * Veri: public/veri/vitrin.json (tools/vitrin/vitrin_verisi.py).
 * Renkler (dataviz doğrulayıcısından geçti): bölge paleti komşu bölgeler arasında CVD ΔE ≥ 9,2 ve normal ΔE ≥ 16,7;
 * kentsel–kırsal için referans paletin ilk üç rengi (bütün çiftlerde geçer). Etiketler hep koyu mürekkep.
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import { scaleLinear, scaleSqrt, scaleLog } from 'd3-scale';
import { line, curveBumpX } from 'd3-shape';
import { sayi, esc } from './format.js';

export const BOLGE_RENK = ['#009a8a', '#8566c4', '#d9568f', '#d6981b', '#c8473b', '#2a95d0', '#4d9a3a'];
const OECD_RENK = ['#2a78d6', '#eb6834', '#1baf7a'];
const MUREKKEP = '#1f1f1f';

/* ------------------------------------------------------------------ ikonlar (24×24, çizgi) */
const IKON = {
  tarim: 'M12 21V8M12 8c0-3 2-5 4-5 0 3-2 5-4 5Zm0 0C12 5 10 3 8 3c0 3 2 5 4 5Zm0 5c0-3 2-5 4-5 0 3-2 5-4 5Zm0 0c0-3-2-5-4-5 0 3 2 5 4 5Zm0 5c0-3 2-5 4-5 0 3-2 5-4 5Zm0 0c0-3-2-5-4-5 0 3 2 5 4 5Z',
  hayvan: 'M6 14a3 3 0 0 1 1-5.5A3 3 0 0 1 12 7a3 3 0 0 1 5 1.5A3 3 0 0 1 18 14a3 3 0 0 1-3 2H9a3 3 0 0 1-3-2Zm2 2v4m8-4v4M18 9.5l2.5-1M20 11h-2',
  ekonomi: 'M4 20h16M7 20v-6m5 6V9m5 11V5',
  sanayi: 'M3 21V11l5 3V11l5 3V11l5 3V4h3v17H3Zm4-4h2m3 0h2m3 0h2',
  ticaret: 'M3 16h18l-2 4H5l-2-4Zm3 0V9h6v7m0-5h5v5M8 9V6h2v3',
  enerji: 'M13 2 5 13h6l-1 9 8-11h-6l1-9Z',
  nufus: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-7 10a7 7 0 0 1 14 0',
  aile: 'M8 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm8 1a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 20a5 5 0 0 1 10 0m0 0a3.5 3.5 0 0 1 8 0',
  saglik: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  egitim: 'M2 9l10-5 10 5-10 5L2 9Zm4 2v5c2 2 10 2 12 0v-5m4-2v6',
  kultur: 'M3 9l9-6 9 6H3Zm2 0v9m4.5-9v9m5-9v9M19 9v9M3 21h18M3 18h18',
  turizm: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ulasim: 'M5 16V11l2-5h10l2 5v5H5Zm0 0v3m14-3v3M5 11h14M8 14h.01M16 14h.01',
  haberlesme: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  cevre: 'M5 19C5 10 10 5 20 4c0 10-5 15-14 15Zm0 0 8-8',
  konut: 'M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6',
};
export const KATEGORI = {
  tarim: 'Tarım', hayvan: 'Hayvancılık', ekonomi: 'Ekonomi', sanayi: 'Sanayi', ticaret: 'Dış ticaret', enerji: 'Enerji',
  nufus: 'Nüfus', aile: 'Aile', saglik: 'Sağlık', egitim: 'Eğitim', kultur: 'Kültür', turizm: 'Turizm', ulasim: 'Ulaşım',
  haberlesme: 'Bilişim', cevre: 'Çevre', konut: 'Konut',
};
export const ikonSvg = (ad, boyut = 20) => `<svg class="ikon" viewBox="0 0 24 24" width="${boyut}" height="${boyut}" aria-hidden="true"><path d="${IKON[ad] ?? IKON.ekonomi}"/></svg>`;

/* ------------------------------------------------------------------ yardımcılar */
const pct = (v) => `%${sayi(v, v < 1 ? 2 : 1)}`;
function ipucu(kap) {
  let el = kap.querySelector('.vt-ipucu');
  if (!el) {
    el = document.createElement('div');
    el.className = 'vt-ipucu';
    kap.appendChild(el);
  }
  return {
    goster(e, html) {
      const r = kap.getBoundingClientRect();
      el.innerHTML = html;
      el.style.opacity = 1;
      const x = e.clientX - r.left;
      const sol = x > r.width * 0.6;
      el.style.left = `${sol ? x - 14 : x + 14}px`;
      el.style.transform = sol ? 'translateX(-100%)' : 'none';
      el.style.top = `${e.clientY - r.top + 14}px`;
    },
    gizle() { el.style.opacity = 0; },
  };
}
/**
 * Düğme ve sekme etiketleri için başlık düzeni (Türkçe title case): her sözcüğün ilk harfi büyük;
 * bağlaçlar (ve, ile, veya, ya, da, de, ki) küçük kalır; GSYH gibi kısaltmalar ve sayılar korunur.
 */
const KUCUK_SOZ = new Set(['ve', 'ile', 'veya', 'ya', 'da', 'de', 'ki']);
export function baslikDuzeni(metin) {
  return String(metin).split(/(\s+|[–\-/(])/).map((p, i) => {
    if (!p || /^\s+$/.test(p) || /^[–\-/(]$/.test(p)) return p;
    if (i > 0 && KUCUK_SOZ.has(p.toLocaleLowerCase('tr'))) return p.toLocaleLowerCase('tr');
    return p.charAt(0).toLocaleUpperCase('tr') + p.slice(1);
  }).join('');
}

let dugmeSayac = 0;
function dugmeler(kap, secenekler, aktif, degisti) {
  const dugme = (s, i = 0) => `<button type="button" data-k="${s.k}" aria-pressed="${s.k === aktif}" style="--i:${i}">${esc(baslikDuzeni(s.ad))}</button>`;
  if (!secenekler.some((s) => s.grup)) {
    kap.innerHTML = secenekler.map((s) => dugme(s)).join('');
    kap.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      kap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      degisti(b.dataset.k);
    });
    return;
  }
  // Gruplu seçim: üstte ana başlıklar (sekme), altta seçilen başlığın alt ölçüleri.
  // Ana başlığın üzerine gelince (fare) ya da tıklayınca alt ölçüler yumuşak bir geçişle açılır.
  const gruplar = [];
  const on = `vt-alt-${++dugmeSayac}`;
  for (const s of secenekler) {
    let g = gruplar.find((x) => x.ad === s.grup);
    if (!g) gruplar.push((g = { ad: s.grup, ss: [] }));
    g.ss.push(s);
  }
  const grupNo = (k) => gruplar.findIndex((g) => g.ss.some((s) => s.k === k));
  let secili = aktif;
  let acik = grupNo(aktif);
  kap.classList.add('vt-secim--gruplu');
  kap.innerHTML = `
    <div class="vt-sekmeler" role="tablist" aria-label="Ana başlıklar">${gruplar.map((g, i) => `
      <button type="button" class="vt-sekme" role="tab" data-g="${i}" aria-selected="${i === acik}" aria-controls="${on}-${i}">
        <span class="vt-sekme-ad">${esc(baslikDuzeni(g.ad))}</span>
      </button>`).join('')}
    </div>
    <div class="vt-alt-kap">${gruplar.map((g, i) => `
      <div class="vt-alt" id="${on}-${i}" role="tabpanel" data-g="${i}" ${i === acik ? '' : 'hidden'}>${g.ss.map((s, j) => dugme(s, j)).join('')}</div>`).join('')}
    </div>`;
  const sekmeler = [...kap.querySelectorAll('.vt-sekme')];
  const paneller = [...kap.querySelectorAll('.vt-alt')];
  const kapAlt = kap.querySelector('.vt-alt-kap');
  const seciliYaz = () => sekmeler.forEach((b, i) => {
    const s = gruplar[i].ss.find((x) => x.k === secili);
    // seçili ölçü sekmede yazılmaz (alt düğmelerde görünüyor); sekme yalnızca vurgulanır
    b.classList.toggle('icerir', !!s);
  });
  const ac = (i) => {
    if (i === acik) return;
    const h0 = kapAlt.offsetHeight;
    sekmeler.forEach((b, j) => b.setAttribute('aria-selected', j === i));
    paneller.forEach((p, j) => {
      p.hidden = j !== i;
      p.classList.toggle('giris', j === i);
    });
    acik = i;
    // yükseklik geçişi: eski yükseklikten yenisine
    const h1 = kapAlt.scrollHeight;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && h0 !== h1) {
      kapAlt.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: 220, easing: 'ease-out' });
    }
  };
  seciliYaz();
  // tıklama: sekme açar, alt düğme ölçüyü seçer
  kap.addEventListener('click', (e) => {
    const sk = e.target.closest('.vt-sekme');
    if (sk) { ac(+sk.dataset.g); return; }
    const b = e.target.closest('.vt-alt button[data-k]');
    if (!b) return;
    kap.querySelectorAll('.vt-alt button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    secili = b.dataset.k;
    seciliYaz();
    degisti(secili);
  });
  // fareyle üzerine gelince aç; alandan çıkınca seçili ölçünün başlığına dön
  const fare = matchMedia('(hover: hover) and (pointer: fine)');
  let tAc;
  let tGeri;
  kap.querySelector('.vt-sekmeler').addEventListener('mouseover', (e) => {
    const sk = e.target.closest('.vt-sekme');
    if (!sk || !fare.matches) return;
    clearTimeout(tAc);
    tAc = setTimeout(() => ac(+sk.dataset.g), 140);
  });
  kap.querySelector('.vt-sekmeler').addEventListener('mouseleave', () => clearTimeout(tAc));
  kap.addEventListener('mouseleave', () => {
    if (!fare.matches) return;
    clearTimeout(tAc);
    tGeri = setTimeout(() => ac(grupNo(secili)), 700);
  });
  kap.addEventListener('mouseenter', () => clearTimeout(tGeri));
  // klavye: sekmeler arasında ok tuşları
  kap.querySelector('.vt-sekmeler').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = (acik + (e.key === 'ArrowRight' ? 1 : -1) + gruplar.length) % gruplar.length;
    ac(i);
    sekmeler[i].focus();
    e.preventDefault();
  });
}
function bolgeLejant(V) {
  return `<div class="vt-lejant">${V.bolgeler.map((b, i) => `<span><i style="background:${BOLGE_RENK[i]}"></i>${esc(b)}</span>`).join('')}</div>`;
}
const genislik = (el) => Math.max(300, el.getBoundingClientRect().width);

/* ================================================================== 1. pasta: ağaç haritası */
// Atlas 1. bölümü (Ekonomik Yoğunlaşma): yalnız ekonomik ölçüler gösterilir
const PASTA_EKONOMI = ['gsyh', 'tarim', 'imalat', 'insaat', 'ticaret', 'bilgi', 'finans', 'ihracat', 'ithalat', 'girisim', 'mevduat', 'kredi', 'elektrik', 'konut', 'turizm'];
const PASTA_GRUP = { elektrik: 'Enerji, konut ve turizm', konut: 'Enerji, konut ve turizm', turizm: 'Enerji, konut ve turizm' };

export function pasta(kap, Vtum) {
  const V = { ...Vtum, pasta: Vtum.pasta.filter((p) => PASTA_EKONOMI.includes(p.anahtar)).map((p) => (PASTA_GRUP[p.anahtar] ? { ...p, grup: PASTA_GRUP[p.anahtar] } : p)) };
  const sec = kap.querySelector('.vt-secim');
  const cumle = kap.querySelector('.vt-cumle');
  const alan = kap.querySelector('.vt-alan');
  kap.querySelector('.vt-lejant-yer').innerHTML = bolgeLejant(V);
  const ip = ipucu(alan);
  let aktif = V.pasta[0].anahtar;
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  // Sağlık ölçülerinde ikinci görünüm: 100 bin kişiye düşen sayı (81 il, sıralı çubuklar)
  const svgOran = select(alan).append('svg').attr('class', 'vt-svg vt-oran-svg').style('display', 'none');
  let gorunum = 'pay';
  const gorunumKap = document.createElement('div');
  gorunumKap.className = 'vt-gorunum';
  gorunumKap.setAttribute('role', 'group');
  gorunumKap.setAttribute('aria-label', 'Görünüm');
  gorunumKap.hidden = true;
  gorunumKap.innerHTML = '<span>Görünüm:</span><button type="button" data-v="pay" aria-pressed="true">Türkiye İçindeki Pay</button><button type="button" data-v="oran" aria-pressed="false">100 Bin Kişiye Düşen</button>';
  alan.parentNode.insertBefore(gorunumKap, alan);
  gorunumKap.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || b.dataset.v === gorunum) return;
    gorunum = b.dataset.v;
    gorunumKap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    ciz(true);
  });
  const ORAN_AD = { hekim: 'hekim sayısı', uzman: 'uzman hekim sayısı', dis: 'diş hekimi sayısı', hemsire: 'hemşire sayısı', eczaci: 'eczacı sayısı', yatak: 'hastane yatağı sayısı' };
  const oranCiz = (olcu) => {
    const w = genislik(alan);
    const h = Math.round(Math.min(460, Math.max(320, w * 0.42)));
    const m = { t: 30, r: 8, b: w > 900 ? 74 : 16, l: 44 };
    svgOran.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    svgOran.selectAll('*').remove();
    const veri = V.iller.map((il, i) => ({ il, v: olcu.oran[i] })).sort((a, b) => b.v - a.v);
    const bw = (w - m.l - m.r) / veri.length;
    const y = scaleLinear().domain([0, Math.max(...veri.map((d) => d.v)) * 1.08]).nice().range([h - m.b, m.t]);
    const g = svgOran.append('g');
    for (const t of y.ticks(5)) {
      g.append('line').attr('class', 'vt-izgara').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(t)).attr('y2', y(t));
      g.append('text').attr('class', 'vt-eksen').attr('x', m.l - 6).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(sayi(t, 0));
    }
    const cubuk = g.selectAll('rect.vt-oran').data(veri).join('rect').attr('class', 'vt-oran')
      .attr('x', (d, i) => m.l + i * bw + 1).attr('width', Math.max(1, bw - 2)).attr('rx', 2)
      .attr('y', h - m.b).attr('height', 0).attr('fill', (d) => BOLGE_RENK[d.il.bolge]);
    cubuk.transition().duration(600).delay((d, i) => i * 6).attr('y', (d) => y(d.v)).attr('height', (d) => h - m.b - y(d.v));
    // geniş ekranda bütün il adları, dar ekranda yalnız ilk ve son üç il
    if (w > 900) {
      g.selectAll('text.vt-oran-ad').data(veri).join('text').attr('class', 'vt-oran-ad')
        .attr('transform', (d, i) => `translate(${m.l + i * bw + bw / 2},${h - m.b + 6}) rotate(-60)`).attr('text-anchor', 'end').attr('dy', '0.32em')
        .text((d) => d.il.ad);
    }
    // en yüksek ve en düşük il: değer (dar ekranda adıyla birlikte), çubuğun yanına yatay
    const cx = (d) => m.l + veri.indexOf(d) * bw + bw / 2;
    const uclar = [{ d: veri[0], ilk: true }, { d: veri.at(-1), ilk: false }];
    g.selectAll('text.vt-oran-uc').data(uclar).join('text').attr('class', 'vt-oran-uc')
      .attr('x', (u) => (u.ilk ? cx(u.d) + bw / 2 + 4 : cx(u.d) + bw / 2)).attr('y', (u) => (u.ilk ? y(u.d.v) + 4 : y(u.d.v) - 34))
      .attr('text-anchor', (u) => (u.ilk ? 'start' : 'end'))
      .text((u) => (w > 900 ? sayi(u.d.v, 1) : `${u.d.il.ad} ${sayi(u.d.v, 1)}`));
    // Türkiye çizgisi
    g.append('line').attr('class', 'vt-oran-tr').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(olcu.trOran)).attr('y2', y(olcu.trOran));
    g.append('text').attr('class', 'vt-oran-tr-ad').attr('x', w - m.r).attr('y', y(olcu.trOran) - 5).attr('text-anchor', 'end')
      .text(`Türkiye ${sayi(olcu.trOran, 1)}`);
    cubuk.on('mousemove', (e, d) => ip.goster(e, `<strong>${esc(d.il.ad)}</strong> · ${esc(V.bolgeler[d.il.bolge])}<br>
        100 bin kişiye düşen ${esc(ORAN_AD[olcu.anahtar])}: ${sayi(d.v, 1)}<br><span class="ikincil">${veri.indexOf(d) + 1}. sırada · Türkiye ${sayi(olcu.trOran, 1)} · ${olcu.yil}</span>`))
      .on('mouseleave', () => ip.gizle());
    const [enY, enD] = [veri[0], veri.at(-1)];
    cumle.innerHTML = `100 bin kişiye düşen ${esc(ORAN_AD[olcu.anahtar])} Türkiye genelinde <strong>${sayi(olcu.trOran, 1)}</strong> olup
      en yüksek değer <strong>${esc(enY.il.ad)}</strong> ilinde (${sayi(enY.v, 1)}), en düşük değer <strong>${esc(enD.il.ad)}</strong> ilinde
      (${sayi(enD.v, 1)}) görülmektedir. En yüksek değer, en düşük değerin ${sayi(enY.v / enD.v, 1)} katıdır.
      ${veri.filter((d) => d.v >= olcu.trOran).length} il Türkiye ortalamasının üzerindedir. <span class="ikincil">${olcu.yil}</span>`;
  };
  // giriş cümlesi veriden: ölçülerin "yarısı N ilde" değerleri ve öne çıkan iller
  const P = Object.fromEntries(V.pasta.map((p) => [p.anahtar, p]));
  const ilAd = (k) => V.iller.find((il) => il.kod === k).ad;
  const yari = (k) => (P[k].yariIl === 1 ? `yarısından fazlası tek bir ilde (${esc(ilAd(P[k].ilk[0][0]))})` : `yarısı ${P[k].yariIl} ilde`);
  const giris = kap.querySelector('.vt-giris');
  if (P.gsyh && P.imalat && P.bilgi && P.mevduat && P.tarim && P.turizm) {
    giris.innerHTML += ` Türkiye GSYH'sinin ${yari('gsyh')}, imalat sanayi katma değerinin ${yari('imalat')}, bilgi ve iletişim katma değerinin ${yari('bilgi')},
      banka mevduatının ${yari('mevduat')} toplanmaktadır. Tarım katma değerinde ${esc(ilAd(P.tarim.ilk[0][0]))}, turist gecelemelerinde ${esc(ilAd(P.turizm.ilk[0][0]))} ilk sırada yer almaktadır.`;
  }
  // "Veri ve yöntem" kutusu seçili ölçüye göre yazılır
  const VERI = {
    nufus: (y) => `TÜİK, Adrese Dayalı Nüfus Kayıt Sistemi (ADNKS) sonuçlarına göre il nüfusları, ${y}.`,
    alan: (y) => `TÜİK, ADNKS il nüfusu ve nüfus yoğunluğu, ${y}.`,
    gsyh: (y) => `TÜİK, Bölgesel Hesaplar: il düzeyinde cari fiyatlarla gayrisafi yurt içi hasıla (GSYH), ${y}.`,
    imalat: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına göre cari fiyatlarla katma değer, imalat sanayi, ${y}.`,
    tarim: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına göre cari fiyatlarla katma değer, tarım, ormancılık ve balıkçılık, ${y}.`,
    bilgi: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına (A10) göre cari fiyatlarla gayrisafi katma değer, "Bilgi ve iletişim" faaliyetleri (NACE Rev.2 J kısmı, 58–63. bölümler), ${y}. Bu kısım yayımcılık; film, televizyon programı ve müzik yapımı; radyo ve televizyon yayıncılığı; telekomünikasyon; bilgisayar programlama ve danışmanlık ile bilgi hizmeti faaliyetlerini kapsamaktadır. Yazılım ve donanım ticareti ile bilgisayar imalatı bu kısma dahil değildir.`,
    insaat: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına (A10) göre cari fiyatlarla gayrisafi katma değer, inşaat (NACE Rev.2 F kısmı), ${y}.`,
    ticaret: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına (A10) göre cari fiyatlarla gayrisafi katma değer, toptan ve perakende ticaret, ulaştırma ve depolama, konaklama ve yiyecek hizmetleri (NACE Rev.2 G, H ve I kısımları), ${y}.`,
    finans: (y) => `TÜİK, Bölgesel Hesaplar: iktisadi faaliyet kollarına (A10) göre cari fiyatlarla gayrisafi katma değer, finans ve sigorta faaliyetleri (NACE Rev.2 K kısmı), ${y}. Finans kuruluşlarının genel müdürlüklerinin bulunduğu il, bu sektörde belirgin biçimde öne çıkmaktadır.`,
    ithalat: (y) => `TÜİK, il bazında toplam ithalat (bin ABD doları), ${y}. İthalat, ithalatçı firmanın kayıtlı olduğu ile göre derlenmektedir; bu nedenle firma merkezlerinin yoğunlaştığı iller yüksek pay almaktadır.`,
    girisim: (y) => `TÜİK, İş Kayıtları: ildeki toplam girişim sayısı, ${y}. Girişim sayısı firma büyüklüğünden bağımsızdır; her girişim bir birim olarak sayılmaktadır.`,
    mevduat: (y) => `Bankacılık Düzenleme ve Denetleme Kurumu (BDDK), illere göre toplam mevduat (bin TL), ${y} yılı sonu. Mevduat, hesabın açıldığı şubenin bulunduğu ile göre sınıflandırılmaktadır.`,
    kredi: (y) => `Bankacılık Düzenleme ve Denetleme Kurumu (BDDK), illere göre toplam nakdi krediler (bin TL), ${y} yılı sonu. Krediler, kullandırıldığı şubenin bulunduğu ile göre sınıflandırılmaktadır.`,
    mezun: (y) => `TÜİK, Ulusal Eğitim İstatistikleri: 15 ve daha yukarı yaştaki nüfus içinde yüksekokul veya fakülte mezunu kişi sayısı, ${y}. Yüksek lisans ve doktora mezunları bu sayıya dahil değildir.`,
    ogrenci: (y) => `TÜİK, yükseköğretim (önlisans ve lisans) öğrenci sayısı, ${y}. Öğrenciler, kayıtlı oldukları yükseköğretim kurumunun bulunduğu ilde sayılmaktadır; açıköğretim öğrencileri de dahil olduğundan açıköğretim fakültesi bulunan iller (ör. Eskişehir) yüksek pay almaktadır.`,
    hekim: (y) => `TÜİK, Sağlık İstatistikleri: toplam hekim sayısı (uzman, pratisyen ve asistan hekimler), ${y}.`,
    uzman: (y) => `TÜİK, Sağlık İstatistikleri: uzman hekim sayısı, ${y}.`,
    dis: (y) => `TÜİK, Sağlık İstatistikleri: diş hekimi sayısı, ${y}.`,
    hemsire: (y) => `TÜİK, Sağlık İstatistikleri: hemşire sayısı, ${y}.`,
    eczaci: (y) => `TÜİK, Sağlık İstatistikleri: eczacı sayısı, ${y}.`,
    yatak: (y) => `TÜİK, Sağlık İstatistikleri: hastane yatak sayısı (Sağlık Bakanlığı, üniversite, özel ve diğer kamu hastaneleri toplamı), ${y}.`,
    elektrik: (y) => `Enerji Piyasası Düzenleme Kurumu (EPDK) verilerinden hesaplanan toplam elektrik üretimi (lisanslı ve lisanssız, GWh), ${y}.`,
    konut: (y) => `TÜİK, Konut Satış İstatistikleri: illere göre toplam konut satış sayısı, ${y}.`,
    muze: (y) => `TÜİK, Kültür ve Turizm Bakanlığına bağlı müze ve ören yerlerinin ziyaretçi sayısı, ${y}.`,
    ihracat: (y) => `TÜİK, faaliyet iline göre ihracat (bin ABD doları), ${y}.`,
    turizm: (y) => `TÜİK, turizm işletme belgeli konaklama tesislerinde toplam geceleme sayısı (yerli ve yabancı), ${y}.`,
  };
  const yontemVeri = kap.querySelector('.vt-yontem-veri');
  const yontemEk = kap.querySelector('.vt-yontem-ek');
  const kaynakEl = kap.querySelector('.vt-kaynak');
  const KAYNAK = { mevduat: 'BDDK', kredi: 'BDDK', elektrik: 'EPDK' };
  const yontemYaz = (olcu) => {
    if (kaynakEl) kaynakEl.textContent = `Kaynak: ${KAYNAK[olcu.anahtar] ?? 'TÜİK'}, Hesaplama: Platform`;
    if (yontemVeri) yontemVeri.innerHTML = `<b>Veri (${esc(olcu.ad)}):</b> ${esc(VERI[olcu.anahtar]?.(olcu.yil) ?? `TÜİK il düzeyi göstergeleri, ${olcu.yil}.`)}`;
    if (yontemEk) {
      yontemEk.textContent = olcu.anahtar === 'alan' ? ' İl yüzölçümü, il nüfusunun nüfus yoğunluğuna bölünmesiyle hesaplanmaktadır.'
        : olcu.oran ? ' "100 bin kişiye düşen" görünümünde değer, ilin toplam sayısının aynı yılın ADNKS il nüfusuna bölünüp 100.000 ile çarpılmasıyla hesaplanmaktadır; sonuçlar TÜİK\'in yayımladığı oranlarla uyumludur.' : '';
    }
  };

  const ciz = (ilk) => {
    const olcu = V.pasta.find((p) => p.anahtar === aktif);
    gorunumKap.hidden = !olcu.oran;
    const oranMi = gorunum === 'oran' && olcu.oran;
    svg.style('display', oranMi ? 'none' : null);
    svgOran.style('display', oranMi ? null : 'none');
    if (oranMi) { oranCiz(olcu); yontemYaz(olcu); return; }
    const w = genislik(alan);
    const h = Math.round(Math.min(560, Math.max(380, w * 0.56)));
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const kok = hierarchy({
      children: V.bolgeler.map((b, bi) => ({
        ad: b, bi,
        children: V.iller.map((il, i) => ({ il, pay: olcu.pay[i] })).filter((d) => d.il.bolge === bi && d.pay > 0),
      })),
    }).sum((d) => d.pay ?? 0).sort((a, b) => b.value - a.value);
    treemap().tile(treemapSquarify.ratio(1.25)).size([w, h]).paddingInner(2).paddingOuter(0).paddingTop((d) => (d.depth === 1 ? 18 : 0)).round(true)(kok);
    const sira = new Map([...V.iller.map((il, i) => [il.kod, olcu.pay[i]])].sort((a, b) => b[1] - a[1]).map(([k], i) => [k, i + 1]));

    // bölge başlıkları
    const bolge = svg.selectAll('g.vt-bolge').data(kok.children, (d) => d.data.ad).join((g) => {
      const e = g.append('g').attr('class', 'vt-bolge');
      e.append('text').attr('class', 'vt-bolge-ad');
      return e;
    });
    bolge.select('text').transition().duration(ilk ? 0 : 700)
      .attr('x', (d) => d.x0 + 3).attr('y', (d) => d.y0 + 13)
      .text((d) => {
        const g = d.x1 - d.x0 - 6;
        const uzun = `${d.data.ad} ${pct(d.value)}`;
        if (uzun.length * 7.2 <= g) return uzun;
        if (d.data.ad.length * 7.2 <= g) return d.data.ad;
        return g > 40 ? `${d.data.ad.slice(0, Math.floor(g / 7.2) - 1)}.` : '';
      });

    const yap = svg.selectAll('g.vt-kutu').data(kok.leaves(), (d) => d.data.il.kod).join((g) => {
      const e = g.append('g').attr('class', 'vt-kutu');
      e.append('rect').attr('rx', 3);
      e.append('text').attr('class', 'vt-kutu-pay').attr('x', 5).attr('y', 15);
      e.append('text').attr('class', 'vt-kutu-ad').attr('x', 5).attr('y', 29);
      return e;
    });
    yap.on('mousemove', (e, d) => ip.goster(e, `<strong>${esc(d.data.il.ad)}</strong> · ${esc(V.bolgeler[d.data.il.bolge])}<br>
        ${esc(olcu.ad)}: Türkiye içindeki payı ${pct(d.data.pay)}<br><span class="ikincil">${sira.get(d.data.il.kod)}. sırada · ${olcu.yil}</span>`))
      .on('mouseleave', () => ip.gizle());
    const t = yap.transition().duration(ilk ? 0 : 700);
    t.attr('transform', (d) => `translate(${d.x0},${d.y0})`);
    t.select('rect').attr('width', (d) => Math.max(0, d.x1 - d.x0)).attr('height', (d) => Math.max(0, d.y1 - d.y0))
      .attr('fill', (d) => BOLGE_RENK[d.data.il.bolge]);
    yap.select('.vt-kutu-pay').text((d) => (d.x1 - d.x0 > 46 && d.y1 - d.y0 > 20 ? pct(d.data.pay) : ''));
    yap.select('.vt-kutu-ad').text((d) => {
      const g = d.x1 - d.x0;
      if (d.y1 - d.y0 < 34 || g < 46) return '';
      const ad = d.data.il.ad;
      return ad.length * 6.3 < g - 8 ? ad : `${ad.slice(0, Math.max(3, Math.floor((g - 10) / 6.5)))}.`;
    });
    const [k1, k2, k3] = olcu.ilk.map(([k, v]) => [V.iller.find((il) => il.kod === k).ad, v]);
    cumle.innerHTML = (olcu.yariIl === 1
      ? `Türkiye ${esc(olcu.cumle)} yarısından fazlası <strong>tek bir ilde</strong> toplanmaktadır: ${esc(k1[0])} (${pct(k1[1])}).
        Bunu ${esc(k2[0])} (${pct(k2[1])}) ve ${esc(k3[0])} (${pct(k3[1])}) izlemektedir.`
      : olcu.anahtar === 'alan'
      ? `Türkiye yüzölçümünün yarısını <strong>${olcu.yariIl} il</strong> kapsamaktadır. İlk sırada ${esc(k1[0])} (${pct(k1[1])})
        yer almakta, bunu ${esc(k2[0])} (${pct(k2[1])}) ve ${esc(k3[0])} (${pct(k3[1])}) izlemektedir.`
      : `Türkiye ${esc(olcu.cumle)} yarısı <strong>${olcu.yariIl} ilde</strong> toplanmaktadır. İlk sırada ${esc(k1[0])} (${pct(k1[1])})
        yer almakta, bunu ${esc(k2[0])} (${pct(k2[1])}) ve ${esc(k3[0])} (${pct(k3[1])}) izlemektedir.`) + ` <span class="ikincil">${olcu.yil}</span>`;
    yontemYaz(olcu);
  };
  dugmeler(sec, V.pasta.map((p) => ({ k: p.anahtar, ad: p.ad, grup: p.grup })), aktif, (k) => { aktif = k; ciz(false); });
  ciz(true);
  return { yenidenCiz: () => ciz(true) };
}

/* ================================================================== 2. birinci: karo harita */
export function birinci(kap, V) {
  const alan = kap.querySelector('.vt-alan');
  const kart = kap.querySelector('.vt-kart');
  const filtre = kap.querySelector('.vt-secim');
  kap.querySelector('.vt-lejant-yer').innerHTML = bolgeLejant(V);
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  const katlar = [...new Set(V.iller.map((il) => il.birinci.ikon))].sort((a, b) => KATEGORI[a].localeCompare(KATEGORI[b], 'tr'));
  let secili = V.iller.find((il) => il.ad === 'Ordu') ?? V.iller[0];
  let kat = 'hepsi';

  const kartYaz = (il) => {
    const b = il.birinci;
    const deg = b.kisi ? `${sayi(b.deger, b.deger < 10 ? 2 : 0)} (bin kişi başına)` : sayi(b.deger, b.deger < 100 ? 1 : 0);
    kart.innerHTML = `<div class="vt-kart-ust" style="--renk:${BOLGE_RENK[il.bolge]}">${ikonSvg(b.ikon, 30)}<span class="vt-sira">${b.sira}.</span></div>
      <p class="vt-kart-il">${esc(il.ad)}</p>
      <p class="vt-kart-gosterge">${esc(b.kisa)}</p>
      <p class="vt-kart-aciklama">81 il içinde ${b.sira === 1 ? esc(b.yon) : `${b.sira}. ${esc(b.yon.replace('en ', 'en '))}`}</p>
      <p class="vt-kart-deger">${deg} <span>· ${b.yil}</span></p>
      <p class="vt-kart-kaynak">${esc(b.gosterge)}</p>`;
  };

  const ciz = () => {
    const w = genislik(alan);
    const { sutun, satir } = V.karo;
    const a = Math.floor(Math.min(w / sutun, 74));
    const bos = a > 40 ? 4 : 2;
    const h = a * satir;
    svg.attr('viewBox', `0 0 ${a * sutun} ${h}`).attr('width', a * sutun).attr('height', h);
    const g = svg.selectAll('g.vt-karo').data(V.iller, (d) => d.kod).join((e) => {
      const k = e.append('g').attr('class', 'vt-karo').attr('tabindex', 0).attr('role', 'button');
      k.append('rect').attr('rx', 5);
      k.append('path').attr('class', 'vt-karo-ikon');
      k.append('text').attr('class', 'vt-karo-ad');
      k.append('text').attr('class', 'vt-karo-sira');
      return k;
    });
    g.attr('transform', (d) => `translate(${d.karo[0] * a + bos / 2},${d.karo[1] * a + bos / 2})`)
      .attr('aria-label', (d) => `${d.ad}: ${d.birinci.kisa}, ${d.birinci.sira}. sıra`)
      .classed('soluk', (d) => kat !== 'hepsi' && d.birinci.ikon !== kat)
      .classed('secili', (d) => d === secili);
    const s = a - bos;
    g.select('rect').attr('width', s).attr('height', s).attr('fill', (d) => BOLGE_RENK[d.bolge]);
    const ik = Math.min(24, s * 0.46);
    g.select('.vt-karo-ikon').attr('d', (d) => IKON[d.birinci.ikon])
      .attr('transform', `translate(${(s - ik) / 2},${a > 40 ? s * 0.16 : (s - ik) / 2}) scale(${ik / 24})`);
    g.select('.vt-karo-ad').attr('x', s / 2).attr('y', s - 6).attr('text-anchor', 'middle')
      .text((d) => (a > 40 ? (d.ad.length > 8 ? `${d.ad.slice(0, 7)}.` : d.ad) : ''));
    g.select('.vt-karo-sira').attr('x', s - 4).attr('y', 11).attr('text-anchor', 'end')
      .text((d) => (a > 40 && d.birinci.sira === 1 ? '1' : ''));
    g.on('mouseenter focus', (e, d) => kartYaz(d))
      .on('mouseleave blur', () => kartYaz(secili))
      .on('click', (e, d) => { secili = d; kartYaz(d); ciz(); });
  };
  filtre.innerHTML = `<button type="button" data-k="hepsi" aria-pressed="true">Hepsi</button>${katlar.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${ikonSvg(k, 14)}${esc(baslikDuzeni(KATEGORI[k]))}</button>`).join('')}`;
  filtre.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    kat = b.dataset.k;
    filtre.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
    ciz();
  });
  const birinciSay = V.iller.filter((il) => il.birinci.sira === 1).length;
  const ilkBesSay = V.iller.filter((il) => il.birinci.sira > 1 && il.birinci.sira <= 5).length;
  kap.querySelector('.vt-cumle').innerHTML = `${birinciSay} il, en az bir göstergede 81 il arasında <strong>birinci</strong> sıradadır.
    Diğer ${V.iller.length - birinciSay} ilin ${ilkBesSay} tanesi en iyi sırada bulunduğu göstergede <strong>ilk beş</strong> içinde yer almaktadır.
    Ayrıntılar için karoların üzerine gelinebilir.`;
  kartYaz(secili);
  ciz();
  return { yenidenCiz: ciz };
}

/* ================================================================== 3. sürü: balonlar */
export function suru(kap, V) {
  const sec = kap.querySelector('.vt-secim');
  const cumle = kap.querySelector('.vt-cumle');
  const alan = kap.querySelector('.vt-alan');
  kap.querySelector('.vt-lejant-yer').innerHTML = `<div class="vt-lejant">${V.oecdSinif.map((s, i) => `<span><i class="yuvarlak" style="background:${OECD_RENK[i]}"></i>${esc(s)}</span>`).join('')}
    <span class="ikincil">Balon büyüklüğü: nüfus (${V.nufusYil})</span></div>`;
  const ip = ipucu(alan);
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  let aktif = V.suru[0].anahtar;
  const konum = new Map();

  const ciz = (ilk) => {
    const e = V.suru.find((x) => x.anahtar === aktif);
    const w = genislik(alan);
    const h = w < 520 ? 340 : 380;
    const m = { l: 16, r: 16, t: 20, b: 40 };
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const veri = V.iller.map((il, i) => ({ il, v: e.deger[i] })).filter((d) => d.v != null);
    const vs = veri.map((d) => d.v);
    const x = scaleLinear().domain([Math.min(...vs), Math.max(...vs)]).nice().range([m.l + 20, w - m.r - 20]);
    const r = scaleSqrt().domain([0, Math.max(...V.iller.map((il) => il.nufus))]).range([0, w < 520 ? 24 : 40]);
    const orta = m.t + (h - m.t - m.b) / 2;
    veri.forEach((d) => {
      const k = konum.get(d.il.kod);
      d.x = k ? k.x : x(d.v);
      d.y = k ? k.y : orta;
      d.r = Math.max(2.5, r(d.il.nufus));
    });
    const sim = forceSimulation(veri).force('x', forceX((d) => x(d.v)).strength(0.9)).force('y', forceY(orta).strength(0.06))
      .force('c', forceCollide((d) => d.r + 1.2).iterations(3)).stop();
    for (let i = 0; i < 260; i++) sim.tick();
    veri.forEach((d) => {
      d.y = Math.max(m.t + d.r, Math.min(h - m.b - d.r, d.y));
      konum.set(d.il.kod, { x: d.x, y: d.y });
    });

    // eksen
    svg.selectAll('g.vt-eksen').data([0]).join('g').attr('class', 'vt-eksen').call((g) => {
      const t = x.ticks(w < 520 ? 4 : 6);
      g.selectAll('line.iz').data(t).join('line').attr('class', 'iz').attr('x1', x).attr('x2', x).attr('y1', m.t).attr('y2', h - m.b);
      g.selectAll('text').data(t).join('text').attr('x', x).attr('y', h - m.b + 18).attr('text-anchor', 'middle').text((v) => sayi(v, e.ondalik > 1 ? 1 : 0));
    });
    const trx = e.tr != null ? x(e.tr) : null;
    svg.selectAll('g.vt-tr').data(trx != null ? [trx] : []).join((g) => {
      const k = g.append('g').attr('class', 'vt-tr');
      k.append('line');
      k.append('text');
      return k;
    }).call((g) => {
      g.select('line').transition().duration(ilk ? 0 : 600).attr('x1', (d) => d).attr('x2', (d) => d).attr('y1', m.t - 6).attr('y2', h - m.b);
      g.select('text').transition().duration(ilk ? 0 : 600).attr('x', (d) => d + 5).attr('y', m.t + 4).text(`Türkiye: ${sayi(e.tr, e.ondalik)} ${e.birim}`);
    });
    svg.selectAll('text.vt-eksen-ad').data([0]).join('text').attr('class', 'vt-eksen-ad').attr('x', w - m.r).attr('y', h - 4).attr('text-anchor', 'end')
      .text(`${e.ad} (${e.birim}, ${e.yil}) →`);

    const b = svg.selectAll('circle.vt-balon').data(veri, (d) => d.il.kod).join((c) => c.append('circle').attr('class', 'vt-balon')
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y));
    b.attr('fill', (d) => (d.il.oecd != null ? OECD_RENK[d.il.oecd] : '#b9b6ad'))
      .on('mousemove', (ev, d) => ip.goster(ev, `<strong>${esc(d.il.ad)}</strong><br>${esc(e.ad)}: ${sayi(d.v, e.ondalik)} ${esc(e.birim)}<br>
        <span class="ikincil">Nüfus ${sayi(d.il.nufus, 0)} · ${esc(V.oecdSinif[d.il.oecd] ?? '')}</span>`))
      .on('mouseleave', () => ip.gizle())
      .transition().duration(ilk ? 0 : 900).attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.r);

    // etiketler: en büyük üç il ve iki uç
    const sirali = [...veri].sort((a2, b2) => a2.v - b2.v);
    const etiket = new Set([sirali[0], sirali.at(-1), ...[...veri].sort((a2, b2) => b2.il.nufus - a2.il.nufus).slice(0, 3)]);
    svg.selectAll('text.vt-balon-ad').data([...etiket], (d) => d.il.kod).join('text').attr('class', 'vt-balon-ad')
      .attr('text-anchor', 'middle')
      .transition().duration(ilk ? 0 : 900)
      .attr('x', (d) => d.x).attr('y', (d) => (d.r > 14 ? d.y + 4 : d.y - d.r - 4))
      .text((d) => d.il.ad);
    const [enAz, enCok] = [sirali[0], sirali.at(-1)];
    const dg = (v) => (e.birim === '%' ? `%${sayi(v, e.ondalik)}` : `${sayi(v, e.ondalik)} ${esc(e.birim)}`);
    cumle.innerHTML = `${esc(e.ad)} göstergesinde en düşük değer <strong>${esc(enAz.il.ad)}</strong> (${dg(enAz.v)}),
      en yüksek değer <strong>${esc(enCok.il.ad)}</strong> (${dg(enCok.v)}) ilindedir. <span class="ikincil">${e.yil}</span>`;
  };
  dugmeler(sec, V.suru.map((s) => ({ k: s.anahtar, ad: s.ad, grup: s.grup })), aktif, (k) => { aktif = k; ciz(false); });
  ciz(true);
  return { yenidenCiz: () => { konum.clear(); ciz(true); } };
}

/* ================================================================== 4. SEGE: 60 yılda gelişmişlik sırası */
const YUKSELEN = '#2a95d0';
const GERILEYEN = '#c8473b';
export function sege(kap, V) {
  const S = V.sege;
  const sec = kap.querySelector('.vt-secim');
  const cumle = kap.querySelector('.vt-cumle');
  const alan = kap.querySelector('.vt-alan');
  const secim = kap.querySelector('.vt-il-sec');
  const ip = ipucu(alan);
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  // konum: 0 = en gelişmiş, 1 = en az gelişmiş (o yıl kaç il varsa ona göre)
  const konum = (sira, j) => (sira - 1) / (S.n[j] - 1);
  const iller = V.iller.map((il, i) => {
    const s = S.sira[i];
    const ilk = s.findIndex((v) => v != null);
    const son = s.length - 1 - [...s].reverse().findIndex((v) => v != null);
    const degisim = s[0] != null && s[son] != null ? konum(s[0], 0) - konum(s[son], son) : null; // + yükseldi
    return { il, s, ilk, son, degisim };
  });
  const eski = iller.filter((d) => d.degisim != null).sort((a, b) => b.degisim - a.degisim);
  const GRUP = {
    yukselen: new Set(eski.slice(0, 6).map((d) => d.il.kod)),
    gerileyen: new Set(eski.slice(-6).map((d) => d.il.kod)),
    zirve: new Set(iller.filter((d) => d.s.every((v, j) => v == null || v <= 5)).map((d) => d.il.kod)),
  };
  let mod = 'yukselen';
  let secili = null;
  secim.innerHTML = `<option value="">İl seçin…</option>${[...V.iller].sort((a, b) => a.ad.localeCompare(b.ad, 'tr')).map((il) => `<option value="${il.kod}">${esc(il.ad)}</option>`).join('')}`;

  const renk = (d) => {
    if (secili === d.il.kod) return MUREKKEP;
    if (mod === 'yukselen' && GRUP.yukselen.has(d.il.kod)) return YUKSELEN;
    if (mod === 'gerileyen' && GRUP.gerileyen.has(d.il.kod)) return GERILEYEN;
    if (mod === 'zirve' && GRUP.zirve.has(d.il.kod)) return BOLGE_RENK[d.il.bolge];
    if (mod === 'bolge') return BOLGE_RENK[d.il.bolge];
    return null;
  };

  const ciz = () => {
    const w = genislik(alan);
    const dar = w < 620;
    const h = dar ? 440 : 520;
    const m = { l: dar ? 64 : 104, r: dar ? 64 : 104, t: 30, b: 26 };
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const x = scaleLinear().domain([S.yillar[0], S.yillar.at(-1)]).range([m.l, w - m.r]);
    const y = scaleLinear().domain([0, 1]).range([m.t, h - m.b]);
    const yol = line().curve(curveBumpX).defined((p) => p[1] != null)
      .x((p) => x(S.yillar[p[0]])).y((p) => y(konum(p[1], p[0])));

    svg.selectAll('g.vt-sege-eksen').data([0]).join('g').attr('class', 'vt-sege-eksen').call((g) => {
      g.selectAll('line').data(S.yillar).join('line').attr('x1', x).attr('x2', x).attr('y1', m.t - 8).attr('y2', h - m.b);
      g.selectAll('text.yil').data(S.yillar).join('text').attr('class', 'yil').attr('x', x).attr('y', m.t - 14).attr('text-anchor', 'middle')
        .text((v, j) => (dar && j % 2 && j !== S.yillar.length - 1 ? '' : v));
      g.selectAll('text.ust').data([0]).join('text').attr('class', 'ust').attr('x', 0).attr('y', m.t - 14).text('↑ en gelişmiş');
      g.selectAll('text.alt').data([0]).join('text').attr('class', 'alt').attr('x', 0).attr('y', h - 6).text('↓ en az gelişmiş');
    });
    const vurgulu = (d) => renk(d) != null;
    const veri = [...iller].sort((a, b) => vurgulu(a) - vurgulu(b) || (secili === a.il.kod) - (secili === b.il.kod));
    svg.selectAll('path.vt-sege-cizgi').data(veri, (d) => d.il.kod).join('path').attr('class', 'vt-sege-cizgi')
      .attr('d', (d) => yol(d.s.map((v, j) => [j, v])))
      .attr('stroke', (d) => renk(d) ?? '#d9d7cf')
      .attr('stroke-width', (d) => (secili === d.il.kod ? 3.5 : vurgulu(d) ? 2.5 : 1.2))
      .attr('stroke-opacity', (d) => (vurgulu(d) ? 1 : mod === 'bolge' ? 0.7 : 0.9))
      .order();
    // görünmez geniş tıklama yolları
    svg.selectAll('path.vt-sege-hedef').data(veri, (d) => d.il.kod).join('path').attr('class', 'vt-sege-hedef')
      .attr('d', (d) => yol(d.s.map((v, j) => [j, v])))
      .on('mousemove', (e, d) => {
        const satir = d.s.map((v, j) => (v == null ? '' : `<tr><td>${S.yillar[j]}</td><td>${v}. / ${S.n[j]}</td></tr>`)).join('');
        ip.goster(e, `<strong>${esc(d.il.ad)}</strong><table class="vt-tablo">${satir}</table>`);
      })
      .on('mouseleave', () => ip.gizle())
      .on('click', (e, d) => { secili = secili === d.il.kod ? null : d.il.kod; secim.value = secili ?? ''; ciz(); });
    // uç etiketleri: vurgulananlar
    const etiketler = [];
    veri.filter(vurgulu).forEach((d) => {
      if (d.s[d.ilk] != null) etiketler.push({ d, x: x(S.yillar[d.ilk]) - 6, y: y(konum(d.s[d.ilk], d.ilk)), yon: 'end', t: `${d.il.ad} ${d.s[d.ilk]}` });
      etiketler.push({ d, x: x(S.yillar[d.son]) + 6, y: y(konum(d.s[d.son], d.son)), yon: 'start', t: `${d.s[d.son]} ${d.il.ad}` });
    });
    // çakışan etiketleri dikeyde aç (her kenar ayrı)
    for (const yon of ['start', 'end']) {
      const k = etiketler.filter((e) => e.yon === yon).sort((a, b) => a.y - b.y);
      for (let i = 1; i < k.length; i++) if (k[i].y - k[i - 1].y < 12) k[i].y = k[i - 1].y + 12;
    }
    svg.selectAll('text.vt-sege-etiket').data(mod === 'bolge' && !secili ? [] : etiketler.filter((e) => mod !== 'bolge' || e.d.il.kod === secili)).join('text').attr('class', 'vt-sege-etiket')
      .attr('x', (e) => e.x).attr('y', (e) => e.y).attr('dy', '0.32em').attr('text-anchor', (e) => e.yon)
      .text((e) => e.t);

    // cümle
    const ad = (d) => esc(d.il.ad);
    const bilgi = (d) => `${S.yillar[d.ilk]} yılında ${S.n[d.ilk]} il arasında ${d.s[d.ilk]}. sırada iken ${S.yillar[d.son]} yılında ${S.n[d.son]} il arasında ${d.s[d.son]}. sıradadır.`;
    if (secili) {
      const d = iller.find((x2) => x2.il.kod === secili);
      cumle.innerHTML = `<strong>${ad(d)}</strong>, ${bilgi(d)}`;
    } else if (mod === 'yukselen') {
      const d = eski[0];
      cumle.innerHTML = `Sıralamada en fazla yükselen il <strong>${ad(d)}</strong> olup ${bilgi(d)} Mavi çizgiler sıralamada en fazla yükselen altı ili göstermektedir.`;
    } else if (mod === 'gerileyen') {
      const d = eski.at(-1);
      cumle.innerHTML = `Sıralamada en fazla gerileyen il <strong>${ad(d)}</strong> olup ${bilgi(d)} Kırmızı çizgiler sıralamada en fazla gerileyen altı ili göstermektedir.`;
    } else if (mod === 'zirve') {
      cumle.innerHTML = `${[...GRUP.zirve].map((k) => ad(iller.find((d) => d.il.kod === k))).join(', ')} illeri, ${S.yillar[0]}–${S.yillar.at(-1)} döneminde yapılan tüm çalışmalarda ilk beş içinde yer almıştır.`;
    } else {
      cumle.innerHTML = 'Çizgiler coğrafi bölgelere göre renklendirilmiştir. Batı ve doğu illeri arasındaki gelişmişlik farkı altmış yılı aşkın dönem boyunca büyük ölçüde korunmuştur.';
    }
  };
  dugmeler(sec, [{ k: 'yukselen', ad: 'Yükselenler' }, { k: 'gerileyen', ad: 'Gerileyenler' }, { k: 'zirve', ad: 'Hep zirvede' }],
    mod, (k) => { mod = k; secili = null; secim.value = ''; ciz(); });
  secim.addEventListener('change', () => { secili = secim.value || null; ciz(); });
  ciz();
  return { yenidenCiz: ciz };
}

/* ================================================================== 5. İliniz nerede? */
export function profil(kap, V) {
  // Düzey seçimi: il (81) ya da Düzey 2 (26). Her düzeyin birimleri, göstergeleri ve benzerleri ayrı.
  const DUZEY = {
    il: { birimler: V.iller, gostergeler: V.profil.gostergeler, benzer: V.profil.benzer, tekil: 'il', cogul: 'iller', Tekil: 'İl' },
    d2: V.profilD2 && { ...V.profilD2, tekil: 'bölge', cogul: 'bölgeler', Tekil: 'Bölge' },
  };
  let duzey = 'il';
  let P = DUZEY.il;
  let B = P.birimler;
  const alan = kap.querySelector('.vt-alan');
  const secim = kap.querySelector('.vt-il-sec');
  const ozet = kap.querySelector('.vt-profil-ozet');
  const ip = ipucu(alan);
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  const secenekYaz = () => {
    const sirali = [...B].sort((a, b) => (duzey === 'il' ? a.ad.localeCompare(b.ad, 'tr') : a.kod.localeCompare(b.kod)));
    secim.innerHTML = sirali.map((b) => `<option value="${b.kod}">${esc(duzey === 'il' ? b.ad : `${b.kod} · ${b.ad}`)}</option>`).join('');
    secim.setAttribute('aria-label', duzey === 'il' ? 'İl seç' : 'Düzey 2 bölgesi seç');
  };
  secenekYaz();
  let i = Math.floor(Math.random() * B.length);
  // düzey düğmeleri (Düzey 2 verisi varsa)
  if (DUZEY.d2) {
    const dz = document.createElement('div');
    dz.className = 'vt-duzey';
    dz.setAttribute('role', 'group');
    dz.setAttribute('aria-label', 'İstatistiki düzey');
    dz.innerHTML = '<button type="button" data-d="il" aria-pressed="true">İl</button><button type="button" data-d="d2" aria-pressed="false">Düzey 2</button>';
    secim.parentNode.insertBefore(dz, secim);
    dz.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.d === duzey) return;
      const eski = B[i];
      duzey = b.dataset.d;
      dz.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      P = DUZEY[duzey];
      B = P.birimler;
      // seçili birim korunur: il → bağlı olduğu Düzey 2 bölgesi; bölge → bölgenin ilk ili
      if (duzey === 'd2') i = Math.max(0, B.findIndex((x) => x.kod === DUZEY.d2.ilUst[V.iller.indexOf(eski)]));
      else i = Math.max(0, V.iller.findIndex((x, n) => DUZEY.d2.ilUst[n] === eski.kod));
      secenekYaz();
      svg.selectAll('*').remove();
      sec(i);
    });
  }
  const siraBul = (g, j) => 1 + g.deger.filter((v) => v != null && v > g.deger[j]).length;

  const sec = (yeni) => { i = yeni; secim.value = B[i].kod; ciz(); };
  secim.addEventListener('change', () => sec(B.findIndex((b) => b.kod === secim.value)));
  ozet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) sec(+b.dataset.i);
  });

  const ciz = () => {
    const il = B[i];
    const w = genislik(alan);
    const dar = w < 640;
    const solG = dar ? 0 : 230;
    const sagG = dar ? 0 : 190;
    const satir = dar ? 66 : 46;
    const h = P.gostergeler.length * satir + 8;
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const g = svg.selectAll('g.vt-profil-satir').data(P.gostergeler, (d) => d.kisa).join((e) => {
      const k = e.append('g').attr('class', 'vt-profil-satir');
      k.append('line').attr('class', 'taban');
      k.append('path').attr('class', 'vt-profil-ikon');
      k.append('text').attr('class', 'ad');
      k.append('line').attr('class', 'tr');
      k.append('g').attr('class', 'noktalar');
      k.append('circle').attr('class', 'secili');
      k.append('text').attr('class', 'deger');
      return k;
    });
    g.attr('transform', (d, j) => `translate(0,${j * satir + 4})`);
    g.each(function (d, j) {
      const k = select(this);
      const x0 = solG + 12;
      const x1 = w - sagG - 12;
      const vs = d.deger.filter((v) => v != null);
      const x = (d.log ? scaleLog() : scaleLinear()).domain([Math.min(...vs), Math.max(...vs)]).range([x0, x1]);
      const yc = dar ? 40 : satir / 2;
      k.select('.taban').attr('x1', x0).attr('x2', x1).attr('y1', yc).attr('y2', yc);
      k.select('.vt-profil-ikon').attr('d', IKON[d.ikon]).attr('transform', `translate(0,${(dar ? 4 : yc - 9)}) scale(0.75)`);
      k.select('.ad').attr('x', 24).attr('y', dar ? 16 : yc).attr('dy', '0.32em').text(d.kisa);
      k.select('.tr').attr('x1', d.tr != null ? x(d.tr) : -99).attr('x2', d.tr != null ? x(d.tr) : -99).attr('y1', yc - 11).attr('y2', yc + 11);
      k.select('.noktalar').selectAll('circle').data(d.deger.map((v, n) => ({ v, n })).filter((p) => p.v != null)).join('circle')
        .attr('cx', (p) => x(p.v)).attr('cy', yc).attr('r', 4)
        .on('mousemove', (e, p) => ip.goster(e, `<strong>${esc(B[p.n].ad)}</strong><br>${esc(d.kisa)}: ${sayi(p.v, d.ondalik)} ${esc(d.birim)}`))
        .on('mouseleave', () => ip.gizle())
        .on('click', (e, p) => sec(p.n));
      const v = d.deger[i];
      k.select('.secili').attr('cy', yc).attr('fill', BOLGE_RENK[il.bolge]).attr('r', 8)
        .transition().duration(600).attr('cx', v != null ? x(v) : -99);
      const sira = v != null ? siraBul(d, i) : null;
      const metin = v == null ? 'veri yok' : `${sayi(v, d.ondalik)} ${d.birim} · ${sira}./${B.length}`;
      if (dar) k.select('.deger').attr('x', w).attr('y', 16).attr('dy', '0.32em').attr('text-anchor', 'end').text(metin);
      else k.select('.deger').attr('x', w - sagG + 4).attr('y', yc).attr('dy', '0.32em').attr('text-anchor', 'start').text(metin);
    });
    // özet
    const ust = P.gostergeler.filter((d) => d.tr != null && d.deger[i] != null && d.deger[i] > d.tr).length;
    const say = P.gostergeler.filter((d) => d.tr != null && d.deger[i] != null).length;
    const ilk3 = P.gostergeler.map((d) => ({ d, s: d.deger[i] != null ? siraBul(d, i) : 99 })).sort((a, b) => a.s - b.s).slice(0, 2);
    ozet.innerHTML = `<p class="vt-profil-il" style="--renk:${BOLGE_RENK[il.bolge]}"><i></i>${duzey === 'd2' ? `${esc(il.kod)} · ` : ''}${esc(il.ad)} <span>${esc(V.bolgeler[il.bolge])}</span></p>
      <p>${P.Tekil}, ${say} göstergenin <strong>${ust} tanesinde</strong> Türkiye değerinin üzerindedir. En üst sırada yer aldığı göstergeler: ${ilk3.map((x2) => `${esc(x2.d.kisa.toLocaleLowerCase('tr'))} (${x2.s}. sıra)`).join(', ')}.</p>
      <p class="vt-benzer">Göstergeler bakımından en çok benzediği ${P.cogul}: ${P.benzer[i].map((j) => `<button type="button" data-i="${j}">${esc(duzey === 'd2' ? `${B[j].kod} ${B[j].ad}` : B[j].ad)}</button>`).join(' ')}</p>`;
  };
  secim.value = B[i].kod;
  ciz();
  return { yenidenCiz: ciz };
}

/* ================================================================== 6. Türkiye 100 kişi olsaydı */
const YUZ_RENK = ['#2a95d0', '#d6981b', '#c8473b', '#009a8a', '#8566c4']; // doğrulandı: komşu çiftler CVD ≥ 10,7, normal ≥ 19,8
const KISI = 'M10 1a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9ZM4 12h12a2.5 2.5 0 0 1 2.5 2.5V25h-3.2v13h-3.6V27h-3.4v11H4.7V25H1.5V14.5A2.5 2.5 0 0 1 4 12Z';
const birim = (g) => (g.taban === 'hanehalkı' ? 'hane' : 'kişi');
function kimlerYaz(g, c) {
  const cins = c === 'Kadın' ? 'kadın ' : c === 'Erkek' ? 'erkek ' : '';
  if (g.taban === 'hanehalkı') return 'Türkiye\'deki hanehalkları';
  if (g.taban === 'çalışanlar') return `istihdam edilen ${cins}nüfus`;
  if (g.taban === 'nüfus') return 'Türkiye nüfusu';
  return `15 ve daha yukarı yaştaki ${cins}nüfus`;
}
export function yuzKisi(kap, V) {
  const sec = kap.querySelector('.vt-secim');
  const cins = kap.querySelector('.vt-cinsiyet');
  const cumle = kap.querySelector('.vt-cumle');
  const alan = kap.querySelector('.vt-alan');
  const lejant = kap.querySelector('.vt-yuz-lejant');
  const ip = ipucu(alan);
  const svg = select(alan).append('svg').attr('class', 'vt-svg');
  let aktif = V.yuz[0].anahtar;
  let cinsiyet = 'Hepsi';

  const renkler = (g) => (g.anahtar === 'bolge' ? BOLGE_RENK : YUZ_RENK);
  const adetler = (g) => (cinsiyet !== 'Hepsi' && g.cinsiyet ? g.cinsiyet[cinsiyet] : g.kategoriler);

  const ciz = (ilk) => {
    const g = V.yuz.find((x) => x.anahtar === aktif);
    cins.hidden = !g.cinsiyet;
    if (!g.cinsiyet) cinsiyet = 'Hepsi';
    cins.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.k === cinsiyet));
    const a = adetler(g);
    const R = renkler(g);
    const kim = [];
    a.forEach((k, j) => { for (let n = 0; n < k.adet; n++) kim.push(j); });
    const tw = genislik(kap.querySelector('.vt-yuz-ikili'));
    const w = tw > 900 ? tw - 300 : tw;
    const dar = w < 560;
    const sut = dar ? 10 : 20;
    const sat = 100 / sut;
    const kw = Math.min(dar ? 34 : 30, (w - 4) / sut);
    const kh = kw * 1.9;
    svg.attr('viewBox', `0 0 ${sut * kw} ${sat * kh}`).attr('width', sut * kw).attr('height', sat * kh);
    const konum = (n) => (dar ? [n % sut, Math.floor(n / sut)] : [Math.floor(n / sat), n % sat]); // geniş ekranda sütun sütun dolar
    const olcek = (kw - 4) / 20;
    svg.selectAll('path.vt-kisi').data(kim.map((j, n) => ({ n, j })), (d) => d.n).join('path').attr('class', 'vt-kisi')
      .attr('d', KISI)
      .attr('transform', (d) => { const [c, r] = konum(d.n); return `translate(${c * kw + 2},${r * kh + 3}) scale(${olcek})`; })
      .on('mousemove', (e, d) => ip.goster(e, `<strong>${esc(g.kategoriler[d.j].ad)}</strong><br>100 ${birim(g)}de ${a[d.j].adet} (${pct(a[d.j].oran)})`))
      .on('mouseleave', () => ip.gizle())
      .transition().duration(ilk ? 0 : 500).delay((d) => (ilk ? 0 : d.n * 6))
      .attr('fill', (d) => R[d.j]);
    lejant.innerHTML = g.kategoriler.map((k, j) => `<div class="vt-yuz-satir"><i style="background:${R[j]}"></i><b>${a[j].adet}</b><span>${esc(k.ad)}</span></div>`).join('');
    const kimler = kimlerYaz(g, cinsiyet);
    let ek = '';
    if (g.cinsiyet && cinsiyet === 'Hepsi') {
      const [kd, er] = [g.cinsiyet.Kadın, g.cinsiyet.Erkek];
      const j = g.vurgu ?? (g.anahtar === 'egitim' ? 0 : 3);
      ek = ` "${esc(g.kategoriler[j].ad)}" grubunda ${g.taban === 'çalışanlar' ? 'çalışan ' : ''}100 kadından ${kd[j].adet}, 100 erkekten ${er[j].adet} kişi yer almaktadır. Kadın ve erkek nüfus ilgili düğmelerle ayrı ayrı incelenebilir.`;
    }
    cumle.innerHTML = `${kimler.charAt(0).toLocaleUpperCase('tr') + kimler.slice(1)} 100 ${birim(g)} ile temsil edildiğinde dağılım şöyledir: ${g.kategoriler.map((k, j) => `${esc(k.ad.toLocaleLowerCase('tr'))} <strong>${a[j].adet}</strong>`).join(', ')}.${ek} <span class="ikincil">${g.yil}</span>`;
  };
  dugmeler(sec, V.yuz.map((g) => ({ k: g.anahtar, ad: g.ad, grup: g.grup })), aktif, (k) => { aktif = k; ciz(false); });
  cins.innerHTML = ['Hepsi', 'Kadın', 'Erkek'].map((c) => `<button type="button" data-k="${c}" aria-pressed="${c === cinsiyet}">${c}</button>`).join('');
  cins.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    cinsiyet = b.dataset.k;
    ciz(false);
  });
  ciz(true);
  return { yenidenCiz: () => ciz(true) };
}

/* ================================================================== 7. Zaman çizelgesi */
const ZAMAN_GRUP = [
  { ad: 'Ekonomi', ikonlar: ['ekonomi', 'ticaret'], renk: '#2a95d0' },
  { ad: 'Nüfus ve aile', ikonlar: ['nufus', 'aile'], renk: '#d6981b' },
  { ad: 'Eğitim ve sağlık', ikonlar: ['egitim', 'saglik'], renk: '#c8473b' }, // üçü bütün çiftlerde doğrulandı
];
const grupBul = (ikon) => ZAMAN_GRUP.find((g) => g.ikonlar.includes(ikon)) ?? ZAMAN_GRUP[0];
function kucukSeri(o, renk) {
  const w = 200;
  const h = 54;
  const m = { l: 4, r: 4, t: 10, b: 14 };
  const xs = o.seri.map((p) => p[0]);
  const vs = o.seri.map((p) => p[1]);
  const x = scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([m.l, w - m.r]);
  const y = scaleLinear().domain([Math.min(...vs), Math.max(...vs)]).range([h - m.b, m.t]);
  const d = o.seri.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const v = o.seri.find((p) => p[0] === o.vurgu);
  return `<svg class="vt-kucuk" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(o.baslik)} serisi">
    <path d="${d}" fill="none" stroke="#9d9b94" stroke-width="1.6"/>
    ${v ? `<circle cx="${x(v[0])}" cy="${y(v[1])}" r="4.5" fill="${renk}" stroke="#fff" stroke-width="1.5"/>` : ''}
    <text x="${m.l}" y="${h - 2}">${xs[0]}</text><text x="${w - m.r}" y="${h - 2}" text-anchor="end">${xs.at(-1)}</text></svg>`;
}
export function zaman(kap, V) {
  const Z = V.zaman;
  const seritAlan = kap.querySelector('.vt-zaman-serit');
  const liste = kap.querySelector('.vt-zaman-liste');
  kap.querySelector('.vt-lejant-yer').innerHTML = `<div class="vt-lejant">${ZAMAN_GRUP.map((g) => `<span><i class="yuvarlak" style="background:${g.renk}"></i>${esc(baslikDuzeni(g.ad))}</span>`).join('')}</div>`;
  liste.innerHTML = Z.map((o, n) => {
    const g = grupBul(o.ikon);
    return `<li class="vt-olay" id="vt-olay-${n}" style="--renk:${g.renk}">
      <p class="vt-olay-yil">${o.yil}</p>
      <span class="vt-olay-ikon">${ikonSvg(o.ikon, 18)}</span>
      <div class="vt-olay-metin"><h3>${esc(o.baslik)}</h3><p>${esc(o.metin)}</p></div>
      ${kucukSeri(o, g.renk)}
    </li>`;
  }).join('');
  liste.classList.add('kisa');
  const dugme = document.createElement('button');
  dugme.type = 'button';
  dugme.className = 'vt-zaman-tumu';
  dugme.textContent = `Bütün dönüm noktalarını göster (${Z.length})`;
  dugme.addEventListener('click', () => { liste.classList.remove('kisa'); dugme.remove(); });
  liste.after(dugme);
  const svg = select(seritAlan).append('svg').attr('class', 'vt-svg');
  const ip = ipucu(seritAlan);
  const ciz = () => {
    const w = genislik(seritAlan);
    const h = 96;
    const m = { l: 18, r: 18 };
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h);
    const x = scaleLinear().domain([2000, 2025]).range([m.l, w - m.r]);
    const taban = 70;
    svg.selectAll('line.eksen').data([0]).join('line').attr('class', 'eksen').attr('x1', m.l).attr('x2', w - m.r).attr('y1', taban).attr('y2', taban);
    const t = w < 520 ? [2000, 2010, 2020, 2025] : [2000, 2005, 2010, 2015, 2020, 2025];
    svg.selectAll('text.yil').data(t).join('text').attr('class', 'yil').attr('x', x).attr('y', taban + 18).attr('text-anchor', 'middle').text((d) => d);
    const yigin = {};
    const noktalar = Z.map((o, n) => {
      const k = (yigin[o.yil] = (yigin[o.yil] ?? 0) + 1);
      return { o, n, x: x(o.yil), y: taban - 12 - (k - 1) * 18 };
    });
    svg.selectAll('line.sap').data(noktalar).join('line').attr('class', 'sap').attr('x1', (d) => d.x).attr('x2', (d) => d.x).attr('y1', taban).attr('y2', (d) => d.y);
    svg.selectAll('circle.vt-zaman-nokta').data(noktalar).join('circle').attr('class', 'vt-zaman-nokta')
      .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', 7).attr('fill', (d) => grupBul(d.o.ikon).renk)
      .on('mousemove', (e, d) => ip.goster(e, `<strong>${d.o.yil}</strong><br>${esc(d.o.baslik)}`))
      .on('mouseleave', () => ip.gizle())
      .on('click', (e, d) => {
        liste.classList.remove('kisa');
        kap.querySelector('.vt-zaman-tumu')?.remove();
        const el = document.getElementById(`vt-olay-${d.n}`);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.remove('parla');
        void el.offsetWidth;
        el.classList.add('parla');
      });
  };
  ciz();
  return { yenidenCiz: ciz };
}
