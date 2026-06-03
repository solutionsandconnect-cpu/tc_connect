'use client'

import { useState, useEffect, useMemo } from 'react'
import { collection, query, orderBy, onSnapshot, getDocs, where, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { copyText } from '@/lib/clipboard'
import { useAuth } from '@/context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import {
  PlusIcon, CalendarIcon, MapPinIcon, UsersIcon,
  ChevronRightIcon, BanknotesIcon, ClipboardDocumentIcon,
  CheckIcon, ShareIcon, ChatBubbleLeftIcon, FireIcon, TrashIcon,
  EyeIcon, EyeSlashIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'

interface Review {
  id: string
  name: string
  email?: string
  rating: number
  comment: string
  photoUrl?: string | null
  createdAt?: Timestamp
}

interface Session {
  id: string
  title: string
  date: Timestamp
  location: string
  maxSpots: number
  registeredCount: number
  status: 'open' | 'full' | 'cancelled'
  price?: number
  hidden?: boolean
}

function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}
function fmtHeure(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function sessionBadge(s: Session) {
  const isPast = s.date.toMillis() < Date.now()
  if (s.status === 'cancelled') return { label: 'Annulée', variant: 'danger' as const }
  if (isPast) return { label: 'Passée', variant: 'gray' as const }
  if (s.status === 'full') return { label: 'Complet', variant: 'warning' as const }
  return { label: 'Ouverte', variant: 'success' as const }
}

export default function AdminParcoursPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [paidBySession, setPaidBySession] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [deleteReviewConfirm, setDeleteReviewConfirm] = useState<string | null>(null)
  const [highlightedReviewId, setHighlightedReviewId] = useState<string | null>(highlightId)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [filterReviewStars, setFilterReviewStars] = useState(0)
  const [filterReviewYear, setFilterReviewYear] = useState<number | null>(null)

  const reviewYears = Array.from(
    new Set(reviews.map((r) => r.createdAt?.toDate().getFullYear()).filter((y): y is number => !!y))
  ).sort((a, b) => b - a)
  const filteredReviews = reviews.filter((r) => {
    if (filterReviewStars > 0 && r.rating !== filterReviewStars) return false
    if (filterReviewYear && r.createdAt?.toDate().getFullYear() !== filterReviewYear) return false
    return true
  })

  const downloadPhoto = async (url: string, name: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.click()
      URL.revokeObjectURL(a.href)
    } catch { window.open(url, '_blank') }
  }

  // Scroll vers + surligner l'avis depuis une notification
  useEffect(() => {
    if (!highlightedReviewId || !reviews.length) return
    const scrollT = setTimeout(() => {
      const el = document.getElementById(`review-${highlightedReviewId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 350)
    const clearT = setTimeout(() => setHighlightedReviewId(null), 5000)
    return () => { clearTimeout(scrollT); clearTimeout(clearT) }
  }, [highlightedReviewId, reviews])

  useEffect(() => {
    if (!isAdmin) return
    const q = query(collection(db, 'parcours_reviews'), orderBy('createdAt', 'desc'))
    return onSnapshot(q,
      (snap) => setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review))),
      () => setReviews([])
    )
  }, [isAdmin])

  const handleDeleteReview = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'parcours_reviews', id))
    } catch (e) {
      console.error('[deleteReview]', e)
    }
    setDeleteReviewConfirm(null)
  }

  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}/parcours-sportif` : ''
  const shareMessage = `Inscris-toi aux Parcours Sportifs de Teddy Coaching ! 🏃\n${publicUrl}`

  const copyLink = async () => {
    const ok = await copyText(publicUrl)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      // Dernier recours : on propose à l'utilisateur de copier manuellement
      window.prompt('Copiez le lien ci-dessous :', publicUrl)
    }
  }

  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Parcours Sportifs — Teddy Coaching', text: shareMessage, url: publicUrl })
      } catch { /* annulé */ }
    } else {
      copyLink()
    }
  }

  useEffect(() => {
    if (!isAdmin) return
    const q = query(collection(db, 'sessions'), orderBy('date', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session)))
      setLoading(false)
    })
    return unsub
  }, [isAdmin])

  // Load paid registration counts for financial stats
  useEffect(() => {
    if (!isAdmin || sessions.length === 0) return
    const load = async () => {
      const snap = await getDocs(
        query(collection(db, 'registrations'), where('paymentStatus', 'in', ['cash', 'transfer']))
      )
      const counts: Record<string, number> = {}
      snap.docs.forEach((d) => {
        const sid = d.data().sessionId
        counts[sid] = (counts[sid] ?? 0) + 1
      })
      setPaidBySession(counts)
    }
    load()
  }, [isAdmin, sessions.length])

  const now = Date.now()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  const financials = useMemo(() => {
    let yearTotal = 0
    let monthTotal = 0
    for (const s of sessions) {
      const price = s.price ?? 5
      const paid = paidBySession[s.id] ?? 0
      const earned = paid * price
      const d = s.date?.toDate?.()
      if (!d) continue
      if (d.getFullYear() === currentYear) yearTotal += earned
      if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) monthTotal += earned
    }
    return { yearTotal, monthTotal }
  }, [sessions, paidBySession, currentYear, currentMonth])

  const upcoming = sessions.filter((s) => s.status !== 'cancelled' && s.date.toMillis() >= now)
  const past = sessions.filter((s) => s.status === 'cancelled' || s.date.toMillis() < now)

  if (!isAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  }

  const SessionCard = ({ s }: { s: Session }) => {
    const badge = sessionBadge(s)
    const price = s.price ?? 5
    const earned = (paidBySession[s.id] ?? 0) * price
    return (
      <div className={`w-full flex items-center gap-3 bg-white border rounded-2xl p-4 hover:border-blue-200 hover:shadow-sm transition ${s.hidden ? 'border-gray-300 opacity-70' : 'border-gray-100'}`}>
        <button
          onClick={() => router.push(`/admin/parcours-sportif/${s.id}`)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-gray-900">{s.title}</span>
            <Badge label={badge.label} variant={badge.variant} />
            {s.hidden && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                <EyeSlashIcon className="w-3 h-3" /> Masquée
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              <span className="capitalize">{fmtDate(s.date)} à {fmtHeure(s.date)}</span>
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <UsersIcon className="w-3.5 h-3.5 text-gray-400" />{s.registeredCount}/{s.maxSpots}
            </span>
            {earned > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                <BanknotesIcon className="w-3.5 h-3.5" />{earned.toFixed(2)}€ encaissés
              </span>
            )}
          </div>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'sessions', s.id), { hidden: !s.hidden }) }}
          title={s.hidden ? 'Rendre visible' : 'Masquer'}
          className={`shrink-0 p-2 rounded-lg border transition ${s.hidden ? 'border-green-200 text-green-600 hover:bg-green-50' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
        >
          {s.hidden ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
        </button>
        <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
            <FireIcon className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Parcours Sportif</h1>
            <p className="text-sm text-gray-500">Séances de sport en groupe</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/admin/parcours-sportif/parametres')}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition"
            title="Paramètres"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Paramètres</span>
          </button>
          <button
            onClick={() => router.push('/admin/parcours-sportif/nouvelle-seance')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <PlusIcon className="w-4 h-4" />
            Nouvelle séance
          </button>
        </div>
      </div>

      {/* Bilan financier global */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Cette année ({currentYear})</p>
          <p className="text-2xl font-bold text-gray-900">{financials.yearTotal.toFixed(2)}€</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Ce mois</p>
          <p className="text-2xl font-bold text-gray-900">{financials.monthTotal.toFixed(2)}€</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Séances à venir</p>
          <p className="text-2xl font-bold text-gray-900">{upcoming.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total inscrits (à venir)</p>
          <p className="text-2xl font-bold text-gray-900">
            {upcoming.reduce((s, sess) => s + sess.registeredCount, 0)}
          </p>
        </div>
      </div>

      {/* Lien public + partage */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-blue-800">Page publique d'inscription</p>
            <p className="text-xs text-blue-600 truncate">{publicUrl}</p>
          </div>
          <a href="/parcours-sportif" target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition shrink-0">
            Voir
          </a>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-600" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
            {copied ? 'Lien copié !' : 'Copier le lien'}
          </button>
          <a href={`sms:?body=${encodeURIComponent(shareMessage)}`}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
            <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
            SMS
          </a>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-300 bg-white hover:bg-green-50 px-3 py-1.5 rounded-lg transition">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.25-.1-.45-.15-.65.15-.2.3-.75.95-.9 1.1-.2.15-.35.2-.65.05-.3-.15-1.25-.45-2.4-1.5-.9-.8-1.5-1.75-1.65-2.05-.15-.3 0-.45.15-.6.15-.15.3-.35.45-.55.15-.2.2-.3.3-.5.1-.2.05-.4-.05-.55-.1-.15-.65-1.55-.9-2.15-.2-.55-.45-.45-.65-.45h-.55c-.2 0-.5.05-.75.35-.25.3-.95.95-.95 2.3 0 1.35.95 2.65 1.1 2.85.15.2 1.9 2.9 4.6 4.05.65.3 1.15.45 1.55.55.65.2 1.25.2 1.7.1.5-.05 1.55-.65 1.75-1.25.2-.6.2-1.15.15-1.25-.05-.1-.25-.15-.55-.3M12 2C6.5 2 2 6.5 2 12c0 1.75.45 3.45 1.3 4.95L2 22l5.2-1.35C8.65 21.55 10.3 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2"/></svg>
            WhatsApp
          </a>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button onClick={shareNative}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition">
              <ShareIcon className="w-3.5 h-3.5" />
              Partager…
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              À venir ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune séance à venir</p>
              </div>
            ) : upcoming.map((s) => <SessionCard key={s.id} s={s} />)}
          </div>
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Historique ({past.length})
              </h2>
              {past.map((s) => <SessionCard key={s.id} s={s} />)}
            </div>
          )}
        </>
      )}

      {/* ── Avis ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <StarSolid className="w-4 h-4 text-yellow-400" />
            Avis des participants ({filteredReviews.length}{filteredReviews.length !== reviews.length ? ` / ${reviews.length}` : ''})
          </h2>
        </div>

        {/* Filtres avis */}
        {reviews.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              {[5, 4, 3, 2, 1].map((n) => (
                <button key={n} onClick={() => setFilterReviewStars(filterReviewStars === n ? 0 : n)}
                  className={`flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-lg border transition ${filterReviewStars === n ? 'bg-yellow-400 text-white border-yellow-400' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {n}<StarSolid className="w-3 h-3" />
                </button>
              ))}
            </div>
            {reviewYears.length > 0 && (
              <select value={filterReviewYear ?? ''} onChange={(e) => setFilterReviewYear(e.target.value ? Number(e.target.value) : null)}
                className="text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                <option value="">Toutes les années</option>
                {reviewYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {(filterReviewStars > 0 || filterReviewYear) && (
              <button onClick={() => { setFilterReviewStars(0); setFilterReviewYear(null) }}
                className="text-xs text-gray-400 hover:text-gray-600 underline">
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <StarSolid className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun avis pour l'instant</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <StarSolid className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun avis ne correspond à ces filtres</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredReviews.map((r) => (
              <div
                key={r.id}
                id={`review-${r.id}`}
                className={`bg-white border rounded-2xl shadow-sm p-4 transition-all duration-700 ${highlightedReviewId === r.id ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-300' : 'border-gray-100'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                      {r.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{r.name}</p>
                      {r.email && <p className="text-[11px] text-gray-400 truncate">{r.email}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarSolid key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                </div>
                {r.photoUrl && (
                  <div
                    className="mb-2 rounded-lg overflow-hidden border border-gray-100 bg-gray-50 flex items-center justify-center cursor-zoom-in"
                    onClick={() => setLightboxUrl(r.photoUrl!)}
                  >
                    <img src={r.photoUrl} alt="" loading="lazy"
                      className="max-h-36 w-auto object-contain" />
                  </div>
                )}
                <p className="text-sm text-gray-600 leading-relaxed">{r.comment}</p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  {r.createdAt ? (
                    <p className="text-[11px] text-gray-400">
                      {r.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  ) : <span />}
                  {deleteReviewConfirm === r.id ? (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setDeleteReviewConfirm(null)}
                        className="text-[11px] border border-gray-200 px-2 py-0.5 rounded-md hover:bg-gray-50">Non</button>
                      <button onClick={() => handleDeleteReview(r.id)}
                        className="text-[11px] text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-md">Supprimer</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteReviewConfirm(r.id)}
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

      {/* ── Lightbox photo ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Avis photo"
            className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex items-center gap-3 mt-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => downloadPhoto(lightboxUrl, `avis-parcours-${Date.now()}.jpg`)}
              className="flex items-center gap-2 bg-white text-gray-800 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-gray-100 transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
              Télécharger
            </button>
            <button
              onClick={() => setLightboxUrl(null)}
              className="flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-white/30 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
