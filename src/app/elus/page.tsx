import type { Metadata } from "next"
import { Suspense } from "react"
import { getStats } from "@/lib/data"
import { ElusTable } from "@/components/table/ElusTable"

export const metadata: Metadata = {
  title: "Élus",
  description: "Liste des élus français filtrables par parti, niveau de mandat et score de probité.",
}

export default function ElusPage() {
  const stats = getStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Élus</h1>
        <p className="mt-1 text-sm text-gray-500">
          {stats.nb_elus_total.toLocaleString("fr-FR")} élus issus du Répertoire National des Élus (RNE).
          Filtrez par niveau, parti ou score de probité.
        </p>
      </div>
      <Suspense fallback={<div className="text-center py-20 text-gray-400">Chargement…</div>}>
        <ElusTable />
      </Suspense>
    </div>
  )
}
