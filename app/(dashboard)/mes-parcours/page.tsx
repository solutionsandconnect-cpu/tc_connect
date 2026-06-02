'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, getDocs, doc, getDoc, onSnapshot,
  runTransaction, Timestamp, orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import {
  CalendarIcon, MapPinIcon, CheckCircleIcon, XCircleIcon,
  FireIcon, BanknotesIcon, ClockIcon, UsersIcon, HeartIcon,
  SparklesIcon, BoltIcon, ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface Registration {
  id: string
  sessionId: string
  userId?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  paymentStatus: 'pending' | 'cash' | 'transfer'
  attendance: 'unknown' | 'present' | 'absent'
  registeredAt: Timestamp
  uniqueToken: string
}

interface Session {
  id: string
  title: string
  date: Timestamp
  dateEnd?: Timestamp
  durationMinutes?: number
  location?: string
  locationLabel?: string
  locationCoords?: string
  maxSpots: number
  registeredCount: number
  status: string
  price?: number
  hidden?: boolean
}

type RegWithSession = Registration & { session: Session | null }

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'En attente de règlement',
  cash: 'Réglé en espèces',
  transfer: 'Réglé par virement',
}

function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtHeure(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function sessionLocationLabel(s: Session): string {
  return s.locationLabel || s.location || s.locationCoords || 'Lieu à confirmer'
}
function sessionMapsLink(s: Session): string | null {
  if (!s.locationCoords) return null
  const parts = s.locationCoords.replace(/\s/g, '').split(',')
  if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) return null
  return `https://maps.google.com/maps?q=${s.locationCoords.replace(/\s/g, '')}`
}
function sessionTimeRange(s: Session): string {
  const start = fmtHeure(s.date)
  if (s.dateEnd) return `${start} → ${fmtHeure(s.dateEnd)}`
  if (s.durationMinutes) {
    const end = new Date(s.date.toMillis() + s.durationMinutes * 60 * 1000)
    return `${start} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return start
}

const BENEFITS = [
  { icon: HeartIcon, color: 'text-red-500', bg: 'bg-red-50', title: 'Pour tous les niveaux', desc: 'Séances adaptées, débutant ou confirmé' },
  { icon: UsersIcon, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Esprit de groupe', desc: 'Motivation et bonne ambiance garanties' },
  { icon: SparklesIcon, color: 'text-purple-500', bg: 'bg-purple-50', title: 'En plein air', desc: 'Au bord de la plage, dans un cadre unique' },
  { icon: BoltIcon, color: 'text-orange-500', bg: 'bg-orange-50', title: '50min – 1h d\'effort', desc: 'Un format efficace pour se dépenser' },
]

export default function MesParcoursPage() {
  const { currentUser, userProfile } = useAuth()
  const router = useRouter()
  const isAdmin = userProfile?.role_app === 'Admin'

  useEffect(() => {
    if (userProfile && !isAdmin && userProfile.droits?.parcoursSportif === false) {
      router.replace('/accueil')
    }
  }, [userProfile, isAdmin, router])

  const [sessions, setSessions] = useState<Session[]>([])
  const [items, setItems] = useState<RegWithSession[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Modal inscription
  const [selected, setSelected] = useState<Session | null>(null)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', suggestions: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Toutes les séances à venir (temps réel)
  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      const now = Date.now()
      setSessions(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Session))
          .filter((s) => s.status !== 'cancelled' && !s.hidden && (s.date?.toMillis() ?? 0) >= now)
      )
    })
  }, [])

  // Mes inscriptions
  const loadRegistrations = async () => {
    if (!currentUser) return
    setLoading(true)
    try {
      const [byUid, byEmail] = await Promise.all([
        getDocs(query(collection(db, 'registrations'), where('userId', '==', currentUser.uid))),
        getDocs(query(collection(db, 'registrations'), where('email', '==', currentUser.email?.toLowerCase() ?? ''))),
      ])
      const seen = new Set<string>()
      const regs: Registration[] = []
      for (const snap of [byUid, byEmail]) {
        for (const d of snap.docs) {
          if (!seen.has(d.id)) { seen.add(d.id); regs.push({ id: d.id, ...d.data() } as Registration) }
        }
      }
      const sessionIds = [...new Set(regs.map((r) => r.sessionId))]
      const sessionMap: Record<string, Session> = {}
      await Promise.all(sessionIds.map(async (sid) => {
        const snap = await getDoc(doc(db, 'sessions', sid))
        if (snap.exists()) sessionMap[sid] = { id: snap.id, ...snap.data() } as Session
      }))
      const merged: RegWithSession[] = regs.map((r) => ({ ...r, session: sessionMap[r.sessionId] ?? null }))
      merged.sort((a, b) => (b.session?.date?.toMillis() ?? 0) - (a.session?.date?.toMillis() ?? 0))
      setItems(merged)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => { loadRegistrations() }, [currentUser])

  const now = Date.now()
  const registeredSessionIds = useMemo(() => new Set(items.map((i) => i.sessionId)), [items])
  const availableSessions = sessions.filter((s) => !registeredSessionIds.has(s.id))
  const upcoming = items.filter((i) => (i.session?.date?.toMillis() ?? 0) >= now)
  const past = items.filter((i) => (i.session?.date?.toMillis() ?? 0) < now)

  const openRegister = (session: Session) => {
    setSelected(session)
    setSuccess(false)
    setError('')
    setForm({
      firstName: userProfile?.prenom ?? '',
      lastName: userProfile?.nom ?? '',
      email: currentUser?.email ?? '',
      phone: userProfile?.phone_number ?? '',
      suggestions: '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !currentUser) return
    setError('')
    setSubmitting(true)
    try {
      await runTransaction(db, async (tx) => {
        const sessionRef = doc(db, 'sessions', selected.id)
        const snap = await tx.get(sessionRef)
        if (!snap.exists()) throw new Error('Séance introuvable')
        const data = snap.data()
        if (data.registeredCount >= data.maxSpots) throw new Error('Cette séance est complète')
        const newCount = data.registeredCount + 1
        const regRef = doc(collection(db, 'registrations'))
        tx.set(regRef, {
          sessionId: selected.id,
          userId: currentUser.uid,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
          suggestions: form.suggestions.trim(),
          isMinor: false,
          paymentStatus: 'pending',
          attendance: 'unknown',
          bookingPhone: form.phone.trim(),
          bookingEmail: form.email.trim().toLowerCase(),
          bookingName: `${form.firstName} ${form.lastName}`.trim(),
          isPrimaryBooking: true,
          registeredAt: Timestamp.now(),
          uniqueToken: crypto.randomUUID(),
        })
        tx.update(sessionRef, {
          registeredCount: newCount,
          status: newCount >= data.maxSpots ? 'full' : 'open',
        })
      })
      // Notification admin (push + section Notifications)
      const who = `${form.firstName} ${form.lastName}`.trim() || 'Un participant'
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          persist: true,
          type: 'PARCOURS_INSCRIPTION',
          title: 'Nouvelle inscription Parcours Sportif',
          body: `${who} s'est inscrit(e) à "${selected.title}"`,
          url: '/admin/parcours-sportif',
        }),
      }).catch(() => {})
      setSuccess(true)
      await loadRegistrations()
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'inscription')
    }
    setSubmitting(false)
  }

  const handleCancel = async (reg: RegWithSession) => {
    if (!reg.session) return
    setCancelling(true)
    try {
      await runTransaction(db, async (tx) => {
        const regRef = doc(db, 'registrations', reg.id)
        const sessionRef = doc(db, 'sessions', reg.sessionId)
        const sessionSnap = await tx.get(sessionRef)
        if (sessionSnap.exists()) {
          const data = sessionSnap.data()
          tx.update(sessionRef, {
            registeredCount: Math.max(0, data.registeredCount - 1),
            status: data.status === 'full' ? 'open' : data.status,
          })
        }
        tx.delete(regRef)
      })
      setItems((prev) => prev.filter((i) => i.id !== reg.id))
      setCancelConfirm(null)
    } catch (err) {
      console.error(err)
    }
    setCancelling(false)
  }

  // ── Carte d'une séance disponible ────────────────────────────
  const AvailableCard = ({ session }: { session: Session }) => {
    const spots = session.maxSpots - session.registeredCount
    const isFull = session.status === 'full' || spots <= 0
    const showSpots = !isFull && spots <= 15
    const mapsLink = sessionMapsLink(session)
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col hover:shadow-md transition">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-bold text-gray-900 flex-1 leading-snug">{session.title}</h3>
          {isFull
            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">Complet</span>
            : showSpots
            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 shrink-0">{spots} place{spots > 1 ? 's' : ''}</span>
            : null}
        </div>
        <div className="space-y-1.5 flex-1 mb-4 text-sm">
          <div className="flex items-center gap-2 text-gray-700">
            <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="capitalize font-medium">{fmtDate(session.date)}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 pl-6">
            <span>{sessionTimeRange(session)}</span>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <span>{sessionLocationLabel(session)}</span>
          </div>
          {mapsLink && (
            <a href={mapsLink} target="_blank" rel="noopener noreferrer"
              className="ml-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition">
              <MapPinIcon className="w-3.5 h-3.5" />
              Itinéraire Google Maps
            </a>
          )}
          {session.price != null && (
            <div className="flex items-center gap-2 text-green-600 font-bold pl-0.5 pt-0.5">
              <BanknotesIcon className="w-4 h-4 shrink-0" />
              <span>{session.price}€ <span className="text-xs font-normal text-gray-400">/ personne</span></span>
            </div>
          )}
        </div>
        <button
          onClick={() => openRegister(session)}
          disabled={isFull}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 disabled:cursor-not-allowed">
          {isFull ? 'Séance complète' : 'S\'inscrire'}
        </button>
      </div>
    )
  }

  // ── Carte d'une inscription ──────────────────────────────────
  const RegCard = ({ reg }: { reg: RegWithSession }) => {
    const session = reg.session
    const isPast = (session?.date?.toMillis() ?? 0) < now
    const isCancelled = session?.status === 'cancelled'
    const mapsLink = session ? sessionMapsLink(session) : null
    return (
      <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isCancelled ? 'border-red-100 opacity-70' : 'border-gray-100'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate">{session?.title ?? 'Séance'}</p>
            {isCancelled && <span className="inline-block text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-0.5">Séance annulée</span>}
          </div>
          {reg.attendance === 'present' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Présent
            </span>
          )}
          {reg.attendance === 'absent' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
              <XCircleIcon className="w-3.5 h-3.5" /> Absent
            </span>
          )}
        </div>
        {session && (
          <div className="space-y-1.5 mb-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="capitalize">{fmtDate(session.date)} · {sessionTimeRange(session)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{sessionLocationLabel(session)}</span>
            </div>
            {mapsLink && !isPast && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                className="ml-6 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg transition">
                <MapPinIcon className="w-3.5 h-3.5" />
                Itinéraire
              </a>
            )}
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${reg.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
            {PAYMENT_LABELS[reg.paymentStatus] ?? reg.paymentStatus}
          </span>
          {!isPast && !isCancelled && (
            cancelConfirm === reg.id ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Annuler ?</span>
                <button onClick={() => setCancelConfirm(null)} className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg hover:bg-gray-50 transition">Non</button>
                <button onClick={() => handleCancel(reg)} disabled={cancelling} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition disabled:opacity-50">{cancelling ? '...' : 'Oui'}</button>
              </div>
            ) : (
              <button onClick={() => setCancelConfirm(reg.id)} className="text-xs text-red-500 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition">
                Se désinscrire
              </button>
            )
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 text-white p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-2">
            <FireIcon className="w-6 h-6" />
            <span className="text-sm font-semibold uppercase tracking-wide opacity-90">Parcours Sportifs</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight">
            Dépasse-toi en plein air,<br />à ton rythme.
          </h1>
          <p className="text-sm sm:text-base text-white/90 mt-2">
            Des séances de sport en groupe, conviviales et accessibles à tous — au bord de la plage de la Mine d'Or.
          </p>
          {availableSessions.length > 0 && (
            <a href="#dispo"
              className="inline-flex items-center gap-2 mt-4 bg-white text-orange-600 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-50 transition">
              Voir les {availableSessions.length} séance{availableSessions.length > 1 ? 's' : ''} disponible{availableSessions.length > 1 ? 's' : ''}
              <ArrowRightIcon className="w-4 h-4" />
            </a>
          )}
        </div>
        <FireIcon className="absolute -right-6 -bottom-6 w-44 h-44 text-white/10" />
      </div>

      {/* Bénéfices / objectifs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {BENEFITS.map((b) => {
          const Icon = b.icon
          return (
            <div key={b.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className={`w-10 h-10 rounded-xl ${b.bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-5 h-5 ${b.color}`} />
              </div>
              <p className="text-sm font-bold text-gray-800">{b.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Mes prochaines séances */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-green-500" />
            Mes prochaines séances ({upcoming.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.map((reg) => <RegCard key={reg.id} reg={reg} />)}
          </div>
        </div>
      )}

      {/* Séances disponibles */}
      <div id="dispo" className="space-y-3 scroll-mt-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
          <FireIcon className="w-4 h-4 text-orange-500" />
          Séances disponibles {availableSessions.length > 0 && `(${availableSessions.length})`}
        </h2>
        {availableSessions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Aucune nouvelle séance disponible</p>
            <p className="text-sm text-gray-400 mt-1">
              {upcoming.length > 0 ? 'Vous êtes déjà inscrit à toutes les séances à venir !' : 'De nouvelles dates seront bientôt proposées'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableSessions.map((s) => <AvailableCard key={s.id} session={s} />)}
          </div>
        )}
      </div>

      {/* Historique */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-gray-400" />
            Historique ({past.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {past.map((reg) => <RegCard key={reg.id} reg={reg} />)}
          </div>
        </div>
      )}

      {/* Modal inscription */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={success ? 'Inscription confirmée !' : 'Inscription'} size="md">
        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Vous êtes inscrit !</h3>
            <p className="text-sm text-gray-500 mb-5">Votre place est réservée. Retrouvez-la dans « Mes prochaines séances ».</p>
            <button onClick={() => setSelected(null)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
              Parfait !
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {selected && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                <p className="font-semibold">{selected.title}</p>
                <p className="capitalize">{fmtDate(selected.date)} · {sessionTimeRange(selected)}</p>
                <p>{sessionLocationLabel(selected)}</p>
                {selected.price != null && <p className="font-semibold mt-0.5">{selected.price}€ / personne</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input type="text" required value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" required value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone *</label>
              <input type="tel" required value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Questions / Suggestions <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              <textarea value={form.suggestions} rows={2}
                onChange={(e) => setForm((f) => ({ ...f, suggestions: e.target.value }))}
                placeholder="Une question ? Un retour ?"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setSelected(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {submitting ? 'Inscription...' : 'Confirmer mon inscription'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
