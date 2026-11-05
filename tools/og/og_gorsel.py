"""Paylaşım görseli ve sekme simgesini üretir:
public/img/og.png (1200x630), public/favicon.svg, public/img/apple-touch-icon.png (180x180)

Çalıştırma: py -X utf8 tools/og/og_gorsel.py   (Playwright + Chromium gerekir)
Harita public/veri/geo/province.json'dan çizilir; önce `npm run veri` çalışmış olmalı.
"""
import json
import math
import pathlib
import tempfile

from playwright.sync_api import sync_playwright

KOK = pathlib.Path(__file__).resolve().parents[2]
CIKTI = KOK / "public" / "img" / "og.png"
GEO = KOK / "public" / "veri" / "geo" / "province.json"
FONT = (KOK / "node_modules" / "@fontsource" / "inter").as_uri()

# Harita kutusu (px) ve Düzey 1 bölgelerine göre ton sırası (batıdan doğuya kabaca)
KUTU = (650, 130, 520, 360)  # x, y, genişlik, yükseklik
TONLAR = ["#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#0ea5e9",
          "#06b6d4", "#14b8a6", "#0d9488", "#2dd4bf", "#38bdf8", "#93c5fd"]


def svg_yollari():
    veri = json.loads(GEO.read_text(encoding="utf-8"))
    halkalar = []
    for f in veri["features"]:
        g = f["geometry"]
        poligonlar = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        halkalar.append((f["properties"]["kod"], [p[0] for p in poligonlar]))

    noktalar = [n for _, hs in halkalar for h in hs for n in h]
    lon0, lon1 = min(n[0] for n in noktalar), max(n[0] for n in noktalar)
    lat0, lat1 = min(n[1] for n in noktalar), max(n[1] for n in noktalar)
    kx = math.cos(math.radians((lat0 + lat1) / 2))  # eşdikdörtgen, enlem düzeltmeli
    x, y, w, h = KUTU
    olcek = min(w / ((lon1 - lon0) * kx), h / (lat1 - lat0))
    ox = x + (w - (lon1 - lon0) * kx * olcek) / 2
    oy = y + (h - (lat1 - lat0) * olcek) / 2

    nuts1 = sorted({kod[:3] for kod, _ in halkalar})
    yollar = []
    for kod, hs in halkalar:
        d = "".join(
            "M" + "L".join(f"{ox + (lo - lon0) * kx * olcek:.1f},{oy + (lat1 - la) * olcek:.1f}" for lo, la in h) + "Z"
            for h in hs)
        renk = TONLAR[nuts1.index(kod[:3]) % len(TONLAR)]
        yollar.append(f'<path d="{d}" fill="{renk}"/>')
    return "".join(yollar)


HTML = """<!doctype html><html lang="tr"><head><meta charset="utf-8">
<link rel="stylesheet" href="{font}/400.css"><link rel="stylesheet" href="{font}/600.css">
<link rel="stylesheet" href="{font}/800.css">
<style>
*{{margin:0;box-sizing:border-box}}
body{{width:1200px;height:630px;overflow:hidden;font-family:Inter,sans-serif;color:#fff;
 background:radial-gradient(900px 600px at 85% 45%,#1e3a8a 0%,#0b1733 55%,#060d1f 100%)}}
.izgara{{position:absolute;inset:0;opacity:.07;
 background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);
 background-size:40px 40px;mask-image:linear-gradient(90deg,transparent,#000 60%)}}
svg{{position:absolute;inset:0;filter:drop-shadow(0 20px 40px rgba(37,99,235,.45))}}
svg path{{stroke:#0b1733;stroke-width:.8;stroke-linejoin:round}}
.metin{{position:absolute;left:72px;top:0;bottom:0;width:560px;display:flex;flex-direction:column;justify-content:center}}
.ust{{font-size:18px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#5eead4;margin-bottom:22px}}
h1{{font-size:62px;line-height:1.04;font-weight:800;letter-spacing:-.025em}}
h1 span{{background:linear-gradient(90deg,#93c5fd,#5eead4);-webkit-background-clip:text;color:transparent}}
.sayilar{{display:flex;gap:34px;margin-top:38px}}
.sayilar b{{display:block;font-size:34px;font-weight:800;letter-spacing:-.02em}}
.sayilar small{{font-size:16px;color:#94a3b8;font-weight:400}}
.alt{{position:absolute;left:72px;right:72px;bottom:40px;display:flex;justify-content:space-between;
 font-size:16px;color:#94a3b8;border-top:1px solid rgba(148,163,184,.2);padding-top:18px}}
</style></head><body>
<div class="izgara"></div>
<svg width="1200" height="630">{yollar}</svg>
<div class="metin">
 <div class="ust">Bölgesel Veri Platformu</div>
 <h1>Türkiye <span>Bölgesel Veri</span> Analizleri</h1>
 <div class="sayilar">
  <div><b>81</b><small>il</small></div>
  <div><b>26</b><small>Düzey 2 bölge</small></div>
  <div><b>2.900+</b><small>gösterge</small></div>
 </div>
</div>
<div class="alt"><span>Harita · Grafik · Analiz · Veri Kataloğu</span><span>TÜİK · OECD · Eurostat · MEB</span></div>
</body></html>"""


def favicon_svg():
    """64x64 simge: mavi-turkuaz zemin üzerinde beyaz Türkiye silueti (ana kara + Trakya)."""
    g = json.loads((KOK / "public" / "veri" / "geo" / "country.json").read_text(encoding="utf-8"))["features"][0]["geometry"]
    halkalar = sorted((p[0] for p in g["coordinates"]), key=len, reverse=True)[:2]
    noktalar = [n for h in halkalar for n in h]
    lon0, lon1 = min(n[0] for n in noktalar), max(n[0] for n in noktalar)
    lat0, lat1 = min(n[1] for n in noktalar), max(n[1] for n in noktalar)
    kx = math.cos(math.radians((lat0 + lat1) / 2))
    olcek = 54 / ((lon1 - lon0) * kx)
    oy = 32 - (lat1 - lat0) * olcek / 2
    d = ""
    for h in halkalar:
        pts = []
        for lo, la in h:
            n = (round(5 + (lo - lon0) * kx * olcek, 1), round(oy + (lat1 - la) * olcek, 1))
            if not pts or n != pts[-1]:
                pts.append(n)
        d += "M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z"
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
            '<defs><linearGradient id="z" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#1d4ed8"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs>'
            '<rect width="64" height="64" rx="14" fill="url(#z)"/>'
            f'<path d="{d}" fill="#fff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/></svg>')


def main():
    svg = favicon_svg()
    (KOK / "public" / "favicon.svg").write_text(svg, encoding="utf-8")
    html = HTML.format(font=FONT, yollar=svg_yollari())
    with tempfile.TemporaryDirectory() as d:
        og_yolu, ikon_yolu = pathlib.Path(d) / "og.html", pathlib.Path(d) / "ikon.html"
        og_yolu.write_text(html, encoding="utf-8")
        # iOS köşeleri kendisi yuvarlar: kare zemin
        kare = svg.replace("<svg ", "<svg width=180 height=180 ", 1).replace(' rx="14"', "")
        ikon_yolu.write_text('<body style="margin:0">' + kare, encoding="utf-8")
        with sync_playwright() as p:
            tarayici = p.chromium.launch()
            sayfa = tarayici.new_page(viewport={"width": 1200, "height": 630})
            sayfa.goto(og_yolu.as_uri())
            sayfa.evaluate("document.fonts.ready")
            sayfa.screenshot(path=str(CIKTI))
            sayfa = tarayici.new_page(viewport={"width": 180, "height": 180})
            sayfa.goto(ikon_yolu.as_uri())
            sayfa.screenshot(path=str(KOK / "public" / "img" / "apple-touch-icon.png"))
            tarayici.close()
    print("Yazıldı: og.png, favicon.svg, apple-touch-icon.png")


if __name__ == "__main__":
    main()
