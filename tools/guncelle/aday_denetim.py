"""
aday_denetim.py — API'den gelen aday değerleri, uygulanmadan önce Veri Masası kontrollerinden geçirir.

Kontroller (veri-masasi/veri_masasi.py, denetle): birim ve aralık (yüzde > 100, oran olarak girilmiş yüzde, negatif
sayı), ondalık kayması (eski değerin 50 katı), önceki yıla göre ±%50 sıçrama, 81 il toplamı = Türkiye (±%2).
Karşılaştırma build/veri.db ile yapılır: veritabanıyla aynı olan değerler denetlenmez ve rapora girmez.

Çıktılar
  build/guncelleme/aday/<ad>-denetim.csv    uyarılı ya da hatalı her aday değer (gerekçesiyle)
  build/guncelleme/aday/<ad>-denetim.json   özet (guncelle.py --uygula bunu gösterir)

Tek başına: py -X utf8 tools/guncelle/aday_denetim.py [tuik-api]
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(KOK / "veri-masasi"))
import veri_masasi as VM  # noqa: E402

GD = KOK / "build/guncelleme"
ESIK = 0.005  # guncelle.py ve tuik_aday.py ile aynı: daha küçük göreli fark "aynı" sayılır


def denetle(ad: str = "tuik-api") -> dict:
    kaynak = GD / "aday" / f"{ad}.ham.csv"
    if not kaynak.exists():
        return {"ad": ad, "yok": True}
    v = VM.Veri(KOK / "build" / "veri.db")
    girisler = []
    with open(kaynak, encoding="utf-8-sig", newline="") as f:
        for i, r in enumerate(csv.DictReader(f, delimiter=";"), 2):
            k = {"tur": "yeni", "sayfa": kaynak.name, "satir": i, "hata": [], "uyari": [], "kaynak": r["kaynak"],
                 "ayrinti": "", "gerekce": "", "not": "", "yil": None, "deger": None}
            k["kod"], h = v.kod_bul(r["kod"])
            k["hata"] += [h] if h else []
            k["gosterge"], h = v.gosterge_bul(r["gosterge"])
            if h:  # veritabanında henüz olmayan gösterge: veri hattı yeni gösterge olarak ekler
                k["gosterge"] = r["gosterge"]
                k["hata"].append("yeni gösterge (veritabanında yok)")
            try:
                k["yil"] = int(r["yil"])
                k["deger"] = VM.sayi(r["deger"])
            except ValueError as e:
                k["hata"].append(f"değer/yıl: {e}")
            girisler.append(k)
    VM.denetle(girisler, v)
    # Raporla aynı ölçüt: %0,5'ten küçük fark (ör. Bin TL'de yuvarlama) değişiklik sayılmaz ve denetlenmez
    for k in girisler:
        e, y = k.get("eski"), k["deger"]
        if k.get("islem") == "revizyon" and e is not None and y is not None \
                and abs(e - y) <= ESIK * max(abs(e), abs(y), 1e-9):
            k["islem"], k["uyari"] = "ayni", []

    islem = Counter(k.get("islem", "hata") for k in girisler)
    sorunlu = [k for k in girisler if k["hata"] or (k["uyari"] and k.get("islem") != "ayni")]
    with open(GD / "aday" / f"{ad}-denetim.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["tur", "kod", "birim", "gosterge", "yil", "eski", "yeni", "islem", "sorun"])
        for k in sorted(sorunlu, key=lambda k: (k["gosterge"] or "", k["yil"] or 0, k["kod"] or "")):
            w.writerow(["hata" if k["hata"] else "uyarı", k["kod"], VM.DUZEY_AD.get(v.birim.get(k["kod"], ("", ""))[1], ""),
                        k["gosterge"], k["yil"], VM.yaz_sayi(k.get("eski")), VM.yaz_sayi(k["deger"]),
                        VM._islem_ad(k), " | ".join(k["hata"] + k["uyari"])])
    uyari_gos = Counter(k["gosterge"] for k in sorunlu if not k["hata"])
    hata_gos = Counter(k["gosterge"] for k in sorunlu if k["hata"])
    ozet = {"ad": ad, "toplam": len(girisler), "ayni": islem["ayni"], "ekleme": islem["ekleme"],
            "revizyon": islem["revizyon"], "uyarili": sum(uyari_gos.values()), "hatali": sum(hata_gos.values()),
            "uyari_gosterge": uyari_gos.most_common(), "hata_gosterge": hata_gos.most_common(),
            "ornek": [f"{k['kod']} {k['yil']} · {k['gosterge']}: {VM.goster(k.get('eski'))} → {VM.goster(k['deger'])} "
                      f"({'; '.join(k['hata'] + k['uyari'])})" for k in sorunlu if not k["hata"]][:15]}
    (GD / "aday" / f"{ad}-denetim.json").write_text(json.dumps(ozet, ensure_ascii=False, indent=1), encoding="utf-8")
    return ozet


def rapor_satirlari(s: dict | None) -> list[str]:
    if not s or s.get("yok"):
        return []
    nf = lambda x: VM.goster(x)
    L = ["", "**Uygulama öncesi kontroller (Veri Masası: birim, ±%50 sıçrama, ondalık kayması, 81 il = Türkiye)**", "",
         f"- Denetlenen aday değer: {nf(s['toplam'])} · veritabanıyla aynı: {nf(s['ayni'])} · "
         f"yeni: {nf(s['ekleme'])} · revize: {nf(s['revizyon'])}",
         f"- Uyarılı değer: {nf(s['uyarili'])} · hatalı değer: {nf(s['hatali'])} "
         f"(ayrıntı: `build/guncelleme/aday/{s['ad']}-denetim.csv`)"]
    if s["uyari_gosterge"]:
        L += ["", "Uyarılı değeri olan göstergeler:", ""]
        L += [f"- {g}: {n}" for g, n in s["uyari_gosterge"][:25]]
        if len(s["uyari_gosterge"]) > 25:
            L.append(f"- … ve {len(s['uyari_gosterge']) - 25} gösterge daha")
        L += ["", "İlk örnekler:", ""] + [f"- {x}" for x in s["ornek"]]
    if s["hata_gosterge"]:
        L += ["", "Hatalı değeri olan göstergeler (birim kodu ya da gösterge adı veritabanında yok):", ""]
        L += [f"- {g}: {n}" for g, n in s["hata_gosterge"][:25]]
    if not s["uyari_gosterge"] and not s["hata_gosterge"]:
        L += ["", "- Kontrollerden geçmeyen değer yok."]
    return L


if __name__ == "__main__":
    o = denetle(sys.argv[1] if len(sys.argv) > 1 else "tuik-api")
    print("\n".join(rapor_satirlari(o)) or "aday dosyası yok (önce guncelle.py çalıştırın)")
