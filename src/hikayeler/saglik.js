import { yukle, seri, son, turkiye, sirala, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Sağlık';

export const SAGLIK = {
  id: 'saglik',
  baslik: 'Sağlık',
  kaynak: 'Sağlık Bakanlığı, TÜİK',
  giris: 'Hekim ve hastane yatağı sayısı arttı, ancak sağlık insan gücü büyük şehirlerde ve üniversite hastanesi olan illerde toplanıyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Hekim sayısında iller arası fark',
      gorsel: { tur: 'harita', baslik: 'Bin kişi başına hekim sayısı', veri: haritaVerisi(K, 'Bin Kişi Başına Düşen Toplam Hekim'), ondalik: 1, birim: 'hekim' },
      kesfet: { kategori: K, ad: 'Bin Kişi Başına Düşen Toplam Hekim' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Bin Kişi Başına Düşen Toplam Hekim');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>${ek(y, 'de')} Türkiye'de bin kişiye <strong>${sayi(t[y], 1)}</strong> hekim düşüyor; ${ek(ilkYil(t), 'de')} bu sayı ${sayi(t[ilkYil(t)], 1)} idi.</p>
          <p>En yüksek oran <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong> (${sayi(s[0][1], 1)}), en düşük
          <strong>${esc(ek(adi(s.at(-1)[0]), 'de'))}</strong> (${sayi(s.at(-1)[1], 1)}). Bir ilde kişi başına düşen hekim,
          diğerinin yaklaşık <strong>${sayi(s[0][1] / s.at(-1)[1], 1)} katı</strong>.</p>`;
      },
    },
    {
      baslik: 'Hastane yatakları artıyor',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Yüz bin kişi başına hastane yatağı, Türkiye',
        seriler: [{ ad: 'Türkiye', veri: (v) => turkiye(seri(v, K, 'Yüz Bin Kişi Başına Hastane Yatak')) }],
        ondalik: 0,
      },
      kesfet: { kategori: K, ad: 'Yüz Bin Kişi Başına Hastane Yatak' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Yüz Bin Kişi Başına Hastane Yatak');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>Yüz bin kişiye düşen hastane yatağı ${ek(ilkYil(t), 'de')} ${sayi(t[ilkYil(t)], 0)} iken ${ek(sonYil(t), 'de')}
          <strong>${ek(sayi(t[sonYil(t)], 0), 'e')}</strong> çıktı.</p>
          <p>İller arasında fark büyük: en yüksek ${esc(adi(s[0][0]))} (${sayi(s[0][1], 0)}), en düşük
          ${esc(adi(s.at(-1)[0]))} (${sayi(s.at(-1)[1], 0)}). Yatak sayısı yüksek illerin çoğu, büyük üniversite ve şehir
          hastaneleriyle çevre illere de hizmet veren bölgesel sağlık merkezleri.</p>`;
      },
    },
    {
      baslik: 'Kalp ve damar hastalıkları: yaşlı nüfusun izi',
      gorsel: {
        tur: 'harita',
        baslik: 'Dolaşım sistemi hastalıklarından ölüm hızı (yüz binde)',
        veri: haritaVerisi(K, 'Dolaşım Sistemi'),
        ondalik: 0,
        birim: 'yüz binde',
      },
      kesfet: { kategori: K, ad: 'Dolaşım Sistemi' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Dolaşım Sistemi');
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>Türkiye'de ölümlerin en sık nedeni dolaşım sistemi hastalıkları. ${ek(y, 'de')} bu nedenden ölüm hızı
          <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong> yüz binde ${sayi(s[0][1], 0)}, <strong>${esc(ek(adi(s.at(-1)[0]), 'de'))}</strong>
          yüz binde ${sayi(s.at(-1)[1], 0)}.</p>
          <p>Harita, nüfus bölümündeki ortanca yaş haritasına çok benziyor: bu hız yaşa göre düzeltilmemiş olduğu için
          yaşlı nüfusu fazla olan kuzey ve batı illeri öne çıkıyor.</p>`;
      },
    },
  ],
};
