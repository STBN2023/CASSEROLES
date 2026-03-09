import type { Metadata } from "next"
import "./globals.css"
import Link from "next/link"

export const metadata: Metadata = {
  title: {
    default: "Casseroles – Observatoire de la probité des élus",
    template: "%s – Casseroles",
  },
  description:
    "Vision sourcée et neutre des affaires judiciaires impliquant des élus français. Données open-data : RNE, Transparency International France, Wikidata.",
  openGraph: {
    title: "Casseroles – Observatoire de la probité des élus",
    description:
      "Vision sourcée et neutre des affaires judiciaires impliquant des élus français. Données open-data : RNE, TI France, Wikidata.",
    locale: "fr_FR",
    type: "website",
    siteName: "Casseroles",
  },
  twitter: {
    card: "summary",
    title: "Casseroles – Observatoire de la probité des élus",
    description: "Observatoire open-data des affaires judiciaires de probité liées aux élus français.",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased min-h-screen" style={{ background: "#f5f5fe" }}>

        {/* Lien d'accès rapide – accessibilité */}
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#000091] focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
        >
          Aller au contenu
        </a>

        {/* Bandeau service – inspiré DSFR */}
        <header role="banner" className="bg-white sticky top-0 z-50" style={{ borderBottom: "2px solid #000091" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-3 no-underline" style={{ color: "#161616" }} aria-label="Casseroles – Accueil">
                <span
                  className="flex items-center justify-center w-9 h-9 text-white font-bold text-lg"
                  style={{ background: "#000091", borderRadius: "4px" }}
                  aria-hidden="true"
                >
                  C
                </span>
                <div className="leading-tight">
                  <div className="font-bold text-sm" style={{ color: "#000091" }}>Casseroles</div>
                  <div className="hidden sm:block text-xs" style={{ color: "#666666" }}>Observatoire de la probité des élus</div>
                </div>
              </Link>
              <nav aria-label="Navigation principale" className="flex items-center gap-0.5">
                <Link href="/" className="nav-link"><span className="hidden sm:inline">Tableau de bord</span><span className="sm:hidden">Accueil</span></Link>
                <Link href="/gouvernement" className="nav-link">Gouvernement</Link>
                <Link href="/elus" className="nav-link">Élus</Link>
                <Link href="/affaires" className="nav-link">Affaires</Link>
                <Link href="/partis" className="nav-link">Partis</Link>
                <Link href="/methodologie" className="nav-link"><span className="hidden sm:inline">Méthodologie</span><span className="sm:hidden">Méthodo</span></Link>
              </nav>
            </div>
          </div>
        </header>

        <main id="contenu" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer DSFR */}
        <footer role="contentinfo" className="mt-16 bg-white" style={{ borderTop: "2px solid #000091" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm" style={{ color: "#666666" }}>
              <div>
                <p className="font-bold mb-1" style={{ color: "#161616" }}>Casseroles</p>
                <p>
                  Données issues du{" "}
                  <a href="https://www.data.gouv.fr/fr/datasets/repertoire-national-des-elus-1/" target="_blank" rel="noopener noreferrer">
                    RNE
                  </a>{" "}
                  (Licence Ouverte 2.0),{" "}
                  <a href="https://transparency-france.org" target="_blank" rel="noopener noreferrer">
                    Transparency International France
                  </a>{" "}
                  et{" "}
                  <a href="https://www.wikidata.org" target="_blank" rel="noopener noreferrer">
                    Wikidata
                  </a>{" "}
                  (CC0).
                </p>
              </div>
              <div className="text-xs text-right" style={{ color: "#888" }}>
                <p>Usage informatif uniquement.</p>
                <p>Aucune affirmation ne préjuge de la culpabilité des personnes citées.</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
