/**
 * Site ayarları — kod değiştirmeden içerik düzenlemek için tek yer.
 */
export const SITE = {
  /**
   * Ana sayfanın giriş şeridi: 'resim' (public/img/<girisResmi>.jpg/.webp) ya da 'kolaj' (tarayıcıda çizilen eski kolaj).
   * girisResmi: 'img/giris-kolaj' → Türkiye harita ve grafiklerinden kolaj (tools/giris-kolaji/ ile üretilir);
   * 'img/giris-serit' ya da 'img/giris-serit-yumusak' → illüstrasyon.
   */
  girisSeridi: 'resim',
  girisResmi: 'img/giris-kolaj',
  /**
   * Ana sayfadaki uluslararası karşılaştırma: 'sahne' → Avrupa'nın 291 bölgesi tek sahnede, 8 adım (src/lib/avrupa-sahne.js);
   * 'adimlar' → OECD/Eurostat şekillerinin 17 grafiklik eski anlatısı (src/pages/giris.js, ADIMLAR).
   */
  karsilastirma: 'sahne',
  baslik: 'Türkiye Bölgesel Veri Analizleri',
  altBaslik: 'Aşağı kaydırarak farklı alanlardaki bölgesel verileri ve istatistikleri keşfedin.',

  /** Ana sayfada gösterilecek kategoriler ve sırası (manifest.json'daki adlarla aynı olmalı). */
  anaSayfaKategorileri: [
    'Nüfus', 'Eğitim', 'Ekonomi', 'Sanayi', 'Sağlık', 'Tarım', 'Turizm', 'Enerji',
    'Haberleşme', 'Sürdürülebilir Kalkınma', 'Bölgesel Refah (OECD)', 'Kentler (OECD)',
  ],

  /** Başlıktaki kısa etiketler (bölüm başlığında tam ad görünür) */
  kisaAdlar: {
    'Bölgesel Refah (OECD)': 'Refah',
    'Kentler (OECD)': 'Kentler',
    'Sürdürülebilir Kalkınma': 'SKA',
    Hakkında: 'Giriş', // Veri Gezgini'nin giriş kartı; sitenin Hakkında sayfasıyla karışmasın
  },

  /** Kategori kartında özetin altında gösterilecek not (isteğe bağlı) */
  kategoriNotlari: {
    'Sürdürülebilir Kalkınma':
      "TÜİK'in Sürdürülebilir Kalkınma Amaçları (SKA) gösterge seti: 17 amaç altında yaklaşık 1.400 gösterge. Çoğu yalnızca Türkiye için yayımlanır; bunları görmek için Bölge Düzeyi'nden \"Türkiye (zaman serisi)\" seçin. İl ve Düzey 2 kırılımı olan göstergeler haritada gösterilir.",
    'Kentler (OECD)':
      "OECD'nin işlevsel kentsel alanları (FUA): 26 kent, il sınırlarından bağımsız tanımlanır; gri alanlar kent dışıdır. Türkiye için OECD'nin FUA ve şehir sınırları aynıdır. Ekonomi ve işgücü göstergeleri 20 kent için yayımlanmaktadır.",
    'Bölgesel Refah (OECD)':
      'OECD Regional Well-Being veri setinden, yalnızca Düzey 2 bölgeleri için. Değerler 2024 sürümünden alınmıştır; göstergelerin ölçüm yılları farklılık gösterebilir.',
  },

  /** Kategoriye özel ilk açılacak gösterge (yoksa listedeki ilk gösterge). */
  varsayilanGosterge: {
    Nüfus: 'toplam-nufus',
    Haberleşme: 'sabit-genisbant-abone-toplam-nufus',
    'Bölgesel Refah (OECD)': 'yasam-memnuniyeti-oecd-0-10',
    'Kentler (OECD)': 'kentsel-isi-adasi-yaz-geceleri-oecd-kent-c',
    'Sürdürülebilir Kalkınma': 'ska-03-saglikli-ve-kaliteli-yasam-3-2-1-bes-yas-alti-olum-hizi-1-000-canli-dogum',
  },

  /** Kategori kartlarındaki ikon (Font Awesome) */
  ikonlar: {
    Nüfus: 'fa-users',
    Eğitim: 'fa-graduation-cap',
    Ekonomi: 'fa-chart-line',
    Sanayi: 'fa-industry',
    Sağlık: 'fa-heartbeat',
    Tarım: 'fa-seedling',
    Turizm: 'fa-plane',
    Enerji: 'fa-bolt',
    Göç: 'fa-truck-moving',
    Çevre: 'fa-leaf',
    Demografi: 'fa-user-friends',
    Kültür: 'fa-theater-masks',
    'Dış Ticaret': 'fa-ship',
    İşgücü: 'fa-hard-hat',
    Haberleşme: 'fa-tower-broadcast',
    'Sürdürülebilir Kalkınma': 'fa-recycle',
    'Bölgesel Refah (OECD)': 'fa-hand-holding-heart',
    'Kentler (OECD)': 'fa-city',
  },

  /**
   * Başlıktaki "Araçlar" menüsü. Harita ve grafik araçları bütün düzeyleri (ilçe, il, Düzey 2, Düzey 1) tek sayfada
   * toplar ve sitenin veritabanını okur. Eski tek düzeyli sayfalar (ilharita.html, nuts1.html, nuts2.html,
   * ilceharita.html, trgrafik.html, ilcegrafik.html) ve SKA sayfaları sitede durur ama menüde gösterilmez:
   * SKA göstergeleri Veri Gezgini'nde "Sürdürülebilir Kalkınma" kategorisindedir.
   */
  araclar: [
  ],
  // 30 Ekim 2026: bütün araçlar menüden çıkarıldı (liste boşken "Araçlar" menüsü gizlenir); sayfalar duruyor.
  // Geri eklemek için: { ad: 'Harita Oluşturma', href: 'harita.html', aciklama: 'İlçe, il, Düzey 2 ve Düzey 1 haritaları' },
  // { ad: 'Grafik Oluşturma', href: 'grafik.html', aciklama: 'Türkiye, bölge, il ve ilçe grafikleri' },
  // { ad: 'İnfografik Oluşturma', href: 'infografik.html' } (eski araç; artifact paylaşımında çalışmıyor).
  digerAraclar: [],
};
