"""
OECD Territorial correspondence (TL2024) → veri-ekleri/oecd-tipoloji/il-tipolojisi.csv

Kaynak: OECD "Territorial correspondence table – TL2024" (oe.cd/geostats), 3 Eylül 2026 sürümü,
sayfa "Regions TL2024". Türkiye'nin 81 TL3 bölgesi (il) için:
  sütun N  Access to city – Level 2      → kente_erisim (MR_L, MR_M, NMR_M, NMR_S, NMR_R)
  sütun P  Rural/urban typology          → kentsel_kirsal (PU, IN, PR; PR ayrıntılı sütundan PRC/PRR)
  sütun Q  Extended rural/urban typology → kentsel_kirsal_ayrintili (PU, INC, INR, IN, PRC, PRR)
  sütun L  TL3C_ID                        → metropol_bolge_kod (yalnız "…M" ile bitenler: OECD metropol bölgesi)

Bu dosya resmî kaynaktır. Önceki sürüm (OECD tipoloji toplamlarından geriye doğru çıkarılmış atama) ile
farklar çalıştırınca yazdırılır.
Kullanım: python tools/oecd-tipoloji/donustur.py
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

import pandas as pd

BU = Path(__file__).parent
KOK = BU.parents[1]
KAYNAK = BU / "OECD-Territorial-correspondence-TL2024c.xlsx"
CIKTI = KOK / "veri-ekleri" / "oecd-tipoloji" / "il-tipolojisi.csv"

KK = {"PU": "Ağırlıklı kentsel", "IN": "Ara (geçiş)", "PRC": "Ağırlıklı kırsal – kente yakın",
      "PRR": "Ağırlıklı kırsal – uzak"}
KK_AYR = {"PU": "Ağırlıklı kentsel", "INC": "Ara – kente yakın", "INR": "Ara – uzak",
          "IN": "Ara (yakın/uzak ayrımı yok)", "PRC": "Ağırlıklı kırsal – kente yakın",
          "PRR": "Ağırlıklı kırsal – uzak"}
KE = {"MR_L": "Büyük metropol", "MR_M": "Orta ölçekli metropol", "NMR_M": "Metropole yakın",
      "NMR_S": "Küçük kente yakın", "NMR_R": "Uzak (kentten uzak)"}


def main() -> None:
    df = pd.read_excel(KAYNAK, sheet_name="Regions TL2024", header=None, skiprows=3, dtype=str)
    t = df[(df[0] == "TUR") & (df[3].str.strip() == "3") & (df[1] != "TRZZZ")]
    iller = {}
    db = KOK / "build" / "veri.db"
    if db.exists():
        iller = dict(sqlite3.connect(db).execute("SELECT geo, name FROM entities WHERE level='province'").fetchall())
    eski = {}
    if CIKTI.exists():
        with open(CIKTI, encoding="utf-8-sig") as f:
            eski = {s["kod"]: s for s in csv.DictReader(f, delimiter=";")}

    satirlar = []
    for _, r in t.iterrows():
        kod = r[1].strip()
        ayr = r[16].strip().removeprefix("3_")
        kk = {"INC": "IN", "INR": "IN"}.get(ayr, ayr)
        ke = r[14].strip()
        assert kk in KK and ayr in KK_AYR and ke in KE, (kod, kk, ayr, ke)
        assert r[15].strip().removeprefix("3_") == kk[:2] or kk == r[15].strip().removeprefix("3_"), kod
        il = iller.get(kod) or eski.get(kod, {}).get("il") or r[9].strip()
        mb = r[11].strip() if str(r[11]).strip().endswith("M") else ""
        satirlar.append({
            "kod": kod, "il": il,
            "kentsel_kirsal_kod": kk, "kentsel_kirsal": KK[kk],
            "kentsel_kirsal_ayrintili_kod": ayr, "kentsel_kirsal_ayrintili": KK_AYR[ayr],
            "kente_erisim_kod": ke, "kente_erisim": KE[ke],
            "metropol_bolge_kod": mb, "metropol_bolge": il if mb else "",
        })
    satirlar.sort(key=lambda s: s["il"])
    assert len(satirlar) == 81, len(satirlar)
    if iller:
        assert {s["kod"] for s in satirlar} == set(iller), "il kodları veri tabanıyla uyuşmuyor"

    fark = [(s["il"], (e["kentsel_kirsal_kod"], e["kente_erisim_kod"]), (s["kentsel_kirsal_kod"], s["kente_erisim_kod"]))
            for s in satirlar if (e := eski.get(s["kod"]))
            and (e["kentsel_kirsal_kod"], e["kente_erisim_kod"]) != (s["kentsel_kirsal_kod"], s["kente_erisim_kod"])]
    print(f"Önceki atamayla farklı il: {len(fark)}", *fark, sep="\n  ")

    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(satirlar[0]), delimiter=";")
        w.writeheader()
        w.writerows(satirlar)
    from collections import Counter
    for a in ("kentsel_kirsal_kod", "kentsel_kirsal_ayrintili_kod", "kente_erisim_kod"):
        print(a, dict(Counter(s[a] for s in satirlar)))
    print("Metropol bölgeleri:", ", ".join(f"{s['il']} ({s['metropol_bolge_kod']})" for s in satirlar if s["metropol_bolge_kod"]))
    print(f"→ {CIKTI.relative_to(KOK)}")


if __name__ == "__main__":
    main()
