/**
 * Nüfus bölümü (pilot hikâye). Sayılar veriden hesaplanır; metinde elle sayı yazılmaz.
 */
import { kategoriVerisi, kapsamliYillar } from '../lib/data.js';
import { sayi, esc, ek } from '../lib/format.js';

const IL = /^TR[0-9A-C]\d\d$/; // il kodları (TR100, TRA11 …)

/** Göstergenin il değerleri (son yıl ya da verilen yıl) */
function iller(k, id, yil) {
  const s = k[id] ?? {};
  const y = yil ?? kapsamliYillar(s, (c) => IL.test(c)).at(-1);
  const out = {};
  for (const [kod, v] of Object.entries(s[y] ?? {})) if (IL.test(kod) && v != null) out[kod] = v;
  return [y, out];
}
/** Türkiye serisi {yıl: değer} */
function turkiye(k, id) {
  const out = {};
  for (const [y, d] of Object.entries(k[id] ?? {})) if (d.TR != null) out[y] = d.TR;
  return out;
}
const sirala = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);

export const NUFUS = {
  id: 'nufus',
  baslik: 'Nüfus',
  kaynak: 'TÜİK, Adrese Dayalı Nüfus Kayıt Sistemi ve Doğum İstatistikleri',
  giris: 'Türkiye nüfusu nerede yoğunlaşıyor, hangi iller büyüyor, hangileri küçülüyor ve toplum ne hızla yaşlanıyor?',
  async yukle() {
    const [nufus, demografi] = await Promise.all([kategoriVerisi('Nüfus'), kategoriVerisi('Demografi')]);
    return { nufus, demografi };
  },
  adimlar: [
    {
      baslik: 'Nüfusun yarısı birkaç ilde',
      gorsel: {
        tur: 'harita',
        baslik: 'Toplam nüfus',
        veri: ({ nufus }) => iller(nufus, 'toplam-nufus'),
        ondalik: 0,
        birim: 'kişi',
      },
      kesfet: { kategori: 'Nüfus', gosterge: 'toplam-nufus' },
      metin: ({ nufus }, adi) => {
        const [y, d] = iller(nufus, 'toplam-nufus');
        const s = sirala(d);
        const top = s.reduce((a, [, v]) => a + v, 0);
        let birikim = 0;
        let n = 0;
        while (birikim < top / 2) birikim += s[n++][1];
        const ilk5 = s.slice(0, 5).reduce((a, [, v]) => a + v, 0);
        return `<p>${y} itibarıyla Türkiye'de <strong>${sayi(top / 1e6, 1)} milyon</strong> kişi yaşıyor.
          Bunların <strong>%${ek(sayi((100 * s[0][1]) / top, 0), 'iyelik')}</strong> yalnızca ${esc(ek(adi(s[0][0]), 'de'))}.</p>
          <p>En kalabalık beş il (${s.slice(0, 5).map(([k]) => esc(adi(k))).join(', ')}) nüfusun
          <strong>%${ek(sayi((100 * ilk5) / top, 0), 'iyelik_i')}</strong> barındırıyor. Nüfusun yarısına ulaşmak için
          81 ilden yalnızca <strong>${n}</strong> tanesini saymak yetiyor.</p>`;
      },
    },
    {
      baslik: 'Büyüyen ve küçülen iller',
      gorsel: {
        tur: 'harita',
        baslik: 'Yıllık nüfus artış hızı',
        veri: ({ nufus }) => iller(nufus, 'yillik-nufus-artis-hizi-binde'),
        ondalik: 1,
        birim: '‰',
        ikiYon: { orta: 0, altEtiket: 'Azalan', ustEtiket: 'Artan' },
      },
      kesfet: { kategori: 'Nüfus', gosterge: 'yillik-nufus-artis-hizi-binde' },
      metin: ({ nufus }, adi) => {
        const [y, d] = iller(nufus, 'yillik-nufus-artis-hizi-binde');
        const s = sirala(d);
        const eksi = s.filter(([, v]) => v < 0).length;
        const tr = turkiye(nufus, 'yillik-nufus-artis-hizi-binde')[y];
        return `<p>${ek(y, 'de')} Türkiye nüfusu binde <strong>${sayi(tr, 1)}</strong> arttı. Ancak artış eşit dağılmıyor:
          <strong>${eksi}</strong> ilin nüfusu azaldı.</p>
          <p>En hızlı büyüyen il <strong>${esc(adi(s[0][0]))}</strong> (binde ${sayi(s[0][1], 1)}),
          en hızlı küçülen il <strong>${esc(adi(s.at(-1)[0]))}</strong> (binde ${sayi(s.at(-1)[1], 1)}).
          Haritada hardal tonlar nüfus kaybeden, mavi tonlar nüfus kazanan illeri gösteriyor.</p>`;
      },
    },
    {
      baslik: 'Doğurganlık yenilenme düzeyinin altında',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Toplam doğurganlık hızı (kadın başına çocuk)',
        seriler: [{ ad: 'Türkiye', veri: ({ demografi }) => turkiye(demografi, 'dogurganlik-hizi-cocuk-sayisi') }],
        ondalik: 2,
        basvuru: { deger: 2.1, etiket: 'Nüfusun kendini yenileme düzeyi (2,1)' },
      },
      kesfet: { kategori: 'Demografi', gosterge: 'dogurganlik-hizi-cocuk-sayisi' },
      metin: ({ demografi }, adi) => {
        const t = turkiye(demografi, 'dogurganlik-hizi-cocuk-sayisi');
        const ys = Object.keys(t).sort();
        const [y, d] = iller(demografi, 'dogurganlik-hizi-cocuk-sayisi');
        const s = sirala(d);
        const ustunde = s.filter(([, v]) => v >= 2.1).length;
        return `<p>Bir kadının ömrü boyunca doğurduğu ortalama çocuk sayısı ${ek(ys[0], 'de')}
          <strong>${sayi(t[ys[0]], 2)}</strong> iken ${ek(ys.at(-1), 'de')} <strong>${ek(sayi(t[ys.at(-1)], 2), 'e')}</strong> indi.
          Nüfusun kendini yenilemesi için gereken düzey 2,1.</p>
          <p>${ek(y, 'de')} ${ustunde ? `yalnızca <strong>${ustunde}</strong> il bu düzeyin üzerinde` : '<strong>hiçbir il</strong> bu düzeye ulaşmıyor'}; en yüksek
          <strong>${esc(adi(s[0][0]))}</strong> (${sayi(s[0][1], 2)}), en düşük
          <strong>${esc(adi(s.at(-1)[0]))}</strong> (${sayi(s.at(-1)[1], 2)}).</p>`;
      },
    },
    {
      baslik: 'Türkiye yaşlanıyor, ama aynı hızda değil',
      gorsel: {
        tur: 'harita',
        baslik: 'Ortanca yaş',
        veri: ({ nufus }) => iller(nufus, 'ortanca-yas'),
        ondalik: 1,
        birim: 'yaş',
      },
      kesfet: { kategori: 'Nüfus', gosterge: 'ortanca-yas' },
      metin: ({ nufus }, adi) => {
        const t = turkiye(nufus, 'ortanca-yas');
        const ys = Object.keys(t).sort();
        const [y, d] = iller(nufus, 'ortanca-yas');
        const s = sirala(d);
        return `<p>Nüfusu yaşa göre sıraladığımızda tam ortadaki kişinin yaşı, yani <strong>ortanca yaş</strong>,
          ${ek(ys[0], 'de')} ${sayi(t[ys[0]], 1)} iken ${ek(ys.at(-1), 'de')} <strong>${ek(sayi(t[ys.at(-1)], 1), 'e')}</strong> yükseldi.</p>
          <p>İller arasındaki fark çok büyük: ${ek(y, 'de')} ortanca yaş <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong>
          ${sayi(s[0][1], 1)}, <strong>${esc(ek(adi(s.at(-1)[0]), 'de'))}</strong> ${sayi(s.at(-1)[1], 1)}.
          Kuzey ve batı illeri yaşlanırken güneydoğu hâlâ genç bir nüfusa sahip.</p>`;
      },
    },
  ],
};
