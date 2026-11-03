# 1996 İlçe SEGE raporunun kontrolü

Kaynak: `kaynak/1996-ilce-sege.pdf` (Bülent Dinçer, *İlçelerin Sosyoekonomik Gelişmişlik Sıralaması*, DPT Bölgesel Gelişme ve Yapısal Uyum GM, 1996; 132 sayfa, taranmış ve ABBYY OCR'lı). Sayfa numaraları **PDF sayfası**dır; basılı sayfa = PDF − 8.

## Sonuç: aynı çalışma, yeniden çıkarılmadı
`1996-ilce.csv` dosyası 1996 il raporunun Ek-3'ünden alınmıştı. Bu rapor, o ekin kaynağı olan ilçe çalışmasının kendisi:
- **Kapsam aynı:** Aralık 1993 idari yapısı, 76 ilde 858 ilçe (s.17–18, 20, 41). İstanbul, Ankara ve İzmir büyükşehirleri kapsam dışı. Adana, Bursa, Gaziantep, Kayseri ve Konya tek "Büyükşehir" satırı. Karabük, Kilis, Yalova ve Osmaniye eski illerinin ilçesi.
- **Yöntem aynı:** 32 değişken, 32×858 veri matrisi, temel bileşenler analizi (s.33–34).
- **Değerler aynı:** Sonuç tablosu "5.1 İlçelerin gelişmişlik seviyelerine göre sıralanması" (s.46–69). Sıra, il, ilçe, 6 ondalıklı endeks ve grup (1–6) içeriyor. 858 satırın hepsinde endeks ve grup `1996-ilce.csv` ile aynı; yalnız aşağıdaki OCR farkları var.
- Raporda ayrıca "5.2 İlçelerin bağlı oldukları il içindeki gelişmişlik sırası" tablosu var (s.73–95: 858 içindeki sıra ve il içi sıra). Bu tablo 1996 il raporunun Ek-4'üyle aynı ve görev kapsamında olmadığı için alınmadı. İl içi sıra Ek-3'ten türetilebiliyor.

## Karşılaştırma yöntemi
Önerilen 100 satırlık örnek yerine **858 satırın tamamı** karşılaştırıldı. s.46–69'un metin katmanı ayrıştırıldı ve 856 satır doğrudan okundu. Kalan 2 satırda OCR satırı bölmüş ya da il adını bozmuştu (360 Evciler, 485 Göksün); bunlar elle tamamlandı. Her sıra için il, ilçe, endeks ve grup `1996-ilce.csv` ile karşılaştırıldı.

İki dosya aynı basılı tablonun iki ayrı taramasından, birbirinden bağımsız OCR ile geliyor. Bu yüzden iki kaynağın uyuştuğu yerde ortak bir OCR hatası olması pek olası değil. Önceki notlarda işaretlenen şüpheli satırların hepsi bu raporla birebir uyuşuyor: bölünmüş satırlar 319, 573, 577, 619–621, 625, 626, 632, 636, 644, 649; adı kaymış satırlar 98, 175, 387, 539, 551, 562, 652, 653, 655, 844.

## Bulunan farklar (28 sıra): hepsi bu raporun OCR hatası, CSV doğru
| Sıra | PDF s. | `1996-ilce.csv` | Bu raporun OCR'ı | Karar |
|---|---|---|---|---|
| 632 | 63 | Mesudiye −0,583643 | −0,583543 | **Görüntüyle doğrulandı:** her iki raporda da −0,583643 basılı. CSV doğru |
| 654 | 64 | Hafik −0,620325 | −0,520325 | OCR değeri monotonluğu bozuyor (653: −0,620181; 655: −0,622247). CSV doğru |
| 518, 562, 767 | 60, 61, 67 | GÜMÜŞHANE / Köse, Şiran, Kürtün | İlçe adı il sütununa kaymış | CSV doğru |
| 94 | 49 | Merkez | "Merkez." | CSV doğru |
| 157, 198, 381, 470, 495, 512, 523, 541, 549, 567, 574, 607, 614, 618, 620, 621, 630, 643, 663, 671, 691, 828 | 51–68 | Sandıklı, İncirliova, Gölpazarı, Gölova, İbradı, Karaisalı, Güzelyurt, Sarıkaya, Büyükorhan, İnhisar, Sincanlı, Dernekpazarı, Otlukbeli, Tufanbeyli, Başyayla, Gölyaka, Karakoçan, Adilcevaz, Şalpazarı, Kumru, İspir, İdil | Sandıkiı, İnciri i ova, Göl pazarı, Göl ova, ibradı, KaraisalI, Güzeiyurt, Sarı kaya, Büyükorftan, inhisar, SincanlI, Demekpazarı, Otlukbeü, Tufan beyi i, Başyayia, Gölvaka, Karakaçan, Adiicevaz, Şal pazarı, Kumaı, ispir, idil | Tek harflik OCR hataları ya da boşluk. CSV doğru |

İl adlarında büyük harf ve noktalama farkları dışında fark yok (ör. "K. M ARAŞ"). Sıra 1–858, endeksin azalan sırası ve grup sınırları (1: 1–15, 2: 16–118, 3: 119–327, 4: 328–662, 5: 663–758, 6: 759–858) iki kaynakta aynı.

## Bugünkü adlarla eşleşmeyen yazımlar (düzeltilmedi)
CSV'deki ilçe adları `public/veri/ilceler.json` ile de karşılaştırıldı. Eşleşmeyenler dönemin yazımları: M.Ereğlisi, Yenihisar, Kazan, Akköy, Arapkir, Cumaova, Çiçekdağ, Ondokuzmayıs, Aydınlar, Sincanlı, Çağlıyancerit, Ilıca, Doğubeyazıt, Potürge. Ayrıca bugünkünden farklı harfle yazılanlar: Talaş, İlgaz, Bahşili, Kıbrısçık, Göksün, Şeydiler, Keleş, Hadım, Kığı, Nazimiye. Bunların hepsi iki bağımsız OCR'da aynı okunuyor, yani basıldığı gibiler. Ad eşlemesi `donustur.py` (AD_DEGISEN) tarafında yapılmalı; kaynak CSV'de değişiklik gerekmiyor.

## Düzeltme dosyası
`1996-ilce-duzeltme.csv` **yalnız başlık satırını** içeriyor: düzeltilmesi gereken satır bulunmadı.
