"""
TÜİK TÜFE (2003=100) Türkiye değerleri, Aralık ayları 2022–2025 → veri-ekleri/tuik-tufe-turkiye.csv

TÜİK, istatistiki bölgelere (İBBS Düzey 2) göre TÜFE'yi Aralık 2021'den sonra yayımlamadığı için bölge
verisi 2021'de biter. Türkiye değerleri ise aralık bültenlerinin ek tablosundan (ana harcama grupları)
alınır: genel TÜFE ve 12 ana grup için yıllık değişim ile 12 aylık ortalamalara göre değişim.
2021 satırı yalnızca denetim içindir (veri tabanındaki değerlerle karşılaştırılır, yazılmaz).
Kullanım: python tools/tuik-tufe/donustur.py
"""
import csv, json, sqlite3
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
J = json.load(open(Path(__file__).with_name("tuik-tufe-aralik.json"), encoding="utf-8"))
KAYNAK = "Türkiye İstatistik Kurumu"
AD = {  # bülten adı → veri tabanındaki grup adı
    "Gıda ve alkolsüz içecekler": "Gıda ve Alkolsüz İçecekler", "Alkollü içecekler ve tütün": "Alkollü İçecekler ve Tütün",
    "Giyim ve ayakkabı": "Giyim ve Ayakkabı", "Konut": "Konut", "Ev eşyası": "Ev Eşyası", "Sağlık": "Sağlık",
    "Ulaştırma": "Ulaştırma", "Haberleşme": "Haberleşme", "Eğlence ve kültür": "Eğlence ve Kültür", "Eğitim": "Eğitim",
    "Lokanta ve oteller": "Lokanta ve Oteller", "Çeşitli mal ve hizmetler": "Çeşitli Mal ve Hizmetler",
}


def gostergeler(grup):
    if grup == "TÜFE":
        return ("Yıllık TÜFE Değişim Oranı (Aralık, Önceki Yılın Aynı Ayına Göre) (%)", "Yıllık TÜFE Değişim Oranı (2003=100) (%)")
    g = AD[grup]
    return (f"TÜFE Yıllık Değişim (Aralık-Aralık, 2003=100): {g} (%)", f"TÜFE 12 Aylık Ortalamalara Göre Değişim (Aralık, 2003=100): {g} (%)")


db = sqlite3.connect(KOK / "build" / "veri.db")
satir, fark = [], []
for yil, degerler in J["yillar"].items():
    for grup, (yillik, ort12) in zip(J["gruplar"], degerler):
        for ad, v in zip(gostergeler(grup), (yillik, ort12)):
            if yil == "2021":
                e = db.execute("SELECT value FROM values_long WHERE indicator=? AND geo='TR' AND time='2021'", (ad,)).fetchone()
                if not e or abs(e[0] - v) > 0.011:
                    fark.append((ad, e, v))
                continue
            satir.append(["TR", ad, "Enflasyon ve Fiyat", yil, v, KAYNAK])
print(f"2021 denetimi: {26 - len(fark)}/26 aynı", fark)
with open(KOK / "veri-ekleri" / "tuik-tufe-turkiye.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
    w.writerows(satir)
print(f"{len(satir)} değer → veri-ekleri/tuik-tufe-turkiye.csv")
