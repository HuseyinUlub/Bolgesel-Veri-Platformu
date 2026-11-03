"""
il_tipolojisi.py — illerin OECD bölge tipolojisini veri hattına katar.

Kaynak: veri-ekleri/oecd-tipoloji/il-tipolojisi.csv (noktalı virgül, UTF-8), resmî OECD "Territorial
correspondence table – TL2024" dosyasından üretilir: python tools/oecd-tipoloji/donustur.py
    kod;il;kentsel_kirsal_kod;kentsel_kirsal;kentsel_kirsal_ayrintili_kod;kentsel_kirsal_ayrintili;
    kente_erisim_kod;kente_erisim;metropol_bolge_kod;metropol_bolge

Tipolojiler (TL3 = il):
  kentsel–kırsal            : PU ağırlıklı kentsel, IN ara, PRC ağırlıklı kırsal–kente yakın, PRR ağırlıklı kırsal–uzak
  kentsel–kırsal (ayrıntılı): ara iller kente yakın (INC) / uzak (INR) diye ayrılır; OECD 5 ilde ayırmamış (IN)
  kente erişim              : MR_L büyük metropol, MR_M orta ölçekli metropol, NMR_M metropole yakın,
                              NMR_S küçük kente yakın, NMR_R uzak
  metropol bölgesi          : OECD metropol bölgesi kodu (TR001M …), yalnız 11 metropol il

Çıktılar: veri.db `il_tipolojisi` tablosu, public/veri/il-tipolojisi.json
"""
from __future__ import annotations

import csv
import json
import sqlite3
from pathlib import Path

DOSYA = Path("oecd-tipoloji") / "il-tipolojisi.csv"
SINIFLAR = {
    "kentsel_kirsal": ["PU", "IN", "PRC", "PRR"],
    "kentsel_kirsal_ayrintili": ["PU", "INC", "INR", "IN", "PRC", "PRR"],
    "kente_erisim": ["MR_L", "MR_M", "NMR_M", "NMR_S", "NMR_R"],
}


def il_tipolojisi(ek_dir: Path, db_path: Path, web_dir: Path, ents: dict, rep) -> None:
    rep.h("İllerin OECD tipolojisi")
    yol = ek_dir / DOSYA
    if not yol.exists():
        rep.warn(f"{DOSYA} bulunamadı; il tipolojisi atlandı")
        return
    with open(yol, encoding="utf-8-sig", newline="") as f:
        satirlar = list(csv.DictReader(f, delimiter=";"))
    iller = {k for k, e in ents.items() if e.get("level") == "province"}
    kodlar = {s["kod"] for s in satirlar}
    if iller and kodlar != iller:
        rep.warn(f"İl tipolojisi: eksik {sorted(iller - kodlar)}, fazla {sorted(kodlar - iller)}")
    for t, gecerli in SINIFLAR.items():
        hatali = [s["kod"] for s in satirlar if s[t + "_kod"] not in gecerli]
        if hatali:
            rep.warn(f"İl tipolojisi: geçersiz {t} kodu: {', '.join(hatali)}")

    con = sqlite3.connect(db_path)
    try:
        con.executescript("""
            DROP TABLE IF EXISTS il_tipolojisi;
            CREATE TABLE il_tipolojisi (kod TEXT PRIMARY KEY, kentsel_kirsal TEXT, kentsel_kirsal_ad TEXT,
                                        kentsel_kirsal_ayrintili TEXT, kentsel_kirsal_ayrintili_ad TEXT,
                                        kente_erisim TEXT, kente_erisim_ad TEXT, metropol_bolge TEXT);
        """)
        con.executemany("INSERT INTO il_tipolojisi VALUES (?,?,?,?,?,?,?,?)",
                        [(s["kod"], s["kentsel_kirsal_kod"], s["kentsel_kirsal"], s["kentsel_kirsal_ayrintili_kod"],
                          s["kentsel_kirsal_ayrintili"], s["kente_erisim_kod"], s["kente_erisim"],
                          s["metropol_bolge_kod"] or None)
                         for s in satirlar])
        con.commit()
    finally:
        con.close()

    adlar = {t: {} for t in SINIFLAR}
    for s in satirlar:
        for t in SINIFLAR:
            adlar[t][s[t + "_kod"]] = s[t]
    web_dir.mkdir(parents=True, exist_ok=True)
    (web_dir / "il-tipolojisi.json").write_text(json.dumps({
        "kaynak": "OECD Territorial correspondence table – TL2024 (3 Eylül 2026 sürümü)",
        "alanlar": ["kentsel_kirsal", "kente_erisim", "kentsel_kirsal_ayrintili", "metropol_bolge"],
        "siniflar": {t: [{"kod": k, "ad": adlar[t].get(k, k)} for k in SINIFLAR[t]] for t in SINIFLAR},
        "iller": {s["kod"]: [s["kentsel_kirsal_kod"], s["kente_erisim_kod"], s["kentsel_kirsal_ayrintili_kod"],
                             s["metropol_bolge_kod"] or None] for s in satirlar},
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    say = {t: {k: sum(1 for s in satirlar if s[t + "_kod"] == k) for k in SINIFLAR[t]} for t in SINIFLAR}
    rep.info(f"{len(satirlar)} il; kentsel–kırsal {say['kentsel_kirsal']}; ayrıntılı {say['kentsel_kirsal_ayrintili']}; "
             f"kente erişim {say['kente_erisim']}; metropol bölgesi {sum(1 for s in satirlar if s['metropol_bolge_kod'])}")
    rep.info("Yazıldı: veri.db `il_tipolojisi`, `public/veri/il-tipolojisi.json`")
