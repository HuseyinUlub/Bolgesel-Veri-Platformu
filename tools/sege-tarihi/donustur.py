"""
Tarihî SEGE çalışmaları (DPT, 1969–2003) → veri-ekleri/sege-tarihi.csv

Kaynaklar: tools/sege-tarihi/kaynak/*.pdf (DPT yayınları; taranmış). Tablolar sayfa görüntülerinden elle/OCR ile
okunup tools/sege-tarihi/cikti/<çalışma>.csv dosyalarına yazıldı (sütunlar: calisma;tablo;sayfa;duzey;il;ilce;
gosterge;yil;deger;sira;emin). Her tablonun notları cikti/<çalışma>-notlar.md dosyalarında.

Bu betik o ara dosyaları sitenin gösterge adlarına çevirir:
  SEGE Endeks Değeri                       il: 1980, 1985, 1991, 1996 çalışmaları (1. ana bileşen / endeks)
                                           ilçe: 1985 (616 ilçe), 1996 (858 ilçe)
  Sosyo-Ekonomik Gelişmişlik Sıralaması    il: 1963–1970 (Tolan 1972), 1980, 1985, 1991, 1996; ilçe: 1985, 1996;
                                           Düzey 1 ve Düzey 2: 2003
  Sosyo-Ekonomik Gelişmişlik Kademesi      il: 1991 (5 grup), 2003 (5 kademe); ilçe: 1996 (6 grup)
  Sosyo-Ekonomik Gelişmişlik Endeksi (Türkiye 1963=100)   il ve Türkiye, 1963–1970 (Tolan 1972, Tablo C)
  SEGE 1980 bileşenleri (2.–4. ana bileşen)                il, 1980
  SEGE 2003 sektörel endeksleri (imalat sanayi, sağlık, eğitim)   il ve Düzey 2, 2003

Yıl sütunu çalışmanın yılıdır (1980 çalışması 1975 verisiyle, 1991 çalışması ağırlıkla 1989 verisiyle yapılmıştır;
bkz. notlar). Eski il adları bugünkü illere eşlenir; sonradan ayrılan iller için değer eski il bütünü içindir.
1969 çalışması (1963–1967) ve 1972'nin Tablo A'sı siteye alınmaz: aynı dönem Tolan (1972) Tablo C'de sabit
tabanla (Türkiye 1963=100) 1963–1970 için yeniden hesaplanmıştır.

Kullanım: python tools/sege-tarihi/donustur.py
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

BU = Path(__file__).parent
KOK = BU.parents[1]
CIKTI = KOK / "veri-ekleri" / "sege-tarihi.csv"
KAT = "Sosyo-Ekonomik Gelişmişlik"
KAYNAK = {
    "1972": "DPT, Tolan (1972), Türkiye'de İller İtibariyle Sosyo-Ekonomik Gelişmişlik Endeksi (1963-1970)",
    "1980": "DPT (1980), İllerin Sosyo-Ekonomik Gelişmişlik Sıralaması",
    "1985": "DPT (1985), İllerin ve İlçelerin Gelişmişlik Sıralaması Araştırması",
    "1991": "DPT (1991), İllerin Sosyo-Ekonomik Gelişmişlik Sıralaması",
    "1996": "DPT (1996), İllerin ve Bölgelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması",
    "2003": "DPT (2003), İllerin ve Bölgelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması",
}

M = json.load(open(KOK / "public" / "veri" / "manifest.json", encoding="utf-8"))["bolgeler"]
ILCE = json.load(open(KOK / "public" / "veri" / "ilceler.json", encoding="utf-8"))


def sade(s: str) -> str:
    s = str(s).strip().replace("İ", "i").replace("I", "ı").lower()
    s = s.replace("â", "a").replace("î", "i").replace("û", "u")
    for a, b in zip("çğıöşü", "cgiosu"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z]", "", s)


IL = {sade(v["ad"]): k for k, v in M.items() if v["duzey"] == "province"}
for eski, yeni in {"maras": "kahramanmaras", "kmaras": "kahramanmaras", "urfa": "sanliurfa", "icel": "mersin",
                   "afyon": "afyonkarahisar", "gumusane": "gumushane", "hakari": "hakkari"}.items():
    IL[eski] = IL[yeni]
D2 = {sade(v["ad"].split(",")[0]): k for k, v in M.items() if v["duzey"] == "region26"}
D1 = {sade(v["ad"]): k for k, v in M.items() if v["duzey"] == "region12"}
ILCE_IL = defaultdict(dict)  # il kodu → sade(ad) → ilçe kodu
ILCE_AD = defaultdict(list)  # sade(ad) → [ilçe kodu]
for k, v in ILCE.items():
    ILCE_IL[v["ust"]][sade(v["ad"])] = k
    ILCE_AD[sade(v["ad"])].append(k)

satirlar: list[list] = []
eksik: Counter = Counter()


def ekle(kod, ad, yil, deger, calisma):
    if deger in (None, ""):
        return
    v = float(deger)
    d = f"{v:.6f}".rstrip("0").rstrip(".") if v != int(v) else str(int(v))
    satirlar.append([kod, ad, KAT, str(yil), d.replace(".", ","), KAYNAK[calisma]])


def il_kodu(ad):
    k = IL.get(sade(ad))
    if not k:
        eksik[f"il {ad}"] += 1
    return k


# Adı değişen ilçeler ve adı değişen merkez ilçeler (bugün tek bir ilçeye karşılık gelenler).
# Merkezi sonradan birden çok ilçeye bölünen iller (Adana, Antalya, Bursa, Samsun, Van…) eşlenmez.
AD_DEGISEN = {
    "sincanli": "sinanpasa", "kazan": "kahramankazan", "yenihisar": "didim",
    "dogubeyazit": "dogubayazit", "sultandag": "sultandagi", "elmadagi": "elmadag", "cumaova": "cumayeri",
    "ilica": "aziziye", "samandagi": "samandag", "egridir": "egirdir", "caglıyancerit": "caglayancerit",
    "cagliyancerit": "caglayancerit", "cicekdag": "cicekdagi", "poturge": "puturge", "arapkir": "arapgir",
    "ondokuzmayis": "ondokuzmayis", "aydinlar": "tillo", "mereglisi": "marmaraereglisi",
    "cemiskezek": "cemisgezek", "eyup": "eyupsultan", "talas": "talas", "magara": "tufanbeyli", "bozoyuk": "bozuyuk", "imroz": "gokceada",
}
MERKEZ = {"hatay": "antakya", "kocaeli": "izmit", "sakarya": "adapazari", "mardin": "artuklu", "mugla": "mentese",
          "ordu": "altinordu", "tekirdag": "suleymanpasa", "trabzon": "ortahisar", "aydin": "efeler"}

TASINAN = {("nigde", "ortakoy"): "aksaray", ("zonguldak", "yenice"): "karabuk", ("cankiri", "ovacik"): "karabuk"}


def ilce_kodu(il_ad, ilce_ad):
    il = il_kodu(il_ad)
    s = sade(ilce_ad)
    if s in ("merkez", "buyuksehir"):
        s = sade(M[il]["ad"]) if il else s
        s = MERKEZ.get(s, s)
    s = AD_DEGISEN.get(s, s)
    if il and sade(M[il]["ad"]) == "antalya" and s == "kale":
        s = "demre"
    if s == "ondokuzmayis":
        s = next((k for k in ILCE_IL.get(il, {}) if k.endswith("mayis")), s)
    if il and s in ILCE_IL[il]:
        return ILCE_IL[il][s]
    if il and (sade(M[il]["ad"]), s) in TASINAN:  # başka ile bağlanan, adı başka illerde de geçen ilçeler
        yeni = IL[TASINAN[(sade(M[il]["ad"]), s)]]
        if s in ILCE_IL[yeni]:
            return ILCE_IL[yeni][s]
    aday = ILCE_AD.get(s, [])
    if len(aday) == 1:  # sonradan başka ile (ör. yeni kurulan il) bağlanan ilçe
        return aday[0]
    eksik[f"ilçe {il_ad}/{ilce_ad}"] += 1
    return None


def oku(ad):
    with open(BU / "cikti" / ad, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


# ---------------------------------------------------------------- 1963–1970 (Tolan 1972, Tablo C)
for r in oku("1972.csv"):
    if not r["tablo"].startswith("Tablo C"):
        continue
    kod = "TR" if r["duzey"] == "ulke" else il_kodu(r["il"])
    if not kod:
        continue
    ekle(kod, "Sosyo-Ekonomik Gelişmişlik Endeksi (Türkiye 1963=100)", r["yil"], r["deger"], "1972")
    if kod != "TR":
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", r["yil"], r["sira"], "1972")

# ---------------------------------------------------------------- 1980
BILESEN80 = {
    "Tablo IV": "SEGE Endeks Değeri",
    "Tablo VI": "SEGE 1980: Tarımsal Modernleşme Bileşeni (2. Ana Bileşen)",
    "Tablo VIII": "SEGE 1980: Sayısal Eğitim Bileşeni (3. Ana Bileşen)",
    "Tablo X": "SEGE 1980: İmalat Sanayii İstihdam Artışı Bileşeni (4. Ana Bileşen)",
}
for r in oku("1980.csv"):
    t = r["tablo"].split(" - ")[0].strip()
    kod = il_kodu(r["il"])
    if kod and t in BILESEN80:
        ekle(kod, BILESEN80[t], 1980, r["deger"], "1980")
        if t == "Tablo IV":
            ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 1980, r["sira"], "1980")

# ---------------------------------------------------------------- 1985 (il + ilçe)
for r in oku("1985.csv"):
    if r["gosterge"] != "Gelişmişlik endeksi (1. ana bileşen)":
        continue
    kod = il_kodu(r["il"]) if r["duzey"] == "il" else ilce_kodu(r["il"], r["ilce"])
    if kod:
        ekle(kod, "SEGE Endeks Değeri", 1985, r["deger"], "1985")
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 1985, r["sira"], "1985")

# ---------------------------------------------------------------- 1991
for r in oku("1991.csv"):
    kod = il_kodu(r["il"])
    if not kod:
        continue
    if r["gosterge"].startswith("Gelişmişlik endeksi"):
        ekle(kod, "SEGE Endeks Değeri", 1991, r["deger"], "1991")
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 1991, r["sira"], "1991")
    elif r["gosterge"].startswith("Gelişmişlik grubu (5"):
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Kademesi", 1991, r["deger"], "1991")

# ---------------------------------------------------------------- 1996 (il + ilçe)
for r in oku("1996.csv"):
    if r["duzey"] != "il":
        continue
    kod = il_kodu(r["il"])
    if kod:
        ekle(kod, "SEGE Endeks Değeri", 1996, r["deger"], "1996")
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 1996, r["sira"], "1996")
ilce96 = Counter()
for r in oku("1996-ilce.csv"):
    kod = ilce_kodu(r["il"], r["ilce"])
    if not kod:
        continue
    ilce96[(kod, r["gosterge"])] += 1
    if ilce96[(kod, r["gosterge"])] > 1:  # iki eski ilçe aynı bugünkü ilçeye düşerse ilki alınır
        eksik[f"ilçe çift {r['il']}/{r['ilce']}"] += 1
        continue
    if r["gosterge"] == "Gelişmişlik endeksi":
        ekle(kod, "SEGE Endeks Değeri", 1996, r["deger"], "1996")
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 1996, r["sira"], "1996")
    elif r["gosterge"] == "Gelişmişlik grubu":
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Kademesi", 1996, r["deger"], "1996")

# ---------------------------------------------------------------- 2003 (sektörel endeksler, bölge sıraları, kademe)
SEKTOR = {"İmalat sanayi gelişmişlik endeksi": "SEGE 2003: İmalat Sanayi Gelişmişlik Endeksi",
          "Sağlık sektörü gelişmişlik endeksi": "SEGE 2003: Sağlık Sektörü Gelişmişlik Endeksi",
          "Eğitim sektörü gelişmişlik endeksi": "SEGE 2003: Eğitim Sektörü Gelişmişlik Endeksi"}
for r in oku("2003.csv"):
    g, dz = r["gosterge"], r["duzey"]
    if dz == "il":
        kod = il_kodu(r["il"])
    elif dz == "duzey2":
        kod = D2.get(sade(r["il"].replace("Alt Bölgesi", "")))
    elif dz == "duzey1":
        kod = D1.get(sade(r["il"]))
    else:
        continue  # coğrafi bölgeler (7 bölge) sitede birim değil
    if not kod:
        eksik[f"{dz} {r['il']}"] += 1
        continue
    if g in SEKTOR:
        ekle(kod, SEKTOR[g], 2003, r["deger"], "2003")
    elif g == "Gelişmişlik endeksi" and dz in ("duzey1", "duzey2"):
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", 2003, r["sira"], "2003")
    elif g == "Gelişmişlik kademesi":
        ekle(kod, "Sosyo-Ekonomik Gelişmişlik Kademesi", 2003, r["deger"], "2003")

# ---------------------------------------------------------------- İlçe SEGE 2004, 2017, 2022
KAYNAK.update({
    "2004": "DPT (2004), İlçelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması",
    "2017": "Kalkınma Bakanlığı (2019), İlçelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması SEGE-2017",
    "2022": "Sanayi ve Teknoloji Bakanlığı (2022), İlçelerin Sosyo-Ekonomik Gelişmişlik Sıralaması Araştırması SEGE-2022",
})
for yil in ("2004", "2017", "2022"):
    for r in oku(f"{yil}-ilce.csv"):
        g = r["gosterge"]
        if g not in ("Gelişmişlik endeksi", "Gelişmişlik kademesi"):
            continue
        kod = ilce_kodu(r["il"], r["ilce"])
        if not kod:
            continue
        if g == "Gelişmişlik endeksi":
            ekle(kod, "SEGE Endeks Değeri", yil, r["deger"], yil)
            ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", yil, r["sira"], yil)
        else:
            ekle(kod, "Sosyo-Ekonomik Gelişmişlik Kademesi", yil, r["deger"], yil)

# ---------------------------------------------------------------- İlçe çalışmaları 1966, 1981 (yalnız ulusal ilçe sıralaması)
KAYNAK.update({
    "1966": "DPT (1966), İlçelere Göre Sosyo-Ekonomik Yönden Gelişmişlik Endeksi Çalışması II",
    "1981": "DPT (1981), İlçeler İtibariyle İllerin Sosyo-Ekonomik Gelişmişlik Sıralaması",
})
for yil, tablo, g in (("1966", "Ek 3", "Gelişmişlik endeksi"), ("1981", "Ek 2", "Gelişmişlik değeri")):
    for r in oku(f"{yil}-ilce.csv"):
        if r["duzey"] != "ilce" or not r["tablo"].startswith(tablo) or not r["gosterge"].startswith(g):
            continue
        kod = ilce_kodu(r["il"], r["ilce"])
        if kod:
            ekle(kod, "SEGE Endeks Değeri", yil, r["deger"], yil)
            ekle(kod, "Sosyo-Ekonomik Gelişmişlik Sıralaması", yil, r["sira"], yil)

# aynı birim-gösterge-yıl iki kez gelmesin
gorulen, temiz = set(), []
for s in satirlar:
    a = (s[0], s[1], s[3])
    if a in gorulen:
        eksik[f"çift {a}"] += 1
        continue
    gorulen.add(a)
    temiz.append(s)

with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
    w.writerows(temiz)
say = Counter((s[1], s[3], "ilce" if s[0].startswith("ILCE") else str(len(s[0]))) for s in temiz)
for k, v in sorted(say.items()):
    print(f"{v:5d}  {k}")
print(f"{len(temiz)} değer → {CIKTI.relative_to(KOK)}")
print("Eşleşmeyen / atlanan:", sum(eksik.values()))
for k, v in sorted(eksik.items()):
    print("  ", k, v)
