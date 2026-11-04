"""
donustur.py — OECD, Regions and Cities at a Glance 2026 (29 Ekim 2026) şekil verilerinden (StatLink Excel dosyaları,
kaynaklar/oecd-rcag-2026/) veri tabanımızda OLMAYAN Türkiye bölge göstergelerini veri-ekleri/oecd-rcag-2026.csv'ye yazar.

Alınan göstergeler (Türkiye ve Düzey 2 / OECD kentleri):
  r7s8ik  Şekil 4.1   Hava sıcaklığındaki değişim, 2021-2025 ortalaması − 1981-2010 ortalaması (°C)      TL2 + Türkiye
  bc3ia7  Şekil 4.10  Yeni otomobil satışlarında elektrikli araç payı (%), 2024                            TL2 + Türkiye
  s7vkao  Şekil 1.1   Çalışan başına reel katma değerin yıllık artışı, 2018-2024 (%)                       TL2 + Türkiye
  1svbe9  Şekil 1.5   Kişi başına reel GSYH artışının Türkiye ortalamasından farkı, 2018-2024 (yüzde puan)   TL2
  bqk4ve  Şekil 3.5   Yaşam memnuniyetindeki değişim, 2014/15 → 2024/25 (0-10 ölçeğinde puan)             TL2 (21 bölge) + Türkiye
  5krnsc  Şekil 1.12  Patent yoğunlaşma katsayısı (patent payı / nüfus payı), 2024                         OECD kentleri (FUA)

Alınmayanlar: ülke düzeyindeki şekiller (1.2, 1.3, 1.6, 1.10, 2.1, 2.6, 2.7, 3.6, C.1, C.2) sitenin karşılaştırma
sayfalarında kullanılır; il düzeyinde yaşlı bağımlılık (2.5) ve iç göç (2.11) TÜİK kaynaklı olup veri tabanında zaten var;
3.13 Türkiye'yi içermez.

Kullanım: py -X utf8 tools/oecd-rcag-2026/donustur.py   (sonra: py -X utf8 pipeline/hepsini_olustur.py)
"""
from __future__ import annotations

import csv
import re
import sqlite3
import unicodedata
from pathlib import Path

import openpyxl

KOK = Path(__file__).resolve().parents[2]
HAM = KOK / "kaynaklar" / "oecd-rcag-2026"
CIKTI = KOK / "veri-ekleri" / "oecd-rcag-2026.csv"
KAYNAK = "OECD Regions and Cities at a Glance 2026"


def tablo(kod: str):
    ws = openpyxl.load_workbook(HAM / f"{kod}.xlsx", data_only=True, read_only=True).worksheets[0]
    satir = list(ws.iter_rows(values_only=True))
    bas = next(i for i, r in enumerate(satir) if r and i > 2 and sum(isinstance(c, str) for c in r) >= 3)
    ad = [c for c in satir[bas] if c is not None]
    return [dict(zip(ad, r)) for r in satir[bas + 1:] if r and r[0] is not None]


def sade(s: str) -> str:
    s = s.replace("ı", "i").replace("İ", "I")
    s = "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))
    return re.sub(r"[^a-z]", "", s.lower())


def main() -> None:
    db = sqlite3.connect(KOK / "build" / "veri.db")
    d2 = {sade(ad): geo for geo, ad in db.execute("SELECT geo, name FROM entities WHERE level='region26'")}
    fua = {geo for (geo,) in db.execute("SELECT geo FROM entities WHERE level='fua'")}
    out = []  # (kod, gösterge, kategori, yıl, değer)

    def ekle(kod, g, kat, yil, v, ondalik=3):
        if v is None:
            return
        out.append((kod, g, kat, yil, str(round(float(v), ondalik)).replace(".", ",")))

    tl2 = lambda r, alan: r[alan] if isinstance(r[alan], str) and re.fullmatch(r"TR[0-9A-C]{2}", r[alan]) else None

    for r in tablo("r7s8ik"):
        if r["iso3"] == "TUR":
            ekle("TR" if r["TL"] == 1 else tl2(r, "geo_id"), "Hava Sıcaklığındaki Değişim, 2021-2025 / 1981-2010 (OECD) (°C)", "Çevre", 2025, r["value"])
    for r in tablo("bc3ia7"):
        if r["iso3"] == "TUR":
            ekle("TR" if r["TL"] == 1 else tl2(r, "geo_id"), "Yeni Otomobil Satışlarında Elektrikli Araç Payı (OECD) (%)", "Ulaştırma", 2024, r["value"], 2)
    s7 = [r for r in tablo("s7vkao") if r["iso"] == "TUR"]
    for r in s7:
        ekle(tl2(r, "reg_id"), "Emek Verimliliği Yıllık Reel Artışı, 2018-2024 (OECD) (%)", "Ekonomi", 2024, r["regional_cagr"], 2)
    if s7:
        ekle("TR", "Emek Verimliliği Yıllık Reel Artışı, 2018-2024 (OECD) (%)", "Ekonomi", 2024, s7[0]["country_cagr"], 2)
    for r in tablo("1svbe9"):
        if r["iso3"] == "TUR":
            ekle(tl2(r, "GEO"), "Kişi Başına Reel GSYH Artışının Türkiye Ortalamasından Farkı, 2018-2024 (OECD) (Yüzde Puan)", "Ekonomi", 2024, r["VALUE"], 2)
    eslesmeyen = []
    bq = [r for r in tablo("bqk4ve") if r["Country_ISO3"] == "TUR"]
    for r in bq:
        geo = d2.get(sade(r["Region_Name"]))
        if not geo:
            eslesmeyen.append(r["Region_Name"])
        ekle(geo, "Yaşam Memnuniyetindeki Değişim, 2014/15-2024/25 (OECD) (Puan)", "Bölgesel Refah (OECD)", 2025, r["Difference"], 2)
    if bq:
        ekle("TR", "Yaşam Memnuniyetindeki Değişim, 2014/15-2024/25 (OECD) (Puan)", "Bölgesel Refah (OECD)", 2025, bq[0]["National_Avg_Change"], 2)
    for r in tablo("5krnsc"):
        if r["iso3"] == "TUR" and r["fuacode"] in fua:
            ekle(r["fuacode"], "Patent Yoğunlaşma Katsayısı (OECD Kent)", "Kentler (OECD)", int(r["year"]), r["lq"], 3)

    out = [o for o in out if o[0]]
    CIKTI.parent.mkdir(exist_ok=True)
    with CIKTI.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        for o in sorted(out, key=lambda o: (o[1], o[0])):
            w.writerow([*o, KAYNAK, "", ""])
    say = {}
    for o in out:
        say[o[1]] = say.get(o[1], 0) + 1
    for g, n in say.items():
        print(f"{n:4d}  {g}")
    if eslesmeyen:
        print("Eşleşmeyen bölge adı:", eslesmeyen)
    print(f"Yazıldı: {CIKTI.relative_to(KOK)} ({len(out)} değer)")


if __name__ == "__main__":
    main()
