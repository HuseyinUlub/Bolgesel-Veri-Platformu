"""
ekler.py — veri-ekleri/ klasöründeki ek kaynakları veri hattına katar.

Desteklenen dosyalar
--------------------
1) *.csv (ya da büyük dosyalar için *.csv.gz) — standart şablon (noktalı virgül, UTF-8):

       kod;gosterge;kategori;yil;deger;kaynak

   kod      : İBBS kodu (TR, TR1, TR10, TR100) ya da ilçe kodu (ILCE1757)
   gosterge : sitede görünecek ad; birim sona parantezle yazılır, örn. "Fiber Optik Kablo Uzunluğu (km)"
   kategori : manifest'teki kategori adı (yeni bir ad yeni kategori açar)
   yil      : 4 haneli yıl
   deger    : sayı; ondalık ayırıcı virgül ya da nokta (binlik ayırıcı KULLANMAYIN)
   kaynak   : kurum adı
   oncelik  : (isteğe bağlı) ek | mevcut — o satır için genel önceliği ezer
   yayin    : (isteğe bağlı) evet | hayir — "hayir" ise gösterge yalnızca veri.db'ye girer, sitede
              listelenmez (ayrıntılı kırılımlar: yaş×cinsiyet, ay, "bilinmeyen" vb.)

2) *.db   — VizStudio veritabanı (values_long / indicators). Yalnızca
   veri-ekleri/ad-eslemesi.csv içinde eşlenen göstergeler alınır:

       uzun_ad;gosterge;kategori;kaynak;oncelik

   oncelik (isteğe bağlı): ek | mevcut — o gösterge için genel önceliği ezer.
   Örn. yalnızca yuvarlama farkı olan göstergelerde "mevcut" yazılır ki
   sitedeki değerler korunsun, sadece eksik yıllar eklensin.

   gosterge sütununa "-" yazılan göstergeler bilerek alınmaz (ör. kaynağında hatalı
   olduğu tespit edilen seriler) ve eşlenmemiş listesinde de görünmez.

   Eşlenmeyen göstergeler build/eslenmemis-gostergeler.csv dosyasına yazılır,
   doldurup tekrar çalıştırmanız yeterli.

Adı "_" ile başlayan dosyalar (şablon, taslak) okunmaz.

Öncelik: aynı bölge-yıl-gösterge hem mevcut veride hem ekte varsa, varsayılan
olarak EK kazanır (--oncelik mevcut ile tersine çevrilir). Her fark raporlanır.
"""

from __future__ import annotations

import csv
import gzip
import re
import sqlite3
from collections import Counter
from pathlib import Path

SABLON = ["kod", "gosterge", "kategori", "yil", "deger", "kaynak"]
ESLEME_DOSYASI = "ad-eslemesi.csv"
NOT_DOSYASI = "gosterge-notlari.csv"  # gösterge notları; build_data.py okur
YARDIMCI = {"yayinlanmayacak.csv", "kaynak-turleri.csv"}  # veri değil: mükerrer listesi ve kaynak türleri
# En son okunan dosyalar (sonraki öncekini ezer): TÜİK API güncellemesi, ardından veri masasıyla elle girilenler
SON_OKUNAN = {"tuik-api.csv": 1,   # tools/guncelle/guncelle.py --uygula ile yazılır
              "elle-giris.csv": 2}  # veri-masasi/veri_masasi.py uygula ile yazılır


def _clean(s):
    return re.sub(r"\s+", " ", str(s or "").replace("\xa0", " ")).strip()


def _num(s):
    if s is None:
        return None
    if isinstance(s, (int, float)):
        return float(s)
    s = str(s).strip()
    if not s:
        return None
    if re.fullmatch(r"-?\d{1,3}(\.\d{3})+(,\d+)?", s):  # 1.234.567 ya da 1.234,5 -> binlik ayırıcı
        raise ValueError("binlik ayırıcı")
    return float(s.replace(",", "."))


def _fmt(v):
    if float(v).is_integer():
        return f"{v:,.0f}".replace(",", ".")
    return f"{v:.6g}".replace(".", ",")


class _Sayac:
    def __init__(self):
        self.c = Counter()
        self.ornek = {}

    def ekle(self, tur, ornek=None):
        self.c[tur] += 1
        if ornek is not None:
            self.ornek.setdefault(tur, []).append(ornek)


def _satirlari_isle(dosya_adi, satirlar, ents, ind_meta, values, dvalues, origin, rep, oncelik, n):
    """satirlar: (kod, gosterge, kategori, yil, deger_ham, kaynak[, oncelik]) üreteci"""
    s = _Sayac()
    mevcut_kategoriler = {m["category"] for m in ind_meta.values()}
    yeni_gostergeler, yeni_kategoriler = set(), set()
    en_buyuk = Counter()  # gösterge -> |değer| üst sınırı (yüzde kontrolü için)
    farkli_gosterge = Counter()
    genisleyen = Counter()  # mevcut göstergeye eklenen yeni değer sayısı

    for satir in satirlar:
        kod, ind, kat, yil, ham, kaynak = satir[:6]
        satir_onceligi = (satir[6] if len(satir) > 6 else None) or oncelik
        yayinlanmaz = len(satir) > 7 and satir[7] in ("hayir", "hayır", "h", "0", "false")
        kod, ind, kat, yil, kaynak = map(_clean, (kod, ind, kat, yil, kaynak))
        yil = yil[:-2] if yil.endswith(".0") else yil
        if not (kod and ind and yil):
            s.ekle("eksik_alan")
            continue
        if not re.fullmatch(r"\d{4}", yil):
            s.ekle("gecersiz_yil", yil)
            continue
        if kod not in ents:
            s.ekle("bilinmeyen_kod", kod)
            continue
        try:
            v = _num(ham)
        except ValueError:
            s.ekle("gecersiz_deger", f"{kod} {yil} {ind}: {ham!r}")
            continue
        if v is None:
            s.ekle("bos_deger")
            continue

        # Gösterge metadatası
        if ind in ind_meta:
            if kat and ind_meta[ind]["category"] != kat:
                s.ekle("kategori_farki", f"{ind}: mevcut '{ind_meta[ind]['category']}', ekte '{kat}'")
        else:
            if not kat:
                s.ekle("kategorisiz", ind)
                continue
            ind_meta[ind] = {"category": kat, "sources": Counter()}
            yeni_gostergeler.add(ind)
            if kat not in mevcut_kategoriler:
                yeni_kategoriler.add(kat)
        if kaynak:
            ind_meta[ind]["sources"][kaynak] += 1
        if yayinlanmaz and ind in yeni_gostergeler:
            ind_meta[ind]["yayin"] = False

        en_buyuk[ind] = max(en_buyuk[ind], abs(v))
        hedef = dvalues if ents[kod]["level"] == "district" else values
        key = (kod, yil, ind)
        eski = hedef.get(key)
        if eski is None:
            s.ekle("yeni")
            if ind not in yeni_gostergeler:
                genisleyen[ind] += 1
            hedef[key] = v
            origin[key] = dosya_adi
        elif abs(eski - v) <= 1e-9 * max(1.0, abs(eski)):
            s.ekle("ayni")
        else:
            s.ekle("farkli", f"`{kod}` {yil} · {ind}: mevcut {_fmt(eski)} → ek {_fmt(v)}"
                             f" ({'ek' if satir_onceligi == 'ek' else 'mevcut'} kullanıldı)")
            farkli_gosterge[ind] += 1
            if satir_onceligi == "ek":
                hedef[key] = v
                origin[key] = dosya_adi

    # ---- rapor
    c = s.c
    rep.info(f"**`{dosya_adi}`** — yeni {n(c['yeni'])}, aynı {n(c['ayni'])}, farklı {n(c['farkli'])}")
    yalniz_db = sorted(i for i in yeni_gostergeler if ind_meta[i].get("yayin") is False)
    if yalniz_db:
        rep.info(f"  Yalnızca veri.db'ye giren (sitede listelenmeyen) ayrıntılı gösterge: {len(yalniz_db)}")
    if yeni_gostergeler:
        rep.ok(f"Yeni gösterge ({len(yeni_gostergeler)}): " + "; ".join(sorted(yeni_gostergeler)))
    if yeni_kategoriler:
        rep.warn(f"Yeni kategori: {', '.join(sorted(yeni_kategoriler))} — ana sayfada görünmesi için "
                 "src/site.config.js ve public/img/<slug>.png gerekir")
    if genisleyen:
        rep.ok(f"Mevcut {len(genisleyen)} göstergeye eksik yıl/bölge eklendi: "
               + "; ".join(f"{i} (+{n(k)})" for i, k in genisleyen.most_common()))
    if c["farkli"]:
        rep.warn(f"Mevcut veriden farklı {n(c['farkli'])} değer: "
                 + "; ".join(f"{i} ({n(k)})" for i, k in farkli_gosterge.most_common()) + ". İlk örnekler:")
        ornekler, gorulen = [], Counter()
        for o in s.ornek["farkli"]:  # her göstergeden en fazla 2 örnek
            g = o.split(" · ", 1)[1].split(":", 1)[0]
            if gorulen[g] < 2:
                gorulen[g] += 1
                ornekler.append(o)
        for o in ornekler[:16]:
            rep.info(f"  {o}")
    for tur, mesaj in [
        ("bilinmeyen_kod", "Tanınmayan bölge kodu"),
        ("gecersiz_deger", "Sayıya çevrilemeyen değer"),
        ("gecersiz_yil", "Geçersiz yıl"),
        ("kategori_farki", "Kategori farkı (mevcut kategori korundu)"),
        ("kategorisiz", "Kategorisi boş yeni gösterge (atlandı)"),
    ]:
        if c[tur]:
            ornek = sorted(set(map(str, s.ornek.get(tur, []))))[:8]
            rep.warn(f"{mesaj}: {n(c[tur])} satır — örn. {', '.join(ornek)}")
    for ind, mx in en_buyuk.items():
        if re.search(r"\(%\)\s*$", ind) and 0 < mx <= 1:
            rep.warn(f"'{ind}' yüzde (%) olarak adlandırılmış ama tüm değerler ≤ 1 (en büyük {mx:g}). "
                     "Oran olarak girilmiş olabilir; dönüştürücüde --carpan \"<ad>=100\" kullanın")
        if re.search(r"\(%\)\s*$", ind) and mx > 100 and not any(k in ind.lower() for k in ("artış", "değişim", "okullaşma")):
            rep.warn(f"'{ind}' yüzde (%) ama 100'ü aşan değer var (en büyük {mx:g})")
    if c["eksik_alan"]:
        rep.warn(f"Zorunlu alanı boş satır: {n(c['eksik_alan'])}")
    if c["bos_deger"]:
        rep.info(f"  Boş değer (atlandı): {n(c['bos_deger'])}")
    return yeni_gostergeler


def _csv_oku(path: Path, rep):
    acici = gzip.open if path.name.lower().endswith(".gz") else open
    with acici(path, "rt", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f, delimiter=";")
        basliklar = [_clean(h).lower() for h in (r.fieldnames or [])]
        eksik = [k for k in SABLON if k not in basliklar]
        if eksik:
            rep.warn(f"`{path.name}` şablona uymuyor, eksik sütun: {', '.join(eksik)} (dosya atlandı)")
            return []
        r.fieldnames = basliklar
        oncelikli = "oncelik" in basliklar  # isteğe bağlı: satır bazında ek | mevcut
        yayinli = "yayin" in basliklar  # isteğe bağlı: hayir -> yalnızca veri.db
        return [(row["kod"], row["gosterge"], row["kategori"], row["yil"], row["deger"], row["kaynak"],
                 (_clean(row.get("oncelik")).lower() or None) if oncelikli else None,
                 _clean(row.get("yayin")).lower() if yayinli else "") for row in r]


def _db_oku(path: Path, ek_dir: Path, build_dir: Path, rep):
    esleme_yolu = ek_dir / ESLEME_DOSYASI
    esleme, haric = {}, set()
    if esleme_yolu.exists():
        with open(esleme_yolu, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f, delimiter=";"):
                uzun = _clean(row.get("uzun_ad"))
                if uzun and _clean(row.get("gosterge")) == "-":  # bilerek dışarıda
                    haric.add(uzun)
                    continue
                if uzun and _clean(row.get("gosterge")):
                    onc = _clean(row.get("oncelik")).lower() or None
                    if onc not in (None, "ek", "mevcut"):
                        rep.warn(f"ad-eslemesi.csv: '{uzun[:60]}…' için geçersiz öncelik '{onc}' (ek/mevcut olmalı)")
                        onc = None
                    esleme[uzun] = (_clean(row["gosterge"]), _clean(row.get("kategori")), _clean(row.get("kaynak")), onc)
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    tum = [(_clean(i), c) for i, c in con.execute("SELECT indicator, category FROM indicators")]
    eslenmemis = [(i, c) for i, c in tum if i not in esleme and i not in haric]
    if haric:
        rep.info(f"`{path.name}`: bilerek alınmayan gösterge ({len(haric)}): " + "; ".join(sorted(haric)))
    if eslenmemis:
        build_dir.mkdir(parents=True, exist_ok=True)
        out = build_dir / "eslenmemis-gostergeler.csv"
        with open(out, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(["uzun_ad", "gosterge", "kategori", "kaynak", "oncelik", "vizstudio_kategorisi"])
            for i, c in eslenmemis:
                w.writerow([i, "", "", "", "", c or ""])
        rep.info(f"`{path.name}`: {len(tum)} göstergeden {len(eslenmemis)} tanesi eşlenmemiş, alınmadı → "
                 f"`build/{out.name}` (doldurup `veri-ekleri/{ESLEME_DOSYASI}` içine ekleyin)")
    satirlar = []
    for geo, time, ind, val in con.execute("SELECT geo, time, indicator, value FROM values_long"):
        e = esleme.get(_clean(ind))
        if e:
            satirlar.append((geo, e[0], e[1], str(time)[:4] if re.match(r"^\d{4}", str(time)) else time, val,
                             e[2] or "VizStudio", e[3]))
    con.close()
    return satirlar


def load_additions(ek_dir: Path, ents, ind_meta, values, dvalues, origin, rep, n, build_dir: Path, oncelik="ek"):
    rep.h("Veri ekleri")
    if not ek_dir.exists():
        rep.info(f"`{ek_dir.name}/` klasörü yok, ek kaynak okunmadı")
        return set()
    # TÜİK API dosyası en son okunur: aynı il-yıl için diğer eklerin önüne geçer (TÜİK API değerleri esastır)
    dosyalar = [p for p in sorted(ek_dir.iterdir(), key=lambda p: (SON_OKUNAN.get(p.name, 0), p.name))
                if (p.suffix.lower() in (".csv", ".db") or p.name.lower().endswith(".csv.gz"))
                and not p.name.startswith("_") and p.name not in (ESLEME_DOSYASI, NOT_DOSYASI) and p.name not in YARDIMCI]
    if not dosyalar:
        rep.info("Ek dosya yok")
        return set()
    yeni = set()
    for p in dosyalar:
        satirlar = _db_oku(p, ek_dir, build_dir, rep) if p.suffix.lower() == ".db" else _csv_oku(p, rep)
        # Türkiye dışı (OECD uluslararası) kodları sessizce ayıkla, sadece say
        yurtici = [r for r in satirlar if str(r[0] or "").strip().startswith(("TR", "ILCE"))]
        if len(yurtici) < len(satirlar):
            rep.info(f"`{p.name}`: Türkiye dışı {n(len(satirlar) - len(yurtici))} satır atlandı")
        satirlar = yurtici
        yeni |= _satirlari_isle(p.name, satirlar, ents, ind_meta, values, dvalues, origin, rep, oncelik, n)
    return yeni
