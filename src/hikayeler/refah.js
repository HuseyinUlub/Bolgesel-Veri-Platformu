import { yukle, seri, son, sirala, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Bölgesel Refah (OECD)';
const d2 = (ad) => haritaVerisi(K, ad, 'd2');

export const REFAH = {
  id: 'refah',
  baslik: 'Bölgesel Refah (OECD)',
  kaynak: 'OECD Regional Well-Being (Düzey 2 bölgeleri)',
  giris: 'Refah yalnızca gelirden ibaret değil. OECD\'nin bölgesel refah göstergeleri yaşam memnuniyeti, sağlık, çevre ve sosyal bağları da ölçüyor.',
  yukle: () => yukle(K, 'Demografi'),
  adimlar: [
    {
      baslik: 'Yaşamından en memnun bölgeler',
      gorsel: { tur: 'harita', baslik: 'Yaşam memnuniyeti (0–10)', duzey: 'region26', veri: d2('Yaşam Memnuniyeti'), ondalik: 1, birim: 'puan' },
      kesfet: { kategori: K, ad: 'Yaşam Memnuniyeti', duzey: 'duzey2' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Yaşam Memnuniyeti'), 'd2');
        const s = sirala(d);
        return `<p>Kişilerin hayatlarını 0 ile 10 arasında puanladığı ankete göre en yüksek memnuniyet
          <strong>${esc(adi(s[0][0]))}</strong> bölgesinde (${sayi(s[0][1], 1)}), en düşük
          <strong>${esc(adi(s.at(-1)[0]))}</strong> bölgesinde (${sayi(s.at(-1)[1], 1)}).</p>
          <p>${((n) => (n === 4 ? 'Sıralamanın son dört bölgesinin tamamı' : `Sıralamanın son dört bölgesinden ${n} tanesi`))(
            s.slice(-4).filter(([k]) => /^TR[ABC]/.test(k)).length)} Doğu ve Güneydoğu Anadolu'da. Yaşam memnuniyeti öznel bir değerlendirme; gelirin yanında pek çok etkene bağlı.</p>`;
      },
    },
    {
      baslik: 'Solunan havada bütün bölgeler sınırın üzerinde',
      gorsel: { tur: 'harita', baslik: 'İnce partikül madde (PM2,5) maruziyeti', duzey: 'region26', veri: d2('Hava Kirliliği'), ondalik: 1, birim: 'µg/m³' },
      kesfet: { kategori: K, ad: 'Hava Kirliliği', duzey: 'duzey2' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Hava Kirliliği'), 'd2');
        const s = sirala(d);
        return `<p>Dünya Sağlık Örgütü'nün yıllık ortalama için önerdiği üst sınır 5 µg/m³. Türkiye'nin en temiz havasına sahip bölgesi
          ${esc(adi(s.at(-1)[0]))} bile bu sınırın yaklaşık <strong>${sayi(s.at(-1)[1] / 5, 1)} katı</strong> (${sayi(s.at(-1)[1], 1)} µg/m³).</p>
          <p>En yüksek maruziyet <strong>${esc(adi(s[0][0]))}</strong> bölgesinde (${sayi(s[0][1], 1)} µg/m³). Trafik ve sanayinin
          yoğun olduğu büyük şehirlerle birlikte, toz taşınımının etkili olduğu güneydoğu bölgeleri de üst sıralarda.</p>`;
      },
    },
    {
      baslik: 'Depremin yaşam süresine etkisi',
      gorsel: { tur: 'harita', baslik: 'Doğuşta beklenen yaşam süresi (TÜİK)', duzey: 'province', veri: haritaVerisi('Demografi', 'Doğuşta Beklenen Yaşam Süresi'), ondalik: 1, birim: 'yıl' },
      kesfet: { kategori: 'Demografi', ad: 'Doğuşta Beklenen Yaşam Süresi' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, 'Demografi', 'Doğuşta Beklenen Yaşam Süresi'), 'il');
        const s = sirala(d);
        const DEPREM = ['TR631', 'TR632', 'TR633', 'TR621', 'TRC11', 'TRC12', 'TRC13', 'TRB11', 'TRB12', 'TRC21', 'TRC22'];
        const son5 = s.slice(-5);
        const depremde = son5.filter(([k]) => DEPREM.includes(k)).length;
        const ort = s.filter(([k]) => !DEPREM.includes(k)).reduce((a, [, x], _, dz) => a + x / dz.length, 0);
        return `<p>Bu adımda TÜİK'in il düzeyindeki ${y} verisi kullanılıyor (OECD refah dosyası aynı göstergeyi Düzey 2 için veriyor).
          Doğuşta beklenen yaşam süresi en yüksek <strong>${esc(adi(s[0][0]))}</strong> ilinde (${sayi(s[0][1], 1)} yıl).</p>
          <p>En düşük beş ilden ${depremde} tanesi 6 Şubat 2023 depremlerinden etkilenen illerden:
          ${son5.map(([k, x]) => `${esc(adi(k))} (${sayi(x, 1)})`).join(', ')}. Deprem bölgesi dışındaki illerin ortalaması
          ${sayi(ort, 1)} yıl. Yaşam süresi o yılın ölümlerinden hesaplandığı için deprem kayıpları göstergeyi sert biçimde düşürüyor.</p>`;
      },
    },
    {
      baslik: 'Zor zamanda güvenilecek biri',
      gorsel: { tur: 'harita', baslik: 'Güvenebileceği bir yakını olduğunu söyleyenler', duzey: 'region26', veri: d2('Algılanan Sosyal'), ondalik: 1, birim: '%' },
      kesfet: { kategori: K, ad: 'Algılanan Sosyal', duzey: 'duzey2' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Algılanan Sosyal'), 'd2');
        const s = sirala(d);
        const memnun = sirala(son(seri(v, K, 'Yaşam Memnuniyeti'), 'd2')[1]).slice(-5).map(([k]) => k);
        const ortak = s.slice(-5).filter(([k]) => memnun.includes(k)).length;
        return `<p>"Başınız sıkıştığında güvenebileceğiniz bir yakınınız var mı?" sorusuna evet diyenlerin oranı
          <strong>${esc(adi(s[0][0]))}</strong> bölgesinde %${sayi(s[0][1], 0)} iken <strong>${esc(adi(s.at(-1)[0]))}</strong>
          bölgesinde %${ek(sayi(s.at(-1)[1], 0), 'e')} iniyor.</p>
          <p>Sosyal destek algısının en düşük olduğu beş bölgeden ${ortak} tanesi, yaşam memnuniyetinde de son beşte.</p>`;
      },
    },
  ],
};
