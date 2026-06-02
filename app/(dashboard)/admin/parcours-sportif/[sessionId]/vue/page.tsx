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
}
interface Circuit {
  id: string
  name: string
  nbTours: number
  recupEntreTours: number
  exercises: Exercise[]
}
interface SessionInfo {
  title: string
  date?: Timestamp
  dateEnd?: Timestamp
  durationMinutes?: number
  locationLabel?: string
  location?: string
  locationCoords?: string
}

function calcCircuitSeconds(c: Circuit): number {
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

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé.</p></div>
  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  const locationDisplay = session?.locationLabel || session?.location || ''

  return (
    <div className="max-w-2xl mx-auto pb-10">
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

      {/* Infos séance compactes */}
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

      {/* Circuits */}
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
        <div className="space-y-4 mt-4">
          {circuits.map((circuit, ci) => (
            <div key={circuit.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* En-tête circuit */}
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-bold">{circuit.name || `Circuit ${ci + 1}`}</h2>
                  <span className="text-xs font-semibold bg-white/20 px-2 py-1 rounded-lg shrink-0">
                    {formatSeconds(calcCircuitSeconds(circuit))}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-xs font-medium text-white/90">
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
                </div>
              </div>

              {/* Exercices */}
              <div className="divide-y divide-gray-50">
                {circuit.exercises.map((ex, ei) => (
                  <div key={ex.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">
                      {ei + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{ex.name || 'Exercice'}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="bg-purple-600 text-white rounded-2xl p-4 flex items-center justify-between">
            <span className="text-sm font-medium">Temps de travail total estimé</span>
            <span className="text-xl font-bold">{formatSeconds(totalSeconds)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
