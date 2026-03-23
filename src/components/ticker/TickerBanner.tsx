"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { SCORE_DOTS } from "@/lib/types"
import type { Score } from "@/lib/types"

interface Maire {
  id: string
  nom: string
  prenom: string
  territoire: string
  score: Score
  nb_affaires: number
}

const REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Guadeloupe",
  "Guyane",
  "Hauts-de-France",
  "La Réunion",
  "Martinique",
  "Mayotte",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
  "Île-de-France",
]

export default function TickerBanner() {
  const [maires, setMaires] = useState<Maire[]>([])
  const [region, setRegion] = useState("") // "" = toutes régions
  const [casserolesOnly, setCasserolesOnly] = useState(true) // par défaut : casseroles uniquement
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const tickerRef = useRef<HTMLDivElement>(null)

  // Charger les préférences sauvegardées
  useEffect(() => {
    const savedRegion = localStorage.getItem("casseroles_ticker_region") ?? ""
    const savedMode = localStorage.getItem("casseroles_ticker_mode")
    setRegion(savedRegion)
    if (savedMode === "tous") setCasserolesOnly(false)
  }, [])

  // Charger les maires
  const fetchMaires = useCallback(async (r: string, casseroles: boolean) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (r) params.set("region", r)
      if (!casseroles) params.set("casseroles", "0")
      const res = await fetch(`/api/maires?${params}`)
      const data = await res.json()
      setMaires(data.items || [])
    } catch {
      setMaires([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMaires(region, casserolesOnly)
  }, [region, casserolesOnly, fetchMaires])

  const handleRegionChange = (r: string) => {
    setRegion(r)
    localStorage.setItem("casseroles_ticker_region", r)
  }

  const handleModeChange = (casseroles: boolean) => {
    setCasserolesOnly(casseroles)
    localStorage.setItem("casseroles_ticker_mode", casseroles ? "casseroles" : "tous")
  }

  if (loading && maires.length === 0) return null

  const label = casserolesOnly
    ? `Municipales 2026 — Maires avec casseroles${region ? ` en ${region}` : ""}`
    : `Municipales 2026 — ${region ? `Maires élus en ${region}` : "Tous les maires"}`

  const labelShort = casserolesOnly
    ? `Casseroles${region ? ` · ${region}` : ""}`
    : region || "Tous les maires"

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#000091] text-white shadow-lg">
      <div className="flex items-center h-10">
        {/* Label */}
        <div className="flex-shrink-0 px-3 text-xs font-semibold bg-[#000091] border-r border-white/20 h-full flex items-center gap-2">
          <span className="hidden lg:inline">{label}</span>
          <span className="hidden sm:inline lg:hidden">{labelShort}</span>
          <span className="sm:hidden">Municipales 2026</span>
          <span className="text-[10px] opacity-60 hidden sm:inline">({maires.length})</span>
        </div>

        {/* Ticker défilant */}
        <div className="flex-1 overflow-hidden relative h-full">
          <div
            ref={tickerRef}
            className="ticker-scroll flex items-center gap-6 h-full whitespace-nowrap absolute"
          >
            {maires.length > 0 ? (
              <>
                {[...maires, ...maires].map((m, i) => (
                  <Link
                    key={`${m.id}-${i}`}
                    href={`/elus/${encodeURIComponent(m.id)}`}
                    className={`inline-flex items-center gap-1.5 text-xs hover:text-yellow-300 transition-colors no-underline ${m.score >= 3 ? "text-red-400 font-semibold" : "text-white/90"}`}
                  >
                    {m.score >= 3 && (
                      <span className="bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">C</span>
                    )}
                    <span className={m.score >= 3 ? "font-bold" : "font-medium"}>{m.prenom} {m.nom}</span>
                    <span className="opacity-60">·</span>
                    <span className={m.score >= 3 ? "opacity-90" : "opacity-70"}>{m.territoire}</span>
                    {m.score > 0 && m.score < 3 && (
                      <span className={`text-[10px] ${m.score === 2 ? "text-orange-300" : "text-yellow-300"}`}>
                        {SCORE_DOTS[m.score]}
                      </span>
                    )}
                  </Link>
                ))}
              </>
            ) : (
              <span className="text-xs opacity-60 px-4">Aucun maire avec casseroles dans cette région</span>
            )}
          </div>
        </div>

        {/* Bouton paramétrage */}
        <div className="flex-shrink-0 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="h-10 px-3 text-xs hover:bg-white/10 transition-colors flex items-center gap-1 border-l border-white/20"
            title="Paramètres du bandeau"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Dropdown paramètres */}
          {showSettings && (
            <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 w-72 max-h-96 overflow-y-auto">
              {/* Mode d'affichage */}
              <div className="p-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 mb-2">Affichage</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleModeChange(true)}
                    className={`flex-1 text-xs px-3 py-1.5 rounded transition-colors ${
                      casserolesOnly
                        ? "bg-[#000091] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Casseroles uniquement
                  </button>
                  <button
                    onClick={() => handleModeChange(false)}
                    className={`flex-1 text-xs px-3 py-1.5 rounded transition-colors ${
                      !casserolesOnly
                        ? "bg-[#000091] text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Tous les maires
                  </button>
                </div>
              </div>

              {/* Choix région */}
              <div className="p-2">
                <p className="text-xs font-semibold text-gray-600 px-2 py-1">Région</p>
                <button
                  onClick={() => { handleRegionChange(""); setShowSettings(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    !region ? "bg-blue-50 text-[#000091] font-medium" : "text-gray-700"
                  }`}
                >
                  Toute la France
                </button>
                {REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { handleRegionChange(r); setShowSettings(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${
                      r === region ? "bg-blue-50 text-[#000091] font-medium" : "text-gray-700"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
