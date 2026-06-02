'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import GameSetup from '@/components/belote/GameSetup'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function NouvellePartiePage() {
  const router = useRouter()
  const [error, setError] = useState('')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/belote')} aria-label="Retour"
          className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Nouvelle partie</h1>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

      <GameSetup
        onCreated={(gameId) => router.push(`/belote/${gameId}`)}
        onError={setError}
      />
    </div>
  )
}
