"""Ana sayfa "Avrupa'nın 291 Bölgesi" sahnesi için veri: public/veri/avrupa-sahne.json

Girdi:
  public/veri/giris.json             (tools/uluslararasi/giris_verisi.py çıktısı: Eurostat/TÜİK Düzey 2 göstergeleri)
  public/veri/geo/avrupa-nuts2.json  (Eurostat/GISCO NUTS 2, EPSG:3035)
  tools/uluslararasi/geo/kibris-km.json
      Natural Earth 1:10m'den Kıbrıs adası kıyı çizgisi ve KKTC sınırı (EPSG:3035, km);
      'gkry' GKRY denetimindeki alanın ağırlık merkezi (CY00 noktası buraya konur).

Her bölge için: kod, ad, ülke, harita konumu (km), kişi başı GSYH (SGP, AB=100; 2004 ve son yıl),
yaşlı bağımlılık oranı, 2008-2025 yıllık nüfus değişimi, kadın istihdam oranı (2019, 2024) ve
"gelir ikizi" (son yıl GSYH düzeyi en yakın Türkiye dışı bölge; Ceuta ve Melilla hariç).

Çalıştırma: python tools/uluslararasi/avrupa_sahne_verisi.py
"""
import json
from pathlib import Path

from shapely.geometry import shape

KOK = Path(__file__).resolve().parents[2]
VERI = KOK / "public" / "veri"
DISARIDA = {"ES70", "PT20", "PT30"}  # Kanarya, Azorlar, Madeira; FRY* (denizaşırı) ayrıca


def main():
    g = json.loads((VERI / "geo" / "avrupa-nuts2.json").read_text(encoding="utf-8"))
    d = json.loads((VERI / "giris.json").read_text(encoding="utf-8"))
    kibris = json.loads((Path(__file__).parent / "geo" / "kibris-km.json").read_text(encoding="utf-8"))
    ad = d["bolgeAdlari"]
    B = []
    for f in g["features"]:
        k = f["id"]
        if k in DISARIDA or k.startswith("FRY"):
            continue
        geo = shape(f["geometry"])
        if geo.geom_type == "MultiPolygon":
            geo = max(geo.geoms, key=lambda p: p.area)
        p = geo.representative_point()
        x, y = round(p.x / 1000), round(p.y / 1000)
        a = ad.get(k, k) if k.startswith("TR") else f["properties"].get("ad", k)
        if k == "CY00":  # Eurostat verisi yalnızca GKRY denetimindeki alanı kapsar
            a = "GKRY (Kıbrıs Rum Kesimi)"
            x, y = kibris["gkry"]
        ka = d["kadin"].get(k) or [None, None]
        B.append(dict(k=k, a=a, u="EL" if k[:2] == "EL" else k[:2], x=x, y=y,
                      g=d["gsyh"]["deger"].get(k), g4=d["gsyh"]["d2004"].get(k), ya=d["yasli"]["deger"].get(k),
                      n=(d["nufus"].get(k) or {}).get("g"), k19=ka[0], k24=ka[1]))
    adaylar = [b for b in B if not b["k"].startswith("TR") and b["g"] is not None and b["k"] not in ("ES63", "ES64")]
    for t in B:
        if t["k"].startswith("TR") and t["g"] is not None:
            t["ikiz"] = min(adaylar, key=lambda e: (abs(e["g"] - t["g"]), -(e["g4"] or 0)))["k"]
    out = dict(
        bolgeler=B,
        ulkeler={k: v for k, v in d["ulkeAdlari"].items() if len(k) == 2} | {"XK": "Kosova"},
        kibris={k: kibris[k] for k in ("ada", "kktc", "kktcMerkez")},
        ab=dict(yasli=d["yasli"]["ab"], kadin=d["kadin"]["EU27_2020"], nufus=d["nufus"]["EU27_2020"]["g"]),
        trUlke=dict(g=d["gsyh"]["ulke"].get("TR"), kadin=d["kadin"]["TR"], nufus=d["nufus"]["TR"]["g"],
                    yasli=d["yasli"]["deger"].get("TR")),
        yil=dict(gsyh=d["gsyh"]["yil"], yasli=d["yasli"]["yil"]),
    )
    (VERI / "avrupa-sahne.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"avrupa-sahne.json: {len(B)} bölge, {sum(b['k'].startswith('TR') for b in B)} Türkiye bölgesi")


if __name__ == "__main__":
    main()
