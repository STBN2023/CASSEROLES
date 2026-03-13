"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import type { Score, Niveau } from "@/lib/types"
import { SCORE_LABELS, SCORE_COLORS, SCORE_DOTS, NIVEAU_LABELS } from "@/lib/types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface EluRow {
  id: string
  nom: string
  prenom: string
  parti: string
  niveau: Niveau
  score: Score
  nb_affaires: number
  territoire: string
  mandat: string
}

interface ApiResponse {
  items: EluRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  partis?: string[]
}

type SortKey = "nom" | "parti" | "niveau" | "score" | "nb_affaires"

const PAGE_SIZE = 50

const NIVEAU_OPTIONS: Record<string, string> = {
  tous: "Tous niveaux",
  local: "Local",
  national: "National",
  europeen: "Européen",
}

const SCORE_OPTIONS: Record<string, string> = {
  tous: "Tous scores",
  "3": "Score 3 – Condamné(e)",
  "2": "Score 2 – Mis(e) en examen",
  "1": "Score 1 – Enquête",
  "0": "Score 0 – Aucune affaire",
}

export function ElusTable() {
  const searchParams = useSearchParams()

  const [items, setItems] = useState<EluRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [partis, setPartis] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [niveau, setNiveau] = useState(searchParams.get("niveau") ?? "tous")
  const [parti, setParti] = useState(searchParams.get("parti") ?? "tous")
  const [score, setScore] = useState(searchParams.get("score") ?? "tous")
  const [sortKey, setSortKey] = useState<SortKey>("score")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Fetch from API
  const fetchElus = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (debouncedSearch) params.set("search", debouncedSearch)
    if (niveau !== "tous") params.set("niveau", niveau)
    if (parti !== "tous") params.set("parti", parti)
    if (score !== "tous") params.set("score", score)
    params.set("sort", sortKey)
    params.set("order", sortAsc ? "asc" : "desc")
    params.set("page", String(page))
    params.set("pageSize", String(PAGE_SIZE))
    // Request partis list only on first load
    if (partis.length === 0) params.set("meta", "1")

    try {
      const res = await fetch(`/api/elus?${params.toString()}`)
      const data: ApiResponse = await res.json()
      setItems(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      if (data.partis) setPartis(data.partis)
    } catch (err) {
      console.error("Erreur chargement élus:", err)
      setItems([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, niveau, parti, score, sortKey, sortAsc, page, partis.length])

  useEffect(() => {
    fetchElus()
  }, [fetchElus])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-gray-600 ml-1">{sortAsc ? "↑" : "↓"}</span>
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <Input
          placeholder="Rechercher un élu, parti, commune..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-72 bg-white"
        />
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Select value={niveau} onValueChange={(v) => { if (v) { setNiveau(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-40 bg-white">
              <span className="truncate">{NIVEAU_OPTIONS[niveau] || niveau}</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(NIVEAU_OPTIONS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={parti} onValueChange={(v) => { if (v) { setParti(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-48 bg-white">
              <span className="truncate">{parti === "tous" ? "Tous partis" : parti}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous partis</SelectItem>
              {partis.slice(0, 40).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={score} onValueChange={(v) => { if (v) { setScore(v); setPage(1) } }}>
            <SelectTrigger className="w-full sm:w-52 bg-white">
              <span className="truncate">{SCORE_OPTIONS[score] || score}</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SCORE_OPTIONS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Résultats */}
      <p className="text-sm text-gray-500">
        {loading ? (
          <span className="inline-block w-16 h-4 bg-gray-100 rounded animate-pulse" />
        ) : (
          <>{total.toLocaleString("fr-FR")} élu{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}</>
        )}
      </p>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("nom")}
                >
                  Élu <SortIcon k="nom" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden md:table-cell"
                  onClick={() => handleSort("parti")}
                >
                  Parti <SortIcon k="parti" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden sm:table-cell"
                  onClick={() => handleSort("niveau")}
                >
                  Niveau <SortIcon k="niveau" />
                </th>
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("score")}
                >
                  Score <SortIcon k="score" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden lg:table-cell"
                  onClick={() => handleSort("nb_affaires")}
                >
                  Affaires <SortIcon k="nb_affaires" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                // Skeleton rows
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="h-4 w-36 bg-gray-100 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-gray-50 rounded animate-pulse mt-1" />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-12 bg-gray-100 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div className="h-4 w-6 bg-gray-100 rounded animate-pulse ml-auto" />
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  {items.map((elu) => (
                    <tr key={elu.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/elus/${encodeURIComponent(elu.id)}`}
                          className="font-medium text-gray-900 hover:text-[#000091]"
                        >
                          {elu.prenom} {elu.nom}
                        </Link>
                        {(elu.mandat || elu.territoire) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {elu.mandat}{elu.mandat && elu.territoire ? " · " : ""}{elu.territoire}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-gray-700 text-xs">{elu.parti}</span>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {NIVEAU_LABELS[elu.niveau]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={`text-xs tracking-widest ${SCORE_COLORS[elu.score]}`}>
                          {SCORE_DOTS[elu.score]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-600 hidden lg:table-cell">
                        {elu.nb_affaires > 0 ? elu.nb_affaires : "–"}
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                        Aucun élu ne correspond à ces critères.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500">
            Page {page} / {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
