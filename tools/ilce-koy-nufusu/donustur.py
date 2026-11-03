"""
donustur.py — eski ilcetr.csv.gz dosyasındaki "Köy Nüfusu" 2013–2022 değerlerini kurtarır.

Eski dosyada her ilçe için 11 "Köy Nüfusu" satırı vardır ve hepsi 2023 yılı ile etiketlenmiştir; pipeline yalnızca
sonuncusunu (gerçek 2023) alıyordu. Satırlar sırasıyla 2013…2023'tür. Doğrulama: sıraya göre Türkiye toplamları,
TÜİK'in "belde ve köy nüfusu" oranıyla (2013 %8,7 … 2022 %6,6) örtüşür; ayrıca 11. sıra veritabanındaki 2023 ile aynıdır.

Kullanım: python tools/ilce-koy-nufusu/donustur.py   →  veri-ekleri/ilce-koy-nufusu-2013-2022.csv
"""
import csv
import gzip
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
KAYNAK_DOSYA = KOK / "dist" / "data" / "ilcetr.csv.gz"
CIKTI = KOK / "veri-ekleri" / "ilce-koy-nufusu-2013-2022.csv"

satirlar = defaultdict(list)
with gzip.open(KAYNAK_DOSYA, "rt", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if r["veri"].strip() == "Köy Nüfusu" and r["yil"] == "2023":
            satirlar[r["kod"]].append((r["deger"], r["veri_kaynagi"]))

cikti = []
for kod, liste in sorted(satirlar.items()):
    assert len(liste) == 11, (kod, len(liste))
    for i, (deger, kaynak) in enumerate(liste[:10]):
        cikti.append([f"ILCE{kod}", "Köy Nüfusu", "Nüfus", 2013 + i, deger, kaynak or "Türkiye İstatistik Kurumu"])

with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
    w.writerows(cikti)
print(f"{CIKTI.name}: {len(cikti)} değer, {len(satirlar)} ilçe")
