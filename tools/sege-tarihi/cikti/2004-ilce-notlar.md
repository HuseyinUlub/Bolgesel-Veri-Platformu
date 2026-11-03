# 2004 İlçelerin SEGE araştırması: çıkarma notları

Kaynak: `kaynak/2004-ilce-sege.pdf` (Dinçer ve Özaslan, DPT, Nisan 2004, 256 sayfa, metin katmanı temiz). Sayfa numaraları **PDF sayfası**dır; basılı sayfa = PDF − 11.

## Çıktı
`2004-ilce.csv`, 2616 satır (872 ilçe × 3 gösterge):

| Gösterge | Tablo | `deger` | `sira` |
|---|---|---|---|
| Gelişmişlik endeksi | Ek-1 (s.96–114) | endeks (5 ondalık) | 872 içindeki sıra |
| Gelişmişlik kademesi | Ek-1 | grup 1–6 (1 = en gelişmiş) | boş |
| İl içi gelişmişlik sırası | Ek-2 (s.118–139) | boş | il içindeki sıra |

## Rapordaki sonuç tabloları

| PDF s. | Başlık | Durum |
|---|---|---|
| 37 | TABLO-1: Değişkenler (32 değişken, yıl ve kaynak) | Yalnız veri yılı için kullanıldı |
| 56–58 | TABLO-2/3/4: Varyans, yükler, ağırlıklar | Atlandı (yöntem) |
| 80 | TABLO-5: Kademeli ilçe gruplarına göre göstergeler | Atlandı (ham değişkenlerin grup ortalamaları) |
| 81 | TABLO-6: Kademe × coğrafi bölge göstergeleri | Atlandı (ham değişken) |
| 96–114 | EK-1: İlçelerin SEGE sıralaması | Alındı: sıra, il, ilçe, endeks, gelişmişlik grubu |
| 118–139 | EK-2: İlçelerin bağlı oldukları il içinde gelişmişlik sıralaması | Alındı: il içi sıra. Ayrıca Ek-1 ile çapraz kontrol için kullanıldı |
| 142 | EK-3: Merkez ilçelerin sıralaması | Atlandı: Ek-1'in merkez ilçe alt kümesi (81 satır, aynı endeks, grup ve 872 içindeki sıra). Merkezler arası sıra (1–81) Ek-1'den türetilebiliyor |
| 146–256 | EK-4: İlçeler itibarıyla sosyo-ekonomik göstergeler | Atlandı (ham değişkenler) |

**Raporda ilçe düzeyinde alt endeks (sektörel ya da bileşen endeksi) yok.** Yalnız genel endeks ve 6 kademeli gelişmişlik grubu var.

## Kapsam
- 2000 idari yapısı: 81 il, 872 ilçe (s.35–36). Sıra 1–872.
- İstanbul, Ankara ve İzmir'in büyükşehir ilçeleri "gelişmiş merkez" kabul edilip kapsam dışı bırakılmış. Ek-1'in başında sırasız ve değersiz yazılmışlar; CSV'ye **alınmadı**. Bu illerin büyükşehir dışı ilçeleri sıralamada var (İstanbul 5, Ankara 16, İzmir 19 ilçe).
- Adana, Bursa, Gaziantep, Kayseri ve Konya'nın büyükşehir ilçeleri tek "Büyükşehir" satırı. 2000 sonrası büyükşehir olan illerin merkez ilçeleri "Merkez" olarak yer alıyor (s.36).
- İl başına ilçe sayıları Ek-1 ve Ek-2'de aynı. 81 il var, her ilin tek bir Merkez ya da Büyükşehir satırı var.

## Kontroller
- **Sıra:** Ek-1'de 1–872 eksiksiz ve tekrarsız. Ek-2'de 872 satırın her biri farklı bir sıraya karşılık geliyor.
- **Ek-1 ve Ek-2 çapraz kontrolü:** 872 satırın tamamında sıra, endeks ve grup birebir aynı. Ad farkları aşağıda.
- **Monotonluk:** Endeks sıraya göre azalan. Üç yerde 5 ondalıkta eşitlik var (azalma değil): 249/250 Kızılcahamam ve Kumluca 0,20565; 309/310 Reyhanlı ve Çarşıbaşı 0,05528; 357/358 Sarıcakaya ve Niksar −0,07744.
- **Kademeler:** Sıraya göre kesintisiz. 1: sıra 1–15 (15), 2: 16–167 (152), 3: 168–476 (309), 4: 477–653 (177), 5: 654–753 (100), 6: 754–872 (119). 2.–6. grup büyüklükleri bölüm 5 metniyle aynı. Birinci gruba metinde kapsam dışı 3 büyükşehir de dahil ediliyor; CSV'de 15 ilçe var.
- **İl içi sıra:** Ek-2'de ayrı bir il içi sıra sütunu basılmamış. Tablo her il içinde 872 içindeki sıraya göre dizili; il içi sıra bu dizilişten okundu (1, 2, 3, …). Her ilde dizilişin Ek-1 sırasıyla tutarlı olduğu kontrol edildi. İstanbul, Ankara ve İzmir'de büyükşehir Ek-2'de de yok; bu illerde 1. sıra büyükşehir dışındaki en gelişmiş ilçe (ör. İstanbul'da Büyükçekmece).
- **Görsel kontrol:** s.104 (sıra 373–419) görüntüyle karşılaştırıldı, metin katmanıyla aynı.

## Adlar
- **İl adları** Ek-1'deki gibi büyük harfle yazıldı: K.MARAŞ, AFYON, MERSİN, ISPARTA, IĞDIR. Bu yazım önceki CSV'lerle tutarlı. Ek-2'de il adı KAHRAMANMARAŞ olarak geçiyor.
- **İlçe adları** Ek-2'den alındı, çünkü Ek-1'de bazı adlar kısaltılmış ya da hatalı:
  - Ek-1'de ŞKoçhisar ve Ş.Karahisar, Ek-2'de Şereflikoçhisar ve Şebinkarahisar.
  - Ek-1'de İbradi ve Süleoğlu, Ek-2'de İbradı ve Süloğlu.
- **İki baskı hatası düzeltildi** (Ek-1 ve Ek-2'de aynı şekilde basılmış): Karaisali→Karaisalı (Adana), Mihalıçcık→Mihalıççık (Eskişehir).
- **Basıldığı gibi bırakılan tarihî adlar:** Kazan, Ondokuzmayıs, Akköy, Arapkir, Ilıca, Sincanlı, Hadım, Aydınlar, Doğubeyazıt, Pötürge. `donustur.py` içindeki AD_DEGISEN tablosu bunların çoğunu bugünkü adlara eşliyor.

## Veri yılı (`yil`)
Tablo 1'deki 32 değişkenin 31'i 2000 yılına ait. Tek istisna "Yıllık ortalama nüfus artış hızı" (1990–2000). Raporda "tüm veriler 2000 yılına aittir" gibi bir ifade yok. 2003 notlarındaki yaklaşım izlenerek `yil` = çalışma yılı **2004** yazıldı. Veri yılı fiilen 2000; istenirse 2000 yapılabilir.

## Değer biçimi
Endeksler basıldığı gibi 5 ondalıkla alındı. Ondalık ayırıcı `.`. Bütün satırlarda `emin` = 1.
