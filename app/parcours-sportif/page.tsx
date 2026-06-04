'use client'

import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot, where,
  doc, runTransaction, Timestamp, getDocs, addDoc, deleteDoc, getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { uploadImage } from '@/lib/uploadImage'
import { randomUUID } from '@/lib/uuid'
import { addParcoursActivite } from '@/lib/parcoursPlanning'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/ui/Modal'
import {
  MapPinIcon, CalendarIcon, ClockIcon, BanknotesIcon,
  UsersIcon, CheckCircleIcon, ChevronDownIcon, ChevronUpIcon,
  PlusIcon, TrashIcon, ChatBubbleLeftIcon, UserGroupIcon,
  DocumentArrowUpIcon, FireIcon, HeartIcon, SparklesIcon,
  BoltIcon, ArrowRightIcon, ArrowLeftIcon, PhoneIcon, EnvelopeIcon, GlobeAltIcon,
  StarIcon as StarOutline, PhotoIcon, BeakerIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'

interface Session {
  id: string
  title: string
  date: Timestamp
  dateEnd?: Timestamp
  durationMinutes?: number
  location?: string
  locationCoords?: string
  locationLabel?: string
  maxSpots: number
  registeredCount: number
  status: 'open' | 'full' | 'cancelled'
  price?: number
  contactPhone?: string
  hidden?: boolean
}

// Formatage des noms : NOM en majuscules, Prénom en nom propre
const toUpperName = (s: string) => s.toUpperCase()
const toProperName = (s: string) =>
  s.split(/([\s-])/).map(p => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')

interface Participant {
  firstName: string
  lastName: string
  email: string
  phone: string
  suggestions: string
  isMinor: boolean
  parentalConsent: boolean
  // Champs attestation parentale (si mineur)
  guardianName: string
  guardianRelation: string
  guardianPhone: string
  birthDate: string
  medicalCert: File | null
}

function emptyParticipant(): Participant {
  return {
    firstName: '', lastName: '', email: '', phone: '', suggestions: '',
    isMinor: false, parentalConsent: false,
    guardianName: '', guardianRelation: '', guardianPhone: '', birthDate: '', medicalCert: null,
  }
}

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

function Stars({ value, size = 'w-4 h-4' }: { value: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        n <= value
          ? <StarSolid key={n} className={`${size} text-yellow-400`} />
          : <StarOutline key={n} className={`${size} text-gray-300`} />
      ))}
    </div>
  )
}

function sessionLocationLabel(s: Session): string {
  return s.locationLabel || s.location || s.locationCoords || '—'
}
function sessionMapsLink(s: Session): string | null {
  if (!s.locationCoords) return null
  const parts = s.locationCoords.replace(/\s/g, '').split(',')
  if (parts.length !== 2 || isNaN(parseFloat(parts[0])) || isNaN(parseFloat(parts[1]))) return null
  return `https://maps.google.com/maps?q=${s.locationCoords.replace(/\s/g, '')}`
}
function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtHeure(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
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

// Numéro de contact du coach (celui de la séance, sinon le numéro par défaut)
const DEFAULT_CONTACT_PHONE = '+33679408254'
function sessionCancelSmsLink(s: Session, signature = '[Votre prénom et nom]'): string {
  const phone = (s.contactPhone || DEFAULT_CONTACT_PHONE).replace(/\s/g, '')
  const dateLabel = fmtDate(s.date)
  const body = `Bonjour Teddy,\n\nJe suis inscrit(e) au Parcours Sportif du ${dateLabel} mais je ne pourrai malheureusement pas être présent(e).\n\nDésolé(e) pour le désagrément et merci de votre compréhension.\n\n${signature}`
  return `sms:${phone}?body=${encodeURIComponent(body)}`
}

function WaterDropIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C12 3 5.5 10 5.5 15a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3z" />
    </svg>
  )
}

const IMPORTANT_NOTES_BASE = [
  { key: 'heure',   Icon: CheckCircleIcon,   bg: 'bg-blue-50',   color: 'text-blue-600',   text: 'Inscription avant 12h le Jour J',            href: null },
  { key: 'min',     Icon: UserGroupIcon,      bg: 'bg-orange-50', color: 'text-orange-500', text: 'Séance maintenue à partir de 6 participants', href: null },
  { key: 'imprévu', Icon: PhoneIcon,          bg: 'bg-red-50',    color: 'text-red-500',    text: 'Prévenez en cas d\'imprévu',                 href: '__SMS__' },
  { key: 'eau',     Icon: WaterDropIcon,      bg: 'bg-purple-50', color: 'text-purple-500', text: 'Prévoyez votre propre bouteille d\'eau',     href: null },
]

const BENEFITS = [
  { icon: HeartIcon, color: 'text-red-500', bg: 'bg-red-50', title: 'Pour tous les niveaux', desc: 'Séances adaptées, débutant ou confirmé' },
  { icon: UsersIcon, color: 'text-blue-500', bg: 'bg-blue-50', title: 'Esprit de groupe', desc: 'Motivation et bonne ambiance garanties' },
  { icon: SparklesIcon, color: 'text-purple-500', bg: 'bg-purple-50', title: 'En plein air', desc: 'Au bord de la plage, dans un cadre unique' },
  { icon: BoltIcon, color: 'text-orange-500', bg: 'bg-orange-50', title: '50min – 1h d\'effort', desc: 'Un format efficace pour se dépenser' },
]

const FULL_INFO = `‼️ Le parcours sportif est destiné à TOUS ‼️

Pour une organisation optimale, inscrivez-vous au plus tard le Jour J à 12h00. La séance aura lieu uniquement si 6 personnes minimum sont inscrites — sans cela, les inscrits seront prévenus de l'annulation.

D'autres dates seront potentiellement rajoutées par la suite !

Attention : Si vous vous inscrivez mais que vous ne venez pas, cela pourrait compromettre l'organisation des Parcours. Merci de me prévenir au plus tôt si vous ne pouvez finalement pas vous libérer.

Information importante : Je ne prends plus les bouteilles d'eau dans mon sac à dos. Merci de prévoir en conséquent.

Vous pouvez également regarder la description du cours un peu plus bas sur la page. N'oubliez pas, le cours est ouvert à TOUS et adaptable à TOUS !!!!

Si vous avez des questions, n'hésitez pas à revenir vers moi.`

export default function ParcoursPublicPage() {
  const { currentUser, userProfile, loading: authLoading } = useAuth()

  const [sessions, setSessions] = useState<Session[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('/logo.png')
  const [settingsPhone, setSettingsPhone] = useState(DEFAULT_CONTACT_PHONE)

  useEffect(() => {
    getDoc(doc(db, 'settings', 'parcours_sportif')).then((snap) => {
      if (snap.exists()) {
        const phone = snap.data().contactPhone
        if (phone) setSettingsPhone(phone)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    getDocs(collection(db, 'companies')).then((snap) => {
      const teddyDoc = snap.docs.find((d) =>
        (d.data().nom ?? '').toLowerCase().includes('teddy')
      )
      if (teddyDoc?.data().logoUrl) setCompanyLogoUrl(teddyDoc.data().logoUrl)
    }).catch(() => {})
  }, [])
  const [selected, setSelected] = useState<Session | null>(null)
  const [extraSessionIds, setExtraSessionIds] = useState<Set<string>>(new Set())
  const [participants, setParticipants] = useState<Participant[]>([emptyParticipant()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successCount, setSuccessCount] = useState(0)
  const [successToken, setSuccessToken] = useState('')
  const [successWarning, setSuccessWarning] = useState('')
  const [showFullInfo, setShowFullInfo] = useState(false)
  const [showWhat, setShowWhat] = useState(false)

  // Avis
  const [reviews, setReviews] = useState<Review[]>([])
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewForm, setReviewForm] = useState({ name: '', email: '', rating: 5, comment: '', photo: null as File | null })
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const [reviewSuccess, setReviewSuccess] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('date', 'asc'))
    return onSnapshot(q, (snap) => {
      const now = Date.now()
      setSessions(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Session))
          .filter((s) => s.status !== 'cancelled' && !s.hidden && (s.date?.toMillis() ?? 0) >= now)
      )
      setLoadingSessions(false)
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'parcours_reviews'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))),
      () => setReviews([])
    )
  }, [])

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewForm.name.trim()) { setReviewError('Veuillez indiquer votre prénom.'); return }
    if (!reviewForm.email.trim()) { setReviewError('Veuillez indiquer votre adresse email.'); return }
    if (!reviewForm.comment.trim()) { setReviewError('Veuillez écrire un avis.'); return }
    setReviewError('')
    setReviewSubmitting(true)
    try {
      let photoUrl: string | null = null
      if (reviewForm.photo) {
        try {
          const path = `parcours_reviews/${Date.now()}_${reviewForm.photo.name}`
          photoUrl = await uploadImage(reviewForm.photo, path)
        } catch { photoUrl = null }
      }
      // Relier l'avis à un compte si l'email correspond à un utilisateur existant
      const reviewEmail = reviewForm.email.trim().toLowerCase()
      let userUid: string | null = null
      if (currentUser?.email?.toLowerCase() === reviewEmail) {
        userUid = currentUser.uid
      } else {
        try {
          const uSnap = await getDocs(query(collection(db, 'users'), where('email', '==', reviewEmail)))
          if (!uSnap.empty) userUid = uSnap.docs[0].id
        } catch {}
      }
      const reviewRef = await addDoc(collection(db, 'parcours_reviews'), {
        name: reviewForm.name.trim(),
        email: reviewEmail,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        photoUrl,
        userUid,
        createdAt: Timestamp.now(),
      })
      setReviewSuccess(true)
      setReviewForm({ name: '', email: '', rating: 5, comment: '', photo: null })
      setTimeout(() => { setShowReviewModal(false); setReviewSuccess(false) }, 1500)
      // Notifier les admins — URL avec l'ID de l'avis pour le surligner
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
      setReviewError(err.message ?? 'Erreur lors de l\'envoi de l\'avis')
    }
    setReviewSubmitting(false)
  }

  // Un avis est supprimable par : un admin, OU l'utilisateur connecté dont l'email
  // correspond à celui de l'avis (il a créé un compte avec la même adresse).
  const isAdmin = userProfile?.role_app === 'Admin'
  const canDeleteReview = (r: Review): boolean => {
    if (isAdmin) return true
    const myEmail = currentUser?.email?.toLowerCase()
    return !!myEmail && !!r.email && r.email.toLowerCase() === myEmail
  }

  const handleDeleteReview = async (r: Review) => {
    try {
      await deleteDoc(doc(db, 'parcours_reviews', r.id))
    } catch (err) {
      console.error('[deleteReview]', err)
    }
  }

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 10) / 10
    : 0

  const handleRegisterClick = (session: Session) => {
    if (authLoading) return
    // Ne pas pré-remplir en mode impersonation (admin prenant la main sur un compte)
    const isImpersonating = typeof window !== 'undefined' && !!localStorage.getItem('tc_impersonation')
    const canPrefill = currentUser && userProfile && !isImpersonating
    setSelected(session)
    setExtraSessionIds(new Set())
    setSuccessCount(0)
    setSuccessWarning('')
    setError('')
    setParticipants([{
      ...emptyParticipant(),
      firstName: canPrefill ? (userProfile?.prenom ?? '') : '',
      lastName:  canPrefill ? (userProfile?.nom ?? '')    : '',
      email:     canPrefill ? (currentUser?.email ?? '')  : '',
      phone:     canPrefill ? (userProfile?.phone_number ?? '') : '',
    }])
  }

  const updateParticipant = (i: number, field: keyof Participant, value: string | boolean | File | null) => {
    setParticipants((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    // Le téléphone du participant principal (qui réserve) est obligatoire
    if (!participants[0]?.phone.trim()) {
      setError('Le numéro de téléphone est obligatoire.')
      return
    }
    for (const p of participants) {
      if (!p.firstName.trim()) { setError('Le prénom est obligatoire pour chaque participant.'); return }
      if (p.isMinor) {
        if (!p.parentalConsent) { setError(`Vous devez cocher l'attestation parentale pour ${p.firstName}.`); return }
        if (!p.guardianName.trim()) { setError(`Le nom du représentant légal est requis pour ${p.firstName}.`); return }
        if (!p.guardianPhone.trim()) { setError(`Le téléphone du représentant légal est requis pour ${p.firstName}.`); return }
      }
    }
    const hasMinor = participants.some((p) => p.isMinor)
    const hasAdult = participants.some((p) => !p.isMinor)
    if (hasMinor && !hasAdult) {
      setError('Un adulte responsable doit être inscrit dans le même formulaire pour accompagner le mineur. Ajoutez un participant adulte.')
      return
    }
    setError('')
    setSuccessWarning('')
    setSubmitting(true)
    const n = participants.length
    // Sessions cibles : celle ouverte + les dates supplémentaires cochées
    const targetSessions = [selected, ...sessions.filter((s) => extraSessionIds.has(s.id))]
    try {
      // Upload des certificats médicaux UNE fois (réutilisés pour toutes les dates)
      const certUrls: (string | null)[] = await Promise.all(
        participants.map(async (p) => {
          if (p.isMinor && p.medicalCert) {
            try {
              const path = `medical_certs/${Date.now()}_${Math.random().toString(36).slice(2)}_${p.medicalCert.name}`
              return await uploadImage(p.medicalCert, path)
            } catch { return null }
          }
          return null
        })
      )

      // Inscrit tous les participants à UNE session (transaction). Lève une erreur si complet / déjà inscrit.
      const registerToSession = async (sess: Session) => {
        if (n === 1) {
          const email = participants[0].email.trim().toLowerCase()
          if (email) {
            const dup = await getDocs(query(
              collection(db, 'registrations'),
              where('sessionId', '==', sess.id),
              where('email', '==', email),
            ))
            if (!dup.empty) throw new Error('DEJA_INSCRIT')
          }
        }
        return await runTransaction(db, async (tx) => {
          const sessionRef = doc(db, 'sessions', sess.id)
          const snap = await tx.get(sessionRef)
          if (!snap.exists()) throw new Error('Séance introuvable')
          const data = snap.data()
          const available = data.maxSpots - data.registeredCount
          if (available < n) throw new Error(
            available <= 0 ? 'complète' : `${available} place${available > 1 ? 's' : ''} restante${available > 1 ? 's' : ''}`
          )
          const newCount = data.registeredCount + n
          const bookingPhone = participants[0]?.phone.trim() ?? ''
          const bookingEmail = participants[0]?.email.trim().toLowerCase() ?? ''
          const bookingName = `${participants[0]?.firstName ?? ''} ${participants[0]?.lastName ?? ''}`.trim()
          const groupId = randomUUID()
          let firstRegId = ''
          let firstToken = ''
          participants.forEach((p, idx) => {
            const regRef = doc(collection(db, 'registrations'))
            const token = randomUUID()
            if (idx === 0) { firstRegId = regRef.id; firstToken = token }
            tx.set(regRef, {
              sessionId: sess.id,
              userId: currentUser?.uid ?? null,
              firstName: p.firstName.trim(),
              lastName: p.lastName.trim(),
              email: p.email.trim().toLowerCase(),
              phone: p.phone.trim(),
              suggestions: p.suggestions.trim(),
              isMinor: p.isMinor,
              parentalAttestation: p.isMinor && p.parentalConsent,
              guardianName: p.isMinor ? p.guardianName.trim() : '',
              guardianRelation: p.isMinor ? p.guardianRelation.trim() : '',
              guardianPhone: p.isMinor ? p.guardianPhone.trim() : '',
              birthDate: p.isMinor ? p.birthDate : '',
              medicalCertUrl: certUrls[idx] ?? null,
              groupId: n > 1 ? groupId : null,
              isPrimaryBooking: idx === 0,
              bookingPhone,
              bookingEmail,
              bookingName,
              paymentStatus: 'pending',
              attendance: 'unknown',
              registeredAt: Timestamp.now(),
              uniqueToken: token,
            })
          })
          tx.update(sessionRef, {
            registeredCount: newCount,
            status: newCount >= data.maxSpots ? 'full' : 'open',
          })
          const prevCount = data.registeredCount
          const notify = data.maxSpots > 10 && prevCount < data.maxSpots - 10 && newCount >= data.maxSpots - 10
          return { notify, firstRegId, firstToken }
        })
      }

      const who = `${participants[0]?.firstName ?? ''} ${participants[0]?.lastName ?? ''}`.trim() || 'Un participant'
      let totalRegistered = 0
      let firstTokenOverall = ''
      const failed: { title: string; reason: string }[] = []

      for (const sess of targetSessions) {
        try {
          const { notify, firstRegId, firstToken } = await registerToSession(sess)
          totalRegistered += n
          if (!firstTokenOverall) firstTokenOverall = firstToken
          // Notification admin (push + section Notifications)
          fetch('/api/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toAdmins: true,
              persist: true,
              type: 'PARCOURS_INSCRIPTION',
              title: 'Nouvelle inscription Parcours Sportif',
              body: n > 1 ? `${who} a inscrit ${n} personnes à "${sess.title}"` : `${who} s'est inscrit(e) à "${sess.title}"`,
              url: `/admin/parcours-sportif/${sess.id}?highlight=${firstRegId}`,
            }),
          }).catch(() => {})
          if (notify) {
            fetch('/api/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toAdmins: true,
                persist: true,
                type: 'PARCOURS_PRESQUE_COMPLET',
                title: '⚠️ Parcours Sportif presque complet',
                body: `Il ne reste que 10 places pour "${sess.title}"`,
                url: '/admin/parcours-sportif',
              }),
            }).catch(() => {})
          }
          // Ajout au planning du compte connecté
          if (currentUser) {
            await addParcoursActivite({
              userId: currentUser.uid,
              registrationId: firstRegId,
              sessionId: sess.id,
              session: sess as any,
            })
          }
        } catch (err: any) {
          const reason = err?.message === 'DEJA_INSCRIT' ? 'déjà inscrit à cette date' : (err?.message ?? 'erreur')
          failed.push({ title: `${fmtDate(sess.date)}`, reason })
        }
      }

      if (totalRegistered === 0) {
        setError(failed.length
          ? `Aucune inscription enregistrée — ${failed.map((f) => `${f.title} : ${f.reason}`).join(' ; ')}`
          : "Erreur lors de l'inscription")
      } else {
        setSuccessToken(firstTokenOverall)
        setSuccessCount(totalRegistered)
        if (failed.length) {
          setSuccessWarning(`Certaines dates n'ont pas pu être réservées : ${failed.map((f) => `${f.title} (${f.reason})`).join(', ')}.`)
        }
      }
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de l\'inscription')
    }
    setSubmitting(false)
  }

  // Signature SMS : nom de l'utilisateur connecté, sinon un repère à compléter
  const userSignature = currentUser && userProfile
    ? `${userProfile.prenom ?? ''} ${userProfile.nom ?? ''}`.trim()
    : ''
  const smsSignature = userSignature ? `\n\n${userSignature}` : '\n\n[Votre prénom et nom]'

  const openReviewModal = () => {
    setReviewSuccess(false)
    setReviewError('')
    setReviewForm((f) => ({
      ...f,
      name: f.name || userProfile?.prenom || '',
      email: currentUser?.email ?? f.email,
    }))
    setShowReviewModal(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Teddy Coaching */}
      <div className="bg-white border-b border-gray-100">
        <div className="px-4 sm:px-8 py-3 sm:py-4 flex items-center gap-3">
          <img src={companyLogoUrl} alt="Teddy Coaching"
            className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl shadow-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-tight truncate">Teddy Coaching</h1>
            <p className="text-xs sm:text-sm font-semibold text-blue-600">Parcours Sportifs</p>
          </div>
          {currentUser ? (
            <a href="/mes-parcours" className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition shrink-0">
              <ArrowLeftIcon className="w-3.5 h-3.5" />
              Retour
            </a>
          ) : !authLoading && (
            <a href="/login" className="text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition shrink-0">
              Se connecter
            </a>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-12 py-4 sm:py-5 space-y-4 sm:space-y-5">

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-purple-600 text-white p-4 sm:p-6">
          <div className="relative z-10 max-w-2xl">
            <div className="flex items-center gap-1.5 mb-1">
              <FireIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide opacity-90">Parcours Sportifs</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-extrabold leading-tight">
              Dépasse-toi en plein air, à ton rythme.
            </h2>
            <p className="text-xs sm:text-sm text-white/90 mt-1.5">
              Des séances de sport en groupe, conviviales et accessibles à tous — au bord de la plage.
            </p>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-3 flex-wrap text-[11px] sm:text-xs font-semibold">
              <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg"><BanknotesIcon className="w-3.5 h-3.5" />5€ / séance</span>
              <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg"><ClockIcon className="w-3.5 h-3.5" />18h30 ou 19h00</span>
              <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-lg"><MapPinIcon className="w-3.5 h-3.5" />Mine d'Or - Pénestin (56)</span>
            </div>
            {sessions.length > 0 && (
              <a href="#dispo"
                className="inline-flex items-center gap-1.5 mt-3.5 bg-white text-orange-600 text-xs sm:text-sm font-bold px-4 py-2 rounded-lg hover:bg-orange-50 transition">
                Voir les {sessions.length} séance{sessions.length > 1 ? 's' : ''}
                <ArrowRightIcon className="w-4 h-4" />
              </a>
            )}
          </div>
          <FireIcon className="absolute -right-5 -bottom-5 w-28 h-28 sm:w-36 sm:h-36 text-white/10" />
        </div>

        {/* ── Bénéfices / objectifs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {BENEFITS.map((b) => {
            const Icon = b.icon
            return (
              <div key={b.title} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-2.5 sm:block">
                <div className={`w-9 h-9 rounded-lg ${b.bg} flex items-center justify-center shrink-0 sm:mb-2`}>
                  <Icon className={`w-4 h-4 ${b.color}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-gray-800 leading-tight">{b.title}</p>
                  <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 leading-tight">{b.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── À savoir (avant les séances) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-800 mb-2.5">À savoir avant de s'inscrire</h2>
          <div className="grid sm:grid-cols-2 gap-2 mb-2.5">
            {IMPORTANT_NOTES_BASE.map((n) => {
              const { Icon } = n
              const smsHref = n.href === '__SMS__'
                ? `sms:${settingsPhone.replace(/\s/g, '')}?body=${encodeURIComponent(`Bonjour Teddy,\n\nJe suis inscrit(e) au Parcours Sportif mais ne pourrai malheureusement pas être présent(e).\n\nDésolé(e) pour le désagrément.${smsSignature}`)}`
                : null
              return smsHref ? (
                <a key={n.key} href={smsHref}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${n.bg} hover:opacity-80 transition group`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`shrink-0 ${n.color}`}><Icon className="w-4 h-4" /></div>
                    <p className="text-xs sm:text-sm text-gray-700">{n.text}</p>
                  </div>
                  <span className="text-[10px] font-medium text-red-400 bg-white/70 px-1.5 py-0.5 rounded-full shrink-0 group-hover:bg-white transition">SMS</span>
                </a>
              ) : (
                <div key={n.key} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${n.bg}`}>
                  <div className={`shrink-0 ${n.color}`}><Icon className="w-4 h-4" /></div>
                  <p className="text-xs sm:text-sm text-gray-700">{n.text}</p>
                </div>
              )
            })}
          </div>
          <button onClick={() => setShowFullInfo((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
            {showFullInfo ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            {showFullInfo ? 'Masquer les détails' : 'Voir toutes les informations'}
          </button>
          {showFullInfo && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{FULL_INFO}</p>
            </div>
          )}
        </div>

        {/* ── Séances ── */}
        <div id="dispo" className="scroll-mt-4">
          <div className="mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Séances à venir</h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Touchez une séance pour vous inscrire</p>
          </div>

          {loadingSessions ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <CalendarIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucune séance à venir</p>
              <p className="text-sm text-gray-400 mt-1">Revenez bientôt pour voir les prochaines dates</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {sessions.map((session) => {
                const spots = session.maxSpots - session.registeredCount
                const isFull = session.status === 'full' || spots <= 0
                const showSpots = !isFull && spots <= 15
                const mapsLink = sessionMapsLink(session)
                return (
                  <div key={session.id}
                    onClick={() => { if (!isFull && !authLoading) handleRegisterClick(session) }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isFull && !authLoading) { e.preventDefault(); handleRegisterClick(session) } }}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col transition ${
                      isFull ? 'opacity-70' : 'cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <h3 className="text-sm font-bold text-gray-900 flex-1 leading-snug">{session.title}</h3>
                      {isFull
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">Complet</span>
                        : showSpots
                        ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 shrink-0">{spots} place{spots > 1 ? 's' : ''}</span>
                        : null
                      }
                    </div>
                    <div className="space-y-1.5 flex-1 mb-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-700">
                        <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="capitalize font-medium">{fmtDate(session.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        <ClockIcon className="w-4 h-4 text-gray-400 shrink-0" />
                        <span>{sessionTimeRange(session)}</span>
                      </div>
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <p className="leading-snug">{sessionLocationLabel(session)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pl-6">
                        {mapsLink && (
                          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            Itinéraire
                          </a>
                        )}
                        {session.price != null && (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg">
                            <BanknotesIcon className="w-3.5 h-3.5" />
                            {session.price}€
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold text-center transition ${
                        isFull ? 'bg-gray-100 text-gray-400' : 'bg-blue-600 text-white'
                      }`}
                    >
                      {isFull ? 'Séance complète' : 'S\'inscrire'}
                    </div>
                    <a
                      href={sessionCancelSmsLink(session, userSignature || '[Votre prénom et nom]')}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-gray-500 border border-gray-200 bg-gray-50 hover:bg-red-50 hover:text-red-500 hover:border-red-200 px-3 py-1.5 rounded-lg transition"
                    >
                      <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
                      Déjà inscrit ? Prévenir d'une absence
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── C'est quoi le Parcours Sportif ? (dépliable) ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button onClick={() => setShowWhat((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 sm:px-5 py-4 hover:bg-gray-50 transition">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 text-left">C'est quoi un Parcours Sportif ?</h2>
            {showWhat ? <ChevronUpIcon className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDownIcon className="w-5 h-5 text-gray-400 shrink-0" />}
          </button>
          {showWhat && (
            <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600 mb-3">
                Le Parcours Sportif combine <strong>2 activités complémentaires</strong> :
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mb-4">
                <div className="flex gap-3 bg-blue-50 rounded-xl p-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <BoltIcon className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Le footing</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Pour se déplacer ensemble d'un point à un autre le long des sentiers côtiers.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 bg-orange-50 rounded-xl p-3">
                  <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                    <FireIcon className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">Le circuit training</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                      Pour faire monter le cardio et se renforcer musculairement — avec des options plus ou moins intenses, adaptées à chacun.
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                L'objectif : se déplacer entre différents points sur les sentiers côtiers en footing (tous ensemble),
                et s'arrêter près des plages de Pénestin pour réaliser différents circuits training !
              </p>
              <p className="text-sm font-semibold text-gray-800 mt-3">
                Un cours pour tous, adapté à chacun, et avec une vue magnifique. Venez vous défouler avec nous !
              </p>
            </div>
          )}
        </div>

        {/* ── Avis ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base sm:text-lg font-bold text-gray-800">Avis des participants</h2>
              {reviews.length > 0 && (
                <span className="flex items-center gap-1 text-sm">
                  <StarSolid className="w-4 h-4 text-yellow-400" />
                  <span className="font-bold text-gray-800">{avgRating}</span>
                  <span className="text-gray-400">({reviews.length})</span>
                </span>
              )}
            </div>
            <button onClick={openReviewModal}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
              <PlusIcon className="w-3.5 h-3.5" />
              Laisser un avis
            </button>
          </div>

          {reviews.length === 0 ? (
            <div className="text-center py-6">
              <StarOutline className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Aucun avis pour l'instant</p>
              <p className="text-xs text-gray-400 mt-0.5">Soyez le premier à partager votre expérience !</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Avatar : toujours l'initiale du prénom */}
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {r.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <span className="text-sm font-semibold text-gray-800 truncate">{r.name}</span>
                    </div>
                    <Stars value={r.rating} size="w-3.5 h-3.5" />
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                  {/* Photo : thumbnail contenu (pas de zoom/recadrage) */}
                  {r.photoUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center">
                      <img src={r.photoUrl} alt={`Photo de ${r.name}`} loading="lazy"
                        className="max-h-40 w-auto object-contain" />
                    </div>
                  )}
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      {r.createdAt ? (
                        <p className="text-[11px] text-gray-400">
                          {r.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      ) : <span />}
                      {canDeleteReview(r) && (
                        <button onClick={() => handleDeleteReview(r)}
                          className="flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-red-500 transition">
                          <TrashIcon className="w-3.5 h-3.5" />
                          Supprimer
                        </button>
                      )}
                    </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Contact & réseaux ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-3 mb-3">
            <img src={companyLogoUrl} alt="Teddy Coaching"
              className="w-10 h-10 object-contain rounded-xl shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">Teddy Coaching</p>
              <p className="text-xs text-gray-400">Une question ? Contactez-moi</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <a href="tel:+33679408254"
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <PhoneIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">06.79.40.82.54</span>
            </a>
            <a href={`sms:+33679408254?body=${encodeURIComponent('Bonjour Teddy,\n\n')}`}
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <ChatBubbleLeftIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">Envoyer un message</span>
            </a>
            <a href="mailto:teddybcoaching@gmail.com"
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <EnvelopeIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700 truncate">teddybcoaching@gmail.com</span>
            </a>
            <a href="https://teddycoaching.fr" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <GlobeAltIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-700">teddycoaching.fr</span>
            </a>
            <a href="https://www.instagram.com/teddy.coaching" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38C1.35 2.67.94 3.34.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.07 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.86 5.86 0 0 0 2.12-1.38c.66-.66 1.07-1.33 1.38-2.12.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.86 5.86 0 0 0-1.38-2.12A5.86 5.86 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32M12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8m6.41-10.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88"/>
              </svg>
              <span className="text-sm text-gray-700">@teddy.coaching</span>
            </a>
            <a href="https://www.facebook.com/teddybcoaching" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 border border-gray-200 hover:bg-gray-50 rounded-xl px-3 py-2.5 transition">
              <svg className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.02 4.39 11.01 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.08 24 18.09 24 12.07"/>
              </svg>
              <span className="text-sm text-gray-700">Teddy Coaching</span>
            </a>
          </div>
        </div>
      </div>

      {/* Modal inscription */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={successCount > 0 ? 'Inscription confirmée !' : 'Inscription'} size="lg">
        {successCount > 0 ? (
          <div className="py-2 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircleIcon className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">
                {successCount === 1 ? 'Inscription confirmée !' : `${successCount} inscriptions confirmées !`}
              </h3>
              <p className="text-sm text-gray-500">
                {successCount === 1 ? 'Votre place est réservée.' : `${successCount} places réservées.`}
              </p>
            </div>

            {successWarning && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{successWarning}</p>
            )}

            {/* Lien de gestion de l'inscription (valide sans compte) */}
            {successToken && (
              <a href={`/mon-inscription/${successToken}`}
                className="flex items-center justify-center gap-2 w-full border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
                Voir / gérer mon inscription
              </a>
            )}

            {currentUser ? (
              /* Déjà connecté — accès direct à ses inscriptions */
              <a href="/mes-parcours"
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                Voir mes parcours dans l'application
              </a>
            ) : (
              /* Visiteur non connecté — proposition (non obligatoire) de créer un compte */
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-blue-800">📱 Créez votre compte TC Connect</p>
                  <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                    Avec un compte, accédez à vos inscriptions, gérez vos réservations, recevez les notifications d'annulation et visualisez vos prochaines séances — directement depuis l'app.
                  </p>
                </div>
                <a
                  href={`/login?tab=creer&email=${encodeURIComponent(participants[0]?.email ?? '')}`}
                  className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                  Créer mon compte avec cet email
                </a>
                <p className="text-xs text-center text-blue-500">
                  Utilisez la même adresse : <strong>{participants[0]?.email}</strong>
                </p>
              </div>
            )}

            <button onClick={() => setSelected(null)}
              className="w-full text-sm text-gray-400 hover:text-gray-600 hover:underline py-1">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {selected && (
              <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-700">
                <p className="font-semibold">{selected.title}</p>
                <p className="capitalize">{fmtDate(selected.date)} · {sessionTimeRange(selected)}</p>
                <p>{sessionLocationLabel(selected)}</p>
              </div>
            )}

            {/* Inscription à plusieurs dates en même temps */}
            {(() => {
              const others = sessions.filter((s) =>
                s.id !== selected?.id &&
                s.status !== 'cancelled' &&
                (s.maxSpots - s.registeredCount) > 0
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
                  <p className="text-xs text-gray-400 mb-2">Cochez les dates souhaitées (optionnel) — les participants ci-dessous seront inscrits à toutes les dates sélectionnées.</p>
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

            {/* Participants */}
            <div className="space-y-3">
              {participants.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl border border-gray-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {i === 0 ? 'Participant principal' : `Participant ${i + 1}`}
                    </p>
                    {i > 0 && (
                      <button type="button"
                        onClick={() => setParticipants((prev) => prev.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500 transition">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prénom *</label>
                      <input type="text" required value={p.firstName}
                        onChange={(e) => updateParticipant(i, 'firstName', toProperName(e.target.value))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Nom{i === 0 ? ' *' : ''}</label>
                      <input type="text" required={i === 0} value={p.lastName}
                        onChange={(e) => updateParticipant(i, 'lastName', toUpperName(e.target.value))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Email{i === 0 ? ' *' : ''}</label>
                      <input type="email" required={i === 0} value={p.email}
                        onChange={(e) => updateParticipant(i, 'email', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone{i === 0 ? ' *' : ''}</label>
                      <input type="tel" required={i === 0} value={p.phone}
                        onChange={(e) => updateParticipant(i, 'phone', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                    </div>
                  </div>
                  {/* Suggestions / questions */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Questions / Suggestions <span className="font-normal text-gray-400">(optionnel)</span>
                    </label>
                    <textarea value={p.suggestions} rows={2}
                      onChange={(e) => updateParticipant(i, 'suggestions', e.target.value)}
                      placeholder="Une question ? Déjà participé et envie de partager un retour ?"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                  </div>
                  {/* Mineur */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={p.isMinor}
                      onChange={(e) => updateParticipant(i, 'isMinor', e.target.checked)}
                      className="rounded accent-blue-600" />
                    <span className="text-xs text-gray-600">Cette inscription concerne un mineur</span>
                  </label>
                  {p.isMinor && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-3">
                      <p className="text-xs text-yellow-800 font-semibold">
                        ⚠️ Attestation du représentant légal
                      </p>
                      <p className="text-xs text-yellow-700 leading-relaxed">
                        Un participant <strong>majeur responsable doit être inscrit dans ce même formulaire</strong> et
                        présent à la séance pour accompagner le mineur.
                      </p>

                      {/* Date de naissance du mineur */}
                      <div>
                        <label className="block text-xs font-medium text-yellow-800 mb-1">Date de naissance du mineur</label>
                        <input type="date" value={p.birthDate}
                          onChange={(e) => updateParticipant(i, 'birthDate', e.target.value)}
                          className="w-full border border-yellow-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
                      </div>

                      {/* Représentant légal */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Nom du représentant légal *</label>
                          <input type="text" value={p.guardianName}
                            onChange={(e) => updateParticipant(i, 'guardianName', e.target.value)}
                            placeholder="Prénom et nom"
                            className="w-full border border-yellow-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Lien de parenté</label>
                          <input type="text" value={p.guardianRelation}
                            onChange={(e) => updateParticipant(i, 'guardianRelation', e.target.value)}
                            placeholder="Père, mère…"
                            className="w-full border border-yellow-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-yellow-800 mb-1">Téléphone *</label>
                          <input type="tel" value={p.guardianPhone}
                            onChange={(e) => updateParticipant(i, 'guardianPhone', e.target.value)}
                            placeholder="Joignable le jour J"
                            className="w-full border border-yellow-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white" />
                        </div>
                      </div>

                      {/* Certificat médical (optionnel) */}
                      <div>
                        <label className="block text-xs font-medium text-yellow-800 mb-1">
                          Certificat médical <span className="font-normal text-yellow-600">(optionnel, recommandé)</span>
                        </label>
                        {p.medicalCert ? (
                          <div className="flex items-center gap-2 bg-white border border-yellow-300 rounded-xl px-3 py-2">
                            <DocumentArrowUpIcon className="w-4 h-4 text-green-600 shrink-0" />
                            <span className="text-xs text-gray-700 flex-1 truncate">{p.medicalCert.name}</span>
                            <button type="button" onClick={() => updateParticipant(i, 'medicalCert', null)}
                              className="text-gray-400 hover:text-red-500 transition">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 bg-white border border-yellow-300 border-dashed rounded-xl px-3 py-2 cursor-pointer hover:bg-yellow-50 transition">
                            <DocumentArrowUpIcon className="w-4 h-4 text-yellow-600 shrink-0" />
                            <span className="text-xs text-yellow-700">Joindre un fichier (PDF ou image)</span>
                            <input type="file" accept="application/pdf,image/*" className="hidden"
                              onChange={(e) => updateParticipant(i, 'medicalCert', e.target.files?.[0] ?? null)} />
                          </label>
                        )}
                      </div>

                      {/* Attestation finale */}
                      <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-yellow-200">
                        <input type="checkbox" required checked={p.parentalConsent}
                          onChange={(e) => updateParticipant(i, 'parentalConsent', e.target.checked)}
                          className="rounded accent-yellow-600 mt-0.5 shrink-0" />
                        <span className="text-xs text-yellow-800 leading-relaxed">
                          Je certifie être le représentant légal de ce mineur (ou disposer de son autorisation),
                          j'autorise sa participation au Parcours Sportif, je reconnais avoir vérifié son aptitude
                          à la pratique sportive et je me porte garant(e) de sa présence et de son comportement
                          durant la séance. *
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Ajouter une personne */}
            <button type="button"
              onClick={() => setParticipants((prev) => [...prev, emptyParticipant()])}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-blue-600 border border-blue-200 border-dashed hover:bg-blue-50 transition">
              <PlusIcon className="w-4 h-4" />
              Ajouter une personne
            </button>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setSelected(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                Annuler
              </button>
              <button type="submit" disabled={submitting}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {submitting
                  ? 'Inscription...'
                  : participants.length > 1
                  ? `Inscrire ${participants.length} personnes`
                  : 'S\'inscrire'
                }
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal avis */}
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
            <div className={currentUser ? '' : 'grid grid-cols-2 gap-3'}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre prénom *</label>
                <input type="text" required value={reviewForm.name}
                  onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!currentUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Votre email *</label>
                  <input type="email" required value={reviewForm.email}
                    onChange={(e) => setReviewForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>
            {!currentUser && (
              <p className="text-xs text-gray-400 -mt-2">
                Votre email reste privé. Il vous permettra de gérer votre avis si vous créez un compte avec la même adresse.
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre note</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                    className="p-0.5">
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
