'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, query, orderBy, doc, writeBatch, Timestamp,
} from 'firebase/firestore'
import {
  ArrowLeftIcon, MagnifyingGlassIcon, UsersIcon,
  PencilIcon, ArrowsRightLeftIcon, XMarkIcon,
  ChevronRightIcon, CalendarIcon, ExclamationTriangleIcon,
  TrophyIcon, ChartBarIcon, PlusIcon, TrashIcon,
  BanknotesIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'
import Modal from '@/components/ui/Modal'
import { useParcoursNotes } from '@/hooks/useParcoursNotes'
import type { ParcoursNote } from '@/types'
import { PAYMENT_NOTE_TYPE, PARCOURS_NOTE_TYPES, getParcoursNoteStyle, isNoteExpired, noteRemaining, isAdvanceAvailable } from '@/lib/parcoursNotes'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Registration {
  id: string
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  paymentStatus: string
  attendance: 'unknown' | 'present' | 'absent' | 'deregistered'
  registeredAt?: Timestamp
  userId?: string
}

interface Session {
  id: string
  title: string
  date: Timestamp
  status?: string
}

interface Participant {
  key: string
  firstName: string
  lastName: string
  email: string
  phone: string
  userId?: string
  registrations: Registration[]
  totalSessions: number
  presentCount: number
  absentCount: number
  unknownCount: number
  pendingCount: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toUpperName = (s: string) => s.toUpperCase()
const toProperName = (s: string) =>
  s.split(/([\s-])/).map((p) => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')
const displayName = (p: { firstName: string; lastName: string }) =>
  [toUpperName(p.lastName), toProperName(p.firstName)].filter(Boolean).join(' ')

function fmtDate(ts?: Timestamp) {
  if (!ts) return ''
  return ts.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'En attente', cash: 'Espèces', transfer: 'Virement',
  free: 'Gratuit', waived: 'Offert', prepaid: "Payé d'avance", cancelled_admin: 'Annulée',
}
const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700', cash: 'bg-green-100 text-green-700',
  transfer: 'bg-blue-100 text-blue-700', free: 'bg-gray-100 text-gray-500',
  waived: 'bg-purple-100 text-purple-700', prepaid: 'bg-emerald-100 text-emerald-700',
  cancelled_admin: 'bg-gray-100 text-gray-400',
}
const ATTENDANCE_LABELS: Record<string, string> = {
  unknown: 'En attente', present: 'Présent', absent: 'Absent', deregistered: 'Désinscrit',
}
const ATTENDANCE_COLORS: Record<string, string> = {
  unknown: 'bg-gray-100 text-gray-500', present: 'bg-green-100 text-green-700',
  absent: 'bg-red-100 text-red-600', deregistered: 'bg-gray-100 text-gray-400',
}
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function pKey(r: Pick<Registration, 'email' | 'firstName' | 'lastName'>): string {
  return (r.email?.trim() || `${r.lastName}|${r.firstName}`).toLowerCase()
}

function buildParticipants(registrations: Registration[], sessions: Map<string, Session>): Participant[] {
  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() })()
  // Vrai impayé : « en attente », ni absent ni désinscrit, séance non annulée et déjà passée
  const isRealUnpaid = (r: Registration): boolean => {
    if (r.paymentStatus !== 'pending') return false
    if (r.attendance === 'absent' || r.attendance === 'deregistered') return false
    const s = sessions.get(r.sessionId)
    if (!s || s.status === 'cancelled') return false
    return !!s.date && s.date.toMillis() < startOfToday
  }
  const map = new Map<string, Participant>()
  for (const r of registrations) {
    if (r.attendance === 'deregistered') continue
    const key = pKey(r)
    if (!key) continue
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        key, firstName: r.firstName, lastName: r.lastName,
        email: r.email ?? '', phone: r.phone ?? '', userId: r.userId,
        registrations: [r], totalSessions: 1,
        presentCount: r.attendance === 'present' ? 1 : 0,
        absentCount: r.attendance === 'absent' ? 1 : 0,
        unknownCount: r.attendance === 'unknown' ? 1 : 0,
        pendingCount: isRealUnpaid(r) ? 1 : 0,
      })
    } else {
      if (!existing.email && r.email) existing.email = r.email
      if (!existing.phone && r.phone) existing.phone = r.phone
      if (!existing.userId && r.userId) existing.userId = r.userId
      existing.registrations.push(r)
      existing.totalSessions++
      if (r.attendance === 'present') existing.presentCount++
      else if (r.attendance === 'absent') existing.absentCount++
      else existing.unknownCount++
      if (isRealUnpaid(r)) existing.pendingCount++
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    `${a.lastName} ${a.firstName}`.toLowerCase().localeCompare(`${b.lastName} ${b.firstName}`.toLowerCase())
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBar({ label, value, sessCount, maxRatio, colorClass }: {
  label: string; value: number; sessCount?: number; maxRatio: number; colorClass: string
}) {
  const ratio = sessCount ? value / sessCount : null
  const barPct = maxRatio > 0 ? Math.round(((ratio ?? value) / maxRatio) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-14 shrink-0 text-right truncate">{label}</span>
      <div className="flex-1 h-3.5 bg-gray-100 rounded-full overflow-hidden min-w-0">
        <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${barPct}%` }} />
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className="text-xs font-semibold text-gray-700">{value}</span>
        {ratio !== null && (
          <span className="text-[10px] text-gray-400 ml-1">({ratio.toFixed(1)}/séance)</span>
        )}
      </div>
    </div>
  )
}

function MiniBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function RankRow({ rank, name, value, unit }: { rank: number; name: string; value: number; unit: string }) {
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="text-sm w-5 shrink-0">{medals[rank] ?? <span className="text-xs text-gray-400 font-bold">{rank + 1}</span>}</span>
      <span className="flex-1 text-xs text-gray-800 truncate">{name}</span>
      <span className="text-xs font-bold text-gray-600 shrink-0">{value} <span className="font-normal text-gray-400">{unit}</span></span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ParticipantsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [loading, setLoading] = useState(true)

  const { notes: parcoursNotes, addNote, updateNote, deleteNote } = useParcoursNotes()

  const [activeTab, setActiveTab] = useState<'participants' | 'stats'>('participants')

  // Participants tab
  const [search, setSearch] = useState('')
  const [filterChip, setFilterChip] = useState<'all' | 'present' | 'absent' | 'pending' | 'homonyms' | 'advance'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'mostSessions' | 'mostPresent' | 'mostAbsent'>('name')

  // Ouverture directe sur les homonymes depuis la pastille d'alerte de la page principale
  useEffect(() => {
    if (searchParams.get('filter') === 'homonyms') { setActiveTab('participants'); setFilterChip('homonyms') }
  }, [searchParams])

  // Detail panel
  const [selected, setSelected] = useState<Participant | null>(null)
  const [detailTab, setDetailTab] = useState<'sessions' | 'stats' | 'notes'>('sessions')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  // Notes
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [editNote, setEditNote] = useState<ParcoursNote | null>(null)
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null)
  const [noteForm, setNoteForm] = useState<{ type_note: string; notes: string; montant: string; montantMethode: 'cash' | 'transfer'; date_max_note_active: string }>({ type_note: PAYMENT_NOTE_TYPE, notes: '', montant: '', montantMethode: 'cash', date_max_note_active: '' })
  const [savingNote, setSavingNote] = useState(false)

  // Merge
  const [showMerge, setShowMerge] = useState(false)
  const [mergeSearch, setMergeSearch] = useState('')
  const [mergeTarget, setMergeTarget] = useState<Participant | null>(null)
  const [merging, setMerging] = useState(false)

  useEffect(() => {
    const loadAll = async () => {
      const [regSnap, sessSnap] = await Promise.all([
        getDocs(collection(db, 'registrations')),
        getDocs(query(collection(db, 'sessions'), orderBy('date', 'desc'))),
      ])
      const regs = regSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Registration))
      const sessMap = new Map<string, Session>()
      sessSnap.docs.forEach((d) => sessMap.set(d.id, { id: d.id, ...d.data() } as Session))
      setRegistrations(regs)
      setSessions(sessMap)
      setLoading(false)
    }
    loadAll().catch(() => setLoading(false))
  }, [])

  const participants = useMemo(() => buildParticipants(registrations, sessions), [registrations, sessions])

  // Notes regroupées par participant
  const notesByKey = useMemo(() => {
    const m = new Map<string, ParcoursNote[]>()
    for (const n of parcoursNotes) {
      if (!m.has(n.participantKey)) m.set(n.participantKey, [])
      m.get(n.participantKey)!.push(n)
    }
    return m
  }, [parcoursNotes])

  // Total des avances disponibles (solde restant des paiements anticipés non expirés) par participant
  const advanceByKey = useMemo(() => {
    const m = new Map<string, number>()
    for (const n of parcoursNotes) {
      if (!isAdvanceAvailable(n)) continue
      m.set(n.participantKey, (m.get(n.participantKey) ?? 0) + noteRemaining(n))
    }
    return m
  }, [parcoursNotes])

  const totalAdvances = useMemo(
    () => Array.from(advanceByKey.values()).reduce((s, v) => s + v, 0),
    [advanceByKey]
  )

  // Detect homonyms: same firstName+lastName but different keys (different emails)
  const homonymKeys = useMemo(() => {
    const nameGroups = new Map<string, string[]>()
    for (const p of participants) {
      const nameKey = `${p.firstName.trim().toLowerCase()}|${p.lastName.trim().toLowerCase()}`
      if (!nameKey.replace('|', '').trim()) continue
      if (!nameGroups.has(nameKey)) nameGroups.set(nameKey, [])
      nameGroups.get(nameKey)!.push(p.key)
    }
    const result = new Set<string>()
    nameGroups.forEach((keys) => { if (keys.length > 1) keys.forEach((k) => result.add(k)) })
    return result
  }, [participants])

  const filtered = useMemo(() => {
    let list = participants
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((p) => `${p.firstName} ${p.lastName} ${p.email} ${p.phone}`.toLowerCase().includes(q))
    if (filterChip === 'present') list = list.filter((p) => p.presentCount > 0)
    else if (filterChip === 'absent') list = list.filter((p) => p.absentCount > 0)
    else if (filterChip === 'pending') list = list.filter((p) => p.pendingCount > 0)
    else if (filterChip === 'homonyms') list = list.filter((p) => homonymKeys.has(p.key))
    else if (filterChip === 'advance') list = list.filter((p) => (advanceByKey.get(p.key) ?? 0) > 0)
    switch (sortBy) {
      case 'mostSessions': return [...list].sort((a, b) => b.totalSessions - a.totalSessions)
      case 'mostPresent': return [...list].sort((a, b) => b.presentCount - a.presentCount)
      case 'mostAbsent': return [...list].sort((a, b) => b.absentCount - a.absentCount)
      default: return list
    }
  }, [participants, search, filterChip, sortBy, homonymKeys, advanceByKey])

  // Sync selected panel with latest data
  useEffect(() => {
    if (!selected) return
    const updated = participants.find((p) => p.key === selected.key)
    if (updated) setSelected(updated)
  }, [participants]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    type Bucket = { total: number; present: number }

    // Session counts per bucket (denominator for ratio)
    const sessMonth: Record<number, number> = {}
    const sessDow: Record<number, number> = {}
    const sessHour: Record<number, number> = {}
    const sessYear: Record<number, number> = {}
    sessions.forEach((s) => {
      if (!s.date) return
      const d = s.date.toDate()
      sessMonth[d.getMonth()] = (sessMonth[d.getMonth()] ?? 0) + 1
      sessDow[d.getDay()] = (sessDow[d.getDay()] ?? 0) + 1
      sessHour[d.getHours()] = (sessHour[d.getHours()] ?? 0) + 1
      sessYear[d.getFullYear()] = (sessYear[d.getFullYear()] ?? 0) + 1
    })

    // Registration counts per bucket
    const byYear: Record<number, Bucket> = {}
    const byMonth: Record<number, Bucket> = {}
    const byDow: Record<number, Bucket> = {}
    const byHour: Record<number, Bucket> = {}
    const inc = (obj: Record<number, Bucket>, key: number, isPresent: boolean) => {
      if (!obj[key]) obj[key] = { total: 0, present: 0 }
      obj[key].total++
      if (isPresent) obj[key].present++
    }
    for (const r of registrations) {
      if (r.attendance === 'deregistered') continue
      const s = sessions.get(r.sessionId)
      if (!s?.date) continue
      const d = s.date.toDate()
      const isPresent = r.attendance === 'present'
      inc(byYear, d.getFullYear(), isPresent)
      inc(byMonth, d.getMonth(), isPresent)
      inc(byDow, d.getDay(), isPresent)
      inc(byHour, d.getHours(), isPresent)
    }

    // Max ratios for bar sizing
    const maxMonthRatio = Math.max(...Object.entries(byMonth).map(([m, b]) => b.total / (sessMonth[Number(m)] || 1)), 0.1)
    const maxDowRatio = Math.max(...Object.entries(byDow).map(([d, b]) => b.total / (sessDow[Number(d)] || 1)), 0.1)
    const maxHourRatio = Math.max(...Object.entries(byHour).map(([h, b]) => b.total / (sessHour[Number(h)] || 1)), 0.1)

    // Rankings
    const topSessions = [...participants].sort((a, b) => b.totalSessions - a.totalSessions).slice(0, 5)
    const topPresent = [...participants].sort((a, b) => b.presentCount - a.presentCount).slice(0, 5)
    const leastAbsent = [...participants].filter((p) => p.totalSessions >= 3)
      .sort((a, b) => (a.absentCount / a.totalSessions) - (b.absentCount / b.totalSessions)).slice(0, 5)
    const topPending = [...participants].filter((p) => p.pendingCount > 0)
      .sort((a, b) => b.pendingCount - a.pendingCount).slice(0, 5)

    return { byYear, byMonth, byDow, byHour, sessMonth, sessDow, sessHour, sessYear, maxMonthRatio, maxDowRatio, maxHourRatio, topSessions, topPresent, leastAbsent, topPending }
  }, [registrations, sessions, participants])

  // ── Per-participant stats ─────────────────────────────────────────────────

  const participantStats = useMemo(() => {
    if (!selected) return null
    type Bucket = { total: number; present: number }
    const byMonth: Record<number, Bucket> = {}
    const byYear: Record<number, Bucket> = {}
    const byDow: Record<number, Bucket> = {}
    const inc = (obj: Record<number, Bucket>, key: number, isPresent: boolean) => {
      if (!obj[key]) obj[key] = { total: 0, present: 0 }
      obj[key].total++
      if (isPresent) obj[key].present++
    }
    for (const r of selected.registrations) {
      const s = sessions.get(r.sessionId)
      if (!s?.date) continue
      const d = s.date.toDate()
      const isPresent = r.attendance === 'present'
      inc(byMonth, d.getMonth(), isPresent)
      inc(byYear, d.getFullYear(), isPresent)
      inc(byDow, d.getDay(), isPresent)
    }
    const maxMonth = Math.max(...Object.values(byMonth).map((b) => b.total), 0.1)
    const maxDow = Math.max(...Object.values(byDow).map((b) => b.total), 0.1)
    const presenceRate = selected.totalSessions > 0 ? Math.round((selected.presentCount / selected.totalSessions) * 100) : 0
    return { byMonth, byYear, byDow, maxMonth, maxDow, presenceRate }
  }, [selected, sessions])

  // ── Detail panel actions ──────────────────────────────────────────────────

  const openDetail = (p: Participant) => {
    setSelected(p); setEditing(false); setShowMerge(false); setMergeSearch(''); setMergeTarget(null); setDetailTab('sessions')
  }

  const startEdit = (p: Participant) => {
    setEditForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone })
    setEditing(true); setShowMerge(false)
  }

  const saveEdit = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const batch = writeBatch(db)
      for (const r of selected.registrations) {
        batch.update(doc(db, 'registrations', r.id), {
          firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(),
          email: editForm.email.trim().toLowerCase(), phone: editForm.phone.trim(),
        })
      }
      await batch.commit()
      setRegistrations((prev) =>
        prev.map((r) =>
          selected.registrations.some((sr) => sr.id === r.id)
            ? { ...r, firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(), email: editForm.email.trim().toLowerCase(), phone: editForm.phone.trim() }
            : r
        )
      )
      setEditing(false)
    } catch (e) { console.error('[saveEdit]', e) }
    setSaving(false)
  }

  // ── Notes ─────────────────────────────────────────────────────────────────
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const openAddNote = () => {
    setEditNote(null)
    const exp = new Date(); exp.setMonth(exp.getMonth() + 2)
    setNoteForm({ type_note: PAYMENT_NOTE_TYPE, notes: '', montant: '', montantMethode: 'cash', date_max_note_active: toLocalDate(exp) })
    setShowNoteModal(true)
  }

  const openEditNote = (n: ParcoursNote) => {
    setEditNote(n)
    const dmax = n.date_max_note_active?.toDate()
    setNoteForm({
      type_note: n.type_note || PAYMENT_NOTE_TYPE,
      notes: n.notes || '',
      montant: n.montant != null ? String(n.montant) : '',
      montantMethode: n.montantMethode === 'transfer' ? 'transfer' : 'cash',
      date_max_note_active: dmax ? toLocalDate(dmax) : '',
    })
    setShowNoteModal(true)
  }

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSavingNote(true)
    try {
      const raw = noteForm.montant.trim().replace(',', '.')
      const montantNum = raw ? Number(raw) : null
      const payload = {
        participantKey: selected.key,
        participantName: displayName(selected),
        type_note: noteForm.type_note,
        notes: noteForm.notes.trim(),
        montant: montantNum != null && Number.isFinite(montantNum) ? montantNum : null,
        montantMethode: noteForm.type_note === PAYMENT_NOTE_TYPE ? noteForm.montantMethode : null,
        date_max_note_active: noteForm.date_max_note_active
          ? Timestamp.fromDate(new Date(noteForm.date_max_note_active))
          : null,
      }
      if (editNote) await updateNote(editNote.id, payload)
      else await addNote({ ...payload, date_create: Timestamp.now() })
      setShowNoteModal(false)
    } catch (e) { console.error('[submitNote]', e) }
    setSavingNote(false)
  }

  const confirmDeleteNote = async () => {
    if (!deleteNoteId) return
    try { await deleteNote(deleteNoteId) } catch (e) { console.error('[deleteNote]', e) }
    setDeleteNoteId(null)
  }

  const selectedNotes = selected ? (notesByKey.get(selected.key) ?? []) : []

  const handleMerge = async () => {
    if (!selected || !mergeTarget) return
    setMerging(true)
    try {
      const batch = writeBatch(db)
      for (const r of mergeTarget.registrations) {
        batch.update(doc(db, 'registrations', r.id), {
          firstName: selected.firstName, lastName: selected.lastName,
          email: selected.email || mergeTarget.email, phone: selected.phone || mergeTarget.phone,
        })
      }
      await batch.commit()
      setRegistrations((prev) =>
        prev.map((r) =>
          mergeTarget.registrations.some((mr) => mr.id === r.id)
            ? { ...r, firstName: selected.firstName, lastName: selected.lastName, email: selected.email || mergeTarget.email, phone: selected.phone || mergeTarget.phone }
            : r
        )
      )
      setShowMerge(false); setMergeTarget(null); setMergeSearch('')
    } catch (e) { console.error('[handleMerge]', e) }
    setMerging(false)
  }

  const mergeResults = useMemo(() => {
    if (!mergeSearch.trim() || !selected) return []
    const q = mergeSearch.toLowerCase()
    return participants.filter((p) => p.key !== selected.key && `${p.firstName} ${p.lastName} ${p.email}`.toLowerCase().includes(q)).slice(0, 8)
  }, [mergeSearch, participants, selected])

  if (!isAdmin) return null

  const totalRegs = registrations.filter((r) => r.attendance !== 'deregistered').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/parcours-sportif')} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <UsersIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Participants</h1>
          <p className="text-sm text-gray-500">
            {loading ? 'Chargement…' : `${participants.length} participant${participants.length !== 1 ? 's' : ''} · ${totalRegs} inscriptions`}
            {homonymKeys.size > 0 && (
              <button onClick={() => { setActiveTab('participants'); setFilterChip('homonyms') }}
                className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full hover:bg-amber-200 transition">
                <ExclamationTriangleIcon className="w-3 h-3" />
                {homonymKeys.size} homonyme{homonymKeys.size > 1 ? 's' : ''}
              </button>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
        {([['participants', UsersIcon, 'Participants'], ['stats', ChartBarIcon, 'Statistiques']] as const).map(([tab, Icon, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 text-sm font-medium px-4 py-1.5 rounded-lg transition ${activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ══ TAB: PARTICIPANTS ══ */}
      {activeTab === 'participants' && (
        <>
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email ou téléphone…"
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter chips + sort */}
          <div className="flex items-center gap-2 flex-wrap">
            {([
              ['all', 'Tous', ''],
              ['present', '✓ Présents', 'bg-green-600 border-green-600'],
              ['absent', '✗ Absences', 'bg-red-500 border-red-500'],
              ['pending', '⚠ Impayés', 'bg-orange-500 border-orange-500'],
              ['advance', 'Avances', 'bg-emerald-600 border-emerald-600'],
              ['homonyms', '⚡ Homonymes', 'bg-amber-500 border-amber-500'],
            ] as const).map(([val, label, activeClass]) => (
              <button key={val} onClick={() => setFilterChip(val)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  filterChip === val
                    ? (val === 'all' ? 'bg-blue-600 text-white border-blue-600' : `${activeClass} text-white`)
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {val === 'advance' && <BanknotesIcon className="w-3.5 h-3.5 inline align-text-bottom mr-0.5" />}{label}
                {val === 'homonyms' && homonymKeys.size > 0 && (
                  <span className={`ml-1 text-[10px] font-bold ${filterChip === 'homonyms' ? 'text-white/80' : 'text-amber-600'}`}>
                    {homonymKeys.size}
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400 text-gray-600">
                <option value="name">Trier : NOM A-Z</option>
                <option value="mostSessions">Plus de séances</option>
                <option value="mostPresent">Plus présents</option>
                <option value="mostAbsent">Plus absents</option>
              </select>
            </div>
          </div>

          {/* Two-column layout */}
          <div className="flex gap-5 items-start">
            {/* List */}
            <div className={`flex-1 min-w-0 space-y-2 ${selected ? 'hidden lg:block' : ''}`}>
              {loading ? (
                <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Aucun participant trouvé</div>
              ) : (
                filtered.map((p) => {
                  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase()
                  const isActive = selected?.key === p.key
                  const isHomonym = homonymKeys.has(p.key)
                  return (
                    <button key={p.key} onClick={() => openDetail(p)}
                      className={`w-full flex items-center gap-3 bg-white border rounded-2xl px-4 py-3.5 hover:border-blue-200 hover:shadow-sm transition text-left ${
                        isActive ? 'border-blue-400 ring-1 ring-blue-100 shadow-sm'
                        : isHomonym ? 'border-amber-200 bg-amber-50/40'
                        : 'border-gray-100'
                      }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isHomonym ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        <span className={`text-sm font-bold ${isHomonym ? 'text-amber-600' : 'text-blue-600'}`}>{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{displayName(p)}</p>
                          {isHomonym && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                              <ExclamationTriangleIcon className="w-2.5 h-2.5" />
                              Doublon possible
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{p.email || p.phone || 'Aucune coordonnée'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(advanceByKey.get(p.key) ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <BanknotesIcon className="w-3 h-3" />{advanceByKey.get(p.key)}€
                          </span>
                        )}
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{p.totalSessions}×</span>
                        {p.presentCount > 0 && (
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full hidden sm:inline">
                            {p.presentCount}✓
                          </span>
                        )}
                        {p.absentCount > 0 && (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full hidden sm:inline">
                            {p.absentCount}✗
                          </span>
                        )}
                        {p.pendingCount > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full hidden sm:inline-flex">
                            <ExclamationTriangleIcon className="w-3 h-3" />{p.pendingCount}
                          </span>
                        )}
                      </div>
                      <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    </button>
                  )
                })
              )}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="w-full lg:w-[400px] shrink-0 bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden sticky top-4">
                {/* Panel header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition lg:hidden">
                    <ArrowLeftIcon className="w-4 h-4 text-gray-500" />
                  </button>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${homonymKeys.has(selected.key) ? 'bg-amber-100' : 'bg-blue-100'}`}>
                    <span className={`text-sm font-bold ${homonymKeys.has(selected.key) ? 'text-amber-600' : 'text-blue-600'}`}>
                      {`${selected.firstName.charAt(0)}${selected.lastName.charAt(0)}`.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-gray-900 truncate">{displayName(selected)}</p>
                      {homonymKeys.has(selected.key) && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">
                          <ExclamationTriangleIcon className="w-2.5 h-2.5" />
                          Doublon?
                        </span>
                      )}
                    </div>
                    {selected.email && <p className="text-xs text-gray-400 truncate">{selected.email}</p>}
                    {!selected.email && selected.phone && <p className="text-xs text-gray-400">{selected.phone}</p>}
                  </div>
                  <button onClick={() => startEdit(selected)} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500" title="Modifier">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setShowMerge((v) => !v); setMergeSearch(''); setMergeTarget(null); setEditing(false) }}
                    className={`p-2 rounded-lg transition ${showMerge ? 'bg-orange-100 text-orange-600' : 'hover:bg-gray-100 text-gray-500'}`} title="Fusionner">
                    <ArrowsRightLeftIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Edit form */}
                {editing && (
                  <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Modifier</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-gray-400 mb-1 block">Prénom</label>
                        <input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-400 mb-1 block">Nom</label>
                        <input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Email</label>
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 mb-1 block">Téléphone</label>
                      <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 bg-white" />
                    </div>
                    <p className="text-[10px] text-gray-400">S'applique à toutes ses inscriptions.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(false)} disabled={saving}
                        className="flex-1 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
                      <button onClick={saveEdit} disabled={saving}
                        className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 transition disabled:opacity-50">
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Merge panel */}
                {showMerge && (
                  <div className="px-5 py-4 border-b border-gray-100 bg-orange-50 space-y-3">
                    <p className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">Fusionner avec un doublon</p>
                    <p className="text-xs text-orange-600">Les inscriptions du doublon seront rattachées au profil actuel.</p>
                    <div className="relative">
                      <MagnifyingGlassIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input type="text" value={mergeSearch} onChange={(e) => { setMergeSearch(e.target.value); setMergeTarget(null) }}
                        placeholder="Rechercher le doublon…"
                        className="w-full pl-8 pr-3 py-2 border border-orange-200 rounded-lg text-sm outline-none focus:border-orange-400 bg-white" />
                    </div>
                    {mergeResults.length > 0 && !mergeTarget && (
                      <div className="space-y-0.5 max-h-40 overflow-y-auto rounded-lg border border-orange-100 bg-white">
                        {mergeResults.map((p) => (
                          <button key={p.key} onClick={() => setMergeTarget(p)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-orange-50 transition text-left">
                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-blue-600">{`${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-800 truncate">{displayName(p)}</p>
                              <p className="text-[10px] text-gray-400 truncate">{p.email || p.phone || `${p.totalSessions} séance(s)`}</p>
                            </div>
                            {homonymKeys.has(p.key) && (
                              <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {mergeTarget && (
                      <div className="bg-white rounded-xl border border-orange-200 p-3 space-y-2">
                        <p className="text-xs font-semibold text-gray-800">{displayName(mergeTarget)}
                          <span className="font-normal text-gray-500 ml-1">— {mergeTarget.totalSessions} séance{mergeTarget.totalSessions !== 1 ? 's' : ''}</span>
                        </p>
                        {mergeTarget.email && <p className="text-[11px] text-gray-500">{mergeTarget.email}</p>}
                        <p className="text-[11px] text-orange-700">
                          {mergeTarget.totalSessions} inscription{mergeTarget.totalSessions !== 1 ? 's' : ''} seront rattachée{mergeTarget.totalSessions !== 1 ? 's' : ''} à « {displayName(selected)} ».
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => setMergeTarget(null)} className="flex-1 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-100 transition">Changer</button>
                          <button onClick={handleMerge} disabled={merging}
                            className="flex-1 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-medium hover:bg-orange-700 transition disabled:opacity-50">
                            {merging ? 'Fusion…' : 'Confirmer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats bar */}
                <div className="grid grid-cols-4 border-b border-gray-100 divide-x divide-gray-100">
                  {[
                    { label: 'Séances', value: selected.totalSessions, color: 'text-gray-800' },
                    { label: 'Présent', value: selected.presentCount, color: 'text-green-600' },
                    { label: 'Absent', value: selected.absentCount, color: 'text-red-500' },
                    { label: 'Impayés', value: selected.pendingCount, color: 'text-orange-600' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-3 py-3 text-center">
                      <p className={`text-xl font-bold ${color}`}>{value}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Detail sub-tabs */}
                <div className="flex border-b border-gray-100">
                  {(['sessions', 'stats', 'notes'] as const).map((t) => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      className={`flex-1 py-2.5 text-xs font-semibold transition ${detailTab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
                      {t === 'sessions' ? 'Séances' : t === 'stats' ? 'Statistiques' : (
                        <span className="inline-flex items-center gap-1">
                          Notes
                          {selectedNotes.length > 0 && (
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-1.5 rounded-full">{selectedNotes.length}</span>
                          )}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Detail: Sessions list */}
                {detailTab === 'sessions' && (
                  <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
                    {selected.registrations
                      .slice().sort((a, b) => (sessions.get(b.sessionId)?.date?.toMillis() ?? 0) - (sessions.get(a.sessionId)?.date?.toMillis() ?? 0))
                      .map((r) => {
                        const sess = sessions.get(r.sessionId)
                        return (
                          <button key={r.id} onClick={() => router.push(`/admin/parcours-sportif/${r.sessionId}`)}
                            className="w-full flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50 transition text-left">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                              <CalendarIcon className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{sess?.title ?? '—'}</p>
                              <p className="text-[11px] text-gray-400 mb-1.5">{fmtDate(sess?.date)}</p>
                              <div className="flex gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${ATTENDANCE_COLORS[r.attendance] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {ATTENDANCE_LABELS[r.attendance] ?? r.attendance}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${PAYMENT_COLORS[r.paymentStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                                  {PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus}
                                </span>
                              </div>
                            </div>
                            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-2" />
                          </button>
                        )
                      })}
                  </div>
                )}

                {/* Detail: Participant stats */}
                {detailTab === 'stats' && participantStats && (
                  <div className="px-5 py-4 space-y-5 max-h-[420px] overflow-y-auto">
                    {/* Presence rate */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-600">Taux de présence</p>
                        <span className={`text-sm font-bold ${participantStats.presenceRate >= 70 ? 'text-green-600' : participantStats.presenceRate >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                          {participantStats.presenceRate}%
                        </span>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${participantStats.presenceRate >= 70 ? 'bg-green-500' : participantStats.presenceRate >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                          style={{ width: `${participantStats.presenceRate}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{selected.presentCount} présence{selected.presentCount !== 1 ? 's' : ''} sur {selected.totalSessions} séance{selected.totalSessions !== 1 ? 's' : ''}</p>
                    </div>

                    {/* By month */}
                    {Object.keys(participantStats.byMonth).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Mois les plus fréquentés</p>
                        <div className="space-y-1.5">
                          {MONTHS_SHORT.map((m, i) => {
                            const b = participantStats.byMonth[i]
                            if (!b) return null
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 w-10 shrink-0 text-right">{m}</span>
                                <MiniBar value={b.total} max={participantStats.maxMonth} colorClass={b.present === b.total ? 'bg-green-400' : b.present > 0 ? 'bg-blue-400' : 'bg-gray-300'} />
                                <span className="text-[11px] font-semibold text-gray-700 w-4 text-right shrink-0">{b.total}</span>
                                {b.present > 0 && <span className="text-[10px] text-green-600 shrink-0">{b.present}✓</span>}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* By day of week */}
                    {Object.keys(participantStats.byDow).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Jours préférés</p>
                        <div className="space-y-1.5">
                          {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                            const b = participantStats.byDow[dow]
                            if (!b) return null
                            return (
                              <div key={dow} className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 w-10 shrink-0 text-right">{DAYS_FR[dow]}</span>
                                <MiniBar value={b.total} max={participantStats.maxDow} colorClass="bg-purple-400" />
                                <span className="text-[11px] font-semibold text-gray-700 w-4 text-right shrink-0">{b.total}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* By year */}
                    {Object.keys(participantStats.byYear).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Par année</p>
                        <div className="space-y-1">
                          {Object.entries(participantStats.byYear).sort(([a], [b]) => Number(b) - Number(a)).map(([year, b]) => (
                            <div key={year} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600 font-semibold">{year}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">{b.total} séance{b.total !== 1 ? 's' : ''}</span>
                                {b.present > 0 && <span className="text-green-600">{b.present}✓</span>}
                                <span className="text-gray-400">({b.total > 0 ? Math.round((b.present / b.total) * 100) : 0}%)</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detail: Notes */}
                {detailTab === 'notes' && (
                  <div className="px-5 py-4 space-y-3 max-h-[460px] overflow-y-auto">
                    <button onClick={openAddNote}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-blue-300 hover:text-blue-600 transition">
                      <PlusIcon className="w-4 h-4" /> Ajouter une note
                    </button>
                    {selectedNotes.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <DocumentTextIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs">Aucune note pour ce participant</p>
                      </div>
                    ) : (
                      selectedNotes.map((n) => {
                        const expired = isNoteExpired(n)
                        const st = getParcoursNoteStyle(n.type_note)
                        const consumed = n.montantConsomme ?? 0
                        const remaining = noteRemaining(n)
                        return (
                          <div key={n.id} className={`rounded-xl border p-3 ${expired ? 'bg-white border-gray-200' : st.card}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${expired ? 'bg-gray-100 text-gray-500' : st.badge}`}>
                                  {n.type_note}
                                </span>
                                {n.montant != null && (
                                  consumed > 0 ? (
                                    remaining > 0 ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                        <BanknotesIcon className="w-3 h-3" /> {remaining}€ restants <span className="font-normal text-emerald-500">/ {n.montant}€</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                        <BanknotesIcon className="w-3 h-3" /> Soldée ({n.montant}€)
                                      </span>
                                    )
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                      <BanknotesIcon className="w-3 h-3" /> {n.montant}€
                                    </span>
                                  )
                                )}
                                {n.montantMethode && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/70 border border-emerald-200 text-emerald-600">
                                    {n.montantMethode === 'transfer' ? 'Virement' : 'Espèces'}
                                  </span>
                                )}
                                {expired && <span className="text-[10px] text-gray-400">Expirée</span>}
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditNote(n)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                                  <PencilIcon className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setDeleteNoteId(n.id)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                                  <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            {n.notes && <p className={`text-xs mt-1.5 whitespace-pre-wrap ${expired ? 'text-gray-500' : 'text-gray-800'}`}>{n.notes}</p>}
                            {n.applications && n.applications.length > 0 && (
                              <div className="mt-1.5 space-y-0.5">
                                {n.applications.map((a, i) => (
                                  <p key={i} className="text-[10px] text-emerald-700 flex items-center gap-1">
                                    <BanknotesIcon className="w-3 h-3 shrink-0" />
                                    {a.amount}€ appliqués{a.sessionDate ? ` — séance du ${a.sessionDate.toDate().toLocaleDateString('fr-FR')}` : ''}
                                  </p>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 flex-wrap">
                              {n.date_create && <span>Créée le {n.date_create.toDate().toLocaleDateString('fr-FR')}</span>}
                              {n.date_max_note_active && (
                                <span>· {expired ? 'Expirée le' : "Active jusqu'au"} {n.date_max_note_active.toDate().toLocaleDateString('fr-FR')}</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ TAB: STATISTIQUES ══ */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Participants uniques', value: participants.length, color: 'text-blue-600' },
              { label: 'Inscriptions actives', value: totalRegs, color: 'text-gray-800' },
              { label: 'Total présences', value: participants.reduce((s, p) => s + p.presentCount, 0), color: 'text-green-600' },
              { label: 'Impayés en cours', value: participants.reduce((s, p) => s + p.pendingCount, 0), color: 'text-orange-600' },
              { label: 'Avances en cours', value: `${totalAdvances}€`, color: 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Rankings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrophyIcon className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-bold text-gray-800">Classements</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Les plus assidus</p>
                <div className="space-y-0.5">
                  {stats.topSessions.map((p, i) => <RankRow key={p.key} rank={i} name={displayName(p)} value={p.totalSessions} unit="séances" />)}
                  {stats.topSessions.length === 0 && <p className="text-xs text-gray-400">Aucune donnée</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Les plus présents</p>
                <div className="space-y-0.5">
                  {stats.topPresent.map((p, i) => <RankRow key={p.key} rank={i} name={displayName(p)} value={p.presentCount} unit="présences" />)}
                  {stats.topPresent.length === 0 && <p className="text-xs text-gray-400">Aucune donnée</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Moins d'absences <span className="normal-case font-normal">(min 3 séances)</span></p>
                <div className="space-y-0.5">
                  {stats.leastAbsent.map((p, i) => <RankRow key={p.key} rank={i} name={displayName(p)} value={p.absentCount} unit={`abs. / ${p.totalSessions}`} />)}
                  {stats.leastAbsent.length === 0 && <p className="text-xs text-gray-400">Pas assez de données</p>}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Impayés en cours</p>
                <div className="space-y-0.5">
                  {stats.topPending.map((p, i) => <RankRow key={p.key} rank={i} name={displayName(p)} value={p.pendingCount} unit="impayé(s)" />)}
                  {stats.topPending.length === 0 && <p className="text-xs text-gray-400">Aucun impayé</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Note sur les ratios */}
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <ChartBarIcon className="w-3.5 h-3.5" />
            Les barres reflètent le ratio moyen d'inscriptions par séance. La valeur indique le total brut et la moyenne entre parenthèses.
          </p>

          {/* Distributions */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-1">Par mois</h2>
              <p className="text-[11px] text-gray-400 mb-3">Barres = moy. inscrits/séance · Valeur = total</p>
              {Object.keys(stats.byMonth).length === 0 ? <p className="text-xs text-gray-400">Aucune donnée</p> : (
                <div className="space-y-2">
                  {MONTHS_SHORT.map((m, i) => {
                    const b = stats.byMonth[i]
                    if (!b) return null
                    return <StatBar key={i} label={m} value={b.total} sessCount={stats.sessMonth[i]} maxRatio={stats.maxMonthRatio} colorClass="bg-blue-400" />
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-1">Par jour</h2>
              <p className="text-[11px] text-gray-400 mb-3">Barres = moy. inscrits/séance · Valeur = total</p>
              {Object.keys(stats.byDow).length === 0 ? <p className="text-xs text-gray-400">Aucune donnée</p> : (
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((i) => {
                    const b = stats.byDow[i]
                    if (!b) return null
                    return <StatBar key={i} label={DAYS_FR[i]} value={b.total} sessCount={stats.sessDow[i]} maxRatio={stats.maxDowRatio} colorClass="bg-purple-400" />
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-1">Par créneau horaire</h2>
              <p className="text-[11px] text-gray-400 mb-3">Barres = moy. inscrits/séance · Valeur = total</p>
              {Object.keys(stats.byHour).length === 0 ? <p className="text-xs text-gray-400">Aucune donnée</p> : (
                <div className="space-y-2">
                  {Array.from({ length: 24 }, (_, i) => i).map((h) => {
                    const b = stats.byHour[h]
                    if (!b) return null
                    return <StatBar key={h} label={`${String(h).padStart(2, '0')}h`} value={b.total} sessCount={stats.sessHour[h]} maxRatio={stats.maxHourRatio} colorClass="bg-green-400" />
                  })}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h2 className="text-sm font-bold text-gray-800 mb-4">Par année</h2>
              {Object.keys(stats.byYear).length === 0 ? <p className="text-xs text-gray-400">Aucune donnée</p> : (
                <div className="space-y-3">
                  {Object.entries(stats.byYear).sort(([a], [b]) => Number(b) - Number(a)).map(([year, b]) => {
                    const sessCount = stats.sessYear[Number(year)] ?? 0
                    return (
                      <div key={year} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">{year}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-500">{b.total} insc.</span>
                            <span className="text-green-600">{b.present} présences</span>
                            {sessCount > 0 && <span className="text-gray-400">{(b.total / sessCount).toFixed(1)}/séance</span>}
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${b.total > 0 ? Math.round((b.present / b.total) * 100) : 0}%` }} />
                        </div>
                        <p className="text-[10px] text-gray-400">{b.total > 0 ? Math.round((b.present / b.total) * 100) : 0}% de présence · {sessCount} séance{sessCount !== 1 ? 's' : ''}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal ajout / modification note */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title={editNote ? 'Modifier la note' : 'Nouvelle note'}>
        {selected && (
          <p className="text-xs text-gray-400 mb-3">Pour <span className="font-semibold text-gray-600">{displayName(selected)}</span></p>
        )}
        <form onSubmit={submitNote} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={noteForm.type_note} onChange={(e) => setNoteForm((f) => ({ ...f, type_note: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PARCOURS_NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Montant <span className="text-gray-400 font-normal">(€, optionnel)</span>
            </label>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={noteForm.montant}
              onChange={(e) => setNoteForm((f) => ({ ...f, montant: e.target.value }))}
              placeholder="ex : 50"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {noteForm.type_note === PAYMENT_NOTE_TYPE && (
              <p className="text-[11px] text-emerald-600 mt-1">Comptabilisé dans les avances en cours tant que la note est active.</p>
            )}
          </div>

          {noteForm.type_note === PAYMENT_NOTE_TYPE && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Moyen de paiement</label>
              <div className="flex gap-2">
                {([['cash', 'Espèces'], ['transfer', 'Virement']] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setNoteForm((f) => ({ ...f, montantMethode: val }))}
                    className={`flex-1 text-sm font-medium px-3 py-2 rounded-lg border transition ${noteForm.montantMethode === val ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea value={noteForm.notes} onChange={(e) => setNoteForm((f) => ({ ...f, notes: e.target.value }))}
              rows={4} placeholder="ex : a payé 50€ en espèces pour le prochain parcours"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date d'expiration <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            <input type="date" value={noteForm.date_max_note_active}
              onChange={(e) => setNoteForm((f) => ({ ...f, date_max_note_active: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowNoteModal(false)} disabled={savingNote}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
            <button type="submit" disabled={savingNote}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {savingNote ? 'Enregistrement…' : editNote ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression note */}
      <Modal isOpen={!!deleteNoteId} onClose={() => setDeleteNoteId(null)} title="Supprimer cette note ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteNoteId(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
          <button onClick={confirmDeleteNote}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">Supprimer</button>
        </div>
      </Modal>
    </div>
  )
}
