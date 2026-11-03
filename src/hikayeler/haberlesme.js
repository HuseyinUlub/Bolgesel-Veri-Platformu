import { yukle, seri, son, turkiye, sirala, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Haberleşme';
const SABIT = 'Sabit Genişbant Abone / Toplam';

/** Yüz kişiye düşen mobil genişbant abonesi (il) */
function mobil(v) {
  const [y, ab] = son(seri(v, K, 'Mobil Genişbant İnternet Abone'));
  const [, nf] = son(seri(v, 'Nüfus', 'Toplam Nüfus'), 'il', y);
  const d = {};
  for (const [k, x] of Object.entries(ab)) if (nf[k]) d[k] = (100 * x) / nf[k];
  return [y, d];
}

export const HABERLESME = {
  id: 'haberlesme',
  baslik: 'Haberleşme',
  kaynak: 'Bilgi Teknolojileri ve İletişim Kurumu (BTK); nüfus TÜİK',
  giris: 'Mobil internet neredeyse herkese ulaştı. Evlere giden sabit genişbant bağlantısında ise batı ile doğu arasındaki fark sürüyor.',
  yukle: () => yukle(K, 'Nüfus'),
  adimlar: [
    {
      baslik: 'Sabit internet aboneliği yayılıyor',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Yüz kişiye düşen sabit genişbant abonesi, Türkiye',
        seriler: [{ ad: 'Türkiye', veri: (v) => turkiye(seri(v, K, SABIT)) }],
        ondalik: 1,
      },
      kesfet: { kategori: K, ad: SABIT },
      metin: (v) => {
        const t = turkiye(seri(v, K, SABIT));
        const [y0, y1] = [ilkYil(t), sonYil(t)];
        const abone = turkiye(seri(v, K, 'Sabit Genişbant İnternet Abone'))[y1];
        const hane = turkiye(seri(v, 'Nüfus', 'Toplam Hanehalkı Sayısı'))[y1];
        return `<p>${ek(y0, 'de')} her yüz kişiye ${sayi(t[y0], 1)} sabit genişbant abonesi düşüyordu; ${ek(y1, 'de')} bu sayı
          <strong>${sayi(t[y1], 1)}</strong>, yani ${sayi(t[y1] / t[y0], 1)} katı.</p>
          ${abone && hane ? `<p>Hane sayısıyla karşılaştırıldığında ${ek(y1, 'de')} yüz haneye yaklaşık <strong>${sayi((100 * abone) / hane, 0)}</strong>
          sabit abonelik düşüyor (işyeri abonelikleri dahil).</p>` : ''}`;
      },
    },
    {
      baslik: 'Sabit bağlantıda bölgesel fark',
      gorsel: { tur: 'harita', baslik: 'Yüz kişiye düşen sabit genişbant abonesi', veri: haritaVerisi(K, SABIT), ondalik: 1, birim: 'abone' },
      kesfet: { kategori: K, ad: SABIT },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, SABIT));
        const s = sirala(d);
        const ort = turkiye(seri(v, K, SABIT))[y];
        const altlar = s.filter(([, x]) => x < ort);
        const alt = altlar.length;
        const dogu = altlar.filter(([k]) => /^TR[ABC]/.test(k)).length;
        return `<p>${ek(y, 'de')} sabit genişbant yaygınlığı en yüksek <strong>${esc(adi(s[0][0]))}</strong> (yüz kişide
          ${sayi(s[0][1], 1)}), en düşük <strong>${esc(adi(s.at(-1)[0]))}</strong> (${sayi(s.at(-1)[1], 1)}).
          Aradaki fark yaklaşık <strong>${sayi(s[0][1] / s.at(-1)[1], 1)} kat</strong>.</p>
          <p>Türkiye ortalamasının altında kalan ${alt} ilin ${dogu} tanesi Doğu ve Güneydoğu Anadolu'da.
          Hanelerin kalabalık olduğu bu illerde kişi başına düşen abonelik de düşük kalıyor.</p>`;
      },
    },
    {
      baslik: 'Mobil internet her yerde',
      gorsel: { tur: 'harita', baslik: 'Yüz kişiye düşen mobil genişbant abonesi', veri: mobil, ondalik: 0, birim: 'abone' },
      kesfet: { kategori: K, ad: 'Mobil Genişbant İnternet Abone' },
      metin: (v, adi) => {
        const [y, d] = mobil(v);
        const s = sirala(d);
        const [, sb] = son(seri(v, K, SABIT), 'il', y);
        const ss = sirala(sb);
        return `<p>Mobil genişbantta tablo farklı: ${ek(y, 'de')} yüz kişiye en az ${sayi(s.at(-1)[1], 0)}
          (${esc(adi(s.at(-1)[0]))}), en çok ${sayi(s[0][1], 0)} (${esc(adi(s[0][0]))}) abonelik düşüyor.</p>
          <p>İller arasındaki fark mobilde <strong>${sayi(s[0][1] / s.at(-1)[1], 1)} kat</strong>, sabit bağlantıda
          ${sayi(ss[0][1] / ss.at(-1)[1], 1)} kat. Sabit altyapının zayıf olduğu yerlerde internete erişim büyük ölçüde telefon üzerinden.</p>`;
      },
    },
  ],
};
