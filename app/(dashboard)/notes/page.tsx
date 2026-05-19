'use client'

import { useState } from 'react'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useNotes } from '@/hooks/useNotes'
import { useUsers } from '@/hooks/useUsers'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { PlusIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

const TYPES_NOTE = ['Observation', 'Alerte', 'Bilan', 'Objectif', 'Autre']

export default function NotesPage() {
  const { notes, loading, addNote, updateNote, deleteNote } = useNotes()
  const { users } = useUsers()

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('')

  const [form, setForm] = useState({
    ref_users: '',
    notes: '',
    type_note: 'Observation',
    date_max_note_active: '',
  })

  const openAdd = () => {
    setEditItem(null)
    setForm({ ref_users: '', notes: '', type_note: 'Observation', date_max_note_active: '' })
    setShowModal(true)
  }

  const openEdit = (note: any) => {
    setEditItem(note)
    const dateMax = note.date_max_note_active?.toDate()
    setForm({
      ref_users: note.ref_users?.id || '',
      notes: note.notes || '',
      type_note: note.type_note || 'Observation',
      date_max_note_active: dateMax ? dateMax.toISOString().split('T')[0] : '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      ref_users: form.ref_users ? doc(db, 'users', form.ref_users) : null,
      notes: form.notes,
      type_note: form.type_note,
      date_create: Timestamp.now(),
      date_max_note_active: form.date_max_note_active
        ? Timestamp.fromDate(new Date(form.date_max_note_active))
        : null,
    }
    if (editItem) {
      await updateNote(editItem.id, payload)
    } else {
      await addNote(payload)
    }
    setShowModal(false)
  }

  const getUserName = (ref: any) => {
    const id = typeof ref === 'string' ? ref : ref?.id
    const u = users.find((u) => u.id === id)
    return u ? `${u.prenom} ${u.nom}` : '—'
  }

  const getNoteVariant = (type: string) => {
    const map: Record<string, any> = {
      Alerte: 'danger',
      Bilan: 'info',
      Objectif: 'success',
      Observation: 'gray',
      Autre: 'gray',
    }
    return map[type] || 'gray'
  }

  const filtered = notes.filter((n) =>
    filterType ? n.type_note === filterType : true
  )

  const isExpired = (note: any) => {
    if (!note.date_max_note_active) return false
    return note.date_max_note_active.toDate() < new Date()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notes</h1>
          <p className="text-sm text-gray-500">Historique des observations clients</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Nouvelle note
        </button>
      </div>

      {/* Filtre type */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
            filterType === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Toutes
        </button>
        {TYPES_NOTE.map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filterType === t ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <DocumentTextIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune note</p>
          <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            + Créer une note
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className={`bg-white rounded-2xl border shadow-sm p-4 ${
                isExpired(note) ? 'border-red-100 opacity-60' : 'border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge label={note.type_note} variant={getNoteVariant(note.type_note)} />
                    {isExpired(note) && (
                      <Badge label="Expirée" variant="danger" />
                    )}
                    <span className="text-xs text-gray-400">
                      {note.ref_users ? getUserName(note.ref_users) : 'Général'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.notes}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>
                      Créée le{' '}
                      {note.date_create
                        ? (note.date_create as any).toDate().toLocaleDateString('fr-FR')
                        : '—'}
                    </span>
                    {note.date_max_note_active && (
                      <span>
                        · Active jusqu'au{' '}
                        {(note.date_max_note_active as any).toDate().toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openEdit(note)} className="text-xs text-blue-600 hover:underline">
                    Modifier
                  </button>
                  <button onClick={() => setShowDeleteConfirm(note.id)} className="text-xs text-red-500 hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Modifier la note' : 'Nouvelle note'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client (optionnel)</label>
            <select
              value={form.ref_users}
              onChange={(e) => setForm({ ...form, ref_users: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Note générale —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type_note}
              onChange={(e) => setForm({ ...form, type_note: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES_NOTE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              required
              rows={4}
              placeholder="Contenu de la note..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date d'expiration (optionnel)
            </label>
            <input
              type="date"
              value={form.date_max_note_active}
              onChange={(e) => setForm({ ...form, date_max_note_active: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {editItem ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Supprimer cette note ?"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => showDeleteConfirm && deleteNote(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}