"""
haftalik.py — zamanlanmış görevin çalıştırdığı haftalık güncelleme (yalnız indirir ve raporlar; hiçbir şeyi uygulamaz).

guncelle.py'yi çalıştırır, çıktıyı build/guncelleme/log/haftalik.log'a yazar ve özet satırını
build/guncelleme/SON-RAPOR.txt'ye koyar. Rapor okunup onaylandıktan sonra elle uygulanır:
    py -3.13 -X utf8 tools/guncelle/guncelle.py --indirme-yok --uygula --site

Görevi kaydetmek / kaldırmak (yönetici bilgisayarda bir kez):
    py -3.13 tools/guncelle/haftalik.py --kaydet      # her pazartesi 09:00
    py -3.13 tools/guncelle/haftalik.py --kaldir
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import subprocess
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
GD = KOK / "build/guncelleme"
GOREV = "Bolgesel Veri Platformu - Haftalik Guncelleme"


def calis() -> int:
    (GD / "log").mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PYTHONUTF8="1")
    with open(GD / "log" / "haftalik.log", "w", encoding="utf-8") as f:
        f.write(f"başladı: {dt.datetime.now():%Y-%m-%d %H:%M}\n")
        f.flush()
        rc = subprocess.run([sys.executable, "-X", "utf8", str(KOK / "tools/guncelle/guncelle.py")],
                            cwd=KOK, stdout=f, stderr=subprocess.STDOUT, env=env).returncode
    rapor = GD / f"rapor-{dt.date.today().isoformat()}.md"
    durum = "tamam" if rc == 0 and rapor.exists() else f"HATA (çıkış kodu {rc}; build/guncelleme/log/haftalik.log)"
    (GD / "SON-RAPOR.txt").write_text(
        f"{dt.datetime.now():%Y-%m-%d %H:%M} · {durum}\nRapor: {rapor.relative_to(KOK)}\n"
        "Onaydan sonra: py -3.13 -X utf8 tools/guncelle/guncelle.py --indirme-yok --uygula --site\n", encoding="utf-8")
    return rc


def kaydet() -> int:
    komut = f'"{sys.executable}" -X utf8 "{Path(__file__).resolve()}"'
    return subprocess.run(["schtasks", "/Create", "/F", "/TN", GOREV, "/SC", "WEEKLY", "/D", "MON",
                           "/ST", "09:00", "/TR", komut]).returncode


def kaldir() -> int:
    return subprocess.run(["schtasks", "/Delete", "/F", "/TN", GOREV]).returncode


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kaydet", action="store_true")
    ap.add_argument("--kaldir", action="store_true")
    a = ap.parse_args()
    sys.exit(kaydet() if a.kaydet else kaldir() if a.kaldir else calis())
