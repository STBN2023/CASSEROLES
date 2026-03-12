"""
Composition du gouvernement français – API DILA (service-public.fr)

Source autoritaire :
  https://api-lannuaire.service-public.fr (Licence Ouverte / Open Licence)

Enrichissement photos :
  Wikidata (CC0) → titre Wikipedia FR → API REST Wikipedia

Stratégie de récupération :
  1. Le record "Gouvernement" (ID:176279) liste ses fils directs = PM + Ministères.
  2. Une requête séparée ramène les Ministres délégué(e)s (auprès de…).
  3. Pour chaque membre : recherche Wikidata par nom → QID → photo Wikipedia.
"""

import time
import re
import json
from pathlib import Path

from sources.http_client import get_session

DILA_BASE = (
    "https://api-lannuaire.service-public.fr"
    "/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records"
)
GOUVERNEMENT_UUID = "176279"   # ID stable du record "Gouvernement (Premier ministre et ministères)"
WD_API = "https://www.wikidata.org/w/api.php"
WP_REST = "https://fr.wikipedia.org/api/rest_v1/page/summary"

HEADERS = {
    "User-Agent": "Casseroles-ETL/1.0 (observatoire open-source; github.com/casseroles)",
    "Accept": "application/json",
}


# ── Utilitaires ───────────────────────────────────────────────────────────────

def classifier_rang(nom_org: str) -> str:
    """Déduit le rang hiérarchique depuis le nom de l'organisation."""
    l = nom_org.lower()
    if l == "premier ministre":
        return "premier_ministre"
    if l.startswith("ministre délégué") or l.startswith("ministre déléguée"):
        return "ministre_delegue"
    if "secrétaire d'état" in l or l.startswith("secrétariat d'état"):
        return "secretaire_etat"
    return "ministre"


def normaliser_parti(p: str) -> str:
    """Normalise le nom de parti renvoyé par Wikidata."""
    mapping = {
        "La République En Marche": "Renaissance",
        "Renaissance (parti politique)": "Renaissance",
        "Mouvement démocrate": "MoDem",
        "Mouvement Démocrate": "MoDem",
        "Les Républicains": "Les Républicains",
        "Parti socialiste": "Parti Socialiste",
        "Parti radical": "Parti radical",
        "Union des démocrates indépendants": "UDI",
        "Union pour un mouvement populaire": "Les Républicains",
        "Union des démocrates et indépendants": "UDI",
    }
    return mapping.get(p, p)


# ── Fetch DILA ────────────────────────────────────────────────────────────────

def _record_by_id(uid: str) -> dict:
    """Récupère un record DILA par son identifiant UUID (champ `id`)."""
    resp = get_session().get(DILA_BASE, params={
        "limit": 1,
        "where": f'id = "{uid}"',
        "select": "nom,affectation_personne",
    }, headers=HEADERS, timeout=15)
    if resp.status_code == 200:
        results = resp.json().get("results", [])
        return results[0] if results else {}
    return {}


def _premier_affectation_ministerielle(aff_list: list) -> tuple[str, str, str] | None:
    """Retourne (prenom, nom, fonction) pour la première affectation ministérielle."""
    for p in aff_list:
        personne = p.get("personne", {})
        prenom = personne.get("prenom", "").strip()
        nom = personne.get("nom", "").strip()
        fonction = p.get("fonction", "").strip()
        if not prenom or not nom:
            continue
        fonc_l = fonction.lower()
        if any(x in fonc_l for x in ["premier ministre", "ministre", "garde des sceaux"]):
            return prenom, nom, fonction
    return None


def fetch_membres_dila() -> list[dict]:
    """
    Retourne la liste brute des membres du gouvernement depuis l'API DILA.
    Combinaison de deux requêtes :
      - Fils directs du record Gouvernement (PM + Ministres)
      - Records "Ministre délégué(e) auprès de…"
    """
    membres_raw = []
    seen = set()

    # ── 1. PM + Ministres via la hiérarchie du record Gouvernement ──────────
    resp = get_session().get(DILA_BASE, params={
        "limit": 1,
        "where": f'itm_identifiant = "{GOUVERNEMENT_UUID}"',
        "select": "hierarchie",
    }, headers=HEADERS, timeout=15)

    if resp.status_code == 200:
        results = resp.json().get("results", [])
        if results:
            hier_raw = results[0].get("hierarchie", "[]")
            hier = json.loads(hier_raw) if isinstance(hier_raw, str) else hier_raw
            fils_uuids = [h["service"] for h in hier if h.get("type_hierarchie") == "Service Fils"]

            for uid in fils_uuids:
                time.sleep(0.15)
                rec = _record_by_id(uid)
                if not rec:
                    continue

                nom_org = rec.get("nom", "")
                aff_raw = rec.get("affectation_personne")
                if not aff_raw:
                    continue

                aff_list = json.loads(aff_raw) if isinstance(aff_raw, str) else aff_raw
                result = _premier_affectation_ministerielle(aff_list)
                if result:
                    prenom, nom, fonction = result
                    key = f"{prenom.lower()}|{nom.lower()}"
                    if key not in seen:
                        seen.add(key)
                        membres_raw.append({
                            "prenom": prenom,
                            "nom": nom,
                            "poste": _format_poste(nom_org, fonction),
                            "rang": classifier_rang(nom_org),
                        })

    # ── 2. Ministres délégué(e)s ─────────────────────────────────────────────
    for genre in ["Ministre délégué", "Ministre déléguée"]:
        time.sleep(0.2)
        resp2 = get_session().get(DILA_BASE, params={
            "limit": 50,
            "where": f'nom like "{genre} auprès"',
            "select": "nom,affectation_personne",
        }, headers=HEADERS, timeout=15)

        if resp2.status_code != 200:
            continue

        for rec in resp2.json().get("results", []):
            nom_org = rec.get("nom", "")
            # Exclure les cabinets
            if "Cabinet" in nom_org or "cabinet" in nom_org:
                continue
            aff_raw = rec.get("affectation_personne")
            if not aff_raw:
                continue

            aff_list = json.loads(aff_raw) if isinstance(aff_raw, str) else aff_raw
            result = _premier_affectation_ministerielle(aff_list)
            if result:
                prenom, nom, fonction = result
                key = f"{prenom.lower()}|{nom.lower()}"
                if key not in seen:
                    seen.add(key)
                    membres_raw.append({
                        "prenom": prenom,
                        "nom": nom,
                        "poste": nom_org,  # Le nom de l'org IS la fonction pour les délégués
                        "rang": "ministre_delegue",
                    })

    # Trier
    rang_order = {"premier_ministre": 0, "ministre": 1, "ministre_delegue": 2, "secretaire_etat": 3}
    membres_raw.sort(key=lambda m: (rang_order.get(m["rang"], 99), m["nom"]))
    return membres_raw


def _format_poste(nom_org: str, fonction: str) -> str:
    """Formate l'intitulé du poste pour un ministre."""
    if "garde des sceaux" in fonction.lower():
        return "Garde des Sceaux, Ministre de la Justice"
    if nom_org.lower() == "premier ministre":
        return "Premier ministre"
    # Le nom de l'organisation est déjà l'intitulé du ministère — on le retourne tel quel
    return nom_org


# ── Enrichissement Wikidata ───────────────────────────────────────────────────

def _wikidata_search(prenom: str, nom: str) -> str:
    """Cherche le QID Wikidata d'un politicien français par son nom."""
    for search_name in [f"{prenom} {nom.capitalize()}", f"{prenom} {nom}"]:
        try:
            resp = get_session().get(WD_API, params={
                "action": "wbsearchentities",
                "search": search_name,
                "language": "fr",
                "type": "item",
                "limit": 5,
                "format": "json",
            }, headers=HEADERS, timeout=10)

            if resp.status_code != 200:
                continue

            results = resp.json().get("search", [])
            for r in results:
                desc = r.get("description", "").lower()
                if any(x in desc for x in [
                    "politique", "politician", "ministre", "premier ministre",
                    "député", "sénateur", "political", "france", "french",
                    "élu", "parlementaire",
                ]):
                    return r["id"]
            if results:
                return results[0]["id"]
        except Exception:
            continue
    return ""


def _wikidata_enrich(qid: str) -> dict:
    """Récupère le titre frwiki et le parti (P102) depuis un QID."""
    if not qid:
        return {"frwiki_title": "", "parti": "Indépendant"}
    try:
        resp = get_session().get(WD_API, params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "sitelinks|claims",
            "sitefilter": "frwiki",
            "format": "json",
        }, headers=HEADERS, timeout=10)

        if resp.status_code != 200:
            return {"frwiki_title": "", "parti": "Indépendant"}

        entity = resp.json().get("entities", {}).get(qid, {})
        frwiki_title = entity.get("sitelinks", {}).get("frwiki", {}).get("title", "")

        parti = "Indépendant"
        p102 = entity.get("claims", {}).get("P102", [])
        if p102:
            parti_id = p102[0].get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id", "")
            if parti_id:
                parti = normaliser_parti(_wikidata_label(parti_id))

        return {"frwiki_title": frwiki_title, "parti": parti}
    except Exception:
        return {"frwiki_title": "", "parti": "Indépendant"}


def _wikidata_label(qid: str) -> str:
    """Récupère le label FR d'un QID."""
    try:
        resp = get_session().get(WD_API, params={
            "action": "wbgetentities",
            "ids": qid,
            "props": "labels",
            "languages": "fr|en",
            "format": "json",
        }, headers=HEADERS, timeout=8)
        if resp.status_code == 200:
            entity = resp.json().get("entities", {}).get(qid, {})
            labels = entity.get("labels", {})
            val = labels.get("fr") or labels.get("en") or {}
            return val.get("value", qid)
    except Exception:
        pass
    return qid


# ── Photos Wikipedia (téléchargement local) ───────────────────────────────────

# Répertoire de cache des photos (relatif à la racine du projet)
_PHOTOS_DIR: Path | None = None


def set_photos_dir(output_dir: Path) -> None:
    """Configure le répertoire de stockage des photos (appelé depuis run.py)."""
    global _PHOTOS_DIR
    _PHOTOS_DIR = output_dir / "photos"
    _PHOTOS_DIR.mkdir(parents=True, exist_ok=True)


def _get_thumbnail_url(frwiki_title: str) -> str:
    """Récupère l'URL Wikimedia de la photo depuis l'API REST Wikipedia FR."""
    if not frwiki_title:
        return ""
    try:
        encoded = frwiki_title.replace(" ", "_")
        resp = get_session().get(f"{WP_REST}/{encoded}", headers=HEADERS, timeout=10)
        if resp.status_code == 200:
            thumbnail = resp.json().get("thumbnail", {}).get("source", "")
            if thumbnail:
                return re.sub(r"/\d+px-", "/220px-", thumbnail)
    except Exception:
        pass
    return ""


def _download_photo(url: str, qid: str) -> str:
    """
    Télécharge une photo Wikimedia et la stocke dans public/data/photos/.
    Retourne le chemin web local (/data/photos/<qid>.jpg) ou "" en cas d'échec.
    Gère les 429 avec backoff automatique (3 tentatives max).
    """
    if not url or not qid:
        return ""

    photos_dir = _PHOTOS_DIR
    if photos_dir is None:
        return url

    ext = ".jpg" if ".jpg" in url.lower() or ".jpeg" in url.lower() else ".png"
    local_path = photos_dir / f"{qid}{ext}"

    # Ne pas re-télécharger si déjà en cache
    if local_path.exists():
        return f"/data/photos/{qid}{ext}"

    img_headers = {
        "User-Agent": HEADERS["User-Agent"],
        "Accept": "image/jpeg,image/png,image/*",
        "Referer": "https://fr.wikipedia.org/",
    }

    try:
        time.sleep(0.5)
        resp = get_session().get(url, headers=img_headers, timeout=20)
        if resp.status_code == 200:
            ct = resp.headers.get("content-type", "")
            if ct.startswith("image"):
                local_path.write_bytes(resp.content)
                return f"/data/photos/{qid}{ext}"
    except Exception:
        pass
    return ""  # Fallback géré dans fetch_gouvernement (URL distante)


# ── Fetch principal ───────────────────────────────────────────────────────────

def fetch_gouvernement() -> list[dict]:
    """
    Retourne la composition actuelle du gouvernement (API DILA),
    enrichie avec les données Wikidata (QID, parti) et les portraits Wikipedia.
    """
    print("  → Récupération composition gouvernement (API DILA)...")
    membres_raw = fetch_membres_dila()

    if not membres_raw:
        print("  ⚠ Aucun membre trouvé – vérifier la connexion à l'API DILA.")
        return []

    print(f"  → Enrichissement Wikidata + portraits ({len(membres_raw)} membres)...")
    membres = []
    nb_photos = 0
    nb_wd = 0

    for m in membres_raw:
        time.sleep(0.2)
        qid = _wikidata_search(m["prenom"], m["nom"])

        wd_data = {}
        if qid:
            time.sleep(0.2)
            wd_data = _wikidata_enrich(qid)
            nb_wd += 1

        url_photo = ""
        thumb_url = ""
        if wd_data.get("frwiki_title"):
            time.sleep(0.3)
            thumb_url = _get_thumbnail_url(wd_data["frwiki_title"])
            if thumb_url:
                # Essayer de télécharger localement pour éviter les problèmes CORS/rate-limit
                local_url = _download_photo(thumb_url, qid or f"{m['prenom']}_{m['nom']}")
                url_photo = local_url if local_url else thumb_url  # Fallback: URL distante
                if url_photo:
                    nb_photos += 1

        membres.append({
            **m,
            "wikidata_id": qid,
            "frwiki_title": wd_data.get("frwiki_title", ""),
            "parti": wd_data.get("parti", "Indépendant"),
            "url_photo": url_photo,
            "source": "dila",
        })
        photo_mark = "📸" if url_photo else "—"
        print(f"    {photo_mark} {m['prenom']} {m['nom']} ({m['rang']})")

    print(f"    ✓ {nb_wd}/{len(membres)} QID Wikidata · {nb_photos} portraits")
    print(f"    ✓ {len(membres)} membres du gouvernement")
    return membres
