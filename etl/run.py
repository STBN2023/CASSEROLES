#!/usr/bin/env python3
"""
Point d'entrée principal de l'ETL Casseroles.
Usage : python etl/run.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from sources.fetch_rne import fetch_all as fetch_rne, normalise_parti
from sources.fetch_ti import fetch_ti
from sources.fetch_nosdeputes import fetch_nosdeputes, build_enrichment_index
from sources.fetch_deputes_wikipedia import fetch_deputes_wikipedia, build_deputes_index
from sources.fetch_assemblee_nationale import fetch_hemicycle_an, build_hemicycle_index, build_groupe_index, _normalise as normalise_an
from sources.fetch_wikidata import fetch_politiques_condamnes
from sources.fetch_gouvernement import fetch_gouvernement, set_photos_dir
from sources.fetch_wikipedia_affaires import fetch_affaires_wikipedia
from transform import joindre_affaires, enrichir_affaires_wikidata, calculer_stats, calculer_partis, construire_personnalites, sauvegarder, enrichir_gouvernement, dedupliquer_elus

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"


def main():
    print("=" * 60)
    print("  Casseroles – ETL Observatoire des élus")
    print("=" * 60)

    # 1. Récupération des sources
    print("\n[1/5] Chargement des élus (RNE)...")
    elus = fetch_rne()
    print(f"      → {len(elus)} élus chargés")

    print("\n[2/5] Chargement des affaires (Transparency International)...")
    affaires = fetch_ti()
    print(f"      → {len(affaires)} affaires chargées")

    print("\n[3/5] Enrichissement élus (AN + Wikidata)...")
    # Priorité sources :
    #   1. assemblee-nationale.fr → groupes parlementaires (partis) + places hémicycle
    #   2. Wikidata SPARQL        → photos + parti en fallback
    #   3. NosDéputés.fr          → dernier recours (photo/parti)

    # Source 1 : assemblee-nationale.fr (groupes parlementaires + places hémicycle)
    hemicycle_data = fetch_hemicycle_an()
    hemicycle_index = build_hemicycle_index(hemicycle_data)
    groupe_index = build_groupe_index(hemicycle_data)

    # Corrections manuelles : noms RNE ≠ noms AN (tirets, particules, etc.)
    _HEMICYCLE_MANUAL: dict[str, str] = {
        "audrey abadie": "audrey abadie-amiel",
        "emmanuel tache de la pagerie": "emmanuel tache",
        "yannick favennec": "yannick favennec-becot",
        "yaël braun-pivet": "yael braun-pivet",
        "benjamin lucas": "benjamin lucas-lundy",
        "emeline kbidi": "emeline k bidi",
        "mereana reid aberlot": "mereana reid arbelot",
    }
    for rne_key, an_key in _HEMICYCLE_MANUAL.items():
        an_norm = normalise_an(an_key)
        if an_norm in hemicycle_index:
            hemicycle_index[rne_key] = hemicycle_index[an_norm]
            hemicycle_index[normalise_an(rne_key)] = hemicycle_index[an_norm]
        if an_norm in groupe_index:
            groupe_index[rne_key] = groupe_index[an_norm]
            groupe_index[normalise_an(rne_key)] = groupe_index[an_norm]

    # Source 2 : Wikidata (photos députés actuels + parti en fallback)
    photos_dir = OUTPUT_DIR / "photos"
    photos_dir.mkdir(parents=True, exist_ok=True)
    deputes_wd = fetch_deputes_wikipedia(photos_dir)
    wd_deputes_index = build_deputes_index(deputes_wd)

    # Source 3 : NosDéputés.fr (dernier recours : photo/parti)
    deputes_nd = fetch_nosdeputes()
    nd_index = build_enrichment_index(deputes_nd)

    enriched_count = 0
    hemicycle_count = 0
    groupe_an_count = 0
    for elu in elus:
        nom_norm = f"{elu['prenom'].lower()} {elu['nom'].lower()}"
        nom_seul = elu["nom"].lower()
        nom_an = normalise_an(f"{elu['prenom']} {elu['nom']}")
        nom_an_seul = normalise_an(elu["nom"])

        # 1. AN : groupe parlementaire (source prioritaire partis) + place hémicycle
        place = hemicycle_index.get(nom_norm) or hemicycle_index.get(nom_seul) or hemicycle_index.get(nom_an) or hemicycle_index.get(nom_an_seul)
        if place:
            elu["place_en_hemicycle"] = place
            hemicycle_count += 1

        groupe_an = groupe_index.get(nom_norm) or groupe_index.get(nom_seul) or groupe_index.get(nom_an) or groupe_index.get(nom_an_seul)
        if groupe_an:
            elu["parti"] = normalise_parti(groupe_an)
            elu["parti_brut"] = f"AN: {groupe_an}"
            groupe_an_count += 1

        # 2. Wikidata : photos (source principale) + parti en fallback si pas de groupe AN
        match_wd = wd_deputes_index.get(nom_norm) or wd_deputes_index.get(nom_seul)
        if match_wd:
            if match_wd.get("url_photo"):
                elu["url_photo"] = match_wd["url_photo"]
            if match_wd.get("url_fiche"):
                elu["url_source"] = match_wd["url_fiche"]
            if not groupe_an:
                groupe_wd = match_wd.get("groupe", "")
                if groupe_wd:
                    elu["parti"] = normalise_parti(groupe_wd)
                    elu["parti_brut"] = f"Wikidata: {groupe_wd}"
            enriched_count += 1

        # 3. NosDéputés : dernier recours (photo/parti si rien au-dessus)
        match_nd = nd_index.get(nom_norm) or nd_index.get(nom_seul)
        if match_nd:
            if not elu.get("url_photo") and match_nd.get("url_photo"):
                elu["url_photo"] = match_nd["url_photo"]
            if not elu.get("url_source") and match_nd.get("url_fiche"):
                elu["url_source"] = match_nd["url_fiche"]
            if elu["parti"] == "Autre / Non renseigné":
                groupe_nd = match_nd.get("groupe", "")
                if groupe_nd:
                    elu["parti"] = normalise_parti(groupe_nd)
                    elu["parti_brut"] = f"NosDéputés: {groupe_nd}"
            if not match_wd:
                enriched_count += 1

    print(f"      → {enriched_count} élus enrichis (photos/fiches)")
    print(f"      → {hemicycle_count} députés avec place hémicycle")
    print(f"      → {groupe_an_count} députés avec groupe AN (source officielle)")

    print("\n[4/5] Composition du gouvernement (API DILA)...")
    set_photos_dir(OUTPUT_DIR)   # Configure le répertoire de cache local des photos
    membres_gouv = fetch_gouvernement()

    print("\n[4b] Affaires judiciaires (Wikipedia)...")
    affaires_wiki = fetch_affaires_wikipedia(membres_gouv)
    print(f"      → {len(affaires_wiki)} affaires Wikipedia trouvées")
    affaires.extend(affaires_wiki)

    print("\n[5/5] Enrichissement affaires (Wikidata)...")
    politiques_wd = fetch_politiques_condamnes()
    affaires, nb_nouvelles = enrichir_affaires_wikidata(affaires, politiques_wd)
    print(f"      → {nb_nouvelles} affaires Wikidata ajoutées ({len(affaires)} total)")

    # Scraping Wikipedia étendu aux personnalités Wikidata (pas seulement gouvernement)
    # On ne re-scrape pas ceux déjà traités (membres du gouvernement)
    noms_gouv = {f"{m.get('prenom','')} {m.get('nom','')}".strip().lower() for m in membres_gouv}
    personnalites_wiki = [
        p for p in politiques_wd
        if p.get("frwiki_title") and p["nom_complet"].lower() not in noms_gouv
    ]
    nb_avec_wiki = len(personnalites_wiki)
    if nb_avec_wiki:
        print(f"\n[5b] Affaires Wikipedia – personnalités Wikidata ({nb_avec_wiki} avec page FR)...")
        affaires_wiki_perso = fetch_affaires_wikipedia(personnalites_wiki)
        print(f"      → {len(affaires_wiki_perso)} affaires Wikipedia (personnalités)")
        affaires.extend(affaires_wiki_perso)

    print("\n[6/6] Jointure élus ↔ affaires, scores et sauvegarde...")
    elus, affaires_orphelines = joindre_affaires(elus, affaires)
    elus_concernes = sum(1 for e in elus if e["nb_affaires"] > 0)
    print(f"      → {elus_concernes} élus concernés par au moins une affaire")

    # Enrichir le parti des élus via Wikidata (pour ceux sans parti NosDéputés)
    from transform import normalise_nom
    wd_parti_index: dict[str, str] = {}
    for p in politiques_wd:
        parti = p.get("parti_wikidata", "")
        if parti:
            key = normalise_nom(p["nom_complet"])
            wd_parti_index[key] = parti
    parti_enriched = 0
    for elu in elus:
        if elu["parti"] == "Autre / Non renseigné" and elu["nb_affaires"] > 0:
            key = normalise_nom(f"{elu['prenom']} {elu['nom']}")
            parti_wd = wd_parti_index.get(key)
            if parti_wd:
                elu["parti"] = normalise_parti(parti_wd)
                elu["parti_brut"] = f"Wikidata: {parti_wd}"
                parti_enriched += 1
    if parti_enriched:
        print(f"      → {parti_enriched} élus enrichis avec parti Wikidata")

    # Déduplication : fusionner les mandats multiples par personne
    nb_avant = len(elus)
    elus = dedupliquer_elus(elus)
    nb_fusions = nb_avant - len(elus)
    if nb_fusions:
        print(f"      → {nb_fusions} mandats fusionnés ({nb_avant} → {len(elus)} personnes)")
    elus_concernes_dedup = sum(1 for e in elus if e["nb_affaires"] > 0)
    print(f"      → {elus_concernes_dedup} personnes concernées par au moins une affaire")

    gouvernement = enrichir_gouvernement(membres_gouv, affaires, politiques_wd, elus)
    nb_gouv_casseroles = sum(1 for m in gouvernement if m["score"] > 0)
    print(f"      → {nb_gouv_casseroles} membre(s) du gouvernement avec affaires")

    personnalites = construire_personnalites(affaires_orphelines)
    print(f"      → {len(personnalites)} personnalités politiques hors RNE")

    stats = calculer_stats(elus, affaires)
    partis_data = calculer_partis(elus, affaires)
    print(f"      → {len(partis_data)} partis avec affaires")
    sauvegarder(elus, affaires, stats, OUTPUT_DIR, gouvernement=gouvernement, partis=partis_data, personnalites=personnalites)

    print("\n✅ ETL terminé avec succès !")


if __name__ == "__main__":
    main()
