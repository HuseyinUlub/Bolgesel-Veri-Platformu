# EPDK Elektrik Piyasası 2025 Yılı Piyasa Gelişim Raporu

- `elektrik-piyasasi-gelisim-raporu-2025-ek.xlsx`: raporun Excel eki (EPDK sitesinden, 5 Kasım 2026).
- `electricity-market-development-report-2025.pdf`: raporun İngilizce metni.
- `rapor-il-tablolari-2025.csv`: PDF'teki il tablolarından çıkarılan değerler (Tablo 1.2, 1.3, 1.6, 1.8). Her tablonun il toplamı raporun "Grand Total" satırıyla karşılaştırıldı ve tuttu. Kilis lisanslı tablolarda yer almadığı için 0 yazıldı (2024'te de 0); lisanssız brüt üretim tablosunda yer almayan 4 il boş bırakıldı (toplam yine tutuyor).

Dönüştürücü: `tools/epdk-2025/donustur.py` → `veri-ekleri/epdk-2025.csv`.
