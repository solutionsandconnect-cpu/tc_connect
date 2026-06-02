'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/hooks/useUsers'
import { updateDroits } from '@/lib/droitsService'
import {
  ShieldCheckIcon, CalendarIcon,
  ClipboardDocumentListIcon, BellIcon,
  ChatBubbleLeftEllipsisIcon, BookOpenIcon, PencilIcon, DocumentTextIcon,
  ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import type { Droits } from '@/types'
import { DEFAULT_DROITS } from '@/types'

const MODULES: { key: keyof Droits; label: string; icon: React.ElementType; description: string }[] = [
  { key: 'planning',       label: 'Planning',        icon: CalendarIcon,               description: 'RDVs et calendrier' },
  { key: 'seances',        label: 'Séances',          icon: ClipboardDocumentListIcon,  description: 'Exercices et circuits' },
  { key: 'notifications',  label: 'Notifications',    icon: BellIcon,                   description: 'Alertes et messages' },
  { key: 'questionnaire',  label: 'Questionnaire',    icon: DocumentTextIcon,           description: 'Questionnaire + bilan' },
  { key: 'compteRendu',    label: 'Compte rendu',     icon: ChatBubbleLeftEllipsisIcon, description: 'Compte rendu du coach' },
  { key: 'exercices',      label: 'Exercices',        icon: BookOpenIcon,               description: 'Bibliothèque (opt-in)' },
  { key: 'modifierProfil', label: 'Modifier profil',  icon: PencilIcon,                 description: 'Modifier ses infos' },
  { key: 'boutique',      label: 'Boutique',         icon: ShoppingBagIcon,            description: 'Accès à la boutique' },
]

export default function DroitsPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { users, loading } = useUsers()

  useEffect(() => {
    if (userProfile && !isAdmin) router.replace('/accueil')
  }, [userProfile, isAdmin, router])

  const [droitsMap, setDroitsMap] = useState<Record<string, Droits>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const utilisateurs = users.filter((u) => u.role_app !== 'Admin')

  useEffect(() => {
    const map: Record<string, Droits> = {}
    utilisateurs.forEach((u) => {
      map[u.id] = {
        planning:       u.droits?.planning       ?? DEFAULT_DROITS.planning,
        seances:        u.droits?.seances        ?? DEFAULT_DROITS.seances,
        notifications:  u.droits?.notifications  ?? DEFAULT_DROITS.notifications,
        questionnaire:  u.droits?.questionnaire  ?? DEFAULT_DROITS.questionnaire,
        compteRendu:    u.droits?.compteRendu    ?? DEFAULT_DROITS.compteRendu,
        exercices:      u.droits?.exercices      ?? DEFAULT_DROITS.exercices,
        modifierProfil: u.droits?.modifierProfil ?? DEFAULT_DROITS.modifierProfil,
        boutique:       u.droits?.boutique       ?? DEFAULT_DROITS.boutique,
      }
    })
    setDroitsMap(map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users])

  const toggle = async (userId: string, key: keyof Droits) => {
    const current = droitsMap[userId] ?? DEFAULT_DROITS
    const updated = { ...current, [key]: !current[key] }
    setDroitsMap((prev) => ({ ...prev, [userId]: updated }))
    setSaving(userId)
    try {
      await updateDroits(userId, updated)
      setSaved(userId)
      setTimeout(() => setSaved(s => s === userId ? null : s), 2000)
    } catch {
      setDroitsMap((prev) => ({ ...prev, [userId]: current }))
    } finally {
      setSaving((s) => s === userId ? null : s)
    }
  }

  if (!userProfile || !isAdmin) return null

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-semibold text-gray-900">Droits d'accès</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {utilisateurs.length} utilisateur{utilisateurs.length !== 1 ? 's' : ''} · hors admins
        </p>
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
          <strong>Les Admins ont toujours accès à tout.</strong> Activez ou désactivez les modules
          pour chaque utilisateur standard. Les modifications sont appliquées immédiatement.
        </div>
      </div>

      {/* LÉGENDE MODULES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {MODULES.map(({ key, label, icon: Icon, description }) => (
          <div key={key} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-2.5">
            <Icon className="w-5 h-5 text-blue-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* LISTE UTILISATEURS */}
      <div className="space-y-3">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 bg-gray-100 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/4" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[1,2,3,4,5,6,7].map((j) => <div key={j} className="h-16 bg-gray-100 rounded-xl" />)}
            </div>
          </div>
        ))}

        {!loading && utilisateurs.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <ShieldCheckIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucun utilisateur standard</p>
            <p className="text-xs text-gray-300 mt-1">Créez des comptes depuis la page Utilisateurs</p>
          </div>
        )}

        {!loading && utilisateurs.map((u) => {
          const d = droitsMap[u.id] ?? DEFAULT_DROITS
          const isSaving = saving === u.id
          const isSaved = saved === u.id
          const initials = ((u.prenom?.[0] ?? '') + (u.nom?.[0] ?? '')).toUpperCase() || '?'
          const allEnabled = MODULES.every(({ key }) => d[key])
          const allDisabled = MODULES.every(({ key }) => !d[key])

          return (
            <div key={u.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {/* User info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm shrink-0">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{u.prenom} {u.nom}</p>
                      {allEnabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Accès total</span>
                      )}
                      {allDisabled && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">Bloqué</span>
                      )}
                    </div>
                    {u.email && <p className="text-xs text-gray-400">{u.email}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isSaving && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {isSaved && !isSaving && (
                    <span className="text-xs text-green-600 font-medium">✓ Sauvegardé</span>
                  )}
                </div>
              </div>

              {/* Module toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MODULES.map(({ key, label, icon: Icon }) => {
                  const enabled = d[key]
                  return (
                    <button
                      key={key}
                      onClick={() => toggle(u.id, key)}
                      disabled={isSaving}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-medium transition select-none ${
                        enabled
                          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Icon className={`w-5 h-5 ${enabled ? 'text-blue-500' : 'text-gray-300'}`} />
                      <span>{label}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        enabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {enabled ? 'Activé' : 'Désactivé'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
