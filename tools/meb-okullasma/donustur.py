"""
donustur.py — MEB "Millî Eğitim İstatistikleri, Örgün Eğitim" kitaplarından il/bölge okullaşma oranlarını
veri-ekleri CSV'sine çevirir.

Kullanım: python tools/meb-okullasma/donustur.py <PDF klasörü>     (pdftotext gerekir: poppler-utils)
Çıktı   : veri-ekleri/meb-okullasma.csv

Kaynak tablolar (her kitapta numarası değişir; başlığa göre bulunur):
  - "İBBS 3. düzey ve eğitim seviyesine göre okullaşma oranı" → okul öncesi brüt/net okullaşma (3-5, 4-5, 5 yaş)
    (2017/18'den itibaren aynı tablo 1. ve 2. düzey için de var)
  - "İBBS 3. düzey yaş gruplarına göre net okullaşma oranı" (2015/16'dan itibaren) → kademeye bakmadan yaşa göre oran
Bir öğretim yılı iki kitapta varsa (kitaplar önceki yılın tablosunu da içerebiliyor) sonraki kitabın değeri alınır.
2012/13 ve öncesinde okul öncesi için tek oran verilir; kitap dipnotuna göre bu NET okullaşma oranıdır.
2024/25 kitabının (2425.pdf) yazı tipi kodlaması bozuk; metin cidmetin.py ile çözülür. Yaşa göre tablosu
okunamadığı için o tablo meb-2024-25.json dosyasından gelir (kitap tarayıcıda okunmuştu);
2022/23 için yalnız Türkiye değerleri (2024/25 kitabı, Tablo 1.1.b) aynı dosyadadır.
Yıl = öğretim yılının başladığı yıl (2024 = 2024/25); TÜİK'in okullaşma serileriyle aynı kural.
"""
from __future__ import annotations

import csv
import json
import re
import subprocess
import sys
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
CIKTI = KOK / "veri-ekleri" / "meb-okullasma.csv"
KAYNAK = "Millî Eğitim Bakanlığı, Millî Eğitim İstatistikleri (Örgün Eğitim)"
KAT = "Eğitim"
NUM = r"\d+[.,]\d+"
KOD = re.compile(r"^\s*(TR[0-9A-C]{0,3})\s")
YASLAR = ["3", "4", "5", "3-5", "4-5", "6-9", "10-13", "14-17"]


def sayi(x):
    return float(x.replace(",", "."))


def yil(sayfa):
    m = re.search(r"\[\s*(20\d\d)/'(\d\d)", sayfa[:3000])
    return int(m.group(1)) if m else None


def okul_oncesi(sayfalar):
    sonuc, kod = {}, None
    for p in sayfalar:
        for satir in p.split("\n"):
            m = KOD.match(satir)
            kalan = satir[m.end():] if m else satir
            if m:
                kod = m.group(1)
            if kod is None:
                continue
            m2 = re.match(r"^\D*?\s(3-5|4-5|5)\s+((?:" + NUM + r"\s+)*" + NUM + ")", " " + kalan)
            if not m2:
                continue
            sayilar = re.findall(NUM, kalan.split("Brüt")[0].split("Net")[0])
            if len(sayilar) not in (3, 6):
                continue
            d = sonuc.setdefault(kod, {})
            if m2.group(1) in d:
                continue
            d[m2.group(1)] = ({"n": sayi(sayilar[0])} if len(sayilar) == 3
                              else {"b": sayi(sayilar[0]), "n": sayi(sayilar[3])})
    return sonuc


def yasa_gore(sayfalar):
    sonuc = {}
    for p in sayfalar:
        for satir in p.split("\n"):
            m = KOD.match(satir)
            if not m:
                continue
            n = re.findall(NUM, satir[m.end():])
            if len(n) >= 24:
                sonuc[m.group(1)] = {y: sayi(n[i * 3]) for i, y in enumerate(YASLAR)}
    return sonuc


def kitaplar(klasor: Path):
    veri = {}
    def yil_adi(p):
        m = re.findall(r"20\d\d_20\d\d", p.name)
        if m:
            return m[0]
        m = re.fullmatch(r"(\d\d)(\d\d)\.pdf", p.name)  # sgb.meb.gov.tr adı: 2425.pdf = 2024/25
        return f"20{m.group(1)}_20{m.group(2)}" if m else None
    pdfler = [p for p in klasor.glob("*.pdf") if yil_adi(p) and ("orgun_egitim" in p.name or re.fullmatch(r"\d{4}\.pdf", p.name))]
    for pdf in sorted(pdfler, key=yil_adi):
        metin = subprocess.run(["pdftotext", "-layout", "-f", "15", "-l", "60", str(pdf), "-"],
                               capture_output=True, text=True).stdout
        if not re.search(r"TR100\s+\S+\s+[\d,.\s-]*\d+,\d+", metin):
            # Yazı tipi kodlaması bozuk kitaplar (2024/25): karakterler (cid:N) olarak gelir, N+29 ile çözülür
            from cidmetin import sayfa_metni
            import pdfplumber
            with pdfplumber.open(pdf) as d:
                metin = "\f".join(sayfa_metni(d.pages[i]) for i in range(14, min(60, len(d.pages))))
        gruplar = {}
        for p in metin.split("\f"):
            bas = "\n".join(p.split("\n")[:8])
            y = yil(p)
            if not y or "düzeltilmiş" in bas:
                continue
            if re.search(r"düzey ve eğitim seviyesine göre okullaşma oran", bas):
                gruplar.setdefault((y, "oo"), []).append(p)
            elif re.search(r"3\. düzey yaş gruplarına göre net okullaşma", bas):
                gruplar.setdefault((y, "yas"), []).append(p)
        for (y, tur), sayfalar in gruplar.items():
            d = okul_oncesi(sayfalar) if tur == "oo" else yasa_gore(sayfalar)
            if d:
                veri.setdefault(y, {})[tur] = d  # sonraki kitap üzerine yazar
        print(f"{pdf.name}: {sorted(gruplar)}")
    return veri


def main(klasor):
    veri = kitaplar(Path(klasor))
    j = json.loads((Path(__file__).with_name("meb-2024-25.json")).read_text(encoding="utf-8"))
    # 2024/25 kitabında yaşa göre tablo (1.3.a) satır düzeni yüzünden okunamıyor; tarayıcıda okunan değerler
    if 2024 in veri and "yas" not in veri[2024]:
        veri[2024]["yas"] = j["yas"]
    # Karşılaştırma: kitaptan okunan 2024/25 il değerleri ile tarayıcıda okunanlar aynı olmalı
    if 2024 in veri:
        fark = [k for k, v in j["oo"].items()
                if abs(veri[2024]["oo"].get(k, {}).get("3-5", {}).get("n", -1) - v["n35"]) > 0.005
                or abs(veri[2024]["oo"].get(k, {}).get("5", {}).get("b", -1) - v["b5"]) > 0.005]
        print("2024/25 kitap–tarayıcı farkı:", fark or "yok")
    # Kitabı elde olmayan yıllar (2022/23) için Türkiye değeri 2024/25 kitabının Tablo 1.1.b'sinden
    for y, d in j.get("turkiye_ek", {}).items():
        veri.setdefault(int(y), {}).setdefault("oo", {}).setdefault("TR", d)
    satirlar = []
    for y in sorted(veri):
        for kod, d in sorted(veri[y].get("oo", {}).items()):
            for yas, v in d.items():
                if "n" in v:
                    satirlar.append([kod, f"Okul Öncesi Net Okullaşma Oranı ({yas} Yaş) (%)", KAT, y, v["n"], KAYNAK])
                if "b" in v:
                    satirlar.append([kod, f"Okul Öncesi Brüt Okullaşma Oranı ({yas} Yaş) (%)", KAT, y, v["b"], KAYNAK])
        for kod, d in sorted(veri[y].get("yas", {}).items()):
            for yas, v in d.items():
                satirlar.append([kod, f"Yaşa Göre Net Okullaşma Oranı: {yas} Yaş (%)", KAT, y, v, KAYNAK])
    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        w.writerows(satirlar)
    for y in sorted(veri):
        print(y, {t: len(v) for t, v in veri[y].items()})
    print(f"{CIKTI.name}: {len(satirlar)} değer")


sys.path.insert(0, str(Path(__file__).parent))

if __name__ == "__main__":
    main(sys.argv[1])
