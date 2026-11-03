"""
oecd_refah.py — OECD Regional Well-Being veri dosyasını (bütün OECD bölgeleri) okur.

Kaynak: veri-ekleri/oecd-refah-bolgeler.xlsx
        (oecdregionalwellbeing.org → "Download the data", OECD-Regional-Well-Being-Data-File.xlsx)

Çıktılar
  veri.db   oecd_bolgeler (kod, ulke, ad, tur)      tur: 'bolge' ya da 'ulke'
            oecd_refah    (kod, tur, alan, deger, metin)
                          tur: 'puan' (0-10, 11 konu), 'gosterge' (15 gösterge), 'egilim' (+ / - / =)
  public/veri/oecd-refah.json   sitede bölge refah profili ve "başka ülkelerden benzer bölgeler" için

Yalnızca standart kütüphane kullanır (xlsx, zip içindeki XML olarak okunur).
"""
from __future__ import annotations

import json
import math
import re
import sqlite3
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

DOSYA = "oecd-refah-bolgeler.xlsx"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

KONULAR = [  # (id, Türkçe, dosyadaki ad)
    ("gelir", "Gelir", "Income"), ("is", "İş", "Jobs"), ("konut", "Konut", "Housing"),
    ("egitim", "Eğitim", "Education"), ("saglik", "Sağlık", "Health"), ("cevre", "Çevre", "Environment"),
    ("guvenlik", "Güvenlik", "Safety"), ("katilim", "Sivil katılım", "Civic engagement"),
    ("erisim", "Hizmetlere erişim", "Access to services"), ("toplum", "Toplum", "Community"),
    ("memnuniyet", "Yaşam memnuniyeti", "Life satisfaction"),
]
GOSTERGELER = [  # (id, Türkçe, dosyadaki ad, konu, birim)
    ("harcanabilir_gelir", "Kişi başı harcanabilir gelir", "Disposable income per capita", "gelir", "$ SGP"),
    ("istihdam", "İstihdam oranı", "Employment rate", "is", "%"),
    ("issizlik", "İşsizlik oranı", "Unemployment rate", "is", "%"),
    ("cinayet", "Cinayet oranı", "Homicide rate", "guvenlik", "yüz binde"),
    ("yasam_suresi", "Doğuşta beklenen yaşam süresi", "Life expectancy", "saglik", "yıl"),
    ("lise_mezunu", "En az lise mezunu işgücü oranı", "Population with at least secondary education", "egitim", "%"),
    ("oda", "Kişi başına oda sayısı", "Number of rooms per capita", "konut", "oda"),
    ("olum", "Yaşa göre standartlaştırılmış ölüm oranı", "Mortality rate", "saglik", "binde"),
    ("secim", "Seçime katılım oranı", "Voter turnout", "katilim", "%"),
    ("genisbant", "Genişbant erişimi olan hane oranı", "Households broadband access", "erisim", "%"),
    ("pm25", "Hava kirliliği (PM2,5)", "Air quality (PM2.5)", "cevre", "µg/m³"),
    ("memnuniyet", "Yaşam memnuniyeti", "Life satisfaction", "memnuniyet", "0-10"),
    ("konut_fiyat", "Konut fiyatlarından memnuniyet", "Satisfaction with housing affordability", "konut", "%"),
    ("internet_hizi", "İnternet hızının OECD ortalamasından farkı", "Internet speed", "erisim", "%"),
    ("sosyal_destek", "Algılanan sosyal destek ağı", "Perceived social network support", "toplum", "%"),
]
TUIK_YIL = "2024"
TUIK_ISTIHDAM = "İstihdam Oranı (15+ yaş) (%)"
TUIK_ISSIZLIK = "İşsizlik Oranı (15+ yaş) (%)"
ULKELER = {
    "Australia": "Avustralya", "Austria": "Avusturya", "Belgium": "Belçika", "Bulgaria": "Bulgaristan",
    "Canada": "Kanada", "Chile": "Şili", "Colombia": "Kolombiya", "Costa Rica": "Kosta Rika", "Croatia": "Hırvatistan",
    "Czechia": "Çekya", "Denmark": "Danimarka", "Estonia": "Estonya", "Finland": "Finlandiya", "France": "Fransa",
    "Germany": "Almanya", "Greece": "Yunanistan", "Hungary": "Macaristan", "Iceland": "İzlanda", "Ireland": "İrlanda",
    "Israel": "İsrail", "Italy": "İtalya", "Japan": "Japonya", "Korea": "Kore", "Latvia": "Letonya",
    "Lithuania": "Litvanya", "Luxembourg": "Lüksemburg", "Mexico": "Meksika", "Netherlands": "Hollanda",
    "New Zealand": "Yeni Zelanda", "Norway": "Norveç", "Poland": "Polonya", "Portugal": "Portekiz",
    "Romania": "Romanya", "Slovak Republic": "Slovakya", "Slovenia": "Slovenya", "Spain": "İspanya",
    "Sweden": "İsveç", "Switzerland": "İsviçre", "Türkiye": "Türkiye", "United Kingdom": "Birleşik Krallık",
    "United States": "ABD",
}


# ------------------------------------------------------------------ xlsx okuyucu (standart kütüphane)
def _sayfalar(yol: Path) -> dict[str, list[list]]:
    z = zipfile.ZipFile(yol)
    paylasilan = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            paylasilan.append("".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t")))
    kitap = ET.fromstring(z.read("xl/workbook.xml"))
    iliski = {r.get("Id"): r.get("Target") for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
    sonuc = {}
    for s in kitap.find("m:sheets", NS):
        hedef = iliski[s.get(f"{{{NS['r']}}}id")].lstrip("/")
        hedef = hedef if hedef.startswith("xl/") else "xl/" + hedef
        satirlar = []
        for row in ET.fromstring(z.read(hedef)).iter(f"{{{NS['m']}}}row"):
            hucreler = {}
            for c in row.findall("m:c", NS):
                sutun = re.match(r"[A-Z]+", c.get("r")).group()
                idx = 0
                for ch in sutun:
                    idx = idx * 26 + ord(ch) - 64
                if idx > 40:
                    continue
                v = c.find("m:v", NS)
                t = c.get("t")
                if t == "s" and v is not None:
                    val = paylasilan[int(v.text)]
                elif t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(f"{{{NS['m']}}}t"))
                elif v is not None:
                    try:
                        val = float(v.text)
                    except ValueError:
                        val = v.text
                else:
                    val = None
                hucreler[idx - 1] = val
            if hucreler:
                satirlar.append([hucreler.get(i) for i in range(max(hucreler) + 1)])
        sonuc[s.get("name")] = satirlar
    return sonuc


def _tablo(satirlar, baslik_kolonu="Code"):
    """Başlık satırını bulur; [{başlık: değer}] döner (kodu olan satırlar)."""
    for i, r in enumerate(satirlar):
        if baslik_kolonu in [str(x).strip() if x else "" for x in r]:
            bas = [str(x).strip() if x else "" for x in r]
            veri = []
            for r2 in satirlar[i + 1:]:
                d = {bas[j]: r2[j] if j < len(r2) else None for j in range(len(bas)) if bas[j]}
                if d.get("Code") and d.get("Region"):
                    veri.append(d)
            return veri
    return []


def _sayi(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


# ------------------------------------------------------------------ ana işlev
def oecd_refah(ek_dir: Path, db_path: Path, web_dir: Path, ents: dict, rep) -> None:
    rep.h("OECD Bölgesel Refah (bütün OECD bölgeleri)")
    yol = ek_dir / DOSYA
    if not yol.exists():
        rep.warn(f"{DOSYA} bulunamadı; OECD karşılaştırması atlandı")
        return
    s = _sayfalar(yol)
    puan = {d["Code"]: d for d in _tablo(s.get("Score_Last", []))}
    deger = {d["Code"]: d for d in _tablo(s.get("Indicator_Last", []))}
    egilim = {d["Code"]: d for d in _tablo(s.get("Score_Trend", []))}

    bolgeler, ulkeler = [], []
    for kod, p in puan.items():
        ulke_en = p.get("Country")
        ulke_mi = not ulke_en  # ülke satırlarında ülke sütunu boş, "Region" ülke adıdır
        ad = p["Region"]
        if kod.startswith("TR") and kod in ents:
            ad = ents[kod]["name"]
        g = deger.get(kod, {})
        e = egilim.get(kod, {})
        kayit = {
            "kod": kod,
            "ulke": ULKELER.get(ad if ulke_mi else ulke_en, ad if ulke_mi else ulke_en),
            "ad": ULKELER.get(ad, ad) if ulke_mi else ad,
            "puan": [_yuvarla(_sayi(p.get(en)), 2) for _, _, en in KONULAR],
            "deger": [_yuvarla(_sayi(g.get(en)), 2) for _, _, en, _, _ in GOSTERGELER],
            "egilim": [e.get(en) if e.get(en) in ("+", "-", "=") else None for _, _, en in KONULAR],
        }
        (ulkeler if ulke_mi else bolgeler).append(kayit)

    # Türkiye'nin iş göstergeleri: OECD dosyasındaki değerler TÜİK ile tutmuyor (bkz. docs/DENETIM.md, madde 11).
    # Türkiye ve Düzey 2 bölgeleri için TÜİK HİA değerleri (15+ yaş, dosyanın referans yılı 2024) kullanılır;
    # OECD'nin bu hatalı değerlerden türettiği "İş" puanı Türkiye için boş bırakılır.
    ji, ju = (next(i for i, g in enumerate(GOSTERGELER) if g[0] == x) for x in ("istihdam", "issizlik"))
    k_is = [k[0] for k in KONULAR].index("is")
    con = sqlite3.connect(db_path)
    try:
        tuik = {ad: dict(con.execute("SELECT geo, value FROM values_long WHERE indicator=? AND time=?", (ad, TUIK_YIL)))
                for ad in (TUIK_ISTIHDAM, TUIK_ISSIZLIK)}
    finally:
        con.close()
    degisen = 0
    hedef = [(b["kod"], b) for b in bolgeler if b["kod"].startswith("TR")] + \
            [("TR", b) for b in ulkeler if b["ulke"] == "Türkiye"]
    for kod, b in hedef:
        b["deger"][ji] = _yuvarla(tuik[TUIK_ISTIHDAM].get(kod), 2)
        b["deger"][ju] = _yuvarla(tuik[TUIK_ISSIZLIK].get(kod), 2)
        b["puan"][k_is] = None
        b["egilim"][k_is] = None
        degisen += 1
    rep.info(f"Türkiye iş göstergeleri TÜİK {TUIK_YIL} değerleriyle değiştirildi ({degisen} kayıt); "
             "Türkiye için OECD İş puanı kullanılmıyor")
    if not tuik[TUIK_ISTIHDAM] or not tuik[TUIK_ISSIZLIK]:
        rep.warn(f"TÜİK {TUIK_YIL} istihdam/işsizlik değerleri veri.db'de bulunamadı; Türkiye iş göstergeleri boş kaldı")

    # Türkiye bölgeleri için başka ülkelerden en benzer 5 bölge (ortak konulardaki puan uzaklığı).
    # "İş" konusu dışarıda: OECD dosyasındaki Türkiye istihdam/işsizlik değerleri TÜİK ile tutmuyor (bkz. rapor).
    haric = {[k[0] for k in KONULAR].index("is")}

    def uzaklik(a, b):
        ortak = [(x, y) for i, (x, y) in enumerate(zip(a["puan"], b["puan"]))
                 if i not in haric and x is not None and y is not None]
        if len(ortak) < 8:
            return None
        return math.sqrt(sum((x - y) ** 2 for x, y in ortak) / len(ortak))

    benzer = {}
    for a in bolgeler:
        if not a["kod"].startswith("TR"):
            continue
        adaylar = [(uzaklik(a, b), b["kod"]) for b in bolgeler if b["ulke"] != a["ulke"]]
        benzer[a["kod"]] = [[k, round(d, 2)] for d, k in sorted(x for x in adaylar if x[0] is not None)[:5]]

    tr = [b for b in bolgeler if b["kod"].startswith("TR")]
    rep.info(f"{len(bolgeler)} bölge ({len({b['ulke'] for b in bolgeler})} ülke), {len(ulkeler)} ülke ortalaması; "
             f"Türkiye'den {len(tr)} bölge")

    con = sqlite3.connect(db_path)
    try:
        con.executescript("""
            DROP TABLE IF EXISTS oecd_bolgeler; DROP TABLE IF EXISTS oecd_refah;
            CREATE TABLE oecd_bolgeler (kod TEXT PRIMARY KEY, ulke TEXT, ad TEXT, tur TEXT);
            CREATE TABLE oecd_refah (kod TEXT NOT NULL, tur TEXT NOT NULL, alan TEXT NOT NULL, deger REAL, metin TEXT);
            CREATE INDEX idx_oecd_refah ON oecd_refah(alan, tur);
        """)
        for tur, liste in (("bolge", bolgeler), ("ulke", ulkeler)):
            for b in liste:
                con.execute("INSERT OR REPLACE INTO oecd_bolgeler VALUES (?,?,?,?)", (b["kod"], b["ulke"], b["ad"], tur))
                for (kid, *_), v, e in zip(KONULAR, b["puan"], b["egilim"]):
                    if v is not None:
                        con.execute("INSERT INTO oecd_refah VALUES (?,?,?,?,NULL)", (b["kod"], "puan", kid, v))
                    if e:
                        con.execute("INSERT INTO oecd_refah VALUES (?,?,?,NULL,?)", (b["kod"], "egilim", kid, e))
                for (gid, *_), v in zip(GOSTERGELER, b["deger"]):
                    if v is not None:
                        con.execute("INSERT INTO oecd_refah VALUES (?,?,?,?,NULL)", (b["kod"], "gosterge", gid, v))
        con.commit()
    finally:
        con.close()

    web_dir.mkdir(parents=True, exist_ok=True)
    (web_dir / "oecd-refah.json").write_text(json.dumps({
        "kaynak": "OECD Regional Well-Being (oecdregionalwellbeing.org), 2024 ya da son yıl",
        "konular": [{"id": i, "ad": a} for i, a, _ in KONULAR],
        "gostergeler": [{"id": i, "ad": a, "konu": k, "birim": b} for i, a, _, k, b in GOSTERGELER],
        "bolgeler": bolgeler,
        "ulkeler": ulkeler,
        "benzer": benzer,
        "benzer_not": "Benzerlik İş konusu dışındaki ortak konuların 0-10 puanlarıyla hesaplandı.",
        "tuik_not": f"Türkiye ve Düzey 2 bölgelerinde istihdam ve işsizlik oranı TÜİK Hanehalkı İşgücü Araştırması "
                    f"({TUIK_YIL}, 15+ yaş) değerleridir; OECD dosyasındaki Türkiye değerleri kullanılmamıştır.",
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    rep.info("Yazıldı: `public/veri/oecd-refah.json`, veri.db `oecd_bolgeler` / `oecd_refah`")


def _yuvarla(x, n):
    return None if x is None else round(x, n)
