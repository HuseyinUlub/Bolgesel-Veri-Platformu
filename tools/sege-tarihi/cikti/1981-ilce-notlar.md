# 1981 İlçeler itibariyle illerin SEGE sıralaması: çıkarma notları

Kaynak: `kaynak/1981-ilce-sege.pdf`. DPT Yayın No 1761 (KÖYD 22), Kalkınmada Öncelikli Yöreler Dairesi, Nisan 1981. PDF 101 sayfa, taranmış daktilo metni. OCR katmanı gürültülü, bu yüzden kullanılmadı. Bütün değerler 200 dpi sayfa görüntülerinden okundu. Sayfa numaraları **PDF sayfası**dır; basılı sayfa = PDF − 4.

## Ne ölçülüyor
- Birim ilçe. 67 ilin 612 ilçesi değerlendirmeye alınmış (merkez ilçeler dahil, s.26 ve s.31).
- İstanbul ilinin bütün ilçeleri ile Ankara ve İzmir'in merkez ilçeleri kapsam dışı (s.28). Bu yüzden 64 merkez ilçe var. Ankara'nın 17, İzmir'in 16 merkez dışı ilçesi kapsamda.
- 21 değişken kullanılmış (s.11–12): tarım, sanayi, hizmet, banka, vergi, eğitim, elektrik ve teşvik göstergeleri. Raporda tek bir veri yılı belirtilmiyor; yalnız teşvik belgesi için "1979(?)–80 kümülatif" yazıyor. Bu nedenle `yil` = çalışma yılı **1981**.
- Yöntem: Maximum Likelihood Faktör Analizi ve Varimax çevirme. Gelişmişlik Değeri 6 faktör skorunun toplamı (ΣFi, s.24). Birimsiz; ortalaması 0 civarında, en yüksek +15.232, en düşük −3.531. PCA ve PFA sonuçları yalnız kontrol amaçlı kullanılmış.

## Tablolar ve CSV'deki karşılıkları

| PDF s. | Tablo | Durum |
|---|---|---|
| 19–23 | Tablo 1–4: varyans, korelasyon, faktör yükleri | Atlandı (yöntem) |
| 25 | Tablo 5: Adana ilçeleri için MLFA/PCA/PFA il içi sıraları (örnek) | Atlandı. Tek ilde yöntem karşılaştırması |
| 26–27 | Tablo 6: Merkez ilçenin üstünde yer alan ilçeler | Atlandı. Ek 2'nin alt kümesi, sıra yok; çapraz kontrol için kullanıldı |
| 28–29 | Tablo 7: Merkez ilçeler gelişmişlik sıralaması (64) | **Alındı**, `duzey=ilce`, `ilce=Merkez`, sıra merkezler arasında |
| 30 | Tablo 8: İlçeler ortalamasına göre iller sıralaması (64 il) | **Alındı**, `duzey=il` |
| 32–67 | Ek 1: İl içinde ilçelerin değerleri ve genel sıraları | Ayrı satır olarak alınmadı. Değer ve genel sıra Ek 2 ile aynı, il içi sıra numarası basılmamış (yalnız diziliş). Çapraz kontrol için kullanıldı |
| 68–90 | Ek 2: Tüm ilçeler gelişmişlik değerleri ve sıralaması (612) | **Alındı**: ana tablo |
| 91–98 | Ek 3: Doğu ve Güneydoğu Anadolu'daki 20 ilin ilçeleri (173) | **Alındı**, sıra bölge içi (1–173) |
| 99 | Ek 4: İlçelerin gelişmişlik grupları haritası | Atlandı (harita; grup eşikleri okunamıyor) |

CSV'de 913 satır var: Ek 2'den 612, Tablo 7'den 64, Ek 3'ten 173, Tablo 8'den 64.

| `gosterge` | `sira` anlamı |
|---|---|
| Gelişmişlik değeri (MLFA faktör skorları toplamı, birimsiz) | 612 ilçe içindeki sıra (Ek 2) |
| Gelişmişlik değeri (MLFA, birimsiz); sıra merkez ilçeler arasında | 64 merkez ilçe içindeki sıra (Tablo 7, basıldığı gibi) |
| Gelişmişlik değeri (MLFA, birimsiz); sıra 20 il ilçeleri arasında | Doğu ve Güneydoğu sırası (Ek 3). Yalnız her 10. sıra basılmış; diğerleri satır dizilişinden okundu. Basılı 10, 20, …, 170 ve 173 işaretleriyle tutarlı |
| Gelişmişlik değeri (ilçe değerlerinin ortalaması, birimsiz) | 64 il içindeki sıra (Tablo 8) |

## Kontroller
- **Ek 2 satır satır görsel doğrulama:** 22 sayfanın tamamı görüntüyle karşılaştırıldı. Sıra 1–612 eksiksiz ve tekrarsız. Ek 2'de sıra yalnız her 5. satırda basılmış ("5-", "10-", "217-", "289-", "436-", "509-", "605-", "612-" gibi). Bütün basılı sıra işaretleri satır sayımıyla tutuyor.
- **Monotonluk:** Ek 2 değerleri sıraya göre kesin azalmıyor ama hiç artmıyor; eşit değerler var. Ek 3 ve Tablo 7 de basıldığı haliyle monoton. Tablo 8'de tek istisna var: 58 Tunceli −2.203, 59 Kars −2.064 (basıldığı gibi).
- **Ek 1 ile Ek 2:** 612 ilçe birebir eşleşiyor. Ek 2'de soluk okunan değerler Ek 1'de teyit edildi: Düzce 2.484, Sapanca 2.317, Saruhanlı 0.681, Beyşehir −0.419, Mut −0.928, Araban −1.268, Çatalzeytin −1.569, Cide −1.587, Varto −2.852.
- **Tablo 8 ile Ek 2 ortalamaları:** Ek 2 değerlerinden il ortalamaları yeniden hesaplandı. 64 ilin 51'inde basılı değerle ±0.001 içinde uyuşuyor, bu da Ek 2 değerlerini bağımsız olarak doğruluyor. 11 ilde basılı ortalama hesaplanandan farklı: Rize 2.135 (hesap 2.272), Konya 0.397 (0.342), Ordu 0.143 (0.096), Bolu 0.037 (0.004), Denizli 1.083 (1.091), Bitlis −1.969 (−1.956), Mardin −1.469 (−1.465), Tokat −0.408 (−0.404), Aydın 2.295 (2.298), Hatay 1.533 (1.529), Van −2.465 (−2.470). Basılı değerler net okunuyor. Bu 11 il ile sırası monoton olmayan Tunceli ve Kars `emin=0`. Tablo 8'de İstanbul, Ankara ve İzmir yok.

## Düzeltmeler ve belirsizlikler (Ek 2 satırları)
- **İl adları ilçe kodundan** (ilk iki hane, 1981 alfabetik il kodu) türetildi. Ek 2'de iki il adı yanlış basılmış: sıra 12 Merkez (4500) "Kütahya" yazılmış, doğrusu Manisa; Soma (4511) "Kütahya" yazılmış, doğrusu Manisa.
- **Kod 0908:** Ek 2'de "Söke" basılmış (Söke ayrıca 0909 ile var). Ek 1, Tablo 6 ve alfabetik kod sırası Nazilli gösteriyor; **Nazilli** yazıldı.
- **Kod 0503/0504 (Amasya) ve 4511/4512 (Manisa):** Ek 2 ile Ek 1 ad–kod eşleşmesinde çelişiyor.
  - Ek 2: Suluova 0504 1.674 ve Merzifon 0503 1.048; Soma 4511 3.919 ve Turgutlu 4512 3.787.
  - Ek 1 ve Tablo 6: Merzifon 0504 1.674 ve Suluova 0503; Turgutlu 4511 3.919 ve Soma 4512.
  - Değer her iki tabloda da aynı koda bağlı. İlçe kodları il içinde alfabetik (örneğin Ankara, Aydın, Kars), bu da 0503 = Merzifon, 0504 = Suluova, 4511 = Soma, 4512 = Turgutlu demek. Bu yüzden Ek 2'nin adları kullanıldı. Dört satır `emin=0`. İstenirse Ek 1'e göre adlar takas edilebilir.
- **Gemerek (5802):** Ek 2'de −0.976, Ek 1 (s.62) ve Ek 3 (s.93) −0.974. Değer **−0.974** alındı; sıra (375) iki değerle de tutarlı. `emin=0`.
- **Ek 1'in kendi hataları** (CSV'yi etkilemiyor): Uşak Merkez sırası 58 basılmış (Ek 2'de 68); Bayındır 121 (120); Nusaybin −0.661 (Ek 2 ve Ek 3'te −0.611, sıra 324 ile tutarlı); Maden kodu 2005 (2305); Konya'da "Kula" (Kulu) ve "Ilgaz" (Ilgın).
- **Ek 3:** Mardin Merkez'in genel sırası 188 basılmış (Ek 2'de 189). Ek 3 değerleri Ek 2 ile aynı; yalnız Gemerek farkı yukarıda.
- Kağızman kodu Ek 2'de 3608 basılmış (Iğdır ile aynı). Doğrusu 3609; CSV'de kod yok.

## Tablo 7 (merkez ilçeler) farkları
Tablo 7 basıldığı gibi alındı. Ek 2 ile çelişen ya da bu yüzden sırası kayan 15 satır `emin=0`:
- Antalya 4.168 basılmış, Ek 2'de 4.618; Tablo 7'de 21. sırada, doğrusu 16. Bu kayma Konya, Edirne, Tekirdağ, Balıkesir ve Isparta'nın sırasını da etkiliyor.
- Edirne 4.497 (Ek 2'de 4.493).
- Afyon 2.082 (2.080) ile Malatya'nın sırası yer değiştirmiş.
- Siirt 1.118 (1.180).
- Çankırı 0.121 (Ek 2'de −0.121) ile Yozgat'ın sırası yer değiştirmiş.
- Artvin −0.218 (−0.128).
- 61 "Bitlis" −1.527 ve 62 "Bingöl" −1.542: adlar takas basılmış. Ek 2'de Bingöl −1.527, Bitlis −1.542.
- Muş −1.877 (−1.867).

## Adlar
- İlçe adları Türkçe başlık harfiyle yazıldı. Kısaltmalar açıldı: M.Kemalpaşa → Mustafakemalpaşa, Ş.Koçhisar → Şereflikoçhisar, Ş.Karahisar → Şebinkarahisar, Balâ → Bala.
- Tarihî adlar basıldığı gibi bırakıldı: İmroz (Gökçeada), Akdağmadeni, Eynesil, Kofçaz, Hadım, Ömerli, Pehlivanköy, Felahiye.
- 1981 il bağlantıları korundu: örneğin Batman ve Şırnak Siirt'e, Karabük ve Bartın Zonguldak'a, Düzce Bolu'ya, Kırıkkale Ankara'ya, Aksaray Niğde'ye, Karaman Konya'ya, Ovacık Çankırı'ya, Iğdır ve Ardahan Kars'a, Osmaniye Adana'ya, Kilis Gaziantep'e bağlı.
- İl adları: Urfa ve İçel tarihî adıyla. K.Maraş için Kahramanmaraş kullanıldı (Ek 1 başlığındaki gibi; ad 1973'ten beri geçerli).

## Önceki yarım deneme
`/tmp/claude-0/ilcesege-old/tr/` altındaki Ek 2, Ek 3 ve Tablo 8 transkripsiyonları yeniden kullanıldı, ama hepsi sayfa görüntüleriyle yeniden doğrulandı. Önceki CSV'de Tablo 7 ve Ek 3 yoktu; il adı Maraş'tı.
