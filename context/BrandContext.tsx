'use client'

// context/BrandContext.tsx
// Résout l'univers COURANT (marque active) et l'ensemble des univers AUTORISÉS d'un compte,
// et expose de quoi changer d'espace (comptes multi-univers).
//
// Univers autorisés : Admin → tous ; sinon les `marques` du profil (repli `marque` déprécié, défaut coaching).
// Univers actif, dans l'ordre :
//   1. Override dev   (?brand=enezo | ?brand=coaching)         — si autorisé
//   2. Domaine        (host → hostToBrand, résolu au SSR via `initialBrand`)
//                       — si autorisé, OU si pas (encore) de profil (login / chargement) :
//                         le domaine est l'ENTRÉE, il habille avant connexion.
//   3. Choix in-app   (sélecteur « changer d'espace », persisté) — si autorisé
//   4. Univers principal (marques[0])
//   5. Défaut coaching
// On ne laisse JAMAIS un utilisateur CONNECTÉ voir un univers hors de son ensemble autorisé
// (hors Admin qui voit tout). Le seul cas où le domaine passe outre = aucun profil chargé.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  ALL_BRANDS, BRANDS, DEFAULT_BRAND, hostToBrand, normalizeMarques,
  type Brand, type BrandConfig,
} from '@/lib/brand'

type BrandSource = 'override' | 'domaine' | 'choix' | 'principal' | 'defaut'

interface BrandContextType {
  /** Univers actuellement affiché. */
  brand: Brand
  config: BrandConfig
  /** Univers auxquels le compte a droit (Admin = tous). */
  allowedBrands: Brand[]
  /** true si le compte a accès à ≥ 2 univers → afficher le sélecteur. */
  canSwitch: boolean
  /** Change l'univers actif (ignoré si non autorisé). Persisté. */
  setBrand: (b: Brand) => void
  source: BrandSource
}

const STORAGE_KEY = 'tc.activeBrand'

const BrandContext = createContext<BrandContextType>({
  brand: DEFAULT_BRAND,
  config: BRANDS[DEFAULT_BRAND],
  allowedBrands: [DEFAULT_BRAND],
  canSwitch: false,
  setBrand: () => {},
  source: 'defaut',
})

function readUrlOverride(): Brand | null {
  if (typeof window === 'undefined') return null
  // window.location.search (pas useSearchParams, qui imposerait une frontière Suspense en Next 16)
  const o = new URLSearchParams(window.location.search).get('brand')
  return o === 'enezo' || o === 'coaching' ? o : null
}

export function BrandProvider({
  children,
  initialBrand,
}: {
  children: React.ReactNode
  /** Marque résolue par le DOMAINE côté serveur (host → hostToBrand). Autoritaire à l'entrée. */
  initialBrand?: Brand
}) {
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const allowedBrands = useMemo<Brand[]>(
    () => (isAdmin ? ALL_BRANDS : normalizeMarques(userProfile)),
    [isAdmin, userProfile]
  )

  // Choix in-app persisté (chargé une fois côté client).
  const [choice, setChoice] = useState<Brand | null>(null)
  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      if (s === 'enezo' || s === 'coaching') setChoice(s)
    } catch { /* localStorage indispo */ }
  }, [])

  const setBrand = useCallback((b: Brand) => {
    setChoice(b)
    try { localStorage.setItem(STORAGE_KEY, b) } catch { /* ignore */ }
  }, [])

  const { brand, source } = useMemo<{ brand: Brand; source: BrandSource }>(() => {
    const ok = (b: Brand | null): b is Brand => !!b && allowedBrands.includes(b)
    const override = readUrlOverride()
    if (ok(override)) return { brand: override, source: 'override' }
    // Domaine : `initialBrand` (résolu au SSR) fait foi ; repli client sur le hostname.
    const fromHost = initialBrand ?? (typeof window !== 'undefined' ? hostToBrand(window.location.hostname) : null)
    // Honoré s'il est autorisé, OU tant qu'aucun profil n'est chargé (login / chargement) :
    // le domaine habille l'entrée avant connexion. Une fois connecté, on reste dans l'autorisé.
    if (fromHost && (ok(fromHost) || !userProfile)) return { brand: fromHost, source: 'domaine' }
    if (ok(choice)) return { brand: choice, source: 'choix' }
    if (allowedBrands[0]) return { brand: allowedBrands[0], source: 'principal' }
    return { brand: DEFAULT_BRAND, source: 'defaut' }
  }, [allowedBrands, choice, initialBrand, userProfile])

  // Applique le thème de la marque active à toute l'app : <html data-brand="…">
  // → la surcharge CSS des variables (globals.css) re-thème boutons/états/focus d'un coup.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.setAttribute('data-brand', brand)
  }, [brand])

  const value = useMemo<BrandContextType>(() => ({
    brand,
    config: BRANDS[brand],
    allowedBrands,
    canSwitch: allowedBrands.length >= 2,
    setBrand,
    source,
  }), [brand, allowedBrands, setBrand, source])

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}

export const useBrand = () => useContext(BrandContext)
