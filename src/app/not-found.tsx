import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-[#000091]">404</p>
      <h1 className="text-xl font-semibold text-gray-900 mt-4">Page introuvable</h1>
      <p className="text-sm text-gray-500 mt-2 max-w-md">
        La page que vous cherchez n&apos;existe pas ou a été déplacée.
      </p>
      <div className="flex gap-3 mt-6">
        <Link
          href="/"
          className="px-4 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
          style={{ background: "#000091" }}
        >
          Tableau de bord
        </Link>
        <Link
          href="/elus"
          className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Explorer les élus
        </Link>
      </div>
    </div>
  )
}
