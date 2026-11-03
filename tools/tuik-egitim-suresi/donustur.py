"""
donustur.py — TÜİK "Ortalama Eğitim Süresi" (DF_ORTALAMA_EGITIM_SURE, 25+ yaş) il ve Türkiye değerlerini
veri-ekleri/tuik-egitim-suresi.csv dosyasına yazar. Eski kaynak dosyada 2024 il satırları karışık olduğu için
silinmişti (duzeltmeler/degerler.csv); bu dosya 2011–2025'i doğrudan TÜİK'ten getirir.

JSON, databrowser2 API'den (POST /api/core/nodes/1/datasets/TR,DF_ORTALAMA_EGITIM_SURE,1.0/data, gövde "[]")
alınmış, cinsiyet=_T süzülmüştür. Kullanım: python tools/tuik-egitim-suresi/donustur.py
"""
import csv, json, sqlite3
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
J = json.load(open(Path(__file__).with_name("tuik-oes-2011-2025.json"), encoding="utf-8"))
AD = "Ortalama Eğitim Süresi (Yıl)"

c = sqlite3.connect(KOK / "build" / "veri.db")
eski = {(g, int(t)): v for g, t, v in c.execute("SELECT geo,time,value FROM values_long WHERE indicator=?", (AD,))}
fark = 0
satir = []
for kod, dizi in J["veri"].items():
    for y, v in zip(J["yillar"], dizi):
        d = round(v, 1)
        if (kod, y) in eski and abs(eski[(kod, y)] - d) > 0.051:
            fark += 1
        satir.append([kod, AD, "Eğitim", y, f"{d:.1f}", "Türkiye İstatistik Kurumu"])
assert len(J["veri"]) == 82
with open(KOK / "veri-ekleri" / "tuik-egitim-suresi.csv", "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
    w.writerows(satir)
print(f"tuik-egitim-suresi.csv: {len(satir)} değer; veritabanındakilerden farklı: {fark}")
