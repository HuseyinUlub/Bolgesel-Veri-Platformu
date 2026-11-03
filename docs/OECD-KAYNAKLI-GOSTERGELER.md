# OECD kaynaklı göstergeler

Platformdaki OECD verisinin listesi (`indicators.kaynak_turu`, sınıflama `pipeline/kaynak_turu.py`). Veri Gezgini'nde bu göstergelerin kaynak satırında **OECD verisi** etiketi görünür.

- **oecd-ozgun**: OECD'den alınan, ulusal kaynaklarda bölge düzeyinde karşılığı olmayan veri.
- **oecd-ulusal**: OECD'den alınan, ulusal bir kurumdan da elde edilebilecek veri (karşılığı yanında yazılı).
- **platform**: ulusal veriden platformun hesapladığı göstergeler (ör. eşitsizlik endeksleri; OECD yöntemiyle hesaplansa da OECD verisi değildir).

Yeni bir OECD göstergesi eklenince ulusal karşılığı varsa `pipeline/kaynak_turu.py` içindeki `ULUSAL_KARSILIK` listesine eklenmeli.

## OECD verisi, ulusal karşılığı olan (15)

| Kategori | Gösterge | Ulusal karşılık | Düzey | Yıllar |
|---|---|---|---|---|
| Araştırma ve Geliştirme | Ar-Ge Harcamasının GSYH'ye Oranı (OECD): Kamu (%) | TÜİK araştırma-geliştirme faaliyetleri araştırması | TR, D2 | 2013–2023 |
| Araştırma ve Geliştirme | Ar-Ge Harcamasının GSYH'ye Oranı (OECD): Yükseköğretim (%) | TÜİK araştırma-geliştirme faaliyetleri araştırması | TR, D2 | 2013–2023 |
| Araştırma ve Geliştirme | Ar-Ge Harcamasının GSYH'ye Oranı (OECD): Şirketler (%) | TÜİK araştırma-geliştirme faaliyetleri araştırması | TR, D2 | 2013–2023 |
| Araştırma ve Geliştirme | Araştırmacıların İstihdamdaki Payı (OECD): Yükseköğretim (%) | TÜİK araştırma-geliştirme faaliyetleri araştırması | TR, D2 | 2013–2023 |
| Araştırma ve Geliştirme | Araştırmacıların İstihdamdaki Payı (OECD): Şirketler (%) | TÜİK araştırma-geliştirme faaliyetleri araştırması | TR, D2 | 2013–2023 |
| Bölgesel Refah (OECD) | En Az Lise Mezunu İşgücü Oranı (OECD) (%) | TÜİK Hanehalkı İşgücü Anketi | D2 | 2024–2024 |
| Gelir ve Yaşam Koşulları | Genel Seçimlere Katılım Oranı (OECD) (%) | Yüksek Seçim Kurulu seçim sonuçları | il, D2, TR | 2015–2023 |
| Gelir ve Yaşam Koşulları | Kasten Öldürme Oranı (OECD) (Yüz Binde) | Emniyet Genel Müdürlüğü ve Adalet Bakanlığı istatistikleri (il düzeyinde açık veri sınırlı) | il, D2, TR | 2013–2024 |
| Gelir ve Yaşam Koşulları | Motorlu Taşıt Hırsızlığı (OECD) (Yüz Binde) | Emniyet Genel Müdürlüğü istatistikleri (il düzeyinde açık veri sınırlı) | il, D2, TR | 2013–2024 |
| Göç | Uluslararası Göç: Yurt Dışına Gidenler (OECD) (%) | TÜİK uluslararası göç istatistikleri | il, TR | 2016–2025 |
| Göç | Uluslararası Göç: Yurt Dışından Gelenler (OECD) (%) | TÜİK uluslararası göç istatistikleri | il, TR | 2016–2025 |
| Sağlık | Hastaneden Taburcu Olan (OECD) (Yüz Binde) | Sağlık Bakanlığı sağlık istatistikleri yıllığı | il, D2, TR | 2013–2023 |
| Ulaştırma | Elektrikli Taşıt Sayısı (OECD) | TÜİK motorlu kara taşıtları istatistikleri | il, D2, TR | 2013–2023 |
| Ulaştırma | Hibrit Taşıt Sayısı (OECD) | TÜİK motorlu kara taşıtları istatistikleri | il, D2, TR | 2013–2024 |
| Çevre | En Az İkincil Arıtmalı Atık Su Sistemine Bağlı Nüfus (OECD) (%) | TÜİK belediye atık su istatistikleri | D2, il | 2013–2022 |

## OECD verisi, ulusal karşılığı olmayan (102)

| Kategori | Gösterge | Düzey | Yıllar |
|---|---|---|---|
| Araştırma ve Geliştirme | Milyon Kişi Başına PCT Patent Başvurusu (OECD) | il, D2, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Bilgi ve İletişim Teknolojileri | D2, il, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Biyoteknoloji | D2, il, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Nanoteknoloji | D2, il, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Toplam | il, D2, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Tıbbi Teknoloji | il, D2, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Yapay Zekâ | D2, il, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): Çevre Teknolojileri | il, D2, TR | 2013–2023 |
| Araştırma ve Geliştirme | PCT Patent Başvurusu (OECD): İlaç | il, D2, TR | 2013–2023 |
| Bölgesel Refah (OECD) | Algılanan Sosyal Destek Ağı (OECD) (%) | D2 | 2024–2024 |
| Bölgesel Refah (OECD) | Hava Kirliliği PM2.5 (OECD) (µg/m³) | D2 | 2024–2024 |
| Bölgesel Refah (OECD) | Kişi Başına Oda Sayısı (OECD) | TR, D2 | 2013–2025 |
| Bölgesel Refah (OECD) | Konut Fiyatlarından Memnuniyet (OECD) (%) | D2 | 2024–2024 |
| Bölgesel Refah (OECD) | Yaşam Memnuniyeti (OECD) (0-10) | D2 | 2024–2024 |
| Bölgesel Refah (OECD) | İnternet Hızının OECD Ortalamasından Farkı (%) | D2 | 2024–2024 |
| Demografi | Yaşa Göre Standartlaştırılmış Ölüm Hızı (OECD) (Binde) | il, TR, D2 | 2013–2024 |
| Demografi | Yaşa Göre Standartlaştırılmış Ölüm Hızı, Erkek (OECD) (Binde) | il, TR, D2 | 2013–2024 |
| Demografi | Yaşa Göre Standartlaştırılmış Ölüm Hızı, Kadın (OECD) (Binde) | il, TR, D2 | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Bilgi ve İletişim ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Diğer Hizmetler ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Finans ve Sigorta ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Gayrimenkul ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Kamu Yönetimi, Eğitim, Sağlık ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Mesleki ve İdari Hizmetler ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Sanayi (Enerji Dahil) ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Tarım, Ormancılık ve Balıkçılık ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Ticaret, Ulaştırma, Konaklama ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): Toplam Ekonomi ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): İmalat ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Emek Verimliliği (OECD): İnşaat ($, SGP, Çalışan Başına) | D2, TR | 2013–2024 |
| Ekonomi | Çalışan Başına GSYH, SGP (OECD) ($) | D2, TR | 2013–2024 |
| Eğitim | Eğitim Düzeyi (25-34 Yaş, OECD): Yükseköğretim Mezunu (%) | TR, D2 | 2013–2025 |
| Eğitim | Eğitim Düzeyi (25-64 Yaş, OECD): Lise Altı (%) | TR, D2 | 2013–2025 |
| Eğitim | Eğitim Düzeyi (25-64 Yaş, OECD): Lise Mezunu (%) | TR, D2 | 2013–2025 |
| Eğitim | Eğitim Düzeyi (25-64 Yaş, OECD): Yükseköğretim Mezunu (%) | TR, D2 | 2013–2025 |
| Eğitim | Eğitimi Erken Bırakanlar (18-24 Yaş, OECD) (%) | TR, D2 | 2013–2025 |
| Eğitim | Ne Eğitimde Ne İstihdamda Olan Gençler (NEET, OECD) (%) | TR, D2 | 2013–2024 |
| Eğitim | Ne Eğitimde Ne İstihdamda Olan Gençler, Kadın (NEET, OECD) (%) | TR, D2 | 2013–2024 |
| Eğitim | Okullaşma Oranı (OECD): 20-29 Yaş (%) | TR, D2 | 2013–2022 |
| Eğitim | Yetişkin Eğitimine Katılım, Son 4 Hafta (25-64 Yaş, OECD) (%) | TR, D2 | 2013–2025 |
| Gelir ve Yaşam Koşulları | Kişi Başına Harcanabilir Hanehalkı Geliri (OECD) (TL) | TR, D2 | 2013–2021 |
| Gelir ve Yaşam Koşulları | Kişi Başına Harcanabilir Hanehalkı Geliri, SGP (OECD) ($) | TR, D2 | 2013–2021 |
| Kentler (OECD) | 15 Dakikada Hizmete Erişen Nüfus (OECD Kent) (%) | FUA | 2024–2024 |
| Kentler (OECD) | Aşırı Yağışlı Gün Sayısı (OECD Kent) (Gün) | FUA | 2013–2024 |
| Kentler (OECD) | Buzlu Gün Sayısı (OECD Kent) (Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Doğal ve Yarı Doğal Alan Payı (OECD Kent) (%) | FUA | 2021–2021 |
| Kentler (OECD) | GSYH'nin Ulusal Paydaki Payı (OECD Kent) (%) | FUA | 2013–2023 |
| Kentler (OECD) | GSYH, SGP (OECD Kent) (Milyon $) | FUA | 2013–2023 |
| Kentler (OECD) | Genç Bağımlılık Oranı (OECD Kent) (%) | FUA | 2013–2024 |
| Kentler (OECD) | Güçlü Isı Stresi Günleri (OECD Kent) (Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Hava Sıcaklığındaki Değişim, 1981-2010 Ortalamasına Göre (OECD Kent) (°C) | FUA | 2013–2025 |
| Kentler (OECD) | Isıtma Derece Gün (OECD Kent) (Derece-Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Kent Nüfusu (OECD) | FUA | 2013–2024 |
| Kentler (OECD) | Kentsel Isı Adası, Yaz Geceleri (OECD Kent) (°C) | FUA | 2013–2023 |
| Kentler (OECD) | Kentsel Isı Adası, Yaz Gündüzleri (OECD Kent) (°C) | FUA | 2013–2023 |
| Kentler (OECD) | Kişi Başına GSYH, SGP (OECD Kent) ($) | FUA | 2013–2023 |
| Kentler (OECD) | Kişi Başına Karayolu Ulaşımı Kaynaklı Sera Gazı (OECD Kent) (t CO2e) | FUA | 2013–2024 |
| Kentler (OECD) | Kişi Başına Kentleşmiş Alan (OECD Kent, 2025-2030 Tahmin) (m²) | FUA | 2015–2030 |
| Kentler (OECD) | Kişi Başına Sera Gazı Emisyonu (OECD Kent) (t CO2e) | FUA | 2013–2024 |
| Kentler (OECD) | Kişi Başına Yeşil Alan (OECD Kent) (m²) | FUA | 2021–2021 |
| Kentler (OECD) | Kişi Başına İmalat Kaynaklı Sera Gazı (OECD Kent) (t CO2e) | FUA | 2013–2024 |
| Kentler (OECD) | Kıyı Taşkınına Maruz Nüfus, 100 Yıllık (OECD Kent) (%) | FUA | 2015–2020 |
| Kentler (OECD) | Mobil İnternet İndirme Hızı (OECD Kent) (Türkiye=100) | FUA | 2019–2025 |
| Kentler (OECD) | Nehir Taşkınına Maruz Nüfus, 100 Yıllık (OECD Kent) (%) | FUA | 2015–2020 |
| Kentler (OECD) | Nüfus Ağırlıklı NO2 Maruziyeti (OECD Kent) (µg/m³) | FUA | 2021–2025 |
| Kentler (OECD) | Nüfus Yoğunluğu (OECD Kent) (Kişi/km²) | FUA | 2013–2023 |
| Kentler (OECD) | Ortalama Hava Sıcaklığı (OECD Kent) (°C) | FUA | 2013–2025 |
| Kentler (OECD) | Rüzgâr Tehdidine Maruz Alan (OECD Kent) (%) | FUA | 2013–2023 |
| Kentler (OECD) | Sabit İnternet Yükleme Hızı (OECD Kent) (Türkiye=100) | FUA | 2019–2025 |
| Kentler (OECD) | Sabit İnternet İndirme Hızı (OECD Kent) (Türkiye=100) | FUA | 2019–2025 |
| Kentler (OECD) | Soğutma Derece Gün (OECD Kent) (Derece-Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Sıcak Gün Sayısı (OECD Kent) (Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Sıcak Gün Sayısındaki Değişim, 1981-2010'a Göre (OECD Kent) (Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Tarım Arazisi Payı (OECD Kent) (%) | FUA | 2021–2021 |
| Kentler (OECD) | Toplam Bağımlılık Oranı (OECD Kent) (%) | FUA | 2013–2024 |
| Kentler (OECD) | Toplam Sera Gazı Emisyonu (OECD Kent) (t CO2e) | FUA | 2013–2024 |
| Kentler (OECD) | Toplam Yağış (OECD Kent) (mm) | FUA | 2013–2024 |
| Kentler (OECD) | Toprak Nemi Anomalisi (OECD Kent) (%) | FUA | 2013–2025 |
| Kentler (OECD) | Tropikal Gece Sayısı (OECD Kent) (Gün) | FUA | 2013–2025 |
| Kentler (OECD) | Yapılaşmış Alan Payı (OECD Kent) (%) | FUA | 2021–2021 |
| Kentler (OECD) | Yaşlı Bağımlılık Oranı (OECD Kent) (%) | FUA | 2013–2024 |
| Kentler (OECD) | İstihdam Oranı 15-64 Yaş (OECD Kent) (%) | FUA | 2013–2024 |
| Kentler (OECD) | İşgücüne Katılma Oranı 15-64 Yaş (OECD Kent) (%) | FUA | 2013–2024 |
| Kentler (OECD) | İşsizlik Oranı (OECD Kent) (%) | FUA | 2013–2024 |
| Çevre | İklim (OECD): Buzlu Gün Sayısı (Gün) | TR, D2, il | 2013–2024 |
| Çevre | İklim (OECD): Isıtma Derece-Gün (Derece-Gün) | TR, D2, il | 2013–2023 |
| Çevre | İklim (OECD): Ortalama Hava Sıcaklığı (°C) | TR, D2, il | 2013–2024 |
| Çevre | İklim (OECD): Soğutma Derece-Gün (Derece-Gün) | il, TR, D2 | 2013–2023 |
| Çevre | İklim (OECD): Soğutma Derece-Gündeki Değişim, 1981-2010'a Göre (Derece-Gün) | TR, D2, il | 2013–2023 |
| Çevre | İklim (OECD): Sıcak Gün Sayısı (Gün) | il, D2, TR | 2013–2024 |
| Çevre | İklim (OECD): Tropikal Gece Sayısı (Gün) | il, TR, D2 | 2013–2024 |
| İnşaat ve Konut | Konut Maliyetinin Harcanabilir Gelirdeki Payı (OECD) (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Bilgi ve İletişim (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Diğer Hizmetler (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Finans ve Sigorta (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Gayrimenkul (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Kamu Yönetimi, Eğitim, Sağlık (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Mesleki ve İdari Hizmetler (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Sanayi (Enerji Dahil) (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): Ticaret, Ulaştırma, Konaklama (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): İmalat (%) | D2, TR | 2013–2024 |
| İşgücü | İstihdamda Sektör Payı (OECD): İnşaat (%) | D2, TR | 2013–2024 |
