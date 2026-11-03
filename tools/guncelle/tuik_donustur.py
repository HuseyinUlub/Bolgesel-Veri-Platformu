"""
tuik_donustur.py — TÜİK SDMX akışlarını eşleme tablosuna göre platform göstergelerine çevirir.

Eşleme tablosu: pipeline/donusturuculer/eslemeler/tuik.csv (noktalı virgül, UTF-8)

    akis;surum;geo;filtre;payda;carpan;topla;gosterge;kategori;durum;eslesme;not

    akis     TÜİK veri akışı (ör. DF_ADNKS_T06)
    surum    akış sürümü (ör. 1.1)
    geo      coğrafi kodları taşıyan boyut (REF_AREA, IKAMET_YERI ...)
    filtre   pay serisini seçen boyut değerleri: "BOYUT=KOD,BOYUT=KOD" (geo ve zaman dışındaki, değeri değişen boyutlar)
    payda    (isteğe bağlı) oran göstergelerinde payda serisinin filtresi; değer = pay / payda × carpan
    carpan   değerle çarpılacak sayı (ör. 0,001 ile bin'e; oranlarda 100 ile yüzdeye)
    ay       yalnız aylık akışlarda: toplam (12 ayın toplamı, ör. doğum sayısı) | 12 (aralık değeri, ör. taşıt stoku)
    topla    evet: API'de bulunmayan Düzey 2, Düzey 1 ve Türkiye değerleri il değerlerinden toplanır
             (oranlarda pay ve payda ayrı ayrı toplanıp bölünür)
    gosterge platformdaki gösterge adı (kaynak eki olmadan, ör. "Hanehalkı Sayısı")
    kategori platformdaki kategori adı
    durum    onayli | inceleme | aday — güncellemede yalnız "onayli" satırlar kullanılır
    eslesme  kuruluş sırasındaki karşılaştırma özeti (bilgi amaçlı)
    not      açıklama

Yalnız Python standart kitaplığı kullanılır (pandas gerekmez).

Değerler İBBS kodlarıyla döner: TR, TR1 (Düzey 1), TR10 (Düzey 2), TR100 (il). Akışlarda Türkiye toplamı "_T" ile
yazılabilir; TR'ye çevrilir. Aylık akışlarda (TIME_PERIOD 2024-01 / 2024-M01) eşlemedeki "ay" alanına göre on iki ayın toplamı ya da aralık değeri alınır.
"""
from __future__ import annotations

import csv
import gzip
import io
import re
from collections import defaultdict
from pathlib import Path


KOK = Path(__file__).resolve().parents[2]
HAM = KOK / "build/guncelleme/tuik/ham"
ESLEME = KOK / "pipeline/donusturuculer/eslemeler/tuik.csv"
ALANLAR = ["akis", "surum", "geo", "filtre", "payda", "carpan", "topla", "ay", "gosterge", "kategori", "durum", "eslesme", "not"]
DISI = {"DATAFLOW", "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "OBS_FLAG", "TIME_FORMAT", "DECIMAL", "DECIMALS",
        "YIL", "AY", "BIRIM_CARPANI", "GOZLEM_DURUMU", "GIZLILIK", "CONF_STATUS", "ONDALIK", "ZAMAN_BICIMI"}
IBBS = re.compile(r"TR([1-9A-C](\d(\d{1,2})?)?)?$")


def duzey(kod: str) -> str | None:
    if kod == "TR":
        return "TR"
    if not IBBS.fullmatch(kod or ""):
        return None
    return {3: "D1", 4: "D2", 5: "il"}.get(len(kod))


def sayi(s) -> float | None:
    if s is None or s == "":
        return None
    try:
        return float(str(s).replace(",", "."))
    except ValueError:
        return None


class Tablo:
    """SDMX-CSV verisi: sütun adları ve satırlar (sözlük listesi)."""

    def __init__(self, sutunlar, satirlar):
        self.sutunlar = list(sutunlar)
        self.satirlar = satirlar

    def degerler(self, c) -> set:
        return {r.get(c, "") for r in self.satirlar}

    def suz(self, f: dict) -> "Tablo":
        return Tablo(self.sutunlar, [r for r in self.satirlar if all(r.get(k) == v for k, v in f.items())])


_onbellek: dict[str, Tablo] = {}


def oku(akis: str) -> Tablo:
    if akis not in _onbellek:
        metin = gzip.decompress((HAM / f"{akis}.csv.gz").read_bytes()).decode("utf-8-sig")
        r = csv.DictReader(io.StringIO(metin))
        _onbellek[akis] = Tablo(r.fieldnames or [], list(r))
    return _onbellek[akis]


def _duzey_t(x):
    return "TR" if x == "_T" else duzey(x)


def geo_boyutu(d: Tablo) -> str:
    """En çok İBBS kodu taşıyan sütun."""
    aday = [c for c in d.sutunlar if c not in DISI]
    return max(aday, key=lambda c: sum(1 for x in d.degerler(c) if duzey(x) is not None))


def duzey_boyutu_mu(d: Tablo, geo: str, c: str) -> bool:
    """Değerleri yalnız coğrafi düzeyi ayıran boyut (ör. IBBS_DUZEY: İBBS-1/2/3, TR). Her değerinde kodlar tek düzeydedir."""
    deger_duzey, duzey_deger = defaultdict(set), defaultdict(set)
    for r in d.satirlar:
        z = _duzey_t(r.get(geo, ""))
        if z:
            deger_duzey[r.get(c, "")].add(z)
            duzey_deger[z].add(r.get(c, ""))
    if not deger_duzey:
        return False
    return all(len(v) == 1 for v in deger_duzey.values()) and max(len(v) for v in duzey_deger.values()) == 1


def degisen_boyutlar(d: Tablo, geo: str) -> list[str]:
    """Seriyi belirleyen boyutlar: değeri değişen, coğrafya ve zaman dışındaki boyutlar (düzey boyutları hariç)."""
    out = [c for c in d.sutunlar if c not in DISI and c != geo and c != "REF_AREA" and len(d.degerler(c)) > 1]
    if geo != "REF_AREA" and "REF_AREA" in d.sutunlar and len(d.degerler("REF_AREA")) > 1 \
            and not all(duzey(x) is not None or x in ("_T", "_Z") for x in d.degerler("REF_AREA")):
        out.append("REF_AREA")
    return [c for c in out if not duzey_boyutu_mu(d, geo, c)]


def _yillik_mi(d: Tablo) -> bool:
    return all(re.fullmatch(r"\d{4}", r.get("TIME_PERIOD", "")) for r in d.satirlar)


def aylik_mi(d: Tablo) -> bool:
    if "YIL" in d.sutunlar:
        return False
    return not _yillik_mi(d) and not ("FREQ" in d.sutunlar and "A" in d.degerler("FREQ"))


def yillik(d: Tablo, ay: str = "toplam") -> Tablo:
    """Yıllık gözlemleri döndürür. Yalnız aylık veri varsa: ay="toplam" ise 12 ayı tam olan yılların toplamı,
    ay="12" ise aralık ayı değeri (stok göstergeleri)."""
    if "YIL" in d.sutunlar:
        return d
    sut = d.sutunlar + ["YIL"]
    if _yillik_mi(d):
        return Tablo(sut, [{**r, "YIL": r["TIME_PERIOD"]} for r in d.satirlar])
    if "FREQ" in d.sutunlar and "A" in d.degerler("FREQ"):
        return Tablo(sut, [{**r, "YIL": r["TIME_PERIOD"][:4]} for r in d.satirlar if r.get("FREQ") == "A"])
    if str(ay) == "12":
        return Tablo(sut, [{**r, "YIL": r["TIME_PERIOD"][:4]} for r in d.satirlar if r["TIME_PERIOD"][-2:] == "12"])
    anahtar = [c for c in d.sutunlar if c not in ("TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "OBS_FLAG", "FREQ")]
    toplam, aylar, ornek = defaultdict(float), defaultdict(set), {}
    for r in d.satirlar:
        v = sayi(r.get("OBS_VALUE"))
        if v is None:
            continue
        k = tuple(r.get(c, "") for c in anahtar) + (r["TIME_PERIOD"][:4],)
        toplam[k] += v
        aylar[k].add(r["TIME_PERIOD"][-2:])
        ornek[k] = r
    satirlar = [{**ornek[k], "YIL": k[-1], "OBS_VALUE": repr(v)} for k, v in toplam.items() if len(aylar[k]) == 12]
    return Tablo(sut, satirlar)


def filtre_coz(s: str) -> dict:
    return dict(p.split("=", 1) for p in (s or "").split(",") if "=" in p)


def filtre_yaz(f: dict) -> str:
    return ",".join(f"{k}={v}" for k, v in f.items())


def seri(d: Tablo, geo: str, f: dict) -> dict:
    """{(kod, yıl): değer} — filtreye uyan satırlar."""
    out = {}
    for r in d.satirlar:
        if f and not all(r.get(k) == v for k, v in f.items()):
            continue
        kod = "TR" if r.get(geo) == "_T" else r.get(geo, "")
        if duzey(kod) and (x := sayi(r.get("OBS_VALUE"))) is not None:
            out[(kod, r["YIL"])] = x
    return out


def seriler(d: Tablo, geo: str, boyutlar: list[str]) -> dict:
    """Boyut bileşimlerine göre bütün seriler: {filtre metni: {(kod, yıl): değer}}."""
    out = defaultdict(dict)
    for r in d.satirlar:
        kod = "TR" if r.get(geo) == "_T" else r.get(geo, "")
        if not duzey(kod) or (x := sayi(r.get("OBS_VALUE"))) is None:
            continue
        out[filtre_yaz({b: r.get(b, "") for b in boyutlar})][(kod, r["YIL"])] = x
    return dict(out)


def ust_kodlar(kod: str) -> list[str]:
    """İl kodunun Düzey 2, Düzey 1 ve Türkiye kodları (TR100 -> TR10, TR1, TR)."""
    return [kod[:4], kod[:3], "TR"]


def topla(deg: dict) -> dict:
    """Eksik üst düzeyleri il değerlerinden toplar (yalnız bütün illeri bulunan yıllar için Türkiye)."""
    out = dict(deg)
    toplam = defaultdict(float)
    sayac = defaultdict(int)
    for (kod, yil), v in deg.items():
        if duzey(kod) == "il":
            for u in ust_kodlar(kod):
                toplam[(u, yil)] += v
                sayac[(u, yil)] += 1
    for k, v in toplam.items():
        if k in out:
            continue
        if k[0] == "TR" and sayac[k] < 81:
            continue
        out[k] = v
    return out


def uygula(satir: dict, d: Tablo | None = None) -> dict:
    """Eşleme satırını uygular: {(kod, yıl): değer}."""
    d = yillik(oku(satir["akis"]) if d is None else d, satir.get("ay") or "toplam")
    geo = satir["geo"]
    c = sayi(satir.get("carpan")) or 1.0
    toplanir = (satir.get("topla") or "").strip().lower() == "evet"
    pay = seri(d, geo, filtre_coz(satir["filtre"]))
    if satir.get("payda"):
        payda = seri(d, geo, filtre_coz(satir["payda"]))
        if toplanir:
            pay, payda = topla(pay), topla(payda)
        return {k: v / payda[k] * c for k, v in pay.items() if payda.get(k)}
    out = {k: v * c for k, v in pay.items()}
    return topla(out) if toplanir else out


def esleme_oku(p: Path = ESLEME) -> list[dict]:
    if not p.exists():
        return []
    with open(p, encoding="utf-8-sig", newline="") as f:
        return [r for r in csv.DictReader(f, delimiter=";") if r.get("akis")]


def esleme_yaz(satirlar: list[dict], p: Path = ESLEME):
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, ALANLAR, delimiter=";", extrasaction="ignore")
        w.writeheader()
        w.writerows(satirlar)
