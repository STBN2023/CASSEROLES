"use client"

import { useState, useMemo } from "react"
import type { Personnalite, Affaire } from "@/lib/types"
import { SCORE_LABELS, SCORE_COLORS, SCORE_DOTS, STATUT_LABELS, STATUT_COLORS } from "@/lib/types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const PAGE_SIZE = 30

interface Props {
  personnalites: Personnalite[]
  affaires: Affaire[]
}

export function PersonnalitesClient({ personnalites, affaires }: Props) {
  const [search, setSearch] = useState("")
  const [scoreFilter, setScoreFilter] = useState("tous")
  const [page, setPage] = useState(0)

  const affairesById = useMemo(() => {
    const map: Record<string, Affaire> = {}
    for (const a of affaires) map[a.id] = a
    return map
  }, [affaires])

  const filtered = useMemo(() => {
    let result = personnalites
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.nom_complet.toLowerCase().includes(q) ||
          p.poste.toLowerCase().includes(q)
      )
    }
    if (scoreFilter !== "tous") {
      const s = Number(scoreFilter)
      result = result.filter((p) => p.score === s)
    }
    return result
  }, [personnalites, search, scoreFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Rechercher une personnalite..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="sm:w-72"
          aria-label="Rechercher une personnalite"
        />
        <Select value={scoreFilter} onValueChange={(v) => { if (v) { setScoreFilter(v); setPage(0) } }}>
          <SelectTrigger className="sm:w-48" aria-label="Filtrer par score">
            {scoreFilter === "tous" ? "Tous scores" : `Score ${scoreFilter}`}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous scores</SelectItem>
            <SelectItem value="3">Condamne(e)</SelectItem>
            <SelectItem value="2">Mis(e) en examen</SelectItem>
            <SelectItem value="1">Enquete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Compteur */}
      <p className="text-sm text-gray-500">
        {filtered.length} personnalite{filtered.length > 1 ? "s" : ""} trouvee{filtered.length > 1 ? "s" : ""}
      </p>

      {/* Liste */}
      <div className="space-y-3">
        {paginated.map((p) => {
          const affairesList = p.affaires
            .map((id) => affairesById[id])
            .filter(Boolean)
          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-gray-900">{p.nom_complet}</h2>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SCORE_COLORS[p.score as keyof typeof SCORE_COLORS]}`}>
                      {SCORE_DOTS[p.score as keyof typeof SCORE_DOTS]} {SCORE_LABELS[p.score as keyof typeof SCORE_LABELS]}
                    </span>
                  </div>
                  {p.poste && (
                    <p className="text-sm text-gray-500 mt-0.5">{p.poste}</p>
                  )}
                </div>
                <div className="text-right text-sm text-gray-500 whitespace-nowrap">
                  {p.nb_affaires} affaire{p.nb_affaires > 1 ? "s" : ""}
                </div>
              </div>

              {/* Affaires detail */}
              {affairesList.length > 0 && (
                <div className="mt-3 space-y-2">
                  {affairesList.map((a) => (
                    <div key={a.id} className="text-sm border-l-2 border-gray-200 pl-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUT_COLORS[a.statut]}>
                          {STATUT_LABELS[a.statut]}
                        </Badge>
                        {a.type && <span className="text-gray-700">{a.type}</span>}
                        {a.date && <span className="text-gray-400">{a.date.slice(0, 4)}</span>}
                      </div>
                      {a.resume && (
                        <p className="text-gray-500 mt-0.5 line-clamp-2">{a.resume}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Sources */}
              {p.sources.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {p.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#000091] hover:underline"
                    >
                      Source {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="px-2 py-1 text-sm rounded border disabled:opacity-30"
          >
            &laquo;
          </button>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-2 py-1 text-sm rounded border disabled:opacity-30"
          >
            &lsaquo;
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 text-sm rounded border disabled:opacity-30"
          >
            &rsaquo;
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 text-sm rounded border disabled:opacity-30"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  )
}
