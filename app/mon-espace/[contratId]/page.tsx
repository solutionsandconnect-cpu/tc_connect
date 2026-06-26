'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { FolderIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import PortailContrat, { type PortalData } from '@/components/espace/PortailContrat'

export default function MonEspaceContratPage({ params }: { params: Promise<{ contratId: string }> }) {
  const { contratId } = use(params)
  const { currentUser, loading: authLoading } = useAuth()

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!currentUser) return
    try {
      const idToken = await currentUser.getIdToken()
      const res = await fetch(`/api/mon-espace/${contratId}`, { headers: { Authorization: `Bearer ${idToken}` } })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Projet introuvable.'); return }
      setData(d)
    } catch {
      setError('Impossible de charger ce projet.')
    } finally {
      setLoading(false)
    }
  }, [currentUser, contratId])

  useEffect(() => {
    if (authLoading) return
    if (!currentUser) { setLoading(false); return }
    load()
  }, [authLoading, currentUser, load])

  const onSign = useCallback(async (devisId: string, signatureDataUrl: string) => {
    if (!currentUser) throw new Error('Connexion requise.')
    const idToken = await currentUser.getIdToken()
    const res = await fetch(`/api/mon-espace/${contratId}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, devisId, signatureDataUrl }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || 'Erreur')
    load()  // rafraîchit en arrière-plan (ne bloque pas la fermeture du modal)
  }, [currentUser, contratId, load])

  if (authLoading || loading) {
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
        <a href="/login" className="mt-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">Se connecter</a>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <FolderIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-bold text-gray-800 mb-1">Projet indisponible</p>
        <p className="text-sm text-gray-500 mb-5">{error || 'Introuvable.'}</p>
        <a href="/mon-espace" className="text-sm font-semibold text-blue-600 hover:text-blue-800">← Mon espace</a>
      </div>
    )
  }

  const headerRight = (
    <a href="/mon-espace" title="Retour" className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 shrink-0">
      <ArrowLeftIcon className="w-4 h-4" /> Mes projets
    </a>
  )

  return <PortailContrat data={data} onSign={onSign} headerRight={headerRight} />
}
