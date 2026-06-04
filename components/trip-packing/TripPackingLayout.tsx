'use client'

import { useState, useEffect } from 'react'
import { useTrips } from '@/hooks/useTrips'
import TripSidebar from './TripSidebar'
import TripDetail from './TripDetail'
import TripModal from './modals/TripModal'
import { PinAppButton } from '@/components/ui/StoreGate'

export default function TripPackingLayout() {
  const { voyages, archived, templates, loading } = useTrips()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

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

      {/* Header global — masqué dès qu'une liste est sélectionnée (mobile ET desktop) */}
      {!selectedId && (
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-800">✅ CheckConnect</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vos checklists et listes partagées</p>
        </div>
      )}

      <div className="lg:flex lg:gap-6">
        {/* Sidebar — pleine largeur sur mobile quand aucune liste sélectionnée */}
        <aside className={`lg:w-72 lg:shrink-0 ${selectedId ? 'hidden lg:block' : 'block'}`}>
          <TripSidebar
            voyages={voyages}
            archived={archived}
            templates={templates}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onCreate={() => setShowCreate(true)}
            loading={loading}
            showBrand={!!selectedId}
          />
        </aside>

        {/* Détail */}
        <main className="flex-1 min-w-0">
          {selectedId ? (
            <TripDetail
              key={selectedId}
              tripId={selectedId}
              onDeleted={() => setSelectedId(null)}
              onBack={() => setSelectedId(null)}
              notify={notify}
            />
          ) : (
            !loading && (
              <div className="hidden lg:flex flex-col items-center justify-center py-24 text-center">
                <p className="text-5xl mb-3">✅</p>
                <p className="text-gray-500 font-medium">Sélectionnez une liste</p>
                <p className="text-sm text-gray-400 mt-1">ou créez-en une nouvelle pour commencer</p>
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
        onCreated={(id) => { setSelectedId(id); notify('Liste créée ✓') }}
      />

      {/* Bouton épingler flottant :
          - Desktop (sm+) : toujours visible
          - Mobile : seulement sur la page principale (pas quand une liste est ouverte) */}
      <PinAppButton appRoute="/trips" hiddenOnMobile={!!selectedId} />
    </div>
  )
}
