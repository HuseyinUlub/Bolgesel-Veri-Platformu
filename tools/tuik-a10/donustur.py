"""
donustur.py — TÜİK "İl bazında gayrisafi yurt içi hasıla, iktisadi faaliyet kollarına (A10) göre, cari fiyatlarla
(değer)" tablosunu (.xls, veriportali.tuik.gov.tr) veri-ekleri CSV'sine çevirir.

Kullanım: python tools/tuik-a10/donustur.py "<indirilen .xls>"      (xlrd gerekir: pip install xlrd)
Çıktı   : veri-ekleri/tuik-il-gskd-a10.csv  (sonra: python pipeline/build_data.py)

İl ve Türkiye değerleri tablodan alınır; Düzey 2 ve Düzey 1 değerleri illerin toplamıdır (cari fiyatlı değerler
toplanabilir). Paylar sektörler toplamına (GSKD) göre hesaplanır, GSYH'ye göre değil: vergi-sübvansiyon
bölgeye dağıtılmış bir büyüklüktür ve payı bozar. Sitedeki üç ana sektör payı da böyle hesaplanmıştı.

Bu tablo, OECD'nin "Reel Katma Değerde Sektör Payı" (2020 fiyatlarıyla, 2013–) göstergelerinin yerini alır.
"""
from __future__ import annotations

import csv
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

import xlrd

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / "veri-ekleri" / "tuik-il-gskd-a10.csv"
KAYNAK = "Türkiye İstatistik Kurumu"
KAYNAK_H = "Türkiye İstatistik Kurumu verileri baz alınarak hesaplanmıştır."
KAT = "Ekonomi"

# tablo sütunu (3'ten başlar) → kısa ad
SEKTORLER = [
    "Tarım, Ormancılık ve Balıkçılık", "Sanayi", "İmalat Sanayi", "İnşaat",
    "Ticaret, Ulaştırma, Konaklama ve Yiyecek Hizmetleri", "Bilgi ve İletişim", "Finans ve Sigorta Faaliyetleri",
    "Gayrimenkul Faaliyetleri", "Mesleki, İdari ve Destek Hizmet Faaliyetleri",
    "Kamu Yönetimi, Eğitim, İnsan Sağlığı ve Sosyal Hizmet Faaliyetleri", "Diğer Hizmet Faaliyetleri",
]
TOPLAM, GSYH = 11, 13  # sektörler toplamı, GSYH (vergi-sübvansiyon: 12)
HIZMET = [4, 5, 6, 7, 8, 9, 10]

# Sitede zaten bulunan göstergeler: yalnızca eksik yıllar eklenir (oncelik=mevcut)
MEVCUT = {
    "gskd": "Gayri Safi Katma Değer (GSKD) (Bin TL)",
    "gsyh": "Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)",
    "tarim": "Tarımın Sektörünün Ekonomi İçindeki Payı (Cari Fiyatlarla) (%)",
    "sanayi": "Sanayi Sektörünün Ekonomi İçindeki Payı (Cari Fiyatlarla) (%)",
    "hizmet": "Hizmetler Sektörünün Ekonomi İçindeki Payı (Cari Fiyatlarla) (%)",
}


def oku(yol):
    s = xlrd.open_workbook(yol).sheet_by_index(0)
    veri, kod = {}, None
    for r in range(4, s.nrows):
        v = s.row_values(r)
        if str(v[0]).strip():
            kod = str(v[0]).strip()
        if isinstance(v[2], float) and kod:
            veri[(kod, int(v[2]))] = [float(x) for x in v[3:17]]
    return veri


def main(yol):
    veri = oku(yol)
    c = sqlite3.connect(KOK / "build" / "veri.db")
    duzey = dict(c.execute("SELECT geo, level FROM entities"))
    ust = dict(c.execute("SELECT geo, parent FROM entities"))
    iller = {g for g, d in duzey.items() if d == "province"}
    bulunan = {k for k, _ in veri if k in iller}
    if bulunan != iller:
        sys.exit(f"İl listesi tutmuyor: eksik {sorted(iller - bulunan)}")

    # Düzey 2 ve Düzey 1: illerin toplamı
    topla = defaultdict(lambda: [0.0] * 14)
    for (g, y), v in veri.items():
        if g in iller:
            for hedef in (ust[g], ust[ust[g]]):
                t = topla[(hedef, y)]
                for i, x in enumerate(v):
                    t[i] += x
    tum = {**veri, **topla}
    # denetim: iller toplamı = Türkiye
    for y in sorted({y for _, y in veri}):
        tr = veri[("TR", y)][GSYH]
        il = sum(veri[(g, y)][GSYH] for g in iller)
        if abs(il / tr - 1) > 1e-6:
            print(f"uyarı: {y} iller toplamı Türkiye'den %{(il / tr - 1) * 100:.4f} farklı")

    satir = []
    for (g, y), v in sorted(tum.items()):
        if g not in duzey:
            continue
        top = v[TOPLAM]
        for i, ad in enumerate(SEKTORLER):
            satir.append([g, f"Sektörlere Göre Katma Değer: {ad} (Cari Fiyatlarla) (Bin TL)", KAT, y, f"{v[i]:.0f}", KAYNAK, "", ""])
            satir.append([g, f"Katma Değerde Sektör Payı: {ad} (Cari Fiyatlarla) (%)", KAT, y, f"{v[i] / top * 100:.2f}", KAYNAK_H, "", ""])
        satir.append([g, MEVCUT["gskd"], KAT, y, f"{top:.0f}", KAYNAK, "mevcut", ""])
        satir.append([g, MEVCUT["gsyh"], KAT, y, f"{v[GSYH]:.0f}", KAYNAK, "mevcut", ""])
        satir.append([g, MEVCUT["tarim"], KAT, y, f"{v[0] / top * 100:.1f}", KAYNAK_H, "mevcut", ""])
        satir.append([g, MEVCUT["sanayi"], KAT, y, f"{(v[1] + v[3]) / top * 100:.1f}", KAYNAK_H, "mevcut", ""])
        satir.append([g, MEVCUT["hizmet"], KAT, y, f"{sum(v[i] for i in HIZMET) / top * 100:.1f}", KAYNAK_H, "mevcut", ""])

    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        w.writerows(satir)
    print(f"{CIKTI.name}: {len(satir)} değer, {len({r[0] for r in satir})} bölge, "
          f"{min(y for _, y in tum)}–{max(y for _, y in tum)}")


if __name__ == "__main__":
    main(sys.argv[1])
