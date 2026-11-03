/**
 * Üst başlıklar (temalar): 25 veri kategorisini TÜİK'in "İstatistiksel Temalar" başlıklarına göre toplar; sıra TÜİK'teki
 * sıradır, platformda verisi bulunmayan temalar (Adalet ve Seçim) listelenmez. Analiz Masası'nın gösterge seçicisi,
 * Veri Kataloğu ve araç sayfalarının kategori listeleri bu yapıyı kullanır. Yeni bir kategori buraya eklenmezse
 * otomatik olarak "Diğer" üst başlığına düşer.
 *
 * Sürdürülebilir Kalkınma (Çok Boyutlu İstatistikler altında) 17 amaca bölünür: gösterge adları
 * "SKA 01 Yoksulluğa Son: …" biçiminde olduğundan amaçlar addaki önekten çıkarılır.
 */
const T = (id, ad, kisa, ikon, resim, aciklama, kategoriler, ek = {}) => ({ id, ad, kisa, ikon, resim, aciklama, kategoriler, ...ek });
export const UST_BASLIKLAR = [
  T('bilim-teknoloji', 'Bilim, Teknoloji ve Bilgi Toplumu', 'Bilim ve Teknoloji', 'fa-flask', 'haberlesme',
    'Ar-Ge harcaması ve personeli, araştırmacılar, patent başvuruları.', ['Araştırma ve Geliştirme']),
  T('cevre', 'Çevre', 'Çevre', 'fa-leaf', 'enerji',
    'Su, kanalizasyon ve atık hizmetleri, çevresel yatırımlar, iklim.', ['Çevre']),
  T('egitim', 'Eğitim', 'Eğitim', 'fa-graduation-cap', 'egitim',
    'Okullaşma, öğrenci, öğretmen ve derslikler, eğitim düzeyi, yükseköğretim.', ['Eğitim']),
  T('enerji', 'Enerji', 'Enerji', 'fa-bolt', 'enerji',
    'Elektrik üretimi ve tüketimi, kurulu güç, dağıtım altyapısı.', ['Enerji']),
  T('fiyat', 'Fiyat İstatistikleri', 'Fiyat', 'fa-tags', 'ekonomi',
    'Bölgesel fiyat düzeyi endeksleri, satınalma gücü paritesi ve TÜFE değişimleri.', ['Enflasyon ve Fiyat']),
  T('gelir-tuketim', 'Gelir, Tüketim ve Yoksulluk', 'Gelir ve Tüketim', 'fa-scale-balanced', 'saglik',
    'Gelir dağılımı ve yoksulluk, mutluluk düzeyi, hanehalkı tüketim harcamaları.', ['Gelir ve Yaşam Koşulları', 'Tüketim Harcamaları']),
  T('istihdam', 'İstihdam, İşsizlik ve Ücret', 'İstihdam', 'fa-briefcase', 'ekonomi',
    'İşgücüne katılma, istihdam ve işsizlik oranları, sektörel istihdam.', ['İşgücü']),
  T('kisa-donemli', 'Kısa Dönemli Ekonomik Göstergeler', 'Kısa Dönemli', 'fa-building', 'sanayi',
    'Yapı ruhsatları, yapı kullanma izinleri ve konut satışları.', ['İnşaat ve Konut']),
  T('kultur-spor', 'Kültür ve Spor', 'Kültür', 'fa-masks-theater', 'egitim',
    'Kütüphaneler, sinema ve tiyatro, müze ve ören yerleri.', ['Kültür']),
  T('nufus-demografi', 'Nüfus ve Demografi', 'Nüfus', 'fa-users', 'nufus',
    'Nüfusun büyüklüğü ve yaş yapısı, hanehalkı, doğum, ölüm, evlenme, boşanma ve göç.', ['Nüfus', 'Demografi', 'Göç']),
  T('saglik', 'Sağlık ve Sosyal Koruma', 'Sağlık', 'fa-heart-pulse', 'saglik',
    'Hastane yatakları, sağlık kurumları ve personeli, ölüm hızları.', ['Sağlık']),
  T('tarim', 'Tarım', 'Tarım', 'fa-seedling', 'tarim',
    'Bitkisel ve hayvansal üretim, tarım alanları, tarımsal alet ve makineler.', ['Tarım']),
  T('turizm', 'Turizm', 'Turizm', 'fa-plane', 'turizm',
    'Konaklama tesisleri ve geceleme, sınır kapılarından giriş ve çıkışlar.', ['Turizm']),
  T('ulastirma-haberlesme', 'Ulaştırma ve Haberleşme', 'Ulaştırma', 'fa-car', 'haberlesme',
    'Taşıt sayıları, yollar, trafik kazaları, havalimanları; telefon ve genişbant internet aboneleri.', ['Ulaştırma', 'Haberleşme']),
  T('ulusal-hesaplar', 'Ulusal Hesaplar', 'Ulusal Hesaplar', 'fa-chart-line', 'ekonomi',
    'Bölgesel GSYH ve kişi başına GSYH, sektörlere göre katma değer, emek verimliliği.', ['Ekonomi']),
  T('uluslararasi-ticaret', 'Uluslararası Ticaret', 'Dış Ticaret', 'fa-ship', 'ekonomi',
    'İhracat ve ithalat, sektörlere göre dış ticaret, ihracatın ithalatı karşılama oranı.', ['Dış Ticaret']),
  T('yapisal', 'Yapısal Ekonomik Göstergeler ve İş Demografisi', 'Yapısal Göstergeler', 'fa-industry', 'sanayi',
    'Sektörlere göre girişim sayıları, organize sanayi bölgeleri ve sanayi siteleri.', ['Sanayi']),
  T('cok-boyutlu', 'Çok Boyutlu İstatistikler', 'Çok Boyutlu', 'fa-ranking-star', 'surdurulebilir-kalkinma',
    'Sosyo-ekonomik gelişmişlik (SEGE) ve illerde yaşam endeksi, Sürdürülebilir Kalkınma Amaçları göstergeleri, OECD bölgesel refah ve kent (FUA) verileri.',
    ['Sosyo-Ekonomik Gelişmişlik', 'Sürdürülebilir Kalkınma', 'Bölgesel Refah (OECD)', 'Kentler (OECD)'], { amaclar: true }),
];

/** Eski üst başlık kimlikleri (paylaşılmış bağlantılar için) */
export const ESKI_UST = {
  'nufus-toplum': 'nufus-demografi', 'ekonomi-uretim': 'ulusal-hesaplar', 'emek-egitim': 'istihdam',
  'yasam-kosullari': 'gelir-tuketim', 'altyapi-cevre': 'ulastirma-haberlesme', endeksler: 'cok-boyutlu', ska: 'cok-boyutlu',
}

const DIGER = { id: 'diger', ad: 'Diğer', kisa: 'Diğer', ikon: 'fa-ellipsis', resim: 'diger', aciklama: 'Henüz bir üst başlığa atanmamış kategoriler.', kategoriler: [] };

/** Kategori ikonları (Font Awesome solid) */
export const KATEGORI_IKON = {
  Nüfus: 'fa-users', Demografi: 'fa-people-roof', Göç: 'fa-truck-moving', Kültür: 'fa-masks-theater',
  Ekonomi: 'fa-chart-line', Sanayi: 'fa-industry', Tarım: 'fa-seedling', 'Dış Ticaret': 'fa-ship', Turizm: 'fa-plane',
  'Enflasyon ve Fiyat': 'fa-tags', 'Araştırma ve Geliştirme': 'fa-flask',
  İşgücü: 'fa-briefcase', Eğitim: 'fa-graduation-cap',
  'Gelir ve Yaşam Koşulları': 'fa-scale-balanced', 'Tüketim Harcamaları': 'fa-basket-shopping', Sağlık: 'fa-heart-pulse',
  'İnşaat ve Konut': 'fa-building',
  Ulaştırma: 'fa-car', Haberleşme: 'fa-tower-broadcast', Enerji: 'fa-bolt', Çevre: 'fa-leaf',
  'Sosyo-Ekonomik Gelişmişlik': 'fa-ranking-star', 'Bölgesel Refah (OECD)': 'fa-hand-holding-heart', 'Kentler (OECD)': 'fa-city',
  'Sürdürülebilir Kalkınma': 'fa-recycle',
};

/** "SKA 03 Sağlıklı ve Kaliteli Yaşam: 3.2.1 …" → { no: '03', ad: 'Sağlıklı ve Kaliteli Yaşam' } */
export function skaAmaci(gostergeAd) {
  const m = /^SKA (\d\d) ([^:]+):/.exec(gostergeAd ?? '');
  return m ? { no: m[1], ad: m[2].trim() } : null;
}

/** "Konu: kırılım" biçimindeki adın konu kısmı (yoksa null) */
export function konu(ad) {
  const i = (ad ?? '').indexOf(': ');
  return i > 0 ? ad.slice(0, i) : null;
}

/**
 * Manifestteki kategorileri üst başlıklara dağıtır.
 * Döner: [{ ...ust, kats: [kategoriNesnesi], sayi }] (boş üst başlıklar atlanır)
 */
export function ustBasliklar(M) {
  const kullanilan = new Set();
  const out = UST_BASLIKLAR.map((u) => {
    const kats = u.kategoriler.map((ad) => M.kategoriByAd.get(ad)).filter(Boolean);
    kats.forEach((k) => kullanilan.add(k.ad));
    return { ...u, kats };
  });
  const kalan = M.kategoriler.filter((k) => !kullanilan.has(k.ad));
  if (kalan.length) out.push({ ...DIGER, kats: kalan, kategoriler: kalan.map((k) => k.ad) });
  return out
    .filter((u) => u.kats.length)
    .map((u) => ({ ...u, sayi: u.kats.reduce((t, k) => t + k.gostergeler.length, 0) }));
}

/** Kategorinin bağlı olduğu üst başlık */
export function ustBul(ustler, kategoriAd) {
  return ustler.find((u) => u.kats.some((k) => k.ad === kategoriAd)) ?? null;
}

/** SKA amaçları: [{ no, ad, sayi }] */
export function skaAmaclari(kategori) {
  const m = new Map();
  for (const g of kategori.gostergeler) {
    const a = skaAmaci(g.ad);
    if (!a) continue;
    if (!m.has(a.no)) m.set(a.no, { ...a, sayi: 0 });
    m.get(a.no).sayi++;
  }
  return [...m.values()].sort((x, y) => x.no.localeCompare(y.no));
}

/** Başlıktaki kısa kaynak ekini kaldırır: "Toplam Nüfus (TÜİK)" → "Toplam Nüfus" */
export function kaynaksizAd(g) {
  const k = g.kaynakKisa;
  return k && g.ad.endsWith(` (${k})`) ? g.ad.slice(0, -(k.length + 3)) : g.ad;
}

/** Göstergenin kısa kaynağı (manifestte yoksa OECD/TÜİK tahmini) */
export function kisaKaynak(g) {
  if (g.kaynakKisa) return g.kaynakKisa;
  if (g.kaynakTuru?.startsWith('oecd') || /OECD/.test(g.kaynak ?? '')) return 'OECD';
  if (/TÜİK|Türkiye İstatistik/.test(g.kaynak ?? '')) return 'TÜİK';
  return 'Diğer';
}

/**
 * Gösterge seçici (src/lib/gosterge-secici.js) için öğe listesi: tema → alt başlık (kategori) → konu.
 * Tek kategorili temalarda alt başlık yazılmaz; tek göstergelik konular gruplanmaz; SKA'da konu = amaç.
 *   seciciOgeleri(ustler, { suzgec: (g) => bool, isaret: (g) => bool })
 */
export function seciciOgeleri(ustler, { suzgec, isaret } = {}) {
  const out = [];
  const grupAdi = (g) => { const a = skaAmaci(g.ad); return a ? `Amaç ${+a.no}: ${a.ad}` : konu(kaynaksizAd(g)); };
  for (const u of ustler) {
    for (const k of u.kats) {
      const gs = k.gostergeler.filter((g) => !suzgec || suzgec(g));
      const say = new Map();
      for (const g of gs) { const x = grupAdi(g); if (x) say.set(x, (say.get(x) ?? 0) + 1); }
      for (const g of gs) {
        const x = grupAdi(g);
        let ad = kaynaksizAd(g);
        if (skaAmaci(ad)) ad = ad.slice(ad.indexOf(':') + 2);
        out.push({ id: g.id, ad, tema: u.id, alt: u.kats.length > 1 ? k.ad : null, konu: x && say.get(x) > 1 ? x : null, isaret: !!isaret?.(g) });
      }
    }
  }
  return out;
}
