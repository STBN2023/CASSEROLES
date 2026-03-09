#!/usr/bin/env python3
"""
Télécharge les logos des partis politiques français depuis Wikidata/Wikimedia Commons.
Utilise la propriété P154 (logo image) de Wikidata.
"""

import os
import json
import urllib.request
import urllib.parse
import hashlib
import ssl
import time

# Contourner le problème de certificats SSL sur macOS
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# Mapping nom du parti → Wikidata QID (vérifiés)
PARTIS_WIKIDATA = {
    "Les Républicains": "Q20012759",
    "Rassemblement National": "Q205150",
    "La France Insoumise": "Q27978402",
    "Parti Socialiste": "Q170972",
    "Horizons": "Q108846587",
    "MoDem": "Q587370",
    "Renaissance": "Q23731823",
    "Les Écologistes": "Q613786",
    "Nouveau Parti anticapitaliste": "Q1045425",
    "UDF": "Q827415",
    "Parti radical de gauche": "Q427965",
}

# Fallback pour les partis sans P154 sur Wikidata (nom fichier Commons)
FALLBACK_COMMONS = {
    "Parti Socialiste": "Logotype du Parti socialiste.svg",
}

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data", "logos")


def get_logo_filename_from_wikidata(qid: str) -> str | None:
    """Récupère le nom du fichier logo depuis Wikidata via l'API."""
    url = (
        f"https://www.wikidata.org/w/api.php?"
        f"action=wbgetclaims&entity={qid}&property=P154&format=json"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "CasserolesBot/1.0 (https://github.com/casseroles; contact@casseroles.fr)"})
    with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
        data = json.loads(resp.read())

    claims = data.get("claims", {}).get("P154", [])
    if not claims:
        return None

    return claims[0]["mainsnak"]["datavalue"]["value"]


def get_commons_thumb_url(filename: str, width: int = 200) -> str:
    """Construit l'URL de la miniature Wikimedia Commons."""
    # Wikimedia Commons utilise un hash MD5 pour le chemin
    filename_encoded = filename.replace(" ", "_")
    md5 = hashlib.md5(filename_encoded.encode()).hexdigest()
    a, b = md5[0], md5[:2]

    # URL directe vers le fichier original (SVG ou PNG)
    ext = filename_encoded.rsplit(".", 1)[-1].lower()

    quoted_filename = urllib.parse.quote(filename_encoded)

    if ext == "svg":
        thumb_name = urllib.parse.quote(f"{width}px-{filename_encoded}.png")
    else:
        thumb_name = urllib.parse.quote(f"{width}px-{filename_encoded}")

    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/"
        f"{a}/{b}/{quoted_filename}/{thumb_name}"
    )


def download_logo(url: str, output_path: str) -> bool:
    """Télécharge un fichier depuis une URL."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CasserolesBot/1.0 (https://github.com/casseroles; contact@casseroles.fr)"})
        with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
            with open(output_path, "wb") as f:
                f.write(resp.read())
        return True
    except Exception as e:
        print(f"  ✗ Erreur téléchargement: {e}")
        return False


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    results = {}

    for i, (parti_nom, qid) in enumerate(PARTIS_WIKIDATA.items()):
        if i > 0:
            time.sleep(3)  # Éviter le rate limiting Wikimedia
        print(f"→ {parti_nom} ({qid})...")

        filename = get_logo_filename_from_wikidata(qid)
        if not filename:
            filename = FALLBACK_COMMONS.get(parti_nom)
        if not filename:
            print(f"  ✗ Pas de logo P154 trouvé")
            continue

        print(f"  Fichier: {filename}")

        thumb_url = get_commons_thumb_url(filename, width=200)
        print(f"  URL: {thumb_url}")

        # Nom de fichier local simplifié
        safe_name = parti_nom.lower().replace(" ", "_").replace("/", "_").replace("'", "")
        ext = "png"  # Les thumbs sont toujours en PNG
        local_filename = f"{safe_name}.{ext}"
        output_path = os.path.join(OUTPUT_DIR, local_filename)

        if download_logo(thumb_url, output_path):
            size_kb = os.path.getsize(output_path) / 1024
            print(f"  ✓ Sauvegardé: {local_filename} ({size_kb:.1f} Ko)")
            results[parti_nom] = f"/data/logos/{local_filename}"
        else:
            print(f"  ✗ Échec")

    # Sauvegarder le mapping
    mapping_path = os.path.join(OUTPUT_DIR, "mapping.json")
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(results)}/{len(PARTIS_WIKIDATA)} logos téléchargés")
    print(f"  Mapping sauvegardé dans {mapping_path}")


if __name__ == "__main__":
    main()
