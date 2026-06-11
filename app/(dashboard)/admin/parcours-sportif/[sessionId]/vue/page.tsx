'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { doc, getDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon, ClockIcon, MapPinIcon, CalendarIcon,
  PencilIcon, ArrowPathIcon, BoltIcon, PauseIcon,
} from '@heroicons/react/24/outline'

interface Exercise {
  id: string
  name: string
  exerciceRefId?: string | null
  tempsEffort: number
  recupEntreExos: number
  reps?: string | null
  options?: string | null
  optionHausse?: string | null
  variant?: string | null
}
interface Circuit {
  id: string
  name: string
  type?: 'standard' | 'amrap' | null
  nbTours: number
  recupEntreTours: number
  dureeAmrap?: number | null
  exercises: Exercise[]
}
interface SessionInfo {
  title: string
  date?: Timestamp
  dateEnd?: Timestamp
  durationMinutes?: number
  locationLabel?: string
  location?: string
}

function calcCircuitSeconds(c: Circuit): number {
  if (c.type === 'amrap') return c.dureeAmrap ?? 0
  if (c.exercises.length === 0) return 0
  const timePerTour = c.exercises.reduce((s, ex) => s + ex.tempsEffort + ex.recupEntreExos, 0)
  return timePerTour * c.nbTours + c.recupEntreTours * Math.max(0, c.nbTours - 1)
}
function formatSeconds(sec: number): string {
  if (sec <= 0) return '0s'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}min`
  return `${m}min ${s}s`
}
function fmtDate(ts?: Timestamp) {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
function fmtHeure(ts?: Timestamp) {
  if (!ts) return ''
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function VueSeancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [session, setSession] = useState<SessionInfo | null>(null)
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCircuit, setActiveCircuit] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      const [sessionSnap, contentSnap] = await Promise.all([
        getDoc(doc(db, 'sessions', sessionId)),
        getDoc(doc(db, 'session_content', sessionId)),
      ])
      if (sessionSnap.exists()) setSession(sessionSnap.data() as SessionInfo)
      if (contentSnap.exists()) setCircuits(contentSnap.data().circuits ?? [])
      setLoading(false)
    }
    load()
  }, [isAdmin, sessionId])

  const totalSeconds = useMemo(() => circuits.reduce((s, c) => s + calcCircuitSeconds(c), 0), [circuits])
  const visibleCircuits = activeCircuit ? circuits.filter((c) => c.id === activeCircuit) : circuits

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé.</p></div>
  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  const locationDisplay = session?.locationLabel || session?.location || ''

  return (
    <div className="pb-10">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}`)}
            className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">{session?.title ?? 'Séance'}</h1>
            <div className="flex items-center gap-1.5 text-xs text-purple-600 font-semibold">
              <ClockIcon className="w-3.5 h-3.5" />
              {formatSeconds(totalSeconds)} de travail
            </div>
          </div>
          <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}/contenu`)}
            className="p-2 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition shrink-0">
            <PencilIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Infos séance */}
      {(session?.date || locationDisplay) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4 space-y-1.5">
          {session?.date && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="capitalize font-medium">{fmtDate(session.date)}</span>
              <span className="text-gray-400">·</span>
              <span>{fmtHeure(session.date)}{session.dateEnd ? ` → ${fmtHeure(session.dateEnd)}` : ''}</span>
            </div>
          )}
          {locationDisplay && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{locationDisplay}</span>
            </div>
          )}
        </div>
      )}

      {circuits.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mt-4">
          <BoltIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun contenu défini</p>
          <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}/contenu`)}
            className="mt-3 text-sm font-medium text-purple-600 hover:underline">
            Créer le contenu de la séance
          </button>
        </div>
      ) : (
        <>
          {/* Chips filtre circuit */}
          <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCircuit(null)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                activeCircuit === null
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600'
              }`}>
              Vue globale
            </button>
            {circuits.map((c) => (
              <button key={c.id}
                onClick={() => setActiveCircuit(c.id === activeCircuit ? null : c.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
                  activeCircuit === c.id
                    ? (c.type === 'amrap' ? 'bg-orange-500 text-white shadow-sm' : 'bg-purple-600 text-white shadow-sm')
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-600'
                }`}>
                {c.name || `Circuit ${circuits.indexOf(c) + 1}`}
              </button>
            ))}
          </div>

          <div className="space-y-4 mt-3">
            {visibleCircuits.map((circuit) => {
              const isAmrap = circuit.type === 'amrap'
              return (
                <div key={circuit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* En-tête circuit */}
                  <div className={`text-white px-5 py-4 ${isAmrap ? 'bg-gradient-to-r from-orange-500 to-amber-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold">{circuit.name || `Circuit`}</h2>
                      <span className="text-xs font-semibold bg-white/20 px-2.5 py-1 rounded-lg shrink-0">
                        {formatSeconds(calcCircuitSeconds(circuit))}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-white/90">
                      {isAmrap ? (
                        <span className="flex items-center gap-1">
                          <ClockIcon className="w-3.5 h-3.5" />
                          AMRAP · max de tours en {formatSeconds(circuit.dureeAmrap ?? 0)}
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1">
                            <ArrowPathIcon className="w-3.5 h-3.5" />
                            {circuit.nbTours} tour{circuit.nbTours > 1 ? 's' : ''}
                          </span>
                          {circuit.recupEntreTours > 0 && (
                            <span className="flex items-center gap-1">
                              <PauseIcon className="w-3.5 h-3.5" />
                              {formatSeconds(circuit.recupEntreTours)} entre tours
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Exercices */}
                  <div className="divide-y divide-gray-50">
                    {circuit.exercises.map((ex, ei) => (
                      <div key={ex.id} className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isAmrap ? 'bg-orange-100 text-orange-600' : 'bg-purple-100 text-purple-600'}`}>
                            {ei + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800">{ex.name || 'Exercice'}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isAmrap ? (
                              ex.reps ? (
                                <span className="text-sm font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">
                                  {ex.reps}
                                </span>
                              ) : null
                            ) : (
                              <>
                                <span className="flex items-center gap-1 text-sm font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">
                                  <BoltIcon className="w-3.5 h-3.5" />
                                  {formatSeconds(ex.tempsEffort)}
                                </span>
                                {ex.recupEntreExos > 0 && (
                                  <span className="flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                                    <PauseIcon className="w-3.5 h-3.5" />
                                    {formatSeconds(ex.recupEntreExos)}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        {(ex.options || ex.optionHausse || ex.variant) && (
                          <div className="pl-11 mt-1 space-y-0.5">
                            {ex.options && (
                              <p className="text-[11px] text-gray-400">↓ Option facile : {ex.options}</p>
                            )}
                            {ex.optionHausse && (
                              <p className="text-[11px] text-blue-500">↑ Option difficile : {ex.optionHausse}</p>
                            )}
                            {ex.variant && (
                              <p className="text-[11px] text-orange-500">⚠ Variante : {ex.variant}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {/* Total temps — vue globale uniquement */}
            {activeCircuit === null && (
              <div className="bg-purple-600 text-white rounded-2xl p-4 flex items-center justify-between">
                <span className="text-sm font-medium">Temps de travail total estimé</span>
                <span className="text-xl font-bold">{formatSeconds(totalSeconds)}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
