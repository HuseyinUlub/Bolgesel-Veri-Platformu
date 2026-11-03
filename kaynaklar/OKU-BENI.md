# kaynaklar

Veri hattının okuduğu ham veriler. Bu klasördeki dosyalar elle değiştirilmez; düzeltmeler `veri-ekleri/` ve Veri Masası üzerinden yapılır.

| Klasör | İçerik |
|---|---|
| `eski-site/data/` | Eski sitenin (`Desktop\dakaveri\dakaveri\data`) ham veri dosyaları, 3 Kasım 2026 kopyası. `pipeline/build_data.py` varsayılan olarak buradan okur. Eski sayfalar da bu verileri kullanır. |

Ham veri başka bir klasörden okunacaksa: `python pipeline/build_data.py --kaynak <klasör>`.
