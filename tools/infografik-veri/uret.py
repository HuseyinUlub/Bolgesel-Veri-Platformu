"""
uret.py — İnfografik aracının veri dosyasını (data/infografik.csv.gz) sitenin veritabanından (build/veri.db) üretir.

İnfografik aracı eski sayfadır (infografik.html) ve kendi dosya biçimini okur:
    il;isim;kod;veri;kategori;yil;deger;Veri Kaynağı      (ondalık virgül, tırnaksız)
Bu betik aynı biçimde, AYNI gösterge adlarıyla (hazır şablonlar bu adlara bağlı) ama veritabanındaki güncel ve
düzeltilmiş değerlerle dosyayı yeniden yazar. Böylece infografikler Veri Gezgini ile aynı veriyi gösterir.

  - Gösterge listesi eski dosyadakiyle aynıdır (yeni gösterge eklenmez; şablonlar ve menüler değişmez);
    her göstergenin eski dosyadaki ilk yılından önceki yıllar da eklenmez.
  - Veritabanında birleştirilen göstergeler (duzeltmeler/gosterge-birlestirme.csv) eski adıyla yazılır.
  - Veritabanında olmayan (düzeltme ile silinmiş) değerler yazılmaz; rapor sayar.

Kullanım: python tools/infografik-veri/uret.py      →  public/data/infografik.csv.gz  (+ rapor)
public/data, derlemede eski sitenin data/ klasörünün üzerine yazılır (vite.config.js).
"""
import csv
import gzip
import io
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
ESKI = KOK / "dist" / "data" / "infografik.csv.gz"
ESKI_YEDEK = KOK.parent / "dakaveri" / "data" / "infografik.csv.gz"  # eski sitenin özgün dosyası
CIKTI = KOK / "public" / "data" / "infografik.csv.gz"


def n(s):
    return " ".join(str(s or "").replace("\xa0", " ").split())


def bicim(v):
    if v is None:
        return ""
    if float(v).is_integer() and abs(v) < 1e15:
        return str(int(v))
    s = f"{v:.6f}".rstrip("0").rstrip(".")
    return s.replace(".", ",")


def main():
    kaynak = ESKI_YEDEK if ESKI_YEDEK.exists() else ESKI
    with gzip.open(kaynak, "rt", encoding="utf-8") as f:
        eski = list(csv.DictReader(f, delimiter=";"))
    birim = {}  # kod → (il, isim)
    gosterge = {}  # eski ad → (kategori, kaynak)
    kaynaklar = defaultdict(Counter)
    eski_deger = {}
    ilk_yil = {}  # gösterge → eski dosyadaki ilk yıl (daha eski yıllar eklenmez; grafiklerin başlangıcı değişmesin)
    for r in eski:
        ilk_yil[r["veri"]] = min(ilk_yil.get(r["veri"], 9999), int(r["yil"]))
        birim.setdefault(r["kod"], (r["il"], r["isim"]))
        gosterge.setdefault(r["veri"], r["kategori"])
        kaynaklar[r["veri"]][r["Veri Kaynağı"]] += 1
        eski_deger[(r["kod"], r["veri"], r["yil"])] = r["deger"]

    birlesme = {}
    with open(KOK / "veri-ekleri" / "duzeltmeler" / "gosterge-birlestirme.csv", encoding="utf-8-sig") as f:
        for r in csv.DictReader(f, delimiter=";"):
            birlesme[n(r["eski"])] = n(r["yeni"])

    c = sqlite3.connect(KOK / "build" / "veri.db")
    db_ad = {n(a): a for (a,) in c.execute("SELECT indicator FROM indicators")}
    eslesme = {}
    eksik = []
    for ad in gosterge:
        hedef = db_ad.get(n(ad)) or db_ad.get(birlesme.get(n(ad), ""))
        if hedef:
            eslesme[ad] = hedef
        else:
            eksik.append(ad)

    satirlar = []
    say = Counter()
    yeni_anahtar = set()
    for ad, hedef in eslesme.items():
        kaynak_ad = kaynaklar[ad].most_common(1)[0][0]
        for geo, yil, v in c.execute("SELECT geo, time, value FROM values_long WHERE indicator=? AND value IS NOT NULL", (hedef,)):
            if geo not in birim or int(yil) < ilk_yil[ad]:
                continue  # ilçe, FUA vb. infografikte yok
            il, isim = birim[geo]
            d = bicim(v)
            satirlar.append([il, isim, geo, ad, gosterge[ad], yil, d, kaynak_ad])
            k = (geo, ad, yil)
            yeni_anahtar.add(k)
            if k not in eski_deger:
                say["yeni"] += 1
            elif eski_deger[k].replace(".", ",") == d or _yakin(eski_deger[k], v):
                say["ayni"] += 1
            else:
                say["farkli"] += 1
    say["kaldirilan"] = sum(1 for k, d in eski_deger.items() if k not in yeni_anahtar and d not in ("", None) and k[1] in eslesme)

    satirlar.sort(key=lambda r: (list(gosterge).index(r[3]), r[5], r[2]))
    CIKTI.parent.mkdir(parents=True, exist_ok=True)
    tampon = io.StringIO()
    w = csv.writer(tampon, delimiter=";", lineterminator="\r\n", quoting=csv.QUOTE_MINIMAL)  # eski dosya gibi CRLF
    w.writerow(["il", "isim", "kod", "veri", "kategori", "yil", "deger", "Veri Kaynağı"])
    w.writerows(satirlar)
    with gzip.open(CIKTI, "wt", encoding="utf-8", compresslevel=9) as f:
        f.write(tampon.getvalue())
    rapor = (f"infografik.csv.gz: {len(satirlar)} değer, {len(eslesme)}/{len(gosterge)} gösterge; "
             f"aynı {say['ayni']}, güncellenen {say['farkli']}, yeni {say['yeni']}, kaldırılan (düzeltme ile silinmiş) {say['kaldirilan']}")
    print(rapor)
    if eksik:
        print("Veritabanında bulunamayan gösterge:", eksik)


def _yakin(eski, v):
    try:
        e = float(str(eski).replace(",", "."))
    except ValueError:
        return False
    return abs(e - v) <= 1e-9 * max(1, abs(v))


if __name__ == "__main__":
    main()
