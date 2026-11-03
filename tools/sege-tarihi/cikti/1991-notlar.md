# 1991 SEGE çalışması: çıkarım notları

**Kaynak:** `kaynak/1991-il-sege.pdf` (38 sayfa). DPT Yayın No: DPT 2265, KÖYBKGM 35. *İllerin Ekonomik ve Sosyal Gelişmişlik Seviyelerinin Tespiti Araştırması*, Ekim 1991 ("Gizli" damgalı).

## Referans yıl
Değişken yılları karışık:
- 1990 nüfus sayımından 2 değişken (şehirleşme, yoğunluk)
- 1985 sayımından 16 değişken (göç, doğurganlık, istihdam yapısı, okuryazarlık, bebek ölümü vb.)
- 1988'den 7 değişken (imalat sanayii, bitkisel üretim)
- 1989'dan 26 değişken (sağlık, okullaşma, banka, vergi, altyapı, taşıt, enerji, PTT)
- Kamu yatırımı değişkeni 1984–1990 dönemini kapsıyor.

En yaygın yıl 1989 olduğu için CSV'de `yil = 1989` kullanıldı. İdari yapı 1990'a göre (73 il) düzenlenmiş.

## Yöntem
- 73 il ve 52 değişken kullanılıyor. Standartlaştırılmış veri üzerinde ana bileşenler analizi yapılmış (STATGRAF) ve döndürme uygulanmamış.
- Özdeğeri 1'den büyük 9 bileşen var ve toplam varyansın %85'ini açıklıyor. Yalnızca 1. bileşen (%46,94) gelişmişlik endeksi olarak kullanılmış.
- Değerler birimsiz ana bileşen skorlarıdır. Ölçek 1980 ve 1985 çalışmalarından farklı: İstanbul 21.5, Muş -6.6.

## Çıkarılan tablolar (219 satır)
| Sayfa | Kaynak | Gösterge | Satır |
|---|---|---|---|
| 32 | Tablo 3: İllerin gelişmişlik seviyelerine göre sıralanması | Gelişmişlik endeksi (1. ana bileşen), 5 ondalık | 73 |
| 34 | Grafik-1 haritası: İllerin gelişmişlik derecelerine göre 5'li gruplaması | Grup 1–5 (`deger`), `sira` boş | 73 |
| 36 | Grafik-2 haritası: İllerin 8 grup halinde gösterimi | Grup 1–8 (`deger`), `sira` boş | 73 |

**Tablo 3:** Metin katmanı temiz. Sayfa görüntüsüyle tamamen doğrulandı. 1..73 sıra eksiksiz, değerler kesin olarak azalan, 73 ayrı il. Tüm satırlar `emin = 1`. OCR hataları düzeltildi: "16. 16013" → 16.16013, "3.6521 1" → 3.65211, 13. ve 31. sıra numaraları.

**Grup haritaları:** Grup tablosu basılmamış. Gruplar, taralı harita desenlerinden (sayfa görüntüleri döndürülerek) il il okundu. Her iki haritada da gruplar Tablo 3'teki sırayla tam ardışık aralıklar oluşturuyor, hiçbir istisna yok. Bu nedenle `emin = 1`.
- 5'li gruplama: I = 1–6, II = 7–25, III = 26–39, IV = 40–58, V = 59–73 (6/19/14/19/15 il)
- 8'li gruplama: I = 1–6, II = 7–13, III = 14–25, IV = 26–39, V = 40–47, VI = 48–58, VII = 59–67, VIII = 68–73 (6/7/12/14/8/11/9/6 il)
- Sınırlardaki iller ayrıca yakından kontrol edildi: Kocaeli beyaz (grup I). Sakarya, Hatay ve Kayseri grup II/III, Konya ve Nevşehir grup III/IV.

## Atlananlar
- Tablo 1 (bileşen varyansları) ve Tablo 2 (değişken yükleri ve korelasyonları) il düzeyinde değil.
- Bölge düzeyinde tablo yok.
- İl adları basıldığı gibi. K.MARAŞ, İÇEL, AFYON korundu. "ISPARTA" doğru yazım.
