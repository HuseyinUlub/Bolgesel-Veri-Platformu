# 1972 — Türkiye'de İller İtibariyle Sosyo-Ekonomik Gelişmişlik Endeksi (1963-1970)

## Kaynak
- Dosya: `kaynak/1972-il-sege.pdf` (128 sayfa, yalnızca taranmış görüntü, metin katmanı yok)
- Başlık: *Türkiye'de İller İtibariyle Sosyo-Ekonomik Gelişmişlik Endeksi (1963-1970)*
- Yazar: Dr. Barlas TOLAN — DPT, SPD Araştırma Şubesi, Toplum Yapısı Araştırmaları Birimi
- Yayın No: DPT 1282 – SPDZ 52; Aralık 1972 (kapak "Bu çalışma DPT'nin görüşlerini yansıtmaz" ibaresini taşır)
- Önsöz: 1963-1967 dönemini kapsayan önceki araştırmanın (DPT 900-SPD 207, Haziran 1970) 1970'e uzatılmış hâli. Yöntem aynı; 1963-1967 verilerinin bir kısmı yeniden toplandığı için önceki yayınla farklar olabilir. Yöntem metinde ayrıntılı anlatılmıyor; sayfa 6-12'de yalnızca 22 göstergenin veri kaynakları sıralanıyor.
- 67 il (dönemin adlarıyla: Maraş, Urfa, İçel, Afyon, Gümüşhane vb.). Bölge (bölge/İBBS) düzeyinde tablo **yok**.

## Belge yapısı (içindekiler, s. 3)
| Tablo | PDF sayfa | İçerik | Çıkarıldı mı |
|---|---|---|---|
| A. 1970 yılı nihai değerlendirmesi | 13 | 67 il, sıra + 1970 nihai endeks (Türkiye 1970=100) | Evet (68 satır, Türkiye dahil) |
| B. 1963 ve 1970 sıralamalarının karşılaştırılması | 14 | 1963 endeksi (Türkiye 1963=100) ve 1970 endeksi (Türkiye 1970=100), ayrı sıralar | Hayır: 1970 sütunu Tablo A ile, 1963 sütunu Tablo C'nin 1963 sütunu ile birebir aynı (kontrol edildi). B'nin 1963 değerleri 24-33. sıralarda soluk basılmış, C ve E'den okunmuştur |
| C. Büyüklük sırasına göre illerin genel endeks değerleri | 15 | 1963-1970 her yıl için il sırası ve genel endeks, **sabit taban Türkiye 1963=100** (Türkiye: 100.0, 110.3, 121.8, 132.8, 144.6, 166, 180.8, 191.7) | Evet (8 yıl × 68 satır) |
| D. 1963-1970 arasında sıra değişimleri | 16 | Sıra değişim sayısına göre gruplanmış il listesi (metin biçimi) | Hayır: A/C'den türetilebilir, sayısal değer yok |
| E. 1963-1970 döneminde gelişme hızlarına göre sıralama | 17 | İl başına 1963 ve 1970 endeksi (Türkiye 1963=100) + 1970 değeri (ilin 1963 değeri=100) ve sıra | Yalnızca gelişme hızı sütunu (68 satır); 1963/1970 sütunları C ile aynı |
| F.1-22 Ham veriler | 19-40 | 22 göstergenin ham değerleri, 1963-1970 | Hayır (ham gösterge, endeks değil) |
| G.1-22 Gösterge endeksleri (alfabetik) | ~42-82 | Her gösterge için il × yıl endeksi (Türkiye 1963=100) | Hayır (bkz. aşağı) |
| H.1-22 Gösterge endeksleri (büyüklük sırasına göre) | ~84-106 | G ile aynı değerler, sıralı | Hayır |
| İ.1-22 Göstergelerin 1963-1970 gelişme hızları | ~108-127 | Her gösterge için gelişme (1963=100) sıralaması | Hayır |

22 gösterge (G/H başlıklarından): 1 imalat sanayii katma değeri/sanayi+hizmet çalışan nüfus; 2 sanayi+hizmet çalışan/toplam çalışan; 3 10.000+ yerleşme nüfusu/il nüfusu; 4 sendikalı işçi/sanayi+hizmet nüfusu; 5 banka hesap sayısı/çalışan; 6 banka-sigorta muamele vergisi/banka şube-ajans sayısı; 7 mevduat/çalışan; 8 kredi/çalışan; 9 sınai bitki+meyve ekim alanı/toplam ekim; 10 traktörle sürülen/toplam tarla; 11 tarımsal nüfus başına gelir; 12 nüfus/doktor; 13 okur-yazar/6+ yaş; 14 7-11 yaş/ilkokul öğretmeni; 15 ilköğretim öğrencisi/7-11 yaş; 16 ortaöğretim öğrencisi/12-17 yaş; 17 tedavi kurumlarına müracaat/nüfus; 18 devlet karayolu/il yüzölçümü; 19 aydınlatma elektriği/belediye nüfusu; 20 gazete satışı/okur-yazar; 21 nüfus/radyo; 22 gelir vergisi/sanayi+hizmet nüfusu.

**Alt endeks yok:** belgede ekonomik/sosyal gibi bileşik alt endeksler bulunmuyor; genel endeksin altında yalnızca 22 tekil gösterge endeksi (G/H/İ) var. Bunlar (22 × 67 × 8 ≈ 11.800 değer, düşük baskı kalitesi) bu turda çıkarılmadı; gerekirse ayrı bir iş olarak ele alınabilir.

## CSV (`1972.csv`)
- 680 satır: Tablo A 68, Tablo C 8 × 68 = 544, Tablo E 68. Bunların 670'i il, 10'u `duzey=ulke` (Türkiye referans satırı, `sira` boş).
- `gosterge`:
  - A: `Genel gelişmişlik endeksi (Türkiye 1970=100)`, yil=1970
  - C: `Genel gelişmişlik endeksi (Türkiye 1963=100)`, yil=1963…1970 (sütun başlıkları). **Dikkat:** taban sabittir; yıllar arası karşılaştırma yapılabilir. C'nin 1970 değeri / 1.917 = A değeri.
  - E: `Genel endeksin 1963-1970 gelişmesi (1970 değeri, ilin 1963 değeri=100)`, yil=1970
- `yil`: tablo/sütun başlıklarında basılı referans yılı.
- `sira`: A ve E'de basılı sıra no; C'de sıra no yalnızca 1963 sütunu için basılı, diğer yıllarda sıra, Türkiye satırı çıkarılarak satır konumundan verilmiştir. Eşit değerler basılı sırayı korur.
- İl adları dönemin yazımıyla, küçük-büyük harf düzeltilmiş (Tablo A büyük harf basılı).

## Doğrulamalar
- Her yıl sütununda 67 il + Türkiye, küme tam (eksik/fazla il yok).
- Değerler sıra ile monoton (istisnalar aşağıda).
- C 1970 / 191.7 × 100 ≈ A (1 istisna dışında hepsi ±0.05 içinde).
- E'nin 1963 sütunu C 1963 ile tümüyle aynı; E gelişme hızı = 1970/1963 × 100 (1 istisna dışında ±0.15 içinde).

## Belirsiz ve tutarsız değerler (emin=0, 9 satır)
- C 1966 Adana 175.8: son hane soluk (6 veya 8 olabilir).
- C 1967 Gaziantep 128.0: ikinci hane soluk (sıra aralığı 127.7-132.2).
- C 1967 Antalya 114.2, Muğla 112.2, Bolu 104.1: ondalık hane soluk.
- C 1968 Elazığ 138: il adı ve değer soluk; ad eleme ile belirlendi.
- C 1969 Kayseri 147.4: soluk; önceki/sonraki satır 147.4 olduğundan bu değer.
- C 1970 Sakarya **196.6** net basılı ancak kaynak kendi içinde tutarsız: A/B'deki 104.1 ve E'deki 199.6 → doğrusu büyük olasılıkla 199.6.
- E Eskişehir **197.0** net basılı ama 227.5/115.1 = 197.65 ve Muğla (197.5) üstünde sıralanmış → baskı hatası, doğrusu büyük olasılıkla 197.6.
- Diğer notlar (emin=1): C 1965'te Antalya 100.3 (19. sıra), Elazığ 101.2'nin (20. sıra) önünde basılı; sıra basıldığı gibi alındı. E'deki Nevşehir 1970 değeri 129.3, C'deki 129.2 (E'nin bu sütunu CSV'de yok).
