import { yukle, seri, son, sirala, toplam, bolge, turkiye, haritaVerisi, sayi, esc, ek } from './ortak.js';

const K = 'Kentler (OECD)';
const fua = (ad) => haritaVerisi(K, ad, 'fua');
const SICAK = 'Sıcak Gün Sayısı (OECD';

/** Son üç yılın ortalamasında en çok sıcak gün yaşayan üç kent */
function sicakKentler(v) {
  const s0 = seri(v, K, SICAK);
  const yillar = Object.keys(s0).sort().slice(-3);
  const ort = {};
  for (const y of yillar) for (const [k, x] of Object.entries(son(s0, 'fua', y)[1])) ort[k] = (ort[k] ?? 0) + x / yillar.length;
  return sirala(ort).slice(0, 3).map(([k]) => k);
}

export const KENTLER = {
  id: 'kentler',
  baslik: 'Kentler (OECD)',
  kaynak: 'OECD Metropolitan Areas / Functional Urban Areas veri tabanı',
  giris: 'OECD, kentleri il sınırlarına göre değil, işe gidip gelme ilişkisiyle birbirine bağlı yerleşimler olarak tanımlıyor. Türkiye\'deki 26 işlevsel kentsel alan bu bölümün konusu.',
  yukle: () => yukle(K, 'Nüfus'),
  adimlar: [
    {
      baslik: 'Kentsel nüfusun büyük bölümü birkaç metropolde',
      gorsel: { tur: 'harita', baslik: 'Kent nüfusu (işlevsel kentsel alan)', duzey: 'fua', veri: fua('Kent Nüfusu'), ondalik: 0, birim: 'kişi' },
      kesfet: { kategori: K, ad: 'Kent Nüfusu', duzey: 'fua' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Kent Nüfusu'), 'fua');
        const s = sirala(d);
        const top = toplam(d);
        const tr = turkiye(seri(v, 'Nüfus', 'Toplam Nüfus'))[y];
        return `<p>${ek(y, 'de')} Türkiye'nin 26 işlevsel kentsel alanında <strong>${sayi(top / 1e6, 1)} milyon</strong> kişi yaşıyordu${tr ? `;
          bu, ülke nüfusunun yaklaşık %${ek(sayi((100 * top) / tr, 0), 'iyelik')}` : ''}.</p>
          <p>Bu kentsel nüfusun <strong>%${ek(sayi((100 * s[0][1]) / top, 0), 'iyelik')}</strong> ${esc(ek(adi(s[0][0]), 'de'))},
          %${ek(sayi((100 * s[1][1]) / top, 0), 'iyelik')} ${esc(ek(adi(s[1][0]), 'de'))}.
          En küçük kent ${esc(adi(s.at(-1)[0]))} (${sayi(s.at(-1)[1] / 1000, 0)} bin kişi).</p>`;
      },
    },
    {
      baslik: 'Kentler arasında gelir farkı',
      gorsel: { tur: 'harita', baslik: 'Kişi başına GSYH, satın alma gücü paritesiyle', duzey: 'fua', veri: fua('Kişi Başına GSYH, SGP'), ondalik: 0, birim: '$' },
      kesfet: { kategori: K, ad: 'Kişi Başına GSYH, SGP', duzey: 'fua' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Kişi Başına GSYH, SGP'), 'fua');
        const s = sirala(d);
        return `<p>OECD'nin satın alma gücüyle düzeltilmiş verilerine göre ${ek(y, 'de')} kişi başına gelirin en yüksek olduğu kent
          <strong>${esc(adi(s[0][0]))}</strong> (${sayi(s[0][1], 0)} $), en düşük olduğu kent <strong>${esc(adi(s.at(-1)[0]))}</strong>
          (${sayi(s.at(-1)[1], 0)} $).</p>
          <p>Aradaki fark <strong>${sayi(s[0][1] / s.at(-1)[1], 1)} kat</strong>. Bu veri OECD'nin gelir tahmini yaptığı
          ${s.length} kent için yayımlanıyor; gri alanlar kent dışıdır.</p>`;
      },
    },
    {
      baslik: 'Isı adası: kentler geceleri daha sıcak',
      gorsel: { tur: 'harita', baslik: 'Kentsel ısı adası etkisi, yaz geceleri', duzey: 'fua', veri: fua('Kentsel Isı Adası, Yaz Geceleri'), ondalik: 1, birim: '°C' },
      kesfet: { kategori: K, ad: 'Kentsel Isı Adası, Yaz Geceleri', duzey: 'fua' },
      metin: (v, adi) => {
        const [y, d] = son(seri(v, K, 'Kentsel Isı Adası, Yaz Geceleri'), 'fua');
        const s = sirala(d);
        return `<p>Beton ve asfalt gündüz depoladığı ısıyı gece geri verir. Bu yüzden kent merkezleri yaz gecelerinde çevresindeki
          kırsal alandan daha sıcaktır.</p>
          <p>${ek(y, 'de')} bu fark en fazla <strong>${esc(ek(adi(s[0][0]), 'de'))}</strong> (${sayi(s[0][1], 1)} °C) ve
          ${esc(ek(adi(s[1][0]), 'de'))} (${sayi(s[1][1], 1)} °C), en az ${esc(ek(adi(s.at(-1)[0]), 'de'))} (${sayi(s.at(-1)[1], 1)} °C).</p>`;
      },
    },
    {
      baslik: 'En sıcak kentlerde çok sıcak günler',
      gorsel: {
        tur: 'cizgi',
        baslik: 'Yılda en yüksek sıcaklığın 35 °C\'yi aştığı gün sayısı',
        seriler: [0, 1, 2].map((i) => ({
          ad: '',
          veri: (v) => bolge(seri(v, K, SICAK), sicakKentler(v)[i] ?? ''),
        })),
        ondalik: 0,
        birim: 'gün',
        seriAdlari: (v, adi) => sicakKentler(v).map((k) => adi(k)),
        altBaslik: 'En çok sıcak gün yaşayan üç kent',
      },
      kesfet: { kategori: K, ad: SICAK, duzey: 'fua' },
      metin: (v, adi) => {
        const s0 = seri(v, K, SICAK);
        const k = sicakKentler(v);
        const ys = Object.keys(bolge(s0, k[0])).sort();
        const ilk = ys.slice(0, 3);
        const sonr = ys.slice(-3);
        const ort = (kod, yl) => yl.reduce((a, t) => a + (s0[t]?.[kod] ?? 0), 0) / yl.length;
        return `<p>Son yıllarda en çok sıcak gün yaşayan kent ${esc(adi(k[0]))}: ${ilk[0]}–${ilk.at(-1)} ortalamasında yılda
          ${sayi(ort(k[0], ilk), 0)} gün 35 °C'yi aşarken ${sonr[0]}–${sonr.at(-1)} ortalamasında <strong>${sayi(ort(k[0], sonr), 0)} gün</strong>.</p>
          <p>Aynı dönemlerde ${esc(adi(k[1]))} için ${sayi(ort(k[1], ilk), 0)} → ${sayi(ort(k[1], sonr), 0)} gün,
          ${esc(adi(k[2]))} için ${sayi(ort(k[2], ilk), 0)} → ${sayi(ort(k[2], sonr), 0)} gün. Yıllar arası dalgalanma büyük olduğu için
          üç yıllık ortalamaları karşılaştırıyoruz.</p>`;
      },
    },
  ],
};
