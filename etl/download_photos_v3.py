#!/usr/bin/env python3
"""
Télécharge les photos des ministres directement depuis les URLs thumbnail Wikimedia.
Stratégie v3 : téléchargement direct des thumbs 220px (pas d'API intermédiaire).
Pour les 3 sans URL : requête SPARQL Wikidata.
"""
import json
import time
import sys
from pathlib import Path
import requests

try:
    from PIL import Image as PILImage
    import io
    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

ROOT = Path(__file__).parent.parent
JSON_PATH = ROOT / "public" / "data" / "gouvernement.json"
PHOTOS_DIR = ROOT / "public" / "data" / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

IMG_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Casseroles-ETL/1.0; +https://github.com/casseroles)",
    "Accept": "image/jpeg,image/png,image/*,*/*",
    "Referer": "https://commons.wikimedia.org/",
}
SPARQL_HEADERS = {
    "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source)",
    "Accept": "application/sparql-results+json",
}


def fetch_wikidata_photo(qid: str) -> str:
    """Requête SPARQL pour obtenir l'URL d'image depuis Wikidata."""
    query = f"""
    SELECT ?imageURL WHERE {{
      wd:{qid} wdt:P18 ?image .
      BIND(CONCAT("https://commons.wikimedia.org/wiki/Special:FilePath/",
           ENCODE_FOR_URI(REPLACE(STR(?image), "http://commons.wikimedia.org/wiki/Special:FilePath/", "")),
           "?width=220") AS ?imageURL)
    }} LIMIT 1
    """
    url = "https://query.wikidata.org/sparql"
    try:
        resp = requests.get(url, params={"query": query, "format": "json"},
                            headers=SPARQL_HEADERS, timeout=15)
        if resp.status_code == 200:
            results = resp.json().get("results", {}).get("bindings", [])
            if results:
                return results[0]["imageURL"]["value"]
    except Exception as e:
        print(f"    SPARQL error for {qid}: {e}")
    return ""


def resize_and_save(img_bytes: bytes, output_path: Path, target_size: int = 220) -> bool:
    if not HAS_PILLOW:
        output_path.write_bytes(img_bytes)
        return True
    try:
        img = PILImage.open(io.BytesIO(img_bytes))
        if img.mode in ("RGBA", "LA", "P"):
            bg = PILImage.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img = img.resize((target_size, target_size), PILImage.LANCZOS)
        img.save(output_path, "JPEG", quality=88, optimize=True)
        return True
    except Exception as e:
        print(f"      Resize error: {e}")
        output_path.write_bytes(img_bytes)
        return True


def download_image(url: str, output_path: Path) -> bool:
    try:
        resp = requests.get(url, headers=IMG_HEADERS, timeout=30)
        if resp.status_code == 200 and "image" in resp.headers.get("content-type", ""):
            size_kb = len(resp.content) // 1024
            resize_and_save(resp.content, output_path)
            print(f"✓ ({size_kb}KB → {output_path.name})")
            return True
        else:
            print(f"❌ HTTP {resp.status_code}")
            return False
    except Exception as e:
        print(f"✗ {e}")
        return False


# ── Main ──────────────────────────────────────────────────────────────────────

data = json.loads(JSON_PATH.read_text())

# Phase 1 : télécharger les URLs Wikipedia distantes
to_download = []
for m in data:
    url = m.get("url_photo", "")
    qid = m.get("wikidata_id", "")
    if url.startswith("https://") and qid:
        local_path = PHOTOS_DIR / f"{qid}.jpg"
        if not local_path.exists():
            to_download.append((m["prenom"], m["nom"], url, qid, local_path))

# Phase 2 : ceux sans URL → SPARQL Wikidata
no_url = []
for m in data:
    url = m.get("url_photo", "")
    qid = m.get("wikidata_id", "")
    if not url and qid:
        local_path = PHOTOS_DIR / f"{qid}.jpg"
        if not local_path.exists():
            no_url.append((m["prenom"], m["nom"], qid, local_path))

print(f"📥 Phase 1 : {len(to_download)} photos avec URL distante")
print(f"🔍 Phase 2 : {len(no_url)} ministres sans URL (requête Wikidata)")

ok = 0
fail = 0

for i, (prenom, nom, url, qid, local_path) in enumerate(to_download):
    print(f"  [{i+1}/{len(to_download)}] {prenom} {nom}... ", end="", flush=True)
    time.sleep(1.5)
    if download_image(url, local_path):
        ok += 1
    else:
        fail += 1

if no_url:
    print("\n🔍 Récupération via Wikidata SPARQL...")
    for prenom, nom, qid, local_path in no_url:
        print(f"  {prenom} {nom} ({qid})... ", end="", flush=True)
        time.sleep(2)
        sparql_url = fetch_wikidata_photo(qid)
        if sparql_url:
            print(f"URL trouvée → ", end="", flush=True)
            time.sleep(1)
            if download_image(sparql_url, local_path):
                ok += 1
            else:
                fail += 1
        else:
            print("❌ Pas de photo sur Wikidata")
            fail += 1

print(f"\n✅ {ok} téléchargées · ❌ {fail} échecs")

# Patch gouvernement.json avec les chemins locaux
if ok > 0:
    print("\n🔧 Mise à jour gouvernement.json...")
    changed = 0
    for m in data:
        qid = m.get("wikidata_id", "")
        if qid:
            local_path = PHOTOS_DIR / f"{qid}.jpg"
            if local_path.exists():
                m["url_photo"] = f"/data/photos/{qid}.jpg"
                changed += 1
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  ✓ {changed} entrées → chemins locaux")
