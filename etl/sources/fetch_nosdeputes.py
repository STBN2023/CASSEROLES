"""
Enrichissement via l'API NosDéputés.fr / NosSénateurs.fr
Source : https://www.nosdeputes.fr / https://www.nossenateurs.fr
Licence : ODbL
"""

import requests
import time
from typing import Generator

NOSDEPUTES_URL = "https://www.nosdeputes.fr/deputes/json"
NOSSENATEURS_URL = "https://www.nossenateurs.fr/senateurs/json"


def fetch_nosdeputes() -> list[dict]:
    """Récupère la liste des députés en mandat avec leurs infos enrichies."""
    print("  → Téléchargement NosDéputés.fr...")
    try:
        resp = requests.get(
            NOSDEPUTES_URL, timeout=30, headers={"User-Agent": "Casseroles-ETL/1.0"}
        )
        resp.raise_for_status()
        data = resp.json()
        deputes = data.get("deputes", [])
        result = []
        for item in deputes:
            dep = item.get("depute", item)
            enriched = {
                "slug": dep.get("slug", ""),
                "nom": dep.get("nom", ""),
                "prenom": dep.get("prenom", ""),
                "nom_complet": dep.get("nom_complet") or f"{dep.get('prenom','')} {dep.get('nom','')}",
                "groupe": dep.get("groupe_sigle", dep.get("parti_ratt_financierement", "")),
                "circo": dep.get("nom_circo", ""),
                "num_deptmt": dep.get("num_deptmt", ""),
                "place_en_hemicycle": dep.get("place_en_hemicycle", ""),
                "url_photo": f"https://www.nosdeputes.fr/depute/photo/{dep.get('slug', '')}/60",
                "url_fiche": f"https://www.nosdeputes.fr/{dep.get('slug', '')}",
                "source": "nosdeputes",
            }
            result.append(enriched)
        print(f"    ✓ {len(result)} députés chargés depuis NosDéputés.fr")
        return result
    except Exception as e:
        print(f"    ✗ Erreur NosDéputés.fr: {e}")
        return []


def build_enrichment_index(deputes: list[dict]) -> dict[str, dict]:
    """Construit un index nom → données enrichies pour jointure."""
    index = {}
    for dep in deputes:
        key = f"{dep['prenom'].lower().strip()}_{dep['nom'].lower().strip()}"
        index[key] = dep
        # Aussi par nom seul pour fuzzy match
        index[dep["nom"].lower().strip()] = dep
    return index
