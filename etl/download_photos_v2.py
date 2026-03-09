#!/usr/bin/env python3
"""
Télécharge les photos des ministres via Wikimedia REST API.
Stratégie : API REST (api.wikimedia.org) → URL originale (pas thumbnail)
→ évite le rate limit sur /thumb/ de upload.wikimedia.org.
Redimensionne ensuite les images localement si Pillow est disponible.
"""
import json
import re
import time
import sys
import urllib.parse
from pathlib import Path
import requests

try:
    from PIL import Image as PILImage
    import io
    HAS_PILLOW = True
    print("  ✓ Pillow disponible – redimensionnement activé")
except ImportError:
    HAS_PILLOW = False
    print("  ⚠ Pillow non disponible – images sauvegardées en taille originale")

ROOT = Path(__file__).parent.parent
JSON_PATH = ROOT / "public" / "data" / "gouvernement.json"
PHOTOS_DIR = ROOT / "public" / "data" / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source; github.com/casseroles)",
    "Accept": "application/json",
}
IMG_HEADERS = {
    "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source; github.com/casseroles)",
    "Accept": "image/jpeg,image/png,image/*",
    "Referer": "https://commons.wikimedia.org/",
}


def get_original_url_from_thumb(thumb_url: str) -> str:
    """
    Extrait le nom de fichier depuis une URL thumbnail Wikimedia,
    puis utilise l'API REST pour obtenir l'URL du fichier original.
    """
    # Extract filename from thumb URL
    # Format: .../thumb/{hash1}/{hash2}/{filename}/220px-{filename}
    match = re.search(r'/thumb/[a-f0-9]/[a-f0-9]+/([^/]+)/\d+px-', thumb_url)
    if not match:
        return ""
    filename_encoded = match.group(1)
    filename = urllib.parse.unquote(filename_encoded)

    # Use Wikimedia REST API
    api_url = f"https://api.wikimedia.org/core/v1/commons/file/{urllib.parse.quote(filename)}"
    try:
        resp = requests.get(api_url, headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            # Prefer thumbnail.url (original file) over preferred.url (may be resized)
            thumb_data = data.get("thumbnail", {})
            original_url = thumb_data.get("url", "")
            return original_url
    except Exception as e:
        print(f"    API error for {filename}: {e}")
    return ""


def resize_and_save(img_bytes: bytes, output_path: Path, target_size: int = 220) -> bool:
    """Redimensionne l'image à target_size px (carré) et la sauvegarde."""
    if not HAS_PILLOW:
        output_path.write_bytes(img_bytes)
        return True
    try:
        img = PILImage.open(io.BytesIO(img_bytes))
        # Convert to RGB if needed (PNG with alpha)
        if img.mode in ("RGBA", "LA", "P"):
            bg = PILImage.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Center crop to square, then resize
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


# ── Main ──────────────────────────────────────────────────────────────────────

data = json.loads(JSON_PATH.read_text())

to_download = []
for m in data:
    url = m.get("url_photo", "")
    qid = m.get("wikidata_id", "")
    if url.startswith("https://upload.wikimedia.org") and qid:
        local_path = PHOTOS_DIR / f"{qid}.jpg"
        if not local_path.exists():
            to_download.append((m["prenom"], m["nom"], url, qid, local_path))

if not to_download:
    print("✅ Toutes les photos déjà téléchargées.")
    sys.exit(0)

print(f"\n📥 {len(to_download)} photos à télécharger (stratégie : fichier original)")

ok = 0
fail = 0
for i, (prenom, nom, thumb_url, qid, local_path) in enumerate(to_download):
    print(f"  [{i+1}/{len(to_download)}] {prenom} {nom}...", end=" ", flush=True)

    # Step 1: Get original file URL via REST API
    time.sleep(0.3)
    original_url = get_original_url_from_thumb(thumb_url)
    if not original_url:
        print("❌ URL originale non trouvée")
        fail += 1
        continue

    # Step 2: Download original file
    time.sleep(0.3)
    try:
        resp = requests.get(original_url, headers=IMG_HEADERS, timeout=30)
        if resp.status_code == 200 and resp.headers.get("content-type", "").startswith("image"):
            size_kb = len(resp.content) // 1024
            # Step 3: Resize and save
            resize_and_save(resp.content, local_path, target_size=220)
            print(f"✓ ({size_kb}KB → {local_path.name})")
            ok += 1
        else:
            print(f"❌ HTTP {resp.status_code}")
            fail += 1
    except Exception as e:
        print(f"✗ {e}")
        fail += 1

print(f"\n✅ {ok} téléchargées · ❌ {fail} échecs")

# Patch gouvernement.json with local paths
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
