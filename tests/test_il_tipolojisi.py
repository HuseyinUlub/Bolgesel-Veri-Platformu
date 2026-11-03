"""
İl tipolojisi testi:  python -m unittest tests/test_il_tipolojisi.py
Tipoloji dosyası (OECD TL2024 yazışma tablosundan) OECD'nin tipolojiye göre Türkiye toplamlarını birebir vermeli.
"""
import csv
import json
import sqlite3
import sys
import tempfile
import unittest
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(KOK / "pipeline"))
from build_data import Report  # noqa: E402
from il_tipolojisi import il_tipolojisi, DOSYA  # noqa: E402

EK = KOK / "veri-ekleri"
ECO = EK / "oecd-tipoloji" / "eco-rurb-tur.csv"
DB = KOK / "build" / "veri.db"


@unittest.skipUnless((EK / DOSYA).exists(), "tipoloji dosyası yok")
class IlTipolojisi(unittest.TestCase):
    def setUp(self):
        with open(EK / DOSYA, encoding="utf-8-sig") as f:
            self.satir = list(csv.DictReader(f, delimiter=";"))

    def test_81_il_ve_bilinen_iller(self):
        self.assertEqual(len(self.satir), 81)
        t = {s["il"]: (s["kentsel_kirsal_kod"], s["kente_erisim_kod"]) for s in self.satir}
        self.assertEqual(t["İstanbul"], ("PU", "MR_L"))
        self.assertEqual(t["Bayburt"][0], "PRR")
        m = {s["il"]: s["metropol_bolge_kod"] for s in self.satir if s["metropol_bolge_kod"]}
        self.assertEqual(len(m), 11)
        self.assertEqual(m["Ankara"], "TR001M")
        # metropol bölgeleri tam olarak kente erişimde MR_L/MR_M olan iller
        self.assertEqual(set(m), {s["il"] for s in self.satir if s["kente_erisim_kod"].startswith("MR")})

    @unittest.skipUnless(ECO.exists() and DB.exists(), "OECD dosyası ya da veri.db yok")
    def test_gsyh_toplamlari_oecd_ile_ayni(self):
        oecd = defaultdict(dict)
        with open(ECO) as f:
            for r in csv.DictReader(f):
                if r["MEASURE"] == "GDP" and r["UNIT_MEASURE"] == "XDC" and r["PRICES"] == "V" and r["TERRITORIAL_TYPE"] in ("PU", "IN"):
                    oecd[r["TERRITORIAL_TYPE"]][r["TIME_PERIOD"]] = float(r["OBS_VALUE"]) * 10 ** int(r["UNIT_MULT"]) / 1000
        sinif = {s["kod"]: s["kentsel_kirsal_kod"] for s in self.satir}
        tuik = defaultdict(lambda: defaultdict(float))
        for g, t, v in sqlite3.connect(DB).execute(
                "SELECT geo, time, value FROM values_long WHERE indicator='Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)'"):
            if g in sinif:
                tuik[sinif[g]][t] += v
        for s in ("PU", "IN"):
            for y, v in oecd[s].items():
                if y in tuik[s]:
                    self.assertAlmostEqual(tuik[s][y] / v, 1, places=6, msg=f"{s} {y}")

    def test_cikti(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            ents = {s["kod"]: {"level": "province"} for s in self.satir}
            il_tipolojisi(EK, d / "v.db", d, ents, Report())
            j = json.loads((d / "il-tipolojisi.json").read_text(encoding="utf-8"))
            self.assertEqual(len(j["iller"]), 81)
            n = sqlite3.connect(d / "v.db").execute("SELECT COUNT(*) FROM il_tipolojisi").fetchone()[0]
            self.assertEqual(n, 81)


if __name__ == "__main__":
    unittest.main()
