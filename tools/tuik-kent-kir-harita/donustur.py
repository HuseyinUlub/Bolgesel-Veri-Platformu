"""
TÜİK "Kent-kır sınıflamasına göre yerleşim yerleri, 2022" haritası (PDF, Esri ArcMap vektör çıktısı) →
  public/veri/geo/kent-kir.json          yoğun kent ve orta yoğun kent alanları (WGS84, sadeleştirilmiş)
  veri-ekleri/tuik-kent-kir-alan.csv     il ve ilçe düzeyinde sınıfların yüzölçümü payı (%), 2022

Harita mahalle ve köyleri üç renkle doldurulmuş çokgenler olarak içerir (kır: gri, orta yoğun kent: sarı,
yoğun kent: kırmızı). Çokgenler PDF sayfa koordinatındadır; projeksiyon Transverse Mercator (merkez boylam 36°)
olarak belirlendi (il sınırlarıyla %99 örtüşme) ve ölçek/öteleme ilçe sınırlarının kapsamına göre kuruldu
(≈2,44 km / pt, konum hatası 1–2 km).

Alan payı nüfus payı değildir: TÜİK'in il düzeyinde yayımladığı "… Nüfus Oranı" göstergeleri nüfusa göredir.
Kır alanı = birim yüzölçümü − yoğun kent − orta yoğun kent (gri çokgenler üst üste bindiği için toplanmaz).
Her renkli çokgen, temsilî noktasının düştüğü ilçeye atanır.

Nüfus payları: AB JRC GHS-POP R2023A (2020, 30 açısaniye ≈1 km, WGS84) karoları ghsl/ klasöründe
(GHS_POP_E2020_GLOBE_R2023A_4326_30ss_V1_0_R{5,6}_C{21,22,23}). Her grid hücresi merkezinin düştüğü sınıfa ve
ilçeye atanır; ilçe/il için yoğun kent, orta yoğun kent ve kır nüfus payı (%) hesaplanır. İl toplamları TÜİK'in
2022 il oranlarıyla karşılaştırılır (rapor ekrana yazılır). GHSL nüfusu TÜİK nüfusu değildir; yalnız paylar alınır.

Kullanım: python tools/tuik-kent-kir-harita/donustur.py
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import pdfplumber
from pyproj import Transformer
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

BU = Path(__file__).parent
KOK = BU.parents[1]
PDF = BU / "kent-kir-siniflamasina-gore-yerlesim-yerleri-2022.pdf"
GEO = KOK / "public" / "veri" / "geo" / "kent-kir.json"
CSV = KOK / "veri-ekleri" / "tuik-kent-kir-alan.csv"
RENK = {"(0.988, 0.859, 0.0)": "orta", "(0.863, 0.184, 0.11)": "yogun"}
KAYNAK = "TÜİK, Kent-Kır Nüfus İstatistikleri 2022 haritası; alan payı: platform hesaplaması"
KAT = "Nüfus"
AD = {"yogun": "Yoğun Kent Alan Payı (%)", "orta": "Orta Yoğun Kent Alan Payı (%)", "kir": "Kır Alan Payı (%)"}


def cokgenler():
    out = defaultdict(list)
    with pdfplumber.open(PDF) as pdf:
        for o in pdf.pages[0].objects["curve"] + pdf.pages[0].objects["rect"]:
            k = RENK.get(str(o.get("non_stroking_color")))
            if not k or not o.get("fill"):
                continue
            pts = o.get("pts") or [(o["x0"], o["top"]), (o["x1"], o["top"]), (o["x1"], o["bottom"]), (o["x0"], o["bottom"])]
            if len(pts) < 3 or all(600 < x < 660 and 405 < y < 485 for x, y in pts):  # lejant kutuları
                continue
            out[k].append(pts)
    return out


def main():
    P = cokgenler()
    tm = Transformer.from_crs("EPSG:4326", "+proj=tmerc +lon_0=36 +datum=WGS84", always_xy=True)
    geri = Transformer.from_crs("+proj=tmerc +lon_0=36 +datum=WGS84", "EPSG:4326", always_xy=True)
    ilce_geo = json.load(open(KOK / "public" / "veri" / "geo" / "district.json", encoding="utf-8"))
    feats = [f for f in ilce_geo["features"] if f.get("geometry")]
    geoms = [transform(lambda x, y, z=None: tm.transform(x, y), shape(f["geometry"])) for f in feats]
    xs = np.concatenate([np.asarray(g.exterior.coords if g.geom_type == "Polygon" else
                                    np.vstack([p.exterior.coords for p in g.geoms]))[:, 0] for g in geoms])
    ys = np.concatenate([np.asarray(g.exterior.coords if g.geom_type == "Polygon" else
                                    np.vstack([p.exterior.coords for p in g.geoms]))[:, 1] for g in geoms])
    # PDF'deki Türkiye kapsamı (kır çokgenlerinin sınırları; lejant hariç)
    bb = (89.5, 771.5, 100.0, 401.5)
    ax = (bb[1] - bb[0]) / (xs.max() - xs.min())
    ay = (bb[3] - bb[2]) / (ys.max() - ys.min())
    to_m = lambda x, y: (xs.min() + (x - bb[0]) / ax, ys.max() - (y - bb[2]) / ay)
    print(f"ölçek: {1 / ax:.0f} m/pt (x), {1 / ay:.0f} m/pt (y)")

    agac = STRtree(geoms)
    alan = defaultdict(lambda: defaultdict(float))
    sinif_cokgen = defaultdict(list)
    for k, liste in P.items():
        for pts in liste:
            pol = Polygon([to_m(x, y) for x, y in pts]).buffer(0)
            if pol.is_empty:
                continue
            sinif_cokgen[k].append(pol)
            i = agac.query(pol.representative_point(), predicate="within")
            if len(i):
                alan[feats[i[0]]["id"]][k] += pol.area

    ilceler = json.load(open(KOK / "public" / "veri" / "ilceler.json", encoding="utf-8"))
    il_top = defaultdict(lambda: defaultdict(float))
    satir = []
    for f, g in zip(feats, geoms):
        a = g.area
        y, o = min(alan[f["id"]]["yogun"], a), min(alan[f["id"]]["orta"], a)
        pay = {"yogun": 100 * y / a, "orta": 100 * o / a, "kir": max(0.0, 100 - 100 * (y + o) / a)}
        for k, v in pay.items():
            satir.append([f["id"], AD[k], KAT, 2022, f"{v:.2f}".replace(".", ","), KAYNAK])
        u = ilceler.get(f["id"], {}).get("ust")
        if u:
            for k, v in (("a", a), ("yogun", y), ("orta", o)):
                il_top[u][k] += v
    tr = defaultdict(float)
    for u, t in il_top.items():
        pay = {"yogun": 100 * t["yogun"] / t["a"], "orta": 100 * t["orta"] / t["a"]}
        pay["kir"] = 100 - pay["yogun"] - pay["orta"]
        for k, v in pay.items():
            satir.append([u, AD[k], KAT, 2022, f"{v:.2f}".replace(".", ","), KAYNAK])
        for k in ("a", "yogun", "orta"):
            tr[k] += t[k]
    trp = {"yogun": 100 * tr["yogun"] / tr["a"], "orta": 100 * tr["orta"] / tr["a"]}
    trp["kir"] = 100 - trp["yogun"] - trp["orta"]
    for k, v in trp.items():
        satir.append(["TR", AD[k], KAT, 2022, f"{v:.2f}".replace(".", ","), KAYNAK])
    print(f"{len(satir)} alan değeri → {CSV.relative_to(KOK)}; Türkiye: " + ", ".join(f"{k} %{v:.2f}" for k, v in trp.items()))

    # GHSL ile ilçe nüfus payları yalnız deneme olarak ayrı dosyaya yazılır (siteye alınmaz; bkz. nufus_paylari)
    deneme = []
    nufus_paylari(sinif_cokgen, feats, geri, ilceler, deneme)
    if deneme:
        with open(BU / "ghsl-ilce-nufus-paylari-deneme.csv", "w", encoding="utf-8-sig", newline="") as f:
            csv.writer(f, delimiter=";").writerows([["kod", "gosterge", "kategori", "yil", "deger", "kaynak"], *deneme])
    with open(CSV, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satir)

    # harita katmanı: sınıf başına birleşik, sadeleştirilmiş çokgen (WGS84)
    ozellik = []
    for k in ("orta", "yogun"):
        u = unary_union(sinif_cokgen[k]).simplify(250)  # m
        u = transform(lambda x, y, z=None: geri.transform(x, y), u)
        gj = mapping(u)

        def yuvarla(c):
            return [round(c[0], 4), round(c[1], 4)] if isinstance(c[0], float) else [yuvarla(x) for x in c]

        gj = {"type": gj["type"], "coordinates": yuvarla(gj["coordinates"])}
        ozellik.append({"type": "Feature", "id": k, "properties": {"sinif": k}, "geometry": gj})
    GEO.write_text(json.dumps({"type": "FeatureCollection", "features": ozellik}, separators=(",", ":")), encoding="utf-8")
    print(f"→ {GEO.relative_to(KOK)} ({GEO.stat().st_size / 1024:.0f} KB)")


NUFUS_AD = {"yogun": "Yoğun Kent Nüfus Oranı (%)", "orta": "Orta Yoğun Kent Nüfus Oranı (%)", "kir": "Kır Nüfus Oranı (%)"}
KAYNAK_NUFUS = ("TÜİK Kent-Kır Nüfus İstatistikleri 2022 haritası ve JRC GHS-POP 2020 nüfus gridi; "
                "ilçe payları: platform hesaplaması")


def nufus_paylari(sinif_cokgen, feats, geri, ilceler, satir):
    """DENEME — siteye alınmadı (Eylül 2026). İl toplamları TÜİK'i tutmuyor: Türkiye yoğun kent payı GHSL ile %45–51,
    TÜİK %67,9; il ortalama mutlak farkı 6–10 puan. Nedeni büyük ölçüde GHS-POP'un Türkiye'de nüfusu bazı illerde
    yanlış yere koyması (ör. Kırıkkale'de en kalabalık hücre kent merkezinin 20 km güneyinde; Adana, Erzurum benzer).
    Tampon (0,5–1,5 km) ve öteleme denemeleri farkı kapatmadı."""
    import glob
    import sqlite3

    import rasterio
    from rasterio.features import rasterize
    from rasterio.merge import merge

    karolar = sorted(glob.glob(str(BU / "ghsl" / "GHS_POP_E2020_*_30ss_*.tif")))
    if not karolar:
        print("GHSL karoları yok; nüfus payları atlandı")
        return
    kaynak = [rasterio.open(k) for k in karolar]
    pop, tr = merge(kaynak, bounds=(25.4, 35.7, 45.0, 42.3))
    pop = pop[0].astype("float64")
    pop[~np.isfinite(pop) | (pop < 0)] = 0
    sekil = pop.shape
    # sınıf rasterı: 0 kır, 1 orta yoğun, 2 yoğun (yoğun üstte)
    lonlat = lambda g: transform(lambda x, y, z=None: geri.transform(x, y), g)
    sinif = rasterize(((lonlat(g), 1) for g in sinif_cokgen["orta"]), out_shape=sekil, transform=tr, fill=0, dtype="uint8")
    sinif = rasterize(((lonlat(g), 2) for g in sinif_cokgen["yogun"]), out=sinif, transform=tr, dtype="uint8")
    kodlar = [f["id"] for f in feats]
    ilce = rasterize(((shape(f["geometry"]), i + 1) for i, f in enumerate(feats)), out_shape=sekil, transform=tr,
                     fill=0, dtype="int32")
    n = len(feats) + 1
    top = np.bincount(ilce.ravel(), weights=pop.ravel(), minlength=n)
    sin = {k: np.bincount(ilce.ravel(), weights=(pop * (sinif == v)).ravel(), minlength=n)
           for k, v in (("kir", 0), ("orta", 1), ("yogun", 2))}
    il = defaultdict(lambda: defaultdict(float))
    for i, kod in enumerate(kodlar, start=1):
        if top[i] <= 0:
            continue
        for k in sin:
            satir.append([kod, NUFUS_AD[k], KAT, 2022, f"{100 * sin[k][i] / top[i]:.2f}".replace(".", ","), KAYNAK_NUFUS])
        u = ilceler.get(kod, {}).get("ust")
        if u:
            il[u]["top"] += top[i]
            for k in sin:
                il[u][k] += sin[k][i]
    print(f"GHSL toplam nüfus (Türkiye ilçelerinde): {top[1:].sum() / 1e6:.1f} milyon")
    # doğrulama: il toplamları TÜİK 2022 il oranlarıyla
    db = KOK / "build" / "veri.db"
    if db.exists():
        con = sqlite3.connect(db)
        tuik = {k: dict(con.execute("SELECT geo, value FROM values_long WHERE indicator=? AND time='2022'", (ad,)))
                for k, ad in NUFUS_AD.items()}
        for k in NUFUS_AD:
            x = [100 * il[u][k] / il[u]["top"] for u in il if u in tuik[k]]
            y = [tuik[k][u] for u in il if u in tuik[k]]
            fark = np.abs(np.array(x) - np.array(y))
            print(f"  {k}: il sayısı {len(x)}, korelasyon {np.corrcoef(x, y)[0, 1]:.3f}, "
                  f"ortalama mutlak fark {fark.mean():.1f} puan, en büyük {fark.max():.1f}")
        ils = sorted(il, key=lambda u: -abs(100 * il[u]["yogun"] / il[u]["top"] - tuik["yogun"].get(u, 0)))[:8]
        for u in ils:
            print(f"    {u}: yoğun hesap {100 * il[u]['yogun'] / il[u]['top']:.1f} / TÜİK {tuik['yogun'].get(u)}")


if __name__ == "__main__":
    main()
