"""
denetim.py — veritabanı (build/veri.db) için otomatik doğruluk ve güncellik denetimleri.

  1. Güncellik: göstergelerin son yılı; uzun süredir güncellenmeyenler.
  2. Toplam tutarlılığı: toplanabilir göstergelerde il toplamı = Düzey 2 toplamı = Türkiye değeri mi?
  3. Ölçek sıçramaları: bir yılın il değerleri diğer yıllara göre topluca 50 kat ve üzeri farklıysa (birim hatası şüphesi).
  4. Olağan dışı yıllık değişim: bir ilin değerinin bir yılda 5 katına çıkması ya da beşte birine düşmesi.
  5. Dünya Bankası çapraz kontrolü: Türkiye nüfusu, GSYH ve mal ihracatı (API).

Tek başına çalıştırma: python tools/guncelle/denetim.py  (raporu ekrana yazar)
"""
from __future__ import annotations

import datetime as dt
import json
import math
import re
import sqlite3
import statistics
import urllib.request
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
UA = "dakaveri-guncelleme/1.0"
TOPLANABILIR = re.compile(r"Sayısı|\((Bin TL|1000 \$|Bin \$|MWh|GWh|Kişi|Bin Kişi|Ton|Hektar|Adet|m²|Km|km)\)|^Toplam ", re.I)
TOPLANAMAZ = re.compile(r"Bir Milyon|Kişiye Düşen|Kişide|Nüfusta|Oran|Başına|Hızı|Pay|Ortalama|Ortanca|Medyan|Endeks|%|Yoğunluğu|Büyüklüğü|Süresi|Yaşı|\(TL\)|Değişim|SKA |OECD|Bin Kişiye|Yüz Bin", re.I)


def nf(v, d=0):
    """Türkçe sayı biçimi: binlik nokta, ondalık virgül."""
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def baglan():
    return sqlite3.connect(KOK / "build/veri.db")


def yayinda():
    """Sitede yayımlanan göstergelerin veritabanı adları ve son yılları (manifest)."""
    M = json.load(open(KOK / "public/veri/manifest.json", encoding="utf-8"))
    out = {}
    for k in M["kategoriler"]:
        for g in k["gostergeler"]:
            ad = g["ad"]
            kk = g.get("kaynakKisa")
            if kk and ad.endswith(f" ({kk})"):
                ad = ad[: -(len(kk) + 3)]
            out[ad] = (k["ad"], g)
    return out


def guncellik(Y):
    bu_yil = dt.date.today().year
    son = defaultdict(list)
    for ad, (kat, g) in Y.items():
        if g.get("yillar"):
            son[kat].append((g["yillar"][-1], ad))
    L = ["### Güncellik", "", "| Kategori | Gösterge | Son yılın ortancası | 4 yıldan eski olan |", "|---|---:|---:|---:|"]
    eski = []
    for kat in sorted(son):
        ys = [y for y, _ in son[kat]]
        e = [(y, a) for y, a in son[kat] if y <= bu_yil - 4]
        eski += [(kat, y, a) for y, a in e]
        L.append(f"| {kat} | {len(ys)} | {int(statistics.median(ys))} | {len(e)} |")
    tek = [x for x in eski if not x[2].startswith("SKA ")]
    if tek:
        L += ["", f"Son verisi {bu_yil - 4} ya da daha eski olan göstergelerden bazıları (SKA hariç, en eskiden):", ""]
        L += [f"- {a} — {y} ({k})" for k, y, a in sorted(tek)[:25]]
    return L


def toplamlar(db, Y):
    ents = {g: (lv, p) for g, lv, p in db.execute("SELECT geo, level, parent FROM entities")}
    adaylar = [a for a in Y if TOPLANABILIR.search(a) and not TOPLANAMAZ.search(a)]
    bulgu = []
    for ad in adaylar:
        d = defaultdict(dict)
        for t, g, v in db.execute("SELECT time, geo, value FROM values_long WHERE indicator=? AND value IS NOT NULL", (ad,)):
            if g in ents or g == "TR":
                d[t][g] = v
        for t, vals in d.items():
            il = [v for g, v in vals.items() if ents.get(g, ("",))[0] == "province"]
            d2 = [v for g, v in vals.items() if ents.get(g, ("",))[0] == "region26"]
            tr = vals.get("TR")
            if len(il) >= 81 and tr:
                fark = (sum(il) - tr) / tr if tr else 0
                if abs(fark) > 0.02:
                    bulgu.append((abs(fark), ad, t, "il toplamı ≠ Türkiye", sum(il), tr))
            if len(il) >= 81 and len(d2) >= 26:
                s2 = sum(d2)
                if s2 and abs(sum(il) - s2) / s2 > 0.02:
                    bulgu.append((abs(sum(il) - s2) / s2, ad, t, "il toplamı ≠ Düzey 2 toplamı", sum(il), s2))
    gost = sorted({b[1] for b in bulgu})
    L = ["### Toplam tutarlılığı", "",
         f"{len(adaylar)} toplanabilir gösterge denetlendi; %2'den büyük farkı olan {len(gost)} gösterge, {len(bulgu)} gösterge-yıl. "
         "Fark her zaman hata değildir (ör. Türkiye toplamında yurt dışı ya da \"bilinmeyen\" il bulunabilir); en büyükleri:", ""]
    son = {}
    for b in sorted(bulgu, reverse=True):
        son.setdefault((b[1], b[3]), b)
    for b in list(son.values())[:25]:
        L.append(f"- {b[1]} ({b[2]}): {b[3]}, fark %{nf(100 * b[0], 1)} ({nf(b[4])} / {nf(b[5])})")
    return L


def il_serileri(db):
    prov = {g for (g,) in db.execute("SELECT geo FROM entities WHERE level='province'")}
    d = defaultdict(lambda: defaultdict(dict))
    for ind, t, g, v in db.execute("SELECT indicator, time, geo, value FROM values_long WHERE value IS NOT NULL"):
        if g in prov and str(t).isdigit():
            d[ind][int(t)][g] = v
    return d


def olcek_ve_sicrama(seriler, Y):
    olcek, sicrama = [], []
    for ind, yil in seriler.items():
        if ind not in Y or len(yil) < 3:
            continue
        med = {y: statistics.median([abs(v) for v in vs.values()]) for y, vs in yil.items() if len(vs) >= 40}
        if len(med) >= 3:
            genel = statistics.median(med.values())
            for y, m in med.items():
                if genel > 0 and m > 0 and (m / genel >= 50 or genel / m >= 50):
                    olcek.append((ind, y, m, genel))
        ys = sorted(yil)
        for a, b in zip(ys, ys[1:]):
            if b - a != 1:
                continue
            for g, v1 in yil[b].items():
                v0 = yil[a].get(g)
                if v0 and v1 and v0 > 0 and v1 > 0 and min(v0, v1) >= 100 and not TOPLANAMAZ.search(ind):
                    r = v1 / v0
                    if r >= 5 or r <= 0.2:
                        sicrama.append((abs(math.log(r)), ind, g, a, b, v0, v1))
    ad = {g: n for g, n in baglan().execute("SELECT geo, name FROM entities")}
    L = ["### Ölçek sıçramaları (birim hatası şüphesi)", ""]
    L += [f"- {i} — {y}: il ortancası {nf(m, 2)}, diğer yılların ortancası {nf(g, 2)}" for i, y, m, g in olcek[:30]] or ["- Bulunmadı."]
    gost = defaultdict(list)
    for s in sicrama:
        gost[s[1]].append(s)
    L += ["", "### Olağan dışı yıllık değişimler (bir yılda 5 kat artış ya da beşte bire düşüş)", "",
          f"{len(sicrama)} il-yıl, {len(gost)} göstergede. Gerçek bir olay (yeni fabrika, havalimanı açılışı, sınıflama değişikliği) "
          "olabileceği gibi veri hatası da olabilir; en çok tekrarlayan göstergeler:", ""]
    for ind, ss in sorted(gost.items(), key=lambda x: -len(x[1]))[:20]:
        s = max(ss)
        L.append(f"- {ind}: {len(ss)} durum · en büyüğü {ad.get(s[2], s[2])} {s[3]}→{s[4]}: {nf(s[5])} → {nf(s[6])}")
    return L


def dunya_bankasi(db):
    """Türkiye toplamlarını Dünya Bankası Göstergeleri API'siyle karşılaştırır."""
    kontrol = [("SP.POP.TOTL", "Toplam Nüfus", 1, "Nüfus"),
               ("NY.GDP.MKTP.CN", "Gayrisafi Yurt İçi Hasıla (GSYH) (Bin TL)", 1000, "GSYH (cari, TL)"),
               ("TX.VAL.MRCH.CD.WT", "Toplam İhracat (1000 $)", 1000, "Mal ihracatı ($)")]
    L = ["### Dünya Bankası çapraz kontrolü (Türkiye toplamları)", "", "| Gösterge | Yıl | Platform | Dünya Bankası | Fark |", "|---|---:|---:|---:|---:|"]
    for kod, ad, carp, et in kontrol:
        try:
            url = f"https://api.worldbank.org/v2/country/TUR/indicator/{kod}?format=json&per_page=100"
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            wb = {int(r["date"]): r["value"] for r in json.load(urllib.request.urlopen(req, timeout=60))[1] if r["value"] is not None}
        except Exception as e:  # noqa: BLE001
            L.append(f"| {et} | – | – | – | API hatası: {e} |")
            continue
        biz = {int(t): v * carp for t, v in db.execute("SELECT time, value FROM values_long WHERE indicator=? AND geo='TR' AND value IS NOT NULL", (ad,)) if str(t).isdigit()}
        ortak = sorted(set(wb) & set(biz))[-4:]
        for y in ortak:
            f = (biz[y] - wb[y]) / wb[y]
            isaret = " ⚠" if abs(f) > 0.02 else ""
            L.append(f"| {et} | {y} | {nf(biz[y])} | {nf(wb[y])} | %{'+' if f >= 0 else '−'}{nf(abs(100 * f), 1)}{isaret} |")
    L += ["", "Fark %2'yi aşarsa ⚠ ile işaretlenir; tanım farkları (ör. ihracatta özel ticaret sistemi, nüfusta yıl ortası/yıl sonu) küçük sapmalara yol açabilir."]
    return L


def hepsi() -> list[str]:
    db = baglan()
    Y = yayinda()
    L = []
    L += guncellik(Y) + [""]
    L += toplamlar(db, Y) + [""]
    L += olcek_ve_sicrama(il_serileri(db), Y) + [""]
    L += dunya_bankasi(db)
    return L


if __name__ == "__main__":
    print("\n".join(hepsi()))
