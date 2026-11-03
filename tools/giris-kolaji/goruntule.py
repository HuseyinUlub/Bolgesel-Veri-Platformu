"""build/giris-kolaji.html → public/img/giris-kolaj.{webp,jpg} (Playwright + Pillow)."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image

KOK = Path(__file__).resolve().parents[2]
png = KOK / "build" / "giris-kolaji.png"
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 3200, "height": 740})
    pg.goto((KOK / "build" / "giris-kolaji.html").as_uri())
    pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(300)
    pg.screenshot(path=str(png), clip={"x": 0, "y": 0, "width": 3200, "height": 740})
    b.close()
im = Image.open(png).convert("RGB")
im.save(KOK / "public" / "img" / "giris-kolaj.webp", quality=84, method=6)
im.save(KOK / "public" / "img" / "giris-kolaj.jpg", quality=84, optimize=True, progressive=True)
for f in ("giris-kolaj.webp", "giris-kolaj.jpg"):
    print(f, round((KOK / "public" / "img" / f).stat().st_size / 1024), "KB")
