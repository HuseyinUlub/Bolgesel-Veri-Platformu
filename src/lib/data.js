/**
 * Veri katmanı — pipeline/build_data.py çıktısını (public/veri) okur.
 *
 *   manifest.json      kategoriler, göstergeler (id, ad, birim, ondalık, yıllar, düzeyler), bölgeler
 *   k/<kategori>.json  { <göstergeId>: { <yıl>: { <bölgeKodu>: değer } } }
 *   geo/<düzey>.json   GeoJSON, feature.id = bölge kodu
 *
 * Bir kategori dosyası yalnızca ilk ihtiyaç duyulduğunda indirilir ve önbelleğe alınır.
 */

const BASE = `${import.meta.env.BASE_URL}veri/`;

/** Arayüzdeki düzey adları ↔ veri düzeyleri */
export const DUZEYLER = {
  il: { veri: 'province', etiket: 'İller', cogul: 'iller' },
  duzey2: { veri: 'region26', etiket: 'Düzey 2', cogul: 'bölgeler' },
  duzey1: { veri: 'region12', etiket: 'Düzey 1', cogul: 'bölgeler' },
  fua: { veri: 'fua', etiket: 'Kentler (OECD FUA)', cogul: 'kentler', zemin: 'province' },
  // Harita yerine Türkiye'nin zaman serisi çizilir (yalnız Türkiye için yayımlanan göstergeler, örn. SKA)
  tr: { veri: 'country', etiket: 'Türkiye', cogul: 'Türkiye', zaman: true },
};

/** Göstergenin Türkiye değerleri: { yıl: değer } */
export async function turkiyeSerisi(kategoriAd, gostergeId) {
  const data = await kategoriVerisi(kategoriAd);
  const out = {};
  for (const [y, d] of Object.entries(data[gostergeId] ?? {})) if (d.TR != null) out[y] = d.TR;
  return out;
}

const cache = new Map();
function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(BASE + path).then((r) => {
        if (!r.ok) throw new Error(`${path} yüklenemedi (HTTP ${r.status})`);
        return r.json();
      }),
    );
  }
  return cache.get(path);
}

/** İllerin OECD tipolojisi (il-tipolojisi.json); yüklenemezse null */
export function ilTipolojisi() {
  return getJSON('il-tipolojisi.json').catch(() => null);
}

let manifestP;
export function manifest() {
  manifestP ??= getJSON('manifest.json').then((m) => {
    m.gostergeById = new Map();
    for (const k of m.kategoriler) for (const g of k.gostergeler) m.gostergeById.set(g.id, { ...g, kategori: k.ad });
    m.kategoriByAd = new Map(m.kategoriler.map((k) => [k.ad, k]));
    return m;
  });
  return manifestP;
}

export async function kategoriVerisi(kategoriAd) {
  const m = await manifest();
  const k = m.kategoriByAd.get(kategoriAd);
  if (!k) throw new Error(`Kategori bulunamadı: ${kategoriAd}`);
  return getJSON(k.dosya);
}

export function geometri(veriDuzeyi) {
  return getJSON(`geo/${veriDuzeyi}.json`);
}

/**
 * Bir göstergenin belirli yıl ve düzeydeki değerleri, büyükten küçüğe.
 * @returns {Promise<Array<{kod:string, ad:string, deger:number}>>}
 */
export async function seri(kategoriAd, gostergeId, yil, duzeyKey) {
  const [m, data] = await Promise.all([manifest(), kategoriVerisi(kategoriAd)]);
  const hedef = DUZEYLER[duzeyKey].veri;
  const yilDegerleri = data[gostergeId]?.[yil] ?? {};
  const out = [];
  for (const [kod, deger] of Object.entries(yilDegerleri)) {
    const b = m.bolgeler[kod];
    if (b?.duzey === hedef && deger !== null) out.push({ kod, ad: b.ad, deger });
  }
  return out.sort((a, b) => b.deger - a.deger);
}

/** Türkiye değeri (karşılaştırma için), yoksa null */
export async function turkiyeDegeri(kategoriAd, gostergeId, yil) {
  const data = await kategoriVerisi(kategoriAd);
  return data[gostergeId]?.[yil]?.TR ?? null;
}

/**
 * Haritalanabilir yıllar: o düzeyde, göstergenin en kapsamlı yılının en az yarısı kadar birimde değeri olan yıllar.
 * İstanbul, İzmir ve Ankara'nın il değerleri bölge verisinden bir yıl erken gelebilir; yalnız bu üç ili içeren
 * bir yıl haritada boş görünmesin diye elenir (şehrin kendi zaman serisinde yine görünür).
 */
export function kapsamliYillar(s, uygun) {
  const say = Object.entries(s ?? {}).map(([y, d]) => [y, Object.entries(d).filter(([k, v]) => v != null && uygun(k)).length]);
  const enCok = Math.max(0, ...say.map(([, n]) => n));
  return say.filter(([, n]) => n > 0 && n >= enCok / 2).map(([y]) => y).sort();
}

/** Göstergenin seçili düzeyde haritalanabilir yılları (yeniden eskiye) */
export async function yillar(kategoriAd, gostergeId, duzeyKey) {
  const [m, data] = await Promise.all([manifest(), kategoriVerisi(kategoriAd)]);
  const hedef = DUZEYLER[duzeyKey].veri;
  return kapsamliYillar(data[gostergeId], (kod) => m.bolgeler[kod]?.duzey === hedef)
    .map(Number)
    .sort((a, b) => b - a);
}
