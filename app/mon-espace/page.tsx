'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { FolderIcon, ArrowRightIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import BrandGuard from '@/components/BrandGuard'

interface ContratItem {
  id: string
  appNom: string | null
  clientNom: string
  statut: string
}

const STATUT: Record<string, { label: string; cls: string }> = {
  prospect: { label: 'Proposition', cls: 'bg-amber-100 text-amber-700' },
  actif: { label: 'En cours', cls: 'bg-green-100 text-green-700' },
  pause: { label: 'En pause', cls: 'bg-gray-100 text-gray-600' },
  termine: { label: 'Terminé', cls: 'bg-gray-100 text-gray-500' },
}

export default function MonEspacePage() {
  return (
    <BrandGuard allow={['enezo']}>
      <MonEspacePageInner />
    </BrandGuard>
  )
}

function MonEspacePageInner() {
  const { currentUser, loading: authLoading } = useAuth()
  const [contrats, setContrats] = useState<ContratItem[] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!currentUser) return
    try {
      const idToken = await currentUser.getIdToken()
      const res = await fetch('/api/mon-espace', { headers: { Authorization: `Bearer ${idToken}` } })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Erreur'); return }
      setContrats(d.contrats)
    } catch {
      setError('Impossible de charger votre espace.')
    }
  }, [currentUser])

  useEffect(() => { if (currentUser) load() }, [currentUser, load])

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <FolderIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-bold text-gray-800 mb-1">Connectez-vous</p>
        <p className="text-sm text-gray-500 mb-5">Accédez à vos projets, devis et factures.</p>
        <a href="/login" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
          Se connecter
        </a>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100">
        <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          {/* Cette page est hors du dashboard : sans ce retour, l'utilisateur n'a aucun
              moyen de revenir dans l'app (pas de navbar ici). */}
          <a
            href="/accueil"
            title="Retour à l'application"
            className="p-2 -ml-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition shrink-0"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </a>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-900">Mon espace</h1>
            <p className="text-xs text-gray-500">Vos projets, devis et factures</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-3">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        {contrats === null && !error ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : contrats && contrats.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun projet rattaché à votre compte pour le moment.</p>
          </div>
        ) : (
          (contrats ?? []).map((c) => {
            const st = STATUT[c.statut] ?? { label: c.statut, cls: 'bg-gray-100 text-gray-600' }
            return (
              <a key={c.id} href={`/mon-espace/${c.id}`}
                className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 shadow-sm px-4 py-4 transition">
                <FolderIcon className="w-6 h-6 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{c.appNom || c.clientNom}</p>
                  {c.appNom && <p className="text-xs text-gray-500 truncate">{c.clientNom}</p>}
                </div>
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                <ArrowRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
              </a>
            )
          })
        )}
      </div>
    </div>
  )
}
