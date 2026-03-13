"""
Enrichissement via Wikidata SPARQL :
Récupère les politiques français avec condamnations/affaires judiciaires documentées.
Endpoint : https://query.wikidata.org/sparql
Licence : CC0
"""

import time
import re
from typing import Generator

from sources.http_client import get_session

SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"
HEADERS = {
    "Accept": "application/sparql-results+json",
}

# Positions politiques françaises sur Wikidata
REQUETE_CONDAMNES = """
SELECT DISTINCT
  ?personne ?personneLabel
  ?dateNaissance ?lieuNaissanceLabel
  ?posteLabel
  ?infra ?infraLabel
  ?dateCondamnation
  ?parti ?partiLabel
  ?frwiki
WHERE {
  # Personnes ayant exercé un mandat politique en France
  ?personne p:P39 ?mandatStmt .
  ?mandatStmt ps:P39 ?poste .
  ?poste wdt:P17 wd:Q142 .           # Poste en France

  # Condamnées pour une infraction (P1399 = condamné pour) — via statement pour avoir le qualificatif de date
  ?personne p:P1399 ?condStmt .
  ?condStmt ps:P1399 ?infra .
  OPTIONAL { ?condStmt pq:P585 ?dateCondamnation }   # date de la condamnation

  OPTIONAL { ?personne wdt:P569 ?dateNaissance }
  OPTIONAL { ?personne wdt:P19 ?lieuNaissance }
  OPTIONAL { ?personne wdt:P102 ?parti }              # parti politique (P102)
  OPTIONAL {
    ?frwiki schema:about ?personne .
    ?frwiki schema:isPartOf <https://fr.wikipedia.org/> .
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "fr,en" .
  }
}
ORDER BY ?personneLabel
LIMIT 2000
"""

REQUETE_ACCUSATIONS = """
SELECT DISTINCT
  ?personne ?personneLabel
  ?dateNaissance
  ?posteLabel
  ?accusationLabel
  ?parti ?partiLabel
  ?frwiki
WHERE {
  # Mandats politiques en France
  ?personne p:P39 ?mandatStmt .
  ?mandatStmt ps:P39 ?poste .
  ?poste wdt:P17 wd:Q142 .

  # Accusations (P1415 = accusé de)
  ?personne wdt:P1415 ?accusation .

  OPTIONAL { ?personne wdt:P569 ?dateNaissance }
  OPTIONAL { ?personne wdt:P102 ?parti }              # parti politique (P102)
  OPTIONAL {
    ?frwiki schema:about ?personne .
    ?frwiki schema:isPartOf <https://fr.wikipedia.org/> .
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "fr,en" .
  }
}
ORDER BY ?personneLabel
LIMIT 2000
"""

REQUETE_AFFAIRES = """
SELECT DISTINCT
  ?affaire ?affaireLabel ?affaireDescription
  ?personne ?personneLabel
  ?dateDebut
  ?typeLabel
WHERE {
  # Affaires judiciaires / scandales politiques en France
  VALUES ?typeAffaire {
    wd:Q1198478   # scandale politique
    wd:Q3966212   # affaire judiciaire
    wd:Q1355340   # corruption
    wd:Q66010     # fraude
  }
  ?affaire wdt:P31 ?typeAffaire .
  ?affaire wdt:P17 wd:Q142 .          # En France

  # Personnes impliquées
  OPTIONAL { ?affaire wdt:P710 ?personne }     # P710 = participant
  OPTIONAL { ?affaire wdt:P1344 ?personne }    # P1344 = participant à
  OPTIONAL { ?affaire wdt:P580 ?dateDebut }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "fr,en" .
  }
}
ORDER BY DESC(?dateDebut)
LIMIT 300
"""


def requete_sparql(query: str, label: str) -> list[dict]:
    """Exécute une requête SPARQL sur Wikidata."""
    print(f"  → Requête Wikidata : {label}...")
    try:
        resp = get_session().get(
            SPARQL_ENDPOINT,
            params={"query": query, "format": "json"},
            headers=HEADERS,
            timeout=60,
        )
        resp.raise_for_status()
        data = resp.json()
        bindings = data.get("results", {}).get("bindings", [])
        print(f"    ✓ {len(bindings)} résultats")
        return bindings
    except Exception as e:
        print(f"    ✗ Erreur : {e}")
        return []


def parse_value(binding: dict, key: str) -> str:
    """Extrait une valeur d'un binding SPARQL."""
    v = binding.get(key, {})
    return v.get("value", "") if isinstance(v, dict) else ""


def fetch_politiques_condamnes() -> list[dict]:
    """
    Récupère les politiques français condamnés sur Wikidata.
    Regroupe TOUTES les infractions par personne (pas de déduplication prématurée).
    """
    time.sleep(1)

    # Index personne_id → entrée agrégée
    personnes: dict[str, dict] = {}

    # Requête 1 : condamnations directes (P1399)
    bindings = requete_sparql(REQUETE_CONDAMNES, "politiques condamnés (P1399)")
    for b in bindings:
        wd_id = parse_value(b, "personne").split("/")[-1]
        nom = parse_value(b, "personneLabel")
        if not nom or nom.startswith("Q"):
            continue

        infraction = parse_value(b, "infraLabel")
        date_raw = parse_value(b, "dateCondamnation")
        date_cond = date_raw[:10] if date_raw else ""

        parti_wd = parse_value(b, "partiLabel")
        # Ignorer les partis qui sont des IDs Wikidata non résolus
        if parti_wd and parti_wd.startswith("Q"):
            parti_wd = ""

        # Extraire le titre Wikipedia FR
        frwiki_url = parse_value(b, "frwiki")
        frwiki_title = ""
        if frwiki_url and "/wiki/" in frwiki_url:
            frwiki_title = frwiki_url.split("/wiki/")[-1].replace("_", " ")

        if wd_id not in personnes:
            personnes[wd_id] = {
                "wikidata_id": wd_id,
                "nom_complet": nom,
                "date_naissance": parse_value(b, "dateNaissance")[:10] if parse_value(b, "dateNaissance") else "",
                "lieu_naissance": parse_value(b, "lieuNaissanceLabel"),
                "poste": parse_value(b, "posteLabel"),
                "parti_wikidata": parti_wd,
                "frwiki_title": frwiki_title,
                "infractions": [],   # list of {"label": str, "date": str}
                "type": "condamnation",
                "source": "wikidata",
                "url_wikidata": f"https://www.wikidata.org/wiki/{wd_id}",
            }
        # Mettre à jour le parti si pas encore renseigné
        if parti_wd and not personnes[wd_id].get("parti_wikidata"):
            personnes[wd_id]["parti_wikidata"] = parti_wd
        if frwiki_title and not personnes[wd_id].get("frwiki_title"):
            personnes[wd_id]["frwiki_title"] = frwiki_title
        if infraction:
            labels_existants = {x["label"] for x in personnes[wd_id]["infractions"]}
            if infraction not in labels_existants:
                personnes[wd_id]["infractions"].append({"label": infraction, "date": date_cond})
            elif date_cond:
                # Mettre à jour la date si elle était vide
                for item in personnes[wd_id]["infractions"]:
                    if item["label"] == infraction and not item["date"]:
                        item["date"] = date_cond
        # Conserver le type le plus grave (condamnation > accusation)
        personnes[wd_id]["type"] = "condamnation"

    time.sleep(2)

    # Requête 2 : accusations (P1415) — ne surécrit pas si déjà condamné
    bindings2 = requete_sparql(REQUETE_ACCUSATIONS, "politiques accusés (P1415)")
    for b in bindings2:
        wd_id = parse_value(b, "personne").split("/")[-1]
        nom = parse_value(b, "personneLabel")
        if not nom or nom.startswith("Q"):
            continue

        infraction = parse_value(b, "accusationLabel")
        parti_wd = parse_value(b, "partiLabel")
        if parti_wd and parti_wd.startswith("Q"):
            parti_wd = ""

        # Extraire le titre Wikipedia FR
        frwiki_url = parse_value(b, "frwiki")
        frwiki_title = ""
        if frwiki_url and "/wiki/" in frwiki_url:
            frwiki_title = frwiki_url.split("/wiki/")[-1].replace("_", " ")

        if wd_id not in personnes:
            personnes[wd_id] = {
                "wikidata_id": wd_id,
                "nom_complet": nom,
                "date_naissance": parse_value(b, "dateNaissance")[:10] if parse_value(b, "dateNaissance") else "",
                "lieu_naissance": "",
                "poste": parse_value(b, "posteLabel"),
                "parti_wikidata": parti_wd,
                "frwiki_title": frwiki_title,
                "infractions": [],   # list of {"label": str, "date": str}
                "type": "accusation",
                "source": "wikidata",
                "url_wikidata": f"https://www.wikidata.org/wiki/{wd_id}",
            }
        # Mettre à jour le parti si pas encore renseigné
        if parti_wd and not personnes[wd_id].get("parti_wikidata"):
            personnes[wd_id]["parti_wikidata"] = parti_wd
        if frwiki_title and not personnes[wd_id].get("frwiki_title"):
            personnes[wd_id]["frwiki_title"] = frwiki_title
        if infraction:
            labels_existants = {x["label"] for x in personnes[wd_id]["infractions"]}
            if infraction not in labels_existants:
                personnes[wd_id]["infractions"].append({"label": infraction, "date": ""})
        # Ne pas dégrader condamnation → accusation
        if personnes[wd_id]["type"] != "condamnation":
            personnes[wd_id]["type"] = "accusation"

    # Ajouter champ "infraction" de compatibilité (labels concaténés)
    for p in personnes.values():
        labels = [x["label"] for x in p["infractions"]]
        p["infraction"] = " · ".join(labels) if labels else "Atteinte à la probité"

    resultats = list(personnes.values())
    print(f"    → {len(resultats)} politiques Wikidata (infractions agrégées)")
    return resultats


def normaliser_nom(s: str) -> str:
    """Normalise un nom pour comparaison."""
    s = s.lower().strip()
    for k, v in {"é":"e","è":"e","ê":"e","à":"a","â":"a","ù":"u","î":"i","ô":"o","ç":"c"}.items():
        s = s.replace(k, v)
    return re.sub(r"[^a-z\s]", " ", s).strip()


def construire_index_wikidata(politiques: list[dict]) -> dict[str, dict]:
    """Index nom normalisé → données Wikidata pour jointure."""
    index = {}
    for p in politiques:
        nom = p.get("nom_complet", "")
        if not nom:
            continue
        key = normaliser_nom(nom)
        index[key] = p
        # Aussi par nom de famille seul
        parts = key.split()
        if len(parts) > 1:
            index[parts[-1]] = p
    return index
