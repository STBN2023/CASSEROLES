import { getPartisDetail } from "@/lib/data"
import type { Metadata } from "next"
import PartisGrid from "@/components/partis/PartisGrid"

export const metadata: Metadata = {
  title: "Partis politiques",
  description:
    "Répartition des affaires judiciaires par parti politique en France.",
}

export default function PartisPage() {
  const partis = getPartisDetail()

  const nbPartis = partis.length
  const nbPartisAvecAffaires = partis.filter((p) => p.nb_affaires > 0).length
  const nbElusConcernes = partis.reduce((s, p) => s + p.nb_elus_concernes, 0)
  const nbAffairesTotal = partis.reduce((s, p) => s + p.nb_affaires, 0)
  const totalAmendes = partis.reduce((s, p) => s + p.total_amendes_euros, 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Partis politiques
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Répartition des affaires judiciaires par formation politique.
          Tous les partis représentés à l&apos;Assemblée nationale sont affichés.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {nbPartis}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Partis ({nbPartisAvecAffaires} avec affaires)
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {nbElusConcernes}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">Élus concernés</p>
        </div>
        <div className="bg-[#fee9e9] rounded-xl border border-[#fcc0bf] p-4 text-center">
          <p className="text-3xl font-bold text-[#ce0500] tabular-nums">
            {nbAffairesTotal}
          </p>
          <p className="text-sm text-[#ce0500] mt-0.5">Affaires</p>
        </div>
        {totalAmendes > 0 && (
          <div className="bg-[#ffe9e6] rounded-xl border border-[#f9c09a] p-4 text-center">
            <p className="text-2xl font-bold text-[#b34000] tabular-nums">
              {(totalAmendes / 1_000_000).toFixed(1)} M€
            </p>
            <p className="text-sm text-[#b34000] mt-0.5">
              Total amendes
            </p>
          </div>
        )}
      </div>

      {/* Grille de cards par parti */}
      {partis.length > 0 ? (
        <PartisGrid partis={partis} />
      ) : (
        <div className="text-center py-20 text-gray-400">
          Aucun parti avec affaires documentées.
        </div>
      )}

      <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-4">
        <strong>Note :</strong> Seuls les élus du Répertoire National des
        Élus (RNE) ayant pu être reliés à une affaire Wikidata sont
        comptabilisés par parti. Les affaires TI France, décrites sans nom
        propre, ne sont pas associées à un élu individuel.
      </div>
    </div>
  )
}
