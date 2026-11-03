/**
 * Ana sayfa atlas düzeni: bölüm özet cümleleri (veriden), bölüm kartları ve yapışkan bölüm menüsü.
 *
 * Bölüm başlıkları index.html'de sabittir; başlığın altındaki özet cümleleri vitrin.json ve esitsizlik.json'dan
 * üretilir, böylece veri güncellendiğinde sayılar kendiliğinden yenilenir. (Mesajın yönü değişirse başlık elle
 * gözden geçirilmelidir.)
 */
import { sayi } from './format.js';
import { select } from 'd3-selection';
import { geoMercator, geoPath } from 'd3-geo';
import { scaleQuantile, scaleLinear } from 'd3-scale';
import { area, line } from 'd3-shape';
import { BOLGE_RENK } from './vitrin.js';

const $ = (s, k = document) => k.querySelector(s);

/** Bölüm özetleri: { anahtar: { uzun, kisa } } */
export function atlasOlgulari(V, E) {
  const o = {};
  const pasta = Object.fromEntries((V.pasta || []).map((p) => [p.anahtar, p]));
  const ilk5 = (p) => p.pay.slice().sort((a, b) => b - a).slice(0, 5).reduce((t, v) => t + v, 0);
  if (pasta.gsyh && pasta.nufus) {
    const g = pasta.gsyh;
    const uzunEk = pasta.mevduat ? ` Hizmetlerde yoğunlaşma daha belirgindir: banka mevduatının yarısı yalnızca <strong>${pasta.mevduat.yariIl}</strong> ilde toplanmaktadır.` : '';
    o.yogunlasma = {
      uzun: `${g.yil} yılında en büyük beş il Türkiye GSYH'sinin <strong>%${sayi(ilk5(g), 0)}</strong> kadarını üretmektedir; en kalabalık beş ilde ise nüfusun <strong>%${sayi(ilk5(pasta.nufus), 0)}</strong> kadarı yaşamaktadır.${uzunEk}`,
      kisa: `GSYH'nin yarısı ${g.yariIl} ilde üretiliyor`,
    };
  }
  // farklar: Theil seyri + SEGE alt basamakların kalıcılığı
  const parca = [];
  let kisa2 = '';
  if (E?.seriler?.theil_il) {
    const t = E.seriler.theil_il;
    const y = Object.keys(t).sort();
    const a = y[0], b = y[y.length - 1];
    const dus = 100 * (1 - t[b] / t[a]);
    parca.push(`İller arası kişi başı GSYH eşitsizliği (Theil endeksi) ${a}–${b} döneminde <strong>%${sayi(dus, 0)}</strong> azalmıştır.`);
    kisa2 = `Eşitsizlik ${a}–${b} döneminde %${sayi(dus, 0)} azaldı`;
  }
  if (V.sege?.sira) {
    const { sira, n, yillar } = V.sege;
    const son = sira[0].length - 1;
    const alt = sira.filter((r) => r[0] != null && r[0] >= n[0] - 9);
    const kalan = alt.filter((r) => r[son] != null && r[son] >= n[son] - 19).length;
    parca.push(`Buna karşın ${yillar[0]} yılında en az gelişmiş on il arasında yer alan illerin <strong>${kalan}</strong> tanesi ${yillar[son]} yılında da son yirmi il arasındadır.`);
  }
  if (parca.length) o.farklar = { uzun: parca.join(' '), kisa: kisa2 || 'Gelişmişlik sıralaması, 1963–2025' };
  // dönüşüm
  const oz = V.ozet || {};
  const yas = (V.yuz || []).find((y) => y.anahtar === 'yas');
  const yasli = yas?.kategoriler?.find((k) => /65/.test(k.ad));
  if (oz.ortancaYas) {
    o.donusum = {
      uzun: `${oz.ortancaYas.yil} yılında Türkiye'de ortanca yaş <strong>${sayi(oz.ortancaYas.deger, 1)}</strong> düzeyindedir${yasli ? `; 65 yaş ve üzeri nüfusun payı <strong>%${sayi(yasli.oran, 1)}</strong> olmuştur` : ''}. Yaş yapısı, hane büyüklüğü ve eğitim düzeyi son yirmi beş yılda belirgin biçimde değişmiş; bu dönüşüm iller arasında farklı hızlarda yaşanmaktadır.`,
      kisa: `Ortanca yaş ${sayi(oz.ortancaYas.deger, 1)}`,
    };
  }
  // iller
  if (V.iller?.length) {
    const bir = V.iller.filter((il) => il.birinci?.sira === 1).length;
    o.iller = {
      uzun: `81 ilin <strong>${bir}</strong> tanesi en az bir göstergede Türkiye'de birinci sıradadır. Bu bölümde illerin öne çıktığı göstergeler, illerin farklı göstergelerdeki konumu ve seçilen bir ilin ya da bölgenin bütün göstergelerdeki yeri incelenebilir.`,
      kisa: `${bir} il en az bir göstergede birinci`,
    };
  }
  return o;
}

export function atlasDoldur(V, E) {
  const o = atlasOlgulari(V, E);
  document.querySelectorAll('[data-olgu]').forEach((el) => { const x = o[el.dataset.olgu]; if (x) el.innerHTML = x.uzun; });
  document.querySelectorAll('[data-olgu-kisa]').forEach((el) => { const x = o[el.dataset.olguKisa]; if (x) el.textContent = x.kisa; });
}

/** Yapışkan bölüm menüsü: kapak kartları geçilince görünür, etkin bölümü işaretler. */
export function atlasMenusu() {
  const menu = $('#atlas-menu'), kartlar = $('#atlas-kartlar');
  if (!menu || !kartlar || !('IntersectionObserver' in window)) return;
  const linkler = [...menu.querySelectorAll('a')];
  const bolumler = linkler.map((a) => $(a.getAttribute('href'))).filter(Boolean)
    .concat([...document.querySelectorAll('[data-bolum]')]);
  const goster = (g) => { menu.classList.toggle('gorunur', g); document.body.classList.toggle('atlas-menu-acik', g); };
  // kartlar görünürken menü gizli; kartlar yukarı çıktıktan sonra ve Analiz Masası geçişine kadar görünür
  let kartAsildi = false, sonaGelindi = false;
  new IntersectionObserver(([e]) => { kartAsildi = !e.isIntersecting && e.boundingClientRect.top < 0; goster(kartAsildi && !sonaGelindi); }).observe(kartlar);
  const gecis = $('#gecis');
  if (gecis) new IntersectionObserver(([e]) => { sonaGelindi = e.isIntersecting || e.boundingClientRect.top < 0; goster(kartAsildi && !sonaGelindi); }).observe(gecis);
  const etkin = new Map();
  const io = new IntersectionObserver((girdiler) => {
    for (const g of girdiler) etkin.set(g.target, g.isIntersecting);
    const acik = bolumler.filter((b) => etkin.get(b)).pop();
    const id = acik && (acik.dataset.bolum || acik.id);
    if (id) linkler.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${id}`)));
  }, { rootMargin: '-45% 0px -50% 0px' });
  bolumler.forEach((b) => io.observe(b));
}

/* ------------------------------------------------------------------ kapak haritası ve kart görselleri */

const KAPAK_GOSTERGE = ['gsyh', 'universite', 'yas', 'dogurganlik', 'otomobil'];
const KAPAK_RENK = ['#f3e3d3', '#e2b48f', '#cc8058', '#a8502e', '#6e2a14'];
const azalt = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Kapak: il haritası, birkaç gösterge arasında kendiliğinden geçer (hareket azaltma tercihinde durur). */
export function atlasKapak(V, geo) {
  const kap = $('#atlas-hero-harita');
  if (!kap || !geo) return;
  const olculer = KAPAK_GOSTERGE.map((k) => V.suru.find((s) => s.anahtar === k)).filter(Boolean);
  if (!olculer.length) return;
  const sira = new Map(V.iller.map((il, i) => [il.kod, i]));
  const svg = select(kap).select('svg');
  const W = 640, H = 290;
  svg.attr('viewBox', `0 0 ${W} ${H}`);
  const yol = geoPath(geoMercator().fitSize([W, H], geo));
  const yollar = svg.selectAll('path').data(geo.features, (f) => f.id).join('path').attr('d', yol);
  const ip = document.createElement('div');
  ip.className = 'ahh-ipucu';
  kap.appendChild(ip);
  let i = 0, zaman = null, kullanici = false;
  const nokta = select(kap).select('.ahh-noktalar');
  nokta.selectAll('button').data(olculer).join('button').attr('type', 'button').attr('aria-label', (o) => o.ad).attr('title', (o) => o.ad)
    .on('click', (e, o) => { kullanici = true; clearInterval(zaman); goster(olculer.indexOf(o)); });
  function goster(n) {
    i = n;
    const o = olculer[i];
    const deger = (kod) => o.deger[sira.get(kod)];
    const olcek = scaleQuantile().domain(o.deger.filter((v) => v != null)).range(KAPAK_RENK);
    yollar.attr('fill', (f) => { const v = deger(f.id); return v == null ? '#ececec' : olcek(v); })
      .on('mousemove', (e, f) => {
        const v = deger(f.id); const il = V.iller[sira.get(f.id)];
        if (v == null || !il) return;
        ip.innerHTML = `<b>${il.ad}</b><br>${o.ad}: ${sayi(v, o.ondalik)}${o.birim ? ` ${o.birim}` : ''}`;
        const r = kap.getBoundingClientRect();
        ip.style.left = `${e.clientX - r.left + 12}px`; ip.style.top = `${e.clientY - r.top + 12}px`; ip.style.opacity = 1;
      })
      .on('mouseleave', () => { ip.style.opacity = 0; });
    $('.ahh-ad', kap).textContent = o.ad;
    $('.ahh-alt', kap).textContent = `${o.yil} · Türkiye ${sayi(o.tr, o.ondalik)}${o.birim ? ` ${o.birim}` : ''}`;
    const q = olcek.quantiles();
    $('.ahh-lejant', kap).innerHTML = `<span>Düşük</span>${KAPAK_RENK.map((r, k) => `<i style="background:${r}" title="${k === 0 ? `${sayi(Math.min(...o.deger.filter((v) => v != null)), o.ondalik)}–${sayi(q[0], o.ondalik)}` : k === KAPAK_RENK.length - 1 ? `${sayi(q[k - 1], o.ondalik)} ve üzeri` : `${sayi(q[k - 1], o.ondalik)}–${sayi(q[k], o.ondalik)}`}"></i>`).join('')}<span>Yüksek</span>`;
    nokta.selectAll('button').attr('aria-pressed', (x, k) => String(k === i));
  }
  goster(0);
  if (!azalt()) {
    zaman = setInterval(() => { if (!kullanici && !document.hidden) goster((i + 1) % olculer.length); }, 5000);
    kap.addEventListener('mouseenter', () => { kullanici = true; });
    kap.addEventListener('mouseleave', () => { kullanici = false; });
  }
}

/** Bölüm kartlarının küçük görselleri */
export function atlasKartGorselleri(V, E, AV) {
  const W = 220, H = 76;
  const ciz = (anahtar, f) => {
    const el = document.querySelector(`[data-kart-gorsel="${anahtar}"]`);
    if (!el) return;
    const svg = select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('aria-hidden', 'true');
    try { f(svg); } catch (e) { console.warn('kart görseli', anahtar, e); el.remove(); }
  };
  // 1: GSYH payları, en büyük beş il vurgulu
  ciz('yogunlasma', (svg) => {
    const p = V.pasta.find((x) => x.anahtar === 'gsyh');
    const pay = p.pay.slice().sort((a, b) => b - a);
    const x = scaleLinear().domain([0, pay.reduce((t, v) => t + v, 0)]).range([0, W]);
    let c = 0;
    svg.selectAll('rect').data(pay).join('rect').attr('x', (v) => { const s = x(c); c += v; return s; }).attr('y', 32).attr('height', 30)
      .attr('width', (v) => Math.max(0.5, x(v) - 1)).attr('fill', (v, k) => (k < 5 ? '#a8502e' : '#e2d6c6'));
    const ilk5 = pay.slice(0, 5).reduce((t, v) => t + v, 0);
    svg.append('text').attr('class', 'akg-etiket').attr('x', 0).attr('y', 20).text(`İlk 5 il %${sayi(ilk5, 0)}`);
    svg.append('text').attr('class', 'akg-etiket soluk').attr('x', W).attr('y', 20).attr('text-anchor', 'end').text('76 il');
  });
  // 2: Theil seyri
  ciz('farklar', (svg) => {
    const t = E?.seriler?.theil_il; if (!t) throw new Error('theil yok');
    const d = Object.keys(t).sort().map((y) => [+y, t[y]]);
    const x = scaleLinear().domain([d[0][0], d.at(-1)[0]]).range([2, W - 2]);
    const y = scaleLinear().domain([0, Math.max(...d.map((v) => v[1]))]).range([H - 4, 18]);
    svg.append('path').attr('d', area().x((v) => x(v[0])).y0(H - 4).y1((v) => y(v[1]))(d)).attr('fill', '#f3e3d3');
    svg.append('path').attr('d', line().x((v) => x(v[0])).y((v) => y(v[1]))(d)).attr('fill', 'none').attr('stroke', '#a8502e').attr('stroke-width', 2);
    svg.append('text').attr('class', 'akg-etiket').attr('x', 0).attr('y', 12).text(`${d[0][0]}`);
    svg.append('text').attr('class', 'akg-etiket').attr('x', W).attr('y', 12).attr('text-anchor', 'end').text(`${d.at(-1)[0]}`);
  });
  // 3: yüz kişi, yaş grupları
  ciz('donusum', (svg) => {
    const yas = V.yuz.find((y) => y.anahtar === 'yas');
    const renk = ['#7fa9bb', '#d9cbb8', '#a8502e'];
    const noktalar = yas.kategoriler.flatMap((k, j) => Array.from({ length: k.adet }, () => j));
    const sut = 20, r = 3.4, ax = (W - 8) / (sut - 1), ay = 13;
    svg.selectAll('circle').data(noktalar).join('circle').attr('cx', (v, k) => 4 + (k % sut) * ax).attr('cy', (v, k) => 12 + Math.floor(k / sut) * ay)
      .attr('r', r).attr('fill', (v) => renk[v]);
  });
  // 4: karo harita, coğrafi bölge renkleri
  ciz('iller', (svg) => {
    const iller = V.iller.filter((il) => il.karo);
    const mx = Math.max(...iller.map((il) => il.karo[0])) + 1, my = Math.max(...iller.map((il) => il.karo[1])) + 1;
    const a = Math.min(W / mx, H / my), ox = (W - a * mx) / 2, oy = (H - a * my) / 2;
    svg.selectAll('rect').data(iller).join('rect').attr('x', (il) => ox + il.karo[0] * a + 0.6).attr('y', (il) => oy + il.karo[1] * a + 0.6)
      .attr('width', a - 1.2).attr('height', a - 1.2).attr('rx', 1.2).attr('fill', (il) => BOLGE_RENK[il.bolge] ?? '#ccc').attr('opacity', 0.85);
  });
  // 5: Avrupa bölgeleri, Türkiye vurgulu
  ciz('avrupa', (svg) => {
    const b = (AV?.bolgeler || []).filter((r) => r.x != null && r.y != null);
    if (!b.length) throw new Error('avrupa verisi yok');
    const yuzde = (a, q) => { const t = a.slice().sort((m, n) => m - n); return t[Math.floor(q * (t.length - 1))]; };
    const xs = b.map((r) => r.x), ys = b.map((r) => r.y);
    const x0 = yuzde(xs, 0.02), x1 = yuzde(xs, 0.995), y0 = yuzde(ys, 0.02), y1 = yuzde(ys, 0.98);
    b.splice(0, b.length, ...b.filter((r) => r.x >= x0 && r.x <= x1 && r.y >= y0 && r.y <= y1));
    const s = Math.min((W - 8) / (x1 - x0), (H - 8) / (y1 - y0));
    const ox = (W - s * (x1 - x0)) / 2, oy = (H - s * (y1 - y0)) / 2;
    const tr = (r) => r.u === 'TR';
    svg.selectAll('circle').data(b.sort((p, q) => tr(p) - tr(q))).join('circle').attr('cx', (r) => ox + (r.x - x0) * s).attr('cy', (r) => oy + (r.y - y0) * s)
      .attr('r', (r) => (tr(r) ? 2.6 : 2)).attr('fill', (r) => (tr(r) ? '#a8502e' : '#b9b4aa'));
  });
}
