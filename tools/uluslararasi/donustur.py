"""
donustur.py — Giriş sayfasının uluslararası karşılaştırma verisini üretir: public/veri/uluslararasi.json

Ham dosyalar (tools/uluslararasi/ham/, 29 Eylül 2026'da Eurostat ve OECD API'lerinden tarayıcıyla alındı):
  eurostat-gsyh-sgp.txt          nama_10r_2gdp, kişi başı GSYH (SGP, AB27=100), NUTS2 + ülke; 2004, 2014, 2023, 2024
  eurostat-gsyh-sgp-tr-seri.txt  aynı gösterge, Türkiye ve 26 Düzey 2, 2000–2024
  eurostat-neet-kadin.txt        edat_lfse_22 NEET (15–29, %), lfst_r_lfe2emprt kadın istihdam oranı (20–64, %); 2024
  eurostat-yuksekogr-yasli.txt   edat_lfse_04 yükseköğretim mezunu (25–64, %), demo_r_pjanind2 yaşlı bağımlılık (%); 2024
  eurostat-nuts2-adlar.txt       NUTS2 bölge adları
  oecd-tl2-gsyh-2022.txt         OECD DF_GDP: TL2 ve ülke; kişi başı GSYH, çalışan başına GSYH (USD SGP), nüfus; 2022
  oecd-fua-gsyh-2021.txt         OECD DF_ECONOMY: metropol (FUA) kişi başı GSYH (USD SGP), 2021

Türetilen: ülke içi bölgesel eşitsizlik (OECD'nin Regions at a Glance ölçüsü): nüfusun en zengin %20'sinin
yaşadığı bölgelerin kişi başı GSYH'si / en yoksul %20'ninki (nüfus ağırlıklı, TL2, 2022).
OECD ortalaması: OECD üyesi ülkelerin nüfus ağırlıklı ortalaması (kişi başı GSYH için toplam GSYH / toplam nüfus).

Kullanım: python tools/uluslararasi/donustur.py
"""
import json
import re
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
HAM = Path(__file__).with_name("ham")
CIKTI = KOK / "public" / "veri" / "uluslararasi.json"

OECD_UYE = set("AUS AUT BEL CAN CHL COL CRI CZE DNK EST FIN FRA DEU GRC HUN ISL IRL ISR ITA JPN KOR LVA LTU LUX MEX NLD "
               "NZL NOR POL PRT SVK SVN ESP SWE CHE TUR GBR USA".split())
AB27 = set("BE BG CZ DK DE EE IE EL ES FR HR IT CY LV LT LU HU MT NL AT PL PT RO SI SK FI SE".split())
ULKE_ADI = {
    "BE": "Belçika", "BG": "Bulgaristan", "CZ": "Çekya", "DK": "Danimarka", "DE": "Almanya", "EE": "Estonya", "IE": "İrlanda",
    "EL": "Yunanistan", "ES": "İspanya", "FR": "Fransa", "HR": "Hırvatistan", "IT": "İtalya", "CY": "GKRY", "LV": "Letonya",
    "LT": "Litvanya", "LU": "Lüksemburg", "HU": "Macaristan", "MT": "Malta", "NL": "Hollanda", "AT": "Avusturya", "PL": "Polonya",
    "PT": "Portekiz", "RO": "Romanya", "SI": "Slovenya", "SK": "Slovakya", "FI": "Finlandiya", "SE": "İsveç", "NO": "Norveç",
    "CH": "İsviçre", "IS": "İzlanda", "ME": "Karadağ", "MK": "Kuzey Makedonya", "AL": "Arnavutluk", "RS": "Sırbistan",
    "BA": "Bosna-Hersek", "LI": "Lihtenştayn", "TR": "Türkiye",
    "AUS": "Avustralya", "AUT": "Avusturya", "BEL": "Belçika", "CAN": "Kanada", "CHL": "Şili", "COL": "Kolombiya",
    "CRI": "Kosta Rika", "CZE": "Çekya", "DNK": "Danimarka", "EST": "Estonya", "FIN": "Finlandiya", "FRA": "Fransa",
    "DEU": "Almanya", "GRC": "Yunanistan", "HUN": "Macaristan", "ISL": "İzlanda", "IRL": "İrlanda", "ISR": "İsrail",
    "ITA": "İtalya", "JPN": "Japonya", "KOR": "Güney Kore", "LVA": "Letonya", "LTU": "Litvanya", "LUX": "Lüksemburg",
    "MEX": "Meksika", "NLD": "Hollanda", "NZL": "Yeni Zelanda", "NOR": "Norveç", "POL": "Polonya", "PRT": "Portekiz",
    "SVK": "Slovakya", "SVN": "Slovenya", "ESP": "İspanya", "SWE": "İsveç", "CHE": "İsviçre", "TUR": "Türkiye",
    "GBR": "Birleşik Krallık", "USA": "ABD", "BGR": "Bulgaristan", "ROU": "Romanya", "HRV": "Hırvatistan",
    "SRB": "Sırbistan", "MNE": "Karadağ", "MKD": "Kuzey Makedonya", "MLT": "Malta", "CYP": "GKRY",
}


def satir(dosya, etiket=None):
    for l in (HAM / dosya).read_text(encoding="utf-8").splitlines():
        if l.startswith("#") or not l.strip():
            continue
        if etiket is None and "|" not in l:
            return l
        if etiket and l.startswith(etiket + "|"):
            return l.split("|", 1)[1]
    raise KeyError(etiket)


def sayi(s):
    s = s.rstrip("*")
    return float(s) if s not in ("", None) else None


def eurostat_tek(dosya, etiket):
    out = {}
    for p in satir(dosya, etiket).split(";"):
        k, v = p.split(":")
        out[k] = sayi(v)
    return out


def main():
    tr_adlar = json.loads((KOK / "public" / "veri" / "manifest.json").read_text(encoding="utf-8"))["bolgeler"]
    adlar = dict(p.split("=", 1) for p in satir("eurostat-nuts2-adlar.txt").split(";"))
    for k, b in tr_adlar.items():
        if b["duzey"] == "region26":
            adlar[k] = b["ad"]
    refah = json.loads((KOK / "public" / "veri" / "oecd-refah.json").read_text(encoding="utf-8"))
    for b in refah["bolgeler"]:
        adlar.setdefault(b["kod"], b["ad"])

    # --- Eurostat kişi başı GSYH (AB27=100)
    gsyh = {}
    for p in satir("eurostat-gsyh-sgp.txt").split(";"):
        k, v = p.split(":")
        gsyh[k] = dict(zip(("2004", "2014", "2023", "2024"), map(sayi, v.split(","))))
    tr_seri = {}
    for p in satir("eurostat-gsyh-sgp-tr-seri.txt").split(";"):
        k, v = p.split(":")
        tr_seri[k] = [sayi(x) for x in v.split(",")]

    def eurostat_bolgeler(d):
        return {k: v for k, v in d.items() if len(k) == 4 and not k.endswith("ZZ")}

    ulke_ad = lambda k: ULKE_ADI.get(k[:2], k[:2])
    bolge = lambda k: {"kod": k, "ad": adlar.get(k, k), "ulke": k[:2], "ab": k[:2] in AB27}

    avrupa = {}
    for k, v in eurostat_bolgeler(gsyh).items():
        avrupa[k] = {**bolge(k), "gsyh": v}
    ek = {
        "neet": eurostat_tek("eurostat-neet-kadin.txt", "NEET2024"),
        "kadin_istihdam": eurostat_tek("eurostat-neet-kadin.txt", "KADIN2024"),
        "yuksekogretim": eurostat_tek("eurostat-yuksekogr-yasli.txt", "YUKSEKOGR2024"),
        "yasli_bagimlilik": eurostat_tek("eurostat-yuksekogr-yasli.txt", "YASLIBAG2024"),
    }
    ek["yasli_bagimlilik"]["EU27_2020"] = 33.9  # demo_pjanind, 2024 (bölgesel tabloda AB27 satırı yok)
    for ad, d in ek.items():
        for k, v in eurostat_bolgeler(d).items():
            avrupa.setdefault(k, bolge(k))[ad] = v
    avrupa_ulke = {k: {"ad": ulke_ad(k), "gsyh": gsyh.get(k), **{a: d.get(k) for a, d in ek.items()}}
                   for k in set(gsyh) | set().union(*ek.values()) if len(k) == 2}

    # --- OECD TL2 kişi başı GSYH, çalışan başına GSYH
    tl2, ulke = {}, {}
    for p in satir("oecd-tl2-gsyh-2022.txt").split(";"):
        k, u, pc, wr, pop = p.split(":")
        rec = {"pc": sayi(pc), "wr": sayi(wr), "nufus": sayi(pop)}
        if u == "C" + k:
            ulke[k] = rec
        else:
            tl2[k] = {"kod": k, "ulke": u, "ad": adlar.get(k, k), **rec}
    uye = [ulke[u] for u in OECD_UYE if u in ulke]
    oecd_pc = sum(x["pc"] * x["nufus"] for x in uye) / sum(x["nufus"] for x in uye)
    wr_uye = [x for x in uye if x["wr"]]
    # çalışan başına: GSYH toplamı / çalışan toplamı; çalışan = GSYH / wr
    oecd_wr = sum(x["pc"] * x["nufus"] for x in wr_uye) / sum(x["pc"] * x["nufus"] / x["wr"] for x in wr_uye)

    # ülke içi eşitsizlik: en zengin %20 / en yoksul %20 (nüfus ağırlıklı)
    def oran(bolgeler):
        b = sorted((r for r in bolgeler if r["pc"] and r["nufus"]), key=lambda r: r["pc"])
        top = sum(r["nufus"] for r in b)
        if len(b) < 3 or not top:
            return None

        def ort(sirali):
            kalan, gdp, nuf = 0.2 * top, 0.0, 0.0
            for r in sirali:
                al = min(r["nufus"], kalan)
                gdp += al * r["pc"]
                nuf += al
                kalan -= al
                if kalan <= 1e-9:
                    break
            return gdp / nuf
        return ort(reversed(b)) / ort(b)

    esitsizlik = []
    for u in sorted({r["ulke"] for r in tl2.values()}):
        if u not in OECD_UYE:
            continue
        o = oran([r for r in tl2.values() if r["ulke"] == u])
        if o:
            esitsizlik.append({"ulke": u, "ad": ULKE_ADI.get(u, u), "oran": round(o, 2)})
    esitsizlik.sort(key=lambda x: -x["oran"])

    # --- metropoller
    fua_satir = (HAM / "oecd-fua-gsyh-2021.txt").read_text(encoding="utf-8").splitlines()
    fua_ad = dict(p.split("=", 1) for p in [l for l in fua_satir if l.startswith("ADLAR|")][0].split("|", 1)[1].split(";"))
    fua = []
    for p in [l for l in fua_satir if not l.startswith(("#", "ADLAR|")) and l.strip()][0].split(";"):
        k, pc, top = p.split(":")
        fua.append({"kod": k, "ad": fua_ad.get(k, k), "ulke": re.match(r"[A-Z]+?(?=\d)", k).group(0)[:3], "pc": sayi(pc), "gsyh": sayi(top)})

    # --- OECD Regional Well-Being (mevcut dosyadan): TR ve OECD karşılaştırmaları için ad/konum bilgisi zaten var
    out = {
        "kaynak": {
            "eurostat": "Eurostat (nama_10r_2gdp, edat_lfse_22, lfst_r_lfe2emprt, edat_lfse_04, demo_r_pjanind2), 29 Eylül 2026",
            "oecd": "OECD Regional Database (DF_GDP, TL2, 2022) ve Metropolitan Database (DF_ECONOMY, FUA, 2021), 29 Eylül 2026",
        },
        "ab27": {"gsyh": gsyh["EU27_2020"] if "EU27_2020" in gsyh else {"2024": 100}, **{a: d.get("EU27_2020") for a, d in ek.items()}},
        "avrupa": sorted(avrupa.values(), key=lambda r: r["kod"]),
        "avrupa_ulke": avrupa_ulke,
        "tr_gsyh_seri": {"yillar": list(range(2000, 2025)), "seri": tr_seri},
        "oecd_tl2": sorted(tl2.values(), key=lambda r: r["kod"]),
        "oecd_ulke": {k: {**v, "ad": ULKE_ADI.get(k, k), "uye": k in OECD_UYE} for k, v in ulke.items()},
        "oecd_ort": {"pc": round(oecd_pc), "wr": round(oecd_wr)},
        "esitsizlik": esitsizlik,
        "metropoller": fua,
    }
    CIKTI.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tr = next(x for x in esitsizlik if x["ulke"] == "TUR")
    print(f"{CIKTI.name}: {len(avrupa)} Avrupa bölgesi, {len(tl2)} OECD TL2 bölgesi, {len(fua)} metropol; "
          f"OECD ort. kişi başı {oecd_pc:,.0f} $; Türkiye eşitsizlik oranı {tr['oran']} "
          f"({esitsizlik.index(tr) + 1}/{len(esitsizlik)})")
    print("En eşitsiz 6:", [(x['ad'], x['oran']) for x in esitsizlik[:6]])


if __name__ == "__main__":
    main()
