'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { submitHooper, submitRPE } from '@/lib/seanceEquipeService'
import type { SeanceEquipe } from '@/types'

// ─── Labels RPE ──────────────────────────────────────────────────────────────
const RPE_LABELS: Record<number, string> = {
  1: 'Repos',
  2: 'Très facile',
  3: 'Facile',
  4: 'Plutôt facile',
  5: 'Modéré',
  6: 'Un peu dur',
  7: 'Dur',
  8: 'Très dur',
  9: 'Extrêmement dur',
  10: 'Maximal',
}

const RPE_COLORS: Record<number, string> = {
  1: '#22c55e',
  2: '#4ade80',
  3: '#86efac',
  4: '#a3e635',
  5: '#facc15',
  6: '#fb923c',
  7: '#f97316',
  8: '#ef4444',
  9: '#dc2626',
  10: '#7f1d1d',
}

// ─── Slider custom ────────────────────────────────────────────────────────────
function StyledSlider({
  min, max, value, onChange, color,
}: {
  min: number; max: number; value: number; onChange: (v: number) => void; color?: string
}) {
  return (
    <div className="relative w-full">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color ?? '#2563eb'} 0%, ${color ?? '#2563eb'} ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`,
          accentColor: color ?? '#2563eb',
        }}
      />
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((v) => (
          <span key={v} className={v === value ? 'font-bold text-gray-700' : ''}>{v}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Mode Hooper ─────────────────────────────────────────────────────────────
function HooperForm({
  seanceId,
  joueurId,
  joueurNom,
  onDone,
}: {
  seanceId: string
  joueurId: string
  joueurNom: string
  onDone: () => void
}) {
  const [sommeil, setSommeil] = useState(4)
  const [fatigue, setFatigue] = useState(4)
  const [courbatures, setCourbatures] = useState(4)
  const [stress, setStress] = useState(4)
  const [submitting, setSubmitting] = useState(false)

  const indiceHooper = sommeil + fatigue + courbatures + stress

  const getHooperColor = () => {
    if (indiceHooper <= 12) return '#22c55e'
    if (indiceHooper <= 18) return '#facc15'
    if (indiceHooper <= 22) return '#f97316'
    return '#ef4444'
  }

  const getHooperLabel = () => {
    if (indiceHooper <= 12) return 'Excellent état'
    if (indiceHooper <= 18) return 'État correct'
    if (indiceHooper <= 22) return 'État limite'
    return 'État dégradé'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitHooper(seanceId, joueurId, {
        sommeil,
        fatigue,
        courbatures,
        stress,
        indiceHooper,
      })
      onDone()
    } catch (err: any) {
      alert(`Erreur : ${err?.message ?? 'inconnue'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {joueurNom && (
        <p className="text-center text-sm font-medium text-gray-600">
          Questionnaire pour <span className="text-blue-600 font-semibold">{joueurNom}</span>
        </p>
      )}

      {/* Indice en temps réel */}
      <div
        className="rounded-2xl p-5 text-center text-white shadow-sm"
        style={{ backgroundColor: getHooperColor() }}
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-80 mb-1">Indice Hooper</p>
        <p className="text-5xl font-bold">{indiceHooper}</p>
        <p className="text-sm font-medium mt-1 opacity-90">{getHooperLabel()}</p>
        <p className="text-xs opacity-70 mt-1">sur 28 — plus bas = meilleur état</p>
      </div>

      {/* Sommeil */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Qualité du sommeil</h3>
        <p className="text-xs text-gray-500 mb-4">1 = très mauvais · 7 = excellent</p>
        <StyledSlider min={1} max={7} value={sommeil} onChange={setSommeil} color="#6366f1" />
        <p className="text-center text-sm font-semibold text-indigo-600 mt-2">
          {sommeil} — {sommeil <= 2 ? 'Très mauvais' : sommeil <= 3 ? 'Mauvais' : sommeil <= 4 ? 'Moyen' : sommeil <= 5 ? 'Bien' : sommeil <= 6 ? 'Très bien' : 'Excellent'}
        </p>
      </div>

      {/* Fatigue */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Niveau de fatigue</h3>
        <p className="text-xs text-gray-500 mb-4">1 = pas fatigué · 7 = épuisé</p>
        <StyledSlider min={1} max={7} value={fatigue} onChange={setFatigue} color="#f97316" />
        <p className="text-center text-sm font-semibold text-orange-600 mt-2">
          {fatigue} — {fatigue <= 2 ? 'Pas fatigué' : fatigue <= 3 ? 'Légèrement' : fatigue <= 4 ? 'Modéré' : fatigue <= 5 ? 'Fatigué' : fatigue <= 6 ? 'Très fatigué' : 'Épuisé'}
        </p>
      </div>

      {/* Courbatures */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Douleurs / courbatures</h3>
        <p className="text-xs text-gray-500 mb-4">1 = aucune · 7 = très douloureuses</p>
        <StyledSlider min={1} max={7} value={courbatures} onChange={setCourbatures} color="#ef4444" />
        <p className="text-center text-sm font-semibold text-red-600 mt-2">
          {courbatures} — {courbatures <= 2 ? 'Aucune' : courbatures <= 3 ? 'Légères' : courbatures <= 4 ? 'Modérées' : courbatures <= 5 ? 'Importantes' : courbatures <= 6 ? 'Sévères' : 'Très sévères'}
        </p>
      </div>

      {/* Stress */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Niveau de stress</h3>
        <p className="text-xs text-gray-500 mb-4">1 = aucun stress · 7 = très stressé</p>
        <StyledSlider min={1} max={7} value={stress} onChange={setStress} color="#8b5cf6" />
        <p className="text-center text-sm font-semibold text-purple-600 mt-2">
          {stress} — {stress <= 2 ? 'Aucun' : stress <= 3 ? 'Léger' : stress <= 4 ? 'Modéré' : stress <= 5 ? 'Élevé' : stress <= 6 ? 'Très élevé' : 'Extrême'}
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
      >
        {submitting ? 'Envoi...' : 'Envoyer mon état de forme'}
      </button>
    </form>
  )
}

// ─── Mode RPE ─────────────────────────────────────────────────────────────────
function RPEForm({
  seanceId,
  joueurId,
  joueurNom,
  dureeDefault,
  onDone,
}: {
  seanceId: string
  joueurId: string
  joueurNom: string
  dureeDefault: number
  onDone: () => void
}) {
  const [rpe, setRpe] = useState(5)
  const [dureeMin, setDureeMin] = useState(dureeDefault)
  const [submitting, setSubmitting] = useState(false)

  const charge = rpe * dureeMin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitRPE(seanceId, joueurId, { rpe, dureeMin, charge })
      onDone()
    } catch (err: any) {
      alert(`Erreur : ${err?.message ?? 'inconnue'}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {joueurNom && (
        <p className="text-center text-sm font-medium text-gray-600">
          Bilan séance pour <span className="text-blue-600 font-semibold">{joueurNom}</span>
        </p>
      )}

      {/* Charge temps réel */}
      <div
        className="rounded-2xl p-5 text-center text-white shadow-sm"
        style={{ backgroundColor: RPE_COLORS[rpe] ?? '#2563eb' }}
      >
        <p className="text-xs font-medium uppercase tracking-wide opacity-80 mb-1">Charge d'entraînement</p>
        <p className="text-5xl font-bold">{charge}</p>
        <p className="text-sm font-medium mt-1 opacity-90">UA (unités arbitraires)</p>
        <p className="text-xs opacity-70 mt-1">RPE {rpe} × {dureeMin} min</p>
      </div>

      {/* RPE slider */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Intensité perçue (RPE)</h3>
        <p className="text-xs text-gray-500 mb-4">Comment avez-vous ressenti l'effort ?</p>

        <div className="space-y-2 mb-4">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setRpe(v)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition border ${
                rpe === v
                  ? 'text-white border-transparent font-semibold'
                  : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
              }`}
              style={rpe === v ? { backgroundColor: RPE_COLORS[v] } : {}}
            >
              <span className="font-bold">{v}</span> — {RPE_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Durée */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-1">Durée de la séance</h3>
        <p className="text-xs text-gray-500 mb-3">En minutes</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={600}
            value={dureeMin}
            onChange={(e) => setDureeMin(Number(e.target.value))}
            className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-semibold"
          />
          <span className="text-sm text-gray-500">minutes</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
      >
        {submitting ? 'Envoi...' : 'Envoyer mon bilan'}
      </button>
    </form>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function QuestionnaireEquipePage() {
  const params = useParams<{ seanceId: string }>()
  const searchParams = useSearchParams()
  const seanceId = params.seanceId
  const mode = searchParams.get('mode') ?? 'hooper'
  const joueurId = searchParams.get('j') ?? ''

  const [seance, setSeance] = useState<SeanceEquipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [joueurNom, setJoueurNom] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await getDoc(doc(db, 'seances_equipe', seanceId))
        if (snap.exists()) {
          setSeance({ id: snap.id, ...snap.data() } as SeanceEquipe)
        }
        if (joueurId) {
          const jSnap = await getDoc(doc(db, 'joueurs', joueurId))
          if (jSnap.exists()) {
            const jData = jSnap.data()
            setJoueurNom(`${jData.prenom_joueur ?? ''} ${jData.nom_joueur ?? ''}`.trim())
          }
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [seanceId, joueurId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!seance) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Séance introuvable.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Merci !</h2>
          <p className="text-gray-500 text-sm">
            {mode === 'hooper'
              ? 'Votre état de forme a bien été enregistré.'
              : 'Votre bilan RPE a bien été enregistré.'}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Séance : {seance.type} — {seance.date?.toDate?.()?.toLocaleDateString('fr-FR')}
          </p>
        </div>
      </div>
    )
  }

  // If mode=hooper or mode=rpe but no joueurId, show a selector
  if (!joueurId) {
    const joueurIds = seance.joueurIds ?? []
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-blue-600">TC Connect</h1>
            <h2 className="text-lg font-semibold text-gray-800 mt-2">
              {mode === 'hooper' ? 'État de forme' : 'Bilan RPE'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {seance.type} — {seance.date?.toDate?.()?.toLocaleDateString('fr-FR')}
              {seance.heureDebut ? ` à ${seance.heureDebut}` : ''}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm font-medium text-gray-700 mb-3">Sélectionnez votre nom :</p>
            <div className="space-y-2">
              {joueurIds.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Aucun joueur dans cette séance</p>
              )}
              {joueurIds.map((jid) => (
                <a
                  key={jid}
                  href={`/questionnaire-equipe/${seanceId}?mode=${mode}&j=${jid}`}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                    {jid.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{jid}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const seanceFmt = `${seance.type} — ${seance.date?.toDate?.()?.toLocaleDateString('fr-FR')}${seance.heureDebut ? ` à ${seance.heureDebut}` : ''}`

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* En-tête */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-blue-600">TC Connect</h1>
          <h2 className="text-lg font-semibold text-gray-800 mt-2">
            {mode === 'hooper' ? 'État de forme' : 'Bilan RPE'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{seanceFmt}</p>
        </div>

        {mode === 'hooper' ? (
          <HooperForm
            seanceId={seanceId}
            joueurId={joueurId}
            joueurNom={joueurNom}
            onDone={() => setSubmitted(true)}
          />
        ) : (
          <RPEForm
            seanceId={seanceId}
            joueurId={joueurId}
            joueurNom={joueurNom}
            dureeDefault={seance.dureeMin ?? 90}
            onDone={() => setSubmitted(true)}
          />
        )}
      </div>
    </div>
  )
}
