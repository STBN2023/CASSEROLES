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
  const [region, setRegion] = useState("")
  const [detectedRegion, setDetectedRegion] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const tickerRef = useRef<HTMLDivElement>(null)

  // Géolocalisation IP → région
  useEffect(() => {
    const saved = localStorage.getItem("casseroles_region")
    if (saved) {
      setRegion(saved)
      setDetectedRegion(saved)
      return
    }

    fetch("https://get.geojs.io/v1/ip/geo.json")
      .then((r) => r.json())
      .then((data) => {
        const r = data.region || ""
        // Mapper les noms GeoJS vers nos régions
        const mapping: Record<string, string> = {
          "Île-de-France": "Île-de-France",
          "Ile-de-France": "Île-de-France",
          "Auvergne-Rhône-Alpes": "Auvergne-Rhône-Alpes",
          "Bourgogne-Franche-Comté": "Bourgogne-Franche-Comté",
          "Bretagne": "Bretagne",
          "Centre-Val de Loire": "Centre-Val de Loire",
          "Corse": "Corse",
          "Grand Est": "Grand Est",
          "Hauts-de-France": "Hauts-de-France",
          "Normandie": "Normandie",
          "Nouvelle-Aquitaine": "Nouvelle-Aquitaine",
          "Occitanie": "Occitanie",
          "Pays de la Loire": "Pays de la Loire",
          "Provence-Alpes-Côte d'Azur": "Provence-Alpes-Côte d'Azur",
        }
        const matched = mapping[r] || REGIONS.find((reg) => r.toLowerCase().includes(reg.toLowerCase().slice(0, 8))) || "Île-de-France"
        setRegion(matched)
        setDetectedRegion(matched)
      })
      .catch(() => {
        setRegion("Île-de-France")
        setDetectedRegion("Île-de-France")
      })
  }, [])

  // Charger les maires de la région
  const fetchMaires = useCallback(async (r: string) => {
    if (!r) return
    setLoading(true)
    try {
      const res = await fetch(`/api/maires?region=${encodeURIComponent(r)}`)
      const data = await res.json()
      setMaires(data.items || [])
    } catch {
      setMaires([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (region) fetchMaires(region)
  }, [region, fetchMaires])

  const handleRegionChange = (r: string) => {
    setRegion(r)
    localStorage.setItem("casseroles_region", r)
    setShowSettings(false)
  }

  if (loading && maires.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#000091] text-white shadow-lg">
      <div className="flex items-center h-10">
        {/* Label */}
        <div className="flex-shrink-0 px-3 text-xs font-semibold bg-[#000091] border-r border-white/20 h-full flex items-center gap-2">
          <span className="hidden lg:inline">Municipales 2026 — Maires élus en {region}</span>
          <span className="hidden sm:inline lg:hidden">Municipales 2026 — {region}</span>
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
                {/* Dupliquer pour boucle infinie */}
                {[...maires, ...maires].map((m, i) => (
                  <Link
                    key={`${m.id}-${i}`}
                    href={`/elus/${encodeURIComponent(m.id)}`}
                    className="inline-flex items-center gap-1.5 text-xs hover:text-yellow-300 transition-colors no-underline text-white/90"
                  >
                    <span className="font-medium">{m.prenom} {m.nom}</span>
                    <span className="opacity-60">·</span>
                    <span className="opacity-70">{m.territoire}</span>
                    {m.score > 0 && (
                      <span className={`text-[10px] ${m.score === 3 ? "text-red-300" : m.score === 2 ? "text-orange-300" : "text-yellow-300"}`}>
                        {SCORE_DOTS[m.score]}
                      </span>
                    )}
                  </Link>
                ))}
              </>
            ) : (
              <span className="text-xs opacity-60 px-4">Aucun maire trouvé pour cette région</span>
            )}
          </div>
        </div>

        {/* Bouton paramétrage */}
        <div className="flex-shrink-0 relative">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="h-10 px-3 text-xs hover:bg-white/10 transition-colors flex items-center gap-1 border-l border-white/20"
            title="Choisir une région"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">Région</span>
          </button>

          {/* Dropdown régions */}
          {showSettings && (
            <div className="absolute bottom-full right-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 w-64 max-h-80 overflow-y-auto">
              <div className="p-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 px-2 py-1">Choisir une région</p>
              </div>
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => handleRegionChange(r)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${
                    r === region ? "bg-blue-50 text-[#000091] font-medium" : "text-gray-700"
                  }`}
                >
                  {r}
                  {r === detectedRegion && (
                    <span className="ml-1 text-[10px] text-gray-400">(détectée)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
