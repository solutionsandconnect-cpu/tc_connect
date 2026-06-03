'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline'

const SETTINGS_REF = () => doc(db, 'settings', 'parcours_sportif')

export default function ParcoursParametresPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [contactPhone, setContactPhone] = useState('+33679408254')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    getDoc(SETTINGS_REF()).then((snap) => {
      if (snap.exists()) {
        const d = snap.data()
        if (d.contactPhone) setContactPhone(d.contactPhone)
        if (d.iban) setIban(d.iban)
        if (d.bic) setBic(d.bic)
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [isAdmin])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await setDoc(SETTINGS_REF(), {
        contactPhone: contactPhone.trim(),
        iban: iban.replace(/\s/g, '').toUpperCase(),
        bic: bic.trim().toUpperCase(),
      }, { merge: true })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setSaving(false)
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
          <h1 className="text-xl font-bold text-gray-800">Paramètres — Parcours Sportif</h1>
          <p className="text-sm text-gray-500">Configuration globale des parcours sportifs</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Contact</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de téléphone</label>
              <p className="text-xs text-gray-400 mb-2">Utilisé pour le SMS "Prévenir en cas d'imprévu" et sur chaque fiche de séance.</p>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+33679408254"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* RIB */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-0.5">Coordonnées bancaires (RIB)</h2>
              <p className="text-xs text-gray-400">
                Affichées aux participants ayant un règlement en attente sur leur espace "Mes Parcours" — avec bouton de copie pour faciliter le virement.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
              <input
                type="text"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="FR76 1600 6200 1100 8401 5620 604"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Les espaces sont retirés automatiquement à l'enregistrement.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">BIC</label>
              <input
                type="text"
                value={bic}
                onChange={(e) => setBic(e.target.value)}
                placeholder="AGRIFRPP860"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              {saved ? <CheckIcon className="w-4 h-4" /> : null}
              {saving ? 'Enregistrement…' : saved ? 'Enregistré !' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/parcours-sportif')}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
