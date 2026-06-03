'use client'

import { use, useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { copyText } from '@/lib/clipboard'
import { removeParcoursActivite } from '@/lib/parcoursPlanning'
import {
  CalendarIcon, MapPinIcon, CheckCircleIcon, UserIcon, ChatBubbleLeftIcon,
  ArrowLeftIcon, ArrowRightIcon, ShareIcon, ClipboardDocumentIcon, CheckIcon, LinkIcon,
} from '@heroicons/react/24/outline'

interface Registration {
  sessionId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  suggestions: string
  paymentStatus: 'pending' | 'cash' | 'transfer'
  registeredAt: Timestamp
  uniqueToken: string
}

interface Session {
  id: string
  title: string
  date: Timestamp
  location?: string
  locationLabel?: string
  locationCoords?: string
  maxSpots: number
  registeredCount: number
  status: string
  contactPhone?: string
  durationMinutes?: number
}

function fmtDate(ts: Timestamp) {
  return ts.toDate().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}
function fmtHeure(ts: Timestamp) {
  return ts.toDate().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'En attente de règlement',
  cash: 'Réglé en espèces',
  transfer: 'Réglé par virement',
}

export default function MonInscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [regId, setRegId] = useState<string | null>(null)
  const [registration, setRegistration] = useState<Registration | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [deregistering, setDeregistering] = useState(false)
  const [deregistered, setDeregistered] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href)
  }, [])

  const shareText = 'Voici le lien de mon inscription au Parcours Sportif (à garder pour gérer ma place) :'
  const copyLink = async () => {
    const url = shareUrl || (typeof window !== 'undefined' ? window.location.href : '')
    const ok = await copyText(url)
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    else window.prompt('Copiez le lien ci-dessous :', url)
  }
  const shareNative = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Mon inscription — Parcours Sportif', text: shareText, url: shareUrl })
      } catch { /* annulé */ }
    } else {
      copyLink()
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, 'registrations'), where('uniqueToken', '==', token))
        const snap = await getDocs(q)
        if (snap.empty) { setLoading(false); return }
        const regDoc = snap.docs[0]
        const regData = regDoc.data() as Registration
        setRegId(regDoc.id)
        setRegistration(regData)
        const sessionSnap = await getDoc(doc(db, 'sessions', regData.sessionId))
        if (sessionSnap.exists()) {
          setSession({ id: sessionSnap.id, ...sessionSnap.data() } as Session)
        }
      } catch (err) {
        console.error(err)
      }
      setLoading(false)
    }
    load()
  }, [token])

  const handleDeregister = async () => {
    if (!regId || !registration || !session) return
    setDeregistering(true)
    setError('')
    try {
      await runTransaction(db, async (tx) => {
        const regRef = doc(db, 'registrations', regId)
        const sessionRef = doc(db, 'sessions', session.id)
        const sessionSnap = await tx.get(sessionRef)
        if (sessionSnap.exists()) {
          const data = sessionSnap.data()
          const newCount = Math.max(0, data.registeredCount - 1)
          tx.update(sessionRef, {
            registeredCount: newCount,
            status: data.status === 'full' ? 'open' : data.status,
          })
        }
        // On garde l'inscription (marquée "désinscrit") pour les stats admin
        tx.update(regRef, { attendance: 'deregistered', paymentStatus: 'pending' })
      })
      // Retirer l'activité du planning de l'utilisateur (si compte lié)
      if (regId) await removeParcoursActivite(regId)
      // Prévenir les admins de la désinscription (push + section Notifications).
      // On attend la requête avant de basculer d'écran, sinon le re-render
      // interrompt le fetch fire-and-forget et la notification n'est pas créée.
      const who = [registration.firstName, registration.lastName].filter(Boolean).join(' ') || 'Un participant'
      const dateStr = session.date.toDate().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
            body: `${who} s'est désinscrit(e) du Parcours Sportif du ${dateStr}.`,
            url: `/admin/parcours-sportif/${session.id}`,
          }),
        })
      } catch { /* la désinscription a réussi même si la notif échoue */ }
      setDeregistered(true)
      setShowConfirm(false)
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la désinscription')
    }
    setDeregistering(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!registration || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <p className="text-gray-500 font-medium">Inscription introuvable</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">Ce lien est invalide ou l'inscription a déjà été annulée.</p>
          <a href="/parcours-sportif"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
            Voir les séances disponibles
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    )
  }

  if (deregistered) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Désinscription confirmée</h2>
          <p className="text-sm text-gray-500 mb-5">Votre inscription a bien été annulée.</p>
          <a href="/parcours-sportif"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition">
            Voir les séances disponibles
            <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    )
  }

  const isPast = session.date.toMillis() < Date.now()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <img src="/logo.png" alt="TC Connect" className="w-8 h-8 object-contain rounded-lg" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-blue-600">TC Connect</h1>
            <p className="text-xs text-gray-500">Mon inscription</p>
          </div>
          <a href="/parcours-sportif"
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition shrink-0">
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Parcours Sportifs
          </a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Confirmation badge */}
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <CheckCircleIcon className="w-5 h-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-700">Inscription confirmée</p>
        </div>

        {/* Infos séance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-base font-bold text-gray-900">{session.title}</h2>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <CalendarIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="capitalize">{fmtDate(session.date)} à {fmtHeure(session.date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPinIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{session.location}</span>
          </div>
        </div>

        {/* Infos participant */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Vos informations</p>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-800 font-medium">{registration.firstName} {registration.lastName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm text-gray-800">{registration.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Téléphone</span>
            <span className="text-sm text-gray-800">{registration.phone}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Règlement</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              registration.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
              'bg-green-100 text-green-700'
            }`}>
              {PAYMENT_LABELS[registration.paymentStatus] ?? registration.paymentStatus}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Inscrit le</span>
            <span className="text-sm text-gray-800">
              {registration.registeredAt.toDate().toLocaleDateString('fr-FR')}
            </span>
          </div>
        </div>

        {/* Garder / partager le lien de gestion */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start gap-2">
            <LinkIcon className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">Gardez ce lien sous la main</p>
              <p className="text-xs text-blue-600 mt-0.5">
                Conservez-le pour retrouver et gérer votre inscription (vous désinscrire, prévenir d'un imprévu…). Aucun compte nécessaire.
              </p>
            </div>
          </div>

          {/* URL + copier */}
          <div className="bg-white border border-blue-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <p className="text-xs text-gray-600 truncate flex-1">{shareUrl}</p>
            <button onClick={copyLink}
              className="flex items-center gap-1 text-xs font-semibold text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition shrink-0">
              {copied ? <CheckIcon className="w-3.5 h-3.5 text-green-600" /> : <ClipboardDocumentIcon className="w-3.5 h-3.5" />}
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>

          {/* Boutons de partage */}
          <div className="flex items-center gap-2 flex-wrap">
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button onClick={shareNative}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition">
                <ShareIcon className="w-3.5 h-3.5" />
                Partager…
              </button>
            )}
            <a href={`sms:?body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-300 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
              <ChatBubbleLeftIcon className="w-3.5 h-3.5" />
              SMS
            </a>
            <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-300 bg-white hover:bg-green-50 px-3 py-1.5 rounded-lg transition">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.15-1.7-.85-2-.95-.25-.1-.45-.15-.65.15-.2.3-.75.95-.9 1.1-.2.15-.35.2-.65.05-.3-.15-1.25-.45-2.4-1.5-.9-.8-1.5-1.75-1.65-2.05-.15-.3 0-.45.15-.6.15-.15.3-.35.45-.55.15-.2.2-.3.3-.5.1-.2.05-.4-.05-.55-.1-.15-.65-1.55-.9-2.15-.2-.55-.45-.45-.65-.45h-.55c-.2 0-.5.05-.75.35-.25.3-.95.95-.95 2.3 0 1.35.95 2.65 1.1 2.85.15.2 1.9 2.9 4.6 4.05.65.3 1.15.45 1.55.55.65.2 1.25.2 1.7.1.5-.05 1.55-.65 1.75-1.25.2-.6.2-1.15.15-1.25-.05-.1-.25-.15-.55-.3M12 2C6.5 2 2 6.5 2 12c0 1.75.45 3.45 1.3 4.95L2 22l5.2-1.35C8.65 21.55 10.3 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2"/></svg>
              WhatsApp
            </a>
            <a href={`mailto:?subject=${encodeURIComponent('Mon inscription Parcours Sportif')}&body=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 px-3 py-1.5 rounded-lg transition">
              Email
            </a>
          </div>
        </div>

        {/* SMS annulation rapide */}
        {!isPast && session.contactPhone && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-orange-800 mb-1">Vous ne pouvez pas venir ?</p>
            <p className="text-xs text-orange-600 mb-3">Prévenez le coach dès que possible pour qu'il puisse organiser la séance.</p>
            <a
              href={`sms:${session.contactPhone}?body=${encodeURIComponent(`Bonjour Teddy,\n\nJe suis inscrit(e) au ${session.title} mais je ne pourrai malheureusement pas être présent(e).\n\nDésolé(e) pour le désagrément.\n\n${[registration.firstName, registration.lastName].filter(Boolean).join(' ')}`)}`}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
            >
              <ChatBubbleLeftIcon className="w-4 h-4" />
              Prévenir le coach par SMS
            </a>
          </div>
        )}

        {/* Désinscription */}
        {!isPast && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {!showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-2.5 rounded-xl text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition"
              >
                Se désinscrire
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 font-medium text-center">Confirmer la désinscription ?</p>
                <p className="text-xs text-gray-500 text-center">Votre place sera libérée pour d'autres participants.</p>
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)}
                    className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
                    Annuler
                  </button>
                  <button onClick={handleDeregister} disabled={deregistering}
                    className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                    {deregistering ? 'Annulation...' : 'Confirmer'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Retour page publique */}
        <a href="/parcours-sportif"
          className="flex items-center justify-center gap-2 w-full border border-gray-200 bg-white text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
          <ArrowLeftIcon className="w-4 h-4" />
          Retour aux Parcours Sportifs
        </a>
      </div>
    </div>
  )
}
