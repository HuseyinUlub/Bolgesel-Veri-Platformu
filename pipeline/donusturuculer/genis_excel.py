"""
genis_excel.py — "geniş" Excel tablosunu veri-ekleri şablonuna (uzun format) çevirir.

Beklenen Excel düzeni (ilk sayfa, ilk satır başlık):

    YIL | BÖLGE KODU | BÖLGE ADI | Gösterge 1 | Gösterge 2 | ...

Her gösterge sütunu şablonda ayrı satırlara açılır:

    kod;gosterge;kategori;yil;deger;kaynak

Kullanım:
    python pipeline/donusturuculer/genis_excel.py "BTK Verileri_Düzey2-3.xlsx" \\
        --kategori Haberleşme --kaynak "Bilgi Teknolojileri ve İletişim Kurumu" \\
        --cikti veri-ekleri/btk-haberlesme.csv

İsteğe bağlı:
    --yil-sutunu / --kod-sutunu   başlık adları farklıysa
    --ad-degistir "Eski ad=Yeni ad"   (birden fazla kez verilebilir) gösterge adını sitedeki adla eşlemek için
    --carpan "Gösterge adı=100"       değeri çarpar (örn. 0,24 gibi oran olarak girilmiş yüzdeyi 24'e çevirmek için)

Çok sütunlu ve karışık tablolar için (her sütun farklı kategori, bazısı atlanacak):
    --esleme eslemeler/konsolide.csv
  Eşleme dosyası (noktalı virgül):  sutun;gosterge;kategori;carpan;yalniz_turkiye;oncelik;kaynak;not
    sutun           Excel başlığı (birebir)
    gosterge        sitedeki ad (boşsa sütun alınmaz)
    kategori        boşsa --kategori kullanılır
    carpan          boşsa 1
    yalniz_turkiye  "evet" ise yalnızca TR satırı alınır (tüm bölgelere kopyalanmış ulusal değerler için)
    oncelik         ek | mevcut | boş
    kaynak          boşsa --kaynak kullanılır
  Eşleme verildiğinde yalnızca dosyada adı geçen ve gösterge adı dolu sütunlar yazılır; Excel'de olup
  eşlemede olmayan sütunlar uyarı olarak listelenir.

Gereksinim: openpyxl  (pip install openpyxl)
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

import openpyxl


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ")).strip()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("excel")
    ap.add_argument("--kategori", default="")
    ap.add_argument("--kaynak", default="")
    ap.add_argument("--cikti", required=True)
    ap.add_argument("--sayfa", default=None, help="sayfa adı (varsayılan: ilk sayfa)")
    ap.add_argument("--yil-sutunu", default="YIL")
    ap.add_argument("--kod-sutunu", default="BÖLGE KODU")
    ap.add_argument("--atla", action="append", default=["BÖLGE ADI"], help="gösterge olmayan başka sütunlar")
    ap.add_argument("--ad-degistir", action="append", default=[], metavar="ESKI=YENI")
    ap.add_argument("--carpan", action="append", default=[], metavar="GOSTERGE=SAYI")
    ap.add_argument("--esleme", default=None, help="sütun eşleme CSV dosyası")
    a = ap.parse_args(argv)

    wb = openpyxl.load_workbook(a.excel, read_only=True, data_only=True)
    ws = wb[a.sayfa] if a.sayfa else wb.worksheets[0]
    it = ws.iter_rows(values_only=True)
    basliklar = [norm(h) for h in next(it)]
    ust = [h.upper() for h in basliklar]
    try:
        iy, ik = ust.index(a.yil_sutunu.upper()), ust.index(a.kod_sutunu.upper())
    except ValueError:
        sys.exit(f"'{a.yil_sutunu}' / '{a.kod_sutunu}' sütunu bulunamadı. Başlıklar: {basliklar}")
    atla = {x.upper() for x in a.atla} | {ust[iy], ust[ik]}
    ad_map = dict(x.split("=", 1) for x in a.ad_degistir)
    carpan = {k: float(v.replace(",", ".")) for k, v in (x.rsplit("=", 1) for x in a.carpan)}
    esleme = None
    if a.esleme:
        with open(a.esleme, encoding="utf-8-sig", newline="") as f:
            esleme = {norm(r["sutun"]): r for r in csv.DictReader(f, delimiter=";")}
        eksik = [h for j, h in enumerate(basliklar) if h and ust[j] not in atla and h not in esleme]
        if eksik:
            print("UYARI: eşlemede olmayan sütunlar (alınmadı):", "; ".join(eksik))
        gostergeler = [(j, norm(esleme[h]["gosterge"])) for j, h in enumerate(basliklar)
                       if h in esleme and norm(esleme[h].get("gosterge"))]
    else:
        gostergeler = [(j, ad_map.get(h, h)) for j, h in enumerate(basliklar) if h and ust[j] not in atla]
    if not a.kategori and not esleme:
        sys.exit("--kategori ya da --esleme verilmeli")

    def ayar(j):
        e = esleme.get(basliklar[j]) if esleme else None
        if not e:
            return a.kategori, carpan.get(basliklar[j], 1.0), False, "", a.kaynak
        c = norm(e.get("carpan")).replace(",", ".")
        return (norm(e.get("kategori")) or a.kategori, float(c) if c else 1.0,
                norm(e.get("yalniz_turkiye")).lower() in ("evet", "e", "1", "true"), norm(e.get("oncelik")).lower(),
                norm(e.get("kaynak")) or a.kaynak)
    ayarlar = {j: ayar(j) for j, _ in gostergeler}

    Path(a.cikti).parent.mkdir(parents=True, exist_ok=True)
    yazilan = 0
    with open(a.cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik"])
        for r in it:
            if r[iy] is None or r[ik] is None:
                continue
            yil = str(int(r[iy])) if isinstance(r[iy], (int, float)) else norm(r[iy])
            kod = norm(r[ik])
            for j, ad in gostergeler:
                v = r[j]
                if v is None or v == "":
                    continue
                kat, carp, yalniz_tr, onc, kaynak = ayarlar[j]
                if yalniz_tr and kod != "TR":
                    continue
                if isinstance(v, (int, float)):
                    v = round(float(v) * carp, 6)
                    v = repr(v).replace(".", ",").removesuffix(",0")
                w.writerow([kod, ad, kat, yil, norm(v), kaynak, onc])
                yazilan += 1
    print(f"{len(gostergeler)} gösterge, {yazilan} değer -> {a.cikti}")


if __name__ == "__main__":
    main()
