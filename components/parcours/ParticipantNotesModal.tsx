'use client'

import { useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import Modal from '@/components/ui/Modal'
import { PlusIcon, PencilIcon, TrashIcon, BanknotesIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import type { ParcoursNote } from '@/types'
import { PAYMENT_NOTE_TYPE, PARCOURS_NOTE_TYPES, getParcoursNoteStyle, isNoteExpired, noteRemaining } from '@/lib/parcoursNotes'

const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Expiration par défaut d'une avance : +2 mois (pour qu'elle serve aux séances à suivre, pas indéfiniment)
const defaultAdvanceExpiry = () => { const d = new Date(); d.setMonth(d.getMonth() + 2); return toLocalDate(d) }

interface Props {
  isOpen: boolean
  onClose: () => void
  participantKey: string
  participantName: string
  notes: ParcoursNote[]
  addNote: (data: Omit<ParcoursNote, 'id'>) => Promise<unknown>
  updateNote: (id: string, data: Partial<ParcoursNote>) => Promise<unknown>
  deleteNote: (id: string) => Promise<unknown>
}

export default function ParticipantNotesModal({
  isOpen, onClose, participantKey, participantName, notes, addNote, updateNote, deleteNote,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editNote, setEditNote] = useState<ParcoursNote | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<{ type_note: string; notes: string; montant: string; montantMethode: 'cash' | 'transfer'; date_max_note_active: string }>({ type_note: PAYMENT_NOTE_TYPE, notes: '', montant: '', montantMethode: 'cash', date_max_note_active: '' })
  const [saving, setSaving] = useState(false)

  const list = notes.filter((n) => n.participantKey === participantKey)

  const openAdd = () => {
    setEditNote(null)
    setForm({ type_note: PAYMENT_NOTE_TYPE, notes: '', montant: '', montantMethode: 'cash', date_max_note_active: defaultAdvanceExpiry() })
    setShowForm(true)
  }

  const openEdit = (n: ParcoursNote) => {
    setEditNote(n)
    const dmax = n.date_max_note_active?.toDate()
    setForm({
      type_note: n.type_note || PAYMENT_NOTE_TYPE,
      notes: n.notes || '',
      montant: n.montant != null ? String(n.montant) : '',
      montantMethode: n.montantMethode === 'transfer' ? 'transfer' : 'cash',
      date_max_note_active: dmax ? toLocalDate(dmax) : '',
    })
    setShowForm(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const raw = form.montant.trim().replace(',', '.')
      const montantNum = raw ? Number(raw) : null
      const payload = {
        participantKey,
        participantName,
        type_note: form.type_note,
        notes: form.notes.trim(),
        montant: montantNum != null && Number.isFinite(montantNum) ? montantNum : null,
        montantMethode: form.type_note === PAYMENT_NOTE_TYPE ? form.montantMethode : null,
        date_max_note_active: form.date_max_note_active ? Timestamp.fromDate(new Date(form.date_max_note_active)) : null,
      }
      if (editNote) await updateNote(editNote.id, payload)
      else await addNote({ ...payload, date_create: Timestamp.now() })
      setShowForm(false); setEditNote(null)
    } catch (err) { console.error('[ParticipantNotesModal submit]', err) }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await deleteNote(deleteId) } catch (err) { console.error('[ParticipantNotesModal delete]', err) }
    setDeleteId(null)
  }

  const handleClose = () => { setShowForm(false); setEditNote(null); setDeleteId(null); onClose() }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Notes — ${participantName}`}>
      <div className="space-y-3">
        {!showForm && (
          <button onClick={openAdd}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition">
            <PlusIcon className="w-4 h-4" /> Ajouter une note
          </button>
        )}

        {showForm && (
          <form onSubmit={submit} className="space-y-3 border border-gray-200 rounded-xl p-3 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{editNote ? 'Modifier la note' : 'Nouvelle note'}</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type_note} onChange={(e) => setForm((f) => ({ ...f, type_note: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                {PARCOURS_NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant <span className="text-gray-400 font-normal">(€, optionnel)</span></label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={form.montant}
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                placeholder="ex : 50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              {form.type_note === PAYMENT_NOTE_TYPE && (
                <p className="text-[11px] text-emerald-600 mt-1">Comptabilisé dans les avances en cours tant que la note est active.</p>
              )}
            </div>

            {form.type_note === PAYMENT_NOTE_TYPE && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Moyen de paiement</label>
                <div className="flex gap-2">
                  {([['cash', 'Espèces'], ['transfer', 'Virement']] as const).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setForm((f) => ({ ...f, montantMethode: val }))}
                      className={`flex-1 text-sm font-medium px-3 py-2 rounded-lg border transition ${form.montantMethode === val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
              <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3} placeholder="ex : a payé 50€ en espèces pour le prochain parcours"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date d'expiration <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input type="date" value={form.date_max_note_active}
                onChange={(e) => setForm((f) => ({ ...f, date_max_note_active: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setShowForm(false); setEditNote(null) }} disabled={saving}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-white transition">Annuler</button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
                {saving ? 'Enregistrement…' : editNote ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </form>
        )}

        {list.length === 0 && !showForm ? (
          <div className="text-center py-8 text-gray-400">
            <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-xs">Aucune note pour ce participant</p>
          </div>
        ) : (
          list.map((n) => {
            const expired = isNoteExpired(n)
            const st = getParcoursNoteStyle(n.type_note)
            const consumed = n.montantConsomme ?? 0
            const remaining = noteRemaining(n)
            return (
              <div key={n.id} className={`rounded-xl border p-3 ${expired ? 'bg-white border-gray-200' : st.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${expired ? 'bg-gray-100 text-gray-500' : st.badge}`}>{n.type_note}</span>
                    {n.montant != null && (
                      consumed > 0 ? (
                        remaining > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <BanknotesIcon className="w-3 h-3" /> {remaining}€ restants <span className="font-normal text-emerald-500">/ {n.montant}€</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            <BanknotesIcon className="w-3 h-3" /> Soldée ({n.montant}€)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          <BanknotesIcon className="w-3 h-3" /> {n.montant}€
                        </span>
                      )
                    )}
                    {n.montantMethode && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/70 border border-emerald-200 text-emerald-600">
                        {n.montantMethode === 'transfer' ? 'Virement' : 'Espèces'}
                      </span>
                    )}
                    {expired && <span className="text-[10px] text-gray-400">Expirée</span>}
                  </div>
                  {deleteId === n.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setDeleteId(null)} className="text-[11px] border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50">Non</button>
                      <button onClick={confirmDelete} className="text-[11px] text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md">Supprimer</button>
                    </div>
                  ) : (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(n)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setDeleteId(n.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>
                {n.notes && <p className={`text-xs mt-1.5 whitespace-pre-wrap ${expired ? 'text-gray-500' : 'text-gray-800'}`}>{n.notes}</p>}
                {n.applications && n.applications.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {n.applications.map((a, i) => (
                      <p key={i} className="text-[10px] text-emerald-700 flex items-center gap-1">
                        <BanknotesIcon className="w-3 h-3 shrink-0" />
                        {a.amount}€ appliqués{a.sessionDate ? ` — séance du ${a.sessionDate.toDate().toLocaleDateString('fr-FR')}` : ''}
                      </p>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 flex-wrap">
                  {n.date_create && <span>Créée le {n.date_create.toDate().toLocaleDateString('fr-FR')}</span>}
                  {n.date_max_note_active && (
                    <span>· {expired ? 'Expirée le' : "Active jusqu'au"} {n.date_max_note_active.toDate().toLocaleDateString('fr-FR')}</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </Modal>
  )
}
