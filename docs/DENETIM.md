# Veri ve site denetimi (25 Eylül 2026)

## Özet

| | Denetim öncesi | Sonrası |
|---|---|---|
| Gösterge | 1.330 | 1.325 (5 kopya birleştirildi) |
| Değer | 2.302.446 | 2.298.021 |
| Düzeltilen / silinen değer | — | 2.007 düzeltildi, 123 silindi |
| Sitede denenen gösterge × düzey | — | 1.799 kombinasyon: konsol hatası 0, boş harita 0 |

Temizlikte değişen her değer `build/temizlik.csv` dosyasına yazılır. Kurallar `VERI-EKLEME.md` §5'te anlatılıyor.

## Bulunan ve düzeltilen hatalar

**Kaynak dosyalardan gelen hatalar**

1. **Yapı izinleri, 2023–2025.** Birleşik Excel'de "Konut Amaçlı" daire sayısı ve yüzölçümü sütunları kaymış. Örneğin Türkiye 2023 konut yüzölçümü 153.159 m² görünüyor; doğrusu yaklaşık 137 milyon m². 1.296 değer "Toplam − Konut Dışı" ile yeniden hesaplandı. Düzeltme dönüştürücüde (`tuik_bolgesel.py`) yapılıyor.
2. **Düzey 1 değerleri (`infografik.csv.gz`, `trveriler.csv.gz`).** Bazı göstergelerde bölge satırları karışmış:
   - Sanayi sitesi ve iş yeri sayıları.
   - Tarımsal elektrik tüketimi: TR1 için 72.873 MWh görünüyor, İstanbul'un değeri 2.800 MWh.
   - Hat uzunluğu.
   - OSB parsel sayısı.
   - GSYH (Bin TL): Düzey 1'de 2017 ve 2018 değerleri yer değiştirmiş.

   Toplam olan göstergelerde bu değerler il toplamıyla değiştirildi (591 değer). Oranlarda (hekim, kanalizasyon, atık su, okullaşma) alt bölgelerin aralığı dışında kalan 122 değer silindi.
3. **Tek illi bölgeler.** TR1/TR10 ile İstanbul, TR51 ile Ankara birbirini tutmuyordu. Örnekler: 2010–2013 hekim sayısı, 2015 kişi başı GSYH, 2022 kanalizasyon oranı. 119 değer il değerine eşitlendi.
4. **Müze ziyaretçi sayısı, 2015.** Türkiye değeri 2,81 olarak girilmiş; ondalık kayması var, doğrusu 28,1 milyon. TR71'in değeri belirsizdi, silindi; toplam il değerlerinden yeniden hesaplandı.
5. **Kopya göstergeler.** Aynı gösterge iki farklı adla duruyordu. Birleştirilen çiftler:
   - "İniş Kalkış" ve "İniş-Kalkış" Yapan Uçak Sayısı
   - "işgücü" ve "İşgücü"
   - Hava yolu yolcu sayısı
   - Hastane yatak sayısı (yüz bin kişi başına)
   - Yoksulluk sınırı
6. **İlçe adları.** "Mayıs" adı "19 Mayıs" (Samsun), "Hakkâri-Hakkâri" adı "Hakkâri" olarak düzeltildi.
7. **Harita (önceki çalışmada).** `tr.geojson` dosyası Çanakkale'yi Zonguldak'ın koduyla etiketliyordu. İller artık adla eşleniyor.

### Hikâyeler yazılırken bulunanlar (26 Eylül 2026)

8. **Satırları karışmış yıllar.** Her göstergede, illerin bir yıldan ötekine sıralaması karşılaştırıldı (sıra korelasyonu). Kaynakta satırları karışmış yıllar bulundu:
   - **Ortalama Eğitim Süresi, 2024 (il düzeyi).** Örneğin Ankara 10,7'den 9,0'a düşmüş, Antalya 9,8'den 10,8'e çıkmış görünüyor.
   - **İlkokul net okullaşma oranları, 2019 (Düzey 2)** ve **erkek net okullaşma oranı, 2023 (Düzey 2).**

   Bu yıllar silindi. Silme kuralı `degerler.csv` dosyasındaki `*il` ve `*d2` satırlarıyla tanımlı.
9. **Algılanan Sosyal Destek Ağı (OECD).** Adında "0-10" yazıyordu, oysa değerler yüzde (60–89). Birim `ad-eslemesi.csv` dosyasında düzeltildi.

### İl ve bölge düzeyinin tamamlanması (26 Eylül 2026)

10. **İstanbul, İzmir ve Ankara'da eksik yıllar.** Bu üç il aynı zamanda bölge olduğu için bir düzeyde olup ötekinde olmayan yıllar karşı düzeyden tamamlandı (1.799 değer):
    - **İşgücü (istihdam, işsizlik, işgücüne katılma oranı).** Düzey 2'deki 2004–2021 ve 2025 değerleri üç ile taşındı (171 değer). Örnek: Ankara istihdam oranı 2025 = %49,3.
    - **Kaba ölüm hızı ve beş yaş altı ölüm hızı.** 2010–2023'te üç ilde eksikti, Düzey 2'den alındı (84 değer).
    - **Bölgeler.** Düzey 1 İstanbul (TR1) bölgesinde 1.514, TR10/TR31/TR51'de 30 değer il verisinden tamamlandı.

    Sıfır değerler taşınmadı. İstanbul'un Düzey 1 satırında köy yolu, tütün, şeker pancarı gibi göstergelerde 0 var; il verisinde bu satırlar hiç yok, 0'ın "veri yok" anlamında olması muhtemel.

11. **OECD Bölgesel Refah verisinde Türkiye'nin iş göstergeleri.** OECD'nin istihdam ve işsizlik oranları TÜİK ile tutmuyor; 2022–2025 yıllarının hiçbirinde örtüşme yok. Örnekler:
    - Referans yılı 2024 olan Türkiye ortalaması OECD'de %70,9 istihdam ve %12,1 işsizlik; TÜİK'te %49,5 ve %8,7.
    - Bölgelerde istihdam oranı %23 (TRC2) ile %77 (TR21) arasında dağılıyor; TÜİK'te bu aralık %40–55.

    Değerler kaynağında böyle. Karar (Eylül 2026): bu iki göstergede TÜİK esas alınır. Yapılanlar:
    - "İstihdam Oranı (OECD)" ve "İşsizlik Oranı (OECD)" siteden ve veri.db'den çıkarıldı (`ad-eslemesi.csv` içinde `gosterge` = `-`).
    - `oecd-refah.json` ve veri.db `oecd_refah` tablosunda Türkiye ile Düzey 2 bölgelerinin istihdam/işsizlik değerleri TÜİK HİA 2024 (15+ yaş) değerleriyle değiştirildi; OECD'nin bu değerlerden türettiği "İş" puanı Türkiye için boş.
    - Benzer bölge hesabında "İş" konusu dışarıda.
    - Ayrıntılı karşılaştırma: `incelemeler/oecd-tuik-kiyas.xlsx`.

    Sitede "Bölgesel Refah (OECD)" kategorisindeki "İstihdam Oranı (OECD)" ve "İşsizlik Oranı (OECD)" göstergeleri de aynı değerleri gösteriyor. OECD'ye bildirilmesi ve bu iki göstergenin sitede gizlenmesi önerilir.

12. **OECD ile TÜİK'in aynı konudaki göstergeleri (Eylül 2026).** İlke: TÜİK esas kaynaktır. Nüfusa oranlanan göstergelerde paydada TÜİK'in aynı yılın 31 Aralık nüfusu kullanılır; OECD iki yıl sonu nüfusunun ortalamasını (yıl ortası) kullanıyor, hemşire ve ölüm nedeni oranlarında fark %0,5–0,8. Sınıflandırma: `incelemeler/oecd-gosterge-ayiklama.xlsx`.
    - Çıkarılan (TÜİK'te aynısı var): doğuşta beklenen yaşam süresi kadın/erkek (OECD), kişi başına belediye atığı (OECD), bölgeler arası hareketlilik oranları (OECD), istihdamda tarım payı (OECD).
    - Çıkarılan (OECD içinde tekrar, Refah dosyası kopyaları): doğuşta beklenen yaşam süresi, ölüm oranı, seçime katılım, cinayet oranı. Uluslararası kıyas için `oecd-refah.json` içinde kalıyorlar.
    - TÜİK sayıları ve TÜİK yıl sonu nüfusuyla yeniden hesaplanan (`pipeline/turetilmis/tuik_oranlar.py` → `veri-ekleri/turetilmis-tuik-oranlar.csv`; OECD sürümleri çıkarıldı): bin kişiye hemşire, dolaşım ve solunum sistemi hastalıklarından ölüm hızı, çocuk-kadın oranı, kişi başına GSYH (SGP; yalnız çevrim oranı OECD'den), Ar-Ge harcamasının GSYH'ye oranı (toplam; sektör kırılımı OECD'de kalıyor). Düzey 1 değerleri il toplamlarından.
    - Hikâyeler: "Bölgesel Refah" bölümündeki yaşam süresi adımı TÜİK il verisine, "Sağlık" bölümündeki dolaşım sistemi haritası TÜİK tabanlı orana geçti.
    - TÜİK'ten alınan (28 Eylül 2026): il bazında GSKD, iktisadi faaliyet kollarına (A10) göre, cari fiyatlarla, 2000–2024 (`veri-ekleri/tuik-il-gskd-a10.csv`, bkz. `VERI-EKLEME.md`, "Sekizinci ek"). OECD'nin 11 "Reel Katma Değerde Sektör Payı (OECD)" göstergesi çıkarıldı.
    - Yakıt türüne göre taşıt: TÜİK Veri Portalı'nda yalnız Türkiye düzeyinde var (`DF_MOTORLU_KARA_TASIT_YAKIT_TURU_V3`, `DF_MOTORLU_KARA_TASIT_YAKIT_CINSI_V4`); il kırılımı yayımlanmıyor. OECD'nin elektrikli ve hibrit taşıt göstergeleri "(OECD)" adıyla kalıyor.
    - Eğitim düzeyi (25–64 ve 25–34 yaş, OECD; 28 Eylül 2026): OECD'nin Düzey 2 değerleri TÜİK Hanehalkı İşgücü Anketi'nden geliyor; TÜİK bu yaş kırılımını yalnız Türkiye düzeyinde yayımlıyor (Veri Portalı: DF_YUKSEKOGRETIM_MEZUN_ORAN, DF_MEZUN_NUFUS_ORAN, DF_E_YOYAS; il düzeyindeki ADNKS eğitim tablosu yalnız 6+ ve 15+ yaş). "Yıllık ve Bölgesel İşgücü İstatistikleri"ndeki eğitim tablosu da yalnız Türkiye, 15+ yaş, işgücü ve istihdam. Karar: dört gösterge kalıyor, kaynak yazısı "OECD Regional, Metropolitan and Local Statistics (kaynak veri: TÜİK Hanehalkı İşgücü Anketi)". Eşleme dosyasının `not` sütunu "kaynak: …" ile başlıyorsa dönüştürücü (`oecd_sdmx.py`) o yazıyı kullanır.
    - Okullaşma (28 Eylül 2026): TÜİK'in il düzeyindeki okullaşma oranları MEB'in Örgün Eğitim kitaplarından geliyor (2024/25'te 82/82 birebir). MEB'in okul öncesi (3-5, 4-5, 5 yaş) ve yaşa göre net okullaşma tabloları eklendi (`VERI-EKLEME.md`, "Dokuzuncu ek"); OECD'nin 3-5 ve 15-19 yaş okullaşma göstergeleri çıkarıldı, 20-29 yaş kalıyor. Ortaöğretimdeki 2024/25 düşüşü (2007 doğumluların ortaöğretimi bir yıl önce bitirmesi) Veri Gezgini'nde not olarak açıklandı.
    - Elektrik üretimi (28 Eylül 2026): OECD'nin 7 göstergesi (toplam, yenilenebilir/güneş/rüzgâr/hidro/doğal gaz payı, karbon yoğunluğu) çıkarıldı. Düzey 2'de yalnız 2019 vardı ve bölge dağılımı EPDK ile tutmuyordu (26 bölgenin 9'unda fark %10'un altında; Gaziantep-Adıyaman-Kilis'te OECD EPDK'nın 7,7 katı). Türkiye toplamı EPDK lisanslı üretim + lisanssız sisteme verilen enerjiyle %0,1 içinde aynı; bu toplam yeni gösterge olarak eklendi (`pipeline/turetilmis/elektrik_toplam.py` → `veri-ekleri/turetilmis-elektrik.csv`, 2016–2024). Kaynak türüne göre il/bölge üretimi şimdilik yok.
    - Tanımı farklı göstergeler grubu tamamlandı. Yalnız OECD'de olanlar "(OECD)" adıyla kalıyor.
    - Atık su (28 Eylül 2026): Eski site verisindeki 2022 bölge değerleri yanlıştı (ör. TRA2 %92, doğrusu %15,15); TÜİK Veri Portalı'nın 2020–2024 il verisiyle düzeltildi, bölgeler belediye nüfusu ağırlığıyla hesaplandı, 2024 eklendi (`VERI-EKLEME.md`, "Onuncu ek"). OECD'nin ikincil arıtma göstergesi TÜİK'ten türetilmiş ama yalnız biyolojik/ileri arıtmayı sayıyor; notla birlikte kalıyor.

13. **Araçların veri dosyaları ile veritabanı (28 Eylül 2026).** Araçlar menüsünden erişilen bütün veri dosyaları (`dist/data`) veritabanıyla karşılaştırıldı (adlar boşluk ve birleştirmelere göre eşlendi):

    | Dosya | Aynı | Farklı (düzeltme) | Veritabanında yok |
    |---|---|---|---|
    | `illerveri.csv.gz` | 301.242 | 269 | 81 (Ortalama Eğitim Süresi 2024, silinmişti → TÜİK'ten yeniden alındı) |
    | `duzey1veri.csv.gz` | 49.471 | 673 | 64 (temizlikte aralık dışı) |
    | `duzey2veri.csv.gz` | 110.486 | 167 | 92 + 18 (ilkokul net okullaşma D2 2019 karışık; temizlik) |
    | `trveriler.csv.gz` | 465.569 | 1.110 | 173 + 82 |
    | `infografik.csv.gz` | 203.002 | 906 | 127 + 81 |
    | `ilcetr.csv.gz` | 411.566 | 4.515 | 469 (hepsi eski dosyada boş) |
    | SKA (`surdurulebilir`, `illerska`, `nuts2ska`, `7bolgeska`) | — | — | Tamamı yoktu → "Sürdürülebilir Kalkınma" kategorisi (`VERI-EKLEME.md`, "On ikinci ek") |

    - "Farklı" değerlerin hepsi belgelenmiş düzeltmeler: nüfus artış hızında işaret, Düzey 1 toplamları (sanayi sitesi, tarımsal elektrik, hat uzunluğu), su/atık su 2022 bölge değerleri, GSYH.
    - "Veritabanında yok" değerlerin hepsi bilerek silinmiş hatalı değerler (`duzeltmeler/degerler.csv`) ya da temizlikte ayıklanan aralık dışı bölge değerleri; tek istisna Ortalama Eğitim Süresi 2024 (TÜİK'ten yeniden alındı).
    - İlçe "Köy Nüfusu": eski dosyada 2013–2022 değerleri 2023 etiketiyle duruyordu, veritabanına yalnız 2023 girmişti. Kurtarıldı (`VERI-EKLEME.md`, "On üçüncü ek").
    - "İniş Kalkış Yapan Uçak Sayısı" ve "Hava Yoluyla Taşınan Yolcu Sayısı" veritabanında birleştirilmiş adlarla var (`gosterge-birlestirme.csv`).
    - `infografik.csv.gz` içinde SEGE 1968/1996'da Giresun ve Bitlis için çift satır var (kaynak hatası; veritabanında tek değer).
    - Veritabanında olmayan, araçlara özel dosyalar: `destekv2.csv` ve `projeler.csv` (Destekler, Projeler sayfaları), `hazir.json` ve `nesne-sablonlar.json` (infografik şablonları), `data.zip` (ilçe sınırları; veritabanı zaten bundan üretiliyor). Bunlar yerinde duruyor.
    - Araçlar menüsü yeniden düzenlendi: Harita Oluşturma (`harita.html`), Grafik Oluşturma (`grafik.html`), İnfografik Oluşturma. Harita ve grafik araçları veriyi doğrudan veritabanından (`public/veri`) okur; eski tek düzeyli sayfalar (ilharita, nuts1, nuts2, ilceharita, trgrafik, ilcegrafik) ve SKA sayfaları sitede duruyor ama menüde yok. İnfografik aracı kendi dosyasını okur; bu dosya artık veritabanından üretiliyor.

## Kontrol edilip hata olmadığı görülenler

- **Nüfus artış hızı.** Nüfus serisinden hesaplanan hızla karşılaştırıldı. İl ve bölge düzeyinde sapma yok; işaret hataları önceki ekte giderilmişti. İlçelerde 85 sapma var; bunlar sınır değişikliklerinden kaynaklanıyor.
- **1963–1991 SEGE sıralamaları.** Tarihî kalkınma sıralamaları. O yıllarda 67 il olduğu için veri 67 il için var.
- **1995–2000 arasında 79–80 il.** O dönemde Düzce, Osmaniye, Kilis ve Karabük gibi iller henüz kurulmamıştı.
- **İhracatın ithalatı karşılama oranında %100'ün çok üstündeki değerler.** İthalatı çok küçük olan bölgelerde bu matematiksel olarak doğru.
- **Harcanabilir gelir (OECD).** 2021'de kişi başına 19.603 TL, SGP ile 6.372 $. Kaynakla tutarlı; OECD'nin Türkiye rakamı hane anketine dayanıyor, bu yüzden millî hesaplardan düşük.

## Açık kalanlar

- **OECD TL2 ve TL3 değerleri farklı.** İstanbul'da standartlaştırılmış ölüm hızı gibi göstergelerde OECD iki düzeyi ayrı ayrı yayımlıyor ve değerler birbirini tutmuyor. Olduğu gibi bırakıldı.
- **Yoksulluk sınırı, 2023.** İki kaynak 26 bölgede farklı; muhtemelen revizyon. Mevcut seri korundu. TÜİK'in son yayınıyla karşılaştırılması gerekiyor.
- **"Yıllık TÜFE Değişim Oranı (2003=100)".** Aralık–Aralık serisiyle aynı değil. Adı hangi hesaplama yöntemini kullandığını söylemiyor; kaynaktan doğrulanması gerekiyor.
- **Eski sayfalar (13 sayfa).** Chart.js, d3, tom-select gibi kütüphaneleri CDN'den ve çoğu zaman sürüm belirtmeden yüklüyor (`chart.js`, `chart.js@4`). Bir kütüphanenin yeni sürümü bu sayfaları bozabilir. Bu ortamdan CDN'ye erişilemediği için sayfalar çalışırken denenemedi; yalnızca bağlantılar ve veri dosyası yolları kontrol edildi, kırık bağlantı yok.
