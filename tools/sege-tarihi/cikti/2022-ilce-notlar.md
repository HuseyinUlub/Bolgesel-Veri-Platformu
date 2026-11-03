# İlçe SEGE-2022: çıkarma notları

Kaynak: `kaynak/2022-ilce-sege.pdf` (İlçelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması SEGE-2022, Kalkınma Ajansları GM Yayın No 35, Şubat 2022; 71 PDF sayfası, metin katmanı temiz). `sayfa` sütunu **PDF sayfasıdır**. PDF her sayfada iki basılı sayfa (yan yana) içeriyor; örneğin PDF s.49 = basılı s.84–85.

## Çıktı
`2022-ilce.csv`: 2919 veri satırı = 973 ilçe × 3 gösterge.
- `Gelişmişlik endeksi`: deger = skor (3 ondalık, raporda basıldığı gibi), sira = Türkiye sırası (1–973). Kaynak: Ek-1.
- `Gelişmişlik kademesi`: deger = 1–6. Ek-1'deki kademe bölüm başlığından gelir; Ek-2'deki Kademe sütunu ile birebir aynı.
- `İl içi gelişmişlik sırası`: sira = il içi sıra, deger boş. Kaynak: Ek-2.
- Tüm satırlarda emin=1.

## Rapordaki tablolar
| PDF s. | Tablo | Durum |
|---|---|---|
| 14 | Tablo 1: Değişkenler (kaynak, yıl, birim) | Veri yıllarını belirlemek için kullanıldı |
| 15–20 | Tablo 2–9: Boyut bazında değişken listeleri | Atlandı (ilçe değeri yok) |
| 22–23 | Tablo 10–11: Özdeğerler, 1. temel bileşen ağırlıkları | Atlandı |
| 23 | Tablo 12: Kademe eşikleri ve ilçe sayıları | Kontrol için kullanıldı |
| 25–26 | Tablo 13: İl × kademe dağılımı | Atlandı (Ek'ten türetilebilir) |
| 42–49 | Ek-1: İlçelerin SEGE sıralaması (sıra, il, ilçe, skor; kademe başlıkları altında) | Alındı |
| 49–70 | Ek-2: İl bazında sıralama (ilçe, genel sıra, il içi sıra, skor, kademe) | Alındı (il içi sıra) ve Ek-1 ile çapraz kontrol edildi |

**Alt boyut endeksi yok.** Raporda ilçe başına demografi, istihdam, eğitim, sağlık, finans, rekabetçilik, yenilikçilik veya yaşam kalitesi boyut skoru verilmiyor. Bu boyutlar yalnızca değişken grupları olarak geçiyor; endeks tek bir birinci temel bileşenden (GTBA) hesaplanıyor. Ham değişken değerleri de ilçe bazında yayımlanmamış.

## Kontroller (hepsi geçti)
- Ek-1: sıra 1–973 eksiksiz, mükerrer yok. Skor sıraya göre artmıyor (6,959 Şişli → −1,447 Harran). 3 ondalıkta 166 eşit skor var; bunlar raporun verdiği sırada bırakıldı.
- Ek-2'de 973 satırın tamamı bulundu. Ek-1 ile genel sıra üzerinden eşleştirildi: ilçe adı, skor ve il içi sıra (Ek-1'den il bazında türetilen sıra) **973/973 eşleşiyor**. Bu, Ek-1'deki il ataması için de bağımsız bir doğrulama.
- Kademeler sıraya göre kesintisiz bloklar oluşturuyor: 1: 1–67 (67), 2: 68–240 (173), 3: 241–415 (175), 4: 416–630 (215), 5: 631–852 (222), 6: 853–973 (121). Sayılar metindeki ve Tablo 12'deki sayılarla aynı. Skorlar Tablo 12 eşiklerine (1,632; 0,396; −0,173; −0,493; −0,824) göre de doğru kademede.
- 81 il var. İl başına ilçe sayıları gerçekçi (İstanbul 39, Konya 31, İzmir 30, Ankara 25 …).
- Ek-1 ile Ek-2 iki ayrı tablo olup birbirini tam tuttuğu için ayrıca görüntü kontrolüne gerek görülmedi.

## Adlar
İl ve ilçe adları Ek-1'de yazıldığı gibi alındı (zaten Türkçe ve baş harfi büyük): Kahramanmaraş, Afyonkarahisar, Hakkari, Eyüpsultan, Kahramankazan, Ondokuzmayıs. Büyükşehir dışındaki illerin merkez ilçesi "Merkez" olarak geçiyor.

## Veri yılı
`yil` = 2022 (çalışmanın yılı). Değişkenler çoğunlukla 2019–2020 verisi (aralık 2016–2021); nüfusta 2020 kullanılmış. Rapor kendisini 2014 verisiyle hazırlanan İlçe SEGE-2017'nin devamı olarak tanımlıyor.
