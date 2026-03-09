import type { Metadata } from "next"
import { Suspense } from "react"

export const metadata: Metadata = {
  title: "Affaires",
  description: "Base de données des affaires judiciaires de probité impliquant des élus français (TI France, Wikidata).",
}

export default function AffairesLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>
}
