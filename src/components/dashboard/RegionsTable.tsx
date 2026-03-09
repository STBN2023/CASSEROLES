import Link from "next/link"
import type { RegionStats } from "@/lib/data"
import { Badge } from "@/components/ui/badge"

interface RegionsTableProps {
  regions: RegionStats[]
}

export function RegionsTable({ regions }: RegionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-1 font-medium text-gray-500">Région</th>
            <th className="text-right py-2 px-1 font-medium text-gray-500">Affaires</th>
            <th className="text-right py-2 px-1 font-medium text-gray-500">Condamn.</th>
            <th className="text-right py-2 px-1 font-medium text-gray-500">Mx. exam.</th>
          </tr>
        </thead>
        <tbody>
          {regions.slice(0, 12).map((r) => (
            <tr key={r.region} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="py-2 px-1">
                <Link
                  href={`/affaires?region=${encodeURIComponent(r.region)}`}
                  className="font-medium text-gray-800 hover:text-[#000091] transition-colors"
                >
                  {r.region}
                </Link>
              </td>
              <td className="py-2 px-1 text-right tabular-nums text-gray-700">{r.nb_affaires}</td>
              <td className="py-2 px-1 text-right">
                {r.nb_condamnations > 0 && (
                  <Badge className="text-xs bg-[#fee9e9] text-[#ce0500] border border-[#fcc0bf] hover:bg-[#fee9e9]">{r.nb_condamnations}</Badge>
                )}
              </td>
              <td className="py-2 px-1 text-right">
                {r.nb_mises_en_examen > 0 && (
                  <Badge className="text-xs bg-[#ffe9e6] text-[#b34000] border border-[#f9c09a] hover:bg-[#ffe9e6]">{r.nb_mises_en_examen}</Badge>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
