"""
TÜİK ADNKS 2025 köy ve belediye nüfusları → veri-ekleri/tuik-koy-belediye-2025.csv

Kaynaklar (TÜİK MEDAS sorguları, kullanıcı indirdi):
  koy-nufuslari-2025.xls       18.183 köy (ve 9 mezra), erkek/kadın nüfus — "İl(İlçe/Ad Köy.)-kod"
  belediye-nufuslari-2025.xls  1.377 belediye (büyükşehir illerinde Evet sütunu) — "İl(İlçe/Ad Bel.)-kod"
  koy-sehir-nufus-2025.xls     ilçe başına köy / şehir nüfusu (denetim için; veri tabanında zaten var)

Belde = ilçe belediyesi olmayan belediye (adı ilçe adından, merkez ilçede il adından farklı).
Denetim: her ilçede köylerin nüfusu + beldelerin nüfusu = TÜİK'in "Köy Nüfusu" (köy-şehir dosyası), 973/973 ilçe.

Göstergeler (Nüfus kategorisi, 2025; ilçe, il ve Türkiye):
  Nüfusu Olan Köy Sayısı · Belde Sayısı · Belde Nüfusu · Köylerde Yaşayan Nüfus (Belde Hariç)
  Ortalama Köy Nüfusu · Nüfusu 100'den Az Olan Köylerin Oranı (%)
Kullanım: python tools/tuik-koy-belediye/donustur.py
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

BU = Path(__file__).parent
KOK = BU.parents[1]
CIKTI = KOK / "veri-ekleri" / "tuik-koy-belediye-2025.csv"
KAYNAK = "Türkiye İstatistik Kurumu, ADNKS 2025 (köy ve belediye nüfusları); platform hesaplaması"
KAT, YIL = "Nüfus", 2025

M = json.load(open(KOK / "public" / "veri" / "manifest.json", encoding="utf-8"))["bolgeler"]
ILCE = json.load(open(KOK / "public" / "veri" / "ilceler.json", encoding="utf-8"))


def sade(s):
    s = str(s).strip().replace("İ", "i").replace("I", "ı").lower()
    for a, b in zip("çğıöşüâî", "cgiosuai"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z]", "", s)


IL = {sade(v["ad"]): k for k, v in M.items() if v["duzey"] == "province"}
IA = {(v["ust"], sade(v["ad"])): k for k, v in ILCE.items()}


def ilce_kodu(il, ilce):
    u = IL.get(sade(il))
    s = sade(ilce)
    if u and s == "merkez":
        s = sade(M[u]["ad"])
    return IA.get((u, s)) if u else None


def sayi(v):
    return 0 if pd.isna(v) else int(v)


def main():
    eksik = []
    koy = defaultdict(list)  # ilçe → [köy nüfusları]
    df = pd.read_excel(BU / "koy-nufuslari-2025.xls", header=None).iloc[5:]
    for ad, e, k in zip(df[1], df[2], df[3]):
        m = re.match(r"^(.*?)\((.*?)/(.*?) (Köy|Mezra)\.?\)-(\d+)$", str(ad).strip())
        kod = m and ilce_kodu(m[1], m[2])
        if not kod:
            eksik.append(ad)
            continue
        koy[kod].append(sayi(e) + sayi(k))
    belde = defaultdict(list)
    df = pd.read_excel(BU / "belediye-nufuslari-2025.xls", header=None).iloc[5:]
    for ad, e, h in zip(df[1], df[2], df[3]):
        m = re.match(r"^(.*?)\((.*?)/(.*?) Bel\.?\)-(\d+)$", str(ad).strip())
        kod = m and ilce_kodu(m[1], m[2])
        if not kod:
            eksik.append(ad)
            continue
        il, ic, bel = sade(m[1]), sade(m[2]), sade(m[3])
        if bel == ic or (ic == "merkez" and bel == il):
            continue  # ilçe belediyesi
        belde[kod].append(sayi(e) + sayi(h))

    # denetim: köy + belde = TÜİK ilçe köy nüfusu
    df = pd.read_excel(BU / "koy-sehir-nufus-2025.xls", header=None).iloc[5:]
    tuik = {"ILCE" + re.search(r"-(\d+)$", str(a)).group(1): sayi(k) for a, k in zip(df[1], df[2])}
    uyumsuz = [k for k in tuik if tuik[k] != sum(koy[k]) + sum(belde[k])]
    print(f"Eşleşmeyen satır: {len(eksik)}; köy+belde ≠ TÜİK köy nüfusu olan ilçe: {len(uyumsuz)} / {len(tuik)}")

    birim = defaultdict(lambda: {"koy": [], "belde": []})
    for kod in set(koy) | set(belde) | set(tuik):
        for u in (kod, ILCE[kod]["ust"], "TR"):
            birim[u]["koy"] += koy[kod]
            birim[u]["belde"] += belde[kod]
    satir = []

    def ekle(kod, ad, v, ondalik=0):
        satir.append([kod, ad, KAT, YIL, (f"{v:.{ondalik}f}" if ondalik else str(int(v))).replace(".", ","), KAYNAK])

    for kod, b in sorted(birim.items()):
        k, bl = b["koy"], b["belde"]
        ekle(kod, "Nüfusu Olan Köy Sayısı", len(k))
        ekle(kod, "Belde Sayısı", len(bl))
        ekle(kod, "Belde Nüfusu", sum(bl))
        ekle(kod, "Köylerde Yaşayan Nüfus (Belde Hariç)", sum(k))
        if k:
            ekle(kod, "Ortalama Köy Nüfusu", sum(k) / len(k), 1)
            ekle(kod, "Nüfusu 100'den Az Olan Köylerin Oranı (%)", 100 * sum(1 for x in k if x < 100) / len(k), 2)
    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satir)
    tr = birim["TR"]
    print(f"Türkiye: {len(tr['koy'])} köy, {sum(tr['koy']):,} kişi; {len(tr['belde'])} belde, {sum(tr['belde']):,} kişi")
    print(f"{len(satir)} değer → {CIKTI.relative_to(KOK)}")


if __name__ == "__main__":
    main()
