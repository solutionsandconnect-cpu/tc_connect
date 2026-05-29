'use client'

import { useState, useEffect, useMemo } from 'react'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNotes } from '@/hooks/useNotes'
import { useUsers } from '@/hooks/useUsers'
import Modal from '@/components/ui/Modal'
import { PlusIcon, DocumentTextIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon, XMarkIcon, FunnelIcon } from '@heroicons/react/24/outline'

const NOTE_TYPES_BASE = ['Observation', 'Alerte', 'Bilan', 'Objectif', 'Autre']
const NOTE_TYPES_KEY = 'tc_note_types_custom'

function getNoteTypeStyle(type: string) {
  switch (type) {
    case 'Alerte':      return { card: 'bg-red-50 border-red-200',      badge: 'bg-red-100 text-red-700',      dot: 'text-red-500',    meta: 'text-red-400' }
    case 'Bilan':       return { card: 'bg-sky-50 border-sky-200',      badge: 'bg-sky-100 text-sky-700',      dot: 'text-sky-500',    meta: 'text-sky-400' }
    case 'Objectif':    return { card: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-700',  dot: 'text-green-500',  meta: 'text-green-400' }
    case 'Observation': return { card: 'bg-orange-50 border-orange-200',badge: 'bg-orange-100 text-orange-700',dot: 'text-orange-500', meta: 'text-orange-400' }
    case 'Autre':       return { card: 'bg-gray-50 border-gray-200',    badge: 'bg-gray-100 text-gray-500',    dot: 'text-gray-400',   meta: 'text-gray-400' }
    default:            return { card: 'bg-violet-50 border-violet-200',badge: 'bg-violet-100 text-violet-700',dot: 'text-violet-500', meta: 'text-violet-400' }
  }
}

type FilterStatus = 'all' | 'active' | 'expired'

export default function NotesPage() {
  const { notes, loading, addNote, updateNote, deleteNote } = useNotes()
  const { users } = useUsers()

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [newNoteType, setNewNoteType] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filterClient, setFilterClient] = useState('')
  const [filterClientSearch, setFilterClientSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  // Modal form
  const [form, setForm] = useState({ ref_users: '', notes: '', type_note: 'Observation', date_max_note_active: '' })
  const [searchClientModal, setSearchClientModal] = useState('')

  useEffect(() => {
    try { localStorage.removeItem(NOTE_TYPES_KEY) } catch {}
  }, [])

  const allTypes = NOTE_TYPES_BASE

  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`

  const j7Default = () => {
    const d = new Date(); d.setDate(d.getDate() + 7)
    return toLocalDate(d)
  }

  const openAdd = () => {
    setEditItem(null)
    setSearchClientModal('')
    setForm({ ref_users: '', notes: '', type_note: 'Observation', date_max_note_active: j7Default() })
    setShowModal(true)
  }

  const openEdit = (note: any) => {
    setEditItem(note)
    setSearchClientModal('')
    const dateMax = note.date_max_note_active?.toDate()
    setForm({
      ref_users: note.ref_users?.id || '',
      notes: note.notes || '',
      type_note: note.type_note || 'Observation',
      date_max_note_active: dateMax ? toLocalDate(dateMax) : '',
    })
    setShowModal(true)
  }

  const addCustomType = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    // Use the custom type for this note only — don't persist as a proposal
    setForm((prev) => ({ ...prev, type_note: t }))
    setNewNoteType('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      ref_users: form.ref_users ? doc(db, 'users', form.ref_users) : null,
      notes: form.notes,
      type_note: form.type_note,
      date_max_note_active: form.date_max_note_active
        ? Timestamp.fromDate(new Date(form.date_max_note_active))
        : null,
    }
    if (editItem) {
      await updateNote(editItem.id, payload)
    } else {
      await addNote({ ...payload, date_create: Timestamp.now() })
    }
    setShowModal(false)
  }

  const getUserName = (ref: any) => {
    const id = typeof ref === 'string' ? ref : ref?.id
    const u = users.find((u) => u.id === id)
    return u ? [u.nom, u.prenom].filter(Boolean).join(" ") : '—'
  }

  const isExpired = (note: any) => {
    if (!note.date_max_note_active) return false
    return note.date_max_note_active.toDate() < new Date()
  }

  // Types appearing in existing notes (for filter chips)

  // Clients with at least one note (for client filter)
  const clientsWithNotes = useMemo(() => {
    const ids = new Set<string>()
    notes.forEach((n) => {
      const id = typeof n.ref_users === 'string' ? n.ref_users : (n.ref_users as any)?.id
      if (id) ids.add(id)
    })
    return users.filter((u) => ids.has(u.id))
  }, [notes, users])

  // Types used in existing notes (for filter chips — includes custom types already saved)
  const filterTypeOptions = useMemo(() => {
    const inUse = Array.from(new Set(notes.map((n) => n.type_note).filter(Boolean))) as string[]
    return [...NOTE_TYPES_BASE, ...inUse.filter((t) => !NOTE_TYPES_BASE.includes(t))]
  }, [notes])

  // Filtered notes
  const filtered = useMemo(() => {
    const now = new Date()
    return notes.filter((n) => {
      const expired = isExpired(n)
      if (filterStatus === 'active' && expired) return false
      if (filterStatus === 'expired' && !expired) return false
      if (filterType && n.type_note !== filterType) return false
      if (filterClient) {
        const refId = typeof n.ref_users === 'string' ? n.ref_users : (n.ref_users as any)?.id
        if (refId !== filterClient) return false
      }
      if (filterDateFrom) {
        const created = (n.date_create as any)?.toDate?.()
        if (!created || created < new Date(filterDateFrom)) return false
      }
      if (filterDateTo) {
        const created = (n.date_create as any)?.toDate?.()
        const toEnd = new Date(filterDateTo); toEnd.setHours(23, 59, 59, 999)
        if (!created || created > toEnd) return false
      }
      if (search.trim()) {
        const s = search.toLowerCase()
        const matchNote = n.notes?.toLowerCase().includes(s)
        const refId = typeof n.ref_users === 'string' ? n.ref_users : (n.ref_users as any)?.id
        const u = users.find((u) => u.id === refId)
        const matchClient = u ? [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s) : false
        if (!matchNote && !matchClient) return false
      }
      return true
    })
  }, [notes, filterStatus, filterType, filterClient, filterDateFrom, filterDateTo, search, users])

  // Users filtered by modal search
  const modalUsers = useMemo(() => {
    if (!searchClientModal.trim()) return users
    const s = searchClientModal.toLowerCase()
    return users.filter((u) => [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s))
  }, [users, searchClientModal])

  const filteredClientOptions = useMemo(() => {
    if (!filterClientSearch.trim()) return clientsWithNotes
    const s = filterClientSearch.toLowerCase()
    return clientsWithNotes.filter((u) => [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s))
  }, [clientsWithNotes, filterClientSearch])

  const activeFilterCount = [filterType, filterClient, filterDateFrom, filterDateTo, filterStatus !== 'all' ? '1' : ''].filter(Boolean).length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notes</h1>
          <p className="text-sm text-gray-500">{notes.length} note{notes.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <PlusIcon className="w-4 h-4" />
          Nouvelle note
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-3">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher dans les notes ou par client..."
          className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Statut + types (toujours visibles) + bouton filtres avancés */}
      <div className="flex gap-2 mb-2">
        <div className="flex gap-1 flex-1 bg-white border border-gray-100 rounded-xl p-1">
          {(['all', 'active', 'expired'] as FilterStatus[]).map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {s === 'all' ? 'Toutes' : s === 'active' ? 'Actives' : 'Expirées'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition ${showFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}>
          <FunnelIcon className="w-3.5 h-3.5" />
          Filtres
          {activeFilterCount > 0 && (
            <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${showFilters ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Types — toujours visibles */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        <button onClick={() => setFilterType('')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filterType === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Tous
        </button>
        {filterTypeOptions.map((t) => (
          <button key={t} onClick={() => setFilterType(filterType === t ? '' : t)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Panneau filtres avancés (client + dates) */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-xl p-3 mb-4 space-y-3">

          {/* Client avec recherche */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Client</p>
            {filterClient ? (
              <div className="flex items-center justify-between border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-blue-700">
                  {(() => { const u = clientsWithNotes.find((u) => u.id === filterClient); return u ? [u.nom, u.prenom].filter(Boolean).join(" ") : '—' })()}
                </span>
                <button onClick={() => { setFilterClient(''); setFilterClientSearch('') }} className="text-blue-400 hover:text-blue-700 ml-2">
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-1.5">
                  <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={filterClientSearch} onChange={(e) => setFilterClientSearch(e.target.value)}
                    placeholder="Rechercher un client..."
                    className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                {filteredClientOptions.length > 0 && (
                  <select value="" onChange={(e) => { if (e.target.value) { setFilterClient(e.target.value); setFilterClientSearch('') } }}
                    size={Math.min(filteredClientOptions.length + 1, 4)}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Tous les clients —</option>
                    {filteredClientOptions.map((u) => (
                      <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          {/* Plage de dates */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Date de création</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-1">Du</p>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-400 mb-1">Au</p>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>
          </div>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterType(''); setFilterClient(''); setFilterClientSearch(''); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo('') }}
              className="text-xs text-blue-600 hover:underline">
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <DocumentTextIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{notes.length === 0 ? 'Aucune note' : 'Aucun résultat'}</p>
          {notes.length === 0 && (
            <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
              + Créer une note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => {
            const expired = isExpired(note)
            const s = getNoteTypeStyle(note.type_note)
            return (
              <div key={note.id}
                className={`rounded-2xl border shadow-sm p-4 ${expired ? 'bg-white border-gray-200' : s.card}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expired ? 'bg-gray-100 text-gray-500' : s.badge}`}>
                        {note.type_note}
                      </span>
                      {expired ? (
                        <span className="text-xs text-gray-400">Expirée</span>
                      ) : note.date_max_note_active ? (
                        <span className={`text-xs font-medium ${s.dot}`}>● Active</span>
                      ) : null}
                      <span className="text-xs text-gray-400">
                        {note.ref_users ? getUserName(note.ref_users) : 'Général'}
                      </span>
                    </div>
                    <p className={`text-sm whitespace-pre-wrap ${expired ? 'text-gray-500' : 'text-gray-800'}`}>
                      {note.notes}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
                      {note.date_create && (
                        <span>Créée le {(note.date_create as any).toDate().toLocaleDateString('fr-FR')}</span>
                      )}
                      {note.date_max_note_active && (
                        <span className={expired ? 'text-gray-400' : s.meta}>
                          · {expired ? 'Expirée le' : "Active jusqu'au"}{' '}
                          {(note.date_max_note_active as any).toDate().toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(note)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition border border-transparent hover:border-blue-100">
                      <PencilIcon className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setShowDeleteConfirm(note.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition border border-transparent hover:border-red-100">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal ajout / modification */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Modifier la note' : 'Nouvelle note'}>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Client avec recherche */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client (optionnel)</label>
            <div className="relative mb-1.5">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchClientModal} onChange={(e) => setSearchClientModal(e.target.value)}
                placeholder="Rechercher un client..."
                className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={form.ref_users} onChange={(e) => setForm({ ...form, ref_users: e.target.value })}
              size={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Note générale —</option>
              {modalUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
              ))}
            </select>
            {form.ref_users && (
              <p className="text-xs text-blue-600 mt-1">
                Sélectionné : {getUserName({ id: form.ref_users })}
                <button type="button" onClick={() => setForm({ ...form, ref_users: '' })} className="ml-2 text-gray-400 hover:text-red-500">
                  ✕
                </button>
              </p>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type_note} onChange={(e) => setForm({ ...form, type_note: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {allTypes
                .concat(form.type_note && !allTypes.includes(form.type_note) ? [form.type_note] : [])
                .map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2 mt-2">
              <input type="text" value={newNoteType} onChange={(e) => setNewNoteType(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomType(newNoteType) } }}
                placeholder="Nouveau type..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => addCustomType(newNoteType)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              required rows={4} placeholder="Contenu de la note..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date d'expiration (optionnel)</label>
            <input type="date" value={form.date_max_note_active}
              onChange={(e) => setForm({ ...form, date_max_note_active: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              {editItem ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Supprimer cette note ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => showDeleteConfirm && deleteNote(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}
