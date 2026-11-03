/**
 * Ana sayfa 3.2: "Demografik Dönüşüm Adım Adım" — 2.2 ile aynı anlatım biçimi (yapışkan tek grafik, kısa kartlar,
 * her adımda grafiğe bir öğe eklenir; metindeki renkli vurgular grafikteki öğelerle aynı renktedir).
 *
 * Adımlar: doğurganlık (yenilenme düzeyiyle) → ortanca yaş → hanehalkı büyüklüğü → illerde ortanca yaş ve doğurganlık.
 * Veri: public/veri/vitrin.json (zaman serileri ve il değerleri; tools/vitrin/vitrin_verisi.py). Sayılar veriden üretilir.
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { scaleLinear } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import { sayi, esc } from './format.js';

const R = { ana: '#1f5f7a', esik: '#a8502e', golge: '#f3e3d3', il: '#c9c3b6', yuksek: '#a8502e', yasli: '#1f5f7a', tr: '#8c8c8c' };
const azalt = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cip = (renk, metin, acik = false) => `<span class="es-cip${acik ? ' acik' : ''}" style="--c:${renk}">${metin}</span>`;

export function demografiSahne(kok, V) {
  if (!kok) return;
  const bul = (re) => V.zaman?.find((z) => re.test(z.baslik));
  const DOG = bul(/doğurganlık/i), YAS = bul(/Ortanca yaş/i), HANE = bul(/hanehalkı büyüklüğü/i);
  const SY = V.suru.find((s) => s.anahtar === 'yas'), SD = V.suru.find((s) => s.anahtar === 'dogurganlik');
  if (!DOG || !YAS || !HANE || !SY || !SD) { kok.remove(); return; }
  const D = DOG.seri, Y = YAS.seri, Hn = HANE.seri;
  const ilk = (s) => s[0], son = (s) => s.at(-1);
  const asim = (s, esik, yon) => s.find(([, v]) => (yon < 0 ? v < esik : v > esik))?.[0];
  const yas30 = asim(Y, 30, 1), hane35 = asim(Hn, 3.5, -1);
  const iller = V.iller.map((il, i) => ({ ad: il.ad, bolge: V.bolgeler?.[il.bolge], x: SY.deger[i], y: SD.deger[i] })).filter((d) => d.x != null && d.y != null);
  const yuksek = iller.filter((d) => d.y >= 2.1).sort((a, b) => b.y - a.y);
  const yasli = iller.filter((d) => d.x >= 40).sort((a, b) => b.x - a.x);
  const yasliEsik = yasli.length >= 3 ? 40 : Math.round(iller.map((d) => d.x).sort((a, b) => b - a)[4]);
  const yasliler = iller.filter((d) => d.x >= yasliEsik).sort((a, b) => b.x - a.x);
  const bolgeSay = new Map(); yasliler.forEach((d) => d.bolge && bolgeSay.set(d.bolge, (bolgeSay.get(d.bolge) ?? 0) + 1));
  const [enBolge, enSay] = [...bolgeSay].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

  const ADIM = [
    { g: 'dog', metin: `<p>${ilk(D)[0]} yılında Türkiye'de kadın başına ortalama ${cip(R.ana, `${sayi(ilk(D)[1], 2)} çocuk`)} doğuyordu. Bu, nüfusun kendini yenileyebilmesi için gereken ${cip(R.esik, '2,1 düzeyine')} çok yakındı.</p>` },
    { g: 'dog', metin: `<p>${son(D)[0]} yılında doğurganlık hızı ${cip(R.ana, sayi(son(D)[1], 2))} düzeyine geriledi. Türkiye artık ${cip(R.golge, 'yenilenme düzeyinin belirgin biçimde altında', true)} bulunuyor.</p>` },
    { g: 'yas', metin: `<p>Daha az çocuk, daha uzun yaşam: nüfus yaşlanıyor. Ortanca yaş ${yas30 ? `${yas30} yılında ${cip(R.esik, '30 yaşı')} aştı ve ` : ''}${son(Y)[0]} yılında ${cip(R.ana, sayi(son(Y)[1], 1))} oldu.</p>
        <p class="es-kucuk">Ortanca yaş, nüfusu yaşa göre iki eşit gruba ayıran yaştır.</p>` },
    { g: 'hane', metin: `<p>Haneler de küçülüyor. Ortalama hanehalkı büyüklüğü ${ilk(Hn)[0]} yılında ${sayi(ilk(Hn)[1], 1)} kişi iken${hane35 ? ` ${hane35} yılında ${cip(R.esik, '3,5 kişinin altına')} indi ve` : ''} ${son(Hn)[0]} yılında ${cip(R.ana, `${sayi(son(Hn)[1], 1)} kişi`)} oldu.</p>` },
    { g: 'il', metin: `<p>Ancak bu dönüşüm iller arasında aynı hızda yaşanmıyor. Her nokta bir ili gösteriyor: ${cip('#2f2f2f', 'Türkiye')} ortalamasının iki yanında çok farklı demografik yapılar var.</p>` },
    { g: 'il', metin: `<p>Yalnızca ${cip(R.yuksek, `${yuksek.length} il`)} yenilenme düzeyinin üzerinde; bunların başında ${esc(yuksek.slice(0, 3).map((d) => d.ad).join(', '))} geliyor. Öte yandan ortanca yaşı ${yasliEsik} ve üzerinde olan ${cip(R.yasli, `${yasliler.length} il`)} var${enBolge ? `; bunların <strong>${enSay}</strong> tanesi ${esc(enBolge)} bölgesinde yer alıyor` : ''}.</p>
        <p class="es-kucuk">Genç nüfuslu illerde okul ve istihdam, yaşlanan illerde sağlık ve bakım hizmetleri öncelik kazanıyor.</p>` },
  ];

  kok.insertAdjacentHTML('beforeend', `
    <div class="as-kap es-kap">
      <div class="as-sahne" aria-live="polite">
        <div class="as-sahne-ust">
          <div><div class="as-sahne-baslik dm-baslik"></div><div class="as-sahne-alt">Kaynak: TÜİK; Hesaplama: Platform</div></div>
          <nav class="as-ilerleme dm-ilerleme" aria-label="Adımlar">${ADIM.map((a, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}. adım">${i + 1}</button>`).join('')}</nav>
        </div>
        <div class="as-alan es-alan dm-alan"><svg role="img"></svg><div class="as-ipucu"></div></div>
        <div class="as-lejant dm-lejant"></div>
      </div>
      <div class="as-adimlar dm-adimlar">${ADIM.map((a, i) => `<section class="as-adim" data-i="${i}"><div class="as-adim-ic es-kart">${a.metin}</div></section>`).join('')}</div>
    </div>
    <details class="yontem es-yontem"><summary>Veri ve Yöntem</summary><div class="yontem-metin">
      <p><b>Veri:</b> TÜİK Doğum İstatistikleri (toplam doğurganlık hızı), Adrese Dayalı Nüfus Kayıt Sistemi (ortanca yaş, ortalama hanehalkı büyüklüğü).
        İl değerleri: ortanca yaş ${esc(SY.yil)}, toplam doğurganlık hızı ${esc(SD.yil)}.</p>
      <p><b>Yöntem:</b> Toplam doğurganlık hızı, bir kadının doğurganlık çağı boyunca sahip olması beklenen ortalama çocuk sayısıdır; 2,1 nüfusun
        kendini yenileme düzeyi kabul edilir. Eşik yılları veriden bulunur: serinin eşiği ilk aştığı yıl. Ayrıntı için
        <a href="ok-kavramlar.html#demografi">Kalkınma Okuryazarlığı: Doğurganlık ve Ortanca Yaş</a>.</p>
    </div></details>`);
  const $ = (s) => kok.querySelector(s);
  const adimlar = $('.dm-adimlar'), ilerleme = $('.dm-ilerleme'), alan = $('.dm-alan'), ipucu = $('.dm-alan .as-ipucu');
  const svg = select(alan).select('svg');
  ilerleme.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) adimlar.children[+b.dataset.i].scrollIntoView({ behavior: azalt() ? 'auto' : 'smooth', block: 'center' });
  });

  function cerceve(xd, yd, yAd, bicim, { xAd, xBicim = (t) => t, xAdim = 4 } = {}) {
    const r = alan.getBoundingClientRect();
    const W = Math.max(320, r.width), H = Math.max(260, r.height);
    const m = { t: 18, r: 132, b: xAd ? 40 : 28, l: 48 };
    svg.attr('viewBox', `0 0 ${W} ${H}`).selectAll('*').remove();
    const x = scaleLinear().domain(xd).range([m.l, W - m.r]);
    const y = scaleLinear().domain(yd).nice().range([H - m.b, m.t]);
    const g = svg.append('g').attr('class', 'as-eksen');
    for (const t of y.ticks(5)) {
      g.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t));
      g.append('text').attr('x', m.l - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(bicim(t));
    }
    const xt = xAd ? x.ticks(6) : []; if (!xAd) for (let t = Math.ceil(xd[0] / xAdim) * xAdim; t <= xd[1]; t += xAdim) xt.push(t);
    for (const t of xt) g.append('text').attr('x', x(t)).attr('y', H - m.b + 18).attr('text-anchor', 'middle').text(xBicim(t));
    svg.append('text').attr('class', 'as-eksen-ad').attr('x', m.l).attr('y', m.t - 6).text(yAd);
    if (xAd) svg.append('text').attr('class', 'as-eksen-ad').attr('x', W - m.r).attr('y', H - 4).attr('text-anchor', 'end').text(xAd);
    return { x, y, W, H, m, ust: svg.append('g') };
  }
  const cizgi = (c, s, renk, anim) => {
    const p = c.ust.append('path').datum(s).attr('fill', 'none').attr('stroke', renk).attr('stroke-width', 2.6).attr('stroke-linecap', 'round')
      .attr('d', line().curve(curveMonotoneX).x((d) => c.x(d[0])).y((d) => c.y(d[1])));
    if (anim && !azalt()) { const L = p.node().getTotalLength(); p.attr('stroke-dasharray', `${L} ${L}`).attr('stroke-dashoffset', L).transition().duration(1300).attr('stroke-dashoffset', 0); }
  };
  const nokta = (c, [xv, yv], renk, etiket, yon = 'sag', anim = false) => {
    const g = c.ust.append('g');
    g.append('circle').attr('cx', c.x(xv)).attr('cy', c.y(yv)).attr('r', 5).attr('fill', renk).attr('stroke', 'var(--zemin)').attr('stroke-width', 2);
    if (etiket) g.append('text').attr('class', 'es-etiket').attr('x', c.x(xv) + (yon === 'sag' ? 9 : -9)).attr('y', c.y(yv)).attr('dy', '-0.6em')
      .attr('text-anchor', yon === 'sag' ? 'start' : 'end').style('fill', renk).text(etiket);
    if (anim && !azalt()) g.style('opacity', 0).transition().delay(anim === 'son' ? 1100 : 0).duration(450).style('opacity', 1);
  };
  const esikCizgi = (c, v, etiket, xd) => {
    c.ust.append('line').attr('x1', c.x(xd[0])).attr('x2', c.x(xd[1])).attr('y1', c.y(v)).attr('y2', c.y(v)).attr('stroke', R.esik).attr('stroke-dasharray', '4 4').attr('stroke-width', 1.4);
    c.ust.append('text').attr('class', 'es-etiket').attr('x', c.x(xd[1]) + 10).attr('y', c.y(v)).attr('dy', '0.32em').style('fill', R.esik).text(etiket);
  };
  const serit = (c, s, renk, anim) => {
    const p = c.ust.append('path').datum(s).attr('fill', renk).attr('d', area().curve(curveMonotoneX).x((d) => c.x(d[0])).y0((d) => c.y(Math.min(d[1], 2.1))).y1(c.y(2.1)));
    if (anim && !azalt()) p.style('opacity', 0).transition().delay(300).duration(700).style('opacity', 1);
  };
  const lejant = (k) => { $('.dm-lejant').innerHTML = k.map(([r, t]) => `<span><i style="background:${r}"></i>${t}</span>`).join(''); };

  function seriGrafik(i, anim) {
    const a = ADIM[i];
    if (a.g === 'dog') {
      const xd = [ilk(D)[0], son(D)[0]];
      const c = cerceve(xd, [1, 2.4], 'Kadın başına ortalama çocuk sayısı', (t) => sayi(t, 1), { xAdim: 2 });
      $('.dm-baslik').textContent = 'Toplam Doğurganlık Hızı, Türkiye';
      if (i === 1) serit(c, D, R.golge, anim);
      esikCizgi(c, 2.1, 'Yenilenme düzeyi 2,1', xd);
      if (i === 0) nokta(c, ilk(D), R.ana, `${ilk(D)[0]}: ${sayi(ilk(D)[1], 2)}`, 'sag', anim);
      else { cizgi(c, D, R.ana, anim); nokta(c, ilk(D), R.ana, `${ilk(D)[0]}: ${sayi(ilk(D)[1], 2)}`); nokta(c, son(D), R.ana, `${son(D)[0]}: ${sayi(son(D)[1], 2)}`, 'sol', anim && 'son'); }
      lejant([[R.ana, 'Toplam doğurganlık hızı'], [R.esik, 'Yenilenme düzeyi']]);
    } else if (a.g === 'yas') {
      const xd = [ilk(Y)[0], son(Y)[0]];
      const c = cerceve(xd, [Math.floor(ilk(Y)[1] - 2), Math.ceil(son(Y)[1] + 1)], 'Ortanca yaş', (t) => sayi(t, 0), { xAdim: 3 });
      $('.dm-baslik').textContent = 'Ortanca Yaş, Türkiye';
      esikCizgi(c, 30, '30 yaş', xd);
      cizgi(c, Y, R.ana, anim);
      if (yas30) nokta(c, Y.find((d) => d[0] === yas30), R.esik, `${yas30}`, 'sol', anim && 'son');
      nokta(c, son(Y), R.ana, `${son(Y)[0]}: ${sayi(son(Y)[1], 1)}`, 'sol', anim && 'son');
      lejant([[R.ana, 'Ortanca yaş'], [R.esik, 'Eşiğin aşıldığı yıl']]);
    } else {
      const xd = [ilk(Hn)[0], son(Hn)[0]];
      const c = cerceve(xd, [2.5, Math.ceil(ilk(Hn)[1] * 2) / 2 + 0.2], 'Ortalama hanehalkı büyüklüğü (kişi)', (t) => sayi(t, 1), { xAdim: 3 });
      $('.dm-baslik').textContent = 'Ortalama Hanehalkı Büyüklüğü, Türkiye';
      esikCizgi(c, 3.5, '3,5 kişi', xd);
      cizgi(c, Hn, R.ana, anim);
      nokta(c, ilk(Hn), R.ana, `${ilk(Hn)[0]}: ${sayi(ilk(Hn)[1], 1)}`);
      if (hane35) nokta(c, Hn.find((d) => d[0] === hane35), R.esik, `${hane35}`, 'sag', anim && 'son');
      nokta(c, son(Hn), R.ana, `${son(Hn)[0]}: ${sayi(son(Hn)[1], 1)}`, 'sol', anim && 'son');
      lejant([[R.ana, 'Ortalama hanehalkı büyüklüğü'], [R.esik, 'Eşiğin aşıldığı yıl']]);
    }
  }

  function ilGrafik(i, anim) {
    const xs = iller.map((d) => d.x), ys = iller.map((d) => d.y);
    const c = cerceve([Math.floor(Math.min(...xs)) - 1, Math.ceil(Math.max(...xs)) + 1], [Math.min(1, Math.min(...ys)), Math.max(...ys) * 1.05],
      `Toplam doğurganlık hızı, ${SD.yil}`, (t) => sayi(t, 1), { xAd: `Ortanca yaş, ${SY.yil}`, xBicim: (t) => sayi(t, 0) });
    $('.dm-baslik').textContent = 'İllerde Ortanca Yaş ve Doğurganlık';
    const xd = c.x.domain();
    c.ust.append('line').attr('x1', c.x(xd[0])).attr('x2', c.x(xd[1])).attr('y1', c.y(2.1)).attr('y2', c.y(2.1)).attr('stroke', R.esik).attr('stroke-dasharray', '4 4');
    c.ust.append('text').attr('class', 'es-etiket').attr('x', c.x(xd[1]) + 10).attr('y', c.y(2.1)).attr('dy', '0.32em').style('fill', R.esik).text('Yenilenme düzeyi');
    const renk = (d) => (i < 5 ? R.il : d.y >= 2.1 ? R.yuksek : d.x >= yasliEsik ? R.yasli : R.il);
    const n = c.ust.append('g').selectAll('circle').data(iller).join('circle').attr('cx', (d) => c.x(d.x)).attr('cy', (d) => c.y(d.y)).attr('r', 5.2)
      .attr('fill', renk).attr('fill-opacity', 0.9).attr('stroke', 'var(--zemin)').attr('stroke-width', 1.2)
      .on('pointermove', (ev, d) => {
        ipucu.innerHTML = `<strong>${esc(d.ad)}</strong><br>Ortanca yaş ${sayi(d.x, 1)} · doğurganlık ${sayi(d.y, 2)}`;
        const k = alan.getBoundingClientRect(); let x = ev.clientX - k.left + 12; if (x > k.width - 220) x -= 240;
        ipucu.style.transform = `translate(${x}px,${ev.clientY - k.top + 12}px)`; ipucu.style.opacity = 1;
      })
      .on('pointerleave', () => { ipucu.style.opacity = 0; });
    if (anim && i === 4 && !azalt()) n.attr('r', 0).transition().delay((d, k) => k * 8).duration(400).attr('r', 5.2);
    nokta(c, [SY.tr, SD.tr], '#2f2f2f', 'Türkiye', 'sag');
    if (i >= 5) {
      const etiket = [...yuksek.slice(0, 3), ...yasliler.slice(0, 3)];
      const kutu = [];
      for (const d of etiket) {
        const px = c.x(d.x) + 8, py = c.y(d.y) + 4;
        if (kutu.some(([a, b]) => Math.abs(a - px) < 70 && Math.abs(b - py) < 13)) continue;
        kutu.push([px, py]);
        c.ust.append('text').attr('class', 'es-etiket').attr('x', px).attr('y', py).style('fill', d.y >= 2.1 ? R.yuksek : R.yasli).text(d.ad);
      }
    }
    lejant(i >= 5 ? [[R.yuksek, 'Yenilenme düzeyinin üzerindeki iller'], [R.yasli, `Ortanca yaşı ${yasliEsik} ve üzeri olan iller`], [R.il, 'Diğer iller']]
      : [[R.il, 'İller'], ['#2f2f2f', 'Türkiye']]);
  }

  let aktif = -1;
  function ciz(i, anim = true) {
    if (i === aktif) return;
    const ileri = anim && i > aktif;
    aktif = i;
    adimlar.querySelectorAll('.as-adim').forEach((el, j) => el.classList.toggle('aktif', j === i));
    ilerleme.querySelectorAll('button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    if (ADIM[i].g === 'il') ilGrafik(i, ileri); else seriGrafik(i, ileri);
  }
  const io = new IntersectionObserver((e) => e.forEach((x) => x.isIntersecting && ciz(+x.target.dataset.i)), { rootMargin: '-45% 0px -45% 0px' });
  adimlar.querySelectorAll('.as-adim').forEach((el) => io.observe(el));
  ciz(0, false);
  let zt;
  window.addEventListener('resize', () => { clearTimeout(zt); zt = setTimeout(() => { const j = aktif; aktif = -1; ciz(j, false); }, 200); });
}
