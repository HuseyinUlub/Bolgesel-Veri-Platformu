"""
guncelle.py — veri kaynaklarını API'den güncelleyip denetim raporu üretir (onaysız hiçbir şeyi değiştirmez).

Adımlar
  1. OECD: tools/guncelle/oecd_indir.py ile Türkiye verisini indirir, pipeline/donusturuculer/oecd_sdmx.py ile
     mevcut eşleme kurallarına göre dönüştürür (aday dosyalar: build/guncelleme/aday/*.csv).
  1b. TÜİK: tools/guncelle/tuik_indir.py ile eşleme tablosundaki (pipeline/donusturuculer/eslemeler/tuik.csv) onaylı
     göstergelerin akışlarını SDMX API'sinden indirir (anahtar: proje kökünde tuik-api-key.txt), tuik_aday.py ile
     göstergelere çevirir ve sitedeki değerlerle karşılaştırır (aday: build/guncelleme/aday/tuik-api.csv).
     TÜİK API değerleri esas alınır: veri-ekleri/tuik-api.csv diğer dosyalardaki aynı il-yıl değerlerinin önüne geçer.
  2. Birleştirme: aday değerler mevcut veri-ekleri dosyasıyla birleştirilir. OECD'nin artık sunmadığı göstergeler
     ve yıllar silinmez, mevcut değerleriyle korunur (rapor bunları ayrıca listeler).
  3. Karşılaştırma: yeni yıllar, değişen (revize edilen) değerler, kaynakta artık bulunmayanlar.
  4. Denetimler (tools/guncelle/denetim.py): veritabanında toplam tutarlılığı, olağan dışı yıllık değişimler,
     Dünya Bankası Türkiye değerleriyle çapraz kontrol.
  5. Rapor: build/guncelleme/rapor-YYYY-AA-GG.md (ve .html).

  --uygula verilirse aday dosyalar (oecd-bolgesel, oecd-kentler, tuik-api) veri-ekleri'ne yazılır, veri hattı (pipeline/build_data.py) ve
  Analiz Masası verisi (tools/analiz/analiz_verisi.py) yeniden üretilir.

Kullanım:
    python tools/guncelle/guncelle.py                 # indir + karşılaştır + denetle + rapor
    python tools/guncelle/guncelle.py --indirme-yok   # önceden indirilmiş dosyalarla
    python tools/guncelle/guncelle.py --uygula        # rapor sonrası değişiklikleri uygula
    python tools/guncelle/guncelle.py --kaynak tuik   # yalnız TÜİK
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
import aday_denetim  # noqa: E402
import denetim  # noqa: E402

GD = KOK / "build/guncelleme"
OECD_DOSYALAR = ["oecd-bolgesel", "oecd-kentler"]
TUIK_DOSYA = "tuik-api"
ESIK = 0.005  # %0,5'ten büyük göreli fark "revizyon" sayılır


def oku(p: Path):
    if not p.exists():
        return [], []
    with open(p, encoding="utf-8-sig", newline="") as f:
        r = csv.reader(f, delimiter=";")
        bas = next(r)
        return bas, [row for row in r if row]


def sayi(s):
    try:
        return float(str(s).replace(",", "."))
    except ValueError:
        return None


def birlestir(ad: str, gecmis: bool = False):
    """Mevcut veri-ekleri dosyası + yeni aday → birleşik aday ve karşılaştırma özeti."""
    bas, eski = oku(KOK / "veri-ekleri" / f"{ad}.csv")
    _, yeni = oku(GD / "aday" / f"{ad}.ham.csv")
    if not bas:
        bas = ["kod", "gosterge", "kategori", "yil", "deger", "kaynak", "oncelik", "yayin"]
    E = {(r[0], r[1], r[3]): r for r in eski}
    Y = {(r[0], r[1], r[3]): r for r in yeni}
    if not (GD / "aday" / f"{ad}.ham.csv").exists():  # kaynak bu çalıştırmada üretilmediyse mevcut dosya aynen korunur
        Y = {}
    # Mevcut dosyadaki ilk yıldan önceki yıllar bilerek alınmamış olabilir: varsayılan olarak eklenmez, ayrıca raporlanır
    ilk = defaultdict(lambda: "9999")
    for k in E:
        ilk[k[1]] = min(ilk[k[1]], k[2])
    gecmis_ozet = defaultdict(int)
    if not gecmis:
        for k in list(Y):
            if k[1] in ilk and k[2] < ilk[k[1]]:
                gecmis_ozet[k[1]] += 1
                del Y[k]
    yeni_gost = {k[1] for k in Y}
    ozet = defaultdict(lambda: {"yeni": 0, "degisen": 0, "ayni": 0, "kaynakta_yok": 0, "ornek": [], "yillar_yeni": set()})
    for k, r in Y.items():
        o = ozet[k[1]]
        if k not in E:
            o["yeni"] += 1
            o["yillar_yeni"].add(k[2])
        else:
            a, b = sayi(E[k][4]), sayi(r[4])
            if a is not None and b is not None and abs(a - b) > ESIK * max(abs(a), abs(b), 1e-9):
                o["degisen"] += 1
                if len(o["ornek"]) < 3:
                    o["ornek"].append(f"{k[0]} {k[2]}: {E[k][4]} → {r[4]}")
            else:
                o["ayni"] += 1
    korunan_gost = sorted({k[1] for k in E} - yeni_gost)
    for k in E:
        if k[1] in yeni_gost and k not in Y:
            ozet[k[1]]["kaynakta_yok"] += 1
    # birleşik: eski değerler korunur, yeni değerler üzerine yazar
    birlesik = dict(E)
    birlesik.update(Y)
    satirlar = sorted(birlesik.values(), key=lambda r: (r[1], r[3], r[0]))
    with open(GD / "aday" / f"{ad}.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(bas)
        for r in satirlar:
            w.writerow((r + [""] * len(bas))[: len(bas)])
    return {"ozet": ozet, "korunan": korunan_gost, "eski": len(E), "yeni": len(Y), "birlesik": len(satirlar),
            "gecmis": dict(gecmis_ozet), "ilk": dict(ilk)}


def calistir(komut: list[str], log: Path) -> int:
    # Alt betikler Türkçe yazar; Windows'ta varsayılan kodlama cp1252 olduğundan UTF-8 zorunlu kılınır
    env = dict(os.environ, PYTHONUTF8="1")
    with open(log, "w", encoding="utf-8") as f:
        return subprocess.run(komut, cwd=KOK, stdout=f, stderr=subprocess.STDOUT, env=env).returncode


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--indirme-yok", action="store_true")
    ap.add_argument("--uygula", action="store_true")
    ap.add_argument("--site", action="store_true", help="--uygula ile: sonunda siteyi de derle (npm run build)")
    ap.add_argument("--ozet-kaydet", action="store_true",
                    help="--uygula ile: yeni veri özetini kaynaklar/veri-ozeti.csv'ye yaz (PR'da fark görünsün)")
    ap.add_argument("--gecmis", action="store_true", help="mevcut ilk yıldan önceki yılları da ekle")
    ap.add_argument("--kaynak", default="oecd,tuik", help="güncellenecek kaynaklar (virgülle): oecd, tuik")
    a = ap.parse_args(argv)
    bugun = dt.date.today().isoformat()
    (GD / "aday").mkdir(parents=True, exist_ok=True)
    (GD / "log").mkdir(parents=True, exist_ok=True)

    kaynaklar = {k.strip() for k in a.kaynak.split(",")}
    if a.uygula:
        dp = GD / "aday" / f"{TUIK_DOSYA}-denetim.json"
        if dp.exists():
            d = json.loads(dp.read_text(encoding="utf-8"))
            print(f"TÜİK adayları: {d['ekleme']} yeni, {d['revizyon']} revize; "
                  f"kontrollerden geçmeyen: {d['uyarili']} uyarılı, {d['hatali']} hatalı (raporda listelendi)")
        for ad in OECD_DOSYALAR + [TUIK_DOSYA]:
            src = GD / "aday" / f"{ad}.csv"
            if src.exists():
                shutil.copyfile(src, KOK / "veri-ekleri" / f"{ad}.csv")
                print(f"uygulandı: veri-ekleri/{ad}.csv")
        # Yalnız build_data.py public/veri/'yi baştan yazar ve sayfa verilerini (vitrin, analiz…) siler;
        # bütün veri hattı ve değişiklik denetimi hepsini_olustur.py ile çalışır.
        rc = calistir([sys.executable, "pipeline/hepsini_olustur.py"] + (["--site"] if a.site else [])
                      + (["--ozet-kaydet"] if a.ozet_kaydet else []), GD / "log" / "hepsini_olustur.log")
        print("veri hattı", "tamam" if rc == 0 else "HATA (build/guncelleme/log/hepsini_olustur.log)",
              "· değişiklik raporu: build/degisiklik-raporu.md")
        return rc

    # 1. OECD indir + dönüştür
    oecd_log = ""
    if "oecd" in kaynaklar and not a.indirme_yok:
        calistir([sys.executable, "tools/guncelle/oecd_indir.py", "--cikti", str(GD / "oecd/turkiye")], GD / "log" / "oecd_indir.log")
    oecd_log = (GD / "log" / "oecd_indir.log").read_text(encoding="utf-8") if (GD / "log" / "oecd_indir.log").exists() else ""
    donustur = {}
    for ad in (OECD_DOSYALAR if "oecd" in kaynaklar else []):
        lg = GD / "log" / f"donustur_{ad}.log"
        calistir([sys.executable, "pipeline/donusturuculer/oecd_sdmx.py", str(GD / "oecd/turkiye"),
                  "--esleme", f"pipeline/donusturuculer/eslemeler/{ad}.csv",
                  "--cikti", str(GD / "aday" / f"{ad}.ham.csv")], lg)
        donustur[ad] = lg.read_text(encoding="utf-8")

    # 1b. TÜİK indir + dönüştür + sitedeki değerlerle karşılaştır
    tuik = None
    if "tuik" in kaynaklar:
        if not a.indirme_yok:
            calistir([sys.executable, "tools/guncelle/tuik_indir.py"], GD / "log" / "tuik_indir.log")
        calistir([sys.executable, "tools/guncelle/tuik_aday.py"] + (["--gecmis"] if a.gecmis else []), GD / "log" / "tuik_aday.log")
        kp = GD / "tuik" / "kiyas.json"
        tuik = {"log": (GD / "log" / "tuik_indir.log").read_text(encoding="utf-8") if (GD / "log" / "tuik_indir.log").exists() else "",
                "aday_log": (GD / "log" / "tuik_aday.log").read_text(encoding="utf-8"),
                "kiyas": json.loads(kp.read_text(encoding="utf-8")) if kp.exists() else {"kiyas": {}, "eksik_akis": []},
                # sitedeki ilk yıldan önceki yıllar tuik_aday.py'de ayıklandığı için burada ayrıca ayıklanmaz
                "birlesik": birlestir(TUIK_DOSYA, True),
                "denetim": aday_denetim.denetle(TUIK_DOSYA)}

    # 2-3. birleştir ve karşılaştır
    sonuc = {ad: birlestir(ad, a.gecmis) for ad in (OECD_DOSYALAR if "oecd" in kaynaklar else [])}

    # 4. denetimler
    den = denetim.hepsi()

    # 5. rapor
    md = rapor(bugun, oecd_log, donustur, sonuc, den, tuik)
    p = GD / f"rapor-{bugun}.md"
    p.write_text(md, encoding="utf-8")
    print(f"rapor: {p}")
    return 0


def rapor(bugun, oecd_log, donustur, sonuc, den, tuik=None) -> str:
    L = [f"# Veri güncelleme ve denetim raporu — {bugun}", ""]
    L += ["## 1. OECD (SDMX API)", ""]
    if not sonuc:
        L.append("- Bu çalıştırmada OECD güncellenmedi (`--kaynak`).")
    indirilen = [s.strip() for s in oecd_log.splitlines() if s.strip().endswith("satır")]
    hatali = [s.strip() for s in oecd_log.splitlines() if "HATA" in s]
    if sonuc:
        L.append(f"- İndirilen veri akışı: {len(indirilen)}; Türkiye verisi alınamayan: {len(hatali)}")
    if sonuc and hatali:
        L.append("- Alınamayanlar (OECD bu akışlarda şu an Türkiye verisi sunmuyor ya da akış geçici olarak yayında değil; "
                 "mevcut değerler korunur): " + ", ".join(h.split(":")[0] for h in hatali))
    for ad, s in sonuc.items():
        L += ["", f"### {ad}", "",
              f"- Mevcut değer: {denetim.nf(s['eski'])} · API'den gelen (yeni ve güncellenen): {denetim.nf(s['yeni'])} · birleşik aday: {denetim.nf(s['birlesik'])}"]
        yeni_yil = [(g, o) for g, o in s["ozet"].items() if o["yeni"]]
        degisen = [(g, o) for g, o in s["ozet"].items() if o["degisen"]]
        yok = [(g, o) for g, o in s["ozet"].items() if o["kaynakta_yok"]]
        if yeni_yil:
            L += ["", "**Yeni değerler (yeni yıl ya da yeni bölge)**", ""]
            L += [f"- {g}: {o['yeni']} değer ({', '.join(sorted(o['yillar_yeni']))})" for g, o in sorted(yeni_yil)]
        if degisen:
            L += ["", "**Revize edilen değerler (fark > %0,5)**", ""]
            L += [f"- {g}: {o['degisen']} değer · örnek: {'; '.join(o['ornek'])}" for g, o in sorted(degisen, key=lambda x: -x[1]['degisen'])]
        if not yeni_yil and not degisen:
            L += ["", "- OECD'de mevcut verilerden daha yeni bir yıl ya da revizyon yok; dosya günceldir."]
        if s["gecmis"]:
            L += ["", f"**OECD'de bulunan ama mevcut seride olmayan geçmiş yıllar: {sum(s['gecmis'].values())} değer, "
                  f"{len(s['gecmis'])} gösterge** (varsayılan olarak eklenmedi; eklemek için `--gecmis`). Örnek: "
                  + "; ".join(f"{g} (mevcut seri {s['ilk'][g]}'ten başlıyor)" for g in list(s["gecmis"])[:5])]
        if yok:
            L += ["", "**Kaynakta artık bulunmayan değerler (korundu)**", ""]
            L += [f"- {g}: {o['kaynakta_yok']} değer (dönüştürücü bu yılları tutarsız bulup attıysa mevcut değerler de gözden geçirilmeli)" for g, o in sorted(yok)]
        if s["korunan"]:
            L += ["", f"**API'den hiç alınamayan göstergeler (mevcut değerleriyle korundu): {len(s['korunan'])}**", ""]
            L += [f"- {g}" for g in s["korunan"]]
        uy = donustur[ad].split("UYARILAR:", 1)
        if len(uy) > 1:
            satir = [x.strip() for x in uy[1].splitlines() if x.strip() and not x.strip().startswith("dosya yok")]
            if satir:
                L += ["", "**Dönüştürme uyarıları**", ""] + [f"- {x}" for x in satir]
    L += tuik_raporu(tuik)
    L += ["", "## 3. Denetimler", ""]
    L += den
    L += ["", "---", "Bu rapor yalnızca öneridir. Uygulamak için: `py -3.13 -X utf8 tools/guncelle/guncelle.py --indirme-yok --uygula --site`"]
    return "\n".join(L) + "\n"


def tuik_raporu(t) -> list[str]:
    L = ["", "## 2. TÜİK (SDMX API)", ""]
    if t is None:
        return L + ["- Bu çalıştırmada TÜİK güncellenmedi (`--kaynak`)."]
    tamam = [s for s in t["log"].splitlines() if s.strip().endswith(": tamam")]
    hata = [s.strip() for s in t["log"].splitlines() if ":" in s and s.strip().startswith(("DF_", "UH_")) and not s.strip().endswith("tamam")]
    if "anahtar" in t["log"].lower() and not tamam:
        L.append("- **TÜİK'e bağlanılamadı**: proje kökünde tuik-api-key.txt dosyası olmalı (bkz. docs/TUIK-SDMX-API-REHBERI.md).")
    L.append(f"- İndirilen veri akışı: {len(tamam)}" + (f"; indirilemeyen: {', '.join(h.split(':')[0] for h in hata)} (bu akışların göstergeleri mevcut değerleriyle korunur)" if hata else ""))
    K = t["kiyas"]["kiyas"]
    top = lambda k: sum(v.get(k, 0) for v in K.values() if isinstance(v.get(k, 0), int))
    E = list(csv.DictReader(open(KOK / "pipeline/donusturuculer/eslemeler/tuik.csv", encoding="utf-8-sig"), delimiter=";")) \
        if (KOK / "pipeline/donusturuculer/eslemeler/tuik.csv").exists() else []
    L.append(f"- Eşleme tablosu: {sum(1 for e in E if e.get('durum') == 'onayli')} onaylı, "
             f"{sum(1 for e in E if e.get('durum') != 'onayli')} incelemede (incelemedekiler güncellenmez; ayrıntı: incelemeler/tuik-esleme-kontrol.xlsx)")
    L.append(f"- Sitedeki değerle aynı: {denetim.nf(top('ayni'))} · TÜİK'te farklı (revize): {denetim.nf(top('revize'))} · "
             f"sitede olmayan yeni değer: {denetim.nf(top('yeni'))} · API'de bulunmayan site değeri (korunur): {denetim.nf(top('kapsanmayan'))}")
    if top("gecmis"):
        L.append(f"- Sitedeki serinin ilk yılından önceki {denetim.nf(top('gecmis'))} değer alınmadı (eklemek için `--gecmis`).")
    yeni = sorted(((g, v) for g, v in K.items() if v.get("yeni")), key=lambda x: -x[1]["yeni"])
    rev = sorted(((g, v) for g, v in K.items() if v.get("revize")), key=lambda x: -x[1]["revize"])
    if yeni:
        L += ["", "**Yeni değerler (yeni yıl ya da yeni bölge)**", ""]
        L += [f"- {g}: {v['yeni']} değer ({', '.join(v['yillar_yeni'][-6:])})" for g, v in yeni]
    if rev:
        L += ["", "**TÜİK'te farklı olan değerler (fark > %0,5; uygulanırsa API değeri yazılır)**", ""]
        L += [f"- {g}: {v['revize']} değer · örnek: {'; '.join(v['ornek'])}" for g, v in rev]
    if not yeni and not rev:
        L += ["", "- TÜİK'te sitedekinden yeni bir yıl ya da farklı değer yok."]
    hatali = [g for g, v in K.items() if "hata" in v]
    if hatali:
        L += ["", "**Dönüştürülemeyen göstergeler**", ""] + [f"- {g}: {K[g]['hata']}" for g in hatali]
    L += aday_denetim.rapor_satirlari(t.get("denetim"))
    return L


if __name__ == "__main__":
    sys.exit(main())
