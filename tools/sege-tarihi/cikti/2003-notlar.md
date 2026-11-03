# 2003 İllerin ve Bölgelerin SEGE araştırması: çıkarma notları

Kaynak: `kaynak/2003-il-sege.pdf` (DPT Yayın No 2671; Dinçer, Özaslan, Kavasoğlu; 257 sayfa, metin katmanı temiz). Sayfa numaraları **PDF sayfası**dır; basılı sayfa = PDF − 7.

## Çıktı
`2003.csv`, 468 satır:

| Tablo | Düzey | Gösterge | Satır |
|---|---|---|---|
| Tablo 7 | il | Gelişmişlik kademesi (1–5) | 81 |
| Grafik 2 | bolge | Gelişmişlik endeksi | 7 |
| Tablo 10 | duzey1 | Gelişmişlik endeksi (yalnız sıra) | 12 |
| Tablo 11 | duzey2 | Gelişmişlik endeksi (yalnız sıra) | 26 |
| Tablo 12 / 13 / 14 | il / bolge / duzey2 | İmalat sanayi gelişmişlik endeksi | 81 / 7 / 26 |
| Tablo 15 / 16 / 17 | il / bolge / duzey2 | Sağlık sektörü gelişmişlik endeksi | 81 / 7 / 26 |
| Tablo 18 / 19 / 20 | il / bolge / duzey2 | Eğitim sektörü gelişmişlik endeksi | 81 / 7 / 26 |

Genel il endeksi (Tablo 5) veritabanında zaten olduğu için CSV'ye **eklenmedi**.

## Rapordaki sonuç tabloları

| PDF s. | Başlık | İçerik | Durum |
|---|---|---|---|
| 62 | TABLO-5: İllerin SEGE sıralaması (2003) | 81 il, endeks (5 ondalık) | Yalnız kontrol için kullanıldı (aşağıda) |
| 63 | TABLO-6: 1996 ve 2003 sıralamalarının karşılaştırması | 76 il: 1996 sıra/endeks, 2003 sıra/endeks (76 il bazında), sıra değişimi | Atlandı. 2003 sırası Tablo 5'ten Yalova, Karabük, Kilis, Osmaniye ve Düzce çıkarılarak elde ediliyor; 1996 sütunu da 1996 Tablo 6'nın yuvarlanmış hâli. |
| 61 | Grafik-1 | Tablo 5'in grafiği | Atlandı |
| 78 | TABLO-7: Gelişmişlik endeksine göre kademeli il grupları | 1.–5. derece gelişmiş iller | Alındı |
| 79 | HARİTA-6 (ve Harita 1–5) | Kademelerin haritası | Atlandı (aynı veri) |
| 80 | TABLO-8: Kademeli il grupları itibarıyla göstergeler | Ham değişkenlerin grup ortalamaları | Atlandı (ham veri) |
| 82 | Grafik-2: Coğrafi bölgelere göre SEGE endeksi | 7 bölge endeksi | Alındı |
| 84 | Grafik-3: 1996 ve 2003 bölge endeksleri | Grafik 2 ve 1996 bölge değerlerinin tekrarı | Kontrol için kullanıldı |
| 86–103 | Grafik 4–10: Bölge illeri endeksi | Tablo 5'in tekrarı | Atlandı |
| 108–112 | TABLO-9: Coğrafi bölgeler itibarıyla göstergeler | Ham değişkenler | Atlandı |
| 113 | TABLO-10: İBBS Düzey-1'e göre SEGE sıralaması | 12 bölge, yalnız sıra ve üyelik; **endeks değeri basılmamış** (görüntüyle doğrulandı) | Alındı, `deger` boş |
| 114 | TABLO-11: İBBS Düzey-2'ye göre SEGE sıralaması | 26 alt bölge: sıra, üye iller ve illerin 81 içindeki sırası; **endeks değeri basılmamış** | Alındı, `deger` boş |
| 125 | TABLO-12: İmalat sanayii gelişmişlik sıralaması | 81 il: endeks, sektör sırası, genel sıra ve 8 ham değişken | Endeks ve sıra alındı |
| 126 | TABLO-13: Coğrafi bölgelere göre imalat sanayii | 7 bölge | Alındı |
| 127 | TABLO-14: Düzey-2'ye göre imalat sanayii | 26 alt bölge | Alındı |
| 130 | TABLO-15: Sağlık sektörü gelişmişlik sıralaması | 81 il | Alındı |
| 131 | TABLO-16: Coğrafi bölgelere göre sağlık | 7 bölge | Alındı |
| 132 | TABLO-17: Düzey-2'ye göre sağlık | 26 alt bölge | Alındı |
| 136 | TABLO-18: Eğitim sektörü gelişmişlik sıralaması | 81 il | Alındı |
| 137 | TABLO-19: Coğrafi bölgelere göre eğitim | 7 bölge | Alındı |
| 138 | TABLO-20: Düzey-2'ye göre eğitim | 26 alt bölge | Alındı |

Ayrıca atlananlar: Tablo 1–4 (yöntem), Ek-1 (s.160+, illere göre ham göstergeler), Ek-2 (İBBS cetveli), Ek-3 ve Ek-4 (Düzey-1 ve Düzey-2 ham göstergeleri).

**Raporda yalnız üç sektörel endeks var: imalat sanayii, sağlık ve eğitim.** Demografi, istihdam, tarım, mali ya da altyapı alt endeksi hesaplanmamış.

## Genel il endeksinin kontrolü (Tablo 5, s.62)
- İstanbul **4,80772**, Ankara **3,31483** ve Şanlıurfa **-0,83158** (68. sıra): üçü de verilen değerlerle **birebir eşleşiyor**.
- Sıra 1–81 eksiksiz ve endeks sıraya göre monoton azalan.
- Tablo 6'daki 2003 endeksleri Tablo 5'ten bazı illerde son hanede farklı:
  - 1e-5 fark: Gaziantep 0,46176/0,46175, Sakarya, Erzurum, Kırıkkale, Elazığ, Afyon, Kayseri, Şanlıurfa (-0,83157/-0,83158).
  - Daha büyük fark: Iğdır -0,89094 (Tablo 5'te -0,89089) ve Ardahan -1,07324 (Tablo 5'te -1,07318).
  - Asıl sıralama tablosu Tablo 5 olduğu için geçerli kabul edilmeli.

## Kontroller ve kararlar
- **Sıra ve monotonluk:** Sektörel tabloların hepsinde sıra eksiksiz (1–81, 1–7, 1–26) ve endeks monoton azalan.
- **Genel sıra sütunu:** Her sektörel tablodaki "Genel Gelişmişlik Sırası" şu kaynaklarla satır satır karşılaştırıldı ve hepsi eşleşti:
  - il tablolarında Tablo 5,
  - bölge tablolarında Grafik 2 sırası,
  - Düzey-2 tablolarında Tablo 11 sırası.
  Bu karşılaştırma, Düzey-2 sıralamasının Tablo 11 ile tutarlı olduğunu da doğruluyor.
- **Kademe (Tablo 7):** 1. derece 5 il (sıra 1–5), 2. derece 20 il (6–25), 3. derece 21 il (26–46), 4. derece 19 il (47–65), 5. derece 16 il (66–81). Kademeler Tablo 5 sırasına göre kesintisiz. `deger` = kademe, `sira` boş.
- **Düzey-1 ve Düzey-2:** Raporda yalnız sıra verilmiş, endeks değeri ne tabloda ne metinde (s.110–112) var. Satırlarda `gosterge`="Gelişmişlik endeksi", `deger` boş, `sira` dolu.
- **Veri yılı (`yil`):**
  - İmalat sanayii (metin: "Değişkenlerin tamamı 2000 yılı verilerini içermektedir") ve sağlık ("Tümü 2000 yılı verilerini içeren") → **2000**.
  - Eğitim endeksinde 3 değişken 2000, 3 değişken 2000–2001 öğretim yılına ait. Tek bir veri yılı olmadığı için **2003** yazıldı. İsterseniz 2000 yapılabilir.
  - Kademe ve bölge sonuçları genel endeksten geliyor; değişkenlerin çoğu 2000 yılına ait ama bazıları 1990–2000, 1995–2000 ya da 2000–01 → **2003**.
- **Ad düzeltmeleri:**
  - Tablo 12'de basımda kesilmiş il adları tamamlandı: GÜMÜŞHAN→GÜMÜŞHANE, KASTAMON→KASTAMONU, ZONGULDA→ZONGULDAK.
  - İl adları Tablo 5'teki gibi yazıldı (K.MARAŞ, AFYON, MERSİN, ISPARTA, IĞDIR).
- **Bölge adları:**
  - Coğrafi bölgeler: MARMARA, EGE, İÇ ANADOLU, AKDENİZ, KARADENİZ, GÜNEYDOĞU ANADOLU, DOĞU ANADOLU. Tablolardaki "G.DOĞU ANADOLU" tam ada çevrildi; adlar 1996.csv ile aynı.
  - Düzey-1 adları Tablo 10'daki gibi.
  - Düzey-2 adları "X Alt Bölgesi" biçiminde. Tablo 14'te yalnız "İstanbul", Tablo 11'de "İstanbul Alt B." yazıyor.
- **Değer biçimi:** Değerler basıldığı gibi alındı. Bazı hücrelerde sondaki sıfır düşürülmüş (ör. Tablo 14 Bursa 1,7394, Hatay -0,0276). Tablo 19 ve 20 ise 6 ondalıkla basılmış (ör. 1,242470).

## Coğrafi bölge üyeliği (2003, 81 il)
Grafik 4–10 ve metinle karşılaştırıldı.
- Marmara (11): 1996'daki 10 il + Yalova
- Ege (8): 1996 ile aynı
- İç Anadolu (13): 1996 ile aynı
- Akdeniz (8): 1996'daki 7 il + Osmaniye
- Karadeniz (18): 1996'daki 16 il + Karabük, Düzce
- Güneydoğu Anadolu (9): 1996'daki 8 il + Kilis
- Doğu Anadolu (14): 1996 ile aynı

## İBBS üyeliği (Tablo 10 ve 11, s.113–114)
Kodlar raporda basılı değil; standart 2002 İBBS kodları referans için eklendi.

| Düzey-1 (sıra) | Düzey-2 (sıra): üye iller |
|---|---|
| 1 İstanbul (TR1) | İstanbul Alt Bölgesi (1, TR10): İstanbul |
| 2 Batı Anadolu (TR5) | Ankara (2, TR51): Ankara · Konya (13, TR52): Konya, Karaman |
| 3 Doğu Marmara (TR4) | Bursa (4, TR41): Bursa, Eskişehir, Bilecik · Kocaeli (5, TR42): Kocaeli, Sakarya, Düzce, Bolu, Yalova |
| 4 Ege (TR3) | İzmir (3, TR31): İzmir · Aydın (8, TR32): Aydın, Denizli, Muğla · Manisa (12, TR33): Manisa, Afyon, Kütahya, Uşak |
| 5 Batı Marmara (TR2) | Tekirdağ (6, TR21): Tekirdağ, Edirne, Kırklareli · Balıkesir (10, TR22): Balıkesir, Çanakkale |
| 6 Akdeniz (TR6) | Antalya (9, TR61): Antalya, Isparta, Burdur · Adana (7, TR62): Adana, Mersin · Hatay (15, TR63): Hatay, K.Maraş, Osmaniye |
| 7 Batı Karadeniz (TR8) | Zonguldak (11, TR81): Zonguldak, Karabük, Bartın · Kastamonu (21, TR82): Kastamonu, Çankırı, Sinop · Samsun (18, TR83): Samsun, Tokat, Çorum, Amasya |
| 8 Orta Anadolu (TR7) | Kırıkkale (17, TR71): Kırıkkale, Aksaray, Niğde, Nevşehir, Kırşehir · Kayseri (16, TR72): Kayseri, Sivas, Yozgat |
| 9 Doğu Karadeniz (TR9) | Trabzon (19, TR90): Trabzon, Ordu, Giresun, Rize, Artvin, Gümüşhane |
| 10 Güneydoğu Anadolu (TRC) | Gaziantep (14, TRC1): Gaziantep, Adıyaman, Kilis · Şanlıurfa (23, TRC2): Şanlıurfa, Diyarbakır · Mardin (24, TRC3): Mardin, Batman, Şırnak, Siirt |
| 11 Ortadoğu Anadolu (TRB) | Malatya (20, TRB1): Malatya, Elazığ, Bingöl, Tunceli · Van (26, TRB2): Van, Muş, Bitlis, Hakkari |
| 12 Kuzeydoğu Anadolu (TRA) | Erzurum (22, TRA1): Erzurum, Erzincan, Bayburt · Ağrı (25, TRA2): Ağrı, Kars, Iğdır, Ardahan |
