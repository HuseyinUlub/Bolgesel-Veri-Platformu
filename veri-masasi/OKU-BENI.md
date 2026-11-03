# Veri Masası

Veritabanını Excel üzerinden güncellemek için. Python ve `openpyxl` gerekir (`python -m pip install openpyxl`).

## Akış

1. `veri-girisi.xlsx` dosyasını açın, değerleri girin, kaydedip kapatın.
   - **Yeni Değerler:** yeni yıl, eksik değer ya da kaynağın revize ettiği değer.
   - **TÜİK Tablosu:** TÜİK'ten indirilen il × yıl tablosu. B1'de göstergeyi seçin, tabloyu A6'dan yapıştırın.
   - **Düzeltmeler:** hatalı bir değeri düzeltme ya da silme. Gerekçe zorunlu.
2. Menüyü açın: `veri-masasi.bat`, ya da proje klasöründe `python veri-masasi/veri_masasi.py`.
3. **2) Kontrol:** rapor tarayıcıda açılır, her satırın sonucu "Durum" sütununa yazılır.
4. **3) Uygula:** onayınızdan sonra değerler yazılır, veri hattı çalışır, site verisi yeniden üretilir.

İlk kullanımda ve yeni veri ekledikten sonra **1) Çalışma kitabını yenile** seçilir. Bu adım Göstergeler ve Birimler sayfalarını veritabanından yeniden üretir; girdiğiniz satırlara dokunmaz.

## Kontroller

| Sonuç | Durum |
|---|---|
| Birim tanınmadı, gösterge bulunamadı (benzer ad önerilir), yıl ya da değer geçersiz, binlik ayırıcı, gerekçesiz düzeltme, aynı değer iki kez girilmiş | Hata: uygulanmaz |
| Önceki yıla göre ±%50'den büyük değişim, eski değerin 50 katı (ondalık kayması), yüzde 100'ü aşan ya da 1'den küçük oran, negatif sayı, 81 il toplamı Türkiye'den %2'den fazla farklı | Uyarı: uygulanır, raporda işaretlenir |
| Değer veritabanındakiyle aynı | Uygulanmaz |

## Yazılan dosyalar

| Dosya | İçerik |
|---|---|
| `veri-ekleri/elle-giris.csv` | Yeni ve revize değerler. Diğer bütün eklerden sonra okunur, yani hepsinin önüne geçer. |
| `veri-ekleri/duzeltmeler/degerler.csv` | Düzeltme ve silmeler (gerekçe ve tarih ile). |
| `veri-masasi/degisiklik-gecmisi.csv` | Her değişikliğin kaydı: tarih, eski değer ve kaynak dosyası, yeni değer, kaynak ayrıntısı, gerekçe. |
| `veri-masasi/raporlar/` | Kontrol, uygulama ve geçmiş raporları (HTML). |

Bir göstergenin değerlerinin hangi dosyalardan geldiğini görmek için: `python veri-masasi/veri_masasi.py kaynak "Toplam Nüfus"`.

Yeni gösterge bu kitapla açılmaz. Yeni gösterge için `docs/VERI-EKLEME.md`'deki şablon kullanılır.
