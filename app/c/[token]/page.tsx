'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

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

type Permission = 'view' | 'check' | 'edit'

function qtyEff(item: Item): number { return item.qtyNeeded }
function isItemDone(item: Item): boolean { return item.qtyReady >= qtyEff(item) }

const IDENTITY_KEY = (token: string) => `cc_identity_${token}`

export default function PublicChecklistPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()
  const { currentUser, userProfile, loading: authLoading } = useAuth()

  const [trip, setTrip] = useState<TripData | null>(null)
  const [permission, setPermission] = useState<Permission>('view')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingItems, setPendingItems] = useState<Set<string>>(new Set())
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Utilisateur connecté → on lui propose de rejoindre la liste dans l'app
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')

  // Édition (permission 'edit')
  const [newItemDrafts, setNewItemDrafts] = useState<Record<string, string>>({})
  const [newSectionDraft, setNewSectionDraft] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null) // `section:<id>` ou `item:<sid>:<iid>`
  const [nameDraft, setNameDraft] = useState('')

  const canCheck = permission === 'check' || permission === 'edit'
  const canEdit = permission === 'edit'

  // Identité (Tricount-style)
  const [identityStep, setIdentityStep] = useState(false)
  const [identityName, setIdentityName] = useState('')
  const [identityDraft, setIdentityDraft] = useState('')
  const [preSuggestedName, setPreSuggestedName] = useState('')
  const [editingIdentity, setEditingIdentity] = useState(false)

  useEffect(() => {
    // On attend la résolution de l'auth pour savoir si l'utilisateur est connecté
    if (authLoading) return
    fetch(`/api/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setTrip(data.trip)
        setPermission(data.permission)

        // Connecté → on ne montre PAS la vue anonyme : écran « rejoindre dans l'app »
        if (currentUser) return

        // Anonyme : identité (Tricount-style)
        const saved = localStorage.getItem(IDENTITY_KEY(token))
        if (saved) {
          setIdentityName(saved)
        } else {
          const suggested = [data.prenom, data.nom].filter(Boolean).join(' ').trim()
          setPreSuggestedName(suggested)
          setIdentityDraft(suggested)
          setIdentityStep(true)  // demander confirmation
        }
      })
      .catch(() => setError('Impossible de charger la liste.'))
      .finally(() => setLoading(false))
  }, [token, currentUser, authLoading])

  const handleJoin = async () => {
    if (!currentUser) return
    setJoining(true)
    setJoinError('')
    try {
      const idToken = await currentUser.getIdToken()
      const res = await fetch(`/api/invite/${token}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      router.replace('/trips')
    } catch (e: any) {
      setJoinError(e?.message || "Impossible de rejoindre la liste.")
      setJoining(false)
    }
  }

  const confirmIdentity = () => {
    const name = identityDraft.trim() || preSuggestedName || 'Anonyme'
    setIdentityName(name)
    localStorage.setItem(IDENTITY_KEY(token), name)
    setIdentityStep(false)
    setEditingIdentity(false)
  }

  // Applique une opération d'édition via l'API et rafraîchit l'état local
  const mutate = useCallback(async (op: Record<string, unknown>) => {
    try {
      const r = await fetch(`/api/invite/${token}/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op),
      })
      const data = await r.json()
      if (data.sections) {
        setTrip(prev => prev ? { ...prev, sections: data.sections } : prev)
      }
    } catch { /* silencieux */ }
  }, [token])

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

  // ── Utilisateur connecté → rejoindre la liste dans l'app ─────────────────────
  if (currentUser) {
    const myName = userProfile ? `${userProfile.prenom ?? ''} ${userProfile.nom ?? ''}`.trim() : ''
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5 text-center">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl mx-auto"
            style={{ backgroundColor: trip.color + '20' }}>
            {trip.icon}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{trip.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Vous avez été invité(e) à rejoindre cette liste{myName ? ` en tant que ${myName}` : ''}.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700">
            La liste sera ajoutée à votre application <strong>CheckConnect</strong>.
          </div>

          {joinError && <p className="text-xs text-red-600">{joinError}</p>}

          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm transition"
          >
            {joining ? 'Ajout en cours…' : 'Rejoindre la liste'}
          </button>
          <button
            onClick={() => router.replace('/trips')}
            className="w-full text-xs text-gray-400 hover:text-gray-600 py-1"
          >
            Aller à mes listes
          </button>
        </div>
      </div>
    )
  }

  // ── Étape identité (anonyme) ─────────────────────────────────────────────────
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
          permission === 'edit' ? 'bg-blue-50 text-blue-700 border border-blue-200'
            : permission === 'check' ? 'bg-green-50 text-green-700 border border-green-200'
            : 'bg-gray-50 text-gray-500 border border-gray-200'
        }`}>
          <span>{permission === 'edit' ? '✏️' : permission === 'check' ? '✅' : '👁️'}</span>
          {permission === 'edit' ? 'Vous pouvez cocher et modifier cette liste.'
            : permission === 'check' ? 'Vous pouvez cocher les éléments de cette liste.'
            : 'Accès en lecture seule.'}
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
        {sortedSections.length === 0 && !canEdit ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">Cette liste est vide pour l'instant.</p>
          </div>
        ) : (
          sortedSections.map(section => {
            const sortedItems = [...section.items].sort((a, b) => a.position - b.position)
            const doneSect = sortedItems.filter(isItemDone).length
            const isCollapsed = collapsedSections.has(section.id)
            const editingSection = editingName === `section:${section.id}`
            return (
              <div key={section.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* En-tête section */}
                <div className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition">
                  {editingSection ? (
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      onBlur={() => { if (nameDraft.trim()) mutate({ op: 'renameSection', sectionId: section.id, title: nameDraft.trim() }); setEditingName(null) }}
                      onKeyDown={e => { if (e.key === 'Enter') { if (nameDraft.trim()) mutate({ op: 'renameSection', sectionId: section.id, title: nameDraft.trim() }); setEditingName(null) } if (e.key === 'Escape') setEditingName(null) }}
                      className="flex-1 text-sm font-bold border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  ) : (
                    <button onClick={() => toggleSection(section.id)} className="flex-1 flex items-center gap-2 text-left">
                      <span className="text-sm font-bold text-gray-800">{section.title}</span>
                      <span className="text-xs text-gray-400">{doneSect}/{sortedItems.length}</span>
                    </button>
                  )}
                  {canEdit && !editingSection && (
                    <>
                      <button onClick={() => { setNameDraft(section.title); setEditingName(`section:${section.id}`) }}
                        title="Renommer" className="p-1 text-gray-300 hover:text-blue-500 transition shrink-0">
                        <PencilIcon className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => { if (confirm(`Supprimer la section « ${section.title} » ?`)) mutate({ op: 'deleteSection', sectionId: section.id }) }}
                        title="Supprimer" className="p-1 text-gray-300 hover:text-red-500 transition shrink-0">
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <button onClick={() => toggleSection(section.id)} className="shrink-0 text-gray-400">
                    {isCollapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="divide-y divide-gray-50">
                    {sortedItems.map(item => {
                      const done = isItemDone(item)
                      const eff = qtyEff(item)
                      const pending = pendingItems.has(`${section.id}:${item.id}`)
                      const editingItem = editingName === `item:${section.id}:${item.id}`
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-4 py-3 transition ${done ? 'bg-green-50/60' : ''} ${canCheck && !editingItem ? 'cursor-pointer active:bg-gray-50' : ''}`}
                          onClick={() => canCheck && !editingItem && toggleItem(section.id, item.id)}
                        >
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
                            done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
                          } ${pending ? 'opacity-60' : ''}`}>
                            {done && <CheckIcon className="w-4 h-4" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingItem ? (
                              <input
                                autoFocus
                                value={nameDraft}
                                onClick={e => e.stopPropagation()}
                                onChange={e => setNameDraft(e.target.value)}
                                onBlur={() => { if (nameDraft.trim()) mutate({ op: 'renameItem', sectionId: section.id, itemId: item.id, name: nameDraft.trim() }); setEditingName(null) }}
                                onKeyDown={e => { if (e.key === 'Enter') { if (nameDraft.trim()) mutate({ op: 'renameItem', sectionId: section.id, itemId: item.id, name: nameDraft.trim() }); setEditingName(null) } if (e.key === 'Escape') setEditingName(null) }}
                                className="w-full text-sm border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            ) : (
                              <p className={`text-sm font-medium truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {item.name}
                              </p>
                            )}
                            {item.note && !editingItem && <p className="text-xs text-gray-400 truncate">📝 {item.note}</p>}
                          </div>
                          {eff > 1 && (
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${done ? 'text-green-600' : 'text-gray-500'}`}>
                              {item.qtyReady}/{eff}
                            </span>
                          )}
                          {canEdit && !editingItem && (
                            <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                              <button onClick={() => { setNameDraft(item.name); setEditingName(`item:${section.id}:${item.id}`) }}
                                title="Renommer" className="p-1 text-gray-300 hover:text-blue-500 transition">
                                <PencilIcon className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => mutate({ op: 'deleteItem', sectionId: section.id, itemId: item.id })}
                                title="Supprimer" className="p-1 text-gray-300 hover:text-red-500 transition">
                                <TrashIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Ajout d'item (edit) */}
                    {canEdit && (
                      <div className="flex items-center gap-2 px-4 py-2.5">
                        <input
                          type="text"
                          value={newItemDrafts[section.id] ?? ''}
                          onChange={e => setNewItemDrafts(d => ({ ...d, [section.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = (newItemDrafts[section.id] ?? '').trim()
                              if (v) { mutate({ op: 'addItem', sectionId: section.id, name: v }); setNewItemDrafts(d => ({ ...d, [section.id]: '' })) }
                            }
                          }}
                          placeholder="Ajouter un élément…"
                          className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                          onClick={() => {
                            const v = (newItemDrafts[section.id] ?? '').trim()
                            if (v) { mutate({ op: 'addItem', sectionId: section.id, name: v }); setNewItemDrafts(d => ({ ...d, [section.id]: '' })) }
                          }}
                          disabled={!(newItemDrafts[section.id] ?? '').trim()}
                          className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0">
                          <PlusIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Ajout de section (edit) */}
        {canEdit && (
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-3">
            <input
              type="text"
              value={newSectionDraft}
              onChange={e => setNewSectionDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSectionDraft.trim()) { mutate({ op: 'addSection', title: newSectionDraft.trim() }); setNewSectionDraft('') } }}
              placeholder="Nouvelle section…"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={() => { if (newSectionDraft.trim()) { mutate({ op: 'addSection', title: newSectionDraft.trim() }); setNewSectionDraft('') } }}
              disabled={!newSectionDraft.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition shrink-0">
              <PlusIcon className="w-4 h-4" /> Section
            </button>
          </div>
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
