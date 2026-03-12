"""
Télécharge et parse les affaires de Transparency International France (CSV)
Source : data.gouv.fr
URL CSV : https://www.data.gouv.fr/api/1/datasets/r/f5ce9054-06a4-46f6-bf36-fafe777d58a0

Colonnes du CSV :
  id, description, vie publique, personnes ou entités impliquées,
  date des faits, date de la condamnation, juridiction du jugement,
  lieu, département, région, références, tags,
  entités impliquées, infractions pertinentes
"""

import csv
import io
import re
import hashlib

from sources.http_client import get_session

from sources.extract_peines import extraire_peines

TI_URL = "https://www.data.gouv.fr/api/1/datasets/r/f5ce9054-06a4-46f6-bf36-fafe777d58a0"

TYPE_MAP = {
    "corruption": "Corruption",
    "favoritisme": "Favoritisme",
    "prise illégale": "Prise illégale d'intérêts",
    "prise illegale": "Prise illégale d'intérêts",
    "conflit d'intérêts": "Prise illégale d'intérêts",
    "détournement": "Détournement de fonds publics",
    "concussion": "Concussion",
    "trafic d'influence": "Trafic d'influence",
    "recel": "Recel",
    "fraude fiscale": "Fraude fiscale",
    "blanchiment": "Blanchiment",
    "abus de bien": "Abus de biens sociaux",
}


def fetch_ti() -> list[dict]:
    """Télécharge et parse le CSV des affaires TI France."""
    print("  → Téléchargement Transparency International France (CSV)...")
    try:
        resp = get_session().get(TI_URL, timeout=30)
        resp.raise_for_status()

        # Détection encodage
        content = None
        for enc in ("utf-8-sig", "utf-8", "latin-1"):
            try:
                content = resp.content.decode(enc)
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            print("    ✗ Impossible de décoder le CSV (aucun encodage compatible)")
            return []

        reader = csv.DictReader(io.StringIO(content), delimiter=",")
        affaires = []
        skipped = 0
        for row in reader:
            # Filtrer sur "vie publique" = oui pour ne garder que les élus/fonctionnaires
            vie_publique = row.get("vie publique", "").strip().lower()
            if vie_publique != "oui":
                skipped += 1
                continue
            affaire = parse_ti_row(row)
            if affaire:
                affaire["_vie_publique"] = True
                affaires.append(affaire)

        print(f"    ✓ {len(affaires)} affaires élus chargées depuis TI France ({skipped} non-élus ignorées)")
        return affaires
    except Exception as e:
        print(f"    ✗ Erreur TI France: {e}")
        return []


def parse_ti_row(row: dict) -> dict | None:
    """Normalise une ligne CSV TI en dict Affaire."""
    description = row.get("description", "").strip()
    if not description:
        return None

    personnes = row.get("personnes ou entités impliquées", "").strip()
    date_faits = row.get("date des faits", "").strip()
    date_condamnation = row.get("date de la condamnation", "").strip()
    juridiction = row.get("juridiction du jugement", "").strip()
    lieu = row.get("lieu", "").strip()
    departement = row.get("département", "").strip()
    region = row.get("région", "").strip()
    infractions = row.get("infractions pertinentes", "").strip()
    entites = row.get("entités impliquées", "").strip()
    tags = row.get("tags", "").strip()

    # Détecter statut à partir de la juridiction
    statut = detecter_statut(juridiction, description)

    # Détecter type d'affaire depuis les infractions
    type_affaire = detecter_type(infractions or description)

    # Extraire et nettoyer les noms depuis "personnes ou entités impliquées"
    noms = extraire_noms(personnes)
    # Version texte lisible (HTML nettoyé, sauts de ligne en séparateurs)
    personnes_clean = re.sub(r"<br\s*/?>", " · ", personnes, flags=re.IGNORECASE)
    personnes_clean = re.sub(r"<[^>]+>", "", personnes_clean).strip()

    # ID stable
    affaire_id = "ti_" + (row.get("id", "") or hashlib.md5(description[:100].encode()).hexdigest()[:12])

    # Extraction structurée des peines depuis la description
    peines = extraire_peines(description)

    return {
        "id": affaire_id,
        "type": type_affaire,
        "statut": statut,
        "date": date_condamnation or date_faits,
        "date_faits": date_faits,
        "date_condamnation": date_condamnation,
        "juridiction": juridiction,
        "lieu": lieu,
        "departement": departement,
        "region": region,
        "personnes": personnes_clean,
        "resume": re.sub(r"<[^>]+>", " ", re.sub(r"\s+", " ", description)).strip()[:500] + ("..." if len(description) > 500 else ""),
        "description_complete": re.sub(r"<[^>]+>", " ", re.sub(r"\s+", " ", description)).strip(),
        "infractions": [i.strip() for i in infractions.split(";") if i.strip()],
        "entites": [e.strip() for e in entites.split(";") if e.strip()],
        "tags": [t.strip() for t in tags.split(";") if t.strip()],
        "sources": ["https://transparency-france.org", TI_URL],
        "source_label": "Transparency International France",
        # Peines structurées (extraction best-effort)
        "peine_prison_ferme_mois": peines["peine_prison_ferme_mois"],
        "peine_prison_sursis_mois": peines["peine_prison_sursis_mois"],
        "amende_euros": peines["amende_euros"],
        "ineligibilite_mois": peines["ineligibilite_mois"],
        # Pour jointure (filtrés à la sauvegarde)
        "_personnes_brut": personnes,
        "_noms_extraits": noms,
    }


def detecter_statut(juridiction: str, description: str) -> str:
    """Détecte le statut judiciaire à partir du contexte."""
    j = juridiction.lower()
    d = description.lower()
    texte = j + " " + d
    if "relaxé" in texte or "acquitté" in texte or "relaxe" in texte:
        return "relaxe"
    if "classé" in texte and "suite" in texte:
        return "classe_sans_suite"
    if "cassation" in texte or "appel" in texte:
        return "condamnation"  # appel → jugement rendu
    if "première instance" in texte or "correctionnel" in texte or "assises" in texte:
        return "condamnation"
    if "mis en examen" in texte or "mise en examen" in texte:
        return "mise_en_examen"
    if "enquête" in texte or "garde à vue" in texte:
        return "enquete"
    return "condamnation"  # TI France recense principalement des condamnations


def detecter_type(texte: str) -> str:
    """Détecte le type d'affaire depuis les infractions."""
    texte_lower = texte.lower()
    for key, val in TYPE_MAP.items():
        if key in texte_lower:
            return val
    return "Atteinte à la probité"


def extraire_noms(personnes: str) -> list[str]:
    """Extrait les noms individuels depuis le champ 'personnes ou entités impliquées'."""
    if not personnes:
        return []
    # Nettoyage HTML
    personnes = re.sub(r"<[^>]+>", " ", personnes)
    # Split sur plusieurs séparateurs
    noms = re.split(r"[,;]|\bet\b|\bainsi que\b", personnes, flags=re.IGNORECASE)
    return [n.strip() for n in noms if n.strip() and len(n.strip()) > 2]
