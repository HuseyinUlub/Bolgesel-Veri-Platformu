# Otomatik veri güncelleme ve denetim

Betikler `tools/guncelle/` altındadır. Hiçbiri onaysız olarak `veri-ekleri/` ya da siteyi değiştirmez.

## Kaynaklar

| Kaynak | Gösterge | Eşleme | Çıktı (onaydan sonra) |
|---|---|---|---|
| OECD SDMX (`sdmx.oecd.org`, anahtar gerekmez) | 109 | `pipeline/donusturuculer/eslemeler/oecd-bolgesel.csv`, `oecd-kentler.csv` | `veri-ekleri/oecd-bolgesel.csv`, `oecd-kentler.csv` |
| TÜİK SDMX (`nsiws.tuik.gov.tr`, anahtar gerekir) | 169 onaylı | `pipeline/donusturuculer/eslemeler/tuik.csv` | `veri-ekleri/tuik-api.csv` |

TÜİK API değerleri esastır: `veri-ekleri/tuik-api.csv` en son okunur ve aynı il-yıl için diğer dosyaların önüne geçer
(`pipeline/ekler.py`, `SON_OKUNAN`). API'de bulunmayan yıllar ve düzeyler eski kaynaklarından gelmeye devam eder.

## Haftalık güncelleme (onayla)

```
py -3.13 -X utf8 tools/guncelle/guncelle.py                                # indir + karşılaştır + denetle → build/guncelleme/rapor-YYYY-AA-GG.md
py -3.13 -X utf8 tools/guncelle/guncelle.py --indirme-yok --uygula --site  # raporu onayladıktan sonra
```

`--uygula` aday dosyaları `veri-ekleri/`'ne yazar ve bütün veri hattını (`pipeline/hepsini_olustur.py`, değişiklik denetimi
dahil) çalıştırır; `--site` siteyi de derler. `--kaynak tuik` ya da `--kaynak oecd` ile tek kaynak güncellenir.

**Otomatik çalışma (GitHub Actions, bilgisayardan bağımsız):** `.github/workflows/haftalik-guncelleme.yml` her pazartesi
09:00'da (ya da Actions sekmesinden elle) veriyi baştan üretir, API'lerden indirir, karşılaştırır ve denetler. `veri-ekleri/`
değiştiyse uygular, siteyi derler ve **onay için pull request açar**: PR açıklaması güncelleme raporu ve değişiklik
denetimidir; `kaynaklar/veri-ozeti.csv` farkı hangi gösterge × düzeyin değiştiğini gösterir. PR'ı birleştirmek onaydır;
birleştirmeden önce yerelde Pull yapıp gerekirse `dist/` üzerinden kontrol edin. Değişiklik yoksa PR açılmaz; rapor her
çalıştırmanın "Artifacts" bölümündedir. Gerekli ayarlar iş akışı dosyasının başında yazılıdır (`TUIK_API_KEY` gizli değişkeni).
`tuik-erisim-denemesi.yml` GitHub sunucusundan TÜİK'e erişimi sınamak içindir.

Yerel zamanlanmış görev (yedek; Actions TÜİK'e erişemezse): `tools/guncelle/haftalik.py` yalnız indirir ve raporlar,
özeti `build/guncelleme/SON-RAPOR.txt`'ye yazar. Kaydetmek / kaldırmak: `py -3.13 tools/guncelle/haftalik.py --kaydet` / `--kaldir`.

Uygulamadan önce TÜİK adayları Veri Masası kontrollerinden geçer (`aday_denetim.py`: birim, ±%50 sıçrama, ondalık
kayması, 81 il = Türkiye); uyarılı değerler raporda ve `build/guncelleme/aday/tuik-api-denetim.csv`'de listelenir.
`topla=evet` göstergelerinde bir il o yıl akışta hiç yoksa bölge ve Türkiye değeri o yıl üretilmez (eksik illerle toplam
yazılmaz); il akışta var ama bu seride yoksa değeri 0 sayılır.

Raporun TÜİK bölümü: sitedeki değerle aynı olanlar, TÜİK'te farklı olanlar (revizyon; örneklerle), yeni yıllar,
API'de bulunmayan site değerleri (korunur) ve indirilemeyen akışlar.

## Betikler

| Betik | Ne yapar |
|---|---|
| `guncelle.py` | Bütün adımları çalıştırır ve raporu yazar; `--uygula` ile aday dosyaları `veri-ekleri/`'ne yazar ve `pipeline/hepsini_olustur.py`'yi çalıştırır. |
| `aday_denetim.py` | TÜİK adaylarını uygulamadan önce Veri Masası kontrollerinden geçirir. |
| `haftalik.py` | Zamanlanmış görev: haftalık indirme ve rapor; `--kaydet` / `--kaldir`. |
| `oecd_indir.py` | OECD bölgesel ve kent akışlarını yalnız Türkiye için indirir. |
| `tuik_indir.py` | `tuik.csv`'deki onaylı göstergelerin akışlarını ve yapısal metaverisini indirir (belirteç süresi dolarsa yeniler). |
| `tuik_aday.py` | Eşlemeyi uygular, değerleri sitedeki ondalığa yuvarlar, sitedeki değerlerle karşılaştırır. |
| `tuik_donustur.py` | Eşleme kuralları: seri süzgeci, birim çarpanı, pay/payda, il toplamından üst düzey, aylık akışlar. |
| `tuik_yapi.py` | Akışın boyutları ve kod listeleri (Türkçe etiketler). |
| `tuik_esle_kur.py` | Kurulum aracı: aday göstergeleri akışlardaki bütün serilerle karşılaştırıp eşleme tablosunu ve `incelemeler/tuik-esleme-kontrol.xlsx`'i üretir. Güncellemede kullanılmaz. |
| `tuik_sdmx.py`, `tuik_tara.py` | API istemcisi ve 508 akışın kapsam taraması (`tuik-akis-kapsami.csv`). |
| `denetim.py` | Güncellik, toplam tutarlılığı, ölçek sıçramaları, yıllık değişimler, Dünya Bankası karşılaştırması. |

## TÜİK eşleme tablosu (`tuik.csv`)

`akis;surum;geo;filtre;payda;carpan;topla;ay;gosterge;kategori;durum;eslesme;not`

- `filtre`: seriyi seçen boyut değerleri, ör. `HANEHALKI_TIPI=_T`. `not` sütunu aynı seriyi Türkçe etiketlerle yazar.
- `payda`: oran göstergelerinde payda serisi; değer = pay / payda × `carpan`.
- `topla=evet`: API'de yalnız il varsa Düzey 2, Düzey 1 ve Türkiye il toplamından üretilir.
- `ay`: aylık akışlarda `toplam` (ör. doğum) ya da `12` (aralık değeri, ör. taşıt stoku).
- `durum`: yalnız `onayli` satırlar güncellenir. `inceleme` satırları eşleşmesi doğrulanamayanlardır.

Bir eşlemeyi elle düzeltmek ya da `inceleme`deki bir göstergeyi açmak için satırı düzenleyip `durum=onayli` yapın ve
`python tools/guncelle/guncelle.py --kaynak tuik` raporunda o göstergenin sitedeki değerle uyumuna bakın.

## Kurallar

- Kaynağın artık sunmadığı göstergeler ve yıllar silinmez; mevcut değerler korunur ve raporda listelenir.
- Sitedeki serinin ilk yılından önceki yıllar varsayılan olarak eklenmez (`--gecmis` ile eklenir).
- %0,5'ten büyük farklar "revizyon" sayılır.
- TÜİK API anahtarı proje kökünde `tuik-api-key.txt` dosyasındadır; sürüm denetimine ve yayına girmez.
