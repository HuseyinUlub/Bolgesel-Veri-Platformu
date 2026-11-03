/**
 * Ana sayfa 2.2: "2000'den Bu Yana İller Arası Gelir Farkının Seyri".
 *
 * World Bank Data360 Atlas anlatım biçimi: sağda yapışkan tek bir grafik, solda kısa metin kartları. Grafik her adımda
 * bir öğe ekleyerek kurulur (ilk yıl noktası → en hızlı düşüş dönemi → bütün seri ve fark → bileşenler); metindeki renkli
 * vurgular grafikteki öğelerle aynı renktedir. İkinci grafik nüfusun en zengin ve en yoksul yüzde yirmilik dilimlerini,
 * son adım illerin Türkiye ortalamasına göre haritasını gösterir. Bütün sayılar esitsizlik.json'dan üretilir.
 *
 * Veri: public/veri/esitsizlik.json (pipeline/turetilmis/esitsizlik.py), il sınırları.
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { geoMercator, geoPath } from 'd3-geo';
import { scaleLinear } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { geometri } from './data.js';
import { sayi, esc } from './format.js';

const RENK = { theil: '#1f5f7a', donem: '#efd9c9', arasi: '#1f5f7a', ici: '#9cc0d1', ust: '#a8502e', alt: '#1f5f7a', tr: '#8c8c8c' };
const IKI_YON = ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'];
const azalt = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cip = (renk, metin, acik = false) => `<span class="es-cip${acik ? ' acik' : ''}" style="--c:${renk}">${metin}</span>`;
const sirali = (s) => Object.keys(s).sort().map((y) => [+y, s[y]]);

export function esitsizlikIskeleti() {
  return `
    <div class="as-kap es-kap">
      <div class="as-sahne" aria-live="polite">
        <div class="as-sahne-ust">
          <div><div class="as-sahne-baslik es-baslik"></div><div class="as-sahne-alt es-alt"></div></div>
          <nav class="as-ilerleme es-ilerleme" aria-label="Adımlar"></nav>
        </div>
        <div class="as-alan es-alan"><svg role="img"></svg><div class="as-ipucu"></div></div>
        <div class="as-lejant es-lejant"></div>
      </div>
      <div class="as-adimlar es-adimlar"></div>
    </div>
    <details class="yontem es-yontem"><summary>Veri ve Yöntem</summary><div class="yontem-metin">
      <p><b>Veri:</b> TÜİK il kişi başına GSYH (2000–2024) ve ADNKS il nüfusu (2007 sonrası).</p>
      <p><b>Yöntem:</b> Tanımlarda OECD <em>Regions and Cities at a Glance</em> Tablo 2.2 esas alınmıştır. Theil endeksi illerin kişi başı
        GSYH'sinden hesaplanır; bütün iller aynı gelir düzeyinde olsaydı sıfır olurdu. Endeks, 12 Düzey 1 bölgesi arasındaki fark ve bölgelerin
        kendi illeri arasındaki fark olarak iki bileşene ayrılır; bileşenlerin toplamı il düzeyi endekse eşittir. Yüzde yirmilik dilimler,
        iller kişi başı GSYH'ye göre sıralanıp nüfusun yüzde yirmisine ulaşılana kadar birleştirilerek oluşturulur (nüfus eşdeğeri).
        Kutuplaşma, en zengin dilimin kişi başı gelirinin en yoksul dilimin gelirine oranıdır.</p>
      <p><b>Kaynak:</b> TÜİK; Hesaplama: Platform. Ayrıntılı açıklama için <a href="ok-olcme.html#theil">Kalkınma Okuryazarlığı: Theil Endeksi</a>.</p>
    </div></details>`;
}

/** En büyük düşüşün yaşandığı n yıllık aralık */
function enHizliDusus(T, n = 2) {
  let en = null;
  for (let i = n; i < T.length; i++) {
    const d = T[i][1] - T[i - n][1];
    if (!en || d < en[0]) en = [d, T[i - n][0], T[i][0]];
  }
  return en.slice(1);
}

export function esitsizlikSahne(kok, E) {
  const $ = (s) => kok.querySelector(s);
  const S = E.seriler;
  const T = sirali(S.theil_il), AR = sirali(S.arasi), IC = sirali(S.ici);
  const UST = sirali(S.ust20_il), ALT = sirali(S.alt20_il);
  const [y0, v0] = T[0], [y1, v1] = T.at(-1);
  const [d0, d1] = enHizliDusus(T);
  const azalis = 100 * (1 - v1 / v0);
  const pay = S.arasi_pay[String(y1)];
  const K = S.kutup_il;
  const ky = Object.keys(K).sort();
  const H = E.haritalar.gsyh_endeks_il;
  const hy = Object.keys(H).sort().at(-1);
  const hv = Object.values(H[hy]);
  const ustSay = hv.filter((x) => x >= 100).length, yarimSay = hv.filter((x) => x < 50).length;

  const ADIM = [
    { g: 'theil', metin: `<p>${y0} yılında illerin kişi başı GSYH'leri arasındaki farkı özetleyen ${cip(RENK.theil, 'Theil endeksi')} <strong>${sayi(v0, 3)}</strong> düzeyindeydi.</p>
        <p class="es-kucuk">Endeks, bütün iller aynı gelire sahip olsaydı sıfır olurdu; değer büyüdükçe fark açılır.</p>` },
    { g: 'theil', metin: `<p>Endeks izleyen yıllarda geriledi. En belirgin düşüş ${cip(RENK.donem, `${d0}–${d1} döneminde`, true)} yaşandı.</p>` },
    { g: 'theil', metin: `<p>${y1} yılında endeks <strong>${sayi(v1, 3)}</strong> düzeyine indi. Bu, ${y0} yılına göre ${cip(RENK.ust, `yaklaşık %${sayi(azalis, 0)} azalma`)} anlamına geliyor.</p>` },
    { g: 'theil', metin: `<p>Eşitsizliğin ${cip(RENK.arasi, `%${sayi(pay, 0)}`)} kadarı Düzey 1 bölgeleri arasındaki farktan, ${cip(RENK.ici, `%${sayi(100 - pay, 0)}`, true)} kadarı ise bölgelerin kendi illeri arasındaki farktan kaynaklanıyor.</p>
        <p class="es-kucuk">Gelir farkı öncelikle batı–doğu ayrımı gibi büyük bölgeler arasında ortaya çıkıyor.</p>` },
    { g: 'dilim', metin: `<p>Nüfusun en zengin yüzde yirmisini barındıran illerde kişi başı gelir, ${UST.at(-1)[0]} yılında ${cip(RENK.ust, `Türkiye ortalamasının ${sayi(UST.at(-1)[1], 2)} katı`)} düzeyinde.</p>` },
    { g: 'dilim', metin: `<p>En yoksul yüzde yirmide ise oran ${cip(RENK.alt, sayi(ALT.at(-1)[1], 2))}. İki dilim arasındaki fark ${ky[0]} yılında <strong>${sayi(K[ky[0]], 1)} kat</strong> iken ${ky.at(-1)} yılında <strong>${sayi(K[ky.at(-1)], 1)} kat</strong> düzeyine geriledi.</p>
        <p class="es-kucuk">Yakınsama esas olarak alt dilimdeki illerin Türkiye ortalamasına yaklaşmasından kaynaklanıyor.</p>` },
    { g: 'harita', metin: `<p>Yine de ${hy} yılında 81 ilin yalnızca <strong>${ustSay}</strong> tanesinde kişi başı GSYH ${cip(IKI_YON[4], 'Türkiye ortalamasının üzerinde')}; <strong>${yarimSay}</strong> ilde ise ${cip(IKI_YON[0], 'ortalamanın yarısının altında')}.</p>` },
  ];

  const adimlar = $('.es-adimlar');
  adimlar.innerHTML = ADIM.map((a, i) => `<section class="as-adim" data-i="${i}"><div class="as-adim-ic es-kart">${a.metin}</div></section>`).join('');
  const ilerleme = $('.es-ilerleme');
  ilerleme.innerHTML = ADIM.map((a, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}. adım">${i + 1}</button>`).join('');
  ilerleme.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) adimlar.children[+b.dataset.i].scrollIntoView({ behavior: azalt() ? 'auto' : 'smooth', block: 'center' });
  });

  const alan = $('.es-alan');
  const svg = select(alan).select('svg');
  const ipucu = $('.es-alan .as-ipucu');
  let aktif = -1, geo = null;
  geometri('province').then((g) => { geo = g; if (ADIM[aktif]?.g === 'harita') { const j = aktif; aktif = -1; ciz(j, false); } }).catch(() => {});

  /* ---- çizim yardımcıları ---- */
  function cerceve(xd, yd, yAd, bicim) {
    const r = alan.getBoundingClientRect();
    const W = Math.max(320, r.width), Hh = Math.max(260, r.height);
    const m = { t: 18, r: 132, b: 28, l: 48 };
    svg.attr('viewBox', `0 0 ${W} ${Hh}`).selectAll('*').remove();
    const x = scaleLinear().domain(xd).range([m.l, W - m.r]);
    const y = scaleLinear().domain(yd).nice().range([Hh - m.b, m.t]);
    const g = svg.append('g').attr('class', 'as-eksen');
    for (const t of y.ticks(5)) {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t));
      g.append('text').attr('x', m.l - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(bicim(t));
    }
    for (let t = Math.ceil(xd[0] / 4) * 4; t <= xd[1]; t += 4) g.append('text').attr('x', x(t)).attr('y', Hh - m.b + 18).attr('text-anchor', 'middle').text(t);
    svg.append('text').attr('class', 'as-eksen-ad').attr('x', m.l).attr('y', m.t - 6).text(yAd);
    return { x, y, W, H: Hh, m, ust: svg.append('g') };
  }
  const ciz_cizgi = (c, veri, renk, anim, gecikme = 0) => {
    const p = c.ust.append('path').datum(veri).attr('fill', 'none').attr('stroke', renk).attr('stroke-width', 2.6)
      .attr('stroke-linecap', 'round').attr('d', line().curve(curveMonotoneX).x((d) => c.x(d[0])).y((d) => c.y(d[1])));
    if (anim && !azalt()) {
      const L = p.node().getTotalLength();
      p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().delay(gecikme).duration(1300).attr('stroke-dashoffset', 0);
    }
    return p;
  };
  const nokta = (c, [x, y], renk, etiket, yon = 'sag', anim = false) => {
    const g = c.ust.append('g');
    g.append('circle').attr('cx', c.x(x)).attr('cy', c.y(y)).attr('r', 5).attr('fill', renk).attr('stroke', 'var(--zemin)').attr('stroke-width', 2);
    if (etiket) g.append('text').attr('class', 'es-etiket').attr('x', c.x(x) + (yon === 'sag' ? 9 : -9)).attr('y', c.y(y)).attr('dy', '-0.6em')
      .attr('text-anchor', yon === 'sag' ? 'start' : 'end').style('fill', renk).text(etiket);
    if (anim && !azalt()) g.style('opacity', 0).transition().duration(500).style('opacity', 1);
    return g;
  };
  const sagEtiket = (c, xv, yv, renk, ust, alt) => {
    const t = c.ust.append('text').attr('class', 'es-etiket').attr('x', c.x(xv) + 10).attr('y', c.y(yv)).attr('dy', '0.32em').style('fill', renk);
    t.append('tspan').attr('font-weight', 600).text(ust);
    if (alt) t.append('tspan').attr('x', c.x(xv) + 10).attr('dy', '1.2em').attr('class', 'es-etiket-alt').text(alt);
    return t;
  };
  const kose = (c, xv, a, b, metin, renk = 'var(--metin)', anim = false) => {
    const g = c.ust.append('g').attr('class', 'es-fark');
    const xx = c.x(xv);
    g.append('line').attr('x1', xx).attr('x2', xx).attr('y1', c.y(a)).attr('y2', c.y(b)).attr('stroke', renk).attr('stroke-width', 1.4);
    for (const v of [a, b]) g.append('line').attr('x1', xx - 5).attr('x2', xx + 5).attr('y1', c.y(v)).attr('y2', c.y(v)).attr('stroke', renk).attr('stroke-width', 1.4);
    g.append('text').attr('class', 'es-etiket').attr('x', xx + 9).attr('y', (c.y(a) + c.y(b)) / 2).attr('dy', '0.32em').style('fill', renk).attr('font-weight', 600).text(metin);
    if (anim && !azalt()) g.style('opacity', 0).transition().delay(300).duration(500).style('opacity', 1);
  };

  /* ---- adım çizimleri ---- */
  function theil(i, anim) {
    const ymax = Math.max(...T.map((d) => d[1]));
    const c = cerceve([y0, y1], [0, ymax * 1.12], 'Theil endeksi', (t) => sayi(t, 2));
    if (i >= 1 && i < 3) {
      const b = c.ust.append('rect').attr('x', c.x(d0)).attr('width', c.x(d1) - c.x(d0)).attr('y', c.m.t).attr('height', c.H - c.m.t - c.m.b).attr('fill', RENK.donem);
      c.ust.append('text').attr('class', 'es-etiket-alt').attr('x', (c.x(d0) + c.x(d1)) / 2).attr('y', c.m.t + 14).attr('text-anchor', 'middle').text('En hızlı düşüş');
      if (anim && i === 1 && !azalt()) b.style('opacity', 0).transition().duration(500).style('opacity', 1);
    }
    if (i >= 3) {
      const yig = AR.map(([yy, a], k) => ({ y: yy, a, i: IC[k]?.[1] ?? 0 }));
      const alanA = c.ust.append('path').datum(yig).attr('fill', RENK.arasi).attr('opacity', 0.85)
        .attr('d', area().curve(curveMonotoneX).x((d) => c.x(d.y)).y0(c.y(0)).y1((d) => c.y(d.a)));
      const alanI = c.ust.append('path').datum(yig).attr('fill', RENK.ici).attr('opacity', 0.9)
        .attr('d', area().curve(curveMonotoneX).x((d) => c.x(d.y)).y0((d) => c.y(d.a)).y1((d) => c.y(d.a + d.i)));
      if (anim && !azalt()) [alanA, alanI].forEach((p, k) => p.style('opacity', 0).transition().delay(k * 250).duration(700).style('opacity', 0.88));
      const son = yig.at(-1);
      sagEtiket(c, y1, son.a / 2, RENK.arasi, `Bölgeler arası %${sayi(pay, 0)}`);
      sagEtiket(c, y1, son.a + son.i / 2 + ymax * 0.06, '#4f8199', `Bölge içi %${sayi(100 - pay, 0)}`);
    }
    if (i === 0) nokta(c, T[0], RENK.theil, `${y0}: ${sayi(v0, 3)}`, 'sag', anim);
    if (i >= 1) {
      const kadar = i === 1 ? T.filter((d) => d[0] <= d1) : T;
      ciz_cizgi(c, kadar, RENK.theil, anim && (i === 1 || i === 2));
      nokta(c, T[0], RENK.theil, i < 3 ? `${y0}: ${sayi(v0, 3)}` : null);
    }
    if (i === 2) {
      c.ust.append('line').attr('x1', c.x(y0)).attr('x2', c.x(y1)).attr('y1', c.y(v0)).attr('y2', c.y(v0)).attr('stroke', RENK.tr).attr('stroke-dasharray', '3 4');
      nokta(c, T.at(-1), RENK.theil, `${y1}: ${sayi(v1, 3)}`, 'sol', anim);
      kose(c, y1, v0, v1, `−%${sayi(azalis, 0)}`, RENK.ust, anim);
    }
    $('.es-baslik').textContent = "Kişi Başına GSYH'de İller Arası Eşitsizlik (Theil Endeksi)";
    $('.es-lejant').innerHTML = i >= 3
      ? `<span><i style="background:${RENK.arasi}"></i>Düzey 1 bölgeleri arası</span><span><i style="background:${RENK.ici}"></i>Bölgelerin kendi illeri arası</span>`
      : `<span><i style="background:${RENK.theil}"></i>Theil endeksi, 81 il</span>`;
  }

  function dilim(i, anim) {
    const xd = [UST[0][0], UST.at(-1)[0]];
    const c = cerceve(xd, [0, Math.max(...UST.map((d) => d[1])) * 1.15], 'Türkiye ortalamasına oran (Türkiye = 1)', (t) => sayi(t, 1));
    c.ust.append('line').attr('x1', c.x(xd[0])).attr('x2', c.x(xd[1])).attr('y1', c.y(1)).attr('y2', c.y(1)).attr('stroke', RENK.tr).attr('stroke-dasharray', '3 4');
    c.ust.append('text').attr('class', 'es-etiket-alt').attr('x', c.x(xd[1]) + 10).attr('y', c.y(1)).attr('dy', '0.32em').text('Türkiye ortalaması');
    ciz_cizgi(c, UST, RENK.ust, anim && i === 4);
    sagEtiket(c, xd[1], UST.at(-1)[1], RENK.ust, `En zengin %20: ${sayi(UST.at(-1)[1], 2)}`);
    if (i >= 5) {
      ciz_cizgi(c, ALT, RENK.alt, anim);
      sagEtiket(c, xd[1], ALT.at(-1)[1], RENK.alt, `En yoksul %20: ${sayi(ALT.at(-1)[1], 2)}`);
      kose(c, xd[0] + 0.4, UST[0][1], ALT[0][1], `${sayi(K[ky[0]], 1)} kat`, 'var(--ikincil)', anim);
      kose(c, xd[1] - 1.2, UST.at(-1)[1], ALT.at(-1)[1], `${sayi(K[ky.at(-1)], 1)} kat`, 'var(--metin)', anim);
    }
    $('.es-baslik').textContent = 'Nüfusun En Zengin ve En Yoksul Yüzde Yirmisi: Kişi Başına GSYH';
    $('.es-lejant').innerHTML = `<span><i style="background:${RENK.ust}"></i>En zengin %20 (nüfus)</span>${i >= 5 ? `<span><i style="background:${RENK.alt}"></i>En yoksul %20 (nüfus)</span>` : ''}<span><i style="background:${RENK.tr}"></i>Türkiye ortalaması</span>`;
  }

  function harita(anim) {
    svg.selectAll('*').remove();
    $('.es-baslik').textContent = `Kişi Başına GSYH Endeksi (Türkiye = 100), ${hy}`;
    const esik = [50, 85, 115, 150];
    const renk = (x) => IKI_YON[esik.filter((e) => x >= e).length];
    $('.es-lejant').innerHTML = ['< 50', '50–85', '85–115', '115–150', '≥ 150'].map((t, k) => `<span><i style="background:${IKI_YON[k]};border-radius:2px"></i>${t}</span>`).join('');
    if (!geo) return;
    const r = alan.getBoundingClientRect();
    const W = Math.max(320, r.width), Hh = Math.max(240, r.height);
    svg.attr('viewBox', `0 0 ${W} ${Hh}`);
    const yol = geoPath(geoMercator().fitExtent([[6, 6], [W - 6, Hh - 6]], geo));
    const p = svg.selectAll('path').data(geo.features, (f) => f.id).join('path').attr('class', 'es-birim').attr('d', yol)
      .attr('fill', (f) => (H[hy][f.id] != null ? renk(H[hy][f.id]) : '#e6e5df'))
      .on('pointermove', (ev, f) => {
        const v = H[hy][f.id];
        ipucu.innerHTML = `<strong>${esc(f.properties?.ad ?? f.id)}</strong><br>${v != null ? sayi(v, 0) : 'veri yok'}`;
        const k = alan.getBoundingClientRect();
        let x = ev.clientX - k.left + 12;
        if (x > k.width - 200) x -= 220;
        ipucu.style.transform = `translate(${x}px,${ev.clientY - k.top + 12}px)`;
        ipucu.style.opacity = 1;
      })
      .on('pointerleave', () => { ipucu.style.opacity = 0; });
    if (anim && !azalt()) p.style('opacity', 0).transition().duration(600).style('opacity', 1);
  }

  function ciz(i, anim = true) {
    if (i === aktif) return;
    const onceki = aktif;
    aktif = i;
    adimlar.querySelectorAll('.as-adim').forEach((el, j) => el.classList.toggle('aktif', j === i));
    ilerleme.querySelectorAll('button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    $('.es-alt').textContent = 'Kaynak: TÜİK; Hesaplama: Platform';
    const ileri = anim && i > onceki; // geri kaydırırken yeniden canlandırma yapılmaz
    const g = ADIM[i].g;
    if (g === 'theil') theil(i, ileri);
    else if (g === 'dilim') dilim(i, ileri);
    else harita(ileri);
  }

  const io = new IntersectionObserver((ents) => ents.forEach((e) => e.isIntersecting && ciz(+e.target.dataset.i)), { rootMargin: '-45% 0px -45% 0px' });
  adimlar.querySelectorAll('.as-adim').forEach((el) => io.observe(el));
  ciz(0, false);
  let zt;
  window.addEventListener('resize', () => { clearTimeout(zt); zt = setTimeout(() => { const j = aktif; aktif = -1; ciz(j, false); }, 200); });
}
