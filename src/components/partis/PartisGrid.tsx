"use client"

import { useState } from "react"
import type { PartiDetail, Score } from "@/lib/types"
import { SCORE_COLORS, STATUT_COLORS } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

/* Logos des partis (depuis Wikidata/Wikimedia Commons) */
const PARTI_LOGOS: Record<string, string> = {
  "Les Républicains": "/data/logos/les_républicains.png",
  "Rassemblement National": "/data/logos/rassemblement_national.png",
  "La France Insoumise": "/data/logos/la_france_insoumise.png",
  "Parti Socialiste": "/data/logos/parti_socialiste.png",
  "Horizons": "/data/logos/horizons.png",
  "MoDem": "/data/logos/modem.png",
  "Renaissance": "/data/logos/renaissance.png",
  "Les Écologistes": "/data/logos/les_écologistes.png",
  "Nouveau Parti anticapitaliste": "/data/logos/nouveau_parti_anticapitaliste.png",
  "UDF": "/data/logos/udf.png",
  "Parti radical de gauche": "/data/logos/parti_radical_de_gauche.png",
}

/* Couleurs et abréviations fallback (quand pas de logo) */
const PARTI_STYLE: Record<string, { abbr: string; bg: string; text: string }> = {
  "Les Républicains":           { abbr: "LR",  bg: "#0053b3", text: "#fff" },
  "Rassemblement National":     { abbr: "RN",  bg: "#0d2240", text: "#fff" },
  "La France Insoumise":        { abbr: "LFI", bg: "#c9462c", text: "#fff" },
  "Parti Socialiste":           { abbr: "PS",  bg: "#e4003a", text: "#fff" },
  "Horizons":                   { abbr: "HZ",  bg: "#00a3e0", text: "#fff" },
  "MoDem":                      { abbr: "MD",  bg: "#ff9900", text: "#fff" },
  "Renaissance":                { abbr: "RE",  bg: "#ffcc00", text: "#1a1a1a" },
  "Les Écologistes":            { abbr: "EE",  bg: "#00a651", text: "#fff" },
  "Nouveau Parti anticapitaliste": { abbr: "NPA", bg: "#8b0000", text: "#fff" },
  "UDF":                        { abbr: "UDF", bg: "#2e86c1", text: "#fff" },
  "Parti radical de gauche":    { abbr: "PRG", bg: "#d4a017", text: "#fff" },
  "Parti Communiste Français":  { abbr: "PCF", bg: "#dd0000", text: "#fff" },
  "Gauche démocrate et républicaine": { abbr: "GDR", bg: "#c41e3a", text: "#fff" },
  "Parti de gauche":            { abbr: "PG",  bg: "#bb0000", text: "#fff" },
  "Reconquête":                 { abbr: "R!",  bg: "#1a1a2e", text: "#fff" },
  "Non inscrit":                { abbr: "NI",  bg: "#999", text: "#fff" },
  "Libertés, Indépendants, Outre-mer et Territoires": { abbr: "LIOT", bg: "#5b7c99", text: "#fff" },
  "Autre / Non renseigné":      { abbr: "AU",  bg: "#888", text: "#fff" },
}

const DEFAULT_STYLE = { abbr: "?", bg: "#666", text: "#fff" }

function getPartiStyle(nom: string) {
  return PARTI_STYLE[nom] ?? { ...DEFAULT_STYLE, abbr: nom.slice(0, 2).toUpperCase() }
}

export default function PartisGrid({ partis }: { partis: PartiDetail[] }) {
  const [openParti, setOpenParti] = useState<string | null>(null)

  const toggle = (nom: string) => {
    setOpenParti((prev) => (prev === nom ? null : nom))
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {partis.map((parti) => {
        const style = getPartiStyle(parti.nom)
        const isOpen = openParti === parti.nom

        return (
          <div key={parti.nom} className={`rounded-xl border transition-all ${isOpen ? "col-span-2 sm:col-span-3 lg:col-span-4 bg-white border-gray-200 shadow-md" : "bg-white border-gray-200 hover:shadow-md cursor-pointer"}`}>
            {/* Carte compacte – toujours visible */}
            <button
              onClick={() => toggle(parti.nom)}
              className={`w-full flex flex-col items-center gap-3 p-5 text-center ${isOpen ? "border-b border-gray-100 cursor-pointer" : ""}`}
            >
              {/* Logo du parti */}
              {PARTI_LOGOS[parti.nom] ? (
                <img
                  src={PARTI_LOGOS[parti.nom]}
                  alt={parti.nom}
                  className="h-14 w-14 object-contain shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-sm"
                  style={{ background: style.bg, color: style.text }}
                >
                  {style.abbr}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">
                  {parti.nom}
                </p>
                {parti.nb_affaires > 0 ? (
                  <p className="text-2xl font-bold mt-1" style={{ color: "#ce0500" }}>
                    {parti.nb_affaires}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      casserole{parti.nb_affaires > 1 ? "s" : ""}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm mt-1 text-[#18753c] font-medium">
                    ✓ Aucune affaire
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {parti.nb_elus_total.toLocaleString("fr-FR")} élu{parti.nb_elus_total > 1 ? "s" : ""}
                </p>
              </div>
            </button>

            {/* Détails – visible uniquement si ouvert */}
            {isOpen && (
              <div className="p-5">
                <PartiDetails parti={parti} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PartiDetails({ parti }: { parti: PartiDetail }) {
  return (
    <div className="space-y-4">
      {/* Compteurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{parti.nb_elus_concernes}</p>
          <p className="text-xs text-gray-500">Élus concernés</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{parti.nb_elus_total.toLocaleString("fr-FR")}</p>
          <p className="text-xs text-gray-500">Élus total</p>
        </div>
        {parti.total_amendes_euros > 0 && (
          <div className="text-center">
            <p className="text-xl font-bold text-[#b34000]">{parti.total_amendes_euros.toLocaleString("fr-FR")} €</p>
            <p className="text-xs text-gray-500">Amendes</p>
          </div>
        )}
        {parti.nb_avec_prison > 0 && (
          <div className="text-center">
            <p className="text-xl font-bold text-[#ce0500]">{parti.nb_avec_prison}</p>
            <p className="text-xs text-gray-500">Peines de prison</p>
          </div>
        )}
      </div>

      {/* Badges statuts */}
      <div className="flex flex-wrap gap-1.5">
        {parti.nb_condamnations > 0 && (
          <Badge className={`text-[11px] border ${STATUT_COLORS.condamnation}`}>
            {parti.nb_condamnations} condamnation{parti.nb_condamnations > 1 ? "s" : ""}
          </Badge>
        )}
        {parti.nb_mises_en_examen > 0 && (
          <Badge className={`text-[11px] border ${STATUT_COLORS.mise_en_examen}`}>
            {parti.nb_mises_en_examen} mise{parti.nb_mises_en_examen > 1 ? "s" : ""} en examen
          </Badge>
        )}
        {parti.nb_enquetes > 0 && (
          <Badge className={`text-[11px] border ${STATUT_COLORS.enquete}`}>
            {parti.nb_enquetes} enquête{parti.nb_enquetes > 1 ? "s" : ""}
          </Badge>
        )}
        {parti.nb_avec_ineligibilite > 0 && (
          <Badge className="text-[11px] border bg-orange-50 text-orange-700 border-orange-200">
            {parti.nb_avec_ineligibilite} inéligibilité{parti.nb_avec_ineligibilite > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Élus concernés */}
      {parti.elus_concernes.length > 0 && (
        <div className="border-t border-gray-100 pt-3 space-y-1.5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
            Élus concernés
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {parti.elus_concernes.map((elu) => (
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
                  <Badge className={`text-[9px] px-1.5 py-0 ${SCORE_COLORS[elu.score as Score]}`}>
                    {elu.score === 3 ? "●●●" : elu.score === 2 ? "●●○" : elu.score === 1 ? "●○○" : "○○○"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Link
            href={`/elus?parti=${encodeURIComponent(parti.nom)}`}
            className="inline-block text-xs text-[#000091] hover:underline mt-2"
          >
            Voir tous les élus de {parti.nom} →
          </Link>
        </div>
      )}
    </div>
  )
}
