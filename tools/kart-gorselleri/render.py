"""Kart görsellerini SVG'den 300x150 PNG'ye çevirir:  python tools/kart-gorselleri/render.py"""
from pathlib import Path
from playwright.sync_api import sync_playwright
KOK = Path(__file__).resolve().parent
HEDEF = KOK.parent.parent / "public" / "img"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 300, "height": 150}, device_scale_factor=1)
    for svg in KOK.glob("*.svg"):
        pg.set_content(f"<html><body style='margin:0;background:transparent'><img src='data:image/svg+xml;utf8,{svg.read_text(encoding='utf-8').replace('#','%23')}' width='300' height='150'></body></html>")
        pg.screenshot(path=str(HEDEF / f"{svg.stem}.png"), omit_background=True)
        print("->", HEDEF / f"{svg.stem}.png")
    b.close()
