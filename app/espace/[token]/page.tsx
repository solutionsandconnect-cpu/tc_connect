'use client'

import { use, useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { DocumentTextIcon, CheckCircleIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import PortailContrat, { type PortalData } from '@/components/espace/PortailContrat'

export default function EspaceClientPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { currentUser, userProfile, loading: authLoading } = useAuth()

  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)
  const [claimError, setClaimError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/espace/${token}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Lien invalide.'); return }
      setData(d)
    } catch {
      setError('Impossible de charger votre espace.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const onSign = useCallback(async (devisId: string, signatureDataUrl: string) => {
    const res = await fetch(`/api/espace/${token}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ devisId, signatureDataUrl }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || 'Erreur')
    load()  // rafraîchit en arrière-plan (ne bloque pas la fermeture du modal)
  }, [token, load])

  const onSignDoc = useCallback(async (docId: string, signatureDataUrl: string) => {
    const res = await fetch(`/api/espace/${token}/sign-doc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId, signatureDataUrl }),
    })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error || 'Erreur')
    load()
  }, [token, load])

  const handleClaim = async () => {
    if (!currentUser) return
    setClaiming(true)
    setClaimError('')
    try {
      const idToken = await currentUser.getIdToken()
      const res = await fetch(`/api/espace/${token}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erreur')
      setClaimed(true)
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Impossible de rattacher ce projet.')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-bold text-gray-800 mb-1">Lien indisponible</p>
        <p className="text-sm text-gray-500">{error || 'Ce lien est expiré ou introuvable.'}</p>
      </div>
    )
  }

  // Bannière « compte » (Phase 3) — accès persistant optionnel
  let banner: React.ReactNode = null
  if (!authLoading) {
    if (claimed) {
      banner = (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 flex-1">Ce projet est rattaché à votre compte.</span>
          <a href="/mon-espace" className="inline-flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-900">
            Mon espace <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      )
    } else if (currentUser) {
      banner = (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 space-y-2">
          <p className="text-sm text-blue-800">
            Rattachez ce projet à votre compte pour le retrouver à tout moment, sans ce lien.
          </p>
          {claimError && <p className="text-xs text-red-600">{claimError}</p>}
          <div className="flex items-center gap-3">
            <button onClick={handleClaim} disabled={claiming}
              className="inline-flex items-center text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 px-3.5 py-2 rounded-xl transition">
              {claiming ? 'Rattachement…' : 'Rattacher à mon compte'}
            </button>
            {userProfile?.linkedClientId && (
              <a href="/mon-espace" className="text-sm font-medium text-blue-700 hover:text-blue-900">Mon espace</a>
            )}
          </div>
        </div>
      )
    } else {
      banner = (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-sm text-blue-800">Vous avez un compte ? Connectez-vous pour retrouver vos projets.</span>
          <a href="/login" className="text-sm font-semibold text-blue-700 hover:text-blue-900 shrink-0">Se connecter</a>
        </div>
      )
    }
  }

  return <PortailContrat data={data} onSign={onSign} onSignDoc={onSignDoc} banner={banner} />
}
