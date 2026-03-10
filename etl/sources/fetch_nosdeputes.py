"""
Enrichissement via l'API NosDéputés.fr / NosSénateurs.fr
Source : https://www.nosdeputes.fr / https://www.nossenateurs.fr
Licence : ODbL

Cache local : les données sont sauvegardées dans etl/.cache/nosdeputes.json
afin de survivre aux pannes de l'API (erreurs 500 fréquentes).
"""

import requests
import json
import time
from pathlib import Path
from typing import Generator

NOSDEPUTES_URL = "https://www.nosdeputes.fr/deputes/json"
NOSSENATEURS_URL = "https://www.nossenateurs.fr/senateurs/json"

_CACHE_DIR = Path(__file__).parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "nosdeputes.json"


def _load_cache() -> list[dict]:
    """Charge les données depuis le cache local."""
    if _CACHE_FILE.exists():
        try:
            data = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list) and len(data) > 0:
                return data
        except Exception:
            pass
    return []


def _save_cache(data: list[dict]) -> None:
    """Sauvegarde les données dans le cache local."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


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
        _save_cache(result)
        return result
    except Exception as e:
        print(f"    ✗ Erreur NosDéputés.fr: {e}")
        cached = _load_cache()
        if cached:
            print(f"    ↻ Cache local utilisé ({len(cached)} députés)")
            return cached
        return []


def build_enrichment_index(deputes: list[dict]) -> dict[str, dict]:
    """Construit un index nom → données enrichies pour jointure."""
    index = {}
    for dep in deputes:
        key = f"{dep['prenom'].lower().strip()} {dep['nom'].lower().strip()}"
        index[key] = dep
        # Aussi par nom seul pour fuzzy match
        index[dep["nom"].lower().strip()] = dep
    return index
