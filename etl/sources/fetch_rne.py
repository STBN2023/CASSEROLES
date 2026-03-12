"""
Télécharge et parse les fichiers CSV du Répertoire National des Élus (RNE)
Source : data.gouv.fr - Licence Ouverte v2.0
"""

import csv
import io
from typing import Generator

from sources.http_client import get_session

RNE_RESOURCES = {
    "deputes": "https://www.data.gouv.fr/api/1/datasets/r/1ac42ff4-1336-44f8-a221-832039dbc142",
    "senateurs": "https://www.data.gouv.fr/api/1/datasets/r/b78f8945-509f-4609-a4a7-3048b8370479",
    "eurodeputes": "https://www.data.gouv.fr/api/1/datasets/r/70957bb0-f19f-40c5-b97b-90b3d4d71f9e",
    "conseillers_regionaux": "https://www.data.gouv.fr/api/1/datasets/r/430e13f9-834b-4411-a1a8-da0b4b6e715c",
    "conseillers_departementaux": "https://www.data.gouv.fr/api/1/datasets/r/601ef073-d986-4582-8e1a-ed14dc857fba",
    "maires": "https://www.data.gouv.fr/api/1/datasets/r/2876a346-d50c-4911-934e-19ee07b0e503",
}

NIVEAU_MAP = {
    "deputes": "national",
    "senateurs": "national",
    "eurodeputes": "europeen",
    "conseillers_regionaux": "local",
    "conseillers_departementaux": "local",
    "maires": "local",
}

MANDAT_MAP = {
    "deputes": "Député(e)",
    "senateurs": "Sénateur/Sénatrice",
    "eurodeputes": "Eurodéputé(e)",
    "conseillers_regionaux": "Conseiller(ère) régional(e)",
    "conseillers_departementaux": "Conseiller(ère) départemental(e)",
    "maires": "Maire",
}


def fetch_rne_source(name: str, url: str) -> Generator[dict, None, None]:
    """Télécharge et parse un CSV du RNE."""
    print(f"  → Téléchargement {name}...")
    try:
        resp = get_session().get(url, timeout=30)
        resp.raise_for_status()
        # Détection encodage
        encoding = "utf-8"
        for enc in ("utf-8-sig", "latin-1", "utf-8"):
            try:
                resp.content.decode(enc)
                encoding = enc
                break
            except UnicodeDecodeError:
                continue

        content = resp.content.decode(encoding)
        reader = csv.DictReader(io.StringIO(content), delimiter=";")
        count = 0
        for row in reader:
            elu = parse_row(row, name)
            if elu:
                yield elu
                count += 1
        print(f"    ✓ {count} élus chargés depuis {name}")
    except Exception as e:
        print(f"    ✗ Erreur {name}: {e}")


def parse_row(row: dict, source: str) -> dict | None:
    """Normalise une ligne CSV du RNE en dict Elu."""
    # Les colonnes varient selon la source, on tente plusieurs noms
    nom = (
        row.get("Nom de l'élu")
        or row.get("Nom de l'elu")
        or row.get("Nom")
        or row.get("nom_elu")
        or ""
    ).strip()
    prenom = (
        row.get("Prénom de l'élu")
        or row.get("Prenom de l'elu")
        or row.get("Prénom")
        or row.get("prenom_elu")
        or ""
    ).strip()

    if not nom or not prenom:
        return None

    sexe = (row.get("Code sexe") or row.get("sexe") or "").strip()
    date_naissance = (row.get("Date de naissance") or row.get("date_naissance") or "").strip()
    parti = (
        row.get("Libellé de l'appartenance politique")
        or row.get("Libelle de l'appartenance politique")
        or row.get("appartenance_politique")
        or row.get("Nuance politique")
        or "Non renseigné"
    ).strip()

    territoire = (
        row.get("Libellé de la commune")
        or row.get("Libellé du département")
        or row.get("Libellé de la région")
        or row.get("libelle_commune")
        or row.get("libelle_departement")
        or ""
    ).strip()

    code_dept = (
        row.get("Code du département")
        or row.get("code_departement")
        or ""
    ).strip()

    elu_id = f"{source}_{nom}_{prenom}_{date_naissance}".lower().replace(" ", "_")

    return {
        "id": elu_id,
        "nom": nom,
        "prenom": prenom,
        "sexe": sexe,
        "date_naissance": date_naissance,
        "parti": normalise_parti(parti),
        "parti_brut": parti,
        "niveau": NIVEAU_MAP[source],
        "mandat": MANDAT_MAP[source],
        "territoire": territoire,
        "code_departement": code_dept,
        "source": "RNE",
        "affaires": [],
        "score": 0,
    }


PARTIS_NORM = {
    # ── Groupes parlementaires (sigles exacts) ─────────────────────────────
    "REN":   "Renaissance",
    "LIOT":  "Libertés, Indépendants, Outre-mer et Territoires",
    "RN":    "Rassemblement National",
    "LFI":   "La France Insoumise",
    "SOC":   "Parti Socialiste",
    "LR":    "Les Républicains",
    "MODEM": "MoDem",
    "HOR":   "Horizons",
    "GDR":   "Gauche démocrate et républicaine",
    "ECOLO": "Les Écologistes",
    "ECO":   "Les Écologistes",
    "NI":    "Non inscrit",
    "UDI":   "UDI",
    # ── Libellés RNE (texte long) ──────────────────────────────────────────
    "LREM":  "Renaissance",
    "La République En Marche": "Renaissance",
    "Rassemblement National":  "Rassemblement National",
    "La France Insoumise":     "La France Insoumise",
    "Parti Socialiste":        "Parti Socialiste",
    "Les Républicains":        "Les Républicains",
    "Europe Écologie":         "Les Écologistes",
    "Parti Communiste":        "Parti Communiste Français",
    # ── Nuances (codes courts) ─────────────────────────────────────────────
    "DVD": "Divers droite",
    "DVG": "Divers gauche",
    "DVC": "Divers centre",
    "DIV": "Divers",
    "SE":  "Sans étiquette",
    "FN":  "Rassemblement National",
    "UMP": "Les Républicains",
    "PCF": "Parti Communiste Français",
    "FI":  "La France Insoumise",
    "PS":  "Parti Socialiste",
    # ── Wikidata (P102 – noms complets des partis) ────────────────────────
    "Rassemblement pour la République": "RPR",
    "Union pour un mouvement populaire": "Les Républicains",
    "Union pour la démocratie française": "UDF",
    "Mouvement démocrate": "MoDem",
    "Les Écologistes – Europe Écologie Les Verts": "Les Écologistes",
    "Europe Écologie Les Verts": "Les Écologistes",
    "Rassemblement national": "Rassemblement National",
    "Parti socialiste": "Parti Socialiste",
    "La France insoumise": "La France Insoumise",
    "Parti communiste français": "Parti Communiste Français",
    "Rassemblement national de la jeunesse": "Rassemblement National",
    "Front national": "Rassemblement National",
    "Parti radical de gauche": "Parti radical de gauche",
    "Debout la France": "Debout la France",
    "Parti communiste réunionnais": "Parti Communiste Français",
    "groupe écologiste": "Les Écologistes",
    "Les Verts": "Les Écologistes",
    "divers gauche": "Divers gauche",
    "indépendant": "Non inscrit",
    "Les Centristes": "UDI",
    "Place publique": "Parti Socialiste",
}


def normalise_parti(parti_brut: str) -> str:
    """Normalise le libellé de parti."""
    p = parti_brut.strip()
    if not p or p == "Non renseigné":
        return "Autre / Non renseigné"
    # 1. Correspondance exacte (insensible à la casse)
    p_lower = p.lower()
    for key, norm in PARTIS_NORM.items():
        if key.lower() == p_lower:
            return norm
    # 2. Sous-chaîne uniquement pour les clés longues (≥ 4 caractères)
    for key, norm in PARTIS_NORM.items():
        if len(key) >= 4 and key.lower() in p_lower:
            return norm
    return p


def fetch_all() -> list[dict]:
    """Télécharge toutes les sources RNE."""
    elus = []
    seen_ids = set()
    for name, url in RNE_RESOURCES.items():
        for elu in fetch_rne_source(name, url):
            if elu["id"] not in seen_ids:
                seen_ids.add(elu["id"])
                elus.append(elu)
    return elus
