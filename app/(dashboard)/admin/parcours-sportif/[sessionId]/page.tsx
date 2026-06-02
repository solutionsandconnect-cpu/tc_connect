'use client'

import { use, useState, useEffect, useMemo } from 'react'
import {
  doc, getDoc, deleteDoc, collection, query, where, onSnapshot,
  updateDoc, runTransaction, Timestamp, addDoc, getDocs,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { copyText } from '@/lib/clipboard'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/hooks/useUsers'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon, TrashIcon, ClipboardDocumentIcon,
  ExclamationTriangleIcon, UsersIcon, CalendarIcon, MapPinIcon,
  CheckCircleIcon, XCircleIcon, BanknotesIcon, PlusIcon,
  MagnifyingGlassIcon, ChatBubbleLeftIcon,
} from '@heroicons/react/24/outline'

interface Session {
  id: string
  title: string
  date: Timestamp
  dateEnd?: Timestamp
  durationMinutes?: number
  locationCoords?: string
  locationLabel?: string
  location?: string
  maxSpots: number
  registeredCount: number
  status: 'open' | 'full' | 'cancelled'
  price?: number
  contactPhone?: string
  hidden?: boolean
}

interface Registration {
  id: string
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  suggestions: string
  paymentStatus: 'pending' | 'cash' | 'transfer'
  attendance: 'unknown' | 'present' | 'absent'
  registeredAt: Timestamp
  userId?: string
  isMinor?: boolean
  guardianName?: string
  guardianRelation?: string
  guardianPhone?: string
  birthDate?: string
  medicalCertUrl?: string | null
  groupId?: string | null
  isPrimaryBooking?: boolean
  bookingPhone?: string
  bookingEmail?: string
  bookingName?: string
}

const PAYMENT_OPTIONS = [
  { value: 'pending',  label: 'En attente' },
  { value: 'cash',     label: 'Espèces' },
  { value: 'transfer', label: 'Virement' },
]

const SMS_TEMPLATE = `Si je ne me trompe pas, tu ne m'as pas réglé le dernier Parcours Sportif.
Tu peux réaliser un virement Wero à ce numéro (+336 79 40 82 54) ou sinon, voici le rib pour effectuer le virement :
IBAN : FR76 1600 6200 1100 8401 5620 604
BIC : AGRIFRPP860
Bonne journée et bon week-end`

function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtHeure(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function mapsLink(coords: string): string {
  return `https://maps.google.com/maps?q=${coords.replace(/\s/g, '')}`
}
function autoTitle(datetime: string): string {
  const [datePart] = datetime.split('T')
  const [y, m, d] = datePart.split('-')
  return `Parcours Sportif du ${d}/${m}/${y}`
}
function parseCoordsLink(coords?: string): string | null {
  if (!coords) return null
  const parts = coords.replace(/\s/g, '').split(',')
  if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) return null
  return `https://maps.google.com/maps?q=${coords.replace(/\s/g, '')}`
}

export default function AdminSessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { users } = useUsers()

  const [session, setSession] = useState<Session | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loadingSession, setLoadingSession] = useState(true)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showDeleteSession, setShowDeleteSession] = useState(false)
  const [deletingSession, setDeletingSession] = useState(false)
  const [togglingHidden, setTogglingHidden] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState({ datetime: '', locationCoords: '', locationLabel: '', maxSpots: '', price: '5', durationMinutes: '60', contactPhone: '+33679408254' })
  const [saving, setSaving] = useState(false)

  // Recherche + filtres sur les inscrits
  const [search, setSearch] = useState('')
  const [filterPayment, setFilterPayment] = useState<'all' | 'pending' | 'paid'>('all')
  const [filterAttendance, setFilterAttendance] = useState<'all' | 'present' | 'absent' | 'unknown'>('all')

  // Quick add participant
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [quickForm, setQuickForm] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [addError, setAddError] = useState('')

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return []
    const s = searchUser.toLowerCase()
    return users.filter((u) =>
      [u.nom, u.prenom].filter(Boolean).join(' ').toLowerCase().includes(s) ||
      (u.email?.toLowerCase().includes(s) ?? false)
    ).slice(0, 8)
  }, [users, searchUser])

  useEffect(() => {
    if (!isAdmin) return
    getDoc(doc(db, 'sessions', sessionId)).then((snap) => {
      if (snap.exists()) {
        const s = { id: snap.id, ...snap.data() } as Session
        setSession(s)
        const d = s.date.toDate()
        const pad = (n: number) => String(n).padStart(2, '0')
        setEditForm({
          datetime: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
          locationCoords: s.locationCoords ?? '',
          locationLabel: s.locationLabel ?? s.location ?? '',
          maxSpots: String(s.maxSpots),
          price: String(s.price ?? 5),
          durationMinutes: String(s.durationMinutes ?? 60),
          contactPhone: s.contactPhone ?? '+33679408254',
        })
      }
      setLoadingSession(false)
    })
    const q = query(collection(db, 'registrations'), where('sessionId', '==', sessionId))
    return onSnapshot(q, (snap) => {
      setRegistrations(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Registration))
          .sort((a, b) => (a.registeredAt?.seconds ?? 0) - (b.registeredAt?.seconds ?? 0))
      )
    })
  }, [isAdmin, sessionId])

  const financials = useMemo(() => {
    const price = session?.price ?? 5
    const byCash = registrations.filter((r) => r.paymentStatus === 'cash').length
    const byTransfer = registrations.filter((r) => r.paymentStatus === 'transfer').length
    const total = (byCash + byTransfer) * price
    const pending = registrations.filter((r) => r.paymentStatus === 'pending').length * price
    const present = registrations.filter((r) => r.attendance === 'present').length
    const absent = registrations.filter((r) => r.attendance === 'absent').length
    return { total, pending, byCash, byTransfer, present, absent }
  }, [registrations, session])

  const handlePaymentChange = (regId: string, value: string) =>
    updateDoc(doc(db, 'registrations', regId), { paymentStatus: value })

  const handleAttendance = (regId: string, value: 'present' | 'absent' | 'unknown') =>
    updateDoc(doc(db, 'registrations', regId), { attendance: value })

  const handleDeleteReg = async (reg: Registration) => {
    await runTransaction(db, async (tx) => {
      const sessionRef = doc(db, 'sessions', sessionId)
      const snap = await tx.get(sessionRef)
      if (snap.exists()) {
        const data = snap.data()
        tx.update(sessionRef, {
          registeredCount: Math.max(0, data.registeredCount - 1),
          status: data.status === 'full' ? 'open' : data.status,
        })
      }
      tx.delete(doc(db, 'registrations', reg.id))
    })
    setDeleteConfirm(null)
  }

  const handleCancelSession = async () => {
    setCancelling(true)
    await updateDoc(doc(db, 'sessions', sessionId), { status: 'cancelled' })
    setSession((s) => s ? { ...s, status: 'cancelled' } : s)
    setShowCancelConfirm(false)
    setCancelling(false)
  }

  const handleToggleHidden = async () => {
    if (!session) return
    setTogglingHidden(true)
    const newHidden = !session.hidden
    await updateDoc(doc(db, 'sessions', sessionId), { hidden: newHidden })
    setSession((s) => s ? { ...s, hidden: newHidden } : s)
    setTogglingHidden(false)
  }

  const handleDeleteSession = async () => {
    if (!session) return
    setDeletingSession(true)
    try {
      // Supprimer toutes les inscriptions liées
      if (registrations.length > 0) {
        await Promise.all(registrations.map((r) => deleteDoc(doc(db, 'registrations', r.id))))
      }
      // Supprimer le contenu de séance s'il existe
      await deleteDoc(doc(db, 'session_content', sessionId)).catch(() => {})
      // Supprimer la séance
      await deleteDoc(doc(db, 'sessions', sessionId))
      router.push('/admin/parcours-sportif')
    } catch {
      setDeletingSession(false)
    }
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const max = parseInt(editForm.maxSpots)
    const price = parseFloat(editForm.price)
    const duration = parseInt(editForm.durationMinutes) || 60
    if (!editForm.datetime || !editForm.locationCoords || isNaN(max) || max <= 0) return
    setSaving(true)
    const startDate = new Date(editForm.datetime)
    const newDate = Timestamp.fromDate(startDate)
    const newDateEnd = Timestamp.fromDate(new Date(startDate.getTime() + duration * 60 * 1000))
    await updateDoc(doc(db, 'sessions', sessionId), {
      title: autoTitle(editForm.datetime),
      date: newDate,
      dateEnd: newDateEnd,
      durationMinutes: duration,
      locationCoords: editForm.locationCoords.replace(/\s/g, ''),
      locationLabel: editForm.locationLabel.trim(),
      location: editForm.locationLabel.trim() || editForm.locationCoords,
      maxSpots: max,
      price: isNaN(price) ? 5 : price,
      contactPhone: editForm.contactPhone.trim(),
      status: session?.registeredCount && session.registeredCount >= max ? 'full' : 'open',
    })
    setSession((s) => s ? {
      ...s,
      title: autoTitle(editForm.datetime),
      date: newDate,
      dateEnd: newDateEnd,
      durationMinutes: duration,
      locationCoords: editForm.locationCoords,
      locationLabel: editForm.locationLabel,
      maxSpots: max,
      price: isNaN(price) ? 5 : price,
      contactPhone: editForm.contactPhone.trim(),
    } : s)
    setShowEdit(false)
    setSaving(false)
  }

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickForm.firstName.trim()) { setAddError('Le prénom est obligatoire.'); return }
    if (!session) return
    setAddError('')
    setAddingParticipant(true)
    try {
      const { notify } = await runTransaction(db, async (tx) => {
        const sessionRef = doc(db, 'sessions', sessionId)
        const snap = await tx.get(sessionRef)
        if (!snap.exists()) throw new Error('Séance introuvable')
        const data = snap.data()
        if (data.registeredCount >= data.maxSpots) throw new Error('Séance complète')
        const newCount = data.registeredCount + 1
        const regRef = doc(collection(db, 'registrations'))
        tx.set(regRef, {
          sessionId,
          firstName: quickForm.firstName.trim(),
          lastName: quickForm.lastName.trim(),
          email: quickForm.email.trim().toLowerCase(),
          phone: quickForm.phone.trim(),
          suggestions: '',
          paymentStatus: 'pending',
          attendance: 'unknown',
          registeredAt: Timestamp.now(),
          uniqueToken: crypto.randomUUID(),
        })
        tx.update(sessionRef, {
          registeredCount: newCount,
          status: newCount >= data.maxSpots ? 'full' : 'open',
        })
        const notify = data.maxSpots > 10 && newCount === data.maxSpots - 10
        return { notify }
      })
      if (notify) {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toAdmins: true,
            title: '⚠️ Parcours Sportif presque complet',
            body: `Il ne reste que 10 places pour "${session.title}"`,
            url: `/admin/parcours-sportif/${sessionId}`,
          }),
        }).catch(() => {})
      }
      setQuickForm({ firstName: '', lastName: '', email: '', phone: '' })
      setSearchUser('')
      setShowQuickAdd(false)
    } catch (err: any) {
      setAddError(err.message ?? 'Erreur lors de l\'ajout')
    }
    setAddingParticipant(false)
  }

  const copyPhones = async () => {
    const phones = registrations.map((r) => r.phone).filter(Boolean).join(', ')
    const ok = await copyText(phones)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      window.prompt('Copiez les numéros ci-dessous :', phones)
    }
  }

  // Numéro à utiliser pour joindre la personne sur un impayé :
  // son propre numéro, sinon le numéro de l'inscription groupée (réservation)
  const effectiveContactPhone = (r: Registration): string => r.phone?.trim() || r.bookingPhone?.trim() || ''
  const usesBookingPhone = (r: Registration): boolean => !r.phone?.trim() && !!r.bookingPhone?.trim()

  const openSMS = (reg: Registration) => {
    const phone = effectiveContactPhone(reg)
    if (!phone) return
    // Si on passe par le numéro de réservation, on personnalise le rappel
    const body = usesBookingPhone(reg)
      ? `Bonjour,\n\nConcernant l'inscription de ${reg.firstName} ${reg.lastName} au Parcours Sportif : il semble que le règlement n'ait pas été effectué.\n${SMS_TEMPLATE}`
      : SMS_TEMPLATE
    window.open(`sms:${phone}?body=${encodeURIComponent(body)}`, '_blank')
  }

  const handleReminderSMS = async (reg: Registration) => {
    if (!session || !reg.phone) return
    const heure = fmtHeure(session.date)
    const locationDisplay = session.locationLabel || session.location || session.locationCoords || ''
    const link = `${window.location.origin}/parcours-sportif`

    let unpaidSection = ''
    try {
      if (reg.email) {
        const prevSnap = await getDocs(
          query(collection(db, 'registrations'),
            where('email', '==', reg.email.toLowerCase()),
            where('paymentStatus', '==', 'pending')
          )
        )
        const prevRegs = prevSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Registration))
          .filter((r) => r.sessionId !== sessionId)

        if (prevRegs.length > 0) {
          const sessionSnaps = await Promise.all(
            prevRegs.map((r) => getDoc(doc(db, 'sessions', r.sessionId)))
          )
          const pastUnpaid = sessionSnaps
            .map((snap, i) => ({ snap, r: prevRegs[i] }))
            .filter(({ snap }) => snap.exists() && (snap.data().date?.toMillis?.() ?? 0) < Date.now())
            .sort((a, b) => (b.snap.data().date?.seconds ?? 0) - (a.snap.data().date?.seconds ?? 0))

          if (pastUnpaid.length > 0) {
            const dateStr = pastUnpaid[0].snap.data().date.toDate().toLocaleDateString('fr-FR', {
              day: '2-digit', month: '2-digit', year: 'numeric',
            })
            unpaidSection = `\n\n⚠️ Rappel d'impayé lors du dernier parcours : ${dateStr}. L'impayé peut être réglé par virement sur le compte suivant :\nIBAN : FR76 1600 6200 1100 8401 5620 604\nBIC : AGRIFRPP860`
          }
        }
      }
    } catch (err) {
      console.error('Unpaid check error:', err)
    }

    const sms = `Bonjour,

Rappel de votre inscription pour le Parcours Sportif d'aujourd'hui à ${heure}.
Lieu du rendez-vous : ${locationDisplay}.

Si vous avez un imprévu, merci de revenir vers moi au plus vite.${unpaidSection}

Je vous joins également le formulaire d'inscription aux Parcours pour que vous l'ayez à porté de main pour les prochaines dates si vous souhaitez y participer : ${link}.

Bonne journée et à toute à l'heure.

Teddy`

    window.open(`sms:${reg.phone}?body=${encodeURIComponent(sms)}`, '_blank')
  }

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  if (loadingSession) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
  if (!session) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Séance introuvable.</p></div>

  const isCancelled = session.status === 'cancelled'
  const coordsLink = parseCoordsLink(session.locationCoords)
  const locationDisplay = session.locationLabel || session.location || session.locationCoords || '—'
  const unpaidWithPhone = registrations.filter((r) => r.paymentStatus === 'pending' && effectiveContactPhone(r))

  const filteredRegistrations = registrations.filter((r) => {
    if (filterPayment === 'pending' && r.paymentStatus !== 'pending') return false
    if (filterPayment === 'paid' && r.paymentStatus === 'pending') return false
    if (filterAttendance !== 'all' && (r.attendance ?? 'unknown') !== filterAttendance) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const hay = `${r.firstName} ${r.lastName} ${r.email} ${r.phone}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/admin/parcours-sportif')} className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-800 truncate">{session.title}</h1>
            {session.hidden && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Masquée</span>
            )}
          </div>
          <p className="text-sm text-gray-500 capitalize">{fmtDate(session.date)} à {fmtHeure(session.date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Vue séance (mobile) */}
          <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}/vue`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 bg-purple-50 hover:bg-purple-100 transition">
            Vue séance
          </button>
          {/* Contenu de séance */}
          <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}/contenu`)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition">
            Contenu
          </button>
          {/* Masquer/Afficher */}
          <button onClick={handleToggleHidden} disabled={togglingHidden}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-50">
            {togglingHidden ? '...' : session.hidden ? 'Afficher' : 'Masquer'}
          </button>
          {/* Modifier */}
          {!isCancelled && (
            <button onClick={() => setShowEdit((v) => !v)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
              {showEdit ? 'Fermer' : 'Modifier'}
            </button>
          )}
          {/* Supprimer (seulement si 0 inscrits) */}
          {(session.registeredCount === 0 || session.status === 'cancelled') && (
            !showDeleteSession ? (
              <button onClick={() => setShowDeleteSession(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                Supprimer
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                <span className="text-xs text-red-600">Supprimer définitivement ?</span>
                <button onClick={() => setShowDeleteSession(false)} className="text-xs text-gray-500 hover:text-gray-700">Non</button>
                <button onClick={handleDeleteSession} disabled={deletingSession}
                  className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md disabled:opacity-50">
                  {deletingSession ? '...' : 'Oui'}
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Formulaire édition */}
      {showEdit && (
        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Modifier la séance</h2>
          <form onSubmit={handleSaveEdit} className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date et heure de début</label>
              <input type="datetime-local" required value={editForm.datetime}
                onChange={(e) => setEditForm((f) => ({ ...f, datetime: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {editForm.datetime && (
                <p className="text-xs text-gray-400 mt-1">→ {autoTitle(editForm.datetime)}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Durée (minutes)</label>
              <input type="number" required min={1} value={editForm.durationMinutes}
                onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {editForm.datetime && editForm.durationMinutes && (
                <p className="text-xs text-gray-400 mt-1">
                  Fin : {new Date(new Date(editForm.datetime).getTime() + (parseInt(editForm.durationMinutes) || 0) * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Coordonnées GPS</label>
              <input type="text" required value={editForm.locationCoords}
                onChange={(e) => setEditForm((f) => ({ ...f, locationCoords: e.target.value }))}
                placeholder="47.473783, -2.487777"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom du lieu (affiché aux participants)</label>
              <input type="text" value={editForm.locationLabel}
                onChange={(e) => setEditForm((f) => ({ ...f, locationLabel: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Places max</label>
              <input type="number" required min={session.registeredCount || 1} value={editForm.maxSpots}
                onChange={(e) => setEditForm((f) => ({ ...f, maxSpots: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Prix (€)</label>
              <input type="number" min={0} step={0.5} value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone de contact (annulations participants)</label>
              <input type="tel" value={editForm.contactPhone}
                onChange={(e) => setEditForm((f) => ({ ...f, contactPhone: e.target.value }))}
                placeholder="+33679408254"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition">{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Infos + bilan */}
        <div className="lg:col-span-1 space-y-4">
          {/* Infos séance */}
          <div className={`bg-white rounded-2xl border shadow-sm p-5 space-y-3 ${isCancelled ? 'border-red-100' : 'border-gray-100'}`}>
            {isCancelled && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm font-medium text-red-600">Séance annulée</p>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="capitalize">{fmtDate(session.date)} à {fmtHeure(session.date)}</span>
            </div>
            <div className="flex items-start gap-1.5 text-sm text-gray-600">
              <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
              <div>
                <span>{locationDisplay}</span>
                {coordsLink && (
                  <a href={coordsLink} target="_blank" rel="noopener noreferrer"
                    className="block text-xs text-blue-600 hover:underline mt-0.5">
                    Ouvrir dans Maps
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <UsersIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span>{session.registeredCount}/{session.maxSpots} inscrits</span>
              {session.maxSpots - session.registeredCount <= 10 && !isCancelled && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full">
                  {session.maxSpots - session.registeredCount} restantes
                </span>
              )}
            </div>
            {session.price != null && (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                <BanknotesIcon className="w-4 h-4 shrink-0" />
                <span>{session.price}€ / personne</span>
              </div>
            )}
            {!isCancelled && (
              <div className="pt-1 border-t border-gray-100">
                {!showCancelConfirm ? (
                  <button onClick={() => setShowCancelConfirm(true)}
                    className="text-xs font-medium text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 transition">
                    Annuler la séance
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-600 flex-1">Confirmer l'annulation ?</p>
                    <button onClick={() => setShowCancelConfirm(false)} className="text-xs border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">Non</button>
                    <button onClick={handleCancelSession} disabled={cancelling} className="text-xs bg-red-500 text-white px-2 py-1 rounded-lg hover:bg-red-600 disabled:opacity-50">{cancelling ? '...' : 'Oui'}</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bilan financier */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <BanknotesIcon className="w-4 h-4 text-green-600" />
              Bilan financier
            </p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Encaissé</span>
              <span className="text-lg font-bold text-green-700">{financials.total.toFixed(2)}€</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Espèces ({financials.byCash})</span>
              <span>{(financials.byCash * (session.price ?? 5)).toFixed(2)}€</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Virement ({financials.byTransfer})</span>
              <span>{(financials.byTransfer * (session.price ?? 5)).toFixed(2)}€</span>
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-sm text-gray-500">En attente</span>
              <span className="text-sm font-medium text-orange-600">{financials.pending.toFixed(2)}€</span>
            </div>
            <div className="border-t border-gray-100 pt-2 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1 text-green-600"><CheckCircleIcon className="w-3.5 h-3.5" />Présents</span>
                <span className="font-semibold">{financials.present}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1 text-red-500"><XCircleIcon className="w-3.5 h-3.5" />Absents</span>
                <span className="font-semibold">{financials.absent}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Liste inscrits */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Inscrits ({registrations.length})
            </h2>
            <div className="flex items-center gap-2">
              {registrations.length > 0 && (
                <button onClick={copyPhones}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  {copied ? 'Copié !' : 'Copier les numéros'}
                </button>
              )}
              {!isCancelled && (
                <button onClick={() => setShowQuickAdd((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                  <PlusIcon className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              )}
            </div>
          </div>

          {/* Panneau ajout rapide */}
          {showQuickAdd && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
              <p className="text-sm font-semibold text-blue-800">Ajout rapide de participant</p>

              {/* Recherche utilisateur existant */}
              <div>
                <label className="block text-xs font-medium text-blue-700 mb-1">Rechercher un utilisateur existant</label>
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={searchUser} onChange={(e) => setSearchUser(e.target.value)}
                    placeholder="Prénom, nom ou email..."
                    className="w-full border border-gray-300 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                {filteredUsers.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    {filteredUsers.map((u) => (
                      <button key={u.id} type="button"
                        onClick={() => {
                          setQuickForm({
                            firstName: u.prenom ?? '',
                            lastName: u.nom ?? '',
                            email: u.email ?? '',
                            phone: u.phone_number ?? '',
                          })
                          setSearchUser('')
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 transition">
                        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {u.prenom?.[0]}{u.nom?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{u.prenom} {u.nom}</p>
                          {u.email && <p className="text-xs text-gray-400 truncate">{u.email}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleQuickAdd} className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Prénom *</label>
                  <input type="text" required value={quickForm.firstName}
                    onChange={(e) => setQuickForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Nom</label>
                  <input type="text" value={quickForm.lastName}
                    onChange={(e) => setQuickForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Email</label>
                  <input type="email" value={quickForm.email}
                    onChange={(e) => setQuickForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Téléphone</label>
                  <input type="tel" value={quickForm.phone}
                    onChange={(e) => setQuickForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                {addError && <p className="col-span-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{addError}</p>}
                <div className="col-span-2 flex gap-2">
                  <button type="button" onClick={() => { setShowQuickAdd(false); setQuickForm({ firstName: '', lastName: '', email: '', phone: '' }); setSearchUser('') }}
                    className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button type="submit" disabled={addingParticipant}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-xl text-sm font-semibold transition">
                    {addingParticipant ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SMS groupés */}
          {unpaidWithPhone.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">
                <ChatBubbleLeftIcon className="w-3.5 h-3.5 inline mr-1" />
                SMS impayé — {unpaidWithPhone.length} non-réglé{unpaidWithPhone.length > 1 ? 's' : ''} avec numéro
              </p>
              {unpaidWithPhone.some(usesBookingPhone) && (
                <p className="text-[11px] text-orange-500 mb-2">
                  « (via réservation) » = envoyé au numéro de la personne qui a inscrit le groupe — pas forcément celui du participant concerné.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {unpaidWithPhone.map((reg) => (
                  <button key={reg.id} onClick={() => openSMS(reg)}
                    className="flex items-center gap-1.5 text-xs font-medium text-orange-700 border border-orange-300 bg-white hover:bg-orange-50 px-2.5 py-1.5 rounded-lg transition">
                    <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                    Impayé → {reg.firstName} {reg.lastName}
                    {usesBookingPhone(reg) && <span className="text-orange-400">(via réservation)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recherche + filtres */}
          {registrations.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-2">
              <div className="relative">
                <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un inscrit (nom, email, téléphone)..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Filtre règlement */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 mr-1">Règlement :</span>
                  {([['all', 'Tous'], ['pending', 'En attente'], ['paid', 'Réglé']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setFilterPayment(val)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                        filterPayment === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {/* Filtre présence */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 mr-1">Présence :</span>
                  {([['all', 'Tous'], ['present', 'Présents'], ['absent', 'Absents'], ['unknown', 'Non pointés']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setFilterAttendance(val)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition ${
                        filterAttendance === val ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                {(search || filterPayment !== 'all' || filterAttendance !== 'all') && (
                  <button onClick={() => { setSearch(''); setFilterPayment('all'); setFilterAttendance('all') }}
                    className="text-xs text-gray-400 hover:text-gray-600 underline ml-auto">
                    Réinitialiser
                  </button>
                )}
              </div>
              {(search || filterPayment !== 'all' || filterAttendance !== 'all') && (
                <p className="text-xs text-gray-400">{filteredRegistrations.length} résultat{filteredRegistrations.length > 1 ? 's' : ''} sur {registrations.length}</p>
              )}
            </div>
          )}

          {registrations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <UsersIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun inscrit pour l'instant</p>
            </div>
          ) : filteredRegistrations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
              <MagnifyingGlassIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun inscrit ne correspond à ces critères</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filteredRegistrations.map((reg) => (
                  <div key={reg.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{reg.firstName} {reg.lastName}</p>
                          {reg.isMinor && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Mineur</span>
                          )}
                        </div>
                        {reg.email && <p className="text-xs text-gray-500">{reg.email}</p>}
                        {reg.phone && <p className="text-xs text-gray-500">{reg.phone}</p>}
                        {reg.isMinor && (
                          <div className="mt-1 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 space-y-0.5">
                            {reg.guardianName && (
                              <p className="text-xs text-amber-800">
                                Responsable : <strong>{reg.guardianName}</strong>
                                {reg.guardianRelation ? ` (${reg.guardianRelation})` : ''}
                                {reg.guardianPhone ? ` · ${reg.guardianPhone}` : ''}
                              </p>
                            )}
                            {reg.birthDate && (
                              <p className="text-xs text-amber-700">Né(e) le {new Date(reg.birthDate).toLocaleDateString('fr-FR')}</p>
                            )}
                            {reg.medicalCertUrl ? (
                              <a href={reg.medicalCertUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs font-medium text-blue-600 hover:underline">
                                Voir le certificat médical →
                              </a>
                            ) : (
                              <p className="text-xs text-amber-600 italic">Aucun certificat médical fourni</p>
                            )}
                          </div>
                        )}
                        {reg.suggestions && (
                          <p className="text-xs text-gray-400 italic mt-1 bg-gray-50 rounded-lg px-2 py-1">« {reg.suggestions} »</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <p className="text-xs text-gray-400">{reg.registeredAt?.toDate().toLocaleDateString('fr-FR')}</p>
                        {deleteConfirm === reg.id ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50">Non</button>
                            <button onClick={() => handleDeleteReg(reg)} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md">Oui</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirm(reg.id)} className="p-1 text-gray-400 hover:text-red-500 transition">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={reg.paymentStatus} onChange={(e) => handlePaymentChange(reg.id, e.target.value)}
                        className={`text-xs font-medium rounded-lg px-2 py-1 border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                          reg.paymentStatus === 'pending' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-green-50 border-green-200 text-green-700'
                        }`}>
                        {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      <button onClick={() => handleAttendance(reg.id, reg.attendance === 'present' ? 'unknown' : 'present')}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition ${reg.attendance === 'present' ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'}`}>
                        <CheckCircleIcon className="w-3.5 h-3.5" />Présent
                      </button>
                      <button onClick={() => handleAttendance(reg.id, reg.attendance === 'absent' ? 'unknown' : 'absent')}
                        className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border transition ${reg.attendance === 'absent' ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'}`}>
                        <XCircleIcon className="w-3.5 h-3.5" />Absent
                      </button>
                      {reg.phone && (
                        <button onClick={() => handleReminderSMS(reg)}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition">
                          <ChatBubbleLeftIcon className="w-3.5 h-3.5" />Rappel
                        </button>
                      )}
                      {reg.paymentStatus === 'pending' && effectiveContactPhone(reg) && (
                        <button onClick={() => openSMS(reg)}
                          title={usesBookingPhone(reg) ? 'Envoyé au numéro de la réservation (pas forcément celui de la personne)' : undefined}
                          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border border-orange-200 text-orange-600 hover:bg-orange-50 transition">
                          <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                          Impayé{usesBookingPhone(reg) && ' (réserv.)'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
