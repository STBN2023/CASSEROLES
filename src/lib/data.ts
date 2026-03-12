import { readFileSync } from "fs"
import { join } from "path"
import type { Elu, Affaire, Stats, MembreGouvernement, PartiDetail, Personnalite } from "./types"

const DATA_DIR = join(process.cwd(), "public", "data")

function readJSON<T>(filename: string): T {
  const content = readFileSync(join(DATA_DIR, filename), "utf-8")
  return JSON.parse(content)
}

export function getElus(): Elu[] {
  return readJSON<Elu[]>("elus.json")
}

export function getAffaires(): Affaire[] {
  return readJSON<Affaire[]>("affaires.json")
}

export function getStats(): Stats {
  return readJSON<Stats>("stats.json")
}

// Index Map pour lookup O(1)
let _elusMap: Map<string, Elu> | null = null

function getElusMap(): Map<string, Elu> {
  if (!_elusMap) {
    _elusMap = new Map(getElus().map((e) => [e.id, e]))
  }
  return _elusMap
}

export function getElu(id: string): Elu | undefined {
  return getElusMap().get(id)
}

export function getAffairesForElu(affaireIds: string[]): Affaire[] {
  if (!affaireIds.length) return []
  const affaires = getAffaires()
  const set = new Set(affaireIds)
  return affaires.filter((a) => set.has(a.id))
}

export function getPartis(elus: Elu[]): string[] {
  return [...new Set(elus.map((e) => e.parti))].sort()
}

// Stats par région pour la carte
export interface RegionStats {
  region: string
  nb_affaires: number
  nb_condamnations: number
  nb_mises_en_examen: number
  nb_enquetes: number
}

export function getStatsByRegion(affaires: Affaire[]): RegionStats[] {
  const regions: Record<string, RegionStats> = {}
  for (const a of affaires) {
    const r = a.region
    if (!r) continue // Ignorer les affaires sans région
    if (!regions[r]) {
      regions[r] = { region: r, nb_affaires: 0, nb_condamnations: 0, nb_mises_en_examen: 0, nb_enquetes: 0 }
    }
    regions[r].nb_affaires++
    if (a.statut === "condamnation") regions[r].nb_condamnations++
    if (a.statut === "mise_en_examen") regions[r].nb_mises_en_examen++
    if (a.statut === "enquete") regions[r].nb_enquetes++
  }
  return Object.values(regions).sort((a, b) => b.nb_affaires - a.nb_affaires)
}

export function getGouvernement(): MembreGouvernement[] {
  try {
    return readJSON<MembreGouvernement[]>("gouvernement.json")
  } catch {
    return []
  }
}

let _gouvMap: Map<string, MembreGouvernement> | null = null

function getGouvernementMap(): Map<string, MembreGouvernement> {
  if (!_gouvMap) {
    _gouvMap = new Map(getGouvernement().map((m) => [m.wikidata_id, m]))
  }
  return _gouvMap
}

export function getMembreGouvernement(wikidataId: string): MembreGouvernement | undefined {
  return getGouvernementMap().get(wikidataId)
}

export interface AffaireEluLink {
  id: string
  prenom: string
  nom: string
  parti: string
}

export function getAffairesElus(): Record<string, AffaireEluLink[]> {
  try {
    return readJSON<Record<string, AffaireEluLink[]>>("affaires-elus.json")
  } catch {
    return {}
  }
}

export function getPartisDetail(): PartiDetail[] {
  try {
    return readJSON<PartiDetail[]>("partis.json")
  } catch {
    return []
  }
}

export function getPersonnalites(): Personnalite[] {
  try {
    return readJSON<Personnalite[]>("personnalites.json")
  } catch {
    return []
  }
}

// Données pour l'hémicycle (députés uniquement)
export interface HemicycleSeatData {
  id: string
  prenom: string
  nom: string
  parti: string
  score: number
  nb_affaires: number
  place_en_hemicycle?: number
}

export function getHemicycleData(elus: Elu[]): HemicycleSeatData[] {
  return elus
    .filter((e) => e.mandat === "Député(e)" && e.place_en_hemicycle)
    .map((e) => ({
      id: e.id,
      prenom: e.prenom,
      nom: e.nom,
      parti: e.parti,
      score: e.score,
      nb_affaires: e.nb_affaires,
      place_en_hemicycle: e.place_en_hemicycle,
    }))
}
