import { yukle, seri, son, turkiye, sirala, toplam, ilkPay, liste, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Turizm';
const GEL_Y = 'Turizm İşletme Belgeli Konaklama Tesislerine Yabancı Turist Geliş';
const GEL_V = 'Turizm İşletme Belgeli Konaklama Tesislerine Vatandaş Geliş';
const GEC_Y = 'Turizm İşletme Belgeli Tesislerde Yabancı Turist Geceleme';
const GEC_V = 'Turizm İşletme Belgeli Tesislerde Vatandaş Geceleme';
const milyon = (o) => Object.fromEntries(Object.entries(o).map(([y, x]) => [y, x / 1e6]));

export const TURIZM = {
  id: 'turizm',
  baslik: 'Turizm',
  kaynak: 'Kültür ve Turizm Bakanlığı, Konaklama İstatistikleri (turizm işletme belgeli tesisler)',
  giris: 'Salgın yılındaki çöküşün ardından turizm hızla toparlandı. Yabancı turistler birkaç kıyı iline ve İstanbul\'a yöneliyor; yerli turizm çok daha geniş bir alana yayılıyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Salgından rekora',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Konaklama tesislerine geliş sayısı, Türkiye (milyon)',
        seriler: [
          { ad: 'Yabancı', kisaAd: 'Yabancı', veri: (v) => milyon(turkiye(seri(v, K, GEL_Y))) },
          { ad: 'Vatandaş', kisaAd: 'Vatandaş', veri: (v) => milyon(turkiye(seri(v, K, GEL_V))) },
        ],
        ondalik: 1,
        birim: 'milyon',
      },
      kesfet: { kategori: K, ad: GEL_Y },
      metin: (v) => {
        const y = turkiye(seri(v, K, GEL_Y));
        const w = turkiye(seri(v, K, GEL_V));
        const son0 = sonYil(y);
        const dip = Object.entries(y).filter(([t]) => t >= '2019').sort((a, b) => a[1] - b[1])[0];
        const onceki = y[String(+dip[0] - 1)];
        return `<p>Turizm belgeli tesislere gelen yabancı sayısı ${ek(dip[0], 'de')} bir önceki yıla göre
          <strong>%${sayi((100 * (onceki - dip[1])) / onceki, 0)}</strong> azaldı. ${ek(son0, 'de')} ise
          <strong>${sayi(y[son0] / 1e6, 1)} milyon</strong> ${Math.max(...Object.values(y)) === y[son0] ? `ile ${ek(ilkYil(y), 'den')} bu yana en yüksek düzeyde` : 'yabancı ziyaretçi geldi'}.</p>
          <p>Aynı yıl ${sayi(w[son0] / 1e6, 1)} milyon vatandaş da bu tesislerde konakladı; yerli turist sayısı ${ek(ilkYil(w), 'den')}
          bu yana ${sayi(w[son0] / w[ilkYil(w)], 1)} katına çıktı.</p>`;
      },
    },
    {
      baslik: 'Yabancı turist geceleri birkaç ilde',
      gorsel: { tur: 'harita', baslik: 'Yabancı turist geceleme sayısı', veri: haritaVerisi(K, GEC_Y), ondalik: 0, birim: 'gece' },
      kesfet: { kategori: K, ad: GEC_Y },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, GEC_Y));
        const s = sirala(d);
        return `<p>${ek(y, 'de')} yabancı turistlerin konaklama gecelerinin <strong>%${ek(sayi((100 * s[0][1]) / toplam(d), 0), 'iyelik')}</strong>
          ${esc(ek(adi(s[0][0]), 'de'))} geçti. ${esc(adi(s[1][0]))} ve ${esc(adi(s[2][0]))} ile birlikte ilk üç ilin payı
          <strong>%${sayi(ilkPay(d, 3), 0)}</strong>.</p>
          <p>Geri kalan 78 ilin toplam payı yalnızca %${sayi(100 - ilkPay(d, 3), 0)}; kıyı turizmi dışında yabancı ziyaretçi
          çeken il sayısı çok az.</p>`;
      },
    },
    {
      baslik: 'Yerli turizm daha yaygın',
      gorsel: { tur: 'harita', baslik: 'Vatandaş geceleme sayısı', veri: haritaVerisi(K, GEC_V), ondalik: 0, birim: 'gece' },
      kesfet: { kategori: K, ad: GEC_V },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, GEC_V));
        const [, dy] = son(seri(v, K, GEC_Y), 'il', y);
        const s = sirala(d);
        return `<p>Vatandaşların konaklamasında ilk beş il (${esc(liste(s.slice(0, 5).map(([k]) => adi(k))))})
          toplam gecelerin <strong>%${ek(sayi(ilkPay(d, 5), 0), 'iyelik_i')}</strong> oluşturuyor. Yabancılarda bu oran
          %${sayi(ilkPay(dy, 5), 0)}.</p>
          ${s.slice(0, 5).some(([k]) => k === 'TR510') ? `<p>İş seyahatleri ve kültür turizmi sayesinde denize kıyısı olmayan Ankara da yerli turizmde ilk beşte.</p>` : ''}`;
      },
    },
  ],
};
