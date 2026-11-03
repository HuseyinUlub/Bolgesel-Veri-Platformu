# Geçiş planı

Yöntem: eski site çalışmaya devam eder. Her adımda **bir** sayfa taşınır, `vite.config.js` → `pages` listesine eklenir ve build artık o sayfanın eski kopyasını almaz. Her adım tek başına yayınlanabilir.

## Tamamlandı: Adım 0–1

- [x] Veri hattı: `pipeline/build_data.py`, doğrulama raporu, VizStudio uyumlu `veri.db`
- [x] Ortak modüller: `data.js` (önbellekli yükleme), `map.js` (kod ile eşleşen koroplet), `chart.js`, `format.js`
- [x] Sürümü sabitlenmiş bağımlılıklar (Chart.js 4.4.4, d3 modülleri, Inter ve Font Awesome yerel paket). Artık CDN kesintisine ya da sürüm değişimine bağlı değil
- [x] Ana sayfa (`index.html`) taşındı. Tasarım aynen korundu, davranış farkları aşağıda
- [x] Araçlar menüsü: yeni ana sayfadan 13 eski sayfaya bağlantı (eski `index.html`'de yoktu)
- [x] Testler: 5 veri testi + 21 tarayıcı kontrolü
- [x] Ana sayfaya Haberleşme ve Bölgesel Refah (OECD) eklendi (özgün kart görselleri: `tools/kart-gorselleri/*.svg` → `python tools/kart-gorselleri/render.py`). Kategoride verisi olmayan düzeyler seçilemiyor ve düzey otomatik değişiyor (OECD → Düzey 2); başka kategoriye geçince kullanıcının seçtiği düzey geri geliyor. Kaydırılmış başlıkta ilk sekmelerin kaybolması düzeltildi. Bölge grafiklerinde eksende kod, ipucunda tam ad gösteriliyor. Tarayıcı kontrolleri 29'a çıktı
- [x] OECD kentleri: "Kentler (OECD)" bölümü ve düzeyi (26 FUA, gri il zemini), 20 gösterge, SDMX dönüştürücüsü (`donusturuculer/oecd_sdmx.py`: kapsam koruması, bozuk yıl kontrolü). REG verisi, indirme betiği düzeltildikten (`download_oecd_turkiye_5.R`) sonra eklenecek. Bkz. `OECD-FUA-DEGERLENDIRME.md`. Tarayıcı kontrolleri 33'e çıktı
- [x] Veritabanı genişletme (25 Eylül): TÜİK Birleşik Excel (+729 gösterge, geçmiş 1995'e), OECD FUA +22 gösterge. 466 → 1.214 gösterge, 0,96 → 2,24 milyon değer. `yayin=hayir` ile ayrıntılı kırılımlar yalnızca `veri.db`'de. Gösterge listesi konu başlıklarıyla gruplanıyor. Tutarlılık kontrolü tek geçişe indirildi (4,5 dk → 55 sn). Kart arka plan görsellerinin statik sunucuda 404 vermesi düzeltildi
- [x] Veri ekleri: `veri-ekleri/` şablonu, Excel dönüştürücü, VizStudio .db + ad eşleme, ek kontrolleri (7 test). İlk ek: BTK Haberleşme (bkz. `VERI-EKLEME.md`)

### Ana sayfada bilinçli farklar

| Konu | Eski | Yeni | Neden |
|---|---|---|---|
| İl ↔ harita eşleşmesi | isim benzetmesi | İBBS kodu | Türkçe `İ` sorunu, kesinlik |
| Grafik renkleri | 15 rastgele pastel | haritayla aynı mavi ölçek | Aynı değer = aynı renk. Renk bir anlam taşıyor; gökkuşağı paleti yanlış bir kategori algısı yaratıyordu |
| Haritada üzerine gelme | yalnızca tooltip | tooltip + grafikte aynı bölgenin vurgusu | Harita ve grafik birbirine bağlı okunuyor |
| Türkiye değeri | yok | "Türkiye" referans kutusu | Karşılaştırma için bir çıpa noktası |
| Kaynak | gösterilmiyordu | grafiğin üstünde "Kaynak: …" | Veri kaynağını belirtmek |
| Düzey değişince | tüm göstergeler listelenir, veri yoksa boş harita | yalnızca o düzeyde verisi olanlar listelenir | Boş ekran oluşmuyor |
| Veri yükleme | 1,4 MB gz, açılışta tamamı | kategori başına, ihtiyaç anında | Daha hızlı ilk açılış |

Eski pastel renklere dönmek isterseniz `explorer.js` içinde `grafik.guncelle(..., { renk: olcek })` satırındaki `renk` parametresini değiştirmeniz yeterli.

### Bölgesel Eşitsizlik bölümü (Eylül 2026)

Ana sayfada Hakkında'dan sonraki ilk bölüm. Altı adımlı bir kaydırmalı anlatı: soldaki kartlar kaydırıldıkça sağdaki yapışkan panel değişir. Düzen örnek aldığımız Growth Lab sayfalarındaki gibidir: sabit görsel ve yanından geçen dar metin kartları.

- Veri: `pipeline/turetilmis/esitsizlik.py` → `public/veri/esitsizlik.json`. Türkiye serilerini, harita değerlerini ve uç bölgeleri içerir. Kartlardaki sayılar bu dosyadan üretilir, elle yazılmaz.
- Adımlar (`src/pages/esitsizlik.js`, `ADIMLAR`):
  1. Theil endeksi (iller ve Düzey 2)
  2. En yüksek / en düşük oranı
  3. Nüfus eşdeğeri üst ve alt %20, ortalamaya göre
  4. Theil ayrıştırması (Düzey 1 arası ve içi, yığılmış alan)
  5. Kişi başına GSYH endeksi haritası (il)
  6. Düzey 1 bölge içi Theil haritası ve yöntem notu
- Çizgi grafikler `src/lib/cizgi.js` ile çizilir. Kurallar: tek eksen, 2 px çizgi, lejant, seri sonunda doğrudan etiket ve dikey imleçli ipucu.
- Sıradaki iş: OECD ülkeleriyle uluslararası kıyaslama. Bunun için R betiğinin yalnızca Türkiye'yi değil, tüm OECD TL2 ve ülke satırlarını da tutması gerekir.

Aynı çalışmada düzeltilen hata: `tr.geojson` Çanakkale'yi Zonguldak'ın koduyla (TR-67) etiketliyordu. Bu yüzden Çanakkale haritada Zonguldak verisiyle boyanıyordu. İl geometrileri artık isimle eşleniyor (`PLAKA_DUZELTME`, `build_data.py`).

### Tasarım dili ve sayfa yapısı (Eylül 2026)

Kararlar Growth Lab'in "Best of 2025" ve "Port Ecosystems" sayfalarını örnek alıyor:

- **Ana sayfa (`index.html`, `src/pages/hikaye.js`):** Kaydırmalı veri hikâyeleri. Solda yapışkan harita ya da grafik, sağda dar metin kartları. Sıra: açılış ve içindekiler, Bölgesel Eşitsizlik, ardından kategori hikâyeleri, en sonda tüm kategorilerin listesi.
- **Veri Gezgini (`gezgin.html`, `explorer.js`):** Serbest seçim (düzey, alt başlık, yıl) ayrı sayfada. Hikâyelerdeki "Bu veriyi keşfet" bağlantısı `gezgin.html?kategori=…&gosterge=…&duzey=il` adresiyle ilgili göstergeyi açar.
- **Görünüm:**
  - Beyaz zemin, koyu gri metin, tek vurgu rengi.
  - Yazı tipleri Source Sans 3 ve etiketlerde IBM Plex Mono.
  - Harita renkleri: sıralı ölçekte tek ton mavi. İki yönlü ölçekte orta nokta gri, altı turuncu, üstü mavi (örneğin nüfus artışı ve GSYH endeksi).
- **Hikâye tanımları (`src/hikayeler/<kategori>.js`):** Metinlerdeki sayılar veriden hesaplanır. İl adlarına ve sayılara gelen ekler `ek()` ile üretilir (İstanbul'da, Sinop'ta, 18'i, 20'si).
- **Kapsam:** 12 bölüm, 45 adım. Bölümler: Eşitsizlik, Nüfus, Eğitim, Ekonomi, Sanayi, Sağlık, Tarım, Turizm, Enerji, Haberleşme, Refah (OECD) ve Kentler (OECD).
- **Yeni hikâye eklemek:**
  1. `src/hikayeler/<kategori>.js` dosyasını yazın. Göstergeler adının başıyla bulunur; `ortak.js` içindeki `seri`, `son`, `turkiye` ve `sirala` yardımcılarını kullanın.
  2. Bölümü `src/pages/hikaye.js` dosyasındaki `BOLUMLER` listesine ekleyin.
- **Veri Gezgini (`gezgin.html`):** Yeni görünüm `src/styles/gezgin.css` dosyasında. Eski stilleri ezer, sayfa düzenine dokunmaz.

## Sıradaki adımlar

**Geçici çözüm (25 Eylül):** Ana sayfada kendi bölümü olmayan 13 kategori (İşgücü, Demografi, İnşaat ve Konut, Enflasyon ve Fiyat, Ulaştırma, Kültür, Dış Ticaret, Çevre, Tüketim Harcamaları, Göç, Gelir ve Yaşam Koşulları, Ar-Ge, SEGE) tek bir **"Diğer Kategoriler"** bölümünde, kart içindeki kategori seçicisiyle gösteriliyor (varsayılan: en çok göstergeli kategori). Kategoriler tek tek gözden geçirilip hangilerinin kendi bölümünü alacağına karar verilecek; bir kategoriyi ana sayfaya taşımak için `site.config.js` → `anaSayfaKategorileri` listesine eklemek ve `public/img/<slug>.png` kart görseli koymak yeterli.

Sıralama, yeniden kullanım oranına göre yapıldı: ilk taşınan sayfalar en çok ortak modül kullananlar.

**Adım 2 — Harita sayfaları** (`ilharita`, `nuts1`, `nuts2`): Üçü aynı sayfa, yalnızca düzeyleri farklı. Tek bir `harita.html?duzey=il|duzey1|duzey2` sayfasına dönüşür. `map.js` ve `data.js` hazır. Eklenecekler: Excel/PNG dışa aktarma için `lib/export.js` (xlsx + html2canvas) ve zaman serisi grafiği.

**Adım 3 — SKA sayfaları** (`illerska`, `nuts2ska`, `7bolgeska`, `surdurulebilir`): Önce veri hattına `ska` bölümü eklenecek: dört dosya tek şemaya (amaç, hedef, gösterge, alt gösterge, bölge, yıl, değer, birim). Ardından tek bir SKA sayfası yazılacak. 7 coğrafi bölge `entities` tablosuna `region7` düzeyi olarak girecek.

**Adım 4 — Grafik sayfaları** (`trgrafik`, `ilcegrafik`): Veriler zaten hazır (`k/*.json`, `ilce/*.json`). Tom-select yerine yerel `<select>` kullanılacak ya da tek bir sabit sürüm seçilecek.

**Adım 5 — İlçe haritası**: `geo/district.json` (2,3 MB) hazır. Ekrana yalnızca seçili ilin ilçeleri çizilecek.

**Adım 6 — Destekler, Projeler, İnfografik**: Kendi veri modelleri var. En son taşınacaklar. İnfografik (6.000 satır, jQuery UI) ayrı bir proje gibi ele alınmalı.

**Adım 7 — Temizlik**: Eski `data/` içindeki gereksiz dosyalar (`illerveri`, `duzey1veri`, `duzey2veri`, `nuts1/2.geojson`, `tr-*.geojson`, `img/* - Kopya.png`) kaldırılacak. Bu adım, hiçbir eski sayfa onlara ihtiyaç duymadığında yapılır.

## Next.js ya da Astro sorusu

Bu yapı framework'e geçişi kolaylaştırıyor ama bunu zorunlu kılmıyor. `src/lib/*` ve `public/veri/*` framework'ten bağımsız, olduğu gibi taşınabilir. Framework'ün gerçek bir kazanç getireceği durum: her il ya da bölge için ayrı, arama motorlarında görünen bir sayfa istenmesi (`/il/ankara`). O noktada Astro (statik çıktı, mevcut JS modülleri "island" olarak) en az değişiklik gerektiren seçenek olur.
