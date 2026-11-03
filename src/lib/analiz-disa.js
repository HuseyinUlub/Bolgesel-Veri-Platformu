/**
 * Analiz Masası dışa aktarma: grafik/harita PNG, bulgular metni, renk paletleri.
 *
 * PNG: ekrandaki SVG kopyalanır, hesaplanmış stiller satır içine yazılır, başlık, alt başlık, lejant ve kaynak satırı
 * eklenerek tek bir SVG oluşturulur; yazı tipi (Source Sans 3) dosyaya gömülür ve tuval üzerinden 2 kat çözünürlükte
 * PNG'ye çevrilir.
 */
import { interpolateRgbBasis, quantize } from 'd3-interpolate';
import f400 from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?url';
import f400e from '@fontsource/source-sans-3/files/source-sans-3-latin-ext-400-normal.woff2?url';
import f600 from '@fontsource/source-sans-3/files/source-sans-3-latin-600-normal.woff2?url';
import f600e from '@fontsource/source-sans-3/files/source-sans-3-latin-ext-600-normal.woff2?url';

/* ---------- paletler ---------- */
export const SIRALI = {
  toprak: { ad: 'Toprak (platform)', r: ['#f6e9dc', '#e8b999', '#d8835a', '#c74827', '#86301a'] },
  deniz: { ad: 'Deniz', r: ['#e7f0f2', '#a9cbd4', '#5f9fb1', '#2b6f86', '#123f52'] },
  yesil: { ad: 'Yeşil', r: ['#eef3e2', '#c3d9a0', '#86b465', '#4a8a3c', '#1f5527'] },
  mor: { ad: 'Mor', r: ['#f1ebf5', '#cdb8de', '#a183c2', '#71519c', '#432b68'] },
  gri: { ad: 'Gri tonlar', r: ['#f0efea', '#cfccc3', '#a19d92', '#6c6960', '#38362f'] },
  viridis: { ad: 'Renk körlüğüne uygun (viridis)', r: ['#fde725', '#5ec962', '#21918c', '#3b528b', '#440154'] },
};
export const IKI_YONLU = {
  kahve: { ad: 'Kahve–mavi (platform)', r: ['#8a5a0e', '#d9b36b', '#ece8df', '#9ab8cf', '#2e6e9e'] },
  kirmizi: { ad: 'Kırmızı–mavi', r: ['#b2182b', '#ef8a62', '#f0ece6', '#67a9cf', '#2166ac'] },
  mor: { ad: 'Mor–yeşil', r: ['#762a83', '#af8dc3', '#ece8df', '#7fbf7b', '#1b7837'] },
  turuncu: { ad: 'Turuncu–mor (renk körlüğüne uygun)', r: ['#b35806', '#f1a340', '#efece6', '#998ec3', '#542788'] },
};
/** n sınıf için renkler: 5 duraklı paletten aradeğerleme */
export const renkler = (palet, n) => (n === palet.length ? [...palet] : quantize(interpolateRgbBasis(palet), n));

export const NOKTA_PALET = {
  platform: { ad: 'Platform renkleri' },
  okabe: { ad: 'Renk körlüğüne uygun', bolge: ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'], oecd: ['#0072B2', '#E69F00', '#009E73'] },
  tek: { ad: 'Tek renk', tek: '#a8502e' },
};

/* ---------- SVG → PNG ---------- */
const STIL = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'opacity', 'font-size', 'font-weight', 'text-anchor', 'paint-order', 'stroke-linejoin', 'dominant-baseline'];
const AILE = "'Source Sans 3', 'Segoe UI', Arial, sans-serif";

let fontP;
async function fontCss() {
  const b64 = async (u) => {
    const buf = await (await fetch(u)).arrayBuffer();
    let s = ''; const v = new Uint8Array(buf);
    for (let i = 0; i < v.length; i += 0x8000) s += String.fromCharCode.apply(null, v.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const yuz = async (u, w, aralik) => `@font-face{font-family:'Source Sans 3';font-weight:${w};src:url(data:font/woff2;base64,${await b64(u)}) format('woff2');unicode-range:${aralik};}`;
  const L = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const LE = 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  return (await Promise.all([yuz(f400, 400, L), yuz(f400e, 400, LE), yuz(f600, 600, L), yuz(f600e, 600, LE)])).join('');
}

const olc = (() => { let c; return (metin, font) => { c ??= document.createElement('canvas').getContext('2d'); c.font = font; return c.measureText(metin).width; }; })();
function sar(metin, font, gen) {
  const out = []; let s = '';
  for (const k of String(metin).split(/\s+/).filter(Boolean)) {
    const d = s ? `${s} ${k}` : k;
    if (s && olc(d, font) > gen) { out.push(s); s = k; } else s = d;
  }
  if (s) out.push(s);
  return out;
}
const xe = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Ekrandaki SVG'nin stilleri satır içine yazılmış kopyası */
function svgKopya(svg) {
  const k = svg.cloneNode(true);
  const a = [svg, ...svg.querySelectorAll('*')], b = [k, ...k.querySelectorAll('*')];
  a.forEach((el, i) => {
    const cs = getComputedStyle(el), h = b[i];
    if (cs.display === 'none' || cs.visibility === 'hidden') { h.setAttribute('display', 'none'); return; }
    STIL.forEach((p) => { const v = cs.getPropertyValue(p); if (v) h.style.setProperty(p, v); });
    if (el.tagName === 'text') h.style.setProperty('font-family', AILE);
    h.removeAttribute('class');
  });
  return k;
}

/** Lejant öğeleri ekrandaki lejant kutusundan okunur: [{renk, yuvarlak, metin}] ya da [{not}] */
export function lejantOku(kutu) {
  const out = [];
  kutu?.querySelectorAll(':scope > span').forEach((s) => {
    const i = s.querySelector(':scope > i');
    if (i) out.push({ renk: getComputedStyle(i).backgroundColor, yuvarlak: i.classList.contains('yuvarlak'), metin: s.textContent.trim() });
    else if (s.classList.contains('boyut-lejant')) { const k = s.querySelector('.bl-metin')?.cloneNode(true); k?.querySelectorAll('br').forEach((b) => b.replaceWith(' · ')); out.push({ not: k?.textContent.replace(/\s+/g, ' ').trim() ?? '' }); }
    else if (s.textContent.trim()) out.push({ not: s.textContent.trim() });
  });
  return out;
}

/**
 * Başlık, alt başlık, şekil, lejant ve kaynak satırından oluşan SVG metni.
 * @param {{svg: SVGSVGElement, baslik: string, alt?: string, lejant?: object[], kaynak?: string, genislik?: number}} o
 */
export async function bilesik(o) {
  const W = o.genislik ?? 960, m = 28, ic = W - 2 * m;
  const renk = { metin: '#1f1f1f', ikincil: '#55524b', soluk: '#7a776e', zemin: '#fbf8f2', cizgi: '#e2ddd2' };
  const parca = [];
  let y = m;
  const satirlar = (metin, font, boyut, agirlik, dolgu, ara) => {
    sar(metin, `${agirlik} ${boyut}px ${AILE}`, ic).forEach((s) => { y += ara; parca.push(`<text x="${m}" y="${y}" font-family="${AILE}" font-size="${boyut}" font-weight="${agirlik}" fill="${dolgu}">${xe(s)}</text>`); });
  };
  satirlar(o.baslik, '', 24, 600, renk.metin, 26);
  if (o.alt) { y += 2; satirlar(o.alt, '', 14, 400, renk.ikincil, 19); }
  y += 14;
  const vb = (o.svg.getAttribute('viewBox') || `0 0 ${o.svg.clientWidth} ${o.svg.clientHeight}`).split(/[\s,]+/).map(Number);
  const olcek = ic / vb[2], sh = vb[3] * olcek;
  const k = svgKopya(o.svg);
  k.setAttribute('x', m); k.setAttribute('y', y); k.setAttribute('width', ic); k.setAttribute('height', sh);
  k.removeAttribute('style'); k.setAttribute('overflow', 'visible');
  parca.push(new XMLSerializer().serializeToString(k));
  y += sh + 16;
  // lejant: akışlı yerleşim
  if (o.lejant?.length) {
    const fs = 13, font = `400 ${fs}px ${AILE}`;
    let x = m; y += 4;
    const yeniSatir = () => { x = m; y += 20; };
    for (const L of o.lejant) {
      if (L.not != null) {
        const sat = sar(L.not, font, ic);
        if (x > m) yeniSatir();
        sat.forEach((s, i) => { if (i) y += 18; parca.push(`<text x="${m}" y="${y + 10}" font-family="${AILE}" font-size="${fs - 1}" fill="${renk.soluk}">${xe(s)}</text>`); });
        yeniSatir();
        continue;
      }
      const w = 18 + olc(L.metin, font) + 16;
      if (x > m && x + w > W - m) yeniSatir();
      parca.push(L.yuvarlak ? `<circle cx="${x + 6}" cy="${y + 6}" r="6" fill="${L.renk}"/>` : `<rect x="${x}" y="${y}" width="12" height="12" rx="2" fill="${L.renk}" stroke="rgba(0,0,0,.12)" stroke-width=".5"/>`);
      parca.push(`<text x="${x + 18}" y="${y + 10.5}" font-family="${AILE}" font-size="${fs}" fill="${renk.ikincil}">${xe(L.metin)}</text>`);
      x += w;
    }
    if (x > m) y += 20;
  }
  y += 6;
  parca.push(`<line x1="${m}" x2="${W - m}" y1="${y}" y2="${y}" stroke="${renk.cizgi}"/>`);
  y += 4;
  if (o.kaynak) satirlar(o.kaynak, '', 12, 400, renk.soluk, 17);
  satirlar(`Türkiye Bölgesel Veri Analizleri · Analiz Masası · ${new Date().toLocaleDateString('tr-TR')}`, '', 12, 400, renk.soluk, 17);
  y += m - 6;
  const css = await (fontP ??= fontCss().catch(() => ''));
  return { W, H: Math.ceil(y), metin: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Math.ceil(y)}" viewBox="0 0 ${W} ${Math.ceil(y)}"><style>${css}</style><rect width="100%" height="100%" fill="${renk.zemin}"/>${parca.join('')}</svg>` };
}

export async function pngYap(o) {
  const { W, H, metin } = await bilesik(o);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(metin)}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = W * 2; c.height = H * 2;
  const ctx = c.getContext('2d');
  ctx.scale(2, 2);
  ctx.drawImage(img, 0, 0, W, H);
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

/* ---------- bulgular metni ---------- */
const temiz = (s) => s.replace(/\s+/g, ' ').trim();
function dugum(el, out) {
  for (const c of el.children) {
    if (c.matches('svg, button[data-temizle], .cubuk')) continue;
    if (c.matches('h3')) { out.push('', temiz(c.textContent).toLocaleUpperCase('tr')); continue; }
    if (c.matches('.liste')) {
      const s = [...c.children];
      for (let i = 0; i < s.length; i += 2) out.push(`  • ${temiz(s[i].textContent)}: ${temiz(s[i + 1]?.textContent ?? '')}`);
      continue;
    }
    if (c.matches('.sayilar')) { [...c.children].forEach((d) => out.push(`  • ${temiz(d.querySelector('span')?.textContent ?? '')}: ${temiz(d.querySelector('b')?.textContent ?? '')}`)); continue; }
    if (c.matches('.iliskiler')) { c.querySelectorAll('button').forEach((b) => out.push(`  • ${temiz(b.querySelector('span')?.textContent ?? '')} (${temiz(b.querySelector('.r')?.textContent ?? '')})`)); continue; }
    if (c.matches('.alt-b')) { out.push(temiz(c.textContent) + ':'); continue; }
    if (c.matches('p, .iliski-guc')) {
      const k = c.cloneNode(true); k.querySelectorAll('button[data-temizle]').forEach((b) => b.remove());
      k.querySelectorAll('.alt-b').forEach((e) => e.append(':')); k.querySelectorAll('br').forEach((b) => b.replaceWith(' '));
      const t = temiz(k.textContent.replace(/·\s*$/, ''));
      if (t) out.push(t);
      continue;
    }
    dugum(c, out);
  }
}
export function bulgularMetni(kutu, { baslik, alt, kaynak }) {
  const out = [baslik];
  if (alt) out.push(alt);
  kutu.querySelectorAll(':scope > .kart').forEach((k) => dugum(k, out));
  out.push('', kaynak ? temiz(kaynak) : '', `Türkiye Bölgesel Veri Analizleri · Analiz Masası · ${location.href}`, `İndirme tarihi: ${new Date().toLocaleDateString('tr-TR')}`);
  return out.filter((s, i, a) => !(s === '' && a[i - 1] === '')).join('\r\n');
}
