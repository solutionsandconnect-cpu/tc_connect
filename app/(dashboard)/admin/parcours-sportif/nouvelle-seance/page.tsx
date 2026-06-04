'use client'

import { useState, useEffect } from 'react'
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, MapPinIcon } from '@heroicons/react/24/outline'

function autoTitle(datetime: string): string {
  if (!datetime) return 'Parcours Sportif'
  const [datePart] = datetime.split('T')
  const [y, m, d] = datePart.split('-')
  return `Parcours Sportif du ${d}/${m}/${y}`
}

function calcEndTime(datetime: string, durationMinutes: number): string {
  if (!datetime || !durationMinutes) return ''
  const start = new Date(datetime)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function parseCoordsLink(coords: string): string | null {
  const parts = coords.replace(/\s/g, '').split(',')
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) return null
  return `https://maps.google.com/maps?q=${lat},${lng}`
}

export default function NouvelleSeancePage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [form, setForm] = useState({
    datetime: '',
    locationCoords: '47.473783, -2.487777',
    locationLabel: 'Parking de la plage de la Mine d\'Or',
    maxSpots: '50',
    price: '5',
    durationMinutes: '60',
    contactPhone: '+33679408254',
    hidden: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pré-remplir le numéro de téléphone depuis les paramètres
  useEffect(() => {
    getDoc(doc(db, 'settings', 'parcours_sportif')).then((snap) => {
      if (snap.exists() && snap.data().contactPhone) {
        setForm((f) => ({ ...f, contactPhone: snap.data().contactPhone }))
      }
    }).catch(() => {})
  }, [])

  const title = autoTitle(form.datetime)
  const previewLink = form.locationCoords ? parseCoordsLink(form.locationCoords) : null
  const endTime = calcEndTime(form.datetime, parseInt(form.durationMinutes) || 60)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.datetime || !form.locationCoords) {
      setError('Veuillez renseigner la date et les coordonnées GPS.')
      return
    }
    if (!parseCoordsLink(form.locationCoords)) {
      setError('Format de coordonnées invalide. Utilisez lat,lng (ex: 47.6234,-2.7890)')
      return
    }
    const max = parseInt(form.maxSpots)
    const price = parseFloat(form.price)
    const duration = parseInt(form.durationMinutes)
    if (isNaN(max) || max <= 0) { setError('Le nombre de places doit être supérieur à 0.'); return }
    if (isNaN(price) || price < 0) { setError('Le prix doit être un nombre positif.'); return }
    if (isNaN(duration) || duration <= 0) { setError('La durée doit être supérieure à 0.'); return }
    setError('')
    setSubmitting(true)
    try {
      const startDate = new Date(form.datetime)
      const endDate = new Date(startDate.getTime() + duration * 60 * 1000)
      await addDoc(collection(db, 'sessions'), {
        title,
        date: Timestamp.fromDate(startDate),
        dateEnd: Timestamp.fromDate(endDate),
        durationMinutes: duration,
        locationCoords: form.locationCoords.replace(/\s/g, ''),
        locationLabel: form.locationLabel.trim(),
        location: form.locationLabel.trim() || form.locationCoords,
        maxSpots: max,
        price,
        contactPhone: form.contactPhone.trim(),
        registeredCount: 0,
        status: 'open',
        hidden: form.hidden,
        createdAt: Timestamp.now(),
      })
      router.push('/admin/parcours-sportif')
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la création')
    }
    setSubmitting(false)
  }

  if (!isAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/admin/parcours-sportif')} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Nouvelle séance</h1>
          <p className="text-sm text-gray-500">Créer une séance de sport en groupe</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-5">

          {/* Titre auto */}
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-gray-500 mb-1">Titre (généré automatiquement)</p>
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 font-medium">
              {title}
            </div>
          </div>

          {/* Date + heure de début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de début *</label>
            <input type="datetime-local" required value={form.datetime}
              onChange={(e) => setForm((f) => ({ ...f, datetime: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Durée */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes) *</label>
            <input type="number" required min={1} value={form.durationMinutes}
              onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {form.datetime && endTime && (
              <p className="text-xs text-gray-400 mt-1">
                Fin estimée : {endTime}
              </p>
            )}
          </div>

          {/* Coordonnées GPS */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Coordonnées GPS du lieu de RDV *</label>
            <input type="text" required value={form.locationCoords}
              onChange={(e) => setForm((f) => ({ ...f, locationCoords: e.target.value }))}
              placeholder="Ex : 47.6234,-2.7890 — Copiez depuis Google Maps"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Sur Google Maps : clic droit sur le point → copier les coordonnées</p>
            {previewLink && (
              <a href={previewLink} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-medium text-blue-600 hover:underline">
                <MapPinIcon className="w-3.5 h-3.5" />Vérifier sur Maps
              </a>
            )}
          </div>

          {/* Nom du lieu */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du lieu (affiché aux participants)</label>
            <input type="text" value={form.locationLabel}
              onChange={(e) => setForm((f) => ({ ...f, locationLabel: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Places max */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Places maximum *</label>
            <input type="number" required min={1} value={form.maxSpots}
              onChange={(e) => setForm((f) => ({ ...f, maxSpots: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Prix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prix par personne (€) *</label>
            <input type="number" required min={0} step={0.5} value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Téléphone contact */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone de contact (pour annulations participants)</label>
            <input type="tel" value={form.contactPhone}
              onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
              placeholder="0679408254"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Visibilité */}
          <div className="sm:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setForm((f) => ({ ...f, hidden: !f.hidden }))}
                className={`relative w-10 h-5 rounded-full transition ${form.hidden ? 'bg-gray-300' : 'bg-green-500'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.hidden ? 'translate-x-0.5' : 'translate-x-5'}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">{form.hidden ? 'Masquée (non visible sur la page publique)' : 'Visible sur la page publique'}</p>
                <p className="text-xs text-gray-400">Vous pourrez la rendre visible depuis la fiche de la séance</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="sm:col-span-2">
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
            </div>
          )}

          <div className="sm:col-span-2 flex gap-3 pt-2">
            <button type="button" onClick={() => router.push('/admin/parcours-sportif')}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition">
              {submitting ? 'Création...' : 'Créer la séance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
