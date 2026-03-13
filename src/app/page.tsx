import { getStats, getAffaires, getStatsByRegion, getElus, getHemicycleData, getPersonnalites, getGouvernement } from "@/lib/data"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { PartisChart } from "@/components/dashboard/PartisChart"
import { RegionsTable } from "@/components/dashboard/RegionsTable"
import { FranceMap } from "@/components/dashboard/FranceMap"
import { Hemicycle } from "@/components/dashboard/Hemicycle"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Tableau de bord",
  description:
    "Observatoire de la probité des élus français. Données open-data : affaires judiciaires, condamnations, mises en examen. Sources : RNE, Transparency International France, Wikidata.",
}

export default async function HomePage() {
  const stats = getStats()
  const affaires = getAffaires()
  const elus = getElus()
  const personnalites = getPersonnalites()
  const gouvernement = getGouvernement()
  const regionStats = getStatsByRegion(affaires)
  const hemicycleSeats = getHemicycleData(elus)

  // KPIs centrés sur le paysage politique
  const nbPersonnalites = personnalites.length
  const nbElusConcernes = stats.nb_elus_concernes
  const nbGouvConcernes = gouvernement.filter((m) => (m.score ?? 0) > 0).length
  const nbGouvTotal = gouvernement.length
  const totalPersonnes = nbElusConcernes + nbPersonnalites
  const nbAffairesNominatives = stats.nb_affaires_personnes ?? 0

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

      {/* KPIs – Paysage politique */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Personnes avec affaires"
          value={totalPersonnes}
          sub={`${nbElusConcernes} élus en mandat · ${nbPersonnalites} personnalités`}
          color="red"
          href="/personnalites"
        />
        <KpiCard
          label="Affaires documentées"
          value={nbAffairesNominatives}
          sub="Wikidata + Wikipedia"
          href="/affaires"
        />
        <KpiCard
          label="Condamnations"
          value={stats.nb_condamnations}
          sub="Décisions de justice définitives"
          color="red"
          href="/affaires?statut=condamnation"
        />
        <KpiCard
          label="Mises en examen"
          value={stats.nb_mises_en_examen}
          sub="Procédures en cours"
          color="orange"
          href="/affaires?statut=mise_en_examen"
        />
      </div>

      {/* KPIs – Détail par catégorie */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Élus en mandat"
          value={nbElusConcernes}
          sub={`sur ${stats.nb_elus_total.toLocaleString("fr-FR")} au RNE`}
          href="/elus?score=3"
        />
        <KpiCard
          label="Personnalités"
          value={nbPersonnalites}
          sub="Hors mandat actuel"
          href="/personnalites"
        />
        <KpiCard
          label="Gouvernement"
          value={`${nbGouvConcernes} / ${nbGouvTotal}`}
          sub={`membre${nbGouvConcernes > 1 ? "s" : ""} concerné${nbGouvConcernes > 1 ? "s" : ""}`}
          color={nbGouvConcernes > 0 ? "orange" : "green"}
          href="/gouvernement"
        />
        <KpiCard
          label="Partis concernés"
          value={stats.repartition_partis.length}
          sub="Formations politiques"
          href="/partis"
        />
      </div>

      {/* Note TI France */}
      <p className="text-xs text-gray-400 italic">
        + {stats.nb_affaires_geographiques ?? 0} affaires géographiques (Transparency International France, 2016)
        non liées à des personnes identifiées —{" "}
        <Link href="/affaires" className="underline hover:text-gray-500">voir toutes les affaires</Link>.
      </p>

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
