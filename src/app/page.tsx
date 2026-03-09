import { getStats, getAffaires, getStatsByRegion, getElus, getHemicycleData } from "@/lib/data"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PartisChart } from "@/components/dashboard/PartisChart"
import { RegionsTable } from "@/components/dashboard/RegionsTable"
import { FranceMap } from "@/components/dashboard/FranceMap"
import { Hemicycle } from "@/components/dashboard/Hemicycle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default async function HomePage() {
  const stats = getStats()
  const affaires = getAffaires()
  const elus = getElus()
  const regionStats = getStatsByRegion(affaires)
  const hemicycleSeats = getHemicycleData(elus)

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Données open-data sur les affaires judiciaires de probité liées à des élus français.{" "}
          <Link href="/methodologie" className="underline hover:text-gray-700">
            En savoir plus sur la méthodologie
          </Link>
        </p>
      </div>

      {/* Avertissement */}
      <div className="bg-[#fef7da] border border-[#f5d98b] rounded-lg p-4 text-sm text-[#716043]">
        <strong>Note :</strong> Les affaires proviennent de Transparency International France (base 2016)
        et Wikidata (CC0, mise à jour continue). Les profils d&apos;élus sont issus du Répertoire National des Élus.
        La correspondance directe entre affaires et élus en mandat est limitée — voir la{" "}
        <Link href="/methodologie" className="underline">méthodologie</Link>.
      </div>

      {/* KPIs – Affaires par statut judiciaire */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Élus répertoriés"
          value={stats.nb_elus_total}
          sub="RNE, tous niveaux"
          href="/elus"
        />
        <KpiCard
          label="Affaires répertoriées"
          value={stats.nb_affaires_total}
          sub="TI France + Wikidata"
          href="/affaires"
        />
        <KpiCard
          label="Condamnations"
          value={stats.nb_condamnations}
          sub={`${stats.nb_elus_condamnes} élu${stats.nb_elus_condamnes > 1 ? "s" : ""} concerné${stats.nb_elus_condamnes > 1 ? "s" : ""}`}
          color="red"
          href="/affaires?statut=condamnation"
        />
        <KpiCard
          label="Mises en examen"
          value={stats.nb_mises_en_examen}
          sub={`${stats.nb_elus_mis_en_examen} élu${stats.nb_elus_mis_en_examen > 1 ? "s" : ""} concerné${stats.nb_elus_mis_en_examen > 1 ? "s" : ""}`}
          color="orange"
          href="/affaires?statut=mise_en_examen"
        />
        <KpiCard
          label="Enquêtes"
          value={stats.nb_enquetes}
          sub={`${stats.nb_elus_enquetes} élu${stats.nb_elus_enquetes > 1 ? "s" : ""} concerné${stats.nb_elus_enquetes > 1 ? "s" : ""}`}
          color="yellow"
          href="/affaires?statut=enquete"
        />
      </div>

      {/* Élus concernés par niveau de mandat */}
      {Object.keys(stats.repartition_niveaux).length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(stats.repartition_niveaux).map(([niveau, count]) => {
            const label: Record<string, string> = {
              local: "Élus locaux concernés",
              national: "Parlementaires concernés",
              europeen: "Eurodéputés concernés",
            }
            return (
              <Link
                key={niveau}
                href={`/elus?niveau=${niveau}&score=3`}
                className="bg-white rounded-xl border border-gray-200 p-4 text-center hover:shadow-md transition-shadow"
              >
                <p className="text-2xl font-bold text-gray-900 tabular-nums">
                  {(count as number).toLocaleString("fr-FR")}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">{label[niveau] || niveau}</p>
              </Link>
            )
          })}
        </div>
      )}

      {/* Hémicycle Assemblée Nationale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Assemblée Nationale — {hemicycleSeats.length} député(e)s
          </CardTitle>
          <p className="text-xs text-gray-500 mt-1">
            Positions réelles des sièges (source : assemblee-nationale.fr).
            Les points rouges indiquent les élu(e)s condamné(e)s.
            Cliquez sur un siège pour voir la fiche.
          </p>
        </CardHeader>
        <CardContent>
          <Hemicycle seats={hemicycleSeats} />
        </CardContent>
      </Card>

      {/* Carte + tableau régions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Affaires par région</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <FranceMap regions={regionStats} />
            <RegionsTable regions={regionStats} />
          </div>
        </CardContent>
      </Card>

      {/* Répartition par parti */}
      {stats.repartition_partis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répartition par parti</CardTitle>
          </CardHeader>
          <CardContent>
            <PartisChart partis={stats.repartition_partis} />
          </CardContent>
        </Card>
      )}

      {/* Liens d'action */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          href="/gouvernement"
          className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <p className="font-semibold text-gray-900 group-hover:text-gray-700">Voir le gouvernement →</p>
          <p className="text-sm text-gray-500 mt-1">
            Composition et affaires des ministres du gouvernement Lecornu.
          </p>
        </Link>
        <Link
          href="/elus"
          className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <p className="font-semibold text-gray-900 group-hover:text-gray-700">Explorer les élus →</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.nb_elus_total.toLocaleString("fr-FR")} élus filtrables par parti, niveau et score.
          </p>
        </Link>
        <Link
          href="/affaires"
          className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <p className="font-semibold text-gray-900 group-hover:text-gray-700">Parcourir les affaires →</p>
          <p className="text-sm text-gray-500 mt-1">
            {stats.nb_affaires_total} affaires référencées avec sources et statuts judiciaires.
          </p>
        </Link>
        <Link
          href="/partis"
          className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <p className="font-semibold text-gray-900 group-hover:text-gray-700">Voir les partis →</p>
          <p className="text-sm text-gray-500 mt-1">
            Répartition des affaires par formation politique.
          </p>
        </Link>
        <Link
          href="/methodologie"
          className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
        >
          <p className="font-semibold text-gray-900 group-hover:text-gray-700">Comprendre les données →</p>
          <p className="text-sm text-gray-500 mt-1">
            Sources, licences, calcul du score de probité et limites.
          </p>
        </Link>
      </div>

      {/* Source */}
      <p className="text-xs text-gray-400 text-right">
        Dernière mise à jour : {stats.derniere_maj} · Sources :{" "}
        {stats.sources.join(", ")}
      </p>
    </div>
  )
}
