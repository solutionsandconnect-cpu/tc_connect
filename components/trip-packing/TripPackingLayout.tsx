'use client'

import { useState, useEffect } from 'react'
import { useTrips } from '@/hooks/useTrips'
import TripSidebar from './TripSidebar'
import TripDetail from './TripDetail'
import TripModal from './modals/TripModal'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function TripPackingLayout() {
  const { voyages, templates, loading } = useTrips()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Sélection auto du premier voyage au chargement
  useEffect(() => {
    if (selectedId) return
    if (voyages.length > 0) setSelectedId(voyages[0].id)
    else if (templates.length > 0) setSelectedId(templates[0].id)
  }, [voyages, templates, selectedId])

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">🧳 Mes valises</h1>
        <p className="text-sm text-gray-500 mt-0.5">Préparez vos voyages sans rien oublier</p>
      </div>

      <div className="lg:flex lg:gap-6">
        {/* Sidebar — pleine largeur sur mobile quand aucun voyage sélectionné */}
        <aside className={`lg:w-72 lg:shrink-0 ${selectedId ? 'hidden lg:block' : 'block'}`}>
          <TripSidebar
            voyages={voyages}
            templates={templates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={() => setShowCreate(true)}
            loading={loading}
          />
        </aside>

        {/* Détail */}
        <main className="flex-1 min-w-0 mt-6 lg:mt-0">
          {selectedId ? (
            <>
              {/* Retour liste (mobile) */}
              <button onClick={() => setSelectedId(null)}
                className="lg:hidden flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition">
                <ArrowLeftIcon className="w-4 h-4" /> Voyages
              </button>
              <TripDetail
                key={selectedId}
                tripId={selectedId}
                onDeleted={() => setSelectedId(null)}
                notify={notify}
              />
            </>
          ) : (
            !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 text-center">
                <p className="text-5xl mb-3">🧳</p>
                <p className="text-gray-500 font-medium">Sélectionnez un voyage</p>
                <p className="text-sm text-gray-400 mt-1">ou créez-en un nouveau pour commencer votre liste</p>
              </div>
            )
          )}
        </main>
      </div>

      {/* Création */}
      <TripModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        templates={templates}
        onCreated={(id) => { setSelectedId(id); notify('Voyage créé ✓') }}
      />
    </div>
  )
}
