"""
TÜİK SDMX (GenericData XML) → veri-ekleri/tuik-fiyat-duzeyi.csv
Bölgesel fiyat düzeyi endeksleri (Türkiye=100), Düzey 2:
  - TRDF_BOLGESEL_FIYAT_DUZEYI_GENEL: tüketim harcamaları geneli, 2008–2025 (yıllık)
    → veri tabanındaki adı "Bölgesel Satınalma Gücü Paritesi (Türkiye=100)"
  - TRDF_BOLGESEL_FIYAT_DUZEYI_TUKETIM_ANA_GRUPLAR: 12 ana harcama grubu, 2008, 2012, 2017, 2024
    (grup "0" = genel; genel dosyayla aynı olduğu için alınmaz)
Türkiye satırları (her yıl 100, endeks tabanı) alınmaz.
TRDF_BOLGESEL_SGP_TUKETIM_ANA_GRUPLAR dosyası aynı endekslerin 100'e bölünüp iki ondalığa yuvarlanmış hâlidir;
ayrıca eklenmez, yalnızca tutarlılık denetimi için okunur.
Kullanım: python tools/tuik-fiyat-duzeyi/donustur.py
"""
import re
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
BU = Path(__file__).parent
CIKTI = KOK / "veri-ekleri" / "tuik-fiyat-duzeyi.csv"
KAYNAK = "Türkiye İstatistik Kurumu"
GENEL = "Bölgesel Satınalma Gücü Paritesi (Türkiye=100)"
GRUP = {
    "01": "Gıda ve Alkolsüz İçecekler",
    "02": "Alkollü İçecekler ve Tütün",
    "03": "Giyim ve Ayakkabı",
    "04": "Konut, Su, Elektrik, Gaz ve Diğer Yakıtlar",
    "05": "Mobilya, Ev Aletleri ve Ev Bakım Hizmetleri",
    "06": "Sağlık",
    "07": "Ulaştırma",
    "08": "Haberleşme",
    "09": "Eğlence ve Kültür",
    "10": "Eğitim",
    "11": "Lokanta ve Oteller",
    "12": "Çeşitli Mal ve Hizmetler",
}


def oku(ad):
    s = (BU / ad).read_text(encoding="utf-8-sig")
    for ser in re.findall(r"<generic:Series>(.*?)</generic:Series>", s, re.S):
        k = dict(re.findall(r'<generic:Value id="(\w+)" value="([^"]*)"', ser))
        for y, v in re.findall(r'TIME_PERIOD" value="(\d{4})" /><generic:ObsValue value="([^"]+)"', ser):
            yield k, y, float(v)


satir = []
for k, y, v in oku("TRDF_BOLGESEL_FIYAT_DUZEYI_GENEL_V11.0.xml"):
    if k["REF_AREA"] != "TR":
        satir.append((k["REF_AREA"], GENEL, y, v))
grup = {}
for k, y, v in oku("TRDF_BOLGESEL_FIYAT_DUZEYI_TUKETIM_ANA_GRUPLAR_V11.0.xml"):
    c = k["COICOP_601"]
    if k["REF_AREA"] == "TR" or c not in GRUP:
        continue
    grup[(c, k["REF_AREA"], y)] = v
    satir.append((k["REF_AREA"], f"{GRUP[c]} Grubu Fiyat Düzeyi Endeksi (Türkiye=100)", y, v))

# denetim: SGP değerleri = endeks / 100 (iki ondalık)
fark = [(c, g, y) for k, y, p in oku("TRDF_BOLGESEL_SGP_TUKETIM_ANA_GRUPLAR_V11.0.xml")
        for c, g in [(k["COICOP_601"], k["REF_AREA"])] if (c, g, y) in grup and abs(grup[(c, g, y)] / 100 - p) > 0.0051]
print(f"SGP denetimi: {len(fark)} tutarsız değer {fark[:5]}")

CIKTI.write_text("﻿kod;gosterge;kategori;yil;deger;kaynak\n"
                 + "\n".join(f"{g};{ad};Enflasyon ve Fiyat;{y};{v};{KAYNAK}" for g, ad, y, v in sorted(satir)) + "\n",
                 encoding="utf-8")
print(f"{len(satir)} değer → {CIKTI.relative_to(KOK)}")
