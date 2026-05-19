'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useSeances } from '@/hooks/useSeances'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import {
  PlusIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline'

const TYPES_SEANCE = [
  'Musculation', 'Cardio', 'Circuit training', 'HIIT',
  'Stretching', 'Technique', 'Mixte', 'Autre'
]

const PARTIES_SEANCE = [
  'Échauffement', 'Corps de séance', 'Retour au calme', 'Séance complète'
]

export default function SeancesPage() {
  const { currentUser } = useAuth()
  const { seances, loading, addSeance, updateSeance, deleteSeance } = useSeances()
  const router = useRouter()

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    type_seance: 'Musculation',
    partie_seance: 'Corps de séance',
    observations_seance: '',
    nb_tours: 1,
    recup_tours: 60,
  })

  const openAdd = () => {
    setEditItem(null)
    setForm({
      type_seance: 'Musculation',
      partie_seance: 'Corps de séance',
      observations_seance: '',
      nb_tours: 1,
      recup_tours: 60,
    })
    setShowModal(true)
  }

  const openEdit = (seance: any) => {
    setEditItem(seance)
    setForm({
      type_seance: seance.type_seance || 'Musculation',
      partie_seance: seance.partie_seance || 'Corps de séance',
      observations_seance: seance.observations_seance || '',
      nb_tours: seance.nb_tours || 1,
      recup_tours: seance.recup_tours || 60,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const payload = {
      ...form,
      nb_tours: Number(form.nb_tours),
      recup_tours: Number(form.recup_tours),
      ref_users: doc(db, 'users', currentUser.uid),
      ref_planning: null,
      num_circuit: 1,
      avancement_circuit: 0,
    }
    if (editItem) {
      await updateSeance(editItem.id, form)
    } else {
      await addSeance(payload as any)
    }
    setShowModal(false)
  }

  const filtered = seances.filter((s) =>
    s.type_seance?.toLowerCase().includes(search.toLowerCase()) ||
    s.partie_seance?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Séances</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Nouvelle séance
        </button>
      </div>

      {/* Recherche */}
      <input
        type="text"
        placeholder="Rechercher une séance..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ClipboardDocumentListIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune séance trouvée</p>
          <button
            onClick={openAdd}
            className="mt-3 text-blue-600 text-sm font-medium hover:underline"
          >
            + Créer une séance
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((seance) => (
            <div
              key={seance.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push(`/seances/${seance.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(seance)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(seance.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800">{seance.type_seance}</h3>
              <p className="text-sm text-gray-500 mb-2">{seance.partie_seance}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>{seance.nb_tours} tour(s)</span>
                <span>·</span>
                <span>Récup {seance.recup_tours}s</span>
              </div>
              {seance.observations_seance && (
                <p className="text-xs text-gray-400 mt-2 italic truncate">
                  {seance.observations_seance}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Modifier la séance' : 'Nouvelle séance'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de séance</label>
            <select
              value={form.type_seance}
              onChange={(e) => setForm({ ...form, type_seance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES_SEANCE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partie de séance</label>
            <select
              value={form.partie_seance}
              onChange={(e) => setForm({ ...form, partie_seance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PARTIES_SEANCE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nb tours</label>
              <input
                type="number"
                min={1}
                value={form.nb_tours}
                onChange={(e) => setForm({ ...form, nb_tours: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Récup (sec)</label>
              <input
                type="number"
                min={0}
                value={form.recup_tours}
                onChange={(e) => setForm({ ...form, recup_tours: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea
              value={form.observations_seance}
              onChange={(e) => setForm({ ...form, observations_seance: e.target.value })}
              rows={3}
              placeholder="Notes, consignes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
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
        title="Supprimer cette séance ?"
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
            onClick={() => showDeleteConfirm && deleteSeance(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}