'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useSeances } from '@/hooks/useSeances'
import { useExercices } from '@/hooks/useExercices'
import { useProgrammeSeance } from '@/hooks/useProgrammeSeance'
import Modal from '@/components/ui/Modal'
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const TYPES_EFFORT = ['Répétitions', 'Durée (sec)', 'Distance (m)']

export default function DetailSeancePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { seances } = useSeances()
  const { exercices } = useExercices()
  const { programme, loading, addExerciceToSeance, updateExerciceSeance, removeExerciceFromSeance } =
    useProgrammeSeance(id)

  const seance = seances.find((s) => s.id === id)

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const [form, setForm] = useState({
    exercice_id: '',
    type_effort: 'Répétitions',
    effort: 10,
    recup_effort: 60,
    tempo_phase1: 2,
    tempo_phase2: 0,
    tempo_phase3: 2,
    explication_exercice: '',
  })

  const openAdd = () => {
    setEditItem(null)
    setForm({
      exercice_id: exercices[0]?.id || '',
      type_effort: 'Répétitions',
      effort: 10,
      recup_effort: 60,
      tempo_phase1: 2,
      tempo_phase2: 0,
      tempo_phase3: 2,
      explication_exercice: '',
    })
    setShowModal(true)
  }

  const openEdit = (item: any) => {
    setEditItem(item)
    setForm({
      exercice_id: item.exercice?.id || '',
      type_effort: item.type_effort || 'Répétitions',
      effort: item.effort || 10,
      recup_effort: item.recup_effort || 60,
      tempo_phase1: item.tempo_phase1 || 2,
      tempo_phase2: item.tempo_phase2 || 0,
      tempo_phase3: item.tempo_phase3 || 2,
      explication_exercice: item.explication_exercice || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ref_seance: doc(db, 'seance', id),
      exercice: doc(db, 'exercices', form.exercice_id),
      type_effort: form.type_effort,
      effort: Number(form.effort),
      recup_effort: Number(form.recup_effort),
      tempo_phase1: Number(form.tempo_phase1),
      tempo_phase2: Number(form.tempo_phase2),
      tempo_phase3: Number(form.tempo_phase3),
      explication_exercice: form.explication_exercice,
    }
    if (editItem) {
      await updateExerciceSeance(editItem.id, payload)
    } else {
      await addExerciceToSeance(payload as any)
    }
    setShowModal(false)
  }

  const getExerciceName = (exerciceRef: any) => {
    const exId = typeof exerciceRef === 'string' ? exerciceRef : exerciceRef?.id
    return exercices.find((e) => e.id === exId)?.nom_exercice || '—'
  }

  const filteredExercices = exercices.filter((e) =>
    e.nom_exercice?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/seances')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">
            {seance?.type_seance || '...'}
          </h1>
          <p className="text-sm text-gray-500">
            {seance?.partie_seance} · {seance?.nb_tours} tour(s) · Récup {seance?.recup_tours}s
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Exercice
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : programme.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">Aucun exercice dans cette séance</p>
          <button
            onClick={openAdd}
            className="mt-3 text-blue-600 text-sm font-medium hover:underline"
          >
            + Ajouter un exercice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {programme.map((item, index) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">
                      {getExerciceName(item.exercice)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.type_effort} : {item.effort} · Récup {item.recup_effort}s
                    </p>
                    <p className="text-xs text-gray-400">
                      Tempo : {item.tempo_phase1}/{item.tempo_phase2}/{item.tempo_phase3}
                    </p>
                    {item.explication_exercice && (
                      <p className="text-xs text-gray-400 italic mt-1">
                        {item.explication_exercice}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(item)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => removeExerciceFromSeance(item.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal ajout exercice */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? "Modifier l'exercice" : 'Ajouter un exercice'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recherche exercice */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Exercice</label>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg">
              {filteredExercices.length === 0 ? (
                <p className="text-xs text-gray-400 p-3">Aucun exercice trouvé</p>
              ) : (
                filteredExercices.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setForm({ ...form, exercice_id: ex.id })}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition ${
                      form.exercice_id === ex.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'
                    }`}
                  >
                    {ex.nom_exercice}
                    {ex.partie_prioritaire && (
                      <span className="text-xs text-gray-400 ml-2">· {ex.partie_prioritaire}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'effort</label>
            <select
              value={form.type_effort}
              onChange={(e) => setForm({ ...form, type_effort: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES_EFFORT.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effort</label>
              <input
                type="number"
                min={0}
                value={form.effort}
                onChange={(e) => setForm({ ...form, effort: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Récup (sec)</label>
              <input
                type="number"
                min={0}
                value={form.recup_effort}
                onChange={(e) => setForm({ ...form, recup_effort: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tempo (Phase 1 / Phase 2 / Phase 3)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['tempo_phase1', 'tempo_phase2', 'tempo_phase3'].map((key, i) => (
                <input
                  key={key}
                  type="number"
                  min={0}
                  value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  placeholder={`Phase ${i + 1}`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explication</label>
            <textarea
              value={form.explication_exercice}
              onChange={(e) => setForm({ ...form, explication_exercice: e.target.value })}
              rows={2}
              placeholder="Consignes spécifiques..."
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
              {editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}