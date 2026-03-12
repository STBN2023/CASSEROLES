import type { Metadata } from "next"
import { getPersonnalites, getAffaires } from "@/lib/data"
import { PersonnalitesClient } from "./PersonnalitesClient"

export const metadata: Metadata = {
  title: "Personnalites politiques",
  description:
    "Personnalites politiques francaises avec affaires judiciaires documentees (Wikidata, Wikipedia). Figures hors mandat actuel : anciens ministres, parlementaires, elus.",
}

export default function PersonnalitesPage() {
  const personnalites = getPersonnalites()
  const affaires = getAffaires()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personnalites politiques</h1>
        <p className="mt-1 text-sm text-gray-500">
          {personnalites.length} personnalites politiques avec affaires judiciaires documentees,
          non presentes dans le Repertoire National des Elus (anciens ministres, parlementaires, etc.).
        </p>
      </div>

      <div className="bg-[#fef7da] border border-[#f5d98b] rounded-lg p-4 text-sm text-[#716043]">
        <strong>Note :</strong> Ces personnalites ne figurent pas dans le RNE (elus en mandat).
        Les affaires proviennent de Wikidata (CC0) et Wikipedia. Ces donnees sont informatives
        et ne prejugent pas de la culpabilite des personnes citees.
      </div>

      <PersonnalitesClient personnalites={personnalites} affaires={affaires} />
    </div>
  )
}
