import { getPartisDetail } from "@/lib/data"
import type { PartiDetail, Score } from "@/lib/types"
import { SCORE_COLORS, STATUT_COLORS } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Partis politiques",
  description:
    "Répartition des affaires judiciaires par parti politique en France.",
}

export default function PartisPage() {
  const partis = getPartisDetail()

  const nbPartis = partis.length
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
          Seuls les partis comptant au moins un élu avec une affaire
          documentée sont affichés.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">
            {nbPartis}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            Partis concernés
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {partis.map((parti) => (
          <PartiCard key={parti.nom} parti={parti} />
        ))}
      </div>

      {partis.length === 0 && (
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

function PartiCard({ parti }: { parti: PartiDetail }) {
  const maxScore: Score = parti.nb_condamnations > 0
    ? 3
    : parti.nb_mises_en_examen > 0
      ? 2
      : parti.nb_enquetes > 0
        ? 1
        : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow flex flex-col">
      {/* En-tête : nom + badge affaires */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <Link
          href={`/elus?parti=${encodeURIComponent(parti.nom)}`}
          className="text-base font-semibold text-[#000091] hover:underline leading-tight"
        >
          {parti.nom}
        </Link>
        <Badge className="bg-[#fee9e9] text-[#ce0500] border border-[#fcc0bf] text-xs flex-shrink-0">
          {parti.nb_affaires} affaire{parti.nb_affaires > 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Compteurs */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3">
        <div className="text-gray-500">
          Élus concernés
        </div>
        <div className="font-medium text-right">
          {parti.nb_elus_concernes}
          <span className="text-gray-400 font-normal">
            {" "}
            / {parti.nb_elus_total.toLocaleString("fr-FR")}
          </span>
        </div>
      </div>

      {/* Badges statuts */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {parti.nb_condamnations > 0 && (
          <Badge
            className={`text-[11px] border ${STATUT_COLORS.condamnation}`}
          >
            {parti.nb_condamnations} condamnation
            {parti.nb_condamnations > 1 ? "s" : ""}
          </Badge>
        )}
        {parti.nb_mises_en_examen > 0 && (
          <Badge
            className={`text-[11px] border ${STATUT_COLORS.mise_en_examen}`}
          >
            {parti.nb_mises_en_examen} mise
            {parti.nb_mises_en_examen > 1 ? "s" : ""} en examen
          </Badge>
        )}
        {parti.nb_enquetes > 0 && (
          <Badge
            className={`text-[11px] border ${STATUT_COLORS.enquete}`}
          >
            {parti.nb_enquetes} enquête{parti.nb_enquetes > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Peines agrégées */}
      {(parti.total_amendes_euros > 0 ||
        parti.nb_avec_prison > 0 ||
        parti.nb_avec_ineligibilite > 0) && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-400 mb-3">
          {parti.nb_avec_prison > 0 && (
            <span>{parti.nb_avec_prison} peine(s) de prison</span>
          )}
          {parti.total_amendes_euros > 0 && (
            <span>
              {parti.total_amendes_euros.toLocaleString("fr-FR")} € d&apos;amendes
            </span>
          )}
          {parti.nb_avec_ineligibilite > 0 && (
            <span>
              {parti.nb_avec_ineligibilite} inéligibilité(s)
            </span>
          )}
        </div>
      )}

      {/* Élus concernés */}
      {parti.elus_concernes.length > 0 && (
        <div className="border-t border-gray-100 pt-3 mt-auto space-y-1.5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            Élus concernés
          </p>
          {parti.elus_concernes.slice(0, 5).map((elu) => (
            <div key={elu.id} className="flex items-center justify-between">
              <Link
                href={`/elus/${encodeURIComponent(elu.id)}`}
                className="text-xs text-gray-600 hover:text-[#000091] hover:underline"
              >
                {elu.prenom} {elu.nom}
              </Link>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400">
                  {elu.nb_affaires} aff.
                </span>
                <Badge
                  className={`text-[9px] px-1.5 py-0 ${SCORE_COLORS[elu.score as Score]}`}
                >
                  {elu.score === 3
                    ? "●●●"
                    : elu.score === 2
                      ? "●●○"
                      : elu.score === 1
                        ? "●○○"
                        : "○○○"}
                </Badge>
              </div>
            </div>
          ))}
          {parti.elus_concernes.length > 5 && (
            <Link
              href={`/elus?parti=${encodeURIComponent(parti.nom)}&score=3`}
              className="block text-xs text-gray-400 hover:text-[#000091]"
            >
              + {parti.elus_concernes.length - 5} autre
              {parti.elus_concernes.length - 5 > 1 ? "s" : ""} →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
