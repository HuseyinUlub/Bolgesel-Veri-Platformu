"""
TÜİK dönüştürücü testleri:  py -X utf8 -m unittest tests/test_tuik_donustur.py
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "guncelle"))
from tuik_donustur import topla  # noqa: E402


class ToplaTest(unittest.TestCase):
    def test_butun_illeri_olan_yil_toplanir(self):
        d = {("TR631", "2024"): 1.0, ("TR632", "2024"): 5.0, ("TR633", "2024"): 2.0}
        o = topla(d)
        self.assertEqual(o[("TR63", "2024")], 8.0)
        self.assertEqual(o[("TR6", "2024")], 8.0)

    def test_eksik_il_varsa_bolge_toplanmaz(self):
        # 2025'te Kahramanmaraş (TR632) yok: TR63 ve TR6 eksik illerle toplanmamalı
        d = {("TR631", "2024"): 1.0, ("TR632", "2024"): 5.0, ("TR633", "2024"): 2.0,
             ("TR631", "2025"): 1.0, ("TR633", "2025"): 2.0}
        o = topla(d)
        self.assertNotIn(("TR63", "2025"), o)
        self.assertNotIn(("TR6", "2025"), o)
        self.assertEqual(o[("TR631", "2025")], 1.0)

    def test_akista_olan_ilin_eksik_degeri_sifir_sayilir(self):
        # TR632 bu seride 2025'te yok ama akışın başka serisinde var: değeri 0, bölge toplanır
        d = {("TR631", "2024"): 1.0, ("TR632", "2024"): 5.0, ("TR633", "2024"): 2.0,
             ("TR631", "2025"): 1.0, ("TR633", "2025"): 2.0}
        mevcut = set(d) | {("TR632", "2025")}
        o = topla(d, mevcut)
        self.assertEqual(o[("TR63", "2025")], 3.0)

    def test_turkiye_81_il_ister(self):
        o = topla({("TR631", "2024"): 1.0})
        self.assertNotIn(("TR", "2024"), o)

    def test_apideki_ust_duzey_korunur(self):
        d = {("TR631", "2024"): 1.0, ("TR633", "2024"): 2.0, ("TR63", "2024"): 99.0}
        self.assertEqual(topla(d)[("TR63", "2024")], 99.0)


if __name__ == "__main__":
    unittest.main()
