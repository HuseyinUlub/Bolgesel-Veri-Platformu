# İlçe SEGE-2017: çıkarma notları

Kaynak: `kaynak/2017-ilce-sege.pdf` (İlçelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması SEGE-2017, Kalkınma Ajansları GM Yayın No 2, Aralık 2019; 133 PDF sayfası, metin katmanı temiz). `sayfa` sütunu **PDF sayfasıdır**. Basılı sayfa = PDF − 11 (örneğin PDF s.112 = basılı s.101).

## Çıktı
`2017-ilce.csv`: 2908 veri satırı = 970 endeks + 970 kademe + 968 il içi sıra.
- `Gelişmişlik endeksi`: deger = skor (3 ondalık), sira = Türkiye sırası (1–970). Kaynak: Ek-1.
- `Gelişmişlik kademesi`: 1–6. Ek-1 bölüm başlığından gelir; mevcut 968 Ek-2 satırındaki Kademe sütunu ile aynı.
- `İl içi gelişmişlik sırası`: sira = il içi sıra (deger boş). Kaynak: Ek-2.
- Tüm satırlarda emin=1.

## Rapordaki tablolar
| PDF s. | Tablo | Durum |
|---|---|---|
| 27 | Tablo 1: Değişkenler (kaynak, yıl, birim) | Veri yılı için kullanıldı |
| 28–35 | Tablo 2–8: Boyut bazında değişken listeleri | Atlandı |
| 37–40 | Tablo 9–11: Ortak faktör varyansları, özdeğerler, ağırlıklar | Atlandı |
| 40 | Tablo 12: Kademe eşikleri ve ilçe sayıları | Kontrol için kullanıldı |
| 43–45 | Tablo 13: İl × kademe dağılımı | Atlandı |
| 75–90 | Ek-1: İlçelerin SEGE sıralaması | Alındı |
| 91–132 | Ek-2: İl bazında sıralama (her sayfada bir veya iki il) | Alındı (il içi sıra) ve çapraz kontrol edildi |

**Alt boyut endeksi yok.** Raporda ilçe başına demografi, istihdam, eğitim, sağlık, rekabetçilik/yenilikçilik, mali veya yaşam kalitesi skoru verilmiyor; bu başlıklar yalnızca değişken grupları. Ham değişkenler ilçe bazında yayımlanmamış.

## Kontroller
- Ek-1: sıra 1–970 eksiksiz, mükerrer yok. Skor sıraya göre artmıyor (7,730 Şişli → −1,741 Harran). 3 ondalıkta 157 eşit skor var; raporun verdiği sırada bırakıldı.
- Ek-2 ile Ek-1 karşılaştırması: ilçe adı, skor, il içi sıra ve il başlığı **968/968 eşleşiyor** (aşağıdaki iki ad düzeltmesinden sonra).
- Kademe blokları: 1: 1–56 (56), 2: 57–229 (173), 3: 230–458 (229), 4: 459–663 (205), 5: 664–860 (197), 6: 861–970 (110). Sayılar Harita 1 lejantı ve Tablo 12 ile aynı. Skorlar Tablo 12 eşiklerine (1,74; 0,52; −0,14; −0,49; −1,01) göre de doğru kademede.
- 81 il, 970 ilçe (raporun belirttiği sayı).

## Raporla ilgili sorunlar ve kararlar
- **Ek-2'de Kars'ın iki ilçesi yok:** Kağızman (genel sıra 890, −1,129) ve Digor (934, −1,376). PDF s.112 görüntüden kontrol edildi; Kars tablosunda yalnızca 6 satır var. Bu iki ilçenin endeks ve kademesi Ek-1'den alındı. İl içi sıra raporda basılmadığı için **yazılmadı**. Ek-1'den türetilirse Kağızman 7., Digor 8. olur.
- Ek-1 s.83: "Denizli - Kale" yazıyor → `Kale` olarak kaydedildi.
- Ek-2 s.94: "Keçiören-" yazıyor → `Keçiören` (Ek-1'deki ad).
- Ek-1 s.77: "Kahramanmaraş Dulkadiroğlu" arasında tek boşluk var; il/ilçe olarak ayrıldı.
- İl adı raporda "Hakkâri" olarak geçiyor. 2022 dosyasıyla tutarlı olsun diye `Hakkari` yazıldı.
- İlçe adları dönemin adlarıyla bırakıldı: Ankara-**Kazan** (2016'dan sonra Kahramankazan), İstanbul-**Eyüp** (2017'den sonra Eyüpsultan). 2022 ile birleştirirken eşleştirme gerekir.
- Kapsam dışı kalanlar: Derecik (Hakkari), Kemalpaşa (Artvin) ve Sultanhanı (Aksaray) 2017–18'de ilçe oldu ve çalışmada yok. Rapor PDF s.15 dipnotunda bu ilçelerin, ayrıldıkları Şemdinli, Hopa ve Aksaray Merkez ile aynı endeks ve sıraya sahip sayılmasını öneriyor. **Bu satırlar eklenmedi.**

## Veri yılı
`yil` = 2017 (çalışmanın adı). Rapor 2014 yılı verileriyle hazırlanmış: Tablo 1'deki değişkenlerin hemen hepsi 2014. Yayın tarihi Aralık 2019.
