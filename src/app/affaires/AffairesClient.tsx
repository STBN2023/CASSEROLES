"use client"

import { useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import type { Affaire } from "@/lib/types"
import { STATUT_LABELS, STATUT_COLORS } from "@/lib/types"
import type { AffaireEluLink } from "@/lib/data"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const PAGE_SIZE = 30

function formatDuree(mois: number): string {
  const ans = Math.floor(mois / 12)
  const m = mois % 12
  if (ans > 0 && m > 0) return `${ans} an${ans > 1 ? "s" : ""} ${m} mois`
  if (ans > 0) return `${ans} an${ans > 1 ? "s" : ""}`
  return `${m} mois`
}

function formatPrison(fermeMois: number | null, sursisMois: number | null): string {
  const ferme = fermeMois ?? 0
  const sursis = sursisMois ?? 0
  const total = ferme + sursis
  if (total === 0) return ""
  const base = formatDuree(total)
  if (ferme > 0 && sursis > 0) return `${base} (dont ${formatDuree(ferme)} ferme)`
  if (sursis > 0 && ferme === 0) return `${base} avec sursis`
  return `${base} ferme`
}

const STATUT_OPTIONS: Record<string, string> = {
  tous: "Tous statuts",
  condamnation: "Condamnation",
  mise_en_examen: "Mise en examen",
  enquete: "Enquête",
  relaxe: "Relaxe",
  classe_sans_suite: "Classé sans suite",
}

const SOURCE_OPTIONS: Record<string, string> = {
  tous: "Toutes sources",
  ti: "TI France",
  wikidata: "Wikidata",
}

interface AffairesClientProps {
  affaires: Affaire[]
  affaireToElus: Record<string, AffaireEluLink[]>
}

export function AffairesClient({ affaires, affaireToElus }: AffairesClientProps) {
  const searchParams = useSearchParams()

  const [search, setSearch] = useState("")
  const [statut, setStatut] = useState(searchParams.get("statut") ?? "tous")
  const [region, setRegion] = useState(searchParams.get("region") ?? "tous")
  const [type, setType] = useState(searchParams.get("type") ?? "tous")
  const [source, setSource] = useState(searchParams.get("source") ?? "tous")
  const [page, setPage] = useState(1)

  const regions = useMemo(
    () => [...new Set(affaires.map((a) => a.region).filter(Boolean))].sort(),
    [affaires]
  )
  const types = useMemo(
    () => [...new Set(affaires.map((a) => a.type).filter(Boolean))].sort(),
    [affaires]
  )

  const filtered = useMemo(() => {
    let r = affaires
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((a) => {
        const matchAffaire =
          a.resume.toLowerCase().includes(q) ||
          a.lieu.toLowerCase().includes(q) ||
          a.departement.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          (a.personnes && a.personnes.toLowerCase().includes(q))
        const elus = affaireToElus[a.id] || []
        const matchElu = elus.some(
          (e) =>
            e.nom.toLowerCase().includes(q) ||
            e.prenom.toLowerCase().includes(q) ||
            `${e.prenom} ${e.nom}`.toLowerCase().includes(q) ||
            e.parti.toLowerCase().includes(q)
        )
        return matchAffaire || matchElu
      })
    }
    if (statut !== "tous") r = r.filter((a) => a.statut === statut)
    if (region !== "tous") r = r.filter((a) => a.region === region)
    if (type !== "tous") r = r.filter((a) => a.type === type)
    if (source !== "tous") {
      if (source === "wikidata") r = r.filter((a) => a.id.startsWith("wd_"))
      else if (source === "ti") r = r.filter((a) => !a.id.startsWith("wd_"))
    }
    return r
  }, [affaires, affaireToElus, search, statut, region, type, source])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
        <Input
          placeholder="Rechercher par nom, parti, lieu..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full sm:max-w-72 bg-white"
        />
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <Select value={statut} onValueChange={(v) => { if (v) { setStatut(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-44 bg-white">
              <span className="truncate">{STATUT_OPTIONS[statut] || statut}</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUT_OPTIONS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={(v) => { if (v) { setType(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-52 bg-white">
              <span className="truncate">{type === "tous" ? "Tous types" : type}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={region} onValueChange={(v) => { if (v) { setRegion(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-48 bg-white">
              <span className="truncate">{region === "tous" ? "Toutes régions" : region}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Toutes régions</SelectItem>
              {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => { if (v) { setSource(v); setPage(1) } }}>
            <SelectTrigger className="w-[calc(50%-4px)] sm:w-44 bg-white">
              <span className="truncate">{SOURCE_OPTIONS[source] || source}</span>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOURCE_OPTIONS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {filtered.length.toLocaleString("fr-FR")} affaire{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="space-y-4">
        {paged.map((affaire) => {
          const elusLies = affaireToElus[affaire.id] || []
          return (
            <div key={affaire.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`text-xs border ${STATUT_COLORS[affaire.statut]}`}>
                    {STATUT_LABELS[affaire.statut]}
                  </Badge>
                  <span className="text-xs font-medium text-gray-700">{affaire.type}</span>
                  {affaire.date && (
                    <span className="text-xs text-gray-400">{affaire.date.slice(0, 4)}</span>
                  )}
                  <Badge variant="outline" className="text-[10px] text-gray-400">
                    {affaire.id.startsWith("wd_") ? "Wikidata" : affaire.id.startsWith("wiki_") ? "Wikipedia" : "TI France"}
                  </Badge>
                </div>
                <div className="text-right text-xs text-gray-400 flex-shrink-0">
                  <p>{affaire.departement}</p>
                  <p>{affaire.region}</p>
                </div>
              </div>

              {elusLies.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                  {elusLies.map((elu) => (
                    <div key={elu.id} className="flex items-center gap-1.5">
                      <Link
                        href={`/elus/${encodeURIComponent(elu.id)}`}
                        className="text-sm font-semibold text-[#000091] hover:underline"
                      >
                        {elu.prenom} {elu.nom}
                      </Link>
                      <Badge variant="outline" className="text-[10px] text-gray-500">
                        {elu.parti}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              {elusLies.length === 0 && affaire.personnes && (
                <p className="text-xs font-medium text-gray-600 mb-2">
                  <span className="text-gray-400">Personnes impliquées : </span>
                  {affaire.personnes}
                </p>
              )}

              <p className="text-sm text-gray-700 leading-relaxed">{affaire.resume}</p>

              {(affaire.peine_prison_ferme_mois || affaire.peine_prison_sursis_mois || affaire.amende_euros || affaire.ineligibilite_mois) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(affaire.peine_prison_ferme_mois || affaire.peine_prison_sursis_mois) && (
                    <Badge variant="outline" className="text-[11px] text-[#ce0500] border-[#fcc0bf] bg-[#fee9e9]">
                      {formatPrison(affaire.peine_prison_ferme_mois, affaire.peine_prison_sursis_mois)}
                    </Badge>
                  )}
                  {affaire.amende_euros && (
                    <Badge variant="outline" className="text-[11px] text-[#b34000] border-[#f9c09a] bg-[#ffe9e6]">
                      {affaire.amende_euros.toLocaleString("fr-FR")} € d&apos;amende
                    </Badge>
                  )}
                  {affaire.ineligibilite_mois && (
                    <Badge variant="outline" className="text-[11px] text-[#716043] border-[#f5d98b] bg-[#fef7da]">
                      {formatDuree(affaire.ineligibilite_mois)} d&apos;inéligibilité
                    </Badge>
                  )}
                </div>
              )}

              {affaire.juridiction && (
                <p className="text-xs text-gray-400 mt-2">Juridiction : {affaire.juridiction}</p>
              )}
              {affaire.infractions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {affaire.infractions.slice(0, 4).map((inf, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{inf}</Badge>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-3">
                {affaire.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#000091] underline hover:opacity-70"
                  >
                    {affaire.source_label || "Source"} ↗
                  </a>
                ))}
              </div>
            </div>
          )
        })}
        {paged.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            Aucune affaire ne correspond à ces critères.
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Page {page} / {totalPages}</p>
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
    </>
  )
}
