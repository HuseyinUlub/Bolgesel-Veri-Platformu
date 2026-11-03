# 1985 SEGE (DPT / KÖYB) — çıkarım notları

Kaynak: `kaynak/1985-il-ilce-sege.pdf`, "İl ve İlçelerin Ekonomik ve Sosyal Gelişmişlik Seviyelerinin Tesbiti Araştırması", DPT Yayın No 2015 / KÖYB 30, Kalkınmada Öncelikli Yöreler Başkanlığı, Ekim 1985 (94 sayfa, taranmış, metin katmanı OCR).
Sayfa numaraları: CSV'deki `sayfa` **PDF sayfası**dır. Basılı sayfa numarası = PDF sayfası − 3.

## Bulunan tablolar

| Tablo | PDF sayfası | Satır | gosterge |
|---|---|---|---|
| İllerin gelişmişlik seviyelerine göre sıralanması (sıra, il, 1. ana bileşen değeri) | 23–25 | 67 | Gelişmişlik endeksi (1. ana bileşen) |
| İlçelerin gelişmişlik seviyelerine göre sıralanması (sıra, ilçe, bağlı olduğu il, 1. ana bileşen değeri) | 33–49 | 616 | Gelişmişlik endeksi (1. ana bileşen) |
| EK 1: İlçelerin bağlı oldukları iller içinde sıralanması (il içi sıra + 616 içindeki sıra) | 52–70 | 616 | İl içi gelişmişlik sırası (deger boş) |
| EK 2: İstanbul, Ankara, İzmir dışındaki merkez ilçelerin sıralanması | 71–72 | 64 | Merkez ilçeler arasında gelişmişlik sırası (deger boş) |

Toplam 1363 satır; emin=0: 5 satır.

Tablo I (il, ilk 10 kök varyans), Tablo II (il değişken yükleri), Tablo III (ilçe, ilk 5 kök) ve Tablo IV (ilçe değişken yükleri) çıkarılmadı (yöntem tabloları).

## Yöntem, değişkenler, veri yılları

- Yöntem: temel bileşenler analizi; endeks = 1. ana bileşen skoru (döndürülmemiş). Program Fortran, Burroughs B 1900.
- **İller:** 67 il, 52 değişken (43 ilin tamamı, 9 kırsal alan). 1. bileşen toplam varyansın %46,52'sini açıklıyor. Değişken yılları 1980–1985 arası karışık: 1980 Genel Nüfus Sayımı (nüfus, istihdam yapısı), 1981 (Köy Envanter Etüdü'nden buzdolabı), 1982 (imalat sanayi, tarımsal üretim), 1983 (inşaat, vergi, taşıt, akaryakıt, sanayi dışı elektrik), 1984 (okuryazarlık, okullaşma, mevduat, krediler, TV/video, elektrikli köy), 1985 (doktor, eczane, hastane yatağı, gübre, asfalt yol). Kamu yatırımları 1963–1984 toplamı.
- **İlçeler:** 616 ilçe, 29 değişken. 1. bileşen varyansın %38,94'ünü açıklıyor (ilk 5 bileşen %67,14). Veri yılları: 1980 Genel Nüfus Sayımı (istihdam yapısı, merkez nüfus oranı), 1975–1980 (nüfus artışı, göç), 1981 Köy Envanter Etüdü (kırsal göstergeler), 1982 tarım istatistikleri, 1983 sonu banka kredileri/mevduatı ve 1983 vergi.
- Tek bir veri yılı yok. Endeks yaklaşık 1980–1985 verisine dayanıyor, ağırlığı 1980–1983'te. Bu nedenle `yil` = çalışma yılı **1985**.

## Kapsam dışı ilçeler (s. 25–26, EK 1 notları)

29 ilçe kapsam dışında (616 + 29 = 645):
- Yeni kurulmuş, verisi olmayanlar: Düziçi (Adana), Keçiören, Mamak, Gölbaşı, Sincan (Ankara), Aliağa (İzmir), Dalaman (Muğla), Ceylanpınar (Urfa).
- Büyükşehir bütünü içinde ayrılamayanlar: Altındağ, Çankaya, Yenimahalle (Ankara); Adalar, Bakırköy, Beşiktaş, Beykoz, Beyoğlu, Eminönü, Eyüp, Fatih, Gaziosmanpaşa, Kadıköy, Kartal, Sarıyer, Şişli, Üsküdar, Zeytinburnu (İstanbul); Merkez, Bornova, Karşıyaka (İzmir).
- Bu yüzden İstanbul, Ankara ve İzmir'in merkez ilçesi ilçe tablosunda **yok**. Bu illerde yalnız çevre ilçeler var (İstanbul 4, Ankara 17, İzmir 16).

## Ad normalizasyonu

- İl adları çalışmadaki gibi: İçel, Kahramanmaraş, Şanlıurfa, Afyonkarahisar ("A.Karahisar"). Isparta, Tablo 1'deki gibi yazıldı (ilçe tablosunda "İsparta" diye de geçiyor).
- Merkez ilçelerde parantezli adlar kaldırılıp yalnız `Merkez` yazıldı: Merkez(Mersin) İçel, Merkez(İzmit) Kocaeli, Merkez(Adapazarı) Sakarya, Merkez(Antakya) Hatay, Merkez(Karaköse) Ağrı.
- Kısaltmalar ve yazım hataları düzeltildi:
  - Ş.Koçhisar → Şereflikoçhisar; M.Kemalpaşa → Mustafakemalpaşa; Ş.Karahisar (EK 1) → Şebinkarahisar.
  - "Yolava" (s.33'te basılı) → Yalova; "Sürüç" → Suruç; "Pötürge" → Pütürge; "Hinyan" (EK 1) → Bünyan; "Aluca" (EK 1) → Alucra.
  - "Tufanbeyli (Mağara)" → Tufanbeyli; "Sinanpaşa (Sincanlı)" → Sinanpaşa.
- Batman, Şırnak, Bartın, Karabük, Yalova, Kilis, Düzce, Iğdır, Ardahan, Bayburt, Aksaray, Karaman, Kırıkkale, Osmaniye bu dönemde ilçe. 1985'teki bağlı oldukları ile göre yazıldı (ör. Batman → Siirt, Karabük → Zonguldak, Yalova → İstanbul).
- OCR hataları (B→E/H/R/Ih, "Mana"→Adana, "Edime"→Edirne vb.) her sayfa görüntüden okunarak düzeltildi.

## Yapılan kontroller

1. **Görüntü doğrulaması:** Tüm tablo sayfaları (23–25, 33–49, 52–72) 150 dpi görüntü olarak tek tek okundu. Ad, il ve değerler metin katmanıyla karşılaştırıldı. Metin katmanında satır kayması olan sayfalar (s.36, 39, 42, 45, 47–49) görüntüden elle yazıldı.
2. **Sıra bütünlüğü:** İl 1..67 ve ilçe 1..616 eksiksiz ve tekrarsız. (ilçe, il) çiftleri benzersiz (616).
3. **Monotonluk:** İl ve ilçe değerleri sıraya göre artmıyor (non-increasing): ihlal yok. Eşit değerli sıralar: 160/161, 168/169, 294/295, 471/472, 527/528, 608/609.
4. **Ana tablo ile EK 1:** Her ilin ilçe sayısı ve il içi sıralaması, ana tablodan türetilen sıralamayla karşılaştırıldı. Basılı il içi sıralar tutuyor. Bulunan basım hataları aşağıda. Hepsinde ana tablo esas alındı: değer sırası ve sayfa akışı ana tabloyu doğruluyor.
   - Çorum / Osmancık: EK 1'de 336 (bulanık), ana tabloda **386** (336 = Banaz/Uşak).
   - Giresun / Dereli: EK 1'de 506, ana tabloda **516** (506 = Reşadiye/Tokat).
   - Konya / Akşehir: EK 1'de 144, ana tabloda **145** (144 = Sultanhisar/Aydın).
   - Niğde / Aksaray: EK 1'de 234, ana tabloda **239** (234 = Merkez/Tokat).
   - EK 1'de basılmamış satırlar: Aydın il içi 6–8 (Yenipazar 99, Sultanhisar 144, Koçarlı 173) ve Çankırı il içi 5 (Ilgaz 337). Basılı numaralama bu satırları atlıyor (Aydın 5'ten 9'a, Çankırı 4'ten 6'ya geçiyor). CSV'ye ana tablodan türetilen il içi sırayla **emin=0** olarak eklendi (sayfa 54 ve 56).
5. **EK 2:** 64 merkez ilçenin parantez içindeki 616 sırası, ana tablodaki Merkez satırlarıyla birebir tutuyor. İl sayısı 67 − 3 = 64. s.71'de Bursa "(9)" diye OCR'lanmış, görüntüde üst üste basılmış bir "(4)" var: 4 doğru.
6. İl listesi (il tablosu) ile ilçe tablosundaki il kümesi aynı (67 il).

## Belirsiz ve emin=0 satırlar

- İlçe sıra 101, Foça (İzmir): değerin üçüncü ondalığı üst üste basılmış ("0,93?5"). Metin katmanı 0,9305 okuyor, 0,9385 de olabilir. İki değer de sıralamaya uyuyor. 0.9305 yazıldı, emin=0.
- EK 1'de basılmamış 4 satır (yukarıda), emin=0.
- Güvenle düzeltilenler (emin=1): sıra 592 Tutak "1,4260" ve 597 Şırnak "1,4988" eksi işaretsiz basılmış, sıralama gereği -1,4260 / -1,4988. Sıra 223 Gerede ":,2533" → 0,2533. Sıra 231 Seyitgazi görüntüde "1,2214" gibi görünüyor, metin katmanı ve sıralama 0,2214.

## Atlananlar

- EK 3: İmalat sanayiinin nisbeten önemli olduğu ilçeler (PDF ~73–75)
- EK 4: Kırsal nüfus başına hayvansal üretim değeri yüksek ilçeler
- EK 5: Madencilik ve taş ocakçılığı istihdam payı yüksek ilçeler
- EK 6: Ücretli çalışanların toplam istihdama oranına göre iller
- EK 7: İlçeler çalışmasında 1. ana bileşenin döndürme öncesi ve sonrası korelasyonları
- EK 8: Kalkınmada öncelikli 28 ilde istihdamın yapısı (PDF ~85–90)
- Haritalar 1–2: il ve ilçe gelişmişlik gruplandırmaları

Bunlar özel özellikli liste veya yöntem ekleri olduğu için çıkarılmadı.
