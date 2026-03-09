import Link from "next/link"

interface KpiCardProps {
  label: string
  value: number | string
  sub?: string
  color?: "default" | "red" | "orange" | "yellow" | "green"
  href?: string
}

// Couleurs DSFR (Design System de l'État)
const colorMap = {
  default: "border-gray-200 bg-white",
  red: "border-[#fcc0bf] bg-[#fee9e9]",        // rouge erreur DSFR
  orange: "border-[#f9c09a] bg-[#ffe9e6]",     // orange caution DSFR
  yellow: "border-[#f5d98b] bg-[#fef7da]",     // jaune tournesol DSFR
  green: "border-[#97f4b4] bg-[#dffee6]",      // vert succès DSFR
}

const textMap = {
  default: "text-gray-900",
  red: "text-[#ce0500]",       // rouge erreur DSFR
  orange: "text-[#b34000]",    // orange caution DSFR
  yellow: "text-[#716043]",    // jaune tournesol DSFR
  green: "text-[#18753c]",     // vert succès DSFR
}

export function KpiCard({ label, value, sub, color = "default", href }: KpiCardProps) {
  const content = (
    <>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 tabular-nums ${textMap[color]}`}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={`block rounded-xl border p-5 transition-shadow hover:shadow-md ${colorMap[color]}`}
      >
        {content}
      </Link>
    )
  }

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      {content}
    </div>
  )
}
