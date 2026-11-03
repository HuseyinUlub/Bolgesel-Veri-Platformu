/**
 * Anadolu dokuma motiflerinden esinlenen sade çizgi simgeler (kilim/cicim geometrisi).
 * Hepsi 100×100 kutuda, yalnızca çizgiyle tanımlıdır; renk ve kalınlık çizen tarafça verilir.
 * Anadolu'dakiler projesinin görsel diliyle akraba, ama buradaki çizimler bu site için yeniden çizildi.
 *
 *   motifSvg('goz', { renk: '#c74827', kalinlik: 5 })  → '<svg …>…</svg>'  (HTML içine koymak için)
 *   motifCiz(g, 'goz', x, y, boyut, renk, kalinlik)   → SVG grubuna doğrudan çizer
 */
const NS = 'http://www.w3.org/2000/svg';

/** Anadolu'dakiler paletinden: kiremit, hardal, adaçayı, is mavisi, mürekkep, krem */
export const TOPRAK = {
  kiremit: '#c74827',
  hardal: '#dd9a3a',
  adacayi: '#7d9076',
  ismavi: '#5b7f95',
  murekkep: '#2f2f2f',
  krem: '#fffcf0',
};

export const MOTIFLER = {
  // Göz: nazara karşı, iç içe eşkenar dörtgen
  goz: ['M50 8 L92 50 L50 92 L8 50 Z', 'M50 30 L70 50 L50 70 L30 50 Z', 'M50 44 L56 50 L50 56 L44 50 Z'],
  // Elibelinde: bereket, kolları belinde kadın figürü
  elibelinde: [
    'M50 6 L60 16 L50 26 L40 16 Z',
    'M50 26 L28 42 L40 50 L28 58 L50 76 L72 58 L60 50 L72 42 Z',
    'M28 42 L16 30', 'M72 42 L84 30', 'M42 70 L34 94', 'M58 70 L66 94',
  ],
  // Koçboynuzu: güç ve kahramanlık
  kocboynuzu: [
    'M50 92 L50 48',
    'M50 48 C50 16 16 14 16 38 C16 56 40 58 40 42 C40 34 30 32 28 40',
    'M50 48 C50 16 84 14 84 38 C84 56 60 58 60 42 C60 34 70 32 72 40',
    'M36 92 L64 92',
  ],
  // Hayat ağacı: süreklilik
  hayatagaci: [
    'M50 94 L50 8',
    'M32 28 L50 16 L68 28', 'M26 46 L50 32 L74 46', 'M20 64 L50 48 L80 64', 'M28 80 L50 68 L72 80',
    'M36 94 L64 94',
  ],
  // Yıldız: mutluluk
  yildiz: ['M50 8 L61 39 L92 50 L61 61 L50 92 L39 61 L8 50 L39 39 Z', 'M50 38 L62 50 L50 62 L38 50 Z'],
  // Su yolu: hayatın akışı
  suyolu: [
    'M6 30 L20 16 L34 30 L48 16 L62 30 L76 16 L90 30',
    'M6 56 L20 42 L34 56 L48 42 L62 56 L76 42 L90 56',
    'M6 82 L20 68 L34 82 L48 68 L62 82 L76 68 L90 82',
  ],
};

export const MOTIF_ADLARI = Object.keys(MOTIFLER);

export function motifSvg(ad, { renk = TOPRAK.kiremit, kalinlik = 5, boyut = 48, baslik = '' } = {}) {
  const yollar = MOTIFLER[ad].map((d) => `<path d="${d}"/>`).join('');
  const erisim = baslik ? `role="img" aria-label="${baslik}"` : 'aria-hidden="true"';
  return `<svg viewBox="0 0 100 100" width="${boyut}" height="${boyut}" ${erisim} fill="none" stroke="${renk}"
    stroke-width="${kalinlik}" stroke-linejoin="miter" stroke-linecap="square">${yollar}</svg>`;
}

export function motifCiz(g, ad, x, y, boyut, renk, kalinlik = 5) {
  const k = document.createElementNS(NS, 'g');
  k.setAttribute('transform', `translate(${x},${y}) scale(${boyut / 100})`);
  k.setAttribute('fill', 'none');
  k.setAttribute('stroke', renk);
  k.setAttribute('stroke-width', kalinlik);
  k.setAttribute('stroke-linejoin', 'miter');
  k.setAttribute('stroke-linecap', 'square');
  for (const d of MOTIFLER[ad]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    k.appendChild(p);
  }
  g.appendChild(k);
  return k;
}

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  parent?.appendChild(e);
  return e;
}
const RENKLER = [TOPRAK.kiremit, TOPRAK.hardal, TOPRAK.adacayi, TOPRAK.ismavi];

/** Kilim bordürü: krem zemin üzerinde kancalı eşkenar dörtgenler ve aralarında küçük gözler */
export function kilimBordur(svg, y, h, W) {
  const g = el('g', {}, svg);
  el('rect', { x: 0, y, width: W, height: h, fill: TOPRAK.krem }, g);
  el('line', { x1: 0, x2: W, y1: y + 1.5, y2: y + 1.5, stroke: TOPRAK.murekkep, 'stroke-width': 1 }, g);
  el('line', { x1: 0, x2: W, y1: y + h - 1.5, y2: y + h - 1.5, stroke: TOPRAK.murekkep, 'stroke-width': 1 }, g);
  const u = h * 1.9; // bir desen birimi
  const cy = y + h / 2;
  const r = h * 0.34;
  for (let i = 0, x = u / 2; x < W + u; i++, x += u) {
    const renk = RENKLER[i % RENKLER.length];
    el('path', { d: `M${x} ${cy - r} L${x + r} ${cy} L${x} ${cy + r} L${x - r} ${cy} Z`, fill: renk }, g);
    el('path', { d: `M${x} ${cy - r * 0.4} L${x + r * 0.4} ${cy} L${x} ${cy + r * 0.4} L${x - r * 0.4} ${cy} Z`, fill: TOPRAK.krem }, g);
    // kancalar
    el('path', { d: `M${x - r} ${cy} L${x - r - r * 0.45} ${cy - r * 0.45} M${x + r} ${cy} L${x + r + r * 0.45} ${cy + r * 0.45}`,
      stroke: renk, 'stroke-width': 1.6, fill: 'none' }, g);
    const ax = x + u / 2;
    el('path', { d: `M${ax} ${cy - 2.5} L${ax + 2.5} ${cy} L${ax} ${cy + 2.5} L${ax - 2.5} ${cy} Z`, fill: TOPRAK.murekkep }, g);
  }
}

