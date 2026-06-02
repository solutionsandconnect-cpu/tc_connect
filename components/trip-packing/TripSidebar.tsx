'use client'

import { tripProgress } from '@/lib/tripsService'
import type { Trip } from '@/types'
import { PlusIcon } from '@heroicons/react/24/outline'

interface Props {
  voyages: Trip[]
  templates: Trip[]
  selectedId: string | null
  onSelect: (id: string) => void
  onCreate: () => void
  loading: boolean
}

function TripRow({ trip, active, onClick }: { trip: Trip; active: boolean; onClick: () => void }) {
  const { pct, total } = tripProgress(trip)
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
        active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'
      }`}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: trip.color + '20' }}>
        {trip.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>{trip.name}</p>
        <p className="text-xs text-gray-400">
          {trip.isTemplate ? 'Modèle' : total > 0 ? `${pct}% prêt` : 'Liste vide'}
          {trip.members.length > 1 && ` · ${trip.members.length} membres`}
        </p>
      </div>
    </button>
  )
}

export default function TripSidebar({ voyages, templates, selectedId, onSelect, onCreate, loading }: Props) {
  return (
    <div className="space-y-5">
      <button onClick={onCreate}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition">
        <PlusIcon className="w-4 h-4" /> Nouveau voyage
      </button>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Mes voyages</p>
            {voyages.length === 0 ? (
              <p className="text-xs text-gray-400 px-1 py-2">Aucun voyage. Créez le premier !</p>
            ) : (
              <div className="space-y-1">
                {voyages.map(t => <TripRow key={t.id} trip={t} active={t.id === selectedId} onClick={() => onSelect(t.id)} />)}
              </div>
            )}
          </div>

          {templates.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Modèles</p>
              <div className="space-y-1">
                {templates.map(t => <TripRow key={t.id} trip={t} active={t.id === selectedId} onClick={() => onSelect(t.id)} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
