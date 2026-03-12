"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import type { MembreGouvernement, RangGouvernement } from "@/lib/types"
import { RANG_LABELS, RANG_ORDER, SCORE_LABELS } from "@/lib/types"

interface GouvernementGridProps {
  membres: MembreGouvernement[]
}

const RANG_COLS: Record<RangGouvernement, string> = {
  premier_ministre: "grid-cols-1 sm:grid-cols-1 max-w-xs mx-auto",
  ministre: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  ministre_delegue: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  secretaire_etat: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
}

const RANG_CARD_SIZE: Record<RangGouvernement, { photo: number; textSize: string }> = {
  premier_ministre: { photo: 120, textSize: "text-base" },
  ministre: { photo: 88, textSize: "text-sm" },
  ministre_delegue: { photo: 80, textSize: "text-xs" },
  secretaire_etat: { photo: 72, textSize: "text-xs" },
}

function Initiales({ prenom, nom, size }: { prenom: string; nom: string; size: number }) {
  const i = `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase()
  return (
    <div
      className="rounded-full bg-[#e8e8f0] flex items-center justify-center text-[#000091] font-bold select-none"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {i}
    </div>
  )
}

function MembreCard({ membre }: { membre: MembreGouvernement }) {
  const [imgError, setImgError] = useState(false)
  const hasAffaire = membre.score > 0
  const rang = membre.rang
  const { photo: photoSize, textSize } = RANG_CARD_SIZE[rang] ?? RANG_CARD_SIZE.ministre

  const cardContent = (
    <div className={`
      group relative bg-white rounded-2xl border border-gray-200 p-4
      flex flex-col items-center text-center gap-2
      hover:shadow-md hover:border-gray-300 transition-all cursor-pointer
      ${hasAffaire ? "ring-2 ring-[#ce0500]/20" : ""}
    `}>
      {/* Photo + badge casserole */}
      <div className="relative flex-shrink-0" style={{ width: photoSize, height: photoSize }}>
        {membre.url_photo && !imgError ? (
          <Image
            src={membre.url_photo}
            alt={`${membre.prenom} ${membre.nom}`}
            width={photoSize}
            height={photoSize}
            className="rounded-full object-cover object-top w-full h-full"
            onError={() => setImgError(true)}
            loading="lazy"
            sizes={`${photoSize}px`}
          />
        ) : (
          <Initiales prenom={membre.prenom} nom={membre.nom} size={photoSize} />
        )}

        {/* Badge casserole — pastille blanche + liseré rouge + C bleu */}
        {hasAffaire && (
          <div
            className="absolute -top-1 -right-1 flex items-center justify-center
              rounded-full bg-white border-2 border-[#ce0500]
              text-[#000091] font-bold leading-none"
            style={{ width: photoSize * 0.28, height: photoSize * 0.28, fontSize: photoSize * 0.14 }}
            title={SCORE_LABELS[membre.score as 0 | 1 | 2 | 3]}
          >
            C
          </div>
        )}
      </div>

      {/* Nom */}
      <div className="min-w-0 w-full">
        <p className={`font-semibold text-gray-900 leading-snug ${textSize}`}>
          {membre.prenom} <span className="uppercase">{membre.nom}</span>
        </p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug line-clamp-2">
          {membre.poste}
        </p>
      </div>

      {/* Parti + score */}
      <div className="flex flex-wrap justify-center gap-1 mt-auto">
        <span className="inline-block rounded-full border border-gray-300 px-2 py-0.5 text-[10px] text-gray-600 leading-none">
          {membre.parti}
        </span>
        {hasAffaire && (
          <span className="inline-block rounded-full bg-[#fee9e9] border border-[#fcc0bf] px-2 py-0.5 text-[10px] text-[#ce0500] font-medium leading-none">
            {SCORE_LABELS[membre.score as 0 | 1 | 2 | 3]}
          </span>
        )}
      </div>
    </div>
  )

  return (
    <Link href={`/gouvernement/${membre.wikidata_id}`} className="no-underline">
      {cardContent}
    </Link>
  )
}

// Regroupe les membres par rang, dans l'ordre hiérarchique
function groupByRang(membres: MembreGouvernement[]) {
  const grouped: Partial<Record<RangGouvernement, MembreGouvernement[]>> = {}
  for (const m of membres) {
    const r = m.rang
    if (!grouped[r]) grouped[r] = []
    grouped[r]!.push(m)
  }
  return Object.entries(grouped)
    .sort(([a], [b]) => (RANG_ORDER[a as RangGouvernement] ?? 99) - (RANG_ORDER[b as RangGouvernement] ?? 99)) as [RangGouvernement, MembreGouvernement[]][]
}

export function GouvernementGrid({ membres }: GouvernementGridProps) {
  const groupes = groupByRang(membres)

  return (
    <div className="space-y-10">
      {groupes.map(([rang, group]) => (
        <section key={rang}>
          {/* Séparateur de rang */}
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-semibold uppercase tracking-widest text-[#000091]">
              {RANG_LABELS[rang]}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">{group.length}</span>
          </div>

          {/* Grille de cartes */}
          <div className={`grid gap-4 ${RANG_COLS[rang]}`}>
            {group.map((m) => (
              <MembreCard key={m.wikidata_id} membre={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
