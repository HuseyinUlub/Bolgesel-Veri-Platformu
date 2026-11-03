"""
tuik_bolgesel.py — TÜİK Bölgesel İstatistikler çok sayfalı Excel'ini (VizStudio
istatistikler/Turkiye_Istatistikleri_Birlesik.xlsx) veri-ekleri şablonuna çevirir.

Excel düzeni: her sayfa bir tema; sütunlar  Year | Region Code | Region Name | <gösterge>...
Başlıklar İngilizce, "Konu : kırılım / kırılım (birim)" biçiminde.

Kullanım:
    python pipeline/donusturuculer/tuik_bolgesel.py Turkiye_Istatistikleri_Birlesik.xlsx \\
        --esleme pipeline/donusturuculer/eslemeler/tuik-bolgesel.csv --cikti veri-ekleri/tuik-bolgesel.csv.gz

Eşleme dosyası (noktalı virgül): sayfa;sutun;gosterge;kategori;oncelik;yayin;not
    gosterge  boşsa sütun alınmaz (not sütunu nedenini söyler)
    oncelik   "mevcut": sitede zaten olan gösterge — mevcut değerler korunur, yalnızca eksik yıl/bölge eklenir
    yayin     "hayir": yalnızca veri.db (ayrıntılı kırılım), sitede listelenmez

Eşlemede olmayan yeni sütun çıkarsa (TÜİK dosyası güncellendiğinde) uyarı verilir ve
build/tuik-eslenmemis.csv dosyasına yazılır.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import re
import sys
from pathlib import Path

import openpyxl

SAYI = re.compile(r"-?\d+([.,]\d+)?")


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ")).strip()


YAPI = re.compile(r"^(Yapı .+?): (Toplam|Konut Amaçlı|Konut Dışı)( \(m²\))?$")


def yapi_kimligi(satirlar):
    """Yapı izin istatistiklerinde Toplam = Konut Amaçlı + Konut Dışı olmalıdır.

    Kaynak dosyada 2023'ten itibaren "Residential buildings / Total" sütunları (daire sayısı ve
    yüzölçümü) başka bir değeri taşıyor (örn. Türkiye 2023 konut yüzölçümü 153.159 m²; gerçeği
    ~137 milyon m²). Kimlik tutmadığında Konut Amaçlı = Toplam − Konut Dışı olarak yeniden hesaplanır.
    """
    tablo = {}
    for r in satirlar:
        m = YAPI.match(r[1])
        if m:
            tablo[(r[0], r[3], m.group(1), m.group(3) or "", m.group(2))] = r
    duzeltilen = 0
    for (kod, yil, aile, birim, tur), r in tablo.items():
        if tur != "Konut Amaçlı":
            continue
        t = tablo.get((kod, yil, aile, birim, "Toplam"))
        d = tablo.get((kod, yil, aile, birim, "Konut Dışı"))
        if not t:
            continue
        sayi = lambda x: float(x[4].replace(",", ".")) if x else 0.0  # Konut Dışı hücresi boşsa 0
        beklenen = sayi(t) - sayi(d)
        if abs(sayi(r) - beklenen) > 0.01 * max(sayi(t), 1) + 1:
            r[4] = repr(round(beklenen, 3)).replace(".", ",").removesuffix(",0")
            duzeltilen += 1
    if duzeltilen:
        print(f"Yapı istatistikleri: {duzeltilen} 'Konut Amaçlı' değeri Toplam − Konut Dışı ile düzeltildi "
              "(kaynakta 2023+ sütun kayması)")
    return satirlar


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("excel")
    ap.add_argument("--esleme", required=True)
    ap.add_argument("--cikti", required=True)
    ap.add_argument("--kaynak", default="Türkiye İstatistik Kurumu")
    a = ap.parse_args(argv)

    with open(a.esleme, encoding="utf-8-sig", newline="") as f:
        esleme = {(norm(r["sayfa"]), norm(r["sutun"])): r for r in csv.DictReader(f, delimiter=";")}

    wb = openpyxl.load_workbook(a.excel, read_only=True)
    satirlar, eslenmemis, sayac = [], [], {"deger": 0, "sayisal_degil": 0, "gosterge": set()}
    for sh in wb.sheetnames:
        rows = wb[sh].iter_rows(values_only=True)
        hdr = [norm(h) for h in next(rows)]
        # Aynı başlık birden fazla kez geçiyorsa (kaynakta etiket hatası) 2., 3. kopya "başlık #2" olarak
        # ayrı anahtar alır; eşlemede yoksa alınmaz. Hangi sütunun doğru olduğu belirsizdir.
        gorulen = {}
        for i, h in enumerate(hdr):
            if h:
                gorulen[h] = gorulen.get(h, 0) + 1
                if gorulen[h] > 1:
                    hdr[i] = f"{h} #{gorulen[h]}"
        sutunlar = []
        for i, h in enumerate(hdr[3:], start=3):
            r = esleme.get((sh, h))
            if r is None:
                if h:
                    eslenmemis.append((sh, h))
                continue
            if norm(r["gosterge"]):
                sutunlar.append((i, r))
        for row in rows:
            yil, kod = norm(row[0]), norm(row[1])
            if not re.fullmatch(r"\d{4}", yil) or not kod.startswith("TR"):
                continue
            for i, r in sutunlar:
                v = row[i] if i < len(row) else None
                if v is None:
                    continue
                s = norm(v).replace(" ", "")
                if not SAYI.fullmatch(s):
                    if s not in ("", "-", ",,,", "None", "..", "x"):
                        sayac["sayisal_degil"] += 1
                    continue
                satirlar.append([kod, norm(r["gosterge"]), norm(r["kategori"]), yil, s.replace(".", ","),
                                 a.kaynak, norm(r.get("oncelik")), norm(r.get("yayin"))])
                sayac["deger"] += 1
                sayac["gosterge"].add(norm(r["gosterge"]))

    # Ondalık kaybı koruması: kaynakta "452,2" gibi değerlerin virgülü düşüp 4522002022204 olarak
    # geldiği hücreler var. Bir bölgenin serisinde, o bölgenin diğer yıllarının medyanından 1000 kat
    # büyük değer atılır ve raporlanır.
    from collections import defaultdict
    seri = defaultdict(list)
    for r in satirlar:
        seri[(r[0], r[1])].append(abs(float(r[4].replace(",", "."))))
    medyan = {}
    for k, v in seri.items():
        if len(v) >= 3:
            v = sorted(v)
            medyan[k] = v[len(v) // 2]
    atilan = []
    temiz = []
    for r in satirlar:
        m = medyan.get((r[0], r[1]))
        x = abs(float(r[4].replace(",", ".")))
        if m and m > 0 and x > 1000 * m and x >= 1e5:
            atilan.append(r)
        else:
            temiz.append(r)
    satirlar = temiz
    if atilan:
        print(f"Ondalık kaybı şüphesi: {len(atilan)} değer atıldı (bölge serisinin medyanının >1000 katı ve ≥100.000). Örnekler:")
        for r in atilan[:10]:
            print(f"  {r[0]} {r[3]} · {r[1][:70]}: {r[4]} (seri medyanı {medyan[(r[0], r[1])]:g})")

    satirlar = yapi_kimligi(satirlar)

    Path(a.cikti).parent.mkdir(parents=True, exist_ok=True)
    acici = gzip.open if a.cikti.endswith(".gz") else open
    with acici(a.cikti, "wt", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        w.writerows(satirlar)
    print(f"{len(sayac['gosterge'])} gösterge, {len(satirlar)} değer -> {a.cikti}")
    if sayac["sayisal_degil"]:
        print(f"Sayıya çevrilemeyen hücre: {sayac['sayisal_degil']} (atlandı)")
    if eslenmemis:
        out = Path(a.cikti).resolve().parents[1] / "build" / "tuik-eslenmemis.csv"
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["sayfa", "sutun", "gosterge", "kategori", "oncelik", "yayin", "not"])
            w.writerows([[s, h, "", "", "", "", ""] for s, h in eslenmemis])
        print(f"UYARI: eşlemede olmayan {len(eslenmemis)} sütun -> {out} (doldurup eşlemeye ekleyin)")


if __name__ == "__main__":
    sys.exit(main())
