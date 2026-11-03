/**
 * Ana sayfa: "Avrupa'nın 291 Bölgesi Arasında Türkiye" — tek sahneli kaydırmalı anlatı.
 *
 * Avrupa ve Türkiye'nin Düzey 2 bölgeleri aynı 291 noktayla gösterilir; okur kaydırdıkça noktalar
 * nokta haritası → gelir sürüsü → ülke satırları → yakınsama → yaş yapısı → nüfus → kadın istihdamı →
 * gelir ikizleri sırasıyla yeniden dizilir. Türkiye bölgeleri kiremit renginde sabit kalır; okurun
 * seçtiği bölge her adımda halkayla izlenir ve kartlardaki cümleler o bölgeye göre güncellenir.
 *
 * Veri: public/veri/avrupa-sahne.json (tools/uluslararasi/avrupa_sahne_verisi.py).
 * Kullanım: avrupaSahne(kap, V) — kap, aşağıdaki iskeleti barındıran öğe (sahneIskeleti()).
 */
import { select } from 'd3-selection';
import 'd3-transition';
import { scaleLinear, scalePoint } from 'd3-scale';
import { forceSimulation, forceX, forceY, forceCollide } from 'd3-force';
import { groups, min, max, mean, extent } from 'd3-array';
import { easeCubicInOut } from 'd3-ease';
import { esc } from './format.js';

export function sahneIskeleti() {
  return `
    <div class="as-kontrol">
      <label for="as-bolge">İzlenen bölge</label>
      <select id="as-bolge"></select>
      <span class="as-not">Seçilen bölge her adımda halkayla işaretlenir ve kartlarda değeriyle birlikte anılır. Haritada ya da grafikte
        kiremit renkli bir noktaya tıklanarak da seçilebilir.</span>
    </div>
    <div class="as-kap">
      <div class="as-sahne" aria-live="polite">
        <div class="as-sahne-ust">
          <div><div class="as-sahne-baslik"></div><div class="as-sahne-alt"></div></div>
          <nav class="as-ilerleme" aria-label="Adımlar"></nav>
        </div>
        <div class="as-alan"><div class="as-ipucu"></div></div>
        <div class="as-lejant"><span><i class="tr"></i>Türkiye bölgeleri</span><span><i class="eu"></i>Avrupa bölgeleri</span><span><i class="secili"></i>İzlenen bölge</span></div>
      </div>
      <div class="as-adimlar"></div>
    </div>`;
}

export function avrupaSahne(kok, V) {
  const $ = (s) => kok.querySelector(s);
  const ULKE = { ...V.ulkeler, XK: 'Kosova', UK: 'Birleşik Krallık' };
  const B = V.bolgeler.map((b) => ({ ...b, tr: b.k.startsWith('TR') }));
  const BK = new Map(B.map((b) => [b.k, b]));
  const TR = B.filter((b) => b.tr);
  const AZ = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nf = (v, d = 0) => (v == null ? '–' : v.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const isr = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), d);
  const kisaAd = (b) => (b.tr && b.a.includes(',') ? `${b.a} bölgesi` : b.a);
  const ulkeAd = (b) => ULKE[b.u] || b.u;
  const sira = (b, alan) => {
    const l = B.filter((x) => x[alan] != null).sort((p, q) => q[alan] - p[alan]);
    return l.indexOf(b) + 1;
  };

  let secili = BK.get('TR10');
  const sec = $('#as-bolge');
  sec.innerHTML = [...TR].sort((p, q) => p.a.localeCompare(q.a, 'tr')).map((b) => `<option value="${b.k}">${esc(b.a)}</option>`).join('');
  sec.value = secili.k;

  /* ---------- sabit istatistikler ---------- */
  const gl = B.filter((b) => b.g != null);
  const enDusuk10 = [...gl].sort((p, q) => p.g - q.g).slice(0, 10);
  const trG = TR.filter((b) => b.g != null).sort((p, q) => q.g - p.g);
  const ulkeler = groups(gl, (b) => b.u).filter(([, l]) => l.length >= 3)
    .map(([u, l]) => ({ u, l, oran: max(l, (b) => b.g) / min(l, (b) => b.g) })).sort((p, q) => q.oran - p.oran);
  const trUlke = ulkeler.find((o) => o.u === 'TR');
  const yak = B.filter((b) => b.g != null && b.g4 != null).map((b) => ({ b, d: b.g - b.g4 }));
  const yakTr = yak.filter((o) => o.b.tr), yakEu = yak.filter((o) => !o.b.tr);
  const ilk20 = [...yak].sort((p, q) => q.d - p.d).slice(0, 20).filter((o) => o.b.tr).length;
  const yas = B.filter((b) => b.ya != null);
  const yasTrMax = max(TR, (b) => b.ya), yasEuAlt = yas.filter((b) => !b.tr && b.ya < yasTrMax).length;
  const nuf = B.filter((b) => b.n != null);
  const azalanEu = nuf.filter((b) => !b.tr && b.n < 0).length, euN = nuf.filter((b) => !b.tr).length;
  const trNufArti = TR.filter((b) => b.n > 0).length;
  const kd = B.filter((b) => b.k24 != null);
  const kd10 = [...kd].sort((p, q) => p.k24 - q.k24).slice(0, 10).filter((b) => b.tr).length;
  const trKmax = TR.filter((b) => b.k24 != null).sort((p, q) => q.k24 - p.k24)[0];
  const euKalti = kd.filter((b) => !b.tr && b.k24 < trKmax.k24).length, euK = kd.filter((b) => !b.tr).length;

  /* ---------- adımlar ---------- */
  const ADIM = [
    { id: 'harita', baslik: 'Avrupa\'nın Düzey 2 bölgeleri', alt: 'Her nokta bir bölge · konum: bölgenin coğrafi merkezi',
      h: 'Aynı Noktalar, Farklı Sorular',
      metin: () => `<p>Haritadaki ${B.length} noktanın her biri Avrupa'da bir Düzey 2 bölgesini temsil etmektedir; bunların <strong>${TR.length}</strong> tanesi Türkiye'dedir.</p>
        <p>İlerleyen adımlarda noktalar haritadan ayrılarak göstergelere göre yeniden dizilecektir. Türkiye bölgeleri ile izlenen bölge bütün adımlarda aynı biçimde işaretli kalacaktır.</p>`,
      secili: (b) => `İzlenen bölge: <b>${esc(b.a)}</b>` },
    { id: 'gelir', baslik: 'Kişi başına GSYH (SGP), AB-27 = 100', alt: `${V.yil.gsyh} · ${gl.length} bölge`,
      h: 'Gelir Düzeyinde Türkiye Bölgelerinin Yeri',
      metin: () => `<p>Satın alma gücü paritesine göre kişi başına GSYH, Türkiye genelinde AB ortalamasının <strong>${nf(V.trUlke.g)}</strong> düzeyindedir. ${esc(kisaAd(trG[0]))} (${nf(trG[0].g)}) ve ${esc(kisaAd(trG[1]))} (${nf(trG[1].g)}) AB ortalamasının üzerindedir.</p>
        <p>Avrupa'da geliri en düşük on bölgenin <strong>${enDusuk10.filter((b) => b.tr).length}</strong> tanesi Türkiye'de yer almaktadır.</p>`,
      secili: (b) => (b.g == null ? '' : `<b>${esc(b.a)}</b>: ${nf(b.g)} · ${gl.length} bölge içinde ${sira(b, 'g')}. sıra`) },
    { id: 'ulke', baslik: 'Ülke içinde bölgeler arası gelir farkı', alt: `Kişi başına GSYH (SGP), AB-27 = 100 · ${V.yil.gsyh} · en az 3 bölgeli ülkeler`,
      h: 'Ülke İçindeki Farklılık',
      metin: () => `<p>Noktalar ülkelerine göre satırlara ayrılmış; satırlar, en zengin bölgenin en yoksul bölgeye oranına göre büyükten küçüğe sıralanmıştır.</p>
        <p>Türkiye'de en yüksek gelirli bölgenin geliri en düşük gelirli bölgenin <strong>${nf(trUlke.oran, 1)} katıdır</strong>. Bu oran ${ulkeler.length} ülke arasında ${ulkeler.indexOf(trUlke) + 1}. sıradadır.</p>
        <p>Türkiye'de bölgeler arası farkın 2000 yılından bu yana seyri, bu bölümün sonundaki <a href="#tr-esitsizlik">Türkiye İçinde Bölgesel Eşitsizlik</a> kısmında ele alınmaktadır.</p>`,
      secili: (b) => (b.g == null ? '' : `<b>${esc(b.a)}</b>: Türkiye içinde ${trG.indexOf(b) + 1}. sıra (${TR.length} bölge)`) },
    { id: 'yakinsama', baslik: 'Başlangıç düzeyi ve 20 yıllık değişim', alt: 'Yatay: 2004 düzeyi · dikey: 2004 → 2024 değişim (puan) · AB-27 = 100',
      h: 'AB Ortalamasına Yakınsama',
      metin: () => `<p>2004 yılında geliri düşük olan bölgeler (solda) AB ortalamasına daha hızlı yaklaşmıştır. Türkiye bölgeleri bu yakınsamanın en belirgin örnekleri arasındadır.</p>
        <p>Türkiye bölgeleri 20 yılda AB ortalamasına göre ortalama <strong>${isr(mean(yakTr, (o) => o.d), 0)} puan</strong> yükselmiştir; Avrupa bölgelerinin ortalaması ${isr(mean(yakEu, (o) => o.d), 0)} puandır. En çok yükselen 20 bölgenin ${ilk20} tanesi Türkiye'dedir.</p>`,
      secili: (b) => (b.g4 == null ? '' : `<b>${esc(b.a)}</b>: ${nf(b.g4)} → ${nf(b.g)} (${isr(b.g - b.g4, 0)} puan)`) },
    { id: 'yas', baslik: 'Gelir ve yaşlı bağımlılık oranı', alt: `Yatay: kişi başına GSYH, AB = 100 · dikey: 65+ / 15–64 (%) · ${V.yil.yasli}`,
      h: 'Genç Nüfus Yapısı',
      metin: () => `<p>Yaşlı bağımlılık oranı AB-27'de <strong>%${nf(V.ab.yasli, 1)}</strong>, Türkiye'de %${nf(V.trUlke.yasli, 1)} düzeyindedir. Türkiye bölgeleri grafiğin alt kısmında ayrı bir küme oluşturmaktadır.</p>
        <p>Türkiye'de oranın en yüksek olduğu bölgeden (%${nf(yasTrMax, 1)}) daha genç nüfus yapısına sahip yalnızca ${yasEuAlt} Avrupa bölgesi bulunmaktadır. Gelir artışı ile nüfusun yaşlanması aynı dönemde yaşanmaktadır.</p>`,
      secili: (b) => (b.ya == null ? '' : `<b>${esc(b.a)}</b>: yaşlı bağımlılık oranı %${nf(b.ya, 1)}`) },
    { id: 'nufus', baslik: 'Yaş yapısı ve nüfus değişimi', alt: 'Yatay: yaşlı bağımlılık oranı (%) · dikey: yıllık ortalama nüfus değişimi, 2008–2025 (%)',
      h: 'Büyüyen ve Küçülen Bölgeler',
      metin: () => `<p>2008–2025 döneminde Avrupa'daki ${euN} bölgenin <strong>${azalanEu}</strong> tanesinde nüfus azalmıştır. Türkiye'de ise ${TR.length} bölgenin ${trNufArti} tanesinde nüfus artmıştır.</p>
        <p>Nüfusu yıllık ortalama %${nf(V.trUlke.nufus, 2)} artan Türkiye, AB-27'nin (%${nf(V.ab.nufus, 2)}) yaklaşık ${nf(V.trUlke.nufus / V.ab.nufus, 0)} katı hızla büyümektedir.</p>`,
      secili: (b) => (b.n == null ? '' : `<b>${esc(b.a)}</b>: yıllık %${isr(b.n, 2)}`) },
    { id: 'kadin', baslik: 'Gelir ve kadın istihdam oranı', alt: 'Yatay: kişi başına GSYH, AB = 100 · dikey: 20–64 yaş kadın istihdam oranı (%) · çizgi: 2019 → 2024',
      h: 'Kadın İstihdamındaki Açık',
      metin: () => `<p>20–64 yaş grubundaki kadınların istihdam oranı 2024 yılında AB-27'de <strong>%${nf(V.ab.kadin[1], 1)}</strong>, Türkiye'de %${nf(V.trUlke.kadin[1], 1)} düzeyindedir. Avrupa'da oranın en düşük olduğu on bölgenin ${kd10} tanesi Türkiye'dedir.</p>
        <p>Türkiye'de oranın en yüksek olduğu ${esc(kisaAd(trKmax))} (%${nf(trKmax.k24, 1)}) dahi ${euK} Avrupa bölgesinin yalnızca ${euKalti} tanesini geride bırakmaktadır. Kısa çizgiler 2019'dan bu yana yaşanan artışı göstermektedir.</p>`,
      secili: (b) => (b.k24 == null ? '' : `<b>${esc(b.a)}</b>: %${nf(b.k19, 1)} → %${nf(b.k24, 1)}`) },
    { id: 'ikiz', baslik: 'Avrupa\'daki gelir ikizleri', alt: '2024 kişi başı GSYH düzeyi en yakın Avrupa bölgesi',
      h: 'Aynı Gelir, Farklı Toplum',
      metin: () => `<p>Her Türkiye bölgesi, 2024 yılında kişi başına geliri kendisine en yakın Avrupa bölgesiyle eşleştirilmiştir. Gelir düzeyi aynı olan bu bölgeler yaş yapısı ve kadın istihdamında belirgin biçimde ayrışmaktadır.</p>
        <div class="as-ikiz-kart"></div>`,
      secili: () => '' },
  ];

  const adimlar = $('.as-adimlar');
  adimlar.innerHTML = ADIM.map((a, i) => `<section class="as-adim" data-i="${i}"><div class="as-adim-ic">
      <div class="as-adim-no">${String(i + 1).padStart(2, '0')} / ${String(ADIM.length).padStart(2, '0')}</div>
      <h3>${esc(a.h)}</h3><div class="as-metin">${a.metin()}</div><div class="as-secili-satir"></div></div></section>`).join('');
  const ilerleme = $('.as-ilerleme');
  ilerleme.innerHTML = ADIM.map((a, i) => `<button type="button" data-i="${i}" aria-label="${i + 1}. adım: ${esc(a.h)}">${i + 1}</button>`).join('');
  ilerleme.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) adimlar.children[+b.dataset.i].scrollIntoView({ behavior: AZ ? 'auto' : 'smooth', block: 'center' });
  });

  /* ---------- sahne ---------- */
  const alan = $('.as-alan');
  const ipucu = $('.as-ipucu');
  const svg = select(alan).append('svg').attr('role', 'img').attr('aria-label', 'Avrupa ve Türkiye Düzey 2 bölgeleri');
  const gEksen = svg.append('g'), gRef = svg.append('g'), gIz = svg.append('g'), gNokta = svg.append('g'), gUst = svg.append('g');
  let W = 0, H = 0, aktif = 0;
  const yer = new Map();
  const R = () => (W < 520 ? 3.6 : 5);

  function arisurusu(liste, xf, yMerkez, bant, r) {
    const n = liste.map((b) => ({ b, x: xf(b), y: yMerkez, hx: xf(b) }));
    const sim = forceSimulation(n).force('x', forceX((d) => d.hx).strength(1)).force('y', forceY(yMerkez).strength(0.08))
      .force('c', forceCollide(r + 0.9)).stop();
    for (let i = 0; i < 220; i++) sim.tick();
    n.forEach((d) => { d.y = Math.max(yMerkez - bant, Math.min(yMerkez + bant, d.y)); });
    return n;
  }

  function yerlesim(i) {
    if (yer.has(i)) return yer.get(i);
    const m = { l: W < 520 ? 34 : 46, r: 14, t: 18, b: 40 };
    const r = R();
    const out = new Map();
    const id = ADIM[i].id;
    const ekle = (b, x, y, rr = r) => out.set(b.k, { x, y, r: rr });
    if (id === 'harita' || id === 'ikiz') {
      const xs = extent(B, (b) => b.x), ys = extent(B, (b) => b.y);
      const s = Math.min((W - 20) / (xs[1] - xs[0]), (H - 20) / (ys[1] - ys[0]));
      const ox = (W - s * (xs[1] - xs[0])) / 2, oy = (H - s * (ys[1] - ys[0])) / 2;
      out.harita = ([x, y]) => [ox + (x - xs[0]) * s, H - oy - (y - ys[0]) * s];
      B.forEach((b) => { const [x, y] = out.harita([b.x, b.y]); ekle(b, x, y, r * 0.95); });
    } else if (id === 'gelir') {
      const x = scaleLinear().domain([0, max(gl, (b) => b.g) * 1.02]).nice().range([m.l, W - m.r]);
      arisurusu(gl, (b) => x(b.g), (H - m.b + m.t) / 2, (H - m.b - m.t) / 2, r).forEach((d) => ekle(d.b, d.x, d.y));
      out.x = x; out.ref = [{ x: x(100), et: 'AB-27 = 100' }];
    } else if (id === 'ulke') {
      const x = scaleLinear().domain([0, max(gl, (b) => b.g) * 1.02]).nice().range([m.l + (W < 520 ? 52 : 70), W - m.r]);
      const y = scalePoint().domain(ulkeler.map((o) => o.u)).range([m.t + 6, H - m.b]).padding(0.4);
      const rr = Math.min(r, y.step() * 0.42);
      ulkeler.forEach((o) => o.l.forEach((b) => ekle(b, x(b.g), y(o.u), rr)));
      out.x = x; out.yUlke = y; out.ref = [{ x: x(100), et: 'AB-27 = 100' }];
    } else {
      const tanim = {
        yakinsama: { l: yak.map((o) => o.b), xv: (b) => b.g4, yv: (b) => b.g - b.g4, xe: 'Kişi başına GSYH 2004 (AB = 100)', ye: 'Değişim, puan', refY: 0, refYe: 'değişim yok' },
        yas: { l: B.filter((b) => b.g != null && b.ya != null), xv: (b) => b.g, yv: (b) => b.ya, xe: 'Kişi başına GSYH (AB = 100)', ye: 'Yaşlı bağımlılık (%)', refX: 100, refY: V.ab.yasli, refYe: 'AB-27' },
        nufus: { l: B.filter((b) => b.ya != null && b.n != null), xv: (b) => b.ya, yv: (b) => b.n, xe: 'Yaşlı bağımlılık oranı (%)', ye: 'Nüfus değişimi (%/yıl)', refY: 0, refYe: 'sabit nüfus' },
        kadin: { l: B.filter((b) => b.g != null && b.k24 != null), xv: (b) => b.g, yv: (b) => b.k24, xe: 'Kişi başına GSYH (AB = 100)', ye: 'Kadın istihdamı (%)', refX: 100, refY: V.ab.kadin[1], refYe: 'AB-27' },
      }[id];
      const xd = extent(tanim.l, tanim.xv), yd = extent(tanim.l, tanim.yv);
      if (id === 'kadin') yd[0] = Math.min(yd[0], min(TR, (b) => b.k19 ?? 99));
      const x = scaleLinear().domain(xd).nice().range([m.l, W - m.r]);
      const y = scaleLinear().domain(yd).nice().range([H - m.b, m.t]);
      tanim.l.forEach((b) => ekle(b, x(tanim.xv(b)), y(tanim.yv(b))));
      out.x = x; out.y = y; out.xe = tanim.xe; out.ye = tanim.ye;
      out.ref = [];
      if (tanim.refX != null) out.ref.push({ x: x(tanim.refX), et: 'AB = 100' });
      if (tanim.refY != null) out.ref.push({ y: y(tanim.refY), et: tanim.refYe });
    }
    out.m = m;
    yer.set(i, out);
    return out;
  }

  function boyut() {
    const r = alan.getBoundingClientRect();
    W = Math.max(280, r.width); H = Math.max(260, r.height);
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    yer.clear();
  }

  function eksenCiz(L) {
    gEksen.selectAll('*').remove();
    if (!L.x) return;
    const m = L.m;
    const xt = L.x.ticks(W < 520 ? 4 : 7);
    const gx = gEksen.append('g').attr('class', 'as-eksen');
    gx.selectAll('line').data(xt).join('line').attr('x1', L.x).attr('x2', L.x)
      .attr('y1', L.y ? m.t : H - m.b).attr('y2', H - m.b + 4);
    gx.selectAll('text').data(xt).join('text').attr('x', L.x).attr('y', H - m.b + 16).attr('text-anchor', 'middle').text((v) => nf(v));
    if (L.y) {
      const yt = L.y.ticks(6);
      const gy = gEksen.append('g').attr('class', 'as-eksen');
      gy.selectAll('line').data(yt).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', L.y).attr('y2', L.y);
      gy.selectAll('text').data(yt).join('text').attr('x', m.l - 6).attr('y', (v) => L.y(v) + 3.5).attr('text-anchor', 'end').text((v) => nf(v));
      gEksen.append('text').attr('class', 'as-eksen-ad').attr('x', m.l + 4).attr('y', m.t - 4).text(`↑ ${L.ye}`);
    }
    gEksen.append('text').attr('class', 'as-eksen-ad').attr('x', W - m.r).attr('y', H - 6).attr('text-anchor', 'end')
      .text(`${L.xe || 'Kişi başına GSYH (AB = 100)'} →`);
    if (L.yUlke) {
      gEksen.selectAll('text.as-ulke-ad').data(ulkeler).join('text')
        .attr('class', (o) => `as-ulke-ad${o.u === 'TR' ? ' tr' : ''}`).attr('x', m.l).attr('y', (o) => L.yUlke(o.u) + 3.5)
        .text((o) => ULKE[o.u] || o.u);
    }
    gEksen.attr('opacity', 0).transition().duration(AZ ? 0 : 600).attr('opacity', 1);
  }

  const sure = () => (AZ ? 0 : 900);
  const ikizSet = new Set(TR.map((b) => b.ikiz).filter(Boolean));

  function ciz(i, ilk = false) {
    const L = yerlesim(i);
    const a = ADIM[i];
    $('.as-sahne-baslik').textContent = a.baslik;
    $('.as-sahne-alt').textContent = a.alt;
    ilerleme.querySelectorAll('button').forEach((b, j) => (j === i ? b.setAttribute('aria-current', 'step') : b.removeAttribute('aria-current')));
    const t = svg.transition().duration(ilk ? 0 : sure()).ease(easeCubicInOut);

    eksenCiz(L);
    gRef.selectAll('*').remove();
    (L.ref || []).forEach((rf) => {
      const g = gRef.append('g').attr('class', 'as-ref');
      if (rf.x != null) {
        g.append('line').attr('x1', rf.x).attr('x2', rf.x).attr('y1', L.m.t).attr('y2', H - L.m.b);
        g.append('text').attr('x', rf.x + 4).attr('y', L.m.t + 10).text(rf.et);
      } else {
        g.append('line').attr('x1', L.m.l).attr('x2', W - L.m.r).attr('y1', rf.y).attr('y2', rf.y);
        g.append('text').attr('x', W - L.m.r - 4).attr('y', rf.y - 5).attr('text-anchor', 'end').text(rf.et);
      }
    });

    // Kıbrıs: ada kıyı çizgisi ve KKTC sınırı (harita adımlarında)
    if (L.harita) {
      const yol = (halkalar) => halkalar.map((h) => `M${h.map(L.harita).map((p) => p.map((v) => v.toFixed(1)).join(',')).join('L')}Z`).join('');
      const g = gRef.append('g').attr('class', 'as-kibris');
      g.append('path').attr('class', 'ada').attr('d', yol(V.kibris.ada));
      g.append('path').attr('class', 'kktc').attr('d', yol(V.kibris.kktc))
        .on('pointermove', (ev) => {
          ipucu.innerHTML = '<strong>Kuzey Kıbrıs Türk Cumhuriyeti</strong><br><small>Eurostat ve TÜİK bölge sınıflamalarında yer almadığından veri noktası bulunmamaktadır.</small>';
          konumla(ev);
        })
        .on('pointerleave', () => { ipucu.style.opacity = 0; });
      const [mx, my] = L.harita(V.kibris.kktcMerkez);
      g.append('text').attr('class', 'kktc-ad').attr('x', mx).attr('y', my - 9).attr('text-anchor', 'middle').text('KKTC');
    }

    // noktalar (Türkiye bölgeleri üstte)
    const dizi = [...B].sort((p, q) => p.tr - q.tr);
    const n = gNokta.selectAll('circle.as-nokta').data(dizi, (b) => b.k).join((e) => e.append('circle')
      .attr('class', (b) => `as-nokta ${b.tr ? 'tr' : 'eu'}`).attr('r', 0).attr('cx', W / 2).attr('cy', H / 2));
    n.on('pointermove', (ev, b) => ipucuGoster(ev, b, i)).on('pointerleave', () => { ipucu.style.opacity = 0; })
      .on('click', (ev, b) => { if (b.tr) secimYap(b.k); });
    n.transition(t).delay((b) => (ilk || AZ ? 0 : ((L.get(b.k)?.x ?? W / 2) / W) * 260))
      .attr('cx', function (b) { return L.get(b.k)?.x ?? this.getAttribute('cx'); })
      .attr('cy', function (b) { return L.get(b.k)?.y ?? this.getAttribute('cy'); })
      .attr('r', (b) => (L.has(b.k) ? L.get(b.k).r : 0))
      .attr('opacity', (b) => (!L.has(b.k) ? 0 : b.tr ? 1 : a.id === 'ikiz' && !ikizSet.has(b.k) ? 0.35 : 0.8));

    // izler ve bağlar
    gIz.selectAll('*').remove();
    if (a.id === 'kadin') {
      gIz.selectAll('line').data(TR.filter((b) => L.has(b.k) && b.k19 != null)).join('line').attr('class', 'as-iz')
        .attr('x1', (b) => L.get(b.k).x).attr('x2', (b) => L.get(b.k).x).attr('y1', (b) => L.y(b.k19)).attr('y2', (b) => L.y(b.k19))
        .transition(t).delay(sure() * 0.6).attr('y2', (b) => L.get(b.k).y);
    }
    if (a.id === 'ikiz') {
      gIz.selectAll('path').data(TR.filter((b) => b.ikiz && L.has(b.ikiz)), (b) => b.k).join('path')
        .attr('class', (b) => `as-bag${b === secili ? ' secili' : ''}`)
        .attr('d', (b) => {
          const p = L.get(b.k), q = L.get(b.ikiz);
          const mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - Math.abs(p.x - q.x) * 0.28;
          return `M${p.x},${p.y} Q${mx},${my} ${q.x},${q.y}`;
        })
        .attr('stroke-dasharray', function () { const l = this.getTotalLength(); return `${l} ${l}`; })
        .attr('stroke-dashoffset', function () { return AZ ? 0 : this.getTotalLength(); })
        .transition(t).delay(sure() * 0.7).duration(AZ ? 0 : 1100).attr('stroke-dashoffset', 0);
    }
    seciliCiz(i, t);
    kartlariYaz();
  }

  function seciliCiz(i, t) {
    const L = yerlesim(i);
    const p = L.get(secili.k);
    const ikiz = ADIM[i].id === 'ikiz' && secili.ikiz ? L.get(secili.ikiz) : null;
    const veri = [];
    if (p) veri.push({ k: secili.k, p, ad: kisaAd(secili) });
    if (ikiz) veri.push({ k: secili.ikiz, p: ikiz, ad: BK.get(secili.ikiz).a });
    const g = gUst.selectAll('g.as-isaret').data(veri, (d) => d.k).join((e) => {
      const k = e.append('g').attr('class', 'as-isaret').attr('opacity', 0);
      k.append('circle').attr('class', 'as-halka');
      k.append('text').attr('class', 'as-secili-ad');
      return k;
    });
    g.select('circle').transition(t).attr('cx', (d) => d.p.x).attr('cy', (d) => d.p.y).attr('r', (d) => d.p.r + 4);
    g.select('text').text((d) => d.ad).transition(t)
      .attr('x', (d) => d.p.x).attr('y', (d) => d.p.y - d.p.r - 8)
      .attr('text-anchor', (d) => (d.p.x > W * 0.8 ? 'end' : d.p.x < W * 0.2 ? 'start' : 'middle'));
    g.transition(t).attr('opacity', 1);
  }

  function kartlariYaz() {
    adimlar.querySelectorAll('.as-adim').forEach((el, j) => {
      const s = ADIM[j].secili(secili) || '';
      const satir = el.querySelector('.as-secili-satir');
      satir.innerHTML = s;
      satir.hidden = !s;
    });
    const kart = kok.querySelector('.as-ikiz-kart');
    const e = secili.ikiz && BK.get(secili.ikiz);
    if (!e) { kart.innerHTML = ''; return; }
    const sat = (ad, a, b, enCok, d = 1, birim = '') => `<div class="as-ikiz-satir"><span>${ad}</span><div class="as-ikiz-cubuk">
        <div class="c-tr" style="width:${Math.max(2, (a / enCok) * 100)}%"></div><div class="c-eu" style="width:${Math.max(2, (b / enCok) * 100)}%"></div>
        <span class="as-ikiz-deger">${nf(a, d)}${birim} · ${nf(b, d)}${birim}</span></div></div>`;
    kart.innerHTML = `<div class="as-ikiz-baslik">${esc(secili.a)} <span>↔</span> ${esc(e.a)} <span>(${esc(ulkeAd(e))})</span></div>
      ${sat('Gelir (AB = 100)', secili.g, e.g, Math.max(secili.g, e.g, 100), 0)}
      ${sat('Yaşlı bağımlılık', secili.ya, e.ya, Math.max(secili.ya, e.ya), 1, '%')}
      ${sat('Kadın istihdamı', secili.k24, e.k24, 100, 1, '%')}
      ${secili.n != null && e.n != null ? `<div class="as-ikiz-satir"><span>Nüfus değişimi</span><span class="as-ikiz-deger">yıllık %${isr(secili.n, 2)} · %${isr(e.n, 2)}</span></div>` : ''}`;
  }

  function ipucuGoster(ev, b, i) {
    const deger = {
      harita: '', gelir: `AB = 100 iken ${nf(b.g)}`, ulke: `AB = 100 iken ${nf(b.g)}`,
      yakinsama: b.g4 != null ? `${nf(b.g4)} → ${nf(b.g)} (${isr(b.g - b.g4, 0)} puan)` : '',
      yas: `Yaşlı bağımlılık %${nf(b.ya, 1)} · gelir ${nf(b.g)}`, nufus: `Nüfus değişimi %${isr(b.n, 2)} / yıl`,
      kadin: `Kadın istihdamı %${nf(b.k24, 1)}${b.k19 != null ? ` (2019: %${nf(b.k19, 1)})` : ''}`,
      ikiz: b.ikiz ? `Gelir ikizi: ${BK.get(b.ikiz).a}` : `Gelir ${nf(b.g)}`,
    }[ADIM[i].id];
    ipucu.innerHTML = `<strong>${esc(b.a)}</strong><br><small>${esc(ulkeAd(b))}</small>${deger ? `<br>${esc(deger)}` : ''}${b.tr ? '<br><small>Tıklayarak izleyin</small>' : ''}`;
    konumla(ev);
  }
  function konumla(ev) {
    const r = alan.getBoundingClientRect();
    let x = ev.clientX - r.left + 12;
    const y = ev.clientY - r.top + 12;
    if (x > r.width - 230) x -= 250;
    ipucu.style.transform = `translate(${x}px,${y}px)`;
    ipucu.style.opacity = 1;
  }

  function secimYap(k) {
    secili = BK.get(k);
    sec.value = k;
    seciliCiz(aktif, svg.transition().duration(AZ ? 0 : 500));
    kartlariYaz();
    gIz.selectAll('path.as-bag').attr('class', (b) => `as-bag${b === secili ? ' secili' : ''}`);
  }
  sec.addEventListener('change', () => secimYap(sec.value));

  function adimaGec(i) {
    if (i === aktif) return;
    aktif = i;
    adimlar.querySelectorAll('.as-adim').forEach((el, j) => el.classList.toggle('aktif', j === i));
    ciz(i);
  }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((e) => { if (e.isIntersecting) adimaGec(+e.target.dataset.i); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  adimlar.querySelectorAll('.as-adim').forEach((el) => io.observe(el));

  boyut();
  adimlar.children[0].classList.add('aktif');
  ciz(0, true);
  let zt;
  new ResizeObserver(() => {
    clearTimeout(zt);
    zt = setTimeout(() => {
      const w = W, h = H;
      boyut();
      if (Math.abs(w - W) > 4 || Math.abs(h - H) > 4) ciz(aktif, true);
    }, 150);
  }).observe(alan);
}
