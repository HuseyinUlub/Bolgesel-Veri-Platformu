"""
tuik_oranlar.py — OECD'nin hazır verdiği bazı oranları TÜİK sayıları ve TÜİK yıl sonu nüfusuyla yeniden üretir.

Neden: OECD oranlarda paydada iki yıl sonu nüfusunun ortalamasını (yıl ortası) kullanıyor; platformun esas kaynağı
TÜİK olduğundan oranlar TÜİK'in yaklaşımıyla (aynı yılın 31 Aralık nüfusu) hesaplanır. OECD sürümleri
veri-ekleri'nden çıkarıldı (bkz. docs/DENETIM.md, madde 12).

Girdi : build/veri.db   Çıktı: veri-ekleri/turetilmis-tuik-oranlar.csv (bir sonraki `npm run veri` ile girer)
Kullanım: python pipeline/turetilmis/tuik_oranlar.py  (sonra: python pipeline/build_data.py)

Düzey 1 değerleri, TÜİK Düzey 1 yayımlamıyorsa il sayılarının toplamından hesaplanır.
Kişi başına GSYH (SGP): TÜİK GSYH ÷ TÜİK nüfusu ÷ SGP çevrim oranı (TL / SGP $, OECD ulusal hesaplar;
pipeline/turetilmis/sgp-cevrim-orani.csv).
"""
from __future__ import annotations

import csv
import sqlite3
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[1].parent
KAYNAK = "Türkiye İstatistik Kurumu verileri baz alınarak hesaplanmıştır."
NUFUS = "Toplam Nüfus"
KADIN_15_49 = [f"Yaş Grubu ve Cinsiyete Göre Nüfus: {a}-{a + 4} Yaş, Kadın" for a in range(15, 50, 5)]
COCUK = ["Yaş Grubu ve Cinsiyete Göre Nüfus: 0-4 Yaş, Erkek", "Yaş Grubu ve Cinsiyete Göre Nüfus: 0-4 Yaş, Kadın"]

# (gösterge, kategori, pay göstergeleri (toplanır), payda göstergeleri (toplanır; None = nüfus), çarpan, ondalık)
TANIMLAR = [
    ("Bin Kişiye Düşen Hemşire Sayısı", "Sağlık", ["Hemşire Sayısı"], None, 1e3, 2),
    ("Dolaşım Sistemi Hastalıklarından Ölüm Hızı (Yüz Binde)", "Sağlık",
     ["Seçilmiş Ölüm Nedenlerine Göre Ölüm Sayısı: Dolaşım Sistemi Hastalıkları"], None, 1e5, 1),
    ("Solunum Sistemi Hastalıklarından Ölüm Hızı (Yüz Binde)", "Sağlık",
     ["Seçilmiş Ölüm Nedenlerine Göre Ölüm Sayısı: Solunum Sistemi Hastalıkları"], None, 1e5, 1),
    ("Çocuk-Kadın Oranı (0-4 Yaş Çocuk / 15-49 Yaş Kadın) (%)", "Demografi", COCUK, KADIN_15_49, 100, 2),
    ("Ar-Ge Harcamasının GSYH'ye Oranı (%)", "Araştırma ve Geliştirme",
     ["AR-GE Harcaması (1000 TL)"], ["Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)"], 100, 2),
]


def main():
    c = sqlite3.connect(KOK / "build" / "veri.db")
    duzey = dict(c.execute("SELECT geo, level FROM entities"))
    ust = dict(c.execute("SELECT geo, parent FROM entities"))

    def seri(ad):
        return {(g, t): v for g, t, v in c.execute("SELECT geo, time, value FROM values_long WHERE indicator=?", (ad,))
                if v is not None and duzey.get(g) in ("country", "region12", "region26", "province")}

    def toplam(adlar):
        """Göstergelerin toplamı; Düzey 1'de yoksa illerden toplanır."""
        parca = [seri(a) for a in adlar]
        ortak = set.intersection(*(set(p) for p in parca))
        out = {k: sum(p[k] for p in parca) for k in ortak}
        d1 = defaultdict(float); say = defaultdict(int)
        for (g, t), v in out.items():
            if duzey.get(g) == "province":
                k = (ust.get(ust.get(g)), t)  # il → Düzey 2 → Düzey 1
                d1[k] += v; say[k] += 1
        for k, v in d1.items():
            if k not in out and k[0] and duzey.get(k[0]) == "region12":
                out[k] = v
        return out

    nufus = toplam([NUFUS])
    satirlar = []
    for ad, kat, pay, payda, carpan, ond in TANIMLAR:
        p = toplam(pay)
        q = nufus if payda is None else toplam(payda)
        for k, v in sorted(p.items()):
            if q.get(k):
                satirlar.append([k[0], ad, kat, k[1], f"{v / q[k] * carpan:.{ond}f}", KAYNAK])

    # Kişi başına GSYH, SGP
    with open(Path(__file__).with_name("sgp-cevrim-orani.csv"), encoding="utf-8") as f:
        sgp = {r["yil"]: float(r["tl_per_sgp_dolar"]) for r in csv.DictReader(f, delimiter=";")}
    gsyh = toplam(["Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)"])
    for (g, t), v in sorted(gsyh.items()):
        if t in sgp and nufus.get((g, t)):
            satirlar.append([g, "Kişi Başına GSYH, Satın Alma Gücü Paritesiyle (SGP) ($)", "Ekonomi", t, f"{v * 1000 / nufus[(g, t)] / sgp[t]:.0f}",
                             "Türkiye İstatistik Kurumu verileri baz alınarak hesaplanmıştır (SGP çevrim oranı: OECD)."])

    cikti = KOK / "veri-ekleri" / "turetilmis-tuik-oranlar.csv"
    with open(cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satirlar)
    say = defaultdict(int)
    for s in satirlar:
        say[s[1]] += 1
    for k, v in say.items():
        print(f"{v:6d}  {k}")
    print("Yazıldı:", cikti.relative_to(KOK))


if __name__ == "__main__":
    main()
