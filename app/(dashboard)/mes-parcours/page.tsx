'use client'

// Garde module-level : la création rétroactive ne tourne qu'une seule fois par UID
// et par session navigateur, même si le composant remonte (React Strict Mode inclus).
const _retroDoneUids = new Set<string>()

import { useState, useEffect, useMemo } from 'react'
import {
  collection, query, where, getDocs, doc, getDoc, onSnapshot,
  runTransaction, Timestamp, orderBy, updateDoc, addDoc,
} from 'firebase/firestore'
import { copyText } from '@/lib/clipboard'
import { uploadImage } from '@/lib/uploadImage'
import { randomUUID } from '@/lib/uuid'
import { addParcoursActivite, removeParcoursActivite } from '@/lib/parcoursPlanning'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { useParcoursIndications } from '@/hooks/useParcoursIndications'
import { indicationsForHeader, indicationsForSession } from '@/lib/parcoursIndications'
import { IndicationList } from '@/components/parcours/IndicationBanner'
import {
  CalendarIcon, MapPinIcon, CheckCircleIcon, XCircleIcon,
  FireIcon, BanknotesIcon, ClockIcon, UsersIcon, HeartIcon,
  SparklesIcon, BoltIcon, ArrowRightIcon, ClipboardDocumentIcon, CheckIcon,
  ExclamationCircleIcon, ChatBubbleLeftRightIcon, PhotoIcon, TrashIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import { StarIcon as StarOutline } from '@heroicons/react/24/outline'

interface Review {
  id: string
  name: string
  email?: string
  rating: number
  comment: string
  photoUrl?: string | null
  userUid?: string | null
  createdAt?: Timestamp
}

function ReviewStars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        n <= value
          ? <StarSolid key={n} className="w-3.5 h-3.5 text-yellow-400" />
          : <StarOutline key={n} className="w-3.5 h-3.5 text-gray-300" />
      )}
    </div>
  )
}

// Formatage des noms : NOM en majuscules, Prénom en nom propre
const toUpperName = (s: string) => s.toUpperCase()
const toProperName = (s: string) =>
  s.split(/([\s-])/).map(p => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')

interface Registration {
  id: string
  sessionId: string
  userId?: string
  firstName: string
  lastName: string
  email: string
  phone: string
  paymentStatus: 'pending' | 'cash' | 'transfer' | 'cancelled_admin' | 'free' | 'waived'
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
  free: 'Offert',
  waived: 'Non dû',
  cancelled_admin: 'Séance annulée',
}

function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function shortDate(ts?: Timestamp) {
  return ts ? ts.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
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

  // Indications / alertes (gérées depuis l'admin)
  const { indications } = useParcoursIndications()

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
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [contactPhone, setContactPhone] = useState('+33679408254')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    getDoc(doc(db, 'settings', 'parcours_sportif')).then((snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (d.iban) setIban(d.iban)
        if (d.bic) setBic(d.bic)
        if (d.contactPhone) setContactPhone(d.contactPhone)
      }
    }).catch(() => {})
  }, [])

  // Lien SMS pour prévenir le coach d'un imprévu (signé avec le nom de l'utilisateur)
  const cancelSmsHref = (reg: RegWithSession) => {
    const dateLabel = reg.session ? fmtDate(reg.session.date) : ''
    const signature = `${userProfile?.prenom ?? ''} ${userProfile?.nom ?? ''}`.trim() || '[Votre prénom et nom]'
    const body = `Bonjour Teddy,\n\nJe suis inscrit(e) au Parcours Sportif du ${dateLabel} mais je ne pourrai malheureusement pas être présent(e).\n\nDésolé(e) pour le désagrément et merci de votre compréhension.\n\n${signature}`
    return `sms:${contactPhone.replace(/\s/g, '')}?body=${encodeURIComponent(body)}`
  }

  // Lien SMS "libre" : message vide (juste une formule + signature pour t'identifier),
  // ex. pour signaler une erreur de coordonnées ("mon numéro n'est pas bon", etc.)
  const contactSmsHref = () => {
    const signature = `${userProfile?.prenom ?? ''} ${userProfile?.nom ?? ''}`.trim() || '[Votre prénom et nom]'
    const body = `Bonjour Teddy,\n\n\n\n${signature}`
    return `sms:${contactPhone.replace(/\s/g, '')}?body=${encodeURIComponent(body)}`
  }

  const copyField = async (value: string, key: string) => {
    await copyText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // ── Avis (lecture seule ici, dépôt sur la page publique) ──
  const [reviews, setReviews] = useState<Review[]>([])
  useEffect(() => {
    const q = query(collection(db, 'parcours_reviews'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))),
      () => setReviews([])
    )
  }, [])
  // Relier rétroactivement les avis dont l'email correspond à mon compte
  useEffect(() => {
    if (!currentUser?.email || !reviews.length) return
    const myEmail = currentUser.email.toLowerCase()
    reviews
      .filter((r) => !r.userUid && r.email && r.email.toLowerCase() === myEmail)
      .forEach((r) => { updateDoc(doc(db, 'parcours_reviews', r.id), { userUid: currentUser.uid }).catch(() => {}) })
  }, [reviews, currentUser])

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 10) / 10
    : 0

  // Modal "Laisser un avis"
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '', photo: null as File | null })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)

  const openReviewModal = () => {
    setReviewSuccess(false)
    setReviewError('')
    setReviewForm({ name: userProfile?.prenom || '', rating: 5, comment: '', photo: null })
    setShowReviewModal(true)
  }

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    if (!reviewForm.name.trim()) { setReviewError('Veuillez indiquer votre prénom.'); return }
    if (!reviewForm.comment.trim()) { setReviewError('Veuillez écrire un avis.'); return }
    setReviewError('')
    setReviewSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (reviewForm.photo) {
        try {
          photoUrl = await uploadImage(reviewForm.photo, `parcours_reviews/${Date.now()}_${reviewForm.photo.name}`)
        } catch { photoUrl = null }
      }
      const reviewRef = await addDoc(collection(db, 'parcours_reviews'), {
        name: reviewForm.name.trim(),
        email: currentUser.email?.toLowerCase() ?? '',
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        photoUrl,
        userUid: currentUser.uid,
        createdAt: Timestamp.now(),
      })
      setReviewSuccess(true)
      setTimeout(() => setShowReviewModal(false), 1500)
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title: 'Nouvel avis Parcours Sportif',
          body: `${reviewForm.name.trim()} a laissé un avis ${reviewForm.rating}/5.`,
          url: `/admin/parcours-sportif?highlight=${reviewRef.id}`,
          persist: true,
          type: 'AVIS_PARCOURS',
        }),
      }).catch(() => {})
    } catch (err: any) {
      setReviewError(err.message ?? "Erreur lors de l'envoi de l'avis")
    }
    setReviewSubmitting(false)
  }

  // Modal inscription
  const [selected, setSelected] = useState<Session | null>(null)
  const [extraSessionIds, setExtraSessionIds] = useState<Set<string>>(new Set())
  const [successWarning, setSuccessWarning] = useState('')
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
          const data = d.data() as any
          // On masque les inscriptions dont la personne s'est désinscrite (gardées pour les stats admin)
          if (!seen.has(d.id) && data.attendance !== 'deregistered') {
            seen.add(d.id); regs.push({ ...data, id: d.id } as Registration)
          }
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
      // Création rétroactive des activités planning manquantes — une seule fois par UID
      // par session navigateur (garde module-level _retroDoneUids).
      if (!_retroDoneUids.has(currentUser!.uid)) {
        _retroDoneUids.add(currentUser!.uid)
        const seenSessionIds = new Set<string>()
        await Promise.all(
          regs
            .filter((r) => {
              if (seenSessionIds.has(r.sessionId)) return false
              seenSessionIds.add(r.sessionId)
              return true
            })
            .map((r) => {
              const sess = sessionMap[r.sessionId]
              if (!sess) return Promise.resolve()
              return addParcoursActivite({
                userId: currentUser!.uid,
                registrationId: r.id,
                sessionId: r.sessionId,
                session: sess as any,
              })
            })
        )
      }
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

  const myStats = useMemo(() => {
    if (past.length === 0) return null
    const presentCount = past.filter((i) => i.attendance === 'present').length
    const absentCount = past.filter((i) => i.attendance === 'absent').length
    const cancelledCount = past.filter((i) => i.paymentStatus === 'cancelled_admin' || i.session?.status === 'cancelled').length
    const unknownCount = past.length - presentCount - absentCount - cancelledCount
    const ratedCount = presentCount + absentCount
    const presenceRate = ratedCount > 0 ? Math.round((presentCount / ratedCount) * 100) : null
    // Par année (hors annulées)
    const byYear: Record<number, { total: number; present: number }> = {}
    for (const i of past) {
      if (i.paymentStatus === 'cancelled_admin' || i.session?.status === 'cancelled') continue
      const y = i.session?.date?.toDate().getFullYear()
      if (!y) continue
      if (!byYear[y]) byYear[y] = { total: 0, present: 0 }
      byYear[y].total++
      if (i.attendance === 'present') byYear[y].present++
    }
    return { total: past.length, presentCount, absentCount, cancelledCount, unknownCount, presenceRate, byYear }
  }, [past])

  const openRegister = (session: Session) => {
    setSelected(session)
    setExtraSessionIds(new Set())
    setSuccessWarning('')
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
    if (!form.phone.trim()) { setError('Le numéro de téléphone est obligatoire.'); return }
    setError('')
    setSuccessWarning('')
    setSubmitting(true)
    const targetSessions = [selected, ...sessions.filter((s) => extraSessionIds.has(s.id))]

    const registerToSession = async (sess: Session) => {
      let newRegId = ''
      await runTransaction(db, async (tx) => {
        const sessionRef = doc(db, 'sessions', sess.id)
        const snap = await tx.get(sessionRef)
        if (!snap.exists()) throw new Error('Séance introuvable')
        const data = snap.data()
        if (data.registeredCount >= data.maxSpots) throw new Error('complète')
        const newCount = data.registeredCount + 1
        const regRef = doc(collection(db, 'registrations'))
        newRegId = regRef.id
        tx.set(regRef, {
          sessionId: sess.id,
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
          uniqueToken: randomUUID(),
        })
        tx.update(sessionRef, {
          registeredCount: newCount,
          status: newCount >= data.maxSpots ? 'full' : 'open',
        })
      })
      return newRegId
    }

    const who = `${form.firstName} ${form.lastName}`.trim() || 'Un participant'
    let successes = 0
    const failed: string[] = []
    try {
      for (const sess of targetSessions) {
        try {
          const newRegId = await registerToSession(sess)
          successes++
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toAdmins: true,
              persist: true,
              type: 'PARCOURS_INSCRIPTION',
              title: 'Nouvelle inscription Parcours Sportif',
              body: `${who} s'est inscrit(e) à "${sess.title}"`,
              url: `/admin/parcours-sportif/${sess.id}?highlight=${newRegId}`,
            }),
          }).catch(() => {})
          await addParcoursActivite({
            userId: currentUser.uid,
            registrationId: newRegId,
            sessionId: sess.id,
            session: sess as any,
          })
        } catch (err: any) {
          failed.push(`${fmtDate(sess.date)} (${err?.message === 'complète' ? 'complète' : 'erreur'})`)
        }
      }
      if (successes === 0) {
        setError(failed.length ? `Aucune inscription : ${failed.join(', ')}` : "Erreur lors de l'inscription")
      } else {
        if (failed.length) setSuccessWarning(`Certaines dates n'ont pas pu être réservées : ${failed.join(', ')}.`)
        setSuccess(true)
        await loadRegistrations()
      }
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
        // On NE supprime PAS l'inscription : on la marque "désinscrit" (garde la trace
        // pour les stats côté admin, et on n'attend plus de paiement).
        tx.update(regRef, { attendance: 'deregistered', paymentStatus: 'pending' })
      })
      // Retirer l'activité du planning
      await removeParcoursActivite(reg.id)
      // Prévenir les admins de la désinscription (push + section Notifications)
      const who = [reg.firstName, reg.lastName].filter(Boolean).join(' ') || userProfile?.display_name || 'Un participant'
      const dateStr = reg.session?.date ? shortDate(reg.session.date) : ''
      try {
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            toAdmins: true,
            persist: true,
            type: 'PARCOURS_DESINSCRIPTION',
            title: 'Désinscription Parcours Sportif',
            body: `${who} s'est désinscrit(e) du Parcours Sportif${dateStr ? ` du ${dateStr}` : ''}.`,
            url: `/admin/parcours-sportif/${reg.sessionId}`,
          }),
        })
      } catch { /* la désinscription a réussi même si la notif échoue */ }
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
        {(() => {
          const ind = indicationsForSession(indications, session.id, session.date.toMillis())
          return ind.length > 0 ? <div className="mb-3"><IndicationList indications={ind} compact /></div> : null
        })()}
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
    const isUpcomingUnpaid = !isPast && !isCancelled && reg.paymentStatus === 'pending'
    return (
      <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isCancelled ? 'border-red-100 opacity-70' : isUpcomingUnpaid ? 'border-yellow-200' : 'border-gray-100'}`}>
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
        {/* Indications / alertes pour cette séance (à venir uniquement) */}
        {session && !isPast && (() => {
          const ind = indicationsForSession(indications, session.id, session.date.toMillis())
          return ind.length > 0 ? <div className="mb-3"><IndicationList indications={ind} compact /></div> : null
        })()}
        {/* Badge impayé discret sur les séances à venir */}
        {isUpcomingUnpaid && (iban || bic) && (
          <div className="mb-3 bg-yellow-50 border border-yellow-100 rounded-xl px-3 py-2 space-y-2">
            <p className="text-xs font-semibold text-yellow-800 flex items-center gap-1">
              <BanknotesIcon className="w-3.5 h-3.5" /> Règlement en attente
            </p>
            {iban && (
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <p className="text-xs font-mono text-gray-700 break-all">{iban.match(/.{1,4}/g)?.join(' ') ?? iban}</p>
                <button onClick={() => copyField(iban, `iban-${reg.id}`)}
                  className="self-start text-[10px] font-medium text-blue-600 border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                  {copiedKey === `iban-${reg.id}` ? '✓ Copié' : 'Copier IBAN'}
                </button>
              </div>
            )}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <p className="text-[10px] text-gray-400">Réf. : nom et prénom + date du parcours</p>
              <button onClick={() => copyField(`${reg.firstName} ${reg.lastName} - Parcours Sportif du ${shortDate(reg.session?.date)}`.trim(), `ref-${reg.id}`)}
                className="self-start text-[10px] font-medium text-blue-600 border border-blue-200 px-2 py-0.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                {copiedKey === `ref-${reg.id}` ? '✓ Copié' : 'Copier la référence'}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            reg.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700'
            : reg.paymentStatus === 'cancelled_admin' ? 'bg-gray-100 text-gray-500'
            : reg.paymentStatus === 'free' || reg.paymentStatus === 'waived' ? 'bg-purple-100 text-purple-600'
            : 'bg-green-100 text-green-700'
          }`}>
            {PAYMENT_LABELS[reg.paymentStatus] ?? reg.paymentStatus}
          </span>
          {!isPast && !isCancelled && (
            <div className="flex items-center gap-2 flex-wrap">
              <a href={cancelSmsHref(reg)}
                className="flex items-center gap-1 text-xs font-medium text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg transition">
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                Prévenir d'un imprévu
              </a>
              <a href={contactSmsHref()}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition">
                <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                Autre message
              </a>
              {cancelConfirm === reg.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Annuler ?</span>
                  <button onClick={() => setCancelConfirm(null)} className="text-xs text-gray-500 border border-gray-200 px-2 py-0.5 rounded-lg hover:bg-gray-50 transition">Non</button>
                  <button onClick={() => handleCancel(reg)} disabled={cancelling} className="text-xs text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition disabled:opacity-50">{cancelling ? '...' : 'Oui'}</button>
                </div>
              ) : (
                <button onClick={() => setCancelConfirm(reg.id)} className="text-xs text-red-500 border border-red-200 hover:bg-red-50 px-2.5 py-1 rounded-lg transition">
                  Se désinscrire
                </button>
              )}
            </div>
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
            Des séances de sport en groupe, conviviales et accessibles à tous — au bord de la plage.
          </p>
          <div className="flex flex-col items-start gap-2 mt-4">
            <a href="/parcours-sportif"
              className="inline-flex items-center gap-2 bg-white/15 border border-white/40 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-white/25 transition">
              <FireIcon className="w-4 h-4" />
              Parcours Sportif
              <ArrowRightIcon className="w-4 h-4" />
            </a>
            {availableSessions.length > 0 && (
              <a href="#dispo"
                className="inline-flex items-center gap-2 bg-white text-orange-600 text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-orange-50 transition">
                Voir les {availableSessions.length} séance{availableSessions.length > 1 ? 's' : ''} disponible{availableSessions.length > 1 ? 's' : ''}
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
        <FireIcon className="absolute -right-6 -bottom-6 w-44 h-44 text-white/10" />
      </div>

      {/* Indications / alertes (gérées depuis l'admin) */}
      <IndicationList indications={indicationsForHeader(indications)} />

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

      {/* ── Règlements en attente PASSÉS (bannière, lendemain matin) ─ */}
      {(() => {
        const tomorrow0h = new Date(); tomorrow0h.setDate(tomorrow0h.getDate() + 1); tomorrow0h.setHours(0, 0, 0, 0)
        const pastUnpaid = items.filter((i) => i.paymentStatus === 'pending' && i.session && i.session.status !== 'cancelled' && (i.session.date?.toMillis() ?? 0) < tomorrow0h.getTime())
        if (!pastUnpaid.length) return null
        return (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-orange-800">
                  {pastUnpaid.length === 1 ? '1 règlement en attente' : `${pastUnpaid.length} règlements en attente`}
                </p>
                <div className="mt-2 space-y-2">
                  {pastUnpaid.map((reg) => {
                    const ref = `${reg.firstName} ${reg.lastName} - Parcours Sportif du ${shortDate(reg.session?.date)}`.trim()
                    return (
                      <div key={reg.id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <p className="text-xs text-orange-700">
                          • {reg.session?.title}{reg.session?.price != null ? ` — ${reg.session.price}€` : ''}
                        </p>
                        <button onClick={() => copyField(ref, `ref-${reg.id}`)}
                          className="self-start flex items-center gap-1 text-[10px] font-medium text-orange-700 border border-orange-300 bg-white px-2 py-0.5 rounded-lg hover:bg-orange-50 transition shrink-0">
                          {copiedKey === `ref-${reg.id}` ? <CheckIcon className="w-3 h-3 text-green-600" /> : <ClipboardDocumentIcon className="w-3 h-3" />}
                          {copiedKey === `ref-${reg.id}` ? 'Copié !' : 'Copier la référence'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            {(iban || bic) && (
              <div className="bg-white rounded-xl border border-orange-100 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Virement bancaire</p>
                {iban && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">IBAN</p>
                      <p className="text-sm font-mono text-gray-800 tracking-wide">{iban.match(/.{1,4}/g)?.join(' ') ?? iban}</p>
                    </div>
                    <button onClick={() => copyField(iban, 'iban')}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                      {copiedKey === 'iban' ? <CheckIcon className="w-3.5 h-3.5 text-green-600" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
                      {copiedKey === 'iban' ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                )}
                {bic && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] text-gray-400 font-medium">BIC</p>
                      <p className="text-sm font-mono text-gray-800">{bic}</p>
                    </div>
                    <button onClick={() => copyField(bic, 'bic')}
                      className="flex items-center gap-1 text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                      {copiedKey === 'bic' ? <CheckIcon className="w-3.5 h-3.5 text-green-600" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
                      {copiedKey === 'bic' ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-gray-400">Indiquez votre nom et prénom ainsi que la date du parcours sportif en référence du virement (bouton « Copier réf. » ci-dessus).</p>
              </div>
            )}
          </div>
        )
      })()}

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

      {/* ── Mes stats ── */}
      {myStats && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <ChartBarIcon className="w-4 h-4 text-blue-500" />
            Mes stats
          </h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
            {/* Chiffres clés */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="text-center bg-gray-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-gray-800">{myStats.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Séance{myStats.total > 1 ? 's' : ''}</p>
              </div>
              <div className="text-center bg-green-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-green-600">{myStats.presentCount}</p>
                <p className="text-xs text-green-700 mt-0.5">Présence{myStats.presentCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-center bg-red-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-red-500">{myStats.absentCount}</p>
                <p className="text-xs text-red-600 mt-0.5">Absence{myStats.absentCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="text-center bg-gray-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-gray-400">{myStats.cancelledCount + myStats.unknownCount}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {myStats.cancelledCount > 0 && myStats.unknownCount === 0 ? 'Annulée' + (myStats.cancelledCount !== 1 ? 's' : '')
                   : myStats.unknownCount > 0 && myStats.cancelledCount === 0 ? 'Non pointée' + (myStats.unknownCount !== 1 ? 's' : '')
                   : 'Non comptées'}
                </p>
              </div>
            </div>
            {/* Détail si mix annulées + non pointées */}
            {myStats.cancelledCount > 0 && myStats.unknownCount > 0 && (
              <p className="text-[11px] text-gray-400 text-center -mt-2">
                dont {myStats.cancelledCount} annulée{myStats.cancelledCount !== 1 ? 's' : ''} et {myStats.unknownCount} non pointée{myStats.unknownCount !== 1 ? 's' : ''}
              </p>
            )}

            {/* Taux de présence */}
            {myStats.presenceRate !== null && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-600">Taux de présence</p>
                  <span className={`text-sm font-bold ${myStats.presenceRate >= 70 ? 'text-green-600' : myStats.presenceRate >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                    {myStats.presenceRate}%
                  </span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${myStats.presenceRate >= 70 ? 'bg-green-500' : myStats.presenceRate >= 40 ? 'bg-orange-400' : 'bg-red-400'}`}
                    style={{ width: `${myStats.presenceRate}%` }}
                  />
                </div>
              </div>
            )}

            {/* Par année */}
            {Object.keys(myStats.byYear).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-2">Par année</p>
                <div className="space-y-1.5">
                  {Object.entries(myStats.byYear).sort(([a], [b]) => Number(b) - Number(a)).map(([year, b]) => {
                    const rate = b.total > 0 ? Math.round((b.present / b.total) * 100) : 0
                    return (
                      <div key={year} className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-gray-700 w-10 shrink-0">{year}</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-400 rounded-full" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 w-24 text-right">
                          {b.total} séance{b.total > 1 ? 's' : ''} · {rate}% présence
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Prochaine séance */}
            {upcoming.length > 0 && (
              <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
                <CalendarIcon className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-700">{upcoming.length} séance{upcoming.length > 1 ? 's' : ''} à venir</p>
                  {upcoming[0].session && (
                    <p className="text-xs text-blue-600 truncate capitalize">{fmtDate(upcoming[0].session.date)}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Avis des participants ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-yellow-500" />
            Avis des participants {reviews.length > 0 && `(${reviews.length})`}
            {reviews.length > 0 && (
              <span className="flex items-center gap-1 normal-case text-gray-600">
                <StarSolid className="w-3.5 h-3.5 text-yellow-400" /> {avgRating}/5
              </span>
            )}
          </h2>
          <button onClick={openReviewModal}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
            Laisser un avis
          </button>
        </div>
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <StarOutline className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">Aucun avis pour l'instant</p>
            <p className="text-xs text-gray-400 mt-0.5">Soyez le premier à partager votre expérience depuis la page publique !</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {reviews.map((r) => (
              <div key={r.id} className="border border-gray-100 rounded-xl p-3 bg-white">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {r.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm font-semibold text-gray-800 truncate">{r.name}</span>
                  </div>
                  <ReviewStars value={r.rating} />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                {r.photoUrl && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                    <img src={r.photoUrl} alt={`Photo de ${r.name}`} loading="lazy" className="max-h-40 w-auto object-contain" />
                  </div>
                )}
                {r.createdAt && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    {r.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal inscription */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={success ? 'Inscription confirmée !' : 'Inscription'} size="md">
        {success ? (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Vous êtes inscrit !</h3>
            <p className="text-sm text-gray-500 mb-3">Votre place est réservée. Retrouvez-la dans « Mes prochaines séances ».</p>
            {successWarning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-left">{successWarning}</p>
            )}
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

            {selected && (
              <IndicationList indications={indicationsForSession(indications, selected.id, selected.date.toMillis())} compact />
            )}

            {/* Inscription à plusieurs dates en même temps */}
            {(() => {
              const others = sessions.filter((s) =>
                s.id !== selected?.id && s.status !== 'cancelled' && (s.maxSpots - s.registeredCount) > 0
              )
              if (others.length === 0) return null
              const toggle = (id: string) => setExtraSessionIds((prev) => {
                const next = new Set(prev)
                next.has(id) ? next.delete(id) : next.add(id)
                return next
              })
              return (
                <div className="border border-gray-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-gray-700">S'inscrire à d'autres dates en même temps ?</p>
                  <p className="text-xs text-gray-400 mb-2">Cochez les dates souhaitées (optionnel).</p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {others.map((s) => {
                      const left = s.maxSpots - s.registeredCount
                      return (
                        <label key={s.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer">
                          <input type="checkbox" checked={extraSessionIds.has(s.id)} onChange={() => toggle(s.id)}
                            className="w-4 h-4 accent-blue-600 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 capitalize truncate">{fmtDate(s.date)} · {sessionTimeRange(s)}</p>
                            <p className="text-xs text-gray-400 truncate">{s.title} — {left} place{left > 1 ? 's' : ''}</p>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {extraSessionIds.size > 0 && (
                    <p className="text-xs font-medium text-blue-600 mt-2">{extraSessionIds.size + 1} dates sélectionnées au total</p>
                  )}
                </div>
              )
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input type="text" required value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: toProperName(e.target.value) }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input type="text" required value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: toUpperName(e.target.value) }))}
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

      {/* Modal Laisser un avis */}
      <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)} title="Laisser un avis" size="md">
        {reviewSuccess ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircleIcon className="w-7 h-7 text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Merci pour votre avis !</h3>
            <p className="text-sm text-gray-500">Il est maintenant visible par tous.</p>
          </div>
        ) : (
          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre prénom *</label>
              <input type="text" required value={reviewForm.name}
                onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre note</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: n }))} className="p-0.5">
                    {n <= reviewForm.rating
                      ? <StarSolid className="w-8 h-8 text-yellow-400" />
                      : <StarOutline className="w-8 h-8 text-gray-300 hover:text-yellow-300 transition" />}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Votre avis *</label>
              <textarea required value={reviewForm.comment} rows={4}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Partagez votre expérience du Parcours Sportif..."
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Photo <span className="font-normal text-gray-400">(optionnel)</span>
              </label>
              {reviewForm.photo ? (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <PhotoIcon className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-xs text-gray-700 flex-1 truncate">{reviewForm.photo.name}</span>
                  <button type="button" onClick={() => setReviewForm((f) => ({ ...f, photo: null }))}
                    className="text-gray-400 hover:text-red-500 transition">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 border-dashed rounded-xl px-3 py-2.5 cursor-pointer hover:bg-gray-100 transition">
                  <PhotoIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500">Ajouter une photo</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => setReviewForm((f) => ({ ...f, photo: e.target.files?.[0] ?? null }))} />
                </label>
              )}
            </div>
            {reviewError && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{reviewError}</p>}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowReviewModal(false)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={reviewSubmitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {reviewSubmitting ? 'Envoi...' : 'Publier mon avis'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
