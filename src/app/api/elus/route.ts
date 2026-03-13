import { NextRequest, NextResponse } from "next/server"
import { readFileSync } from "fs"
import { join } from "path"
import type { Elu } from "@/lib/types"

// Charger les élus une seule fois en mémoire (module-level cache)
let elusCache: Elu[] | null = null
let partisCache: string[] | null = null

function getElusData(): Elu[] {
  if (!elusCache) {
    const content = readFileSync(
      join(process.cwd(), "public", "data", "elus.json"),
      "utf-8"
    )
    elusCache = JSON.parse(content) as Elu[]
  }
  return elusCache
}

function getPartisData(): string[] {
  if (!partisCache) {
    const elus = getElusData()
    partisCache = [...new Set(elus.map((e) => e.parti))].sort()
  }
  return partisCache
}

type SortKey = "nom" | "parti" | "niveau" | "score" | "nb_affaires"
const VALID_SORT_KEYS: SortKey[] = ["nom", "parti", "niveau", "score", "nb_affaires"]

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const search = params.get("search") ?? ""
  const niveau = params.get("niveau") ?? "tous"
  const parti = params.get("parti") ?? "tous"
  const score = params.get("score") ?? "tous"
  const sortKey = (params.get("sort") ?? "score") as SortKey
  const sortAsc = params.get("order") === "asc"
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1)
  const pageSize = Math.min(100, Math.max(10, parseInt(params.get("pageSize") ?? "50", 10) || 50))
  const meta = params.get("meta") === "1" // Renvoyer les partis disponibles

  const elus = getElusData()

  // Filtrage
  let result = elus

  if (search) {
    const q = search.toLowerCase()
    result = result.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.parti.toLowerCase().includes(q) ||
        e.territoire.toLowerCase().includes(q)
    )
  }

  if (niveau !== "tous") {
    result = result.filter((e) => e.niveau === niveau)
  }

  if (parti !== "tous") {
    result = result.filter((e) => e.parti === parti)
  }

  if (score !== "tous") {
    const scoreNum = Number(score)
    if (!isNaN(scoreNum)) {
      result = result.filter((e) => e.score === scoreNum)
    }
  }

  // Tri
  const validSort = VALID_SORT_KEYS.includes(sortKey) ? sortKey : "score"
  result = [...result].sort((a, b) => {
    let va: string | number = a[validSort]
    let vb: string | number = b[validSort]
    if (typeof va === "string") va = va.toLowerCase()
    if (typeof vb === "string") vb = vb.toLowerCase()
    if (va < vb) return sortAsc ? -1 : 1
    if (va > vb) return sortAsc ? 1 : -1
    return 0
  })

  const total = result.length
  const totalPages = Math.ceil(total / pageSize)
  const paged = result.slice((page - 1) * pageSize, page * pageSize)

  // Réponse légère : seulement les champs nécessaires pour le tableau
  const items = paged.map((e) => ({
    id: e.id,
    nom: e.nom,
    prenom: e.prenom,
    parti: e.parti,
    niveau: e.niveau,
    score: e.score,
    nb_affaires: e.nb_affaires,
    territoire: e.territoire,
    mandat: e.mandat,
    nb_mandats: e.mandats?.length ?? 1,
  }))

  const response: Record<string, unknown> = {
    items,
    total,
    page,
    pageSize,
    totalPages,
  }

  if (meta) {
    response.partis = getPartisData()
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  })
}
