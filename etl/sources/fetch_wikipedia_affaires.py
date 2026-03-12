"""
Scraping des affaires judiciaires depuis Wikipedia FR.

Pour chaque politicien dont le titre Wikipedia (frwiki_title) est connu,
on cherche les sections "Affaires judiciaires", "Condamnations",
"Controverses", etc. et on les transforme en objets Affaire compatibles
avec le reste du pipeline ETL.

Filtrage anti-faux-positifs en deux étapes :
  1. Le titre de section doit contenir un mot-clé judiciaire
     ET ne pas correspondre à un intitulé ministériel ou non-judiciaire.
  2. Le contenu de la section doit contenir un vocabulaire juridique
     significatif (tribunal, plainte, condamné, etc.).

Licence des données : CC BY-SA (Wikipédia)
"""

import time
import re
from html.parser import HTMLParser

from sources.http_client import get_session

WP_API = "https://fr.wikipedia.org/w/api.php"
WP_BASE = "https://fr.wikipedia.org/wiki/"

HEADERS = {
    "Accept": "application/json",
}

# ── Filtrage des titres de section ───────────────────────────────────────────

# Mots-clés POSITIFS dans le titre de section (au moins un requis)
SECTION_KEYWORDS = [
    "affaire judiciaire",
    "affaires judiciaires",
    "affaire juridique",
    "affaire pénale",
    "affaire de",            # "Affaire de la roseraie", "Affaire du PSG"
    "affaire du",
    "condamnation",
    "mise en examen",
    "procès",
    "poursuites",
    "perquisition",
    "controverse",
    "polémique",
    "scandale",
]

# Motifs NÉGATIFS : si le titre de section matche un de ces patterns, on l'exclut
# (faux positifs courants : noms de ministères, postes, etc.)
SECTION_EXCLUDES = [
    "affaires étrangères",
    "affaires européennes",
    "affaires sociales",
    "affaires culturelles",
    "affaires économiques",
    "affaires intérieures",
    "affaires religieuses",
    "affaires courantes",
    "affaires locales",
    "affaires municipales",
    "affaires rurales",
    "chargé des affaires",    # "Chargé des affaires européennes"
    "secrétaire d'état",
    "secrétariat",
    "au ministère",
    "au gouvernement",
    "aux affaires",           # "Aux Affaires étrangères"
    "à l'assemblée",
    "au sénat",
    "carrière",
    "parcours",
    "biographie",
    "vie privée",
    "vie personnelle",
    "œuvres",
    "publications",
    "bibliographie",
    "distinctions",
    "honneurs",
    "mandats",
    "fonctions",
    "élections",
    "résultats électoraux",
]

# ── Vocabulaire juridique (validation du contenu) ────────────────────────────

# Au moins N de ces termes doivent apparaître dans le texte pour confirmer
# qu'il s'agit bien d'un contenu judiciaire (et pas d'une simple polémique médiatique)
VOCABULAIRE_JURIDIQUE = [
    # Procédure
    "tribunal", "justice", "judiciaire", "procureur", "procureure",
    "avocat", "avocate", "plainte", "garde à vue", "perquisition",
    "instruction", "enquête préliminaire", "enquête judiciaire",
    "information judiciaire", "parquet", "juridiction", "audience",
    "comparution", "citation directe",
    # Statuts
    "mis en examen", "mise en examen", "inculpé", "inculpée",
    "prévenu", "prévenue", "accusé", "accusée",
    "poursuivi", "poursuivie", "renvoyé en jugement", "renvoyée en jugement",
    # Issues
    "condamné", "condamnée", "condamnation", "reconnu coupable",
    "reconnue coupable", "coupable", "relaxé", "relaxée", "relaxe",
    "acquitté", "acquittée", "acquittement", "non-lieu",
    "classé sans suite", "classée sans suite",
    # Peines
    "peine", "prison", "prison ferme", "sursis", "amende",
    "inéligibilité", "interdiction", "travaux d'intérêt général",
    "bracelet électronique", "contrôle judiciaire",
    # Infractions
    "détournement", "corruption", "fraude", "abus de biens sociaux",
    "abus de confiance", "favoritisme", "prise illégale d'intérêt",
    "concussion", "trafic d'influence", "recel",
    "harcèlement", "agression", "viol", "violence",
    "diffamation", "injure", "faux et usage de faux",
    "blanchiment", "évasion fiscale", "fraude fiscale",
    "financement illégal", "emploi fictif", "emplois fictifs",
]

# Seuil minimum de termes juridiques dans le texte
SEUIL_TERMES_JURIDIQUES = 2

# ── Indicateurs de statut ────────────────────────────────────────────────────

MOTS_CONDAMNATION = [
    "condamné", "condamnée", "condamnation définitive",
    "reconnu coupable", "reconnue coupable",
    "peine de prison", "prison ferme",
    "cour d'appel a confirmé", "cour de cassation a rejeté",
    "déclaré coupable", "déclarée coupable",
]

MOTS_MEX = [
    "mis en examen", "mise en examen",
    "renvoyé en jugement", "renvoyée en jugement",
    "renvoyé devant le tribunal", "renvoyée devant le tribunal",
    "inculpé", "inculpée",
    "poursuivi pour", "poursuivie pour",
]


# ── Utilitaires HTML ─────────────────────────────────────────────────────────

class _HTMLStripper(HTMLParser):
    """Extrait le texte brut depuis du HTML."""

    def __init__(self):
        super().__init__()
        self.reset()
        self._fed: list[str] = []

    def handle_data(self, d: str) -> None:
        self._fed.append(d)

    def get_data(self) -> str:
        return " ".join(self._fed)


def _strip_html(html: str) -> str:
    # Supprimer les headings (h1-h6) qui répètent le titre de section + liens [modifier]
    html = re.sub(r'<h[1-6][^>]*>.*?</h[1-6]>', '', html, flags=re.DOTALL)
    # Supprimer les spans "mw-editsection" (liens [modifier]) au cas où
    html = re.sub(r'<span class="mw-editsection">.*?</span>', '', html, flags=re.DOTALL)
    s = _HTMLStripper()
    s.feed(html)
    text = s.get_data()
    # Nettoyer les artefacts wiki résiduels
    text = re.sub(r"\[?\s*modifier\s*\|\s*modifier le code\s*\]?", "", text)
    text = re.sub(r"\[?\s*modifier\s*\]?", "", text)
    text = re.sub(r"\[\s*\d+\s*\]", "", text)  # références [1], [2], etc.
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ── API Wikipedia ────────────────────────────────────────────────────────────

def _get_sections(title: str) -> list[dict]:
    """Récupère la table des matières d'un article Wikipedia."""
    try:
        resp = get_session().get(
            WP_API,
            params={
                "action": "parse",
                "page": title,
                "prop": "sections",
                "format": "json",
            },
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json().get("parse", {}).get("sections", [])
    except Exception:
        pass
    return []


def _get_section_text(title: str, section_index: int) -> str:
    """Récupère le texte brut d'une section donnée."""
    try:
        resp = get_session().get(
            WP_API,
            params={
                "action": "parse",
                "page": title,
                "section": section_index,
                "prop": "text",
                "format": "json",
            },
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            html = resp.json().get("parse", {}).get("text", {}).get("*", "")
            return _strip_html(html)
    except Exception:
        pass
    return ""


# ── Filtrage ─────────────────────────────────────────────────────────────────

def _is_judicial_section(section_title: str) -> bool:
    """
    Vérifie si un titre de section correspond à une rubrique judiciaire.
    Niveau 1 : mot-clé positif requis + aucun motif d'exclusion.
    """
    lower = section_title.lower()

    # Exclure d'abord les faux positifs connus
    if any(excl in lower for excl in SECTION_EXCLUDES):
        return False

    # Vérifier la présence d'un mot-clé judiciaire
    return any(kw in lower for kw in SECTION_KEYWORDS)


def _contient_vocabulaire_juridique(text: str) -> bool:
    """
    Niveau 2 : vérifie que le contenu contient un nombre suffisant
    de termes juridiques pour confirmer qu'il s'agit d'une affaire réelle.
    """
    lower = text.lower()
    nb = sum(1 for terme in VOCABULAIRE_JURIDIQUE if terme in lower)
    return nb >= SEUIL_TERMES_JURIDIQUES


def _detect_statut(text: str) -> str:
    """Déduit le statut judiciaire le plus grave depuis le texte."""
    lower = text.lower()
    if any(m in lower for m in MOTS_CONDAMNATION):
        return "condamnation"
    if any(m in lower for m in MOTS_MEX):
        return "mise_en_examen"
    return "enquete"


# ── Fetch principal ──────────────────────────────────────────────────────────

def fetch_affaires_wikipedia(personnes: list[dict]) -> list[dict]:
    """
    Scrape Wikipedia FR pour chaque personne disposant d'un frwiki_title.

    Paramètres
    ----------
    personnes : list[dict]
        Chaque entrée doit contenir au moins :
          - "frwiki_title" : titre de l'article Wikipedia FR
          - "nom_complet" OU ("prenom" + "nom")
          - "wikidata_id"  (optionnel, utilisé pour la jointure gouvernement)

    Retourne une liste d'affaires au format standard du pipeline ETL.
    """
    affaires: list[dict] = []
    vus: set[str] = set()

    for p in personnes:
        frwiki_title = p.get("frwiki_title", "")
        if not frwiki_title or frwiki_title in vus:
            continue
        vus.add(frwiki_title)

        nom_complet = (
            p.get("nom_complet")
            or f"{p.get('prenom', '')} {p.get('nom', '')}".strip()
        )
        wikidata_id = p.get("wikidata_id", "")

        print(f"    Wikipedia → {nom_complet} ({frwiki_title})")

        time.sleep(0.5)
        sections = _get_sections(frwiki_title)

        # Niveau 1 : filtrage par titre de section
        judicial_sections = [
            s for s in sections if _is_judicial_section(s.get("line", ""))
        ]

        if not judicial_sections:
            print(f"      — aucune section judiciaire")
            continue

        nb_rejetees = 0
        for sec in judicial_sections:
            sec_title = sec.get("line", "Section")
            sec_index = sec.get("index", "")
            if not sec_index:
                continue

            # sec_index peut être "2.1.3" pour les sous-sections
            try:
                sec_index_int = int(sec_index)
            except (ValueError, TypeError):
                continue

            time.sleep(0.3)
            text = _get_section_text(frwiki_title, sec_index_int)
            if not text or len(text) < 50:
                continue

            # Niveau 2 : validation du contenu juridique
            if not _contient_vocabulaire_juridique(text):
                nb_rejetees += 1
                print(f"      ✗ [{sec_title}] rejeté (pas de vocabulaire juridique)")
                continue

            statut = _detect_statut(text)
            resume = text[:400] + ("…" if len(text) > 400 else "")

            # ID déterministe (stable entre deux runs)
            safe_nom = re.sub(r"[^a-z0-9]", "_", nom_complet.lower())
            safe_title = re.sub(r"[^a-z0-9]", "_", sec_title.lower())
            affaire_id = f"wiki_{safe_nom}_{safe_title}"

            affaires.append(
                {
                    "id": affaire_id,
                    "type": sec_title,
                    "statut": statut,
                    "date": "",
                    "date_faits": "",
                    "date_condamnation": "",
                    "juridiction": "",
                    "lieu": "",
                    "departement": "",
                    "region": "",
                    "personnes": nom_complet,
                    "resume": resume,
                    "description_complete": text[:1500] + ("…" if len(text) > 1500 else ""),
                    "infractions": [sec_title],
                    "entites": [],
                    "tags": ["wikipedia"],
                    "sources": [f"{WP_BASE}{frwiki_title.replace(' ', '_')}"],
                    "source_label": "Wikipedia",
                    "peine_prison_ferme_mois": None,
                    "peine_prison_sursis_mois": None,
                    "amende_euros": None,
                    "ineligibilite_mois": None,
                    "_nom_complet_wd": nom_complet,
                    "_wikidata_id": wikidata_id,
                }
            )
            print(f"      ✓ [{statut}] {sec_title}")

        if nb_rejetees and not any(
            a["_nom_complet_wd"] == nom_complet for a in affaires
        ):
            print(f"      — {nb_rejetees} section(s) rejetée(s), aucune affaire retenue")

    return affaires
