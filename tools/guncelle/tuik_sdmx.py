"""
tuik_sdmx.py — TÜİK SDMX API istemcisi (veri akışlarını listeler, seçilen akışı CSV olarak indirir).

Kimlik doğrulama (docs/TUIK-SDMX-API-REHBERI.md, bölüm 4):
  Veri Portalı'nda (https://veriportali.tuik.gov.tr) "Kullanıcı Bilgileri" ekranında SMS ile telefon doğrulaması
  yapılarak üretilen API anahtarı, proje kökündeki tuik-api-key.txt (ya da .tuik-api-key) dosyasına (tek satır) yazılır. Bu dosya
  yayına ve sürüm denetimine girmez; anahtar sohbete ya da koda yazılmaz.

Kullanım:
    python tools/guncelle/tuik_sdmx.py liste                       # bütün veri akışları -> build/guncelleme/tuik/akislar.csv
    python tools/guncelle/tuik_sdmx.py liste --ara il               # adında "il" geçenler
    python tools/guncelle/tuik_sdmx.py indir DF_KODU [--surum 1.0] [--anahtar A.TR..] [--baslangic 2010]

Not: Bu betik API anahtarı olmadan çalışmaz; anahtar edinilene kadar test edilmemiştir.
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

KOK = Path(__file__).resolve().parents[2]
TOKEN_URL = "https://giris.tuik.gov.tr/realms/web/protocol/openid-connect/token"
API = "https://nsiws.tuik.gov.tr/rest"
UA = "dakaveri-guncelleme/1.0"
CIKTI = KOK / "build/guncelleme/tuik"
NS = {"s": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure",
      "c": "http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common"}


def anahtar_oku() -> str:
    for ad in (".tuik-api-key", "tuik-api-key.txt"):
        p = KOK / ad
        if p.exists() and p.read_text(encoding="utf-8-sig").strip():
            return p.read_text(encoding="utf-8-sig").strip()
    sys.exit("API anahtarı bulunamadı ya da dosya boş: proje kökünde tuik-api-key.txt (ya da .tuik-api-key) olmalı.")


def token() -> str:
    veri = urllib.parse.urlencode({"grant_type": "password", "client_id": "nsi-ws-consumer", "api_key": anahtar_oku()}).encode()
    req = urllib.request.Request(TOKEN_URL, data=veri, headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)["access_token"]


def getir(yol: str, tok: str, kabul: str | None = None) -> bytes:
    h = {"Authorization": f"Bearer {tok}", "User-Agent": UA}
    if kabul:
        h["Accept"] = kabul
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + yol, headers=h), timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == 3:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if i == 3:
                raise
        time.sleep(5 * (i + 1))


def liste(a):
    tok = token()
    kok = ET.fromstring(getir("/dataflow/TR/all/latest", tok))
    satirlar = []
    for df in kok.iter(f"{{{NS['s']}}}Dataflow"):
        ad = {n.get("{http://www.w3.org/XML/1998/namespace}lang"): n.text for n in df.findall("c:Name", NS)}
        satirlar.append([df.get("agencyID"), df.get("id"), df.get("version"), ad.get("tr", ""), ad.get("en", "")])
    if a.ara:
        satirlar = [s for s in satirlar if re.search(a.ara, s[3] + " " + s[4], re.I)]
    CIKTI.mkdir(parents=True, exist_ok=True)
    with open(CIKTI / "akislar.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["ajans", "akis", "surum", "ad_tr", "ad_en"])
        w.writerows(satirlar)
    for s in satirlar[:50]:
        print(f"{s[1]} ({s[2]}): {s[3]}")
    print(f"{len(satirlar)} veri akışı -> {CIKTI / 'akislar.csv'}")


def indir(a):
    tok = token()
    yol = f"/data/TR,{a.akis},{a.surum}/{a.anahtar or 'all'}"
    q = {}
    if a.baslangic:
        q["startPeriod"] = a.baslangic
    if q:
        yol += "?" + urllib.parse.urlencode(q)
    # Rehber 6.3: CSV çıktısı Accept başlığıyla istenebilir; desteklenmezse SDMX-ML döner
    veri = getir(yol, tok, "application/vnd.sdmx.data+csv;version=1.0.0")
    CIKTI.mkdir(parents=True, exist_ok=True)
    uzanti = "csv" if veri[:200].count(b",") > 3 else "xml"
    p = CIKTI / f"{a.akis}.{uzanti}"
    p.write_bytes(veri)
    print(f"{len(veri)} bayt -> {p}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    alt = ap.add_subparsers(dest="komut", required=True)
    l = alt.add_parser("liste"); l.add_argument("--ara")
    i = alt.add_parser("indir"); i.add_argument("akis"); i.add_argument("--surum", default="latest")
    i.add_argument("--anahtar"); i.add_argument("--baslangic")
    a = ap.parse_args(argv)
    return liste(a) if a.komut == "liste" else indir(a)


if __name__ == "__main__":
    sys.exit(main())
