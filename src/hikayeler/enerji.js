import { yukle, seri, son, turkiye, sirala, ilkYil, sonYil, ilkPay, liste, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Enerji';

export const ENERJI = {
  id: 'enerji',
  baslik: 'Enerji',
  kaynak: 'EPDK, TEİAŞ ve TÜİK elektrik istatistikleri',
  giris: 'Elektrik tüketimi sanayinin haritasını çiziyor. Üretimde ise güneş enerjisiyle birlikte yeni bir coğrafya ortaya çıkıyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Kişi başına tüketim sanayiyi izliyor',
      gorsel: { tur: 'harita', baslik: 'Kişi başına toplam elektrik tüketimi', veri: haritaVerisi(K, 'Kişi Başına Toplam Elektrik'), ondalik: 0, birim: 'kWh' },
      kesfet: { kategori: K, ad: 'Kişi Başına Toplam Elektrik' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Kişi Başına Toplam Elektrik');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>${ek(y, 'de')} Türkiye'de kişi başına <strong>${sayi(t[y], 0)} kWh</strong> elektrik tüketildi.
          En yüksek tüketim <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong> (${sayi(s[0][1], 0)} kWh), en düşük
          <strong>${esc(ek(adi(s.at(-1)[0]), 'de'))}</strong> (${sayi(s.at(-1)[1], 0)} kWh): arada yaklaşık
          ${sayi(s[0][1] / s.at(-1)[1], 0)} kat fark var.</p>
          <p>Listenin başındaki iller (${esc(liste(s.slice(0, 5).map(([k]) => adi(k))))}) elektriği yoğun kullanan
          sanayi tesisleriyle öne çıkıyor; bu illerde tüketimin büyük bölümü evlerden değil fabrikalardan geliyor.</p>`;
      },
    },
    {
      baslik: 'Evlerde ve sanayide tüketim',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Kişi başına elektrik tüketimi, Türkiye (kWh)',
        seriler: [
          { ad: 'Sanayi', kisaAd: 'Sanayi', veri: (v) => turkiye(seri(v, K, 'Kişi Başına Sanayi Elektrik')) },
          { ad: 'Mesken', kisaAd: 'Mesken', veri: (v) => turkiye(seri(v, K, 'Kişi Başına Mesken')) },
        ],
        ondalik: 0,
        birim: 'kWh',
      },
      kesfet: { kategori: K, ad: 'Kişi Başına Mesken' },
      metin: (v, adi) => {
        const sn = turkiye(seri(v, K, 'Kişi Başına Sanayi Elektrik'));
        const m = turkiye(seri(v, K, 'Kişi Başına Mesken'));
        const [y0, y1] = [ilkYil(m), sonYil(m)];
        const [, dm] = son(seri(v, K, 'Kişi Başına Mesken'));
        const s = sirala(dm);
        return `<p>${ek(y0, 'den')} ${ek(y1, 'e')} kişi başına sanayi tüketimi ${sayi(sn[y0], 0)} kWh'den
          <strong>${sayi(sn[y1], 0)} kWh</strong>'e, konut tüketimi ${sayi(m[y0], 0)} kWh'den <strong>${sayi(m[y1], 0)} kWh</strong>'e çıktı.</p>
          <p>Konutlarda tüketim en yüksek ${esc(adi(s[0][0]))} ve ${esc(adi(s[1][0]))} gibi sıcak iklimli kıyı illerinde;
          yaz aylarındaki soğutma ihtiyacı ve turizm bölgelerindeki konutlar bu farkı açıklayan etkenler arasında.</p>`;
      },
    },
    {
      baslik: 'Güneşle gelen yeni üretim haritası',
      gorsel: { tur: 'harita', baslik: 'Lisanssız kurulu güç (çoğunlukla güneş)', veri: haritaVerisi(K, 'Lisanssız Kurulu Güç'), ondalik: 0, birim: 'MW' },
      kesfet: { kategori: K, ad: 'Lisanssız Kurulu Güç' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Lisanssız Kurulu Güç');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>Lisans almadan kurulabilen küçük ölçekli santrallerin (büyük ölçüde çatı ve arazi tipi güneş) gücü
          ${ek(ilkYil(t), 'de')} ${sayi(t[ilkYil(t)], 0)} MW iken ${ek(y, 'de')} <strong>${sayi(t[y], 0)} MW</strong>'a ulaştı:
          yaklaşık ${sayi(t[y] / t[ilkYil(t)], 0)} katı.</p>
          <p>En çok kurulu güç ${esc(liste(s.slice(0, 3).map(([k]) => adi(k))))} illerinde; ilk beş ilin payı
          %${sayi(ilkPay(d, 5), 0)}. Tüketimin aksine üretim, geniş arazisi ve güneşi bol olan Anadolu illerine yayılıyor.</p>`;
      },
    },
  ],
};
