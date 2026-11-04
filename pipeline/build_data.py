"""
build_data.py
--------------------------------
Sitenin dağınık CSV dosyalarını TEK bir veri katmanında birleştirir ve
web için parçalı JSON dosyaları üretir.

Şema, VizStudio'daki gostergeler.db ile aynıdır (veri_katmani_olustur.py):

    entities(geo, name, level, parent, plate)
    indicators(indicator, id, category, unit, decimals, source)
    values_long(geo, time, indicator, value, source_file)

Böylece VizStudio araçları (harita_render, infografik_uret, hikaye_...)
bu veritabanını da doğrudan okuyabilir.

Düzeyler (level):
    country   -> TR
    region12  -> İBBS Düzey 1 (TR1 ... TRC)
    region26  -> İBBS Düzey 2 (TR10 ... TRC3)
    province  -> İBBS Düzey 3 = il (TR100 ... TRC33)
    district  -> ilçe (ILCE<ilçe kodu>)

Kullanım:
    python pipeline/build_data.py                       # varsayılan: kaynaklar/eski-site/data
    python pipeline/build_data.py --kaynak D:/veri/ham  # farklı ham veri klasörü

Çıktılar:
    build/veri.db                 SQLite (VizStudio uyumlu)
    public/veri/manifest.json     kategori -> gösterge listesi, yıllar, düzeyler
    public/veri/k/<kategori>.json kategori başına değerler (il/Düzey1/Düzey2/TR)
    public/veri/ilce/<id>.json    ilçe düzeyi değerler (gösterge başına)
    public/veri/geo/<düzey>.json  sadeleştirilmiş sınırlar, özellik = kod
    build/rapor.md                doğrulama raporu (uyarılar, çakışmalar)

Gereksinim: yalnızca Python 3.9+ standart kütüphanesi.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import io
import json
import re
import sqlite3
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from temizlik import temizle
from oecd_refah import oecd_refah
from il_tipolojisi import il_tipolojisi
from kaynak_turu import tur as kaynak_turu, gorunen as gorunen_ad, kisa as kisa_kaynak
from ekler import load_additions  # noqa: E402
from utm import donustur as utm_donustur  # ilçe sınırları UTM 36K (metre) → boylam/enlem

ROOT = Path(__file__).resolve().parent.parent

LEVELS = ["country", "region12", "region26", "province", "district", "fua", "city"]

# OECD işlevsel kentsel alan (FUA) ve şehir sınırları — veri-ekleri/geo/ altında (isteğe bağlı)
OECD_GEO = {"fua": ("oecd-fua.geojson", "fuacode", "fuaname"),
            "city": ("oecd-sehir.geojson", "citycode", "cityname")}

# Ham kaynak dosyalar - sıra önemli: aynı (geo, yıl, gösterge) birden fazla
# dosyada varsa İLK dosyadaki değer esas alınır, diğerleri karşılaştırılır.
STAT_SOURCES = ["infografik.csv.gz", "trveriler.csv.gz"]  # gösterge sırası ilk dosyadan gelir
DISTRICT_SOURCE = "ilcetr.csv.gz"
GEO_MAIN = "tr.geojson"
GEO_DISTRICT_ZIP = "data.zip"  # içinde harita.geojson


# --------------------------------------------------------------------------
# Yardımcılar
# --------------------------------------------------------------------------
TR_LOWER = str.maketrans({"I": "ı", "İ": "i"})
ASCII_MAP = str.maketrans("çğıöşüâîû", "cgiosuaiu")


def tr_key(s: str) -> str:
    """Türkçe-duyarlı eşleştirme anahtarı: 'İSTANBUL' == 'istanbul' == 'Istanbul'."""
    s = (s or "").strip().translate(TR_LOWER).lower()
    s = s.translate(ASCII_MAP)
    return re.sub(r"[^a-z0-9]+", "", s)


def slugify(s: str) -> str:
    s = (s or "").strip().translate(TR_LOWER).lower().translate(ASCII_MAP)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def n(x) -> str:
    """Türkçe binlik ayırıcı: 1234567 -> '1.234.567'."""
    return f"{x:,.0f}".replace(",", ".")


def clean_text(s: str | None) -> str:
    """Baş/son boşlukları ve çift boşlukları temizler (\xa0 dahil)."""
    return re.sub(r"\s+", " ", (s or "").replace("\xa0", " ")).strip()


def parse_value(s: str | None):
    """'15,88' -> 15.88 ; '' -> None. Kaynakta binlik ayırıcı yok (doğrulandı)."""
    s = (s or "").strip()
    if not s:
        return None
    try:
        return float(s.replace(",", "."))
    except ValueError:
        return None


def level_of(code: str) -> str | None:
    if code == "TR":
        return "country"
    if re.fullmatch(r"TR[0-9A-Z]", code):
        return "region12"
    if re.fullmatch(r"TR[0-9A-Z]{2}", code):
        return "region26"
    if re.fullmatch(r"TR[0-9A-Z]{2}\d", code):
        return "province"
    return None


def parent_of(code: str, level: str) -> str | None:
    return {"region12": "TR", "region26": code[:3], "province": code[:4]}.get(level)


def extract_unit(name: str) -> str | None:
    """VizStudio/birim_ondalik_otomatik_ata.py ile aynı kural."""
    m = re.search(r"\(([^()]{1,15})\)\s*$", name)
    return m.group(1).strip() if m else None


def infer_decimals(values) -> int:
    """Gösterimde kullanılacak ondalık basamak sayısı.
    VizStudio/birim_ondalik_otomatik_ata.py kuralı (gereken kadar, en fazla 2) + bir istisna:
    değerlerin tamamı 1'den küçükse (Gini katsayısı gibi) 3 basamağa kadar izin verilir,
    yoksa 0,425 ile 0,42 aynı görünür."""
    vals = [v for v in values if v is not None]
    if not vals:
        return 0
    ust = 3 if max(abs(v) for v in vals) < 1 else 2
    max_dec = 0
    for v in vals:
        for d in range(0, 5):
            if abs(round(v, d) - v) < 1e-6:
                max_dec = max(max_dec, d)
                break
        else:
            max_dec = 4
        if max_dec >= ust:
            return ust
    return max_dec


def read_csv(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8-sig", newline="") as f:
        yield from csv.DictReader(f, delimiter=";")


def round_coords(obj, nd=4):
    if isinstance(obj, list):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], nd), round(obj[1], nd)]
        return [round_coords(o, nd) for o in obj]
    return obj


# --------------------------------------------------------------------------
# Rapor
# --------------------------------------------------------------------------
class Report:
    def __init__(self):
        self.lines: list[str] = []
        self.warnings = 0

    def h(self, t):
        self.lines += ["", f"## {t}", ""]

    def ok(self, t):
        self.lines.append(f"- ✔ {t}")

    def warn(self, t):
        self.warnings += 1
        self.lines.append(f"- ⚠ {t}")

    def info(self, t):
        self.lines.append(f"- {t}")

    def write(self, path: Path):
        head = ["# Veri hattı raporu", "", f"Uyarı sayısı: **{self.warnings}**"]
        path.write_text("\n".join(head + self.lines) + "\n", encoding="utf-8")


# --------------------------------------------------------------------------
# 1) İstatistik dosyaları (TR / Düzey1 / Düzey2 / il)
# --------------------------------------------------------------------------
def load_stats(src: Path, rep: Report):
    values: dict[tuple, float | None] = {}
    origin: dict[tuple, str] = {}
    ind_meta: dict[str, dict] = {}
    names: dict[str, Counter] = defaultdict(Counter)
    conflicts: list[tuple] = []
    dup_same = 0
    category_clash: dict[str, set] = defaultdict(set)

    rep.h("Kaynak dosyalar")
    for fname in STAT_SOURCES:
        path = src / fname
        if not path.exists():
            rep.warn(f"{fname} bulunamadı, atlandı")
            continue
        count = 0
        for row in read_csv(path):
            code = clean_text(row.get("kod"))
            lvl = level_of(code)
            if not lvl:
                continue
            ind = clean_text(row.get("veri"))
            cat = clean_text(row.get("kategori"))
            year = clean_text(row.get("yil"))
            if not (ind and cat and year.isdigit()):
                continue
            count += 1
            val = parse_value(row.get("deger"))
            nm = clean_text(row.get("il")) if lvl == "province" else clean_text(row.get("isim"))
            names[code][nm] += 1

            m = ind_meta.setdefault(ind, {"category": cat, "sources": Counter()})
            if m["category"] != cat:
                category_clash[ind].add(cat)
            m["sources"][clean_text(row.get("Veri Kaynağı"))] += 1

            key = (code, year, ind)
            if key in values:
                old = values[key]
                if old is None and val is not None:
                    values[key] = val
                elif val is not None and old is not None and abs(old - val) > 1e-9 * max(1, abs(old)):
                    conflicts.append((key, old, val, origin[key], fname))
                else:
                    dup_same += 1
                continue
            values[key] = val
            origin[key] = fname
        rep.info(f"`{fname}`: {n(count)} satır okundu")

    rep.h("Tekrar ve çakışmalar")
    rep.info(f"Birebir tekrar eden satır (atıldı): {n(dup_same)}")
    if conflicts:
        rep.warn(f"Aynı bölge-yıl-gösterge için FARKLI değer: {len(conflicts)} (ilk dosyadaki değer tutuldu)")
        for (code, year, ind), a, b, fa, fb in conflicts[:20]:
            rep.info(f"  `{code}` {year} · {ind}: {a} ({fa}) ≠ {b} ({fb})")
    else:
        rep.ok("Dosyalar arası değer çakışması yok")
    for ind, cats in category_clash.items():
        rep.warn(f"'{ind}' birden fazla kategoride: {ind_meta[ind]['category']} + {', '.join(cats)}")

    return values, ind_meta, names, origin


# --------------------------------------------------------------------------
# 2) Bölgeler (entities)
# --------------------------------------------------------------------------
# tr.geojson (geoBoundaries) Çanakkale'yi Zonguldak'ın koduyla (TR-67) etiketliyor.
# Geometri artık isimle eşlenir; plaka yalnızca bilgi amaçlıdır ve burada düzeltilir.
PLAKA_DUZELTME = {"Çanakkale": 17}


def build_entities(names, geo_main, rep: Report):
    ents = {}
    for code, cnt in names.items():
        lvl = level_of(code)
        # En uzun / en çok geçen ismi seç (örn. 'Afyonkarahisar' > 'Afyon')
        name = sorted(cnt.items(), key=lambda kv: (-len(kv[0]), -kv[1]))[0][0]
        if lvl == "country":
            name = "Türkiye"
        ents[code] = {"geo": code, "name": name, "level": lvl, "parent": parent_of(code, lvl), "plate": None}

    # İl plaka kodu: tr.geojson ADM1 (shapeISO 'TR-34') ile isim üzerinden eşle
    rep.h("Bölge eşleştirme")
    by_key = {tr_key(e["name"]): e for e in ents.values() if e["level"] == "province"}
    unmatched = []
    for f in geo_main["features"]:
        p = f["properties"]
        if p.get("Level") != "ADM1":
            continue
        e = by_key.get(tr_key(p.get("name")))
        if e:
            e["plate"] = PLAKA_DUZELTME.get(e["name"], int(p["shapeISO"].split("-")[1]))
        else:
            unmatched.append(p.get("name"))
    if unmatched:
        rep.warn(f"Haritada olup veride eşleşmeyen iller: {', '.join(unmatched)}")
    else:
        rep.ok("81 ilin tamamı harita ile kod üzerinden eşleşti")

    counts = Counter(e["level"] for e in ents.values())
    rep.info("Bölge sayıları: " + ", ".join(f"{k}={counts.get(k, 0)}" for k in LEVELS[:4]))
    expected = {"country": 1, "region12": 12, "region26": 26, "province": 81}
    for k, v in expected.items():
        if counts.get(k, 0) != v:
            rep.warn(f"{k} için {v} beklenirken {counts.get(k, 0)} bulundu")
    return ents


# --------------------------------------------------------------------------
# 3) İlçeler
# --------------------------------------------------------------------------
# Kaynakta son yılda bozuk yazılmış ilçe adları (ör. 2025'te "Samsun-Mayıs")
ILCE_AD_DUZELTME = {"1830": "19 Mayıs"}


def load_districts(src: Path, ents, ind_meta, rep: Report):
    path = src / DISTRICT_SOURCE
    values = {}
    if not path.exists():
        rep.warn(f"{DISTRICT_SOURCE} yok, ilçe düzeyi atlandı")
        return values
    prov_by_key = {tr_key(e["name"]): e["geo"] for e in ents.values() if e["level"] == "province"}
    latest_name: dict[str, tuple] = {}
    missing_prov = set()
    for row in read_csv(path):
        kod = clean_text(row.get("kod"))
        year = clean_text(row.get("yil"))
        ind = clean_text(row.get("veri"))
        if not (kod.isdigit() and year.isdigit() and ind):
            continue
        geo = f"ILCE{kod}"
        il = clean_text(row.get("il"))
        ilce = clean_text(row.get("ilce"))
        # "Hakkâri-Hakkâri" (il sütunu "Hakkari"): önek il adıyla Türkçe-duyarlı karşılaştırılır
        on, tire, kalan = ilce.partition("-")
        if tire and tr_key(on) == tr_key(il):
            ilce = kalan
        ilce = ILCE_AD_DUZELTME.get(kod, ilce)
        if geo not in latest_name or year > latest_name[geo][0]:
            latest_name[geo] = (year, ilce, il)
        ind_meta.setdefault(ind, {"category": clean_text(row.get("kategori")), "sources": Counter()})
        ind_meta[ind]["sources"][clean_text(row.get("veri_kaynagi"))] += 1
        ind_meta[ind].setdefault("district", True)
        values[(geo, year, ind)] = parse_value(row.get("deger"))
    for geo, (_, ilce, il) in latest_name.items():
        parent = prov_by_key.get(tr_key(il))
        if not parent:
            missing_prov.add(il)
        ents[geo] = {"geo": geo, "name": ilce, "level": "district", "parent": parent, "plate": None}
    rep.info(f"İlçe: {len(latest_name)} ilçe, {n(len(values))} değer")
    if missing_prov:
        rep.warn(f"İl adı eşleşmeyen ilçe kayıtları: {', '.join(sorted(missing_prov))}")
    return values


# --------------------------------------------------------------------------
# 4) Doğrulama: toplanabilir göstergelerde il toplamı ≈ Türkiye
# --------------------------------------------------------------------------
# Toplanamayan göstergeler: oranlar, ortalamalar ve zincirlenmiş hacim serileri (zincirleme toplamı bozar)
def _halka_alani(r):
    return sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1)) / 2


def d3_yonu(geom):
    """D3'ün beklediği halka yönü: dış halka saat yönünde, delikler tersine.
    (RFC 7946 tersini önerir; ters yönlü bir poligon D3'te tüm dünyayı kaplar.)"""
    def poligon(p):
        return [r if (_halka_alani(r) < 0) == (i == 0) else r[::-1] for i, r in enumerate(p)]
    if geom["type"] == "Polygon":
        return {"type": "Polygon", "coordinates": poligon(geom["coordinates"])}
    if geom["type"] == "MultiPolygon":
        return {"type": "MultiPolygon", "coordinates": [poligon(p) for p in geom["coordinates"]]}
    return geom


def load_oecd_geo(ek_dir: Path, ents, rep: Report):
    """OECD FUA ve şehir sınırlarını okur, `fua` / `city` düzeyinde bölge olarak ekler.
    OECD adları ASCII'dir (Izmir, Nevsehir); il adıyla eşleşenler Türkçe yazımıyla alınır."""
    feats = {}
    il_adi = {tr_key(e["name"]): e["name"] for e in ents.values() if e["level"] == "province"}
    for lvl, (dosya, kod_alani, ad_alani) in OECD_GEO.items():
        p = ek_dir / "geo" / dosya
        if not p.exists():
            continue
        g = json.loads(p.read_text(encoding="utf-8"))
        out = []
        for f in g["features"]:
            pr = f["properties"]
            kod = pr.get(kod_alani)
            ham = pr.get(ad_alani) or kod
            ad = il_adi.get(tr_key(ham), ham)
            ents[kod] = {"geo": kod, "name": ad, "level": lvl,
                         "parent": pr.get("fuacode") if lvl == "city" else None, "plate": None}
            out.append({"type": "Feature", "id": kod, "properties": {"kod": kod, "ad": ad},
                        "geometry": d3_yonu({"type": f["geometry"]["type"],
                                             "coordinates": round_coords(f["geometry"]["coordinates"])})})
        feats[lvl] = out
        rep.info(f"OECD {lvl}: {len(out)} birim (`{dosya}`)")
    return feats


# Toplanamayan göstergeler (oran, ortalama, iklim ölçüleri) ve bölgeye dağıtılamayan payı olan sayımlar
# (OECD PCT patentlerinin bir kısmı hiçbir bölgeye atanmaz; il toplamı Türkiye'den küçüktür)
ORAN_IPUCU = re.compile(r"(%|oran|başına|düşen|ortalama|endeks|hız|binde|sıra|zincirlen|süre|iklim|derece-gün|patent|değişim|artış|fark)", re.I)


def check_sums(values, ents, rep: Report, extra=(), ind_meta=None):
    """Toplanabilir göstergelerde il toplamı = Düzey 2 toplamı = Türkiye olmalı.
    Oran/ortalama türü göstergeler (adında %, oranı, başına, düşen... geçen) kontrol edilmez."""
    rep.h("Tutarlılık kontrolü (il toplamı = Düzey 2 toplamı = Türkiye)")
    probes = ["Toplam Nüfus"] + sorted(i for i in extra if not ORAN_IPUCU.search(i))
    # Tek geçişte indeks: gösterge -> yıl -> düzey -> toplam (eskiden her gösterge için tüm değerler
    # taranıyordu; 700+ yeni gösterge ile dakikalar sürüyordu)
    hedef = set(probes)
    toplam = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    for (g, yy, i), v in values.items():
        if i in hedef and v:
            lv = "TR" if g == "TR" else ents.get(g, {}).get("level")
            if lv in ("TR", "province", "region26"):
                toplam[i][yy][lv] += v
    kapsam_disi = []
    for ind in probes:
        years = sorted(y for y, d in toplam[ind].items() if "TR" in d)
        if not years:
            continue
        y = years[-1]
        d = toplam[ind][y]
        tr, s3, s2 = d["TR"], d.get("province"), d.get("region26")
        karsilastir = [s for s in (s3, s2) if s is not None]
        if not karsilastir:
            kapsam_disi.append(ind)
            continue
        # Bin kişi gibi yuvarlanmış birimlerde 26 bölgenin yuvarlama farkı birikir (en fazla 26 × 0,5)
        tolerans = max(0.001 * abs(tr or 0), 13 if "(Bin" in ind else 0)
        if tr and all(abs(s - tr) <= tolerans for s in karsilastir):
            rep.ok(f"{ind} {y}: il toplamı {n(s3) if s3 is not None else '–'} = Düzey2 toplamı "
                   f"{n(s2) if s2 is not None else '–'} = Türkiye {n(tr)}")
        else:
            rep.warn(f"{ind} {y}: il {n(s3 or 0)} / Düzey2 {n(s2 or 0)} / Türkiye {n(tr or 0)}")
    if kapsam_disi:
        rep.info(f"Yalnızca Türkiye/Düzey 1 değeri olduğu için toplam kontrolü yapılamayan: {len(kapsam_disi)} gösterge")
    atlanan = sorted(i for i in extra if ORAN_IPUCU.search(i))
    if atlanan:
        rep.info("Oran/ortalama olduğu için toplam kontrolü yapılmayan yeni göstergeler: " + "; ".join(atlanan))


# --------------------------------------------------------------------------
# 5) SQLite (VizStudio uyumlu)
# --------------------------------------------------------------------------
def write_db(db_path: Path, ents, indicators, values, dvalues, origin):
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.executescript(
        """
        CREATE TABLE entities (geo TEXT PRIMARY KEY, name TEXT, level TEXT, parent TEXT, plate INTEGER);
        CREATE TABLE indicators (indicator TEXT PRIMARY KEY, id TEXT UNIQUE, category TEXT,
                                 unit TEXT, decimals INTEGER, source TEXT, kaynak_turu TEXT, kaynak_aciklama TEXT);
        CREATE TABLE values_long (geo TEXT NOT NULL, time TEXT NOT NULL, indicator TEXT NOT NULL,
                                  value REAL, value_text TEXT, source_file TEXT,
                                  UNIQUE(geo, time, indicator, source_file));
        CREATE INDEX ix_values_ind ON values_long(indicator, time);
        """
    )
    con.executemany("INSERT INTO entities VALUES (:geo,:name,:level,:parent,:plate)", ents.values())
    con.executemany(
        "INSERT INTO indicators VALUES (:indicator,:id,:category,:unit,:decimals,:source,:kaynak_turu,:kaynak_aciklama)", indicators.values()
    )
    con.executemany(
        "INSERT INTO values_long(geo,time,indicator,value,source_file) VALUES (?,?,?,?,?)",
        ((g, y, i, v, origin.get((g, y, i), DISTRICT_SOURCE if g.startswith("ILCE") else "dakaveri"))
         for (g, y, i), v in list(values.items()) + list(dvalues.items())),
    )
    con.commit()
    con.close()


# --------------------------------------------------------------------------
# 6) Web çıktısı
# --------------------------------------------------------------------------
def fmt_num(v, dec):
    if v is None:
        return None
    # Web dosyasında veri kaybı olmasın: gösterim ondalığından bağımsız olarak 4 basamak saklanır
    return int(round(v)) if dec == 0 and float(v).is_integer() else round(v, 4)


def write_web(out: Path, ents, indicators, values, dvalues, geo_main, src: Path, rep: Report, ek_geo=None):
    (out / "k").mkdir(parents=True, exist_ok=True)
    (out / "ilce").mkdir(parents=True, exist_ok=True)
    (out / "geo").mkdir(parents=True, exist_ok=True)

    by_cat: dict[str, dict] = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    ind_levels: dict[str, set] = defaultdict(set)
    ind_years: dict[str, set] = defaultdict(set)
    for (g, y, i), v in values.items():
        if v is None or not indicators[i]["yayin"]:
            continue
        meta = indicators[i]
        by_cat[meta["category"]][meta["id"]][y][g] = fmt_num(v, meta["decimals"])
        ind_levels[i].add(ents[g]["level"])
        ind_years[i].add(int(y))

    d_by_ind: dict[str, dict] = defaultdict(lambda: defaultdict(dict))
    for (g, y, i), v in dvalues.items():
        if v is None or not indicators[i]["yayin"]:
            continue
        meta = indicators[i]
        d_by_ind[meta["id"]][y][g] = fmt_num(v, meta["decimals"])
        ind_levels[i].add("district")
        ind_years[i].add(int(y))

    total = 0
    for cat, data in by_cat.items():
        p = out / "k" / f"{slugify(cat)}.json"
        p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        total += p.stat().st_size
    for iid, data in d_by_ind.items():
        (out / "ilce" / f"{iid}.json").write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )

    cats = defaultdict(list)
    for name, m in indicators.items():  # kaynak dosyadaki sıra korunur
        if not ind_years[name]:
            continue
        cats[m["category"]].append(
            {
                "id": m["id"],
                "ad": gorunen_ad(name, m["source"]),
                "birim": m["unit"],
                "ondalik": m["decimals"],
                "kaynak": m["source"],
                **({"kaynakKisa": kisa_kaynak(name, m["source"])} if kisa_kaynak(name, m["source"]) else {}),
                **({"not": m["not"]} if m.get("not") else {}),
                **({"kaynakTuru": m["kaynak_turu"]} if m.get("kaynak_turu") != "ulusal" else {}),
                **({"kaynakAciklama": m["kaynak_aciklama"]} if m.get("kaynak_aciklama") else {}),
                "yillar": sorted(ind_years[name]),
                "duzeyler": [lv for lv in LEVELS if lv in ind_levels[name]],
            }
        )
    manifest = {
        "surum": 2,
        "kategoriler": [
            {"ad": c, "slug": slugify(c), "dosya": f"k/{slugify(c)}.json", "gostergeler": lst}
            for c, lst in sorted(cats.items())
        ],
        "bolgeler": {
            g: {"ad": e["name"], "duzey": e["level"], "ust": e["parent"], "plaka": e["plate"]}
            for g, e in sorted(ents.items())
            if e["level"] != "district"
        },
    }
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "ilceler.json").write_text(
        json.dumps(
            {g: {"ad": e["name"], "ust": e["parent"]} for g, e in ents.items() if e["level"] == "district"},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )

    # --- Geometri: her düzey ayrı dosya, özellik kimliği = bölge kodu
    # İller isimle eşlenir (kaynak geojson'daki shapeISO kodu bir ilde hatalı, bkz. PLAKA_DUZELTME)
    name_to_geo = {tr_key(e["name"]): g for g, e in ents.items() if e["level"] == "province"}
    level_map = {"D0": "country", "D1": "region12", "D2": "region26", "ADM1": "province"}
    per_level = defaultdict(list)
    for f in geo_main["features"]:
        p = f["properties"]
        lvl = level_map.get(p.get("Level"))
        if not lvl:
            continue
        code = name_to_geo.get(tr_key(p.get("name"))) if lvl == "province" else p["shapeISO"]
        if not code:
            continue
        per_level[lvl].append(
            {"type": "Feature", "id": code, "properties": {"kod": code, "ad": ents.get(code, {}).get("name", code)},
             "geometry": {"type": f["geometry"]["type"], "coordinates": round_coords(f["geometry"]["coordinates"])}}
        )
    zp = src / GEO_DISTRICT_ZIP
    if zp.exists():
        with zipfile.ZipFile(zp) as z:
            name = next((n for n in z.namelist() if n.endswith(".geojson")), None)
            if name:
                gd = json.load(io.TextIOWrapper(z.open(name), encoding="utf-8"))
                for f in gd["features"]:
                    p = f["properties"]
                    code = f"ILCE{p.get('ilcekod')}"
                    per_level["district"].append(
                        {"type": "Feature", "id": code,
                         "properties": {"kod": code, "ad": ents.get(code, {}).get("name", p.get("shapeName"))},
                         "geometry": {"type": f["geometry"]["type"],
                                      "coordinates": utm_donustur(f["geometry"]["coordinates"])}}
                    )
    for lvl, feats in (ek_geo or {}).items():
        per_level[lvl] = feats
    for lvl, feats in per_level.items():
        (out / "geo" / f"{lvl}.json").write_text(
            json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )

    rep.h("Web çıktısı")
    rep.info(f"{len(by_cat)} kategori dosyası, toplam {total/1e6:.1f} MB (sunucu gzip ile ~%20'si iner)")
    rep.info(f"{len(d_by_ind)} ilçe göstergesi dosyası")
    rep.info("Geometri: " + ", ".join(f"{k}={len(v)}" for k, v in per_level.items()))


# Ham veri depo içinde tutulur; eski site klasörü yalnızca geçiş dönemi için yedek yoldur.
VARSAYILAN_KAYNAK = next(
    (p for p in (ROOT / "kaynaklar" / "eski-site" / "data", ROOT.parent / "dakaveri" / "data") if p.exists()),
    ROOT / "kaynaklar" / "eski-site" / "data",
)


# --------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--kaynak", default=str(VARSAYILAN_KAYNAK), help="ham veri klasörü")
    ap.add_argument("--db", default=str(ROOT / "build" / "veri.db"))
    ap.add_argument("--web", default=str(ROOT / "public" / "veri"))
    ap.add_argument("--ekler", default=str(ROOT / "veri-ekleri"), help="ek kaynak klasörü (CSV şablonu / VizStudio .db)")
    ap.add_argument("--oncelik", choices=["ek", "mevcut"], default="ek",
                    help="aynı değer iki yerde farklıysa hangisi geçerli (varsayılan: ek)")
    args = ap.parse_args(argv)

    src = Path(args.kaynak)
    if not src.exists():
        sys.exit(f"Ham veri klasörü bulunamadı: {src}\n--kaynak ile belirtin.")
    rep = Report()

    geo_main = json.loads((src / GEO_MAIN).read_text(encoding="utf-8"))
    values, ind_meta, names, origin = load_stats(src, rep)
    ents = build_entities(names, geo_main, rep)
    dvalues = load_districts(src, ents, ind_meta, rep)
    rep.h("OECD kent sınırları")
    ek_geo = load_oecd_geo(Path(args.ekler), ents, rep)
    yeni = load_additions(Path(args.ekler), ents, ind_meta, values, dvalues, origin, rep, n,
                          ROOT / "build", args.oncelik)
    temizle(values, ind_meta, ents, origin, Path(args.ekler), ROOT / "build", rep, n)
    check_sums(values, ents, rep, extra=yeni, ind_meta=ind_meta)

    # Gösterge metadatası
    rep.h("Göstergeler")
    by_ind_vals = defaultdict(list)
    for (g, y, i), v in list(values.items()) + list(dvalues.items()):
        if v is not None and len(by_ind_vals[i]) < 2000:
            by_ind_vals[i].append(v)
    indicators, used_ids = {}, set()
    for name, m in ind_meta.items():
        iid = slugify(name)[:80] or "gosterge"
        base, k = iid, 2
        while iid in used_ids:
            iid, k = f"{base}-{k}", k + 1
        used_ids.add(iid)
        src_name = m["sources"].most_common(1)[0][0] if m["sources"] else None
        indicators[name] = {
            "indicator": name,
            "id": iid,
            "category": m["category"],
            "unit": extract_unit(name),
            "decimals": infer_decimals(by_ind_vals[name]),
            "source": src_name,
            "yayin": m.get("yayin", True),
        }
        indicators[name]["kaynak_turu"], indicators[name]["kaynak_aciklama"] = kaynak_turu(name, src_name)
    rep.info(f"{len(indicators)} gösterge, {len({m['category'] for m in indicators.values()})} kategori; "
             f"sitede {sum(m['yayin'] for m in indicators.values())}, "
             f"yalnızca veri.db'de {sum(not m['yayin'] for m in indicators.values())}")
    no_unit = [n for n, m in indicators.items() if not m["unit"]]
    rep.info(f"Adında birim olmayan gösterge: {len(no_unit)} (sayı/adet varsayılır)")

    # Gösterge notları (veri-ekleri/gosterge-notlari.csv: gosterge;not) — sitede kaynak satırının altında
    notlar_yol = Path(args.ekler) / "gosterge-notlari.csv"
    if notlar_yol.exists():
        with open(notlar_yol, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                ad, metin = (r.get("gosterge") or "").strip(), (r.get("not") or "").strip()
                if ad in indicators and metin:
                    indicators[ad]["not"] = metin
                elif ad:
                    rep.warn(f"gosterge-notlari.csv: gösterge bulunamadı: {ad}")
    # Mükerrer göstergeler (veri-ekleri/yayinlanmayacak.csv: gosterge;tutulan;neden) sitede gösterilmez, veri.db'de kalır
    muk_yol = Path(args.ekler) / "yayinlanmayacak.csv"
    if muk_yol.exists():
        say = 0
        with open(muk_yol, encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                ad = (r.get("gosterge") or "").strip()
                if ad in indicators:
                    indicators[ad]["yayin"] = False
                    say += 1
                elif ad:
                    rep.warn(f"yayinlanmayacak.csv: gösterge bulunamadı: {ad}")
        rep.info(f"Mükerrer olduğu için sitede gösterilmeyen gösterge: {say}")
    write_db(Path(args.db), ents, indicators, values, dvalues, origin)
    write_web(Path(args.web), ents, indicators, values, dvalues, geo_main, src, rep, ek_geo)
    oecd_refah(Path(args.ekler), Path(args.db), Path(args.web), ents, rep)
    il_tipolojisi(Path(args.ekler), Path(args.db), Path(args.web), ents, rep)

    rp = ROOT / "build" / "rapor.md"
    rp.parent.mkdir(parents=True, exist_ok=True)
    rep.write(rp)
    print(f"Tamam: {n(len(values) + len(dvalues))} değer, {len(indicators)} gösterge, "
          f"{rep.warnings} uyarı -> {rp}")


if __name__ == "__main__":
    main()
