"""
Veri ekleri testleri:  python -m unittest tests/test_ekler.py
"""
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from build_data import Report, infer_decimals, n  # noqa: E402
from ekler import load_additions  # noqa: E402

ENTS = {
    "TR": {"level": "country"},
    "TR10": {"level": "region26"},
    "TR100": {"level": "province"},
    "ILCE1757": {"level": "district"},
}


def calistir(csv_metni, oncelik="ek", values=None):
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        (d / "ek.csv").write_text(csv_metni, encoding="utf-8")
        ind_meta = {"Toplam Nüfus": {"category": "Nüfus", "sources": Counter()}}
        values = values if values is not None else {("TR100", "2025", "Toplam Nüfus"): 100.0}
        dvalues, origin, rep = {}, {}, Report()
        yeni = load_additions(d, ENTS, ind_meta, values, dvalues, origin, rep, n, d / "build", oncelik)
        return values, dvalues, ind_meta, rep, yeni


BASLIK = "kod;gosterge;kategori;yil;deger;kaynak\n"


class EkTestleri(unittest.TestCase):
    def test_yeni_gosterge_ve_virgul(self):
        v, _, meta, rep, yeni = calistir(BASLIK + "TR100;Oran (%);Nüfus;2024;15,5;X\n")
        self.assertEqual(v[("TR100", "2024", "Oran (%)")], 15.5)
        self.assertIn("Oran (%)", yeni)
        self.assertEqual(meta["Oran (%)"]["category"], "Nüfus")

    def test_ek_oncelikli(self):
        v, *_ = calistir(BASLIK + "TR100;Toplam Nüfus;Nüfus;2025;120;X\n")
        self.assertEqual(v[("TR100", "2025", "Toplam Nüfus")], 120.0)

    def test_mevcut_oncelikli(self):
        v, *_ = calistir(BASLIK + "TR100;Toplam Nüfus;Nüfus;2025;120;X\n", oncelik="mevcut")
        self.assertEqual(v[("TR100", "2025", "Toplam Nüfus")], 100.0)

    def test_hatalar_raporlanir_ve_atlanir(self):
        v, _, _, rep, _ = calistir(BASLIK + "TR999;A;Nüfus;2024;1;X\nTR100;B;Nüfus;2024;1.234.567;X\n")
        metin = "\n".join(rep.lines)
        self.assertIn("Tanınmayan bölge kodu", metin)
        self.assertIn("Sayıya çevrilemeyen", metin)
        self.assertEqual(len(v), 1)

    def test_ilce_ayri_sozluge(self):
        _, d, *_ = calistir(BASLIK + "ILCE1757;Toplam Nüfus;Nüfus;2024;17221;X\n")
        self.assertEqual(d[("ILCE1757", "2024", "Toplam Nüfus")], 17221.0)

    def test_oran_olarak_girilmis_yuzde_uyarisi(self):
        *_, rep, _ = calistir(BASLIK + "TR100;Pay (%);Nüfus;2024;0,24;X\n")
        self.assertTrue(any("≤ 1" in l for l in rep.lines))

    def test_sablona_uymayan_dosya_atlanir(self):
        v, _, _, rep, _ = calistir("il;veri;deger\nAnkara;X;1\n")
        self.assertTrue(any("şablona uymuyor" in l for l in rep.lines))
        self.assertEqual(len(v), 1)


class OndalikTestleri(unittest.TestCase):
    def test_gini_gibi_kucuk_degerler_3_basamak(self):
        self.assertEqual(infer_decimals([0.425, 0.41, 0.433]), 3)

    def test_normal_degerler_en_fazla_2(self):
        self.assertEqual(infer_decimals([15.884, 23.1]), 2)
        self.assertEqual(infer_decimals([100, 2500]), 0)


if __name__ == "__main__":
    unittest.main()


class YayinVeGzipTestleri(unittest.TestCase):
    def test_yayin_hayir_yalniz_db(self):
        _, _, meta, rep, yeni = calistir(
            "kod;gosterge;kategori;yil;deger;kaynak;oncelik;yayin\n"
            "TR100;Ayrıntı: A;Nüfus;2024;5;X;;hayir\nTR100;Özet;Nüfus;2024;7;X;;\n")
        self.assertIs(meta["Ayrıntı: A"].get("yayin"), False)
        self.assertNotIn("yayin", meta["Özet"])
        self.assertIn("Yalnızca veri.db", "\n".join(rep.lines))

    def test_csv_gz_okunur(self):
        import gzip
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            with gzip.open(d / "ek.csv.gz", "wt", encoding="utf-8") as f:
                f.write(BASLIK + "TR100;Gz Göstergesi;Nüfus;2024;3;X\n")
            ind_meta = {}
            values = {}
            load_additions(d, ENTS, ind_meta, values, {}, {}, Report(), n, d / "build", "ek")
            self.assertEqual(values[("TR100", "2024", "Gz Göstergesi")], 3.0)
