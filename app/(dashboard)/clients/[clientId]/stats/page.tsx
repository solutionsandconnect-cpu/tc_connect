'use client'

import { use, useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where, doc, getDoc, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { ArrowLeftIcon, ExclamationTriangleIcon, ExclamationCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PainPoint { zone: string; intensite: number; type?: string }

interface StatPoint {
  date: Date
  label: string
  indiceHooper?: number
  qualiteSommeil?: number
  niveauFatigue?: number
  niveauCourbatures?: number
  quantiteStress?: number
  motivationAvant?: number
  activite?: number
  alimentation?: number
  douleurs: PainPoint[]
  rpePlanifie?: number
  rpeRessenti?: number
  intensiteMise?: number
  durationMin?: number
  chargePlanifiee?: number
  chargeReelle?: number
}

interface LoadPoint extends StatPoint {
  monotony: number
  strain: number
  acwr: number
}

// ─── Maths ───────────────────────────────────────────────────────────────────

const mean  = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const stddev= (arr: number[]) => {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length)
}
function computeLoadStats(pts: StatPoint[]): LoadPoint[] {
  return pts.map((p, i) => {
    const w7  = pts.slice(Math.max(0, i - 6), i + 1).map((x) => x.chargeReelle ?? 0)
    const w28 = pts.slice(Math.max(0, i - 27), i + 1).map((x) => x.chargeReelle ?? 0)
    const avg7 = mean(w7), avg28 = mean(w28)
    const mono = stddev(w7) > 0 ? avg7 / stddev(w7) : 0
    const acwr = avg28 > 0 ? avg7 / avg28 : 0
    return { ...p, monotony: +mono.toFixed(2), strain: +(avg7 * mono).toFixed(0), acwr: +acwr.toFixed(2) }
  })
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const hooColor  = (v: number) => v <= 12 ? '#16a34a' : v <= 18 ? '#d97706' : '#dc2626'
const rpeColor  = (v: number) => v <= 3 ? '#16a34a' : v <= 7 ? '#d97706' : '#dc2626'
const sc5Color  = (v: number) => v <= 2 ? '#dc2626' : v === 3 ? '#d97706' : '#16a34a'
const acwrColor = (v: number) => (v < 0.8 || v > 1.5) ? '#dc2626' : v > 1.3 ? '#d97706' : '#16a34a'

// ─── Period picker ────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '1m', days: 30 },
  { label: '3m', days: 90 },
  { label: '6m', days: 180 },
  { label: '1a', days: 365 },
  { label: 'Tout', days: 0 },
]

function PeriodPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {PERIOD_OPTIONS.map((o) => (
        <button key={o.label} onClick={(e) => { e.stopPropagation(); onChange(o.days) }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition ${value === o.days ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function usePeriodFilter(pts: StatPoint[], days: number) {
  return useMemo(() => {
    if (!days) return pts
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return pts.filter((p) => p.date >= cutoff)
  }, [pts, days])
}

// ─── Series toggle hook ───────────────────────────────────────────────────────

function useSeriesToggle() {
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const toggle = useCallback((key: string) =>
    setHidden((prev) => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next }), [])
  return { hidden, toggle }
}

// ─── Charts ───────────────────────────────────────────────────────────────────

interface Series { key?: string; values: number[]; color: string }

function LineChart({ series, labels, yMin = 0, vbH = 160, refLines, hidden }:
  { series: Series[]; labels: string[]; yMin?: number; vbH?: number; refLines?: { y: number; color: string; dash?: boolean }[]; hidden?: Set<string> }) {
  const visible = hidden ? series.filter((s) => !s.key || !hidden.has(s.key)) : series
  const n = labels.length
  if (n < 2 || !visible.length) return <p className="text-xs text-gray-400 text-center py-4">Aucune série visible — cliquez sur la légende pour réactiver.</p>
  const W = 600, H = vbH, PL = 20, PR = 8, PT = 12, PB = 24
  const allVals = visible.flatMap((s) => s.values).concat(refLines?.map((r) => r.y) ?? []).filter((v) => !isNaN(v))
  const yMax = Math.max(...allVals, yMin + 1)
  const xOf = (i: number) => PL + (i / Math.max(n - 1, 1)) * (W - PL - PR)
  const yOf = (v: number) => PT + (1 - (v - yMin) / (yMax - yMin)) * (H - PT - PB)
  const yVals = [yMin, yMin + (yMax - yMin) / 2, yMax]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((t) => {
        const y = yOf(yMin + t * (yMax - yMin))
        return <line key={t} x1={PL} x2={W - PR} y1={y} y2={y} stroke="#f1f5f9" strokeWidth="1" />
      })}
      {yVals.map((v) => (
        <text key={v} x={PL - 3} y={yOf(v) + 3} textAnchor="end" fontSize="9" fill="#cbd5e1">{Math.round(v)}</text>
      ))}
      {refLines?.map((r, ri) => (
        <line key={ri} x1={PL} x2={W - PR} y1={yOf(r.y)} y2={yOf(r.y)} stroke={r.color} strokeWidth="1.5" strokeDasharray={r.dash ? '5 4' : undefined} opacity="0.7" />
      ))}
      {visible.map((s, si) => {
        const d = s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ')
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {s.values.map((v, i) => <circle key={i} cx={xOf(i)} cy={yOf(v)} r="4" fill={s.color} stroke="white" strokeWidth="2" />)}
          </g>
        )
      })}
      {labels.map((l, i) => {
        if (n > 20 && i % 3 !== 0) return null
        if (n > 12 && i % 2 !== 0) return null
        return <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{l}</text>
      })}
    </svg>
  )
}

function BarChart({ values, colors, labels, vbH = 140 }: { values: number[]; colors: string[]; labels: string[]; vbH?: number }) {
  const n = values.length
  if (!n) return null
  const W = 600, H = vbH, PB = 24, PT = 12
  const maxV = Math.max(...values, 1)
  const slotW = W / n
  const barW = Math.min(slotW * 0.72, 36)
  const gap = (slotW - barW) / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1={0} x2={W} y1={PT + (1 - t) * (H - PT - PB)} y2={PT + (1 - t) * (H - PT - PB)} stroke="#f1f5f9" strokeWidth="1" />
      ))}
      {values.map((v, i) => {
        const bh = Math.max((v / maxV) * (H - PT - PB), 2)
        const x = slotW * i + gap
        return (
          <g key={i}>
            <rect x={x} y={H - PB - bh} width={barW} height={bh} rx="3" fill={colors[i]} opacity="0.88" />
            {n <= 16 && <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">{labels[i]}</text>}
          </g>
        )
      })}
    </svg>
  )
}

// ─── Card with clickable legend ───────────────────────────────────────────────

interface LegendItem { key: string; color: string; label: string }

function Card({
  title, subtitle, children, legend, hidden, onToggle, period, onPeriodChange, fullWidth,
}: {
  title: string; subtitle?: string; children: React.ReactNode
  legend?: LegendItem[]; hidden?: Set<string>; onToggle?: (key: string) => void
  period?: number; onPeriodChange?: (v: number) => void; fullWidth?: boolean
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-700">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        {onPeriodChange !== undefined && (
          <PeriodPicker value={period ?? 0} onChange={onPeriodChange} />
        )}
      </div>
      {children}
      {legend && legend.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-50">
          {legend.map((l) => {
            const isHidden = hidden?.has(l.key)
            return (
              <button key={l.key} onClick={() => onToggle?.(l.key)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-50 transition"
                title={isHidden ? 'Afficher' : 'Masquer'}>
                <div className="w-2.5 h-2.5 rounded-full shrink-0 transition" style={{ background: isHidden ? '#d1d5db' : l.color }} />
                <span className={`text-xs transition ${isHidden ? 'text-gray-300 line-through' : 'text-gray-500'}`}>{l.label}</span>
              </button>
            )
          })}
          {hidden && hidden.size > 0 && (
            <button onClick={() => hidden.forEach((k) => onToggle?.(k))}
              className="text-[10px] text-blue-500 hover:underline px-1">
              Tout afficher
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold" style={{ color: color ?? '#374151' }}>{value}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientStatsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params)
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [loading, setLoading] = useState(true)
  const [clientName, setClientName] = useState('')
  const [rawPoints, setRawPoints] = useState<StatPoint[]>([])

  // Global date range filter
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showDateFilter, setShowDateFilter] = useState(false)

  // Per-card period filters
  const [pHooper,   setPHooper]   = useState(0)
  const [pQform,    setPQform]    = useState(0)
  const [pAlimAct,  setPAlimAct]  = useState(0)
  const [pMotiv,    setPMotiv]    = useState(0)
  const [pDouleurs, setPDouleurs] = useState(0)
  const [pRpe,      setPRpe]      = useState(0)
  const [pCharge,   setPCharge]   = useState(0)
  const [pLoad,     setPLoad]     = useState(90)

  // Per-chart series toggles
  const qform   = useSeriesToggle()
  const alimAct = useSeriesToggle()
  const rpe     = useSeriesToggle()

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', clientId))
        if (snap.exists()) {
          const d = snap.data() as any
          setClientName([d.nom, d.prenom].filter(Boolean).join(' ') || d.email || clientId)
        }
      } catch {}
      try {
        const ref = doc(db, 'users', clientId)
        const snap = await getDocs(query(collection(db, 'planning_pro'), where('ref_users', '==', ref), orderBy('date_planning', 'asc')))
        const pts: StatPoint[] = []
        snap.docs.forEach((d) => {
          const p = d.data() as any
          const dateTs = p.date_planning?.toDate?.()
          if (!dateTs) return
          const debut = p.heure_planning_debut?.toDate?.()
          const fin   = p.heure_planning_fin?.toDate?.()
          const dur = debut && fin ? Math.round((fin.getTime() - debut.getTime()) / 60000) : undefined
          const rpePlan = p.intensite_seance_planifiee || undefined
          const rpeRess = p.intensite_seance > 0 ? p.intensite_seance : undefined
          const hooper  = p.indice_hooper != null ? p.indice_hooper : undefined
          const hasData = hooper != null || rpePlan != null || rpeRess != null || p.questionnaire_rempli || p.motivation_avant_seance || p.alimentation_derniers_jours || p.activite_derniers_jours
          if (!hasData) return
          pts.push({
            date: dateTs,
            label: dateTs.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
            indiceHooper: hooper,
            qualiteSommeil: p.qualite_sommeil || undefined,
            niveauFatigue: p.niveau_fatigue || undefined,
            niveauCourbatures: p.niveau_courbatures || undefined,
            quantiteStress: p.quantite_stress || undefined,
            motivationAvant: p.motivation_avant_seance || undefined,
            activite: p.activite_derniers_jours || undefined,
            alimentation: p.alimentation_derniers_jours || undefined,
            douleurs: Array.isArray(p.douleurs) ? p.douleurs : [],
            rpePlanifie: rpePlan, rpeRessenti: rpeRess, intensiteMise: p.intensite_mise_pdt_seance || undefined,
            durationMin: dur,
            chargePlanifiee: rpePlan && dur ? Math.round(rpePlan * dur) : undefined,
            chargeReelle: rpeRess && dur ? Math.round(rpeRess * dur) : undefined,
          })
        })
        setRawPoints(pts)
      } catch {}
      setLoading(false)
    }
    load()
  }, [clientId, isAdmin])

  // Apply global date range filter
  const allPoints = useMemo(() => {
    let pts = rawPoints
    if (dateFrom) { const from = new Date(dateFrom + 'T00:00:00'); pts = pts.filter((p) => p.date >= from) }
    if (dateTo)   { const to   = new Date(dateTo   + 'T23:59:59'); pts = pts.filter((p) => p.date <= to) }
    return pts
  }, [rawPoints, dateFrom, dateTo])

  // Filtered sets per section
  const ptsHooper  = usePeriodFilter(allPoints.filter((p) => p.indiceHooper != null), pHooper)
  const ptsQform   = usePeriodFilter(allPoints.filter((p) => p.qualiteSommeil != null), pQform)
  const ptsAlimAct = usePeriodFilter(allPoints.filter((p) => p.alimentation != null || p.activite != null), pAlimAct)
  const ptsMotiv   = usePeriodFilter(allPoints.filter((p) => p.motivationAvant != null), pMotiv)
  const ptsDoul    = usePeriodFilter(allPoints.filter((p) => p.douleurs.length > 0 || p.qualiteSommeil != null), pDouleurs)
  const ptsRpe     = usePeriodFilter(allPoints.filter((p) => p.rpePlanifie != null || p.rpeRessenti != null), pRpe)
  const ptsCharge  = usePeriodFilter(allPoints.filter((p) => p.chargeReelle != null || p.chargePlanifiee != null), pCharge)
  const withLoad   = useMemo(() => computeLoadStats(ptsCharge), [ptsCharge])
  const ptsLoad    = usePeriodFilter(allPoints.filter((p) => p.chargeReelle != null), pLoad)
  const withLoadAll= useMemo(() => computeLoadStats(ptsLoad), [ptsLoad])

  // Alerts computed from all filtered points
  const alerts = useMemo(() => {
    const res: { level: 'critical' | 'warning'; msg: string }[] = []
    const lastH = [...allPoints].reverse().find((p) => p.indiceHooper != null)
    if (lastH?.indiceHooper != null) {
      if (lastH.indiceHooper > 18) res.push({ level: 'critical', msg: `Récupération insuffisante — Hooper ${lastH.indiceHooper}/28 (${lastH.label})` })
      else if (lastH.indiceHooper > 12) res.push({ level: 'warning', msg: `Récupération modérée — Hooper ${lastH.indiceHooper}/28 (${lastH.label})` })
    }
    const lastFat = allPoints.filter((p) => p.niveauFatigue != null).slice(-3)
    if (lastFat.length >= 2 && mean(lastFat.map((p) => p.niveauFatigue!)) >= 5)
      res.push({ level: 'warning', msg: `Fatigue chronique — moy. ${mean(lastFat.map((p) => p.niveauFatigue!)).toFixed(1)}/7 sur 3 dernières séances` })
    const lastSt = allPoints.filter((p) => p.quantiteStress != null).slice(-3)
    if (lastSt.length >= 2 && mean(lastSt.map((p) => p.quantiteStress!)) >= 5)
      res.push({ level: 'warning', msg: `Stress chronique — moy. ${mean(lastSt.map((p) => p.quantiteStress!)).toFixed(1)}/7 sur 3 dernières séances` })
    const lastMot = [...allPoints].reverse().find((p) => p.motivationAvant != null)
    if (lastMot?.motivationAvant != null && lastMot.motivationAvant <= 2)
      res.push({ level: 'warning', msg: `Faible motivation — ${lastMot.motivationAvant}/5 (${lastMot.label})` })
    const lastAl = allPoints.filter((p) => p.alimentation != null).slice(-3)
    if (lastAl.length >= 2 && mean(lastAl.map((p) => p.alimentation!)) <= 2)
      res.push({ level: 'warning', msg: `Alimentation insuffisante — moy. ${mean(lastAl.map((p) => p.alimentation!)).toFixed(1)}/5 sur 3 dernières séances` })
    if (withLoadAll.length > 0) {
      const last = withLoadAll[withLoadAll.length - 1]
      if (last.acwr > 1.5) res.push({ level: 'critical', msg: `Risque de blessure — ACWR ${last.acwr} (> 1.5)` })
      else if (last.acwr > 1.3) res.push({ level: 'warning', msg: `Charge élevée — ACWR ${last.acwr} (> 1.3)` })
      else if (last.acwr < 0.8 && last.acwr > 0) res.push({ level: 'warning', msg: `Sous-charge — ACWR ${last.acwr} (< 0.8)` })
      if (last.monotony > 2) res.push({ level: 'critical', msg: `Monotonie élevée — ${last.monotony} (> 2) · varier les charges` })
    }
    const recentDoul = allPoints.slice(-5).filter((p) => p.douleurs.length > 0)
    if (recentDoul.length >= 3) res.push({ level: 'warning', msg: `Douleurs signalées dans ${recentDoul.length} des 5 dernières séances` })
    return res
  }, [allPoints, withLoadAll])

  const hasDateFilter = dateFrom || dateTo

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-400">Accès réservé aux administrateurs.</p></div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800 truncate">Évolution — {clientName || clientId}</h1>
          <p className="text-sm text-gray-400">{allPoints.length} séance{allPoints.length !== 1 ? 's' : ''} avec données{hasDateFilter ? ' · filtrée' : ''}</p>
        </div>
        <button onClick={() => setShowDateFilter((v) => !v)}
          className={`flex items-center gap-1.5 shrink-0 text-xs font-medium px-3 py-1.5 rounded-xl border transition ${showDateFilter || hasDateFilter ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          <CalendarDaysIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Période</span>
        </button>
      </div>

      {/* Global date range filter */}
      {showDateFilter && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Filtrer par plage de dates</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Du</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Au</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {hasDateFilter && (
              <button onClick={() => { setDateFrom(''); setDateTo('') }}
                className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition">
                Effacer
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Les filtres de période sur chaque graphique s'appliquent à l'intérieur de cette plage.
            Cliquez sur une variable dans la légende d'un graphique pour la masquer/afficher.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : allPoints.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400">{hasDateFilter ? 'Aucune donnée sur cette période.' : 'Aucune donnée disponible.'}</p>
        </div>
      ) : (
        <>
          {/* Alertes */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.filter((a) => a.level === 'critical').map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <ExclamationCircleIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-red-700">{a.msg}</p>
                </div>
              ))}
              {alerts.filter((a) => a.level === 'warning').map((a, i) => (
                <div key={i} className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                  <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-orange-700">{a.msg}</p>
                </div>
              ))}
            </div>
          )}

          {/* Grid 2 colonnes sur desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Hooper */}
            {ptsHooper.length >= 2 && (
              <Card title="Indice Hooper" subtitle="Vert ≤12 · Orange ≤18 · Rouge >18 (sur 28)"
                period={pHooper} onPeriodChange={setPHooper}>
                <LineChart
                  series={[{ key: 'hooper', values: ptsHooper.map((p) => p.indiceHooper!), color: '#6366f1' }]}
                  labels={ptsHooper.map((p) => p.label)} yMin={0}
                  refLines={[{ y: 12, color: '#16a34a', dash: true }, { y: 18, color: '#d97706', dash: true }]}
                />
                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50 text-center">
                  {(() => {
                    const vals = ptsHooper.map((p) => p.indiceHooper!)
                    const last = vals[vals.length - 1], avg = Math.round(mean(vals))
                    return (<>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Dernier</p><p className="text-lg font-bold" style={{ color: hooColor(last) }}>{last}<span className="text-xs text-gray-400 font-normal">/28</span></p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Moyenne</p><p className="text-lg font-bold" style={{ color: hooColor(avg) }}>{avg}<span className="text-xs text-gray-400 font-normal">/28</span></p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Min / Max</p><p className="text-sm font-semibold text-gray-700">{Math.min(...vals)} / {Math.max(...vals)}</p></div>
                    </>)
                  })()}
                </div>
              </Card>
            )}

            {/* RPE */}
            {ptsRpe.length >= 2 && (
              <Card title="RPE — Intensité perçue" subtitle="Cliquez sur la légende pour masquer/afficher"
                period={pRpe} onPeriodChange={setPRpe}
                legend={[{ key: 'plan', color: '#93c5fd', label: 'Planifié' }, { key: 'ress', color: '#3b82f6', label: 'Ressenti' }]}
                hidden={rpe.hidden} onToggle={rpe.toggle}>
                <LineChart
                  series={[
                    { key: 'plan', values: ptsRpe.map((p) => p.rpePlanifie ?? 0), color: '#93c5fd' },
                    { key: 'ress', values: ptsRpe.map((p) => p.rpeRessenti ?? 0), color: '#3b82f6' },
                  ]}
                  labels={ptsRpe.map((p) => p.label)} yMin={0}
                  refLines={[{ y: 7, color: '#d97706', dash: true }]}
                  hidden={rpe.hidden}
                />
                {(() => {
                  const vR = ptsRpe.filter((p) => p.rpeRessenti != null).map((p) => p.rpeRessenti!)
                  if (!vR.length) return null
                  return (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-50 text-center">
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Moy. ressenti</p><p className="text-lg font-bold" style={{ color: rpeColor(mean(vR)) }}>{mean(vR).toFixed(1)}<span className="text-xs text-gray-400 font-normal">/10</span></p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Dernier RPE</p><p className="text-lg font-bold" style={{ color: rpeColor(vR[vR.length - 1]) }}>{vR[vR.length - 1]}<span className="text-xs text-gray-400 font-normal">/10</span></p></div>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Composantes questionnaire */}
            {ptsQform.length >= 2 && (
              <Card title="Composantes questionnaire" subtitle="1 = optimal · 7 = critique — cliquez sur la légende"
                period={pQform} onPeriodChange={setPQform}
                legend={[
                  { key: 'sommeil', color: '#3b82f6', label: 'Sommeil' },
                  { key: 'fatigue', color: '#f59e0b', label: 'Fatigue' },
                  { key: 'courbatures', color: '#ef4444', label: 'Courbatures' },
                  { key: 'stress', color: '#8b5cf6', label: 'Stress' },
                ]}
                hidden={qform.hidden} onToggle={qform.toggle}>
                <LineChart
                  series={[
                    { key: 'sommeil',     values: ptsQform.map((p) => p.qualiteSommeil!),    color: '#3b82f6' },
                    { key: 'fatigue',     values: ptsQform.map((p) => p.niveauFatigue ?? 0), color: '#f59e0b' },
                    { key: 'courbatures', values: ptsQform.map((p) => p.niveauCourbatures ?? 0), color: '#ef4444' },
                    { key: 'stress',      values: ptsQform.map((p) => p.quantiteStress ?? 0),   color: '#8b5cf6' },
                  ]}
                  labels={ptsQform.map((p) => p.label)} yMin={1}
                  refLines={[{ y: 5, color: '#d97706', dash: true }]}
                  hidden={qform.hidden}
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-gray-50">
                  {([
                    { key: 'qualiteSommeil', label: 'Sommeil' }, { key: 'niveauFatigue', label: 'Fatigue' },
                    { key: 'niveauCourbatures', label: 'Courbatures' }, { key: 'quantiteStress', label: 'Stress' },
                  ] as { key: keyof StatPoint; label: string }[]).map(({ key, label }) => {
                    const vals = ptsQform.map((p) => (p[key] as number)).filter((v) => v != null)
                    if (!vals.length) return null
                    const avg = mean(vals)
                    return <StatRow key={key} label={label} value={`moy. ${avg.toFixed(1)}/7`} color={avg >= 5 ? '#dc2626' : avg >= 4 ? '#d97706' : '#16a34a'} />
                  })}
                </div>
              </Card>
            )}

            {/* Alimentation & Activité */}
            {ptsAlimAct.length >= 2 && (
              <Card title="Alimentation & Activité" subtitle="1 = insuffisant · 5 = excellent — cliquez sur la légende"
                period={pAlimAct} onPeriodChange={setPAlimAct}
                legend={[{ key: 'alim', color: '#f97316', label: 'Alimentation' }, { key: 'act', color: '#10b981', label: 'Activité physique' }]}
                hidden={alimAct.hidden} onToggle={alimAct.toggle}>
                <LineChart
                  series={[
                    { key: 'alim', values: ptsAlimAct.map((p) => p.alimentation ?? 0), color: '#f97316' },
                    { key: 'act',  values: ptsAlimAct.map((p) => p.activite ?? 0),     color: '#10b981' },
                  ]}
                  labels={ptsAlimAct.map((p) => p.label)} yMin={1}
                  refLines={[{ y: 2, color: '#dc2626', dash: true }]}
                  hidden={alimAct.hidden}
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-gray-50">
                  {(() => {
                    const vA   = ptsAlimAct.filter((p) => p.alimentation != null).map((p) => p.alimentation!)
                    const vAct = ptsAlimAct.filter((p) => p.activite != null).map((p) => p.activite!)
                    return (<>
                      {vA.length   > 0 && <StatRow label="Alimentation moy." value={`${mean(vA).toFixed(1)}/5`}   color={mean(vA) <= 2 ? '#dc2626' : mean(vA) <= 3 ? '#d97706' : '#16a34a'} />}
                      {vAct.length > 0 && <StatRow label="Activité moy."     value={`${mean(vAct).toFixed(1)}/5`} color={mean(vAct) <= 2 ? '#d97706' : '#16a34a'} />}
                    </>)
                  })()}
                </div>
              </Card>
            )}

            {/* Motivation */}
            {ptsMotiv.length >= 2 && (
              <Card title="Motivation avant séance" subtitle="1 = pas motivé · 5 = très motivé"
                period={pMotiv} onPeriodChange={setPMotiv}>
                <LineChart
                  series={[{ key: 'motiv', values: ptsMotiv.map((p) => p.motivationAvant!), color: '#10b981' }]}
                  labels={ptsMotiv.map((p) => p.label)} yMin={1}
                  refLines={[{ y: 2, color: '#dc2626', dash: true }]}
                />
                {(() => {
                  const vals = ptsMotiv.map((p) => p.motivationAvant!)
                  const avg = mean(vals)
                  return (
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-50 text-center">
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Moyenne</p><p className="text-lg font-bold" style={{ color: sc5Color(Math.round(avg)) }}>{avg.toFixed(1)}<span className="text-xs text-gray-400 font-normal">/5</span></p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Dernier</p><p className="text-lg font-bold" style={{ color: sc5Color(vals[vals.length - 1]) }}>{vals[vals.length - 1]}<span className="text-xs text-gray-400 font-normal">/5</span></p></div>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Douleurs */}
            {ptsDoul.length >= 2 && (() => {
              const counts = ptsDoul.map((p) => p.douleurs.length)
              const zoneFreq: Record<string, number> = {}
              ptsDoul.filter((p) => p.douleurs.length > 0).forEach((p) =>
                p.douleurs.forEach((d) => { zoneFreq[d.zone] = (zoneFreq[d.zone] ?? 0) + 1 }))
              const topZones = Object.entries(zoneFreq).sort((a, b) => b[1] - a[1]).slice(0, 6)
              return (
                <Card title="Douleurs signalées" subtitle="Nombre de zones douloureuses par séance"
                  period={pDouleurs} onPeriodChange={setPDouleurs}>
                  <BarChart
                    values={counts}
                    colors={counts.map((v) => v === 0 ? '#e2e8f0' : v >= 3 ? '#dc2626' : v >= 2 ? '#d97706' : '#f59e0b')}
                    labels={ptsDoul.map((p) => p.label)} vbH={120}
                  />
                  {topZones.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <p className="text-xs text-gray-400 mb-2">Zones les plus fréquentes</p>
                      <div className="flex flex-wrap gap-1.5">
                        {topZones.map(([zone, freq]) => (
                          <span key={zone} className="inline-flex items-center gap-1 text-xs bg-red-50 border border-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            {zone} <span className="font-bold">×{freq}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })()}

            {/* Charges */}
            {ptsCharge.length >= 2 && (
              <Card title="Charges d'entraînement" subtitle="Durée (min) × RPE — unités arbitraires (UA)"
                period={pCharge} onPeriodChange={setPCharge}>
                <BarChart
                  values={withLoad.map((p) => p.chargeReelle ?? p.chargePlanifiee ?? 0)}
                  colors={withLoad.map((p) => rpeColor(p.rpeRessenti ?? p.rpePlanifie ?? 5))}
                  labels={withLoad.map((p) => p.label)}
                />
                {(() => {
                  const valid = withLoad.filter((p) => p.chargeReelle != null)
                  if (!valid.length) return null
                  const vals = valid.map((p) => p.chargeReelle!)
                  return (
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50 text-center">
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Moy.</p><p className="text-sm font-bold text-gray-700">{Math.round(mean(vals))} UA</p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Total</p><p className="text-sm font-bold text-gray-700">{vals.reduce((a, b) => a + b, 0)} UA</p></div>
                      <div><p className="text-[10px] text-gray-400 mb-0.5">Min / Max</p><p className="text-sm font-semibold text-gray-600">{Math.min(...vals)} / {Math.max(...vals)}</p></div>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Monotonie */}
            {withLoadAll.length >= 3 && (
              <Card title="Monotonie" subtitle="Charge moy. 7j / écart-type — zone sûre < 2"
                period={pLoad} onPeriodChange={setPLoad}>
                <LineChart
                  series={[{ key: 'mono', values: withLoadAll.map((p) => p.monotony), color: '#f59e0b' }]}
                  labels={withLoadAll.map((p) => p.label)} yMin={0}
                  refLines={[{ y: 2, color: '#dc2626', dash: true }]}
                />
                {(() => {
                  const last = withLoadAll[withLoadAll.length - 1]
                  const color = last.monotony > 2 ? '#dc2626' : last.monotony > 1.5 ? '#d97706' : '#16a34a'
                  return <p className="text-xs mt-2">Valeur actuelle : <span className="font-bold" style={{ color }}>{last.monotony}</span>{last.monotony > 2 && <span className="text-red-500 ml-1">— ⚠ Risque de surentraînement</span>}</p>
                })()}
              </Card>
            )}

            {/* ACWR */}
            {withLoadAll.length >= 4 && (
              <Card title="ACWR — Charge Aiguë/Chronique" subtitle="Charge 7j / 28j · Zone optimale 0.8–1.3"
                period={pLoad} onPeriodChange={setPLoad}>
                <LineChart
                  series={[{ key: 'acwr', values: withLoadAll.map((p) => p.acwr), color: '#6366f1' }]}
                  labels={withLoadAll.map((p) => p.label)} yMin={0}
                  refLines={[{ y: 0.8, color: '#16a34a', dash: true }, { y: 1.3, color: '#16a34a', dash: true }, { y: 1.5, color: '#dc2626', dash: true }]}
                />
                {(() => {
                  const last = withLoadAll[withLoadAll.length - 1]
                  return (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                      <p className="text-sm font-bold" style={{ color: acwrColor(last.acwr) }}>{last.acwr}</p>
                      <p className="text-xs text-gray-400">
                        {last.acwr < 0.8 && '⬇ Sous-charge'}{last.acwr >= 0.8 && last.acwr <= 1.3 && '✓ Zone optimale'}
                        {last.acwr > 1.3 && last.acwr <= 1.5 && '⚠ Charge élevée'}{last.acwr > 1.5 && '⛔ Risque de blessure'}
                      </p>
                    </div>
                  )
                })()}
              </Card>
            )}

            {/* Tableau récap */}
            <Card title="Dernières séances — récapitulatif" subtitle={`${Math.min(8, allPoints.length)} séances les plus récentes`} fullWidth>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs border-collapse min-w-[560px]">
                  <thead>
                    <tr className="text-gray-400 text-left border-b border-gray-100">
                      {['Date','Hooper','Motiv.','Alim.','Activité','Douleurs','RPE pl.','RPE res.','Charge','ACWR'].map((h) => (
                        <th key={h} className="px-2 py-2 font-medium text-center first:text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allPoints.slice(-8).reverse().map((p, i) => {
                      const lp = withLoadAll.find((w) => w.date.getTime() === p.date.getTime())
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition">
                          <td className="px-2 py-2 font-medium text-gray-700">{p.label}</td>
                          <td className="px-2 py-2 text-center">{p.indiceHooper != null ? <span className="font-bold" style={{ color: hooColor(p.indiceHooper) }}>{p.indiceHooper}</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.motivationAvant != null ? <span className="font-bold" style={{ color: sc5Color(p.motivationAvant) }}>{p.motivationAvant}/5</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.alimentation != null ? <span className="font-bold" style={{ color: sc5Color(p.alimentation) }}>{p.alimentation}/5</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.activite != null ? <span className="font-bold" style={{ color: sc5Color(p.activite) }}>{p.activite}/5</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.douleurs.length > 0 ? <span className="font-bold text-orange-500">{p.douleurs.length}</span> : <span className="text-gray-300">0</span>}</td>
                          <td className="px-2 py-2 text-center">{p.rpePlanifie != null ? <span className="font-bold" style={{ color: rpeColor(p.rpePlanifie) }}>{p.rpePlanifie}</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.rpeRessenti != null ? <span className="font-bold" style={{ color: rpeColor(p.rpeRessenti) }}>{p.rpeRessenti}</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{p.chargeReelle != null ? <span className="font-semibold text-gray-700">{p.chargeReelle}</span> : <span className="text-gray-200">—</span>}</td>
                          <td className="px-2 py-2 text-center">{lp?.acwr ? <span className="font-bold" style={{ color: acwrColor(lp.acwr) }}>{lp.acwr}</span> : <span className="text-gray-200">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
