"""
veri_masasi.py — veritabanını Excel üzerinden güncellemek için kontrol ve uygulama aracı.

Çalışma kitabı: veri-masasi/veri-girisi.xlsx

    Yeni Değerler   tek tek değer girişi (birim, gösterge, yıl, değer, kaynak)
    TÜİK Tablosu    TÜİK'ten indirilen il × yıl tablosunu yapıştırma alanı (tek gösterge)
    Düzeltmeler     mevcut bir değeri gerekçesiyle düzeltme ya da silme
    Göstergeler     veritabanındaki göstergelerin listesi (salt okunur, seçim kutularını besler)
    Birimler        kodlar ve adlar (salt okunur)

Komutlar (komutsuz çalıştırılırsa menü açılır):

    python veri-masasi/veri_masasi.py sablon     çalışma kitabını oluşturur; varsa yalnızca başvuru sayfalarını yeniler
    python veri-masasi/veri_masasi.py kontrol    girişleri denetler, veritabanıyla karşılaştırır, rapor yazar
    python veri-masasi/veri_masasi.py uygula     kontrolden geçen girişleri veri-ekleri'ne yazar, veri hattını çalıştırır
    python veri-masasi/veri_masasi.py gecmis     değişiklik geçmişi raporu
    python veri-masasi/veri_masasi.py kaynak "Toplam Nüfus"   bir göstergenin değerlerinin hangi dosyalardan geldiği

Yazdığı dosyalar:

    veri-ekleri/elle-giris.csv               yeni ve revize değerler (şablon biçimi; diğer eklerden sonra okunur, onları ezer)
    veri-ekleri/duzeltmeler/degerler.csv     düzeltme ve silmeler (pipeline/temizlik.py uygular)
    veri-masasi/degisiklik-gecmisi.csv       her uygulanan değişikliğin kaydı (eski değer, yeni değer, kaynak, gerekçe)
    veri-masasi/raporlar/*.html              kontrol, uygulama ve geçmiş raporları

Gereken paket: openpyxl  (yoksa:  python -m pip install openpyxl)
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import difflib
import html
import re
import shutil
import sqlite3
import subprocess
import sys
import webbrowser
from collections import defaultdict
from pathlib import Path

try:
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.utils import get_column_letter
    from openpyxl.workbook.defined_name import DefinedName
    from openpyxl.worksheet.datavalidation import DataValidation
except ImportError:  # pragma: no cover
    sys.exit("openpyxl paketi gerekli. Kurmak için:  python -m pip install openpyxl")

BU = Path(__file__).resolve().parent
KOK = BU.parent
KITAP_ADI = "veri-girisi.xlsx"
ELLE = "elle-giris.csv"
GECMIS_ALANLAR = ["tarih", "islem", "kod", "birim", "gosterge", "yil", "eski", "yeni", "eski_kaynak", "yeni_kaynak",
                  "kaynak_ayrintisi", "gerekce"]
SAYFA_YENI, SAYFA_TUIK, SAYFA_DUZ, SAYFA_GOS, SAYFA_BIR, SAYFA_BILGI = (
    "Yeni Değerler", "TÜİK Tablosu", "Düzeltmeler", "Göstergeler", "Birimler", "Nasıl Kullanılır")
DUZEY_AD = {"country": "Türkiye", "region12": "Düzey 1", "region26": "Düzey 2", "province": "İl", "district": "İlçe",
            "fua": "Kent (OECD)"}

# Uyarı eşikleri
SICRAMA = 0.5        # önceki yıla göre ±%50'den büyük değişim
KAYMA = 50           # eski/yeni oranı 50 katı aşıyorsa ondalık kayması şüphesi
TOPLAM_TOL = 0.02    # il toplamı ile Türkiye arasında kabul edilen fark


# --------------------------------------------------------------------------- yardımcılar
def yollar(kok: Path):
    return {
        "db": kok / "build" / "veri.db",
        "ekler": kok / "veri-ekleri",
        "elle": kok / "veri-ekleri" / ELLE,
        "duz": kok / "veri-ekleri" / "duzeltmeler" / "degerler.csv",
        "kitap": kok / "veri-masasi" / KITAP_ADI,
        "gecmis": kok / "veri-masasi" / "degisiklik-gecmisi.csv",
        "rapor": kok / "veri-masasi" / "raporlar",
        "web": kok / "public" / "veri",
        "dist": kok / "dist" / "veri",
    }


def sade(s) -> str:
    s = str(s or "").strip().replace("İ", "i").replace("I", "ı").lower()
    for a, b in zip("çğıöşüâîû", "cgiosuaiu"):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def sayi(x):
    """Excel hücresi ya da metin → float. Binlik ayırıcıyı reddeder."""
    if x is None or (isinstance(x, str) and not x.strip()):
        return None
    if isinstance(x, bool):
        raise ValueError("sayı değil")
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().replace("\xa0", "").replace(" ", "")
    if s in {"-", "..", "...", "–"}:
        return None
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+(,\d+)?", s):
        raise ValueError("binlik ayırıcı kullanılmış (ör. 1.234.567); ayırıcısız yazın")
    try:
        return float(s.replace(",", "."))
    except ValueError:
        raise ValueError("sayıya çevrilemedi") from None


def yaz_sayi(v) -> str:
    if v is None:
        return ""
    v = float(v)
    if v.is_integer() and abs(v) < 1e15:
        return str(int(v))
    return f"{v:.10g}".replace(".", ",")


def goster(v) -> str:
    if v is None:
        return "—"
    v = float(v)
    if v.is_integer():
        return f"{v:,.0f}".replace(",", ".")
    s = f"{v:,.4f}".rstrip("0").rstrip(".")
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def simdi() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d %H:%M")


# --------------------------------------------------------------------------- veritabanı
class Veri:
    def __init__(self, db: Path):
        if not db.exists():
            sys.exit(f"Veritabanı bulunamadı: {db}\nÖnce veri hattını çalıştırın (veri-olustur.bat ya da python pipeline/build_data.py).")
        self.con = sqlite3.connect(db)
        self.birim = {}      # kod -> (ad, düzey)
        self.ad_kod = {}     # sade ad -> [kod]
        for kod, ad, duzey, ust in self.con.execute("SELECT geo, name, level, parent FROM entities"):
            self.birim[kod] = (ad, duzey)
            if duzey == "district" and ust:
                ust_ad = self.con.execute("SELECT name FROM entities WHERE geo=?", (ust,)).fetchone()
                anahtar = f"{sade(ust_ad[0]) if ust_ad else ''} {sade(ad)}".strip()
            else:
                anahtar = sade(ad)
            self.ad_kod.setdefault(anahtar, []).append(kod)
        for eski, yeni in {"afyon": "afyonkarahisar", "maras": "kahramanmaras", "urfa": "sanliurfa", "icel": "mersin",
                           "turkiye": "turkiye"}.items():
            if yeni in self.ad_kod and eski not in self.ad_kod:
                self.ad_kod[eski] = self.ad_kod[yeni]
        self.gosterge = {}   # ad -> dict
        for ad, kat, birim, kaynak in self.con.execute("SELECT indicator, category, unit, source FROM indicators"):
            self.gosterge[ad] = {"kategori": kat, "birim": birim, "kaynak": kaynak}
        self._sade_gos = {sade(a): a for a in self.gosterge}

    def kod_bul(self, giris):
        """Kod ya da ad → (kod, hata)."""
        s = str(giris or "").strip()
        if not s:
            return None, "birim boş"
        if s.upper() in self.birim:
            return s.upper(), None
        if s in self.birim:
            return s, None
        if re.fullmatch(r"\d{1,2}", s):  # plaka
            r = self.con.execute("SELECT geo FROM entities WHERE level='province' AND plate=?", (int(s),)).fetchone()
            if r:
                return r[0], None
        aday = self.ad_kod.get(sade(s), [])
        il = [k for k in aday if self.birim[k][1] == "province"]
        if len(il) == 1:
            return il[0], None
        if len(aday) == 1:
            return aday[0], None
        if len(aday) > 1:
            return None, f"'{s}' birden fazla birime uyuyor ({', '.join(aday[:4])}); kod yazın"
        return None, f"'{s}' tanınmadı; İBBS kodu (TR100), plaka ya da il adı yazın"

    def gosterge_bul(self, ad):
        s = str(ad or "").strip()
        if not s:
            return None, "gösterge boş"
        if s in self.gosterge:
            return s, None
        k = sade(s)
        if k in self._sade_gos:
            return self._sade_gos[k], None
        kaynaksiz = re.sub(r"\s*\((TÜİK|OECD|BDDK|BTK|MEB|EPDK|Platform)\)\s*$", "", s)
        if kaynaksiz in self.gosterge:
            return kaynaksiz, None
        oneri = difflib.get_close_matches(s, list(self.gosterge), n=3, cutoff=0.6)
        return None, "gösterge bulunamadı" + (f"; şunlardan biri mi: {' | '.join(oneri)}" if oneri else
                                              "; Göstergeler sayfasındaki adı aynen kullanın")

    def deger(self, kod, gosterge, yil):
        """Mevcut değer ve kaynak dosyası (birden çok kaynak varsa en son okunan geçerli: tek satır tutulur)."""
        r = self.con.execute("SELECT value, source_file FROM values_long WHERE geo=? AND indicator=? AND time=?",
                             (kod, gosterge, str(yil))).fetchone()
        return (r[0], r[1]) if r else (None, None)

    def seri(self, kod, gosterge):
        return {int(t): v for t, v in self.con.execute(
            "SELECT time, value FROM values_long WHERE geo=? AND indicator=? AND value IS NOT NULL", (kod, gosterge))
            if str(t).isdigit()}

    def toplanabilir(self, gosterge):
        """Son ortak yılda 81 il toplamı Türkiye'ye ±%2 içinde eşitse True."""
        r = self.con.execute(
            """SELECT v.time, SUM(CASE WHEN e.level='province' THEN v.value END), COUNT(CASE WHEN e.level='province' THEN 1 END),
                      MAX(CASE WHEN v.geo='TR' THEN v.value END)
               FROM values_long v JOIN entities e ON e.geo=v.geo WHERE v.indicator=? GROUP BY v.time
               HAVING COUNT(CASE WHEN e.level='province' THEN 1 END)=81 AND MAX(CASE WHEN v.geo='TR' THEN v.value END) IS NOT NULL
               ORDER BY v.time DESC LIMIT 1""", (gosterge,)).fetchone()
        return bool(r and r[3] and abs(r[1] - r[3]) <= TOPLAM_TOL * abs(r[3]))

    def iller(self, gosterge, yil):
        return dict(self.con.execute(
            """SELECT v.geo, v.value FROM values_long v JOIN entities e ON e.geo=v.geo
               WHERE v.indicator=? AND v.time=? AND e.level='province'""", (gosterge, str(yil))))


# --------------------------------------------------------------------------- çalışma kitabı
BASLIK_DOLGU = PatternFill("solid", fgColor="EBEAE2")
BILGI_DOLGU = PatternFill("solid", fgColor="FFFDF6")
KALIN = Font(bold=True)


def _baslik(ws, basliklar, genislik):
    for i, (b, g) in enumerate(zip(basliklar, genislik), 1):
        c = ws.cell(row=1, column=i, value=b)
        c.font, c.fill = KALIN, BASLIK_DOLGU
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(i)].width = g
    ws.freeze_panes = "A2"
    ws.row_dimensions[1].height = 30


def _basvuru_sayfalari(wb, v: Veri):
    for ad in (SAYFA_GOS, SAYFA_BIR):
        if ad in wb.sheetnames:
            del wb[ad]
    ws = wb.create_sheet(SAYFA_GOS)
    _baslik(ws, ["Gösterge", "Kategori", "Birim", "Düzeyler", "İlk yıl", "Son yıl", "Ana kaynak dosyası"],
            [70, 24, 12, 26, 8, 8, 28])
    # iki gruplu sorgu: süre ve kaynak dosyası; düzey kod uzunluğundan
    ozet = defaultdict(lambda: {"duz": set(), "ilk": None, "son": None, "kaynak": {}})
    for ind, ilk, son, dosya, n in v.con.execute(
            "SELECT indicator, MIN(time), MAX(time), source_file, COUNT(*) FROM values_long GROUP BY indicator, source_file"):
        o = ozet[ind]
        o["kaynak"][dosya] = n
        o["ilk"] = ilk if o["ilk"] is None else min(o["ilk"], ilk)
        o["son"] = son if o["son"] is None else max(o["son"], son)
    for ind, d in v.con.execute(
            """SELECT DISTINCT indicator, CASE WHEN geo LIKE 'ILCE%' THEN 'district' WHEN geo='TR' THEN 'country'
               WHEN length(geo)=3 THEN 'region12' WHEN length(geo)=4 THEN 'region26' WHEN length(geo)=5 THEN 'province'
               ELSE 'fua' END FROM values_long"""):
        ozet[ind]["duz"].add(d)
    sira_d = list(DUZEY_AD)
    for ad, kat, birim in v.con.execute("SELECT indicator, category, unit FROM indicators ORDER BY category, indicator"):
        o = ozet.get(ad)
        if not o:
            continue
        duz = ", ".join(DUZEY_AD.get(x, x) for x in sorted(o["duz"], key=lambda d: sira_d.index(d) if d in sira_d else 9))
        ana = max(o["kaynak"].items(), key=lambda x: x[1])[0] if o["kaynak"] else ""
        ws.append([ad, kat, birim, duz, o["ilk"], o["son"], ana])
    ws.auto_filter.ref = f"A1:G{ws.max_row}"
    son = ws.max_row
    ws2 = wb.create_sheet(SAYFA_BIR)
    _baslik(ws2, ["Kod", "Ad", "Düzey"], [12, 34, 14])
    sira = {"country": 0, "region12": 1, "region26": 2, "province": 3, "fua": 4, "district": 5}
    for kod, (ad, duz) in sorted(v.birim.items(), key=lambda x: (sira.get(x[1][1], 9), x[0])):
        if duz == "district":
            continue  # ilçeler kod ile girilir; liste çok uzun
        ws2.append([kod, ad, DUZEY_AD.get(duz, duz)])
    ws2.auto_filter.ref = f"A1:C{ws2.max_row}"
    if "GostergeListesi" in wb.defined_names:
        del wb.defined_names["GostergeListesi"]
    wb.defined_names["GostergeListesi"] = DefinedName("GostergeListesi", attr_text=f"'{SAYFA_GOS}'!$A$2:$A${son}")
    return son


def _dogrulama(ws, aralik):
    dv = DataValidation(type="list", formula1="=GostergeListesi", allow_blank=True, showErrorMessage=False)
    dv.prompt, dv.promptTitle = "Listeden seçin ya da Göstergeler sayfasındaki adı aynen yazın.", "Gösterge"
    ws.add_data_validation(dv)
    dv.add(aralik)


def sablon(kok: Path, sessiz=False):
    y = yollar(kok)
    v = Veri(y["db"])
    y["kitap"].parent.mkdir(parents=True, exist_ok=True)
    if y["kitap"].exists():
        wb = openpyxl.load_workbook(y["kitap"])
        _basvuru_sayfalari(wb, v)
        wb.save(y["kitap"])
        if not sessiz:
            print(f"Başvuru sayfaları güncellendi: {y['kitap']} ({len(v.gosterge)} gösterge)")
        return y["kitap"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = SAYFA_BILGI
    ws.column_dimensions["A"].width = 110
    metin = [
        ("Veri Girişi Çalışma Kitabı", True),
        ("", False),
        ("1. Değerleri girin:", True),
        ("   • Yeni Değerler: tek tek değer (yeni yıl, eksik değer ya da kaynağın revize ettiği değer).", False),
        ("   • TÜİK Tablosu: TÜİK'ten indirdiğiniz il × yıl tablosunu yapıştırın; üstte göstergeyi seçin.", False),
        ("   • Düzeltmeler: mevcut bir değerin hatalı olduğu durumlar. Gerekçe zorunludur; 'Yeni değer' boşsa değer silinir.", False),
        ("2. Kontrol edin:  python veri-masasi/veri_masasi.py kontrol", True),
        ("   Rapor tarayıcıda açılır; her satırın sonucu 'Durum' sütununa yazılır. Hatalı satırlar uygulanmaz.", False),
        ("3. Uygulayın:  python veri-masasi/veri_masasi.py uygula", True),
        ("   Onayınızdan sonra değerler veri-ekleri'ne yazılır, veri hattı çalışır, site verisi yeniden üretilir.", False),
        ("   Uygulanan satırların Durum sütununa 'Uygulandı' yazılır; bir sonraki çalıştırmada atlanır.", False),
        ("", False),
        ("Kurallar", True),
        ("   • Birim: İBBS kodu (TR, TR1, TR10, TR100), il adı (Adana) ya da plaka (1). İlçe için ILCE kodu.", False),
        ("   • Gösterge: Göstergeler sayfasındaki adı aynen kullanın (seçim kutusu). Yeni gösterge bu kitapla açılmaz.", False),
        ("   • Değer: ondalık ayırıcı virgül ya da nokta; binlik ayırıcı kullanmayın. Oranları yüzde olarak girin (12,5).", False),
        ("   • Kaynak: kurum adı (TÜİK). Kaynak ayrıntısı: tablo adı, bülten tarihi ya da bağlantı.", False),
        ("   • Bu kitapla yapılan girişler diğer bütün kaynakların önüne geçer.", False),
        ("", False),
        ("Başvuru sayfalarını güncellemek için:  python veri-masasi/veri_masasi.py sablon", False),
    ]
    for i, (t, k) in enumerate(metin, 1):
        c = ws.cell(row=i, column=1, value=t)
        if k:
            c.font = Font(bold=True, size=13 if i == 1 else 11)

    ws = wb.create_sheet(SAYFA_YENI)
    _baslik(ws, ["Birim (kod ya da ad)", "Gösterge", "Yıl", "Değer", "Kaynak", "Kaynak ayrıntısı", "Not", "Durum"],
            [20, 60, 8, 14, 14, 36, 24, 50])
    _dogrulama(ws, "B2:B5000")

    ws = wb.create_sheet(SAYFA_TUIK)
    ws.column_dimensions["A"].width = 24
    for c in range(2, 30):
        ws.column_dimensions[get_column_letter(c)].width = 12
    for r, (etiket, aciklama) in enumerate([("Gösterge", "seçin"), ("Kaynak", "ör. TÜİK"),
                                            ("Kaynak ayrıntısı", "tablo adı, bülten tarihi ya da bağlantı"),
                                            ("Durum", "kontrol sonucunu araç yazar")], 1):
        ws.cell(row=r, column=1, value=etiket).font = KALIN
        ws.cell(row=r, column=1).fill = BASLIK_DOLGU
        ws.cell(row=r, column=8, value=aciklama).font = Font(italic=True, color="8C8C8C")
    ws.merge_cells("B1:G1")
    ws.merge_cells("B3:G3")
    ws.merge_cells("B4:G4")
    _dogrulama(ws, "B1")
    ws.cell(row=6, column=1, value="Birim").font = KALIN
    ws.cell(row=6, column=1).fill = BILGI_DOLGU
    ws.cell(row=6, column=2, value="2024").fill = BILGI_DOLGU
    ws.cell(row=6, column=3, value="2025").fill = BILGI_DOLGU
    ws.cell(row=5, column=1, value="Tabloyu A6 hücresinden başlayarak yapıştırın: ilk sütunda birimler, ilk satırda yıllar "
                                   "(ya da tersi: ilk sütunda yıllar, ilk satırda birimler).").font = Font(italic=True, color="5F5F5F")

    ws = wb.create_sheet(SAYFA_DUZ)
    _baslik(ws, ["Birim (kod ya da ad)", "Gösterge", "Yıl", "Yeni değer (boş = sil)", "Gerekçe (zorunlu)",
                 "Kaynak ayrıntısı", "Durum"], [20, 60, 8, 16, 50, 36, 50])
    _dogrulama(ws, "B2:B5000")

    _basvuru_sayfalari(wb, v)
    wb.active = 1
    wb.save(y["kitap"])
    if not sessiz:
        print(f"Çalışma kitabı oluşturuldu: {y['kitap']} ({len(v.gosterge)} gösterge)")
    return y["kitap"]


# --------------------------------------------------------------------------- okuma
def _uygulandi(d):
    return str(d or "").startswith("Uygulandı")


def girisleri_oku(wb, v: Veri):
    """→ liste: {tur, sayfa, satir, kod, birim, gosterge, yil, deger, kaynak, ayrinti, gerekce, not, hata[], uyari[]}"""
    girisler = []

    def yeni_kayit(tur, sayfa, satir):
        return {"tur": tur, "sayfa": sayfa, "satir": satir, "hata": [], "uyari": [], "kod": None, "gosterge": None,
                "yil": None, "deger": None, "kaynak": "", "ayrinti": "", "gerekce": "", "not": ""}

    def ortak(k, birim_g, gos_g, yil_g):
        k["birim_girdi"] = birim_g
        k["kod"], h = v.kod_bul(birim_g)
        if h:
            k["hata"].append(h)
        k["gosterge_girdi"] = gos_g
        k["gosterge"], h = v.gosterge_bul(gos_g)
        if h:
            k["hata"].append(h)
        try:
            yil = int(float(str(yil_g).strip()))
            if not 1900 <= yil <= dt.date.today().year + 1:
                raise ValueError
            k["yil"] = yil
        except (TypeError, ValueError):
            k["hata"].append(f"yıl geçersiz: {yil_g!r}")

    if SAYFA_YENI in wb.sheetnames:
        ws = wb[SAYFA_YENI]
        for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            r = list(r) + [None] * 8
            if all(x in (None, "") for x in r[:7]) or _uygulandi(r[7]):
                continue
            k = yeni_kayit("yeni", SAYFA_YENI, i)
            ortak(k, r[0], r[1], r[2])
            try:
                k["deger"] = sayi(r[3])
                if k["deger"] is None:
                    k["hata"].append("değer boş (silmek için Düzeltmeler sayfasını kullanın)")
            except ValueError as e:
                k["hata"].append(f"değer: {e}")
            k["kaynak"], k["ayrinti"], k["not"] = (str(x or "").strip() for x in r[4:7])
            girisler.append(k)

    if SAYFA_TUIK in wb.sheetnames:
        ws = wb[SAYFA_TUIK]
        gos, kaynak, ayrinti, durum = (ws.cell(row=n, column=2).value for n in (1, 2, 3, 4))
        if gos and not _uygulandi(durum):
            tablo = [list(r) for r in ws.iter_rows(min_row=6, values_only=True)]
            tablo = [r for r in tablo if any(x not in (None, "") for x in r)]
            if tablo:
                bas = tablo[0][1:]
                yil_mi = lambda x: bool(re.fullmatch(r"\s*(19|20)\d{2}\s*", str(x or "")) or
                                        (isinstance(x, (int, float)) and 1900 <= x <= 2100))
                yillar_ustte = sum(yil_mi(x) for x in bas if x not in (None, "")) >= max(1, len([x for x in bas if x not in (None, "")]) // 2)
                for ri, r in enumerate(tablo[1:], 7):
                    for ci, hucre in enumerate(r[1:]):
                        if ci >= len(bas) or bas[ci] in (None, "") or hucre in (None, ""):
                            continue
                        birim_g, yil_g = (r[0], bas[ci]) if yillar_ustte else (bas[ci], r[0])
                        if r[0] in (None, ""):
                            continue
                        k = yeni_kayit("tuik", SAYFA_TUIK, ri)
                        k["hucre"] = f"{get_column_letter(ci + 2)}{ri}"
                        ortak(k, birim_g, gos, yil_g)
                        try:
                            k["deger"] = sayi(hucre)
                        except ValueError as e:
                            k["hata"].append(f"değer: {e}")
                        if k["deger"] is None and not k["hata"]:
                            continue
                        k["kaynak"], k["ayrinti"] = str(kaynak or "").strip(), str(ayrinti or "").strip()
                        girisler.append(k)

    if SAYFA_DUZ in wb.sheetnames:
        ws = wb[SAYFA_DUZ]
        for i, r in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            r = list(r) + [None] * 7
            if all(x in (None, "") for x in r[:6]) or _uygulandi(r[6]):
                continue
            k = yeni_kayit("duzeltme", SAYFA_DUZ, i)
            ortak(k, r[0], r[1], r[2])
            try:
                k["deger"] = sayi(r[3])
            except ValueError as e:
                k["hata"].append(f"yeni değer: {e}")
            k["gerekce"], k["ayrinti"] = str(r[4] or "").strip(), str(r[5] or "").strip()
            if not k["gerekce"]:
                k["hata"].append("gerekçe zorunlu")
            girisler.append(k)
    return girisler


# --------------------------------------------------------------------------- denetim
def denetle(girisler, v: Veri):
    # aynı birim-gösterge-yıl iki kez girilmiş mi
    gorulen = {}
    for k in girisler:
        if k["hata"]:
            continue
        anahtar = (k["kod"], k["gosterge"], k["yil"])
        if anahtar in gorulen:
            onceki = gorulen[anahtar]
            k["hata"].append(f"aynı değer {onceki['sayfa']} satır {onceki['satir']} ile çakışıyor")
        gorulen[anahtar] = k

    yeni_yillar = defaultdict(dict)   # (gösterge, yıl) -> {kod: değer} toplam kontrolü için
    for k in girisler:
        if k["hata"]:
            continue
        eski, kaynak = v.deger(k["kod"], k["gosterge"], k["yil"])
        k["eski"], k["eski_kaynak"] = eski, kaynak
        g = v.gosterge[k["gosterge"]]
        ad_kucuk = k["gosterge"].lower()
        yeni = k["deger"]
        if k["tur"] == "duzeltme":
            if eski is None:
                k["hata"].append("veritabanında bu değer yok; eklemek için Yeni Değerler sayfasını kullanın")
                continue
            k["islem"] = "silme" if yeni is None else ("ayni" if abs(eski - yeni) < 1e-9 else "duzeltme")
        else:
            k["islem"] = "ekleme" if eski is None else ("ayni" if abs(eski - yeni) < 1e-9 else "revizyon")
        if k["islem"] == "ayni":
            k["uyari"].append("değer veritabanındakiyle aynı; uygulanmayacak")
            continue
        if yeni is None:
            continue
        # birim ve aralık kontrolleri
        if "(%)" in k["gosterge"] or "oranı" in ad_kucuk:
            if yeni < 0 and "değişim" not in ad_kucuk and "artış" not in ad_kucuk and "göç" not in ad_kucuk:
                k["uyari"].append("oran negatif")
            if 0 < abs(yeni) <= 1 and "(%)" in k["gosterge"]:
                seri = v.seri(k["kod"], k["gosterge"])
                if seri and min(abs(x) for x in seri.values()) > 1:
                    k["uyari"].append("değer 1'den küçük; oran olarak girilmiş olabilir (yüzde bekleniyor)")
            if yeni > 100 and "(%)" in k["gosterge"] and not re.search(r"değişim|artış|karşılama|endeks", ad_kucuk):
                k["uyari"].append("yüzde değeri 100'ü aşıyor")
        elif yeni < 0 and re.search(r"sayısı|nüfus|\(adet\)|\(kişi\)|\(ton\)|\(km\)", ad_kucuk):
            k["uyari"].append("sayı göstergesinde negatif değer")
        if eski not in (None, 0) and yeni not in (None, 0):
            oran = abs(yeni / eski)
            if oran >= KAYMA or oran <= 1 / KAYMA:
                k["uyari"].append(f"eski değerin {goster(oran)} katı: ondalık kayması olabilir")
        seri = v.seri(k["kod"], k["gosterge"])
        onceki_yil = max((y for y in seri if y < k["yil"]), default=None)
        if onceki_yil is not None and seri[onceki_yil] not in (0, None):
            deg = yeni / seri[onceki_yil] - 1
            k["onceki"] = (onceki_yil, seri[onceki_yil])
            if abs(deg) > SICRAMA and not re.search(r"değişim|artış|büyüme|göç|fark", ad_kucuk):
                k["uyari"].append(f"{onceki_yil} yılına göre %{goster(round(deg * 100, 1))} değişim")
        if k["kod"].startswith("TR") and len(k["kod"]) == 5:
            yeni_yillar[(k["gosterge"], k["yil"])][k["kod"]] = yeni
        if g["kategori"] is None:
            k["uyari"].append("göstergenin kategorisi yok")

    # il toplamı ↔ Türkiye
    for (gos, yil), iller in yeni_yillar.items():
        if not v.toplanabilir(gos):
            continue
        hepsi = v.iller(gos, yil)
        hepsi.update(iller)
        if len(hepsi) < 81:
            continue
        tr = next((k["deger"] for k in girisler if k.get("kod") == "TR" and k.get("gosterge") == gos
                   and k.get("yil") == yil and not k["hata"]), None)
        if tr is None:
            tr = v.deger("TR", gos, yil)[0]
        if tr:
            toplam = sum(hepsi.values())
            if abs(toplam - tr) > TOPLAM_TOL * abs(tr):
                for k in girisler:
                    if k.get("gosterge") == gos and k.get("yil") == yil and not k["hata"]:
                        k["uyari"].append(f"81 il toplamı ({goster(toplam)}) Türkiye değerinden (%{goster(round((toplam / tr - 1) * 100, 1))}) farklı")
                        break
    return girisler


# --------------------------------------------------------------------------- rapor
CSS = """body{font-family:'Segoe UI',system-ui,sans-serif;margin:24px auto;max-width:1200px;padding:0 16px;color:#2f2f2f;background:#f9f9f3}
h1{font-size:24px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p.alt{color:#5f5f5f;margin:0 0 16px}
.ozet{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.ozet div{background:#fff;border:1px solid #e3e3e0;padding:10px 14px;min-width:120px}
.ozet b{display:block;font-size:22px}.ozet span{font-size:12px;color:#5f5f5f;text-transform:uppercase;letter-spacing:.04em}
table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}th,td{border:1px solid #e3e3e0;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#ebeae2;position:sticky;top:0}td.s{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.hata{color:#b42318}.uyari{color:#8a5a0e}.tamam{color:#2e6e9e}tr.h td{background:#fdf2f1}tr.u td{background:#fdf8ec}
.not{font-size:12px;color:#5f5f5f}"""


def _islem_ad(k):
    return {"ekleme": "Yeni değer", "revizyon": "Revizyon", "duzeltme": "Düzeltme", "silme": "Silme",
            "ayni": "Değişiklik yok"}.get(k.get("islem"), "—")


def rapor_yaz(girisler, v: Veri, hedef: Path, baslik: str, ek_html: str = ""):
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hata = [k for k in girisler if k["hata"]]
    uygun = [k for k in girisler if not k["hata"] and k.get("islem") != "ayni"]
    uyari = [k for k in uygun if k["uyari"]]
    say = defaultdict(int)
    for k in uygun:
        say[k["islem"]] += 1
    e = html.escape

    def satir(k):
        birim = v.birim.get(k["kod"], ("", ""))[0] if k.get("kod") else ""
        durum = ("; ".join(k["hata"]) if k["hata"] else "; ".join(k["uyari"]) if k["uyari"] else "uygun")
        sinif = "h" if k["hata"] else "u" if k["uyari"] else ""
        yer = f"{k['sayfa']} {k.get('hucre') or k['satir']}"
        degisim = ""
        if k.get("eski") not in (None, 0) and k.get("deger") is not None:
            degisim = f"%{goster(round((k['deger'] / k['eski'] - 1) * 100, 2))}"
        return (f"<tr class='{sinif}'><td>{e(yer)}</td><td>{e(_islem_ad(k))}</td><td>{e(k.get('kod') or str(k.get('birim_girdi') or ''))}"
                f"<br><span class='not'>{e(birim)}</span></td><td>{e(k.get('gosterge') or str(k.get('gosterge_girdi') or ''))}</td><td>{k.get('yil') or ''}</td>"
                f"<td class='s'>{goster(k.get('eski'))}<br><span class='not'>{e(k.get('eski_kaynak') or '')}</span></td>"
                f"<td class='s'>{goster(k.get('deger'))}</td><td class='s'>{degisim}</td>"
                f"<td>{e(k.get('kaynak') or '')}<br><span class='not'>{e(k.get('ayrinti') or k.get('gerekce') or '')}</span></td>"
                f"<td class='{'hata' if k['hata'] else 'uyari' if k['uyari'] else 'tamam'}'>{e(durum)}</td></tr>")

    tablo_bas = ("<table><tr><th>Satır</th><th>İşlem</th><th>Birim</th><th>Gösterge</th><th>Yıl</th><th>Mevcut değer<br>"
                 "<span class='not'>kaynak dosyası</span></th><th>Yeni değer</th><th>Fark</th><th>Kaynak</th><th>Durum</th></tr>")
    bolumler = []
    if hata:
        bolumler.append(f"<h2 class='hata'>Hatalı satırlar ({len(hata)}) — uygulanmaz</h2>{tablo_bas}{''.join(map(satir, hata))}</table>")
    if uyari:
        bolumler.append(f"<h2 class='uyari'>Uyarılı satırlar ({len(uyari)}) — gözden geçirin</h2>{tablo_bas}{''.join(map(satir, uyari))}</table>")
    temiz = [k for k in uygun if not k["uyari"]]
    if temiz:
        bolumler.append(f"<h2>Uygun satırlar ({len(temiz)})</h2>{tablo_bas}{''.join(map(satir, temiz))}</table>")
    ayni = [k for k in girisler if k.get("islem") == "ayni" and not k["hata"]]
    if ayni:
        bolumler.append(f"<p class='not'>Veritabanındakiyle aynı olduğu için uygulanmayacak satır: {len(ayni)}</p>")
    kutular = "".join(f"<div><b>{n}</b><span>{ad}</span></div>" for ad, n in [
        ("Yeni değer", say["ekleme"]), ("Revizyon", say["revizyon"]), ("Düzeltme", say["duzeltme"]),
        ("Silme", say["silme"]), ("Uyarı", len(uyari)), ("Hata", len(hata))])
    hedef.write_text(
        f"<!doctype html><html lang='tr'><head><meta charset='utf-8'><title>{e(baslik)}</title><style>{CSS}</style></head>"
        f"<body><h1>{e(baslik)}</h1><p class='alt'>{simdi()} · çalışma kitabı: {e(KITAP_ADI)}</p>"
        f"<div class='ozet'>{kutular}</div>{ek_html}{''.join(bolumler) or '<p>İşlenecek satır yok.</p>'}</body></html>",
        encoding="utf-8")
    return len(hata), len(uygun)


def durum_yaz(wb, girisler):
    """Kontrol sonucunu Durum sütunlarına yazar."""
    tuik = [k for k in girisler if k["tur"] == "tuik"]
    for k in girisler:
        if k["tur"] == "tuik":
            continue
        ws = wb[k["sayfa"]]
        sutun = 8 if k["tur"] == "yeni" else 7
        metin = ("Hata: " + "; ".join(k["hata"])) if k["hata"] else (
            "Değişiklik yok" if k.get("islem") == "ayni" else
            ("Uyarı: " + "; ".join(k["uyari"])) if k["uyari"] else f"Hazır ({_islem_ad(k).lower()})")
        ws.cell(row=k["satir"], column=sutun, value=metin)
    if tuik and SAYFA_TUIK in wb.sheetnames:
        h = sum(1 for k in tuik if k["hata"])
        u = sum(1 for k in tuik if k["uyari"] and not k["hata"])
        wb[SAYFA_TUIK].cell(row=4, column=2, value=f"{len(tuik)} değer · {h} hata · {u} uyarı (ayrıntı raporda)")


def kitap_ac(y):
    if not y["kitap"].exists():
        sys.exit(f"Çalışma kitabı yok: {y['kitap']}\nÖnce:  python veri-masasi/veri_masasi.py sablon")
    try:
        return openpyxl.load_workbook(y["kitap"])
    except PermissionError:
        sys.exit("Çalışma kitabı açık görünüyor. Excel'de kaydedip kapattıktan sonra tekrar deneyin.")


def kaydet(wb, y):
    try:
        wb.save(y["kitap"])
    except PermissionError:
        print("Uyarı: çalışma kitabı Excel'de açık olduğu için Durum sütunu yazılamadı.")


def kontrol(kok: Path, tarayici=True):
    y = yollar(kok)
    v = Veri(y["db"])
    wb = kitap_ac(y)
    girisler = denetle(girisleri_oku(wb, v), v)
    durum_yaz(wb, girisler)
    kaydet(wb, y)
    hedef = y["rapor"] / f"kontrol-{dt.datetime.now():%Y%m%d-%H%M}.html"
    nh, nu = rapor_yaz(girisler, v, hedef, "Veri Girişi Kontrol Raporu")
    print(f"{len(girisler)} satır okundu: {nu} uygulanabilir, {nh} hatalı. Rapor: {hedef}")
    if tarayici:
        webbrowser.open(hedef.as_uri())
    return girisler, v, wb, nh, nu


# --------------------------------------------------------------------------- uygulama
def _csv_oku(yol: Path, alanlar):
    if not yol.exists():
        return []
    with open(yol, encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f, delimiter=";")]


def _csv_yaz(yol: Path, alanlar, satirlar):
    yol.parent.mkdir(parents=True, exist_ok=True)
    with open(yol, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, alanlar, delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(satirlar)


def calistir(komut, kok: Path, log: Path):
    log.parent.mkdir(parents=True, exist_ok=True)
    with open(log, "w", encoding="utf-8") as f:
        return subprocess.run(komut, cwd=kok, stdout=f, stderr=subprocess.STDOUT,
                              env={**__import__("os").environ, "PYTHONUTF8": "1"}).returncode


def uygula(kok: Path, evet=False, veri_hatti=True, tarayici=True):
    y = yollar(kok)
    girisler, v, wb, nh, nu = kontrol(kok, tarayici=False)
    uygun = [k for k in girisler if not k["hata"] and k.get("islem") not in (None, "ayni")]
    if not uygun:
        print("Uygulanacak satır yok.")
        return 0
    if nh:
        print(f"{nh} hatalı satır uygulanmayacak; geri kalan {len(uygun)} satır uygulanabilir.")
    nuy = sum(1 for k in uygun if k["uyari"])
    if not evet:
        cevap = input(f"{len(uygun)} değişiklik uygulansın mı? ({nuy} uyarılı) [e/h]: ").strip().lower()
        if cevap not in {"e", "evet", "y", "yes"}:
            print("Vazgeçildi; hiçbir dosya değiştirilmedi.")
            return 1
    zaman = simdi()

    # 1) yeni ve revize değerler → elle-giris.csv (aynı anahtar varsa son giriş geçerli)
    alanlar = ["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "not"]
    eski_satirlar = _csv_oku(y["elle"], alanlar)
    mevcut = {(r["kod"], r["gosterge"], r["yil"]): r for r in eski_satirlar}
    for k in uygun:
        if k["tur"] in ("yeni", "tuik"):
            g = v.gosterge[k["gosterge"]]
            mevcut[(k["kod"], k["gosterge"], str(k["yil"]))] = {
                "kod": k["kod"], "gosterge": k["gosterge"], "kategori": g["kategori"] or "", "yil": str(k["yil"]),
                "deger": yaz_sayi(k["deger"]), "kaynak": k["kaynak"] or g["kaynak"] or "",
                "not": f"{zaman} · {k['ayrinti']}".strip(" ·")}
    # elle girilmiş bir değer sonradan "Düzeltmeler" ile silinirse elle-giris'ten de çıkar
    for k in uygun:
        if k["tur"] == "duzeltme" and k["islem"] == "silme":
            mevcut.pop((k["kod"], k["gosterge"], str(k["yil"])), None)
    _csv_yaz(y["elle"], alanlar, sorted(mevcut.values(), key=lambda r: (r["gosterge"], r["yil"], r["kod"])))

    # 2) düzeltmeler → duzeltmeler/degerler.csv
    duz_alan = ["kod", "gosterge", "yil", "deger", "gerekce"]
    duz = _csv_oku(y["duz"], duz_alan)
    duz_idx = {(r["kod"], r["gosterge"], r["yil"]): i for i, r in enumerate(duz)}
    for k in uygun:
        if k["tur"] != "duzeltme":
            continue
        r = {"kod": k["kod"], "gosterge": k["gosterge"], "yil": str(k["yil"]), "deger": yaz_sayi(k["deger"]),
             "gerekce": f"{k['gerekce']}" + (f" (Kaynak: {k['ayrinti']})" if k["ayrinti"] else "") + f" [{zaman}]"}
        anahtar = (r["kod"], r["gosterge"], r["yil"])
        if anahtar in duz_idx:
            duz[duz_idx[anahtar]] = r
        else:
            duz_idx[anahtar] = len(duz)
            duz.append(r)
    if any(k["tur"] == "duzeltme" for k in uygun):
        _csv_yaz(y["duz"], duz_alan, duz)

    # 3) değişiklik geçmişi
    gecmis = _csv_oku(y["gecmis"], GECMIS_ALANLAR)
    for k in uygun:
        gecmis.append({
            "tarih": zaman, "islem": _islem_ad(k), "kod": k["kod"], "birim": v.birim[k["kod"]][0],
            "gosterge": k["gosterge"], "yil": str(k["yil"]), "eski": yaz_sayi(k.get("eski")), "yeni": yaz_sayi(k["deger"]),
            "eski_kaynak": k.get("eski_kaynak") or "",
            "yeni_kaynak": ELLE if k["tur"] != "duzeltme" else "duzeltmeler/degerler.csv",
            "kaynak_ayrintisi": " · ".join(x for x in (k["kaynak"], k["ayrinti"]) if x), "gerekce": k["gerekce"] or k["not"]})
    _csv_yaz(y["gecmis"], GECMIS_ALANLAR, gecmis)

    # 4) çalışma kitabında satırları işaretle
    for k in uygun:
        if k["tur"] == "tuik":
            continue
        wb[k["sayfa"]].cell(row=k["satir"], column=8 if k["tur"] == "yeni" else 7, value=f"Uygulandı {zaman}")
    if any(k["tur"] == "tuik" for k in uygun):
        wb[SAYFA_TUIK].cell(row=4, column=2, value=f"Uygulandı {zaman} — yeni tablo için B1:B4 ve A6'dan sonrasını temizleyin")
    kaydet(wb, y)
    print(f"Yazıldı: {y['elle'].relative_to(kok)}, {y['gecmis'].relative_to(kok)}"
          + (f", {y['duz'].relative_to(kok)}" if any(k['tur'] == 'duzeltme' for k in uygun) else ""))

    # 5) veri hattı ve doğrulama
    ek = ""
    if veri_hatti:
        print("Veri hattı çalışıyor (birkaç dakika sürebilir)…")
        log = y["rapor"] / "log"
        rc = calistir([sys.executable, "pipeline/build_data.py"], kok, log / "build_data.log")
        if rc == 0 and (kok / "tools" / "analiz" / "analiz_verisi.py").exists():
            rc |= calistir([sys.executable, "tools/analiz/analiz_verisi.py"], kok, log / "analiz_verisi.log")
        if rc:
            print(f"Veri hattı hata verdi. Ayrıntı: {log}")
            ek = "<h2 class='hata'>Veri hattı hata verdi</h2><p>Günlük dosyaları: veri-masasi/raporlar/log/</p>"
        else:
            v2 = Veri(y["db"])
            tutmayan = []
            for k in uygun:
                yeni, _ = v2.deger(k["kod"], k["gosterge"], k["yil"])
                beklenen = k["deger"]
                if (beklenen is None) != (yeni is None) or (beklenen is not None and abs(yeni - beklenen) > 1e-9 * max(1, abs(beklenen))):
                    tutmayan.append((k, yeni))
            if tutmayan:
                ek = ("<h2 class='uyari'>Veritabanında beklenenden farklı çıkan değerler</h2><p class='not'>Temizlik kuralları "
                      "(ör. il toplamından yeniden hesaplanan bölge değerleri) değeri değiştirmiş olabilir; build/rapor.md'ye bakın.</p><ul>"
                      + "".join(f"<li>{html.escape(k['kod'])} · {html.escape(k['gosterge'])} · {k['yil']}: girilen "
                                f"{goster(k['deger'])}, veritabanında {goster(n)}</li>" for k, n in tutmayan[:200]) + "</ul>")
            else:
                ek = f"<p class='tamam'>Veri hattı tamamlandı; uygulanan {len(uygun)} değerin tamamı yeni veritabanında doğrulandı.</p>"
            if y["dist"].parent.exists() and y["web"].exists():
                shutil.copytree(y["web"], y["dist"], dirs_exist_ok=True)
                ek += "<p class='not'>Site verisi public/veri ve dist/veri klasörlerine yazıldı (siteyi-ac.py ile görebilirsiniz).</p>"
            ek += ("<p class='not'>Paylaşılan gözden geçirme sitesinin de güncellenmesi için Claude'a "
                   "\"veri güncellendi, siteyi yayınla\" demeniz yeterli.</p>")
            sablon(kok, sessiz=True)
    hedef = y["rapor"] / f"uygulama-{dt.datetime.now():%Y%m%d-%H%M}.html"
    rapor_yaz(uygun, v, hedef, "Veri Girişi Uygulama Raporu", ek)
    print(f"Tamamlandı. Rapor: {hedef}")
    if tarayici:
        webbrowser.open(hedef.as_uri())
    return 0


# --------------------------------------------------------------------------- geçmiş ve kaynak
def gecmis_raporu(kok: Path, tarayici=True):
    y = yollar(kok)
    satirlar = _csv_oku(y["gecmis"], GECMIS_ALANLAR)
    e = html.escape
    govde = "".join(
        "<tr>" + "".join(f"<td{' class=s' if a in ('eski', 'yeni') else ''}>{e(r.get(a, ''))}</td>" for a in GECMIS_ALANLAR) + "</tr>"
        for r in reversed(satirlar))
    hedef = y["rapor"] / "gecmis.html"
    hedef.parent.mkdir(parents=True, exist_ok=True)
    hedef.write_text(
        f"<!doctype html><html lang='tr'><head><meta charset='utf-8'><title>Değişiklik Geçmişi</title><style>{CSS}</style></head>"
        f"<body><h1>Değişiklik Geçmişi</h1><p class='alt'>{len(satirlar)} kayıt, en yenisi üstte</p><table><tr>"
        + "".join(f"<th>{e(a.replace('_', ' '))}</th>" for a in GECMIS_ALANLAR) + f"</tr>{govde}</table></body></html>",
        encoding="utf-8")
    print(f"{len(satirlar)} kayıt. Rapor: {hedef}")
    if tarayici:
        webbrowser.open(hedef.as_uri())


def kaynak_raporu(kok: Path, gosterge: str):
    y = yollar(kok)
    v = Veri(y["db"])
    ad, h = v.gosterge_bul(gosterge)
    if h:
        sys.exit(h)
    print(f"{ad}  ·  kategori: {v.gosterge[ad]['kategori']}  ·  kaynak: {v.gosterge[ad]['kaynak']}")
    for yil, dosya, n in v.con.execute(
            "SELECT time, source_file, COUNT(*) FROM values_long WHERE indicator=? GROUP BY time, source_file ORDER BY time, source_file", (ad,)):
        print(f"  {yil}  {n:>4} değer  ←  {dosya}")
    elle = [r for r in _csv_oku(y["gecmis"], GECMIS_ALANLAR) if r["gosterge"] == ad]
    if elle:
        print(f"  Bu göstergede veri masasıyla yapılmış {len(elle)} değişiklik var (gecmis komutu).")


# --------------------------------------------------------------------------- giriş
def menu(kok):
    secenek = {"1": ("Çalışma kitabını oluştur / başvuru sayfalarını yenile", lambda: sablon(kok)),
               "2": ("Girişleri kontrol et", lambda: kontrol(kok)),
               "3": ("Kontrol et ve uygula (veri hattı dahil)", lambda: uygula(kok)),
               "4": ("Değişiklik geçmişi", lambda: gecmis_raporu(kok))}
    print("Veri Masası\n")
    for k, (ad, _) in secenek.items():
        print(f"  {k}) {ad}")
    s = input("\nSeçiminiz (1-4): ").strip()
    if s in secenek:
        secenek[s][1]()
    else:
        print("Geçersiz seçim.")
    input("\nKapatmak için Enter…")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("komut", nargs="?", choices=["sablon", "kontrol", "uygula", "gecmis", "kaynak"])
    ap.add_argument("gosterge", nargs="?", help="kaynak komutu için gösterge adı")
    ap.add_argument("--kok", default=str(KOK), help="proje klasörü (varsayılan: bu dosyanın üst klasörü)")
    ap.add_argument("--evet", action="store_true", help="uygula: onay sormadan uygula")
    ap.add_argument("--veri-hatti-yok", action="store_true", help="uygula: veri hattını çalıştırma")
    ap.add_argument("--tarayici-yok", action="store_true", help="raporu tarayıcıda açma")
    a = ap.parse_args(argv)
    kok = Path(a.kok).resolve()
    if a.komut is None:
        return menu(kok)
    if a.komut == "sablon":
        sablon(kok)
    elif a.komut == "kontrol":
        kontrol(kok, tarayici=not a.tarayici_yok)
    elif a.komut == "uygula":
        return uygula(kok, evet=a.evet, veri_hatti=not a.veri_hatti_yok, tarayici=not a.tarayici_yok)
    elif a.komut == "gecmis":
        gecmis_raporu(kok, tarayici=not a.tarayici_yok)
    elif a.komut == "kaynak":
        if not a.gosterge:
            sys.exit('Gösterge adı yazın:  python veri-masasi/veri_masasi.py kaynak "Toplam Nüfus"')
        kaynak_raporu(kok, a.gosterge)


if __name__ == "__main__":
    sys.exit(main())
