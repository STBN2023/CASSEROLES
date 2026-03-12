import type { Metadata } from "next"
import { Suspense } from "react"
import { getAffaires, getAffairesElus } from "@/lib/data"
import { AffairesClient } from "./AffairesClient"

export const metadata: Metadata = {
  title: "Affaires répertoriées",
  description:
    "Base de données des affaires judiciaires liées à la probité en France. Sources : Transparency International France, Wikidata, Wikipedia.",
}

export default function AffairesPage() {
  const affaires = getAffaires()
  const affaireToElus = getAffairesElus()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Affaires répertoriées</h1>
        <p className="mt-1 text-sm text-gray-500">
          Base de données Transparency International France, Wikidata et Wikipedia · Atteintes à la probité en France.
        </p>
      </div>

      <Suspense fallback={<div className="text-center py-20 text-gray-400">Chargement des affaires…</div>}>
        <AffairesClient affaires={affaires} affaireToElus={affaireToElus} />
      </Suspense>

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4">
        <strong>Sources :</strong> Transparency International France ·{" "}
        <a href="https://www.data.gouv.fr/fr/datasets/affaires-de-corruption-en-france-par-transparency-international-france-1/" className="underline" target="_blank" rel="noopener noreferrer">
          data.gouv.fr
        </a>{" "}
        · Base arrêtée en août 2016 | Wikidata ·{" "}
        <a href="https://query.wikidata.org" className="underline" target="_blank" rel="noopener noreferrer">
          query.wikidata.org
        </a>{" "}
        · Licence CC0.
      </div>
    </div>
  )
}
