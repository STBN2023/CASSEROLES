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
from sources.fetch_wikidata import fetch_politiques_condamnes
from sources.fetch_gouvernement import fetch_gouvernement, set_photos_dir
from transform import joindre_affaires, enrichir_affaires_wikidata, calculer_stats, calculer_partis, sauvegarder, enrichir_gouvernement

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

    print("\n[3/5] Enrichissement élus (NosDéputés.fr)...")
    deputes_enrichis = fetch_nosdeputes()
    enrichment_index = build_enrichment_index(deputes_enrichis)
    enriched_count = 0
    for elu in elus:
        key = f"{elu['prenom'].lower()} {elu['nom'].lower()}"
        match = enrichment_index.get(key) or enrichment_index.get(elu["nom"].lower())
        if match:
            elu["url_photo"] = match.get("url_photo", "")
            elu["url_source"] = match.get("url_fiche", "")
            # Place dans l'hémicycle (numéro de siège officiel)
            place = match.get("place_en_hemicycle", "")
            if place:
                try:
                    elu["place_en_hemicycle"] = int(place)
                except (ValueError, TypeError):
                    pass
            # Parti depuis le groupe parlementaire NosDéputés
            groupe = match.get("groupe", "")
            if groupe:
                elu["parti"] = normalise_parti(groupe)
                elu["parti_brut"] = groupe
            enriched_count += 1
    print(f"      → {enriched_count} élus enrichis avec photo/fiche")

    print("\n[4/5] Composition du gouvernement (API DILA)...")
    set_photos_dir(OUTPUT_DIR)   # Configure le répertoire de cache local des photos
    membres_gouv = fetch_gouvernement()

    print("\n[5/5] Enrichissement affaires (Wikidata)...")
    politiques_wd = fetch_politiques_condamnes()
    affaires, nb_nouvelles = enrichir_affaires_wikidata(affaires, politiques_wd)
    print(f"      → {nb_nouvelles} affaires Wikidata ajoutées ({len(affaires)} total)")

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

    gouvernement = enrichir_gouvernement(membres_gouv, affaires, politiques_wd, elus)
    nb_gouv_casseroles = sum(1 for m in gouvernement if m["score"] > 0)
    print(f"      → {nb_gouv_casseroles} membre(s) du gouvernement avec affaires")

    stats = calculer_stats(elus, affaires)
    partis_data = calculer_partis(elus, affaires)
    print(f"      → {len(partis_data)} partis avec affaires")
    sauvegarder(elus, affaires, stats, OUTPUT_DIR, gouvernement=gouvernement, partis=partis_data)

    print("\n✅ ETL terminé avec succès !")


if __name__ == "__main__":
    main()
