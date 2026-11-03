"""
TÜİK "İllere göre beşeri kalkınma endeksi, alt endeksleri ve değişim oranları" (SDMX, DF_BESERI_KALKINMA_ENDEKS)
→ veri-ekleri/tuik-beseri-kalkinma.csv. 81 il ve Türkiye, 2018–2022.
Yalnızca endeks değerleri alınır (ENDEKS_DEGISIM=1); yıllık değişim oranları (16) veriden türetilebildiği için alınmaz.
Kullanım: python tools/tuik-beseri/donustur.py
"""
import re
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
XML = Path(__file__).with_name("TRDF_BESERI_KALKINMA_ENDEKS1.0.xml")
CIKTI = KOK / "veri-ekleri" / "tuik-beseri-kalkinma.csv"
KAT = "Sosyo-Ekonomik Gelişmişlik"
AD = {
    "E_BKE": "Beşeri Kalkınma Endeksi (0-1)",
    "E_EE": "Beşeri Kalkınma Endeksi: Eğitim Alt Endeksi (0-1)",
    "E_GE": "Beşeri Kalkınma Endeksi: Gelir Alt Endeksi (0-1)",
    "E_YKE": "Beşeri Kalkınma Endeksi: Yaşam Beklentisi Alt Endeksi (0-1)",
}
s = XML.read_text(encoding="utf-8-sig")
satir = []
for ser in re.findall(r"<generic:Series>(.*?)</generic:Series>", s, re.S):
    k = dict(re.findall(r'<generic:Value id="(\w+)" value="([^"]*)"', ser))
    if k["ENDEKS_DEGISIM"] != "1":
        continue
    for y, v in re.findall(r'TIME_PERIOD" value="(\d{4})" /><generic:ObsValue value="([^"]+)"', ser):
        satir.append(f"{k['REF_AREA']};{AD[k['INDICATOR']]};{KAT};{y};{float(v):.4f};Türkiye İstatistik Kurumu")
CIKTI.write_text("﻿kod;gosterge;kategori;yil;deger;kaynak\n" + "\n".join(sorted(satir)) + "\n", encoding="utf-8")
print(f"{len(satir)} değer → {CIKTI.relative_to(KOK)}")
