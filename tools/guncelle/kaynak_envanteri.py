"""
kaynak_envanteri.py — yayımlanan bütün göstergelerin veri kaynağı ve güncelleme yöntemi envanteri (Excel).

Her gösterge için: tema, kategori, ad, kaynak kurum, istatistiki düzeyler, yıl aralığı, veritabanına geldiği dosya ve
güncelleme yöntemi:
  1. API ile otomatik      OECD SDMX (tools/guncelle/guncelle.py) — veri-ekleri/oecd-bolgesel.csv, oecd-kentler.csv
  2. TÜİK API adayı        TÜİK SDMX'te karşılığı olduğu düşünülen akış (ad kuralıyla önerildi; eşleme henüz yapılmadı)
  3. TÜİK API'de veri yok  akış tanımlı ama API boş dönüyor (ölüm, intihar, uluslararası göç)
  4. Platform hesaplaması  başka göstergelerden türetilen değerler (kaynak verisi güncellenince yeniden hesaplanır)
  5. Dosyadan (elle)       Excel/CSV derlemelerinden yüklenen veriler

Kullanım: python tools/guncelle/kaynak_envanteri.py [--cikti incelemeler/veri-kaynak-envanteri.xlsx]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

KOK = Path(__file__).resolve().parents[2]

API_OECD = {"oecd-bolgesel.csv": "OECD SDMX – Bölgesel istatistikler", "oecd-kentler.csv": "OECD SDMX – Kentler (FUA)"}
HESAP = ("turetilmis", "temizlik:")
# Çok kaynaklı ara derlemeler: birden çok kurumun tablolarını bir araya getiren, platform dışında hazırlanmış dosyalar.
# Bunların dışındaki dosyalar tek bir kurum yayınından (ya da tek bir kurum tablosundan) dönüştürülmüştür.
DERLEME = {"tuik-bolgesel.csv.gz", "trveriler.csv.gz", "infografik.csv.gz", "ilcetr.csv.gz", "konsolide.csv", "vizstudio-gostergeler3.db"}
TAMAMLAMA = {"temizlik:tek_illi_tamamlama": "tek illi Düzey 2 bölgesine il değeri aktarıldı",
             "temizlik:tek_illi": "tek illi bölge değeri ile eşitlendi",
             "temizlik:toplam": "eksik bölge/Türkiye toplamı il değerlerinden hesaplandı"}
DOSYA_ACIKLAMA = {
    "tuik-bolgesel.csv.gz": "TÜİK bölgesel istatistikler derlemesi (VizStudio Turkiye_Istatistikleri_Birlesik.xlsx, 22 tema sayfası)",
    "ska.csv": "TÜİK Sürdürülebilir Kalkınma Amaçları göstergeleri (il/bölge)",
    "ska_2026.csv": "TÜİK Sürdürülebilir Kalkınma Amaçları göstergeleri, 2026 yayını",
    "trveriler.csv.gz": "Önceki platformun il/bölge veri derlemesi",
    "infografik.csv.gz": "Önceki platformun infografik veri derlemesi",
    "ilcetr.csv.gz": "Önceki platformun ilçe/il veri derlemesi",
    "tuik-il-refah.csv": "TÜİK il refah göstergeleri (Beşeri Sermaye, İllerde Yaşam Endeksi vb.)",
    "konsolide.csv": "Konsolide.xlsx derlemesi (65 sütun, eslemeler/konsolide.csv)",
    "tuik-il-gskd-a10.csv": "TÜİK il GSKD, A10 iktisadi faaliyet kolları",
    "tuik-tufe-turkiye.csv": "TÜİK TÜFE, Türkiye düzeyi",
    "meb-okullasma.csv": "MEB Millî Eğitim İstatistikleri (Örgün Eğitim kitapları)",
    "tuik-fiyat-duzeyi.csv": "TÜİK bölgesel fiyat düzeyi endeksleri ve SGP",
    "sege-tarihi.csv": "DPT ve Sanayi ve Teknoloji Bakanlığı SEGE çalışmaları",
    "vizstudio-gostergeler3.db": "VizStudio gostergeler3.db",
    "tuik-koy-belediye-2025.csv": "TÜİK köy ve belde nüfusu, 2025",
    "tuik-belediye-su.csv": "TÜİK belediye su ve atıksu istatistikleri",
    "tuik-beseri-kalkinma.csv": "TÜİK il beşeri kalkınma endeksi",
    "tuik-kent-kir-alan.csv": "TÜİK kent–kır sınıflaması alan payları",
    "bddk-nakdi-kredi-banka-grubu.csv": "BDDK FinTürk, banka gruplarına göre nakdi krediler",
    "tuik-gelir-yoksulluk-duzey2.csv": "TÜİK Gelir ve Yaşam Koşulları, Düzey 2 (kullanıcının CSV dosyası)",
    "btk-haberlesme.csv": "BTK haberleşme verileri (Düzey 2–3)",
    "tuik-egitim-suresi.csv": "TÜİK ortalama eğitim süresi",
    "ilce-koy-nufusu-2013-2022.csv": "İlçe ve köy nüfusları 2013–2022",
    "duzeltmeler/degerler.csv": "Elle düzeltilen değerler",
}

# Ad kuralı → TÜİK SDMX akışı (yalnız TÜİK kaynaklı, SKA dışı göstergeler için; ilk eşleşen kural geçerli)
TUIK_KURAL = [
    (r"^Toplam Nüfus$|^Cinsiyet: ", "DF_ADNKS_T30 / T16"),
    (r"^Nüfus Yoğunluğu$", "DF_ADNKS_T20"),
    (r"Yıllık Nüfus Artış Hızı", "DF_ADNKS_T29"),
    (r"Ortalama Hanehalkı Büyüklüğü", "DF_ADNKS_T25"),
    (r"^Ortanca Yaş", "DF_ADNKS_T23"),
    (r"Bağımlılık Oranı", "DF_ADNKS_T24"),
    (r"(Yoğun Kent|Kır) Nüfus", "DF_ADNKS_T37"),
    (r"İl ve İlçe Merkezleri|Belde ve Köyler|^Şehir Nüfusu|^Köy Nüfusu", "DF_ADNKS_T14"),
    (r"Hanehalkı Sayısı", "DF_ADNKS_T06"),
    (r"Medeni Duruma Göre Nüfus", "DF_ADNKS_T10"),
    (r"Çocuk Nüfus|Genç Nüfus|Yaşlı Nüfus|Yaş Grubu Nüfus|Yaş Oranı|65 Yaş ve Üzeri Nüfus", "DF_ADNKS_T35 / T16"),
    (r"Kaba Evlenme Hızı", "DF_KABA_EVLENME_HIZI"),
    (r"Kaba Boşanma Hızı", "DF_KABA_BOSANMA_HIZI"),
    (r"Kaba Doğum Hızı", "DF_DOGUM_KDH_C"),
    (r"^Doğurganlık Hızı", "DF_DOGUM_IL_TDH_C"),
    (r"Ortalama İlk Evlenme Yaşı", "DF_EVLENME_ORT_ILK_EVL_YAS"),
    (r"Ortalama Evlenme Yaşı", "DF_EVLENME_ORT_EVL_YAS"),
    (r"Anne Yaşına Göre Doğum", "DF_DOGUM_ANNEYASGR_IL_C"),
    (r"^Doğum Sayısı|Aylara Göre Doğum", "DF_DOGUM_IL_AY_C"),
    (r"^Evlenme Sayısı", "DF_EVLENME_IL_AY"),
    (r"Evlilik Süresine Göre Boşanma", "DF_BOSANMA_EVLSURE"),
    (r"Akraba Evlil", "DF_EVLENME_AKRABA_EVLILIK"),
    (r"^Kişi Başına GSYH \((\$|TL)\)", "DF_UH_BH_KISI_BASI"),
    (r"Kişi Başına GSYH Endeksi", "DF_UH_BH_KB_ENDEKS"),
    (r"Zincirlenmiş Hacim|Değişim Oranı \(%\)$", "UH_BH_GSYH_HACIM", "Ekonomi"),
    (r"^Gayrisafi Yurt İçi Hasıla \(GSYH\) \(Bin TL\)|^Gayri Safi Katma Değer \(GSKD\) \(Bin TL\)|^Sektörlere Göre Katma Değer|GSYH Değişim Oranı \(Cari", "UH_BH_GSYH_CARI"),
    (r"Katma Değerde Sektör Payı|Sektörünün Ekonomi İçindeki Payı", "DF_UH_BH_PAY_SEKTOREL"),
    (r"^Kredi Kuruluşları:", "DF_KREDI_ISTIHDAM_ODEME"),
    (r"^Finansal Hizmet Faaliyetleri", "DF_FINANSAL_ISTIHDAM_ODEME"),
    (r"Girişim Sayısı", "DF_BR_FAALIYET_GIRISIM_V1", "Sanayi"),
    (r"Ortalama Eğitim Süresi", "DF_ORTALAMA_EGITIM_SURE"),
    (r"Muhtemel Eğitim Süresi", "DF_MUHTEMEL_EGITIM_SURE_*"),
    (r"15 Yaş ve Üzeri|Eğitim Durumuna Göre Nüfus|Okuma Yazma", "DF_ULUSAL_EGITIM_ISTATISTIK_BED_NUFUS", "Eğitim"),
    (r"Müze|Ören Yeri", "DF_MUZE_SAYISI_V3 / ESER_SAY / ORENYER_ZYARETCI"),
    (r"Trafik Kaza", "DF_TRAFIK_KAZA_OLU_YARALI_V2"),
    (r"Otomobil Sayısı|Motorlu Kara Taşıt|Taşıt Sayısı", "DF_MOTORLU_KARA_TASIT_ILLER_V3", "Ulaştırma"),
    (r"^Konut Satış", "DF_SATIS_SEKLI_DURUMU_ILILCE_V3"),
    (r"Yabancılara .*Satış", "DF_YABANCILARA_SATILAR_ILILCE_V3"),
    (r"Atık Hizmeti|Belediye Atık|Toplanan Atık", "DF_ATIK_BELEDIYE_HIZMET_V1 / ATIKYONETIMI_V1", "Çevre"),
    (r"Belediye|Su |Atık Su|Kanalizasyon|Arıtma", "DF_SU_ATIKSU_BELEDIYE_*", "Çevre"),
    (r"Beşeri Kalkınma Endeksi", "DF_BESERI_KALKINMA_ENDEKS"),
    (r"Fiyat Düzeyi Endeksi", "DF_BOLGESEL_FIYAT_DUZEYI_*"),
    (r"Satınalma Gücü Paritesi", "DF_BOLGESEL_SGP_TUKETIM_ANA_GRUPLAR_V1"),
]
TUIK_BOS = r"Ölüm|İntihar|Bebek"  # yalnız Demografi kategorisinde

DUZEY = {"country": "Türkiye", "region12": "Düzey 1", "region26": "Düzey 2", "province": "İl", "district": "İlçe", "fua": "Kent (FUA)"}
ELLE_KURUM = "Dosyadan: kurum yayını"
ELLE_DERLEME = "Dosyadan: çok kaynaklı derleme"
YONTEM_SIRA = ["API ile otomatik (OECD)", "TÜİK API adayı", "TÜİK API'de veri yok", "Platform hesaplaması", ELLE_KURUM, ELLE_DERLEME]
RENK = {"API ile otomatik (OECD)": "C6E7CE", "TÜİK API adayı": "DCE9F7", "TÜİK API'de veri yok": "F6DEDE",
        "Platform hesaplaması": "EEEEEE", ELLE_KURUM: "FFFFFF", ELLE_DERLEME: "FFF4D6"}


def dosya_turu(f: str) -> str:
    if f in API_OECD:
        return "OECD API"
    if f.startswith(HESAP):
        return "Platform hesaplaması"
    if f in DERLEME:
        return "Çok kaynaklı derleme"
    return "Kurum yayını" if f else ""


def temalar():
    js = "import('./src/lib/basliklar.js').then(m=>console.log(JSON.stringify(m.UST_BASLIKLAR.map(u=>[u.ad,u.kategoriler]))))"
    out = subprocess.run(["node", "-e", js], cwd=KOK, capture_output=True, text=True, check=True).stdout
    return {k: ad for ad, ks in json.loads(out) for k in ks}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cikti", default=str(KOK / "incelemeler/veri-kaynak-envanteri.xlsx"))
    a = ap.parse_args(argv)
    db = sqlite3.connect(KOK / "build/veri.db")
    kaynak_say = defaultdict(Counter)
    for ind, sf, n in db.execute("SELECT indicator, source_file, COUNT(*) FROM values_long GROUP BY indicator, source_file"):
        kaynak_say[ind][sf] += n
    tema = temalar()
    M = json.load(open(KOK / "public/veri/manifest.json", encoding="utf-8"))
    kapsam = {}
    p = KOK / "build/guncelleme/tuik/kapsam.csv"
    if p.exists():
        kapsam = {r["akis"]: r for r in csv.DictReader(open(p, encoding="utf-8-sig"), delimiter=";")}

    def tamamlama(ks: Counter) -> str:
        top = sum(ks.values())
        parca = [f"{TAMAMLAMA[f]} ({n} değer, %{100 * n / top:.0f})".replace(".", ",")
                 for f, n in ks.most_common() if f in TAMAMLAMA and ks.most_common(1)[0][0] != f]
        return "; ".join(parca)

    satir = []
    for k in M["kategoriler"]:
        for g in k["gostergeler"]:
            ad = g["ad"]
            kk = g.get("kaynakKisa") or ""
            # veritabanı adı: kimi göstergede sondaki kaynak kısaltması addan atılmıştır, kiminde adın parçasıdır
            adaylar = [ad, ad[: -(len(kk) + 3)] if kk and ad.endswith(f" ({kk})") else ad, ad.replace(f" ({kk})", "", 1)]
            dbad = next((x for x in adaylar if x in kaynak_say), adaylar[1])
            ks = kaynak_say.get(dbad, Counter())
            dosyalar = [f for f, _ in ks.most_common()]
            ana = dosyalar[0] if dosyalar else ""
            akis = ""
            if any(f in API_OECD for f in dosyalar):
                yontem = "API ile otomatik (OECD)"
                akis = "; ".join(API_OECD[f] for f in dosyalar if f in API_OECD)
            elif ana.startswith(HESAP):
                yontem = "Platform hesaplaması"
            elif kk == "TÜİK" and not dbad.startswith("SKA ") and k["ad"] == "Demografi" and re.search(TUIK_BOS, dbad):
                yontem = "TÜİK API'de veri yok"
                akis = "DF_OLUM_* / DF_INTIHAR_* (API boş dönüyor)"
            else:
                yontem = ELLE_DERLEME if ana in DERLEME else ELLE_KURUM
                if kk == "TÜİK" and not dbad.startswith("SKA "):
                    for kural, df, *kat in TUIK_KURAL:
                        if re.search(kural, dbad) and (not kat or kat[0] == k["ad"]):
                            yontem, akis = "TÜİK API adayı", df
                            break
            ys = g.get("yillar") or []
            satir.append({
                "tema": tema.get(k["ad"], ""), "kategori": k["ad"], "ad": ad, "kaynak": g.get("kaynak") or kk,
                "duzey": ", ".join(DUZEY.get(d, d) for d in g.get("duzeyler", [])),
                "ilk": ys[0] if ys else "", "son": ys[-1] if ys else "", "yil": len(ys),
                "yontem": yontem, "akis": akis, "dosya": ana,
                "dosya_ack": DOSYA_ACIKLAMA.get(ana, API_OECD.get(ana, "Platform hesaplaması" if ana.startswith(HESAP) else "")),
                "diger": ", ".join(dosyalar[1:]), "tur": dosya_turu(ana),
                "tamam": tamamlama(ks),
            })

    wb = Workbook()
    kalin = Font(bold=True)
    bas_dolgu = PatternFill("solid", fgColor="1F3A5F")
    bas_yazi = Font(bold=True, color="FFFFFF")

    def basliklar(ws, adlar, gen):
        ws.append(adlar)
        for i, (c, w) in enumerate(zip(ws[ws.max_row], gen), 1):
            c.font, c.fill = bas_yazi, bas_dolgu
            c.alignment = Alignment(wrap_text=True, vertical="center")
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = f"A{ws.max_row + 1}"

    # 1. Özet
    ws = wb.active
    ws.title = "Özet"
    ws.append(["Veri Kaynakları ve Güncelleme Yöntemi Envanteri"]); ws["A1"].font = Font(bold=True, size=14)
    ws.append([f"Yayımlanan gösterge sayısı: {len(satir)}. Kaynak: build/veri.db ve public/veri/manifest.json; Hesaplama: Platform"])
    ws.append([])
    ws.append(["Güncelleme yöntemi", "Gösterge", "Açıklama"])
    for c in ws[ws.max_row]:
        c.font, c.fill = bas_yazi, bas_dolgu
    acik = {
        "API ile otomatik (OECD)": "OECD SDMX API'sinden indirilir; guncelle.py ile karşılaştırılıp denetim raporu üretilir.",
        "TÜİK API adayı": "TÜİK SDMX'te il/bölge kırılımlı karşılığı bulunan göstergeler (ad kuralıyla önerildi). Eşleme tablosu kurulunca otomatik güncellenecek.",
        "TÜİK API'de veri yok": "Akış API'de tanımlı, ancak veri dönmüyor (ölüm, intihar, uluslararası göç). Dosyadan güncellenmeye devam edecek.",
        "Platform hesaplaması": "Başka göstergelerden türetilir (paylar, oranlar, eşitsizlik ölçüleri, tek illi bölge tamamlamaları).",
        ELLE_KURUM: "Tek bir kurumun yayınından ya da tablosundan dönüştürülen dosyalar: TÜİK SKA, TÜİK il refah endeksleri, TÜİK GSKD A10, MEB, BTK, BDDK, SEGE vb.",
        ELLE_DERLEME: "Platform dışında daha önce hazırlanmış, birden çok tablo ve kurumu bir arada tutan dosyalar: TÜİK bölgesel istatistik derlemesi (VizStudio), önceki platformun dosyaları (trveriler, infografik, ilcetr), Konsolide.xlsx, VizStudio veritabanı.",
    }
    say = Counter(s["yontem"] for s in satir)
    for y in YONTEM_SIRA:
        ws.append([y, say[y], acik[y]])
        ws.cell(ws.max_row, 1).fill = PatternFill("solid", fgColor=RENK[y])
    ws.append(["Toplam", len(satir), ""]); ws.cell(ws.max_row, 1).font = kalin; ws.cell(ws.max_row, 2).font = kalin
    ws.append([])
    nt = sum(1 for s in satir if s["tamam"])
    ws.append([f"Platform tamamlaması: {nt} göstergede değerlerin bir kısmını veri hattı tamamlar (tek illi Düzey 2 bölgeleri, eksik toplamlar). "
               "Bu göstergeler ana dosyalarının yöntemiyle sayılmıştır; ayrıntı 'Bütün Göstergeler' sayfasındaki 'Platform Tamamlaması' sütunundadır."])
    ws.append(["Dünya Bankası API'si veri kaynağı olarak değil, çapraz denetim için kullanılır: Türkiye nüfusu, GSYH (cari TL) ve mal ihracatı (tools/guncelle/denetim.py)."])
    ws.append([])
    ws.append(["Tema"] + YONTEM_SIRA + ["Toplam"])
    for c in ws[ws.max_row]:
        c.font, c.fill = bas_yazi, bas_dolgu
    tt = defaultdict(Counter)
    for s in satir:
        tt[s["tema"]][s["yontem"]] += 1
    for t in sorted(tt, key=lambda t: -sum(tt[t].values())):
        ws.append([t] + [tt[t][y] or "" for y in YONTEM_SIRA] + [sum(tt[t].values())])
    ws.column_dimensions["A"].width = 46
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 110
    for col in "DEFG":
        ws.column_dimensions[col].width = 16

    # 2. API ile bağlı olanlar
    ws = wb.create_sheet("API ile Bağlı")
    basliklar(ws, ["Tema", "Kategori", "Gösterge", "Düzeyler", "İlk Yıl", "Son Yıl", "API Kaynağı"], [30, 26, 70, 30, 9, 9, 36])
    for s in satir:
        if s["yontem"] == "API ile otomatik (OECD)":
            ws.append([s["tema"], s["kategori"], s["ad"], s["duzey"], s["ilk"], s["son"], s["akis"]])
    ws.auto_filter.ref = ws.dimensions

    # 3. Bütün göstergeler
    ws = wb.create_sheet("Bütün Göstergeler")
    basliklar(ws, ["Tema", "Kategori", "Gösterge", "Kaynak Kurum", "Düzeyler", "İlk Yıl", "Son Yıl", "Yıl Sayısı",
                   "Güncelleme Yöntemi", "API Akışı / Aday Akış", "Veri Dosyası", "Dosya Türü", "Dosya Açıklaması",
                   "Platform Tamamlaması", "Diğer Dosyalar"],
               [28, 24, 70, 24, 28, 8, 8, 8, 26, 34, 28, 20, 50, 44, 30])
    for s in sorted(satir, key=lambda s: (s["tema"], s["kategori"], YONTEM_SIRA.index(s["yontem"]), s["ad"])):
        ws.append([s["tema"], s["kategori"], s["ad"], s["kaynak"], s["duzey"], s["ilk"], s["son"], s["yil"],
                   s["yontem"], s["akis"], s["dosya"], s["tur"], s["dosya_ack"], s["tamam"], s["diger"]])
        ws.cell(ws.max_row, 9).fill = PatternFill("solid", fgColor=RENK[s["yontem"]])
    ws.auto_filter.ref = ws.dimensions

    # 4. Veri dosyaları
    ws = wb.create_sheet("Veri Dosyaları")
    basliklar(ws, ["Veri Dosyası", "Dosya Türü", "Açıklama", "Ana Kaynağı Olduğu Gösterge", "Tamamladığı Gösterge"], [34, 22, 90, 16, 16])
    dsay = Counter(s["dosya"] for s in satir)
    tsay = Counter()
    for s in satir:
        for f in TAMAMLAMA:
            if TAMAMLAMA[f] in s["tamam"]:
                tsay[f] += 1
    for f, n in dsay.most_common():
        ws.append([f or "(veritabanında bulunamadı)", dosya_turu(f), DOSYA_ACIKLAMA.get(f, API_OECD.get(f, "")), n, ""])
    for f, n in tsay.most_common():
        ws.append([f, "Platform tamamlaması", TAMAMLAMA[f], "", n])

    # 5. TÜİK API il/bölge akışları
    if kapsam:
        ws = wb.create_sheet("TÜİK API Akışları")
        basliklar(ws, ["Akış", "Ad", "İlk Yıl", "Son Yıl", "İl", "Düzey 2", "Düzey 1", "Platformda Aday Gösterge"],
                  [44, 80, 8, 8, 6, 8, 8, 14])
        aday = Counter()
        for s in satir:
            if s["yontem"] == "TÜİK API adayı":
                for parca in re.split(r"\s*/\s*", s["akis"]):
                    aday[parca.split()[0]] += 1
        for r in sorted(kapsam.values(), key=lambda r: r["akis"]):
            if r["durum"] != "tamam":
                continue
            il, d2, d1 = int(r["il"] or 0), int(r["d2"] or 0), int(r["d1"] or 0)
            if il >= 75 or d2 >= 24 or d1 >= 11:
                n = sum(v for k, v in aday.items() if r["akis"] == k or (k.endswith("*") and r["akis"].startswith(k[:-1])))
                ws.append([r["akis"], r["ad"], r["ilk"], r["son"], il or "", d2 or "", d1 or "", n or ""])
        ws.auto_filter.ref = ws.dimensions

    Path(a.cikti).parent.mkdir(parents=True, exist_ok=True)
    wb.save(a.cikti)
    print(a.cikti)
    for y in YONTEM_SIRA:
        print(f"  {y}: {say[y]}")
    print("  veritabanında dosyası bulunamayan:", sum(1 for s in satir if not s["dosya"]))


if __name__ == "__main__":
    main()
