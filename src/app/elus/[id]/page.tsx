import { getElus, getAffairesForElu } from "@/lib/data"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  SCORE_LABELS,
  SCORE_COLORS,
  SCORE_DOTS,
  NIVEAU_LABELS,
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
  const decodedId = decodeURIComponent(id)
  const elus = getElus()
  const elu = elus.find((e) => e.id === decodedId)
  if (!elu) return { title: "Élu non trouvé" }
  return {
    title: `${elu.prenom} ${elu.nom}`,
    description: `Fiche de probité de ${elu.prenom} ${elu.nom}, ${elu.mandat}. Score : ${elu.score}/3, ${elu.nb_affaires} affaire(s).`,
  }
}

export async function generateStaticParams() {
  // Pour les élus avec affaires uniquement (les autres sont trop nombreux)
  const elus = getElus()
  return elus
    .filter((e) => e.nb_affaires > 0)
    .map((e) => ({ id: encodeURIComponent(e.id) }))
}

export default async function FicheEluPage({ params }: Props) {
  const { id } = await params
  const decodedId = decodeURIComponent(id)

  const elus = getElus()
  const elu = elus.find((e) => e.id === decodedId)
  if (!elu) notFound()

  const affaires = getAffairesForElu(elu.affaires)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500">
        <Link href="/elus" className="hover:text-gray-700">Élus</Link>
        {" → "}
        <span className="text-gray-800">{elu.prenom} {elu.nom}</span>
      </nav>

      {/* En-tête */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {elu.url_photo ? (
              <Image
                src={elu.url_photo}
                alt={`Photo de ${elu.prenom} ${elu.nom}`}
                width={72}
                height={96}
                className="rounded-lg object-cover flex-shrink-0 border border-gray-200"
                unoptimized
              />
            ) : (
              <div className="w-[72px] h-[96px] rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200">
                <span className="text-2xl text-gray-300">
                  {elu.prenom[0]}{elu.nom[0]}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {elu.prenom} {elu.nom}
              </h1>
              <p className="text-gray-500 mt-1">{elu.mandat}</p>
              {elu.territoire && (
                <p className="text-sm text-gray-400">{elu.territoire}</p>
              )}
            </div>
          </div>
          <Badge className={`text-sm px-3 py-1 flex-shrink-0 ${SCORE_COLORS[elu.score]}`}>
            {SCORE_LABELS[elu.score]}
          </Badge>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline">{NIVEAU_LABELS[elu.niveau]}</Badge>
          <Badge variant="outline" className="max-w-48 truncate">{elu.parti}</Badge>
          {elu.url_source && (
            <a
              href={elu.url_source}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#000091] underline flex items-center gap-1"
            >
              Fiche NosDéputés.fr ↗
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
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold tracking-widest ${SCORE_COLORS[elu.score]}`}>
              {SCORE_DOTS[elu.score]}
            </div>
            <div>
              <p className="font-medium text-gray-900">{SCORE_LABELS[elu.score]}</p>
              <p className="text-sm text-gray-500">
                {elu.nb_affaires > 0
                  ? `${elu.nb_affaires} affaire${elu.nb_affaires > 1 ? "s" : ""} répertoriée${elu.nb_affaires > 1 ? "s" : ""}`
                  : "Aucune affaire trouvée dans les sources référencées"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([3, 2, 1, 0] as const).map((s) => (
              <Link
                key={s}
                href={`/elus?score=${s}`}
                className={`rounded-lg border p-3 text-center text-xs transition-opacity hover:opacity-80 ${elu.score === s ? SCORE_COLORS[s] + " border-current font-semibold" : "bg-gray-50 text-gray-400 border-gray-100"}`}
              >
                <div className="font-bold text-base tracking-widest mb-1">{SCORE_DOTS[s]}</div>
                <div>{SCORE_LABELS[s]}</div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Gravité croissante de ○○○ (aucune affaire) à ●●● (condamnation définitive).
            Cliquer sur un niveau affiche tous les élus concernés.
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
              {affaire.personnes && (
                <p className="text-xs font-medium text-gray-600 mb-2">
                  <span className="text-gray-400">Personnes impliquées : </span>
                  {affaire.personnes}
                </p>
              )}
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
              Cet élu n&apos;apparaît dans aucune des sources référencées (TI France, RNE).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sources */}
      <div className="text-xs text-gray-400 space-y-1 bg-gray-50 rounded-lg p-4">
        <p className="font-medium text-gray-500">Sources utilisées pour cette fiche</p>
        <p>
          Répertoire National des Élus (RNE) ·{" "}
          <a href="https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/" className="underline" target="_blank" rel="noopener noreferrer">
            data.gouv.fr
          </a>{" "}
          · Licence Ouverte v2.0
        </p>
        {elu.url_source && (
          <p>
            NosDéputés.fr ·{" "}
            <a href={elu.url_source} className="underline" target="_blank" rel="noopener noreferrer">
              {elu.url_source}
            </a>{" "}
            · Licence ODbL
          </p>
        )}
        <p className="italic mt-2">
          Aucune information ici ne préjuge de la culpabilité des personnes concernées.
          Les statuts judiciaires (mise en examen, condamnation) sont distincts.
        </p>
      </div>
    </div>
  )
}
