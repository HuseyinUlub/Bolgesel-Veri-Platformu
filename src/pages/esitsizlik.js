/**
 * "Bölgesel Eşitsizlik" bölümü — sayfanın ilk veri bölümü.
 *
 * Soldaki kartlar kaydırıldıkça sağdaki yapışkan panel değişir (scrollytelling):
 * zaman serisi adımlarında çizgi grafik, harita adımlarında koroplet + sıralı çubuk.
 * Veri: public/veri/esitsizlik.json  (pipeline/turetilmis/esitsizlik.py üretir)
 */
import { sayi, esc } from '../lib/format.js';

export const ESITSIZLIK = 'Bölgesel Eşitsizlik';

let veri = null;
export async function esitsizlikVerisi() {
  veri ??= fetch(`${import.meta.env.BASE_URL}veri/esitsizlik.json`).then((r) => {
    if (!r.ok) throw new Error(`esitsizlik.json yüklenemedi (HTTP ${r.status})`);
    return r.json();
  });
  return veri;
}

const yillari = (s) => Object.keys(s).sort();
const ilk = (s) => { const y = yillari(s)[0]; return [y, s[y]]; };
const son = (s) => { const y = yillari(s).at(-1); return [y, s[y]]; };
const degisim = (a, b) => (100 * (b - a)) / a;

/** En büyük düşüşün yaşandığı `n` yıllık aralık: [başlangıç yılı, bitiş yılı] */
function enHizliDusus(s, n = 2) {
  const y = yillari(s);
  let en = null;
  for (let i = n; i < y.length; i++) {
    const d = s[y[i]] - s[y[i - n]];
    if (!en || d < en[0]) en = [d, y[i - n], y[i]];
  }
  return en.slice(1);
}

/**
 * Adımlar. `metin(d, adi)` kart metnini üretir (sayılar veriden, elle yazılmaz).
 * gorsel: 'cizgi' → seriler; 'harita' → harita anahtarı + düzey
 */
export const ADIMLAR = [
  {
    baslik: 'Bölgesel Eşitsizliğin Seyri',
    gorsel: 'cizgi',
    grafikBaslik: 'Kişi Başına GSYH\'de İller Arası Eşitsizlik (Theil Endeksi)',
    seriler: [
      { anahtar: 'theil_il', ad: 'İller (81)', kisaAd: 'İller' },
    ],
    ondalik: 3,
    metin: (d) => {
      const s = d.seriler.theil_il;
      const [y0, v0] = ilk(s);
      const [y1, v1] = son(s);
      return `<p>İller arasındaki kişi başına GSYH farkını tek bir değerle özetleyen <strong>Theil endeksi</strong>
        ${y0} yılında <strong>${sayi(v0, 3)}</strong> iken ${y1} yılında <strong>${sayi(v1, 3)}</strong> düzeyine gerilemiştir.
        Bu, yaklaşık yüzde <strong>${sayi(-degisim(v0, v1), 0)}</strong> oranında bir azalmaya karşılık gelmektedir.</p>
        <p>Endeks, bütün illerin aynı gelir düzeyinde olması durumunda sıfır değerini almakta, değer yükseldikçe iller arasındaki fark
        açılmaktadır. En belirgin gerileme ${enHizliDusus(s).join('–')} döneminde yaşanmıştır.</p>`;
    },
  },
  {
    baslik: 'En Yüksek ve En Düşük Gelirli İller Arasındaki Fark',
    gorsel: 'cizgi',
    grafikBaslik: 'Kişi Başına GSYH: En Yüksek / En Düşük İl (Kat)',
    seriler: [
      { anahtar: 'maxmin_il', ad: 'İller', kisaAd: 'İller' },
    ],
    ondalik: 1,
    birim: 'kat',
    metin: (d, adi) => {
      const [y0, v0] = ilk(d.seriler.maxmin_il);
      const [y1, v1] = son(d.seriler.maxmin_il);
      const [enY, enD] = d.uclar[y1].il;
      return `<p>${y1} yılında kişi başına GSYH'si en yüksek il olan <strong>${esc(adi(enY))}</strong> ilinin değeri, en düşük il olan
        <strong>${esc(adi(enD))}</strong> ilinin değerinin <strong>${sayi(v1, 1)} katıdır</strong>. Bu oran ${y0} yılında
        ${sayi(v0, 1)} kat düzeyindeydi.</p>
        <p>Söz konusu ölçü yalnızca iki uç değeri dikkate almakta, aradaki illerde yaşanan değişimi yansıtmamaktadır.
        Bu nedenle Theil endeksi ve nüfusun yüzde yirmilik dilimleriyle birlikte değerlendirilmelidir.</p>`;
    },
  },
  {
    baslik: 'Nüfusun En Zengin ve En Yoksul Yüzde Yirmilik Dilimleri',
    gorsel: 'cizgi',
    grafikBaslik: 'Kişi Başına GSYH, Türkiye Ortalamasına Oranla (Türkiye = 1)',
    seriler: [
      { anahtar: 'ust20_il', ad: 'En zengin %20 (nüfus)', kisaAd: 'Üst %20' },
      { anahtar: 'alt20_il', ad: 'En yoksul %20 (nüfus)', kisaAd: 'Alt %20' },
    ],
    ondalik: 2,
    basvuru: { deger: 1, etiket: 'Türkiye ortalaması' },
    metin: (d) => {
      const [y1, u] = son(d.seriler.ust20_il);
      const a = d.seriler.alt20_il[y1];
      const [y0, k0] = ilk(d.seriler.kutup_il);
      const k1 = d.seriler.kutup_il[y1];
      return `<p>İller kişi başına GSYH'ye göre sıralanıp toplam nüfusun yüzde yirmisine ulaşılana kadar bir araya getirildiğinde
        (OECD'nin "nüfus eşdeğeri" yöntemi), ${y1} yılında en zengin dilimin kişi başına geliri Türkiye ortalamasının
        <strong>${sayi(u, 2)} katı</strong>, en yoksul dilimin geliri ise <strong>${sayi(a, 2)} katı</strong> düzeyindedir.</p>
        <p>İki dilim arasındaki oran olarak tanımlanan <strong>kutuplaşma</strong>, ${y0} yılında ${sayi(k0, 2)} iken ${y1} yılında
        ${sayi(k1, 2)} düzeyine gerilemiştir. Yakınsama esas olarak alt dilimdeki illerin Türkiye ortalamasına yaklaşmasından kaynaklanmaktadır.</p>`;
    },
  },
  {
    baslik: 'Bölgeler Arası ve Bölge İçi Eşitsizlik',
    gorsel: 'cizgi',
    grafikBaslik: 'Theil Endeksinin Ayrıştırılması (Düzey 1 Bölgeleri)',
    seriler: [
      { anahtar: 'arasi', ad: 'Bölgeler arası', kisaAd: 'Arası' },
      { anahtar: 'ici', ad: 'Bölge içi (iller arası)', kisaAd: 'İçi' },
    ],
    ondalik: 3,
    yigilmis: true,
    metin: (d) => {
      const [y1, p1] = son(d.seriler.arasi_pay);
      return `<p>Theil endeksi iki bileşene ayrılabilmektedir: 12 Düzey 1 bölgesinin ortalamaları arasındaki fark ve her bölgenin
        kendi illeri arasındaki fark. İki bileşenin toplamı, ilk adımdaki il düzeyi endekse eşittir.</p>
        <p>${y1} yılında toplam eşitsizliğin yüzde <strong>${sayi(p1, 0)}</strong> oranındaki kısmı bölgeler arasındaki farktan
        kaynaklanmaktadır. Buna göre Türkiye'de gelir farkı öncelikle batı–doğu ayrımı gibi büyük bölgeler arasında ortaya çıkmaktadır.</p>`;
    },
  },
  {
    baslik: 'İllerin Kişi Başına GSYH Düzeyi: Türkiye Ortalamasına Göre',
    gorsel: 'harita',
    harita: 'gsyh_endeks_il',
    duzey: 'province',
    gostergeAd: 'Kişi Başına GSYH Endeksi (Türkiye=100)',
    ondalik: 0,
    metin: (d, adi) => {
      const h = d.haritalar.gsyh_endeks_il;
      const y = Object.keys(h).sort().at(-1);
      const v = Object.values(h[y]);
      const ust = v.filter((x) => x >= 100).length;
      const yarim = v.filter((x) => x < 50).length;
      return `<p>${y} yılında 81 ilin yalnızca <strong>${ust}</strong> tanesinde kişi başına GSYH Türkiye ortalamasının üzerindedir.
        <strong>${yarim}</strong> ilde ise ortalamanın yarısının altında kalmaktadır.</p>
        <p>Haritada mavi tonlar ortalamanın üzerindeki, hardal tonlar ise altındaki illeri göstermektedir. Kıyı ve batı illeri ile
        güneydoğu illeri arasındaki ayrım, bir önceki adımda bölgeler arası farkın belirleyici olmasının nedenini ortaya koymaktadır.</p>`;
    },
  },
  {
    baslik: 'Düzey 1 Bölgelerinin Kendi İçindeki Farklar',
    gorsel: 'harita',
    harita: 'd1_theil',
    duzey: 'region12',
    gostergeAd: 'Bölge içi Theil endeksi (iller arası)',
    ondalik: 3,
    metin: (d, adi) => {
      const h = d.haritalar.d1_theil;
      const y = Object.keys(h).sort().at(-1);
      const s = Object.entries(h[y]).sort((a, b) => b[1] - a[1]);
      return `<p>Harita, ${y} yılı itibarıyla her Düzey 1 bölgesinin kendi illeri arasındaki eşitsizliği göstermektedir.
        En yüksek değer <strong>${esc(adi(s[0][0]))}</strong> (${sayi(s[0][1], 3)}), en düşük değer <strong>${esc(adi(s.at(-1)[0]))}</strong>
        (${sayi(s.at(-1)[1], 3)}) bölgesindedir. İstanbul tek ilden oluştuğu için değeri sıfırdır.</p>
        <p class="yontem-notu"><strong>Yöntem:</strong> Tüm ölçüler TÜİK il ve Düzey 2 kişi başına GSYH (2000–2024) ile nüfus (2007 sonrası)
        verilerinden hesaplanmaktadır; tanımlarda OECD <em>Regions and Cities at a Glance</em> Tablo 2.2 esas alınmıştır.
        Theil endeksi ve oranlar ağırlıksız, yüzde yirmilik dilimler nüfus eşdeğeridir.</p>`;
    },
  },
];
