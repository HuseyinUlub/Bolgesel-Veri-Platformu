# Veri Güncelliği ve Güvenilirliği Planı

Amaç: hangi göstergenin eskidiğini aramadan görmek; yeni veriyi siteye girmeden önce otomatik kontrolden geçirmek; her veri değişikliğinin izini tutmak.

## 1. Güncellik raporu (uygulandı, 4 Kasım 2026)

- Betik: `tools/guncellik/guncellik_raporu.py` (`pipeline/hepsini_olustur.py` içinde çalışır). Girdi: `build/veri.db` ve `kaynaklar/yayin-takvimi.csv`.
- Yayın takvimi: `kaynaklar/yayin-takvimi.csv`. `dogrulandi` sütunu boş satırlar taslaktır. Takvim satırı olmayan göstergelerde beklenen yıl "emsal" yöntemiyle (aynı kaynak ve kategorideki göstergelerin en az %30'unun ulaştığı yıl) bulunur; derleme yayınlarında (SKA) kullanılan baskının yılı esas alınır.
- Her gösterge için veritabanındaki son yıl, beklenen yıl ve durum: Güncel / Güncelleme Bekliyor / Gecikmiş / Dönemsel / Tek Seferlik / Belirlenemedi.
- Çıktı: `build/guncellik.html` (kategoriye göre filtrelenebilir tablo) ve `build/guncellik.csv`; önce "Gecikmiş" olanlar listelenir.

## 2. Otomatik güncelleme (uygulandı, 4 Kasım 2026)

- GitHub Actions `.github/workflows/haftalik-guncelleme.yml` her pazartesi 09:00'da (ya da elle) bilgisayardan bağımsız çalışır: veriyi baştan üretir, TÜİK ve OECD API'lerinden indirir, sitedeki değerlerle karşılaştırır.
- Sonuç doğrudan yayına girmez: TÜİK adayları Veri Masası kontrollerinden geçer (`tools/guncelle/aday_denetim.py`: birim, ±%50 sıçrama, ondalık kayması, 81 il toplamı = Türkiye). Değişiklik varsa iş akışı uygular, siteyi derler ve onay için pull request açar; PR'ı birleştirmek onaydır. Değişiklik yoksa PR açılmaz, rapor çalıştırmanın "Artifacts" bölümünde saklanır.
- API anahtarı yerelde `tuik-api-key.txt` dosyasından, Actions'ta `TUIK_API_KEY` gizli değişkeninden okunur; içeriği hiçbir çıktıya yazılmaz.
- Otomatik kapsam: `pipeline/donusturuculer/eslemeler/tuik.csv`'deki onaylı eşlemeler (169 gösterge) ve OECD eşlemeleri. API'de olmayanlar (MEB, BTK, BDDK vb.) Veri Masası Excel'i ile elle girilir.
- Ayrıntılar ve elle çalıştırma: `docs/VERI-GUNCELLEME.md`.

## 3. Değişiklik denetimi (uygulandı, 4 Kasım 2026)

- `pipeline/hepsini_olustur.py` her çalıştırmada yeni veritabanının özetini (gösterge × düzey: değer sayısı, son yıl, toplam) `kaynaklar/veri-ozeti.csv` ile karşılaştırır ve `build/degisiklik-raporu.md` yazar (kaybolan, azalan, son yılı değişen, revize, yeni).
- Özet depoda tutulur; böylece her commit neyin değiştiğini taşır. Değişiklik doğruysa `--ozet-kaydet` yeni özeti kaynak kabul eder.

## Açık işler (4 Kasım 2026 durumu)

- Gecikmiş göstergeler: güncellik raporunda 79 (75 TÜİK, 4 OECD). API ile kapatılabilecekler eşlemeye eklenmeli, kalanlar Veri Masası ile girilmeli.
- `tuik.csv`'de `inceleme` durumundaki 71 eşleme: sitedeki değerle karşılaştırılıp onaylanırsa otomatik kapsama girer.
- Yayın takvimi: 14 satırdan 13'ü taslak; TÜİK ve OECD yayın takvimlerinden doğrulanmalı.
- TÜİK müze akışları (DF_MUZE_ESER_SAY, DF_MUZE_ORENYER_ZYARETCI, DF_MUZE_SAYISI_V3) API'den kaldırıldı; mevcut değerler korunuyor, yeni yıllar elle girilmeli.

## Kurallar

- Bir değer siteye ancak kaynağı (`values_long.source_file`) belli ise girer.
- Ham dosyalar (`kaynaklar/`) elle değiştirilmez; düzeltmeler `veri-ekleri/duzeltmeler/` üzerinden, gerekçeyle yapılır.
