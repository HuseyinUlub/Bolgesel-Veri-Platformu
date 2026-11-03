"""
Temizlik adımı testleri:  python -m unittest tests/test_temizlik.py
"""
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from build_data import Report, n  # noqa: E402
from temizlik import temizle  # noqa: E402

# Türkiye > 1 Düzey 1 (TR2) > 2 Düzey 2 (TR21, TR22) > 4 il; ayrıca tek illi TR1 > TR10 > TR100
ENTS = {
    "TR": {"level": "country", "parent": None},
    "TR1": {"level": "region12", "parent": "TR"},
    "TR10": {"level": "region26", "parent": "TR1"},
    "TR100": {"level": "province", "parent": "TR10"},
    "TR2": {"level": "region12", "parent": "TR"},
    "TR21": {"level": "region26", "parent": "TR2"},
    "TR22": {"level": "region26", "parent": "TR2"},
    "TR211": {"level": "province", "parent": "TR21"},
    "TR212": {"level": "province", "parent": "TR21"},
    "TR221": {"level": "province", "parent": "TR22"},
    "TR222": {"level": "province", "parent": "TR22"},
}
ILLER = {"TR100": 50, "TR211": 10, "TR212": 20, "TR221": 30, "TR222": 40}


def veri(ind, yillar, bozuk=None):
    """Tutarlı bir toplanabilir seri; `bozuk` = {(kod, yıl): değer} ile bozulur."""
    v = {}
    for y in yillar:
        il = {k: x + int(y) % 7 for k, x in ILLER.items()}
        v.update({(k, y, ind): float(x) for k, x in il.items()})
        v[("TR10", y, ind)] = v[("TR1", y, ind)] = il["TR100"]
        v[("TR21", y, ind)] = il["TR211"] + il["TR212"]
        v[("TR22", y, ind)] = il["TR221"] + il["TR222"]
        v[("TR2", y, ind)] = v[("TR21", y, ind)] + v[("TR22", y, ind)]
        v[("TR", y, ind)] = sum(il.values())
    for (k, y), x in (bozuk or {}).items():
        v[(k, y, ind)] = x
    return v


def calistir(values, dosyalar=None):
    meta = {i: {"category": "Test", "sources": Counter()} for (_, _, i) in values}
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        for ad, metin in (dosyalar or {}).items():
            (d / "duzeltmeler").mkdir(exist_ok=True)
            (d / "duzeltmeler" / ad).write_text(metin, encoding="utf-8")
        log = temizle(values, meta, ENTS, {}, d, d / "build", Report(), n)
    return values, meta, log


YILLAR = [str(y) for y in range(2000, 2016)]


class Temizlik(unittest.TestCase):
    def test_toplanabilir_bolge_il_toplamina_duzeltilir(self):
        v = veri("Sayı", YILLAR, {("TR2", "2010"): 999.0})
        v, _, log = calistir(v)
        self.assertEqual(v[("TR2", "2010", "Sayı")], v[("TR21", "2010", "Sayı")] + v[("TR22", "2010", "Sayı")])
        self.assertEqual([x[0] for x in log], ["toplam"])

    def test_tek_illi_bolge_il_degerini_alir(self):
        v = veri("Sayı", YILLAR, {("TR1", "2005"): 7.0})
        v, _, _ = calistir(v)
        self.assertEqual(v[("TR1", "2005", "Sayı")], v[("TR100", "2005", "Sayı")])

    def test_tek_illi_eksik_yil_karsi_duzeyden_tamamlanir(self):
        ind = "İstihdam Oranı (15+ yaş) (%)"
        v = {("TR100", "2023", ind): 44.0, ("TR100", "2024", ind): 45.0,
             ("TR10", "2024", ind): 45.0, ("TR10", "2025", ind): 46.0,
             ("TR211", "2024", ind): 40.0, ("TR21", "2025", ind): 41.0}
        v, _, log = calistir(v)
        self.assertEqual(v[("TR100", "2025", ind)], 46.0)           # Düzey 2 → il
        self.assertEqual(v[("TR10", "2023", ind)], 44.0)            # il → Düzey 2
        self.assertNotIn(("TR1", "2024", ind), v)                   # Düzey 1'de hiç yoksa eklenmez
        self.assertNotIn(("TR211", "2025", ind), v)                 # çok illi bölgede taşıma yok

    def test_siralama_ve_yalniz_bolge_gostergesi_tamamlanmaz(self):
        v = {("TR10", "2025", "SEGE Sıralaması"): 1.0, ("TR100", "2024", "SEGE Sıralaması"): 1.0,
             ("TR10", "2025", "Kadın İstihdam Oranı (%)"): 30.0}
        v, _, _ = calistir(v)
        self.assertNotIn(("TR100", "2025", "SEGE Sıralaması"), v)
        self.assertNotIn(("TR100", "2025", "Kadın İstihdam Oranı (%)"), v)

    def test_oran_araligin_disindaysa_silinir(self):
        ind = "Okullaşma Oranı (%)"
        v = {(k, "2020", ind): x for k, x in {"TR211": 90.0, "TR212": 92.0, "TR21": 80.0,
                                              "TR221": 95.0, "TR222": 96.0, "TR22": 95.5}.items()}
        v, _, _ = calistir(v)
        self.assertNotIn(("TR21", "2020", ind), v)
        self.assertEqual(v[("TR22", "2020", ind)], 95.5)

    def test_oecd_ve_degisim_gostergelerine_dokunulmaz(self):
        for ind in ("Ölüm Hızı (OECD) (Binde)", "GSYH Değişim Oranı (%)"):
            v = {("TR211", "2020", ind): 1.0, ("TR212", "2020", ind): 2.0, ("TR21", "2020", ind): 9.0,
                 ("TR100", "2020", ind): 3.0, ("TR10", "2020", ind): 3.0}
            v, _, log = calistir(v)
            self.assertEqual(v[("TR21", "2020", ind)], 9.0)
            self.assertEqual(log, [])

    def test_elle_duzeltme_ve_birlestirme(self):
        v = {("TR100", "2020", "Uçak"): 5.0, ("TR100", "2021", "Uçak Sayısı"): 6.0,
             ("TR100", "2020", "Uçak Sayısı"): 5.0, ("TR", "2015", "Ziyaretçi"): 2.8}
        dosyalar = {
            "gosterge-birlestirme.csv": "eski;yeni;gerekce\nUçak;Uçak Sayısı;kopya\n",
            "degerler.csv": "kod;gosterge;yil;deger;gerekce\nTR;Ziyaretçi;2015;28122934;ondalık\n",
        }
        v, meta, _ = calistir(v, dosyalar)
        self.assertNotIn("Uçak", meta)
        self.assertEqual(v[("TR100", "2021", "Uçak Sayısı")], 6.0)
        self.assertEqual(v[("TR", "2015", "Ziyaretçi")], 28122934.0)


if __name__ == "__main__":
    unittest.main()
