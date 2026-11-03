"""
tuik_yapi.py — TÜİK SDMX veri akışlarının yapısal metaverisi: boyutlar, kod listeleri ve Türkçe etiketler.

Rehber bölüm 5.3: /dataflow/TR/{akış}/{sürüm}?references=descendants tek yanıtta akışı, veri yapısı tanımını (DSD),
kavram şemalarını ve kod listelerini getirir. Yanıt build/guncelleme/tuik/yapi/<akış>.xml.gz olarak önbelleğe alınır.

    from tuik_yapi import yapi
    Y = yapi("DF_ADNKS_T06", "1.1")
    Y["boyutlar"]            -> ["FREQ", "REF_AREA", ...]  (DSD sırası)
    Y["etiket"]["SEX"]["_T"] -> "Toplam"
    Y["ad"]                  -> akışın Türkçe adı
"""
from __future__ import annotations

import gzip
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import tuik_sdmx as T  # noqa: E402

YAPI = T.CIKTI / "yapi"
S = "{http://www.sdmx.org/resources/sdmxml/schemas/v2_1/structure}"
C = "{http://www.sdmx.org/resources/sdmxml/schemas/v2_1/common}"
XL = "{http://www.w3.org/XML/1998/namespace}lang"


def _ad(el) -> str:
    adlar = {n.get(XL): (n.text or "").strip() for n in el.findall(f"{C}Name")}
    return adlar.get("tr") or adlar.get("en") or ""


def ham(akis: str, surum: str, tok: str | None = None, yeniden: bool = False) -> bytes:
    YAPI.mkdir(parents=True, exist_ok=True)
    p = YAPI / f"{akis}.xml.gz"
    if p.exists() and not yeniden:
        return gzip.decompress(p.read_bytes())
    veri = T.getir(f"/dataflow/TR/{akis}/{surum}?references=descendants", tok or T.token())
    p.write_bytes(gzip.compress(veri))
    return veri


def yapi(akis: str, surum: str, tok: str | None = None, yeniden: bool = False) -> dict:
    kok = ET.fromstring(ham(akis, surum, tok, yeniden))
    df = next(kok.iter(f"{S}Dataflow"))
    kodlistesi = {}
    for cl in kok.iter(f"{S}Codelist"):
        kodlistesi[(cl.get("id"), cl.get("version"))] = {c.get("id"): _ad(c) for c in cl.findall(f"{S}Code")}
    kavram = {}
    for cs in kok.iter(f"{S}ConceptScheme"):
        for c in cs.findall(f"{S}Concept"):
            kavram[c.get("id")] = _ad(c)
    boyutlar, etiket, kavram_adi = [], {}, {}
    for tur in ("Dimension", "Attribute"):
        for d in kok.iter(f"{S}{tur}"):
            did = d.get("id")
            if tur == "Dimension":
                boyutlar.append(did)
            ref = d.find(f"{S}LocalRepresentation/{S}Enumeration/Ref")
            cref = d.find(f"{S}ConceptIdentity/Ref")
            kavram_adi[did] = kavram.get(cref.get("id")) if cref is not None else did
            if ref is not None:
                etiket[did] = kodlistesi.get((ref.get("id"), ref.get("version")), {})
    return {"akis": akis, "surum": surum, "ad": _ad(df), "boyutlar": boyutlar, "etiket": etiket, "kavram": kavram_adi}


if __name__ == "__main__":
    import json
    Y = yapi(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "latest")
    print(Y["ad"], Y["boyutlar"])
    for b in Y["boyutlar"]:
        print(b, Y["kavram"].get(b), len(Y["etiket"].get(b, {})))
