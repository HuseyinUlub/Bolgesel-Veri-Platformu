/**
 * Biçimlendirme ve metin yardımcıları — tüm sayfalarda ortak.
 */

const nfCache = new Map();

/** Sayıyı Türkçe biçimde yazar. `ondalik` verilmezse tam sayıda 0, değilse 2 basamak. */
export function sayi(v, ondalik) {
  if (v === null || v === undefined || Number.isNaN(v)) return 'Veri yok';
  const d = ondalik ?? (Number.isInteger(v) ? 0 : 2);
  if (!nfCache.has(d)) {
    nfCache.set(d, new Intl.NumberFormat('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  }
  return nfCache.get(d).format(v);
}

/** Büyük sayıları kısaltır: 15.754.053 -> "15,8 Mn" (eksen etiketleri için). */
export function kisa(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return `${sayi(v / 1e9, 1)} Mr`;
  if (a >= 1e6) return `${sayi(v / 1e6, 1)} Mn`;
  if (a >= 1e3) return `${sayi(v / 1e3, 1)} B`;
  return sayi(v, Number.isInteger(v) ? 0 : 1);
}

const TR_ASCII = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** "Dış Ticaret" -> "dis-ticaret". Veri hattındaki (Python) slugify ile aynı sonucu verir. */
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .replace(/I/g, 'ı')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (c) => TR_ASCII[c])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** HTML'e güvenli metin (veri kaynaklı metinler innerHTML'e yazılmadan önce). */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/* ------------------------------------------------------------------ Türkçe ek
 * Değişken bir ada ya da sayıya doğru eki getirir: ek('İstanbul','de') → "İstanbul'da",
 * ek('18','iyelik') → "18'i", ek('20','iyelik') → "20'si", ek('Sinop','de') → "Sinop'ta".
 * Sayılar okunuşlarının son sözcüğüne göre çekilir (0,045 → "kırk beş" → 0,045'e).
 */
const BIRLER = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const ONLAR = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
function sayininSonSozcugu(metin) {
  const m = String(metin).match(/(\d[\d.]*)(?:,(\d+))?\s*$/);
  if (!m) return null;
  const tam = m[2] && /[1-9]/.test(m[2]) ? m[2].replace(/^0+/, '') : m[1].replace(/\./g, '');
  const n = BigInt(tam || '0');
  if (n === 0n) return 'sıfır';
  if (n % 10n) return BIRLER[Number(n % 10n)];
  if (n % 100n) return ONLAR[Number((n % 100n) / 10n)];
  if (n % 1000n) return 'yüz';
  if (n % 1000000n) return 'bin';
  if (n % 1000000000n) return 'milyon';
  return 'milyar';
}
export function ek(metin, tur) {
  const s = String(metin);
  const soz = (sayininSonSozcugu(s) ?? s.trim().split(/\s+/).at(-1)).toLocaleLowerCase('tr');
  const unluler = soz.match(/[aıoueiöüâîû]/g) ?? ['e'];
  const u = unluler.at(-1).replace('â', 'a').replace('î', 'i').replace('û', 'u');
  const kalin = 'aıou'.includes(u);
  const yuvarlak = 'ouöü'.includes(u);
  const u4 = kalin ? (yuvarlak ? 'u' : 'ı') : yuvarlak ? 'ü' : 'i';
  const u2 = kalin ? 'a' : 'e';
  const son = soz.at(-1);
  const unluyleBiter = 'aıoueiöüâîû'.includes(son);
  const sert = 'çfhkpsşt'.includes(son);
  const ekler = {
    i: (unluyleBiter ? 'y' : '') + u4, // belirtme: İstanbul'u, Ankara'yı
    iyelik: (unluyleBiter ? 's' : '') + u4, // üçüncü tekil iyelik: 18'i, 20'si
    iyelik_i: (unluyleBiter ? 's' : '') + u4 + 'n' + u4, // iyelik + belirtme: 18'ini, 40'ını
    e: (unluyleBiter ? 'y' : '') + u2, // yönelme
    de: (sert ? 't' : 'd') + u2, // bulunma
    den: (sert ? 't' : 'd') + u2 + 'n', // ayrılma
    in: (unluyleBiter ? 'n' : '') + u4 + 'n', // ilgi
  };
  return `${s}'${ekler[tur]}`;
}
