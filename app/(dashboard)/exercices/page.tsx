'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useExercices } from '@/hooks/useExercices'
import Modal from '@/components/ui/Modal'
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const PARTIES = [
  'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets',
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps',
  'Abdominaux', 'Cardio', 'Full body', 'Autre'
]

export default function ExercicesPage() {
  const { exercices, loading, addExercice, updateExercice, deleteExercice } = useExercices()
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [filterPartie, setFilterPartie] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [form, setForm] = useState({
    nom_exercice: '',
    partie_prioritaire: 'Full body',
    explications_commentees_exercice: '',
    lien_exercice: '',
    Materiel: [] as string[],
    Muscles: [] as string[],
    image_exercice: '',
    video_exercice: '',
  })

  const openAdd = () => {
    setEditItem(null)
    setForm({
      nom_exercice: '',
      partie_prioritaire: 'Full body',
      explications_commentees_exercice: '',
      lien_exercice: '',
      Materiel: [],
      Muscles: [],
      image_exercice: '',
      video_exercice: '',
    })
    setShowModal(true)
  }

  const openEdit = (ex: any) => {
    setEditItem(ex)
    setForm({
      nom_exercice: ex.nom_exercice || '',
      partie_prioritaire: ex.partie_prioritaire || 'Full body',
      explications_commentees_exercice: ex.explications_commentees_exercice || '',
      lien_exercice: ex.lien_exercice || '',
      Materiel: ex.Materiel || [],
      Muscles: ex.Muscles || [],
      image_exercice: ex.image_exercice || '',
      video_exercice: ex.video_exercice || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (editItem) {
      await updateExercice(editItem.id, form)
    } else {
      await addExercice(form as any)
    }
    setShowModal(false)
  }

  const filtered = exercices.filter((ex) => {
    const matchSearch = ex.nom_exercice?.toLowerCase().includes(search.toLowerCase())
    const matchPartie = filterPartie ? ex.partie_prioritaire === filterPartie : true
    return matchSearch && matchPartie
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Exercices</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Nouvel exercice
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={filterPartie}
          onChange={(e) => setFilterPartie(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes les parties</option>
          {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">Aucun exercice trouvé</p>
          <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            + Créer un exercice
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ex) => (
            <div
              key={ex.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push(`/exercices/${ex.id}`)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 text-sm">{ex.nom_exercice}</h3>
                  <p className="text-xs text-gray-500">{ex.partie_prioritaire}</p>
                </div>
                <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(ex)} className="text-xs text-blue-600 hover:underline">
                    Modifier
                  </button>
                  <button onClick={() => setShowDeleteConfirm(ex.id)} className="text-xs text-red-500 hover:underline">
                    Supprimer
                  </button>
                </div>
              </div>
              {ex.Muscles && ex.Muscles.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {ex.Muscles.slice(0, 3).map((m) => (
                    <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? "Modifier l'exercice" : 'Nouvel exercice'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={form.nom_exercice}
              onChange={(e) => setForm({ ...form, nom_exercice: e.target.value })}
              required
              placeholder="Ex: Squat"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partie prioritaire</label>
            <select
              value={form.partie_prioritaire}
              onChange={(e) => setForm({ ...form, partie_prioritaire: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explications</label>
            <textarea
              value={form.explications_commentees_exercice}
              onChange={(e) => setForm({ ...form, explications_commentees_exercice: e.target.value })}
              rows={3}
              placeholder="Description technique, consignes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien vidéo / externe</label>
            <input
              type="url"
              value={form.lien_exercice}
              onChange={(e) => setForm({ ...form, lien_exercice: e.target.value })}
              placeholder="https://..."
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
        title="Supprimer cet exercice ?"
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
            onClick={() => showDeleteConfirm && deleteExercice(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}