'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useExercices } from '@/hooks/useExercices'
import { uploadImage } from '@/lib/uploadImage'
import Modal from '@/components/ui/Modal'
import {
  ArrowLeftIcon, PencilIcon, TrashIcon,
  PhotoIcon, LinkIcon, PlayIcon,
} from '@heroicons/react/24/outline'

const PARTIES = [
  'Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets',
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps',
  'Abdominaux', 'Cardio', 'Full body', 'Autre'
]

function MissingBadge() {
  return (
    <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
      ✗ Non rempli
    </span>
  )
}

export default function DetailExercicePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { updateExercice, deleteExercice } = useExercices()

  const [exercice, setExercice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Fetch direct par ID — rapide, pas besoin de charger toute la collection
  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'exercices', id)).then((snap) => {
      if (snap.exists()) setExercice({ id: snap.id, ...snap.data() })
    }).catch(console.error).finally(() => setLoading(false))
  }, [id])

  const openEdit = () => {
    setForm({
      nom_exercice: exercice.nom_exercice || '',
      partie_prioritaire: exercice.partie_prioritaire || 'Full body',
      explications_commentees_exercice: exercice.explications_commentees_exercice || '',
      lien_exercice: exercice.lien_exercice || '',
      Materiel: exercice.Materiel || [],
      Muscles: exercice.Muscles || [],
      image_exercice: exercice.image_exercice || '',
      video_exercice: exercice.video_exercice || '',
    })
    setShowEditModal(true)
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, `exercices/${Date.now()}_${file.name}`)
      setForm((f) => ({ ...f, image_exercice: url }))
    } catch {
      alert("Erreur lors de l'upload de l'image")
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateExercice(id, form)
    setExercice({ ...exercice, ...form })
    setShowEditModal(false)
  }

  const handleDelete = async () => {
    await deleteExercice(id)
    router.push('/exercices')
  }

  const toggleTag = (field: 'Muscles' | 'Materiel', value: string) => {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!exercice) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-400">Exercice introuvable.</p>
      </div>
    )
  }

  const MUSCLES_SUGGESTIONS = ['Quadriceps', 'Ischio-jambiers', 'Fessiers', 'Mollets', 'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Abdominaux', 'Core', 'Full body']
  const MATERIEL_SUGGESTIONS = ['Haltères', 'Barre', 'Élastiques', 'Kettlebell', 'Banc', 'Poulie', 'TRX', 'Poids du corps', 'Médecine-ball', 'Corde à sauter', 'Tapis', 'Aucun']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/exercices')} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{exercice.nom_exercice}</h1>
          {exercice.partie_prioritaire && (
            <span className="hidden sm:inline-block text-xs bg-blue-100 text-blue-700 font-medium px-2.5 py-1 rounded-full">
              {exercice.partie_prioritaire}
            </span>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={openEdit}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition">
            <PencilIcon className="w-4 h-4" />
            Modifier
          </button>
          <button onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition">
            <TrashIcon className="w-4 h-4" />
            Supprimer
          </button>
        </div>
      </div>

      {/* Contenu en 2 colonnes sur PC */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Colonne gauche : image + liens */}
        <div className="space-y-4">
          {/* Image */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {exercice.image_exercice ? (
              <img src={exercice.image_exercice} alt={exercice.nom_exercice}
                className="w-full h-56 object-contain bg-gray-50" />
            ) : (
              <div className="h-40 flex flex-col items-center justify-center gap-2 bg-gray-50">
                <PhotoIcon className="w-8 h-8 text-gray-300" />
                <MissingBadge />
              </div>
            )}
          </div>

          {/* Liens */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Liens</p>
            {exercice.lien_exercice ? (
              <a href={exercice.lien_exercice} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all">
                <LinkIcon className="w-4 h-4 shrink-0" />
                {exercice.lien_exercice}
              </a>
            ) : <MissingBadge />}

            {exercice.video_exercice ? (
              <a href={exercice.video_exercice} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 hover:underline break-all">
                <PlayIcon className="w-4 h-4 shrink-0" />
                Vidéo
              </a>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Vidéo</span>
                <MissingBadge />
              </div>
            )}
          </div>
        </div>

        {/* Colonne droite : infos */}
        <div className="lg:col-span-2 space-y-4">

          {/* Muscles + Matériel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">Muscles ciblés</p>
              {exercice.Muscles && exercice.Muscles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {exercice.Muscles.map((m: string) => (
                    <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{m}</span>
                  ))}
                </div>
              ) : <MissingBadge />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500 mb-2">Matériel</p>
              {exercice.Materiel && exercice.Materiel.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {exercice.Materiel.map((m: string) => (
                    <span key={m} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">{m}</span>
                  ))}
                </div>
              ) : <MissingBadge />}
            </div>
          </div>

          {/* Explications */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-sm font-semibold text-gray-500 mb-2">Explications</p>
            {exercice.explications_commentees_exercice ? (
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {exercice.explications_commentees_exercice}
              </p>
            ) : <MissingBadge />}
          </div>
        </div>
      </div>

      {/* Modal modification */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier l'exercice" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input type="text" value={form.nom_exercice} onChange={(e) => setForm({ ...form, nom_exercice: e.target.value })} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partie prioritaire</label>
            <select value={form.partie_prioritaire} onChange={(e) => setForm({ ...form, partie_prioritaire: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Muscles ciblés</label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLES_SUGGESTIONS.map((m) => (
                <button key={m} type="button" onClick={() => toggleTag('Muscles', m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${form.Muscles.includes(m) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Matériel</label>
            <div className="flex flex-wrap gap-1.5">
              {MATERIEL_SUGGESTIONS.map((m) => (
                <button key={m} type="button" onClick={() => toggleTag('Materiel', m)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${form.Materiel.includes(m) ? 'bg-gray-700 text-white border-gray-700' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Explications</label>
            <textarea value={form.explications_commentees_exercice}
              onChange={(e) => setForm({ ...form, explications_commentees_exercice: e.target.value })}
              rows={4} placeholder="Description technique, consignes..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Photo</label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
            {form.image_exercice ? (
              <div className="relative rounded-lg overflow-hidden h-40 bg-gray-100">
                <img src={form.image_exercice} alt="Aperçu" className="w-full h-full object-contain" />
                <button type="button" onClick={() => setForm((f) => ({ ...f, image_exercice: '' }))}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600">✕</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition disabled:opacity-50">
                <PhotoIcon className="w-7 h-7" />
                <span className="text-sm">{uploadingImage ? "Upload en cours…" : "Cliquer pour ajouter une photo"}</span>
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien vidéo / externe</label>
            <input type="url" value={form.lien_exercice} onChange={(e) => setForm({ ...form, lien_exercice: e.target.value })}
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Supprimer cet exercice ?" size="sm">
        <p className="text-sm text-gray-600 mb-5">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
          <button onClick={handleDelete}
            className="flex-1 bg-red-500 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-600 transition">Supprimer</button>
        </div>
      </Modal>
    </div>
  )
}
