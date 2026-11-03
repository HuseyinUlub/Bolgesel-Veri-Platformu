"""
siniflandir.py — Göstergelerin veri kaynağı türü.

Türler:
  oecd-ozgun   OECD'den alınan, ulusal kaynaklarda bölge düzeyinde karşılığı olmayan veri
  oecd-ulusal  OECD'den alınan, ama ulusal bir kurumdan da elde edilebilecek veri (aciklama: o kurum)
  platform     Ulusal veriden platformun hesapladığı gösterge (OECD yöntemiyle hesaplananlar dahil)
  ulusal       TÜİK ve diğer ulusal kurumların yayımladığı veri

Girdi : build/veri.db (indicators.source)   Çıktı: veri-ekleri/kaynak-turleri.csv (gosterge;tur;aciklama)
Kullanım: python tools/kaynak-turu/siniflandir.py   (sonra: python pipeline/build_data.py)
Not: Yeni bir OECD göstergesi eklenirse ve ulusal karşılığı varsa ULUSAL_KARSILIK listesine eklenmeli.
"""
import csv
import sqlite3
from collections import Counter
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
import sys
sys.path.insert(0, str(KOK / "pipeline"))
from kaynak_turu import tur  # noqa: E402


def main():
    db = sqlite3.connect(KOK / "build" / "veri.db")
    satirlar = [(ad, *tur(ad, kaynak)) for ad, kaynak in db.execute("SELECT indicator, source FROM indicators ORDER BY indicator")]
    cikti = KOK / "veri-ekleri" / "kaynak-turleri.csv"
    with open(cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["gosterge", "tur", "aciklama"])
        w.writerows(satirlar)
    print(Counter(t for _, t, _ in satirlar))
    print("Yazıldı:", cikti.relative_to(KOK))


if __name__ == "__main__":
    main()
