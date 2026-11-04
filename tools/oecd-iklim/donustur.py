"""
donustur.py — OECD Regional Climate (DSD_REG_CLIM@DF_AIR_TEMP) Türkiye verisi → veri-ekleri/oecd-iklim.csv

Göstergeler (Türkiye, Düzey 2 = TL2, il = TL3; 2000'den son yıla):
  AIR_TEMP2M   İklim (OECD): Ortalama Hava Sıcaklığı (°C)
  ICING_DAYS   İklim (OECD): Buzlu Gün Sayısı (Gün)
  TROP_NIGHTS  İklim (OECD): Tropikal Gece Sayısı (Gün)
Veri tabanındaki 2013-2024 değerleri (oecd-bolgesel.csv) bu akışla aynıdır (yuvarlama farkı dışında); bu dosya\nyalnızca oecd-bolgesel.csv'de olmayan yılları yazar (2000-2012 ve OECD yeni yıl yayımladığında o yıl).

Ham veri: kaynaklar/oecd-iklim/DF_AIR_TEMP-TUR.csv (OECD SDMX API, CSV). Yenilemek için:
    py -X utf8 tools/oecd-iklim/donustur.py --indir
Kullanım: py -X utf8 tools/oecd-iklim/donustur.py   (sonra: py -X utf8 pipeline/hepsini_olustur.py)
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
import urllib.request
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
HAM = KOK / "kaynaklar" / "oecd-iklim" / "DF_AIR_TEMP-TUR.csv"
CIKTI = KOK / "veri-ekleri" / "oecd-iklim.csv"
API = "https://sdmx.oecd.org/public/rest/data/OECD.CFE.EDS,DSD_REG_CLIM@DF_AIR_TEMP,2.4/A..{alan}.......?startPeriod=2000"
AD = {"AIR_TEMP2M": "İklim (OECD): Ortalama Hava Sıcaklığı (°C)",
      "ICING_DAYS": "İklim (OECD): Buzlu Gün Sayısı (Gün)",
      "TROP_NIGHTS": "İklim (OECD): Tropikal Gece Sayısı (Gün)"}
KAYNAK = "OECD Regional, Metropolitan and Local Statistics"


def indir() -> None:
    db = sqlite3.connect(KOK / "build" / "veri.db")
    alan = "+".join(["TUR"] + [g for (g,) in db.execute("SELECT geo FROM entities WHERE level IN ('region26','province')")])
    istek = urllib.request.Request(API.format(alan=alan), headers={"Accept": "application/vnd.sdmx.data+csv; charset=utf-8"})
    with urllib.request.urlopen(istek, timeout=180) as y:
        HAM.write_bytes(y.read())
    print(f"İndirildi: {HAM.relative_to(KOK)}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--indir", action="store_true", help="ham veriyi OECD API'den yeniden indir")
    if ap.parse_args().indir:
        indir()
    # oecd-bolgesel.csv'de bulunan değerler (2013 sonrası) yazılmaz: aynı akıştan gelir, yalnız yuvarlama farkı vardır
    var = set()
    with (KOK / "veri-ekleri" / "oecd-bolgesel.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["gosterge"] in AD.values():
                var.add((r["kod"], r["gosterge"], r["yil"]))
    satir = []
    with HAM.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["MEASURE"] in AD and r["OBS_VALUE"]:
                geo = "TR" if r["REF_AREA"] == "TUR" else r["REF_AREA"]
                if (geo, AD[r["MEASURE"]], r["TIME_PERIOD"]) in var:
                    continue
                satir.append((geo, AD[r["MEASURE"]], "Çevre", r["TIME_PERIOD"], f"{round(float(r['OBS_VALUE']), 4):g}".replace(".", ",")))
    with CIKTI.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        for s in sorted(satir, key=lambda s: (s[1], s[3], s[0])):
            w.writerow([*s, KAYNAK, "", ""])
    print(f"Yazıldı: {CIKTI.relative_to(KOK)} ({len(satir)} değer)")


if __name__ == "__main__":
    main()
