"""guncellik_raporu.py — Sitedeki her göstergenin güncel olup olmadığını gösteren rapor.

Girdi : build/veri.db, public/veri/manifest.json (sitede listelenen göstergeler),
        kaynaklar/yayin-takvimi.csv (kaynak / bülten bazında yayın takvimi)
Çıktı : build/guncellik.html (filtrelenebilir tablo), build/guncellik.csv

Beklenen son yıl iki yoldan belirlenir:
  1. Takvim: göstergeye uyan ilk takvim satırı (kaynak ve gösterge adı düzenli ifade, kategori birebir).
     Bugünün ayı yayın ayına ulaştıysa beklenen = bu yıl − gecikme, ulaşmadıysa bir yıl öncesi.
  2. Emsal: takvim satırı yoksa aynı kaynak ve kategorideki göstergelerin en az %30'unun ulaştığı en ileri yıl.
Takvim satırında son_yayin (kaynakta elle kontrol edilmiş son yıl) doluysa beklenen yıl odur.
Durum: Güncel · Güncelleme Bekliyor (1 yıl geride) · Gecikmiş (2+ yıl geride) · Dönemsel / Tek Seferlik · Belirlenemedi.
Son yılı 6 yıldan eski olan seriler ayrıca "Eski Seri" olarak işaretlenir (devam edip etmediği gözden geçirilmeli).

Kullanım: py -X utf8 tools/guncellik/guncellik_raporu.py [--tarih 2026-11-04]
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import html
import json
import re
import sqlite3
from collections import Counter, defaultdict
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
DUZEY_SIRA = ["province", "region26", "region12", "country"]
DUZEY_AD = {"province": "İl", "region26": "Düzey 2", "region12": "Düzey 1", "country": "Türkiye"}
DURUM_SIRA = ["Gecikmiş", "Güncelleme Bekliyor", "Belirlenemedi", "Dönemsel / Tek Seferlik", "Güncel"]
AYLAR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]


def takvim_oku() -> list[dict]:
    with (KOK / "kaynaklar" / "yayin-takvimi.csv").open(encoding="utf-8") as f:
        satirlar = list(csv.DictReader(f, delimiter=";"))
    for s in satirlar:
        s["_kaynak"] = re.compile(s["kaynak"]) if s["kaynak"] else None
        s["_gosterge"] = re.compile(s["gosterge"]) if s["gosterge"] else None
    return satirlar


def kural_bul(takvim, kaynak, kategori, ad):
    for s in takvim:
        if s["_kaynak"] and not s["_kaynak"].search(kaynak or ""):
            continue
        if s["kategori"] and s["kategori"] != kategori:
            continue
        if s["_gosterge"] and not s["_gosterge"].search(ad):
            continue
        return s
    return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tarih", help="raporun tarihi (YYYY-AA-GG); varsayılan bugün")
    a = ap.parse_args()
    bugun = dt.date.fromisoformat(a.tarih) if a.tarih else dt.date.today()

    man = json.loads((KOK / "public" / "veri" / "manifest.json").read_text(encoding="utf-8"))
    db = sqlite3.connect(KOK / "build" / "veri.db")
    ad_id = {i: ind for ind, i in db.execute("SELECT indicator, id FROM indicators")}
    db_kaynak = dict(db.execute("SELECT indicator, source FROM indicators"))
    son = defaultdict(dict)  # gösterge → düzey → son yıl
    for ind, lvl, y in db.execute(
            "SELECT v.indicator, e.level, max(v.time) FROM values_long v JOIN entities e ON e.geo = v.geo "
            "WHERE v.value IS NOT NULL GROUP BY 1, 2"):
        if y and str(y).isdigit():
            son[ind][lvl] = int(y)

    takvim = takvim_oku()
    kayitlar = []
    for kat in man["kategoriler"]:
        for g in kat["gostergeler"]:
            ind = ad_id.get(g["id"])
            if not ind or not son.get(ind):
                continue
            duzey = next((d for d in DUZEY_SIRA if d in son[ind]), None)
            if not duzey:
                continue
            kayitlar.append({"gosterge": ind, "kategori": kat["ad"], "kaynak": db_kaynak.get(ind) or g.get("kaynak", ""),
                             "kaynakKisa": g.get("kaynakKisa", ""), "duzey": duzey, "son": son[ind][duzey]})

    # emsal: aynı kaynak + kategori
    grup = defaultdict(list)
    for k in kayitlar:
        grup[(k["kaynak"], k["kategori"])].append(k["son"])
    emsal = {}
    for anahtar, yillar in grup.items():
        if len(yillar) < 3:
            continue
        say = Counter(yillar)
        emsal[anahtar] = max(y for y in say if sum(n for x, n in say.items() if x >= y) >= 0.3 * len(yillar))

    for k in kayitlar:
        s = kural_bul(takvim, k["kaynak"], k["kategori"], k["gosterge"])
        k["bulten"], k["yontem"], k["sonraki"], k["beklenen"] = "", "", "", None
        if s:
            k["bulten"], k["yontem"] = s["bulten"], "Takvim" + ("" if s["dogrulandi"] else " (taslak)")
            if s["siklik"] in ("donemsel", "tek-sefer", "sonlandi"):
                k["durum"] = "Dönemsel / Tek Seferlik"
                continue
            if s["siklik"] == "derleme":  # derleme yayını: kaynak adındaki baskı yılı beklenen baskıyla karşılaştırılır
                ay = int(s["yayin_ayi"])
                baski = bugun.year - (0 if bugun.month >= ay else 1)
                yil = [int(x) for x in re.findall(r"(?:19|20)\d\d", s["bulten"] + " " + k["kaynak"])]
                k["beklenen"], k["sonraki"] = baski, f"{AYLAR[ay]} {baski + 1}"
                k["durum"] = "Güncel" if yil and max(yil) >= baski else ("Güncelleme Bekliyor" if yil else "Belirlenemedi")
                k["yontem"] += " · baskı"
                continue
            if (s.get("son_yayin") or "").strip():  # elle doğrulanmış son yayın yılı: takvimin önüne geçer
                k["beklenen"] = int(s["son_yayin"])
                k["durum"] = "Güncel" if k["son"] >= k["beklenen"] else (
                    "Güncelleme Bekliyor" if k["beklenen"] - k["son"] == 1 else "Gecikmiş")
                k["yontem"] += " · elle doğrulandı"
                continue
            ay, gec = int(s["yayin_ayi"]), int(s["gecikme"] or 1)
            k["beklenen"] = bugun.year - gec - (0 if bugun.month >= ay else 1)
            k["sonraki"] = f"{AYLAR[ay]} {bugun.year + (1 if bugun.month >= ay else 0)}"
            pay = 1 if s["siklik"] == "iki-yillik" else 0
        elif (k["kaynak"], k["kategori"]) in emsal:
            k["beklenen"], k["yontem"], pay = emsal[(k["kaynak"], k["kategori"])], "Emsal", 0
        else:
            k["durum"], k["yontem"] = "Belirlenemedi", "—"
            continue
        fark = k["beklenen"] - k["son"] - pay
        k["durum"] = "Güncel" if fark <= 0 else ("Güncelleme Bekliyor" if fark == 1 else "Gecikmiş")
    for k in kayitlar:
        k["eski"] = bugun.year - k["son"] >= 6 and k["durum"] != "Dönemsel / Tek Seferlik"

    kayitlar.sort(key=lambda k: (DURUM_SIRA.index(k["durum"]), k["kategori"], k["gosterge"]))
    cikti = KOK / "build"
    with (cikti / "guncellik.csv").open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Durum", "Kategori", "Gösterge", "Kaynak", "En Alt Düzey", "Son Yıl", "Beklenen Yıl",
                    "Sonraki Yayın", "Bülten", "Yöntem", "Eski Seri"])
        for k in kayitlar:
            w.writerow([k["durum"], k["kategori"], k["gosterge"], k["kaynak"], DUZEY_AD[k["duzey"]], k["son"],
                        k["beklenen"] or "", k["sonraki"], k["bulten"], k["yontem"], "Evet" if k["eski"] else ""])
    (cikti / "guncellik.html").write_text(sayfa(kayitlar, bugun), encoding="utf-8")
    say = Counter(k["durum"] for k in kayitlar)
    print(f"{len(kayitlar)} gösterge: " + ", ".join(f"{d} {say[d]}" for d in DURUM_SIRA if say[d])
          + f"; eski seri {sum(k['eski'] for k in kayitlar)} → build/guncellik.html, build/guncellik.csv")


def sayfa(kayitlar, bugun) -> str:
    say = Counter(k["durum"] for k in kayitlar)
    kat = sorted({k["kategori"] for k in kayitlar})
    rozet = {"Güncel": "iyi", "Güncelleme Bekliyor": "uyari", "Gecikmiş": "kritik",
             "Dönemsel / Tek Seferlik": "notr", "Belirlenemedi": "notr"}
    e = html.escape
    satir = "".join(
        f'<tr data-d="{e(k["durum"])}" data-k="{e(k["kategori"])}" data-e="{int(k["eski"])}">'
        f'<td><span class="rozet {rozet[k["durum"]]}">{e(k["durum"])}</span></td><td>{e(k["kategori"])}</td>'
        f'<td>{e(k["gosterge"])}{" <span class=eski>Eski Seri</span>" if k["eski"] else ""}</td>'
        f'<td>{e(k["kaynakKisa"] or k["kaynak"])}</td><td>{DUZEY_AD[k["duzey"]]}</td>'
        f'<td class=s>{k["son"]}</td><td class=s>{(str(k["beklenen"]) + (" baskısı" if "baskı" in k["yontem"] else "")) if k["beklenen"] else "—"}</td><td>{e(k["sonraki"]) or "—"}</td>'
        f'<td class=yontem title="{e(k["bulten"])}">{e(k["yontem"])}</td></tr>' for k in kayitlar)
    kutu = "".join(f'<button class="kutu" data-f="{e(d)}"><b>{say[d]}</b><span>{e(d)}</span></button>'
                   for d in DURUM_SIRA if say[d])
    secenek = "".join(f"<option>{e(c)}</option>" for c in kat)
    return f"""<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Veri Güncelliği</title>
<style>
:root{{--z:#fff;--y:#f5f6f8;--m:#1d2330;--i:#5b6474;--c:#e3e6eb;--iyi:#1f7a4d;--uyari:#a15c00;--kritik:#b42318;--notr:#5b6474}}
@media (prefers-color-scheme:dark){{:root{{--z:#14171d;--y:#1c2029;--m:#e8ebf0;--i:#9aa3b2;--c:#2b303b;--iyi:#4cc38a;--uyari:#f0a83c;--kritik:#ff6b5e;--notr:#9aa3b2}}}}
body{{margin:0;background:var(--z);color:var(--m);font:14px/1.45 system-ui,sans-serif}}
main{{max-width:1200px;margin:0 auto;padding:24px 16px}}h1{{font-size:22px;margin:0 0 4px}}
.alt{{color:var(--i);margin:0 0 18px}}.kutular{{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}}
.kutu{{background:var(--y);border:1px solid var(--c);border-radius:8px;padding:8px 14px;cursor:pointer;color:var(--m);text-align:left}}
.kutu b{{display:block;font-size:20px}}.kutu span{{color:var(--i);font-size:12px}}.kutu.secili{{outline:2px solid var(--m)}}
.suzgec{{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}}input,select{{padding:6px 8px;border:1px solid var(--c);border-radius:6px;background:var(--z);color:var(--m)}}
input{{flex:1;min-width:180px}}.tablo{{overflow-x:auto}}table{{border-collapse:collapse;width:100%}}
th,td{{padding:6px 8px;border-bottom:1px solid var(--c);text-align:left;vertical-align:top}}th{{position:sticky;top:0;background:var(--z);font-size:12px;color:var(--i)}}
.s{{text-align:right;font-variant-numeric:tabular-nums}}.rozet{{font-size:12px;font-weight:600;white-space:nowrap}}
.rozet::before{{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background:currentColor}}
.iyi{{color:var(--iyi)}}.uyari{{color:var(--uyari)}}.kritik{{color:var(--kritik)}}.notr{{color:var(--notr)}}
.eski{{font-size:11px;color:var(--uyari);border:1px solid currentColor;border-radius:4px;padding:0 4px;margin-left:4px}}
.yontem{{color:var(--i);font-size:12px}}.not{{color:var(--i);font-size:12px;margin-top:16px}}
</style></head><body><main>
<h1>Veri Güncelliği</h1>
<p class="alt">{len(kayitlar)} gösterge · Rapor tarihi {bugun.day} {AYLAR[bugun.month]} {bugun.year} · Son yıl, göstergenin en alt düzeyindeki son veri yılıdır.</p>
<div class="kutular">{kutu}</div>
<div class="suzgec"><input id="ara" placeholder="Gösterge ara"><select id="kat"><option value="">Bütün Kategoriler</option>{secenek}</select>
<label><input type="checkbox" id="eski" style="flex:none;min-width:0"> Yalnızca Eski Seriler</label></div>
<div class="tablo"><table><thead><tr><th>Durum</th><th>Kategori</th><th>Gösterge</th><th>Kaynak</th><th>En Alt Düzey</th>
<th class=s>Son Yıl</th><th class=s>Beklenen Yıl</th><th>Sonraki Yayın</th><th>Yöntem</th></tr></thead><tbody>{satir}</tbody></table></div>
<p class="not">Beklenen yıl: derleme yayınlarında (ör. Sürdürülebilir Kalkınma Göstergeleri) kullanılması beklenen baskının yılı; diğer "Takvim" satırlarında kaynaklar/yayin-takvimi.csv, "Emsal" satırlarında aynı kaynak ve kategorideki göstergelerin en az %30'unun ulaştığı yıl. "Taslak" takvim satırları henüz doğrulanmamıştır. Takvim dosyasının son_yayin sütununa yazılan yıl (kaynakta kontrol edilmiş son yayın yılı) takvimin önüne geçer. Eski Seri: son yılı 6 yıldan eski. Hesaplama: Platform.</p>
</main><script>
const ara=document.getElementById('ara'),kat=document.getElementById('kat'),eski=document.getElementById('eski');let durum='';
const rows=[...document.querySelectorAll('tbody tr')];
function uygula(){{const q=ara.value.toLocaleLowerCase('tr');rows.forEach(r=>{{r.hidden=!((!durum||r.dataset.d===durum)&&(!kat.value||r.dataset.k===kat.value)&&(!eski.checked||r.dataset.e==='1')&&(!q||r.textContent.toLocaleLowerCase('tr').includes(q)))}})}}
document.querySelectorAll('.kutu').forEach(b=>b.onclick=()=>{{durum=durum===b.dataset.f?'':b.dataset.f;document.querySelectorAll('.kutu').forEach(x=>x.classList.toggle('secili',x.dataset.f===durum));uygula()}});
[ara,kat,eski].forEach(x=>x.oninput=uygula);
</script></body></html>"""


if __name__ == "__main__":
    main()
