# 1996 İllerin SEGE araştırması: çıkarma notları

Kaynak: `kaynak/1996-il-sege.pdf` (DPT Yayın No 2466, 164 sayfa, taranmış ve OCR'lı). Sayfa numaraları **PDF sayfası**dır; basılı sayfa = PDF − 10.

## Çıktılar
- `1996.csv`: 83 satır (76 il + 7 coğrafi bölge).
- `1996-ilce.csv`: 1716 satır (858 ilçe × 2 gösterge). Ayrı dosyada tutuldu, çünkü görev tanımı `ilce` sütununun boş olmasını ve `duzey` değerinin il/bölge olmasını istiyordu. Bu dosyada `duzey=ilce` kullanıldı. Birleştirmek isterseniz başlık aynıdır.

## Rapordaki sonuç tabloları

| PDF s. | Başlık | İçerik | Durum |
|---|---|---|---|
| 59 | TABLO-6: İllerin sosyo-ekonomik gelişmişlik sıralaması | 76 il için SIRA, İL ve ENDEKS (6 ondalık) | Alındı (`il`, "Gelişmişlik endeksi") |
| 60 | GRAFİK-1 | Tablo 6'nın grafiği | Atlandı (aynı veri) |
| 62 | GRAFİK-2: Coğrafi bölgeler itibariyle SEGE endeksi | 7 bölge endeksi (5 ondalık). Değerler s.61–64 metninde de geçiyor. | Alındı (`bolge`, "Gelişmişlik endeksi") |
| 65, 69, 72, 75, 78, 81, 84 | GRAFİK-3…9: Bölge illeri gelişmişlik endeksi | Tablo 6 değerlerinin 5 ondalığa yuvarlanmış hâli | Atlandı (aynı veri). Bölge üyeliğini doğrulamak için kullanıldı. |
| 89 | TABLO-7: Coğrafi bölgeler itibariyle sosyo-ekonomik göstergeler | Ham değişkenler (endeks yok) | Atlandı (ham veri) |
| 116–136 | EK-3: İlçelerin SEGE sıralaması | 858 ilçe için sıra, endeks (6 ondalık) ve gelişmişlik grubu (1–6) | Alındı → `1996-ilce.csv` |
| 139–162 | EK-4: İlçelerin bağlı oldukları il içindeki sıralaması | 858 içindeki sıra ve il içi sıra | Atlandı: Ek-3'ten türetilebiliyor. OCR bu sayfalarda çok bozuk. |

Ayrıca atlananlar: s.49–55'teki Tablo 1–5 (değişkenler, varyanslar, korelasyonlar, yükler, ağırlıklar), s.95–101'deki Ek-1 (ham il değişkenleri) ve s.103–110'daki Ek-2 (korelasyon matrisi).

**1996 il raporunda sektörel alt endeks (demografi, eğitim, sağlık, imalat vb.) yok. İllerin kademe/derece grupları da yok.** Tek gruplama, Ek-3'teki ilçe "Gelişmişlik Grubu"dur (1–6).

## 1996.csv
- **İl endeksi (Tablo 6):** Sıra 1–76 eksiksiz ve endeks sıraya göre kesin azalan. Değerler 170 dpi görüntüyle satır satır karşılaştırıldı, hepsi eşleşiyor. Aynı veriyi veren Grafik 3–9 ve 2003 raporundaki Tablo 6'nın 1996 sütunu da (5 ondalık) yuvarlama farkı dışında tutuyor.
- **İl adları:** Basıldığı gibi büyük harfle yazıldı (İÇEL, K.MARAŞ, AFYON). OCR düzeltmeleri: `ŞİRNÂK`→ŞIRNAK, `İĞDİR`→IĞDIR, `İSPARTA`→ISPARTA (görüntüde noktasız I).
- **Kapsam:** 1995–96'da il olan Yalova, Karabük, Kilis ve Osmaniye bu çalışmada yok (76 il).
- **Coğrafi bölge endeksi (Grafik 2):** Bölge adları tam yazıldı. Grafikteki kısaltmalar "GD. ANADOLU" ve "D.ANADOLU" idi; bunlar GÜNEYDOĞU ANADOLU ve DOĞU ANADOLU olarak kaydedildi. Değerler grafik etiketi, metin ve 2003 raporunun Grafik 3'ü (s.84) ile üç yönden doğrulandı.
- **Bölge üyeliği (Grafik 3–9'dan), toplam 76 il:**
  - Marmara (10): İstanbul, Kocaeli, Bursa, Tekirdağ, Balıkesir, Kırklareli, Bilecik, Edirne, Çanakkale, Sakarya
  - Ege (8): İzmir, Muğla, Aydın, Denizli, Manisa, Uşak, Kütahya, Afyon
  - İç Anadolu (13): Ankara, Eskişehir, Kayseri, Konya, Kırıkkale, Nevşehir, Kırşehir, Karaman, Niğde, Sivas, Aksaray, Çankırı, Yozgat
  - Akdeniz (7): Antalya, Adana, İçel, Isparta, Hatay, Burdur, K.Maraş
  - Karadeniz (16): Zonguldak, Bolu, Trabzon, Samsun, Rize, Amasya, Kastamonu, Çorum, Giresun, Artvin, Bartın, Tokat, Sinop, Ordu, Gümüşhane, Bayburt
  - Güneydoğu Anadolu (8): Gaziantep, Diyarbakır, Şanlıurfa, Adıyaman, Batman, Mardin, Siirt, Şırnak
  - Doğu Anadolu (14): Malatya, Elazığ, Erzincan, Erzurum, Tunceli, Kars, Van, Iğdır, Hakkari, Bitlis, Ardahan, Bingöl, Ağrı, Muş
- **yil = 1996:** Değişkenlerin yılları karışık (1990–1994), tek bir veri yılı yok.

## 1996-ilce.csv (Ek-3)
- **Kaynak çalışma:** Ek-3, ayrı bir çalışma olan "İlçelerin SEGE Sıralaması"nın (DPT 1996) sonuçlarını veriyor. Aralık 1993 idari yapısı esas alınmış, 32 değişken kullanılmış, veriler 1990–93 yıllarına ait. Tek bir veri yılı olmadığı için `yil=1996`.
- **Kapsam:** Karabük, Kilis, Yalova ve Osmaniye bağlı oldukları illerin ilçesi olarak yer alıyor (örneğin ZONGULDAK/Karabük, İSTANBUL/Yalova).
- **Büyükşehir satırları:** Adana, Bursa, Gaziantep, Kayseri ve Konya'nın büyükşehir ilçeleri birleştirilip tek "Büyükşehir" satırı yapılmış. İstanbul, Ankara ve İzmir'in büyükşehir ilçeleri ise sıralamaya dahil değil ("gelişmiş merkez" kabul edilmiş, s.113 ve 116).
- **Göstergeler:** Her ilçe için iki satır var: "Gelişmişlik endeksi" (`sira` = 858 içindeki sıra) ve "Gelişmişlik grubu" (`deger` 1–6, `sira` boş).
- **Grup büyüklükleri:** 1:15, 2:103, 3:209, 4:335, 5:96, 6:100. Gruplar sıraya göre kesintisiz ilerliyor.
- **Kontroller:** Sıra 1–858 eksiksiz ve tekrarsız. Endeks sıraya göre monoton azalan. Toplam 76 il var; 68 "Merkez" ve 5 "Büyükşehir" satırı bulunuyor, üç büyükşehirde merkez satırı yok.
- **Görüntüyle düzeltilen satırlar (satırı bölünmüş ya da ad kaymış):**
  - Satırı bölünmüş sıralar: 319, 573, 577, 619–621, 625, 626, 632, 636, 644, 649 (s.131 görüntüsüyle doğrulandı).
  - Ad kaymış satırlar: 98 Abana, 175/539/551/562 Gümüşhane, 387 Of, 652 Oğuzlar, 653 Balya, 655 Ortaköy (Çorum), 844 Diyadin.
  - Son sayfa (s.136) tümüyle görüntüyle karşılaştırıldı.
- **İlçe adlarında OCR düzeltmeleri:**
  - Aiacakaya→Alacakaya, Altmekin→Altınekin, Damai→Damal, Mazgirî→Mazgirt, Oyacı k→Ovacık (Tunceli), Orta köy→Ortaköy (Aksaray), Sarı kaya→Sarıkaya, Kazimkarabekir→Kazımkarabekir
  - PolatlI→Polatlı, KaraisalI→Karaisalı, SincanlI→Sincanlı
  - Küçük harfle başlayan/noktası düşen İ ve Ö: Ibradı, Idil, Ihsangazi, Iscehisar, ihsaniye, ikizce, ikizdere, incirliova, inebolu, inhisar, ispir, iyidere, ödemiş → İ…/Ö…
  - İl adında: İĞDIR→IĞDIR.
- **Kalan belirsizlik:** Endeks değerleri monotonluk kontrolünden geçti. Yine de 858 ilçe adının hepsi tek tek görüntüyle karşılaştırılmadı; tek harflik OCR hataları kalmış olabilir. İl adları olduğu gibi bırakıldı (İÇEL, K.MARAŞ, AFYON).
