"""
esitsizlik.py — OECD Regions and Cities at a Glance, Tablo 2.2'deki bölgesel gelir eşitsizliği
ölçülerini veritabanındaki TÜİK kişi başına GSYH ve nüfus verisinden türetir.

Girdi : build/veri.db  ("Kişi Başına GSYH (TL)", "Toplam Nüfus")
Çıktı : veri-ekleri/turetilmis-esitsizlik.csv  (standart ek şablonu; bir sonraki `npm run veri` ile girer)
        public/veri/esitsizlik.json                (sitenin "Bölgesel Eşitsizlik" bölümü: Türkiye serileri + haritalar)

Kullanım:  python pipeline/turetilmis/esitsizlik.py   (sonra: python pipeline/build_data.py)

Ölçüler (her yıl, il = TL3 ve Düzey 2 = TL2 için ayrı):
  Theil endeksi (ağırlıksız)      T = 1/N · Σ (yᵢ/μ) · ln(yᵢ/μ)          μ = bölgelerin basit ortalaması
  Ortalama / medyan               μ / medyan(yᵢ)
  En yüksek / en düşük            max(yᵢ) / min(yᵢ)
  Değişim katsayısı               standart sapma / ortalama (ağırlıksız)
  En üst %20 / ortalama           nüfusun en zengin %20'sini (nüfus eşdeğeri) oluşturan bölgelerin
                                  toplam GSYH'si / toplam nüfusu, bölü Türkiye kişi başı GSYH
  En alt %20 / ortalama           aynı, en yoksul %20 için
  Kutuplaşma (üst %20 / alt %20)  ikisinin oranı
  Theil ayrıştırması (yalnız il)  gruplar = Düzey 1 (12 bölge)
      grup arası = 1/N · Σ_g N_g · (μ_g/μ) · ln(μ_g/μ)
      grup içi   = Σ_g (N_g/N) · (μ_g/μ) · T_g        (T = arası + içi)
      T_g        = Düzey 1 bölgesinin kendi illeri arasındaki Theil endeksi → haritada Düzey 1'de gösterilir

Tabloda "nüfus eşdeğeri" notu: üst/alt grup, nüfusun en az %20'sine ulaşana kadar bölge eklenerek oluşturulur.
Türkiye düzeyindeki seriler haritada gösterilemediği için yalnızca veri.db'ye girer (yayin=hayir).
"""

from __future__ import annotations

import csv
import math
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
GSYH = "Kişi Başına GSYH (TL)"
NUFUS = "Toplam Nüfus"
KAYNAK = "Platform hesaplaması (TÜİK kişi başına GSYH ve nüfus; OECD Tablo 2.2 yöntemi)"
KATEGORI = "Ekonomi"


def theil(ys):
    mu = sum(ys) / len(ys)
    return sum((y / mu) * math.log(y / mu) for y in ys) / len(ys)


def medyan(ys):
    s = sorted(ys)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def uc_grup(bolgeler, ust=True):
    """bolgeler: [(kpgsyh, nufus)]; nüfusun >= %20'sine ulaşana kadar en üst/alt bölgeleri toplar."""
    toplam_nufus = sum(p for _, p in bolgeler)
    sirali = sorted(bolgeler, key=lambda t: t[0], reverse=ust)
    gsyh = nufus = 0.0
    for y, p in sirali:
        gsyh += y * p
        nufus += p
        if nufus >= 0.2 * toplam_nufus:
            break
    return gsyh / nufus


def main():
    db = sqlite3.connect(KOK / "build" / "veri.db")
    duzey = dict(db.execute("SELECT geo, level FROM entities"))
    ust = dict(db.execute("SELECT geo, parent FROM entities"))
    deger = defaultdict(dict)  # (gösterge, yıl) -> {geo: v}
    for g, t, i, v in db.execute(
        "SELECT geo, time, indicator, value FROM values_long WHERE indicator IN (?, ?) AND value IS NOT NULL",
        (GSYH, NUFUS),
    ):
        deger[(i, t)][g] = v

    satirlar = []
    web = defaultdict(dict)       # seri anahtarı -> {yıl: değer}   (Türkiye serileri)
    harita = defaultdict(lambda: defaultdict(dict))  # harita anahtarı -> yıl -> {kod: değer}
    uclar = {}                    # yıl -> {düzey: (en yüksek kod, en düşük kod)}

    def ekle(kod, ad, yil, v, yayin="", anahtar=None):
        satirlar.append([kod, ad, KATEGORI, yil, repr(round(v, 6)).replace(".", ","), KAYNAK, "", yayin])
        if anahtar:
            if kod == "TR":
                web[anahtar][yil] = round(v, 5)
            else:
                harita[anahtar][yil][kod] = round(v, 4)

    yillar = sorted({t for (i, t) in deger if i == GSYH})
    for yil in yillar:
        y = deger[(GSYH, yil)]
        pop = deger.get((NUFUS, yil), {})
        for dz, etiket, k in (("province", "İller", "il"), ("region26", "Düzey 2", "d2")):
            b = {g: v for g, v in y.items() if duzey.get(g) == dz and v > 0}
            if len(b) < (81 if dz == "province" else 26):
                continue
            ys = list(b.values())
            mu = sum(ys) / len(ys)
            sd = math.sqrt(sum((v - mu) ** 2 for v in ys) / len(ys))
            ekle("TR", f"Bölgesel Eşitsizlik: Theil Endeksi, {etiket} (Kişi Başına GSYH)", yil, theil(ys), "hayir", f"theil_{k}")
            ekle("TR", f"Bölgesel Eşitsizlik: Ortalama / Medyan Oranı, {etiket}", yil, mu / medyan(ys), "hayir", f"ort_medyan_{k}")
            ekle("TR", f"Bölgesel Eşitsizlik: En Yüksek / En Düşük Oranı, {etiket}", yil, max(ys) / min(ys), "hayir", f"maxmin_{k}")
            ekle("TR", f"Bölgesel Eşitsizlik: Değişim Katsayısı, {etiket}", yil, sd / mu, "hayir", f"dk_{k}")
            uclar.setdefault(yil, {})[k] = [max(b, key=b.get), min(b, key=b.get)]

            # Kişi başına GSYH endeksi (Türkiye = 100): haritada gösterilebilen bölge düzeyli ölçü
            if "TR" in y:
                for g, v in b.items():
                    ekle(g, "Kişi Başına GSYH Endeksi (Türkiye=100)", yil, 100 * v / y["TR"], "", f"gsyh_endeks_{k}")

            # Nüfus eşdeğeri üst / alt %20 (nüfus verisi 2007'den itibaren)
            if all(g in pop for g in b) and "TR" in y:
                grup = [(b[g], pop[g]) for g in b]
                ort = y["TR"]
                ust20, alt20 = uc_grup(grup, True), uc_grup(grup, False)
                ekle("TR", f"Bölgesel Eşitsizlik: En Üst %20 / Ortalama, {etiket}", yil, ust20 / ort, "hayir", f"ust20_{k}")
                ekle("TR", f"Bölgesel Eşitsizlik: En Alt %20 / Ortalama, {etiket}", yil, alt20 / ort, "hayir", f"alt20_{k}")
                ekle("TR", f"Bölgesel Eşitsizlik: Kutuplaşma (Üst %20 / Alt %20), {etiket}", yil, ust20 / alt20, "hayir", f"kutup_{k}")

            # Theil ayrıştırması: iller, Düzey 1 grupları
            if dz == "province":
                gruplar = defaultdict(list)
                for g, v in b.items():
                    d2 = ust.get(g)
                    d1 = ust.get(d2)
                    if d1:
                        gruplar[d1].append(v)
                N = len(ys)
                arasi = sum(len(vs) * (sum(vs) / len(vs) / mu) * math.log(sum(vs) / len(vs) / mu)
                            for vs in gruplar.values()) / N
                ici = 0.0
                for d1, vs in gruplar.items():
                    tg = theil(vs) if len(vs) > 1 else 0.0
                    ici += (len(vs) / N) * (sum(vs) / len(vs) / mu) * tg
                    ekle(d1, "Bölge İçi Eşitsizlik: İller Arası Theil Endeksi (Düzey 1 Bölgesi İçinde)", yil, tg, "", "d1_theil")
                ekle("TR", "Bölgesel Eşitsizlik: Theil Ayrıştırması, Düzey 1 Bölgeleri Arası", yil, arasi, "hayir", "arasi")
                ekle("TR", "Bölgesel Eşitsizlik: Theil Ayrıştırması, Düzey 1 Bölgeleri İçi", yil, ici, "hayir", "ici")
                ekle("TR", "Bölgesel Eşitsizlik: Bölgeler Arası Farkın Toplam Eşitsizlikteki Payı (%)", yil,
                     100 * arasi / (arasi + ici), "hayir", "arasi_pay")
                assert abs((arasi + ici) - theil(ys)) < 1e-9, "Theil ayrıştırması toplamı tutmuyor"

    cikti = KOK / "veri-ekleri" / "turetilmis-esitsizlik.csv"
    with open(cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        w.writerows(satirlar)
    print(f"{len({r[1] for r in satirlar})} gösterge, {len(satirlar)} değer -> {cikti.relative_to(KOK)}")

    # Site için tek dosya: Türkiye serileri + harita değerleri + uç bölgeler
    webp = KOK / "public" / "veri" / "esitsizlik.json"
    webp.parent.mkdir(parents=True, exist_ok=True)
    import json
    webp.write_text(json.dumps({
        "kaynak": "TÜİK il ve Düzey 2 kişi başına GSYH ile nüfustan hesaplanmıştır (yöntem: OECD, Regions and Cities at a Glance, Tablo 2.2)",
        "seriler": web,
        "haritalar": harita,
        "uclar": uclar,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"-> {webp.relative_to(KOK)} ({webp.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
