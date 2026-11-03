# Siteye veri eklemek

Tüm ekler `veri-ekleri/` klasöründen geçer. Sayfa koduna dokunmak gerekmez.

```
Excel / VizStudio .db  →  veri-ekleri/*.csv  →  npm run veri  →  build/rapor.md kontrolü  →  npm run build
```

## 1. Şablon

Noktalı virgülle ayrılmış, UTF-8 bir CSV (örnek dosya: `veri-ekleri/_sablon.csv`):

| sütun | açıklama |
|---|---|
| `kod` | `TR`, Düzey 1 `TR1`, Düzey 2 `TR10`, il `TR100`, ilçe `ILCE1757` |
| `gosterge` | Sitede görünecek ad. Birim sona parantezle yazılır: `Fiber Optik Kablo Uzunluğu (km)` |
| `kategori` | Mevcut bir kategori adı (Nüfus, Eğitim, Haberleşme…). Yeni bir ad yazılırsa yeni kategori açılır |
| `yil` | 4 haneli yıl |
| `deger` | `15,5` ya da `15.5`. **Binlik ayırıcı kullanılmaz** (`1.234.567` reddedilir) |
| `kaynak` | Kurum adı. Grafiğin üstünde "Kaynak:" olarak görünür |
| `oncelik` | (isteğe bağlı) `ek` ya da `mevcut`. Aynı bölge-yıl sitede zaten varsa hangisinin kalacağı |
| `yayin` | (isteğe bağlı) `hayir` yazılırsa gösterge **yalnızca `veri.db`'ye** girer, sitede listelenmez. Yaş×cinsiyet, ay, "bilinmeyen" gibi ayrıntılı kırılımlar için |

Büyük dosyalar `.csv.gz` olarak da konabilir (örn. `tuik-bolgesel.csv.gz`, 1,6 milyon satır, 10 MB).

Adı `_` ile başlayan dosyalar okunmaz; taslakları böyle adlandırabilirsin.

## 2. Excel'den şablona

Excel'in düzeni `YIL | BÖLGE KODU | BÖLGE ADI | gösterge sütunları…` ise:

```bash
python pipeline/donusturuculer/genis_excel.py "BTK Verileri_Düzey2-3.xlsx" ^
  --kategori Haberleşme --kaynak "Bilgi Teknolojileri ve İletişim Kurumu" ^
  --carpan "Sabit Genişbant Abone / Toplam Nüfus (%)=100" ^
  --cikti veri-ekleri/btk-haberlesme.csv
```

- `--ad-degistir "Excel'deki ad=Sitedeki ad"`: Excel'deki ad sitedekinden farklıysa kullanılır. Aksi hâlde aynı gösterge ikinci bir adla eklenir.
- `--carpan "ad=100"`: oran olarak girilmiş yüzdeleri düzeltir.

Başka bir Excel düzeni (başlıkları birleştirilmiş TÜİK tabloları gibi) için `donusturuculer/` klasörüne yeni bir dönüştürücü yazılır. Çıktısı yine aynı şablon olur.

### TÜİK Bölgesel İstatistikler (çok sayfalı, İngilizce başlıklı Excel)

VizStudio `istatistikler/Turkiye_Istatistikleri_Birlesik.xlsx` (22 tema sayfası, 1.121 sütun) için ayrı dönüştürücü:

```bash
python pipeline/donusturuculer/tuik_bolgesel.py Turkiye_Istatistikleri_Birlesik.xlsx ^
  --esleme pipeline/donusturuculer/eslemeler/tuik-bolgesel.csv --cikti veri-ekleri/tuik-bolgesel.csv.gz
```

Eşleme dosyası (`sayfa;sutun;gosterge;kategori;oncelik;yayin;not`) her sütun için kararı ve nedenini tutar. TÜİK dosyayı güncelleyip yeni sütun eklerse dönüştürücü bunları `build/tuik-eslenmemis.csv` dosyasına yazar. Türkçe adlar `eslemeler/tuik_ceviri.py` ile üretildi (bir kez); sonrasında eşleme dosyası elle düzeltilebilir.

Dönüştürücünün kendi korumaları:
- **Ondalık kaybı:** kaynakta `452,2` gibi değerlerin virgülü düşüp `4522002022204` olarak geldiği hücreler var. Bir bölgenin serisinde diğer yıllarının medyanının 1000 katını aşan (ve ≥100.000) değer atılır. İlk çalıştırmada 771 değer yakalandı: 2024 kütüphane yararlanma oranı (tüm bölgeler), 2018–2023 yüz bin kişiye yatak sayısı (tüm bölgeler), 2015 müze ziyaretçisi (6 bölge), birkaç finans ve köy yolu değeri.
- **Aynı başlık iki kez:** Kaynakta 3 başlık birden fazla sütunda geçiyor. İkinci ve üçüncü kopyalar `başlık #2` olarak ayrılır; hangisinin doğru olduğu belirsiz olduğu için alınmadı (ayrıntı eşleme dosyasının `not` sütununda).

## 3. VizStudio veritabanından

`gostergeler3.db` dosyasını `veri-ekleri/` klasörüne kopyala ve `npm run veri` çalıştır. İlk çalıştırmada hiçbir gösterge alınmaz. Bunun yerine `build/eslenmemis-gostergeler.csv` dosyası yazılır. Almak istediğin satırlarda `gosterge` ve `kategori` sütunlarını doldur, bu satırları `veri-ekleri/ad-eslemesi.csv` dosyasına taşı ve komutu tekrar çalıştır.

`oncelik` sütunu isteğe bağlıdır (`ek` ya da `mevcut`) ve o gösterge için genel önceliği ezer. Örneğin fark yalnızca yuvarlamadan kaynaklanıyorsa `mevcut` yazılır: sitedeki değerler korunur, yalnızca eksik yıllar eklenir.

Bir göstergeyi bilerek dışarıda bırakmak için `gosterge` sütununa `-` yaz. Gösterge alınmaz ve eşlenmemiş listesinde de görünmez. Örnek: OECD Refah dosyasındaki istihdam ve işsizlik oranları (TÜİK ile tutmadığı için; bkz. DENETIM madde 11).

Bu adımın amacı, TÜİK'in uzun adlarıyla gelen göstergelerin (`… : Genel toplam`) sitede mevcut göstergelerin kopyası olarak görünmesini önlemek. Türkiye dışı (OECD uluslararası) kayıtlar otomatik olarak atlanır.

## 4. Veri hattının yaptığı kontroller (`build/rapor.md` → "Veri ekleri")

| Kontrol | Sonuç |
|---|---|
| Aynı bölge-yıl-gösterge mevcut veride farklı | ⚠ Her fark listelenir. **Ek kazanır**; `python pipeline/build_data.py --oncelik mevcut` ile tersine çevrilir |
| Tanınmayan bölge kodu, sayıya çevrilemeyen değer, geçersiz yıl | ⚠ Satır atlanır, örneklerle raporlanır |
| Mevcut göstergeye farklı kategori verilmiş | ⚠ Mevcut kategori korunur |
| `(%)` göstergede tüm değerler ≤ 1 | ⚠ "Oran olarak girilmiş olabilir" |
| Yeni kategori | ⚠ Ana sayfada görünmesi için `src/site.config.js` ve `public/img/<slug>.png` gerekir |
| Toplanabilir yeni göstergede il toplamı ≠ Türkiye | ⚠ (oran, ortalama ve "başına" türü göstergeler bu kontrole girmez; yalnızca Türkiye/Düzey 1 değeri olanlar sayılır, uyarı verilmez; "Bin" birimlilerde 13'e kadar yuvarlama farkı kabul edilir) |

## 5. Düzeltmeler ve otomatik temizlik (`pipeline/temizlik.py`)

Bütün kaynaklar birleştirildikten sonra, veri.db yazılmadan önce çalışır. Yaptığı her değişiklik `build/temizlik.csv` dosyasına satır satır yazılır; özeti `build/rapor.md` → "Temizlik" bölümündedir.

**Elle düzeltmeler** (`veri-ekleri/duzeltmeler/`, noktalı virgülle ayrılmış):

- `gosterge-birlestirme.csv` — `eski;yeni;gerekce`. Aynı göstergenin iki adını birleştirir. Çakışmada `yeni` adın değeri korunur.
- `degerler.csv` — `kod;gosterge;yil;deger;gerekce`. Tek bir değeri düzeltir. `deger` boş bırakılırsa değer silinir.

**Otomatik kurallar:**

1. **Tek illi bölgeler.** TR1, TR10 ve TR100 (İstanbul), TR31 ve TR310 (İzmir), TR51 ve TR510 (Ankara) aynı alanı kapsar, bu yüzden değerleri aynı olmalıdır. Farklıysa il değeri esas alınır.
   Bir düzeyde olup ötekinde olmayan yıllar karşı düzeye taşınır. Örneğin TÜİK Düzey 2 işgücü verisini il verisinden önce yayımlıyor; Ankara'nın 2025 istihdam oranı TR51'den TR510'a alınır. İstanbul için önce Düzey 2 (TR10), yoksa Düzey 1 (TR1) kullanılır. Şunlar taşınmaz:
   - OECD göstergeleri,
   - sıralama ve kademe göstergeleri (bölge sıralaması il sıralamasıyla aynı şey değildir),
   - sıfır değerler (bazı kaynaklarda bölge satırındaki 0 "veri yok" anlamında),
   - karşı düzeyde hiç bulunmayan göstergeler (ör. yalnız Düzey 2'de yayımlanan cinsiyete göre işgücü).

   Bu yüzden il düzeyinde yalnızca bu üç ilin değeri olan yıllar oluşabilir. Site bu yılları haritada göstermez: bir yıl, göstergenin o düzeydeki en kapsamlı yılının en az yarısı kadar birimde değer varsa haritada seçilebilir (`kapsamliYillar`, `src/lib/data.js`). Değerler şehrin zaman serisinde ve veri tabanında durur.
2. **Toplanabilir göstergeler.** Bir göstergede Düzey 2 değeri, en az %95 oranında il toplamına eşitse gösterge toplanabilir sayılır. Tutmayan Düzey 2 ve Düzey 1 değerleri il toplamıyla değiştirilir. Türkiye değeri yalnızca Türkiye = 81 il toplamı en az %80 tutuyorsa değiştirilir.
3. **Oran ve ortalamalar.** Bölge değeri, alt birimlerinin en küçük ve en büyük değeri arasında olmalıdır. Kural yalnızca alt birimlerin tamamının verisi varken uygulanır. Aralığın dışındaki değer silinir.

OECD göstergelerine 1–3 uygulanmaz, çünkü OECD TL2 ve TL3 değerlerini ayrı ayrı tahmin ediyor. Değişim, artış, endeks, sıralama ve göç göstergelerine de 2–3 uygulanmaz.

## İlk ek: BTK Haberleşme (Eylül 2026)

| | |
|---|---|
| Dosya | `veri-ekleri/btk-haberlesme.csv`, kaynağı `VizStudio/BTK Verileri_Düzey2-3.xlsx` |
| Mevcut 8 gösterge | 12.425 değer **birebir aynı**, fark yok |
| Yeni 2 gösterge | `Sabit Genişbant Abone / Toplam Nüfus (%)`, `100.000 Kişiye Düşen Sabit Genişbant Abone Sayısı`: 3.026 değer (TR, Düzey 2, il; 2010–2024) |
| Excel'deki hata | `(%)` sütunu yüzde değil, oran olarak girilmiş: Türkiye 2024 için 0,239 (doğrusu %23,9). Abone sayısı / nüfus ile doğrulandı ve `--carpan …=100` ile düzeltildi |
| Düzey 1 | Excel'de yok; `veri-ekleri/btk-duzey1-turetilmis.csv` içinde Düzey 1 sabit genişbant abone sayısı ÷ aynı yılın nüfusu ile hesaplandı (336 değer, 2011–2024). Yöntem Excel'deki Düzey 2 ve il değerlerini birebir veriyor. BTK dosyası güncellenince bu dosya da yeniden hesaplanmalı |

## İkinci ek: VizStudio `gostergeler3.db` (Eylül 2026)

Dosya: `veri-ekleri/vizstudio-gostergeler3.db`. Eşleme: `veri-ekleri/ad-eslemesi.csv` (50 göstergeden 48'i). VizStudio'da veritabanı güncellenirse dosyayı yeniden kopyalamak yeterli.

Her gösterge sitedeki verilerle değer değer karşılaştırıldı:

| Sonuç | Göstergeler |
|---|---|
| **29.851 değer birebir aynı** | 32 TÜİK göstergesi zaten sitede vardı. Uzun adları sitedeki kısa adlara eşlendi, böylece kopya gösterge oluşmadı |
| **Mevcut 26 göstergeye eski yıllar eklendi** (+11.000'den fazla değer) | Örneğin Kişi Başına GSYH artık 2000'den, altyapı ve atık göstergeleri 1998'den, tarım alanı 1995'ten, işgücü göstergeleri (Düzey 2) 2004'ten başlıyor. Gini 2025 de eklendi |
| **Yeni 3 TÜİK göstergesi** | Yıllık TÜFE Değişim Oranı (Düzey 2, 2005–2021) · Önlisans ve Lisans Mezun Sayısı (il, 2000–2024) · Girişim Sayısı (İş Kayıtlarına Göre) |
| **Yeni 13 OECD göstergesi**, yeni kategori "Bölgesel Refah (OECD)" | Yalnızca Düzey 2. Adlarında "(OECD)" var, TÜİK'teki benzerleriyle karışmasın diye |
| Alınmayan 2 gösterge | "Kullanılabilir Kişi Başı Gelir" ve "Genişbant İnternet Erişimi": veritabanında Türkiye bölgeleri için değer yok |

### Farklı çıkan değerler ve verilen kararlar

| Gösterge | Fark | Karar |
|---|---|---|
| **Gini Katsayısı 2023** (26 bölge) | Sitedeki değerler yanlış. Örneğin İstanbul (TR10) sitede 0,446, doğrusu 0,425; Türkiye sitede 0,433, doğrusu 0,420. Üçüncü bir kaynak, `istatistikler/Gini_Regional_2014-2025.xlsx` (TÜİK), 25 bölgenin 25'inde VizStudio ile aynı, sitenin 2023 satırıyla ise hiçbir bölgede aynı değil. Diğer yıllarda üç kaynak birebir tutuyor | **Ek geçerli** (`oncelik=ek`) |
| **Yoksulluk Oranı 2023** (25 bölge) | Aynı durum: sadece 2023'te fark var (örn. TR10: sitede 21,8, VizStudio'da 18,3). Aynı TÜİK bülteninden geldiği için Gini ile aynı karar verildi | **Ek geçerli**. Bir kez TÜİK tablosundan kontrol edilmesi önerilir |
| Hastane yatak (649), kütüphane (108), elektrik tüketimi (27) | Yalnızca yuvarlama: sitede 283, VizStudio'da 282,81 | **Mevcut korundu**, sadece eksik yıllar eklendi |
| Toplam Girişim Sayısı | Her yıl yaklaşık %3 fark var; aynı gösterge değil, tanımları farklı | Birleştirilmedi. Ayrı gösterge olarak eklendi: "Girişim Sayısı (İş Kayıtlarına Göre)" |

### Veri hattında düzeltilen bir hata

Gösterim ondalığı en fazla 2 basamakla sınırlıydı ve web dosyası da bu basamağa yuvarlanıyordu. Bu yüzden Gini sitede 0,425 yerine 0,42 görünüyordu. Artık:

- Tüm değerleri 1'den küçük olan göstergeler 3 basamakla gösteriliyor.
- Web dosyasına değerler her zaman 4 basamakla yazılıyor, veri kaybı olmuyor.

### Dikkat edilecek iki nokta

- **İşgücü serisinde yöntem kırılması:** Bu göstergeler (2004–2025) artık 2014'teki TÜİK yöntem değişikliğinin iki tarafını da içeriyor. Grafiklerde uzun dönem karşılaştırma yapılırken not düşülmeli.
- **OECD değerlerinin yılı:** OECD göstergeleri "2024" olarak kaydedildi. Bu, OECD Regional Well-Being dosyasının sürüm yılı. Göstergelerin ölçüm yılları farklı olabilir (bazıları birkaç yılın ortalaması).

## Üçüncü ek: `Konsolide.xlsx` (Eylül 2026)

| | |
|---|---|
| Dönüştürme | `python pipeline/donusturuculer/genis_excel.py "Konsolide.xlsx" --sayfa Konsolide --esleme pipeline/donusturuculer/eslemeler/konsolide.csv --cikti veri-ekleri/konsolide.csv` |
| Eşleme | `eslemeler/konsolide.csv` (65 sütun). Her sütunun sitedeki adı, kategorisi, çarpanı, önceliği ve kararın gerekçesi (`not` sütunu) bu dosyada |
| Sonuç | 57.732 değer birebir aynı · **27.350 yeni değer** · 10 yeni gösterge · 437 farklı değer (kararlar aşağıda) |
| Alınmayan | "Bölgesel Satınalma Gücü Paritesi" (aynı endeksin 100'e bölünmüş hâli) ve "Fiyat düzeyi endeksleri" (aynı endeksin kopyası). Diğer sayfalar (DEGURBA, FUA sınırları, düzey referansı) gösterge değil; OECD değerlendirmesinde kullanıldı |

**Seriler geriye uzadı:** Elektrik tüketimi (toplam, mesken, sanayi, aydınlatma) ve kişi başına GSYH (TL) artık 2000'den başlıyor. Nüfus yapısı göstergelerine 2007–2009, işgücü göstergelerine (Düzey 2) 2004–2008 eklendi.

**Yeni göstergeler:** 0-14, 15-64 ve 65+ yaş grubu nüfusları (il; toplamları Türkiye ile birebir tutuyor) · SEGE endeks değeri (il; 2003, 2011, 2017 ve 2025 çalışmaları) · SEGE kademesine 2003 ve 2011 · GSYH ve GSKD zincirlenmiş hacim (2009=100) · Aralık ayı yıllık TÜFE · Türkiye GSYH büyümesi (cari fiyatlarla).

### Önemli bulgu: nüfus artış hızında kaybolan eksi işaretleri

Yayındaki sitede "Yıllık Nüfus Artış Hızı (Binde)" göstergesinde **288 değerin eksi işareti kaybolmuş**. Nüfusu azalan yerler, artmış gibi görünüyor. Örneğin İstanbul 2023'te sitede +15,97, doğrusu −15,97.

Doğrulama: artış hızı iki yılın nüfusundan yeniden hesaplandı (binde, logaritmik). Farklı çıkan 288 değerin 286'sında hesap Konsolide ile tutuyor, sitedeki değerle yalnızca 2'sinde. Konsolide değerleri kullanıldı (`oncelik=ek`). Eski sitede hata hâlâ duruyor (`data/infografik.csv.gz`).

### Diğer kararlar

| Konu | Karar |
|---|---|
| "GSYH Yıllık Büyüme Oranı … - Türkiye" (iki sütun) | Excel'de ulusal değer 26 bölgenin ve 81 ilin satırına kopyalanmış. Bölge verisi gibi haritaya düşmesin diye yalnızca TR satırı alındı (`yalniz_turkiye=evet`) |
| GSYH büyümesi 2024 (Türkiye) | Sitede 3,3, Excel'de 3,5. Hangisinin güncel TÜİK revizyonu olduğu doğrulanamadığı için site değeri korundu. **Kontrol edilmeli** |
| Aldığı / Verdiği / Net Göç (yalnızca TR satırı) | Excel'deki Türkiye toplamı Düzey 2 tablosundan (bölgeler arası göç), sitedeki il tablosundan (iller arası göç). Tanım farkı var; site korundu |
| Kişi başına elektrik tüketimi (39 değer) | Yalnızca yuvarlama farkı; site korundu |
| Sabit genişbant / nüfus | Excel'de yine oran olarak girilmiş (0,24); ×100 ile düzeltildi |
| Zincirlenmiş hacim serileri | Zincirleme yöntemi gereği il toplamı Türkiye değerine eşit değil. Bu bir hata değil; toplam kontrolünden muaf tutuldu |

## Dördüncü ek: TÜİK Bölgesel İstatistikler, `Turkiye_Istatistikleri_Birlesik.xlsx` (Eylül 2026)

1.121 sütun, değerle karşılaştırılarak sınıflandırıldı. Her sütun için mevcut veritabanındaki tüm göstergelere aynı bölge-yıl değerleriyle bakıldı:

| Sonuç | Sütun | Ne yapıldı |
|---|---|---|
| Sitede zaten var (örtüşen değerlerin ≥%90'ı aynı) | 265 | `oncelik=mevcut`: sitedeki değerler korundu, yalnızca **eksik yıllar** eklendi. 177 göstergenin geçmişi 1995'e kadar uzadı |
| Yeni, sitede | 345 | Türkçe ad, konu başlığı altında gruplanarak (`Konu: kırılım`) listelenir |
| Yeni, yalnızca `veri.db` | 386 | Yaş×cinsiyet, ay, "bilinmeyen", bina alt türü gibi ayrıntılı kırılımlar (`yayin=hayir`) |
| Alınmadı | 127 | Başka sayfadaki kopya (sütun ya da gösterge), belirsiz yinelenen başlık, Gini sayfası (farklı düzen, Gini zaten var) ve **intiharın neden, yöntem ve yaş kırılımları** (hassas; toplamlar ve hız alındı) |

Sonuç: 466 → 1.214 gösterge, 0,96 → 2,24 milyon değer. Sitede 808 gösterge listeleniyor.

Açılır listede "Konu: kırılım" biçimindeki göstergeler artık `<optgroup>` başlıkları altında toplanıyor (örn. Tarım: 8 grup, 81 gösterge).

### Mevcut veride bulunan hata

- **Kültür ve Turizm Bakanlığına Bağlı Müze ve Ören Yeri Ziyaretçi Sayısı, 2015:** sitede Türkiye değeri `2,81229`, TR71 değeri `3,15405e+06`. TÜİK dosyasındaki değer de bozuk (`28.122.933.812`, ondalık kaybı). Doğrusu yaklaşık 28,1 milyon olmalı. Kaynaktan doğrulanıp düzeltilmeli.

## Beşinci ek: OECD bölgesel (TL2/TL3) veri setleri ve türetilmiş eşitsizlik ölçüleri (Eylül 2026)

**OECD (`veri-ekleri/oecd-bolgesel.csv`, eşleme `eslemeler/oecd-bolgesel.csv`):** v7 indirmesinde tamamlanan dosyalardan:
- Yaşa göre standartlaştırılmış ölüm hızı (binde; toplam sitede, kadın/erkek yalnızca veri.db). OECD birimi "bin kişide" yazıyor ama değerler yüz binde (TR 2022: 1048); `carpan 0,01` ile düzeltildi.
- Çocuk-kadın oranı (0-4 yaş çocuk / 15-49 yaş kadın, %).
- Reel katma değerde 11 sektör payı: **yalnızca veri.db**. 2020 sabit fiyatlı (ROPI) değerlerden hesaplandığı için cari paylardan belirgin farklı (TR 2022 sanayi: reel 25,2 / TÜİK cari 34,4). Cari fiyatlı `DF_GVA` OECD'de 500 hatası veriyor.

`oecd_sdmx.py` iki yeni eşleme sütunu aldı: `payda` (örn. `ACTIVITY=_T` → sektörün toplamdaki payı, %) ve `yayin`.

v7 indirmesi 79 hata verdi; ilki `DF_MIGR_FLOW`'da 600 sn zaman aşımı, kalan 78'i "Could not resolve hostname" (internet bağlantısı kopmuş). Betik artık 3 ardışık bağlantı hatasında duruyor ve zaman aşımı 1200 sn. Tekrar çalıştırıldığında tamamlanan dosyaları atlar.

**Türetilmiş eşitsizlik ölçüleri (`pipeline/turetilmis/esitsizlik.py` → `veri-ekleri/turetilmis-esitsizlik.csv`):** OECD *Regions and Cities at a Glance* Tablo 2.2'deki kavramlar TÜİK il ve Düzey 2 kişi başına GSYH (2000–2024) ve nüfustan (2007–) hesaplanır:

| Ölçü | Düzey | Sitede |
|---|---|---|
| Theil endeksi (ağırlıksız), ortalama/medyan | Türkiye (il ve Düzey 2 için ayrı) | Hayır (tek seri; haritada gösterilemez) |
| En üst %20 / ortalama, en alt %20 / ortalama, kutuplaşma (nüfus eşdeğeri %20) | Türkiye | Hayır |
| Theil ayrıştırması: Düzey 1 arası / içi, aradaki farkın payı | Türkiye | Hayır |
| Düzey 1 bölgesinin kendi illeri arasındaki Theil endeksi | Düzey 1 | Evet (Ekonomi) |
| Kişi başına GSYH endeksi (Türkiye=100) | İl, Düzey 2 | Evet (Ekonomi) |

Ayrıştırmanın toplamı betik içinde denetlenir (arası + içi = toplam Theil). Sıra: `python pipeline/turetilmis/esitsizlik.py` → `python pipeline/build_data.py`.

### v7 sonrası (OECD bölgesel, 98 gösterge)

v7: 38 veri seti indi, 16'sı OECD'nin istek sınırına (429) takıldı (iklim riskleri, sera gazı, işgücü oranları, turizm, reel seriler), 7'si Türkiye'yi kapsamıyor, 5'i OECD'de yok/hatalı (404/500). 429 alanlar betik tekrar çalıştırılınca iner.

Eklenenler (`eslemeler/oecd-bolgesel.csv`): kişi başına GSYH (SGP $, il), çalışan başına GSYH, harcanabilir hanehalkı geliri (Düzey 2, 2013–2021), 11 sektörde istihdam payı ve emek verimliliği (Düzey 2), bölgeler arası ve uluslararası göç oranları, solunum/dolaşım ölüm hızları, hemşire, taburcu, eğitim düzeyi (25-64 ve 25-34), NEET, erken ayrılma, okullaşma (OECD), yetişkin eğitimi, Ar-Ge/GSYH ve araştırmacı payı (sektörlere göre), PCT patentleri (toplam, milyon kişiye ve 7 teknoloji), taşıt hırsızlığı, kasten öldürme ve seçime katılım (il), kişi başına oda, konut maliyeti, elektrikli/hibrit taşıt, belediye atığı, ikincil atık su arıtma, iklim (sıcaklık, sıcak gün, tropikal gece, buzlu gün, derece-gün), elektrik üretimi ve kaynak payları, karbon yoğunluğu.

Notlar:
- `SOC` veri setlerinin (`DF_SAFETY`, `DF_VOTER`, `DF_VEH`, `DF_HOUSING`, `DF_BROADBAND`, `DF_INCOME_INEQ`) hepsi OECD'den aynı içerikle geliyor; yalnızca `DF_SAFETY` okunuyor. Türkiye için gelir eşitsizliği ve genişbant ölçüleri yok.
- Dönüştürücü artık önce birebir dosya adını arıyor (`DF_GDP` öneki `DF_GDP_ROPI` dosyasını yakalıyordu).
- Kasten öldürme ve seçime katılım il düzeyinde "Gelir ve Yaşam Koşulları" kategorisinde; "Bölgesel Refah (OECD)" kategorisi Düzey 2'de kalıyor (Regional Well-Being 2024 değerleri korunarak).
- "Gelenler içinde 15-29 yaş payı" alınmadı: OECD verisinde %100'ü aşan değerler var.
- Güneş payında 2013–2014, elektrikli taşıtta 2024 "tutarsız yıl" korumasıyla düştü (güneşte gerçek hızlı artış olabilir).
- Harcanabilir hanehalkı geliri (TR 2021: 6.372 $ SGP) OECD ulusal hesaplardaki değerden düşük görünüyor; kaynak tanımı doğrulanmalı.

## Altıncı ek: OECD Bölgesel Refah, bütün OECD bölgeleri (Eylül 2026)

- **Kaynak dosya:** `veri-ekleri/oecd-refah-bolgeler.xlsx`. oecdregionalwellbeing.org sayfasındaki "Download the data" bağlantısından indirilen `OECD-Regional-Well-Being-Data-File.xlsx`, Kasım 2025 sürümü. Güncellemek için yeni dosyayı aynı adla bu klasöre koyup veri hattını çalıştırmak yeterli.
- **Kapsam:** 41 ülkeden 468 bölge ve 41 ülke ortalaması. İçerik:
  - 11 konuda 0–10 puan
  - 15 göstergenin son yıl değeri
  - konu eğilimleri (+ / − / =)
- **Okuyan kod:** `pipeline/oecd_refah.py`. Yalnızca Python'un standart kütüphanesini kullanır, ek paket gerekmez.
- **Çıktılar:**
  - `veri.db` içinde iki tablo: `oecd_bolgeler` (kod, ülke, ad, tür) ve `oecd_refah` (kod, tür = puan / gosterge / egilim, alan, değer).
  - Site için `public/veri/oecd-refah.json`.
- **Veritabanı yapısı:** Bu bölgeler `entities` ve `values_long` tablolarına eklenmez; haritalar ve Veri Gezgini yalnızca Türkiye birimleriyle çalışmaya devam eder.
- **Benzer bölgeler:** Her Türkiye Düzey 2 bölgesi için başka ülkelerden en benzer 5 bölge önceden hesaplanır. Ölçüt, ortak konulardaki 0–10 puanların ortalama uzaklığıdır. "İş" konusu bu hesaba katılmaz (bkz. `DENETIM.md`, madde 11).

## Yedinci ek: İllerin OECD tipolojisi (Eylül 2026)

OECD illeri (TL3) iki tipolojiyle sınıflandırıyor (kaynak: OECD TL2024 yazışma tablosu, aşağıda). DEGURBA değil; DEGURBA'nın Türkiye karşılığı TÜİK'in Kent-Kır Nüfus İstatistikleri (yoğun kent, orta yoğun kent, kır), o veri zaten sitede.

| Tipoloji | Sınıflar (il sayısı) |
|---|---|
| Kentsel–kırsal | Ağırlıklı kentsel (18), ara (57), ağırlıklı kırsal–kente yakın (3), ağırlıklı kırsal–uzak (3) |
| Kente erişim | Büyük metropol (5), orta ölçekli metropol (6), metropole yakın (12), küçük kente yakın (5), uzak (53) |

Dosyalar: `veri-ekleri/oecd-tipoloji/`

- `il-tipolojisi.csv`: **resmî OECD kaynağından** üretilir: "Territorial correspondence table – TL2024" (oe.cd/geostats,
  3 Eylül 2026 sürümü), `tools/oecd-tipoloji/OECD-Territorial-correspondence-TL2024c.xlsx` →
  `python tools/oecd-tipoloji/donustur.py`. İl başına: kentsel–kırsal sınıfı, ayrıntılı kentsel–kırsal sınıfı (ara iller
  kente yakın 33 / uzak 19; OECD 5 ilde ayırmamış: Balıkesir, Aydın, Denizli, Manisa, Eskişehir), kente erişim sınıfı ve
  OECD metropol bölgesi kodu (11 metropol il: Ankara TR001M, Antalya, Bursa, Denizli, Diyarbakır, Gaziantep, İstanbul
  TR012M, İzmir, Kayseri, Konya, Malatya).
  İlk sürüm (OECD il listesi yokken tipoloji toplamlarından geriye doğru çıkarılan atama) resmî listeyle 81 ilde de aynı
  çıktı. GSYH toplamları testi (`tests/test_il_tipolojisi.py`) sürüyor.
- `eco-rurb-tur.csv`, `eco-metro-tur.csv`, `lab-rurb-tur.csv`: OECD'nin tipolojiye göre Türkiye toplamları (sdmx.oecd.org, DSD_REG_ECO@DF_TYPE_RURB / DF_TYPE_METRO, DSD_REG_LAB@DF_TYPE_RURB). İşgücü dosyasında Türkiye için yalnız nüfus var; istihdam/işsizlik yok.

Veri hattı (`pipeline/il_tipolojisi.py`) veri.db'ye `il_tipolojisi` tablosunu ve `public/veri/il-tipolojisi.json` dosyasını yazar. TÜİK verilerinin tipolojiye göre toplamları: `incelemeler/il-tipolojisi.xlsx`.

## Sekizinci ek: İl bazında GSKD, iktisadi faaliyet kollarına (A10) göre (Eylül 2026)

Kaynak: TÜİK Veri Portalı (veriportali.tuik.gov.tr), Ulusal Hesaplar → Bölgesel Hesaplar → "İl bazında gayrisafi yurt içi hasıla, iktisadi faaliyet kollarına (A10) göre, cari fiyatlarla (değer)", 2000–2024, 81 il ve Türkiye.

Dönüştürücü: `python tools/tuik-a10/donustur.py "<indirilen .xls>"` → `veri-ekleri/tuik-il-gskd-a10.csv` (xlrd gerekir). Düzey 2 ve Düzey 1 değerleri illerin toplamıdır; iller toplamı her yıl Türkiye'ye eşit.

| Gösterge | Not |
|---|---|
| Sektörlere Göre Katma Değer: … (Cari Fiyatlarla) (Bin TL), 11 sektör | Yeni |
| Katma Değerde Sektör Payı: … (Cari Fiyatlarla) (%), 11 sektör | Yeni. Payda sektörler toplamı (GSKD), GSYH değil |
| Tarım / Sanayi / Hizmetler sektörünün ekonomi içindeki payı | Sitede 2020–2024 vardı; 2000–2019 eklendi (`oncelik=mevcut`). Sanayi = sanayi + inşaat, sitedeki tanımla aynı |
| GSKD (Bin TL), GSYH (Bin TL) | Sitede 2010–2024 vardı; 2000–2009 eklendi (`oncelik=mevcut`) |

"Sanayi" (B–E) imalatı (C) içerir; iki pay toplanmaz. Örtüşen yıllarda sitedeki değerlerle fark yok (yalnızca ±1 bin TL yuvarlama). Rapordaki "farklı" satırlar temizlikten önceki ham veriyle kıyastan geliyor (tek illi Düzey 1 bölgelerinde 2017–2018 değerleri ham veride yer değiştirmiş, `temizlik.py` bunları zaten düzeltiyor).

Bu ek, OECD'nin "Reel Katma Değerde Sektör Payı (OECD)" göstergelerinin (2020 fiyatlarıyla, 2013–2024) yerini aldı; OECD sürümleri `veri-ekleri/oecd-bolgesel.csv` ve eşleme dosyasından çıkarıldı.

## Dokuzuncu ek: MEB okul öncesi ve yaşa göre okullaşma oranları (Eylül 2026)

Kaynak: MEB, Millî Eğitim İstatistikleri – Örgün Eğitim kitapları (sgb.meb.gov.tr/istatistik_k), 2009/10–2024/25. Kitaplar `Documents/VizStudio` klasöründen okundu (2006/07–2024/25). 2024/25 kitabının (`2425.pdf`) yazı tipi kodlaması bozuk; metin `tools/meb-okullasma/cidmetin.py` ile çözülür (karakter kodu + 29). O kitabın yaşa göre tablosu satır düzeni yüzünden okunamadığı için tarayıcıda okunan değerler (`meb-2024-25.json`) kullanılır; kitaptan okunan il değerleri tarayıcıdakilerle birebir aynı.

Dönüştürücü: `python tools/meb-okullasma/donustur.py "<PDF klasörü>"` → `veri-ekleri/meb-okullasma.csv` (pdftotext gerekir). Tablolar başlığa göre bulunur; bir öğretim yılı iki kitapta varsa sonraki kitabın (düzeltilmiş) değeri alınır.

| Gösterge | Yıllar | Düzey |
|---|---|---|
| Okul Öncesi Net Okullaşma Oranı (3-5, 4-5, 5 Yaş) (%) | 2009–2024 (5 yaş 2011'den) | İl, Türkiye; Düzey 1–2 2017'den |
| Okul Öncesi Brüt Okullaşma Oranı (3-5, 4-5, 5 Yaş) (%) | 2013–2024 | aynı |
| Yaşa Göre Net Okullaşma Oranı: 3, 4, 5, 3-5, 4-5, 6-9, 10-13, 14-17 Yaş (%) | 2015–2024 | İl, Türkiye |

Notlar:
- Yıl = öğretim yılının başladığı yıl (2024 = 2024/25), TÜİK okullaşma serileriyle aynı kural.
- 2012/13 ve öncesinde kitaplar okul öncesi için tek oran veriyor; dipnota göre bu net orandır.
- Doğrulama: 2024/25 kitabındaki ilkokul, ortaokul ve ortaöğretim net okullaşma oranları 82 satırın 82'sinde TÜİK serisiyle aynı; TÜİK il düzeyindeki okullaşma oranlarını MEB'den alıyor. Türkiye okul öncesi değerleri 2014/15–2023/24 için 2024/25 kitabının geçmiş yıllar tablosuyla aynı.
- Yerini aldığı OECD göstergeleri: "Okullaşma Oranı (OECD): 3-5 Yaş" ve "15-19 Yaş" çıkarıldı. "20-29 Yaş" karşılığı olmadığı için kalıyor.

Gösterge notları: `veri-ekleri/gosterge-notlari.csv` (`gosterge;not`) Veri Gezgini'nde kaynak satırının altında gösterilir. Notta `;` geçiyorsa hücre tırnak içine alınır.

## Onuncu ek: TÜİK belediye su ve atık su göstergeleri, 2020–2024 (Eylül 2026)

Kaynak: TÜİK Veri Portalı, "Şebeke ve Arıtma Tesisi ile Hizmet Verilen Belediye Sayısı ve Nüfusu (İllere göre)" (`DF_SU_ATIKSU_SEBEKE_TESIS_BELEDIYE_NITELIK_V1`), 2020, 2022, 2024. Veri tarayıcıda portal API'sinden alındı: `tools/tuik-su/tuik-belediye-su-2020-2024.json`. Dönüştürücü: `python tools/tuik-su/donustur.py` → `veri-ekleri/tuik-belediye-su.csv` (`oncelik=ek`).

| Gösterge | Not |
|---|---|
| Atık su arıtma tesisi, kanalizasyon, içme suyu şebekesi ve içme suyu arıtma tesisi ile hizmet verilen belediye nüfusu oranları | İl değerleri TÜİK'ten. Düzey 1, Düzey 2 ve Türkiye değerleri illerden belediye nüfusu ağırlığıyla hesaplanır; Türkiye için sonuç TÜİK'in Türkiye değeriyle birebir aynı |
| Kişi başı çekilen günlük su, kişi başı günlük atık su | Yalnız il ve Türkiye (bölge değeri ağırlıkla hesaplanamıyor) |

Neden:
- Eski site verisindeki (`trveriler.csv.gz`) 2022 bölge değerleri yanlıştı: ör. Ağrı-Kars-Iğdır-Ardahan (TRA2) %92, oysa illeri %0, %10, %44, %57; doğrusu %15,15. Türkiye 2022 değeri %77,66.
- Arıtma tesisi olmayan iller eski veride boştu; TÜİK'te %0 (ör. Ağrı).
- 2024 yılı yeni eklendi.
- VizStudio eşlemesinde (`ad-eslemesi.csv`) bu dört oran `oncelik=mevcut` yapıldı; aksi hâlde sonra okunan VizStudio verisi yuvarlanmış eski değerleri geri yazıyordu.

OECD'nin "En Az İkincil Arıtmalı Atık Su Sistemine Bağlı Nüfus" göstergesi aynı TÜİK kaynağından türetiliyor ama yalnız biyolojik ve ileri arıtmayı sayıyor (ör. Şanlıurfa 2022'de iki kaynak da %35,52; İstanbul'da OECD %41, TÜİK %100, çünkü İstanbul'un arıtması büyük ölçüde fiziksel ön arıtma + derin deniz deşarjı). TÜİK bu kırılımı nüfus olarak yayımlamadığı için OECD göstergesi "(OECD)" adıyla kalıyor; iki göstergeye de açıklayıcı not eklendi.

## On birinci ek: Toplam elektrik üretimi (EPDK, türetilmiş) (Eylül 2026)

`python pipeline/turetilmis/elektrik_toplam.py` → `veri-ekleri/turetilmis-elektrik.csv`: "Toplam Elektrik Üretimi (Lisanslı + Lisanssız) (GWh)" = EPDK lisanslı üretim + lisanssız üretimden ihtiyaç fazlası olarak sisteme verilen enerji; il, Düzey 1, Düzey 2, Türkiye, 2016–2024. Türkiye toplamı OECD'nin toplam üretimiyle %0,1 içinde aynı (2019: 304.081 / 303.893 GWh). Veri tabanındaki iki EPDK göstergesi değişirse betik yeniden çalıştırılır (iki geçişli derleme, `tuik_oranlar.py` gibi). Yerini aldığı OECD elektrik üretimi göstergeleri çıkarıldı.


## On ikinci ek: Sürdürülebilir Kalkınma Amaçları (SKA) göstergeleri (Eylül 2026)

Eski araçlardaki SKA dosyaları veritabanına alındı; Veri Gezgini'nde yeni kategori: **Sürdürülebilir Kalkınma** (ana sayfa bölümü, kısa adı "SKA").

`python tools/ska/donustur.py` → `veri-ekleri/ska.csv` (31.986 değer, 998 gösterge; denetim raporu `veri-ekleri/_ska-denetim.txt`).

| Eski dosya | Ne oldu |
|---|---|
| `surdurulebilir.csv.gz` (Türkiye, Düzey 2, il) | Esas kaynak; tamamı alındı |
| `illerska.csv.gz` (il, 30 gösterge) | `surdurulebilir.csv.gz`'nin alt kümesi: 22.984 değerin hepsi birebir aynı |
| `nuts2ska.csv` (Düzey 2) | Alt küme: 312 değerin hepsi aynı (boş satırlar hariç) |
| `7bolgeska.csv` (7 coğrafi bölge, 1 gösterge, 56 değer) | Coğrafi bölgeler İBBS düzeylerine karşılık gelmiyor; son yıl değerleri Türkiye göstergesinin notuna yazıldı, bütün yıllar `veri-ekleri/_ska-cografi-bolgeler.csv` dosyasında |

- Gösterge adı `SKA 03 Sağlıklı ve Kaliteli Yaşam: 3.2.1 Beş yaş altı ölüm hızı (...)`. ": " öncesi Veri Gezgini'nin gösterge listesinde grup başlığı olur (17 amaç). Grafik ve harita başlıklarında "SKA 3 · Amaç adı" alt başlığa taşınır.
- Addaki birim (%, TZE, µg/m3…) sona alınır; addan çıkmıyorsa kaynaktaki "Ölçü birimi" sütunu eklenir.
- Kaynak dosyadaki etiket hataları satır sırasından onarıldı: 8.9.2 turizm istihdamının üç bloğu Toplam/Erkek/Kadın (Erkek + Kadın = Toplam denetlendi); 9.5.2.b'de "Genel devlet" sektörünün Erkek/Kadın satırları; bozuk "?" karakteri "≤" (17.6.1 hız sınıfları); 17.6.1 2024'te yanlış sınıfa yazılmış değer (0,02 + 0,46 + 23,42 = 23,90 ≈ toplam 23,93); 9.5.2.b 2023'te fazladan bir Erkek satırı atlandı (151.219 + 79.315 = 230.534 tutuyor); 4.a.1.a'daki "2013-2024" dönemi yıllara açıldı.
- 998 göstergenin 965'i yalnız Türkiye için yayımlanıyor. Veri Gezgini'ne bu yüzden yeni bir düzey eklendi: **Türkiye (zaman serisi)**. Bu düzeyde harita yerine Türkiye'nin zaman serisi, solda ilk/son yıl ve değişim gösterilir. Düzey bütün kategorilerde çalışır.

## On üçüncü ek: Eski dosyalardan kurtarılan veriler (Eylül 2026)

Araçların eski veri dosyaları veritabanıyla karşılaştırıldı (bkz. `DENETIM.md`, madde 13). Kayıp olarak görünen iki seri kurtarıldı:

- **İlçe köy nüfusu 2013–2022.** `ilcetr.csv.gz` içinde her ilçenin 11 "Köy Nüfusu" satırı vardı ve hepsi 2023 olarak etiketlenmişti; pipeline yalnız sonuncuyu alıyordu. Satırlar sırasıyla 2013…2023; sıraya göre Türkiye toplamları TÜİK'in belde ve köy nüfusu oranlarıyla örtüşüyor (2013 %8,7 → 6,6 milyon … 2022 %6,6 → 5,7 milyon). `python tools/ilce-koy-nufusu/donustur.py` → `veri-ekleri/ilce-koy-nufusu-2013-2022.csv` (973 ilçe × 10 yıl).
- **Ortalama Eğitim Süresi 2011–2025.** 2024 il satırları eski kaynakta karışık olduğu için silinmişti. TÜİK Veri Portalı'ndan (`DF_ORTALAMA_EGITIM_SURE`, 25+ yaş) yeniden alındı: `tools/tuik-egitim-suresi/` → `veri-ekleri/tuik-egitim-suresi.csv` (81 il + Türkiye, 2011–2025). `duzeltmeler/degerler.csv`'deki silme kuralı kaldırıldı. 2011–2023 eski değerlerle aynı (bir yuvarlama farkı hariç).

## İlçe sınırları boylam/enlem (Eylül 2026)

`data.zip/harita.geojson` ilçe sınırları UTM 36K (metre) koordinatlıydı; `pipeline/utm.py` ile boylam/enlem'e çevriliyor (`geo/district.json`). Artık il ve bölge haritalarıyla aynı projeksiyonda çizilebiliyor (Harita Oluşturma'da ilçelerin üzerine il sınırları).

## İnfografik verisi veritabanından (Eylül 2026)

`python tools/infografik-veri/uret.py` → `public/data/infografik.csv.gz`. İnfografik aracı (eski sayfa) aynı dosya biçimini ve aynı 175 gösterge adını okur (hazır şablonlar bu adlara bağlı); değerler artık veritabanından gelir. İlk sürümde: 205.994 değer aynı, 1.133 güncellendi (düzeltmeler), 2.315 yeni (2025 ve eksik yıllar), 127 kaldırıldı (düzeltme ile silinmiş hatalı değerler). Her göstergenin eski dosyadaki ilk yılından önceki yıllar eklenmez. `public/data` derlemede eski sitenin `data/` klasörünün üzerine yazılır. Veritabanı her yeniden üretildiğinde bu betik de çalıştırılmalı.

## Ana sayfa: uluslararası karşılaştırma (Eylül 2026)

Hikâyeler bölümü kaldırıldı; ana sayfa (`index.html` → `src/pages/giris.js`) artık Türkiye'nin bölgelerini
Avrupa ve OECD bölgeleriyle karşılaştıran 17 adımlı kaydırmalı bir anlatı. Sona gelindiğinde dolan çubukla
Veri Gezgini'ne geçilir (yukarı kaydırılırsa iptal; geri tuşuyla dönülünce hemen yeniden yönlendirmez).

- Veri: `tools/uluslararasi/giris_verisi.py` → `public/veri/giris.json`, `public/veri/geo/avrupa-nuts2.json`,
  `public/veri/geo/avrupa-ulkeler.json`. Ham dosyalar `tools/uluslararasi/ham/` altında (Eurostat ve OECD SDMX'ten,
  tarayıcıdan alındı), NUTS 2024 geometrisi `tools/uluslararasi/geo/` (Eurostat Nuts2json, EPSG:3035, 1:20M).
- Görseller: `src/lib/giris-gorsel.js` (Avrupa ve Türkiye haritası, dağılım, dambıl/çubuk, şerit).
- Karşılık gelen rapor şekilleri: Regional Outlook 2023 Şekil 2.7, 2.9, 2.14, 2.15; Regions and Cities at a Glance
  2024 Şekil 1.2, 1.4, 1.23, 1.26, 2.2, 3.20, 3.21. Farklar:
  - Nüfus değişimi 2003–2023 yerine 2008–2025 (Eurostat bölge serisi 2008'de başlıyor).
  - Kadın istihdamı 2019 → 2024 (raporda 2023).
  - Atık geri kazanım payı adımı (Şekil 3.21 karşılığı) kaldırıldı (Ekim 2026, kullanıcı isteği); Türkiye'de bölge verisi yalnızca 2016'ydı.
  - Regions and Cities at a Glance 2026 Şekil 1.3 ve 1.4–1.5 (Ekim 2026): "Büyüme, 2018–2024" bölümünün iki adımı.
    Yalnız Türkiye, TÜİK verisiyle (`buyume_tuik()` → giris.json `buyume`; girdi `build/veri.db`, önce pipeline çalışmalı).
    Reel GSYH = TÜİK zincirlenmiş hacim (OECD'nin ROPI ile bulduğu seriyle aynı); nüfus ADNKS yıl sonu; istihdam HİA 15+
    (Düzey 2). Göreli büyüme = (bölge CAGR − Türkiye CAGR) / bölge CAGR'lerinin standart sapması. Ayrıştırma: kişi başı
    GSYH = verimlilik × emek kullanımı, büyüme logaritmik paylarla bölünür; gruplar 2018–24 ortalama gelire göre nüfusun
    %20'si. Rapordaki Türkiye değerleriyle yakın (alt %20 büyüme 5,3 – rapor ≈5,7; istihdam oranı farkı −8,6 – rapor ≈−9);
    fark OECD'nin yıl ortası nüfus ve eski veri sürümü kullanmasından. Şekil 1.1–1.2 ve ülke karşılaştırması OECD verisi
    gerektirdiği için yapılmadı.
  - Şekil 2.20 (uzaktan çalışanların payı) bölge düzeyinde açık veri olarak yayımlanmadığı için yok.
- Güncelleme: ham dosyaları yenileyip `python tools/uluslararasi/giris_verisi.py` çalıştırın; metinlerdeki sayılar
  veriden hesaplanır.

## Bölgesel fiyat düzeyi endeksleri: 2025 genel endeks, 2008 ve 2024 harcama grupları (Eylül 2026)

TÜİK SDMX dosyaları `tools/tuik-fiyat-duzeyi/` altında; `python tools/tuik-fiyat-duzeyi/donustur.py`
→ `veri-ekleri/tuik-fiyat-duzeyi.csv` (1.716 değer, 26 Düzey 2 bölgesi).
- Genel endeks (TRDF_BOLGESEL_FIYAT_DUZEYI_GENEL): 2008–2025. Veri tabanındaki adı "Bölgesel Satınalma Gücü Paritesi
  (Türkiye=100)". 2008–2024 mevcut veriyle aynı; eski kayıtların bir kısmı tek ondalığa yuvarlanmıştı, artık TÜİK'in
  iki ondalıklı değerleri kullanılıyor. 2025 yeni.
- 12 harcama grubu (TRDF_BOLGESEL_FIYAT_DUZEYI_TUKETIM_ANA_GRUPLAR): 2008, 2012, 2017, 2024. Bizde 11 grup için yalnız
  2012 ve 2017 vardı (572 değer, hepsi aynı); 2008 ve 2024 eklendi. "Haberleşme Grubu Fiyat Düzeyi Endeksi" yeni gösterge.
- TRDF_BOLGESEL_SGP_TUKETIM_ANA_GRUPLAR: aynı endekslerin 100'e bölünmüş hâli; eklenmedi, yalnız tutarlılık denetimi
  için okunuyor (tutarsızlık yok).
- Türkiye satırları (her yıl 100, endeks tabanı) alınmadı.

## TÜFE: Türkiye değerleri 2022–2025, bölge verisinin sona ermesi (Eylül 2026)

TÜİK, İBBS Düzey 2 bölgelerine göre TÜFE'yi Aralık 2021'den sonra yayımlamıyor (Aralık 2021 bülteninde
"İstatistiki bölgelere göre tüketici fiyat endeksi" tablosu var, Aralık 2022'de yok; databrowser2 TÜFE veri setleri
ve Veri Portalı tabloları yalnız Türkiye). Bu yüzden 26 bölgesel TÜFE göstergesi bölge düzeyinde 2021'de biter.
- `tools/tuik-tufe/tuik-tufe-aralik.json`: aralık bültenlerinin ek tablosu (genel TÜFE + 12 ana grup; yıllık değişim
  ve 12 aylık ortalamalara göre değişim), 2021–2025. `python tools/tuik-tufe/donustur.py` →
  `veri-ekleri/tuik-tufe-turkiye.csv` (104 değer, yalnız TR, 2022–2025). 2021 satırı denetim için: 26/26 aynı.
- 26 göstergeye `gosterge-notlari.csv` ile not eklendi (bölge verisinin neden 2021'de bittiği; Türkiye serisinin
  "Türkiye (zaman serisi)" düzeyinde sürdüğü; bölgesel fiyat karşılaştırması için fiyat düzeyi endeksleri).
  Not: notta noktalı virgül olduğu için alan tırnak içinde yazılır.

## SKA: TÜİK yayımlanan gösterge listesi, Şubat 2026 (Eylül 2026)

`tools/ska-2026/yayimlanan-gosterge-listesi-2026-02.xlsx` (Sürdürülebilir Kalkınma Göstergeleri, 2010–2025; 17 sayfa,
3.793 seri). `python tools/ska-2026/donustur.py` → `veri-ekleri/ska_2026.csv`, ayrıntı `tools/ska-2026/_rapor.txt`.
- Seriler veri tabanıyla DEĞERLERİNDEN eşleştirilir (aynı kod, ortak yıllarda bütün değerler tutmalı; il/Düzey 2
  kırılımları o birimin değerleriyle). 3.209 seri eşleşti; bunlara yalnız eksik 78 yıl-değer eklendi.
- Eşleşmeyen Türkiye serileri 432 yeni gösterge (3.146 değer): çoğu yaş grubu, eğitim, gelir dilimi, yerleşim yeri,
  harcama türü, ülke gibi kırılımlar. Adlar mevcut adlandırmayla kurulur (kardeş serinin kodu: 1.3.1.a …).
- 15 göstergede veri tabanındaki değerler ölçek hatalıydı (eski kaynak dosyada ondalık ayırıcı: Gini 0,434 → 434,
  enerji yoğunluğu 2,32 → 2.319, CO2 yoğunluğu, RKY oranları, sıtma 2010/2012) ya da tam sayıya yuvarlanmıştı;
  dosyanın değerleri bunları düzeltir (102 değer). "milyon ton" gibi ölçeği adında yazan göstergeler düzeltilmez.
- İl/bölge kırılımlarının hepsi veri tabanında var (122 seride yalnız yuvarlama/ölçek farkı); eklenmedi.
- Dosya adı `ska_2026.csv`: ek dosyaları ada göre okunur, `_` `ska.csv`'den sonra geldiği için düzeltmeler öne geçer.
- Dönüştürücü veri tabanını okurken `ska_2026.csv` kaynaklı değerleri dışarıda bırakır (yeniden çalıştırılabilir).

## Beşeri Kalkınma Endeksi, iller 2018–2022 (Eylül 2026)

TÜİK "İllere göre beşeri kalkınma endeksi, alt endeksleri ve değişim oranları" (SDMX, DF_BESERI_KALKINMA_ENDEKS):
`tools/tuik-beseri/` → `veri-ekleri/tuik-beseri-kalkinma.csv` (1.640 değer; 81 il ve Türkiye). "Sosyo-Ekonomik
Gelişmişlik" kategorisinde 4 gösterge: Beşeri Kalkınma Endeksi ve eğitim, gelir, yaşam beklentisi alt endeksleri (0–1).
Yıllık değişim oranları veriden türetilebildiği için alınmadı.

Not (ondalık ayırıcı): pipeline "214.702" gibi tam üç ondalıklı noktalı değerleri binlik ayırıcı sanıp reddeder.
Dönüştürücüler değeri ya virgülle ("214,702") ya da dört ondalıkla yazmalı. `ska_2026.csv` bu yüzden virgülle yazılır
(ilk sürümde 45 değer bu nedenle alınmamıştı; düzeltildi).

## TÜİK il refah tabloları: beşeri sermaye, yaşam endeksi, SES, mutluluk (Eylül 2026)

`tools/tuik-il-refah/` altındaki 9 TÜİK xls tablosu (`beseri-sermaye-2021-2023.xls` iki kez yüklenmişti, aynı dosya)
`python tools/tuik-il-refah/donustur.py` → `veri-ekleri/tuik-il-refah.csv` (16.281 değer, 117 gösterge). Hiçbiri
veri tabanında yoktu.
- Sosyo-Ekonomik Gelişmişlik: Beşeri Sermaye Endeksi + hayatta kalma, eğitim, sağlık bileşenleri (il, 2021–2023);
  İllerde Yaşam Endeksi genel + 11 boyut (2015) ve endeksin 41 ham göstergesi ("İllerde Yaşam Endeksi Göstergesi: …");
  SES skoru ve 7 sınıfa göre hanehalkı sayısı (il, 2023); 5 sınıfa göre hanehalkı oranı (il ve 973 ilçe, 2023).
- Gelir ve Yaşam Koşulları (2013, il): mutluluk düzeyi (yaş grubu; medeni durum × cinsiyet), umut düzeyi (cinsiyet),
  olası AB üyeliğinin birey yaşamına etkisi.
- Sıralama ve "önceki yıla göre değişim" sütunları alınmadı. İlçe "Merkez" satırları il adıyla kayıtlı ilçeye eşlenir.
- Medeni durum tablosunda başlık etiketleri bir sütun kaymış; blok düzeni dönüştürücüde sabit yazılıdır
  (Türkiye satırı TÜİK toplamlarıyla denetlendi).

## Tarihî SEGE çalışmaları, 1963–2003 (Eylül 2026)

DPT'nin taranmış SEGE yayınlarından (1969, 1972, 1980, 1985, 1991, 1996, 2003) tablolar sayfa görüntülerinden
okundu: ara dosyalar `tools/sege-tarihi/cikti/<çalışma>.csv` (sayfa no ve okuma güveni ile) ve her çalışmanın
notları `cikti/<çalışma>-notlar.md`. PDF'ler kullanıcının İndirilenler klasöründe; `tools/sege-tarihi/kaynak/`
yalnız bulut çalışma alanında. `python tools/sege-tarihi/donustur.py` → `veri-ekleri/sege-tarihi.csv` (6.073 değer).
- **SEGE Endeks Değeri:** il 1980 (1975 verisi), 1985, 1991, 1996 eklendi (2003–2025 zaten vardı); ilçe 1985 (579/616
  ilçe eşlendi) ve 1996 (814/858). Ölçekler çalışmalar arasında farklı; gösterge notunda yazıyor.
- **Sosyo-Ekonomik Gelişmişlik Endeksi (Türkiye 1963=100):** yeni; Tolan (1972) Tablo C, 67 il + Türkiye, 1963–1970,
  sabit taban (yıllar arası karşılaştırılabilir). 1969 çalışmasının 1963–1967 serisi ve projeksiyonları siteye
  alınmadı (1972'de yeniden hesaplandı).
- **Sıralama:** 1963–1970, 1980, 1985, 1991, 1996 kaynaktan yeniden okundu; ilçe 1985/1996; Düzey 1 ve Düzey 2 2003.
  Eski verideki hatalar düzeldi: 1996'da 10 il sırası karışıktı (ör. Bolu 8 → 28, Rize 72 → 37, Ardahan 37 → 72),
  Giresun 1968 17 → 34.
- **Kademe:** il 1991 (5 grup, haritadan), ilçe 1996 (6 grup); 2003 kademeleri Tablo 7'ye göre düzeltildi (12 il,
  ör. Çorum 5 → 3, Sakarya 3 → 2).
- **Yeni:** SEGE 1980'in 2.–4. ana bileşenleri (tarımsal modernleşme, sayısal eğitim, imalat istihdam artışı);
  SEGE 2003 sektörel endeksleri (imalat sanayi, sağlık, eğitim; il ve Düzey 2).
- Eski il adları bugünkü illere eşlenir (Maraş, Urfa, İçel, Afyon…); sonradan ayrılan illerde değer eski il
  bütünü içindir. İlçeler adıyla eşlenir; adı değişenler (Kale→Demre, Yenihisar→Didim, Ilıca→Aziziye…) ve tek
  ilçeye dönüşen merkezler (Hatay→Antakya, Kocaeli→İzmit, Sakarya→Adapazarı…) dönüştürücüde tablo olarak duruyor;
  sonradan bölünen merkez ilçeler (Adana, Antalya, Bursa, Konya, Samsun…) eşlenmedi.
- Okuma güveni düşük (emin=0) satırlar notlarda tek tek listelidir; 1972'de Sakarya 1970 (196,6; kaynağın diğer
  tabloları 199,6 gösteriyor) basıldığı gibi alındı.

## TÜİK kent-kır sınıflaması haritası, 2022: harita katmanı ve alan payları (Eylül 2026)

TÜİK'in "Kent-kır sınıflamasına göre yerleşim yerleri, 2022" haritası (PDF, ArcMap vektör çıktısı) sayısallaştırıldı:
`tools/tuik-kent-kir-harita/` → `python tools/tuik-kent-kir-harita/donustur.py`.
- PDF'de her mahalle/köy dolgu rengiyle bir çokgen (kır gri, orta yoğun kent sarı, yoğun kent kırmızı). Projeksiyon
  Transverse Mercator, merkez boylam 36° (il sınırlarıyla %99 örtüşme); ölçek ≈2,44 km/pt, konum hatası 1–2 km.
- `public/veri/geo/kent-kir.json` (289 KB): yoğun ve orta yoğun kent alanları, WGS84, 250 m sadeleştirme. Hakkında
  sayfasındaki "Kent ve kır tanımları" bölümünde harita olarak; üzerine gelinen ilin TÜİK nüfus oranları ve alan payları.
- `veri-ekleri/tuik-kent-kir-alan.csv`: Nüfus kategorisinde 3 yeni gösterge, 2022, Türkiye + 81 il + 973 ilçe:
  Yoğun Kent / Orta Yoğun Kent / Kır Alan Payı (%). Yüzölçümü payıdır, nüfus payı değildir (Türkiye: %2,2 / %5,7 /
  %92,0). İl düzeyinde yoğun kent alan payı ile TÜİK'in yoğun kent nüfus oranı arasındaki korelasyon 0,5.
- İlçe düzeyinde nüfus payı için mahalle/köy nüfusu ile birlikte konum gerekir: haritadaki çokgenlerin adı yok.
- **GHSL denemesi (siteye alınmadı):** JRC GHS-POP R2023A 2020, 1 km (`ghsl/` karoları R5–R6 × C21–C23) harita
  sınıflarıyla çakıştırıldı. İl toplamları TÜİK'i tutmadı: Türkiye yoğun kent nüfus payı %45–51 (TÜİK 2022: %67,9),
  il başına ortalama mutlak fark 6–10 puan; 0,5–1,5 km tampon ve ±1 km öteleme farkı kapatmadı. Neden: GHS-POP bazı
  illerde nüfusu yanlış yere koyuyor (Kırıkkale'de en kalabalık hücre kent merkezinin ~20 km güneyinde, merkezde 4 bin;
  Adana ve Erzurum'da benzer). Deneme çıktısı `tools/tuik-kent-kir-harita/ghsl-ilce-nufus-paylari-deneme.csv`.
  Doğru yol: adı ve sınırı olan mahalle/köy katmanı + ADNKS mahalle nüfusları (TÜİK sınıfı mahalle bazında olduğu için
  ilçe payları birebir hesaplanır).

### Ek: İlçe SEGE 2004, 2017, 2022 (Ekim 2026)
`tools/sege-tarihi/cikti/{2004,2017,2022}-ilce.csv` (Ek-1 ulusal sıralama ile Ek-2 il içi tablolar satır satır
karşılaştırıldı, hepsi tutarlı) → `sege-tarihi.csv`: ilçe SEGE Endeks Değeri, Sıralama ve Kademe (6 grup) —
2004: 853/872 ilçe eşlendi (Büyükşehir satırları ve bölünen merkezler hariç), 2017: 970/970, 2022: 973/973.
Veri yılları: 2004 çalışması 2000 verisi, SEGE-2017 2014 verisi, SEGE-2022 ağırlıkla 2019–2020 verisi.
1996 ilçe raporu (Dinçer, DPT) 1996 il raporunun Ek-3'üyle aynı çalışma; 858 satırın tamamı karşılaştırıldı, düzeltme
gerekmedi. 1966 (DPT 403; 573 ilçe, 15 gösterge, Türkiye ortalaması=100, ağırlıkla 1964 verisi; 572 eşlendi) ve 1981 (DPT 1761; 612 ilçe, 6 faktörün skor toplamı; 594 eşlendi) ilçe raporları da eklendi: yalnız ulusal ilçe sıralaması (Ek 3 / Ek 2). 1981'in il ortalamaları (Tablo 8) basım hataları nedeniyle alınmadı. Ayrıntılar `cikti/1966-ilce-notlar.md`, `1981-ilce-notlar.md`.
Mülki idare sınırları arşivinde (`turkiye-mulki-idare-sinirlari-2083.rar`) mahalle katmanı yok (il, ilçe sınırı ve
1.003 il/ilçe merkez noktası); kent-kır ilçe nüfus payı için kullanılamaz.

## TÜİK ADNKS 2025: köy ve belediye nüfusları (Ekim 2026)

`tools/tuik-koy-belediye/` (kullanıcının MEDAS sorguları: 18.183 köy/mezra, 1.377 belediye, ilçe köy-şehir nüfusu)
→ `python tools/tuik-koy-belediye/donustur.py` → `veri-ekleri/tuik-koy-belediye-2025.csv` (5.230 değer; ilçe, il,
Türkiye; 2025). Nüfus kategorisinde 6 yeni gösterge: Nüfusu Olan Köy Sayısı, Belde Sayısı, Belde Nüfusu, Köylerde
Yaşayan Nüfus (Belde Hariç), Ortalama Köy Nüfusu, Nüfusu 100'den Az Olan Köylerin Oranı (%).
- Belde = ilçe belediyesi olmayan belediye (adı ilçe adından, merkez ilçede il adından farklı): 404 belde, 1,28 milyon kişi.
- Denetim: her ilçede köy + belde nüfusu = TÜİK ilçe "Köy Nüfusu" (973/973). Köy-şehir dosyasının değerleri veri
  tabanındaki 2025 ilçe köy ve şehir nüfusuyla birebir aynı; o dosyadan yeni değer alınmadı.
- Köy düzeyindeki nüfuslar siteye birim olarak alınmadı (köy sınırı/konumu yok); yalnız ilçe ve il özetleri.


## Türkiye toplamındaki paylar (GSYH, GSKD, 11 sektör)

TÜİK'in "Sektörlere Göre Bölgesel Paylar (2009 Bazlı)" tablosu (pivot.xls) mevcut TÜİK bölgesel hesaplarından üretilir;
ayrı bir ham dosya gerekmez.

- Betik: `pipeline/turetilmis/turkiye_paylari.py` (girdi `build/veri.db`) → `veri-ekleri/turetilmis-turkiye-paylari.csv`.
  Ardından `python pipeline/build_data.py`.
- Hesap: pay = 100 × bölgenin cari fiyatlı değeri ÷ Türkiye değeri. Düzey 1, Düzey 2 ve il; 2000–2024.
- 13 gösterge (her biri 2.975 değer): "Türkiye GSYH'si İçindeki Pay (Cari Fiyatlarla) (%)", "Türkiye GSKD'si İçindeki Pay
  (Cari Fiyatlarla) (%)" ve "Türkiye Sektör Katma Değeri İçindeki Pay: <sektör> (Cari Fiyatlarla) (%)" (tarım, sanayi,
  imalat, inşaat, ticaret-ulaştırma-konaklama, bilgi-iletişim, finans, gayrimenkul, mesleki-idari, kamu-eğitim-sağlık,
  diğer hizmetler).
- Denetim: TÜİK tablosuyla 2020–2024 GSYH/GSKD payları (405 değer, fark ≤ 0,005 puan, yuvarlama) ve 2024 sektör
  payları (891 değer) birebir aynı. İl düzeyinde ürün vergileri GSKD paylarıyla dağıtıldığından GSYH ve GSKD payları aynıdır.
- "Katma Değerde Sektör Payı" göstergelerinden farklıdır: o, sektörün bölgenin kendi katma değerindeki payını verir.

## Ana sayfa vitrini (giriş bölümü)

Ana sayfanın açılışı, uluslararası karşılaştırmadan önce Türkiye'nin 81 iline üç etkileşimli gösterimle bakar
(Information is Beautiful örneklerinden esinlenildi).

- Veri: `python tools/vitrin/vitrin_verisi.py` (girdi `build/veri.db`, `public/veri/geo/province.json`,
  `public/veri/il-tipolojisi.json`) → `public/veri/vitrin.json`. Pipeline'dan sonra çalıştırılmalı.
- Kod: `src/lib/vitrin.js` (pasta, birinci, suru), `src/styles/vitrin.css`; `src/pages/giris.js` içindeki `vitrin()`.
  Bağımlılıklar: `d3-hierarchy`, `d3-force` (yerelde bir kez `npm install`).
- 01 Pasta: ölçü değiştirilebilir ağaç haritası (nüfus, yüzölçümü = nüfus / yoğunluk, GSYH, imalat, tarım, bilişim,
  ihracat 2024, turist gecelemesi); coğrafi bölgelere göre gruplanır; "yarısı N ilde" cümlesi.
- 02 Birinci: 16×8 karo harita (il merkezleri Macar yöntemiyle ızgaraya). `ADAY` listesindeki ~111 gösterge için iller
  sıralanır (yön: yüksek/düşük iyi; bazıları bin kişi başına), her ile en üst sırada olduğu gösterge, tekrarsız
  atanır (maliyet sıra²). `TERCIH` ile Ankara ve Kocaeli elle seçildi. 36 il birinci, çoğu diğeri ilk beşte.
- 03 Sürü: nüfusla boyutlanan balonlar, d3-force arı sürüsü; eksenler kişi başı GSYH, ortanca yaş, doğurganlık,
  üniversite mezunu oranı, yaşam süresi, net göç; renk OECD TL2024 kentsel–kırsal (3 sınıf).
- Renkler (dataviz doğrulayıcısı): bölge paleti `#009a8a #8566c4 #d9568f #d6981b #c8473b #2a95d0 #4d9a3a`
  (Marmara → Güneydoğu), komşu bölgeler arasında CVD ΔE ≥ 9,2, normal ΔE ≥ 16,7; kentsel–kırsal için referans paletin
  ilk üç rengi.
- 03 SEGE (Ekim 2026): "Altmış yılda kim yükseldi, kim geriledi?" sıralama çizgileri (d3-shape curveBumpX). Veri:
  `Sosyo-Ekonomik Gelişmişlik Sıralaması` 1963, 1970, 1980, 1985, 1991, 1996, 2003, 2011, 2017, 2025 → vitrin.json `sege`
  (her yılda sıraların 1..n eksiksiz olduğu denetlenir). Dikey konum = (sıra − 1) / (il sayısı − 1). Modlar: yükselenler
  / gerileyenler (1963→2025 konum değişimi en büyük altışar il, yalnız 67 eski il), hep zirvede (her çalışmada ilk beş),
  bölgelere göre; il seçme kutusu. Sürü 04'e kaydı.
- 04 İliniz nerede? (Ekim 2026): seçilen ilin 12 göstergede (ortanca yaş, doğurganlık, hanehalkı, net göç, kişi başı
  GSYH, kişi başı ihracat [log ölçek], üniversite mezunu, okul öncesi okullaşma, yaşam süresi, hekim, otomobil,
  genişbant) 81 il arasındaki yeri; Türkiye değeri kesikli çizgi (kişi başı ihracatta toplam ihracat ÷ toplam nüfus).
  Benzer iller: göstergeler standartlaştırılıp (ihracat log) Öklid uzaklığına göre en yakın üç il. vitrin.json `profil`.
  Açılışta rastgele bir il seçilir. Sürü 05'e kaydı.
- 05 Türkiye 100 kişi olsaydı (Ekim 2026): birim grafiği (100 figür; genişte 20×5 sütun sütun, darda 10×10 satır
  satır). Görünümler: yaş, yerleşim (yoğun/orta yoğun kent/kır), coğrafi bölge, eğitim (15+, bilinmeyen hariç), iş
  (çalışıyor / işsiz = katılım − istihdam / işgücü dışında), medeni durum (15+). Eğitim ve medeni durumda kadın/erkek
  ayrımı. Paylar en büyük kalan yöntemiyle 100'e tamamlanır. vitrin.json `yuz`. Sürü 06'ya kaydı.
- 06 Zaman çizelgesi 2000–2025 (Ekim 2026): dönüm noktaları veriden bulunur (eşiğin seri içinde ilk aşıldığı yıl; seri
  eşiğin öbür tarafından başlamıyorsa olay yok): kişi başı GSYH 10 bin $, Theil (iller) 2000'in %60'ı, İstanbul GSYH
  payının zirvesi, ihracat 250 milyar $, nüfus 75/80/85 milyon, ortanca yaş 30, 65+ payı %10, doğurganlık 1,6, kadın ilk
  evlenme yaşı 25, hanehalkı 3,5, üniversite mezunu %10/%20, bebek ölüm hızı binde 10, 2023 depremleri (Hatay ve
  Kahramanmaraş nüfus değişimi). Her kartta göstergenin bütün serisi küçük grafik. Metinlerde yıl ekleri yerine
  "… yılında" kullanılır. Renk 3 grup (bütün çiftlerde doğrulandı). Sürü 07'ye kaydı. vitrin.json `zaman`.
