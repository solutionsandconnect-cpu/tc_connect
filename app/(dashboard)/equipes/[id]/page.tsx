'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTeams } from '@/hooks/useTeams'
import { useJoueurs } from '@/hooks/useJoueurs'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { ArrowLeftIcon, PlusIcon, UserIcon } from '@heroicons/react/24/outline'

const TYPES = ['Joueur', 'Staff']
const TYPES_STAFF = ['Entraîneur', 'Préparateur physique', 'Médecin', 'Kiné', 'Autre']

export default function DetailEquipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { teams } = useTeams()
  const { joueurs, loading, addJoueur, updateJoueur, deleteJoueur } = useJoueurs(id)

  const team = teams.find((t) => t.id === id)

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({
    prenom_joueur: '',
    nom_joueur: '',
    mail_joueur: '',
    type: 'Joueur',
    type_staff: '',
  })

  const openAdd = () => {
    setEditItem(null)
    setForm({ prenom_joueur: '', nom_joueur: '', mail_joueur: '', type: 'Joueur', type_staff: '' })
    setShowModal(true)
  }

  const openEdit = (joueur: any) => {
    setEditItem(joueur)
    setForm({
      prenom_joueur: joueur.prenom_joueur || '',
      nom_joueur: joueur.nom_joueur || '',
      mail_joueur: joueur.mail_joueur || '',
      type: joueur.type || 'Joueur',
      type_staff: joueur.type_staff || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      ...form,
      equiperef: doc(db, 'team', id),
      create_date: Timestamp.now(),
      iduserref: null,
      date_naissance: null,
    }
    if (editItem) {
      await updateJoueur(editItem.id, form)
    } else {
      await addJoueur(payload as any)
    }
    setShowModal(false)
  }

  const joueursList = joueurs.filter((j) => j.type === 'Joueur')
  const staffList = joueurs.filter((j) => j.type === 'Staff')

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/equipes')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">{team?.nom_equipe || '...'}</h1>
          <p className="text-sm text-gray-500">{team?.sport}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : (
        <div className="space-y-6">
          {/* Joueurs */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Joueurs ({joueursList.length})
            </h2>
            {joueursList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun joueur</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {joueursList.map((j) => (
                  <JoueurCard
                    key={j.id}
                    joueur={j}
                    onEdit={() => openEdit(j)}
                    onDelete={() => setShowDeleteConfirm(j.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Staff */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Staff ({staffList.length})
            </h2>
            {staffList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun staff</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {staffList.map((j) => (
                  <JoueurCard
                    key={j.id}
                    joueur={j}
                    onEdit={() => openEdit(j)}
                    onDelete={() => setShowDeleteConfirm(j.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Modifier' : 'Ajouter un membre'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input
                type="text"
                value={form.prenom_joueur}
                onChange={(e) => setForm({ ...form, prenom_joueur: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input
                type="text"
                value={form.nom_joueur}
                onChange={(e) => setForm({ ...form, nom_joueur: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={form.mail_joueur}
              onChange={(e) => setForm({ ...form, mail_joueur: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {form.type === 'Staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select
                value={form.type_staff}
                onChange={(e) => setForm({ ...form, type_staff: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Choisir --</option>
                {TYPES_STAFF.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

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

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Supprimer ce membre ?"
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
            onClick={() => showDeleteConfirm && deleteJoueur(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}

function JoueurCard({
  joueur,
  onEdit,
  onDelete,
}: {
  joueur: any
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/joueurs/${joueur.id}`)}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition"
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
        <UserIcon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">
          {joueur.prenom_joueur} {joueur.nom_joueur}
        </p>
        {joueur.mail_joueur && (
          <p className="text-xs text-gray-400 truncate">{joueur.mail_joueur}</p>
        )}
        {joueur.type_staff && (
          <Badge label={joueur.type_staff} variant="info" />
        )}
      </div>
      <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
        <button onClick={onEdit} className="text-xs text-blue-600 hover:underline">Modifier</button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:underline">Supprimer</button>
      </div>
    </div>
  )
}