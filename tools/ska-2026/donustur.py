"""
donustur.py — TÜİK "Sürdürülebilir Kalkınma Göstergeleri, 2010-2025" (yayımlanan gösterge listesi, Şubat 2026
sürümü) dosyasından veri tabanımızda OLMAYAN değerleri veri-ekleri/ska_2026.csv dosyasına yazar.

Yöntem
  1. Dosyadaki her veri satırı bir seri: gösterge kodu (1.2.1), alt gösterge (a) …), kırılım yolu
     (Toplam / Erkek / Yaş grubu › 18-24 / il adı …), birim ve 2010–2025 değerleri.
  2. Seri veri tabanındaki bir SKA göstergesiyle DEĞERLERİNDEN eşleştirilir: aynı kodlu göstergelerden,
     ortak yıllardaki bütün değerleri (yuvarlama payıyla) tutan. İl ve Düzey 2 kırılımları o birimin
     değerleriyle karşılaştırılır.
  3. Eşleşen serilerde yalnızca veri tabanında olmayan yıllar eklenir (mevcut değerlere dokunulmaz).
  4. Eşleşmeyen Türkiye serileri yeni gösterge olarak eklenir. Adı, aynı bloktaki eşleşmiş bir kardeş
     serinin kodundan (1.3.1.a gibi) ve dosyadaki Türkçe başlıktan kurulur. Oluşan ad veri tabanında zaten
     varsa seri "revizyon" sayılır ve eklenmez (değerler değişmiş olabilir; rapora yazılır).
  İl/bölge kırılımlarının tamamı veri tabanında var (yalnız yuvarlama/ölçek farkları), bunlar eklenmez.

Kullanım: python tools/ska-2026/donustur.py  →  veri-ekleri/ska_2026.csv, tools/ska-2026/_rapor.txt
(Dosya adı "ska_2026": ek dosyaları ada göre sırayla okunur; "_" ska.csv'den sonra geldiği için düzeltmeler öne geçer.)
"""
from __future__ import annotations

import csv
import re
import sqlite3
import warnings
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

warnings.filterwarnings("ignore")
KOK = Path(__file__).resolve().parents[2]
XLSX = Path(__file__).with_name("yayimlanan-gosterge-listesi-2026-02.xlsx")
CIKTI = KOK / "veri-ekleri" / "ska_2026.csv"
RAPOR = Path(__file__).with_name("_rapor.txt")
KAT = "Sürdürülebilir Kalkınma"
KAYNAK = "Türkiye İstatistik Kurumu, Sürdürülebilir Kalkınma Göstergeleri (Şubat 2026)"


def tek(v) -> str:
    return "" if pd.isna(v) else " ".join(str(v).replace("\xa0", " ").split())


def turkce(v) -> str:
    """İki dilli hücrenin Türkçe kısmı: ilk satır; tek satırsa ' - ' ya da '- ' öncesi."""
    if pd.isna(v):
        return ""
    s = str(v).replace("\xa0", " ")
    ilk = s.split("\n")[0]
    if "\n" not in s:
        # "Türkçe - English" ya da "Türkçe- english": kalan kısım yalnız ASCII ise İngilizcedir
        for m in re.finditer(r"\s*-\s+", ilk):
            kalan = ilk[m.end():]
            if kalan and all(ord(c) < 128 for c in kalan) and re.search(r"[A-Za-z]{3,}", kalan):
                ilk = ilk[:m.start()]
                break
    ilk = re.sub(r"^[a-zçğıöşü]\)\s*(\(p\)\s*)?", "", ilk.strip())
    return " ".join(ilk.split()).strip(" -")


# ------------------------------------------------------------------ 1. dosyayı oku
def oku():
    X = pd.read_excel(XLSX, sheet_name=None, header=None)
    seriler = []
    for sh, df in X.items():
        ycols = {}
        for j, v in enumerate(df.iloc[2].tolist()):
            try:
                y = int(float(v))
                if 2000 < y < 2030:
                    ycols[j] = y
            except (TypeError, ValueError):
                pass
        code = baslik = sub = birim = ""
        yol_ham: dict[int, object] = {}
        veri_satiri: dict[int, bool] = {}  # yol öğesinin satırında değer var mı (varsa kırılımdır, blok başlığı değil)
        for i in range(3, len(df)):
            r = df.iloc[i].tolist()
            c1 = tek(r[1])
            m0 = re.match(r"^(\d+\.[0-9a-z]+\.\d+)", c1)
            if m0:
                code, baslik, sub, yol_ham = m0.group(1), turkce(r[2]), "", {}
            elif tek(r[2]) and not c1:
                sub, yol_ham = turkce(r[2]), {}  # "a) …" ya da harfsiz alt başlık (1.2.1'deki %50 / %60)
            veri_var = any(isinstance(r[j], (int, float)) and not pd.isna(r[j]) or re.fullmatch(r"-?[\d.]+", tek(r[j]))
                           for j in ycols)
            for k in (3, 4, 5, 6):
                if tek(r[k]) and re.match(r"^Yaş( grubu| \(Ay\))", tek(r[k])):
                    # yeni kırılım boyutu: Toplam/Erkek/Kadın satırlarının kardeşidir (girinti tutarsız olabilir)
                    for kk in [x for x in yol_ham if x > 3 or (x == 3 and re.match(TEMEL, tek(yol_ham[x])))]:
                        del yol_ham[kk]
                    yol_ham[max(k, 4) if 3 in yol_ham else k] = r[k]
                    continue
                if tek(r[k]):
                    yol_ham[k] = r[k]
                    veri_satiri[k] = veri_var
                    for kk in [x for x in yol_ham if x > k]:
                        del yol_ham[kk]
            if tek(r[7]):
                birim = turkce(r[7]).strip("() ")
            vals = {}
            for j, y in ycols.items():
                v = r[j]
                if isinstance(v, (int, float)) and not pd.isna(v):
                    vals[y] = float(v)
                elif re.fullmatch(r"-?[\d.]+", tek(v)):
                    vals[y] = float(tek(v))
            if vals and code:
                ks = sorted(yol_ham)
                seriler.append(dict(sheet=sh, row=i, code=code, baslik=baslik, sub=sub,
                                    yol=[turkce(yol_ham[k]) for k in ks], birim=birim, vals=vals,
                                    ilk_baslik=bool(ks) and not veri_satiri.get(ks[0], False)))
    return seriler


# ------------------------------------------------------------------ 2. veri tabanı
def db_oku():
    db = sqlite3.connect(KOK / "build" / "veri.db")
    D = defaultdict(lambda: defaultdict(dict))
    for ind, g, t, v in db.execute(
        "SELECT v.indicator, geo, time, value FROM values_long v JOIN indicators i ON i.indicator=v.indicator "
        "WHERE i.category=? AND v.source_file NOT LIKE 'ska_2026%' AND v.source_file NOT LIKE 'ska-2026%'", (KAT,)):
        D[ind][g][int(t)] = v
    B = {k: n for k, n in db.execute("SELECT geo, name FROM entities")}
    return D, B


def kod_bul(ind):
    m = re.search(r": (\d+\.\w+\.\d+)((?:\.\w+)?)", ind)
    return (m.group(1), m.group(1) + m.group(2)) if m else (None, None)


def sade(s):
    s = s.replace("İ", "i").replace("I", "ı").lower().strip()
    return s.translate(str.maketrans("âîû", "aiu"))


def esit(a, b):
    return abs(a - b) <= max(0.051, abs(b) * 0.001)


def main():
    S = oku()
    D, B = db_oku()
    bykod = defaultdict(list)
    for ind in D:
        bykod[kod_bul(ind)[0]].append(ind)
    prefix = {}
    for ind in D:
        m = re.match(r"^(SKA (\d\d) [^:]+):", ind)
        if m:
            prefix[int(m.group(2))] = m.group(1)
    ad2kod = {}
    for k, n in B.items():
        if re.fullmatch(r"TR\d\d\d|TR[A-C]\d\d", k):
            ad2kod[sade(n)] = k
    ad2kod.update({"afyon": "TR332", "afyonkarahisar": "TR332"})

    def geo(s):
        for p in s["yol"]:
            q = sade(p)
            if q in ad2kod:
                return ad2kod[q]
            m = re.match(r"^(TR[0-9A-C]\d)\b", p)
            if m:
                return m.group(1)
        return "TR"

    # eşleştirme
    for s in S:
        s["geo"] = geo(s)
        best = None
        for ind in bykod.get(s["code"], []):
            d = D[ind].get(s["geo"], {})
            ort = [y for y in s["vals"] if y in d]
            if ort and all(esit(s["vals"][y], d[y]) for y in ort) and (best is None or len(ort) > best[1]):
                best = (ind, len(ort))
        s["db"] = best[0] if best else None

    # blok: aynı sayfa, kod, alt gösterge ve yolun ilk öğesi (blok başlığı olabilir)
    def blok(s):
        return (s["sheet"], s["code"], s["sub"], s["yol"][0] if s["yol"] and s["ilk_baslik"] and not re.match(TEMEL, s["yol"][0]) else "")

    kardes = defaultdict(list)
    for s in S:
        if s["db"] and s["geo"] == "TR":
            kardes[blok(s)].append(s)

    satir, yeni_ad, revizyon, ek_yil, olcek, duzeltilen = [], Counter(), [], 0, [], 0
    eslesen_db = {s["db"] for s in S if s["db"]}
    for s in S:
        if s["db"]:  # 3. eşleşen serilerde yeni yıllar
            for y, v in sorted(s["vals"].items()):
                if y not in D[s["db"]].get(s["geo"], {}):
                    satir.append([s["geo"], s["db"], KAT, y, v, KAYNAK])
                    ek_yil += 1
            continue
        if s["geo"] != "TR":
            continue  # il/bölge kırılımları veri tabanında var (yuvarlama/ölçek farkı)
        benzer, duzelt = olcekli_esi(s, bykod, D, eslesen_db) or (None, False)
        if benzer and not duzelt:
            eslesen_db.add(benzer)
            continue
        if benzer:
            olcek.append((benzer, s))
            eslesen_db.add(benzer)
            for y, v in sorted(s["vals"].items()):
                eski = D[benzer]["TR"].get(y)
                if eski is None or not esit(v, eski):
                    satir.append(["TR", benzer, KAT, y, v, KAYNAK])
                    duzeltilen += eski is not None
                    ek_yil += eski is None
            continue
        ad = ad_kur(s, kardes.get(blok(s), []), prefix)
        if ad in D:
            revizyon.append((ad, s))
            continue
        yeni_ad[ad] += 1
        for y, v in sorted(s["vals"].items()):
            satir.append(["TR", ad, KAT, y, v, KAYNAK])

    # aynı adı alan iki seri olursa ikisini de at (belirsiz)
    cift = {a for a, n in yeni_ad.items() if n > 1}
    satir = [r for r in satir if r[1] not in cift]
    CIKTI.parent.mkdir(exist_ok=True)
    with open(CIKTI, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["kod", "gosterge", "kategori", "yil", "deger", "kaynak"])
        # ondalık ayırıcı virgül: "214.702" gibi değerler binlik ayırıcıyla karışmasın
        w.writerows([r[:4] + [repr(float(r[4])).replace(".", ",")] + r[5:] for r in satir])
    yeni = sorted(a for a in yeni_ad if a not in cift)
    with open(RAPOR, "w", encoding="utf-8") as f:
        f.write(f"Dosyadaki seri: {len(S)}; eşleşen: {sum(1 for s in S if s['db'])}; "
                f"il/bölge kırılımı (eşleşmeyen, eklenmedi): {sum(1 for s in S if not s['db'] and s['geo'] != 'TR')}\n")
        f.write(f"Eşleşen serilere eklenen yeni yıl-değer: {ek_yil}\n")
        f.write(f"Yeni gösterge: {len(yeni)}; değer: {sum(1 for r in satir if r[1] in set(yeni))}\n")
        f.write(f"Revizyon (adı var, değerleri farklı; eklenmedi): {len(revizyon)}\n")
        f.write(f"Belirsiz (aynı ada düşen, eklenmedi): {len(cift)}\n")
        f.write(f"Veri tabanında ölçek/yuvarlama farkıyla bulunan: {len(olcek)} gösterge; düzeltilen değer: {duzeltilen}\n\n== Yeni göstergeler\n")
        f.write("\n".join(yeni) + "\n\n== Revizyonlar\n")
        for ad, s in revizyon:
            ort = sorted(y for y in s["vals"] if y in D[ad].get("TR", {}))
            f.write(f"{ad}\n   dosya: {[(y, s['vals'][y]) for y in ort[-3:]]}  veri tabanı: {[(y, D[ad]['TR'][y]) for y in ort[-3:]]}\n")
        f.write("\n== Belirsiz\n" + "\n".join(sorted(cift)) + "\n")
        f.write("\n== Ölçek/yuvarlama farkı: dosyanın değerleri veri tabanındakini düzeltir\n")
        for ind, s in olcek:
            ort = sorted(y for y in s["vals"] if y in D[ind]["TR"])
            f.write(f"{ind}\n   dosya: {[(y, round(s['vals'][y], 4)) for y in ort[-3:]]}  veri tabanı: {[(y, D[ind]['TR'][y]) for y in ort[-3:]]}\n")
    print(open(RAPOR, encoding="utf-8").read().split("\n\n")[0])


def olcekli_esi(s, bykod, D, eslesen_db):
    """Aynı kodlu, henüz eşleşmemiş bir TR göstergesi bu serinin kendisi mi? Her ortak yılda değerler ya aynı,
    ya tam sayıya yuvarlanmış (|fark| ≤ 0,5, değer ≥ 20) ya da 10'un kuvveti kadar kaymış olmalı (eski kaynak
    dosyada ondalık ayırıcı hatası: 0,213 → 213). Öyleyse veri tabanındaki gösterge döndürülür; dosyanın
    değerleri o göstergeyi düzeltir."""
    import math
    for ind in bykod.get(s["code"], []):
        if ind in eslesen_db:
            continue
        d = D[ind].get("TR", {})
        ort = [y for y in s["vals"] if y in d]
        if len(ort) < 2:
            continue
        ok = 0
        for y in ort:
            a, b = s["vals"][y], d[y]
            if esit(a, b) or (abs(b) >= 20 and abs(a - b) <= 0.51):
                ok += 1
            elif a and b and (a > 0) == (b > 0):
                k = math.log10(b / a)
                if abs(k - round(k)) < 0.004 and round(k) != 0:
                    ok += 1
        if ok == len(ort):
            # bütün yıllarda aynı ölçek farkı ve adda bu ölçeği açıklayan birim varsa (ör. "milyon ton"
            # göstergesi, dosyada ton) veri tabanı tutarlıdır: gösterge var sayılır ama düzeltilmez
            ks = {round(math.log10(d[y] / s["vals"][y])) for y in ort if d[y] and s["vals"][y] and (d[y] > 0) == (s["vals"][y] > 0)}
            if len(ks) == 1 and (k := ks.pop()) != 0:
                ad = ind.lower()
                if (abs(k) == 6 and "milyon" in ad) or (abs(k) == 3 and ("bin" in ad or "1000" in ad or "1.000" in ad)):
                    return ind, False
            return ind, True
    return None


TEMEL = r"^(Toplam|Erkek|Kadın|Kent|Kır|Yaş|Belirtilmemiş|\d|<|>|≤|≥|\+)"


def ad_kur(s, kardesler, prefix):
    """Veri tabanındaki adlandırmaya uygun gösterge adı."""
    amac = int(s["code"].split(".")[0])
    on = prefix.get(amac, f"SKA {amac:02d}")
    # kod: kardeşin tam kodu (1.3.1.a), yoksa ana kod
    tam = kod_bul(kardesler[0]["db"])[1] if kardesler else s["code"]
    yol = list(s["yol"])
    if s["sub"]:
        baslik = s["sub"]
    elif yol and s["ilk_baslik"] and not re.match(TEMEL, yol[0]):
        baslik = yol.pop(0)
    else:
        baslik = s["baslik"]
    kirilim = [p for p in yol if p and p != "Toplam"]
    # "Yaş grubu" gibi başlıklar değerle birleşir: "Yaş grubu: 18-24"
    parca = []
    i = 0
    while i < len(kirilim):
        p = kirilim[i]
        if re.match(r"^Yaş( grubu| \(Ay\))?$", p, re.I) and i + 1 < len(kirilim):
            parca.append(f"{p}: {kirilim[i + 1]}")
            i += 2
            continue
        parca.append(p)
        i += 1
    ad = f"{on}: {tam} {baslik}"
    for p in parca:
        ad += f" ({p})"
    birim = s["birim"] or ""
    if birim:
        ad += f" ({birim.replace('1 000', '1000')})"
    return " ".join(ad.split())


if __name__ == "__main__":
    main()
