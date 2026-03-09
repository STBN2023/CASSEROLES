"""
Extraction best-effort des peines depuis les descriptions TI France.

Parse le texte libre des descriptions d'affaires pour en extraire :
- peine_prison_ferme_mois (int | None)
- peine_prison_sursis_mois (int | None)
- amende_euros (int | None)
- ineligibilite_mois (int | None)
"""

import re


def _parse_montant(s: str) -> int:
    """Convertit une chaîne de montant français en entier.
    Ex: '100.000' → 100000, '3 500' → 3500, '100000' → 100000
    """
    s = s.strip().replace(" ", "").replace(".", "").replace(",", "").replace("\u00a0", "")
    try:
        return int(s)
    except ValueError:
        return 0


def _duree_en_mois(ans: int, mois: int) -> int:
    """Convertit ans + mois en total de mois."""
    return ans * 12 + mois


def extraire_peines(description: str) -> dict:
    """
    Parse une description TI France pour extraire les peines structurées.

    Returns:
        dict avec clés :
        - peine_prison_ferme_mois: int | None
        - peine_prison_sursis_mois: int | None
        - amende_euros: int | None
        - ineligibilite_mois: int | None
    """
    if not description:
        return {
            "peine_prison_ferme_mois": None,
            "peine_prison_sursis_mois": None,
            "amende_euros": None,
            "ineligibilite_mois": None,
        }

    # Nettoyage HTML résiduel et normalisation espaces
    d = re.sub(r"<[^>]+>", " ", description)
    d = re.sub(r"\s+", " ", d).lower()

    result = {
        "peine_prison_ferme_mois": None,
        "peine_prison_sursis_mois": None,
        "amende_euros": None,
        "ineligibilite_mois": None,
    }

    # ── PRISON ────────────────────────────────────────────────────────────────
    # Patterns courants dans les données TI France :
    # "X an(s) [et Y mois] de prison/d'emprisonnement [ferme|avec sursis|dont Z (ans|mois) (de|avec) sursis]"
    # "X mois de prison [ferme|avec sursis|dont Z mois ferme]"
    # "X an(s) ferme"
    # "X mois ferme"
    # "X mois [de prison] avec sursis"

    prison_total_mois = None
    prison_ferme_mois = None
    prison_sursis_mois = None

    # Pattern 1 : "X an(s) [et Y mois] de prison/d'emprisonnement ..."
    m = re.search(
        r"(\d+)\s*ans?\s*(?:et\s*(\d+)\s*mois\s*)?(?:de\s*prison|d.emprisonnement|de\s*r[ée]clusion)",
        d,
    )
    if m:
        ans = int(m.group(1))
        mois_extra = int(m.group(2)) if m.group(2) else 0
        prison_total_mois = _duree_en_mois(ans, mois_extra)

    # Pattern 2 : "X mois de prison/d'emprisonnement ..."
    if prison_total_mois is None:
        m = re.search(r"(\d+)\s*mois\s*(?:de\s*prison|d.emprisonnement|de\s*r[ée]clusion)", d)
        if m:
            prison_total_mois = int(m.group(1))

    # Pattern 3 : "X an(s) ferme" (sans "de prison" explicite)
    if prison_total_mois is None:
        m = re.search(r"(\d+)\s*ans?\s+ferme", d)
        if m:
            prison_total_mois = _duree_en_mois(int(m.group(1)), 0)
            prison_ferme_mois = prison_total_mois

    # Pattern 4 : "X mois ferme"
    if prison_total_mois is None:
        m = re.search(r"(\d+)\s*mois\s+ferme", d)
        if m:
            prison_total_mois = int(m.group(1))
            prison_ferme_mois = prison_total_mois

    # Pattern 5 : "condamné(e) à X an(s)/mois" (sans "de prison" explicite mais contexte pénal)
    if prison_total_mois is None:
        m = re.search(r"condamn[ée]{1,2}e?\s+[àa]\s+(\d+)\s*ans?\s*(?:et\s*(\d+)\s*mois)?", d)
        if m:
            # Vérifier que ce n'est pas suivi de "d'amende" ou "d'inéligibilité"
            rest = d[m.end():m.end() + 40]
            if not re.match(r"\s*(?:d.amende|d.in[ée]lig|euros?\b|€)", rest):
                ans = int(m.group(1))
                mois_extra = int(m.group(2)) if m.group(2) else 0
                prison_total_mois = _duree_en_mois(ans, mois_extra)

    # Détection ferme / sursis dans le contexte proche
    if prison_total_mois is not None and prison_ferme_mois is None:
        # Chercher "dont X (ans|mois) (de|avec) sursis" ou "dont X ferme"
        m_dont_sursis = re.search(
            r"dont\s+(\d+)\s*(ans?|mois)\s*(?:de\s+|avec\s+)?sursis", d
        )
        m_dont_ferme = re.search(
            r"dont\s+(\d+)\s*(ans?|mois)\s*ferme", d
        )
        m_avec_sursis = re.search(r"avec\s+sursis", d)
        m_ferme = re.search(r"\bferme\b", d)
        m_tout_sursis = re.search(r"totalit[ée]\s+(?:avec\s+)?sursis|enti[èe]rement\s+(?:avec\s+)?sursis", d)

        if m_dont_sursis:
            val = int(m_dont_sursis.group(1))
            unit = m_dont_sursis.group(2)
            sursis_mois = _duree_en_mois(val, 0) if unit.startswith("an") else val
            prison_sursis_mois = sursis_mois
            prison_ferme_mois = max(0, prison_total_mois - sursis_mois)
        elif m_dont_ferme:
            val = int(m_dont_ferme.group(1))
            unit = m_dont_ferme.group(2)
            ferme_mois = _duree_en_mois(val, 0) if unit.startswith("an") else val
            prison_ferme_mois = ferme_mois
            prison_sursis_mois = max(0, prison_total_mois - ferme_mois)
        elif m_tout_sursis:
            prison_sursis_mois = prison_total_mois
            prison_ferme_mois = 0
        elif m_avec_sursis and not m_ferme:
            # "avec sursis" sans mention de "ferme" → tout sursis
            prison_sursis_mois = prison_total_mois
            prison_ferme_mois = 0
        elif m_ferme and not m_avec_sursis:
            # "ferme" sans mention de "sursis" → tout ferme
            prison_ferme_mois = prison_total_mois
            prison_sursis_mois = 0

    if prison_total_mois is not None:
        result["peine_prison_ferme_mois"] = prison_ferme_mois
        result["peine_prison_sursis_mois"] = prison_sursis_mois
        # Si on n'a pas pu distinguer ferme/sursis, on met le total en ferme par défaut
        if result["peine_prison_ferme_mois"] is None and result["peine_prison_sursis_mois"] is None:
            result["peine_prison_ferme_mois"] = prison_total_mois

    # ── AMENDE ────────────────────────────────────────────────────────────────
    # Patterns : "amende de X.XXX€", "X.XXX€ d'amende", "X.XXX euros d'amende"
    # "amende de X XXX euros"

    amende_patterns = [
        # "amende(s) de X€/euros"
        r"amendes?\s+de\s+([\d]+(?:[.\s\u00a0]\d{3})*)\s*(?:€|euros?)",
        # "X€/euros d'amende(s)"
        r"([\d]+(?:[.\s\u00a0]\d{3})*)\s*(?:€|euros?)\s*d.amendes?",
        # "à X€/euros d'amende" (après "condamné à")
        r"[àa]\s+([\d]+(?:[.\s\u00a0]\d{3})*)\s*(?:€|euros?)\s*d.amendes?",
        # "amende de X euros" (nombre simple sans séparateur)
        r"amendes?\s+de\s+([\d]+)\s*(?:€|euros?)",
    ]

    for pat in amende_patterns:
        m = re.search(pat, d)
        if m:
            montant = _parse_montant(m.group(1))
            if montant > 0:
                result["amende_euros"] = montant
                break

    # ── INÉLIGIBILITÉ ─────────────────────────────────────────────────────────
    # Patterns : "X an(s) d'inéligibilité", "X mois d'inéligibilité"

    m = re.search(r"(\d+)\s*ans?\s*d.in[ée]ligibilit[ée]", d)
    if m:
        result["ineligibilite_mois"] = _duree_en_mois(int(m.group(1)), 0)
    else:
        m = re.search(r"(\d+)\s*mois\s*d.in[ée]ligibilit[ée]", d)
        if m:
            result["ineligibilite_mois"] = int(m.group(1))

    return result
