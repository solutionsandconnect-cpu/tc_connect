'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useBeloteGame } from '@/hooks/useBeloteGame'
import ScoreBoard from '@/components/belote/ScoreBoard'
import RoundHistory from '@/components/belote/RoundHistory'
import Modal from '@/components/ui/Modal'
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import type { BeloteEndCondition } from '@/lib/belote/types'

export default function GameDetailPage() {
  const { gameId } = useParams<{ gameId: string }>()
  const router = useRouter()
  const { game, rounds, loading, removeRound, updateGameSettings, deleteGame } = useBeloteGame(gameId)

  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState<{ endCondition: BeloteEndCondition; endValue: string }>({ endCondition: 'score', endValue: '1000' })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const capots = rounds.filter(r => r.capot).length
  const dedans = rounds.filter(r => r.dedans).length
  const belotes = rounds.filter(r => r.beloteRebelote).length

  const openEdit = () => {
    if (!game) return
    setEditForm({ endCondition: game.endCondition, endValue: String(game.endValue) })
    setShowEdit(true)
  }

  const handleSaveSettings = async () => {
    setBusy(true)
    try {
      await updateGameSettings({ endCondition: editForm.endCondition, endValue: Number(editForm.endValue) || 1 })
      setShowEdit(false)
    } finally { setBusy(false) }
  }

  const handleDelete = async () => {
    setBusy(true)
    try { await deleteGame(); router.push('/belote') }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/belote')} aria-label="Retour"
          className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-800 truncate flex-1">
          {game ? `${game.team1Name} vs ${game.team2Name}` : 'Partie'}
        </h1>
        {game && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={openEdit} aria-label="Modifier la partie"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <PencilIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setConfirmDelete(true)} aria-label="Supprimer la partie"
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : !game ? (
        <div className="text-center py-20 text-gray-400 text-sm">Partie introuvable.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Colonne gauche : score + actions + bilan */}
          <div className="space-y-4">
            <ScoreBoard game={game} rounds={rounds} />

            {game.status === 'in_progress' ? (
              <button onClick={() => router.push(`/belote/${gameId}/nouveau-tour`)}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition">
                <PlusIcon className="w-5 h-5" /> Nouveau tour
              </button>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center text-sm font-medium text-green-700">
                Partie terminée
              </div>
            )}

            {/* Bilan des événements */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bilan</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-bold text-purple-600">{capots}</p>
                  <p className="text-xs text-gray-500">Capot{capots > 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{dedans}</p>
                  <p className="text-xs text-gray-500">Dedans</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{belotes}</p>
                  <p className="text-xs text-gray-500">Belote{belotes > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Colonne droite : historique des tours */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Tours</h2>
            <RoundHistory
              game={game}
              rounds={rounds}
              onEdit={(id) => router.push(`/belote/${gameId}/nouveau-tour?roundId=${id}`)}
              onDelete={removeRound}
            />
          </div>
        </div>
      )}

      {/* Modale modifier la partie */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Modifier la partie" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fin de partie</label>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {([['score', 'Par score'], ['rounds', 'Par tours']] as [BeloteEndCondition, string][]).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setEditForm(f => ({ ...f, endCondition: k }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${editForm.endCondition === k ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editForm.endCondition === 'score' ? 'Score cible' : 'Nombre de tours'}
            </label>
            <input type="number" inputMode="numeric" min={1} value={editForm.endValue}
              onChange={e => setEditForm(f => ({ ...f, endValue: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setShowEdit(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
            <button onClick={handleSaveSettings} disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">Enregistrer</button>
          </div>
        </div>
      </Modal>

      {/* Confirmation suppression partie */}
      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer la partie" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Supprimer cette partie et tous ses tours ? Cette action est irréversible.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
            <button onClick={handleDelete} disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">Supprimer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
