import { yukle, seri, son, turkiye, sirala, toplam, ilkPay, liste, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Tarım';

export const TARIM = {
  id: 'tarim',
  baslik: 'Tarım',
  kaynak: 'TÜİK, Bitkisel ve Hayvansal Üretim İstatistikleri',
  giris: 'Tarım alanları daralıyor, ama bazı ürünlerde üretim birkaç ilde yoğunlaşarak artıyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Tarım alanı daralıyor',
      gorsel: {
        tur: 'cizgi',
        baslik: 'İşlenen tarım alanı, Türkiye (milyon hektar)',
        seriler: [
          {
            ad: 'İşlenen tarım alanı',
            veri: (v) => Object.fromEntries(Object.entries(turkiye(seri(v, K, 'Toplam İşlenen Tarım Alanı (Hektar)'))).map(([y, x]) => [y, x / 1e6])),
          },
        ],
        ondalik: 1,
        birim: 'milyon ha',
      },
      kesfet: { kategori: K, ad: 'Toplam İşlenen Tarım Alanı (Hektar)' },
      metin: (v, adi) => {
        const t = turkiye(seri(v, K, 'Toplam İşlenen Tarım Alanı (Hektar)'));
        const enB = sirala(son(seri(v, K, 'Toplam İşlenen Tarım Alanı (Hektar)'))[1])[0];
        const [y0, y1] = [ilkYil(t), sonYil(t)];
        const kayip = t[y0] - t[y1];
        return `<p>Türkiye'de işlenen tarım alanı ${ek(y0, 'de')} ${sayi(t[y0] / 1e6, 1)} milyon hektar iken ${ek(y1, 'de')}
          <strong>${sayi(t[y1] / 1e6, 1)} milyon hektar</strong>. Aradaki kayıp <strong>${sayi(kayip / 1e6, 1)} milyon hektar</strong>,
          yani yaklaşık %${sayi((100 * kayip) / t[y0], 0)}.</p>
          <p>Kaybedilen alan, en geniş tarım arazisine sahip il olan ${esc(adi(enB[0]))} işlenen alanının yaklaşık
          <strong>${sayi(kayip / enB[1], 1)} katı</strong>.</p>`;
      },
    },
    {
      baslik: 'Seracılık Akdeniz kıyısında toplanıyor',
      gorsel: { tur: 'harita', baslik: 'Örtü altı sebze ve meyve üretimi', veri: haritaVerisi(K, 'Örtü Altı Sebze ve Meyve Üretimi (Ton)'), ondalik: 0, birim: 'ton' },
      kesfet: { kategori: K, ad: 'Örtü Altı Sebze ve Meyve Üretimi (Ton)' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Örtü Altı Sebze ve Meyve Üretimi (Ton)');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>Sera ve tünellerde yetiştirilen sebze ve meyve ${ek(ilkYil(t), 'de')} ${sayi(t[ilkYil(t)] / 1e6, 1)} milyon ton iken
          ${ek(y, 'de')} <strong>${sayi(t[y] / 1e6, 1)} milyon tona</strong> çıktı.</p>
          <p>Üretimin <strong>%${ek(sayi((100 * s[0][1]) / toplam(d), 0), 'iyelik')}</strong> ${esc(ek(adi(s[0][0]), 'de'))};
          ${esc(adi(s[1][0]))} ve ${esc(adi(s[2][0]))} ile birlikte ilk üç il üretimin %${ek(sayi(ilkPay(d, 3), 0), 'iyelik_i')} karşılıyor.</p>`;
      },
    },
    {
      baslik: 'Hayvancılık daha dengeli dağılmış',
      gorsel: { tur: 'harita', baslik: 'Büyükbaş hayvan sayısı', veri: haritaVerisi(K, 'Büyükbaş Hayvan Sayısı'), ondalik: 0, birim: 'baş' },
      kesfet: { kategori: K, ad: 'Büyükbaş Hayvan Sayısı' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Büyükbaş Hayvan Sayısı');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>${ek(y, 'de')} Türkiye'de <strong>${sayi(t[y] / 1e6, 1)} milyon</strong> büyükbaş hayvan vardı
          (${ek(ilkYil(t), 'de')} ${sayi(t[ilkYil(t)] / 1e6, 1)} milyon).</p>
          <p>En çok hayvan ${esc(liste(s.slice(0, 5).map(([k]) => adi(k))))} illerinde. Bu beş il toplam sayının
          %${ek(sayi(ilkPay(d, 5), 0), 'iyelik_i')} barındırıyor; hayvancılık tarım arazisinden daha dengeli dağılmış durumda.</p>`;
      },
    },
    {
      baslik: 'Bal üretimi',
      gorsel: { tur: 'harita', baslik: 'Bal üretimi', veri: haritaVerisi(K, 'Bal Üretimi'), ondalik: 0, birim: 'ton' },
      kesfet: { kategori: K, ad: 'Bal Üretimi' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Bal Üretimi');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>${ek(y, 'de')} Türkiye <strong>${sayi(t[y] / 1000, 1)} bin ton</strong> bal üretti. Liste başında
          <strong>${esc(adi(s[0][0]))}</strong> (${sayi(s[0][1], 0)} ton) ve ${esc(adi(s[1][0]))} (${sayi(s[1][1], 0)} ton) var.</p>
          <p>İlk beş il üretimin %${ek(sayi(ilkPay(d, 5), 0), 'iyelik_i')} karşılıyor. Üretim yıldan yıla iklime bağlı olarak
          dalgalanıyor: ${ek(sonYil(t), 'de')} ${sayi(t[sonYil(t)] / 1000, 1)} bin ton, bir önceki yıl
          ${sayi(t[String(+sonYil(t) - 1)] / 1000, 1)} bin ton.</p>`;
      },
    },
  ],
};
