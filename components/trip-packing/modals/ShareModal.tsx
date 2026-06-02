'use client'

import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import { useUsers } from '@/hooks/useUsers'
import { shareTrip, removeMember } from '@/lib/tripsService'
import type { Trip } from '@/types'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  isOwner: boolean
  onError?: (msg: string) => void
}

export default function ShareModal({ isOpen, onClose, trip, isOwner, onError }: Props) {
  const { users } = useUsers()
  const [search, setSearch] = useState('')

  const memberIds = new Set(trip.memberIds)
  const candidates = users
    .filter(u => { const id = u.uid ?? u.id; return id && !memberIds.has(id) })
    .filter(u => {
      const q = search.toLowerCase().trim()
      if (!q) return false
      return [u.nom, u.prenom].filter(Boolean).join(' ').toLowerCase().includes(q)
        || (u.email?.toLowerCase().includes(q) ?? false)
    })
    .slice(0, 6)

  const handleAdd = async (uid: string) => {
    const user = users.find(u => (u.uid ?? u.id) === uid)
    if (!user) return
    try {
      // L'UID fiable = doc id du user (la collection users est indexée par UID auth)
      await shareTrip(trip, { ...user, uid: user.uid ?? user.id })
      setSearch('')
    } catch {
      onError?.("Impossible d'ajouter ce membre.")
    }
  }

  const handleRemove = async (uid: string) => {
    try {
      await removeMember(trip, uid)
    } catch {
      onError?.('Impossible de retirer ce membre.')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Partager le voyage" size="md">
      <div className="space-y-4">
        {/* Membres actuels */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">Membres ({trip.members.length})</p>
          <div className="space-y-1.5">
            {trip.members.map(m => {
              const name = [m.prenom, m.nom].filter(Boolean).join(' ') || m.email || m.uid.slice(0, 6)
              return (
                <div key={m.uid} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                    {m.email && <p className="text-xs text-gray-400 truncate">{m.email}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.role === 'owner' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {m.role === 'owner' ? 'Propriétaire' : 'Membre'}
                    </span>
                    {isOwner && m.role !== 'owner' && (
                      <button onClick={() => handleRemove(m.uid)} aria-label="Retirer"
                        className="p-1 text-gray-300 hover:text-red-500 transition">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Inviter (owner uniquement) */}
        {isOwner ? (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Inviter un membre</p>
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou email…"
                className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {search.trim() && (
              <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50 overflow-hidden">
                {candidates.length === 0 ? (
                  <p className="text-sm text-gray-400 px-3 py-2 italic">Aucun utilisateur trouvé</p>
                ) : candidates.map(u => (
                  <button key={u.uid ?? u.id} onClick={() => handleAdd(u.uid ?? u.id)}
                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition">
                    <span className="text-sm text-gray-800">{[u.prenom, u.nom].filter(Boolean).join(' ') || u.email}</span>
                    {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Seul le propriétaire peut inviter ou retirer des membres.</p>
        )}
      </div>
    </Modal>
  )
}
