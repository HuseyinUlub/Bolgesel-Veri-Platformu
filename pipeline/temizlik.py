"""
temizlik.py — veri hattının son adımı: kaynaklar birleştirildikten sonra, veri.db yazılmadan önce
çalışan tutarlılık düzeltmeleri. Her değişiklik build/rapor.md'ye ve build/temizlik.csv'ye yazılır.

1. Elle düzeltmeler   veri-ekleri/duzeltmeler/
     gosterge-birlestirme.csv   eski;yeni;gerekce     → aynı göstergenin iki adını tek ada toplar
     degerler.csv               kod;gosterge;yil;deger;gerekce  (deger boşsa değer silinir;
                                kod "*il" / "*d2" / "*d1" ise o yılın o düzeydeki tüm değerleri silinir)
2. Tek illi bölgeler         TR1 (Düzey 1) = TR10 (Düzey 2) = TR100 (İstanbul), TR31 = TR310, TR51 = TR510.
                             Farklıysa il değeri esas alınır (OECD göstergeleri hariç: TL2 ve TL3 ayrı tahmin).
                             Bir düzeyde olup ötekinde olmayan yıllar karşı düzeye taşınır (il için Düzey 2
                             önceliklidir; sıralama/kademe ve OECD göstergeleri hariç).
3. Toplanabilir göstergeler  Düzey 2 = il toplamı en az %95 oranında tutuyorsa gösterge toplanabilir sayılır;
                             tutmayan Düzey 2 / Düzey 1 değerleri il toplamıyla değiştirilir. Türkiye değeri
                             yalnızca göstergede Türkiye = 81 il toplamı da en az %80 tutuyorsa değiştirilir
                             (dış ticaret gibi bölgeye dağıtılamayan kalemleri korumak için).
4. Oran / ortalama           Bölge değeri, alt birimlerinin (tamamı mevcutken) en küçük ve en büyük değeri
                             arasında olmalıdır (ağırlıklı ortalama özelliği). Dışındaysa değer silinir.
                             Değişim, artış, endeks, sıralama ve OECD göstergelerine uygulanmaz.
"""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from pathlib import Path

TEK_ILLI = {"TR1": "TR100", "TR10": "TR100", "TR31": "TR310", "TR51": "TR510"}

ORAN = re.compile(r"%|oran|hızı|başına|\bbaşı\b|düşen|ortalama|ortanca|\byaşı\b|yoğunluk|payı|nüfusta|"
                  r"kişiye|beklenen|katsayı", re.I)
ORAN_DISI = re.compile(r"değişim|artış|büyüme|göç|endeks|sıralama|kademe|karşılama|theil|eşitsizlik|"
                       r"zincirlen|sege|net göç|net akış|fark|anomali", re.I)
OECD = re.compile(r"OECD")
SIRALAMA = re.compile(r"sıralama|sırası|kademe|sege", re.I)


def _num(s):
    s = (s or "").strip().replace(" ", "")
    if not s:
        return None
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    return float(s)


def _oku(p: Path):
    if not p.exists():
        return []
    with open(p, encoding="utf-8-sig", newline="") as f:
        return [{k.strip(): (v or "").strip() for k, v in r.items() if k and isinstance(v, str)} for r in csv.DictReader(f, delimiter=";")]


def temizle(values, ind_meta, ents, origin, ek_dir: Path, build_dir: Path, rep, n):
    rep.h("Temizlik (tutarlılık düzeltmeleri)")
    log = []  # (adım, kod, yıl, gösterge, eski, yeni, not)

    # ---------------------------------------------------------------- 1a) gösterge birleştirme
    d = ek_dir / "duzeltmeler"
    for r in _oku(d / "gosterge-birlestirme.csv"):
        eski, yeni = r["eski"], r["yeni"]
        if eski not in ind_meta:
            rep.warn(f"Birleştirme: '{eski}' bulunamadı (zaten düzeltilmiş olabilir)")
            continue
        if yeni not in ind_meta:
            ind_meta[yeni] = ind_meta[eski]
        tasinan = cakisan = 0
        for key in [k for k in values if k[2] == eski]:
            v = values.pop(key)
            yk = (key[0], key[1], yeni)
            if yk in values:
                if abs(values[yk] - v) > 1e-6 * max(1, abs(v)):
                    cakisan += 1
            else:
                values[yk] = v
                origin[yk] = origin.get(key)
                tasinan += 1
            origin.pop(key, None)
        ind_meta[yeni]["sources"].update(ind_meta[eski]["sources"])
        del ind_meta[eski]
        rep.info(f"Birleştirildi: '{eski}' → '{yeni}' ({n(tasinan)} değer taşındı, "
                 f"{n(cakisan)} çakışmada '{yeni}' değeri korundu) — {r.get('gerekce', '')}")
        log.append(("birlestirme", "", "", eski, "", yeni, f"{tasinan} taşındı, {cakisan} çakışma"))

    # ---------------------------------------------------------------- 1b) tekil değer düzeltmeleri
    # kod "*il", "*d2", "*d1" ise o düzeyin o yıldaki bütün değerleri silinir (kaynakta satırları karışmış yıl)
    joker = {"*il": "province", "*d2": "region26", "*d1": "region12"}
    for r in _oku(d / "degerler.csv"):
        if r["kod"] in joker:
            silinecek = [k for k in values if k[2] == r["gosterge"] and k[1] == r["yil"]
                         and ents.get(k[0], {}).get("level") == joker[r["kod"]]]
            for k in silinecek:
                values.pop(k, None)
            log.append(("elle", r["kod"], r["yil"], r["gosterge"], f"{len(silinecek)} değer", None, r.get("gerekce", "")))
            continue
        key = (r["kod"], r["yil"], r["gosterge"])
        eski = values.get(key)
        yeni = _num(r.get("deger"))
        if yeni is None:
            values.pop(key, None)
        else:
            values[key] = yeni
            origin[key] = "duzeltmeler/degerler.csv"
        log.append(("elle", *key[:2], key[2], eski, yeni, r.get("gerekce", "")))
    elle = sum(1 for x in log if x[0] == "elle")
    if elle:
        rep.info(f"Elle düzeltilen değer: {elle} (`veri-ekleri/duzeltmeler/degerler.csv`)")

    # indeks: gösterge -> {(kod, yıl): değer}
    by_ind = defaultdict(dict)
    for (g, y, i), v in values.items():
        if v is not None:
            by_ind[i][(g, y)] = v
    level = {g: e["level"] for g, e in ents.items()}
    cocuk = defaultdict(list)       # doğrudan alt birimler
    iller = defaultdict(list)       # bölgedeki tüm iller
    for g, e in ents.items():
        if e["level"] in ("region12", "region26", "province"):
            cocuk[e["parent"]].append(g)
        if e["level"] == "province":
            p = e["parent"]
            while p:
                iller[p].append(g)
                p = ents.get(p, {}).get("parent")

    def degistir(adim, g, y, i, yeni, notu=""):
        eski = values.get((g, y, i))
        if yeni is None:
            values.pop((g, y, i), None)
            by_ind[i].pop((g, y), None)
        else:
            values[(g, y, i)] = yeni
            by_ind[i][(g, y)] = yeni
            origin[(g, y, i)] = f"temizlik:{adim}"
        log.append((adim, g, y, i, eski, yeni, notu))

    # ---------------------------------------------------------------- 2) tek illi bölgeler
    for i, d_ in by_ind.items():
        if OECD.search(i):
            continue
        for (g, y), v in list(d_.items()):
            il = TEK_ILLI.get(g)
            if il and (il, y) in d_:
                w = d_[(il, y)]
                if abs(v - w) > 1e-6 * max(1, abs(w)) + 0.051 and abs(v - w) > 0.005 * abs(w):
                    degistir("tek_illi", g, y, i, w, f"il ({il}) değeri esas alındı")

    # ---------------------------------------------------------------- 2b) tek illi bölgelerde eksik yıllar
    # İstanbul, İzmir ve Ankara hem il hem bölge olduğundan, bir düzeyde olup ötekinde olmayan yıl
    # karşı düzeye aynen taşınır (ör. Düzey 2 işgücü verisi il verisinden bir yıl önce yayımlanıyor).
    # Sıralama/kademe göstergeleri hariç: bölge sıralaması il sıralamasıyla aynı şey değil.
    # Sıfır değerler taşınmaz: bazı kaynaklarda bölge satırındaki 0 "veri yok" anlamında kullanılmış.
    il_kaynak = defaultdict(list)                      # il -> [bölgeler], Düzey 2 önce
    for g in sorted(TEK_ILLI, key=lambda k: (len(k) != 4, k)):
        il_kaynak[TEK_ILLI[g]].append(g)
    for i, d_ in by_ind.items():
        if OECD.search(i) or SIRALAMA.search(i):
            continue
        for il, bolgeler in il_kaynak.items():
            if not any(k[0] == il for k in d_):       # gösterge il düzeyinde hiç yoksa dokunma
                continue
            for g in bolgeler:                          # bölge → il
                for (k, y), v in list(d_.items()):
                    if k == g and v != 0 and (il, y) not in d_:
                        degistir("tek_illi_tamamlama", il, y, i, v, f"bölge ({g}) değeri kullanıldı")
            for g in bolgeler:                          # il → bölge
                if not any(k[0] == g for k in d_):
                    continue
                for (k, y), v in list(d_.items()):
                    if k == il and v != 0 and (g, y) not in d_:
                        degistir("tek_illi_tamamlama", g, y, i, v, f"il ({il}) değeri kullanıldı")

    # ---------------------------------------------------------------- 3) toplanabilir göstergeler
    def toplam(d_, g, y):
        xs = [d_.get((c, y)) for c in iller[g]]
        return None if not xs or None in xs else sum(xs)

    def tutarlilik(d_, lv):
        uyan = toplam_ = 0
        for (g, y), v in d_.items():
            if level.get(g) != lv:
                continue
            s = toplam(d_, g, y)
            if s is None:
                continue
            toplam_ += 1
            uyan += abs(s - v) <= 0.02 * max(abs(v), abs(s), 1) + 3
        return uyan, toplam_

    toplanabilir = 0
    for i, d_ in by_ind.items():
        if ORAN.search(i) or OECD.search(i) or ORAN_DISI.search(i):
            continue
        uyan, say = tutarlilik(d_, "region26")
        if say < 30 or uyan < 0.95 * say:
            continue
        toplanabilir += 1
        tr_uyan, tr_say = tutarlilik(d_, "country")
        seviyeler = ["region26", "region12"] + (["country"] if tr_say and tr_uyan >= 0.8 * tr_say else [])
        for (g, y), v in list(d_.items()):
            if level.get(g) not in seviyeler:
                continue
            s = toplam(d_, g, y)
            if s is not None and abs(s - v) > 0.02 * max(abs(v), abs(s), 1) + 3:
                degistir("toplam", g, y, i, s, f"alt illerin toplamı ({len(iller[g])} il)")
    rep.info(f"Toplanabilir kabul edilen gösterge: {toplanabilir}")

    # ---------------------------------------------------------------- 4) oran / ortalama aralık kontrolü
    for i, d_ in by_ind.items():
        if not ORAN.search(i) or ORAN_DISI.search(i) or OECD.search(i):
            continue
        for (g, y), v in list(d_.items()):
            if level.get(g) not in ("country", "region12", "region26"):
                continue
            xs = [d_.get((c, y)) for c in cocuk[g]]
            if len(xs) < 2 or None in xs:
                continue
            lo, hi = min(xs), max(xs)
            pay = 0.03 * max(abs(lo), abs(hi)) + 0.051
            if v < lo - pay or v > hi + pay:
                degistir("aralik_disi", g, y, i, None, f"alt birimler {lo:g}–{hi:g}")

    # ---------------------------------------------------------------- rapor
    c = Counter(x[0] for x in log)
    etiket = {"birlestirme": "gösterge birleştirme", "elle": "elle düzeltme",
              "tek_illi": "tek illi bölge = il değeri",
              "tek_illi_tamamlama": "tek illi bölge/il eksik yılı karşı düzeyden", "toplam": "bölge değeri = il toplamı",
              "aralik_disi": "alt birim aralığı dışında (silindi)"}
    for k, v in c.items():
        rep.warn(f"{etiket[k]}: {n(v)} değer")
    for k in ("tek_illi", "tek_illi_tamamlama", "toplam", "aralik_disi"):
        g = Counter(x[3] for x in log if x[0] == k)
        if g:
            rep.info(f"  {etiket[k]} — en çok: " + "; ".join(f"{a} ({b})" for a, b in g.most_common(8)))
    build_dir.mkdir(parents=True, exist_ok=True)
    with open(build_dir / "temizlik.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["adim", "kod", "yil", "gosterge", "eski", "yeni", "not"])
        w.writerows(log)
    rep.info("Ayrıntı: `build/temizlik.csv`")
    return log
