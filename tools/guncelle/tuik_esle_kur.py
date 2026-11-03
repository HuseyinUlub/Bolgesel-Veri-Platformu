"""
tuik_esle_kur.py — TÜİK eşleme tablosunu kurar ve doğrular (kurulum aracı; güncellemede kullanılmaz).

Yöntem: her aday gösterge için ilgili TÜİK akışının bütün serileri (değeri değişen boyutların her bileşimi) sitedeki
yayımlanmış değerlerle aynı il ve yıllarda karşılaştırılır. Birim çarpanı (1, 1000, 0,001 ...) değerlerin oranından
bulunur. Tek seri tutmazsa oran göstergeleri için pay/payda çiftleri denenir. API'de il dışı düzeyler yoksa il
değerlerinin toplamının sitedeki Düzey 2 / Düzey 1 / Türkiye değerlerini verip vermediğine bakılır.

Sonuç:
  pipeline/donusturuculer/eslemeler/tuik.csv          eşleme tablosu (onayli / inceleme)
  incelemeler/tuik-esleme-kontrol.xlsx                gösterge başına karşılaştırma ve en iyi seçenekler

Kullanım: python tools/guncelle/tuik_esle_kur.py [--adaylar build/guncelleme/tuik/adaylar.csv]
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "pipeline"))
import tuik_donustur as D  # noqa: E402
import tuik_yapi as Y  # noqa: E402
from kaynak_turu import kisa  # noqa: E402

KOK = D.KOK
CARPANLAR = [1, 1e3, 1e-3, 1e6, 1e-6, 100, 0.01, 10, 0.1, 1e9, 1e-9]
ESIK_ONAY = 0.80      # ortak değerlerin en az %80'i birebir tutmalı (doğru seri); kalan farklar revizyon olarak raporlanır
ESIK_TAM = 0.95
EN_AZ_ORTAK = 20


def yayinlanan():
    M = json.loads((KOK / "public/veri/manifest.json").read_text(encoding="utf-8"))
    by_ad, kat_veri = {}, {}
    for k in M["kategoriler"]:
        for g in k["gostergeler"]:
            by_ad[g["ad"]] = {**g, "kategori": k["ad"], "slug": k["slug"]}
    def veri(g):
        if g["slug"] not in kat_veri:
            kat_veri[g["slug"]] = json.loads((KOK / "public/veri/k" / f"{g['slug']}.json").read_text(encoding="utf-8"))
        return {(kod, yil): float(v) for yil, d in kat_veri[g["slug"]].get(g["id"], {}).items() for kod, v in d.items()}
    return by_ad, veri


def ic_ad(gorunen: str, kaynak: str) -> str:
    k = kisa(gorunen, kaynak)
    return gorunen[: -len(f" ({k})")] if k and gorunen.endswith(f" ({k})") else gorunen


def tutar(a: float, p: float, ond: int) -> bool:
    return abs(a - p) <= max(0.5 * 10 ** -ond * 1.001, abs(p) * 1e-4)


def yakin(a: float, p: float) -> bool:
    return abs(a - p) <= abs(p) * 0.005 + 1e-9


def puanla(S: dict, P: dict, ond: int, carpan: float | None = None):
    ortak = [k for k in P if k in S]
    if len(ortak) < 3:
        return None
    if carpan is None:
        oranlar = [P[k] / S[k] for k in ortak if S[k] and P[k]]
        if not oranlar:
            return None
        med = statistics.median(oranlar)
        carpan = min(CARPANLAR, key=lambda c: abs(math.log10(abs(med) or 1e-12) - math.log10(c)))
    birebir = sum(tutar(S[k] * carpan, P[k], ond) for k in ortak)
    yakin_ = sum(yakin(S[k] * carpan, P[k]) for k in ortak)
    son_yil = max(k[1] for k in ortak)
    son = [k for k in ortak if k[1] == son_yil]
    son_p = sum(tutar(S[k] * carpan, P[k], ond) or yakin(S[k] * carpan, P[k]) for k in son) / len(son)
    return {"carpan": carpan, "ortak": len(ortak), "birebir": birebir / len(ortak), "yakin": yakin_ / len(ortak),
            "son": son_p, "son_yil": son_yil, "son_n": len(son)}


def sira(x):
    """Doğru seriyi seçme ölçütü: bütün yıllarda birebir uyum ya da (TÜİK revizyonları için) son ortak yılda uyum."""
    return (max(x["birebir"], x["son"] * 0.98 if x["son_n"] >= 10 else 0), x["yakin"], x["ortak"])


def akis_seriler(akis: str, ay: str = "toplam"):
    d = D.yillik(D.oku(akis), ay)
    geo = D.geo_boyutu(d)
    dims = D.degisen_boyutlar(d, geo)
    return d, geo, dims, D.seriler(d, geo, dims)


def etiketle(filtre: str, Y_):
    if not filtre:
        return ""
    return " · ".join(f"{Y_['etiket'].get(k, {}).get(v, v)}" for k, v in D.filtre_coz(filtre).items())


def aday_akislar(metin: str, kapsam: dict) -> list[str]:
    import fnmatch
    parca = [p.strip() for p in str(metin).split("/")]
    onek = parca[0].rsplit("_", 1)[0]
    out = []
    for p in parca:
        if not p.startswith(("DF_", "UH_")):
            p = onek + "_" + p
        if "*" in p:
            out += [k for k in kapsam if fnmatch.fnmatch(k, p)]
        elif p in kapsam:
            out.append(p)
        else:
            out += [k for k in kapsam if k.startswith(p)]
    # bilinen ad farkları
    ek = {"DF_MUZE_SAYISI_ESER_SAY": "DF_MUZE_ESER_SAY", "DF_MUZE_SAYISI_ORENYER_ZYARETCI": "DF_MUZE_ORENYER_ZYARETCI",
          "DF_ATIK_BELEDIYE_HIZMET_ATIKYONETIMI_V1": "DF_ATIK_BELEDIYE_ATIKYONETIMI_V1"}
    for p in parca:
        tam = p if p.startswith(("DF_", "UH_")) else onek + "_" + p
        if tam in ek:
            out.append(ek[tam])
    return list(dict.fromkeys(out))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--adaylar", default=str(KOK / "build/guncelleme/tuik/adaylar.csv"))
    a = ap.parse_args(argv)
    kapsam = {r["akis"]: r for r in csv.DictReader(open(KOK / "tuik-akis-kapsami.csv", encoding="utf-8-sig"), delimiter=";")}
    adaylar = list(csv.DictReader(open(a.adaylar, encoding="utf-8-sig"), delimiter=";"))
    by_ad, veri = yayinlanan()
    tok = None
    yapilar, akislar = {}, {}
    sonuc, esleme = [], []
    for i, r in enumerate(adaylar, 1):
        g = by_ad.get(r["gosterge"])
        if not g:
            sonuc.append({**r, "sonuc": "sitede bulunamadı"}); continue
        P = veri(g)
        ond = g.get("ondalik", 1)
        en_iyi = []
        for akis in aday_akislar(r["akis"], kapsam):
            if not (D.HAM / f"{akis}.csv.gz").exists():
                continue
            aylar = ("toplam", "12") if D.aylik_mi(D.oku(akis)) else ("",)
            for ay in aylar:
              if (akis, ay) not in akislar:
                akislar[(akis, ay)] = akis_seriler(akis, ay or "toplam")
                if akis not in yapilar:
                    if tok is None:
                        tok = Y.T.token()
                    yapilar[akis] = Y.yapi(akis, kapsam[akis]["surum"], tok)
              d, geo, dims, seriler = akislar[(akis, ay)]
              for f, S in seriler.items():
                p = puanla(S, P, ond)
                if p:
                    en_iyi.append({"akis": akis, "ay": ay, "geo": geo, "filtre": f, "payda": "", **p})
              # oran: tek seri tutmuyorsa pay/payda (paydası bir boyutta farklı olan seri)
              if not en_iyi or max(sira(x)[0] for x in en_iyi) < 0.9:
                if len(seriler) <= 600 and dims:
                    anahtarlar = list(seriler)
                    fz = {k: D.filtre_coz(k) for k in anahtarlar}
                    for pay in anahtarlar:
                        for payda in anahtarlar:
                            if pay == payda:
                                continue
                            fark = [k for k in dims if fz[pay][k] != fz[payda][k]]
                            if len(fark) != 1:
                                continue
                            Sp, Sd = seriler[pay], seriler[payda]
                            O = {k: Sp[k] / Sd[k] for k in Sp if Sd.get(k)}
                            for c in (100, 1000, 1, 100000):
                                p = puanla(O, P, ond, c)
                                if p and max(p["birebir"], p["son"]) >= 0.5:
                                    en_iyi.append({"akis": akis, "ay": ay, "geo": geo, "filtre": pay, "payda": payda, **p})
        en_iyi.sort(key=sira, reverse=True)
        if not en_iyi:
            sonuc.append({**r, "id": g["id"], "sonuc": "akışta ortak il-yıl bulunamadı"}); continue
        b = en_iyi[0]
        satir = {"akis": b["akis"], "surum": kapsam[b["akis"]]["surum"], "geo": b["geo"], "filtre": b["filtre"],
                 "payda": b["payda"], "carpan": f"{b['carpan']:g}".replace(".", ","), "topla": "hayir", "ay": b["ay"],
                 "gosterge": ic_ad(r["gosterge"], g["kaynak"]), "kategori": g["kategori"]}
        # toplama: API'de olmayan üst düzeyler il toplamından üretilebiliyor mu?
        A = D.uygula(satir, akislar[(b["akis"], b["ay"])][0])
        eksik = [k for k in P if k not in A and D.duzey(k[0]) in ("D2", "D1", "TR")]
        toplam_puan = None
        if eksik:
            At = D.uygula({**satir, "topla": "evet"}, akislar[(b["akis"], b["ay"])][0])
            ortak = [k for k in eksik if k in At]
            if ortak:
                toplam_puan = sum(tutar(At[k], P[k], ond) or yakin(At[k], P[k]) for k in ortak) / len(ortak)
                if toplam_puan >= 0.9:
                    satir["topla"] = "evet"
                    A = At
        ortak = [k for k in P if k in A]
        birebir = sum(tutar(A[k], P[k], ond) for k in ortak) / max(len(ortak), 1)
        yakin_ = sum(yakin(A[k], P[k]) for k in ortak) / max(len(ortak), 1)
        yeni_yil = sorted({k[1] for k in A} - {k[1] for k in P})
        kapsanmayan = sorted({D.duzey(k[0]) for k in P if k not in A} - {None})
        son_ok = b["son_n"] >= 10 and b["son"] >= ESIK_TAM
        kucuk_fark = yakin_ >= 0.95  # farklar %0,5'in altında: TÜİK'in küçük revizyonları
        onay = len(ortak) >= EN_AZ_ORTAK and (birebir >= ESIK_ONAY or son_ok or kucuk_fark)
        satir["durum"] = "onayli" if onay else "inceleme"
        neden = "" if birebir >= ESIK_ONAY else (
            f"; son ortak yıl {b['son_yil']} uyumlu, önceki yıllar TÜİK'te revize" if son_ok else
            "; farklar %0,5'in altında (TÜİK revizyonu)" if kucuk_fark else "")
        satir["eslesme"] = f"{len(ortak)} ortak değer, %{birebir*100:.1f} birebir, %{yakin_*100:.1f} yakın{neden}"
        Y_ = yapilar[b["akis"]]
        satir["not"] = etiketle(b["filtre"], Y_) + (f" / payda: {etiketle(b['payda'], Y_)}" if b["payda"] else "")
        esleme.append(satir)
        alternatif = " | ".join(f"{etiketle(x['filtre'], yapilar[x['akis']])}{' / ' + etiketle(x['payda'], yapilar[x['akis']]) if x['payda'] else ''}"
                                f" ({x['akis']}, ×{x['carpan']:g}, %{x['birebir']*100:.0f})" for x in en_iyi[1:4])
        sonuc.append({**r, "id": g["id"], "sonuc": satir["durum"], "akis_secilen": b["akis"], "seri": satir["not"],
                      "carpan": satir["carpan"], "topla": satir["topla"], "ortak": len(ortak),
                      "birebir": round(birebir * 100, 1), "yakin": round(yakin_ * 100, 1),
                      "son": f"{b['son_yil']}: %{b['son']*100:.0f}", "aciklama": neden.strip('; '),
                      "toplam_puan": None if toplam_puan is None else round(toplam_puan * 100, 1),
                      "yeni_yillar": ", ".join(yeni_yil), "kapsanmayan_duzey": ", ".join(kapsanmayan),
                      "alternatifler": alternatif, "_A": A, "_P": P, "_ond": ond})
        print(f"{i}/{len(adaylar)} {satir['durum']:9} %{birebir*100:5.1f} {r['gosterge'][:70]}", flush=True)
    D.esleme_yaz(esleme)
    rapor(sonuc)


def rapor(sonuc):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    wb = Workbook()
    ws = wb.active
    ws.title = "Özet"
    durum = defaultdict(int)
    for s in sonuc:
        durum[s["sonuc"]] += 1
    ws.append(["TÜİK API eşleme kontrolü"]); ws["A1"].font = Font(bold=True, size=13)
    ws.append(["Her aday gösterge, TÜİK akışındaki serilerle sitede yayımlanan değerler üzerinden karşılaştırıldı. Kaynak: TÜİK SDMX API; Hesaplama: Platform"])
    ws.append([])
    ws.append(["Sonuç", "Gösterge"])
    for k in ("onayli", "inceleme", "akışta ortak il-yıl bulunamadı", "sitede bulunamadı"):
        ws.append([{"onayli": "Onaylandı (değerlerin en az %80'i birebir aynı; farklar API değeriyle güncellenecek)", "inceleme": "İnceleme gerekiyor (doğru seri bulunamadı ya da farklar büyük)"}.get(k, k.capitalize()), durum.get(k, 0)])
    ws.append(["Toplam", len(sonuc)])
    ws.append([])
    ws.append(["Birebir: sitedeki değerle yayımlanan ondalık basamağına kadar aynı. Yakın: fark %0,5'ten az (TÜİK revizyonu ya da yuvarlama)."])
    ws.append(["Toplama: API'de yalnız il değeri varsa Düzey 2, Düzey 1 ve Türkiye değerleri il toplamından üretilir; 'Toplam uyumu' bu değerlerin sitedekiyle uyumunu gösterir."])
    ws.column_dimensions["A"].width = 60; ws.column_dimensions["B"].width = 12

    ws2 = wb.create_sheet("Göstergeler")
    bas = ["Gösterge", "Sonuç", "Aday akış", "Seçilen akış", "Seçilen seri", "Çarpan", "İl toplamından üst düzey",
           "Ortak değer", "Birebir (%)", "Yakın (%)", "Son ortak yılda uyum", "Açıklama", "Toplam uyumu (%)", "API'de olup sitede olmayan yıllar",
           "API'de olmayan düzeyler", "Diğer seçenekler"]
    ws2.append(bas)
    for s in sorted(sonuc, key=lambda x: (x["sonuc"] != "inceleme", x.get("birebir") or 0)):
        ws2.append([s["gosterge"], {"onayli": "Onaylandı", "inceleme": "İnceleme"}.get(s["sonuc"], s["sonuc"]), s["akis"],
                    s.get("akis_secilen"), s.get("seri"), s.get("carpan"), s.get("topla"), s.get("ortak"), s.get("birebir"),
                    s.get("yakin"), s.get("son"), s.get("aciklama"), s.get("toplam_puan"), s.get("yeni_yillar"), s.get("kapsanmayan_duzey"), s.get("alternatifler")])
    _bicim(ws2, [55, 12, 30, 30, 55, 8, 10, 10, 10, 10, 14, 40, 10, 22, 16, 80])

    ws3 = wb.create_sheet("Farklar")
    ws3.append(["Gösterge", "Kod", "Yıl", "Sitedeki değer", "API değeri", "Fark (%)"])
    for s in sonuc:
        if "_A" not in s:
            continue
        A, P, ond = s["_A"], s["_P"], s["_ond"]
        fark = [(k, P[k], A[k]) for k in P if k in A and not tutar(A[k], P[k], ond)]
        fark.sort(key=lambda x: -abs(x[2] - x[1]) / (abs(x[1]) or 1))
        for (kod, yil), p, v in fark[:15]:
            ws3.append([s["gosterge"], kod, int(yil), p, round(v, 6), round((v - p) / p * 100, 2) if p else None])
    _bicim(ws3, [55, 8, 8, 16, 16, 10])
    p = KOK / "incelemeler/tuik-esleme-kontrol.xlsx"
    p.parent.mkdir(parents=True, exist_ok=True)
    wb.save(p)
    print(f"-> {p}")


def _bicim(ws, gen):
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    for i, w in enumerate(gen, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="6E2A14")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions


if __name__ == "__main__":
    sys.exit(main())
