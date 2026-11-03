# 1980 SEGE çalışması: çıkarım notları

**Kaynak:** `kaynak/1980-il-sege.pdf` (99 sayfa). DPT Yayın No: DPT 1695, KÖYDs 19. Dr. Bilge Hacıhasanoğlu, *İller İçin Bir Gelişmişlik Göstergesi ve Sıralama*, Mart 1980.

## Referans yıl
- Değişkenlerin büyük çoğunluğu **1975** yılına ait. Üniversite giriş sınavı değişkeni 1976 yılına ait. Değişim değişkenleri 1963–1975, 1954–1975, 1970–1975 ve 1965–1970 dönemlerini kapsıyor.
- CSV'de `yil = 1975`. Yayın yılı 1980.

## Yöntem
- 67 il ve 56 değişken kullanılıyor. Veri standartlaştırılmış, korelasyon matrisi üzerinden ana bileşenler hesaplanmış (BMDP4M), ardından varimax döndürmesi uygulanmış.
- Özdeğeri 1'den büyük 15 bileşen toplam varyansın yaklaşık %86'sını açıklıyor. Değerler bileşen skorlarıdır (factor scores) ve birimsizdir (standart skor).
- Açıklanan varyans (metinden): 1. bileşen yaklaşık 1/3, 2. bileşen %7, 3. bileşen %6, 4. bileşen %6. İlk dört bileşenin toplamı döndürmeden önce %56, döndürmeden sonra %52.

## Çıkarılan tablolar (67 il × 4 = 268 satır)
| Sayfa | Tablo | Gösterge | Satır |
|---|---|---|---|
| 33 | Tablo IV (görevde "Tablo V" olarak geçiyordu; basılı başlık Tablo IV, metin de IV diyor) | Gelişmişlik endeksi (1. ana bileşen) | 67 |
| 35 | Tablo VI | Tarımsal modernleşme göstergesi (2. ana bileşen) | 67 |
| 37 | Tablo VIII | Sayısal eğitim göstergesi (3. ana bileşen) | 67 |
| 39 | Tablo X | 4. ana bileşen. Metne göre 1963–1975 dönemindeki imalat sanayii istihdamı oransal artışının göstergesi. | 67 |

Her tabloda şu kontroller yapıldı: 1..67 sıra eksiksiz, değerler sıraya göre azalan (eşitlikler var), 67 ilin her biri bir kez geçiyor. Tüm değerler sayfa görüntüsüyle karşılaştırıldı.

## Belirsizlikler (`emin = 0`)
- **Tablo IV, 50. sıra KIRŞEHİR:** Son hane okunamıyor (`-0.39_`). Değer -0.382 ile -0.395 arasında olmalı. CSV'ye `-0.39` yazıldı.
- **Tablo VIII'de basım hatası:** KONYA iki kez basılmış (39. sırada 0.038, 47. sırada -0.355), MALATYA ise tabloda yok. Ek I'deki bilgisayar çıktısı (s. 73, "Estimated factor scores") plaka sırasıyla kontrol edildi. Komşu satırlar 1. ve 4. bileşen değerleriyle doğrulandı. Sonuçlar:
  - Konya'nın 3. bileşen değeri -0.355. 47. sıradaki KONYA doğru.
  - Kütahya'nın değeri 0.038. 39. sıradaki "KONYA" aslında KÜTAHYA.
  - Malatya'nın değeri 0.524 (çıktıda bulanık, 0.324 ya da 0.524 okunabiliyor). 22. sıradaki "KÜTAHYA" büyük olasılıkla MALATYA.
  - CSV'de 22. sıra **MALATYA**, 39. sıra **KÜTAHYA** olarak düzeltildi, ikisi de `emin = 0`.
- Doğrulananlar: Tablo VIII'deki İSTANBUL -0.543 (sayfada kalemle üzerine yazılmış) aynı çıktıyla doğrulandı. MANİSA -0.256 ve AMASYA (Tablo IV) -0.420 okundu. Amasya'daki silik hane sıra kısıtıyla kesinleşti.

## Atlananlar
- Tablo I (bileşen varyansları), Tablo II, III, V, VII, IX (değişken yükleri) ve Tablo XI (s. 40, bileşen–değişken özeti) il düzeyinde değil.
- Ek I (s. 42–79): BMDP bilgisayar çıktıları. Korelasyon matrisi, yükler, saçılım grafikleri ve 15 bileşenin il skorları (s. 73) bunlar arasında. 5–15. bileşenler yorumlanmamış, çıktı kalitesi de güvenilir okumaya yetmiyor. Bu yüzden alınmadı; yalnızca kontrol için kullanıldı.
- Ek II (s. 80–98): 38 değişkenle kümeleme (BMDP2M). Dendrogram ve uzaklık matrisi var, küme üyeliği tablosu yok. Alınmadı.
- Bölge düzeyinde tablo yok.
- İl adları basıldığı gibi (1975 idari yapısı, 67 il). URFA, K.MARAŞ, İÇEL, AFYON korundu.
