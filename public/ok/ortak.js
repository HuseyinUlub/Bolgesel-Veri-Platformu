/* Kalkınma Okuryazarlığı — ortak yardımcılar (prototip). d3 v7 gerektirir. */
(function () {
  const OK = (window.OK = {});
  const nf = (OK.nf = (v, d = 0) =>
    v == null || Number.isNaN(v) ? '–' : new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v));

  /* ---------- sayfa iskeleti ---------- */
  OK.SAYFALAR = [
    { id: 'kavramlar', ad: 'Temel Kavramlar', url: 'ok-kavramlar.html' },
    { id: 'olcme', ad: 'Ölçme ve Yöntem', url: 'ok-olcme.html' },
    { id: 'tuzaklar', ad: 'Veri Okuma Tuzakları', url: 'ok-tuzaklar.html' },
    { id: 'politika', ad: 'Bölgesel Kalkınma Politikası', url: 'ok-politika.html' },
    { id: 'planlama', ad: 'Planlamada Veri Kullanımı', url: 'ok-planlama.html' },
  ];
  OK.iskelet = function (aktif) {
    const ust = document.getElementById('ust');
    if (ust) {
      ust.className = 'ust-cubuk';
      ust.innerHTML = `<a class="marka" href="./"><img src="./img/logo.png" alt="T.C. Sanayi ve Teknoloji Bakanlığı"><span>Türkiye Bölgesel Veri Analizleri</span></a>
        <nav class="ust-nav"><a href="./">Ana Sayfa</a><a href="analiz.html">Analiz Masası</a>
        <a href="okuryazarlik.html" aria-current="page">Kalkınma Okuryazarlığı</a><a href="katalog.html">Veri Kataloğu</a><a href="hakkinda.html">Hakkında</a></nav>`;
    }
    const alt = document.getElementById('alt');
    if (alt) {
      alt.className = 'alt-bilgi';
      alt.textContent = 'T.C. Sanayi ve Teknoloji Bakanlığı, Kalkınma Ajansları Genel Müdürlüğü. Veriler: TÜİK, BDDK, OECD ve ilgili kurumlar.';
    }
    const i = OK.SAYFALAR.findIndex((s) => s.id === aktif);
    const son = document.getElementById('sonraki');
    if (son && i >= 0) {
      const o = OK.SAYFALAR[i - 1], s = OK.SAYFALAR[i + 1];
      son.className = 'ko-sonraki';
      son.innerHTML = (o ? `<a href="${o.url}"><small>Önceki Başlık</small>← ${o.ad}</a>` : '<a href="okuryazarlik.html"><small>Bölüm</small>← Kalkınma Okuryazarlığı</a>') +
        (s ? `<a href="${s.url}" style="text-align:right"><small>Sonraki Başlık</small>${s.ad} →</a>` : '<a href="okuryazarlik.html" style="text-align:right"><small>Bölüm</small>Kalkınma Okuryazarlığı →</a>');
    }
    // içindekiler
    const ic = document.getElementById('icindekiler');
    if (ic) {
      ic.className = 'ko-icindekiler';
      ic.innerHTML = [...document.querySelectorAll('article.ko-yazi')].map((a, n) =>
        `<a href="#${a.id}"><span>${String(n + 1).padStart(2, '0')}</span>${a.querySelector('h2').textContent}</a>`).join('');
    }
  };

  /* ---------- ipucu ---------- */
  let ip;
  OK.ipGoster = (e, html) => {
    if (!ip) { ip = document.createElement('div'); ip.className = 'ko-ipucu'; ip.setAttribute('role', 'tooltip'); document.body.appendChild(ip); }
    ip.innerHTML = html; ip.style.opacity = 1;
    const r = ip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
    ip.style.left = x + 'px'; ip.style.top = y + 'px';
  };
  OK.ipGizle = () => { if (ip) ip.style.opacity = 0; };

  /* ---------- veri ---------- */
  const onbellek = new Map();
  OK.json = (yol) => { if (!onbellek.has(yol)) onbellek.set(yol, fetch(yol).then((r) => { if (!r.ok) throw new Error(yol); return r.json(); })); return onbellek.get(yol); };
  OK.kat = (k) => OK.json(`veri/k/${k}.json`);
  OK.geo = (d) => OK.json(`veri/geo/${d}.json`);
  OK.D1AD = { TR1: 'İstanbul', TR2: 'Batı Marmara', TR3: 'Ege', TR4: 'Doğu Marmara', TR5: 'Batı Anadolu', TR6: 'Akdeniz',
    TR7: 'Orta Anadolu', TR8: 'Batı Karadeniz', TR9: 'Doğu Karadeniz', TRA: 'Kuzeydoğu Anadolu', TRB: 'Ortadoğu Anadolu', TRC: 'Güneydoğu Anadolu' };
  OK.adlar = async function () {
    const g = await OK.geo('province');
    const il = new Map(g.features.map((f) => [f.id, f.properties.ad]));
    const d2iller = d3.group([...il.keys()].sort(), (k) => k.slice(0, 4));
    const d2 = new Map([...d2iller].map(([k, v]) => [k, `${k}, ${v.map((x) => il.get(x)).join(', ')}`]));
    const d2kisa = new Map([...d2iller].map(([k, v]) => [k, v.length > 2 ? `${k} ${il.get(v[0])} vd.` : `${k} ${v.map((x) => il.get(x)).join('-')}`]));
    return { il, d2, d2kisa, d2iller };
  };
  /** düzey: 'il' (TRxxx), 'd2' (TRxx), 'd1' (TRx) */
  OK.uzunluk = { il: 5, d2: 4, d1: 3 };
  /** Bir göstergenin, düzeyde yeterli kapsamı olan son yılı ve değerleri */
  OK.seri = function (kat, slug, duzey = 'il', yil) {
    const s = kat[slug]; if (!s) return null;
    const L = OK.uzunluk[duzey], esik = { il: 75, d2: 24, d1: 11 }[duzey];
    const yillar = Object.keys(s).filter((y) => Object.keys(s[y]).filter((k) => k.length === L).length >= esik).sort();
    const y = yil && s[yil] ? String(yil) : yillar[yillar.length - 1];
    if (!y) return null;
    const d = new Map(Object.entries(s[y]).filter(([k, v]) => k.length === L && v != null));
    return { yil: y, d, tr: s[y].TR, yillar };
  };
  OK.trSeri = (kat, slug) => Object.entries(kat[slug] || {}).filter(([, o]) => o.TR != null).map(([y, o]) => ({ x: +y, y: o.TR })).sort((a, b) => a.x - b.x);

  /* ---------- düğmeler ---------- */
  OK.secim = function (kap, ogeler, onSec, ilk = 0) {
    const s = d3.select(kap);
    s.selectAll('button').data(ogeler).join('button').attr('type', 'button').attr('aria-pressed', (o, i) => i === ilk).text((o) => o.ad)
      .on('click', (e, o) => { s.selectAll('button').attr('aria-pressed', (x) => x === o); onSec(o); });
    onSec(ogeler[ilk]);
  };

  /* ---------- harita ---------- */
  OK.harita = function (svgSel, geo, { dolgu, ipucu, W = 520, H = 250, tikla } = {}) {
    const svg = d3.select(svgSel).attr('viewBox', `0 0 ${W} ${H}`);
    const proj = d3.geoMercator().fitSize([W, H], geo);
    const yol = d3.geoPath(proj);
    svg.selectAll('path').data(geo.features, (f) => f.id).join('path').attr('d', yol)
      .attr('fill', (f) => dolgu(f.id) ?? '#ececec')
      .on('mousemove', function (e, f) { d3.select(this).classed('secili', true).raise(); const h = ipucu?.(f.id); if (h) OK.ipGoster(e, h); })
      .on('mouseleave', function () { d3.select(this).classed('secili', false); OK.ipGizle(); })
      .on('click', (e, f) => tikla?.(f.id));
    return { svg, proj, yol };
  };
  OK.SIRALI = ['#f3e3d3', '#e2b48f', '#cc8058', '#a8502e', '#6e2a14'];
  OK.IKI = { neg: ['#1f5f7a', '#7fa9bb'], notr: '#e6e4dc', poz: ['#d89a7a', '#a8502e'] };
  /** dilim (quantile) ölçeği + lejant */
  OK.dilimOlcek = function (degerler, renkler = OK.SIRALI) { return d3.scaleQuantile().domain(degerler).range(renkler); };
  OK.lejantDilim = function (kap, olcek, bicim = (v) => nf(v, 1), ek = '') {
    const q = olcek.quantiles(); const dom = d3.extent(olcek.domain());
    const sinir = [dom[0], ...q, dom[1]];
    document.querySelector(kap).innerHTML = (ek ? `<span style="color:var(--soluk)">${ek}</span>` : '') +
      olcek.range().map((r, i) => `<span><i style="background:${r}"></i>${bicim(sinir[i])}–${bicim(sinir[i + 1])}</span>`).join('');
  };

  /* ---------- çizgi grafik ---------- */
  OK.cizgi = function (svgSel, seriler, { W = 520, H = 280, yBicim = (v) => nf(v), ipBicim, yAd = '', sifir = false, logY = false, m = { t: 14, r: 120, b: 26, l: 52 }, referans } = {}) {
    const svg = d3.select(svgSel).attr('viewBox', `0 0 ${W} ${H}`); svg.selectAll('*').remove();
    const tum = seriler.flatMap((s) => s.d);
    const x = d3.scaleLinear().domain(d3.extent(tum, (d) => d.x)).range([m.l, W - m.r]);
    const ye = d3.extent(tum, (d) => d.y); if (sifir) ye[0] = Math.min(0, ye[0]); if (referans != null) { ye[0] = Math.min(ye[0], referans); ye[1] = Math.max(ye[1], referans); }
    const y = (logY ? d3.scaleLog() : d3.scaleLinear()).domain(ye).nice().range([H - m.b, m.t]);
    const yTik = logY ? OK.logTik(y.domain()) : y.ticks(5);
    svg.append('g').attr('class', 'izgara').selectAll('line').data(yTik).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    svg.append('g').attr('class', 'eksen').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format('d')).tickSizeOuter(0));
    svg.append('g').attr('class', 'eksen').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).tickValues(yTik).tickFormat(yBicim).tickSize(0)).call((g) => g.select('.domain').remove());
    if (yAd) svg.append('text').attr('class', 'eksen-ad').attr('x', m.l).attr('y', m.t - 4).text(yAd);
    if (referans != null) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(referans)).attr('y2', y(referans)).attr('stroke', '#8c8c8c').attr('stroke-dasharray', '4 3');
    const cz = d3.line().x((d) => x(d.x)).y((d) => y(d.y));
    // doğrudan etiketler, çakışmasız
    const sonlar = seriler.map((s) => ({ s, y: y(s.d[s.d.length - 1].y) })).sort((a, b) => a.y - b.y);
    let onceki = -Infinity; for (const o of sonlar) { o.ly = Math.max(o.y, onceki + 14); onceki = o.ly; }
    for (const s of seriler) {
      svg.append('path').attr('d', cz(s.d)).attr('fill', 'none').attr('stroke', s.renk).attr('stroke-width', s.kalin ?? 2).attr('stroke-dasharray', s.kesik ? '5 3' : null);
      const o = sonlar.find((z) => z.s === s);
      svg.append('text').attr('class', 'etiket').attr('x', W - m.r + 6).attr('y', o.ly).attr('dy', '0.35em').style('fill', s.renk).style('font-weight', 600).text(s.ad);
    }
    const imlec = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).attr('stroke', '#2f2f2f').style('opacity', 0);
    const xs = [...new Set(tum.map((d) => d.x))].sort((a, b) => a - b);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
      .on('mousemove', function (e) {
        const [px] = d3.pointer(e, this); const xv = xs[d3.bisector((d) => d).center(xs, x.invert(px))];
        imlec.attr('x1', x(xv)).attr('x2', x(xv)).style('opacity', 0.5);
        const satir = seriler.map((s) => { const d = s.d.find((z) => z.x === xv); return d ? `<span style="color:${s.renk}">●</span> ${s.ad}: ${(ipBicim || yBicim)(d.y)}` : ''; }).filter(Boolean);
        OK.ipGoster(e, `<b>${xv}</b><br><span class="s">${satir.join('<br>')}</span>`);
      })
      .on('mouseleave', () => { imlec.style('opacity', 0); OK.ipGizle(); });
    return { x, y, svg };
  };

  /* ---------- nokta (saçılım) grafiği ---------- */
  OK.nokta = function (svgSel, veri, { W = 760, H = 380, xAd = '', yAd = '', xBicim = (v) => nf(v), yBicim = (v) => nf(v), logX = false, egilim = false,
    etiket = 6, renk = () => '#a8502e', r = () => 4.5, ip, m = { t: 18, r: 20, b: 40, l: 56 }, refX, refY } = {}) {
    const svg = d3.select(svgSel).attr('viewBox', `0 0 ${W} ${H}`); svg.selectAll('*').remove();
    const xe = d3.extent(veri, (d) => d.x);
    const x = logX ? d3.scaleLog().domain([xe[0] / 1.15, xe[1] * 1.15]).range([m.l, W - m.r]) : d3.scaleLinear().domain(xe).nice().range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(d3.extent(veri, (d) => d.y)).nice().range([H - m.b, m.t]);
    svg.append('g').attr('class', 'izgara').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y).attr('y2', y);
    const xEks = d3.axisBottom(x).tickFormat(xBicim).tickSizeOuter(0);
    if (logX) xEks.tickValues(OK.logTik(x.domain())); else xEks.ticks(6);
    svg.append('g').attr('class', 'eksen').attr('transform', `translate(0,${H - m.b})`).call(xEks);
    svg.append('g').attr('class', 'eksen').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(yBicim).tickSize(0)).call((g) => g.select('.domain').remove());
    svg.append('text').attr('class', 'eksen-ad').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end').text(xAd);
    svg.append('text').attr('class', 'eksen-ad').attr('x', m.l).attr('y', m.t - 6).text(yAd);
    if (refX != null) svg.append('line').attr('x1', x(refX)).attr('x2', x(refX)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', '#8c8c8c').attr('stroke-dasharray', '4 3');
    if (refY != null) svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(refY)).attr('y2', y(refY)).attr('stroke', '#8c8c8c').attr('stroke-dasharray', '4 3');
    let reg = null;
    if (egilim) {
      reg = OK.regresyon(veri.map((d) => [logX ? Math.log(d.x) : d.x, d.y]));
      const xs = x.domain(); const f = (v) => reg.a + reg.b * (logX ? Math.log(v) : v);
      const nokt = d3.range(0, 41).map((i) => { const v = logX ? xs[0] * Math.pow(xs[1] / xs[0], i / 40) : xs[0] + (xs[1] - xs[0]) * i / 40; return [x(v), y(f(v))]; })
        .filter(([, py]) => py >= m.t && py <= H - m.b);
      svg.append('path').attr('d', d3.line()(nokt)).attr('fill', 'none').attr('stroke', '#2f2f2f').attr('stroke-width', 1.2).attr('stroke-dasharray', '5 4');
    }
    const s = [...veri].sort((a, b) => r(b) - r(a));
    svg.append('g').selectAll('circle').data(s).join('circle').attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', r)
      .attr('fill', renk).attr('fill-opacity', 0.85).attr('stroke', '#f9f9f3').attr('stroke-width', 1.5)
      .on('mousemove', (e, d) => OK.ipGoster(e, ip ? ip(d) : `<b>${d.ad}</b><br><span class="s">${xAd}: ${xBicim(d.x)}<br>${yAd}: ${yBicim(d.y)}</span>`))
      .on('mouseleave', OK.ipGizle);
    // etiket: eğilimden en çok sapan ya da uçtaki noktalar
    if (etiket || veri.some((d) => d.etiketle)) {
      const puan = (d) => reg ? Math.abs(d.y - (reg.a + reg.b * (logX ? Math.log(d.x) : d.x))) : Math.abs(d.y - d3.mean(veri, (z) => z.y));
      const sec = veri.filter((d) => d.etiketle).concat([...veri].sort((a, b) => puan(b) - puan(a)).slice(0, etiket));
      const kutu = [];
      for (const d of sec) {
        const px = x(d.x) + 7, py = y(d.y) + 4, w = d.ad.length * 6.4;
        if (kutu.some((b) => px < b[0] + b[2] && px + w > b[0] && Math.abs(py - b[1]) < 13)) continue;
        kutu.push([px, py, w]);
        svg.append('text').attr('class', 'etiket').attr('x', px).attr('y', py).text(d.ad);
      }
    }
    return { x, y, svg, reg };
  };
  OK.logTik = (dom) => { const t = (cs) => cs.flatMap((c) => d3.range(-2, 9).map((e) => c * 10 ** e)).filter((v) => v >= dom[0] && v <= dom[1]).sort((a, b) => a - b);
    const a = t([1, 2, 5]); return a.length <= 8 ? a : t([1, 3]).length <= 8 ? t([1, 3]) : t([1]); };
  OK.regresyon = function (xy) {
    const n = xy.length, mx = d3.mean(xy, (d) => d[0]), my = d3.mean(xy, (d) => d[1]);
    let sxy = 0, sxx = 0, syy = 0; for (const [a, b] of xy) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
    const b = sxy / sxx; return { a: my - b * mx, b, r: sxy / Math.sqrt(sxx * syy), n };
  };

  /* ---------- yatay çubuk ---------- */
  OK.cubuk = function (svgSel, veri, { W = 520, bicim = (v) => nf(v, 1), renk = () => '#cc8058', satir = 22, m = { t: 6, r: 60, b: 6, l: 150 }, ref, refAd = 'Türkiye', ip } = {}) {
    const H = m.t + m.b + satir * veri.length;
    const svg = d3.select(svgSel).attr('viewBox', `0 0 ${W} ${H}`); svg.selectAll('*').remove();
    const max = d3.max(veri, (d) => Math.max(d.deger, ref ?? 0)), min = Math.min(0, d3.min(veri, (d) => d.deger));
    const x = d3.scaleLinear().domain([min, max]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(veri.map((d, i) => i)).range([m.t, H - m.b]).padding(0.25);
    const g = svg.selectAll('g').data(veri).join('g');
    g.append('rect').attr('x', (d) => x(Math.min(0, d.deger))).attr('y', (d, i) => y(i)).attr('height', y.bandwidth()).attr('rx', 2)
      .attr('width', (d) => Math.abs(x(d.deger) - x(0))).attr('fill', renk)
      .on('mousemove', (e, d) => ip && OK.ipGoster(e, ip(d))).on('mouseleave', OK.ipGizle);
    g.append('text').attr('x', m.l - 8).attr('y', (d, i) => y(i) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end')
      .style('font-size', '12.5px').style('fill', (d) => (d.vurgu ? 'var(--metin)' : 'var(--ikincil)')).style('font-weight', (d) => (d.vurgu ? 600 : 400)).text((d) => d.ad);
    g.append('text').attr('x', (d) => x(Math.max(0, d.deger)) + 5).attr('y', (d, i) => y(i) + y.bandwidth() / 2).attr('dy', '0.35em')
      .style('font-family', 'var(--es-aralik)').style('font-size', '11px').style('fill', 'var(--ikincil)').text((d) => bicim(d.deger));
    if (ref != null) {
      svg.append('line').attr('x1', x(ref)).attr('x2', x(ref)).attr('y1', m.t).attr('y2', H - m.b).attr('stroke', '#2f2f2f').attr('stroke-dasharray', '4 3');
      svg.append('text').attr('x', x(ref) + 4).attr('y', H - m.b - 2).style('font-family', 'var(--es-aralik)').style('font-size', '10.5px').style('fill', 'var(--ikincil)').text(`${refAd} ${bicim(ref)}`);
    }
    return { svg, x };
  };

  OK.hata = (sel, e) => { const el = document.querySelector(sel); if (el) el.textContent = 'Veri yüklenemedi.'; console.error(e); };
})();
