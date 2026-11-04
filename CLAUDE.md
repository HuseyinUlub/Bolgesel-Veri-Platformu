# Bölgesel Veri Platformu

"Türkiye Bölgesel Veri Analizleri" sitesinin kaynağı: TÜİK, MEB, OECD, Eurostat vb. bölgesel verilerin (il, İBBS Düzey 1/2, ilçe) toplandığı, görselleştirildiği ve indirildiği statik site.

## Ortam (önemli)

- İki Windows bilgisayar, tek kaynak GitHub (`HuseyinUlub/Bolgesel-Veri-Platformu`). İşe başlarken Pull, bitirirken Commit + Push; aynı anda iki yerde çalışılmaz.
- Python komutu `py`'dir. Türkçe karakterler için `py -X utf8 ...` kullanın. Gerekli paketler: `requirements.txt` (`py -m pip install -r requirements.txt`).
- Yönetici bilgisayarda Node vardır (`npm run build`); iş bilgisayarında Node yoktur ve `.bat` dosyaları antivirüse takılır. `dist/` depoda tutulur; site `py siteyi-ac.py` ile `dist/`'ten açılır.
- `tuik-api-key.txt` gizlidir: içeriğini asla okumayın, yazdırmayın, commit etmeyin.

## Yapı

- **Tek komut:** `py -X utf8 pipeline/hepsini_olustur.py [--site]` bütün veriyi baştan üretir: veritabanı (`build_data.py`) → türetilmiş ekler (`pipeline/turetilmis/`) → sayfa verileri (`tools/uluslararasi`, `tools/vitrin`, `tools/analiz`) → değişiklik denetimi → `--site` ile `npm run build`. Yalnızca `build_data.py` çalıştırmak siteyi eksik bırakır.
- `pipeline/build_data.py`: ham veri (`kaynaklar/eski-site/data`) + `veri-ekleri/` + temizlik → `build/veri.db` (SQLite, ~700 MB, depoda yok) ve `public/veri/` (depoda yok, her seferinde üretilir). Doğrulama raporu `build/rapor.md`.
- `veri-ekleri/`: ek kaynak CSV'leri (`kod;gosterge;kategori;yil;deger;kaynak`). `tuik-api.csv` TÜİK API güncellemesidir (`tools/guncelle/guncelle.py --uygula` yazar) ve diğer eklerin önüne geçer; `elle-giris.csv` (Veri Masası) en son okunur. Düzeltmeler `veri-ekleri/duzeltmeler/degerler.csv`.
- Değişiklik denetimi: `kaynaklar/veri-ozeti.csv` (gösterge × düzey: değer sayısı, son yıl, toplam) ile karşılaştırılır → `build/degisiklik-raporu.md`. Değişiklik doğruysa `--ozet-kaydet` ile özet güncellenir ve commit edilir.
- `kaynaklar/eski-site/`: henüz taşınmamış eski sayfalar (ilharita, nuts2, trgrafik …) ve onların `data/` klasörü; `vite.config.js` bunları `dist/`'e kopyalar. `kaynaklar/sabit/`: bir kez üretilen coğrafi çıktılar (kent-kır haritası).
- `veri-masasi/`: Excel ile veri girişi ve kontrol (`veri_masasi.py`, bkz. `veri-masasi/OKU-BENI.md`).
- `src/` (Vite kaynakları), kök `*.html` sayfaları, `public/`; derleme çıktısı `dist/`.
- `tools/`: dönüştürücüler ve yardımcı betikler; çoğu tek seferliktir ve çıktısını `veri-ekleri/`'ne yazar.

## Bilinen işler

- Güncellik raporu (docs/VERI-GUNCELLIK-PLANI.md, 1. adım) henüz yok.
- `trgrafik.html` (eski sayfa) Chart.js'i CDN'den yükler; CDN'ye erişilemeyen ortamda çalışmaz.

## Yazım kuralları

- Arayüz ve metinler resmî Türkçe; etiketler Başlık Düzeninde.
- Kaynak satırları: "Kaynak: X; Hesaplama: Platform".
- Değişiklikten sonra ilgili sayfayı `dist/` üzerinden açıp kontrol edin; veri değiştiyse `build/rapor.md`'yi önceki sürümle karşılaştırın.
