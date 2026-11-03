/**
 * Hikâye bölümlerinin ortak yardımcıları.
 *
 *   const v = await yukle('Eğitim', 'Nüfus');       // { M, k: { Eğitim: {...}, Nüfus: {...} } }
 *   const s = seri(v, 'Eğitim', 'Ortalama Eğitim')  // gösterge adının başıyla bulunur → { yıl: { kod: değer } }
 *   const [yil, d] = son(s, 'il')                    // son yılın il değerleri
 *   turkiye(s)                                       // { yıl: Türkiye değeri }
 */
import { manifest, kategoriVerisi, kapsamliYillar } from '../lib/data.js';
import { sayi, esc, ek } from '../lib/format.js';

export { sayi, esc, ek };

const DUZEY = {
  il: /^TR[0-9A-C]\d\d$/,
  d2: /^TR[0-9A-C]\d$/,
  d1: /^TR[0-9A-C]$/,
  fua: /^TR\d{3}F$/,
};

export async function yukle(...kategoriler) {
  const M = await manifest();
  const k = Object.fromEntries(await Promise.all(kategoriler.map(async (a) => [a, await kategoriVerisi(a)])));
  return { M, k };
}

/** Göstergeyi adının başıyla bulur (manifestte tek eşleşme beklenir) */
export function gosterge(M, kategori, adBasi) {
  const g = M.kategoriByAd.get(kategori)?.gostergeler.find((x) => x.ad === adBasi || x.ad.startsWith(adBasi));
  if (!g) throw new Error(`Gösterge bulunamadı: ${kategori} / ${adBasi}`);
  return g;
}

export function seri(v, kategori, adBasi) {
  return v.k[kategori]?.[gosterge(v.M, kategori, adBasi).id] ?? {};
}

/** Belirli düzeyin (il, d2, fua) son yılı ve değerleri: [yıl, {kod: değer}] */
export function son(s, duzey = 'il', yil = null) {
  const re = DUZEY[duzey];
  const y = yil ?? kapsamliYillar(s, (c) => re.test(c)).at(-1);
  const out = {};
  for (const [kod, x] of Object.entries(s[y] ?? {})) if (re.test(kod) && x != null) out[kod] = x;
  return [y, out];
}

/** Türkiye serisi {yıl: değer} */
export function turkiye(s) {
  const out = {};
  for (const [y, d] of Object.entries(s)) if (d.TR != null) out[y] = d.TR;
  return out;
}

/** Tek bir bölgenin serisi {yıl: değer} */
export function bolge(s, kod) {
  const out = {};
  for (const [y, d] of Object.entries(s)) if (d[kod] != null) out[y] = d[kod];
  return out;
}

export const sirala = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
export const toplam = (o) => Object.values(o).reduce((a, b) => a + b, 0);
export const ilkYil = (o) => Object.keys(o).sort()[0];
export const sonYil = (o) => Object.keys(o).sort().at(-1);

/** Değerlerin en büyük n tanesinin toplamdaki payı (%) */
export function ilkPay(o, n) {
  const s = sirala(o);
  return (100 * s.slice(0, n).reduce((a, [, x]) => a + x, 0)) / toplam(o);
}

/** "İstanbul, Ankara ve İzmir" */
export function liste(adlar) {
  return adlar.length < 2 ? adlar.join('') : `${adlar.slice(0, -1).join(', ')} ve ${adlar.at(-1)}`;
}

/** Harita adımı için veri fonksiyonu */
export const haritaVerisi = (kategori, adBasi, duzey = 'il') => (v) => son(seri(v, kategori, adBasi), duzey);
