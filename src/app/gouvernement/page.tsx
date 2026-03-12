import { getGouvernement } from "@/lib/data"
import { GouvernementGrid } from "@/components/dashboard/GouvernementGrid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RANG_LABELS, SCORE_LABELS } from "@/lib/types"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Gouvernement",
  description:
    "Composition du gouvernement Lecornu et indicateurs de probité des ministres. Données Wikidata CC0 croisées avec les affaires judiciaires référencées.",
}

export default function GouvernementPage() {
  const membres = getGouvernement()

  const nbTotal = membres.length
  const nbCasseroles = membres.filter((m) => m.score > 0).length
  const nbCondamnes = membres.filter((m) => m.score === 3).length
  const nbMisEnExamen = membres.filter((m) => m.score === 2).length

  // Compter par rang
  const parRang: Record<string, number> = {}
  for (const m of membres) {
    parRang[m.rang] = (parRang[m.rang] ?? 0) + 1
  }

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gouvernement</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Composition du gouvernement Lecornu et indicateurs de probité.{" "}
          Données issues de l&apos;annuaire officiel service-public.fr (API DILA).{" "}
          <Link href="/methodologie" className="underline hover:text-gray-700">
            Voir la méthodologie
          </Link>
        </p>
      </div>

      {/* Avertissement légal */}
      <div className="bg-[#fef7da] border border-[#f5d98b] rounded-lg p-4 text-sm text-[#716043]">
        <strong>Note :</strong> Les affaires sont issues de Wikidata (CC0) et de Transparency International France.
        Toute mention préjuge uniquement d&apos;un statut judiciaire documenté, non de la culpabilité des personnes citées.
        La pastille{" "}
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#ce0500] bg-white text-[#000091] text-[8px] font-bold align-middle mx-0.5">C</span>
        {" "}signale un élu concerné par au moins une affaire référencée.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{nbTotal}</p>
          <p className="text-sm text-gray-500 mt-0.5">Membres</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${nbCasseroles > 0 ? "bg-[#fee9e9] border-[#fcc0bf]" : "bg-white border-gray-200"}`}>
          <p className={`text-3xl font-bold tabular-nums ${nbCasseroles > 0 ? "text-[#ce0500]" : "text-gray-900"}`}>
            {nbCasseroles}
          </p>
          <p className={`text-sm mt-0.5 ${nbCasseroles > 0 ? "text-[#ce0500]" : "text-gray-500"}`}>
            Avec affaires
          </p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${nbCondamnes > 0 ? "bg-[#fee9e9] border-[#fcc0bf]" : "bg-white border-gray-200"}`}>
          <p className={`text-3xl font-bold tabular-nums ${nbCondamnes > 0 ? "text-[#ce0500]" : "text-gray-900"}`}>
            {nbCondamnes}
          </p>
          <p className={`text-sm mt-0.5 ${nbCondamnes > 0 ? "text-[#ce0500]" : "text-gray-500"}`}>
            Condamné(e)s
          </p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${nbMisEnExamen > 0 ? "bg-[#ffe9e6] border-[#f9c09a]" : "bg-white border-gray-200"}`}>
          <p className={`text-3xl font-bold tabular-nums ${nbMisEnExamen > 0 ? "text-[#b34000]" : "text-gray-900"}`}>
            {nbMisEnExamen}
          </p>
          <p className={`text-sm mt-0.5 ${nbMisEnExamen > 0 ? "text-[#b34000]" : "text-gray-500"}`}>
            Mis(es) en examen
          </p>
        </div>
      </div>

      {/* Répartition par rang */}
      <div className="flex flex-wrap gap-3">
        {(["premier_ministre", "ministre", "ministre_delegue", "secretaire_etat"] as const)
          .filter((r) => parRang[r])
          .map((r) => (
            <span
              key={r}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600"
            >
              <span className="font-medium text-gray-900">{parRang[r]}</span>
              {RANG_LABELS[r]}
            </span>
          ))}
      </div>

      {/* Grille portraits */}
      {membres.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Gouvernement Lecornu — {nbTotal} membre{nbTotal > 1 ? "s" : ""}
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Cliquez sur un portrait pour accéder à la fiche ou à la fiche Wikidata.
              Données : API DILA (service-public.fr) · Photos : Wikidata CC0 / Wikipedia.
            </p>
          </CardHeader>
          <CardContent>
            <GouvernementGrid membres={membres} />
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <p className="text-lg font-medium">Données non disponibles</p>
          <p className="text-sm mt-1">Lancez l'ETL pour générer le fichier gouvernement.json</p>
          <code className="block mt-3 text-xs bg-gray-100 rounded px-3 py-2 text-gray-600 inline-block">
            python etl/run.py
          </code>
        </div>
      )}

      {/* Sources */}
      <p className="text-xs text-gray-400 text-right">
        Sources : API DILA / service-public.fr · Wikidata (CC0) · Transparency International France
      </p>
    </div>
  )
}
