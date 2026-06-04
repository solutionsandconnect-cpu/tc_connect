'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import { useAuth } from '@/context/AuthContext'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from '@heroicons/react/24/outline'

interface Item {
  id: string
  name: string
  qtyNeeded: number
  qtyReady: number
  note?: string
  position: number
}
interface Section {
  id: string
  title: string
  position: number
  items: Item[]
}
interface TripData {
  id: string
  name: string
  icon: string
  color: string
  sections: Section[]
}

type Permission = 'check' | 'view'

function qtyEff(item: Item): number { return item.qtyNeeded }
function isItemDone(item: Item): boolean { return item.qtyReady >= qtyEff(item) }

const IDENTITY_KEY = (token: string) => `cc_identity_${token}`

export default function PublicChecklistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const { currentUser, userProfile } = useAuth()

  const [trip, setTrip] = useState<TripData | null>(null)
  const [permission, setPermission] = useState<Permission>('view')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Identité (Tricount-style)
  const [identityStep, setIdentityStep] = useState(false)
  const [identityName, setIdentityName] = useState('')
  const [identityDraft, setIdentityDraft] = useState('')
  const [preSuggestedName, setPreSuggestedName] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setTrip(data.trip)
        setPermission(data.permission)

        // Déterminer l'identité
        const tcName = currentUser && userProfile
          ? `${userProfile.prenom ?? ''} ${userProfile.nom ?? ''}`.trim()
          : ''

        if (tcName) {
          // Compte TC Connect : utiliser le nom du profil
          setIdentityName(tcName)
        } else {
          // Pas de compte : vérifier localStorage puis le nom pré-rempli
          const saved = localStorage.getItem(IDENTITY_KEY(token))
          if (saved) {
            setIdentityName(saved)
          } else {
            const suggested = [data.prenom, data.nom].filter(Boolean).join(' ').trim()
            setPreSuggestedName(suggested)
            setIdentityDraft(suggested)
            setIdentityStep(true)  // demander confirmation
          }
        }
      })
      .catch(() => setError('Impossible de charger la liste.'))
      .finally(() => setLoading(false))
  }, [token, currentUser, userProfile])

  const confirmIdentity = () => {
    const name = identityDraft.trim() || preSuggestedName || 'Anonyme'
    setIdentityName(name)
    localStorage.setItem(IDENTITY_KEY(token), name)
    setIdentityStep(false)
    setEditingIdentity(false)
  }

  const toggleItem = useCallback(async (sectionId: string, itemId: string) => {
    if (permission === 'view') return
    const key = `${sectionId}:${itemId}`
    setPendingItems(s => new Set(s).add(key))
    setTrip(prev => {
      if (!prev) return prev
      return {
        ...prev,
        sections: prev.sections.map(s => s.id !== sectionId ? s : {
          ...s,
          items: s.items.map(it => it.id !== itemId ? it : {
            ...it,
            qtyReady: isItemDone(it) ? 0 : qtyEff(it),
          }),
        }),
      }
    })
    try {
      await fetch(`/api/invite/${token}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, itemId, action: 'toggle' }),
      })
    } catch { /* optimistic UI already applied */ }
    setPendingItems(s => { const n = new Set(s); n.delete(key); return n })
  }, [permission, token])

  const toggleSection = (id: string) => {
    setCollapsedSections(s => {
      const n = new Set(s)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <p className="text-4xl mb-3">🔗</p>
        <p className="text-lg font-bold text-gray-800 mb-1">Lien invalide</p>
        <p className="text-sm text-gray-500">{error || 'Ce lien est expiré ou introuvable.'}</p>
      </div>
    )
  }

  // ── Étape identité ───────────────────────────────────────────────────────────
  if (identityStep || editingIdentity) {
    const hasSuggested = !!preSuggestedName
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mx-auto mb-3"
              style={{ backgroundColor: trip.color + '20' }}>
              {trip.icon}
            </div>
            <h1 className="text-lg font-bold text-gray-900">{trip.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {hasSuggested ? 'Confirmez votre identité pour accéder à cette liste.' : 'Comment vous appelez-vous ?'}
            </p>
          </div>

          {hasSuggested && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-sm text-blue-700 text-center">
              Vous avez été invité(e) en tant que <strong>{preSuggestedName}</strong>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {hasSuggested ? 'Confirmer ou modifier votre nom' : 'Votre prénom et nom'}
            </label>
            <input
              autoFocus
              type="text"
              value={identityDraft}
              onChange={e => setIdentityDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmIdentity() }}
              placeholder="Prénom NOM"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={confirmIdentity}
            disabled={!identityDraft.trim() && !preSuggestedName}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            {hasSuggested ? 'C\'est moi, accéder à la liste' : 'Accéder à la liste'}
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            Votre nom est utilisé pour identifier vos actions sur cette liste.
          </p>
        </div>
      </div>
    )
  }

  // ── Liste ────────────────────────────────────────────────────────────────────
  const sortedSections = [...trip.sections].sort((a, b) => a.position - b.position)
  const allItems = sortedSections.flatMap(s => s.items)
  const totalItems = allItems.length
  const doneItems = allItems.filter(isItemDone).length
  const pct = totalItems === 0 ? 0 : Math.round((doneItems / totalItems) * 100)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: trip.color + '20' }}>
            {trip.icon}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{trip.name}</h1>
            {identityName && (
              <button onClick={() => { setIdentityDraft(identityName); setEditingIdentity(true) }}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition">
                {identityName}
                <PencilIcon className="w-3 h-3" />
              </button>
            )}
          </div>
          <a href="/login" className="shrink-0 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
            TC Connect
          </a>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-4 space-y-3">
        {/* Permission badge */}
        <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
          permission === 'check' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'
        }`}>
          <span>{permission === 'check' ? '✅' : '👁️'}</span>
          {permission === 'check' ? 'Vous pouvez cocher les éléments de cette liste.' : 'Accès en lecture seule.'}
        </div>

        {/* Progression */}
        {totalItems > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">{doneItems} / {totalItems} fait{doneItems > 1 ? 's' : ''}</span>
              <span className={`text-xs font-bold ${pct === 100 ? 'text-green-600' : 'text-blue-600'}`}>{pct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Sections */}
        {sortedSections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">Cette liste est vide pour l'instant.</p>
          </div>
        ) : (
          sortedSections.map(section => {
            const sortedItems = [...section.items].sort((a, b) => a.position - b.position)
            const doneSect = sortedItems.filter(isItemDone).length
            const isCollapsed = collapsedSections.has(section.id)
            return (
              <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">{section.title}</span>
                    <span className="text-xs text-gray-400">{doneSect}/{sortedItems.length}</span>
                  </div>
                  {isCollapsed
                    ? <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    : <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                  }
                </button>
                {!isCollapsed && (
                  <div className="divide-y divide-gray-50">
                    {sortedItems.map(item => {
                      const done = isItemDone(item)
                      const eff = qtyEff(item)
                      const pending = pendingItems.has(`${section.id}:${item.id}`)
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-3 transition ${done ? 'bg-green-50/60' : ''} ${permission === 'check' ? 'cursor-pointer active:bg-gray-50' : ''}`}
                          onClick={() => permission === 'check' && toggleItem(section.id, item.id)}
                        >
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                            done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                          } ${pending ? 'opacity-60' : ''}`}>
                            {done && <CheckIcon className="w-4 h-4" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                              {item.name}
                            </p>
                            {item.note && <p className="text-xs text-gray-400 truncate">📝 {item.note}</p>}
                          </div>
                          {eff > 1 && (
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${done ? 'text-green-600' : 'text-gray-500'}`}>
                              {item.qtyReady}/{eff}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Footer */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center space-y-2">
          <p className="text-xs text-gray-500">Liste partagée via <strong>TC Connect</strong></p>
          <a href="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition">
            ✅ Créer ou accéder à mon compte
          </a>
        </div>
      </div>
    </div>
  )
}
