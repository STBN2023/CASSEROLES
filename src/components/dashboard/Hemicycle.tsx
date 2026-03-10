"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { HEMICYCLE_SEATS } from "./hemicycle-seats"

export interface HemicycleSeat {
  id: string
  prenom: string
  nom: string
  parti: string
  score: number
  nb_affaires: number
  place_en_hemicycle?: number
}

interface HemicycleProps {
  seats: HemicycleSeat[]
}

// Placement dans l'hémicycle vu depuis la tribune du président
// Gauche → Droite (ordre officiel XVIIe législature, 2024)
// Sources: assemblee-nationale.fr, LCP
const PARTI_ORDER: Record<string, number> = {
  "Gauche démocrate et républicaine": 0,  // GDR – extrême gauche
  "Nouveau Parti anticapitaliste": 1,     // NPA (apparenté extrême gauche)
  "La France Insoumise": 2,               // LFI-NFP
  "Parti Socialiste": 3,                  // SOC
  "Les Écologistes": 4,                   // EcoS
  "Libertés, Indépendants, Outre-mer et Territoires": 5,  // LIOT – centre
  "Renaissance": 6,                       // EPR (Ensemble pour la République)
  "MoDem": 7,                             // Dem (Les Démocrates)
  "Horizons": 8,                          // HOR
  "Les Républicains": 9,                  // DR (Droite républicaine)
  "Union des Droites pour la République": 10,  // UDR (Ciotti)
  "Rassemblement National": 11,           // RN
  "Non inscrit": 12,                      // NI
  "Autre / Non renseigné": 13,            // Non renseigné (rangs du haut)
}

// Couleurs officielles / conventionnelles des partis
const PARTI_COLORS: Record<string, string> = {
  "Gauche démocrate et républicaine": "#c9462c",  // rouge PCF
  "Nouveau Parti anticapitaliste": "#bb1840",
  "La France Insoumise": "#cc2443",               // rouge LFI
  "Parti Socialiste": "#e8426f",                   // rose PS
  "Les Écologistes": "#00a85a",                    // vert EELV
  "Libertés, Indépendants, Outre-mer et Territoires": "#8cc8a0",
  "Renaissance": "#ffcc00",                        // jaune Renaissance
  "MoDem": "#ff9900",                              // orange MoDem
  "Horizons": "#00b7eb",                           // bleu ciel Horizons
  "Les Républicains": "#0066cc",                   // bleu LR
  "Union des Droites pour la République": "#3367a7", // bleu UDR (Ciotti)
  "Rassemblement National": "#0d2c6c",             // bleu marine RN
  "Non inscrit": "#999999",
  "Autre / Non renseigné": "#cccccc",
}

// SVG viewBox derived from the Assemblée Nationale official hemicycle
// Coordinates extracted from assemblee-nationale.fr/dyn/vos-deputes/hemicycle
const VB_X = 0
const VB_Y = 0
const VB_W = 237
const VB_H = 135
const SEAT_R = 2.6     // Seat circle radius
const SEAT_R_HOVER = 4.2
const SEAT_R_AFFAIRE = 3.1

/**
 * Compute fallback (x, y) positions for seats without a real hemicycle place.
 * Uses concentric arcs layout, sorted by party (left→right).
 */
function computeFallbackPositions(
  total: number,
): { x: number; y: number }[] {
  const numRows = Math.max(6, Math.min(14, Math.ceil(total / 50)))
  const cx = VB_W / 2
  const cy = VB_H + 10
  const rInner = 30
  const rOuter = VB_H - 5
  const rowHeight = (rOuter - rInner) / numRows
  const seatRadius = rowHeight * 0.38

  const rowRadii = Array.from({ length: numRows }, (_, i) => rInner + (i + 0.5) * rowHeight)
  const totalArc = rowRadii.reduce((sum, r) => sum + r, 0)
  const rawSeatsPerRow = rowRadii.map((r) => (r / totalArc) * total)
  const seatsPerRow = rawSeatsPerRow.map((n) => Math.round(n))
  let diff = total - seatsPerRow.reduce((a, b) => a + b, 0)
  for (let i = seatsPerRow.length - 1; diff !== 0 && i >= 0; i--) {
    const add = diff > 0 ? 1 : -1
    seatsPerRow[i] += add
    diff -= add
  }

  const positions: { x: number; y: number }[] = []
  for (let row = 0; row < numRows; row++) {
    const r = rowRadii[row]
    const n = seatsPerRow[row]
    const padding = seatRadius / r
    for (let j = 0; j < n; j++) {
      const angle = Math.PI - padding - (j / Math.max(n - 1, 1)) * (Math.PI - 2 * padding)
      positions.push({
        x: cx + r * Math.cos(angle),
        y: cy - r * Math.sin(angle),
      })
    }
  }
  return positions
}

export function Hemicycle({ seats }: HemicycleProps) {
  const [hovered, setHovered] = useState<HemicycleSeat | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Separate seats with and without real hemicycle positions
  const { positioned, fallback } = useMemo(() => {
    const positioned: (HemicycleSeat & { x: number; y: number })[] = []
    const unpositioned: HemicycleSeat[] = []

    for (const seat of seats) {
      const place = seat.place_en_hemicycle
      if (place && HEMICYCLE_SEATS[place]) {
        const [x, y] = HEMICYCLE_SEATS[place]
        positioned.push({ ...seat, x, y })
      } else {
        unpositioned.push(seat)
      }
    }

    // For seats without real positions, use fallback algorithm
    const fallbackPositions = computeFallbackPositions(unpositioned.length)
    // Sort by party for coherent fallback placement
    const sortedUnpositioned = [...unpositioned].sort((a, b) => {
      const orderA = PARTI_ORDER[a.parti] ?? 12
      const orderB = PARTI_ORDER[b.parti] ?? 12
      if (orderA !== orderB) return orderA - orderB
      return b.score - a.score
    })
    const fallback = sortedUnpositioned.map((seat, i) => ({
      ...seat,
      x: fallbackPositions[i]?.x ?? 0,
      y: fallbackPositions[i]?.y ?? 0,
    }))

    return { positioned, fallback }
  }, [seats])

  const allSeats = useMemo(() => [...positioned, ...fallback], [positioned, fallback])

  // Count concerned
  const nbConcernes = seats.filter((s) => s.score > 0).length

  // Unique parties present (for legend)
  const partiesPresent = useMemo(() => {
    const set = new Set(seats.map((s) => s.parti))
    return Object.entries(PARTI_COLORS)
      .filter(([p]) => set.has(p))
      .sort(([a], [b]) => (PARTI_ORDER[a] ?? 99) - (PARTI_ORDER[b] ?? 99))
  }, [seats])

  return (
    <div className="relative hemicycle-container">
      <svg
        viewBox={`${VB_X} ${VB_Y} ${VB_W} ${VB_H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Hémicycle : ${seats.length} député(e)s, ${nbConcernes} concerné(e)s par des affaires`}
      >
        {/* Seats */}
        {allSeats.map((seat) => {
          const fill = PARTI_COLORS[seat.parti] || "#cccccc"
          const isHovered = hovered?.id === seat.id
          const hasAffaire = seat.score > 0

          const r = isHovered ? SEAT_R_HOVER : hasAffaire ? SEAT_R_AFFAIRE : SEAT_R
          const mouseHandlers = {
            onMouseEnter: (e: React.MouseEvent) => {
              setHovered(seat)
              const container = (e.currentTarget as Element).closest(".hemicycle-container") as HTMLElement
              if (container) {
                const rect = container.getBoundingClientRect()
                setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              }
            },
            onMouseMove: (e: React.MouseEvent) => {
              const container = (e.currentTarget as Element).closest(".hemicycle-container") as HTMLElement
              if (container) {
                const rect = container.getBoundingClientRect()
                setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              }
            },
            onMouseLeave: () => setHovered(null),
          }

          return (
            <Link key={seat.id} href={`/elus/${encodeURIComponent(seat.id)}`}>
              {hasAffaire ? (
                <g className="cursor-pointer" {...mouseHandlers}>
                  {/* Pastille blanche avec liseré rouge + « C » pour casserole */}
                  <circle
                    cx={seat.x}
                    cy={seat.y}
                    r={r}
                    fill="#ffffff"
                    stroke={isHovered ? "#000091" : "#ce0500"}
                    strokeWidth={isHovered ? 1 : 0.7}
                    style={{ transition: "r 100ms" }}
                  />
                  <text
                    x={seat.x}
                    y={seat.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#000091"
                    fontSize={r * 1.25}
                    fontWeight="bold"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    C
                  </text>
                </g>
              ) : (
                <circle
                  cx={seat.x}
                  cy={seat.y}
                  r={r}
                  fill={fill}
                  opacity={0.75}
                  stroke={isHovered ? "#000091" : "none"}
                  strokeWidth={isHovered ? 1 : 0}
                  className="cursor-pointer"
                  style={{ transition: "r 100ms, opacity 100ms" }}
                  {...mouseHandlers}
                />
              )}
            </Link>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hovered && (
        <div
          className="absolute pointer-events-none z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm whitespace-nowrap"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 8,
            transform: tooltipPos.x > 400 ? "translateX(calc(-100% - 28px))" : "none",
          }}
        >
          <p className="font-semibold text-gray-900">
            {hovered.prenom} {hovered.nom}
          </p>
          <p className="text-xs text-gray-500">{hovered.parti}</p>
          {hovered.score > 0 && (
            <p className="text-xs font-medium text-[#ce0500] mt-0.5">
              Score {hovered.score} · {hovered.nb_affaires} affaire{hovered.nb_affaires > 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3">
        {partiesPresent.map(([parti, color]) => (
          <div key={parti} className="flex items-center gap-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: color }}
            />
            <span className="text-[10px] text-gray-500 leading-none">
              {parti.length > 20 ? parti.slice(0, 18) + "…" : parti}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0 border border-[#ce0500] bg-white text-[#000091] text-[7px] font-bold leading-none">C</span>
          <span className="text-[10px] text-gray-500 leading-none">Condamné(e)</span>
        </div>
      </div>
    </div>
  )
}
