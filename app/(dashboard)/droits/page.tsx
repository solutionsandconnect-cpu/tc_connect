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
  ShoppingBagIcon, FireIcon, CheckIcon,
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
  { key: 'parcoursSportif', label: 'Parcours Sportif', icon: FireIcon,                 description: 'Séances de groupe' },
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

  // Mode sélection multiple
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkDone, setBulkDone] = useState(false)

  const utilisateurs = users.filter((u) => u.role_app !== 'Admin')

  useEffect(() => {
    const map: Record<string, Droits> = {}
    utilisateurs.forEach((u) => {
      map[u.id] = {
        planning:        u.droits?.planning        ?? DEFAULT_DROITS.planning,
        seances:         u.droits?.seances         ?? DEFAULT_DROITS.seances,
        notifications:   u.droits?.notifications   ?? DEFAULT_DROITS.notifications,
        questionnaire:   u.droits?.questionnaire   ?? DEFAULT_DROITS.questionnaire,
        compteRendu:     u.droits?.compteRendu     ?? DEFAULT_DROITS.compteRendu,
        exercices:       u.droits?.exercices       ?? DEFAULT_DROITS.exercices,
        modifierProfil:  u.droits?.modifierProfil  ?? DEFAULT_DROITS.modifierProfil,
        boutique:        u.droits?.boutique        ?? DEFAULT_DROITS.boutique,
        parcoursSportif: u.droits?.parcoursSportif ?? DEFAULT_DROITS.parcoursSportif,
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

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(utilisateurs.map((u) => u.id)))
  const clearSelection = () => setSelectedIds(new Set())

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  // Applique un module (activer/désactiver) à tous les utilisateurs sélectionnés
  const applyBulk = async (key: keyof Droits, value: boolean) => {
    if (selectedIds.size === 0) return
    setBulkSaving(true)
    const ids = [...selectedIds]
    // Mise à jour optimiste
    setDroitsMap((prev) => {
      const next = { ...prev }
      ids.forEach((id) => { next[id] = { ...(next[id] ?? DEFAULT_DROITS), [key]: value } })
      return next
    })
    try {
      await Promise.all(ids.map((id) => updateDroits(id, { ...(droitsMap[id] ?? DEFAULT_DROITS), [key]: value })))
      setBulkDone(true)
      setTimeout(() => setBulkDone(false), 2000)
    } catch (e) {
      console.error('[applyBulk]', e)
    }
    setBulkSaving(false)
  }

  if (!userProfile || !isAdmin) return null

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-semibold text-gray-900">Droits d'accès</h1>
          </div>
          {!selectMode ? (
            <button onClick={() => setSelectMode(true)}
              className="text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
              Modifier plusieurs utilisateurs
            </button>
          ) : (
            <button onClick={exitSelectMode}
              className="text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition">
              Terminer
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {utilisateurs.length} utilisateur{utilisateurs.length !== 1 ? 's' : ''} · hors admins
        </p>
        {!selectMode && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700">
            <strong>Les Admins ont toujours accès à tout.</strong> Activez ou désactivez les modules
            pour chaque utilisateur standard. Les modifications sont appliquées immédiatement.
          </div>
        )}
      </div>

      {/* BARRE D'ACTION GROUPÉE */}
      {selectMode && (
        <div className="sticky top-2 z-20 mb-6 bg-white rounded-2xl border border-blue-200 shadow-md p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-gray-800">
              {selectedIds.size} utilisateur{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}
              {bulkSaving && <span className="ml-2 text-xs text-blue-500">Application…</span>}
              {bulkDone && !bulkSaving && <span className="ml-2 text-xs text-green-600">✓ Appliqué</span>}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="text-xs font-medium text-blue-600 hover:underline">Tout sélectionner</button>
              {selectedIds.size > 0 && (
                <button onClick={clearSelection} className="text-xs font-medium text-gray-400 hover:underline">Désélectionner</button>
              )}
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">Appliquer à la sélection :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MODULES.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700 min-w-0">
                      <Icon className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate">{label}</span>
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => applyBulk(key, true)} disabled={bulkSaving}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition disabled:opacity-50">
                        Activer
                      </button>
                      <button onClick={() => applyBulk(key, false)} disabled={bulkSaving}
                        className="text-[11px] font-semibold px-2 py-1 rounded-md bg-red-100 text-red-600 hover:bg-red-200 transition disabled:opacity-50">
                        Couper
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LÉGENDE MODULES */}
      {!selectMode && (
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
      )}

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

          const isSelected = selectedIds.has(u.id)

          return (
            <div key={u.id}
              onClick={selectMode ? () => toggleSelect(u.id) : undefined}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition ${
                selectMode ? 'cursor-pointer ' + (isSelected ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-100 hover:border-blue-200') : 'border-gray-100'
              }`}
            >
              {/* User info */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {selectMode && (
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                      isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                    </div>
                  )}
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
                  {!selectMode && isSaving && (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                  {!selectMode && isSaved && !isSaving && (
                    <span className="text-xs text-green-600 font-medium">✓ Sauvegardé</span>
                  )}
                </div>
              </div>

              {/* Module toggles — masqués en mode sélection */}
              {!selectMode && (
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
              )}

              {/* Résumé compact des accès en mode sélection */}
              {selectMode && (
                <div className="flex flex-wrap gap-1.5">
                  {MODULES.map(({ key, label }) => (
                    <span key={key} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      d[key] ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400 line-through'
                    }`}>
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
