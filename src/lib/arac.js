/**
 * Araç sayfaları (Harita Oluşturma, Grafik Oluşturma) için ortak veri seçimi.
 *
 * Veriler sitenin kendi veritabanından gelir (public/veri: manifest + k/<kategori>.json + ilce/<gösterge>.json);
 * eski araçlardaki gibi ayrı CSV dosyası indirilmez ya da yüklenmez. Kullanıcı isterse kendi verisini yükleyebilir.
 */
import { manifest, kategoriVerisi, geometri } from './data.js';
import { SITE } from '../site.config.js';
import { esc } from './format.js';
import { UST_BASLIKLAR } from './basliklar.js';

const BASE = `${import.meta.env.BASE_URL}veri/`;

/** Araçlardaki düzeyler (sıra = menü sırası) */
export const ARAC_DUZEYLERI = {
  tr: { veri: 'country', etiket: 'Türkiye', cogul: 'Türkiye' },
  duzey1: { veri: 'region12', etiket: 'Düzey 1', cogul: 'Düzey 1 bölgeleri' },
  duzey2: { veri: 'region26', etiket: 'Düzey 2', cogul: 'Düzey 2 bölgeleri' },
  il: { veri: 'province', etiket: 'İl', cogul: 'İller' },
  ilce: { veri: 'district', etiket: 'İlçe', cogul: 'İlçeler' },
};

const onbellek = new Map();
function json(yol) {
  if (!onbellek.has(yol)) {
    onbellek.set(yol, fetch(BASE + yol).then((r) => {
      if (!r.ok) throw new Error(`${yol} yüklenemedi (HTTP ${r.status})`);
      return r.json();
    }));
  }
  return onbellek.get(yol);
}

let ilcelerP;
/** İlçe adları ve bağlı oldukları il: { ILCE1757: { ad, ust: 'TR621' } } */
export const ilceler = () => (ilcelerP ??= json('ilceler.json'));

/** Tüm birimlerin adı ve üst birimi (manifest bölgeleri + ilçeler) */
export async function birimler() {
  const [M, I] = await Promise.all([manifest(), ilceler()]);
  const out = {};
  for (const [kod, b] of Object.entries(M.bolgeler)) out[kod] = { ad: b.ad, duzey: b.duzey, ust: b.ust };
  for (const [kod, b] of Object.entries(I)) out[kod] = { ad: b.ad, duzey: 'district', ust: b.ust };
  return out;
}

/** Birimin görünen adı: il "Adana", ilçe "Aladağ (Adana)", bölge "TR62 (Adana, Mersin)" */
export function birimAdi(B, kod, { kisa = false } = {}) {
  const b = B[kod];
  if (!b) return kod;
  if (b.duzey === 'district') return kisa ? b.ad : `${b.ad} (${B[b.ust]?.ad ?? b.ust})`;
  if (b.duzey === 'province' || b.duzey === 'country') return b.ad;
  return kisa ? kod : `${kod} (${b.ad})`;
}

/** kod, verilen üst birimin (her düzeyde) altında mı? */
export function altinda(B, kod, ust) {
  if (!ust || ust === 'TR') return true;
  for (let k = kod, i = 0; k && i < 6; k = B[k]?.ust, i++) if (k === ust) return true;
  return false;
}

/** Seçili düzeyde verisi olan kategoriler (manifest sırasıyla; ana sayfa kategorileri önce) */
export async function kategoriler(duzeyKey) {
  const M = await manifest();
  const hedef = ARAC_DUZEYLERI[duzeyKey].veri;
  const uygun = M.kategoriler.filter((k) => k.gostergeler.some((g) => g.duzeyler.includes(hedef))).map((k) => k.ad);
  const once = SITE.anaSayfaKategorileri.filter((k) => uygun.includes(k));
  return [...once, ...uygun.filter((k) => !once.includes(k)).sort((a, b) => a.localeCompare(b, 'tr'))];
}

export async function gostergeler(kategori, duzeyKey) {
  const M = await manifest();
  const hedef = ARAC_DUZEYLERI[duzeyKey].veri;
  return (M.kategoriByAd.get(kategori)?.gostergeler ?? []).filter((g) => g.duzeyler.includes(hedef));
}

/**
 * Göstergenin seçili düzeydeki bütün değerleri: { yıl: { kod: değer } }
 * İlçe değerleri gösterge başına ayrı dosyada (veri/ilce/<id>.json) durur.
 */
export async function degerler(kategori, gostergeId, duzeyKey) {
  const hedef = ARAC_DUZEYLERI[duzeyKey].veri;
  if (hedef === 'district') return json(`ilce/${gostergeId}.json`);
  const [M, data] = await Promise.all([manifest(), kategoriVerisi(kategori)]);
  const out = {};
  for (const [y, d] of Object.entries(data[gostergeId] ?? {})) {
    const s = {};
    for (const [kod, v] of Object.entries(d)) if (v != null && M.bolgeler[kod]?.duzey === hedef) s[kod] = v;
    if (Object.keys(s).length) out[y] = s;
  }
  return out;
}

/** Türkiye değerleri (karşılaştırma için): { yıl: değer } */
export async function turkiye(kategori, gostergeId) {
  const data = await kategoriVerisi(kategori);
  const out = {};
  for (const [y, d] of Object.entries(data[gostergeId] ?? {})) if (d.TR != null) out[y] = d.TR;
  return out;
}

/** Harita geometrisi; ilçe sınırları metre cinsinden projeksiyonlu gelir (diğerleri boylam/enlem) */
export function geo(duzeyKey) {
  return geometri(ARAC_DUZEYLERI[duzeyKey].veri);
}

/* ------------------------------------------------------------------ form yardımcıları */
export function secenekler(select, liste, secili) {
  select.innerHTML = liste.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
  if (secili != null && liste.some(([v]) => String(v) === String(secili))) select.value = String(secili);
}

/** Kategori listesi TÜİK tema başlıkları altında (src/lib/basliklar.js); temaya atanmamışlar "Diğer" altında */
export function kategoriSecenekleri(select, ks, secili) {
  const kalan = new Set(ks);
  let html = '';
  for (const u of UST_BASLIKLAR) {
    const l = u.kategoriler.filter((k) => kalan.has(k));
    l.forEach((k) => kalan.delete(k));
    if (l.length) html += `<optgroup label="${esc(u.ad)}">${l.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</optgroup>`;
  }
  if (kalan.size) html += `<optgroup label="Diğer">${[...kalan].map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}</optgroup>`;
  select.innerHTML = html;
  if (secili != null && ks.includes(secili)) select.value = secili;
}

/** "Konu: kırılım" adlı göstergeleri konu başlığı altında toplar (Veri Gezgini ile aynı kural) */
export function gostergeSecenekleri(select, liste, secili) {
  const konu = (ad) => (ad.includes(': ') ? ad.slice(0, ad.indexOf(': ')) : null);
  const sayac = new Map();
  for (const g of liste) {
    const k = konu(g.ad);
    if (k) sayac.set(k, (sayac.get(k) ?? 0) + 1);
  }
  const duz = [];
  const gruplar = new Map();
  for (const g of liste) {
    const k = konu(g.ad);
    if (k && sayac.get(k) > 1) {
      if (!gruplar.has(k)) gruplar.set(k, []);
      gruplar.get(k).push(g);
    } else duz.push(g);
  }
  const opt = (g, t) => `<option value="${esc(g.id)}" title="${esc(g.ad)}">${esc(t)}</option>`;
  select.innerHTML =
    duz.map((g) => opt(g, g.ad)).join('') +
    [...gruplar].map(([k, gs]) => `<optgroup label="${esc(k)}">${gs.map((g) => opt(g, g.ad.slice(k.length + 2))).join('')}</optgroup>`).join('');
  if (secili != null && liste.some((g) => g.id === secili)) select.value = secili;
}

/** Kapsam (alan) seçenekleri: düzeye göre üst birimler */
export async function kapsamSecenekleri(select, duzeyKey, secili) {
  const B = await birimler();
  const grup = (etiket, duzey) => {
    const kodlar = Object.keys(B).filter((k) => B[k].duzey === duzey).sort((a, b) => birimAdi(B, a).localeCompare(birimAdi(B, b), 'tr'));
    return `<optgroup label="${etiket}">${kodlar.map((k) => `<option value="${k}">${esc(birimAdi(B, k))}</option>`).join('')}</optgroup>`;
  };
  let html = '<option value="TR">Tüm Türkiye</option>';
  if (duzeyKey === 'duzey2') html += grup('Düzey 1 bölgesi', 'region12');
  if (duzeyKey === 'il') html += grup('Düzey 1 bölgesi', 'region12') + grup('Düzey 2 bölgesi', 'region26');
  if (duzeyKey === 'ilce') html += grup('İl', 'province') + grup('Düzey 2 bölgesi', 'region26') + grup('Düzey 1 bölgesi', 'region12');
  select.innerHTML = html;
  select.value = secili && select.querySelector(`option[value="${secili}"]`) ? secili : 'TR';
  select.disabled = duzeyKey === 'duzey1' || duzeyKey === 'tr';
}

/* ------------------------------------------------------------------ indirme */
export { indir } from './indir.js';

/** Excel'in Türkçe ayarlarıyla doğru açılan CSV (noktalı virgül, ondalık virgül, BOM) */
export function csv(satirlar) {
  const h = (v) => (typeof v === 'number' ? String(v).replace('.', ',') : /[;"\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
  return '﻿' + satirlar.map((r) => r.map(h).join(';')).join('\r\n');
}

export function dosyaAdi(metin) {
  return String(metin).toLocaleLowerCase('tr').replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c])
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'veri';
}

/* ------------------------------------------------------------------ kendi verisi */
const kucuk = (s) => String(s ?? '').toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]+/g, '');

/**
 * Yapıştırılan / yüklenen metni (CSV, TSV; Excel'den kopyalanan tablo) seçili düzeyin birimleriyle eşleştirir.
 * Birinci sütun kod (TR62, ILCE1757) ya da ad (Adana; ilçede "Adana-Aladağ", "Aladağ (Adana)" ya da benzersizse "Aladağ"),
 * ikinci sütun değer. İlk satır başlıksa (değer sayı değilse) atlanır.
 * @returns {{ degerler: Map<string, number>, eslesmeyen: string[], baslik: string|null }}
 */
export function kendiVerisi(metin, B, duzeyVeri) {
  const satirlar = metin.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const ayrac = [';', '\t', ','].find((a) => satirlar.slice(0, 5).every((s) => s.includes(a))) ?? ';';
  const adlar = new Map();
  const adSay = new Map();
  for (const [kod, b] of Object.entries(B)) {
    if (b.duzey !== duzeyVeri) continue;
    const anahtarlar = [kod, b.ad];
    if (duzeyVeri === 'district') {
      const il = B[b.ust]?.ad ?? '';
      anahtarlar.push(`${il}-${b.ad}`, `${il} ${b.ad}`, `${b.ad} (${il})`, `${b.ad}-${il}`, kod.replace('ILCE', ''));
    }
    for (const a of anahtarlar) {
      const k = kucuk(a);
      adSay.set(k, (adSay.get(k) ?? 0) + 1);
      adlar.set(k, kod);
    }
  }
  const out = new Map();
  const eslesmeyen = [];
  let baslik = null;
  satirlar.forEach((s, i) => {
    const h = s.split(ayrac).map((x) => x.trim().replace(/^"|"$/g, ''));
    if (h.length < 2) return;
    const deger = Number(h.at(-1).replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    if (!Number.isFinite(deger)) {
      if (i === 0) baslik = h.at(-1);
      return;
    }
    const k = kucuk(h[0]);
    const kod = adSay.get(k) === 1 ? adlar.get(k) : null;
    if (kod) out.set(kod, deger);
    else eslesmeyen.push(h[0]);
  });
  return { degerler: out, eslesmeyen, baslik };
}

/** SKA göstergelerinde "SKA 03 Amaç adı: 3.2.1 Gösterge" → başlık "3.2.1 Gösterge", ek "SKA 3 · Amaç adı" */
export function gorunenAd(ad) {
  const m = /^SKA (\d+) (.+?): (.+)$/.exec(ad ?? '');
  return m ? { baslik: m[3], ek: `SKA ${Number(m[1])} · ${m[2]}` } : { baslik: ad, ek: '' };
}
