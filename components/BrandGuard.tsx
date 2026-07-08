'use client'

// components/BrandGuard.tsx
// Garde une page à un/des univers (« une app, deux portes »).
// - Admin : bypass total (voit tout).
// - Univers actif autorisé pour la page → affiche le contenu.
// - Compte multi-univers dont l'univers requis est autorisé mais non actif → propose de basculer.
// - Sinon → écran « cet espace n'est pas le vôtre ».
// La nav (Navbar) filtre déjà l'AFFICHAGE ; ce garde ferme l'accès par URL directe.

import { useAuth } from '@/context/AuthContext'
import { useBrand } from '@/context/BrandContext'
import { BRANDS, type Brand } from '@/lib/brand'

export default function BrandGuard({ allow, children }: { allow: Brand[]; children: React.ReactNode }) {
  const { userProfile, loading } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { brand, allowedBrands, setBrand } = useBrand()

  // Profil pas encore chargé : ne pas flasher l'écran de refus.
  if (loading || !userProfile) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Admin voit tout ; ou l'univers actif est autorisé pour cette page.
  if (isAdmin || allow.includes(brand)) return <>{children}</>

  // Le compte a droit à un univers requis, mais il n'est pas l'univers actif → bascule possible.
  const target = allow.find((b) => allowedBrands.includes(b))

  return (
    <div className="flex items-center justify-center py-20 px-4">
      <div className="max-w-sm w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-2xl">🔒</div>
        <h1 className="text-lg font-bold text-gray-800">Cet espace n&apos;est pas le vôtre</h1>
        {target ? (
          <>
            <p className="text-sm text-gray-500 mt-2">
              Cette page fait partie de l&apos;espace <strong>{BRANDS[target].nom}</strong>. Basculez pour y accéder.
            </p>
            <button
              onClick={() => setBrand(target)}
              className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 text-sm font-semibold transition"
            >
              Aller dans l&apos;espace {BRANDS[target].nom}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-500 mt-2">
            Vous n&apos;avez pas accès à cette partie de l&apos;application.
          </p>
        )}
      </div>
    </div>
  )
}
