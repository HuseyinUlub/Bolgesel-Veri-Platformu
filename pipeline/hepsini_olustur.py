"""hepsini_olustur.py — Sitenin bütün verisini ham kaynaklardan tek komutla baştan üretir.

Depodan yeni indirilmiş bir bilgisayarda da aynı siteyi üretmek için kullanılır. Sırasıyla:

  1. Veritabanı       pipeline/build_data.py                 → build/veri.db, public/veri/ (gösterge dosyaları)
  2. Türetilmiş ekler pipeline/turetilmis/*.py               → veri-ekleri/turetilmis-*.csv
                      (bir ek değiştiyse 1. adım bir kez daha çalışır)
  3. Sayfa verileri   tools/uluslararasi, tools/vitrin, tools/analiz; kaynaklar/sabit/ (kent-kır haritası)
                                                             → public/veri/*.json
  4. Değişiklik denetimi  kaynaklar/veri-ozeti.csv ile karşılaştırma → build/degisiklik-raporu.md
  5. Site (isteğe bağlı, --site)  npm run build              → dist/

Kullanım:
    py -X utf8 pipeline/hepsini_olustur.py            # veri (1–4)
    py -X utf8 pipeline/hepsini_olustur.py --site     # veri + siteyi derle (Node gerekir)
    py -X utf8 pipeline/hepsini_olustur.py --ozet-kaydet   # denetimden sonra yeni özeti kaynak kabul et

Gerekli paketler: py -m pip install shapely scipy numpy openpyxl
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import os
import shutil
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

KOK = Path(__file__).resolve().parents[1]
PY = sys.executable

TURETILMIS = [  # veritabanından türetilip veri-ekleri'ne yazılan ekler
    "pipeline/turetilmis/esitsizlik.py",
    "pipeline/turetilmis/tuik_oranlar.py",
    "pipeline/turetilmis/turkiye_paylari.py",
    "pipeline/turetilmis/elektrik_toplam.py",
]
SAYFA = [  # public/veri altındaki sayfa verileri (sıra önemli: analiz vitrin.json'u okur)
    "tools/uluslararasi/giris_verisi.py",
    "tools/uluslararasi/avrupa_sahne_verisi.py",
    "tools/uluslararasi/donustur.py",
    "tools/vitrin/vitrin_verisi.py",
    "tools/analiz/analiz_verisi.py",
]
# Sabit coğrafi çıktılar: bir kez üretilir, kaynaklar/sabit/ altında saklanır ve her seferinde kopyalanır.
# kent-kir.json, TÜİK PDF haritası ve GHSL karolarıyla tools/tuik-kent-kir-harita/donustur.py tarafından üretildi.
SABIT = {"kent-kir.json": "public/veri/geo/kent-kir.json"}
OZET = KOK / "kaynaklar" / "veri-ozeti.csv"
DENETIM = KOK / "build" / "degisiklik-raporu.md"


def calistir(betik: str) -> None:
    t0 = time.time()
    print(f"\n▶ {betik}", flush=True)
    env = dict(os.environ, PYTHONUTF8="1")
    r = subprocess.run([PY, "-X", "utf8", str(KOK / betik)], cwd=KOK, env=env)
    if r.returncode:
        sys.exit(f"✖ {betik} hata verdi (çıkış kodu {r.returncode}). Yukarıdaki mesaja bakın.")
    print(f"  ✔ {time.time() - t0:.0f} sn")


def ek_imzasi() -> str:
    h = hashlib.sha1()
    for p in sorted((KOK / "veri-ekleri").glob("turetilmis-*.csv")):
        h.update(p.name.encode()); h.update(p.read_bytes())
    return h.hexdigest()


# --------------------------------------------------------------------------- değişiklik denetimi
def ozet_uret() -> dict[tuple[str, str], tuple[int, str, float]]:
    """gösterge × düzey → (değer sayısı, son yıl, değerlerin toplamı)."""
    db = sqlite3.connect(KOK / "build" / "veri.db")
    q = """SELECT v.indicator, e.level, count(v.value), max(v.time), round(sum(v.value), 4)
           FROM values_long v JOIN entities e ON e.geo = v.geo
           WHERE v.value IS NOT NULL GROUP BY 1, 2"""
    return {(g, d): (n, str(y), s or 0.0) for g, d, n, y, s in db.execute(q)}


def ozet_oku() -> dict[tuple[str, str], tuple[int, str, float]]:
    if not OZET.exists():
        return {}
    with OZET.open(encoding="utf-8") as f:
        return {(r["gosterge"], r["duzey"]): (int(r["sayi"]), r["son_yil"], float(r["toplam"]))
                for r in csv.DictReader(f, delimiter=";")}


def ozet_yaz(oz) -> None:
    with OZET.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["gosterge", "duzey", "sayi", "son_yil", "toplam"])
        for (g, d), (n, y, s) in sorted(oz.items()):
            w.writerow([g, d, n, y, s])


def denetle(kaydet: bool) -> None:
    yeni, eski = ozet_uret(), ozet_oku()
    if not eski:
        ozet_yaz(yeni)
        DENETIM.write_text("# Değişiklik denetimi\n\nİlk özet oluşturuldu: kaynaklar/veri-ozeti.csv. "
                           "Bundan sonraki çalıştırmalar buna göre karşılaştırılır.\n", encoding="utf-8")
        print(f"\nİlk veri özeti yazıldı ({len(yeni)} gösterge × düzey): {OZET.relative_to(KOK)}")
        return
    kayip = sorted(k for k in eski if k not in yeni)
    gelen = sorted(k for k in yeni if k not in eski)
    yil, sayi, deger = [], [], []
    for k in sorted(set(eski) & set(yeni)):
        (n0, y0, s0), (n1, y1, s1) = eski[k], yeni[k]
        if y1 != y0:
            yil.append((k, y0, y1))
        elif n1 < n0:
            sayi.append((k, n0, n1))
        elif n1 == n0 and abs(s1 - s0) > 1e-6 * max(1.0, abs(s0)):
            deger.append((k, s0, s1))
    satir = ["# Değişiklik denetimi", "",
             f"Karşılaştırılan: `kaynaklar/veri-ozeti.csv` ({len(eski)}) → bu çalıştırma ({len(yeni)}) gösterge × düzey.", ""]

    def blok(baslik, liste, bicim, uyari=False):
        satir.append(f"## {'⚠ ' if uyari else ''}{baslik}: {len(liste)}")
        satir.extend(bicim(x) for x in liste[:200])
        if len(liste) > 200:
            satir.append(f"- … ve {len(liste) - 200} satır daha")
        satir.append("")

    blok("Kaybolan gösterge × düzey", kayip, lambda k: f"- {k[0]} · {k[1]}", uyari=True)
    blok("Değer sayısı azalan", sayi, lambda x: f"- {x[0][0]} · {x[0][1]}: {x[1]} → {x[2]}", uyari=True)
    blok("Son yılı değişen", yil, lambda x: f"- {x[0][0]} · {x[0][1]}: {x[1]} → {x[2]}")
    blok("Yıl aynı, değerleri değişen (revizyon)", deger, lambda x: f"- {x[0][0]} · {x[0][1]}")
    blok("Yeni gelen gösterge × düzey", gelen, lambda k: f"- {k[0]} · {k[1]}")
    DENETIM.write_text("\n".join(satir), encoding="utf-8")
    print(f"\nDeğişiklik denetimi: kaybolan {len(kayip)}, azalan {len(sayi)}, son yılı değişen {len(yil)}, "
          f"revize {len(deger)}, yeni {len(gelen)} → {DENETIM.relative_to(KOK)}")
    if kayip or sayi:
        print("⚠ Kaybolan ya da azalan veri var; raporu inceleyin.")
    if kaydet:
        ozet_yaz(yeni)
        print(f"Yeni özet kaynak kabul edildi: {OZET.relative_to(KOK)} (commit edin)")
    else:
        print("Değişiklikler doğruysa: --ozet-kaydet ile yeni özeti kaynak kabul edin.")


# ---------------------------------------------------------------------------
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", action="store_true", help="sonunda siteyi derle (npm run build)")
    ap.add_argument("--ozet-kaydet", action="store_true", help="yeni veri özetini kaynak kabul et")
    a = ap.parse_args()
    t0 = time.time()

    calistir("pipeline/build_data.py")
    once = ek_imzasi()
    for b in TURETILMIS:
        calistir(b)
    if ek_imzasi() != once:
        print("\nTüretilmiş ekler değişti; veritabanı yeniden üretiliyor.")
        calistir("pipeline/build_data.py")

    for ad, hedef in SABIT.items():
        (KOK / hedef).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(KOK / "kaynaklar" / "sabit" / ad, KOK / hedef)
    for b in SAYFA:
        calistir(b)

    denetle(a.ozet_kaydet)

    if a.site:
        npm = shutil.which("npm") or shutil.which("npm.cmd")
        if not npm:
            sys.exit("Node/npm bulunamadı; siteyi derlemek için Node kurun ya da --site olmadan çalıştırın.")
        print("\n▶ npm run build", flush=True)
        if subprocess.run([npm, "run", "build"], cwd=KOK).returncode:
            sys.exit("✖ Site derlenemedi.")
    print(f"\nBitti ({(time.time() - t0) / 60:.1f} dk). Rapor: build/rapor.md, denetim: build/degisiklik-raporu.md")


if __name__ == "__main__":
    main()
