# Veri envanteri (Eylül 2026)

Eski sitenin `data/` klasöründeki dosyalar, hangi sayfaların kullandığı ve v2'de nereye gittikleri.

## 1. İstatistik göstergeleri: tek şemada birleştirildi

| Dosya | Satır | Düzeyler | Kullanan sayfa | v2 durumu |
|---|---|---|---|---|
| `trveriler.csv.gz` | 468.794 | TR, D1, D2, il | trgrafik | **Kaynak** (339 gösterge, 2010–2025) |
| `infografik.csv.gz` | 207.720 | TR, D1, D2, il | index, infografik | **Kaynak** (175 gösterge, 56'sı yalnız burada, 1963'ten itibaren) |
| `illerveri.csv.gz` | 302.010 | il | ilharita | Gereksiz: tamamı `trveriler` içinde |
| `duzey1veri.csv.gz` | 51.550 | D1 | nuts1 | Gereksiz: tamamı `trveriler` içinde |
| `duzey2veri.csv.gz` | 110.862 | D2 | nuts2 | Gereksiz: tamamı `trveriler` içinde |
| `ilcetr.csv.gz` | 416.563 | ilçe | ilcegrafik | **Kaynak** (35 gösterge, 973 ilçe) |
| `data.zip` (veri.csv + harita.geojson) | – | ilçe | ilceharita | Geometri alındı; veri `ilcetr` ile aynı |

Karşılaştırma sonuçları:

- `trveriler` ve `infografik` 165.684 ortak kayıtta **birebir aynı değerleri** taşıyor. Kategori çelişkisi yok.
- Birebir tekrar eden 169.886 satır atıldı.
- ⚠ **Kaynakta düzeltilmesi gereken 2 kayıt:** `infografik.csv.gz` içinde "Sosyo-Ekonomik Gelişmişlik Sıralaması" TR903/1968 (17 ve 34) ile TRB23/1996 (68 ve 71) için iki farklı değer var. Şu an ilk değer kullanılıyor.
- Değerlerde ondalık ayırıcı virgül (`15,88`), binlik ayırıcı yok. Eski koddaki `replace(/\\./g,'')` ifadesi aslında hiçbir şeyi silmiyordu. Bu tesadüfen doğru sonuç veriyordu; binlik noktalı bir değer gelseydi sessizce bozulurdu.
- Adlarında boşluk hatası olan 3 gösterge normalleştirildi (örn. `Yoğun Kent Nüfusu ␣`, `Elektrik Tüketimi␣␣(MWh)`).

## 2. Geometriler

| Dosya | İçerik | v2 |
|---|---|---|
| `tr.geojson` | 81 il (ADM1) + 26 D2 + 12 D1 + TR tek dosyada | Düzey başına ayrıldı → `veri/geo/*.json`, özellik kimliği = İBBS kodu |
| `nuts1.geojson`, `nuts2.geojson` | D1, D2 (ayrı kopyalar) | Gereksiz (`tr.geojson` içinde var) |
| `tr-.geojson`, `tr-old.geojson` | eski sürümler | Kullanılmıyor, arşivlenebilir |
| `7bolge.geojson` | coğrafi 7 bölge | SKA sayfası için ayrı kalacak |

**Önemli düzeltme:** Eski ana sayfa illeri haritaya **isim benzetmesiyle** eşliyordu (`toLowerCase` + `ı→i`). Bu yöntem Türkçe `İ` harfinde kırılgandır. v2'de her il plaka koduyla (`TR-34`) İBBS Düzey 3 koduna (`TR100`) bağlandı: 81/81 eşleşme.

## 3. Ayrı alanlar: henüz birleştirilmedi

| Dosya | Şema | Sayfa | Not |
|---|---|---|---|
| `illerska.csv.gz`, `surdurulebilir.csv.gz`, `nuts2ska.csv`, `7bolgeska.csv` | SKA hiyerarşisi (Amaç › Hedef › Gösterge › Alt gösterge) | SKA sayfaları | Dört dosyanın sütun adları birbirinden farklı. Ortak bir `ska` tablosu önerilir (bkz. geçiş planı, Adım 3) |
| `destekv2.csv` | il × yıl × destek türü | destekler | Tutarlar `68.582.159` biçiminde, başlıklarda boşluk var (`' destek_tutar '`) |
| `projeler.csv` | proje kaydı (koordinatlı) | projeler | Kendi şemasında kalabilir |
| `nesne-sablonlar.json`, `hazir.json` | infografik şablonları | infografik | Olduğu gibi kalır |

## 4. Üretilen katman (`npm run veri`)

- `build/veri.db`: VizStudio `gostergeler.db` ile aynı tablolar (`entities`, `indicators`, `values_long`). `harita_render.py`, `infografik_uret.py` ve `hikaye_*` betikleri bu dosyayı doğrudan açabilir. Düzey adları da aynı: `country / region12 / region26 / province / district`.
- `public/veri/`: 418 gösterge, 22 kategori, 913.459 değer. Kategori dosyaları yalnızca o bölüme gelindiğinde indirilir. Eski ana sayfa açılışta 1,4 MB'lık gz dosyasının tamamını indirip tarayıcıda açıyordu.

## 5. VizStudio ve OECD kaynaklarının durumu (25 Eylül 2026)

| Kaynak | Durum | Not |
|---|---|---|
| `istatistikler/Turkiye_Istatistikleri_Birlesik.xlsx` (TÜİK, 22 tema) | ✅ Alındı | 729 yeni gösterge, 177 göstergeye 1995'e uzanan geçmiş. Ayrıntı: `VERI-EKLEME.md` |
| `istatistikler/*.xlsx` (20 tema dosyası) ve `Gapminder/*.csv` | ✅ Gerek yok | Birleşik dosyanın parçaları / dönüştürülmüş kopyaları |
| `gostergeler3.db` | ✅ Alındı | 48 eşleme |
| `Konsolide.xlsx`, `BTK Verileri_Düzey2-3.xlsx` | ✅ Alındı | |
| `gennnel.xlsx` | ✅ Gerek yok | Konsolide ile aynı sütunlar + analiz sayfaları (SEGE, yakınsama) |
| OECD FUA (`DSD_FUA_*`, 26 dosya) | ✅ 42 gösterge | İklim, sera gazı, NO2, arazi örtüsü, internet hızı, bağımlılık, işgücü. PM2.5 bilerek dışarıda |
| OECD REG (`DSD_REG_*`, ~40 dosya) | ⏳ Yeniden indirilmeli | DEMO dışındakiler v4 hatasıyla indi: TL2 19/26, TL3 57/81 (TRA, TRB, TRC yok). `download_oecd_turkiye_6_reg.R` yalnızca eksik dosyaları yeniler |
| OECD LOCAL_AREA (`DSD_LA_*`) | ⏳ Yeniden indirilmeli | Aynı v4 hatası (~760/973 ilçe). Büyük olanlar (nüfus-yaş, istihdam, yağış: 0,9–1,7 GB ham) dünya verisini indirip süzüyor; Türkiye filtresiyle sorgu gerekir |
| `sau_TUR.csv` (OECD ilçe özeti, 973 ilçe, ~200 değişken) | ⏸ Beklemede | İlçe kodu eşlemesi hazır (973/973, OECD `TUR1843` → `ILCE1843`, 57'si ad ile). Ancak dosya yıl bilgisi taşımıyor (anlık özet); zaman serisi için LA dosyaları kullanılmalı |
| `gostergeler.db` (475 MB) | ⏸ Aktarılamadı | Aktarım sınırı 400 MB. İçeriği büyük olasılıkla Birleşik Excel + OECD ham verisi |
| `city.csv`, `fua.csv`, `sau.csv` (OECD genel, tüm ülkeler) | ✅ Gerek yok | Türkiye kısmı FUA/LA SDMX dosyalarıyla aynı |

**İlçe adlarında iki kaynak hatası** (mevcut `ilcetr` verisinden): `19 Mayıs` → `Mayıs`, `Hakkari Merkez` → `Hakkâri-Hakkâri`. Düzeltme tablosuyla giderilecek.
