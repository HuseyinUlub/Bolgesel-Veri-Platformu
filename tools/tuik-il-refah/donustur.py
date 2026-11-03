"""
donustur.py — TÜİK'in il (ve ilçe) düzeyindeki refah / yaşam kalitesi tablolarını veri-ekleri CSV'sine çevirir.

Dosyalar (bu klasörde; TÜİK Veri Portalı'ndan indirilmiş .xls):
  beseri-sermaye-2021-2023.xls         İllere göre beşeri sermaye endeksi ve bileşenleri, 2021–2023
  yasam-endeksi-2015.xls               İllerde yaşam endeksi: genel endeks ve 11 boyut, 2015
  yasam-endeksi-gostergeler-2015.xls   İllerde yaşam endeksi gösterge değerleri (41 gösterge), 2015
  ses-il-hanehalki-2023.xls            İllerin sosyoekonomik seviye (SES) skoru ve sınıflara göre hanehalkı sayısı, 2023
  ses-il-ilce-oran-2023.xls            İl ve ilçe bazında SES skoru ve sınıflara göre hanehalkı oranı, 2023
  mutluluk-yas-2013.xls                İllere ve yaş grubuna göre mutluluk düzeyi, 2013 (Yaşam Memnuniyeti Araştırması)
  mutluluk-medeni-2013.xls             İllere ve medeni duruma göre mutluluk düzeyi, 2013
  umut-2013.xls                        İllere göre umut düzeyi, 2013
  ab-uyeligi-etkisi-2013.xls           İllere göre olası AB üyeliğinin birey yaşamına etkisi, 2013

Endeks sıralamaları ve "bir önceki yıla göre değişim" sütunları alınmaz (değerlerden türetilebilir).
Değerler virgülle yazılır ("214,702" binlik ayırıcıyla karışmasın).
Kullanım: python tools/tuik-il-refah/donustur.py  →  veri-ekleri/tuik-il-refah.csv
"""
from __future__ import annotations

import csv
import json
import re
import warnings
from pathlib import Path

import pandas as pd

warnings.filterwarnings("ignore")
BU = Path(__file__).parent
KOK = BU.parents[1]
CIKTI = KOK / "veri-ekleri" / "tuik-il-refah.csv"
TUIK = "Türkiye İstatistik Kurumu"
SEGE = "Sosyo-Ekonomik Gelişmişlik"
YASAM = "Gelir ve Yaşam Koşulları"

M = json.load(open(KOK / "public" / "veri" / "manifest.json", encoding="utf-8"))["bolgeler"]
ILCE = json.load(open(KOK / "public" / "veri" / "ilceler.json", encoding="utf-8"))


def sade(s) -> str:
    s = str(s).replace("İ", "i").replace("I", "ı").lower().strip()
    return " ".join(s.translate(str.maketrans("âîû", "aiu")).split())


IL = {sade(v["ad"]): k for k, v in M.items() if v["duzey"] == "province"}
IL.update({"afyon": "TR332", "türkiye": "TR", "toplam-total": "TR", "toplam": "TR"})
PLAKA = {}
for k, v in M.items():
    if v["duzey"] == "province" and v.get("plaka"):
        PLAKA[int(v["plaka"])] = k
ILCE_AD = {(v["ust"], sade(v["ad"])): k for k, v in ILCE.items()}

satir: list[list] = []
eksik: list[str] = []


def ekle(kod, ad, kat, yil, v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return
    if isinstance(v, str):
        v = v.strip()
        if not re.fullmatch(r"-?\d+(\.\d+)?", v):
            return
        v = float(v)
    satir.append([kod, ad, kat, yil, repr(float(v)).replace(".", ",") if float(v) != int(float(v)) else str(int(float(v))), TUIK])


def il_kodu(ad):
    k = IL.get(sade(ad))
    if not k:
        eksik.append(str(ad))
    return k


def oku(ad):
    return pd.read_excel(BU / ad, header=None)


def il_satirlari(df, bas=5):
    for i in range(bas, len(df)):
        ad = df.iat[i, 0]
        if pd.isna(ad) or str(ad).startswith(("TÜİK", "TurkStat", "Sosyo", "In the")):
            continue
        k = il_kodu(ad)
        if k:
            yield k, df.iloc[i].tolist()


# ------------------------------------------------------------------ 1. Beşeri sermaye endeksi (2021–2023)
df = oku("beseri-sermaye-2021-2023.xls")
BS = {6: "Beşeri Sermaye Endeksi (0-1)", 9: "Beşeri Sermaye Endeksi: Hayatta Kalma Bileşeni (0-1)",
      12: "Beşeri Sermaye Endeksi: Sağlık Bileşeni (0-1)", 14: "Beşeri Sermaye Endeksi: Eğitim Bileşeni (0-1)"}
yil = None
for i in range(5, len(df)):
    r = df.iloc[i].tolist()
    if not pd.isna(r[0]) and re.fullmatch(r"\d{4}(\.0)?", str(r[0])):
        yil = int(float(r[0]))
    if yil is None or pd.isna(r[4]):
        continue
    kod = PLAKA.get(int(float(r[2]))) if not pd.isna(r[2]) else il_kodu(r[4])
    if not kod:
        eksik.append(f"beşeri sermaye {r[2]} {r[4]}")
        continue
    for j, ad in BS.items():
        ekle(kod, ad, SEGE, yil, r[j])

# ------------------------------------------------------------------ 2. İllerde yaşam endeksi (2015)
df = oku("yasam-endeksi-2015.xls")
BOYUT = {3: "Genel", 6: "Konut", 9: "Çalışma Hayatı", 12: "Gelir ve Servet", 15: "Sağlık", 18: "Eğitim", 21: "Çevre",
         24: "Güvenlik", 27: "Sivil Katılım", 30: "Altyapı Hizmetlerine Erişim", 33: "Sosyal Yaşam", 36: "Yaşam Memnuniyeti"}
for kod, r in il_satirlari(df, 7):
    for j, b in BOYUT.items():
        ad = "İllerde Yaşam Endeksi (0-1)" if b == "Genel" else f"İllerde Yaşam Endeksi: {b} (0-1)"
        ekle(kod, ad, SEGE, 2015, r[j])

df = oku("yasam-endeksi-gostergeler-2015.xls")
basliklar = {}
for j, v in enumerate(df.iloc[5].tolist()):
    if j >= 2 and not pd.isna(v):
        tr = str(v).split("\n")[0].strip()
        birim = re.search(r"\(([^)]*)\)", str(v))
        # "İstihdam oranı \n(%) Employment…" → birim ikinci satırda
        satirlar = [s.strip() for s in str(v).split("\n") if s.strip()]
        b = next((re.search(r"\(([^)]*)\)", s).group(1) for s in satirlar[:3] if re.search(r"\(([^)]*)\)", s)), "")
        b = {"‰": "Binde"}.get(b, b)
        tr = re.sub(r"\s*\([^)]*\)\s*$", "", tr).strip()
        if b and f"({b})" in tr:  # parantez birim değil, adın parçası: "(3-5 yaş) net okullaşma oranı"
            b = "%" if "oran" in tr.lower() else ""
        basliklar[j] = f"İllerde Yaşam Endeksi Göstergesi: {tr}" + (f" ({b})" if b else "")
for kod, r in il_satirlari(df, 7):
    for j, ad in basliklar.items():
        ekle(kod, ad, SEGE, 2015, r[j])

# ------------------------------------------------------------------ 3. Sosyoekonomik seviye (2023)
df = oku("ses-il-hanehalki-2023.xls")
SINIF7 = {3: "En Üst Seviye (A+)", 4: "Üst Seviye (A)", 5: "Üst Altı Seviye (B)", 6: "Üst Orta Seviye (C1)",
          7: "Alt Orta Seviye (C2)", 8: "Alt Seviye (D)", 9: "En Alt Seviye (E)"}
for kod, r in il_satirlari(df, 5):
    ekle(kod, "Ortalama Sosyoekonomik Seviye (SES) Skoru", SEGE, 2023, r[1])
    ekle(kod, "Sosyoekonomik Seviyeye Göre Hanehalkı Sayısı: Toplam", SEGE, 2023, round(float(r[2])))
    for j, s in SINIF7.items():
        ekle(kod, f"Sosyoekonomik Seviyeye Göre Hanehalkı Sayısı: {s}", SEGE, 2023, round(float(r[j])))

df = oku("ses-il-ilce-oran-2023.xls")
SINIF5 = {4: "Üst Seviye (A ve A+)", 5: "Üst Altı Seviye (B)", 6: "Orta Seviye (C1 ve C2)", 7: "Alt Seviye (D)", 8: "En Alt Seviye (E)"}
for i in range(5, len(df)):
    r = df.iloc[i].tolist()
    if pd.isna(r[0]) or pd.isna(r[2]):
        continue
    il = il_kodu(r[0])
    if not il:
        continue
    if pd.isna(r[1]):
        kod = il
    else:
        kod = ILCE_AD.get((il, sade(r[1])))
        if not kod and sade(r[1]) == sade("Merkez"):  # merkez ilçeler il adıyla kayıtlı
            kod = ILCE_AD.get((il, sade(r[0])))
        if not kod:
            eksik.append(f"ilçe {r[0]} / {r[1]}")
            continue
        ekle(kod, "Ortalama Sosyoekonomik Seviye (SES) Skoru", SEGE, 2023, r[2])  # il değeri yukarıdaki dosyadan
    for j, s in SINIF5.items():
        ekle(kod, f"Sosyoekonomik Seviyeye Göre Hanehalkı Oranı: {s} (%)", SEGE, 2023, r[j])

# ------------------------------------------------------------------ 4. Yaşam Memnuniyeti Araştırması (2013)
DUZEY = ["Mutlu", "Orta Düzeyde Mutlu", "Mutsuz"]
df = oku("mutluluk-yas-2013.xls")
YAS = ["Toplam", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
bloklar = [(1, 2), (14, 15), (27, 28)]  # (toplam sütunu, ilk yaş sütunu) — yaş sütunları ikişer aralıklı
for kod, r in il_satirlari(df, 7):
    for d, (t, y0) in zip(DUZEY, bloklar):
        for k, yas in enumerate(YAS):
            j = t if yas == "Toplam" else y0 + 2 * (k - 1)
            ad = f"Mutluluk Düzeyi: {d} (%)" if yas == "Toplam" else f"Mutluluk Düzeyi: {d}, {yas} Yaş (%)"
            ekle(kod, ad, YASAM, 2013, r[j])

df = oku("mutluluk-medeni-2013.xls")
# Başlık etiketleri bir sütun kaymış; blok düzeni sabit: her düzey için Evli (Toplam, Erkek, Kadın), boşluk,
# Evli olmayan (Toplam, Erkek, Kadın), boşluk. Mutlu 5–11, Orta 13–19, Mutsuz 21–27.
for bas, duzey in ((5, "Mutlu"), (13, "Orta Düzeyde Mutlu"), (21, "Mutsuz")):
    for k, medeni in ((0, "Evli"), (4, "Evli Olmayan")):
        for d, ek in ((0, ""), (1, ", Erkek"), (2, ", Kadın")):
            j = bas + k + d
            ad = f"Mutluluk Düzeyi: {duzey}, {medeni}{ek} (%)"
            for kod, r in il_satirlari(df, 7):
                ekle(kod, ad, YASAM, 2013, r[j])

df = oku("umut-2013.xls")
UMUT = {1: "Umutlu (%)", 3: "Umutlu Değil (%)", 5: "Umutlu, Erkek (%)", 7: "Umutlu Değil, Erkek (%)",
        9: "Umutlu, Kadın (%)", 11: "Umutlu Değil, Kadın (%)"}
for kod, r in il_satirlari(df, 6):
    for j, ad in UMUT.items():
        ekle(kod, f"Umut Düzeyi: {ad}", YASAM, 2013, r[j])

df = oku("ab-uyeligi-etkisi-2013.xls")
AB = {1: "Olumlu", 2: "Etkisi Yok", 3: "Olumsuz", 4: "Fikri Yok"}
for kod, r in il_satirlari(df, 5):
    for j, ad in AB.items():
        ekle(kod, f"Olası AB Üyeliğinin Birey Yaşamına Etkisi: {ad} (%)", YASAM, 2013, r[j])

# ------------------------------------------------------------------ yaz
with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
    w.writerows(satir)
from collections import Counter
say = Counter(r[1] for r in satir)
print(f"{len(satir)} değer, {len(say)} gösterge → {CIKTI.relative_to(KOK)}")
print("Eşleşmeyen:", sorted(set(eksik))[:40], len(set(eksik)))
