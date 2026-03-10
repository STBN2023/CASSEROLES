"""
Récupération des places et groupes parlementaires depuis assemblee-nationale.fr

Source : https://www.assemblee-nationale.fr/dyn/vos-deputes/hemicycle
- Le <select id="depute"> contient les 577 députés (value = numéro de place)
- Le SVG contient les <path class="place" id="pN"> avec style="fill: rgb(...);"
  dont la couleur identifie le groupe parlementaire officiel.

Cache local : etl/.cache/hemicycle_an.json
"""

import json
import re
import requests
from html.parser import HTMLParser
from pathlib import Path

HEMICYCLE_URL = "https://www.assemblee-nationale.fr/dyn/vos-deputes/hemicycle"

_CACHE_DIR = Path(__file__).parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "hemicycle_an.json"

# Mapping couleur SVG → groupe parlementaire officiel (XVIIe législature)
_COLOR_TO_GROUPE: dict[str, str] = {
    "rgb(131, 14, 33)":   "Gauche démocrate et républicaine",
    "rgb(192, 13, 13)":   "La France Insoumise",
    "rgb(245, 180, 206)": "Parti Socialiste",
    "rgb(119, 170, 121)": "Les Écologistes",
    "rgb(255, 217, 111)": "Libertés, Indépendants, Outre-mer et Territoires",
    "rgb(123, 69, 145)":  "Renaissance",
    "rgb(240, 126, 38)":  "MoDem",
    "rgb(181, 226, 249)": "Horizons",
    "rgb(140, 176, 220)": "Les Républicains",
    "rgb(51, 103, 167)":  "Union des Droites pour la République",
    "rgb(49, 53, 103)":   "Rassemblement National",
    "rgb(141, 148, 154)": "Non inscrit",
}


class _HemicycleParser(HTMLParser):
    """Parse le <select id="depute"> et les <path class="place"> du SVG."""

    def __init__(self):
        super().__init__()
        self._in_select = False
        self._in_option = False
        self._in_svg = False
        self._current_value = ""
        self._current_text = ""
        self.deputies: list[dict] = []
        self.seat_colors: dict[int, str] = {}  # place → couleur rgb(...)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        attr_dict = dict(attrs)
        if tag == "select" and attr_dict.get("id") == "depute":
            self._in_select = True
        elif tag == "option" and self._in_select:
            self._in_option = True
            self._current_value = attr_dict.get("value", "")
            self._current_text = ""
        elif tag == "svg":
            self._in_svg = True
        elif tag == "path" and self._in_svg:
            cls = attr_dict.get("class", "")
            pid = attr_dict.get("id", "")
            style = attr_dict.get("style", "")
            if "place" in cls and pid.startswith("p"):
                try:
                    num = int(pid[1:])
                    # Extraire fill: rgb(...) du style
                    m = re.search(r"fill:\s*(rgb\([^)]+\))", style)
                    if m:
                        self.seat_colors[num] = m.group(1)
                except ValueError:
                    pass

    def handle_endtag(self, tag: str):
        if tag == "option" and self._in_option:
            self._in_option = False
            name = self._current_text.strip()
            if self._current_value and name:
                try:
                    place = int(self._current_value)
                    self.deputies.append({"nom": name, "place": place})
                except ValueError:
                    pass
        elif tag == "select" and self._in_select:
            self._in_select = False
        elif tag == "svg" and self._in_svg:
            self._in_svg = False

    def handle_data(self, data: str):
        if self._in_option:
            self._current_text += data


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


def fetch_hemicycle_an() -> list[dict]:
    """
    Récupère le mapping nom → place + groupe depuis assemblee-nationale.fr.
    Retourne une liste de {"nom": str, "place": int, "groupe": str}.
    """
    print("  → Téléchargement places hémicycle (assemblee-nationale.fr)...")
    try:
        resp = requests.get(
            HEMICYCLE_URL,
            timeout=30,
            headers={"User-Agent": "Casseroles-ETL/1.0 (observatoire open-source)"},
        )
        resp.raise_for_status()
        html = resp.text

        parser = _HemicycleParser()
        parser.feed(html)
        deputies = parser.deputies

        if len(deputies) < 400:
            print(f"    ⚠ Seulement {len(deputies)} places trouvées, utilisation du cache")
            cached = _load_cache()
            if cached:
                print(f"    ↻ Cache local utilisé ({len(cached)} places)")
                return cached
            return deputies

        # Enrichir avec le groupe parlementaire via la couleur du siège
        nb_grouped = 0
        for dep in deputies:
            color = parser.seat_colors.get(dep["place"], "")
            groupe = _COLOR_TO_GROUPE.get(color, "")
            dep["groupe"] = groupe
            if groupe:
                nb_grouped += 1

        print(f"    ✓ {len(deputies)} places récupérées ({nb_grouped} avec groupe)")
        _save_cache(deputies)
        return deputies

    except Exception as e:
        print(f"    ✗ Erreur assemblee-nationale.fr: {e}")
        cached = _load_cache()
        if cached:
            print(f"    ↻ Cache local utilisé ({len(cached)} places)")
            return cached
        return []


def build_groupe_index(deputies: list[dict]) -> dict[str, str]:
    """
    Construit un index nom normalisé → groupe parlementaire pour jointure.
    """
    index: dict[str, str] = {}
    for dep in deputies:
        groupe = dep.get("groupe", "")
        if not groupe:
            continue
        name = dep["nom"]
        key_lower = name.lower().strip()
        key_norm = _normalise(name)
        index[key_lower] = groupe
        index[key_norm] = groupe
        # Nom de famille seul
        parts = key_norm.split()
        if len(parts) >= 2:
            index[parts[-1]] = groupe
            # Premier segment des noms composés
            if "-" in name.lower():
                for part in parts[1:]:
                    if "-" in part:
                        first_seg = part.split("-")[0]
                        short_key = " ".join(parts[:1]) + " " + first_seg
                        index[short_key] = groupe
                        index[first_seg] = groupe
    return index


def build_hemicycle_index(deputies: list[dict]) -> dict[str, int]:
    """
    Construit un index nom normalisé → numéro de place pour jointure.
    Les noms sont indexés sous plusieurs formes pour maximiser le matching.
    """
    index: dict[str, int] = {}
    for dep in deputies:
        name = dep["nom"]
        place = dep["place"]

        # Nom complet en minuscules
        key_lower = name.lower().strip()
        index[key_lower] = place

        # Nom sans accents et caractères spéciaux normalisés
        key_norm = _normalise(name)
        index[key_norm] = place

        # "Prénom Nom-Composé" → indexer aussi "prénom nom" (premier segment)
        parts = key_norm.split()
        if len(parts) >= 2:
            # Nom de famille complet (dernier mot)
            index[parts[-1]] = place
            # Si nom composé avec tiret, indexer aussi le premier segment
            # Ex: "abadie-amiel" → indexer "abadie"
            last = parts[-1]
            if "-" in name.lower():
                # Reconstruire prénom + premier segment du nom composé
                nom_parts = key_norm.split()
                for part in nom_parts[1:]:
                    if "-" in part:
                        first_seg = part.split("-")[0]
                        # "prénom premierSegment"
                        short_key = " ".join(nom_parts[:1]) + " " + first_seg
                        index[short_key] = place
                        index[first_seg] = place

    return index


def _normalise(s: str) -> str:
    s = s.lower().strip()
    for k, v in {
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "à": "a", "â": "a", "ä": "a",
        "ù": "u", "û": "u", "ü": "u",
        "î": "i", "ï": "i", "ô": "o", "ö": "o",
        "ç": "c", "œ": "oe", "æ": "ae",
    }.items():
        s = s.replace(k, v)
    # Normalise séparateurs : /, ', -, espaces → espace unique
    s = re.sub(r"[/'\-\s]+", " ", s).strip()
    return s
