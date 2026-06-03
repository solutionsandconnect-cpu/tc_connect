'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Timestamp, doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePlanning } from '@/hooks/usePlanning'
import { useUsers } from '@/hooks/useUsers'
import { useClients } from '@/hooks/useClients'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import AdresseAutocomplete from '@/components/ui/AdresseAutocomplete'
import MaterielSelect from '@/components/ui/MaterielSelect'
import { formatDate, formatHeure, isSameDay } from '@/lib/planningUtils'
import {
  PlusIcon, ChevronLeftIcon, ChevronRightIcon,
  MagnifyingGlassIcon, MapPinIcon, GlobeAltIcon,
  PencilIcon, TrashIcon, CalendarIcon, XMarkIcon, UserIcon,
  BoltIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { useActivites } from '@/hooks/useActivites'

const ETATS = ['Non calé', 'Calé', 'Annulé', 'Effectué']

// Map : linkedUserId (UID du compte client) → liste des périodes d'abonnement
export type AboPeriods = Record<string, { id: string; start: number; end: number }[]>

function getRdvUserId(p: any): string | null {
  return p?.ref_users?.id || p?.ref_users?.path?.split('/').pop() ||
    (typeof p?.ref_users === 'string' ? p.ref_users.split('/').pop() : null) ||
    p?.ref_client?.id || p?.ref_client?.path?.split('/').pop() || null
}

// Clé de regroupement d'un RDV : son client + l'abonnement (par période de dates) auquel il appartient.
// Bornes de journée — pour comparer par jour (et non à la milliseconde près),
// afin qu'un RDV le jour même de la date de début d'abonnement soit bien compté.
export const startOfDayMs = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime() }
export const endOfDayMs = (ms: number) => { const d = new Date(ms); d.setHours(23, 59, 59, 999); return d.getTime() }

// On se base uniquement sur la collection "abonnements" et les dates — pas sur refDatabaseUser/abonnementId.
function getRdvGroupKey(p: any, aboPeriods: AboPeriods): string | null {
  const userId = getRdvUserId(p)
  if (!userId) return null
  const periods = aboPeriods[userId]
  if (!periods || periods.length === 0) return null
  const ms = startOfDayMs((p?.date_planning?.seconds ?? 0) * 1000)
  const match = periods.find((per) => ms >= per.start && ms <= per.end)
  return match ? `${userId}:${match.id}` : null
}

function getRdvSequence(item: any, plannings: any[], aboPeriods: AboPeriods) {
  const key = getRdvGroupKey(item, aboPeriods)
  if (!key) return null
  const type = item.type_planning || 'Séance'
  const group = plannings
    .filter((p) => getRdvGroupKey(p, aboPeriods) === key && (p.type_planning || 'Séance') === type)
    .sort((a, b) => {
      const dateDiff = (a.date_planning?.seconds ?? 0) - (b.date_planning?.seconds ?? 0)
      if (dateDiff !== 0) return dateDiff
      return (a.heure_planning_debut?.seconds ?? 0) - (b.heure_planning_debut?.seconds ?? 0)
    })
  const idx = group.findIndex((p) => p.id === item.id)
  if (idx === -1 || group.length <= 1) return null
  return { index: idx + 1, total: group.length }
}

const TYPES_RDV = [
  { groupe: 'TC', options: ['Séance', 'Programme', 'Rendez-vous informations', 'Rendez-vous bilan', 'Règlement TC', 'Séance en autonomie', 'Autre activité', 'Parcours sportif'] },
  { groupe: 'S&C', options: ['Rendez-vous infos S&C', 'Rendez-vous bilan S&C', 'Règlement S&C'] },
  { groupe: 'FFD', options: ['Détection', 'Règlement FFD'] },
  { groupe: 'EMF', options: ['Séminaire', 'Règlement EMF'] },
]

const MATERIEL_DEFAUT = ['Sac', 'Tapis', 'Enceinte', 'Chrono']

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`)
    const data = await res.json()
    const coords = data.features?.[0]?.geometry?.coordinates
    if (!coords) return null
    return { lat: coords[1], lng: coords[0] }
  } catch { return null }
}

async function calculateRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<{ distanceKm: number; duration: string }> {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`)
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error('Pas de route trouvée')
  const km = Math.round(route.distance / 100) / 10
  const mins = Math.round(route.duration / 60)
  const duration = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}` : `${mins} min`
  return { distanceKm: km, duration }
}

const TYPES_ACTIVITE = [
  'Course à pied', 'Marche', 'Vélo', 'Natation', 'Musculation', 'Yoga', 'Pilates',
  'Football', 'Tennis', 'Basket', 'Rugby', 'Randonnée', 'Ski', 'Surf',
  'Arts martiaux', 'Boxe', 'CrossFit', 'HIIT', 'Étirements', 'Autre',
]

// Activity types that have a meaningful distance
const ACTIVITE_HAS_DISTANCE = new Set([
  'Course à pied', 'Marche', 'Vélo', 'Natation', 'Randonnée', 'Ski', 'Surf',
])

function ActiviteTypeDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = value.trim()
    ? TYPES_ACTIVITE.filter((t) => t.toLowerCase().includes(value.toLowerCase()))
    : TYPES_ACTIVITE

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        placeholder="Ex : Course à pied, Natation..."
        required
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length > 0 ? filtered.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onChange(t); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition ${value === t ? 'bg-green-50 font-medium text-green-700' : 'text-gray-700'}`}
            >
              {t}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-gray-400 italic">Entrée libre acceptée</div>
          )}
        </div>
      )}
    </div>
  )
}

const emptyActiviteForm = {
  clientId: '',
  type_activite: '',
  date: '',
  heure_debut: '',
  heure_fin: '',
  distance_km: '',
  calories: '',
  notes: '',
}

function getEtatBadgeLocal(etat: string) {
  switch (etat) {
    case 'Calé':    return { label: 'Calé',    variant: 'success' as const }
    case 'Non calé':return { label: 'Non calé',variant: 'warning' as const }
    case 'Annulé':  return { label: 'Annulé',  variant: 'danger'  as const }
    case 'Effectué':return { label: 'Effectué',variant: 'info'    as const }
    default:        return { label: etat || '—',variant: 'gray'   as const }
  }
}

// Couleur du point pour la vue mensuelle
function dotColor(etat: string) {
  switch (etat) {
    case 'Calé':    return 'bg-green-500'
    case 'Non calé':return 'bg-yellow-400'
    case 'Annulé':  return 'bg-red-400'
    case 'Effectué':return 'bg-gray-400'
    default:        return 'bg-gray-300'
  }
}

const emptyForm = {
  ref_client: '',
  date: '',
  heure_debut: '',
  heure_fin: '',
  adresse_rdv: '',
  etat_planning_rdv: 'Non calé',
  observations_rdv: '',
  type_planning: 'Séance',
  mode_rdv: 'Présentiel',
  materiel: [] as string[],
  abonnement_id: '',
  participants_supplementaires: [] as { ref_client: string; ref_database_user: string }[],
  distance_km: null as number | null,
  temps_route: '',
}

type ViewMode = 'semaine' | 'mois'

export default function PlanningPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentUser, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  useEffect(() => {
    if (userProfile && !isAdmin && userProfile.droits?.planning === false) {
      router.replace('/accueil')
    }
  }, [userProfile, isAdmin, router])

  const { plannings, loading, addPlanning, updatePlanning, deletePlanning } = usePlanning()
  const { users } = useUsers()
  const { clients } = useClients()
  const { activites, addActivite, updateActivite, deleteActivite } = useActivites(isAdmin)

  // Normalise un linkedUserId qui peut être "uid", "users/uid" ou une référence { id }
  const normUid = (v: any): string | null => {
    if (!v) return null
    if (typeof v === 'string') return v.includes('/') ? v.split('/').pop() ?? null : v
    return v.id ?? v.path?.split('/').pop() ?? null
  }

  // Charger tous les abonnements du coach
  const [allAbos, setAllAbos] = useState<any[]>([])
  useEffect(() => {
    if (!currentUser) return
    getDocs(query(collection(db, 'abonnements'), where('userId', '==', currentUser.uid)))
      .then((snap) => setAllAbos(snap.docs.map((d) => ({ id: d.id, ...d.data() as any }))))
      .catch(() => setAllAbos([]))
  }, [currentUser])

  // Abonnements indexés par identifiant client : on indexe chaque abonnement
  // par le linkedUserId du client ET par l'id du client lui-même. Ainsi, quel que
  // soit l'identifiant sélectionné dans le planning (UID app ou id client), et même
  // si plusieurs fiches clients pointent vers le même user, on retrouve tous ses abonnements.
  const abosByUserId = useMemo<Record<string, any[]>>(() => {
    // Email du compte app → UID (filet de secours si linkedUserId absent)
    const emailToUid: Record<string, string> = {}
    users.forEach((u) => { const e = (u as any).email?.toLowerCase?.(); if (e) emailToUid[e] = u.id })
    // clientId → liste des UID app (via linkedUserId ET email)
    const clientToUids: Record<string, string[]> = {}
    clients.forEach((c) => {
      const set = new Set<string>()
      const lu = normUid((c as any).linkedUserId); if (lu) set.add(lu)
      const ce = (c as any).email?.toLowerCase?.(); if (ce && emailToUid[ce]) set.add(emailToUid[ce])
      clientToUids[c.id] = [...set]
    })
    const map: Record<string, any[]> = {}
    const push = (key: string, a: any) => { if (!map[key]) map[key] = []; if (!map[key].some((x) => x.id === a.id)) map[key].push(a) }
    allAbos.forEach((a) => {
      if (!a.clientId) return
      push(a.clientId, a)                            // sélection directe par id client
      ;(clientToUids[a.clientId] ?? []).forEach((uid) => push(uid, a))  // par UID app (linkedUserId ou email)
    })
    Object.values(map).forEach((list) => list.sort((x, y) => (x.dateDebut?.toMillis?.() ?? 0) - (y.dateDebut?.toMillis?.() ?? 0)))
    return map
  }, [allAbos, clients, users])

  // Périodes d'abonnement (pour le compteur de RDV), même indexation
  const aboPeriods = useMemo<AboPeriods>(() => {
    const map: AboPeriods = {}
    Object.entries(abosByUserId).forEach(([key, abos]) => {
      map[key] = abos.map((a) => ({
        id: a.id,
        start: a.dateDebut?.toMillis ? startOfDayMs(a.dateDebut.toMillis()) : 0,
        end: a.dateFin?.toMillis ? endOfDayMs(a.dateFin.toMillis()) : Infinity,
      }))
    })
    return map
  }, [abosByUserId])

  const today = new Date()
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = searchParams.get('date')
    if (d) { const parsed = new Date(d + 'T12:00:00'); if (!isNaN(parsed.getTime())) return parsed }
    return new Date()
  })
  const [view, setView] = useState<ViewMode>('semaine')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [searchClient, setSearchClient] = useState('')
  const [form, setForm] = useState({ ...emptyForm, materiel: [...MATERIEL_DEFAUT] })

  const clientAbonnements = useMemo<any[]>(() => {
    if (!form.ref_client) return []
    let list = abosByUserId[form.ref_client] ?? []
    // Fallback 1 : RDV déjà lié à un abonnement → lister tous les abos de ce client
    if (list.length === 0 && (editItem as any)?.abonnementId) {
      const abo = allAbos.find((a) => a.id === (editItem as any).abonnementId)
      if (abo) list = allAbos.filter((a) => a.clientId === abo.clientId)
    }
    // Fallback 2 : matcher par nom complet du compte sélectionné
    if (list.length === 0) {
      const u = users.find((x) => x.id === form.ref_client)
      if (u) {
        const fullName = [u.nom, u.prenom].filter(Boolean).join(' ').toLowerCase().trim()
        if (fullName) {
          const ids = new Set(clients.filter((c) => [c.nom, c.prenom].filter(Boolean).join(' ').toLowerCase().trim() === fullName).map((c) => c.id))
          list = allAbos.filter((a) => ids.has(a.clientId))
        }
      }
    }
    return [...list].sort((x, y) => (x.dateDebut?.toMillis?.() ?? 0) - (y.dateDebut?.toMillis?.() ?? 0))
  }, [form.ref_client, abosByUserId, editItem, allAbos, users, clients])

  // Ouvrir le modal "Nouveau RDV" avec client pré-sélectionné si ?client=<uid> dans l'URL
  useEffect(() => {
    const clientUid = searchParams.get('client')
    if (!clientUid || !users.length) return
    const d = new Date()
    setEditItem(null)
    setForm({
      ...emptyForm,
      ref_client: clientUid,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      materiel: [...MATERIEL_DEFAUT],
    })
    setShowModal(true)
    // Nettoyer le param de l'URL sans rechargement
    router.replace('/planning', { scroll: false })
  }, [searchParams.get('client'), users.length])

  const [calcDistance, setCalcDistance] = useState(false)
  const [showActiviteModal, setShowActiviteModal] = useState(false)
  const [activiteForm, setActiviteForm] = useState({ ...emptyActiviteForm })
  const [editActiviteItem, setEditActiviteItem] = useState<import('@/hooks/useActivites').Activite | null>(null)
  const [searchActiviteClient, setSearchActiviteClient] = useState('')
  const [deleteActiviteConfirm, setDeleteActiviteConfirm] = useState<string | null>(null)
  const [afficherActivites, setAfficherActivites] = useState(true)

  const [extraDetails, setExtraDetails] = useState<Record<string, any[]>>({})
  const [newParticipant, setNewParticipant] = useState({ ref_client: '', ref_database_user: '' })
  const [searchNewParticipant, setSearchNewParticipant] = useState('')

  const loadExtraDetails = async (clientId: string) => {
    if (!clientId || extraDetails[clientId]) return
    try {
      const snap = await getDocs(query(
        collection(db, 'database_users_details'),
        where('refUsers', '==', doc(db, 'users', clientId))
      ))
      setExtraDetails((prev) => ({ ...prev, [clientId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }))
    } catch {}
  }

  const filteredUsersExtra = useMemo(() => {
    if (!searchNewParticipant) return users
    const s = searchNewParticipant.toLowerCase()
    return users.filter((u) =>
      [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s) ||
      (u.email?.toLowerCase().includes(s) ?? false)
    )
  }, [users, searchNewParticipant])

  const filteredUsers = useMemo(() => {
    if (!searchClient) return users
    const s = searchClient.toLowerCase()
    return users.filter((u) =>
      [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    )
  }, [users, searchClient])

  const handleClientChange = (clientId: string) => {
    const client = users.find((u) => u.id === clientId)
    setForm({ ...form, ref_client: clientId, adresse_rdv: (client as any)?.adresse_postale || form.adresse_rdv, abonnement_id: '' })
  }

  // ── Vue semaine ────────────────────────────────────────────────
  const startOfWeek = new Date(selectedDate)
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  // ── Vue mensuelle ──────────────────────────────────────────────
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  const gridStart = new Date(monthStart)
  const dow = monthStart.getDay()
  gridStart.setDate(gridStart.getDate() - (dow === 0 ? 6 : dow - 1))
  const monthGrid = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(gridStart.getDate() + i)
    return d
  })

  // Navigation
  const goBack = () => {
    const d = new Date(selectedDate)
    if (view === 'semaine') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setSelectedDate(d)
  }
  const goForward = () => {
    const d = new Date(selectedDate)
    if (view === 'semaine') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setSelectedDate(d)
  }
  const goToday = () => setSelectedDate(new Date())

  const tsMs = (ts: any): number => {
    if (!ts) return 0
    if (typeof ts.toDate === 'function') return ts.toDate().getTime()
    if (typeof ts.seconds === 'number') return ts.seconds * 1000
    return 0
  }

  // Plannings du jour sélectionné, triés par heure de début
  const planningsDuJour = plannings
    .filter((p) => p.date_planning && isSameDay(p.date_planning as any, selectedDate))
    .slice()
    .sort((a, b) => tsMs((a as any).heure_planning_debut) - tsMs((b as any).heure_planning_debut))

  const activitesDuJour = activites.filter(
    (a) => a.date_activite && isSameDay(a.date_activite as any, selectedDate)
  ).sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))

  // Liste fusionnée RDV + activités, triée par heure de début (ordre chronologique réel)
  const minutesOfDay = (hhmm?: string) => {
    const [h, m] = (hhmm || '00:00').split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  const dayItems: ({ kind: 'rdv'; sortKey: number; rdv: typeof planningsDuJour[number] }
                 | { kind: 'act'; sortKey: number; act: typeof activitesDuJour[number] })[] = [
    ...planningsDuJour.map((p) => {
      const d = (p as any).heure_planning_debut?.toDate?.() as Date | undefined
      return { kind: 'rdv' as const, sortKey: d ? d.getHours() * 60 + d.getMinutes() : 0, rdv: p }
    }),
    ...(afficherActivites
      ? activitesDuJour.map((a) => ({ kind: 'act' as const, sortKey: minutesOfDay(a.heure_debut), act: a }))
      : []),
  ].sort((x, y) => x.sortKey - y.sortKey)

  const filteredActiviteUsers = useMemo(() => {
    if (!searchActiviteClient) return users
    const s = searchActiviteClient.toLowerCase()
    return users.filter((u) => [u.nom, u.prenom].filter(Boolean).join(" ").toLowerCase().includes(s) || u.email?.toLowerCase().includes(s))
  }, [users, searchActiviteClient])

  const openEditActivite = (act: import('@/hooks/useActivites').Activite) => {
    setEditActiviteItem(act)
    const d = act.date_activite.toDate()
    setActiviteForm({
      clientId: act.clientId,
      type_activite: act.type_activite,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      heure_debut: act.heure_debut,
      heure_fin: act.heure_fin,
      distance_km: act.distance_km != null ? String(act.distance_km) : '',
      calories: act.calories != null ? String(act.calories) : '',
      notes: act.notes ?? '',
    })
    setSearchActiviteClient('')
    setShowActiviteModal(true)
  }

  const handleActiviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser || !activiteForm.type_activite || !activiteForm.date) return
    const [y, mo, d] = activiteForm.date.split('-').map(Number)

    if (editActiviteItem) {
      await updateActivite(editActiviteItem.id, {
        clientId: activiteForm.clientId,
        type_activite: activiteForm.type_activite,
        date_activite: Timestamp.fromDate(new Date(y, mo - 1, d)),
        heure_debut: activiteForm.heure_debut,
        heure_fin: activiteForm.heure_fin,
        distance_km: activiteForm.distance_km ? Number(activiteForm.distance_km) : null,
        calories: activiteForm.calories ? Number(activiteForm.calories) : null,
        notes: activiteForm.notes || undefined,
      })
    } else {
      const clientName = users.find((u) => u.id === activiteForm.clientId)
      await addActivite({
        userId: currentUser.uid,
        clientId: activiteForm.clientId,
        type_activite: activiteForm.type_activite,
        date_activite: Timestamp.fromDate(new Date(y, mo - 1, d)),
        heure_debut: activiteForm.heure_debut,
        heure_fin: activiteForm.heure_fin,
        distance_km: activiteForm.distance_km ? Number(activiteForm.distance_km) : null,
        calories: activiteForm.calories ? Number(activiteForm.calories) : null,
        notes: activiteForm.notes || undefined,
        date_create: Timestamp.now(),
      })
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title: 'Nouvelle activité enregistrée',
          body: `${clientName ? [clientName.nom, clientName.prenom].filter(Boolean).join(" ") : 'Un client'} · ${activiteForm.type_activite}${activiteForm.distance_km ? ` · ${activiteForm.distance_km} km` : ''}`,
          url: '/planning',
        }),
      }).catch(() => {})
    }
    setShowActiviteModal(false)
    setActiviteForm({ ...emptyActiviteForm })
    setEditActiviteItem(null)
  }

  // Plannings par jour (pour les points)
  const planningsForDay = (day: Date) =>
    plannings.filter((p) => p.date_planning && isSameDay(p.date_planning as any, day))

  const activitesForDay = (day: Date) =>
    activites.filter((a) => a.date_activite && isSameDay(a.date_activite as any, day))

  const openAdd = () => {
    setEditItem(null)
    setSearchClient('')
    setNewParticipant({ ref_client: '', ref_database_user: '' })
    setSearchNewParticipant('')
    const d = selectedDate
    setForm({ ...emptyForm, date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, materiel: [...MATERIEL_DEFAUT] })
    setShowModal(true)
  }

  const openEdit = (item: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditItem(item)
    setSearchClient('')
    setNewParticipant({ ref_client: '', ref_database_user: '' })
    setSearchNewParticipant('')
    const date = item.date_planning?.toDate()
    const debut = item.heure_planning_debut?.toDate()
    const fin = item.heure_planning_fin?.toDate()
    const existingParts = ((item.participants_supplementaires as any[]) || []).map((p: any) => ({
      ref_client: p.ref_users?.id || p.ref_users?.path?.split('/').pop() || (typeof p.ref_users === 'string' ? p.ref_users.split('/').pop() : '') || '',
      ref_database_user: p.ref_database_user?.id || p.ref_database_user?.path?.split('/').pop() || '',
    }))
    existingParts.forEach((p) => { if (p.ref_client) loadExtraDetails(p.ref_client) })
    setForm({
      ref_client: item.ref_users?.id || item.ref_users?.path?.split('/').pop() || (typeof item.ref_users === 'string' ? item.ref_users.split('/').pop() : '') || item.ref_client?.id || item.ref_client?.path?.split('/').pop() || '',
      date: date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : '',
      heure_debut: debut ? `${String(debut.getHours()).padStart(2,'0')}:${String(debut.getMinutes()).padStart(2,'0')}` : '',
      heure_fin: fin ? `${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}` : '',
      adresse_rdv: item.adresse_rdv || '',
      etat_planning_rdv: item.etat_planning_rdv || 'Non calé',
      observations_rdv: item.observations_rdv || '',
      type_planning: item.type_planning || 'Séance',
      mode_rdv: item.mode_rdv || 'Présentiel',
      materiel: Array.isArray(item.materiel) ? item.materiel : item.materiel ? [item.materiel] : [...MATERIEL_DEFAUT],
      abonnement_id: (item as any).abonnementId || '',
      participants_supplementaires: existingParts,
      distance_km: (item as any).distance_km ?? null,
      temps_route: (item as any).temps_route || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const [year, month, day] = form.date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const [hDebut, mDebut] = form.heure_debut.split(':').map(Number)
    const [hFin, mFin] = form.heure_fin.split(':').map(Number)
    const dateDebut = new Date(dateObj); dateDebut.setHours(hDebut, mDebut, 0)
    const dateFin = new Date(dateObj); dateFin.setHours(hFin, mFin, 0)
    const payload: any = {
      rdv_cree_par: doc(db, 'users', currentUser.uid),
      date_planning: Timestamp.fromDate(dateObj),
      heure_planning_debut: Timestamp.fromDate(dateDebut),
      heure_planning_fin: Timestamp.fromDate(dateFin),
      adresse_rdv: form.adresse_rdv,
      etat_planning_rdv: form.etat_planning_rdv,
      observations_rdv: form.observations_rdv,
      type_planning: form.type_planning,
      mode_rdv: form.mode_rdv,
      materiel: form.materiel,
    }
    if (!editItem) {
      payload.rdv_pret = ''
      payload.rdv_effectue = ''
      payload.questionnaire_rempli = false
      payload.date_create = Timestamp.now()
    }
    if (form.ref_client) {
      const clientRef = doc(db, 'users', form.ref_client)
      payload.ref_users = clientRef
      payload.ref_client = clientRef
    } else if (!editItem) {
      payload.ref_users = null
    }
    if (form.distance_km != null) payload.distance_km = form.distance_km
    if (form.temps_route) payload.temps_route = form.temps_route
    if (form.abonnement_id) payload.abonnementId = form.abonnement_id
    payload.participants_supplementaires = form.participants_supplementaires
      .filter((p) => p.ref_client)
      .map((p) => ({
        ref_users: doc(db, 'users', p.ref_client),
        ...(p.ref_database_user ? { ref_database_user: doc(db, 'database_users_details', p.ref_database_user) } : {}),
      }))
    if (editItem) await updatePlanning(editItem.id, payload)
    else {
      await addPlanning(payload)
      if (form.ref_client) {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: form.ref_client,
            title: 'Nouveau RDV',
            body: 'Un nouveau rendez-vous vous a été programmé.',
            url: '/planning',
          }),
        }).catch(() => {})
      }
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deletePlanning(id)
    setShowDeleteConfirm(null)
  }

  const handleCalculateDistance = async () => {
    if (!form.adresse_rdv) return
    setCalcDistance(true)
    try {
      const coachAddr = (userProfile as any)?.adresse_postale || (userProfile as any)?.rue_adresse
      if (!coachAddr) throw new Error('Adresse coach introuvable (configurez votre profil)')
      const [coachCoords, destCoords] = await Promise.all([
        geocodeAddress(coachAddr),
        geocodeAddress(form.adresse_rdv),
      ])
      if (!coachCoords) throw new Error('Impossible de géolocaliser votre adresse')
      if (!destCoords) throw new Error('Impossible de géolocaliser l\'adresse du RDV')
      const { distanceKm, duration } = await calculateRoute(coachCoords.lat, coachCoords.lng, destCoords.lat, destCoords.lng)
      setForm((f) => ({ ...f, distance_km: distanceKm, temps_route: duration }))
    } catch (e: any) {
      alert(e.message ?? 'Erreur lors du calcul de la distance')
    } finally {
      setCalcDistance(false)
    }
  }

  const navLabel = view === 'semaine'
    ? startOfWeek.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    : selectedDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  const isThisMonth = selectedDate.getMonth() === today.getMonth() && selectedDate.getFullYear() === today.getFullYear()
  const isThisWeek = weekDays.some((d) => d.toDateString() === today.toDateString())

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Planning</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const d = selectedDate
              setEditActiviteItem(null)
              setActiviteForm({
                ...emptyActiviteForm,
                date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
                clientId: isAdmin ? '' : (currentUser?.uid || ''),
              })
              setSearchActiviteClient('')
              setShowActiviteModal(true)
            }}
            className="flex items-center gap-1.5 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 text-sm font-medium px-3 py-2 rounded-lg transition"
          >
            <BoltIcon className="w-4 h-4" />
            Activité
          </button>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <PlusIcon className="w-4 h-4" />
              RDV
            </button>
          )}
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">

        {/* Barre de contrôles */}
        <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
          {/* Navigation */}
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0">
              <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
            </button>
            <span className="text-sm font-medium text-gray-700 capitalize w-28 sm:w-36 text-center truncate">
              {navLabel}
            </span>
            <button onClick={goForward} className="p-1.5 rounded-lg hover:bg-gray-100 transition shrink-0">
              <ChevronRightIcon className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Aujourd'hui + toggle vue */}
          <div className="flex items-center gap-2 shrink-0">
            {selectedDate.toDateString() !== today.toDateString() && (
              <button
                onClick={goToday}
                className="text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                Aujourd'hui
              </button>
            )}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              {(['semaine', 'mois'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
                    view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {v === 'semaine' ? 'Semaine' : 'Mois'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Vue Semaine ── */}
        {view === 'semaine' && (
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => {
              const isSelected = day.toDateString() === selectedDate.toDateString()
              const isToday = day.toDateString() === today.toDateString()
              const dayPlannings = planningsForDay(day)
              const dayActivites = activitesForDay(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex flex-col items-center py-2 rounded-xl transition ${
                    isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  <span className="text-xs">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                  <span className="text-sm font-semibold">{day.getDate()}</span>
                  {(dayPlannings.length > 0 || dayActivites.length > 0) && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayPlannings.slice(0, 3).map((p, i) => (
                        <div key={`r${i}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : dotColor((p as any).etat_planning_rdv)}`} />
                      ))}
                      {dayActivites.slice(0, 2).map((_, i) => (
                        <div key={`a${i}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/70' : 'bg-purple-500'}`} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Vue Mensuelle ── */}
        {view === 'mois' && (
          <div>
            {/* Entêtes jours */}
            <div className="grid grid-cols-7 mb-1">
              {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
                <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
              ))}
            </div>
            {/* Grille */}
            <div className="grid grid-cols-7 gap-px">
              {monthGrid.map((day) => {
                const isCurrentMonth = day.getMonth() === selectedDate.getMonth()
                const isSelected = day.toDateString() === selectedDate.toDateString()
                const isToday = day.toDateString() === today.toDateString()
                const dayPlannings = planningsForDay(day)
                const dayActivites = activitesForDay(day)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`flex flex-col items-center py-1.5 rounded-xl transition min-h-[52px] ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : isToday
                        ? 'bg-blue-50 text-blue-600'
                        : isCurrentMonth
                        ? 'hover:bg-gray-50 text-gray-700'
                        : 'hover:bg-gray-50 text-gray-300'
                    }`}
                  >
                    <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday && !isSelected ? 'font-bold' : ''
                    }`}>
                      {day.getDate()}
                    </span>
                    {(dayPlannings.length > 0 || dayActivites.length > 0) && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[32px]">
                        {dayPlannings.slice(0, 3).map((p, i) => (
                          <div key={`r${i}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/80' : dotColor((p as any).etat_planning_rdv)}`} />
                        ))}
                        {dayActivites.slice(0, 2).map((_, i) => (
                          <div key={`a${i}`} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/60' : 'bg-purple-500'}`} />
                        ))}
                        {(dayPlannings.length + dayActivites.length) > 5 && (
                          <span className={`text-[9px] leading-none ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                            +{dayPlannings.length + dayActivites.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Liste RDV + Activités du jour sélectionné */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {formatDate(Timestamp.fromDate(selectedDate))} — {planningsDuJour.length} RDV{activitesDuJour.length > 0 ? ` · ${activitesDuJour.length} activité${activitesDuJour.length > 1 ? 's' : ''}` : ''}
          </h2>
          {activitesDuJour.length > 0 && (
            <button onClick={() => setAfficherActivites((v) => !v)}
              className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap shrink-0 px-2.5 py-1 rounded-lg border transition ${
                afficherActivites
                  ? 'text-purple-700 border-purple-200 bg-purple-50 hover:bg-purple-100'
                  : 'text-gray-500 border-gray-200 bg-white hover:bg-gray-50'
              }`}>
              <BoltIcon className="w-3.5 h-3.5" />
              {afficherActivites ? 'Masquer les activités' : 'Afficher les activités'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Chargement...</div>
        ) : planningsDuJour.length === 0 && activitesDuJour.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Aucun RDV ce jour</p>
              <p className="text-xs text-gray-400 mt-0.5">Planifiez un rendez-vous pour cette date</p>
            </div>
            {isAdmin && (
              <button
                onClick={openAdd}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition shadow-sm"
              >
                <PlusIcon className="w-4 h-4" />
                Nouveau RDV
              </button>
            )}
          </div>
        ) : (
          dayItems.map((di) => {
            // ── Carte Activité ──
            if (di.kind === 'act') {
              const act = di.act
              // Résolution du nom : par clientId, sinon par userId (cas des activités Parcours Sportif)
              const client = users.find((u) => u.id === act.clientId)
                ?? users.find((u) => u.id === act.userId || u.uid === act.userId)
              const canModify = isAdmin || act.userId === currentUser?.uid
              return (
                <div key={act.id} className="bg-green-50 rounded-2xl border border-green-200 shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <BoltIcon className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-sm font-semibold text-green-800">{act.type_activite}</span>
                        {act.heure_debut && (
                          <span className="text-xs text-green-600">{act.heure_debut}{act.heure_fin ? ` → ${act.heure_fin}` : ''}</span>
                        )}
                      </div>
                      {isAdmin && client && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-4 h-4 rounded-full bg-green-200 text-green-700 flex items-center justify-center shrink-0">
                            <UserIcon className="w-3 h-3" />
                          </div>
                          <p className="text-xs text-green-700 font-medium">{client.nom} {client.prenom}</p>
                        </div>
                      )}
                      {(act.distance_km != null && act.distance_km > 0 || act.calories) && (
                        <p className="text-xs text-green-600 mt-0.5">
                          {act.distance_km != null && act.distance_km > 0 && `📍 ${act.distance_km} km`}
                          {act.distance_km != null && act.distance_km > 0 && act.calories ? ' · ' : ''}
                          {act.calories ? `🔥 ${act.calories} kcal` : ''}
                        </p>
                      )}
                      {act.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">{act.notes}</p>
                      )}
                    </div>
                    {canModify && (
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEditActivite(act)} className="p-1.5 text-gray-400 hover:text-blue-500 transition" title="Modifier">
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteActiviteConfirm(act.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition" title="Supprimer">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            // ── Carte RDV ──
            const item = di.rdv
            const etat = getEtatBadgeLocal(item.etat_planning_rdv)
            const client = users.find((u) => u.id === ((item as any).ref_users?.id || (item as any).ref_client?.id))
            const seq = getRdvSequence(item, plannings, aboPeriods)
            const isEffectue = (item as any).rdv_effectue === 'Effectué' || item.etat_planning_rdv === 'Effectué'
            return (
              <div
                key={item.id}
                onClick={() => router.push(`/planning/${item.id}?date=${selectedDate.toISOString().split('T')[0]}`)}
                className={`rounded-2xl border shadow-sm p-4 cursor-pointer hover:shadow-md transition ${isEffectue ? 'bg-green-50 border-l-4 border-l-green-500 border-green-100' : 'bg-white border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800">
                        {formatHeure(item.heure_planning_debut as any)} → {formatHeure(item.heure_planning_fin as any)}
                      </span>
                      {isEffectue ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Effectué
                        </span>
                      ) : (
                        <Badge label={etat.label} variant={etat.variant} />
                      )}
                    </div>
                    {client && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {client.photo_url ? (
                          <img src={client.photo_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <UserIcon className="w-3 h-3" />
                          </div>
                        )}
                        <p className="text-xs text-blue-600 font-medium">{client.nom} {client.prenom}</p>
                      </div>
                    )}
                    {((item as any).participants_supplementaires as any[])?.filter((p: any) => p.ref_users).map((p: any, i: number) => {
                      const pu = users.find((u) => u.id === (p.ref_users?.id || p.ref_users?.path?.split('/').pop()))
                      return pu ? (
                        <div key={i} className="flex items-center gap-1.5 mt-0.5">
                          {(pu as any).photo_url ? (
                            <img src={(pu as any).photo_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                              <UserIcon className="w-3 h-3" />
                            </div>
                          )}
                          <p className="text-xs text-gray-400 font-medium">{pu.prenom} {pu.nom}</p>
                        </div>
                      ) : null
                    })}
                    {(item as any).type_planning && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500">{(item as any).type_planning}</p>
                        {seq && (
                          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                            {seq.index}/{seq.total}
                          </span>
                        )}
                      </div>
                    )}
                    {isAdmin && Array.isArray((item as any).materiel) && (item as any).materiel.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(item as any).materiel.map((m: string) => (
                          <span key={m} className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded-full">{m}</span>
                        ))}
                      </div>
                    )}
                    {item.adresse_rdv && (
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <span className="text-xs text-gray-400">{item.adresse_rdv}</span>
                        {isAdmin && ((item as any).distance_km != null || (item as any).temps_route) && (
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                            {(item as any).distance_km != null ? `${(item as any).distance_km} km` : ''}
                            {(item as any).distance_km != null && (item as any).temps_route ? ' · ' : ''}
                            {(item as any).temps_route || ''}
                          </span>
                        )}
                        <div className="flex items-center gap-2">
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(item.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50 transition">
                            <MapPinIcon className="w-3 h-3" />Waze
                          </a>
                          <a href={`https://maps.google.com/maps?q=${encodeURIComponent(item.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 transition">
                            <GlobeAltIcon className="w-3 h-3" />Maps
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => openEdit(item, e)} className="inline-flex items-center gap-1 text-xs font-medium p-2 sm:px-2.5 sm:py-1.5 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition">
                        <PencilIcon className="w-4 h-4 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Modifier</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(item.id) }} className="inline-flex items-center gap-1 text-xs font-medium p-2 sm:px-2.5 sm:py-1.5 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition">
                        <TrashIcon className="w-4 h-4 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Supprimer</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal ajout / modification */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? 'Modifier le RDV' : 'Nouveau RDV'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Rechercher un client..." value={searchClient} onChange={(e) => setSearchClient(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <select value={form.ref_client} onChange={(e) => handleClientChange(e.target.value)} size={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Aucun client —</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom} {u.email ? `— ${u.email}` : ''}</option>
              ))}
            </select>
          </div>
          {form.ref_client && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abonnement</label>
              {clientAbonnements.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun abonnement trouvé pour ce client</p>
              ) : (
                <select value={form.abonnement_id} onChange={(e) => setForm({ ...form, abonnement_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Sélectionner un abonnement —</option>
                  {(() => {
                    const actifs = clientAbonnements.filter((a) => a.etat === 'Actif')
                    const autres = clientAbonnements.filter((a) => a.etat !== 'Actif')
                    const opt = (a: typeof clientAbonnements[number], i: number) => (
                      <option key={a.id} value={a.id}>
                        N°{clientAbonnements.indexOf(a) + 1} — {a.categorie}{a.typeSuivi ? ` · ${a.typeSuivi}` : ''} ({a.etat})
                      </option>
                    )
                    return <>
                      {actifs.length > 0 && <optgroup label="Actifs">{actifs.map(opt)}</optgroup>}
                      {autres.length > 0 && <optgroup label="Inactifs / Terminés">{autres.map(opt)}</optgroup>}
                    </>
                  })()}
                </select>
              )}
            </div>
          )}
          {/* Participants supplémentaires */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Participants supplémentaires</label>
            {form.participants_supplementaires.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {form.participants_supplementaires.map((p, i) => {
                  const pc = users.find((u) => u.id === p.ref_client)
                  const pAbo = (extraDetails[p.ref_client] || []).find((d: any) => d.id === p.ref_database_user)
                  return (
                    <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">{pc ? [pc.nom, pc.prenom].filter(Boolean).join(" ") : '—'}</p>
                        {pAbo && <p className="text-xs text-gray-400">{(pAbo as any).titre_abo || (pAbo as any).categorie_prestation || 'Abonnement'}{(pAbo as any).etat ? ` — ${(pAbo as any).etat}` : ''}</p>}
                      </div>
                      <button type="button"
                        onClick={() => setForm({ ...form, participants_supplementaires: form.participants_supplementaires.filter((_, j) => j !== i) })}
                        className="p-1 text-gray-400 hover:text-red-500 transition">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="border border-dashed border-gray-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-gray-500">Ajouter un participant</p>
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Rechercher..." value={searchNewParticipant}
                  onChange={(e) => setSearchNewParticipant(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={newParticipant.ref_client} size={3}
                onChange={(e) => { const v = e.target.value; setNewParticipant({ ref_client: v, ref_database_user: '' }); loadExtraDetails(v) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sélectionner —</option>
                {filteredUsersExtra
                  .filter((u) => u.id !== form.ref_client && !form.participants_supplementaires.some((p) => p.ref_client === u.id))
                  .map((u) => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
              {newParticipant.ref_client && (
                <select value={newParticipant.ref_database_user}
                  onChange={(e) => setNewParticipant({ ...newParticipant, ref_database_user: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Abonnement (optionnel) —</option>
                  {(() => {
                    const details = extraDetails[newParticipant.ref_client] || []
                    const sorted = [...details].sort((a: any, b: any) => {
                      const aA = a.etat === 'Actif' ? 0 : 1; const bA = b.etat === 'Actif' ? 0 : 1
                      if (aA !== bA) return aA - bA
                      return (b.date_debut?.seconds ?? 0) - (a.date_debut?.seconds ?? 0)
                    })
                    const actifs = sorted.filter((d: any) => d.etat === 'Actif')
                    const autres = sorted.filter((d: any) => d.etat !== 'Actif')
                    const opt = (d: any) => <option key={d.id} value={d.id}>{d.titre_abo || d.categorie_prestation || 'Abonnement sans titre'}{d.etat ? ` — ${d.etat}` : ''}</option>
                    return <>{actifs.length > 0 && <optgroup label="Actifs">{actifs.map(opt)}</optgroup>}{autres.length > 0 && <optgroup label="Inactifs / Terminés">{autres.map(opt)}</optgroup>}</>
                  })()}
                </select>
              )}
              <button type="button" disabled={!newParticipant.ref_client}
                onClick={() => {
                  if (!newParticipant.ref_client) return
                  setForm({ ...form, participants_supplementaires: [...form.participants_supplementaires, { ...newParticipant }] })
                  setNewParticipant({ ref_client: '', ref_database_user: '' })
                  setSearchNewParticipant('')
                }}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition">
                <PlusIcon className="w-3.5 h-3.5" />
                Ajouter ce participant
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de RDV</label>
            <select value={form.type_planning} onChange={(e) => setForm({ ...form, type_planning: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TYPES_RDV.map((groupe) => (
                <optgroup key={groupe.groupe} label={groupe.groupe}>
                  {groupe.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
              className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
              <input type="time" value={form.heure_debut} onChange={(e) => {
                const val = e.target.value
                const updates: Partial<typeof form> = { heure_debut: val }
                if (val && !form.heure_fin) {
                  const [h, m] = val.split(':').map(Number)
                  const fin = new Date(0, 0, 0, h + 1, m)
                  updates.heure_fin = `${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}`
                }
                setForm({ ...form, ...updates })
              }} required
                className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
              <input type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} required
                className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {form.heure_debut && (
                <div className="flex gap-1 mt-1">
                  {([15, 30, 60] as const).map((min) => {
                    const [h, m] = form.heure_debut.split(':').map(Number)
                    const total = h * 60 + m + min
                    const fin = `${String(Math.floor(total / 60) % 24).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
                    return (
                      <button key={min} type="button" onClick={() => setForm({ ...form, heure_fin: fin })}
                        className="flex-1 text-xs py-0.5 rounded bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition">
                        +{min < 60 ? `${min}min` : '1h'}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode de RDV</label>
            <select value={form.mode_rdv} onChange={(e) => setForm({ ...form, mode_rdv: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['Présentiel', 'Visioconférence', 'Appel téléphonique'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <AdresseAutocomplete value={form.adresse_rdv} onChange={(val) => setForm({ ...form, adresse_rdv: val, distance_km: null, temps_route: '' })} placeholder="Rechercher une adresse..." />
            {form.adresse_rdv && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={handleCalculateDistance}
                  disabled={calcDistance}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60"
                >
                  {calcDistance ? 'Calcul...' : '📍 Calculer la distance'}
                </button>
                {form.distance_km != null && (
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold">{form.distance_km} km</span>
                    {form.temps_route && <span className="text-gray-400"> · {form.temps_route}</span>}
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Matériel</label>
            <MaterielSelect value={form.materiel} onChange={(val) => setForm({ ...form, materiel: val })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">État</label>
            <select value={form.etat_planning_rdv} onChange={(e) => setForm({ ...form, etat_planning_rdv: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ETATS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={form.observations_rdv} onChange={(e) => setForm({ ...form, observations_rdv: e.target.value })} rows={3}
              placeholder="Notes, observations..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition">
              {editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression RDV */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Supprimer ce RDV ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
            Supprimer
          </button>
        </div>
      </Modal>

      {/* Modal ajout / modification activité */}
      <Modal isOpen={showActiviteModal} onClose={() => { setShowActiviteModal(false); setEditActiviteItem(null); setActiviteForm({ ...emptyActiviteForm }) }} title={editActiviteItem ? "Modifier l'activité" : "Ajouter une activité"} size="md">
        <form onSubmit={handleActiviteSubmit} className="space-y-4">
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <div className="relative mb-2">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Rechercher un client..." value={searchActiviteClient}
                  onChange={(e) => setSearchActiviteClient(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <select value={activiteForm.clientId}
                onChange={(e) => setActiviteForm({ ...activiteForm, clientId: e.target.value })} size={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">— Aucun client —</option>
                {filteredActiviteUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'activité *</label>
            <ActiviteTypeDropdown
              value={activiteForm.type_activite}
              onChange={(v) => setActiviteForm({ ...activiteForm, type_activite: v })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={activiteForm.date} required
              onChange={(e) => setActiviteForm({ ...activiteForm, date: e.target.value })}
              className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
              <input type="time" value={activiteForm.heure_debut}
                onChange={(e) => setActiviteForm({ ...activiteForm, heure_debut: e.target.value })}
                className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
              <input type="time" value={activiteForm.heure_fin}
                onChange={(e) => setActiviteForm({ ...activiteForm, heure_fin: e.target.value })}
                className="w-full min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          {(ACTIVITE_HAS_DISTANCE.has(activiteForm.type_activite) || !activiteForm.type_activite) ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                <input type="number" min={0} step={0.1} value={activiteForm.distance_km}
                  onChange={(e) => setActiviteForm({ ...activiteForm, distance_km: e.target.value })}
                  placeholder="Optionnel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Calories (kcal)</label>
                <input type="number" min={0} step={1} value={activiteForm.calories}
                  onChange={(e) => setActiviteForm({ ...activiteForm, calories: e.target.value })}
                  placeholder="Optionnel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calories (kcal)</label>
              <input type="number" min={0} step={1} value={activiteForm.calories}
                onChange={(e) => setActiviteForm({ ...activiteForm, calories: e.target.value })}
                placeholder="Optionnel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={activiteForm.notes}
              onChange={(e) => setActiviteForm({ ...activiteForm, notes: e.target.value })}
              rows={2} placeholder="Observations..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowActiviteModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition">
              {editActiviteItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression activité */}
      <Modal isOpen={!!deleteActiviteConfirm} onClose={() => setDeleteActiviteConfirm(null)} title="Supprimer cette activité ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteActiviteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => deleteActiviteConfirm && deleteActivite(deleteActiviteConfirm).then(() => setDeleteActiviteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}
