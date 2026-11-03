"""
OECD Bölgesel Refah dosyası okuma testi:  python -m unittest tests/test_oecd_refah.py
"""
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOK / "pipeline"))
from build_data import Report  # noqa: E402
from oecd_refah import oecd_refah, _sayfalar  # noqa: E402

DOSYA = KOK / "veri-ekleri" / "oecd-refah-bolgeler.xlsx"


@unittest.skipUnless(DOSYA.exists(), "OECD dosyası yok")
class OecdRefah(unittest.TestCase):
    def test_okuma_ve_cikti(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            db = d / "v.db"
            sqlite3.connect(db).executescript("CREATE TABLE values_long (geo, time, indicator, value);")
            oecd_refah(KOK / "veri-ekleri", db, d, {"TR10": {"name": "İstanbul"}}, Report())
            j = json.loads((d / "oecd-refah.json").read_text(encoding="utf-8"))
            self.assertGreater(len(j["bolgeler"]), 400)
            self.assertEqual(len(j["konular"]), 11)
            ist = next(b for b in j["bolgeler"] if b["kod"] == "TR10")
            self.assertEqual(ist["ad"], "İstanbul")
            self.assertEqual(len(j["benzer"]["TR10"]), 5)
            self.assertTrue(all(b["ulke"] != "Türkiye" for b in (next(x for x in j["bolgeler"] if x["kod"] == k)
                                                               for k, _ in j["benzer"]["TR10"])))
            con = sqlite3.connect(db)
            self.assertGreater(con.execute("SELECT COUNT(*) FROM oecd_refah WHERE tur='puan'").fetchone()[0], 4000)

    def test_turkiye_is_gostergeleri_tuikten(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            db = d / "v.db"
            con = sqlite3.connect(db)
            con.executescript("CREATE TABLE values_long (geo, time, indicator, value);")
            con.executemany("INSERT INTO values_long VALUES (?,?,?,?)", [
                ("TR10", "2024", "İstihdam Oranı (15+ yaş) (%)", 52.8), ("TR10", "2024", "İşsizlik Oranı (15+ yaş) (%)", 8.8),
                ("TR", "2024", "İstihdam Oranı (15+ yaş) (%)", 49.5), ("TR", "2024", "İşsizlik Oranı (15+ yaş) (%)", 8.7),
                ("TR10", "2025", "İstihdam Oranı (15+ yaş) (%)", 99.0)])
            con.commit(); con.close()
            oecd_refah(KOK / "veri-ekleri", db, d, {}, Report())
            j = json.loads((d / "oecd-refah.json").read_text(encoding="utf-8"))
            ids = [g["id"] for g in j["gostergeler"]]
            ji, ju, kis = ids.index("istihdam"), ids.index("issizlik"), [k["id"] for k in j["konular"]].index("is")
            ist = next(b for b in j["bolgeler"] if b["kod"] == "TR10")
            self.assertEqual((ist["deger"][ji], ist["deger"][ju]), (52.8, 8.8))
            self.assertIsNone(ist["puan"][kis])
            tur = next(u for u in j["ulkeler"] if u["ulke"] == "Türkiye")
            self.assertEqual((tur["deger"][ji], tur["deger"][ju]), (49.5, 8.7))
            ank = next(b for b in j["bolgeler"] if b["kod"] == "TR51")   # TÜİK değeri yoksa OECD değeri de kalmaz
            self.assertIsNone(ank["deger"][ji])
            fr = next(b for b in j["bolgeler"] if b["ulke"] == "Fransa")  # diğer ülkeler değişmez
            self.assertIsNotNone(fr["deger"][ji])

    def test_sayfalar(self):
        self.assertIn("Score_Last", _sayfalar(DOSYA))


if __name__ == "__main__":
    unittest.main()
