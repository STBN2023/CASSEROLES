import Link from "next/link"
import type { RepartitionParti } from "@/lib/types"

interface PartisChartProps {
  partis: RepartitionParti[]
}

export function PartisChart({ partis }: PartisChartProps) {
  const max = Math.max(...partis.map((p) => p.nb_affaires), 1)

  return (
    <div className="space-y-3">
      {partis.slice(0, 8).map((p) => (
        <Link
          key={p.nom}
          href={`/elus?parti=${encodeURIComponent(p.nom)}`}
          className="block space-y-0.5 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-36 text-sm text-gray-700 truncate flex-shrink-0 group-hover:text-[#000091] transition-colors" title={p.nom}>
              {p.nom}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-2.5 rounded-full transition-all bg-[#ce0500]/70"
                  style={{ width: `${(p.nb_affaires / max) * 100}%` }}
                />
              </div>
              <span className="text-sm font-medium text-gray-700 w-8 text-right tabular-nums">
                {p.nb_affaires}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-36" />
            <p className="text-[10px] text-gray-400">
              {p.nb_elus} élu{p.nb_elus > 1 ? "s" : ""}
              {p.nb_condamnations > 0 && (
                <> · {p.nb_condamnations} condamné{p.nb_condamnations > 1 ? "s" : ""}</>
              )}
            </p>
          </div>
        </Link>
      ))}
      <p className="text-xs text-gray-400 pt-1">Nombre d&apos;affaires répertoriées par parti</p>
    </div>
  )
}
