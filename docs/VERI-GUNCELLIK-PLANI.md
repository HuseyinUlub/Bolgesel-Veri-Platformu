# Veri Güncelliği ve Güvenilirliği Planı

Amaç: hangi göstergenin eskidiğini aramadan görmek; yeni veriyi siteye girmeden önce otomatik kontrolden geçirmek; her veri değişikliğinin izini tutmak.

## 1. Güncellik raporu (ilk adım)

- Betik: `tools/guncellik/guncellik_raporu.py` (yazılacak). Girdi: `build/veri.db` ve `kaynaklar/yayin-takvimi.csv`.
- `kaynaklar/yayin-takvimi.csv` (yazılacak): `gosterge;kaynak;siklik;yayin_ayi;gecikme_yil;not`. Örnek: il GSYH yıllık, Aralık'ta, bir önceki yıl. Gösterge adları `indicators.indicator` ile birebir aynı olmalı; bilinmeyenler için kaynak bazında varsayılan satır kullanılır.
- Her gösterge için: veritabanındaki son yıl (il düzeyi ve Türkiye ayrı), beklenen son yıl (bugünün tarihi ve takvimden), durum: Güncel / Güncelleme Bekliyor / Gecikmiş / Takvim Yok.
- Çıktı: `build/guncellik.html` (kategoriye göre filtrelenebilir tablo) ve `build/guncellik.csv`. Önce "Gecikmiş" olanlar listelenir.

## 2. Otomatik güncelleme (yönetici bilgisayarda)

- TÜİK API'de bulunan göstergeler haftalık zamanlanmış görevle çekilir (`tools/guncelle/guncelle.py`, eşleme `docs/` ve TUIK-API-ESLEME). Sonuç doğrudan uygulanmaz: Veri Masası kontrolleri (birim, ±%50 sıçrama, ondalık kayması, 81 il toplamı = Türkiye) çalışır, rapor üretilir, kullanıcı onaylar.
- API anahtarı yalnızca yerel `tuik-api-key.txt` dosyasından okunur; içeriği hiçbir çıktıya yazılmaz.
- API'de olmayanlar (MEB, BTK, OECD, BDDK vb.) Veri Masası Excel'i ile elle girilir.

## 3. Değişiklik denetimi

- Her `build_data.py` çalışmasından sonra yeni veritabanı bir öncekinin özetiyle karşılaştırılır (gösterge × düzey × yıl başına değer sayısı ve toplam/ortalama). Kaybolan, yeni gelen ve değişen değerler `build/degisiklik-raporu.md`'ye yazılır.
- Önceki özet `kaynaklar/veri-ozeti.csv` olarak depoda tutulur; böylece her commit neyin değiştiğini taşır.

## Kurallar

- Bir değer siteye ancak kaynağı (`values_long.source_file`) belli ise girer.
- Ham dosyalar (`kaynaklar/`) elle değiştirilmez; düzeltmeler `veri-ekleri/duzeltmeler/` üzerinden, gerekçeyle yapılır.
