"""
oecd_sdmx.py — OECD Data Explorer (SDMX "csvfilewithlabels") dosyalarını veri-ekleri şablonuna çevirir.

OECD dosyalarında bir ölçü birden fazla boyuta bölünmüştür (yaş, cinsiyet, senaryo, dönüş periyodu…).
Hepsini almak yüzlerce gösterge üretir; bu yüzden yalnızca eşleme dosyasında seçilen
(dosya + ölçü + birim + boyut filtresi) kombinasyonları alınır.

Kullanım:
    python pipeline/donusturuculer/oecd_sdmx.py <oecd_turkiye_veri/turkiye klasörü> \\
        --esleme pipeline/donusturuculer/eslemeler/oecd-kentler.csv --cikti veri-ekleri/oecd-kentler.csv

Eşleme dosyası (noktalı virgül):
    dosya;olcu;birim;filtre;duzey;gosterge;kategori;carpan;eksik_kabul;not
    dosya    dosya adının başı, örn. DSD_FUA_DEMO_DF_AGE_SEX
    olcu     MEASURE, örn. POP
    birim    UNIT_MEASURE, örn. PS
    filtre   ek boyutlar, virgülle: AGE=_T,SEX=_T   (boş = ek boyut yok)
    duzey    TERRITORIAL_LEVEL listesi, virgülle: FUA,CITY | TL2,TL3,CTRY
    gosterge sitedeki ad (birim sona parantezle)
    kategori manifest kategorisi
    carpan   boşsa 1
    eksik_kabul  "evet" ise kapsam koruması bu gösterge için kapatılır. Yalnızca OECD'nin kendisi
                 eksik yayımlıyorsa kullanın (örn. FUA ekonomi/işgücü verisi 26 FUA'nın 20'si için var)
    payda    (isteğe bağlı) pay hesabı: "ACTIVITY=_T" yazılırsa değer, filtrenin bu boyutu değiştirilmiş
             hâlindeki değere bölünüp 100 ile çarpılır (örn. sektörün toplam katma değerdeki payı, %)
    yayin    (isteğe bağlı) "hayir": yalnızca veri.db

Kod dönüşümü: TUR -> TR; TL2/TL3 kodları (TR10, TR100) ve FUA/şehir kodları (TR001F, TR001C) aynen kalır.

Kapsam koruması: TL2 için 26, TL3 için 81 bölgenin tamamı yoksa gösterge YAZILMAZ
(eksik indirme haritada "veri yok" gibi görünür ve yanıltır). --eksik-kabul ile kapatılır.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import defaultdict
from pathlib import Path

BEKLENEN = {"TL2": 26, "TL3": 81, "FUA": 26, "CITY": 26}


def norm(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ")).strip()


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("klasor", help="OECD Türkiye CSV klasörü (download_oecd_turkiye_5.R çıktısı: .../turkiye)")
    ap.add_argument("--esleme", required=True)
    ap.add_argument("--cikti", required=True)
    ap.add_argument("--kaynak", default="OECD Regional, Metropolitan and Local Statistics")
    ap.add_argument("--eksik-kabul", action="store_true", help="bölge kapsamı eksik olsa da yaz")
    a = ap.parse_args(argv)

    klasor = Path(a.klasor)
    with open(a.esleme, encoding="utf-8-sig", newline="") as f:
        kurallar = [r for r in csv.DictReader(f, delimiter=";") if norm(r.get("gosterge"))]

    satirlar, ozet, uyarilar = [], [], []
    dosya_onbellek: dict[str, list[dict]] = {}
    for k in kurallar:
        # Önce birebir ad (DSD_REG_ECO_DF_GDP_turkiye.csv); yoksa önek eşleşmesi. Aksi hâlde
        # "DF_GDP" öneki "DF_GDP_ROPI" dosyasını da yakalayıp yanlış dosyayı seçiyordu.
        tam = klasor / (norm(k["dosya"]) + "_turkiye.csv")
        adaylar = [tam] if tam.exists() else sorted(klasor.glob(norm(k["dosya"]) + "*.csv"))
        if not adaylar:
            uyarilar.append(f"dosya yok: {k['dosya']} ({k['gosterge']})")
            continue
        p = adaylar[0]
        if p not in dosya_onbellek:
            with open(p, encoding="utf-8-sig", newline="") as f:
                dosya_onbellek[p] = list(csv.DictReader(f))
        filtre = dict(x.split("=", 1) for x in norm(k.get("filtre")).split(",") if "=" in x)
        duzeyler = {x.strip() for x in norm(k.get("duzey")).split(",") if x.strip()}
        carp = float(norm(k.get("carpan")).replace(",", ".") or 1)

        payda = dict(x.split("=", 1) for x in norm(k.get("payda")).split(",") if "=" in x)
        paydalar = {}
        if payda:
            # payda başka bir ölçü/birim de olabilir: "MEASURE=PROD_ELEC_T" ya da "UNIT_MEASURE=PS"
            p_olcu = payda.get("MEASURE", norm(k["olcu"]))
            p_birim = payda.get("UNIT_MEASURE", norm(k["birim"]))
            pf = {b: d for b, d in {**filtre, **payda}.items() if b not in ("MEASURE", "UNIT_MEASURE")}
            for r in dosya_onbellek[p]:
                if r.get("MEASURE") == p_olcu and r.get("UNIT_MEASURE") == p_birim \
                        and all(r.get(b) == d for b, d in pf.items()) and r.get("OBS_VALUE") not in ("", "NA"):
                    paydalar[(r["REF_AREA"], r["TIME_PERIOD"])] = float(r["OBS_VALUE"])

        secilen = []
        for r in dosya_onbellek[p]:
            if r.get("MEASURE") != norm(k["olcu"]) or r.get("UNIT_MEASURE") != norm(k["birim"]):
                continue
            if any(r.get(boyut) != deger for boyut, deger in filtre.items()):
                continue
            tl = r.get("TERRITORIAL_LEVEL", "")
            if duzeyler and tl not in duzeyler:
                continue
            v = r.get("OBS_VALUE", "")
            if v in ("", "NA"):
                continue
            kod = "TR" if r["REF_AREA"] == "TUR" else r["REF_AREA"]
            deger = float(v) * carp
            if payda:
                d = paydalar.get((r["REF_AREA"], r["TIME_PERIOD"]))
                if not d:
                    continue
                deger = 100 * float(v) / d
            secilen.append((tl, kod, r["TIME_PERIOD"], deger))

        # aynı kod-yıl birden fazla kez geliyorsa filtre yetersiz demektir
        anahtar = defaultdict(int)
        for tl, kod, yil, _ in secilen:
            anahtar[(kod, yil)] += 1
        cift = sum(1 for c in anahtar.values() if c > 1)
        if cift:
            uyarilar.append(f"{k['gosterge']}: {cift} kod-yıl birden fazla satırla eşleşti, filtre eksik (atlandı)")
            continue

        # Yıl bazında tutarlılık: bir yılın medyanı diğer yılların medyanından 50 kattan fazla
        # sapıyorsa (ör. OECD kirlilik verisinde 2023 değerlerinin ~1/500 ölçekte gelmesi) o yıl atılır.
        yil_deg = defaultdict(list)
        for _, _, yil, v in secilen:
            yil_deg[yil].append(abs(v))
        def medyan(x):
            x = sorted(x); return x[len(x) // 2] if x else 0
        if len(yil_deg) >= 3:
            genel = medyan([medyan(v) for v in yil_deg.values()])
            bozuk = [y for y, v in yil_deg.items() if genel > 0 and (medyan(v) < genel / 50 or medyan(v) > genel * 50)]
            if bozuk:
                uyarilar.append(f"{k['gosterge']}: {', '.join(sorted(bozuk))} yılı diğer yıllarla tutarsız (≥50 kat), atıldı")
                secilen = [r for r in secilen if r[2] not in bozuk]

        kapsam = defaultdict(set)
        for tl, kod, _, _ in secilen:
            kapsam[tl].add(kod)
        eksik = {tl: f"{len(kodlar)}/{BEKLENEN[tl]}" for tl, kodlar in kapsam.items()
                 if tl in BEKLENEN and len(kodlar) < BEKLENEN[tl]}
        kural_kabul = norm(k.get("eksik_kabul")).lower() in ("evet", "e", "1", "true")
        if eksik and kural_kabul:
            uyarilar.append(f"{k['gosterge']}: kapsam {eksik} — OECD kaynağında eksik, bilerek kabul edildi")
        if eksik and not (a.eksik_kabul or kural_kabul):
            uyarilar.append(f"{k['gosterge']}: bölge kapsamı eksik {eksik} — yazılmadı (--eksik-kabul ile zorlanabilir)")
            continue

        # "not" sütunu "kaynak: …" ile başlıyorsa o gösterge için kaynak yazısı budur
        not_ = norm(k.get("not"))
        kaynak = not_.split(":", 1)[1].strip() if not_.lower().startswith("kaynak:") else a.kaynak
        for tl, kod, yil, v in secilen:
            satirlar.append([kod, norm(k["gosterge"]), norm(k["kategori"]), yil,
                             repr(round(v, 6)).replace(".", ",").removesuffix(",0"), kaynak, "",
                             norm(k.get("yayin"))])
        yillar = sorted({y for _, _, y, _ in secilen})
        ozet.append(f"  {k['gosterge']}: {len(secilen)} değer, "
                    + ", ".join(f"{tl} {len(c)}" for tl, c in sorted(kapsam.items()))
                    + (f", {yillar[0]}–{yillar[-1]}" if yillar else ""))

    Path(a.cikti).parent.mkdir(parents=True, exist_ok=True)
    with open(a.cikti, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"])
        w.writerows(satirlar)
    print(f"{len(ozet)} gösterge, {len(satirlar)} değer -> {a.cikti}")
    print("\n".join(ozet))
    if uyarilar:
        print("UYARILAR:\n  " + "\n  ".join(uyarilar))


if __name__ == "__main__":
    sys.exit(main())
