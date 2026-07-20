'use client'

import { useCallback, useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { Copy, Check, Link2, Trash2, UserPlus, LogOut, Share2 } from 'lucide-react'
import type { Bebe, BebeMember } from '@/types'

interface PendingInvite {
  token: string
  createdByName: string
  expiresAt: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  baby: Bebe
  /** Appelé après « quitter le partage » (le bébé disparaît de la liste). */
  onLeft?: () => void
}

/** Partage d'un bébé avec l'autre parent : lien d'invitation + gestion des accès. */
export function ShareBabyModal({ isOpen, onClose, baby, onLeft }: Props) {
  const { currentUser } = useAuth()
  const [members, setMembers] = useState<BebeMember[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [isCreator, setIsCreator] = useState(false)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const call = useCallback(async (url: string, body: Record<string, unknown>) => {
    if (!currentUser) throw new Error('Session expirée.')
    const idToken = await currentUser.getIdToken()
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, ...body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data?.error || 'Une erreur est survenue.')
    return data
  }, [currentUser])

  const refresh = useCallback(async () => {
    setError('')
    try {
      const data = await call('/api/bebe-invite/list', { babyId: baby.id })
      setMembers(data.members ?? [])
      setInvites(data.invites ?? [])
      setIsCreator(!!data.isCreator)
    } catch (e: any) {
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [call, baby.id])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    refresh()
  }, [isOpen, refresh])

  const inviteUrl = invites.length
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/bebe-invitation/${invites[0].token}`
    : ''

  const handleGenerate = async () => {
    setWorking(true); setError('')
    try {
      await call('/api/bebe-invite/create', { babyId: baby.id })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Génération impossible.')
    } finally {
      setWorking(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Copie impossible — sélectionnez le lien à la main.')
    }
  }

  const handleShare = async () => {
    try {
      await navigator.share({
        title: `Suivi de ${baby.name}`,
        text: `Rejoins-moi pour suivre ${baby.name} (biberons, couches, sommeil) :`,
        url: inviteUrl,
      })
    } catch { /* partage annulé */ }
  }

  const handleRevoke = async (token: string) => {
    setWorking(true); setError('')
    try {
      await call('/api/bebe-invite/revoke', { token })
      await refresh()
    } catch (e: any) {
      setError(e?.message || 'Révocation impossible.')
    } finally {
      setWorking(false)
    }
  }

  const handleRemove = async (uid: string) => {
    const isSelf = uid === currentUser?.uid
    setWorking(true); setError('')
    try {
      await call('/api/bebe-invite/remove-member', { babyId: baby.id, uid })
      if (isSelf) { onClose(); onLeft?.() }
      else await refresh()
    } catch (e: any) {
      setError(e?.message || 'Retrait impossible.')
    } finally {
      setWorking(false)
    }
  }

  const label = (m: BebeMember) => {
    const name = [m.prenom, m.nom].filter(Boolean).join(' ').trim()
    return name || m.email || 'Compte sans nom'
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Partager — ${baby.name}`}>
      <div className="space-y-5">

        <p className="text-sm text-gray-500">
          L'autre parent voit et complète le suivi de {baby.name} en temps réel, depuis son
          propre compte. Aucun abonnement supplémentaire n'est nécessaire.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Qui a accès ─────────────────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Qui a accès</h3>
              <div className="space-y-1.5">
                {members.map(m => (
                  <div key={m.uid} className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {label(m)}{m.uid === currentUser?.uid && <span className="text-gray-400 font-normal"> (vous)</span>}
                      </p>
                      <p className="text-xs text-gray-500">{m.isCreator ? 'Parent principal' : 'Co-parent'}</p>
                    </div>
                    {isCreator && !m.isCreator && (
                      <button onClick={() => handleRemove(m.uid)} disabled={working}
                        title="Retirer l'accès"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Lien d'invitation ───────────────────────────────────────── */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Inviter l'autre parent</h3>

              {invites.length === 0 ? (
                <button onClick={handleGenerate} disabled={working}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm transition">
                  <UserPlus size={16} />
                  {working ? 'Génération…' : 'Générer un lien d\'invitation'}
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                    <Link2 size={15} className="text-blue-600 shrink-0" />
                    <span className="text-xs text-blue-900 truncate flex-1">{inviteUrl}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCopy}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-gray-50 transition">
                      {copied ? <><Check size={15} className="text-green-600" />Copié</> : <><Copy size={15} />Copier</>}
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button onClick={handleShare}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-sm transition">
                        <Share2 size={15} />Partager
                      </button>
                    )}
                    <button onClick={() => handleRevoke(invites[0].token)} disabled={working}
                      title="Annuler ce lien"
                      className="px-3 rounded-xl border border-gray-300 text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">
                    Valable 7 jours et utilisable une seule fois. Le lien devient inactif dès que
                    l'autre parent l'a accepté.
                  </p>
                </div>
              )}
            </div>

            {/* ── Quitter (co-parent invité) ──────────────────────────────── */}
            {!isCreator && currentUser && (
              <div className="pt-1 border-t border-gray-100">
                <button onClick={() => handleRemove(currentUser.uid)} disabled={working}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-red-500 py-2 transition">
                  <LogOut size={15} />Quitter le partage
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
