#!/usr/bin/env python3
"""
Script ponctuel : télécharge les photos de gouvernement.json dans public/data/photos/
Attend 30s avant de commencer, puis 12s entre chaque image (retry-after: 10s Wikimedia).
"""
import json
import re
import time
import sys
from pathlib import Path
import requests

ROOT = Path(__file__).parent.parent
JSON_PATH = ROOT / "public" / "data" / "gouvernement.json"
PHOTOS_DIR = ROOT / "public" / "data" / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

IMG_HEADERS = {
    "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source; github.com/casseroles)",
    "Accept": "image/jpeg,image/png,image/*",
    "Referer": "https://fr.wikipedia.org/",
}

data = json.loads(JSON_PATH.read_text())

# Collect URLs to download
to_download = []
for m in data:
    url = m.get("url_photo", "")
    qid = m.get("wikidata_id", "")
    if url.startswith("http") and qid:
        ext = ".jpg" if ".jpg" in url.lower() or ".jpeg" in url.lower() else ".png"
        local_path = PHOTOS_DIR / f"{qid}{ext}"
        if not local_path.exists():
            to_download.append((m["prenom"], m["nom"], url, qid, local_path))

if not to_download:
    print("✅ Toutes les photos déjà téléchargées.")
    sys.exit(0)

print(f"📥 {len(to_download)} photos à télécharger")
print("⏳ Attente 35s pour laisser le rate-limit Wikimedia se réinitialiser...")
time.sleep(35)

ok = 0
fail = 0
for prenom, nom, url, qid, local_path in to_download:
    try:
        resp = requests.get(url, headers=IMG_HEADERS, timeout=20)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            local_path.write_bytes(resp.content)
            ok += 1
            print(f"  ✓ {prenom} {nom} ({local_path.name}) [{len(resp.content)//1024}KB]")
        elif resp.status_code == 429:
            fail += 1
            print(f"  ❌ 429 {prenom} {nom} – rate limit encore actif")
        else:
            fail += 1
            print(f"  ⚠ {resp.status_code} {prenom} {nom}")
    except Exception as e:
        fail += 1
        print(f"  ✗ {prenom} {nom}: {e}")

    if to_download.index((prenom, nom, url, qid, local_path)) < len(to_download) - 1:
        time.sleep(12)

print(f"\n✅ {ok} téléchargées · ❌ {fail} échecs")

# Now patch gouvernement.json with local paths
if ok > 0:
    print("\n🔧 Mise à jour gouvernement.json avec chemins locaux...")
    changed = 0
    for m in data:
        url = m.get("url_photo", "")
        qid = m.get("wikidata_id", "")
        if url.startswith("http") and qid:
            ext = ".jpg" if ".jpg" in url.lower() or ".jpeg" in url.lower() else ".png"
            local_path = PHOTOS_DIR / f"{qid}{ext}"
            if local_path.exists():
                m["url_photo"] = f"/data/photos/{qid}{ext}"
                changed += 1
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  ✓ {changed} entrées mises à jour avec chemins locaux")
