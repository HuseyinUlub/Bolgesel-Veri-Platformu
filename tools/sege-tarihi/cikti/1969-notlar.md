# 1969 DPT çalışması — çıkarım notları

Kaynak: `kaynak/1969-il-sege.pdf` (235 sayfa, taranmış daktilo). Künye: *Türkiye'de İller İtibariyle Sosyo-Ekonomik Gelişmişlik Endeksi (1963-1967)*, B. Tolan, A. Yücel, M. Törüner, B. Gürer, DPT. 67 il. OCR katmanı kullanılamayacak durumda; tüm değerler sayfa görüntülerinden (150–300 dpi, kırpılıp büyütülerek) okundu.

**Endeks tabanı:** 1963 Türkiye ortalaması = 100. Yani değerler yıllar arasında karşılaştırılabilir: Türkiye 1964'te 110, 1965'te 122, 1966'da 132, 1967'de 138. Nihai endeks, 22 göstergeden (sanayileşme, şehirleşme, tarımda modernleşme, sosyal/eğitim; 4 grup) elde edilen endekslerin toplanmasıyla bulunuyor (s. 21–23). **İl düzeyinde ayrı alt endeks (ekonomik/sosyal) tablosu yok.**

Sayfa numaraları PDF sayfasıdır (basılı numara ≈ PDF − 5).

## CSV'ye alınan tablolar (`1969.csv`, 1226 satır)

| Tablo | PDF s. | İçerik | Satır |
|---|---|---|---|
| Tablo 1: İller İtibariyle Sosyo-Ekonomik Gelişmişlik Endeksi (1963-1967) | 29–30 | Her yıl için büyükten küçüğe sıralı il listesi, tamsayı endeks. `sira` listedeki sıradan türetildi (Türkiye satırı sayılmadı). **Ana tablo.** | 335 il + 5 Türkiye |
| Tablo VI: İllerin endeks dereceleri itibariyle gelişme eğilimleri | 51–53 | Aynı endeks, **bir ondalık basamaklı**, alfabetik (1963–1967). `sira` boş. | 335 il + 5 Türkiye |
| Tablo V (1967 sıralaması) | 44–45 | Yalnızca 1967, basılı sıra numaralarıyla. Değerler Tablo 1'in 1967 sütunuyla birebir aynı. Basılı listede 34. sıra yanlışlıkla "35" yazılmış (Malatya); CSV'de 34 verildi. | 67 + 1 |
| Tablo VII: İl Gelişme Hızları (1963=100) | 54–56 | Her ilin 1967 endeksinin kendi 1963 değerine oranı (1963=100), basılı sırayla. Eşit değerler ayrı sıra no. almış. | 67 + 1 |
| Tablo XVII: 1972 Yılına Kadar İller İtibariyle Gelişme Projeksiyonu | 99–100 | 1968–1972 **projeksiyon** değerleri (1963–67 il büyüme hızı sabit varsayımı). 1967 sütunu Tablo 1 ile aynı olduğundan alınmadı (kontrol edildi, 67/67 eşleşiyor). | 335 + 5 |
| Tablo XVIII: Bölge Ortalama Endeks Değerleri | 104 | 6 bölge, 1963–1967, `duzey=bolge`. | 30 + 5 |
| Tablo XXIV: Bölge ortalama gelişme hızları (1963=100) | 143 | 6 bölge, 1963–1967. | 30 + 5 |

Türkiye satırları `duzey=ulke`, `il=Türkiye` olarak yazıldı; dışarıda bırakmak için filtreleyin.

`gosterge` değerleri: `Gelişmişlik endeksi (1963 Türkiye ort.=100)` (Tablo 1, V), `Gelişmişlik endeksi, ondalıklı (...)` (VI), `Gelişme hızı: 1967 endeksi (1963=100)` (VII), `Gelişmişlik endeksi projeksiyonu (...)` (XVII), `Bölge ortalama gelişmişlik endeksi (...)` (XVIII), `Bölge gelişme hızı (1963=100)` (XXIV).

İl adları basıldığı şekliyle, dönemin adlarıyla: Maraş, Urfa, İçel, Afyon, Gümüşhane, Elâzığ, Hakkâri. Sakarya'nın merkezi Adapazarı'dır; Sakarya olarak basılmış.

## Çapraz kontroller ve emin=0 satırlar (31)

Tablo 1 değerleri üç bağımsız kaynakla karşılaştırıldı: Tablo VI'daki ondalıklı değerler, bölge tabloları (XIX–XXIII ve Doğu için Tablo XII, s. 119–187) ve Tablo XVII'nin 1967 sütunu. Her yıl sütununun sıralaması azalmayan düzende doğrulandı.

**Tablo 1, basıldığı gibi alınıp işaretlendi (emin=0):**
- Denizli 1963 = 79 (elle mürekkeple düzeltilmiş). Tablo VI 77,1 ve Ege tablosu 77 veriyor.
- Tekirdağ 1963 = 77 (elle düzeltilmiş). Tablo VI 76,4 ve Marmara tablosu 76 veriyor.
- Malatya 1963 = 73 ve Uşak 1963 = 71: mürekkep lekesi var. Tablo VI (72,8 ve 71,2) ile tutarlı.
- Aydın 1966 = 151 (Tablo VI 150,0; Ege tablosu 150). Bursa 1966 = 138 (137,0; 137). Kırşehir 1966 = 83 (81,8; 82). Edirne 1966 = 96 (96,5; Marmara tablosu 97).
- Küçük yuvarlama farkları işaretlenmedi: Trabzon 1963 = 66 (66,6), Tekirdağ 1964 = 85 (85,5).

**Tablo VI (ondalıklı), belirgin daktilo hataları, düzeltilmiş değer yazıldı (emin=0):**
- İçel 1964: basılı "213,6", yazılan 123,6.
- Kocaeli 1966: basılı "86,9", yazılan 186,9.
- Türkiye 1963: basılı "110,0", yazılan 100,0.
- Üst üste daktilo edilmiş (okunuş tahmini): Bilecik 1963 = 66,8; Denizli 1965 = 84,2 (basılı "384,2" gibi); Edirne 1964 = 84,1 (basılı "80,1"/"84,1"); Giresun 1964 = 64,7 (basılı "67,7"/"64,7"); Tokat 1965 = 81,2 (basılı "91,2"/"81,2"); Kocaeli 1963 = 126,5.

**Tablo VI, basıldığı gibi bırakılıp işaretlendi (emin=0):** Bu değerler diğer tablolarla çelişiyor.
- Kayseri 1967 = 113,3. Diğer tüm tablolarda 118; olası doğru değer 118,3.
- Malatya 1967 = 95,8. Diğer tablolarda 92; Tablo VII oranı da 92'yi doğruluyor.
- Muş 1967 = 48,7. Diğer tablolarda 50; olası doğru değer 49,7.
- Niğde 1966 = 71,0. Diğer tablolarda 72.
- Kars 1966 = 58,7. Tablo 1'de 58.

**Tablo XVII (projeksiyon), basıldığı gibi alındı (emin=0):**
- İzmir 1968: basılı "2555", yazılan 255.
- Tunceli 1968: basılı "511", yazılan 51.
- Aşağıdakiler olduğu gibi bırakıldı. Serinin kendi büyüme oranına uymuyor, büyük olasılıkla daktilo hatası:
  - Kırklareli 1969 = 114 (olası 141)
  - Sivas 1969 = 99 (olası 93)
  - Çankırı 1969 = 89 (olası 83)
  - Siirt 1970 = 69 (olası 96)
  - Artvin 1971 = 112 ve 1972 = 120 (olası 102 / 110)
  - Hatay 1972 = 200 (Sakarya aynı seride 208)

## Alınmayanlar ve nedenleri

- **Tablo II (s. 32, en gelişmiş 10 il) ve Tablo IV (s. 43, en çok ve en az gelişmiş iller):** Tablo 1'in alt kümeleri, değerleri aynı.
- **Bölge il tabloları:** Tablo XIX Marmara (s. 119), XX Akdeniz (s. 123), XXI Ege (s. 127), XXII İç Anadolu (s. 134), XXIII Karadeniz (s. 140) ve XII Doğu (s. 187, yıl bazında sıralı). Tablo 1'in bölgelere göre tekrarı; yalnızca çapraz kontrol için kullanıldı. İçlerindeki "Bölge Ortalaması" satırları Tablo XVIII ile aynı.
  - Bölge üyelikleri (s. 102–104): Akdeniz 6, Doğu Anadolu 20, Ege 7, İç Anadolu 14, Karadeniz 10, Marmara 10 il. Doğu Anadolu'ya Gaziantep, Malatya, Maraş dahil; Artvin Karadeniz'e, Sivas İç Anadolu'ya alınmış.
- **Bölge bazında il gelişme hızı tabloları** (XXV–XXIX, s. 143–157; Doğu için s. 194): Tablo VII'ye ek olarak 1964–1966 oranlarını da veriyor. Bunlar Tablo 1 ya da VI'dan türetilebilir, bu yüzden alınmadı.
- **s. 106–107, 1967→1972 sıra değişimleri:** Yükselen 10 il ve düşen 12 il; Tablo XVII'den türetilebilir. s. 105: 1972'de Türkiye ortalamasını aşan iller (XVII'nin alt kümesi).
- **Kamu yatırımları, şehirleşme, traktörle sürülen arazi, okur-yazarlık gibi tek gösterge tabloları** (Tablo III, IV-bin TL, XIII–XVI, XXX–L): Gelişmişlik endeksi değil.
- **Grafikler ve haritalar** (s. 47–50, 118 ve sonrası, 231–235): Sayısal değer içermiyor ya da tabloları tekrarlıyor.
