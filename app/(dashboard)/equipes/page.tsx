'use client'

import { useState } from 'react'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useTeams } from '@/hooks/useTeams'
import Modal from '@/components/ui/Modal'
import { PlusIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

const SPORTS = [
  'Football', 'Basketball', 'Rugby', 'Volleyball', 'Handball',
  'Tennis', 'Natation', 'Athlétisme', 'Cyclisme', 'Autre'
]

export default function EquipesPage() {
  const { currentUser } = useAuth()
  const { teams, loading, addTeam, updateTeam, deleteTeam } = useTeams()
  const router = useRouter()

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [form, setForm] = useState({ nom_equipe: '', sport: 'Football' })

  const openAdd = () => {
    setEditItem(null)
    setForm({ nom_equipe: '', sport: 'Football' })
    setShowModal(true)
  }

  const openEdit = (team: any) => {
    setEditItem(team)
    setForm({ nom_equipe: team.nom_equipe, sport: team.sport })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const payload = {
      ...form,
      userref: doc(db, 'users', currentUser.uid),
      create_date: Timestamp.now(),
      logo: '',
    }
    if (editItem) {
      await updateTeam(editItem.id, { nom_equipe: form.nom_equipe, sport: form.sport })
    } else {
      await addTeam(payload as any)
    }
    setShowModal(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Équipes</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Nouvelle équipe
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : teams.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <UsersIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune équipe pour le moment</p>
          <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            + Créer une équipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div
              key={team.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:shadow-md transition"
              onClick={() => router.push(`/equipes/${team.id}`)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
                  {team.nom_equipe?.[0]}
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(team)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(team.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-gray-800">{team.nom_equipe}</h3>
              <p className="text-sm text-gray-500">{team.sport}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? "Modifier l'équipe" : 'Nouvelle équipe'}
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'équipe</label>
            <input
              type="text"
              value={form.nom_equipe}
              onChange={(e) => setForm({ ...form, nom_equipe: e.target.value })}
              required
              placeholder="Ex: US Rennes"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select
              value={form.sport}
              onChange={(e) => setForm({ ...form, sport: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
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
        title="Supprimer cette équipe ?"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Tous les joueurs associés resteront dans la base. Cette action est irréversible.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => showDeleteConfirm && deleteTeam(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}