/**
 * Bölgesel Eşitsizlik bölümü: src/pages/esitsizlik.js içindeki ADIMLAR'ı hikâye motorunun
 * adım biçimine çevirir (metinler ve sayılar orada tanımlı).
 */
import { ADIMLAR, esitsizlikVerisi } from '../pages/esitsizlik.js';

const sonYil = (h) => {
  const y = Object.keys(h).sort().at(-1);
  return [y, h[y]];
};

export const ESITSIZLIK = {
  id: 'esitsizlik',
  baslik: 'Bölgesel Eşitsizlik',
  giris:
    'İller arasındaki gelir farkı son yirmi yılda nasıl değişti? OECD\'nin bölgesel eşitsizlik ölçüleriyle Türkiye\'nin kendi içindeki farklarına bakıyoruz.',
  yukle: esitsizlikVerisi,
  adimlar: ADIMLAR.map((a) => ({
    baslik: a.baslik,
    metin: a.metin,
    gorsel:
      a.gorsel === 'cizgi'
        ? {
            tur: 'cizgi',
            baslik: a.grafikBaslik,
            seriler: a.seriler.map((s) => ({ ...s, veri: (d) => d.seriler[s.anahtar] ?? {} })),
            ondalik: a.ondalik,
            birim: a.birim,
            yigilmis: a.yigilmis,
            basvuru: a.basvuru,
          }
        : {
            tur: 'harita',
            baslik: a.gostergeAd,
            duzey: a.duzey,
            veri: (d) => sonYil(d.haritalar[a.harita]),
            ondalik: a.ondalik,
            ikiYon: a.harita.startsWith('gsyh_endeks')
              ? { orta: 100, altEtiket: 'Ortalamanın altı', ustEtiket: 'Ortalamanın üstü' }
              : null,
          },
    kesfet: a.harita?.startsWith('gsyh_endeks')
      ? { kategori: 'Ekonomi', gosterge: 'kisi-basina-gsyh-endeksi-turkiye-100' }
      : null,
  })),
};
