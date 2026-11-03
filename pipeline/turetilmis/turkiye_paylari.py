"""
turkiye_paylari.py — Bölgelerin ve illerin Türkiye toplamındaki payları (GSYH, GSKD ve 11 sektörün katma değeri).

TÜİK'in "Sektörlere Göre Bölgesel Paylar (2009 Bazlı)" tablosunu (pivot.xls) mevcut cari fiyatlı TÜİK
il/bölge hesaplarından yeniden üretir: pay = 100 × bölgenin değeri ÷ Türkiye değeri. TÜİK tablosuyla
karşılaştırıldı (2020–2024, 81 il: GSYH ve GSKD payları en fazla 0,005 puan farkla aynı, fark yuvarlamadan).

Bunlar "Katma Değerde Sektör Payı" göstergelerinden farklıdır: o göstergeler sektörün bölgenin kendi
katma değerindeki payını; buradakiler bölgenin Türkiye'deki o sektör içindeki payını verir.

Girdi : build/veri.db   Çıktı: veri-ekleri/turetilmis-turkiye-paylari.csv (bir sonraki `npm run veri` ile girer)
Kullanım: python pipeline/turetilmis/turkiye_paylari.py  (sonra: python pipeline/build_data.py)
"""
from __future__ import annotations

import csv
import sqlite3
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[1].parent
KAYNAK = "Türkiye İstatistik Kurumu verileri baz alınarak hesaplanmıştır."
SEKTORLER = [
    "Tarım, Ormancılık ve Balıkçılık",
    "Sanayi",
    "İmalat Sanayi",
    "İnşaat",
    "Ticaret, Ulaştırma, Konaklama ve Yiyecek Hizmetleri",
    "Bilgi ve İletişim",
    "Finans ve Sigorta Faaliyetleri",
    "Gayrimenkul Faaliyetleri",
    "Mesleki, İdari ve Destek Hizmet Faaliyetleri",
    "Kamu Yönetimi, Eğitim, İnsan Sağlığı ve Sosyal Hizmet Faaliyetleri",
    "Diğer Hizmet Faaliyetleri",
]
# (çıktı göstergesi, kaynak gösterge)
TANIMLAR = [
    ("Türkiye GSYH'si İçindeki Pay (Cari Fiyatlarla) (%)", "Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)"),
    ("Türkiye GSKD'si İçindeki Pay (Cari Fiyatlarla) (%)", "Gayri Safi Katma Değer (GSKD) (Bin TL)"),
] + [
    (f"Türkiye Sektör Katma Değeri İçindeki Pay: {s} (Cari Fiyatlarla) (%)",
     f"Sektörlere Göre Katma Değer: {s} (Cari Fiyatlarla) (Bin TL)")
    for s in SEKTORLER
]
DUZEYLER = ("region12", "region26", "province")


def main():
    c = sqlite3.connect(KOK / "build" / "veri.db")
    duzey = dict(c.execute("SELECT geo, level FROM entities"))
    satirlar = []
    for ad, kaynak in TANIMLAR:
        tr, deg = {}, defaultdict(dict)
        for g, t, v in c.execute("SELECT geo, time, value FROM values_long WHERE indicator=?", (kaynak,)):
            if v is None:
                continue
            if duzey.get(g) == "country":
                tr[t] = v
            elif duzey.get(g) in DUZEYLER:
                deg[t][g] = v
        if not tr:
            raise SystemExit(f"Kaynak gösterge bulunamadı: {kaynak}")
        for t in sorted(deg):
            if not tr.get(t):
                continue
            for g, v in sorted(deg[t].items()):
                satirlar.append([g, ad, "Ekonomi", t, f"{100 * v / tr[t]:.2f}", KAYNAK])

    cikti = KOK / "veri-ekleri" / "turetilmis-turkiye-paylari.csv"
    with open(cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satirlar)
    say = defaultdict(int)
    for s in satirlar:
        say[s[1]] += 1
    for k, v in say.items():
        print(f"{v:6d}  {k}")
    print("Yazıldı:", cikti.relative_to(KOK))


if __name__ == "__main__":
    main()
