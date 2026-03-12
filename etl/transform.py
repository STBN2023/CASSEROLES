"""
Jointure élus ↔ affaires, calcul des scores de probité.
Génère les fichiers JSON finaux dans public/data/.
"""

import json
import re
from pathlib import Path


def normalise_nom(s: str) -> str:
    """Normalise un nom pour comparaison : minuscules, sans accents, sans tirets."""
    s = s.lower().strip()
    replacements = {
        "é": "e", "è": "e", "ê": "e", "ë": "e",
        "à": "a", "â": "a", "ä": "a",
        "ù": "u", "û": "u", "ü": "u",
        "î": "i", "ï": "i",
        "ô": "o", "ö": "o",
        "ç": "c", "œ": "oe", "æ": "ae",
    }
    for k, v in replacements.items():
        s = s.replace(k, v)
    s = re.sub(r"[-'\s]+", " ", s).strip()
    return s


def calculer_score(affaires: list[dict]) -> int:
    """
    Score de probité :
    3 = condamnation définitive
    2 = mise en examen / renvoi en procès
    1 = enquête documentée
    0 = aucune affaire
    """
    if not affaires:
        return 0
    statuts = {a["statut"] for a in affaires}
    if "condamnation" in statuts:
        return 3
    if "mise_en_examen" in statuts:
        return 2
    if "enquete" in statuts:
        return 1
    return 0


def convertir_wikidata_en_affaires(politiques_wd: list[dict]) -> list[dict]:
    """
    Convertit les entrées Wikidata en objets Affaire.
    Une affaire par infraction (permet d'avoir diffamation ET détournement séparément).
    """
    affaires = []
    for p in politiques_wd:
        if p.get("type") not in ("condamnation", "accusation"):
            continue
        nom = p.get("nom_complet", "")
        if not nom:
            continue

        statut = "condamnation" if p["type"] == "condamnation" else "mise_en_examen"
        poste = p.get("poste", "")
        wikidata_id = p.get("wikidata_id", "")
        url_wd = p.get("url_wikidata", "")
        infractions_liste = p.get("infractions") or [p.get("infraction", "Atteinte à la probité")]

        for i, inf_item in enumerate(infractions_liste):
            # inf_item peut être un dict {"label": ..., "date": ...} ou une string (fallback)
            if isinstance(inf_item, dict):
                infraction = inf_item.get("label", "")
                date_cond = inf_item.get("date", "")
            else:
                infraction = str(inf_item)
                date_cond = ""
            if not infraction:
                continue
            # ID unique par (personne, infraction)
            affaire_id = f"wd_{wikidata_id}_{i}"
            annee = date_cond[:4] if date_cond else ""
            affaires.append({
                "id": affaire_id,
                "type": infraction,
                "statut": statut,
                "date": date_cond,
                "date_faits": "",
                "date_condamnation": date_cond,
                "juridiction": "",
                "lieu": "",
                "departement": "",
                "region": "",
                "personnes": nom,
                "resume": f"{nom}{' (' + poste + ')' if poste else ''} : {infraction}{' (' + annee + ')' if annee else ''}.",
                "description_complete": f"{nom}{' (' + poste + ')' if poste else ''} : {infraction}{' (' + annee + ')' if annee else ''}.",
                "infractions": [infraction],
                "entites": [poste] if poste else [],
                "tags": ["wikidata"],
                "sources": [url_wd],
                "source_label": "Wikidata",
                # Pas de données de peines dans Wikidata
                "peine_prison_ferme_mois": None,
                "peine_prison_sursis_mois": None,
                "amende_euros": None,
                "ineligibilite_mois": None,
                "_nom_complet_wd": nom,
                "_wikidata_id": wikidata_id,
                "_date_naissance_wd": p.get("date_naissance", ""),
            })
    return affaires


def enrichir_affaires_wikidata(affaires: list[dict], politiques_wd: list[dict]) -> tuple[list[dict], int]:
    """
    Crée des affaires depuis Wikidata et les ajoute à la liste.
    Retourne (affaires_totales, nb_nouvelles).
    """
    nouvelles = convertir_wikidata_en_affaires(politiques_wd)
    # Dédoublonnage par id
    ids_existants = {a["id"] for a in affaires}
    a_ajouter = [a for a in nouvelles if a["id"] not in ids_existants]
    affaires.extend(a_ajouter)
    return affaires, len(a_ajouter)


# Anciennes régions → nouvelles régions (fusion 2016)
REGIONS_NORM = {
    # Anciennes régions métropolitaines
    "Alsace": "Grand Est",
    "Champagne-Ardenne": "Grand Est",
    "Lorraine": "Grand Est",
    "Aquitaine": "Nouvelle-Aquitaine",
    "Limousin": "Nouvelle-Aquitaine",
    "Poitou-Charentes": "Nouvelle-Aquitaine",
    "Auvergne": "Auvergne-Rhône-Alpes",
    "Rhône-Alpes": "Auvergne-Rhône-Alpes",
    "Bourgogne": "Bourgogne-Franche-Comté",
    "Franche-Comté": "Bourgogne-Franche-Comté",
    "Languedoc-Roussillon": "Occitanie",
    "Midi-Pyrénées": "Occitanie",
    "Basse-Normandie": "Normandie",
    "Haute-Normandie": "Normandie",
    "Nord-Pas-de-Calais": "Hauts-de-France",
    "Picardie": "Hauts-de-France",
    "Nord-Pas-de-Calais Picardie": "Hauts-de-France",
    # Noms transitionnels (intermédiaires entre ancien et nouveau découpage)
    "Aquitaine Limousin Poitou-Charentes": "Nouvelle-Aquitaine",
    "Alsace-Champagne-Ardenne-Lorraine": "Grand Est",
    "Languedoc-Roussillon Midi-Pyrénées": "Occitanie",
    "Centre": "Centre-Val de Loire",
    # Variantes sans tirets (données TI France)
    "Auvergne Rhône-Alpes": "Auvergne-Rhône-Alpes",
    "Bourgogne Franche-Comté": "Bourgogne-Franche-Comté",
    "Centre Val de Loire": "Centre-Val de Loire",
    "Haute Normandie": "Normandie",
    "Languedoc Roussillon": "Occitanie",
    # Outre-mer – villes/communes → région
    "Basse-Terre": "Guadeloupe",
    "Pointe-à-Pitre": "Guadeloupe",
    "Cayenne": "Guyane",
    "Saint Laurent du Maroni": "Guyane",
    "Fort-de-France": "Martinique",
    "Mamoudzou": "Mayotte",
    "Dzaoudzi": "Mayotte",
    "Saint Denis": "La Réunion",
    "Saint Benoit": "La Réunion",
    "Saint-Paul": "La Réunion",
    "Saint Pierre": "La Réunion",
    "Saint-Pierre": "La Réunion",
    "Réunion": "La Réunion",
    # Polynésie / Nouvelle-Calédonie
    "Polynésie Française": "Polynésie française",
    "Îles du Vent": "Polynésie française",
    "Îles Australes": "Polynésie française",
    "Province Sud": "Nouvelle-Calédonie",
}


def normalise_region(r: str) -> str:
    """Normalise un nom de région vers les régions actuelles (post-2016)."""
    if not r:
        return ""
    r = r.strip()
    return REGIONS_NORM.get(r, r)


# Correspondance code département → région (métropole + DOM)
DEPT_REGION = {
    "01":"Auvergne-Rhône-Alpes","03":"Auvergne-Rhône-Alpes","07":"Auvergne-Rhône-Alpes",
    "15":"Auvergne-Rhône-Alpes","26":"Auvergne-Rhône-Alpes","38":"Auvergne-Rhône-Alpes",
    "42":"Auvergne-Rhône-Alpes","43":"Auvergne-Rhône-Alpes","63":"Auvergne-Rhône-Alpes",
    "69":"Auvergne-Rhône-Alpes","73":"Auvergne-Rhône-Alpes","74":"Auvergne-Rhône-Alpes",
    "21":"Bourgogne-Franche-Comté","25":"Bourgogne-Franche-Comté","39":"Bourgogne-Franche-Comté",
    "58":"Bourgogne-Franche-Comté","70":"Bourgogne-Franche-Comté","71":"Bourgogne-Franche-Comté",
    "89":"Bourgogne-Franche-Comté","90":"Bourgogne-Franche-Comté",
    "22":"Bretagne","29":"Bretagne","35":"Bretagne","56":"Bretagne",
    "18":"Centre-Val de Loire","28":"Centre-Val de Loire","36":"Centre-Val de Loire",
    "37":"Centre-Val de Loire","41":"Centre-Val de Loire","45":"Centre-Val de Loire",
    "2A":"Corse","2B":"Corse",
    "08":"Grand Est","10":"Grand Est","51":"Grand Est","52":"Grand Est",
    "54":"Grand Est","55":"Grand Est","57":"Grand Est","67":"Grand Est","68":"Grand Est","88":"Grand Est",
    "02":"Hauts-de-France","59":"Hauts-de-France","60":"Hauts-de-France","62":"Hauts-de-France","80":"Hauts-de-France",
    "75":"Île-de-France","77":"Île-de-France","78":"Île-de-France","91":"Île-de-France",
    "92":"Île-de-France","93":"Île-de-France","94":"Île-de-France","95":"Île-de-France",
    "14":"Normandie","27":"Normandie","50":"Normandie","61":"Normandie","76":"Normandie",
    "16":"Nouvelle-Aquitaine","17":"Nouvelle-Aquitaine","19":"Nouvelle-Aquitaine","23":"Nouvelle-Aquitaine",
    "24":"Nouvelle-Aquitaine","33":"Nouvelle-Aquitaine","40":"Nouvelle-Aquitaine","47":"Nouvelle-Aquitaine",
    "64":"Nouvelle-Aquitaine","79":"Nouvelle-Aquitaine","86":"Nouvelle-Aquitaine","87":"Nouvelle-Aquitaine",
    "09":"Occitanie","11":"Occitanie","12":"Occitanie","30":"Occitanie","31":"Occitanie",
    "32":"Occitanie","34":"Occitanie","46":"Occitanie","48":"Occitanie","65":"Occitanie",
    "66":"Occitanie","81":"Occitanie","82":"Occitanie",
    "44":"Pays de la Loire","49":"Pays de la Loire","53":"Pays de la Loire",
    "72":"Pays de la Loire","85":"Pays de la Loire",
    "04":"Provence-Alpes-Côte d'Azur","05":"Provence-Alpes-Côte d'Azur","06":"Provence-Alpes-Côte d'Azur",
    "13":"Provence-Alpes-Côte d'Azur","83":"Provence-Alpes-Côte d'Azur","84":"Provence-Alpes-Côte d'Azur",
    "971":"Guadeloupe","972":"Martinique","973":"Guyane","974":"La Réunion","976":"Mayotte",
}


def _parse_date_naissance(date_str: str) -> str | None:
    """Normalise une date de naissance en YYYY-MM-DD, quel que soit le format d'entrée."""
    if not date_str:
        return None
    # Format RNE : DD/MM/YYYY
    if "/" in date_str:
        parts = date_str.split("/")
        if len(parts) == 3 and len(parts[2]) == 4:
            return f"{parts[2]}-{parts[1]}-{parts[0]}"
    # Format Wikidata : YYYY-MM-DD (déjà bon)
    if len(date_str) >= 10 and date_str[4] == "-":
        return date_str[:10]
    return None


def _dates_compatibles(date_wd: str, date_rne: str) -> bool:
    """
    Vérifie si deux dates de naissance sont compatibles (même année ± 1 an).
    Retourne True si l'une des deux est absente (pas de données = pas de rejet).
    """
    d1 = _parse_date_naissance(date_wd)
    d2 = _parse_date_naissance(date_rne)
    if not d1 or not d2:
        return True  # pas assez de données pour rejeter
    try:
        annee_wd = int(d1[:4])
        annee_rne = int(d2[:4])
        return abs(annee_wd - annee_rne) <= 1
    except (ValueError, IndexError):
        return True


def joindre_affaires(elus: list[dict], affaires: list[dict]) -> list[dict]:
    """
    Tente de relier chaque affaire à un élu du RNE par correspondance nom/prénom.
    Wikidata : correspondance exacte prénom+nom + vérification date de naissance.
    TI France : correspondance exacte prénom+nom, puis fallback nom seul.
    Enrichit aussi les affaires Wikidata sans géographie avec le département/région de l'élu.
    """
    # Index des élus par nom normalisé
    elu_index_full: dict[str, list[int]] = {}
    elu_index_nom: dict[str, list[int]] = {}
    for i, elu in enumerate(elus):
        key_full = f"{normalise_nom(elu['prenom'])} {normalise_nom(elu['nom'])}"
        key_nom = normalise_nom(elu["nom"])
        elu_index_full.setdefault(key_full, []).append(i)
        elu_index_nom.setdefault(key_nom, []).append(i)

    affaires_par_elu: dict[str, list[str]] = {elu["id"]: [] for elu in elus}
    affaires_orphelines = []

    for affaire in affaires:
        matched = None

        # Cas 1 : affaire Wikidata (nom complet disponible)
        # Correspondance stricte prénom+nom + vérification date de naissance
        # pour éviter les faux positifs (ex: François Fillon PM ≠ François Fillon maire)
        nom_complet_wd = affaire.get("_nom_complet_wd", "")
        date_naissance_wd = affaire.get("_date_naissance_wd", "")
        if nom_complet_wd:
            key_full = normalise_nom(nom_complet_wd)
            candidates = elu_index_full.get(key_full)
            if candidates:
                # Filtrer par date de naissance si disponible
                if date_naissance_wd:
                    candidates = [
                        idx for idx in candidates
                        if _dates_compatibles(date_naissance_wd, elus[idx].get("date_naissance", ""))
                    ]
                if len(candidates) == 1:
                    matched = candidates
                elif len(candidates) > 1:
                    # Homonymes restants : vérifier si même personne (mandats multiples)
                    dobs = {elus[idx].get("date_naissance", "") for idx in candidates}
                    if len(dobs) == 1:
                        matched = candidates
                    # Sinon : personnes différentes, trop ambigu → pas de match

        # Cas 2 : affaire TI (champs _nom_condamne / _prenom_condamne)
        if not matched:
            nom = affaire.get("_nom_condamne", "")
            prenom = affaire.get("_prenom_condamne", "")
            if nom:
                key_full = f"{normalise_nom(prenom)} {normalise_nom(nom)}"
                key_nom = normalise_nom(nom)
                matched = elu_index_full.get(key_full) or elu_index_nom.get(key_nom)

        if matched:
            for idx in matched:
                elu_id = elus[idx]["id"]
                if affaire["id"] not in affaires_par_elu[elu_id]:
                    affaires_par_elu[elu_id].append(affaire["id"])

            # Enrichir la géographie des affaires Wikidata sans région
            if not affaire.get("region") and matched:
                elu_ref = elus[matched[0]]
                code_dept = elu_ref.get("code_departement", "")
                territoire = elu_ref.get("territoire", "")
                if code_dept:
                    affaire["departement"] = territoire or code_dept
                    affaire["region"] = DEPT_REGION.get(code_dept, "")
        else:
            affaires_orphelines.append(affaire)

    # Appliquer les affaires aux élus et calculer les scores
    for elu in elus:
        elu["affaires"] = affaires_par_elu.get(elu["id"], [])
        affaires_elu = [a for a in affaires if a["id"] in elu["affaires"]]
        elu["score"] = calculer_score(affaires_elu)
        elu["nb_affaires"] = len(elu["affaires"])

    return elus, affaires_orphelines


def calculer_stats(elus: list[dict], affaires: list[dict]) -> dict:
    """Calcule les statistiques globales pour le dashboard."""
    elus_avec_affaires = [e for e in elus if e["nb_affaires"] > 0]

    # Compter les affaires par statut (pas les élus par score !)
    nb_condamnations = sum(1 for a in affaires if a.get("statut") == "condamnation")
    nb_mises_en_examen = sum(1 for a in affaires if a.get("statut") == "mise_en_examen")
    nb_enquetes = sum(1 for a in affaires if a.get("statut") == "enquete")
    nb_relaxes = sum(1 for a in affaires if a.get("statut") == "relaxe")
    nb_classes = sum(1 for a in affaires if a.get("statut") == "classe_sans_suite")

    # Élus par score (pour info complémentaire)
    nb_elus_condamnes = sum(1 for e in elus if e["score"] == 3)
    nb_elus_mis_en_examen = sum(1 for e in elus if e["score"] == 2)
    nb_elus_enquetes = sum(1 for e in elus if e["score"] == 1)

    # Répartition par parti
    partis: dict[str, dict] = {}
    for elu in elus_avec_affaires:
        p = elu["parti"]
        if p not in partis:
            partis[p] = {"nom": p, "nb_elus": 0, "nb_affaires": 0, "nb_condamnations": 0}
        partis[p]["nb_elus"] += 1
        partis[p]["nb_affaires"] += elu["nb_affaires"]
        if elu["score"] == 3:
            partis[p]["nb_condamnations"] += 1

    # Répartition par niveau
    niveaux: dict[str, int] = {}
    for elu in elus_avec_affaires:
        niveaux[elu["niveau"]] = niveaux.get(elu["niveau"], 0) + 1

    # Top 10 partis par nb d'affaires
    top_partis = sorted(partis.values(), key=lambda x: x["nb_affaires"], reverse=True)[:10]

    # Agrégats peines
    total_amendes = sum(a.get("amende_euros") or 0 for a in affaires)
    nb_avec_prison = sum(1 for a in affaires if a.get("peine_prison_ferme_mois") or a.get("peine_prison_sursis_mois"))
    nb_avec_amende = sum(1 for a in affaires if a.get("amende_euros"))
    nb_avec_ineligibilite = sum(1 for a in affaires if a.get("ineligibilite_mois"))

    # Ventilation par source
    nb_affaires_personnes = sum(1 for a in affaires if a.get("source_label") in ("Wikidata", "Wikipedia"))
    nb_affaires_geographiques = sum(1 for a in affaires if a.get("source_label") not in ("Wikidata", "Wikipedia"))

    # Affaires effectivement liées à un élu RNE
    elu_affaire_ids = set()
    for elu in elus:
        elu_affaire_ids.update(elu.get("affaires", []))
    nb_affaires_matchees = len(elu_affaire_ids)

    return {
        "nb_elus_total": len(elus),
        "nb_elus_concernes": len(elus_avec_affaires),
        "nb_affaires_total": len(affaires),
        "nb_affaires_personnes": nb_affaires_personnes,
        "nb_affaires_geographiques": nb_affaires_geographiques,
        "nb_affaires_matchees": nb_affaires_matchees,
        "nb_condamnations": nb_condamnations,
        "nb_mises_en_examen": nb_mises_en_examen,
        "nb_enquetes": nb_enquetes,
        "nb_relaxes": nb_relaxes,
        "nb_classes_sans_suite": nb_classes,
        "nb_elus_condamnes": nb_elus_condamnes,
        "nb_elus_mis_en_examen": nb_elus_mis_en_examen,
        "nb_elus_enquetes": nb_elus_enquetes,
        "repartition_niveaux": niveaux,
        "repartition_partis": top_partis,
        "total_amendes_euros": total_amendes,
        "nb_avec_prison": nb_avec_prison,
        "nb_avec_amende": nb_avec_amende,
        "nb_avec_ineligibilite": nb_avec_ineligibilite,
        "derniere_maj": __import__("datetime").date.today().isoformat(),
        "sources": ["RNE", "Transparency International France", "Wikidata", "NosDéputés.fr"],
    }


def enrichir_gouvernement(
    membres: list[dict],
    affaires: list[dict],
    politiques_wd: list[dict],
    elus: list[dict],
) -> list[dict]:
    """
    Croise les membres du gouvernement avec :
    1. Les affaires Wikidata (par wikidata_id) → score, affaires
    2. Les élus RNE (par nom normalisé) → elu_id (pour lien fiche)
    """
    # Index Wikidata : wikidata_id → données
    wd_index: dict[str, dict] = {p["wikidata_id"]: p for p in politiques_wd if p.get("wikidata_id")}

    # Index élus : nom complet normalisé → id
    # PAS de fallback par nom seul (risque d'homonymes : Jean-Luc Darmanin ≠ Gérald Darmanin)
    elu_index: dict[str, str] = {}
    for e in elus:
        key = f"{normalise_nom(e['prenom'])} {normalise_nom(e['nom'])}"
        elu_index[key] = e["id"]

    # Index affaires : id → affaire
    affaires_by_id = {a["id"]: a for a in affaires}

    result = []
    for m in membres:
        membre = dict(m)
        membre.setdefault("score", 0)
        membre.setdefault("nb_affaires", 0)
        membre.setdefault("affaires", [])
        membre.setdefault("elu_id", None)

        # Recherche des affaires par wikidata_id (Wikidata + Wikipedia)
        wikidata_id = membre.get("wikidata_id", "")
        for aff in affaires:
            aff_wd_id = aff.get("_wikidata_id", "")
            if aff_wd_id and aff_wd_id == wikidata_id:
                if aff["id"] not in membre["affaires"]:
                    membre["affaires"].append(aff["id"])

        # Score depuis Wikidata (source d'autorité)
        wd = wd_index.get(wikidata_id)
        if wd:
            if wd["type"] == "condamnation" and membre["score"] < 3:
                membre["score"] = 3
            elif wd["type"] == "accusation" and membre["score"] < 2:
                membre["score"] = 2

        # Score complémentaire depuis les affaires Wikipedia
        if membre["score"] == 0 and membre["affaires"]:
            aff_liste = [affaires_by_id[aid] for aid in membre["affaires"] if aid in affaires_by_id]
            membre["score"] = calculer_score(aff_liste)

        # Lien vers la fiche élu RNE (match strict prénom + nom uniquement)
        key_full = f"{normalise_nom(membre.get('prenom',''))} {normalise_nom(membre.get('nom',''))}"
        elu_id = elu_index.get(key_full)
        if elu_id:
            membre["elu_id"] = elu_id

        membre["nb_affaires"] = len(membre["affaires"])
        result.append(membre)

    return result


def calculer_partis(elus: list[dict], affaires: list[dict]) -> list[dict]:
    """
    Calcule les statistiques détaillées par parti politique.
    Retourne uniquement les partis ayant au moins 1 affaire.
    """
    affaires_by_id = {a["id"]: a for a in affaires}
    partis: dict[str, dict] = {}

    for elu in elus:
        p = elu["parti"]
        if p not in partis:
            partis[p] = {
                "nom": p,
                "nb_elus_total": 0,
                "nb_elus_concernes": 0,
                "nb_affaires": 0,
                "nb_condamnations": 0,
                "nb_mises_en_examen": 0,
                "nb_enquetes": 0,
                "total_amendes_euros": 0,
                "nb_avec_prison": 0,
                "nb_avec_ineligibilite": 0,
                "elus_concernes": [],
            }
        partis[p]["nb_elus_total"] += 1

        if elu["nb_affaires"] > 0:
            # Dédupliquer par personne (même nom + date de naissance = même personne avec mandats multiples)
            person_key = f"{normalise_nom(elu['prenom'])} {normalise_nom(elu['nom'])} {elu.get('date_naissance', '')}"
            already_counted = person_key in partis[p].get("_seen_persons", set())
            if not already_counted:
                partis[p].setdefault("_seen_persons", set()).add(person_key)
                partis[p].setdefault("_seen_affaires", set())
                partis[p]["nb_elus_concernes"] += 1

                # Compter chaque affaire une seule fois par parti (éviter le double-comptage
                # quand plusieurs homonymes sont matchés sur la même affaire Wikidata)
                for aid in elu["affaires"]:
                    if aid in partis[p]["_seen_affaires"]:
                        continue
                    partis[p]["_seen_affaires"].add(aid)
                    partis[p]["nb_affaires"] += 1

                    aff = affaires_by_id.get(aid, {})
                    statut = aff.get("statut", "")
                    if statut == "condamnation":
                        partis[p]["nb_condamnations"] += 1
                    elif statut == "mise_en_examen":
                        partis[p]["nb_mises_en_examen"] += 1
                    elif statut == "enquete":
                        partis[p]["nb_enquetes"] += 1
                    if aff.get("amende_euros"):
                        partis[p]["total_amendes_euros"] += aff["amende_euros"]
                    if aff.get("peine_prison_ferme_mois") or aff.get("peine_prison_sursis_mois"):
                        partis[p]["nb_avec_prison"] += 1
                    if aff.get("ineligibilite_mois"):
                        partis[p]["nb_avec_ineligibilite"] += 1

                partis[p]["elus_concernes"].append({
                    "id": elu["id"],
                    "prenom": elu["prenom"],
                    "nom": elu["nom"],
                    "score": elu["score"],
                    "nb_affaires": elu["nb_affaires"],
                })

    # Inclure tous les partis avec ≥ 2 élus (ou au moins 1 affaire)
    # Trier par nb_affaires desc, puis nb_elus_total desc
    result = []
    for v in partis.values():
        if v["nb_affaires"] > 0 or v["nb_elus_total"] >= 2:
            v.pop("_seen_persons", None)
            v.pop("_seen_affaires", None)
            result.append(v)
    result.sort(key=lambda x: (x["nb_affaires"], x["nb_elus_total"]), reverse=True)
    return result


def construire_personnalites(affaires_orphelines: list[dict]) -> list[dict]:
    """
    Construit la liste des personnalités politiques hors RNE
    à partir des affaires Wikidata/Wikipedia orphelines (non matchées à un élu).
    Regroupe par personne (wikidata_id ou nom).
    """
    personnes: dict[str, dict] = {}
    for aff in affaires_orphelines:
        # Seules les affaires avec un nom de personne identifié
        nom = aff.get("personnes", "") or aff.get("_nom_complet_wd", "")
        if not nom:
            continue
        wikidata_id = aff.get("_wikidata_id", "")
        key = wikidata_id or normalise_nom(nom)
        if key not in personnes:
            personnes[key] = {
                "id": f"perso_{wikidata_id}" if wikidata_id else f"perso_{normalise_nom(nom).replace(' ', '_')}",
                "nom_complet": nom,
                "wikidata_id": wikidata_id,
                "poste": "",
                "score": 0,
                "nb_affaires": 0,
                "affaires": [],
                "sources": [],
            }
        p = personnes[key]
        p["affaires"].append(aff["id"])
        p["nb_affaires"] = len(p["affaires"])
        # Poste : prendre le premier non-vide
        if not p["poste"]:
            entites = aff.get("entites", [])
            if entites:
                p["poste"] = entites[0]
        # Sources
        for src in aff.get("sources", []):
            if src and src not in p["sources"]:
                p["sources"].append(src)

    # Calculer les scores
    affaires_by_id = {a["id"]: a for a in affaires_orphelines}
    for p in personnes.values():
        aff_list = [affaires_by_id[aid] for aid in p["affaires"] if aid in affaires_by_id]
        p["score"] = calculer_score(aff_list)

    result = sorted(personnes.values(), key=lambda x: (-x["score"], -x["nb_affaires"], x["nom_complet"]))
    return result


def sauvegarder(
    elus: list[dict],
    affaires: list[dict],
    stats: dict,
    output_dir: Path,
    gouvernement: list[dict] | None = None,
    partis: list[dict] | None = None,
    personnalites: list[dict] | None = None,
):
    """Écrit les fichiers JSON dans public/data/."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Normaliser les régions (anciennes → nouvelles post-2016)
    for a in affaires:
        if a.get("region"):
            a["region"] = normalise_region(a["region"])

    # Nettoyage des champs internes (_nom_condamne, etc.)
    affaires_clean = [
        {k: v for k, v in a.items() if not k.startswith("_")} for a in affaires
    ]

    # Index affaire_id → élus liés (léger, pour la page Affaires côté client)
    affaires_elus_index: dict[str, list[dict]] = {}
    for elu in elus:
        if elu["nb_affaires"] > 0:
            for aid in elu["affaires"]:
                if aid not in affaires_elus_index:
                    affaires_elus_index[aid] = []
                affaires_elus_index[aid].append({
                    "id": elu["id"],
                    "prenom": elu["prenom"],
                    "nom": elu["nom"],
                    "parti": elu["parti"],
                })

    (output_dir / "elus.json").write_text(
        json.dumps(elus, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_dir / "affaires.json").write_text(
        json.dumps(affaires_clean, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_dir / "affaires-elus.json").write_text(
        json.dumps(affaires_elus_index, ensure_ascii=False), encoding="utf-8"
    )
    (output_dir / "stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    if gouvernement is not None:
        # Nettoyer les champs internes du gouvernement
        gouvernement_clean = [
            {k: v for k, v in m.items() if not k.startswith("_")} for m in gouvernement
        ]
        (output_dir / "gouvernement.json").write_text(
            json.dumps(gouvernement_clean, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    if partis is not None:
        (output_dir / "partis.json").write_text(
            json.dumps(partis, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    if personnalites is not None:
        (output_dir / "personnalites.json").write_text(
            json.dumps(personnalites, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    print(f"\n✓ Fichiers JSON sauvegardés dans {output_dir}")
    print(f"  - elus.json        : {len(elus)} élus")
    print(f"  - affaires.json    : {len(affaires_clean)} affaires")
    print(f"  - stats.json       : tableau de bord")
    if gouvernement is not None:
        print(f"  - gouvernement.json: {len(gouvernement)} membres")
    if partis is not None:
        print(f"  - partis.json      : {len(partis)} partis avec affaires")
    if personnalites is not None:
        print(f"  - personnalites.json: {len(personnalites)} personnalités hors RNE")
