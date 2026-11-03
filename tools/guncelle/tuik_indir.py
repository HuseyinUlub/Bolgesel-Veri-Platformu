"""
tuik_indir.py — eşleme tablosundaki (ya da verilen) TÜİK veri akışlarını ve yapısal metaverilerini indirir.

Çıktı: build/guncelleme/tuik/ham/<akış>.csv.gz (SDMX-CSV) ve build/guncelleme/tuik/yapi/<akış>.xml.gz
Belirteç (token) kısa ömürlü olduğu için 401 yanıtında yenilenir. Ağ kesintilerinde tuik_sdmx.getir yeniden dener.

Kullanım:
    python tools/guncelle/tuik_indir.py                      # tuik.csv'deki onaylı eşlemelerin akışları (yeniden indirir)
    python tools/guncelle/tuik_indir.py DF_ADNKS_T06 ...     # yalnız verilen akışlar
    python tools/guncelle/tuik_indir.py --onbellek           # var olan dosyaları yeniden indirmez
"""
from __future__ import annotations

import argparse
import csv
import gzip
import sys
import threading
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import tuik_sdmx as T  # noqa: E402
import tuik_donustur as D  # noqa: E402

CSV_KABUL = "application/vnd.sdmx.data+csv;version=1.0.0"
KAPSAM = D.KOK / "tuik-akis-kapsami.csv"


class Belirtec:
    def __init__(self):
        self.kilit = threading.Lock()
        self.t = T.token()

    def getir(self, yol, kabul=None):
        t = self.t
        try:
            return T.getir(yol, t, kabul)
        except urllib.error.HTTPError as e:
            if e.code != 401:
                raise
            with self.kilit:
                if self.t == t:
                    self.t = T.token()
            return T.getir(yol, self.t, kabul)


def surumler() -> dict:
    s = {}
    if KAPSAM.exists():
        s = {r["akis"]: r["surum"] for r in csv.DictReader(open(KAPSAM, encoding="utf-8-sig"), delimiter=";")}
    for r in D.esleme_oku():
        s[r["akis"]] = r.get("surum") or s.get(r["akis"], "latest")
    return s


def indir(akislar, onbellek=False, isci=2, yazdir=print) -> dict:
    D.HAM.mkdir(parents=True, exist_ok=True)
    (T.CIKTI / "yapi").mkdir(parents=True, exist_ok=True)
    sv = surumler()
    B = Belirtec()
    sonuc = {}

    def bir(akis):
        surum = sv.get(akis, "latest")
        p = D.HAM / f"{akis}.csv.gz"
        y = T.CIKTI / "yapi" / f"{akis}.xml.gz"
        try:
            if not (onbellek and p.exists()):
                p.write_bytes(gzip.compress(B.getir(f"/data/TR,{akis},{surum}", CSV_KABUL)))
            if not (onbellek and y.exists()):
                y.write_bytes(gzip.compress(B.getir(f"/dataflow/TR/{akis}/{surum}?references=descendants")))
            return akis, "tamam"
        except urllib.error.HTTPError as e:
            return akis, f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            return akis, f"hata: {e}"[:120]

    with ThreadPoolExecutor(isci) as ex:
        for akis, durum in ex.map(bir, akislar):
            sonuc[akis] = durum
            yazdir(f"  {akis}: {durum}")
    return sonuc


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("akislar", nargs="*")
    ap.add_argument("--onbellek", action="store_true")
    ap.add_argument("--is", dest="isci", type=int, default=2)
    a = ap.parse_args(argv)
    akislar = a.akislar or sorted({r["akis"] for r in D.esleme_oku() if r.get("durum") == "onayli"})
    if not akislar:
        sys.exit("İndirilecek akış yok: tuik.csv boş ve komut satırında akış verilmedi.")
    s = indir(akislar, a.onbellek, a.isci, lambda m: print(m, flush=True))
    hata = [k for k, v in s.items() if v != "tamam"]
    print(f"{len(s) - len(hata)}/{len(s)} akış indirildi" + (f"; hata: {', '.join(hata)}" if hata else ""))
    return 1 if hata else 0


if __name__ == "__main__":
    sys.exit(main())
