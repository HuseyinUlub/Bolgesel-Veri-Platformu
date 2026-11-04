"""
donustur.py — EPDK, Elektrik Piyasası 2025 Yılı Piyasa Gelişim Raporu (Excel eki ve rapor tabloları) →
veri-ekleri/epdk-2025.csv

Girdi (kaynaklar/epdk-2025/):
  elektrik-piyasasi-gelisim-raporu-2025-ek.xlsx   Rapor eki. Tablo 3: illere ve tüketici türüne göre faturalanan tüketim
                                                   (MWh, 2024 ve 2025); Tablo 4: il ve tüketici türüne göre tüketici sayısı.
  rapor-il-tablolari-2025.csv                      Raporun İngilizce PDF'indeki il tablolarından çıkarıldı (bkz. aynı klasör):
                                                   1.2 lisanslı üretim (GWh), 1.3 lisanslı kurulu güç (MW),
                                                   1.6 lisanssız kurulu güç (MWe, 2024 ve 2025), 1.8 lisanssız brüt üretim (GWh).
                                                   Her tablonun il toplamı raporun Genel Toplam satırını tutar.

Raporda il bazında kaynak türüne (kömür, doğal gaz, hidrolik …) göre üretim ya da kurulu güç yoktur; kaynak kırılımı
yalnızca Türkiye geneli içindir (ek Tablo 1-2).

EPDK faturalanan tüketimi TÜİK'in elektrik tüketimi serilerinden farklı bir tanımdır (2024'te il medyanında mesken
+%10, sanayi −%7); bu yüzden ayrı göstergeler olarak eklenir, TÜİK serileri uzatılmaz.

Düzey 2 ve Düzey 1 değerleri il toplamıdır.

Kullanım: py -X utf8 tools/epdk-2025/donustur.py   (sonra: py -X utf8 pipeline/hepsini_olustur.py)
"""
from __future__ import annotations

import csv
import sqlite3
import unicodedata
from pathlib import Path

import openpyxl

KOK = Path(__file__).resolve().parents[2]
HAM = KOK / "kaynaklar" / "epdk-2025"
CIKTI = KOK / "veri-ekleri" / "epdk-2025.csv"
KAYNAK = "Enerji Piyasası Düzenleme Kurumu"
KAT = "Enerji"
TABLO = {"1.2": "Lisanslı Elektrik Üretimi (GWh)", "1.3": "Lisanslı Kurulu Güç (MW)",
         "1.6": "Lisanssız Kurulu Güç (MW)", "1.8": "Lisanssız Brüt Elektrik Üretimi (GWh)"}
TUR = {"Aydınlatma": "Aydınlatma", "Kamu ve Özel Hizmetler Sektörü ile Diğer": "Kamu ve Özel Hizmetler ile Diğer",
       "Mesken": "Mesken", "Sanayi": "Sanayi", "Tarımsal Faaliyetler": "Tarımsal Faaliyetler", "İl Toplam": "Toplam"}


def sade(s: str) -> str:
    s = s.replace("İ", "i").replace("I", "ı").lower().replace("ı", "i")
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c)).replace(" ", "")


def main() -> None:
    db = sqlite3.connect(KOK / "build" / "veri.db")
    il = {sade(n): g for g, n in db.execute("SELECT geo, name FROM entities WHERE level='province'")}
    il[sade("Türkiye")] = "TR"
    out: list[tuple] = []

    with (HAM / "rapor-il-tablolari-2025.csv").open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            out.append((il[sade(r["il"])], TABLO[r["tablo"]], int(r["yil"]), float(r["deger"].replace(",", "."))))

    wb = openpyxl.load_workbook(HAM / "elektrik-piyasasi-gelisim-raporu-2025-ek.xlsx", data_only=True, read_only=True)
    for sayfa, ad, birim in [("Tablo 3", "Faturalanan Elektrik Tüketimi: {} (MWh)", ""),
                             ("Tablo 4", "Elektrik Tüketici Sayısı: {}", "")]:
        toplam: dict[tuple, float] = {}
        cur = None
        for r in list(wb[sayfa].iter_rows(values_only=True))[2:]:
            if r[0]:
                cur = r[0]
            if not r[1] or r[1] not in TUR or not cur:
                continue
            geo = il[sade(cur)]
            for yil, v in ((2024, r[2]), (2025, r[4])):
                if v is None:
                    continue
                g = ad.format(TUR[r[1]])
                out.append((geo, g, yil, float(v)))
                toplam[(g, yil)] = toplam.get((g, yil), 0) + float(v)
        for (g, yil), v in toplam.items():  # Türkiye = 81 il toplamı (raporun Genel Toplam satırıyla aynı)
            out.append(("TR", g, yil, v))

    # Düzey 2 ve Düzey 1 = il toplamları (bütün göstergeler toplanabilir büyüklüktür)
    bolge: dict[tuple, float] = {}
    for geo, g, yil, v in out:
        if len(geo) == 5:
            for k in (geo[:4], geo[:3]):
                bolge[(k, g, yil)] = bolge.get((k, g, yil), 0) + v
    out += [(k, g, yil, v) for (k, g, yil), v in bolge.items()]

    with CIKTI.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        for geo, g, yil, v in sorted(out, key=lambda o: (o[1], o[2], o[0])):
            w.writerow([geo, g, KAT, yil, str(round(v, 3)).replace(".", ","), KAYNAK, "", ""])
    say: dict[str, int] = {}
    for o in out:
        say[o[1]] = say.get(o[1], 0) + 1
    for g, n in sorted(say.items()):
        print(f"{n:4d}  {g}")
    print(f"Yazıldı: {CIKTI.relative_to(KOK)} ({len(out)} değer)")


if __name__ == "__main__":
    main()
