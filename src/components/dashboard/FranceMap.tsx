"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import type { RegionStats } from "@/lib/data"
import { REGION_PATHS, FRANCE_VIEWBOX } from "./france-paths"

interface FranceMapProps {
  regions: RegionStats[]
}

export function FranceMap({ regions }: FranceMapProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Build a lookup from region name → stats
  const statsMap: Record<string, RegionStats> = {}
  for (const r of regions) {
    statsMap[r.region] = r
  }

  // Find max for color scale
  const maxAffaires = Math.max(...regions.map((r) => r.nb_affaires), 1)

  // Color scale: light → dark blue (DSFR palette)
  const getColor = useCallback(
    (nb: number): string => {
      if (nb === 0) return "#f0f0f5"
      const t = nb / maxAffaires
      // Interpolate from light (#cacafb) to dark (#000091)
      const r = Math.round(202 - t * 202)
      const g = Math.round(202 - t * 202)
      const b = Math.round(251 - t * (251 - 145))
      return `rgb(${r},${g},${b})`
    },
    [maxAffaires]
  )

  const handleMouseMove = useCallback((e: React.MouseEvent, region: string) => {
    setHovered(region)
    const container = e.currentTarget.closest(".france-map-container") as HTMLElement
    if (container) {
      const rect = container.getBoundingClientRect()
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
  }, [])

  const hoveredStats = hovered ? statsMap[hovered] : null

  return (
    <div className="relative france-map-container">
      <svg
        viewBox={FRANCE_VIEWBOX}
        className="w-full h-auto max-h-[420px]"
        role="img"
        aria-label="Carte des affaires judiciaires par région en France métropolitaine"
        style={{ shapeRendering: "geometricPrecision" }}
      >
        {Object.entries(REGION_PATHS).map(([region, paths]) => {
          const stats = statsMap[region]
          const nb = stats?.nb_affaires ?? 0
          const isHovered = hovered === region
          const fill = getColor(nb)

          return (
            <Link key={region} href={`/affaires?region=${encodeURIComponent(region)}`}>
              <g
                onMouseMove={(e) => handleMouseMove(e, region)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              >
                {paths.map((d, i) => (
                  <path
                    key={i}
                    d={d}
                    fill={fill}
                    stroke={isHovered ? "#000091" : "#ffffff"}
                    strokeWidth={isHovered ? 1.5 : 0.8}
                    strokeLinejoin="round"
                    style={{
                      transition: "fill 150ms, stroke 150ms, stroke-width 150ms",
                      filter: isHovered ? "brightness(0.85)" : "none",
                    }}
                  />
                ))}
              </g>
            </Link>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hoveredStats && (
        <div
          className="absolute pointer-events-none z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm whitespace-nowrap"
          style={{
            left: tooltipPos.x + 14,
            top: tooltipPos.y - 8,
            transform: tooltipPos.x > 300 ? "translateX(calc(-100% - 28px))" : "none",
          }}
        >
          <p className="font-semibold text-gray-900">{hoveredStats.region}</p>
          <p className="text-gray-600 tabular-nums">
            {hoveredStats.nb_affaires} affaire{hoveredStats.nb_affaires > 1 ? "s" : ""}
          </p>
          {hoveredStats.nb_condamnations > 0 && (
            <p className="text-xs text-[#ce0500]">
              {hoveredStats.nb_condamnations} condamnation{hoveredStats.nb_condamnations > 1 ? "s" : ""}
            </p>
          )}
          {hoveredStats.nb_mises_en_examen > 0 && (
            <p className="text-xs text-[#b34000]">
              {hoveredStats.nb_mises_en_examen} mise{hoveredStats.nb_mises_en_examen > 1 ? "s" : ""} en examen
            </p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-center">
        <span className="text-[10px] text-gray-400">0</span>
        <div
          className="h-2 rounded-full flex-1 max-w-[120px]"
          style={{
            background: "linear-gradient(to right, #f0f0f5, #cacafb, #6a6af4, #000091)",
          }}
        />
        <span className="text-[10px] text-gray-400">{maxAffaires}</span>
        <span className="text-[10px] text-gray-400 ml-1">affaires</span>
      </div>
    </div>
  )
}
