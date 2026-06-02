'use client'

import { use, useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc, runTransaction, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { CalendarIcon, MapPinIcon, CheckCircleIcon, UserIcon, ChatBubbleLeftIcon } from '@heroicons/react/24/outline'

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
        tx.delete(regRef)
      })
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
          <p className="text-sm text-gray-400 mt-1">Ce lien est invalide ou l'inscription a déjà été annulée.</p>
          <a href="/parcours-sportif" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
            Voir les séances disponibles
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
          <p className="text-sm text-gray-500">Votre inscription a bien été annulée.</p>
          <a href="/parcours-sportif" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
            Voir les séances disponibles
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
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <img src="/logo.png" alt="TC Connect" className="w-8 h-8 object-contain rounded-lg" />
          <div>
            <h1 className="text-lg font-bold text-blue-600">TC Connect</h1>
            <p className="text-xs text-gray-500">Mon inscription</p>
          </div>
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

        {/* SMS annulation rapide */}
        {!isPast && session.contactPhone && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
            <p className="text-sm font-semibold text-orange-800 mb-1">Vous ne pouvez pas venir ?</p>
            <p className="text-xs text-orange-600 mb-3">Prévenez le coach dès que possible pour qu'il puisse organiser la séance.</p>
            <a
              href={`sms:${session.contactPhone}?body=${encodeURIComponent(`Bonjour Teddy,\n\nJe suis inscrit(e) au ${session.title} mais je ne pourrai malheureusement pas être présent(e).\n\nDésolé(e) pour le désagrément.\n\nCordialement`)}`}
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
      </div>
    </div>
  )
}
