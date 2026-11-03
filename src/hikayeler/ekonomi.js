import { yukle, seri, son, turkiye, bolge, sirala, ilkYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Ekonomi';
const GSYH = 'Kişi Başına GSYH ($)';

/** Son yılda kişi başına GSYH'si en yüksek ve en düşük il */
function uclar(v) {
  const s = sirala(son(seri(v, K, GSYH))[1]);
  return [s[0][0], s.at(-1)[0]];
}

export const EKONOMI = {
  id: 'ekonomi',
  baslik: 'Ekonomi',
  kaynak: 'TÜİK, Bölgesel Hesaplar',
  giris: 'Türkiye ekonomisi büyüdükçe iller arasındaki üretim yapısı da farklılaştı: kimi il sanayiyle, kimi tarımla, kimi hizmetlerle geçiniyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Kişi başına gelir: en zengin ve en yoksul il',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Kişi başına GSYH (ABD doları)',
        seriler: [
          { ad: 'En yüksek il', kisaAd: 'En yüksek', veri: (v) => bolge(seri(v, K, GSYH), uclar(v)[0]) },
          { ad: 'Türkiye', kisaAd: 'Türkiye', veri: (v) => turkiye(seri(v, K, GSYH)) },
          { ad: 'En düşük il', kisaAd: 'En düşük', veri: (v) => bolge(seri(v, K, GSYH), uclar(v)[1]) },
        ],
        ondalik: 0,
        birim: '$',
        altBaslik: 'Türkiye ile en yüksek ve en düşük il',
        seriAdlari: (v, adi) => [adi(uclar(v)[0]), 'Türkiye', adi(uclar(v)[1])],
      },
      kesfet: { kategori: K, ad: GSYH },
      metin: (v, adi) => {
        const t = turkiye(seri(v, K, GSYH));
        const [y, d] = son(seri(v, K, GSYH));
        const [ust, alt] = uclar(v);
        const y0 = ilkYil(t);
        return `<p>Türkiye'nin kişi başına geliri ${ek(y0, 'de')} ${sayi(t[y0], 0)} dolar iken ${ek(y, 'de')}
          <strong>${sayi(t[y], 0)} dolar</strong>. Dolar cinsinden seri kur hareketlerinden etkilendiği için
          yıllar arasında dalgalanıyor.</p>
          <p>${ek(y, 'de')} en yüksek il <strong>${esc(adi(ust))}</strong> (${sayi(d[ust], 0)} $), en düşük il
          <strong>${esc(adi(alt))}</strong> (${sayi(d[alt], 0)} $). Grafikte üç çizgi arasındaki mesafe,
          bölgesel eşitsizlik bölümündeki farkın dolar karşılığı.</p>`;
      },
    },
    {
      baslik: 'Sanayinin ağırlığı',
      gorsel: {
        tur: 'harita',
        baslik: 'Sanayinin il ekonomisindeki payı (cari fiyatlarla)',
        veri: haritaVerisi(K, 'Sanayi Sektörünün Ekonomi'),
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: 'Sanayi Sektörünün Ekonomi' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Sanayi Sektörünün Ekonomi');
        const [y, d] = son(s0);
        const s = sirala(d);
        const yarisi = s.filter(([, x]) => x >= 40).length;
        return `<p>${ek(y, 'de')} Türkiye ekonomisinde sanayinin payı <strong>%${sayi(turkiye(s0)[y], 1)}</strong>.
          Ama <strong>${yarisi}</strong> ilde üretimin %${ek('40', 'iyelik')} ya da daha fazlası sanayiden geliyor.</p>
          <p>Liste başında ${esc(adi(s[0][0]))} (%${sayi(s[0][1], 0)}), ${esc(adi(s[1][0]))} ve ${esc(adi(s[2][0]))} var.
          En düşük pay ${esc(ek(adi(s.at(-1)[0]), 'de'))} (%${sayi(s.at(-1)[1], 1)}).</p>`;
      },
    },
    {
      baslik: 'Tarıma bağımlı iller',
      gorsel: {
        tur: 'harita',
        baslik: 'Tarımın il ekonomisindeki payı (cari fiyatlarla)',
        veri: haritaVerisi(K, 'Tarımın Sektörünün'),
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: 'Tarımın Sektörünün' },
      metin: (v, adi) => {
        const s0 = seri(v, K, 'Tarımın Sektörünün');
        const [y, d] = son(s0);
        const s = sirala(d);
        const ceyrek = s.filter(([, x]) => x >= 20).length;
        return `<p>Tarım Türkiye ekonomisinin yalnızca <strong>%${ek(sayi(turkiye(s0)[y], 1), 'iyelik')}</strong>. Buna karşın
          <strong>${ceyrek}</strong> ilde ekonominin beşte biri ya da daha fazlası tarımdan geliyor; en yüksek pay
          ${esc(ek(adi(s[0][0]), 'de'))} (%${sayi(s[0][1], 1)}).</p>
          <p>Bu harita, sanayi haritasının neredeyse tersi: sanayinin güçlü olduğu illerde tarımın payı birkaç puanı geçmiyor,
          İstanbul'da ise neredeyse sıfır.</p>`;
      },
    },
  ],
};
