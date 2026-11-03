# OECD FUA, şehir ve yerel alan verileri: veritabanına uygunluk

Kapsam: VizStudio'daki `oecd_turkiye_veri/turkiye/*.csv` dosyaları (OECD Regional, Metropolitan and Local Statistics; SDMX çıktısı), `city.csv`, `fua.csv`, sınır dosyaları ve `cities_2026_TUR.gpkg`. İnceleme tarihi Eylül 2026.

## Kısa cevap

Şema uygun: `entities / indicators / values_long` hiçbir değişiklik gerektirmeden bu verileri taşır. Farklılık coğrafi birimlerde. Veri dört gruba ayrılıyor ve her biri başka bir iş gerektiriyor:

| Grup | Coğrafi birim / kod | Bizim yapıda karşılığı | Uyum | Gereken iş |
|---|---|---|---|---|
| **REG** (`DSD_REG_*`, 45 dosya) | TL2 = `TR10`, TL3 = `TR100` | Düzey 2 / il, **kodlar birebir aynı** | ✅ Doğrudan | Sadece ad eşleme. Bu dosyalarda TL3 57/81, TL2 19/26 bölge var, yani indirme eksik görünüyor; önce tam indirilmeli |
| **LA** (`DSD_LA_*_DDOWN`, 17 dosya) | Yerel alan = ilçe, `TUR1101` + ad | İlçe (`ILCE####`) | ✅ Eşlemeyle | Ad + Düzey 2 ile 758 ilçenin 755'i otomatik eşleşiyor ("X Merkez" → il adı, parantezli ekler atılıyor). Kalan 3 yazım farkı (19 Mayıs, Emirgazi, Yakakent) ve 4 çift eşleşme için küçük bir sabit tablo yeterli |
| **FUA / CITY** (`DSD_FUA_*`, 25 dosya) | 26 FUA `TR001F` + 26 şehir `TR001C` | **Yok**: yeni düzey | ⚠ Yeni düzey | `entities` tablosuna `fua` ve `city` düzeyleri eklenir. Sınırlar hazır (`turkiye_fua_sinirlari.geojson`, `turkiye_sehir_sinirlari.geojson`, 26'şar). FUA'lar il sınırlarını aşabildiği için il/Düzey 2 ile toplanmaz, kendi haritasında gösterilir |
| **city.csv / fua.csv** | Aynı 26 + 26 birim | FUA / şehir | ⚠ Kesit veri | Türkiye için şehirde 198, FUA'da 210 dolu değişken; çoğu tek yıllık. Zaman serileri (`*_TS`, JSON) açılabilir. Seçerek alınmalı |

## Dikkat: iki farklı şehir tanımı

- **Veri** (FUA/CITY dosyaları, `city.csv`): OECD–AB'nin **eski tanımı**, 26 şehir, kodlar `TR001C`.
- **`cities_2026_TUR.gpkg`** ve Konsolide'deki "FUA Sınırları" sayfası: **2026 tanımı**, 112 şehir, kodlar `TUR001C`, `fuacode` boş.

Kodlar ve sınırlar farklı olduğu için **2026 katmanı bugünkü veriye bağlanamaz**. OECD veriyi yeni tanımla yayımlayana kadar harita için 26'lık eski sınırlar kullanılmalı. 112 şehrin il ve Düzey 2 eşlemesi (Konsolide'de hazır) ileride işe yarayacak.

## Çok boyutlu veri: seçim yapmak gerekiyor

FUA dosyalarının çoğunda ölçüye ek boyutlar var: yaş, cinsiyet, iklim senaryosu (SSP), dönüş periyodu (taşkın), kirletici türü, ulaşım süresi. Veritabanında her boyut kombinasyonu ayrı bir gösterge olur. Hepsi alınırsa birkaç yüz gösterge çıkar, ki bu bir siteyi okunmaz hâle getirir. Önerilen ilk set (yaklaşık 20 gösterge):

- **Nüfus ve yapı:** Toplam nüfus (FUA/şehir), yaşlı bağımlılık oranı, nüfus yoğunluğu
- **Ekonomi:** GSYH'nin ulusal paydaki yüzdesi (FUA, 20 FUA), istihdam ve işsizlik oranı (FUA)
- **Çevre ve iklim:** PM2.5 yoğunluğu, kentsel ısı adası, yeşil alan, sıcak gün sayısı, kuraklık, taşkına maruz nüfus (100 yıllık)
- **Erişim ve dijital:** Sabit ve mobil internet hızı, 15 dakikada hizmete erişim

## Önerilen sıra

1. **REG:** Tam indirme alındıktan sonra doğrudan `veri-ekleri/` klasörüne eklenir. Tek iş SDMX dönüştürücüsü ve ad eşlemesi. Kişi başına GSYH ($) sitedekinin aynısı (medyan fark %0,1) olduğu için alınmaz; asıl değerli olan PPP bazlı GSYH ve cinsiyete göre yaşam süresi.
2. **FUA / şehir:** Veri hattına `fua` ve `city` düzeyleri ile geometrisi eklenir, ana sayfanın düzey seçicisine "Kentler (OECD)" gelir. Yukarıdaki seçilmiş setle başlanır.
3. **LA (ilçe):** İlçe haritası yeni yapıya taşındığında (geçiş planında Adım 5) eklenir.

---

## Uygulama (Eylül 2026)

### 1. REG verisindeki eksiklik bulundu: indirme betiği

`download_oecd_turkiye_4.R` Türkiye satırlarını `grepl("^TR[0-9]", kodlar)` ile süzüyordu. Bu kalıp harfle devam eden kodları dışarıda bırakıyor:

- **7 Düzey 2 bölgesi**: TRA1, TRA2, TRB1, TRB2, TRC1, TRC2, TRC3
- **24 il**: Doğu ve Güneydoğu Anadolu
- **Bu bölgelerdeki yaklaşık 215 ilçe** (yerel alan dosyalarında)

57/81 ve 19/26 kapsamının nedeni bu. FUA dosyaları etkilenmedi, çünkü FUA kodları rakamla devam ediyor (TR001F).

**Düzeltme:** `VizStudio/download_oecd_turkiye_5.R`. Kalıp `^TR[0-9A-C]` oldu ve `overwrite_existing = TRUE` yapıldı, böylece eksik dosyaların üzerine yazılır. v4 dosyasına dokunulmadı.

**Yapılacak:** v5 betiğini R'da çalıştır, ardından:

```
python pipeline/donusturuculer/oecd_sdmx.py "<VizStudio>/oecd_turkiye_veri/turkiye" --esleme pipeline/donusturuculer/eslemeler/oecd-kentler.csv --cikti veri-ekleri/oecd-kentler.csv
npm run veri
```

REG göstergeleri (PPP bazlı GSYH, kadın/erkek yaşam süresi) eşlemede hazır bekliyor. Dönüştürücü, 81 il ve 26 bölgenin tamamı gelene kadar bunları bilerek yazmıyor (kapsam koruması).

### 2. FUA ve şehir aynı çıktı: yalnızca FUA düzeyi kullanıldı

Türkiye için OECD'nin FUA ve şehir sınırları **birebir aynı**. Bunu üç kaynak gösteriyor: OECD'nin resmi `fuas.shp` ve `cities.shp` dosyaları ile VizStudio'daki geojson'lar. Veriler de aynı: 14 göstergenin tamamında FUA ile şehir değeri eşit. Türkiye'de banliyö (işe gidip gelme) kuşağı tanımlanmadığı için FUA ile kent çekirdeği örtüşüyor.

İki düzey göstermek aynı haritayı iki kez göstermek olacağı için sitede tek düzey var: **"Kentler (OECD)"**, 26 kent.

`turkiye_sehir_sinirlari.geojson` dosyası da aslında FUA sınırlarını içeriyor. Bunda bir hata yok, çünkü kaynakta ikisi zaten aynı.

### 3. Eklenen 20 gösterge (`eslemeler/oecd-kentler.csv`)

| Konu | Göstergeler |
|---|---|
| Nüfus | Kent nüfusu, nüfus yoğunluğu, yaşlı bağımlılık oranı |
| Ekonomi ve işgücü* | GSYH'nin ulusal paydaki payı, kişi başına GSYH (SGP), işsizlik oranı, istihdam oranı (15-64) |
| İklim | Sıcak gün, tropikal gece, güçlü ısı stresi günleri, toprak nemi anomalisi, 100 yıllık nehir ve kıyı taşkınına maruz nüfus |
| Çevre | Kentsel ısı adası (yaz geceleri), kişi başına yeşil alan, kişi başına sera gazı emisyonu, yapılaşmış alan payı |
| Erişim | Sabit ve mobil internet indirme hızı (Türkiye=100), 15 dakikada hizmete erişen nüfus |

\* OECD bu dört göstergeyi 26 kentin 20'si için yayımlıyor. Edirne, Kars, Kastamonu, Nevşehir, Siirt ve Zonguldak yok; bu kentler haritada gri görünür.

### 4. Alınmayan: PM2.5 maruziyeti

OECD kirlilik verisinde iki sorun var:

- 2023 değerleri diğer yılların yaklaşık 1/500'ü.
- Diğer yıllar da kuşkulu derecede yüksek: İstanbul için 85 µg/m³, oysa ölçüm istasyonları genellikle bunun üçte biri civarını gösteriyor.

Kaynakta doğrulanana kadar alınmadı. Eşleme dosyasında gerekçesiyle birlikte duruyor, istenirse tek satırla açılır. Dönüştürücüye bu tür bozuk yılları yakalayan genel bir kontrol eklendi: bir yılın medyanı diğer yıllardan 50 kattan fazla saparsa o yıl atılıyor ve raporlanıyor.

### 5. Sitede

- Ana sayfada yeni **"Kentler (OECD)"** bölümü var ve düzey seçicisine **Kentler (OECD)** eklendi. Bu bölüme gelindiğinde düzey kendiliğinden kentlere geçiyor; kentlerin verisi olmayan kategorilerde bu seçenek kapalı.
- Kent haritası gri il zemini üzerine çiziliyor. Böylece kentlerin Türkiye'deki yeri görünüyor ve kent dışı alanlar veri eksikliği gibi okunmuyor.
