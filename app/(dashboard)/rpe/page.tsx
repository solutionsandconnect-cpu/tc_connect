'use client'

import { useState } from 'react'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRPE } from '@/hooks/useRPE'
import { useJoueurs } from '@/hooks/useJoueurs'
import { useTeams } from '@/hooks/useTeams'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { PlusIcon, ChartBarIcon } from '@heroicons/react/24/outline'

function getRPELabel(val: number): {
  label: string
  variant: 'success' | 'info' | 'warning' | 'danger' | 'gray'
} {
  if (val <= 3) return { label: `${val} — Facile`, variant: 'success' }
  if (val <= 5) return { label: `${val} — Modéré`, variant: 'info' }
  if (val <= 7) return { label: `${val} — Difficile`, variant: 'warning' }
  return { label: `${val} — Très dur`, variant: 'danger' }
}

export default function RPEPage() {
  const { rpeList, loading, addRPE, deleteRPE } = useRPE()
  const { teams } = useTeams()
  const [selectedTeam, setSelectedTeam] = useState('')
  const { joueurs } = useJoueurs(selectedTeam || undefined)

  const [showModal, setShowModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  const [form, setForm] = useState({
    joueur_id: '',
    date: new Date().toISOString().split('T')[0],
    rpe: 5,
    temps: 60,
  })

  const openAdd = () => {
    setForm({
      joueur_id: joueurs[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      rpe: 5,
      temps: 60,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.joueur_id) return

    const chargeEntrainement = form.rpe * form.temps
    const payload = {
      joueurref: doc(db, 'joueurs', form.joueur_id),
      date: Timestamp.fromDate(new Date(form.date)),
      rpe: Number(form.rpe),
      temps: Number(form.temps),
      date_create: Timestamp.now(),
      charge_entrainement: chargeEntrainement,
      charge_aigue: 0,
      charge_chronique: 0,
      rcac: 0,
    }
    await addRPE(payload as any)
    setShowModal(false)
  }

  const getJoueurName = (joueurRef: any) => {
    const id = typeof joueurRef === 'string' ? joueurRef : joueurRef?.id
    const found = joueurs.find((j) => j.id === id)
    if (found) return `${found.prenom_joueur} ${found.nom_joueur}`
    return '—'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">RPE</h1>
          <p className="text-sm text-gray-500">Suivi de charge d'entraînement</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Filtre équipe */}
      <div className="flex gap-3 mb-5">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Toutes les équipes</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.nom_equipe}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : rpeList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ChartBarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune donnée RPE</p>
          <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            + Ajouter un RPE
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rpeList.map((item) => {
            const rpeInfo = getRPELabel(item.rpe)
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-12">
                      <p className="text-2xl font-bold text-gray-800">{item.rpe}</p>
                      <p className="text-xs text-gray-400">/10</p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge label={rpeInfo.label} variant={rpeInfo.variant} />
                      </div>
                      <p className="text-xs text-gray-500">
                        Durée : {item.temps} min · Charge : {item.charge_entrainement} UA
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.date
                          ? (item.date as any).toDate().toLocaleDateString('fr-FR')
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(item.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal ajout */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Ajouter un RPE"
        size="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Équipe</label>
            <select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choisir une équipe --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.nom_equipe}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Joueur</label>
            <select
              value={form.joueur_id}
              onChange={(e) => setForm({ ...form, joueur_id: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Choisir un joueur --</option>
              {joueurs.filter((j) => j.type === 'Joueur').map((j) => (
                <option key={j.id} value={j.id}>
                  {j.prenom_joueur} {j.nom_joueur}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RPE : <span className="text-blue-600 font-bold">{form.rpe}/10</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.rpe}
              onChange={(e) => setForm({ ...form, rpe: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>1 — Très facile</span>
              <span>10 — Maximum</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée (minutes)
            </label>
            <input
              type="number"
              min={1}
              value={form.temps}
              onChange={(e) => setForm({ ...form, temps: Number(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-700">
            Charge d'entraînement estimée :{' '}
            <span className="font-bold">{form.rpe * form.temps} UA</span>
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
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Supprimer ce RPE ?"
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
            onClick={() => showDeleteConfirm && deleteRPE(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}