'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { createTrip, createTripFromTemplate, updateTrip, nbJoursOf } from '@/lib/tripsService'
import { TRIP_TYPES, TRIP_COLORS, TRIP_EMOJIS } from '../constants'
import { Timestamp } from 'firebase/firestore'
import type { Trip, TripType } from '@/types'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip?: Trip | null            // null/undefined = création
  templates?: Trip[]            // modèles proposés en création
  onCreated?: (id: string) => void
}

function tsToInput(ts?: Timestamp | null): string {
  const d = ts?.toDate?.()
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function inputToTs(v: string): Timestamp | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  return Timestamp.fromDate(new Date(y, m - 1, d))
}

export default function TripModal({ isOpen, onClose, trip, templates = [], onCreated }: Props) {
  const { currentUser, userProfile } = useAuth()
  const isEdit = !!trip
  // owner fiable : l'UID d'authentification fait foi (cohérent avec les règles + useTrips)
  const owner = currentUser && userProfile ? { ...userProfile, uid: currentUser.uid } : null
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'other' as TripType, icon: '🧳', color: TRIP_COLORS[0],
    dateFrom: '', dateTo: '', fromTemplateId: '',
  })

  useEffect(() => {
    if (!isOpen) return
    if (trip) {
      setForm({
        name: trip.name, type: trip.type, icon: trip.icon, color: trip.color,
        dateFrom: tsToInput(trip.dateFrom), dateTo: tsToInput(trip.dateTo), fromTemplateId: '',
      })
    } else {
      setForm({ name: '', type: 'other', icon: '🧳', color: TRIP_COLORS[0], dateFrom: '', dateTo: '', fromTemplateId: '' })
    }
  }, [isOpen, trip])

  // Quand on choisit un modèle, pré-remplit type/icône/couleur depuis celui-ci
  const applyTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id)
    setForm(f => ({
      ...f,
      fromTemplateId: id,
      ...(tpl ? { type: tpl.type, icon: tpl.icon, color: tpl.color, name: f.name || tpl.name.replace(/ \(modèle\)$/, '') } : {}),
    }))
  }

  const nbJours = nbJoursOf({ dateFrom: inputToTs(form.dateFrom), dateTo: inputToTs(form.dateTo) })

  const handleSave = async () => {
    if (!owner || !form.name.trim()) return
    setSaving(true)
    try {
      const base = {
        name: form.name.trim(), type: form.type, icon: form.icon, color: form.color,
        dateFrom: inputToTs(form.dateFrom), dateTo: inputToTs(form.dateTo),
      }
      if (isEdit && trip) {
        await updateTrip(trip.id, base)
      } else if (form.fromTemplateId) {
        const ref = await createTripFromTemplate(owner, form.fromTemplateId, base)
        onCreated?.((ref as { id: string }).id)
      } else {
        const ref = await createTrip(owner, base)
        onCreated?.((ref as { id: string }).id)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Modifier le voyage' : 'Nouveau voyage'} size="lg">
      <div className="space-y-4">
        {/* Aperçu */}
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: form.color + '15' }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: form.color + '30' }}>
            {form.icon}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{form.name || 'Nom du voyage'}</p>
            <p className="text-xs text-gray-500">{TRIP_TYPES.find(t => t.value === form.type)?.label}{nbJours ? ` · ${nbJours} jour${nbJours > 1 ? 's' : ''}` : ''}</p>
          </div>
        </div>

        {/* Modèle (création seulement) */}
        {!isEdit && templates.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{"Partir d'un modèle"}</label>
            <select value={form.fromTemplateId} onChange={e => applyTemplate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Liste vierge —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
            </select>
          </div>
        )}

        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Week-end à la mer"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {TRIP_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, type: t.value }))}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs border transition ${
                  form.type === t.value ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                }`}>
                <span>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Départ</label>
            <input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Retour</label>
            <input type="date" value={form.dateTo} min={form.dateFrom || undefined} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Icône */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Icône</label>
          <div className="flex flex-wrap gap-1.5">
            {TRIP_EMOJIS.map(e => (
              <button key={e} type="button" onClick={() => setForm(f => ({ ...f, icon: e }))}
                className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                  form.icon === e ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-gray-100'
                }`}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {/* Couleur */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {TRIP_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                aria-label={`Couleur ${c}`}
                className={`w-7 h-7 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-700' : ''}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">
            {saving ? '…' : isEdit ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
