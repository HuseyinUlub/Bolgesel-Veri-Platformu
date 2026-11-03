"""
donustur.py — TÜİK "Şebeke ve Arıtma Tesisi ile Hizmet Verilen Belediye Sayısı ve Nüfusu (İllere göre)"
(Veri Portalı, DF_SU_ATIKSU_SEBEKE_TESIS_BELEDIYE_NITELIK_V1; 2020, 2022, 2024) → veri-ekleri/tuik-belediye-su.csv

Girdi: tuik-belediye-su-2020-2024.json ("kod|yıl|nitelik" → değer; nitelik kodları aşağıda). Tarayıcıda Veri
Portalı API'sinden alındı (28 Eylül 2026).
Oranlar illerde TÜİK'ten; Düzey 1, Düzey 2 değerleri illerden belediye nüfusu ağırlığıyla hesaplanır (hizmet
verilen nüfus = oran × belediye nüfusu). Türkiye için bu hesap TÜİK'in Türkiye değerini birebir veriyor.
Neden: sitedeki 2022 bölge değerleri (eski siteden gelen trveriler.csv.gz) yanlıştı (ör. TRA2 %92, illeri %0–57);
eksik iller de aslında %0'dı.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / "veri-ekleri" / "tuik-belediye-su.csv"
KAYNAK = "Türkiye İstatistik Kurumu"
KAT = "Çevre"
# nitelik (Veri Portalı sırası) → gösterge
ORANLAR = {
    4: "İçme ve Kullanma Suyu Şebekesi ile Hizmet Verilen Nüfusun Belediye Nüfusu İçindeki Oranı (%)",
    5: "Kanalizasyon Şebekesi ile Hizmet Verilen Belediye Nüfusunun Toplam Belediye Nüfusuna Oranı (%)",
    8: "İçme ve Kullanma Suyu Arıtma Tesisi İle Hizmet Verilen Nüfusun Belediye Nüfusu İçindeki Oranı (%)",
    9: "Atık Su Arıtma Tesisi ile Hizmet Verilen Belediye Nüfusunun Belediye Nüfusu İçindeki Payı (%)",
}
KISI_BASI = {
    10: "Belediyelerde Kişi Başı Çekilen Günlük Su Miktarı (Litre/Kişi Gün)",
    11: "Belediyelerde Kişi Başı Günlük Atık Su Miktarı (Litre/Kişi Gün)",
}
BELEDIYE_NUFUSU = 1


def main():
    ham = {tuple(k.split("|")): v for k, v in
           json.loads(Path(__file__).with_name("tuik-belediye-su-2020-2024.json").read_text()).items()}
    veri = {(g, y, int(n)): v for (g, y, n), v in ham.items()}
    c = sqlite3.connect(KOK / "build" / "veri.db")
    ust = dict(c.execute("SELECT geo, parent FROM entities"))
    duzey = dict(c.execute("SELECT geo, level FROM entities"))
    iller = sorted(g for g, d in duzey.items() if d == "province")
    yillar = sorted({y for _, y, _ in veri})
    satir = []
    for y in yillar:
        for n, ad in ORANLAR.items():
            pay, payda = defaultdict(float), defaultdict(float)
            for g in iller:
                oran, nuf = veri[(g, y, n)], veri[(g, y, BELEDIYE_NUFUSU)]
                satir.append([g, ad, KAT, y, f"{oran:.2f}", KAYNAK, "ek"])
                for b in (ust[g], ust[ust[g]], "TR"):
                    pay[b] += oran * nuf; payda[b] += nuf
            for b in pay:
                satir.append([b, ad, KAT, y, f"{pay[b] / payda[b]:.2f}", KAYNAK, "ek"])
            tr = veri[("TR", y, n)]
            assert abs(pay["TR"] / payda["TR"] - tr) < 0.01, (ad, y, tr)
        for n, ad in KISI_BASI.items():
            for g in iller + ["TR"]:
                satir.append([g, ad, KAT, y, f"{veri[(g, y, n)]:.1f}", KAYNAK, "ek"])
    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik"])
        w.writerows(satir)
    print(f"{CIKTI.name}: {len(satir)} değer, yıllar {yillar}")


if __name__ == "__main__":
    main()
