# 1966 İlçelere göre SEGE endeksi çalışması II: çıkarma notları

Kaynak: `kaynak/1966-ilce-sege.pdf`. DPT Yayın No 403, Mart 1966. Başlık: "İlçelere göre sosyo-ekonomik yönden gelişmişlik endeksi çalışması II" (iç başlık "İlçe seviyesinde gelişmişlik endeksi çalışması"). PDF 72 sayfa, taranmış daktilo metni. OCR katmanı gürültülü; bütün değerler 200 dpi sayfa görüntülerinden okundu. Sayfa numaraları **PDF sayfası**dır; tablo sayfalarında basılı sayfa = PDF − 5.

## Ne ölçülüyor
- Birim ilçe. Toplam 67 il ve 637/638 ilçe var (metinde iki sayı da geçiyor, s.5). Bunların 64'ü kapsam dışı bırakılmış: 1960 sayımında belediye nüfusu yüksek olan ilçeler, çoğu merkez ilçe (Ek 1, s.15–18). Kalan **573 ilçe** değerlendirilmiş.
- Merkezi kapsam dışı kalan iller için o ilin merkez ilçesi listede yok. Örneğin İstanbul'da yalnız Çatalca, Kartal, Silivri, Şile ve Yalova var; Ankara ve Konya'nın merkezi yok.
- 15 gösterge kullanılmış (s.6–7). Ekonomik: tasarruf bonosu, gider vergisi, sanayi elektriği, banka sayısı ve muamele vergisi, TMO ve Şeker alımları (hepsi 1964), karayolu (1965). Sosyal: otel ve lokanta kapasitesi, ilkokul, öğrenci ve öğretmen, belediye gideri, hasta yatağı (1964), radyo ve taşıt sayısı (1965). Nüfus 1960 sayımı ve 1965 tahmininden enterpole edilmiş.
- Yöntem (s.8–11): her oran Türkiye ortalaması = 100 olacak şekilde mekân endeksine çevrilmiş. Sonra ağırlıklı aritmetik ortalama alınmış; ağırlıkların toplamı 100, ekonomik 33, sosyal 67. **Endeks birimi: Türkiye ortalaması = 100**, tamsayı; en yüksek 606 (Batman), en düşük 24 (Espiye).
- `yil`: veriler ağırlıkla 1964, bir kısmı 1965 yılına ait; tek bir yıl belirtilmemiş. Bu nedenle `yil` = çalışma yılı **1966**.

## Tablolar

| PDF s. | İçerik | Durum |
|---|---|---|
| 15–18 | Ek 1: Kapsam dışı tutulan 64 ilçe ve illeri | Atlandı (değer yok) |
| 19–41 | Ek 2: Alfabetik il sırasına göre ilçe endeksleri (sırasız) | Ayrı satır olarak alınmadı; Ek 3 ile satır satır çapraz kontrol için kullanıldı |
| 42–64 | Ek 3: Endeks değerine göre büyükten küçüğe sıralı ilçeler (Sıra No, Derece, İlçe, İl, Endeks) | **Alındı** |
| 65–67 | Ek 4: Endeks gruplarına göre ilçe sayıları | Atlandı (yalnız eşik ve sayı). Kontrol için kullanıldı |
| 68 | Ek 5: Gruplara göre ilçe haritası | Atlandı |
| 69 | Yanlış-doğru cetveli | Yalnız metin düzeltmeleri; tabloları etkilemiyor |

Raporda **il düzeyinde sonuç yok**. Bütün satırlar `duzey=ilce`.

## CSV
`1966-ilce.csv`, 1146 satır (573 ilçe × 2 gösterge), sayfa 42–64:

| `gosterge` | `deger` | `sira` |
|---|---|---|
| Gelişmişlik endeksi (Türkiye ortalaması = 100) | endeks | Sıra No (1–573) |
| Gelişmişlik derecesi (eşit endekse aynı derece) | boş | Derece (1–160; eşit endeksler aynı dereceyi alıyor) |

## Kontroller
- Ek 3'ün 23 sayfasının tamamı görüntüyle satır satır karşılaştırıldı.
- **Sıra No:** 1–573 eksiksiz ve tekrarsız.
- **Derece:** Endeks değiştiğinde 1 artıyor, eşit endekste aynı kalıyor; 573 satırda bir istisna bile yok. Son derece 160.
- **Monotonluk:** Endeks Sıra No'ya göre hiç artmıyor.
- **Ek 4 grupları:** A (≥200) 17, B (120–199) 93, C (80–119) 145, D (50–79) 225, E (<50) 93 ilçe; toplam 573. Ek 3'ten sayılan grup büyüklükleri Ek 4 ile birebir aynı.
- **Ek 2 ile Ek 3:** 573 ilçenin tamamında il, ad ve endeks karşılaştırıldı. 67 il, il başına ilçe sayıları aynı. Fark çıkan 6 satır `emin=0` (her ilçenin iki göstergesi; toplam 12 satır):
  - Alanya: Ek 2'de 90, Ek 3'te 99. Sıra 170, komşu değerler 100 ve 99; Ek 3 değeri sırayla tutarlı.
  - Biga: Ek 2'de 90, Ek 3'te 89 (sıra 217).
  - Çankırı Merkez: Ek 2'de 141, Ek 3'te 142 (sıra 70).
  - Sivrihisar: Ek 2'de 125, Ek 3'te 145 (sıra 62).
  - Karacasu: Ek 3'te il "Afyon" basılmış; Ek 2'de Aydın altında (aynı değer, 65). Aydın yazıldı.
  - Darende: Ek 3'te il "Hatay" basılmış; Ek 2'de Malatya altında (aynı değer, 64). Malatya yazıldı.
  - Bu durumlarda değer ve sıra Ek 3'ten alındı.

## Adlar
- İl adları 1966'daki gibi: Maraş, Urfa, İçel, Afyon. Hakkâri → Hakkari, Elâzığ → Elazığ.
- İlçe adlarında düzeltilen baskı ve yazım farkları (Ek 2 ile teyitli):
  - Bayhan → Baykan; Kuyuluhisar → Koyulhisar; Kufcaz → Kofçaz; Sürüç → Suruç; Ürfüp → Ürgüp; İncesi → İncesu; Ermenak → Ermenek.
  - Kısaltmalar açıldı: Ş. Karahisar → Şebinkarahisar, Ş. Koçhisar → Şereflikoçhisar, M.Kemalpaşa → Mustafakemalpaşa.
  - Şapkalar kaldırıldı: Balâ, Kemâh, Lâlâpaşa, Felâhiye, Devrekâni, Eflâni, Lâpseki.
- Dönemin adları korundu: Mağara (Adana), İmroz, Sincanlı (Afyon), Akdağmadeni, Bornova (İzmir'in merkez dışı ilçesi). Ankara'da Elmadağ (Ek 2'de "Elmadağı").
- 1966 il bağlantıları korundu: Batman, Şırnak ve Baykan Siirt'e, Bartın Zonguldak'a, Kırıkkale ve Kızılcahamam Ankara'ya, Aksaray Niğde'ye, Karaman Konya'ya, Osmaniye Adana'ya, Iğdır ve Ardahan Kars'a, Bayburt Gümüşhane'ye bağlı.

## Önceki yarım deneme
`/tmp/claude-0/ilcesege-old/tr/e3_66.txt` (Ek 3, 573 satır) kullanıldı. İçeriği bütün sayfalarda görüntüyle doğrulandı ve hatasız çıktı; yalnız il ve ad düzeltmeleri yukarıdaki gibi yapıldı. Ek 2 baştan sona görüntüden okunarak Ek 3 ile karşılaştırıldı.
