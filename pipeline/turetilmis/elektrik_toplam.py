"""
elektrik_toplam.py — EPDK lisanslı üretim ile lisanssız üretimden sisteme verilen enerjiyi toplar.

Neden: OECD'nin bölgesel elektrik üretimi göstergeleri (toplam, kaynak payları, karbon yoğunluğu) Türkiye için
Düzey 2'de yalnız 2019'u veriyor ve bölge dağılımı EPDK ile tutmuyor (ör. Gaziantep-Adıyaman-Kilis'te OECD
EPDK'nın 7,7 katı; sınırdaki büyük barajlar farklı bölgeye yazılmış görünüyor). Türkiye toplamı ise bu iki EPDK
kaleminin toplamıyla %0,1 içinde aynı. OECD sürümleri kaldırıldı (bkz. docs/DENETIM.md, madde 12).

Girdi : build/veri.db   Çıktı: veri-ekleri/turetilmis-elektrik.csv
Kullanım: python pipeline/turetilmis/elektrik_toplam.py  (sonra: python pipeline/build_data.py)
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

KOK = Path(__file__).resolve().parents[1].parent
LISANSLI = "Lisanslı Elektrik Üretimi (GWh)"
LISANSSIZ = "Lisanssız Üretilen İhtiyaç Fazlası Olarak Sisteme Verilen Enerji Miktarı (GWh)"
AD = "Toplam Elektrik Üretimi (Lisanslı + Lisanssız) (GWh)"
KAYNAK = "Enerji Piyasası Düzenleme Kurumu verileri baz alınarak hesaplanmıştır."


def main():
    c = sqlite3.connect(KOK / "build" / "veri.db")
    seri = lambda ad: {(g, t): v for g, t, v in c.execute(
        "SELECT geo, time, value FROM values_long WHERE indicator=?", (ad,)) if v is not None}
    a, b = seri(LISANSLI), seri(LISANSSIZ)
    satir = [[g, AD, "Enerji", t, f"{a[(g, t)] + b[(g, t)]:.2f}", KAYNAK] for (g, t) in sorted(a) if (g, t) in b]
    cikti = KOK / "veri-ekleri" / "turetilmis-elektrik.csv"
    with open(cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satir)
    print(f"{cikti.name}: {len(satir)} değer")


if __name__ == "__main__":
    main()
