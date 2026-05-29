'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  doc, getDoc, query, collection, where, getDocs,
  updateDoc, increment, onSnapshot
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  XMarkIcon, PlayIcon, PauseIcon, ArrowPathIcon,
  ChevronRightIcon, ArrowLeftIcon
} from '@heroicons/react/24/outline'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Exercice {
  id: string
  nom_exercice: string
  image_exercice?: string
  video_exercice?: string
  explications_commentees_exercice?: string
  muscles?: string[]
}

interface ProgrammeSeance {
  id: string
  ref_seance: any
  exercice: any
  explication_exercice: string
  type_effort: string
  effort: number          // secondes
  recup_effort: number    // secondes
  tempo_phase1: number
  tempo_phase2: number
  tempo_phase3: number
  tempo_phase4: number
  num_exercice: number
  nb_serie_effectuee: number
  notes_utilisateur: string
  charge: number
}

interface Seance {
  id: string
  nb_tours: number
  nb_exercice: number
  recup_tours: number
  partie_seance: string
  type_seance: string
  avancement_circuit: number
}

type TimerPhase = 'idle' | 'effort' | 'recup_exo' | 'recup_tours'

// ─── Hook Timer ──────────────────────────────────────────────────────────────

function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onEndRef = useRef<(() => void) | null>(null)

  const reset = useCallback((secs?: number) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setRunning(false)
    setRemaining(secs ?? initialSeconds)
  }, [initialSeconds])

  const start = useCallback(() => setRunning(true), [])
  const pause = useCallback(() => setRunning(false), [])

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          onEndRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  const setOnEnd = useCallback((fn: () => void) => { onEndRef.current = fn }, [])

  return { remaining, running, start, pause, reset, setOnEnd }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern)
  }
}

// ─── Composant Timer ─────────────────────────────────────────────────────────

function TimerBlock({
  label, seconds, active, phase, onStart, onPause, onReset
}: {
  label: string
  seconds: number
  active: boolean
  phase: TimerPhase
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  const pct = seconds > 0 ? (seconds / (seconds || 1)) * 100 : 0
  const color = phase === 'effort'
    ? 'text-blue-600'
    : phase === 'recup_exo'
    ? 'text-green-600'
    : 'text-orange-500'
  const bgRing = phase === 'effort'
    ? 'ring-blue-200'
    : phase === 'recup_exo'
    ? 'ring-green-200'
    : 'ring-orange-200'

  return (
    <div className={`rounded-2xl p-4 transition-all duration-300 ${
      active ? 'bg-white shadow-md ring-2 ' + bgRing : 'bg-gray-50 opacity-70'
    }`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</p>
      <div className={`text-3xl font-bold tabular-nums mb-3 ${active ? color : 'text-gray-400'}`}>
        {formatTime(seconds)}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onStart}
          className={`flex items-center justify-center w-9 h-9 rounded-xl transition ${
            active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}
        >
          <PlayIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onPause}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
        >
          <PauseIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onReset}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-200 text-gray-600 hover:bg-gray-300 transition"
        >
          <ArrowPathIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SeanceLancementPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()

  const seanceId = params.seanceId as string
  const numExo = parseInt(searchParams.get('numExo') || '1')
  const planningId = searchParams.get('planningId') || ''

  const [seance, setSeance] = useState<Seance | null>(null)
  const [programme, setProgramme] = useState<ProgrammeSeance | null>(null)
  const [exercice, setExercice] = useState<Exercice | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<TimerPhase>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const [charge, setCharge] = useState<string>('0')
  const [notes, setNotes] = useState<string>('')
  const [saving, setSaving] = useState(false)

  // 3 timers indépendants
  const effortTimer = useCountdown(0)
  const recupExoTimer = useCountdown(0)
  const recupToursTimer = useCountdown(0)

  // Wakelock
  const wakeLockRef = useRef<any>(null)
  useEffect(() => {
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        }
      } catch {}
    }
    acquire()
    return () => { wakeLockRef.current?.release() }
  }, [])

  // Toast helper
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Chargement données
  useEffect(() => {
    if (!seanceId) return
    const load = async () => {
      setLoading(true)
      try {
        // Séance
        const seanceSnap = await getDoc(doc(db, 'seance', seanceId))
        if (!seanceSnap.exists()) return
        const seanceData = { id: seanceSnap.id, ...seanceSnap.data() } as Seance
        setSeance(seanceData)

        // Programme séance pour cet exercice
        const q = query(
          collection(db, 'programme_seance'),
          where('ref_seance', '==', doc(db, 'seance', seanceId)),
          where('num_exercice', '==', numExo)
        )
        const progSnap = await getDocs(q)
        if (progSnap.empty) return
        const progData = { id: progSnap.docs[0].id, ...progSnap.docs[0].data() } as ProgrammeSeance
        setProgramme(progData)
        setCharge(String(progData.charge || 0))
        setNotes(progData.notes_utilisateur || '')

        // Exercice
        if (progData.exercice) {
          const exoSnap = await getDoc(progData.exercice)
          if (exoSnap.exists()) {
            setExercice({ id: exoSnap.id, ...(exoSnap.data() as Record<string, unknown>) } as Exercice)
          }
        }

        // Init timers
        effortTimer.reset(progData.effort || 0)
        recupExoTimer.reset(progData.recup_effort || 0)
        recupToursTimer.reset(seanceData.recup_tours || 0)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [seanceId, numExo])

  // Callbacks timers
  useEffect(() => {
    effortTimer.setOnEnd(() => {
      vibrate([200, 100, 200])
      if (seance && programme && numExo === seance.nb_exercice) {
        showToast('Récupère avant le tour suivant 💪')
        recupToursTimer.reset(seance.recup_tours)
        recupToursTimer.start()
        setPhase('recup_tours')
      } else {
        showToast('Récupère avant le prochain exercice')
        recupExoTimer.reset(programme?.recup_effort || 0)
        recupExoTimer.start()
        setPhase('recup_exo')
      }
    })
  }, [seance, programme, numExo])

  useEffect(() => {
    recupExoTimer.setOnEnd(() => {
      vibrate([300])
      showToast('Passe à l\'exercice suivant ▶')
      effortTimer.reset(programme?.effort || 0)
      recupExoTimer.reset(programme?.recup_effort || 0)
      recupToursTimer.reset(seance?.recup_tours || 0)
      setPhase('idle')
    })
  }, [programme, seance])

  useEffect(() => {
    recupToursTimer.setOnEnd(() => {
      vibrate([300])
      showToast('Passe au tour suivant ▶')
      effortTimer.reset(programme?.effort || 0)
      recupExoTimer.reset(programme?.recup_effort || 0)
      recupToursTimer.reset(seance?.recup_tours || 0)
      setPhase('idle')
    })
  }, [programme, seance])

  // Sauvegarder et passer à suivant
  const handleSuivant = async () => {
    if (!programme || !seance) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'programme_seance', programme.id), {
        charge: parseFloat(charge) || 0,
        notes_utilisateur: notes,
        nb_serie_effectuee: increment(1),
      })

      const newNbSerie = (programme.nb_serie_effectuee || 0) + 1
      const isDernierExo = numExo === seance.nb_exercice
      const isDernierTour = newNbSerie === seance.nb_tours

      if (isDernierExo && isDernierTour) {
        // Circuit terminé
        await updateDoc(doc(db, 'seance', seanceId), {
          avancement_circuit: 1.0,
        })
        showToast('Circuit terminé ! 🎉')
        setTimeout(() => {
          router.push(`/seances/${seanceId}${planningId ? `?planningId=${planningId}` : ''}`)
        }, 1000)
      } else if (isDernierExo) {
        // Retour à l'exo 1 du prochain tour
        router.push(`/seances/lancement/${seanceId}?numExo=1&planningId=${planningId}`)
      } else {
        // Exercice suivant
        router.push(`/seances/lancement/${seanceId}?numExo=${numExo + 1}&planningId=${planningId}`)
      }
    } finally {
      setSaving(false)
    }
  }

  // Quitter
  const handleQuitter = async () => {
    if (!confirm('Quitter le circuit ? Il sera noté comme effectué.')) return
    if (seance) {
      await updateDoc(doc(db, 'seance', seanceId), { avancement_circuit: 1.0 })
    }
    router.push(`/seances/${seanceId}${planningId ? `?planningId=${planningId}` : ''}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement de la séance...</p>
        </div>
      </div>
    )
  }

  if (!seance || !programme || !exercice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Exercice introuvable</p>
          <button onClick={() => router.back()} className="text-blue-600 text-sm">← Retour</button>
        </div>
      </div>
    )
  }

  const tourActuel = (programme.nb_serie_effectuee || 0) + 1
  const progressTour = seance.nb_tours > 0 ? ((tourActuel - 1) / seance.nb_tours) * 100 : 0
  const isDernierExo = numExo === seance.nb_exercice

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={handleQuitter} className="p-2 rounded-xl hover:bg-gray-100 transition">
          <XMarkIcon className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-400">Exercice {numExo}/{seance.nb_exercice}</p>
          <p className="text-sm font-bold text-gray-800">Tour {tourActuel}/{seance.nb_tours}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Barre progression tour */}
      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${progressTour}%` }}
        />
      </div>

      {/* Progression exercices */}
      <div className="px-4 pt-3 pb-1 flex gap-1">
        {Array.from({ length: seance.nb_exercice }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all ${
              i + 1 < numExo ? 'bg-blue-600' :
              i + 1 === numExo ? 'bg-blue-400' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Carte exercice */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {exercice.image_exercice && (
            <img
              src={exercice.image_exercice}
              alt={exercice.nom_exercice}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-4">
            <h2 className="text-lg font-bold text-gray-800 mb-1">{exercice.nom_exercice}</h2>
            {exercice.muscles && exercice.muscles.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {exercice.muscles.map(m => (
                  <span key={m} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            )}
            {programme.explication_exercice && (
              <p className="text-sm text-gray-600">{programme.explication_exercice}</p>
            )}
          </div>
        </div>

        {/* Tempo */}
        {(programme.tempo_phase1 || programme.tempo_phase2 || programme.tempo_phase3 || programme.tempo_phase4) ? (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tempo</p>
            <div className="flex items-center gap-3">
              {[programme.tempo_phase1, programme.tempo_phase2, programme.tempo_phase3, programme.tempo_phase4].map((t, i) => (
                <div key={i} className="text-center flex-1">
                  <div className="text-xl font-bold text-gray-800">{t || 0}</div>
                  <div className="text-xs text-gray-400">{['↓', '⏸', '↑', '⏸'][i]}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Timers */}
        <div className="grid grid-cols-1 gap-3">
          <TimerBlock
            label={`⚡ Effort${programme.type_effort ? ` — ${programme.type_effort}` : ''}`}
            seconds={effortTimer.remaining}
            active={phase === 'effort' || phase === 'idle'}
            phase="effort"
            onStart={() => { effortTimer.start(); setPhase('effort') }}
            onPause={() => effortTimer.pause()}
            onReset={() => { effortTimer.reset(programme.effort); setPhase('idle') }}
          />
          {!isDernierExo && (
            <TimerBlock
              label="😮‍💨 Récupération exercice"
              seconds={recupExoTimer.remaining}
              active={phase === 'recup_exo'}
              phase="recup_exo"
              onStart={() => { recupExoTimer.start(); setPhase('recup_exo') }}
              onPause={() => recupExoTimer.pause()}
              onReset={() => { recupExoTimer.reset(programme.recup_effort); setPhase('recup_exo') }}
            />
          )}
          {isDernierExo && (
            <TimerBlock
              label="🔄 Récupération tours"
              seconds={recupToursTimer.remaining}
              active={phase === 'recup_tours'}
              phase="recup_tours"
              onStart={() => { recupToursTimer.start(); setPhase('recup_tours') }}
              onPause={() => recupToursTimer.pause()}
              onReset={() => { recupToursTimer.reset(seance.recup_tours); setPhase('recup_tours') }}
            />
          )}
        </div>

        {/* Charge */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Charge (kg)</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCharge(prev => String(Math.max(0, (parseFloat(prev) || 0) - 1)))}
              className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
            >−</button>
            <input
              type="number"
              value={charge}
              onChange={e => setCharge(e.target.value)}
              step="0.5"
              className="flex-1 text-center text-2xl font-bold text-gray-800 border border-gray-200 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setCharge(prev => String((parseFloat(prev) || 0) + 1))}
              className="w-10 h-10 rounded-xl bg-gray-100 text-xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
            >+</button>
          </div>
        </div>

        {/* Notes */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Observations, ressenti..."
            className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Bouton Suivant fixe en bas */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-area-bottom">
        <button
          onClick={handleSuivant}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition text-base"
        >
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {isDernierExo && (programme.nb_serie_effectuee + 1) === seance.nb_tours
                ? '🎉 Terminer le circuit'
                : isDernierExo
                ? 'Tour suivant →'
                : `Exercice suivant (${numExo + 1}/${seance.nb_exercice}) →`
              }
            </>
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg animate-fade-in max-w-xs text-center">
          {toast}
        </div>
      )}
    </div>
  )
}
