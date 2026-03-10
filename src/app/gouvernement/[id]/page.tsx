import { getMembreGouvernement, getAffairesForElu } from "@/lib/data"
import { getGouvernement } from "@/lib/data"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  SCORE_LABELS,
  SCORE_COLORS,
  SCORE_DOTS,
  RANG_LABELS,
  STATUT_LABELS,
  STATUT_COLORS,
} from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const membre = getMembreGouvernement(id)
  if (!membre) return { title: "Membre non trouvé" }
  return {
    title: `${membre.prenom} ${membre.nom} – Gouvernement`,
    description: `Fiche de ${membre.prenom} ${membre.nom}, ${membre.poste}. Score de probité : ${membre.score}/3, ${membre.nb_affaires} affaire(s).`,
  }
}

export async function generateStaticParams() {
  const membres = getGouvernement()
  return membres.map((m) => ({ id: m.wikidata_id }))
}

export default async function FicheMembreGouvernementPage({ params }: Props) {
  const { id } = await params
  const membre = getMembreGouvernement(id)
  if (!membre) notFound()

  const affaires = getAffairesForElu(membre.affaires)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/gouvernement" className="hover:text-gray-700">Gouvernement</Link>
        {" → "}
        <span className="text-gray-800">{membre.prenom} {membre.nom}</span>
      </nav>

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {membre.url_photo ? (
              <Image
                src={membre.url_photo}
                alt={`Photo de ${membre.prenom} ${membre.nom}`}
                width={96}
                height={96}
                className="rounded-full object-cover object-top flex-shrink-0 border border-gray-200"
                unoptimized
              />
            ) : (
              <div className="w-[96px] h-[96px] rounded-full bg-[#e8e8f0] flex items-center justify-center flex-shrink-0 border border-gray-200">
                <span className="text-2xl font-bold text-[#000091]">
                  {membre.prenom[0]}{membre.nom[0]}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {membre.prenom} <span className="uppercase">{membre.nom}</span>
              </h1>
              <p className="text-gray-500 mt-1">{membre.poste}</p>
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 flex-shrink-0 ${SCORE_COLORS[membre.score]}`}>
            {SCORE_LABELS[membre.score]}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{RANG_LABELS[membre.rang]}</Badge>
          <Badge variant="outline">{membre.parti}</Badge>
          {membre.wikidata_id && (
            <a
              href={`https://www.wikidata.org/wiki/${membre.wikidata_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#000091] underline flex items-center gap-1"
            >
              Wikidata ↗
            </a>
          )}
        </div>
      </div>

      {/* Score de probité */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score de probité</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold tracking-widest ${SCORE_COLORS[membre.score]}`}>
              {SCORE_DOTS[membre.score]}
            </div>
            <div>
              <p className="font-medium text-gray-900">{SCORE_LABELS[membre.score]}</p>
              <p className="text-sm text-gray-500">
                {membre.nb_affaires > 0
                  ? `${membre.nb_affaires} affaire${membre.nb_affaires > 1 ? "s" : ""} répertoriée${membre.nb_affaires > 1 ? "s" : ""}`
                  : "Aucune affaire trouvée dans les sources référencées"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([3, 2, 1, 0] as const).map((s) => (
              <div
                key={s}
                className={`rounded-lg border p-3 text-center text-xs ${membre.score === s ? SCORE_COLORS[s] + " border-current font-semibold" : "bg-gray-50 text-gray-400 border-gray-100"}`}
              >
                <div className="font-bold text-base tracking-widest mb-1">{SCORE_DOTS[s]}</div>
                <div>{SCORE_LABELS[s]}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Gravité croissante de ○○○ (aucune affaire) à ●●● (condamnation définitive).
          </p>
        </CardContent>
      </Card>

      {/* Affaires */}
      {affaires.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Affaires ({affaires.length})
          </h2>
          {affaires.map((affaire) => (
            <div key={affaire.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium text-gray-900">{affaire.type}</p>
                  {affaire.date && (
                    <p className="text-xs text-gray-400 mt-0.5">{affaire.date} · {affaire.juridiction || affaire.lieu}</p>
                  )}
                </div>
                <Badge className={`text-xs flex-shrink-0 border ${STATUT_COLORS[affaire.statut]}`}>
                  {STATUT_LABELS[affaire.statut]}
                </Badge>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{affaire.resume}</p>
              {affaire.infractions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {affaire.infractions.map((inf, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{inf}</Badge>
                  ))}
                </div>
              )}
              {affaire.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {affaire.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#000091] underline hover:opacity-70"
                    >
                      {affaire.source_label || "Source"} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-gray-400">
            <p className="text-4xl mb-3">✓</p>
            <p className="font-medium text-gray-600">Aucune affaire répertoriée</p>
            <p className="text-sm mt-1">
              Ce membre du gouvernement n&apos;apparaît dans aucune des sources référencées.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      <div className="text-xs text-gray-400 space-y-1 bg-gray-50 rounded-lg p-4">
        <p className="font-medium text-gray-500">Sources utilisées pour cette fiche</p>
        <p>
          API DILA (Annuaire de l&apos;administration) ·{" "}
          <a href="https://api-lannuaire.service-public.fr" className="underline" target="_blank" rel="noopener noreferrer">
            service-public.fr
          </a>{" "}
          · Licence Ouverte v2.0
        </p>
        <p>
          Wikidata ·{" "}
          <a href={`https://www.wikidata.org/wiki/${membre.wikidata_id}`} className="underline" target="_blank" rel="noopener noreferrer">
            {membre.wikidata_id}
          </a>{" "}
          · CC0
        </p>
        <p>
          Wikipédia FR · CC BY-SA
        </p>
        <p className="italic mt-2">
          Aucune information ici ne préjuge de la culpabilité des personnes concernées.
          Les statuts judiciaires (mise en examen, condamnation) sont distincts.
        </p>
      </div>
    </div>
  )
}
