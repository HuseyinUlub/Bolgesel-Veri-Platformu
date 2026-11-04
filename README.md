# Bölgesel Veri Platformu

Türkiye Bölgesel Veri Analizleri sitesinin yeni yapısı. Eski site (`../dakaveri`) **hiç değiştirilmedi**. Sayfalar tek tek bu yapıya taşınıyor, taşınmayanlar build sırasında eski hâlleriyle kopyalanıyor.

## Kurulum (bir kez)

Gerekenler: **Node.js 20+** ve **Python 3.9+** (ek Python paketi gerekmiyor).

```bash
cd dakaveri-v2
npm install
```

## Günlük kullanım

| Komut | Ne yapar |
|---|---|
| `npm run veri` | `../dakaveri/data` içindeki ham CSV'lerden `public/veri/` ve `build/veri.db` dosyalarını üretir, `build/rapor.md` doğrulama raporunu yazar |
| `npm run dev` | Geliştirme sunucusu: http://localhost:5173 (kaydettikçe yenilenir) |
| `npm run build` | Yayına hazır site `dist/` klasöründe: yeni sayfalar + eski sayfalar + eski `data/` ve `img/` |
| `npm run preview` | `dist/` klasörünü yerelde yayınlar (http://localhost:4173) |
| `npm test` | Veri çıktısı ve veri ekleri testleri |
| `python tests/e2e_smoke.py` | Tarayıcı testi (Playwright): düzey geçişleri, 81 il eşleşmesi, konsol hataları. `preview` açıkken çalıştırılır |

Yayınlamak için `dist/` klasörünün içeriği sunucuya kopyalanır. Yol ayarı göreli (`base: './'`) olduğundan site bir alt klasörde de çalışır.

## Klasörler

```
pipeline/build_data.py   ham veri + ekler → tek şema (VizStudio gostergeler.db ile aynı)
pipeline/ekler.py        veri-ekleri/ okuma ve kontrolleri
pipeline/donusturuculer/ Excel → şablon dönüştürücüleri
veri-ekleri/             ek veriler (şablon CSV, VizStudio .db, ad-eslemesi.csv)
public/veri/             (üretilir) manifest.json, k/<kategori>.json, geo/<düzey>.json, ilce/
src/site.config.js       içerik ayarları: kategoriler, sıra, varsayılan gösterge, araç bağlantıları
src/lib/                 ortak modüller: data, map, chart, format
src/pages/               sayfa başına tek JS dosyası (explorer.js = ana sayfa)
src/styles/tokens.css    renkler ve yazı tipi, tek yerden
tests/                   veri testleri + tarayıcı testi
docs/                    veri envanteri, geçiş planı
```

## Sık yapılan işler

**Yeni veri eklemek:** Veriyi şablona çevirip `veri-ekleri/` klasörüne koy, `npm run veri` çalıştır, `build/rapor.md` → "Veri ekleri" bölümünü kontrol et, sonra `npm run build`. Ayrıntılar ve Excel/VizStudio dönüştürücüleri için bkz. [`docs/VERI-EKLEME.md`](docs/VERI-EKLEME.md).

**Ana sayfaya kategori eklemek:** `src/site.config.js` → `anaSayfaKategorileri`. Adı `public/veri/manifest.json` içindeki ile aynı olmalı. Kart görseli `public/img/<slug>.png` (örn. `dis-ticaret.png`).

**Renk değiştirmek:** yalnızca `src/styles/tokens.css`.

**Ham veri başka klasördeyse:** `python pipeline/build_data.py --kaynak D:/veri/ham`. Eski site başka yerdeyse build için `ESKI_SITE=D:/site npm run build`.
