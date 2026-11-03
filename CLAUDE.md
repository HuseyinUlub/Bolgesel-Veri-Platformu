# Bölgesel Veri Platformu

"Türkiye Bölgesel Veri Analizleri" sitesinin kaynağı: TÜİK, MEB, OECD, Eurostat vb. bölgesel verilerin (il, İBBS Düzey 1/2, ilçe) toplandığı, görselleştirildiği ve indirildiği statik site.

## Ortam (önemli)

- Windows. Node kurulu değil; site `dist/` klasöründen `py siteyi-ac.py` ile açılır. `dist/` bu yüzden depoda tutulur.
- Python komutu `py`'dir (`python` yok). Türkçe karakterler için `py -X utf8 ...` kullanın.
- Antivirüs `.bat` dosyalarını engeller; komutları doğrudan çalıştırın.
- `tuik-api-key.txt` gizlidir: içeriğini asla okumayın, yazdırmayın, commit etmeyin.

## Yapı

- `pipeline/build_data.py`: ham veri (`kaynaklar/eski-site/data`) + `veri-ekleri/` + temizlik → `build/veri.db` (SQLite, ~700 MB, depoda yok) ve `public/veri/` (site verisi). Çalıştırma: `py -X utf8 pipeline/build_data.py`; doğrulama raporu `build/rapor.md`.
- `veri-ekleri/`: ek kaynak CSV'leri (`kod;gosterge;kategori;yil;deger;kaynak`). Düzeltmeler `veri-ekleri/duzeltmeler/degerler.csv`.
- `veri-masasi/`: Excel ile veri girişi ve kontrol (`veri_masasi.py`, bkz. `veri-masasi/OKU-BENI.md`).
- `src/` (Vite kaynakları), kök `*.html` sayfaları, `public/`; derleme çıktısı `dist/`.
- `tools/`: tek seferlik ve yardımcı betikler (vitrin verisi, SEGE tarihi, TÜİK güncelleme vb.).
- `vite.config.js`: eski sayfalar ve `img/` hâlâ `../dakaveri` klasöründen kopyalanıyor (ESKI_SITE).

## Bilinen işler

- Eski sayfalar ve `img/` depoya alınmalı (`kaynaklar/eski-site/`), ESKI_SITE bağımlılığı kaldırılmalı.
- Hakkında sayfasında bir 404 hatası var.

## Yazım kuralları

- Arayüz ve metinler resmî Türkçe; etiketler Başlık Düzeninde.
- Kaynak satırları: "Kaynak: X; Hesaplama: Platform".
- Değişiklikten sonra ilgili sayfayı `dist/` üzerinden açıp kontrol edin; veri değiştiyse `build/rapor.md`'yi önceki sürümle karşılaştırın.
