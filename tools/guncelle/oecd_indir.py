"""
oecd_indir.py — OECD bölgesel ve kent (FUA) verilerini SDMX API'sinden Türkiye için indirir.

Platformdaki OECD göstergeleri pipeline/donusturuculer/eslemeler/oecd-bolgesel.csv ve oecd-kentler.csv eşleme
dosyalarında tanımlıdır; bu betik eşlemelerde geçen veri akışlarını (ör. DSD_REG_ECO_DF_GDP) indirir ve
pipeline/donusturuculer/oecd_sdmx.py'nin beklediği adla ("<akış>_turkiye.csv") bir klasöre yazar.
Böylece daha önce elle (R betiğiyle) yapılan indirme otomatikleşir; dönüştürme kuralları aynen kullanılır.

Kullanım:
    python tools/guncelle/oecd_indir.py --cikti build/guncelleme/oecd/turkiye

API: https://sdmx.oecd.org/public/rest  (anahtar gerekmez; istekler arasında bekleme ve 429/5xx'te yeniden deneme yapılır)
Türkiye süzgeci: veri yapısındaki REF_AREA boyutuna Türkiye kodları (TUR, Düzey 1-2-3 ve FUA/şehir kodları) yazılır.
"""
from __future__ import annotations

import argparse
import csv
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
API = "https://sdmx.oecd.org/public/rest"
AJANS = "OECD.CFE.EDS"
ESLEMELER = [KOK / "pipeline/donusturuculer/eslemeler/oecd-bolgesel.csv",
             KOK / "pipeline/donusturuculer/eslemeler/oecd-kentler.csv"]
NS = {"s": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure"}
UA = "dakaveri-guncelleme/1.0 (Turkiye Bolgesel Veri Analizleri)"


def getir(url: str, deneme: int = 6, bekle: float = 20.0) -> bytes:
    """GET; 429 ve 5xx yanıtlarında artan beklemeyle yeniden dener."""
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "identity"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise
            if e.code in (429, 500, 502, 503, 504) and i < deneme - 1:
                t = bekle * (i + 1)
                print(f"    HTTP {e.code}, {t:.0f} sn sonra yeniden denenecek", flush=True)
                time.sleep(t)
                continue
            raise
        except (urllib.error.URLError, TimeoutError) as e:
            if i < deneme - 1:
                time.sleep(bekle)
                continue
            raise
    raise RuntimeError("ulaşılamadı: " + url)


def akislar() -> list[str]:
    """Eşleme dosyalarındaki 'dosya' önekleri → SDMX akış kimliği (DSD_REG_ECO_DF_GDP → DSD_REG_ECO@DF_GDP)."""
    out = []
    for p in ESLEMELER:
        with open(p, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                d = (r.get("dosya") or r.get("﻿dosya") or "").strip()
                if d and d not in out:
                    out.append(d)
    return out


def akis_kimligi(dosya: str) -> str:
    i = dosya.index("_DF_")
    return dosya[:i] + "@" + dosya[i + 1:]


def turkiye_kodlari() -> dict[str, list[str]]:
    """Bölgesel akışlar için TUR + Düzey 1/2/3; kent akışları için FUA (…F) ve şehir (…C) kodları."""
    db = sqlite3.connect(KOK / "build/veri.db")
    bolge = ["TUR"] + [g for (g,) in db.execute(
        "SELECT geo FROM entities WHERE level IN ('region12','region26','province') ORDER BY geo")]
    kent = set()
    p = KOK / "veri-ekleri/oecd-kentler.csv"
    if p.exists():
        with open(p, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if re.fullmatch(r"TR\d{3}[FC]", r["kod"]):
                    kent.add(r["kod"])
    # her FUA için hem işlevsel kent alanı (…F) hem şehir (…C) kodu; bazı akışlar yalnız birini içerir
    kent |= {f"TR{i:03d}{t}" for i in range(1, 27) for t in "FC"}
    return {"REG": bolge, "FUA": ["TUR"] + sorted(kent)}


def boyutlar(akis: str) -> list[str]:
    """Veri yapısı tanımındaki boyut sırası (TIME_PERIOD hariç)."""
    xml = getir(f"{API}/dataflow/{AJANS}/{akis}/latest?references=datastructure")
    kok = ET.fromstring(xml)
    dims = kok.findall(".//s:DataStructure/s:DataStructureComponents/s:DimensionList/s:Dimension", NS)
    dims.sort(key=lambda d: int(d.get("position", "0")))
    return [d.get("id") for d in dims]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cikti", default=str(KOK / "build/guncelleme/oecd/turkiye"))
    ap.add_argument("--bekleme", type=float, default=3.0, help="istekler arası bekleme (sn)")
    ap.add_argument("--yalniz", nargs="*", help="yalnız bu dosya önekleri (ör. DSD_REG_ECO_DF_GDP)")
    a = ap.parse_args(argv)
    cikti = Path(a.cikti)
    cikti.mkdir(parents=True, exist_ok=True)
    kodlar = turkiye_kodlari()
    liste = [d for d in akislar() if not a.yalniz or d in a.yalniz]
    print(f"{len(liste)} OECD veri akışı indirilecek -> {cikti}")
    sorun = []
    for d in liste:
        akis = akis_kimligi(d)
        try:
            dims = boyutlar(akis)
            time.sleep(a.bekleme)
            if "REF_AREA" not in dims:
                raise RuntimeError(f"REF_AREA boyutu yok: {dims}")
            tur = "FUA" if d.startswith("DSD_FUA") else "REG"
            anahtar = ".".join("+".join(kodlar[tur]) if b == "REF_AREA" else "" for b in dims)
            veri = getir(f"{API}/data/{AJANS},{akis},/{anahtar}?format=csvfilewithlabels")
            (cikti / f"{d}_turkiye.csv").write_bytes(veri)
            satir = veri.count(b"\n") - 1
            print(f"  {d}: {satir} satır", flush=True)
            if satir <= 0:
                sorun.append(f"{d}: boş yanıt")
        except Exception as e:  # noqa: BLE001
            sorun.append(f"{d}: {e}")
            print(f"  {d}: HATA {e}", flush=True)
        time.sleep(a.bekleme)
    if sorun:
        print("SORUNLAR:\n  " + "\n  ".join(sorun))
    return 1 if len(sorun) == len(liste) else 0


if __name__ == "__main__":
    sys.exit(main())
