'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import {
  doc, getDoc, collection, query, where, getDocs,
  updateDoc, increment, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { XMarkIcon, PlayIcon, PauseIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/context/AuthContext'


interface Exercice {
  id: string
  nom_exercice: string
  image_exercice?: string
  video_exercice?: string
}

interface ProgItem {
  id: string
  num_exercice: number
  nb_serie_effectuee: number
  exercice: any
  explication_exercice?: string
  effort: number
  recup_effort: number
  tempo_phase1?: number
  tempo_phase2?: number
  tempo_phase3?: number
  tempo_phase4?: number
  charge?: number
  notes_utilisateur?: string
}

interface Seance {
  id: string
  nb_tours: number
  nb_exercice: number
  recup_tours: number
}

// ── Countdown hook ─────────────────────────────────────────────────────────────
function useCountdown() {
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const [resetVal, setResetVal] = useState(0)
  const [restartKey, setRestartKey] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onEndRef = useRef<(() => void) | null>(null)
  const resetValRef = useRef(0)

  function clear() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  useEffect(() => {
    if (!running) { clear(); return }
    if (remaining <= 0) { setRunning(false); return }
    timerRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clear()
          setRunning(false)
          onEndRef.current?.()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return clear
  }, [running])

  // Triggered by resetAndStart to force a clean start even if running didn't change
  useEffect(() => {
    if (restartKey === 0) return
    setRunning(true)
  }, [restartKey])

  return {
    remaining,
    running,
    start() { setRunning(true) },
    pause() { setRunning(false) },
    reset(secs: number) {
      clear()
      setRunning(false)
      setRemaining(secs)
      setResetVal(secs)
      resetValRef.current = secs
    },
    resetAndStart(secs: number) {
      clear()
      setRunning(false)
      setRemaining(secs)
      setResetVal(secs)
      resetValRef.current = secs
      setRestartKey(k => k + 1)
    },
    replay() {
      clear()
      setRunning(false)
      setRemaining(resetValRef.current)
      setResetVal(resetValRef.current)
    },
    resetVal,
    setOnEnd(fn: () => void) { onEndRef.current = fn },
  }
}

function fmt(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ── Timer control row ──────────────────────────────────────────────────────────
function TimerRow({
  label, timer,
}: {
  label: string
  timer: ReturnType<typeof useCountdown>
}) {
  const isRunning = timer.running
  const isPaused = !timer.running && timer.remaining > 0 && timer.remaining !== timer.resetVal

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <div className="flex justify-center items-center gap-3 mb-3">
        <p className="text-base font-semibold text-gray-700">{label}</p>
        <p className={`text-base font-semibold tabular-nums ${isRunning ? 'text-gray-800' : isPaused ? 'text-orange-500' : 'text-gray-700'}`}>
          {fmt(timer.remaining)}
        </p>
      </div>
      <div className="flex justify-center gap-3">
        {/* Play */}
        <button
          onClick={() => timer.start()}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            isRunning ? 'bg-gray-700 text-white ring-2 ring-gray-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <PlayIcon className="w-5 h-5" />
        </button>
        {/* Reset */}
        <button
          onClick={() => timer.replay()}
          className="w-10 h-10 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center transition"
        >
          <ArrowPathIcon className="w-5 h-5" />
        </button>
        {/* Pause */}
        <button
          onClick={() => timer.pause()}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
            isPaused ? 'bg-orange-500 text-white ring-2 ring-orange-300' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <PauseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

const RPE_LABELS = [
  '0 — Repos',
  '1 — Très très facile',
  '2 — Très facile',
  '3 — Facile',
  '4 — Je sens un effort',
  '5 — Ça commence à être dur',
  '6 — Ça devient bien dur',
  '7 — Dur',
  '8 — Très dur',
  '9 — Très très dur',
  '10 — Tellement dur que je vais arrêter',
]

function rpeBg(v: number) {
  if (v === 0) return 'bg-gray-400 text-white border-gray-400'
  if (v >= 8) return 'bg-red-500 text-white border-red-500'
  if (v >= 4) return 'bg-orange-400 text-white border-orange-400'
  return 'bg-green-500 text-white border-green-500'
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function SeanceLancementPage() {
  const params = useParams()
  const sp = useSearchParams()
  const router = useRouter()

  const seanceId = params.seanceId as string
  const numExo = parseInt(sp.get('exo') || '1', 10)
  const planningId = sp.get('planningId') || ''
  const isReplay = sp.get('replay') === '1'
  const afterDoneUrl = planningId
    ? `/seances/apercu/${planningId}`
    : `/seances/${seanceId}`
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [activePlanningId, setActivePlanningId] = useState(planningId)
  const [intensitePlanifiee, setIntensitePlanifiee] = useState<number | null>(null)
  const [intensiteReelle, setIntensiteReelle] = useState<number | null>(null)
  const [lastCr, setLastCr] = useState<{ date: string; cr: string; comment: string } | null>(null)

  const [loading, setLoading] = useState(true)
  const [seance, setSeance] = useState<Seance | null>(null)
  const [progItem, setProgItem] = useState<ProgItem | null>(null)
  const [exercice, setExercice] = useState<Exercice | null>(null)
  const [charge, setCharge] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [showCloseDialog, setShowCloseDialog] = useState(false)
  const [showCircuitDone, setShowCircuitDone] = useState(false)
  const [bilanCircuit, setBilanCircuit] = useState({ satisfaction: '', rpe: 0 })
  const [programmeBilan, setProgrammeBilan] = useState<{
    exoName: string
    effort: number
    typeEffort: string
    charge: number
    recup: number
    tempo: string
    notes: string
  }[]>([])


  // Load planning data (questionnaire, intensités, last CR)
  useEffect(() => {
    if (!activePlanningId) return
    let cancelled = false
    ;(async () => {
      try {
        const pSnap = await getDoc(doc(db, 'planning_pro', activePlanningId))
        if (!pSnap.exists() || cancelled) return
        const d = pSnap.data() as any
        setIntensitePlanifiee(d.intensite_seance_planifiee || null)
        setIntensiteReelle(d.intensite_seance || null)

        if (isAdmin && d.ref_client) {
          const clientId = (d.ref_client as any)?.id
          if (clientId) {
            try {
              const cq = query(
                collection(db, 'planning_pro'),
                where('ref_client', '==', doc(db, 'users', clientId)),
                where('etat_planning_rdv', '==', 'Effectué'),
                orderBy('date_planning', 'desc')
              )
              const cSnap = await getDocs(cq)
              const last = cSnap.docs
                .map(rDoc => ({ id: rDoc.id, ...(rDoc.data() as any) }))
                .filter(r => r.id !== activePlanningId && (r.observations_rdv || r.cr_rdv_moi))
                .slice(0, 1)[0]
              if (last && !cancelled) {
                const dateStr = last.date_planning?.toDate().toLocaleDateString('fr-FR', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })
                setLastCr({ date: dateStr || '', cr: last.observations_rdv || '', comment: last.cr_rdv_moi || '' })
              }
            } catch {}
          }
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [activePlanningId, isAdmin])


  const effortT = useCountdown()
  const recupT = useCountdown()

  const seanceRef = useRef<Seance | null>(null)
  const progRef = useRef<ProgItem | null>(null)
  useEffect(() => { seanceRef.current = seance }, [seance])
  useEffect(() => { progRef.current = progItem }, [progItem])

  // Reset saving when exercise changes (router.replace keeps component mounted)
  useEffect(() => { setSaving(false) }, [numExo])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  // ── Load exercise data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!seanceId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const sSnap = await getDoc(doc(db, 'seance', seanceId))
        if (!sSnap.exists() || cancelled) return
        const sd = sSnap.data()

        let nbExercice = (sd.nb_exercice as number) || 0
        if (!nbExercice) {
          const cq = query(collection(db, 'programme_seance'), where('ref_seance', '==', doc(db, 'seance', seanceId)))
          const cs = await getDocs(cq)
          nbExercice = cs.size
        }

        // Reset all exercise tour counters and seance progress on replay
        if (isReplay && numExo === 1) {
          await updateDoc(doc(db, 'seance', seanceId), { avancement_circuit: 0 })
          const allQ = query(collection(db, 'programme_seance'), where('ref_seance', '==', doc(db, 'seance', seanceId)))
          const allSnap = await getDocs(allQ)
          await Promise.all(allSnap.docs.map(d => updateDoc(d.ref, { nb_serie_effectuee: 0 })))
        }

        const s: Seance = {
          id: sSnap.id,
          nb_tours: (sd.nb_tours as number) ?? 1,
          nb_exercice: nbExercice,
          recup_tours: (sd.recup_tours as number) ?? 0,
        }
        if (!cancelled) {
          setSeance(s)
          if (!planningId) {
            const rpId = (sd.ref_planning as any)?.id
            if (rpId) setActivePlanningId(rpId)
          }
        }

        const pq = query(
          collection(db, 'programme_seance'),
          where('ref_seance', '==', doc(db, 'seance', seanceId)),
          where('num_exercice', '==', numExo),
        )
        const pSnap = await getDocs(pq)
        if (pSnap.empty || cancelled) return
        const pDoc = pSnap.docs[0]
        const item = { id: pDoc.id, ...pDoc.data() } as ProgItem

        const isLast = item.num_exercice === s.nb_exercice
        effortT.resetAndStart(item.effort || 0)
        recupT.reset(isLast ? (s.recup_tours || 0) : (item.recup_effort || 0))

        if (!cancelled) {
          setProgItem(item)
          setCharge(String(item.charge ?? 0))
          setNotes(item.notes_utilisateur ?? '')
        }

        if (item.exercice) {
          const eSnap = await getDoc(item.exercice)
          if (eSnap.exists() && !cancelled)
            setExercice({ id: eSnap.id, ...(eSnap.data() as object) } as Exercice)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [seanceId, numExo, isReplay])

  // ── Chargement bilan circuit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showCircuitDone || !seanceId) return
    ;(async () => {
      const pq = query(collection(db, 'programme_seance'), where('ref_seance', '==', doc(db, 'seance', seanceId)))
      const pSnap = await getDocs(pq)
      const items = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[]
      items.sort((a, b) => (a.num_exercice ?? 0) - (b.num_exercice ?? 0))
      const bilan = await Promise.all(items.map(async (item) => {
        let exoName = `Exercice ${item.num_exercice ?? ''}`
        if (item.exercice) {
          try {
            const eSnap = await getDoc(item.exercice)
            if (eSnap.exists()) exoName = (eSnap.data() as any).nom_exercice || exoName
          } catch {}
        }
        const t1 = item.tempo_phase1 ?? 0
        const t2 = item.tempo_phase2 ?? 0
        const t3 = item.tempo_phase3 ?? 0
        const t4 = item.tempo_phase4 ?? 0
        return {
          exoName,
          effort: item.effort ?? 0,
          typeEffort: item.type_effort ?? '',
          charge: item.charge ?? 0,
          recup: item.recup_effort ?? 0,
          tempo: `${t1}-${t2}-${t3}-${t4}`,
          notes: item.notes_utilisateur ?? '',
        }
      }))
      setProgrammeBilan(bilan)
    })()
  }, [showCircuitDone, seanceId])

  // ── Timer end callbacks ──────────────────────────────────────────────────────
  useEffect(() => {
    effortT.setOnEnd(() => {
      const s = seanceRef.current
      const p = progRef.current
      if (!s || !p) return
      const isLast = p.num_exercice === s.nb_exercice
      if (isLast) {
        showToast('Récupères avant le tour suivant')
      } else {
        showToast('Récupère avant le prochain exercice')
      }
      recupT.start()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    recupT.setOnEnd(() => {
      const s = seanceRef.current
      const p = progRef.current
      if (!s || !p) return
      const isLast = p.num_exercice === s.nb_exercice
      showToast(isLast
        ? "Passer au tour suivant en cliquant sur 'Suivant'"
        : "Passer à l'exercice suivant en cliquant sur 'Suivant'"
      )
      effortT.replay()
      recupT.replay()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Suivant ──────────────────────────────────────────────────────────────────
  const handleSuivant = async () => {
    if (!seance || !progItem || saving || loading) return
    setSaving(true)
    try {
      const chargeVal = parseFloat(charge) || 0
      const currentNbSerie = progItem.nb_serie_effectuee ?? 0
      const newSerieCount = currentNbSerie + 1
      const isLast = progItem.num_exercice === seance.nb_exercice

      await updateDoc(doc(db, 'programme_seance', progItem.id), {
        charge: chargeVal,
        notes_utilisateur: notes,
        nb_serie_effectuee: increment(1),
      })

      // Mise à jour optimiste : si l'URL ne change pas (exercice unique + plusieurs tours),
      // le useEffect ne se relance pas et nb_serie_effectuee resterait à 0 dans le state.
      setProgItem(prev => prev ? { ...prev, nb_serie_effectuee: newSerieCount } : null)

      const base = `/seances/lancement/${seanceId}`
      const pid = planningId ? `&planningId=${planningId}` : ''

      if (newSerieCount >= seance.nb_tours && isLast) {
        await updateDoc(doc(db, 'seance', seanceId), { avancement_circuit: 1.0 })
        setSaving(false)
        setShowCircuitDone(true)
      } else if (isLast) {
        // Retour à exo=1 pour le tour suivant : on reset les timers manuellement
        // car si l'URL ne change pas le useEffect ne le fera pas
        effortT.resetAndStart(progItem.effort || 0)
        recupT.reset(seance.recup_tours || 0)
        router.replace(`${base}?exo=1${pid}`)
        setSaving(false)
      } else {
        router.replace(`${base}?exo=${numExo + 1}${pid}`)
        setSaving(false)
      }
    } catch {
      setSaving(false)
    }
  }

  // ── Bilan circuit ────────────────────────────────────────────────────────────
  const handleBilanSubmit = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'seance', seanceId), {
        satisfaction_circuit: bilanCircuit.satisfaction,
        intensite_circuit: bilanCircuit.rpe,
      })
    } catch {}
    setSaving(false)
    router.push(afterDoneUrl)
  }

  // ── Close ────────────────────────────────────────────────────────────────────
  const handleClose = async (confirmed: boolean) => {
    setShowCloseDialog(false)
    if (!confirmed) return
    try {
      await updateDoc(doc(db, 'seance', seanceId), { avancement_circuit: 1.0 })
    } catch {}
    router.push(afterDoneUrl)
  }

  // ── Screens ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!seance || !progItem) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400 text-sm">Exercice introuvable</p>
    </div>
  )

  const tour = (progItem.nb_serie_effectuee ?? 0) + 1
  const isLastExo = progItem.num_exercice === seance.nb_exercice

  // ── Écran bilan circuit ───────────────────────────────────────────────────────
  if (showCircuitDone) return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="flex-1 px-5 pt-8 pb-4 space-y-6 overflow-y-auto">
        <div className="text-center">
          <div className="text-4xl mb-2">🎉</div>
          <h1 className="text-xl font-bold text-gray-800">Circuit terminé !</h1>
          <p className="text-sm text-gray-500 mt-1">{seance.type_seance} · {seance.nb_tours} tour(s)</p>
        </div>

        {/* Bilan des exercices */}
        {programmeBilan.length > 0 && (
          <div className="bg-gray-50 rounded-2xl overflow-hidden">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 pt-3 pb-2">Ce qui a été réalisé</p>
            <div className="divide-y divide-gray-100">
              {programmeBilan.map((item, i) => {
                const effortLabel = item.typeEffort === 'Répétitions' ? 'rép'
                  : item.typeEffort === 'Secondes' ? 'sec'
                  : item.typeEffort === 'Mètres' ? 'm' : ''
                return (
                  <div key={i} className="px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.exoName}</p>
                      {item.charge > 0 && (
                        <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                          {item.charge} kg
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="text-xs text-gray-500">{item.effort} {effortLabel}</span>
                      {item.recup > 0 && <span className="text-xs text-gray-400">Récup {item.recup}s</span>}
                      <span className="text-xs text-gray-400">Tempo {item.tempo}</span>
                    </div>
                    {item.notes && (
                      <p className="text-xs text-gray-500 italic bg-white rounded-lg px-2 py-1 mt-1">{item.notes}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Bilan texte → satisfaction_circuit */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Bilan du circuit</label>
          <textarea
            value={bilanCircuit.satisfaction}
            onChange={e => setBilanCircuit(b => ({ ...b, satisfaction: e.target.value }))}
            rows={3}
            placeholder="Comment s'est passé ce circuit ?"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600 resize-none"
          />
        </div>

        {/* RPE ressenti → intensite_circuit */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">RPE ressenti</label>
          <div className="space-y-1.5">
            {RPE_LABELS.map((label, i) => (
              <button key={i} type="button"
                onClick={() => setBilanCircuit(b => ({ ...b, rpe: i }))}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition border ${
                  bilanCircuit.rpe === i ? rpeBg(i) : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-5 pb-10 pt-2 space-y-3">
        <button
          onClick={() => router.replace(`/seances/lancement/${seanceId}?exo=1&replay=1${planningId ? `&planningId=${planningId}` : ''}`)}
          disabled={saving}
          className="w-full bg-white border-2 border-gray-200 text-gray-700 font-semibold py-4 rounded-2xl transition hover:border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Relancer ce circuit
        </button>
        <button
          onClick={handleBilanSubmit}
          disabled={saving}
          className="w-full bg-gray-700 hover:bg-gray-800 disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition flex items-center justify-center gap-2"
        >
          {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          Retour à la séance
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white pb-8">

      {/* Header row */}
      <div className="flex items-center justify-end px-2 pt-2 pb-1">
        <button
          onClick={() => setShowCloseDialog(true)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <XMarkIcon className="w-6 h-6 text-gray-600" />
        </button>
      </div>

      {/* Intensités planifiée / réelle */}
      {(intensitePlanifiee || intensiteReelle) && (
        <div className="px-2.5 pb-2">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex gap-4">
            {intensitePlanifiee && (
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-1">Intensité planifiée</p>
                <p className="text-lg font-bold text-blue-600">{intensitePlanifiee}/10</p>
              </div>
            )}
            {intensiteReelle && (
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-500 mb-1">Intensité réelle</p>
                <p className={`text-lg font-bold ${intensiteReelle >= 8 ? 'text-red-500' : intensiteReelle >= 4 ? 'text-orange-500' : 'text-green-600'}`}>
                  {intensiteReelle}/10
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dernier CR (admin uniquement) */}
      {isAdmin && lastCr && (
        <div className="px-2.5 pb-2">
          <div className="bg-amber-50 rounded-xl border border-amber-200 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-amber-700">Dernier CR ({lastCr.date})</p>
            {lastCr.cr && <p className="text-sm text-gray-700">{lastCr.cr}</p>}
            {lastCr.comment && <p className="text-sm text-gray-600 italic">{lastCr.comment}</p>}
          </div>
        </div>
      )}

      <div className="px-2.5 pb-6">
        <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 pt-2 pb-8 space-y-5">

            {/* Tour heading */}
            <div className="flex justify-center pt-2">
              <p className="text-lg font-bold text-gray-800">Tour {tour}</p>
            </div>

            {/* Video (if available) */}
            {exercice?.video_exercice && (
              <video
                src={exercice.video_exercice}
                autoPlay
                loop
                controls
                playsInline
                className="w-full rounded-xl max-h-52 object-cover"
              />
            )}

            {/* Divider */}
            <hr className="border-gray-200" />

            {/* Exercise name + image + explications */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-lg font-bold text-gray-800 text-center max-w-xs">
                {exercice?.nom_exercice || 'Exercice'}
              </p>

              <div className="rounded-xl overflow-hidden">
                <img
                  src={exercice?.image_exercice || 'https://storage.googleapis.com/flutterflow-io-6f20.appspot.com/projects/t-c-connect-palw1q/assets/ddevbvo7hyl4/Logo_2_-_Copie.PNG'}
                  alt={exercice?.nom_exercice}
                  className="w-48 h-48 object-cover"
                />
              </div>

              <p className="text-sm font-semibold underline text-gray-700 text-center mt-1">
                Explications :
              </p>
              <p className="text-sm text-gray-600 text-center max-w-xs">
                {progItem.explication_exercice || "Pas d'explications"}
              </p>
            </div>

            {/* Effort timer */}
            <TimerRow label="Effort :" timer={effortT} />

            {/* Recovery timer */}
            <TimerRow
              label={isLastExo ? 'Récupération Tours :' : 'Récupération :'}
              timer={recupT}
            />

            {/* Tempo */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
              <div className="flex justify-center items-center gap-3">
                <p className="text-base font-semibold text-gray-700">Tempo :</p>
                <p className="text-base font-semibold text-gray-700">
                  {progItem.tempo_phase1 ?? 0}-{progItem.tempo_phase2 ?? 0}-{progItem.tempo_phase3 ?? 0}-{progItem.tempo_phase4 ?? 0}
                </p>
              </div>
            </div>

            {/* Charge */}
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 text-center">Charge (kg)</p>
              <div className="grid grid-cols-3 items-center gap-2">
                <button
                  onClick={() => setCharge(p => String(Math.max(0, (parseFloat(p) || 0) - 0.25)))}
                  className="h-12 rounded-xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
                >−</button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={charge}
                  onChange={e => setCharge(e.target.value)}
                  step="0.25"
                  className="text-center text-2xl font-bold text-gray-800 border-0 focus:outline-none bg-transparent py-2 min-w-0 w-full"
                />
                <button
                  onClick={() => setCharge(p => String((parseFloat(p) || 0) + 0.25))}
                  className="h-12 rounded-xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center hover:bg-gray-200 transition"
                >+</button>
              </div>
            </div>

            {/* Notes */}
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notes"
              rows={3}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-600 resize-none"
            />

            {/* Suivant */}
            <div className="flex justify-center pt-1">
              <button
                onClick={handleSuivant}
                disabled={saving}
                className="bg-gray-600 hover:bg-gray-700 disabled:opacity-60 text-white px-10 py-2.5 rounded-lg text-sm font-semibold transition min-w-[120px] flex items-center justify-center gap-2"
              >
                {saving && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Suivant
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Close confirm dialog */}
      {showCloseDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Quitter le circuit ?</h3>
            <p className="text-sm text-gray-600 mb-6">
              Êtes-vous sûr de vouloir quitter le circuit ? Cela notera le circuit comme effectuée.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={() => handleClose(true)}
                className="px-4 py-2 text-sm text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-secondary text-white text-sm px-4 py-2.5 rounded-xl shadow-lg max-w-xs text-center pointer-events-none">
          {toast}
        </div>
      )}

    </div>
  )
}
