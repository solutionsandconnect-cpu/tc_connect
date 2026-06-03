'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { useTeams } from '@/hooks/useTeams'
import { StoreGate } from '@/components/ui/StoreGate'
import { useJoueurs } from '@/hooks/useJoueurs'
import { useSeancesEquipe } from '@/hooks/useSeancesEquipe'
import {
  createSeanceEquipe,
  updateSeanceEquipe,
  deleteSeanceEquipe,
  submitHooper,
  submitRPE,
} from '@/lib/seanceEquipeService'
import Modal from '@/components/ui/Modal'
import {
  ArrowLeftIcon,
  PlusIcon,
  ChartBarIcon,
  CalendarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  PencilIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import type { SeanceEquipe } from '@/types'

const TYPES_SEANCE: SeanceEquipe['type'][] = [
  'Entraînement', 'Match', 'Physique', 'Technique', 'Tactique', 'Récupération',
]

const STATUT_COLORS: Record<SeanceEquipe['statut'], string> = {
  planifiée: 'bg-blue-50 text-blue-700 border-blue-200',
  terminée: 'bg-green-50 text-green-700 border-green-200',
  annulée: 'bg-red-50 text-red-600 border-red-200',
}

// ─── Calculs de charge ────────────────────────────────────────────────────────

interface ChargeJoueur {
  joueurId: string
  chargeAigue: number       // moyenne 7j
  chargeChronique: number   // moyenne 28j
  acwr: number | null
  monotonie: number
  contrainte: number
  charges7j: number[]       // array of 7 daily values (day 0 = today)
  charges28j: number[]      // array of 28 daily values
}

function computeCharges(
  seances: SeanceEquipe[],
  joueurIds: string[],
): ChargeJoueur[] {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Build a map: joueurId → { dateStr → totalCharge }
  const chargeMap: Record<string, Record<string, number>> = {}
  for (const jid of joueurIds) chargeMap[jid] = {}

  for (const seance of seances) {
    if (seance.statut === 'annulée') continue
    const seanceDate = seance.date?.toDate?.()
    if (!seanceDate) continue
    const dateStr = `${seanceDate.getFullYear()}-${seanceDate.getMonth()}-${seanceDate.getDate()}`
    for (const [jid, rpe] of Object.entries(seance.rpes ?? {})) {
      if (!chargeMap[jid]) continue
      chargeMap[jid][dateStr] = (chargeMap[jid][dateStr] ?? 0) + rpe.charge
    }
  }

  return joueurIds.map((jid) => {
    const dayCharges = chargeMap[jid] ?? {}

    const charges28j: number[] = []
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      charges28j.push(dayCharges[key] ?? 0)
    }
    const charges7j = charges28j.slice(21) // last 7 days

    const chargeAigue = charges7j.reduce((a, b) => a + b, 0) / 7
    const chargeChronique = charges28j.reduce((a, b) => a + b, 0) / 28

    const acwr = chargeChronique > 0 ? chargeAigue / chargeChronique : null

    // Monotonie = moyenne 7j / écart-type 7j
    const mean7 = chargeAigue
    const variance = charges7j.reduce((s, v) => s + (v - mean7) ** 2, 0) / 7
    const sd = Math.sqrt(variance)
    const monotonie = sd > 0 ? mean7 / sd : 1

    const contrainte = chargeAigue * 7 * monotonie

    return {
      joueurId: jid,
      chargeAigue,
      chargeChronique,
      acwr,
      monotonie,
      contrainte,
      charges7j,
      charges28j,
    }
  })
}

// ─── SVG Sparkline ACWR ───────────────────────────────────────────────────────
function ACWRSparkline({ seances, joueurId }: { seances: SeanceEquipe[]; joueurId: string }) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  // Compute weekly ACWR for last 4 weeks
  const points: number[] = []
  for (let w = 3; w >= 0; w--) {
    const dayCharges: number[] = []
    for (let d = 27 - w * 7; d <= 27 - w * 7 + 6 && d < 28; d++) {
      const day = new Date(today)
      day.setDate(day.getDate() - (27 - d))
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
      let c = 0
      for (const s of seances) {
        if (s.statut === 'annulée') continue
        const sd = s.date?.toDate?.()
        if (!sd) continue
        const sk = `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}`
        if (sk === key) c += (s.rpes?.[joueurId]?.charge ?? 0)
      }
      dayCharges.push(c)
    }
    const acute = dayCharges.reduce((a, b) => a + b, 0) / 7

    // Chronic: full 28-day window ending at the week's last day
    const chronicDays: number[] = []
    const endDay = 27 - w * 7 + 6
    for (let d = Math.max(0, endDay - 27); d <= endDay && d < 28; d++) {
      const day = new Date(today)
      day.setDate(day.getDate() - (27 - d))
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`
      let c = 0
      for (const s of seances) {
        if (s.statut === 'annulée') continue
        const sd = s.date?.toDate?.()
        if (!sd) continue
        const sk = `${sd.getFullYear()}-${sd.getMonth()}-${sd.getDate()}`
        if (sk === key) c += (s.rpes?.[joueurId]?.charge ?? 0)
      }
      chronicDays.push(c)
    }
    const chronic = chronicDays.length > 0
      ? chronicDays.reduce((a, b) => a + b, 0) / chronicDays.length
      : 0
    points.push(chronic > 0 ? acute / chronic : 0)
  }

  const W = 80, H = 32
  const maxVal = 2
  const toY = (v: number) => H - (v / maxVal) * H

  const pathD = points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / 3) * W} ${toY(v)}`)
    .join(' ')

  return (
    <svg width={W} height={H} className="overflow-visible">
      {/* Zone verte 0.8-1.3 */}
      <rect
        x={0} y={toY(1.3)} width={W} height={toY(0.8) - toY(1.3)}
        fill="#22c55e" opacity={0.15}
      />
      {/* Zone rouge > 1.5 */}
      <rect
        x={0} y={0} width={W} height={toY(1.5)}
        fill="#ef4444" opacity={0.1}
      />
      <path d={pathD} fill="none" stroke="#2563eb" strokeWidth={1.5} strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle
          key={i}
          cx={(i / 3) * W}
          cy={toY(v)}
          r={2.5}
          fill={v > 1.5 ? '#ef4444' : v >= 0.8 ? '#22c55e' : '#3b82f6'}
        />
      ))}
    </svg>
  )
}

// ─── SVG Barres charge 28j ────────────────────────────────────────────────────
function ChargeBarChart({ charges28j }: { charges28j: number[] }) {
  const W = 280, H = 60
  const max = Math.max(...charges28j, 1)
  const barW = W / 28 - 1

  return (
    <svg width={W} height={H}>
      {charges28j.map((v, i) => {
        const h = (v / max) * H
        const isHigh = v > max * 0.75
        return (
          <rect
            key={i}
            x={i * (W / 28)}
            y={H - h}
            width={barW}
            height={h}
            fill={isHigh ? '#ef4444' : '#2563eb'}
            opacity={0.7}
            rx={1}
          />
        )
      })}
    </svg>
  )
}

// ─── Badge ACWR ───────────────────────────────────────────────────────────────
function ACWRBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400">—</span>
  const v = value.toFixed(2)
  if (value < 0.8) return <span className="font-semibold text-blue-600">{v}</span>
  if (value <= 1.3) return <span className="font-semibold text-green-600">{v}</span>
  if (value <= 1.5) return <span className="font-semibold text-orange-500">{v}</span>
  return <span className="font-semibold text-red-600">{v}</span>
}

// ─── Alert badge ──────────────────────────────────────────────────────────────
function AlertBadge({ acwr }: { acwr: number | null }) {
  if (acwr === null) return <span className="text-xs text-gray-400">—</span>
  if (acwr > 1.5) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">Risque</span>
  if (acwr > 1.3) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">Attention</span>
  if (acwr >= 0.8) return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">Optimal</span>
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">Sous-charge</span>
}

// ─── Saisie directe RPE + Hooper par joueur ─────────────────────────────────────
const RPE_LABELS: Record<number, string> = {
  1: 'Repos', 2: 'Très facile', 3: 'Facile', 4: 'Plutôt facile', 5: 'Modéré',
  6: 'Un peu dur', 7: 'Dur', 8: 'Très dur', 9: 'Extrêmement dur', 10: 'Maximal',
}
const RPE_COLORS: Record<number, string> = {
  1: '#22c55e', 2: '#4ade80', 3: '#86efac', 4: '#a3e635', 5: '#facc15',
  6: '#fb923c', 7: '#f97316', 8: '#ef4444', 9: '#dc2626', 10: '#7f1d1d',
}
const sommeilLabel = (v: number) => v <= 2 ? 'Très mauvais' : v <= 3 ? 'Mauvais' : v <= 4 ? 'Moyen' : v <= 5 ? 'Bien' : v <= 6 ? 'Très bien' : 'Excellent'
const fatigueLabel = (v: number) => v <= 2 ? 'Pas fatigué' : v <= 3 ? 'Légèrement' : v <= 4 ? 'Modéré' : v <= 5 ? 'Fatigué' : v <= 6 ? 'Très fatigué' : 'Épuisé'
const courbaturesLabel = (v: number) => v <= 2 ? 'Aucune' : v <= 3 ? 'Légères' : v <= 4 ? 'Modérées' : v <= 5 ? 'Importantes' : v <= 6 ? 'Sévères' : 'Très sévères'
const stressLabel = (v: number) => v <= 2 ? 'Aucun' : v <= 3 ? 'Léger' : v <= 4 ? 'Modéré' : v <= 5 ? 'Élevé' : v <= 6 ? 'Très élevé' : 'Extrême'
const hooperColor = (i: number) => i <= 12 ? '#22c55e' : i <= 18 ? '#facc15' : i <= 22 ? '#f97316' : '#ef4444'
const hooperLabel = (i: number) => i <= 12 ? 'Excellent état' : i <= 18 ? 'État correct' : i <= 22 ? 'État limite' : 'État dégradé'

function SliderMetric({ label, value, set, min, max, color, text }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number; color: string; text: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-semibold" style={{ color }}>{value} — {text}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="range-clean"
        style={{
          color,
          background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, #e5e7eb ${pct}%, #e5e7eb 100%)`,
        }}
      />
      <div className="flex justify-between mt-1 px-0.5">
        {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((v) => (
          <span key={v} className={`text-[10px] ${v === value ? 'font-bold text-gray-700' : 'text-gray-300'}`}>{v}</span>
        ))}
      </div>
    </div>
  )
}

function PlayerEntryRow({ seance, joueur }: { seance: SeanceEquipe; joueur: any }) {
  const eH = seance.hoopers?.[joueur.id]
  const eR = seance.rpes?.[joueur.id]
  const [open, setOpen] = useState(false)
  const [sommeil, setSommeil] = useState(eH?.sommeil ?? 4)
  const [fatigue, setFatigue] = useState(eH?.fatigue ?? 4)
  const [courbatures, setCourbatures] = useState(eH?.courbatures ?? 4)
  const [stress, setStress] = useState(eH?.stress ?? 4)
  const [rpe, setRpe] = useState(eR?.rpe ?? 5)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const indiceHooper = sommeil + fatigue + courbatures + stress
  const charge = rpe * seance.dureeMin
  const hasData = !!eH || !!eR

  const save = async () => {
    setSaving(true)
    try {
      await submitHooper(seance.id, joueur.id, { sommeil, fatigue, courbatures, stress, indiceHooper })
      await submitRPE(seance.id, joueur.id, { rpe, dureeMin: seance.dureeMin, charge })
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      setOpen(false)
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden bg-white">
      {/* En-tête cliquable */}
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 transition text-left">
        <span className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">
          {joueur.prenom_joueur} {joueur.nom_joueur}
        </span>
        {hasData ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: hooperColor(eH?.indiceHooper ?? indiceHooper) }}>
              H {eH?.indiceHooper ?? '—'}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: RPE_COLORS[eR?.rpe ?? 5] }}>
              RPE {eR?.rpe ?? '—'}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 shrink-0">À remplir</span>
        )}
        <ChevronDownIcon className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Corps déplié */}
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-4">
          {/* Hooper */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">État de forme — indice Hooper</p>
            <SliderMetric label="Qualité du sommeil" value={sommeil} set={setSommeil} min={1} max={7} color="#6366f1" text={sommeilLabel(sommeil)} />
            <SliderMetric label="Niveau de fatigue" value={fatigue} set={setFatigue} min={1} max={7} color="#f97316" text={fatigueLabel(fatigue)} />
            <SliderMetric label="Douleurs / courbatures" value={courbatures} set={setCourbatures} min={1} max={7} color="#ef4444" text={courbaturesLabel(courbatures)} />
            <SliderMetric label="Niveau de stress" value={stress} set={setStress} min={1} max={7} color="#8b5cf6" text={stressLabel(stress)} />
            <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: hooperColor(indiceHooper) + '1a' }}>
              <span className="text-sm font-medium text-gray-600">Indice Hooper</span>
              <span className="text-sm font-bold" style={{ color: hooperColor(indiceHooper) }}>{indiceHooper}/28 — {hooperLabel(indiceHooper)}</span>
            </div>
          </div>

          {/* RPE */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Charge — RPE × durée</p>
            <SliderMetric label="Intensité perçue (RPE)" value={rpe} set={setRpe} min={1} max={10} color={RPE_COLORS[rpe]} text={RPE_LABELS[rpe]} />
            <div className="flex items-center justify-between mt-2 px-3 py-2 rounded-lg bg-amber-50">
              <span className="text-sm font-medium text-gray-600">Charge d'entraînement</span>
              <span className="text-sm font-bold text-amber-600">{charge} UA <span className="font-normal text-gray-400">({rpe} × {seance.dureeMin} min)</span></span>
            </div>
          </div>

          <button onClick={save} disabled={saving}
            className={`w-full text-sm font-semibold py-2.5 rounded-xl transition ${saved ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white hover:bg-blue-700'} disabled:opacity-50`}>
            {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function SeancesEquipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { teams } = useTeams()
  const { joueurs } = useJoueurs(id)
  const { seances, loading } = useSeancesEquipe(id)

  const team = teams.find((t) => t.id === id)

  const [showModal, setShowModal] = useState(false)
  const [editingSeance, setEditingSeance] = useState<SeanceEquipe | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedJoueurChart, setSelectedJoueurChart] = useState<string | null>(null)
  const [entrySeanceId, setEntrySeanceId] = useState<string | null>(null)

  const emptyForm = {
    date: '',
    heureDebut: '',
    type: 'Entraînement' as SeanceEquipe['type'],
    dureeMin: 90,
    notes: '',
    joueurIds: [] as string[],
  }
  const [form, setForm] = useState(emptyForm)

  const joueursList = joueurs.filter((j) => j.type === 'Joueur')
  const allJoueurIds = joueursList.map((j) => j.id)

  const chargesData = useMemo(
    () => computeCharges(seances, allJoueurIds),
    [seances, allJoueurIds],
  )

  const chartJoueur = chargesData.find((c) => c.joueurId === selectedJoueurChart)

  const toggleJoueur = (jid: string) => {
    setForm((f) => ({
      ...f,
      joueurIds: f.joueurIds.includes(jid)
        ? f.joueurIds.filter((x) => x !== jid)
        : [...f.joueurIds, jid],
    }))
  }

  const openEditSeance = (seance: SeanceEquipe) => {
    setEditingSeance(seance)
    const d = seance.date?.toDate?.()
    setForm({
      date: d ? d.toISOString().split('T')[0] : '',
      heureDebut: seance.heureDebut || '',
      type: seance.type,
      dureeMin: seance.dureeMin,
      notes: seance.notes || '',
      joueurIds: seance.joueurIds || [],
    })
    setShowModal(true)
  }

  const handleSubmitSeance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date) return
    const dateObj = new Date(form.date + 'T12:00:00')
    const updates = {
      date: Timestamp.fromDate(dateObj),
      heureDebut: form.heureDebut || '',
      type: form.type,
      dureeMin: Number(form.dureeMin),
      notes: form.notes || '',
      joueurIds: form.joueurIds,
    }
    if (editingSeance) {
      await updateSeanceEquipe(editingSeance.id, updates)
    } else {
      await createSeanceEquipe({
        ...updates,
        teamId: id,
        statut: 'planifiée',
        hoopers: {},
        rpes: {},
        createdAt: Timestamp.now(),
      })
    }
    setShowModal(false)
    setEditingSeance(null)
    setForm(emptyForm)
  }

  const handleStatut = async (seanceId: string, statut: SeanceEquipe['statut']) => {
    await updateSeanceEquipe(seanceId, { statut })
  }

  const handleDelete = async (seanceId: string) => {
    await deleteSeanceEquipe(seanceId)
    setDeletingId(null)
  }

  const getJoueurName = (jid: string) => {
    const j = joueurs.find((x) => x.id === jid)
    return j ? `${j.prenom_joueur} ${j.nom_joueur}` : jid
  }

  const fmtDate = (ts: Timestamp) => {
    const d = ts.toDate()
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <StoreGate appRoute="/equipes" showPin={false}>
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/equipes/${id}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">Charges d&apos;entraînement</h1>
          <p className="text-sm text-gray-500 truncate">{team?.nom_equipe}</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm); setShowModal(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 sm:px-4 py-2 rounded-lg transition shrink-0"
        >
          <PlusIcon className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">Nouvelle séance</span>
          <span className="sm:hidden">Séance</span>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* ── Colonne gauche : Planning ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" /> Planning des séances ({seances.length})
            </h2>

            {seances.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
                <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucune séance planifiée</p>
              </div>
            ) : (
              seances.map((s) => {
                const hooperCount = Object.keys(s.hoopers ?? {}).length
                const rpeCount = Object.keys(s.rpes ?? {}).length
                const total = s.joueurIds?.length ?? 0

                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3"
                  >
                    {/* Header séance */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">{s.type}</span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUT_COLORS[s.statut]}`}
                          >
                            {s.statut}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3.5 h-3.5" />
                            {fmtDate(s.date)}
                          </span>
                          {s.heureDebut && (
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3.5 h-3.5" />
                              {s.heureDebut}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <ClockIcon className="w-3.5 h-3.5" />
                            {s.dureeMin} min
                          </span>
                          <span className="flex items-center gap-1">
                            <UserGroupIcon className="w-3.5 h-3.5" />
                            {total} joueur{total > 1 ? 's' : ''}
                          </span>
                        </div>
                        {s.notes && (
                          <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditSeance(s) }}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition"
                          title="Modifier"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(s.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                          title="Supprimer"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Réponses reçues */}
                    <div className="flex gap-4 text-xs">
                      <span className={`font-medium ${hooperCount >= total && total > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        Hooper : {hooperCount}/{total}
                      </span>
                      <span className={`font-medium ${rpeCount >= total && total > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        RPE : {rpeCount}/{total}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {s.statut === 'planifiée' && (
                        <>
                          <a
                            href={`/questionnaire-equipe/${s.id}?mode=hooper`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                          >
                            Lien Hooper
                          </a>
                          <a
                            href={`/questionnaire-equipe/${s.id}?mode=rpe`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition"
                          >
                            Lien RPE
                          </a>
                          <button
                            onClick={() => handleStatut(s.id, 'terminée')}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition"
                          >
                            <CheckCircleIcon className="w-3.5 h-3.5" />
                            Terminée
                          </button>
                          <button
                            onClick={() => handleStatut(s.id, 'annulée')}
                            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition"
                          >
                            <XCircleIcon className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        </>
                      )}
                      {s.statut !== 'planifiée' && (
                        <button
                          onClick={() => handleStatut(s.id, 'planifiée')}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition"
                        >
                          Repasser en planifiée
                        </button>
                      )}
                      {total > 0 && (
                        <button
                          onClick={() => setEntrySeanceId((prev) => (prev === s.id ? null : s.id))}
                          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${entrySeanceId === s.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'}`}
                        >
                          <PencilIcon className="w-3.5 h-3.5" />
                          {entrySeanceId === s.id ? 'Fermer la saisie' : 'Saisir RPE / Hooper'}
                        </button>
                      )}
                    </div>

                    {/* Saisie directe RPE + Hooper par joueur */}
                    {entrySeanceId === s.id && (
                      <div className="border-t border-gray-100 pt-3 space-y-2 bg-gray-50/50 -mx-4 px-4 pb-1">
                        <p className="text-[11px] text-gray-400 px-1">
                          Touchez un joueur pour saisir son <strong>état de forme (Hooper)</strong> et son <strong>RPE</strong>.
                        </p>
                        {joueurs
                          .filter((j) => (s.joueurIds ?? []).includes(j.id))
                          .map((j) => <PlayerEntryRow key={j.id} seance={s} joueur={j} />)}
                        {(s.joueurIds ?? []).length === 0 && (
                          <p className="text-xs text-gray-400 py-2">Aucun joueur associé à cette séance.</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </section>

          {/* ── Colonne droite : Tableau de charges ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4" /> Charges par joueur
            </h2>

            {joueursList.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-sm">
                Aucun joueur dans l'équipe
              </div>
            ) : (
              <>
                {/* Tableau */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 text-left">
                        <th className="px-3 py-2 font-medium">Nom</th>
                        <th className="px-3 py-2 font-medium text-right">Aiguë</th>
                        <th className="px-3 py-2 font-medium text-right">Chron.</th>
                        <th className="px-3 py-2 font-medium text-right">ACWR</th>
                        <th className="px-3 py-2 font-medium text-right">Mono.</th>
                        <th className="px-3 py-2 font-medium text-right">Contrainte</th>
                        <th className="px-3 py-2 font-medium text-center">Alerte</th>
                        <th className="px-3 py-2 font-medium text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chargesData.map((c) => {
                        const j = joueurs.find((x) => x.id === c.joueurId)
                        if (!j) return null
                        return (
                          <tr
                            key={c.joueurId}
                            onClick={() =>
                              setSelectedJoueurChart(
                                selectedJoueurChart === c.joueurId ? null : c.joueurId,
                              )
                            }
                            className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition"
                          >
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                              {j.prenom_joueur} {j.nom_joueur}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {c.chargeAigue.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {c.chargeChronique.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <ACWRBadge value={c.acwr} />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {c.monotonie.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {c.contrainte.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <AlertBadge acwr={c.acwr} />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <ACWRSparkline seances={seances} joueurId={c.joueurId} />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Graphique détail joueur */}
                {selectedJoueurChart && chartJoueur && (
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Charge 28 jours — {getJoueurName(selectedJoueurChart)}
                    </h3>
                    <ChargeBarChart charges28j={chartJoueur.charges28j} />
                    <p className="text-xs text-gray-400 mt-2">J-28 → aujourd'hui. Rouge = charge supérieure à 75% du max.</p>
                  </div>
                )}

                {/* Légende */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Légende ACWR</h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> {'<'} 0.8 : Sous-charge</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> 0.8–1.3 : Optimal</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" /> 1.3–1.5 : Attention</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> {'>'} 1.5 : Risque élevé</span>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* Modal création séance */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingSeance(null); setForm(emptyForm) }}
        title={editingSeance ? 'Modifier la séance' : 'Nouvelle séance'}
        size="lg"
      >
        <form onSubmit={handleSubmitSeance} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure de début</label>
              <input
                type="time"
                value={form.heureDebut}
                onChange={(e) => setForm({ ...form, heureDebut: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as SeanceEquipe['type'] })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TYPES_SEANCE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (min)</label>
              <input
                type="number"
                min={1}
                max={600}
                required
                value={form.dureeMin}
                onChange={(e) => setForm({ ...form, dureeMin: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Optionnel..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Joueurs participants ({form.joueurIds.length}/{joueursList.length})
            </label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, joueurIds: joueursList.map((j) => j.id) })}
                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition"
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, joueurIds: [] })}
                className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition"
              >
                Aucun
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {joueursList.map((j) => (
                <label
                  key={j.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={form.joueurIds.includes(j.id)}
                    onChange={() => toggleJoueur(j.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm text-gray-700 truncate">
                    {j.prenom_joueur} {j.nom_joueur}
                  </span>
                </label>
              ))}
              {joueursList.length === 0 && (
                <p className="text-sm text-gray-400 col-span-2 text-center py-2">Aucun joueur dans l'équipe</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              {editingSeance ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression séance */}
      <Modal
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Supprimer cette séance ?"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">Toutes les données Hooper et RPE associées seront perdues.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setDeletingId(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => deletingId && handleDelete(deletingId)}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
    </StoreGate>
  )
}
