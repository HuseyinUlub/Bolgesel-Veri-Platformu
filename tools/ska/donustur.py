"""
donustur.py — Sürdürülebilir Kalkınma Amaçları (SKA) göstergelerini eski araç dosyalarından
veri-ekleri/ska.csv dosyasına çevirir ("Sürdürülebilir Kalkınma" kategorisi).

Kaynak: dist/data/surdurulebilir.csv.gz (TÜİK SKA gösterge seti; Türkiye, Düzey 2 ve il satırları).
  illerska.csv.gz ve nuts2ska.csv bu dosyanın alt kümesidir (değerler birebir aynı; denetim aşağıda).
  7bolgeska.csv (coğrafi bölgeler) sitenin bölge sistemine (İBBS) karşılık gelmediği için veritabanına
  alınmaz; gösterge notunda belirtilir.

Gösterge adı: "SKA 03 Sağlıklı ve Kaliteli Yaşam: 3.2.1 Beş yaş altı ölüm hızı (...)"
  - ": " öncesi Veri Gezgini'nde grup başlığı olur (amaçlara göre gruplanır).
  - Addaki birim (%, TZE, µg/m3, ...) sona taşınır ki pipeline birimi doğru çıkarsın.

Kaynak dosyadaki etiket hataları (satır sırasından onarılır, bkz. ONARIM):
  - 8.9.2 Turizm sektöründe istihdam: üç blok aynı adla → Toplam / Erkek / Kadın (Erkek + Kadın = Toplam denetlenir)
  - 9.5.2.b "(Genel devlet)" sonrasındaki "(Erkek)"/"(Kadın)" satırları sektör adını kaybetmiş → sektör adı eklenir
  - "?" karakteri "≤" işaretinin bozulmuş hâli (17.6.1 hız sınıfları)

Kullanım: python tools/ska/donustur.py   →  veri-ekleri/ska.csv, veri-ekleri/_ska-denetim.txt
"""
from __future__ import annotations

import csv
import gzip
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
VERI = KOK / "dist" / "data"
CIKTI = KOK / "veri-ekleri" / "ska.csv"
NOTLAR = KOK / "veri-ekleri" / "gosterge-notlari.csv"
KAT = "Sürdürülebilir Kalkınma"

AMAC_ADLARI = {}  # kod → ad (kaynaktan)


def n(s):
    return " ".join(str(s or "").replace("\xa0", " ").replace("\t", " ").split())


def sayi(s):
    s = n(s).replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def oku(yol, **kw):
    ac = gzip.open if yol.suffix == ".gz" else open
    with ac(yol, "rt", encoding="utf-8-sig") as f:
        r = csv.DictReader(f, delimiter=";")
        return [{n(k): v for k, v in row.items()} for row in r]


BIRIM_ADAYI = re.compile(
    r"\((%|‰|TZE|Bin Kişi|Bin kişi|1000 kişi|Sayı|µg/m3|Ton|TL|Milyon TL|Milyon ABD \$|Milyar ABD \$|ABD \$|"
    r"Yıl|Kg|Km|Kişi|Hektar|Oran|Watt|GWh|MW|kişi başına watt|100\.000 nüfusta|1\.000 canlı doğum başına|"
    r"10\.000 nüfusta|Binde)\)"
)


def birim_temiz(b: str) -> str | None:
    """Ölçü birimi sütunundan tek ve kısa bir birim çıkarır; birden çok birim ya da açıklama ise None."""
    b = n(b).strip("() ")
    if not b or len(b) > 30 or any(x in b for x in (",", ":", ";", " - ", "a)")):
        return None
    return b.replace("10 000", "10.000").replace("100 000", "100.000")


def ad_duzenle(ad: str, birim: str | None = None) -> str:
    ad = ad.replace("(%) Türkiye)", "(%) (Türkiye)")
    ad = ad.replace(" ? ", " ≤ ").replace("?", "ı" if "hızland?r" in ad else "≤")
    m = list(BIRIM_ADAYI.finditer(ad))
    if m and not ad.endswith(m[-1].group(0)):
        b = m[0].group(0)
        ad = n(ad.replace(b, "", 1)) + f" {b}"
    if birim and not m and not ad.endswith(f"({birim})"):
        ad = f"{ad} ({birim})"
    return ad


def main():
    c = sqlite3.connect(KOK / "build" / "veri.db")
    iller = {ad: g for g, ad in c.execute("SELECT geo, name FROM entities WHERE level='province'")}
    d2 = {g for (g,) in c.execute("SELECT geo FROM entities WHERE level='region26'")}

    satirlar = oku(VERI / "surdurulebilir.csv.gz")
    for r in satirlar:
        AMAC_ADLARI[n(r["Amaç_kod"])] = n(r["Amaç"])

    # --- onarımlar (satır sırasına bağlı) ---
    blok = defaultdict(int)
    son_sektor = {}
    for i, r in enumerate(satirlar):
        alt = n(r.get("Alt gösterge"))
        gos = n(r["Gösterge"])
        if n(r["Gösterge_kod"]) == "8.9.2":
            anahtar = (n(r["Bölge/Şehir"]), n(r["Yıl"]))
            k = blok[anahtar]
            blok[anahtar] += 1
            r["Gösterge"] = f"{gos} ({['Toplam', 'Erkek', 'Kadın'][k]})"
        if n(r.get("Alt_gösterge_kod")) == "9.5.2.b":
            y = n(r["Yıl"])
            m = re.match(r"^(.*?)(?: \((Erkek|Kadın)\))?$", alt)
            govde, cins = m.group(1), m.group(2)
            if not cins:
                son_sektor[y] = govde
            elif govde != son_sektor.get(y):
                r["Alt gösterge"] = f"{son_sektor[y]} ({cins})"

    cikti = {}
    kaynaklar = {}
    birimsiz = set()
    cakisma = []
    onarim = []
    yedi_bolge = 0
    for r in satirlar:
        alt, gos = n(r.get("Alt gösterge")), n(r["Gösterge"])
        kod = n(r.get("Alt_gösterge_kod")) or n(r["Gösterge_kod"])
        amac = n(r["Amaç_kod"])
        ad = ad_duzenle(f"SKA {int(amac):02d} {AMAC_ADLARI[amac]}: {kod} {alt or gos}", birim_temiz(next((v for k, v in r.items() if k.startswith("Ölçü")), "")))
        yer = n(r["Bölge/Şehir"])
        duzey = n(r["Bölge düzeyi"]).split(".")[0]
        if duzey == "":
            yedi_bolge += 1  # coğrafi bölge satırları (7bolgeska.csv ile aynı) — İBBS karşılığı yok
            continue
        if duzey == "0":
            geo = "TR"
        elif duzey == "2":
            geo = yer if yer in d2 else None
        else:
            geo = iller.get(yer)
        if not geo:
            raise SystemExit(f"Tanınmayan yer: {yer!r} ({duzey})")
        v = sayi(r["Değer"])
        if v is None:
            continue
        if "17.6.1" in ad and "(10 Mbps ≤ x)" in ad and v < 1:
            # 2 Mbps ≤ x < 10 Mbps sınıfının 2024 değeri ≥10 Mbps etiketiyle gelmiş (0,02 + 0,46 + 23,42 = 23,90 ≈ toplam 23,93)
            ad = ad.replace("(10 Mbps ≤ x)", "(2 Mbps ≤ x < 10 Mbps)")
            onarim.append(f"17.6.1 {n(r['Yıl'])}: {v:g} değeri 2–10 Mbps sınıfına taşındı")
        yil = n(r["Yıl"])
        if re.fullmatch(r"\d{4}-\d{4}", yil):  # "2013-2024": dönem boyunca sabit değer → her yıla yazılır
            a, b = map(int, yil.split("-"))
            for y in range(a, b + 1):
                cikti.setdefault((geo, ad, str(y)), v)
            kaynaklar[ad] = n(r["Kaynak"]) or "Türkiye İstatistik Kurumu"
            onarim.append(f"{ad}: '{yil}' dönemi yıllara açıldı ({v:g})")
            continue
        anahtar = (geo, ad, yil)
        if anahtar in cikti:
            if abs(cikti[anahtar] - v) > 1e-9:
                # kaynakta fazladan satır: ilk değer tutulur (9.5.2.b 2023 Erkek: 151.219 + Kadın 79.315 = Toplam 230.534)
                cakisma.append(f"Çakışan fazla satır atlandı: {anahtar[0]} {anahtar[2]} {anahtar[1]}: {cikti[anahtar]:g} tutuldu, {v:g} atlandı")
            continue
        cikti[anahtar] = v
        kaynaklar[ad] = n(r["Kaynak"]) or "Türkiye İstatistik Kurumu"
        if not re.search(r"\([^()]{1,25}\)\s*$", ad):
            birimsiz.add(ad)

    # --- denetimler ---
    rapor = list(cakisma) + onarim
    # 8.9.2: Erkek + Kadın = Toplam
    for (geo, ad, y), v in cikti.items():
        if ad.endswith("(Toplam) (Bin Kişi)") and "8.9.2" in ad:
            e = cikti.get((geo, ad.replace("(Toplam)", "(Erkek)"), y))
            k = cikti.get((geo, ad.replace("(Toplam)", "(Kadın)"), y))
            if e is not None and k is not None and abs(e + k - v) > 2:
                rapor.append(f"8.9.2 {y}: Erkek+Kadın {e + k} ≠ Toplam {v}")
    # il ve Düzey 2 alt dosyaları birebir mi?
    esas = defaultdict(list)
    for (g, a, y), v in cikti.items():
        esas[(g, y, a.split(": ", 1)[1].split(" ", 1)[0])].append(v)
    for dosya, yer_sut in (("illerska.csv.gz", "Şehir"), ("nuts2ska.csv", "Bölge")):
        eksik = toplam = 0
        for r in oku(VERI / dosya):
            v = sayi(r["Değer"])
            if v is None:
                continue
            toplam += 1
            yer = n(r[yer_sut])
            kod = n(r.get("Alt_gösterge_kod")) or n(r["Gösterge_kod"])
            if not any(abs(x - v) < 1e-9 for x in esas.get((iller.get(yer, yer), n(r["Yıl"]), kod), [])):
                eksik += 1
        rapor.append(f"{dosya}: {toplam} değerden surdurulebilir.csv.gz'de karşılığı olmayan: {eksik}")
    b7 = oku(VERI / "7bolgeska.csv")
    rapor.append(f"surdurulebilir.csv.gz içindeki coğrafi bölge satırı: {yedi_bolge}")
    rapor.append(f"7bolgeska.csv: {len(b7)} değer (coğrafi bölge) veritabanına alınmadı, notta belirtildi")
    rapor.append(f"Birimi addan çıkarılamayan gösterge: {len(birimsiz)}")
    rapor += [f"  {a}" for a in sorted(birimsiz)]

    CIKTI.parent.mkdir(exist_ok=True)
    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        for (geo, ad, y), v in sorted(cikti.items(), key=lambda t: (t[0][1], t[0][2], t[0][0])):
            w.writerow([geo, ad, KAT, y, f"{v:.10g}", kaynaklar[ad]])
    (KOK / "veri-ekleri" / "_ska-denetim.txt").write_text("\n".join(rapor) + "\n", encoding="utf-8")

    # 7 coğrafi bölge değerleri: Türkiye göstergesinin notuna (son yıl) — veri kaybı olmasın
    tr_ad = next(a for (_, a, _) in cikti if ": 16.3.3.a " in a)
    son = max(n(r["Yıl"]) for r in b7)
    degerler = ", ".join(f"{n(r['Bölge']).replace(' Bölgesi', '')} %{n(r['Değer'])}" for r in b7 if n(r["Yıl"]) == son)
    notlar = {}
    if NOTLAR.exists():
        with open(NOTLAR, encoding="utf-8-sig", newline="") as f:
            notlar = {r["gosterge"]: r["not"] for r in csv.DictReader(f, delimiter=";")}
    notlar = {k: v for k, v in notlar.items() if not k.startswith("SKA ")}
    notlar[tr_ad] = (f"TÜİK bu göstergeyi coğrafi bölgelere göre de yayımlar ({son}: {degerler}). Coğrafi bölgeler "
                     "İBBS düzeylerine karşılık gelmediği için haritada gösterilmez; 2017 sonrası tüm yıllar veri-ekleri/_ska-cografi-bolgeler.csv dosyasında saklanır.")
    with open(NOTLAR, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["gosterge", "not"])
        w.writerows(notlar.items())
    with open(KOK / "veri-ekleri" / "_ska-cografi-bolgeler.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["bolge", "gosterge", "yil", "deger", "kaynak"])
        for r in b7:
            w.writerow([n(r["Bölge"]), tr_ad.replace("(Türkiye) ", ""), n(r["Yıl"]), n(r["Değer"]).replace(",", "."), n(r["Kaynak"])])
    print(f"ska.csv: {len(cikti)} değer, {len({a for _, a, _ in cikti})} gösterge")
    print("\n".join(rapor[:8]))

if __name__ == "__main__":
    main()
