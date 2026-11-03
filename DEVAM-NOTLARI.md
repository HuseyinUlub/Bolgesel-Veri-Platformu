# Devam notları (27 Eylül 2026 akşamı; 29 Eylül, 3, 8, 15 ve 16–17 Ekim ekleri aşağıda)

## 21 Ekim 2026: TÜİK SDMX erişimi çalışıyor, akış taraması
- API anahtarı `tuik-api-key.txt` (git ve yayın dışında). Ağ izni: `giris.tuik.gov.tr` (belirteç) ve `nsiws.tuik.gov.tr` (veri).
- Veri sorgusu: `/rest/data/TR,{akış},{sürüm}` + `Accept: application/vnd.sdmx.data+csv;version=1.0.0` (CSV; `?format=` parametresi yok sayılıyor).
  `availableconstraint` ve `codelist/all` desteklenmiyor (500/422). Ara sıra SSL kopması: `tuik_sdmx.getir` 4 kez yeniden dener.
- `tools/guncelle/tuik_tara.py`: 508 akışın hepsini indirir (önbellek `build/guncelleme/tuik/ham/*.csv.gz`, ≈50 MB, ≈1 saat), `kapsam.csv` yazar.
  Coğrafi boyut her akışta REF_AREA değil (ADNKS'de `IKAMET_YERI`, `DOGUM_YERI_IL`, `NUFUS_KAYIT_IL`): en çok İBBS kodu taşıyan sütun seçilir.
- Sonuç: 469 akış veri döndürdü; 97 akış il düzeyinde (66'sının son yılı 2025, 7'sinin 2026), Düzey 2'de 21, Düzey 1'de 23.
  Ölüm, intihar ve uluslararası göç akışları (39) `NoRecordsFound` döndürüyor (API'de boş).
- Pilot karşılaştırma: ADNKS il nüfusu 2024 değerleri veritabanıyla 81 ilde birebir aynı. İl toplam doğurganlık hızı API'de 2025'e kadar, veritabanında 2024'te bitiyor.
- Sıradaki iş: `tools/guncelle/eslemeler/tuik.csv` (akış + boyut süzgeci + platform gösterge adı + çarpan) ve guncelle.py'ye TÜİK adımı.

## 20 Ekim 2026: otomatik veri güncelleme (API) — erişim testi
- claude.ai'de ağ izni verildi; bu oturumdan test sonuçları:
  - Dünya Bankası Data360: `https://data360api.worldbank.org/data360/data?DATABASE_ID=WB_MPO&INDICATOR=NYGDPFCST&REF_AREA=TUR` çalışıyor
    (gösterge kodu veri seti öneki OLMADAN yazılır; sayfa başına 1000 satır, `skip` ile sayfalama; birden çok tahmin sürümü dönebilir).
    Gösterge listesi: `/data360/indicators?datasetId=WB_MPO`. Eski API (`api.worldbank.org/v2/...`) da çalışıyor.
  - OECD SDMX: `https://sdmx.oecd.org/public/rest/dataflow/OECD.CFE.EDS` ile bölgesel veri akışları (DSD_REG_*, DSD_FUA_*) listelendi;
    `.../data/OECD.CFE.EDS,DSD_REG_SOC@DF_SAFETY,/all?startPeriod=2022&format=csvfilewithlabels` indirildi. Türkiye TL2/TL3 kasten
    öldürme oranları veritabanıyla 324/324 birebir aynı (denetim için kullanılabilir).
  - TÜİK: veriportali.tuik.gov.tr erişilebilir; portalın arama API'si `/api/tr/data/search` (POST, "X-Requested-With: XMLHttpRequest"
    başlığı gerekli) JSON döndürüyor. Portal verileri TÜİK'in SDMX web servisinden okuyor: `https://nsiws.tuik.gov.tr/rest/dataflow/TR/all/latest`
    — izin verildi; servis 401 döndürüyor: TÜİK SDMX API'si kimlik doğrulama istiyor. Resmî rehber portalın içinde gömülü,
    `docs/TUIK-SDMX-API-REHBERI.md` olarak kaydedildi. Özet: Veri Portalı'nda kullanıcı hesabı + "Kullanıcı Bilgileri"nde SMS ile telefon
    doğrulaması → API Anahtarı; token: POST https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token
    (grant_type=password, client_id=nsi-ws-consumer, api_key=…); çağrılar "Authorization: Bearer {token}" ile. Veri:
    `https://nsiws.tuik.gov.tr/rest/data/TR,{DF_KODU},{sürüm}/{seri anahtarı}?startPeriod=&endPeriod=`; liste: `/rest/dataflow/TR/all/latest`.
    API anahtarını kullanıcı kendisi üretecek ve sohbete yazmadan bilgisayarındaki proje klasöründe bir dosyada (ör. `.tuik-api-key`,
    yayına girmeyecek) tutacak; betikler anahtarı oradan okuyacak.
- Kuruldu (20 Ekim): `tools/guncelle/` — `guncelle.py` (OECD indir+dönüştür+karşılaştır+denetle → `build/guncelleme/rapor-*.md`,
  `--uygula` ile veri-ekleri'ne yazar ve veri hattını çalıştırır), `oecd_indir.py`, `denetim.py`, `tuik_sdmx.py` (anahtar bekliyor).
  Belgeler: `docs/VERI-GUNCELLEME.md`. İlk rapor: OECD bölgesel veriler günceldir (yeni yıl/revizyon yok); OECD 15 kent (FUA) akışında
  Türkiye verisini şu an sunmuyor (mevcut değerler korunuyor); Dünya Bankası ile nüfus, GSYH ve ihracat Türkiye toplamları uyumlu.
  Denetimde öne çıkanlar: Bitkisel Üretim Değeri 1995 ve İniş-Kalkış Yapan Uçak 2010 ölçek şüphesi; Hayvansal Ürünler Değeri 2011 il
  toplamı Türkiye'nin %37'si; Tiyatro seyirci gibi seyrek serilerde çok sayıda sıçrama.
  Ayrıca `pipeline/donusturuculer/eslemeler/oecd-bolgesel.csv` dosyasındaki çift BOM düzeltildi (dönüştürücü okuyamıyordu).
- Plan: kaynak başına güncelleme betiği (OECD, Dünya Bankası, TÜİK SDMX, BDDK) → `veri-ekleri` CSV → `pipeline/build_data.py` →
  denetim raporu (yeni yıllar, revizyonlar, il↔Düzey 2↔TR toplam tutarlılığı, yıllık sıçramalar, birim hataları, TÜİK–OECD karşılaştırması) → onay → yayın.

## 16–17 Ekim 2026: yorum düzeltmeleri, TÜİK tema başlıkları, İlişki'de Düzey 2
- Eşitsizlik anlatısı: ilk iki grafikten Düzey 2 çizgisi kaldırıldı (yalnız il serisi); grafik başlıkları title case.
- SEGE kaynak satırından "Tolan (1972)" kaldırıldı (Veri ve Yöntem notunda duruyor). Analiz Masası'nda "Kümeler" görünümü kaldırıldı
  (Moran I / sıcak-soğuk küme kartı duruyor).
- Üst başlıklar TÜİK "İstatistiksel Temalar" sırasıyla 18 tema (Adalet ve Seçim hariç; verisi yok): `src/lib/basliklar.js`.
  Eşleştirme notları: İnşaat ve Konut → Kısa Dönemli Ekonomik Göstergeler; Sanayi → Yapısal Ekonomik Göstergeler ve İş Demografisi;
  SEGE, SKA, OECD refah ve kentler → Çok Boyutlu İstatistikler. Eski üst başlık kimlikleri `ESKI_UST` ile yönlendiriliyor.
- Yeni tema başlıklı gösterge seçici `src/lib/gosterge-secici.js` (+ `src/styles/gosterge-secici.css`): solda temalar, sağda alt başlık
  ve katlanabilir konu grupları, Türkçe karakterden bağımsız arama, klavye ve mobil. Analiz Masası Gösterge ve İlişki eksenlerinde.
  Katalog süzgeci/kartları ve Harita/Grafik araçlarının kategori listeleri (optgroup) aynı temalarla.
- İlişki sekmesi il (81) / Düzey 2 (26) düzey seçimi. `tools/analiz/analiz_verisi.py` her göstergeye `d2` alanı ekliyor; yalnız Düzey 2'de
  yayımlanan 32 gösterge (istihdam, işsizlik, işgücüne katılma ve kadın/yaş kırılımları, yoksulluk oranı, Ar-Ge/GSYH, sektör istihdam payları,
  iş kazası oranları vb.) eklendi → 170 gösterge (il 138, Düzey 2 135). Yalnız Düzey 2 göstergesi seçilince ekran Düzey 2'ye geçer.
  Bulgu metinleri anlamlılık testine (Fisher z, %5) bağlandı; Düzey 2'de 0,39 eşiği ve ekolojik yanılgı notu. D2 renkleri: bölgedeki illerin
  çoğunun coğrafi bölgesi; kentsel–kırsal renklendirme Düzey 2'de kapalı.
- Artifact sürüm 82; e2e 79/79.
- Bekleyen: Yer sekmesinde Düzey 2 ("bir bölgenin bütün göstergeleri"), 2–3 il karşılaştırma, "kendi endeksini kur", iyi yön etiketlerinin gözden geçirilmesi.

## 15 Ekim 2026 (gece): Veri Gezgini kaldırıldı, işlevleri taşındı
- Analiz Masası / Gösterge sekmesi artık manifestteki 2.445 göstergenin tamamını kapsıyor: Düzey seçici (il, Düzey 2,
  Düzey 1, Kent (OECD) il zeminiyle, Türkiye zaman serisi), haritanın altında "Bölgelere göre / Sıralama" görünümü, kaynak
  satırı (OECD/Platform etiketi, gösterge ve kategori notları), haritada tıklayınca bölge radarı (`src/lib/radar.js`),
  adres parametreleri (?gosterge=&duzey=&yil=&gorunum=; eski ?kategori= de okunur). Kümelenme il ve Düzey 2'de.
  İlişki ve Yer sekmeleri 138 analiz göstergesiyle (◆) çalışmaya devam ediyor.
- "Bölgesel Eşitsizlik" anlatısı (6 adım, `src/pages/esitsizlik.js`, metinler resmî dile çevrildi) ana sayfada
  "Avrupa'nın 291 Bölgesi"nin devamı olarak: `src/lib/esitsizlik-sahne.js`, bölüm `#tr-esitsizlik`.
- `gezgin.html` artık yönlendirme sayfası (eski bağlantılar Analiz Masası'nda aynı göstergeyle açılır); eski sayfa
  `arsiv/gezgin.html`. Katalog "Haritada aç", ana sayfa sonu geçişi, Hakkında kartları Analiz Masası'na bağlandı.
- Henüz silinmeyenler (bir süre sonra kaldırılabilir): `src/pages/explorer.js`, `src/styles/gezgin.css`, `explorer.css`.
- Artifact sürüm 75; e2e 73/73 (Gezgin testleri Analiz Masası'na uyarlandı).

## 15 Ekim 2026 (akşam): Analiz Masası sitede
- Veri Gezgini'nin işlevi tartışıldı (Katalog ve Araçlar ile örtüşüyor). Karar: "analiz masası" yaklaşımı.
- Yeni sayfa `analiz.html` (menüde Veri Gezgini'nin yerinde; Gezgin sayfası duruyor, katalog bağlantıları ve
  Düzey 1/2/ilçe için kullanılıyor). Üç sekme:
  Gösterge (il haritası: düzey / değişim / kümeler; özet+Gini, Moran I ve LISA kümeleri, bölge ve kentsel–kırsal farkı,
  iller arası farkın seyri; değişimde yakınsama ve sıra değişimi), İlişki (dağılım grafiği; sade ve resmî dilde
  değerlendirme, katsayılar yalnızca "Teknik ayrıntı" satırında; ayrışan iller; birlikte değişen göstergeler),
  Yer (bir ilin bütün göstergeleri, 5 yıllık sıra değişimi, güçlü/zayıf yanlar, benzer iller).
- Kapsam kuralı (kullanıcı onayı): 81 ili kapsayan, 2008 sonrası en az 5 yıllık serisi olan oran/hız/pay/kişi başı/endeks
  göstergeleri; mutlak sayılar ve mükerrerler hariç → 138 gösterge. "İyi yön" addan kurallarla atanıyor (gözden geçirilmeli).
- Kod: `tools/analiz/analiz_verisi.py` → `public/veri/analiz.json`; `src/pages/analiz.js`, `src/styles/analiz.css`
  (.analiz altında). Yeni bağımlılık: d3-format. Prototip: `prototip/analiz-masasi.html` (artifact 3QbgZD7CfAanEfWiC2segf).
- Bekleyen: Yer sekmesinde 2–3 il karşılaştırma, "kendi endeksini kur"; bulgu kartları ileride geliştirilecek.
- Artifact sürüm 74; e2e 100/100.

## 15 Ekim 2026: uluslararası karşılaştırma tek sahnede ve vitrin göstergeleri
- Ana sayfadaki 17 grafiklik uluslararası karşılaştırma yerine "Avrupa'nın 291 Bölgesi Arasında Türkiye" geldi:
  aynı 291 Düzey 2 noktası 8 adımda yeniden dizilir (nokta haritası → gelir sürüsü → ülke içi fark → yakınsama →
  gelir × yaşlı bağımlılığı → yaş × nüfus değişimi → gelir × kadın istihdamı → gelir ikizleri). Okur bir Türkiye bölgesi
  seçer, bütün adımlarda halkayla izlenir; kart cümleleri veriden hesaplanır. Haritada KKTC sınırı (Natural Earth 1:10m)
  ayrıca çizilir; CY00 noktası "GKRY" adıyla adanın güneyinde.
- Kod: `tools/uluslararasi/avrupa_sahne_verisi.py` → `public/veri/avrupa-sahne.json` (girdi giris.json + avrupa-nuts2 +
  `tools/uluslararasi/geo/kibris-km.json`); `src/lib/avrupa-sahne.js`, `src/styles/avrupa-sahne.css`.
  Eski anlatıya dönmek için `src/site.config.js` → `karsilastirma: 'adimlar'`. Yeni bağımlılıklar: d3-array, d3-ease.
- Ayrı prototip: `prototip/avrupa-sahne.html` (artifact WY84oYU4YmMzuQ3Wp8dCsc). Kullanıcı: "geliştirmeye açık",
  sonra ufak düzeltmeler gelecek. Kapsam dışı kalanlar (ROPI/fiyat farkı, büyüme ayrıştırması, atık) ileride
  düğme ya da Veri Gezgini'ne taşıma olarak eklenebilir.
- Vitrin 05 (100 kişi): hane tipi, sektör, kayıt dışı istihdam (SKA 8.3.1, cinsiyetli), göreli yoksulluk eklendi;
  iki ana başlık (Nüfus ve Toplum / İşgücü ve Gelir).
- Vitrin 07 (balon sürüsü): 6 → 20 eksen, 4 ana başlık (Ekonomi ve üretim, Nüfus ve aile, Eğitim ve sağlık, Yaşam ve çevre).
- Artifact sürüm 73; e2e 90/90.

## 8 Ekim 2026: veri düzeni (yorum e3910442)
- Başlıklarda kaynak parantez içinde ("Toplam Nüfus (TÜİK)"); `pipeline/kaynak_turu.py` → `gorunen()`, manifestte `kaynakKisa`.
- 66 mükerrer gösterge siteden gizlendi (veritabanında duruyor): `veri-ekleri/yayinlanmayacak.csv`. OECD göstergelerinin hiçbiri TÜİK verisinin kopyası değil.
- 7 üst başlık: Nüfus ve Toplum · Ekonomi ve Üretim · Emek ve Eğitim · Yaşam Koşulları · Altyapı ve Çevre · Endeksler ve Uluslararası · Sürdürülebilir Kalkınma (17 amaç). Tanım tek yerde: `src/lib/basliklar.js` (listede olmayan kategori "Diğer"e düşer).
- Veri Gezgini: bölümler artık üst başlık; her bölümde kategori düğmeleri (SKA'da amaç düğmeleri). Eski "Diğer" bölümü kalktı.
- Yeni sayfa `katalog.html` (Veri Kataloğu): bütün göstergeler üst başlık → kategori → konu; arama, üst başlık/düzey/kaynak/güncellik süzgeçleri (adres çubuğunda paylaşılabilir), "Haritada aç" ve CSV indirme (; ayraçlı, virgüllü ondalık, Excel uyumlu).
- Artifact sürüm 54; e2e 80/80. Bilgisayara yazılacak dosyalar `sync_katalog` altında hazır (cihaz bağlı değildi).

## 3 Ekim 2026: ana sayfa vitrini (ara verildi)
- Ana sayfanın açılışı yeniden yazıldı ("Bir ülke, 81 il, 81 ayrı hikâye") ve uluslararası karşılaştırmadan önce yedi
  etkileşimli gösterimlik bir vitrin eklendi (Information is Beautiful örneklerinden esinlenildi):
  01 Türkiye'nin pastası (ölçü değiştirilebilir ağaç haritası) · 02 Her il bir şeyde öne çıkıyor (karo harita + ikonlar) ·
  03 SEGE 1963–2025 sıralama çizgileri · 04 İliniz nerede? (12 gösterge, benzer iller) · 05 Türkiye 100 kişi olsaydı ·
  06 Zaman çizelgesi 2000–2025 (veriden bulunan dönüm noktaları) · 07 81 il balon sürüsü.
- Kod: `tools/vitrin/vitrin_verisi.py` → `public/veri/vitrin.json`; `src/lib/vitrin.js`, `src/styles/vitrin.css`,
  `src/pages/giris.js` içinde `vitrin()`. Ayrıntılar `VERI-EKLEME.md` "Ana sayfa vitrini" bölümünde.
- Yeni bağımlılıklar: d3-hierarchy, d3-force (yerelde derlemek için bir kez `npm install`).
- Artifact sürüm 49; e2e 72/72.
- Bekleyen öneri: ana sayfadaki 17 adımlık uluslararası karşılaştırma grafiklerini vitrinle aynı görsel dile
  (palet, ikonlar, büyük rakamlar) taşımak. (15 Ekim'de tek sahneli anlatıyla çözüldü.)
- Diğer bekleyenler: çalışan başına katma değer (büyüklük grubu) dosyasından hangi alt kümenin ekleneceği;
  yerelde `veriolustur.bat` yeniden çalıştırılmalı (ilçe SEGE 1966/1981, köy/belediye 2025, Türkiye payları).

## Bugün yapılanlar (27 Eylül)
- OECD–TÜİK karşılaştırma raporu: `incelemeler/oecd-tuik-kiyas.xlsx`.
- OECD Refah dosyasındaki istihdam/işsizlik oranları siteden çıkarıldı; TÜİK esas (DENETIM madde 11).
- İllerin OECD tipolojisi (kentsel–kırsal, kente erişim) çıkarıldı: `veri-ekleri/oecd-tipoloji/`, `incelemeler/il-tipolojisi.xlsx`, veri.db `il_tipolojisi`.
- Site gözden geçirmesi (yorumlarla): ana sayfa başlık ve giriş metni, Hakkında menüsü en sağda, 12 maddelik liste kaldırıldı, giriş şeridi Growth Lab tarzı Voronoi kolaj (`tools/giris-kolaji/`).
- Hakkında: politika ve yönetişim bölümleri kaldırıldı; "Kent ve Kır Tanımları" (DEGURBA + FUA haritası) eklendi.
- Destatis Türkiye profili ile karşılaştırma yapıldı (sohbette raporlandı).
- BTK genişbant oranlarının Düzey 1 değerleri eklendi: `veri-ekleri/btk-duzey1-turetilmis.csv`.

## 29 Eylül 2026: OECD tipolojisi resmî kaynağa geçti ve radarda
- Kaynak artık OECD "Territorial correspondence table – TL2024" (3 Eylül 2026): `tools/oecd-tipoloji/donustur.py`. Önceki çıkarım 81 ilde de aynıydı. Yeni: ara illerin kente yakın/uzak ayrımı, 11 metropol ilin OECD metropol bölgesi kodu.
- Veri Gezgini'nde bir ile tıklayınca açılan Bölge radarında "OECD sınıfı" bölümü: ilin sınıfı, sınıf içindeki sırası; kente erişim / kentsel–kırsal sınıflarına göre 81 ilin nokta şeridi ve sınıf ortancaları (`src/lib/radar.js`, `tipolojiBolumu`).
- Kullanıcı: tipoloji ileride çeşitli kıyaslama ve gösterimlerde kullanılacak (ör. Veri Gezgini'nde tipolojiye göre filtre, sınıf ortalamaları, Hakkında'da tipoloji haritası).

## Çalışma düzeni
- Kullanıcının bilgisayarında Node yok: site `siteyi-ac.py` (antivirüs .bat'ı engelliyor) ile `dist/` klasöründen açılıyor. Her değişiklikten sonra derlenmiş `dist` dosyaları da bilgisayara yazılmalı; kullanıcı Ctrl+F5 ile görür.
- Ortak CSS ya da `site.config.js` değişince ya da yeni sayfa eklenince bütün sayfaların JS özetleri (hash) değişebilir: yayına ve bilgisayara bütün başvurulan varlıklar gönderilmeli (bir yazma çağrısı en çok 50 dosya).
- Gözden geçirme kopyası claude.ai'de özel bir artifact olarak yayında; yorumlar "Send to Claude" ile gönderilirse cevaplanıp kapatılabiliyor.

## Açık konular
- Enflasyon: Türkiye düzeyi TÜFE serileri 2021'de bitiyor, yeni baz yılıyla güncellenmeli.
- İnternet kullanım oranı (TÜİK Hanehalkı Bilişim) platformda yok; eklenebilir.
- Doğuşta beklenen yaşam süresinde 2024 yılı eksik.
- İlçe sınırları (`veri/geo/district.json`) metre cinsinden düzlem koordinatında; ileride ilçe haritası eklenirse dönüştürülmeli.
- Eski araç sayfaları (.gz veri kullananlar) gözden geçirme kopyasında çalışmıyor; yerel sitede sorun yok.
- Pasta ölçüleri için açık öneri (yorum 697b202b): kurulu güç, sanayi elektrik tüketimi, OSB parsel, PCT patent, yabancı turist.
- Olası sonraki işler: bölge refah profili, tipolojiye göre filtre ve kıyaslamalar.
