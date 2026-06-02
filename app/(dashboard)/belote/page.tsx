'use client'

import { useRouter } from 'next/navigation'
import { StoreGate } from '@/components/ui/StoreGate'
import { useBeloteGames } from '@/hooks/useBeloteGames'
import CardsLogo from '@/components/belote/CardsLogo'
import { PlusIcon, ClockIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

export default function BelotePage() {
  const router = useRouter()
  const { inProgress, finished, loading } = useBeloteGames()

  return (
    <StoreGate appRoute="/belote">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardsLogo className="w-11 h-11 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Belote</h1>
              <p className="text-sm text-gray-500 mt-0.5">Comptez vos points partie après partie</p>
            </div>
          </div>
          <button onClick={() => router.push('/belote/historique')}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition shrink-0">
            <ClockIcon className="w-4 h-4" /> Historique
          </button>
        </div>

        {/* Nouvelle partie */}
        <button onClick={() => router.push('/belote/nouvelle-partie')}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition">
          <PlusIcon className="w-5 h-5" /> Nouvelle partie
        </button>

        {/* Parties en cours */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Parties en cours</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : inProgress.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <p className="text-3xl mb-2">🎴</p>
              <p className="text-sm text-gray-400">Aucune partie en cours.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {inProgress.map(g => (
                <button key={g.id} onClick={() => router.push(`/belote/${g.id}`)}
                  className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3 hover:shadow-md transition text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {g.team1Name} <span className="text-gray-300">vs</span> {g.team2Name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {g.totalScore.team1} · {g.totalScore.team2}
                      {' — '}{g.endCondition === 'score' ? `objectif ${g.endValue}` : `${g.endValue} tours`}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Aperçu terminées */}
        {finished.length > 0 && (
          <button onClick={() => router.push('/belote/historique')}
            className="w-full text-sm text-blue-600 hover:underline">
            Voir les {finished.length} partie{finished.length > 1 ? 's' : ''} terminée{finished.length > 1 ? 's' : ''} →
          </button>
        )}
      </div>
    </StoreGate>
  )
}
