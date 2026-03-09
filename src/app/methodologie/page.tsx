import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { SCORE_LABELS, SCORE_COLORS, SCORE_DOTS, STATUT_LABELS, STATUT_COLORS } from "@/lib/types"

export const metadata: Metadata = {
  title: "Méthodologie",
  description: "Sources de données, calcul du score de probité, statuts judiciaires, limites et licences.",
}

export default function MethodologiePage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Méthodologie</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sources utilisées, calcul du score de probité, limites et licences.
        </p>
      </div>

      {/* Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Sources de données</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <h3 className="font-semibold text-gray-900">
              Répertoire National des Élus (RNE)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Source officielle des élus français, gérée par le Ministère de l&apos;Intérieur.
              Couvre les conseillers municipaux, maires, conseillers départementaux,
              conseillers régionaux, députés, sénateurs et eurodéputés.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">CSV · Trimestriel</Badge>
              <Badge variant="outline" className="text-xs">Licence Ouverte v2.0</Badge>
              <a
                href="https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#000091] underline"
              >
                data.gouv.fr ↗
              </a>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-gray-900">
              Transparency International France – Affaires de corruption
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Base de données des condamnations et affaires de corruption documentées par la presse,
              compilée par Transparency International France. Contient les affaires répertoriées
              jusqu&apos;en août 2016. Couvre les atteintes à la probité : corruption, favoritisme,
              prise illégale d&apos;intérêts, détournements de fonds publics, etc.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">CSV/JSON · Base 2016</Badge>
              <a
                href="https://www.data.gouv.fr/fr/datasets/affaires-de-corruption-en-france-par-transparency-international-france-1/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#000091] underline"
              >
                data.gouv.fr ↗
              </a>
              <a
                href="https://transparency-france.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#000091] underline"
              >
                Transparency International France ↗
              </a>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-gray-900">Wikidata – Condamnations et accusations</h3>
            <p className="text-sm text-gray-600 mt-1">
              Base de connaissances collaborative (Wikimedia). Requêtes SPARQL sur les propriétés
              P1399 (condamné pour) et P1415 (accusé de) des personnalités politiques françaises.
              Permet d&apos;obtenir des noms, dates de condamnation et infractions pour enrichir
              les affaires au-delà de la base TI France (arrêtée en 2016).
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">SPARQL · Licence CC0</Badge>
              <a
                href="https://query.wikidata.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#000091] underline"
              >
                query.wikidata.org ↗
              </a>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold text-gray-900">NosDéputés.fr</h3>
            <p className="text-sm text-gray-600 mt-1">
              Plateforme citoyenne offrant des données enrichies sur les députés (photos, fiches,
              groupe parlementaire). Utilisée pour enrichir les profils et attribuer le parti
              politique des députés issus du RNE.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="outline" className="text-xs">API JSON · Licence ODbL</Badge>
              <a
                href="https://www.nosdeputes.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#000091] underline"
              >
                nosdeputes.fr ↗
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Score */}
      <Card>
        <CardHeader>
          <CardTitle>Score de probité (0–3)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Chaque élu se voit attribuer un score basé uniquement sur les informations
            disponibles dans les sources référencées. Un score de 0 signifie l&apos;absence
            d&apos;affaire dans ces sources, et <strong>ne constitue pas un certificat de probité</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([3, 2, 1, 0] as const).map((s) => (
              <div key={s} className={`rounded-lg border p-4 ${SCORE_COLORS[s]}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold tracking-widest">{SCORE_DOTS[s]}</span>
                  <span className="font-medium">{SCORE_LABELS[s]}</span>
                </div>
                <p className="text-xs opacity-80">
                  {s === 3 && "Au moins une condamnation définitive pour atteinte à la probité ou corruption."}
                  {s === 2 && "Au moins une mise en examen ou renvoi en procès pour des faits de probité."}
                  {s === 1 && "Au moins une enquête publique documentée par des sources fiables."}
                  {s === 0 && "Aucune affaire répertoriée dans les sources utilisées."}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statuts judiciaires */}
      <Card>
        <CardHeader>
          <CardTitle>Statuts judiciaires</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Les statuts sont toujours affichés explicitement pour ne jamais présenter
            une mise en examen comme une condamnation, ou une enquête comme un jugement.
          </p>
          <div className="space-y-2">
            {(["condamnation", "mise_en_examen", "enquete", "relaxe", "classe_sans_suite"] as const).map((s) => (
              <div key={s} className="flex items-center gap-3">
                <Badge className={`text-xs border w-36 justify-center flex-shrink-0 ${STATUT_COLORS[s]}`}>
                  {STATUT_LABELS[s]}
                </Badge>
                <span className="text-sm text-gray-600">
                  {s === "condamnation" && "Décision de justice rendue (1ère instance, appel ou cassation)."}
                  {s === "mise_en_examen" && "Mis(e) en examen par un juge d'instruction – présomption d'innocence maintenue."}
                  {s === "enquete" && "Enquête en cours documentée par des sources fiables – aucune charge officielle."}
                  {s === "relaxe" && "Acquitté(e) ou relaxé(e) par un tribunal."}
                  {s === "classe_sans_suite" && "Affaire classée sans suite par le parquet."}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Limites */}
      <Card>
        <CardHeader>
          <CardTitle>Limites et avertissements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <p>
            <strong>Correspondance élus ↔ affaires TI France limitée.</strong>{" "}
            La base TI France (2016) décrit souvent les personnes impliquées par leur
            fonction (&quot;l&apos;ancien maire de X&quot;) sans nom propre, ce qui empêche
            la jointure automatique avec le RNE actuel. Ces affaires sont donc affichées
            géographiquement (région/département) mais rarement liées à un élu individuel.
          </p>
          <p>
            <strong>Correspondance Wikidata par nom.</strong>{" "}
            Les affaires Wikidata sont reliées aux élus par correspondance de nom
            (prénom + nom de famille). Des homonymes peuvent entraîner de faux positifs.
          </p>
          <p>
            <strong>Base TI France arrêtée en 2016.</strong>{" "}
            Les affaires postérieures à août 2016 ne sont pas incluses dans cette source.
            Wikidata complète partiellement ce manque mais ne couvre pas l&apos;exhaustivité
            des affaires récentes.
          </p>
          <p>
            <strong>Partis politiques partiels.</strong>{" "}
            Le RNE ne contient pas l&apos;appartenance partisane des élus locaux (maires,
            conseillers municipaux, etc.). Seuls les députés sont enrichis avec leur groupe
            parlementaire via NosDéputés.fr. Les autres élus apparaissent sous
            &quot;Autre / Non renseigné&quot;.
          </p>
          <p>
            <strong>Le score ○○○ ne certifie pas la probité.</strong>{" "}
            Il signifie simplement l&apos;absence d&apos;affaire dans les sources utilisées.
            Des affaires non documentées ou absentes de ces bases ne seront pas reflétées.
          </p>
          <p>
            <strong>Vocabulaire neutre.</strong>{" "}
            Aucun élu n&apos;est qualifié de &quot;corrompu&quot;. Les formulations utilisées
            renvoient strictement aux statuts judiciaires officiels.
          </p>
          <p>
            <strong>RGPD.</strong>{" "}
            Seules des données déjà publiques (open-data gouvernemental et Wikidata CC0)
            sont utilisées. Aucune donnée sensible hors périmètre open-data n&apos;est traitée.
          </p>
        </CardContent>
      </Card>

      {/* Fréquence de MAJ */}
      <Card>
        <CardHeader>
          <CardTitle>Fréquence de mise à jour</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-medium text-gray-900">RNE (élus)</p>
              <p>Trimestrielle (Ministère de l&apos;Intérieur)</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">TI France (affaires)</p>
              <p>Statique (base arrêtée en 2016)</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Wikidata (affaires)</p>
              <p>Collaborative (mise à jour continue par la communauté)</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">NosDéputés.fr (enrichissement)</p>
              <p>En continu (API temps réel)</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">ETL Casseroles</p>
              <p>Hebdomadaire (via GitHub Actions)</p>
            </div>
            <div>
              <p className="font-medium text-gray-900">Cache Next.js</p>
              <p>1 heure (revalidation ISR)</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
