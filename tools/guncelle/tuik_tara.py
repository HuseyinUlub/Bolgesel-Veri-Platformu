"""
tuik_tara.py — TÜİK SDMX veri akışlarının hepsini indirip coğrafi düzey ve dönem kapsamını çıkarır.

Çıktılar (build/guncelleme/tuik/):
  ham/<akış>.csv.gz   her akışın SDMX-CSV verisi (önbellek; tuik_sdmx.py indir ile aynı biçim)
  kapsam.csv          akış başına: ad, satır, gösterge sayısı, dönem, il/Düzey 2/Düzey 1 kod sayısı

İBBS kodları: TR (Türkiye), TR1 (Düzey 1), TR10 (Düzey 2), TR100 (Düzey 3 = il).
Kullanım: python tools/guncelle/tuik_tara.py [--yeniden] [--is 4]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import io
import re
import sys
import threading
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import tuik_sdmx as T  # noqa: E402

CIKTI = T.CIKTI
HAM = CIKTI / "ham"
CSV_KABUL = "application/vnd.sdmx.data+csv;version=1.0.0"


def akislar(tok):
    kok = ET.fromstring(T.getir("/dataflow/TR/all/latest", tok))
    for df in kok.iter(f"{{{T.NS['s']}}}Dataflow"):
        ad = {n.get("{http://www.w3.org/XML/1998/namespace}lang"): n.text for n in df.findall("c:Name", T.NS)}
        yield df.get("id"), df.get("version"), (ad.get("tr") or ad.get("en") or "").strip()


def duzey(kod: str) -> str | None:
    if kod == "TR":
        return "TR"
    m = re.fullmatch(r"TR[1-9A-C](\d?)(\d?)", kod)
    if not m:
        return None
    return {0: "D1", 1: "D2", 2: "il"}[len(m.group(1)) + len(m.group(2))]


def ozet(veri: bytes):
    """Coğrafi boyut REF_AREA olmayabilir (ör. ADNKS'de IKAMET_YERI): en çok İBBS kodu taşıyan sütun seçilir."""
    r = csv.DictReader(io.TextIOWrapper(io.BytesIO(veri), encoding="utf-8-sig"))
    alan = r.fieldnames or []
    disla = {"DATAFLOW", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "UNIT_MEASURE", "UNIT_MULT", "DECIMAL", "TIME_FORMAT"}
    kodlar = {a: {"TR": set(), "D1": set(), "D2": set(), "il": set()} for a in alan if a not in disla}
    yil, gost, n = set(), set(), 0
    for s in r:
        n += 1
        for a, k in kodlar.items():
            if (d := duzey(s.get(a) or "")):
                k[d].add(s[a])
        if s.get("TIME_PERIOD"):
            yil.add(s["TIME_PERIOD"][:4])
        for a in ("INDICATOR",) + tuple(x for x in alan if x.endswith("GOSTERGE")):
            if s.get(a) and s[a] != "_Z":
                gost.add(f"{a}={s[a]}")
    geo = max(kodlar, key=lambda a: (len(kodlar[a]["il"]), len(kodlar[a]["D2"]), len(kodlar[a]["D1"])), default=None)
    kod = kodlar.get(geo) or {"TR": set(), "D1": set(), "D2": set(), "il": set()}
    ys = sorted(y for y in yil if y.isdigit())
    return {"satir": n, "geo_boyut": geo or "", "gosterge": len(gost), "ilk": ys[0] if ys else "", "son": ys[-1] if ys else "",
            "il": len(kod["il"]), "d2": len(kod["D2"]), "d1": len(kod["D1"]), "tr": len(kod["TR"]),
            "boyutlar": "|".join(a for a in alan if a not in disla)}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--yeniden", action="store_true", help="önbellekteki dosyaları da yeniden indir")
    ap.add_argument("--is", type=int, default=2)
    a = ap.parse_args(argv)
    HAM.mkdir(parents=True, exist_ok=True)
    tok = {"t": T.token()}
    kilit = threading.Lock()
    liste = list(akislar(tok["t"]))
    print(f"{len(liste)} akış", flush=True)

    def isle(x):
        akis, surum, ad = x
        p = HAM / f"{akis}.csv.gz"
        try:
            if a.yeniden or not p.exists():
                try:
                    veri = T.getir(f"/data/TR,{akis},{surum}", tok["t"], CSV_KABUL)
                except T.urllib.error.HTTPError as e:
                    if e.code == 401:
                        with kilit:
                            tok["t"] = T.token()
                        veri = T.getir(f"/data/TR,{akis},{surum}", tok["t"], CSV_KABUL)
                    else:
                        raise
                p.write_bytes(gzip.compress(veri))
            else:
                veri = gzip.decompress(p.read_bytes())
            o = ozet(veri)
            o["durum"] = "tamam"
        except T.urllib.error.HTTPError as e:
            o = {"durum": f"HTTP {e.code} {e.read()[:60].decode('utf-8', 'replace')}"}
        except Exception as e:  # noqa: BLE001
            o = {"durum": f"hata {e}"[:80]}
        return {"akis": akis, "surum": surum, "ad": ad, **o}

    sonuc = []
    with ThreadPoolExecutor(a.is_ if hasattr(a, "is_") else getattr(a, "is")) as ex:
        for i, s in enumerate(ex.map(isle, liste), 1):
            sonuc.append(s)
            if i % 25 == 0:
                print(f"  {i}/{len(liste)}", flush=True)
    alanlar = ["akis", "surum", "ad", "durum", "satir", "gosterge", "ilk", "son", "il", "d2", "d1", "tr", "geo_boyut", "boyutlar"]
    with open(CIKTI / "kapsam.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, alanlar, delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(sonuc)
    ok = [s for s in sonuc if s["durum"] == "tamam"]
    print(f"tamam: {len(ok)} · il düzeyi: {sum(1 for s in ok if s['il'] >= 75)} · Düzey 2: {sum(1 for s in ok if s['d2'] >= 24)}"
          f" · Düzey 1: {sum(1 for s in ok if s['d1'] >= 11)} -> {CIKTI / 'kapsam.csv'}")


if __name__ == "__main__":
    sys.exit(main())
