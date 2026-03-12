"""
Module HTTP partagé pour l'ETL Casseroles.

Fournit une session requests pré-configurée qui :
  - Gère le problème SSL de Python 3.13 sur macOS (certificats non installés)
  - Réutilise les connexions (connection pooling)
  - Définit un User-Agent commun
"""

import requests
import urllib3

# Désactiver les warnings SSL quand verify=False
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Session partagée avec SSL désactivé (macOS Python 3.13 fix)
_session: requests.Session | None = None


def get_session() -> requests.Session:
    """Retourne une session HTTP réutilisable avec SSL fix."""
    global _session
    if _session is None:
        _session = requests.Session()
        _session.verify = False
        _session.headers.update({
            "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source; github.com/casseroles)",
        })
    return _session
