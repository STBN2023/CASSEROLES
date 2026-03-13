# Devbook — Casseroles

> Suivi des bugs, corrections et améliorations du projet.
> Dernière mise à jour : 2026-03-13

## Légende statuts

- [ ] À faire
- [x] Corrigé
- [~] En cours / partiel

---

## Bugs critiques

- [x] **B1** — `page.tsx` : metadata SEO manquante sur la page d'accueil
- [x] **B2** — `gouvernement/page.tsx:11` : incohérence "Bayrou" vs "Lecornu" dans la metadata
- [x] **B3** — `affaires/page.tsx` : utilise `fetch()` client-side au lieu de `readFileSync` (pas de SSR/SEO)
- [x] **B4** — `etl/sources/fetch_ti.py` : variable `content` non définie si les 3 encodages échouent
- [x] **B5** — `etl/sources/fetch_deputes_wikipedia.py:219` : index par nom de famille écrase les homonymes
- [x] **B6** — ETL SSL manquant sur 7 fichiers — centralisé via `http_client.py`

## Bugs moyens

- [x] **B7** — `elus/[id]/page.tsx:76` et `gouvernement/[id]/page.tsx:69` : accès `prenom[0]` sans vérification chaîne vide
- [x] **B8** — `ElusTable.tsx` : erreurs fetch silencieuses (catch vide)
- [x] **B9** — `GouvernementGrid.tsx` : cast `as RangGouvernement` redondant supprimé
- [x] **B10** — `etl/sources/fetch_wikipedia_affaires.py` : `int(sec_index)` crashe sur sous-sections "2.1.3"

## Améliorations — Architecture & Performance

- [x] **A1** — Migrer `affaires/page.tsx` en Server Component (lié à B3)
- [ ] **A2** — Ajouter Error Boundaries autour de `ElusTable`, `PartisGrid`, `Hemicycle`
- [x] **A3** — Indexer `getElu()` et `getMembreGouvernement()` avec `Map` au lieu de `Array.find()` O(n)
- [x] **A4** — Utiliser `requests.Session()` dans l'ETL pour le pooling de connexions (fait via B6, `http_client.py`)

## Améliorations — SEO

- [x] **S1** — Ajouter metadata + OpenGraph à `page.tsx` (fait via B1)
- [x] **S2** — Ajouter OpenGraph/Twitter aux pages dynamiques `elus/[id]` et `gouvernement/[id]`

## Améliorations — Accessibilité

- [ ] **X1** — Navigation clavier sur `FranceMap` et `Hemicycle` (SVG interactifs) — `tabindex`, `role="button"`
- [ ] **X2** — `aria-expanded` sur le bouton d'expansion dans `PartisGrid`
- [ ] **X3** — `aria-sort` sur les en-têtes de table dans `ElusTable`
- [ ] **X4** — `aria-label` sur les boutons de pagination (`««`, `»»`)
- [ ] **X5** — Labels explicites sur les champs de recherche/filtre de `affaires/page.tsx`

## Améliorations — ETL / Qualité des données

- [x] **E1** — Centraliser la gestion SSL dans un module partagé (fait via B6)
- [ ] **E2** — Retry avec backoff exponentiel pour les requêtes HTTP
- [ ] **E3** — Valider les données avant écriture en cache
- [ ] **E4** — Logger les enregistrements ignorés dans `fetch_ti.py`
- [x] **E5** — Remplacer l'index par nom de famille par un index multi-candidat (fait via B5)

## Améliorations — UX

- [ ] **U1** — Synchroniser l'état d'expansion de `PartisGrid` avec l'URL (query params)
- [ ] **U2** — Afficher un message d'erreur quand le chargement des élus échoue dans `ElusTable`
- [x] **U3** — Ajouter `width`/`height` au logo `<img>` dans le layout pour éviter le CLS

## Bugs données — Faux positifs & KPIs (2026-03-12)

- [x] **D1** — **Faux positifs jointure nom** — Implémenté : `_dates_compatibles()` + `_parse_date_naissance()` dans `transform.py` (L218-294). François Fillon PM (né 1954) séparé du maire Fillon (né 1970). ETL relancé : 35 affaires matchées à 43 élus RNE (vs risque de faux positifs avant).
- [x] **D2** — **KPIs page d'accueil** — Implémenté : `calculer_stats()` distingue 273 affaires nominatives (Wikidata+Wikipedia), 429 géographiques (TI France), 35 matchées à élus RNE. Dashboard affiche 5 KPIs séparés. ETL relancé : stats actualisées.
- [x] **D3** — **Personnalités politiques hors RNE** — Implémenté : `construire_personnalites()` (L552-597) + page `/personnalites` + `PersonnalitesClient.tsx`. ETL relancé : 633 personnalités générées (Sarkozy, Carignon, Fillon, etc. avec affaires Wikidata/Wikipedia).

---

## Journal des corrections

| Date | Ref | Description | Fichier(s) |
|------|-----|-------------|------------|
| 2026-03-11 | B1, S1 | Ajout metadata SEO (title + description) | `src/app/page.tsx` |
| 2026-03-11 | B2 | Correction "Bayrou" → "Lecornu" dans metadata | `src/app/gouvernement/page.tsx` |
| 2026-03-11 | B7 | Protection `prenom?.charAt(0)` / `nom?.charAt(0)` | `src/app/elus/[id]/page.tsx`, `src/app/gouvernement/[id]/page.tsx` |
| 2026-03-11 | B8 | Gestion d'erreur explicite dans catch (reset state + console.error) | `src/components/table/ElusTable.tsx` |
| 2026-03-11 | B9 | Suppression cast `as RangGouvernement` redondant | `src/components/dashboard/GouvernementGrid.tsx` |
| 2026-03-11 | B4 | Ajout guard `if content is None: return []` après boucle encodage | `etl/sources/fetch_ti.py` |
| 2026-03-11 | B5, E5 | Index multi-candidat : clé de nom de famille ignorée si homonymes | `etl/sources/fetch_deputes_wikipedia.py` |
| 2026-03-11 | B10 | `try/except ValueError` sur `int(sec_index)` | `etl/sources/fetch_wikipedia_affaires.py` |
| 2026-03-11 | B6, E1, A4 | Création `http_client.py` (session partagée, SSL fix, connection pooling). Migration des 7 sources ETL. | `etl/sources/http_client.py`, `fetch_ti.py`, `fetch_rne.py`, `fetch_nosdeputes.py`, `fetch_wikidata.py`, `fetch_gouvernement.py`, `fetch_deputes_wikipedia.py`, `fetch_wikipedia_affaires.py`, `fetch_assemblee_nationale.py` |
| 2026-03-11 | B3, A1 | Migration `affaires/page.tsx` en Server Component : extraction `AffairesClient.tsx`, lecture SSR via `getAffaires()` + `getAffairesElus()`, ajout metadata SEO | `src/app/affaires/page.tsx`, `src/app/affaires/AffairesClient.tsx`, `src/lib/data.ts` |
| 2026-03-11 | S2 | Ajout OpenGraph + Twitter Card aux pages dynamiques `elus/[id]` et `gouvernement/[id]` | `src/app/elus/[id]/page.tsx`, `src/app/gouvernement/[id]/page.tsx` |
| 2026-03-11 | U3 | Ajout `width={128} height={128}` au logo `<img>` pour éviter le CLS | `src/app/layout.tsx` |
| 2026-03-11 | A3 | Index `Map` pour `getElu()` et `getMembreGouvernement()` — lookup O(1) au lieu de O(n) | `src/lib/data.ts` |
| 2026-03-13 | D1 | Vérification date de naissance dans jointure affaires ↔ élus (évite faux positifs homonymes) | `etl/transform.py` (L218-294) |
| 2026-03-13 | D2 | Distinction stats : 273 affaires nominatives · 429 géographiques · 35 matchées à élus RNE | `src/app/page.tsx`, `etl/transform.py:calculer_stats()` |
| 2026-03-13 | D3 | Page `/personnalites` + génération 633 personnalités hors RNE (Wikidata/Wikipedia orphelines) | `src/app/personnalites/`, `etl/transform.py:construire_personnalites()` |
