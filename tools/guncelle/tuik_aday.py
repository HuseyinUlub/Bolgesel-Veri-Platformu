"""
tuik_aday.py — eşleme tablosundaki onaylı TÜİK göstergelerini indirilmiş akışlardan üretir ve sitedeki değerlerle karşılaştırır.

Çıktılar
  build/guncelleme/aday/tuik-api.ham.csv     veri-ekleri şablonunda aday değerler (kod;gosterge;kategori;yil;deger;kaynak)
  build/guncelleme/tuik/kiyas.json           sitede yayımlanan değerlerle karşılaştırma özeti (rapor için)

Kurallar
  - Değerler sitedeki gösterge ondalığına yuvarlanır (ondalık bilinmiyorsa 6 anlamlı basamak).
  - Sitedeki serinin ilk yılından önceki yıllar varsayılan olarak alınmaz (--gecmis ile alınır); rapora yazılır.
  - Yalnız durum = onayli satırlar kullanılır.

Kullanım: python tools/guncelle/tuik_aday.py [--gecmis]
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline"))
import tuik_donustur as D  # noqa: E402
from kaynak_turu import gorunen  # noqa: E402

KOK = D.KOK
GD = KOK / "build/guncelleme"
ESIK = 0.005
VARSAYILAN_KAYNAK = "Türkiye İstatistik Kurumu"


def site():
    """Sitede yayımlanan göstergeler: görünen ad -> (meta, değer sözlüğü yükleyici)."""
    p = KOK / "public/veri/manifest.json"
    if not p.exists():
        return {}, lambda g: {}
    M = json.loads(p.read_text(encoding="utf-8"))
    by_ad = {}
    for k in M["kategoriler"]:
        for g in k["gostergeler"]:
            by_ad[g["ad"]] = {**g, "kategori": k["ad"], "slug": k["slug"]}
    onbellek = {}

    def veri(g):
        if g["slug"] not in onbellek:
            f = KOK / "public/veri/k" / f"{g['slug']}.json"
            onbellek[g["slug"]] = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
        return {(kod, yil): float(v) for yil, d in onbellek[g["slug"]].get(g["id"], {}).items() for kod, v in d.items()}
    return by_ad, veri


def yuvarla(v: float, ond: int | None) -> str:
    x = round(v, ond) if ond is not None else float(f"{v:.6g}")
    s = f"{x:.{ond}f}" if ond is not None else f"{x:.6g}"
    return s.replace(".", ",")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--gecmis", action="store_true")
    a = ap.parse_args(argv)
    by_ad, veri = site()
    satirlar, kiyas = [], {}
    eksik_akis = []
    for e in D.esleme_oku():
        if e.get("durum") != "onayli":
            continue
        if not (D.HAM / f"{e['akis']}.csv.gz").exists():
            eksik_akis.append(e["akis"]); continue
        try:
            A = D.uygula(e)
        except Exception as x:  # noqa: BLE001
            kiyas[e["gosterge"]] = {"hata": str(x)[:200]}; continue
        g = None
        for ad in (e["gosterge"], *[gorunen(e["gosterge"], k) for k in ("Türkiye İstatistik Kurumu", "TÜİK")]):
            g = g or by_ad.get(ad)
        P = veri(g) if g else {}
        ond = g.get("ondalik") if g else None
        ilk = min((k[1] for k in P), default=None)
        o = {"ayni": 0, "revize": 0, "yeni": 0, "gecmis": 0, "ornek": [], "yillar_yeni": set(), "kapsanmayan": 0,
             "son_api": max((k[1] for k in A), default=""), "son_site": max((k[1] for k in P), default="")}
        for (kod, yil), v in sorted(A.items(), key=lambda x: (x[0][1], x[0][0])):
            if ilk and yil < ilk and not a.gecmis:
                o["gecmis"] += 1
                continue
            s = yuvarla(v, ond)
            vv = float(s.replace(",", "."))
            if (kod, yil) in P:
                p = P[(kod, yil)]
                if abs(vv - p) > ESIK * max(abs(p), abs(vv), 1e-9):
                    o["revize"] += 1
                    if len(o["ornek"]) < 3:
                        o["ornek"].append(f"{kod} {yil}: {yuvarla(p, ond)} → {s}")
                else:
                    o["ayni"] += 1
            else:
                o["yeni"] += 1
                o["yillar_yeni"].add(yil)
            satirlar.append([kod, e["gosterge"], e["kategori"], yil, s, (g or {}).get("kaynak") or VARSAYILAN_KAYNAK])
        o["kapsanmayan"] = sum(1 for k in P if k not in A)
        o["yillar_yeni"] = sorted(o["yillar_yeni"])
        kiyas[e["gosterge"]] = o
    (GD / "aday").mkdir(parents=True, exist_ok=True)
    with open(GD / "aday" / "tuik-api.ham.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satirlar)
    (GD / "tuik").mkdir(parents=True, exist_ok=True)
    (GD / "tuik" / "kiyas.json").write_text(json.dumps({"kiyas": kiyas, "eksik_akis": sorted(set(eksik_akis))},
                                                      ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(kiyas)} gösterge, {len(satirlar)} değer -> {GD / 'aday' / 'tuik-api.ham.csv'}")
    if eksik_akis:
        print("indirilmemiş akış:", ", ".join(sorted(set(eksik_akis))))


if __name__ == "__main__":
    sys.exit(main())
