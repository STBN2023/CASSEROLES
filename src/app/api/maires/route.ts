import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import type { Elu } from "@/lib/types"

const DEPT_REGION: Record<string, string> = {
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

let elusCache: Elu[] | null = null

function getElus(): Elu[] {
  if (!elusCache) {
    const content = readFileSync(join(process.cwd(), "public", "data", "elus.json"), "utf-8")
    elusCache = JSON.parse(content) as Elu[]
  }
  return elusCache
}

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get("region") ?? ""

  const elus = getElus()

  // Filtrer les maires de la région
  const depts = region
    ? Object.entries(DEPT_REGION)
        .filter(([, r]) => r === region)
        .map(([d]) => d)
    : []

  const maires = elus.filter((e) => {
    if (e.mandat !== "Maire") return false
    if (region && !depts.includes(e.code_departement)) return false
    return true
  })

  // Retourner un sous-ensemble léger, trié par score desc puis nom
  const sorted = [...maires].sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom))

  const items = sorted.slice(0, 200).map((e) => ({
    id: e.id,
    nom: e.nom,
    prenom: e.prenom,
    territoire: e.territoire,
    score: e.score,
    nb_affaires: e.nb_affaires,
  }))

  // Liste des régions disponibles
  const regions = [...new Set(Object.values(DEPT_REGION))].sort()

  return NextResponse.json({ items, total: maires.length, regions }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
