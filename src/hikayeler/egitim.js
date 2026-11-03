import { yukle, seri, son, turkiye, sirala, ilkYil, sonYil, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Eğitim';

export const EGITIM = {
  id: 'egitim',
  baslik: 'Eğitim',
  kaynak: 'TÜİK, Ulusal Eğitim İstatistikleri ve Adrese Dayalı Nüfus Kayıt Sistemi',
  giris: 'Okullaşma hızla arttı, üniversite mezunlarının payı iki katından fazlasına çıktı. Ama eğitim düzeyindeki farklar hâlâ haritada net biçimde okunuyor.',
  yukle: () => yukle(K),
  adimlar: [
    {
      baslik: 'Liseye devam artık kural',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Ortaöğretimde net okullaşma oranı (%)',
        seriler: [
          { ad: 'Toplam', kisaAd: 'Toplam', veri: (v) => turkiye(seri(v, K, 'Ortaöğretimde Net Okullaşma')) },
          { ad: 'Kız öğrenciler', kisaAd: 'Kız', veri: (v) => turkiye(seri(v, K, 'Ortaöğretimde Kız Net Okullaşma')) },
        ],
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: 'Ortaöğretimde Net Okullaşma' },
      metin: (v) => {
        const t = turkiye(seri(v, K, 'Ortaöğretimde Net Okullaşma'));
        const kiz = turkiye(seri(v, K, 'Ortaöğretimde Kız Net Okullaşma'));
        const [y0, y1] = [ilkYil(t), sonYil(t)];
        const enY = sirala(t)[0];
        return `<p>Lise çağındaki gençlerin okula kayıtlı olma oranı ${ek(y0, 'de')} <strong>%${sayi(t[y0], 0)}</strong>
          iken ${ek(enY[0], 'de')} <strong>%${ek(sayi(enY[1], 0), 'e')}</strong> kadar yükseldi; ${ek(y1, 'de')} %${sayi(t[y1], 0)}.</p>
          <p>Kız öğrencilerin oranı ${ek(y0, 'de')} toplamın ${sayi(t[y0] - kiz[y0], 1)} puan gerisindeyken
          bugün ${kiz[y1] >= t[y1] ? 'toplamın üzerinde' : 'toplama çok yakın'} (%${sayi(kiz[y1], 1)}).</p>`;
      },
    },
    {
      baslik: 'Okullaşmanın geride kaldığı iller',
      gorsel: {
        tur: 'harita',
        baslik: 'Ortaöğretimde net okullaşma oranı',
        veri: haritaVerisi(K, 'Ortaöğretimde Net Okullaşma'),
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: 'Ortaöğretimde Net Okullaşma' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Ortaöğretimde Net Okullaşma'));
        const s = sirala(d);
        const alt = s.slice(-4).map(([k]) => esc(adi(k)));
        return `<p>${ek(y, 'de')} ortaöğretimde okullaşma en yüksek <strong>${esc(adi(s[0][0]))}</strong> (%${sayi(s[0][1], 1)}),
          en düşük <strong>${esc(adi(s.at(-1)[0]))}</strong> (%${sayi(s.at(-1)[1], 1)}).</p>
          <p>Aradaki fark ${sayi(s[0][1] - s.at(-1)[1], 0)} puan. En düşük dört ilde (${alt.join(', ')})
          lise çağındaki gençlerin yaklaşık <strong>%${ek(sayi(100 - s.at(-1)[1], 0), 'iyelik')}</strong> okula kayıtlı değil.</p>`;
      },
    },
    {
      baslik: 'Üniversite mezunları büyük şehirlerde',
      gorsel: {
        tur: 'harita',
        baslik: '15 yaş ve üzeri nüfusta yükseköğretim mezunu oranı',
        veri: haritaVerisi(K, '15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı'),
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: '15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı' },
      metin: (v, adi) => {
        const s0 = seri(v, K, '15 Yaş ve Üzeri Yüksekokul veya Fakülte Mezunu Oranı');
        const t = turkiye(s0);
        const [y, d] = son(s0);
        const s = sirala(d);
        return `<p>Yetişkinler arasında üniversite mezunlarının payı ${ek(ilkYil(t), 'de')} %${sayi(t[ilkYil(t)], 1)}
          iken ${ek(y, 'de')} <strong>%${ek(sayi(t[y], 1), 'e')}</strong> çıktı.</p>
          <p>Oran en yüksek <strong>${esc(adi(s[0][0]))}</strong> (%${sayi(s[0][1], 1)}), en düşük
          <strong>${esc(adi(s.at(-1)[0]))}</strong> (%${sayi(s.at(-1)[1], 1)}). Üniversitelerin ve kamu
          istihdamının yoğunlaştığı iller haritanın koyu tonlarını oluşturuyor.</p>`;
      },
    },
    {
      baslik: 'Okuma yazma bilmeyenlerin çoğu kadın',
      gorsel: {
        tur: 'harita',
        baslik: '6 yaş ve üzeri kadınlarda okuma yazma bilmeyenlerin oranı',
        veri: haritaVerisi(K, '6 Yaş ve Üzeri Okuma Yazma Bilmeyen Kadın Oranı'),
        ondalik: 1,
        birim: '%',
      },
      kesfet: { kategori: K, ad: '6 Yaş ve Üzeri Okuma Yazma Bilmeyen Kadın Oranı' },
      metin: (v, adi) => {
        const kadin = seri(v, K, '6 Yaş ve Üzeri Okuma Yazma Bilmeyen Kadın Oranı');
        const erkek = seri(v, K, '6 Yaş ve Üzeri Okuma Yazma Bilmeyen Erkek Oranı');
        const [y, d] = son(kadin);
        const tk = turkiye(kadin);
        const te = turkiye(erkek);
        const s = sirala(d);
        return `<p>${ek(y, 'de')} 6 yaş ve üzeri kadınların <strong>%${ek(sayi(tk[y], 1), 'iyelik')}</strong> okuma yazma bilmiyor;
          erkeklerde bu oran yalnızca %${sayi(te[y], 1)}. Kadın ve erkek nüfus yaklaşık eşit olduğundan, okuma yazma
          bilmeyenlerin kabaca <strong>%${ek(sayi((100 * tk[y]) / (tk[y] + te[y]), 0), 'iyelik')}</strong> kadın.</p>
          <p>Kadınlarda oran en yüksek <strong>${esc(adi(s[0][0]))}</strong> (%${sayi(s[0][1], 1)}) ve
          <strong>${esc(adi(s[1][0]))}</strong> (%${sayi(s[1][1], 1)}); en düşük ${esc(adi(s.at(-1)[0]))} (%${sayi(s.at(-1)[1], 1)}).</p>`;
      },
    },
  ],
};
