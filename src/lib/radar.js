/**
 * Bölge Radarı — Veri Gezgini'nde haritada bir birime tıklayınca açılan karşılaştırma paneli.
 * (Regionalatlas Deutschland'daki "Regionsradar" fikrinden.)
 *
 *   const r = bolgeRadari({ ad: kod => metin, onKapat, onSec: kod => … });
 *   r.ac({ kod, duzey, g, yil, satirlar, tr, seri, geo, olcek, trSeri });
 *   r.kapat();  r.acikMi;  r.kod
 *
 * Bölümler: Türkiye içindeki yeri (yüzdelik) · OECD sınıfı (yalnız iller; aynı sınıftaki illerle) ·
 * komşularla karşılaştırma · sıralama kesiti · zaman içinde.
 * Dil yönsüzdür: "daha yüksek / daha düşük" (bir göstergede yüksek değerin iyi mi kötü mü olduğu söylenmez).
 */
import { sayi, kisa, esc } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const RENK = { secili: '#c24a28', komsu: '#b9b6ad', tr: '#2f2f2f', ikinci: '#2e6e9e' };

/* ------------------------------------------------------------------ komşuluk (ortak sınır noktası) */
const komsuOnbellek = new WeakMap();
/** GeoJSON birimleri arasında ortak köşe noktası olanlar komşudur. Sonuç geometri başına bir kez hesaplanır. */
export function komsular(geo) {
  if (komsuOnbellek.has(geo)) return komsuOnbellek.get(geo);
  const noktalar = new Map();
  const gez = (c, id) => {
    if (typeof c[0] === 'number') {
      const k = `${c[0].toFixed(4)},${c[1].toFixed(4)}`;
      let s = noktalar.get(k);
      if (!s) noktalar.set(k, (s = new Set()));
      s.add(id);
      return;
    }
    for (const x of c) gez(x, id);
  };
  for (const f of geo.features) gez(f.geometry.coordinates, f.id);
  const K = new Map(geo.features.map((f) => [f.id, new Set()]));
  for (const s of noktalar.values()) {
    if (s.size < 2) continue;
    for (const a of s) for (const b of s) if (a !== b) K.get(a).add(b);
  }
  komsuOnbellek.set(geo, K);
  return K;
}

/* ------------------------------------------------------------------ panel */
export function bolgeRadari({ ad, onKapat, onSec }) {
  const el = document.createElement('aside');
  el.className = 'radar';
  el.id = 'bolge-radari';
  el.hidden = true;
  el.setAttribute('aria-label', 'Bölge karşılaştırması');
  el.innerHTML = `
    <div class="radar-ust">
      <p class="radar-etiket">Bölge karşılaştırması</p>
      <button type="button" class="radar-kapat" aria-label="Kapat">×</button>
    </div>
    <div class="radar-govde" aria-live="polite"></div>`;
  document.body.appendChild(el);
  const govde = el.querySelector('.radar-govde');
  const ipucu = document.createElement('div');
  ipucu.className = 'radar-ipucu';
  el.appendChild(ipucu);

  const api = { acikMi: false, kod: null, duzey: null, grup: 'kente_erisim' };
  let sonAcilis = null;
  const kapat = () => {
    el.hidden = true;
    api.acikMi = false;
    api.kod = null;
    onKapat?.();
  };
  el.querySelector('.radar-kapat').onclick = kapat;
  document.addEventListener('keydown', (e) => e.key === 'Escape' && api.acikMi && kapat());
  // Sıralama ve komşu satırlarına tıklayınca o birime geç
  govde.addEventListener('click', (e) => {
    const gb = e.target.closest('[data-grup]');
    if (gb) {
      api.grup = gb.dataset.grup;
      const b = govde.querySelector('.radar-tipoloji');
      if (b && sonAcilis) b.outerHTML = tipolojiBolumu(sonAcilis, ad, api.grup);
      return;
    }
    const t = e.target.closest('[data-kod]');
    if (t && t.dataset.kod !== api.kod) onSec?.(t.dataset.kod);
  });

  api.kapat = kapat;
  api.ac = (o) => {
    api.acikMi = true;
    api.kod = o.kod;
    api.duzey = o.duzey;
    el.hidden = false;
    sonAcilis = o;
    o.grup = api.grup;
    govde.innerHTML = icerik(o, ad);
    const zk = govde.querySelector('.radar-zaman svg');
    if (zk) zamanGrafigi(zk, o, ad, ipucu);
  };
  return api;
}

/* ------------------------------------------------------------------ içerik */
function icerik(o, ad) {
  const { kod, duzey, g, yil, satirlar, tr, geo, olcek } = o;
  const f = (v) => sayi(v, g.ondalik);
  const birim = g.birim ? ` <span class="radar-birim">${esc(g.birim)}</span>` : '';
  const tur = { il: 'il', duzey2: 'bölge', duzey1: 'bölge', fua: 'kent' }[duzey] ?? 'birim';
  const turCogul = { il: 'il', duzey2: 'Düzey 2 bölgesi', duzey1: 'Düzey 1 bölgesi', fua: 'kent' }[duzey] ?? 'birim';
  const satir = satirlar.find((d) => d.kod === kod);
  // Türkiye değeri birimlerin değer aralığındaysa (oran, ortalama…) karşılaştırmaya girer; toplam
  // göstergelerde (nüfus, üretim…) Türkiye değeri birimlerin çok üstünde kaldığı için çubuk ve çizgi dışında tutulur.
  const vs0 = satirlar.map((d) => d.deger);
  const trKarsilastir = tr != null && tr >= Math.min(...vs0) && tr <= Math.max(...vs0);
  o.trKarsilastir = trKarsilastir;
  const bas = `
    <h2 class="radar-ad">${esc(ad(kod))}</h2>
    <p class="radar-gosterge">${esc(g.ad)} · ${esc(String(yil))}</p>`;
  if (!satir) {
    return `${bas}<p class="radar-yok">Bu ${tur} için ${esc(String(yil))} yılında veri yok.</p>`;
  }
  const n = satirlar.length;
  const sira = satirlar.findIndex((d) => d.kod === kod) + 1;
  const dusuk = satirlar.filter((d) => d.deger < satir.deger).length;
  const esit = satirlar.filter((d) => d.deger === satir.deger).length - 1;
  const yuzde = n > 1 ? ((dusuk + esit / 2) / (n - 1)) * 100 : 50;

  // 1. komşular
  let komsuHtml = '';
  if (duzey !== 'fua' && geo) {
    const K = komsular(geo).get(kod) ?? new Set();
    const deger = new Map(satirlar.map((d) => [d.kod, d.deger]));
    const liste = [...K].filter((k) => deger.has(k)).map((k) => ({ kod: k, ad: ad(k), deger: deger.get(k), tip: 'komsu' }));
    const eksik = [...K].filter((k) => !deger.has(k)).length;
    liste.push({ kod, ad: ad(kod), deger: satir.deger, tip: 'secili' });
    if (trKarsilastir) liste.push({ kod: 'TR', ad: 'Türkiye', deger: tr, tip: 'tr' });
    liste.sort((a, b) => b.deger - a.deger);
    const vs = liste.map((d) => d.deger);
    const min = Math.min(0, ...vs);
    const max = Math.max(0, ...vs);
    const x = (v) => ((v - min) / (max - min || 1)) * 100;
    const komsuSay = liste.filter((d) => d.tip === 'komsu').length;
    const ustte = liste.filter((d) => d.tip === 'komsu' && d.deger > satir.deger).length;
    komsuHtml = `
      <section class="radar-bolum">
        <h3>Komşularla karşılaştırma</h3>
        <p class="radar-aciklama">${komsuSay
          ? `Sınır komşusu ${komsuSay} ${turCogul} ile karşılaştırıldığında ${ustte ? `${ustte} komşunun değeri daha yüksek, ${komsuSay - ustte} komşununki daha düşük ya da eşit` : `en yüksek değer bu ${{ il: 'ilde', bölge: 'bölgede' }[tur] ?? 'birimde'}`}.`
          : 'Verisi olan sınır komşusu yok.'}${eksik ? ` ${eksik} komşunun verisi yok.` : ''}</p>
        <div class="radar-cubuklar" role="list">
          ${liste.map((d) => `
            <div class="radar-cubuk radar-cubuk--${d.tip}" role="listitem" ${d.tip === 'komsu' ? `data-kod="${esc(d.kod)}" title="${esc(d.ad)}: karşılaştırmayı aç"` : ''}>
              <span class="radar-cubuk-ad">${esc(d.tip === 'secili' ? d.ad : d.ad)}</span>
              <span class="radar-cubuk-iz"><i style="left:${Math.min(x(0), x(d.deger))}%;width:${Math.max(0.6, Math.abs(x(d.deger) - x(0)))}%"></i></span>
              <span class="radar-cubuk-deger">${f(d.deger)}</span>
            </div>`).join('')}
        </div>
      </section>`;
  }

  // 2. Türkiye içindeki yeri (yarım daire gösterge; yay haritanın renk ölçeğiyle boyanır)
  const siraliDeger = satirlar.map((d) => d.deger).sort((a, b) => a - b);
  const dilim = 24;
  const yay = Array.from({ length: dilim }, (_, i) => {
    const a0 = Math.PI * (1 - i / dilim);
    const a1 = Math.PI * (1 - (i + 1) / dilim);
    const q = siraliDeger[Math.min(n - 1, Math.floor(((i + 0.5) / dilim) * n))];
    return `<path d="${dilimYolu(a0, a1)}" fill="${olcek ? olcek(q) : '#d8835a'}"/>`;
  }).join('');
  const aci = Math.PI * (1 - yuzde / 100);
  const ib = [100 + 58 * Math.cos(aci), 96 - 58 * Math.sin(aci)];
  const yuzdeMetin = sayi(Math.round(yuzde), 0);
  const konumHtml = `
    <section class="radar-bolum">
      <h3>Türkiye içindeki yeri</h3>
      <div class="radar-gosterge-kap">
        <svg viewBox="0 0 200 112" class="radar-kadran" role="img" aria-label="Verisi olan ${n} ${turCogul} içinde değeri daha düşük olanların payı yüzde ${yuzdeMetin}">
          ${yay}
          <line x1="100" y1="96" x2="${ib[0].toFixed(1)}" y2="${ib[1].toFixed(1)}" stroke="#2f2f2f" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="100" cy="96" r="5" fill="#2f2f2f"/>
          <text x="14" y="110" class="radar-kadran-uc">en düşük</text>
          <text x="186" y="110" text-anchor="end" class="radar-kadran-uc">en yüksek</text>
        </svg>
        <div class="radar-deger">
          <strong>${f(satir.deger)}</strong>${birim}
          ${tr != null ? `<span class="radar-tr">Türkiye: ${f(tr)}</span>` : ''}
        </div>
      </div>
      <p class="radar-aciklama">Verisi olan ${n} ${turCogul} içinde değeri bu ${{ il: 'ilden', bölge: 'bölgeden', kent: 'kentten' }[tur] ?? 'birimden'} düşük olanların payı <strong>%${yuzdeMetin}</strong>.</p>
    </section>`;

  // 3. sıralama kesiti: ilk iki, seçilenin bir üstü ve altı, son
  const goster = new Set([0, 1, sira - 2, sira - 1, sira, n - 1].filter((i) => i >= 0 && i < n));
  const idx = [...goster].sort((a, b) => a - b);
  let onceki = -1;
  const siraSatir = idx.map((i) => {
    const bosluk = i - onceki > 1 ? '<tr class="radar-bosluk"><td colspan="3">…</td></tr>' : '';
    onceki = i;
    const d = satirlar[i];
    return `${bosluk}<tr class="${d.kod === kod ? 'secili' : ''}" ${d.kod !== kod ? `data-kod="${esc(d.kod)}"` : ''}>
      <td>${i + 1}</td><td>${esc(ad(d.kod))}</td><td>${f(d.deger)}</td></tr>`;
  }).join('');
  const siraHtml = `
    <section class="radar-bolum">
      <h3>Sıralama</h3>
      <p class="radar-aciklama">En yüksek değerden en düşüğe, ${n} ${turCogul} içinde <strong>${sira}.</strong> sırada.</p>
      <table class="radar-tablo"><thead><tr><th>Sıra</th><th>${tur === 'il' ? 'İl' : 'Ad'}</th><th>Değer</th></tr></thead><tbody>${siraSatir}</tbody></table>
    </section>`;

  const zamanHtml = Object.keys(o.seri ?? {}).length > 1 ? `
    <section class="radar-bolum radar-zaman">
      <h3>Zaman içinde</h3>
      <svg role="img" aria-label="${esc(ad(kod))} ve Türkiye, zaman serisi"></svg>
    </section>` : '';

  const tipHtml = duzey === 'il' && o.tipoloji?.iller?.[kod] ? tipolojiBolumu(o, ad, o.grup) : '';

  return `${bas}${konumHtml}${tipHtml}${komsuHtml}${siraHtml}${zamanHtml}
    <p class="radar-not">Karşılaştırmada yalnızca "daha yüksek / daha düşük" ifadeleri kullanılır; bir göstergede yüksek değerin olumlu ya da olumsuz olduğu gösterge ile değişir.</p>`;
}

/* ------------------------------------------------------------------ OECD sınıfı (iller) */
const GRUPLAR = {
  kente_erisim: {
    etiket: 'Kente erişim', sira: 1, siniflar: 'kente_erisim',
    kisa: { MR_L: 'Büyük metropol', MR_M: 'Orta metropol', NMR_M: 'Metropole yakın', NMR_S: 'Küçük kente yakın', NMR_R: 'Uzak' },
    tanim: 'Metropol: 250 binden kalabalık bir işlevsel kentsel alanı (FUA) olan il (büyük: 1,5 milyon üstü). Metropol olmayan iller o büyüklükte bir FUA\'ya ya da küçük bir kente yakınlığa göre ayrılır.',
  },
  kentsel_kirsal: {
    etiket: 'Kentsel–kırsal', sira: 2, siniflar: 'kentsel_kirsal_ayrintili',
    kisa: { PU: 'Ağırlıklı kentsel', INC: 'Ara – kente yakın', INR: 'Ara – uzak', IN: 'Ara (ayrımsız)', PRC: 'Kırsal – kente yakın', PRR: 'Kırsal – uzak' },
    tanim: 'Nüfusun kentsel ve kırsal yerleşimlerdeki payına göre sınıf; ara ve kırsal iller bir kente yakınlığa göre ayrılır. OECD beş ara ilde yakın/uzak ayrımı yapmamış.',
  },
};

/** İlin OECD sınıfı ve göstergenin sınıflara göre dağılımı (her sınıf bir sıra, her il bir nokta). */
function tipolojiBolumu(o, ad, grup = 'kente_erisim') {
  const T = o.tipoloji;
  const G = GRUPLAR[grup] ?? GRUPLAR.kente_erisim;
  const sinifListe = T.siniflar[G.siniflar] ?? T.siniflar.kentsel_kirsal;
  const sinifi = (k) => {
    const t = T.iller[k];
    if (!t) return null;
    return grup === 'kentsel_kirsal' ? (t[G.sira] ?? t[0]) : t[G.sira];
  };
  const { kod, g, satirlar } = o;
  const f = (v) => sayi(v, g.ondalik);
  const benim = sinifi(kod);
  const t = T.iller[kod];
  const siniflar = sinifListe.filter((c) => satirlar.some((d) => sinifi(d.kod) === c.kod));
  const gruplar = siniflar.map((c) => {
    const d = satirlar.filter((x) => sinifi(x.kod) === c.kod);
    const vs = d.map((x) => x.deger).sort((a, b) => a - b);
    const m = vs.length % 2 ? vs[(vs.length - 1) / 2] : (vs[vs.length / 2 - 1] + vs[vs.length / 2]) / 2;
    return { ...c, d, medyan: m };
  });
  const benimGrup = gruplar.find((x) => x.kod === benim);
  const satir = satirlar.find((d) => d.kod === kod);
  const sinifAd = (c) => sinifListe.find((x) => x.kod === c)?.ad ?? c;
  const otekiAd = grup === 'kente_erisim'
    ? `kentsel–kırsal: ${(T.siniflar.kentsel_kirsal_ayrintili ?? T.siniflar.kentsel_kirsal).find((x) => x.kod === (t[2] ?? t[0]))?.ad ?? ''}`
    : `kente erişim: ${T.siniflar.kente_erisim.find((x) => x.kod === t[1])?.ad ?? ''}`;
  const mb = t[3] ? `; OECD metropol bölgesi ${t[3]}` : '';

  let metin = `${esc(ad(kod))}, OECD sınıflamasında <strong>${esc(sinifAd(benim))}</strong> (${esc(otekiAd)}${esc(mb)}).`;
  if (satir && benimGrup) {
    const sirali = [...benimGrup.d].sort((a, b) => b.deger - a.deger);
    const k = sirali.findIndex((x) => x.kod === kod) + 1;
    metin += benimGrup.d.length > 1
      ? ` Bu sınıftaki ${benimGrup.d.length} ilin ortancası ${f(benimGrup.medyan)}; ${esc(ad(kod))} sınıf içinde <strong>${k}.</strong> sırada (yüksekten düşüğe).`
      : ' Bu sınıfta başka il yok.';
  }

  // şerit grafiği
  const W = 360, sol = 112, sag = 14, ust = o.trKarsilastir ? 16 : 6, sh = 24;
  const H = ust + gruplar.length * sh + 20;
  const tum = satirlar.map((d) => d.deger);
  let lo = Math.min(...tum), hi = Math.max(...tum);
  const log = lo > 0 && hi / lo > 30;
  const tx = log ? Math.log10 : (v) => v;
  const [a, b] = [tx(lo), tx(hi)];
  const x = (v) => sol + ((tx(v) - a) / (b - a || 1)) * (W - sol - sag);
  const titrek = (k) => { let h = 0; for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 997; return (h / 997 - 0.5) * 9; };
  let svg = '';
  gruplar.forEach((c, i) => {
    const yo = ust + i * sh + sh / 2;
    const sec = c.kod === benim;
    svg += `<text x="${sol - 8}" y="${yo}" text-anchor="end" dominant-baseline="middle" class="radar-tip-etiket${sec ? ' secili' : ''}">${esc(G.kisa[c.kod] ?? c.ad)} <tspan class="radar-tip-n">${c.d.length}</tspan></text>`;
    svg += `<line x1="${sol}" x2="${W - sag}" y1="${yo}" y2="${yo}" stroke="#ebe9e3"/>`;
    for (const d of c.d) {
      if (d.kod === kod) continue;
      svg += `<circle cx="${x(d.deger).toFixed(1)}" cy="${(yo + titrek(d.kod)).toFixed(1)}" r="3.4" fill="#aeaaa0" fill-opacity="0.75" data-kod="${esc(d.kod)}"><title>${esc(ad(d.kod))}: ${f(d.deger)}</title></circle>`;
    }
    svg += `<line x1="${x(c.medyan).toFixed(1)}" x2="${x(c.medyan).toFixed(1)}" y1="${yo - 8}" y2="${yo + 8}" stroke="#2f2f2f" stroke-width="2"><title>Ortanca: ${f(c.medyan)}</title></line>`;
    if (sec && satir) {
      svg += `<circle cx="${x(satir.deger).toFixed(1)}" cy="${yo}" r="5.5" fill="${RENK.secili}" stroke="#fff" stroke-width="1.5"><title>${esc(ad(kod))}: ${f(satir.deger)}</title></circle>`;
    }
  });
  if (o.trKarsilastir) {
    const xt = x(o.tr).toFixed(1);
    svg = `<line x1="${xt}" x2="${xt}" y1="${ust - 2}" y2="${ust + gruplar.length * sh}" stroke="${RENK.ikinci}" stroke-dasharray="3 3"/>
      <text x="${xt}" y="${ust - 5}" text-anchor="middle" class="radar-eksen" fill="${RENK.ikinci}">Türkiye</text>` + svg;
  }
  const ey = ust + gruplar.length * sh + 13;
  svg += `<text x="${sol}" y="${ey}" class="radar-eksen">${f(lo)}</text><text x="${W - sag}" y="${ey}" text-anchor="end" class="radar-eksen">${f(hi)}${log ? ' · log ölçek' : ''}</text>`;

  return `
    <section class="radar-bolum radar-tipoloji">
      <h3>OECD sınıfı</h3>
      <div class="radar-tip-sec" role="group" aria-label="Sınıflama">
        ${Object.entries(GRUPLAR).map(([k, v]) => `<button type="button" data-grup="${k}" aria-pressed="${k === grup}">${v.etiket}</button>`).join('')}
      </div>
      <p class="radar-aciklama">${metin}</p>
      <svg viewBox="0 0 ${W} ${H}" class="radar-serit" role="img" aria-label="${esc(g.ad)}: OECD sınıflarına göre illerin değerleri; siyah çizgi sınıf ortancası">${svg}</svg>
      <p class="radar-tip-tanim">Her nokta bir il, siyah çizgi sınıfın ortancası. ${G.tanim} Kaynak: OECD TL2024 bölge tipolojisi.</p>
    </section>`;
}

function dilimYolu(a0, a1) {
  const R = 84;
  const r = 60;
  const p = (a, rr) => `${(100 + rr * Math.cos(a)).toFixed(2)},${(96 - rr * Math.sin(a)).toFixed(2)}`;
  // dilimler arasına ince boşluk kalsın diye açı biraz daraltılır
  const e = 0.008;
  return `M${p(a0 - e, R)} A${R},${R} 0 0 1 ${p(a1 + e, R)} L${p(a1 + e, r)} A${r},${r} 0 0 0 ${p(a0 - e, r)} Z`;
}

/* ------------------------------------------------------------------ zaman grafiği (seçili birim ve Türkiye) */
function zamanGrafigi(svg, o, ad, ipucu) {
  const { kod, g } = o;
  const yillar = Object.keys(o.seri).sort();
  const seriler = [{ ad: ad(kod), kisa: kisaAd(ad(kod)), renk: RENK.secili, v: yillar.map((y) => o.seri[y]) }];
  if (o.trKarsilastir && o.trSeri && yillar.some((y) => o.trSeri[y] != null)) {
    seriler.push({ ad: 'Türkiye', kisa: 'Türkiye', renk: RENK.ikinci, v: yillar.map((y) => o.trSeri[y] ?? null) });
  }
  const W = 360;
  const H = 180;
  const m = { l: 44, r: 64, t: 12, b: 24 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const tum = seriler.flatMap((s) => s.v).filter((v) => v != null);
  let lo = Math.min(...tum);
  let hi = Math.max(...tum);
  const pay = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  lo -= pay;
  hi += pay;
  const x = (i) => m.l + (yillar.length === 1 ? 0 : (i / (yillar.length - 1)) * (W - m.l - m.r));
  const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
  const ciz = (tag, at, ebeveyn = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(at)) e.setAttribute(k, v);
    ebeveyn.appendChild(e);
    return e;
  };
  // ızgara ve eksenler
  const adim = guzelAdim((hi - lo) / 4);
  for (let t = Math.ceil(lo / adim) * adim; t <= hi; t += adim) {
    ciz('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: '#ebe9e3' });
    ciz('text', { x: m.l - 6, y: y(t), 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'radar-eksen' }).textContent =
      Math.abs(t) < adim / 2 ? '0' : Math.abs(t) >= 10000 ? kisa(t) : sayi(t, adim < 1 ? Math.min(2, g.ondalik ?? 1) : 0);
  }
  const etiketAdim = Math.ceil(yillar.length / 5);
  yillar.forEach((yy, i) => {
    const son = i === yillar.length - 1;
    if (son || (i % etiketAdim === 0 && yillar.length - 1 - i >= etiketAdim * 0.6)) {
      ciz('text', { x: x(i), y: H - 6, 'text-anchor': 'middle', class: 'radar-eksen' }).textContent = yy;
    }
  });
  for (const s of seriler) {
    let d = '';
    s.v.forEach((v, i) => {
      if (v == null) return;
      d += `${d && s.v[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    ciz('path', { d, fill: 'none', stroke: s.renk, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    const son = s.v.map((v, i) => [v, i]).filter(([v]) => v != null).at(-1);
    if (son) {
      ciz('text', { x: x(son[1]) + 6, y: y(son[0]), 'dominant-baseline': 'middle', class: 'radar-seri-etiket', fill: '#2f2f2f' }).textContent = s.kisa;
    }
  }
  // imleç + ipucu
  const imlec = ciz('line', { y1: m.t, y2: H - m.b, stroke: '#9d9b94', 'stroke-dasharray': '3 3', visibility: 'hidden' });
  const noktalar = seriler.map((s) => ciz('circle', { r: 4, fill: s.renk, stroke: '#fff', 'stroke-width': 1.5, visibility: 'hidden' }));
  const alan = ciz('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
  alan.addEventListener('mousemove', (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(yillar.length - 1, Math.round(((px - m.l) / (W - m.l - m.r)) * (yillar.length - 1))));
    imlec.setAttribute('x1', x(i));
    imlec.setAttribute('x2', x(i));
    imlec.setAttribute('visibility', 'visible');
    seriler.forEach((s, j) => {
      const v = s.v[i];
      noktalar[j].setAttribute('visibility', v == null ? 'hidden' : 'visible');
      if (v != null) {
        noktalar[j].setAttribute('cx', x(i));
        noktalar[j].setAttribute('cy', y(v));
      }
    });
    ipucu.innerHTML = `<strong>${yillar[i]}</strong>${seriler.map((s) => `<br><i style="background:${s.renk}"></i>${esc(s.ad)}: ${sayi(s.v[i], g.ondalik)}`).join('')}`;
    const pr = ipucu.parentElement.getBoundingClientRect();
    ipucu.style.left = `${e.clientX - pr.left}px`;
    ipucu.style.top = `${e.clientY - pr.top + ipucu.parentElement.scrollTop}px`;
    ipucu.style.opacity = 1;
  });
  alan.addEventListener('mouseleave', () => {
    imlec.setAttribute('visibility', 'hidden');
    noktalar.forEach((n) => n.setAttribute('visibility', 'hidden'));
    ipucu.style.opacity = 0;
  });
}

function guzelAdim(ham) {
  const us = 10 ** Math.floor(Math.log10(ham || 1));
  const k = ham / us;
  return (k <= 1 ? 1 : k <= 2 ? 2 : k <= 5 ? 5 : 10) * us;
}
function kisaAd(s) {
  const t = s.replace(/^TR\w+ \((.*)\)$/, '$1').split(',')[0];
  return t.length > 12 ? `${t.slice(0, 11)}…` : t;
}
