"""
giris_verisi.py — Ana sayfanın (uluslararası karşılaştırmalar) verisini ve Avrupa haritasını üretir.

Girdi: tools/uluslararasi/ham/*.txt (Eurostat ve OECD API'lerinden alınan ham değerler, bkz. donustur.py başlığı)
       tools/uluslararasi/geo/*.json (Eurostat GISCO / Nuts2json, NUTS 2024, EPSG:3035, 1:20M)
Çıktı: public/veri/giris.json, public/veri/geo/avrupa-nuts2.json, public/veri/geo/avrupa-ulkeler.json

Ana sayfadaki bölümler (OECD Regional Outlook 2023 ve Regions at a Glance 2024 şekillerinden seçildi):
  gsyh       kişi başı GSYH (SGP, AB27=100), Avrupa NUTS2 + Türkiye Düzey 2            (Eurostat)
  yakinsama  illerde 2000'deki kişi başı reel GSYH ve 2000–2023 yıllık büyüme         (OECD TL3)      RO 2023 Şekil 2.7
  theil      bölgeler arası Theil endeksi, Türkiye 2000–2023 ve ülkeler               (OECD TL3)      RO 2023 Şekil 2.9
  gini       TL3 bölgeleri arasında Gini ve en büyük %10 bölgenin GSYH/nüfus payı      (OECD TL3)      RO 2023 Şekil 2.14–2.15
  ropi       bölgesel deflatörlerle ve ulusal deflatörle eşitsizlik (üst/alt %20)      (OECD TL2)      RaG 2024 Şekil 1.2–1.4
  yasli      yaşlı bağımlılık oranı, 2024                                              (Eurostat)      RaG 2024 Şekil 1.23
  nufus      yıllık ortalama nüfus değişimi, 2008–2025                                 (Eurostat)      RaG 2024 Şekil 1.26
  kadin      kadın istihdam oranı 2019 ve 2024 (20–64 yaş)                              (Eurostat)      RaG 2024 Şekil 2.2
  atik       kişi başı belediye atığı (2010 → son yıl)                                  (OECD TL2)      RaG 2024 Şekil 3.20
  buyume     2018–2024 reel kişi başı GSYH büyümesinin ülke ortalamasından sapması (SS) ve
             büyümenin verimlilik / emek kullanımı ayrıştırması                         (TÜİK, build/veri.db) RaC at a Glance 2026 Şekil 1.3–1.5
Uzaktan çalışma (RaG 2024 Şekil 2.20) bölge düzeyinde açık veri olarak yayımlanmıyor (Eurostat/OECD API'de yok).

Kullanım: python tools/uluslararasi/giris_verisi.py
"""
import json
import math
import sqlite3
import statistics
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
HAM = Path(__file__).with_name("ham")
GEO = Path(__file__).with_name("geo")
VERI = KOK / "public" / "veri"

ULKE2 = {
    "BE": "Belçika", "BG": "Bulgaristan", "CZ": "Çekya", "DK": "Danimarka", "DE": "Almanya", "EE": "Estonya", "IE": "İrlanda",
    "EL": "Yunanistan", "ES": "İspanya", "FR": "Fransa", "HR": "Hırvatistan", "IT": "İtalya", "CY": "GKRY", "LV": "Letonya",
    "LT": "Litvanya", "LU": "Lüksemburg", "HU": "Macaristan", "MT": "Malta", "NL": "Hollanda", "AT": "Avusturya", "PL": "Polonya",
    "PT": "Portekiz", "RO": "Romanya", "SI": "Slovenya", "SK": "Slovakya", "FI": "Finlandiya", "SE": "İsveç", "NO": "Norveç",
    "CH": "İsviçre", "IS": "İzlanda", "ME": "Karadağ", "MK": "K. Makedonya", "AL": "Arnavutluk", "RS": "Sırbistan",
    "BA": "Bosna-Hersek", "LI": "Lihtenştayn", "TR": "Türkiye", "UK": "Birleşik Krallık",
}
ULKE3 = {
    "AUS": "Avustralya", "AUT": "Avusturya", "BEL": "Belçika", "CAN": "Kanada", "CHL": "Şili", "COL": "Kolombiya",
    "CRI": "Kosta Rika", "CZE": "Çekya", "DNK": "Danimarka", "EST": "Estonya", "FIN": "Finlandiya", "FRA": "Fransa",
    "DEU": "Almanya", "GRC": "Yunanistan", "HUN": "Macaristan", "ISL": "İzlanda", "IRL": "İrlanda", "ISR": "İsrail",
    "ITA": "İtalya", "JPN": "Japonya", "KOR": "Güney Kore", "LVA": "Letonya", "LTU": "Litvanya", "LUX": "Lüksemburg",
    "MEX": "Meksika", "NLD": "Hollanda", "NZL": "Yeni Zelanda", "NOR": "Norveç", "POL": "Polonya", "PRT": "Portekiz",
    "SVK": "Slovakya", "SVN": "Slovenya", "ESP": "İspanya", "SWE": "İsveç", "CHE": "İsviçre", "TUR": "Türkiye",
    "GBR": "Birleşik Krallık", "USA": "ABD", "BGR": "Bulgaristan", "ROU": "Romanya", "HRV": "Hırvatistan",
    "SRB": "Sırbistan", "BRA": "Brezilya", "PER": "Peru", "IDN": "Endonezya", "CHN": "Çin", "IND": "Hindistan",
}
AB27 = set("BE BG CZ DK DE EE IE EL ES FR HR IT CY LV LT LU HU MT NL AT PL PT RO SI SK FI SE".split())


def satirlar(dosya):
    return [l for l in (HAM / dosya).read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]


def etiketli(dosya, etiket):
    for l in satirlar(dosya):
        if l.startswith(etiket + "|"):
            return l.split("|", 1)[1]
    raise KeyError(etiket)


def f(s):
    s = (s or "").rstrip("*")
    return float(s) if s not in ("", "nan", "NaN") else None


def bolum(s, ayrac=";"):
    return [p for p in s.split(ayrac) if p]


# ---------------------------------------------------------------- 2018–2024 büyüme (TÜİK; Regions and Cities at a Glance 2026)
BUYUME_YIL = (2018, 2024)


def buyume_tuik():
    """OECD Regions and Cities at a Glance 2026, Şekil 1.3–1.5'in Türkiye için TÜİK verisiyle yeniden hesabı.

    Reel GSYH: TÜİK zincirlenmiş hacim (2009=100). OECD'nin ROPI'si (cari GSYH / zincirlenmiş hacim) ile reel seri
    aynıdır. Nüfus: TÜİK ADNKS yıl sonu. İstihdam: TÜİK HİA, 15+ yaş, Düzey 2 (ikamete göre).
    Göreli büyüme: (bölgenin yıllık bileşik büyümesi − Türkiye'ninki) / bölge büyümelerinin standart sapması.
    Ayrıştırma: kişi başı GSYH = (GSYH / istihdam) × (istihdam / nüfus); toplam büyüme logaritmik paylara göre bölünür.
    Gruplar: 2018–2024 ortalama reel kişi başı GSYH'ye göre sıralanıp nüfusun %20'sine ulaşana kadar alınan bölgeler.
    """
    db = sqlite3.connect(KOK / "build" / "veri.db")
    duzey = dict(db.execute("SELECT geo, level FROM entities"))
    ad = dict(db.execute("SELECT geo, name FROM entities"))

    def seri(gosterge):
        return {(g, int(t)): v for g, t, v in db.execute(
            "SELECT geo, time, value FROM values_long WHERE indicator=?", (gosterge,)) if v is not None}
    R = seri("GSYH Zincirlenmiş Hacim (2009=100) (Bin TL)")
    P = seri("Toplam Nüfus")
    E = seri("İstihdam (15 Yaş ve Üzeri-1000 Kişi)")
    W = seri("15-64 Yaş Grubu Nüfus")
    y0, y1 = BUYUME_YIL
    n = y1 - y0

    def cagr(a, b):
        return ((b / a) ** (1 / n) - 1) * 100

    tr = cagr(R[("TR", y0)] / P[("TR", y0)], R[("TR", y1)] / P[("TR", y1)])

    def goreli(level):
        kod = sorted(g for g in duzey if duzey[g] == level)
        b = {g: cagr(R[(g, y0)] / P[(g, y0)], R[(g, y1)] / P[(g, y1)]) for g in kod}
        ss = statistics.stdev(b.values())
        top = sum(P[(g, y1)] for g in kod)
        satir = [{"kod": g, "ad": ad[g], "buyume": round(b[g], 2), "z": round((b[g] - tr) / ss, 2),
                  "nufus": P[(g, y1)]} for g in kod]
        pay = lambda f: round(sum(r["nufus"] for r in satir if f(r["z"])) / top * 100, 1)
        return {"ss": round(ss, 2), "alt": pay(lambda z: z <= -1), "ust": pay(lambda z: z >= 1), "bolgeler": satir}

    d2 = goreli("region26")
    il = goreli("province")

    # Ayrıştırma (Düzey 2)
    kod = sorted(g for g in duzey if duzey[g] == "region26")
    ort = {g: sum(R[(g, y)] / P[(g, y)] for y in range(y0, y1 + 1)) / (n + 1) for g in kod}
    top = sum(P[(g, y1)] for g in kod)
    sira = sorted(kod, key=ort.get)

    def ilk20(dizi):
        out, acc = [], 0
        for g in dizi:
            if acc >= 0.2 * top:
                break
            out.append(g)
            acc += P[(g, y1)]
        return out
    alt, ust = ilk20(sira), ilk20(sira[::-1])
    orta = [g for g in kod if g not in alt and g not in ust]
    ist_tr = E[("TR", y1)] * 1000 / W[("TR", y1)] * 100

    def ayristir(ad_, grup, geo=None):
        S = (lambda d, y: d[(geo, y)]) if geo else (lambda d, y: sum(d[(g, y)] for g in grup))
        kb = cagr(S(R, y0) / S(P, y0), S(R, y1) / S(P, y1))
        lp = math.log((S(R, y1) / S(E, y1)) / (S(R, y0) / S(E, y0)))
        le = math.log((S(E, y1) / S(P, y1)) / (S(E, y0) / S(P, y0)))
        ver = kb * lp / (lp + le)
        ist = S(E, y1) * 1000 / S(W, y1) * 100
        return {"grup": ad_, "bolgeler": [ad[g] for g in grup], "kbGsyh": round(kb, 2), "verimlilik": round(ver, 2),
                "emek": round(kb - ver, 2), "istOrani": round(ist, 1), "istFark": round(ist - ist_tr, 1),
                "nufusPay": round((S(P, y1)) / top * 100, 1) if not geo else 100.0}
    ayr = [ayristir("En alt %20", alt), ayristir("Orta %60", orta), ayristir("En üst %20", ust),
           ayristir("Türkiye", kod, geo="TR")]
    # Çalışan başına reel GSKD büyümesi (RaC at a Glance 2026 Şekil 1.1): zincirlenmiş hacim GSKD / HİA istihdamı
    G = seri("GSKD Zincirlenmiş Hacim (2009=100) (Bin TL)")
    ver = lambda g: cagr(G[(g, y0)] / E[(g, y0)], G[(g, y1)] / E[(g, y1)])
    verimlilik = sorted(({"kod": g, "ad": ad[g], "buyume": round(ver(g), 2)} for g in kod), key=lambda r: -r["buyume"])
    return {"yillar": [y0, y1], "trBuyume": round(tr, 2), "d2": d2, "il": il, "ayristirma": ayr,
            "verimlilik": {"tr": round(ver("TR"), 2), "bolgeler": verimlilik}}


def main():
    manifest = json.loads((VERI / "manifest.json").read_text(encoding="utf-8"))["bolgeler"]
    adlar = dict(p.split("=", 1) for p in bolum(satirlar("eurostat-nuts2-adlar.txt")[0]))
    for k, b in manifest.items():
        if b["duzey"] in ("region26", "province"):
            adlar[k] = b["ad"]

    # ---- kişi başı GSYH (AB27=100)
    gsyh, gsyh04, gsyh_ulke = {}, {}, {}
    for p in bolum(satirlar("eurostat-gsyh-sgp.txt")[0]):
        k, v = p.split(":")
        d = [f(x) for x in v.split(",")]  # 2004, 2014, 2023, 2024
        son = d[3] if d[3] is not None else d[2]
        if len(k) == 2:
            gsyh_ulke[k] = son
        elif son is not None:
            gsyh[k] = son
            if d[0] is not None:
                gsyh04[k] = d[0]
    tr_seri = {}
    for p in bolum(satirlar("eurostat-gsyh-sgp-tr-seri.txt")[0]):
        k, v = p.split(":")
        tr_seri[k] = [f(x) for x in v.split(",")]

    # ---- yakınsama (81 il, OECD sabit fiyat SGP): 2000 düzeyi ve 2000–2023 yıllık büyüme
    yakinsama = []
    for p in bolum(satirlar("oecd-tr-tl3-reel-gsyh.txt")[0]):
        k, v = p.split(":")
        y00, y10, y20, y23 = [f(x) for x in v.split(",")]
        yakinsama.append({"kod": k, "ad": adlar.get(k, k), "d2": manifest.get(k, {}).get("ust"),
                          "y2000": y00, "y2023": y23, "buyume": round(((y23 / y00) ** (1 / 23) - 1) * 100, 2)})

    # ---- Theil, Gini, yoğunlaşma
    esit = etiketli_ham = satirlar("oecd-esitsizlik-endeksleri.txt")
    ulkeler = []
    for blok in esit[0].split(";;"):
        u, duzey, n, ilk, y20, son = blok.split("|")
        iy, iv = ilk.split("=")
        sy, sv = son.split("=")
        iv, sv = [f(x) for x in iv.split(",")], [f(x) for x in sv.split(",")]
        ulkeler.append({"ulke": u, "ad": ULKE3.get(u, u), "duzey": duzey, "n": int(n),
                        "ilkYil": int(iy), "theilIlk": iv[0], "giniIlk": iv[1],
                        "sonYil": int(sy), "theil": sv[0], "gini": sv[1], "gsyhPay": sv[2], "nufusPay": sv[3]})
    tr_theil = {}
    for l in esit[1:]:
        ad, v = l.split("|", 1)
        tr_theil[ad] = {int(x.split("=")[0]): [f(y) for y in x.split("=")[1].split(",")] for x in v.split(" ")}
    yillar = sorted(tr_theil["TR_TL3_SERI"])

    # ---- ROPI
    ropi_u = []
    for p in bolum(etiketli("oecd-ropi.txt", "ULKE")):
        u, a, b = p.split(":")
        y0, v0 = a.split("=")
        y1, v1 = b.split("=")
        q0, r0 = [f(x) for x in v0.split(",")]
        q1, r1 = [f(x) for x in v1.split(",")]
        ropi_u.append({"ulke": u, "ad": ULKE3.get(u, u), "y0": int(y0), "ulusal0": q0, "bolgesel0": r0,
                       "y1": int(y1), "ulusal1": q1, "bolgesel1": r1})
    ropi_tr = []
    for p in bolum(etiketli("oecd-ropi.txt", "TR")):
        k, v = p.split(":")
        q01, q22, r01, r22 = [f(x) for x in v.split(",")]
        ropi_tr.append({"kod": k, "ad": adlar.get(k, k),
                        "ulusal": round(((q22 / q01) ** (1 / 21) - 1) * 100, 2),
                        "bolgesel": round(((r22 / r01) ** (1 / 21) - 1) * 100, 2)})

    # ---- yaşlı bağımlılık, nüfus değişimi, kadın istihdamı (Eurostat NUTS2)
    def tek(dosya, etiket):
        out = {}
        for p in bolum(etiketli(dosya, etiket)):
            k, v = p.split(":")
            out[k] = f(v)
        return out
    yasli = tek("eurostat-yuksekogr-yasli.txt", "YASLIBAG2024")
    nufus = {}
    for p in bolum(satirlar("eurostat-nufus-degisim.txt")[0]):
        k, g, y0, n = p.split(":")
        nufus[k] = {"g": f(g), "y0": int(y0), "n": f(n)}
    kadin = {}
    for p in bolum(satirlar("eurostat-kadin-2019-2024.txt")[0]):
        k, v = p.split(":")
        a, b = [f(x) for x in v.split(",")]
        kadin[k] = [a, b]

    # ---- belediye atığı (OECD TL2 + ülke)
    atik_b, atik_u = [], []
    for p in bolum(satirlar("oecd-belediye-atik.txt")[0]):
        k, ilk, son, geri = p.split(":")
        rec = {"kod": k.rstrip("*")}
        if ilk:
            rec["ilk"], rec["ilkYil"] = f(ilk.split("@")[0]), int(ilk.split("@")[1])
        rec["son"], rec["sonYil"] = f(son.split("@")[0]), int(son.split("@")[1])
        if geri:
            rec["geri"], rec["geriYil"] = min(100.0, f(geri.split("@")[0])), int(geri.split("@")[1])
        if k.endswith("*"):
            rec["ad"] = ULKE3.get(rec["kod"], rec["kod"])
            atik_u.append(rec)
        else:
            on = rec["kod"][:2]
            rec["ulke"] = on
            rec["ad"] = adlar.get(rec["kod"], rec["kod"])
            atik_b.append(rec)

    # ---- bölge → ülke (Eurostat 2 harf); yalnız verisi olan bölgelerin adları
    kullanilan = set(gsyh) | set(yasli) | set(nufus) | set(kadin) | {r["kod"] for r in atik_b}
    bolge_ad = {k: adlar.get(k, k) for k in sorted(kullanilan) if len(k) >= 3}

    out = {
        "kaynak": {
            "eurostat": "Eurostat (nama_10r_2gdp, demo_r_pjanind2, demo_r_d2jan, lfst_r_lfe2emprt)",
            "oecd": "OECD Regional Database (DF_GDP, DF_GDP_ROPI, DF_WASTE)",
            "tuik": "TÜİK bölgesel hesaplar (zincirlenmiş hacim GSYH), ADNKS nüfus, HİA istihdam",
            "tarih": "29 Eylül 2026",
        },
        "ulkeAdlari": {**ULKE2, **ULKE3},
        "ab27": sorted(AB27),
        "bolgeAdlari": bolge_ad,
        "gsyh": {"yil": 2024, "deger": gsyh, "d2004": gsyh04, "ulke": gsyh_ulke,
                 "trSeri": {"yillar": list(range(2000, 2025)), "seri": tr_seri}},
        "yakinsama": yakinsama,
        "theil": {"yillar": yillar,
                  "tl3": [tr_theil["TR_TL3_SERI"][y][0] for y in yillar],
                  "tl2": [tr_theil["TR_TL2_SERI"][y][0] for y in yillar],
                  "giniTl3": [tr_theil["TR_TL3_SERI"][y][1] for y in yillar]},
        "ulkeEsitsizlik": ulkeler,
        "ropi": {"ulkeler": ropi_u, "tr": ropi_tr},
        "yasli": {"yil": 2024, "deger": yasli, "ab": 33.9},
        "nufus": nufus,
        "kadin": kadin,
        "atik": {"bolgeler": atik_b, "ulkeler": atik_u},
        "buyume": buyume_tuik(),
    }
    (VERI / "giris.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # ---- Avrupa geometrisi (EPSG:3035, metre; tam sayıya yuvarlanır)
    def yuvarla(c):
        return [round(c[0]), round(c[1])] if isinstance(c[0], (int, float)) else [yuvarla(x) for x in c]
    nuts = json.loads((GEO / "nutsrg_2_2024_3035_20M.json").read_text(encoding="utf-8"))
    feats = [{"type": "Feature", "id": ft["properties"]["id"], "properties": {"ad": ft["properties"].get("na")},
              "geometry": {"type": ft["geometry"]["type"], "coordinates": yuvarla(ft["geometry"]["coordinates"])}}
             for ft in nuts["features"]]
    (VERI / "geo" / "avrupa-nuts2.json").write_text(
        json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":")), encoding="utf-8")
    cnt = json.loads((GEO / "cntrg_2024_3035_20M.json").read_text(encoding="utf-8"))
    # Harita çerçevesi (İzlanda'dan Türkiye'nin doğusuna); çerçeve dışındaki ülkeler atılır
    X0, X1, Y0, Y1 = 2300000, 7500000, 1300000, 5500000

    def kutuda(c):
        if isinstance(c[0], (int, float)):
            return X0 - 5e5 <= c[0] <= X1 + 5e5 and Y0 - 5e5 <= c[1] <= Y1 + 5e5
        return any(kutuda(x) for x in c)
    ulkeler_geo = [{"type": "Feature", "id": ft["properties"]["id"], "properties": {},
                    "geometry": {"type": ft["geometry"]["type"], "coordinates": yuvarla(ft["geometry"]["coordinates"])}}
                   for ft in cnt["features"] if kutuda(ft["geometry"]["coordinates"])]
    (VERI / "geo" / "avrupa-ulkeler.json").write_text(
        json.dumps({"type": "FeatureCollection", "features": ulkeler_geo}, separators=(",", ":")), encoding="utf-8")

    tr_y = next(x for x in yakinsama if x["kod"] == "TR100")
    print(f"giris.json: {len(gsyh)} bölge GSYH, {len(yakinsama)} il, {len(ulkeler)} ülke eşitsizlik, "
          f"{len(ropi_u)} ülke ROPI, {len(atik_b)} bölge atık; harita {len(feats)} NUTS2 + {len(ulkeler_geo)} ülke")
    # yakınsama eğimi (beta): büyüme ~ ln(2000 düzeyi)
    xs = [math.log(r["y2000"]) for r in yakinsama]
    ys = [r["buyume"] for r in yakinsama]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    beta = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    print(f"yakınsama eğimi: {beta:.2f} puan / log birim; İstanbul büyümesi %{tr_y['buyume']}")


if __name__ == "__main__":
    main()
