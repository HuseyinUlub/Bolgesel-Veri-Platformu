import { yukle, seri, son, turkiye, sirala, toplam, ilkPay, liste, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Sanayi';
const IG = 'İşgücü';
const TEK = 'İmalat Sanayinde Teknoloji Düzeyine Göre İstihdam Oranı (%)';

/** Orta-yüksek + yüksek teknoloji istihdam payı, il düzeyinde */
function ileriTeknoloji(v) {
  const [y, oy] = son(seri(v, IG, `${TEK} (Orta Yüks`));
  const [, yu] = son(seri(v, IG, `${TEK} (Yüksek`), 'il', y);
  const d = {};
  for (const k of Object.keys(oy)) if (yu[k] != null) d[k] = oy[k] + yu[k];
  return [y, d];
}

export const SANAYI = {
  id: 'sanayi',
  baslik: 'Sanayi',
  kaynak: 'TÜİK İş Kayıtları; Sanayi ve Teknoloji Bakanlığı OSB Bilgi Sistemi',
  giris: 'İmalat birkaç büyük ilde toplanmış durumda. Organize sanayi bölgeleri üretimi Anadolu\'ya yayarken, ileri teknoloji hâlâ sınırlı sayıda ilde.',
  yukle: () => yukle(K, IG),
  adimlar: [
    {
      baslik: 'İmalat birkaç ilde yoğunlaşıyor',
      gorsel: { tur: 'harita', baslik: 'İmalat sanayinde girişim sayısı', veri: haritaVerisi(K, 'İmalat Girişim Sayısı'), ondalik: 0, birim: 'girişim' },
      kesfet: { kategori: K, ad: 'İmalat Girişim Sayısı' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'İmalat Girişim Sayısı'));
        const s = sirala(d);
        return `<p>${ek(y, 'de')} Türkiye'de <strong>${sayi(toplam(d), 0)}</strong> imalat girişimi vardı.
          Bunların <strong>%${ek(sayi((100 * s[0][1]) / toplam(d), 0), 'iyelik')}</strong> ${esc(ek(adi(s[0][0]), 'de'))}.</p>
          <p>${esc(liste(s.slice(0, 5).map(([k]) => adi(k))))} birlikte imalat girişimlerinin
          <strong>%${ek(sayi(ilkPay(d, 5), 0), 'iyelik_i')}</strong> barındırıyor. Harita, girişim sayısını gösterdiği için
          nüfusu büyük illeri öne çıkarıyor.</p>`;
      },
    },
    {
      baslik: 'Organize sanayi bölgeleri Anadolu\'ya yayılıyor',
      gorsel: { tur: 'harita', baslik: "OSB'lerde istihdam", veri: haritaVerisi(K, "OSB'lerde İstihdam"), ondalik: 0, birim: 'kişi' },
      kesfet: { kategori: K, ad: "OSB'lerde İstihdam" },
      metin: (v, adi) => {
        const s0 = seri(v, K, "OSB'lerde İstihdam");
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        const bos = s.filter(([, x]) => x === 0).length;
        return `<p>OSB'lerde çalışanların sayısı ${ek(ilkYil(t), 'de')} ${sayi(t[ilkYil(t)] / 1e6, 1)} milyon iken
          ${ek(sonYil(t), 'de')} <strong>${sayi(t[sonYil(t)] / 1e6, 1)} milyona</strong> çıktı.</p>
          <p>İlk beşte ${esc(liste(s.slice(0, 5).map(([k]) => adi(k))))} var. İstihdamın bu kadar yayılmış olmasına karşın
          ${bos ? `<strong>${bos}</strong> ilde faal OSB istihdamı yok.` : 'her ilde OSB istihdamı bulunuyor.'}</p>`;
      },
    },
    {
      baslik: 'İmalatın yarısı hâlâ düşük teknolojide',
      gorsel: {
        tur: 'cizgi',
        baslik: 'İmalat istihdamının teknoloji düzeyine göre dağılımı, Türkiye (%)',
        seriler: [
          { ad: 'Düşük teknoloji', kisaAd: 'Düşük', veri: (v) => turkiye(seri(v, IG, `${TEK} (Düşük`)) },
          { ad: 'Orta-yüksek teknoloji', kisaAd: 'Orta-yüksek', veri: (v) => turkiye(seri(v, IG, `${TEK} (Orta Yüks`)) },
          { ad: 'Yüksek teknoloji', kisaAd: 'Yüksek', veri: (v) => turkiye(seri(v, IG, `${TEK} (Yüksek`)) },
        ],
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: IG, ad: `${TEK} (Yüksek` },
      metin: (v) => {
        const d = turkiye(seri(v, IG, `${TEK} (Düşük`));
        const oy = turkiye(seri(v, IG, `${TEK} (Orta Yüks`));
        const yu = turkiye(seri(v, IG, `${TEK} (Yüksek`));
        const [y0, y1] = [ilkYil(yu), sonYil(yu)];
        return `<p>${ek(y1, 'de')} imalatta çalışanların <strong>%${ek(sayi(d[y1], 0), 'iyelik')}</strong> gıda, tekstil, mobilya gibi
          düşük teknolojili sektörlerde. Bu oran ${ek(y0, 'de')} %${sayi(d[y0], 0)} idi.</p>
          <p>Yüksek teknolojinin payı ${ek(y0, 'de')} %${sayi(yu[y0], 1)} iken ${ek(y1, 'de')} <strong>%${ek(sayi(yu[y1], 1), 'e')}</strong>
          yükseldi. Asıl artış orta-yüksek teknolojide (otomotiv, makine, kimya): %${sayi(oy[y0], 0)} → %${sayi(oy[y1], 0)}.</p>`;
      },
    },
    {
      baslik: 'İleri teknoloji birkaç ilde',
      gorsel: { tur: 'harita', baslik: 'İmalat istihdamında orta-yüksek ve yüksek teknolojinin payı', veri: ileriTeknoloji, ondalik: 1, birim: '%' },
      kesfet: { kategori: IG, ad: `${TEK} (Orta Yüks` },
      metin: (v, adi) => {
        const [y, d] = ileriTeknoloji(v);
        const s = sirala(d);
        const ustu = s.filter(([, x]) => x >= 30).length;
        const dusuk = Object.entries(son(seri(v, IG, `${TEK} (Düşük`), 'il', y)[1]).filter(([, x]) => x >= 80);
        const dusukIller = dusuk.length;
        const dogu = dusuk.filter(([k]) => /^TR[ABC]/.test(k)).length;
        return `<p>${ek(y, 'de')} orta-yüksek ve yüksek teknolojili imalatın istihdamdaki payı
          <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong> %${sayi(s[0][1], 0)}, ${esc(ek(adi(s[1][0]), 'de'))} %${sayi(s[1][1], 0)}.
          Bu payın %${ek('30', 'iyelik')} geçtiği il sayısı yalnızca <strong>${ustu}</strong>.</p>
          <p>Öte yandan <strong>${dusukIller}</strong> ilde imalat istihdamının %${ek('80', 'iyelik')} ya da fazlası
          düşük teknolojili sektörlerde${dogu ? `; bunların ${dogu} tanesi Doğu ve Güneydoğu Anadolu'da` : ''}.</p>`;
      },
    },
  ],
};
