"""
Enrichissement des députés via Wikidata SPARQL + Wikimedia Commons.

Remplace NosDéputés.fr (archive 2022-2024, obsolète) comme source principale
pour les photos et partis des députés.

Source : Wikidata (CC0) · Wikimedia Commons (licences variées, usage éducatif)

Stratégie :
  1. Une requête SPARQL récupère TOUS les députés actuels (pas de date de fin
     sur le statement P39) avec photo (P18) et parti (P102).
  2. Les photos sont téléchargées localement dans public/data/photos/.
  3. L'index est construit par nom normalisé pour jointure avec le RNE.
"""

import hashlib
import time
import re
import json
from pathlib import Path

from sources.http_client import get_session

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"

HEADERS = {
    "Accept": "application/sparql-results+json",
}

IMG_HEADERS = {
    "Accept": "image/jpeg,image/png,image/*",
}

# Députés actuels à l'Assemblée nationale (XVIIe législature, depuis juillet 2024)
# On filtre par date de début de mandat > 2024-06-01 ET pas de date de fin,
# ce qui exclut les députés historiques dont la date de fin n'a pas été renseignée.
# On récupère aussi le groupe parlementaire (P4100) pour l'hémicycle.
QUERY_DEPUTES = """
SELECT DISTINCT ?person ?personLabel ?image ?partyLabel ?groupLabel ?frwiki WHERE {
  ?person p:P39 ?stmt .
  ?stmt ps:P39 wd:Q3044918 .
  ?stmt pq:P580 ?startDate .
  FILTER(?startDate > "2024-06-01T00:00:00Z"^^xsd:dateTime)
  FILTER NOT EXISTS { ?stmt pq:P582 ?endDate }
  OPTIONAL { ?person wdt:P18 ?image }
  OPTIONAL { ?person wdt:P102 ?party }
  OPTIONAL {
    ?person p:P4100 ?groupStmt .
    ?groupStmt ps:P4100 ?group .
    FILTER NOT EXISTS { ?groupStmt pq:P582 ?groupEnd }
  }
  OPTIONAL {
    ?frwiki schema:about ?person .
    ?frwiki schema:isPartOf <https://fr.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en" . }
}
ORDER BY ?personLabel
LIMIT 700
"""

_CACHE_DIR = Path(__file__).parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "deputes_wikidata.json"


def _load_cache() -> list[dict]:
    if _CACHE_FILE.exists():
        try:
            data = json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list) and len(data) > 0:
                return data
        except Exception:
            pass
    return []


def _save_cache(data: list[dict]) -> None:
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _CACHE_FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def _commons_thumb_url(commons_url: str, width: int = 220) -> str:
    """
    Convertit une URL Wikimedia Commons en URL de miniature.
    Ex: http://commons.wikimedia.org/wiki/Special:FilePath/Photo.jpg
    → https://commons.wikimedia.org/wiki/Special:FilePath/Photo.jpg?width=220
    """
    if not commons_url:
        return ""
    url = commons_url.replace("http://", "https://")
    if "Special:FilePath" in url:
        return f"{url}?width={width}"
    return url


def _download_photo(url: str, qid: str, photos_dir: Path) -> str:
    """Télécharge une photo et retourne le chemin local, ou '' en cas d'échec."""
    if not url or not qid:
        return ""

    ext = ".jpg"
    if ".png" in url.lower():
        ext = ".png"
    local_path = photos_dir / f"{qid}{ext}"

    # Ne pas re-télécharger si déjà en cache
    if local_path.exists():
        return f"/data/photos/{qid}{ext}"

    try:
        time.sleep(0.2)
        resp = get_session().get(url, headers=IMG_HEADERS, timeout=15, allow_redirects=True)
        if resp.status_code == 200:
            ct = resp.headers.get("content-type", "")
            if ct.startswith("image"):
                local_path.write_bytes(resp.content)
                return f"/data/photos/{qid}{ext}"
        elif resp.status_code == 429:
            time.sleep(2)
    except Exception:
        pass
    return ""


def _parse_value(binding: dict, key: str) -> str:
    v = binding.get(key, {})
    return v.get("value", "") if isinstance(v, dict) else ""


def fetch_deputes_wikipedia(photos_dir: Path | None = None) -> list[dict]:
    """
    Récupère les députés actuels depuis Wikidata avec photos et partis.
    Télécharge les photos dans photos_dir si fourni.
    """
    print("  → Requête Wikidata : députés actuels (P39 + P18 + P102)...")
    try:
        resp = get_session().get(
            SPARQL_ENDPOINT,
            params={"query": QUERY_DEPUTES, "format": "json"},
            headers=HEADERS,
            timeout=60,
        )
        resp.raise_for_status()
        bindings = resp.json().get("results", {}).get("bindings", [])
        print(f"    ✓ {len(bindings)} résultats Wikidata")
    except Exception as e:
        print(f"    ✗ Erreur Wikidata: {e}")
        cached = _load_cache()
        if cached:
            print(f"    ↻ Cache local utilisé ({len(cached)} députés)")
            return cached
        return []

    # Dédoublonner par QID et construire les résultats
    seen: set[str] = set()
    result: list[dict] = []
    nb_photos = 0

    for b in bindings:
        qid = _parse_value(b, "person").split("/")[-1]
        if not qid or qid in seen:
            continue
        seen.add(qid)

        name = _parse_value(b, "personLabel")
        if not name or name.startswith("Q"):
            continue

        image_url = _parse_value(b, "image")
        party = _parse_value(b, "partyLabel")
        if party and party.startswith("Q"):
            party = ""
        group = _parse_value(b, "groupLabel")
        if group and group.startswith("Q"):
            group = ""

        # Titre Wikipedia FR (pour le scraping des affaires)
        frwiki_url = _parse_value(b, "frwiki")
        frwiki_title = ""
        if frwiki_url:
            # URL format: https://fr.wikipedia.org/wiki/Titre_article
            frwiki_title = frwiki_url.split("/wiki/")[-1].replace("_", " ") if "/wiki/" in frwiki_url else ""

        # Télécharger la photo
        url_photo = ""
        if image_url and photos_dir:
            thumb = _commons_thumb_url(image_url)
            url_photo = _download_photo(thumb, qid, photos_dir)
            if url_photo:
                nb_photos += 1

        result.append({
            "wikidata_id": qid,
            "nom_complet": name,
            "groupe": group or party,  # Groupe parlementaire prioritaire sur parti
            "parti": party,
            "groupe_parlementaire": group,
            "frwiki_title": frwiki_title,
            "url_photo": url_photo,
            "url_fiche": f"https://www.wikidata.org/wiki/{qid}",
            "source": "wikidata",
        })

    print(f"    ✓ {len(result)} députés · {nb_photos} photos téléchargées")
    _save_cache(result)
    return result


def build_deputes_index(deputes: list[dict]) -> dict[str, dict | list[dict]]:
    """Index par nom normalisé pour jointure avec le RNE.

    Les clés de nom complet pointent directement vers un dict.
    Les clés de nom de famille seul pointent vers un dict si unique,
    ou None si collision (homonymes) pour éviter les faux positifs.
    """
    index: dict[str, dict | list[dict]] = {}
    # Tracking des collisions sur les noms de famille
    _family_keys: dict[str, list[dict]] = {}

    for dep in deputes:
        name = dep.get("nom_complet", "")
        if not name:
            continue
        # Index par nom complet : avec accents (lower) ET sans accents (normalisé)
        key_lower = name.lower().strip()
        key_norm = _normalise(name)
        index[key_lower] = dep
        index[key_norm] = dep
        # Collecter les noms de famille pour détecter les collisions
        for parts in (key_lower.split(), key_norm.split()):
            if len(parts) > 1:
                family = parts[-1]
                _family_keys.setdefault(family, []).append(dep)

    # Ajouter les noms de famille uniques (pas d'homonymes)
    for family, deps in _family_keys.items():
        if len(deps) == 1:
            index[family] = deps[0]
        # Si collision (plusieurs députés avec le même nom de famille),
        # on n'ajoute pas la clé pour éviter les faux positifs.

    return index


def _normalise(s: str) -> str:
    s = s.lower().strip()
    for k, v in {"é": "e", "è": "e", "ê": "e", "ë": "e",
                 "à": "a", "â": "a", "ä": "a",
                 "ù": "u", "û": "u", "ü": "u",
                 "î": "i", "ï": "i", "ô": "o", "ö": "o",
                 "ç": "c", "œ": "oe", "æ": "ae"}.items():
        s = s.replace(k, v)
    s = re.sub(r"[-'\s]+", " ", s).strip()
    return s
