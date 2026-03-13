export type Niveau = "local" | "national" | "europeen"
export type Score = 0 | 1 | 2 | 3
export type Statut =
  | "condamnation"
  | "mise_en_examen"
  | "enquete"
  | "relaxe"
  | "classe_sans_suite"

export interface Mandat {
  type: string
  niveau: Niveau
  territoire?: string
  code_departement?: string
  debut?: string
  fin?: string
}

export interface Elu {
  id: string
  nom: string
  prenom: string
  sexe: string
  date_naissance: string
  parti: string
  parti_brut: string
  niveau: Niveau
  mandat: string
  territoire: string
  code_departement: string
  score: Score
  nb_affaires: number
  affaires: string[]
  mandats?: Mandat[]
  place_en_hemicycle?: number
  url_photo?: string
  url_source?: string
  source: string
}

export interface Affaire {
  id: string
  type: string
  statut: Statut
  date: string
  date_faits: string
  date_condamnation: string
  juridiction: string
  lieu: string
  departement: string
  region: string
  personnes?: string
  resume: string
  infractions: string[]
  entites: string[]
  tags: string[]
  sources: string[]
  source_label: string
  // Peines structurées (TI France uniquement, null pour Wikidata)
  peine_prison_ferme_mois: number | null
  peine_prison_sursis_mois: number | null
  amende_euros: number | null
  ineligibilite_mois: number | null
}

export interface RepartitionParti {
  nom: string
  nb_elus: number
  nb_affaires: number
  nb_condamnations: number
}

export interface Personnalite {
  id: string
  nom_complet: string
  wikidata_id: string
  poste: string
  score: Score
  nb_affaires: number
  affaires: string[]
  sources: string[]
}

export interface Stats {
  nb_elus_total: number
  nb_elus_concernes: number
  nb_affaires_total: number
  // Ventilation par source
  nb_affaires_personnes: number
  nb_affaires_geographiques: number
  nb_affaires_matchees: number
  // Nombre d'affaires par statut judiciaire
  nb_condamnations: number
  nb_mises_en_examen: number
  nb_enquetes: number
  nb_relaxes: number
  nb_classes_sans_suite: number
  // Nombre d'élus par score de probité
  nb_elus_condamnes: number
  nb_elus_mis_en_examen: number
  nb_elus_enquetes: number
  repartition_niveaux: Record<string, number>
  repartition_partis: RepartitionParti[]
  // Agrégats peines
  total_amendes_euros: number
  nb_avec_prison: number
  nb_avec_amende: number
  nb_avec_ineligibilite: number
  derniere_maj: string
  sources: string[]
}

export interface PartiDetail {
  nom: string
  nb_elus_total: number
  nb_elus_concernes: number
  nb_affaires: number
  nb_condamnations: number
  nb_mises_en_examen: number
  nb_enquetes: number
  total_amendes_euros: number
  nb_avec_prison: number
  nb_avec_ineligibilite: number
  elus_concernes: {
    id: string
    prenom: string
    nom: string
    score: Score
    nb_affaires: number
  }[]
}

export const SCORE_LABELS: Record<Score, string> = {
  0: "Aucune affaire référencée",
  1: "Enquête documentée",
  2: "Mis(e) en examen",
  3: "Condamné(e)",
}

// Gravité visuelle : points pleins = gravité croissante
export const SCORE_DOTS: Record<Score, string> = {
  0: "○○○",
  1: "●○○",
  2: "●●○",
  3: "●●●",
}

// Couleurs DSFR (Design System de l'État)
export const SCORE_COLORS: Record<Score, string> = {
  0: "bg-[#dffee6] text-[#18753c]",   // vert succès DSFR
  1: "bg-[#fef7da] text-[#716043]",   // jaune tournesol DSFR
  2: "bg-[#ffe9e6] text-[#b34000]",   // orange caution DSFR
  3: "bg-[#fee9e9] text-[#ce0500]",   // rouge erreur DSFR
}

export const STATUT_LABELS: Record<Statut, string> = {
  condamnation: "Condamnation",
  mise_en_examen: "Mise en examen",
  enquete: "Enquête",
  relaxe: "Relaxe / Acquittement",
  classe_sans_suite: "Classé sans suite",
}

// Couleurs statut DSFR
export const STATUT_COLORS: Record<Statut, string> = {
  condamnation:      "bg-[#fee9e9] text-[#ce0500] border-[#fcc0bf]",
  mise_en_examen:    "bg-[#ffe9e6] text-[#b34000] border-[#f9c09a]",
  enquete:           "bg-[#fef7da] text-[#716043] border-[#f5d98b]",
  relaxe:            "bg-[#dffee6] text-[#18753c] border-[#97f4b4]",
  classe_sans_suite: "bg-[#f6f6f6] text-[#666666] border-[#dddddd]",
}

export const NIVEAU_LABELS: Record<Niveau, string> = {
  local: "Local",
  national: "National",
  europeen: "Européen",
}

// ── Gouvernement ────────────────────────────────────────────────────────────
export type RangGouvernement =
  | "premier_ministre"
  | "ministre"
  | "ministre_delegue"
  | "secretaire_etat"

export const RANG_LABELS: Record<RangGouvernement, string> = {
  premier_ministre: "Premier ministre",
  ministre: "Ministre",
  ministre_delegue: "Ministre délégué(e)",
  secretaire_etat: "Secrétaire d'État",
}

export const RANG_ORDER: Record<RangGouvernement, number> = {
  premier_ministre: 0,
  ministre: 1,
  ministre_delegue: 2,
  secretaire_etat: 3,
}

export interface MembreGouvernement {
  wikidata_id: string
  prenom: string
  nom: string
  poste: string
  rang: RangGouvernement
  parti: string
  date_debut: string
  score: Score
  nb_affaires: number
  affaires: string[]
  url_photo?: string
  elu_id?: string | null
  source?: string
}
