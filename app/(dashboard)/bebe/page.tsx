'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useBebe } from '@/hooks/useBebe'
import { useBebeEvents } from '@/hooks/useBebeEvents'
import { StoreGate } from '@/components/ui/StoreGate'
import Modal from '@/components/ui/Modal'
import { Trash2, Pencil, Plus, Star, Moon, CalendarDays, LayoutList, Camera, Play } from 'lucide-react'
import { Milk, Pill, Baby } from 'lucide-react'
import { Timestamp } from 'firebase/firestore'
import { uploadImage } from '@/lib/uploadImage'
import type { BebeEvent, BebeEventType } from '@/types'

// ─── Icône couche (SVG custom rempli — aucun équivalent dans lucide) ──────────

function DiaperIcon({ size = 24, className }: { size?: number; className?: string }) {
  // Couche stylisée vue de face : trapèze arrondi pincé à la taille
  return (
    <svg width={size} height={size} className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.2 5.5C3.2 4.7 3.9 4 4.7 4h14.6c.8 0 1.5.7 1.5 1.5 0 4.4-2.7 7-5.4 7.4-.9 2.6-2 4.6-3.4 4.6s-2.5-2-3.4-4.6C5.9 12.5 3.2 9.9 3.2 5.5z" opacity="0.92" />
      <path d="M8.5 8.2c.6 1.2 1.9 2 3.5 2s2.9-.8 3.5-2" fill="none" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const EVENT_ICONS: Record<BebeEventType, React.ElementType> = {
  bottle: Milk,
  diaper: DiaperIcon,
  sleep:  Moon,
  meds:   Pill,
}

const EVENT_LABELS: Record<BebeEventType, string> = {
  bottle: 'Biberon',
  diaper: 'Couche',
  sleep:  'Sommeil',
  meds:   'Médicament',
}

const EVENT_COLORS: Record<BebeEventType, { bg: string; text: string }> = {
  bottle: { bg: 'bg-sky-100',    text: 'text-sky-600'    },
  diaper: { bg: 'bg-teal-100',   text: 'text-teal-600'   },
  sleep:  { bg: 'bg-indigo-100', text: 'text-indigo-600' },
  meds:   { bg: 'bg-rose-100',   text: 'text-rose-600'   },
}

const MEDS_SUGGESTIONS = [
  { name: 'Doliprane nourrisson',  dose: '2.5 ml' },
  { name: 'Doliprane nourrisson',  dose: '5 ml'   },
  { name: 'Efferalgan nourrisson', dose: '2.5 ml' },
  { name: 'Advil nourrisson',      dose: '2.5 ml' },
  { name: 'Advil nourrisson',      dose: '5 ml'   },
  { name: 'Spasfon',               dose: '1 suppositoire' },
  { name: 'Smecta',                dose: '1 sachet' },
  { name: 'Maalox nourrisson',     dose: '5 ml'   },
  { name: 'Lactobacillus',         dose: '5 gouttes' },
  { name: 'Vitamine D (Zymad)',    dose: '1 goutte' },
  { name: 'Vitamine D (Adrigyl)',  dose: '1 goutte' },
  { name: 'Physiomer nourrisson',  dose: '1 jet/narine' },
  { name: 'Rhinathiol nourrisson', dose: '2.5 ml' },
  { name: 'Dafalgan pédiatrique',  dose: '5 ml'   },
  { name: 'Homéopathie dentition', dose: '1 dose' },
]

const STORAGE_KEY = 'bebe_primary_id'

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function formatTime(ts: Timestamp): string {
  return ts?.toDate?.().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) ?? '—'
}

function timeAgo(ts: Timestamp): string {
  const ms = ts?.toDate?.()?.getTime?.()
  if (!ms) return ''
  const d = Math.floor((Date.now() - ms) / 60_000)
  if (d < 1)  return "à l'instant"
  if (d < 60) return `il y a ${d}min`
  const h = Math.floor(d / 60), m = d % 60
  return m > 0 ? `il y a ${h}h${m}min` : `il y a ${h}h`
}

function formatDuration(min: number): string {
  if (min <= 0)  return '0min'
  if (min < 60)  return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function getBabyAge(birthDate: Timestamp): string {
  const b = birthDate?.toDate?.()
  if (!b) return ''
  const days = Math.floor((Date.now() - b.getTime()) / 86_400_000)
  if (days < 7)  return `${days}j`
  const w = Math.floor(days / 7)
  if (w < 8)     return `${w} sem.`
  const mo = Math.floor(days / 30.44)
  if (mo < 24)   return `${mo} mois`
  return `${Math.floor(mo / 12)} ans`
}

function nowTimeStr(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function timeStrToTs(s: string): Timestamp {
  const [h, m] = s.split(':').map(Number)
  const d = new Date(); d.setHours(h, m, 0, 0)
  return Timestamp.fromDate(d)
}

function addMin(s: string, minutes: number): string {
  const [h, m] = s.split(':').map(Number)
  const t = h * 60 + m + minutes
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function tsToTimeStr(ts: Timestamp): string {
  const d = ts?.toDate?.()
  if (!d) return nowTimeStr()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function dayKey(d: Date): string { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
function dayLabel(d: Date): string {
  const today = new Date(); today.setHours(0,0,0,0)
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1)
  const dm    = new Date(d); dm.setHours(0,0,0,0)
  if (dm.getTime() === today.getTime()) return "Aujourd'hui"
  if (dm.getTime() === yest.getTime())  return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eventDescription(type: BebeEventType, data: Record<string, any>): string {
  switch (type) {
    case 'bottle': {
      const k: Record<string, string> = { biberon: 'Biberon', sein_g: 'Sein G.', sein_d: 'Sein D.', tire_lait: 'Tire-lait' }
      return [data.amount ? `${data.amount} ml` : null, data.kind ? k[data.kind] ?? data.kind : null].filter(Boolean).join(' · ') || 'Biberon'
    }
    case 'diaper': {
      const k: Record<string, string> = { seche: 'Sèche', urine: 'Urine', selles: 'Selles', mixte: 'Mixte' }
      return k[data.kind] ?? 'Couche'
    }
    case 'sleep': {
      const dur   = data.durationMin ? formatDuration(data.durationMin) : null
      const start = data.startTime   ? formatTime(data.startTime as Timestamp) : null
      return dur && start ? `${dur} · depuis ${start}` : (dur ?? 'Sommeil')
    }
    case 'meds':
      return [data.name, data.dose].filter(Boolean).join(' · ') || 'Médicament'
  }
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, bg, tc }: {
  icon: React.ElementType; label: string; value: string; sub?: string; bg: string; tc: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${bg}`}>
        <Icon size={18} className={tc} />
      </div>
      <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}

function ModalFooter({ onCancel, onSave, saving, label = 'Enregistrer', disabled = false }: {
  onCancel: () => void; onSave: () => void; saving: boolean; label?: string; disabled?: boolean
}) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
      <button onClick={onSave} disabled={saving || disabled}
        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">
        {saving ? '…' : label}
      </button>
    </div>
  )
}

/** Sélecteur de photo rond avec aperçu */
function PhotoPicker({ preview, onPick }: { preview: string; onPick: (file: File) => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <label className="relative cursor-pointer group">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-sky-100 flex items-center justify-center border-2 border-gray-100 group-hover:border-sky-300 transition">
          {preview
            ? <img src={preview} alt="" className="w-full h-full object-cover" />
            : <Baby size={36} className="text-sky-400" />
          }
        </div>
        <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-md group-hover:bg-blue-700 transition">
          <Camera size={14} />
        </div>
        <input type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f) }} />
      </label>
      <span className="text-xs text-gray-400">Photo (optionnelle)</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BebePage() {
  const { currentUser } = useAuth()
  const { babies, loading: loadingBabies, addBebe, updateBebe, deleteBabeWithEvents } = useBebe(currentUser?.uid)

  // ── Sélection + bébé principal ────────────────────────────────────────────
  const [selectedBabyId, setSelectedBabyId] = useState<string | null>(null)
  const [primaryId, setPrimaryId] = useState<string | null>(null)

  useEffect(() => { try { setPrimaryId(localStorage.getItem(STORAGE_KEY)) } catch {} }, [])

  useEffect(() => {
    if (!babies.length) return
    if (selectedBabyId && babies.some(b => b.id === selectedBabyId)) return
    const pref = babies.find(b => b.id === primaryId) ?? babies[0]
    setSelectedBabyId(pref.id)
  }, [babies, primaryId, selectedBabyId])

  const selectedBaby = babies.find(b => b.id === selectedBabyId) ?? null
  const { events, addEvent, updateEvent, deleteEvent } = useBebeEvents(selectedBabyId)

  const markAsPrimary = (id: string) => {
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
    setPrimaryId(id); setSelectedBabyId(id)
  }

  // ── Vue ───────────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'dashboard' | 'planning'>('dashboard')
  const [planningRange, setPlanningRange] = useState<'7j' | '30j'>('7j')

  // ── Timer sommeil actif ───────────────────────────────────────────────────
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!selectedBaby?.activeSleep) return
    const iv = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(iv)
  }, [selectedBaby?.activeSleep])
  void tick

  const sleepElapsedMin = selectedBaby?.activeSleep
    ? Math.max(0, Math.floor((Date.now() - (selectedBaby.activeSleep.startTime?.toMillis?.() ?? Date.now())) / 60_000))
    : 0

  // ── Ajout / édition bébé ──────────────────────────────────────────────────
  const [showAddBabyModal, setShowAddBabyModal] = useState(false)
  const [addBabyForm, setAddBabyForm] = useState({ name: '', birthDate: '' })
  const [addPhotoFile, setAddPhotoFile] = useState<File | null>(null)
  const [addPhotoPreview, setAddPhotoPreview] = useState<string>('')
  const [savingAdd, setSavingAdd] = useState(false)

  const handleAddBebe = async () => {
    if (!currentUser || !addBabyForm.name.trim() || !addBabyForm.birthDate) return
    setSavingAdd(true)
    try {
      const [y, m, d] = addBabyForm.birthDate.split('-').map(Number)
      let photoUrl: string | undefined
      if (addPhotoFile) {
        photoUrl = await uploadImage(addPhotoFile, `users/${currentUser.uid}/bebe_photos/${Date.now()}_${addPhotoFile.name}`)
      }
      const ref = await addBebe({
        name: addBabyForm.name.trim(),
        birthDate: Timestamp.fromDate(new Date(y, m - 1, d)),
        members: [currentUser.uid],
        createdBy: currentUser.uid,
        ...(photoUrl ? { photoUrl } : {}),
      })
      const newId = (ref as any)?.id
      if (newId) setSelectedBabyId(newId)
      setShowAddBabyModal(false)
      setAddBabyForm({ name: '', birthDate: '' })
      setAddPhotoFile(null); setAddPhotoPreview('')
    } finally { setSavingAdd(false) }
  }

  const [showEditBabyModal, setShowEditBabyModal] = useState(false)
  const [editBabyForm, setEditBabyForm] = useState({ name: '', birthDate: '' })
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string>('')
  const [savingEditBaby, setSavingEditBaby] = useState(false)

  const openEditBaby = () => {
    if (!selectedBaby) return
    const b = selectedBaby.birthDate?.toDate?.()
    setEditBabyForm({ name: selectedBaby.name, birthDate: b ? b.toISOString().split('T')[0] : '' })
    setEditPhotoFile(null)
    setEditPhotoPreview(selectedBaby.photoUrl ?? '')
    setShowEditBabyModal(true)
  }

  const handleSaveEditBaby = async () => {
    if (!selectedBabyId || !editBabyForm.name.trim() || !editBabyForm.birthDate) return
    setSavingEditBaby(true)
    try {
      const [y, m, d] = editBabyForm.birthDate.split('-').map(Number)
      let photoUrl = selectedBaby?.photoUrl
      if (editPhotoFile && currentUser) {
        photoUrl = await uploadImage(editPhotoFile, `users/${currentUser.uid}/bebe_photos/${Date.now()}_${editPhotoFile.name}`)
      }
      await updateBebe(selectedBabyId, {
        name: editBabyForm.name.trim(),
        birthDate: Timestamp.fromDate(new Date(y, m - 1, d)),
        ...(photoUrl ? { photoUrl } : {}),
      })
      setShowEditBabyModal(false)
      setEditPhotoFile(null); setEditPhotoPreview('')
    } finally { setSavingEditBaby(false) }
  }

  // ── Suppression bébé ──────────────────────────────────────────────────────
  const [showDeleteBabyConfirm, setShowDeleteBabyConfirm] = useState(false)
  const [deletingBaby, setDeletingBaby] = useState(false)

  const handleDeleteBaby = async () => {
    if (!selectedBabyId) return
    setDeletingBaby(true)
    try {
      await deleteBabeWithEvents(selectedBabyId)
      setSelectedBabyId(null)
      setShowDeleteBabyConfirm(false)
      // Retirer du localStorage si c'était le principal
      if (selectedBabyId === primaryId) { try { localStorage.removeItem(STORAGE_KEY) } catch {}; setPrimaryId(null) }
    } finally { setDeletingBaby(false) }
  }

  // ── Sommeil actif ─────────────────────────────────────────────────────────
  const handleStartSleep = async () => {
    if (!selectedBabyId) return
    await updateBebe(selectedBabyId, { activeSleep: { startTime: Timestamp.now() } })
  }

  const handleWakeUp = async () => {
    if (!currentUser || !selectedBabyId || !selectedBaby?.activeSleep) return
    const startTs = selectedBaby.activeSleep.startTime
    const endTs   = Timestamp.now()
    const durationMin = Math.max(1, Math.floor((endTs.toMillis() - startTs.toMillis()) / 60_000))
    await addEvent({ type: 'sleep', data: { startTime: startTs, durationMin }, timestamp: endTs, createdBy: currentUser.uid })
    await updateBebe(selectedBabyId, { activeSleep: null })
  }

  // ── Modales événements ────────────────────────────────────────────────────
  const [modalType,    setModalType]    = useState<BebeEventType | null>(null)
  const [editingEvent, setEditingEvent] = useState<BebeEvent | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [savingEvent,   setSavingEvent]   = useState(false)

  const [bottleForm, setBottleForm] = useState({ amount: '120', kind: 'biberon' })
  const [diaperForm, setDiaperForm] = useState({ kind: 'urine' })
  const [sleepForm,  setSleepForm]  = useState({ startTime: nowTimeStr(), endTime: nowTimeStr() })
  const [medsForm,   setMedsForm]   = useState({ name: '', dose: '' })
  const [medsSearch, setMedsSearch] = useState('')

  const openNewModal = (type: BebeEventType) => {
    setEditingEvent(null)
    if (type === 'bottle') setBottleForm({ amount: '120', kind: 'biberon' })
    if (type === 'diaper') setDiaperForm({ kind: 'urine' })
    if (type === 'sleep')  setSleepForm({ startTime: nowTimeStr(), endTime: nowTimeStr() })
    if (type === 'meds')   { setMedsForm({ name: '', dose: '' }); setMedsSearch('') }
    setModalType(type)
  }

  const openEditModal = (event: BebeEvent) => {
    setEditingEvent(event)
    if (event.type === 'bottle') setBottleForm({ amount: String(event.data?.amount ?? 120), kind: event.data?.kind ?? 'biberon' })
    if (event.type === 'diaper') setDiaperForm({ kind: event.data?.kind ?? 'urine' })
    if (event.type === 'sleep') {
      const startStr = event.data?.startTime ? tsToTimeStr(event.data.startTime as Timestamp) : nowTimeStr()
      const endStr   = tsToTimeStr(event.timestamp)
      setSleepForm({ startTime: startStr, endTime: endStr })
    }
    if (event.type === 'meds') { setMedsForm({ name: event.data?.name ?? '', dose: event.data?.dose ?? '' }); setMedsSearch('') }
    setModalType(event.type)
  }

  const closeModal = () => { setModalType(null); setEditingEvent(null) }

  const handleSaveEvent = async () => {
    if (!currentUser || !modalType) return
    setSavingEvent(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: Record<string, any> = {}
      let ts = Timestamp.now()

      if (modalType === 'bottle') {
        data = { amount: Number(bottleForm.amount) || 0, kind: bottleForm.kind }
      } else if (modalType === 'diaper') {
        data = { kind: diaperForm.kind }
      } else if (modalType === 'sleep') {
        const startTs   = timeStrToTs(sleepForm.startTime)
        const endTs     = timeStrToTs(sleepForm.endTime)
        let durationMin = Math.floor((endTs.toMillis() - startTs.toMillis()) / 60_000)
        if (durationMin < 0) durationMin += 24 * 60
        data = { startTime: startTs, durationMin }; ts = endTs
      } else if (modalType === 'meds') {
        data = { name: medsForm.name.trim(), dose: medsForm.dose.trim() }
      }

      if (editingEvent) {
        await updateEvent(editingEvent.id, { type: modalType, data, timestamp: ts, createdBy: currentUser.uid })
      } else {
        await addEvent({ type: modalType, data, timestamp: ts, createdBy: currentUser.uid })
      }
      closeModal()
    } finally { setSavingEvent(false) }
  }

  // ── Données calculées ─────────────────────────────────────────────────────
  const todayEvents = useMemo(() => {
    const t = new Date(); t.setHours(0,0,0,0)
    return events.filter(e => { const d = e.timestamp?.toDate?.(); return d && d >= t })
  }, [events])

  const todayStats = useMemo(() => {
    const b = todayEvents.filter(e => e.type === 'bottle')
    const d = todayEvents.filter(e => e.type === 'diaper')
    const s = todayEvents.filter(e => e.type === 'sleep')
    return {
      bottleCount: b.length,
      bottleMl: b.reduce((n, e) => n + ((e.data?.amount as number) ?? 0), 0),
      diaperCount: d.length,
      sleepMin: s.reduce((n, e) => n + ((e.data?.durationMin as number) ?? 0), 0),
    }
  }, [todayEvents])

  const bottlePrediction = useMemo(() => {
    const b = events.filter(e => e.type === 'bottle').sort((a, z) => (z.timestamp?.seconds ?? 0) - (a.timestamp?.seconds ?? 0))
    if (b.length < 2) return null
    const r = b.slice(0, 5)
    const intervals = r.slice(0, -1).map((e, i) => ((e.timestamp?.seconds ?? 0) - (r[i+1].timestamp?.seconds ?? 0)) / 60)
    const avgMin = Math.round(intervals.reduce((s, v) => s + v, 0) / intervals.length)
    const predictedMs = (b[0].timestamp?.seconds ?? 0) * 1000 + avgMin * 60_000
    return { predictedAt: new Date(predictedMs), avgIntervalMin: avgMin, lastBottle: b[0], diffMin: Math.floor((predictedMs - Date.now()) / 60_000) }
  }, [events])

  // Planning : regroupement par jour
  const planningDays = useMemo(() => {
    const days = planningRange === '7j' ? 7 : 30
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days); cutoff.setHours(0,0,0,0)
    const filtered = events.filter(e => { const d = e.timestamp?.toDate?.(); return d && d >= cutoff })
    const groups: Record<string, { label: string; date: Date; events: BebeEvent[] }> = {}
    filtered.forEach(e => {
      const d = e.timestamp?.toDate?.(); if (!d) return
      const k = dayKey(d)
      if (!groups[k]) groups[k] = { label: dayLabel(d), date: d, events: [] }
      groups[k].events.push(e)
    })
    return Object.values(groups).sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [events, planningRange])

  const filteredMeds = MEDS_SUGGESTIONS.filter(m => !medsSearch.trim() || m.name.toLowerCase().includes(medsSearch.toLowerCase()))

  // ─── Rendu ────────────────────────────────────────────────────────────────

  if (loadingBabies) {
    return (
      <StoreGate appRoute="/bebe">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </StoreGate>
    )
  }

  // ── Écran de création (premier bébé) ──────────────────────────────────────
  if (babies.length === 0) {
    return (
      <StoreGate appRoute="/bebe">
        <div className="max-w-sm mx-auto pt-8 px-2">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Baby size={32} className="text-sky-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Suivi Bébé</h1>
            <p className="text-sm text-gray-500 mt-1">Commencez par ajouter votre bébé</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <PhotoPicker
              preview={addPhotoPreview}
              onPick={(file) => { setAddPhotoFile(file); setAddPhotoPreview(URL.createObjectURL(file)) }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" placeholder="Emma, Léo…" value={addBabyForm.name}
                onChange={e => setAddBabyForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
              <input type="date" value={addBabyForm.birthDate}
                onChange={e => setAddBabyForm(f => ({ ...f, birthDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button onClick={handleAddBebe} disabled={savingAdd || !addBabyForm.name.trim() || !addBabyForm.birthDate}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm transition">
              {savingAdd ? 'Création…' : 'Créer le profil'}
            </button>
          </div>
        </div>
      </StoreGate>
    )
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  return (
    <StoreGate appRoute="/bebe">
      <div className="space-y-5">

        {/* En-tête */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-sky-100 flex items-center justify-center shrink-0 border border-gray-100">
              {selectedBaby?.photoUrl
                ? <img src={selectedBaby.photoUrl} alt={selectedBaby.name} className="w-full h-full object-cover" />
                : <Baby size={24} className="text-sky-600" />
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-800">{selectedBaby?.name}</h1>
                {babies.length > 1 && (
                  <button onClick={() => selectedBabyId && markAsPrimary(selectedBabyId)}
                    title={selectedBabyId === primaryId ? 'Bébé principal' : 'Définir comme principal'}>
                    <Star size={14} className={selectedBabyId === primaryId ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300 hover:text-yellow-400 transition'} />
                  </button>
                )}
              </div>
              {selectedBaby?.birthDate && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {getBabyAge(selectedBaby.birthDate)} · né le {selectedBaby.birthDate.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {babies.length > 1 && (
              <select value={selectedBabyId ?? ''} onChange={e => setSelectedBabyId(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {babies.map(b => <option key={b.id} value={b.id}>{b.id === primaryId ? '★ ' : ''}{b.name}</option>)}
              </select>
            )}
            <button onClick={openEditBaby} title="Modifier" className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition">
              <Pencil size={16} />
            </button>
            <button onClick={() => { setAddBabyForm({ name: '', birthDate: '' }); setAddPhotoFile(null); setAddPhotoPreview(''); setShowAddBabyModal(true) }} title="Ajouter un bébé"
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
              <Plus size={16} />
            </button>
            <button onClick={() => setShowDeleteBabyConfirm(true)} title="Supprimer ce bébé"
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {/* Onglets vue */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[{ key: 'dashboard', icon: LayoutList, label: "Aujourd'hui" }, { key: 'planning', icon: CalendarDays, label: 'Planning' }].map(v => {
            const Icon = v.icon
            return (
              <button key={v.key} onClick={() => setViewMode(v.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === v.key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <Icon size={15} />{v.label}
              </button>
            )
          })}
        </div>

        {/* ═══ VUE AUJOURD'HUI ═══ */}
        {viewMode === 'dashboard' && (
          <>
            {/* Sommeil actif */}
            {selectedBaby?.activeSleep && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                      <Moon size={18} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-indigo-800">{selectedBaby.name} dort</p>
                      <p className="text-xs text-indigo-600">
                        Depuis {formatTime(selectedBaby.activeSleep.startTime)}
                        {sleepElapsedMin > 0 && ` · ${formatDuration(sleepElapsedMin)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => updateBebe(selectedBabyId!, { activeSleep: null })}
                      className="text-xs text-indigo-400 hover:text-indigo-600 px-2 py-1 transition">
                      Annuler
                    </button>
                    <button onClick={handleWakeUp}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition">
                      Réveillé !
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Prochain biberon */}
            {bottlePrediction && (() => {
              const { diffMin, predictedAt, avgIntervalMin, lastBottle } = bottlePrediction
              const ov = diffMin < 0, sn = !ov && diffMin < 30
              const card  = ov ? 'bg-red-50 border-red-200' : sn ? 'bg-orange-50 border-orange-200' : 'bg-sky-50 border-sky-200'
              const tc    = ov ? 'text-red-700' : sn ? 'text-orange-700' : 'text-sky-700'
              const ic    = ov ? 'bg-red-100' : sn ? 'bg-orange-100' : 'bg-sky-100'
              const itc   = ov ? 'text-red-500' : sn ? 'text-orange-500' : 'text-sky-500'
              const msg   = ov ? `En retard de ${formatDuration(-diffMin)}` : diffMin < 5 ? 'Maintenant !' : `Dans ${formatDuration(diffMin)}`
              return (
                <div className={`rounded-2xl border p-4 ${card}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${ic}`}>
                      <Milk size={18} className={itc} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${tc}`}>Prochain biberon — {msg}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Vers {predictedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}Moy. {formatDuration(avgIntervalMin)}
                        {' · '}Dernier {formatTime(lastBottle.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Stats */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={Milk}   label="Biberons" value={String(todayStats.bottleCount)} sub={todayStats.bottleMl > 0 ? `${todayStats.bottleMl} ml` : undefined} bg="bg-sky-100"    tc="text-sky-600" />
                <StatCard icon={DiaperIcon} label="Couches" value={String(todayStats.diaperCount)} bg="bg-teal-100" tc="text-teal-600" />
                <StatCard icon={Moon}   label="Sommeil"  value={todayStats.sleepMin > 0 ? formatDuration(todayStats.sleepMin) : '—'} bg="bg-indigo-100" tc="text-indigo-600" />
              </div>
            </div>

            {/* 4 boutons rapides + Start sommeil */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ajouter</p>
              <div className="grid grid-cols-4 gap-2">
                {(['bottle', 'diaper', 'sleep', 'meds'] as BebeEventType[]).map(type => {
                  const Icon = EVENT_ICONS[type]
                  const c    = EVENT_COLORS[type]
                  return (
                    <button key={type} onClick={() => openNewModal(type)}
                      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex flex-col items-center gap-2 hover:shadow-md hover:border-blue-200 transition active:scale-95">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.bg}`}>
                        <Icon size={18} className={c.text} />
                      </div>
                      <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">{EVENT_LABELS[type]}</span>
                    </button>
                  )
                })}
              </div>
              {!selectedBaby?.activeSleep && (
                <button onClick={handleStartSleep}
                  className="mt-2 w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-2xl py-2.5 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition">
                  <Moon size={16} />
                  Commencer le sommeil maintenant
                </button>
              )}
            </div>

            {/* Timeline */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Timeline · {todayEvents.length} événement{todayEvents.length !== 1 ? 's' : ''}
              </p>
              {todayEvents.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                  <Milk size={32} className="text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Aucun événement aujourd'hui</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayEvents.map(event => {
                    const Icon = EVENT_ICONS[event.type]
                    const c    = EVENT_COLORS[event.type]
                    return (
                      <div key={event.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.bg}`}>
                          <Icon size={16} className={c.text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {EVENT_LABELS[event.type]}
                            {' '}<span className="font-normal text-gray-500">{eventDescription(event.type, event.data ?? {})}</span>
                          </p>
                          <p className="text-xs text-gray-400">{formatTime(event.timestamp)} · {timeAgo(event.timestamp)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => openEditModal(event)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirm(event.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ═══ VUE PLANNING ═══ */}
        {viewMode === 'planning' && (
          <>
            {/* Sélecteur plage */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {[{ k: '7j', l: '7 derniers jours' }, { k: '30j', l: '30 derniers jours' }].map(r => (
                <button key={r.k} onClick={() => setPlanningRange(r.k as any)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${planningRange === r.k ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                  {r.l}
                </button>
              ))}
            </div>

            {planningDays.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <CalendarDays size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune donnée sur cette période</p>
              </div>
            ) : (
              <div className="space-y-3">
                {planningDays.map(({ label: dl, events: dayEvts }) => {
                  const bottles = dayEvts.filter(e => e.type === 'bottle')
                  const diapers = dayEvts.filter(e => e.type === 'diaper')
                  const sleeps  = dayEvts.filter(e => e.type === 'sleep')
                  const meds    = dayEvts.filter(e => e.type === 'meds')
                  const totalMl  = bottles.reduce((n, e) => n + ((e.data?.amount as number) ?? 0), 0)
                  const sleepMin = sleeps.reduce((n, e) => n + ((e.data?.durationMin as number) ?? 0), 0)
                  return (
                    <div key={dl} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-700 capitalize">{dl}</p>
                        <p className="text-xs text-gray-400">{dayEvts.length} événement{dayEvts.length !== 1 ? 's' : ''}</p>
                      </div>
                      <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {bottles.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center shrink-0">
                              <Milk size={14} className="text-sky-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Biberons</p>
                              <p className="text-sm font-semibold text-gray-800">{bottles.length} · {totalMl} ml</p>
                            </div>
                          </div>
                        )}
                        {diapers.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
                              <DiaperIcon size={14} className="text-teal-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Couches</p>
                              <p className="text-sm font-semibold text-gray-800">{diapers.length}</p>
                            </div>
                          </div>
                        )}
                        {sleeps.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                              <Moon size={14} className="text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Sommeil</p>
                              <p className="text-sm font-semibold text-gray-800">{formatDuration(sleepMin)}</p>
                            </div>
                          </div>
                        )}
                        {meds.length > 0 && (
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center shrink-0">
                              <Pill size={14} className="text-rose-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Médicaments</p>
                              <p className="text-sm font-semibold text-gray-800 truncate max-w-[100px]">
                                {[...new Set(meds.map(e => e.data?.name).filter(Boolean))].join(', ') || String(meds.length)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Timeline du jour (détail) */}
                      <div className="px-4 pb-3 space-y-1.5 border-t border-gray-50 pt-2">
                        {dayEvts.map(event => {
                          const Icon = EVENT_ICONS[event.type]
                          const c    = EVENT_COLORS[event.type]
                          return (
                            <div key={event.id} className="flex items-center gap-2.5">
                              <span className="text-xs text-gray-400 w-10 shrink-0">{formatTime(event.timestamp)}</span>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                                <Icon size={12} className={c.text} />
                              </div>
                              <span className="text-xs text-gray-600 flex-1 min-w-0 truncate">
                                {EVENT_LABELS[event.type]} · {eventDescription(event.type, event.data ?? {})}
                              </span>
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => openEditModal(event)} className="p-1 text-gray-300 hover:text-blue-500 transition"><Pencil size={12} /></button>
                                <button onClick={() => setDeleteConfirm(event.id)} className="p-1 text-gray-300 hover:text-red-500 transition"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* ── Modale Biberon ──────────────────────────────────────────────────── */}
      <Modal isOpen={modalType === 'bottle'} onClose={closeModal} title={editingEvent ? 'Modifier — Biberon' : 'Biberon'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantité (ml)</label>
            <input type="number" min={0} step={5} value={bottleForm.amount}
              onChange={e => setBottleForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-1.5 mt-2">
              {[60, 90, 120, 150, 180, 210].map(ml => (
                <button key={ml} type="button" onClick={() => setBottleForm(f => ({ ...f, amount: String(ml) }))}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition ${bottleForm.amount === String(ml) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600'}`}>
                  {ml}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'biberon', l: 'Biberon' }, { v: 'sein_g', l: 'Sein gauche' }, { v: 'sein_d', l: 'Sein droit' }, { v: 'tire_lait', l: 'Tire-lait' }].map(o => (
                <button key={o.v} type="button" onClick={() => setBottleForm(f => ({ ...f, kind: o.v }))}
                  className={`px-3 py-2.5 rounded-xl text-sm border transition text-left ${bottleForm.kind === o.v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSaveEvent} saving={savingEvent} label={editingEvent ? 'Enregistrer' : 'Ajouter'} />
        </div>
      </Modal>

      {/* ── Modale Couche ───────────────────────────────────────────────────── */}
      <Modal isOpen={modalType === 'diaper'} onClose={closeModal} title={editingEvent ? 'Modifier — Couche' : 'Couche'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {[{ v: 'seche', l: 'Sèche' }, { v: 'urine', l: 'Urine' }, { v: 'selles', l: 'Selles' }, { v: 'mixte', l: 'Mixte' }].map(o => (
              <button key={o.v} type="button" onClick={() => setDiaperForm({ kind: o.v })}
                className={`px-3 py-3 rounded-xl text-sm border transition text-left ${diaperForm.kind === o.v ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'}`}>
                {o.l}
              </button>
            ))}
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSaveEvent} saving={savingEvent} label={editingEvent ? 'Enregistrer' : 'Ajouter'} />
        </div>
      </Modal>

      {/* ── Modale Sommeil ──────────────────────────────────────────────────── */}
      <Modal isOpen={modalType === 'sleep'} onClose={closeModal} title={editingEvent ? 'Modifier — Sommeil' : 'Sommeil'}>
        <div className="space-y-4">
          {/* Démarrer un sommeil en direct (uniquement en création, si aucun en cours) */}
          {!editingEvent && !selectedBaby?.activeSleep && (
            <>
              <button
                onClick={async () => { await handleStartSleep(); closeModal() }}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition">
                <Play size={16} />
                Commencer le sommeil maintenant
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">ou saisir manuellement</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
              <input type="time" value={sleepForm.startTime} onChange={e => setSleepForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input type="time" value={sleepForm.endTime} onChange={e => setSleepForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {sleepForm.startTime && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">Raccourcis durée</p>
              <div className="flex gap-1.5 flex-wrap">
                {[30, 60, 90, 120, 150, 180, 240].map(min => (
                  <button key={min} type="button" onClick={() => setSleepForm(f => ({ ...f, endTime: addMin(f.startTime, min) }))}
                    className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition font-mono">
                    +{min < 60 ? `${min}min` : `${min/60}h`}
                  </button>
                ))}
                <button type="button" onClick={() => setSleepForm(f => ({ ...f, endTime: nowTimeStr() }))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 transition">
                  Maintenant
                </button>
              </div>
            </div>
          )}
          {sleepForm.startTime && sleepForm.endTime && (() => {
            const [sh, sm] = sleepForm.startTime.split(':').map(Number)
            const [eh, em] = sleepForm.endTime.split(':').map(Number)
            let diff = (eh * 60 + em) - (sh * 60 + sm)
            if (diff < 0) diff += 24 * 60
            return (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-center">
                <p className="text-sm font-semibold text-indigo-700">Durée : {formatDuration(diff)}</p>
              </div>
            )
          })()}
          <ModalFooter onCancel={closeModal} onSave={handleSaveEvent} saving={savingEvent} label={editingEvent ? 'Enregistrer' : 'Ajouter'} />
        </div>
      </Modal>

      {/* ── Modale Médicament ───────────────────────────────────────────────── */}
      <Modal isOpen={modalType === 'meds'} onClose={closeModal} title={editingEvent ? 'Modifier — Médicament' : 'Médicament'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Suggestions</label>
            <input type="text" placeholder="Rechercher…" value={medsSearch} onChange={e => setMedsSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2" />
            <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-50">
              {filteredMeds.map((s, i) => (
                <button key={i} type="button" onClick={() => { setMedsForm({ name: s.name, dose: s.dose }); setMedsSearch('') }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition ${medsForm.name === s.name && medsForm.dose === s.dose ? 'bg-blue-50' : ''}`}>
                  <span className="text-sm text-gray-800">{s.name}</span>
                  {s.dose && <span className="text-xs text-gray-400 ml-2">{s.dose}</span>}
                </button>
              ))}
              {filteredMeds.length === 0 && <p className="text-sm text-gray-400 px-3 py-2 italic">Aucun résultat</p>}
            </div>
          </div>
          <div className="border-t border-dashed border-gray-200 pt-3 space-y-2">
            <p className="text-xs font-medium text-gray-500">Saisie personnalisée</p>
            <input type="text" placeholder="Nom du médicament" value={medsForm.name} onChange={e => setMedsForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input type="text" placeholder="Dose (ex : 5 ml, 1 suppositoire…)" value={medsForm.dose} onChange={e => setMedsForm(f => ({ ...f, dose: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <ModalFooter onCancel={closeModal} onSave={handleSaveEvent} saving={savingEvent} disabled={!medsForm.name.trim()} label={editingEvent ? 'Enregistrer' : 'Ajouter'} />
        </div>
      </Modal>

      {/* ── Modale Ajouter bébé ─────────────────────────────────────────────── */}
      <Modal isOpen={showAddBabyModal} onClose={() => setShowAddBabyModal(false)} title="Ajouter un bébé">
        <div className="space-y-4">
          <PhotoPicker
            preview={addPhotoPreview}
            onPick={(file) => { setAddPhotoFile(file); setAddPhotoPreview(URL.createObjectURL(file)) }}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input type="text" placeholder="Emma, Léo…" value={addBabyForm.name} onChange={e => setAddBabyForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
            <input type="date" value={addBabyForm.birthDate} onChange={e => setAddBabyForm(f => ({ ...f, birthDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <ModalFooter onCancel={() => setShowAddBabyModal(false)} onSave={handleAddBebe} saving={savingAdd} label="Créer" disabled={!addBabyForm.name.trim() || !addBabyForm.birthDate} />
        </div>
      </Modal>

      {/* ── Modale Éditer bébé ──────────────────────────────────────────────── */}
      <Modal isOpen={showEditBabyModal} onClose={() => setShowEditBabyModal(false)} title={`Modifier — ${selectedBaby?.name}`}>
        <div className="space-y-4">
          <PhotoPicker
            preview={editPhotoPreview}
            onPick={(file) => { setEditPhotoFile(file); setEditPhotoPreview(URL.createObjectURL(file)) }}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input type="text" value={editBabyForm.name} onChange={e => setEditBabyForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
            <input type="date" value={editBabyForm.birthDate} onChange={e => setEditBabyForm(f => ({ ...f, birthDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <ModalFooter onCancel={() => setShowEditBabyModal(false)} onSave={handleSaveEditBaby} saving={savingEditBaby} disabled={!editBabyForm.name.trim() || !editBabyForm.birthDate} />
        </div>
      </Modal>

      {/* ── Confirmation suppression bébé ──────────────────────────────────── */}
      <Modal isOpen={showDeleteBabyConfirm} onClose={() => setShowDeleteBabyConfirm(false)} title="Supprimer le bébé" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-red-700">Attention — action irréversible</p>
            <p className="text-xs text-red-600 mt-0.5">
              Supprimer <strong>{selectedBaby?.name}</strong> effacera définitivement tous ses biberons, couches, sommeils et médicaments.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowDeleteBabyConfirm(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleDeleteBaby} disabled={deletingBaby}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">
              {deletingBaby ? 'Suppression…' : 'Supprimer tout'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Confirmation suppression événement ─────────────────────────────── */}
      <Modal isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer l'événement" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Confirmer la suppression de cet événement ?</p>
          <div className="flex gap-3">
            <button onClick={() => setDeleteConfirm(null)}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={async () => { if (deleteConfirm) { await deleteEvent(deleteConfirm); setDeleteConfirm(null) } }}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium transition">
              Supprimer
            </button>
          </div>
        </div>
      </Modal>

    </StoreGate>
  )
}
