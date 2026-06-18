'use client'

import { useState, useEffect, useMemo } from 'react'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useExercices } from '@/hooks/useExercices'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ClockIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import CircuitsEditor from '@/components/parcours/CircuitsEditor'
import {
  type Circuit, TEMPLATE_DOC_PATH,
  createStandardTemplate, calcCircuitSeconds, formatSeconds, cleanCircuits,
} from '@/lib/parcoursContent'

export default function ParcoursTemplatePage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { exercices } = useExercices()

  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    getDoc(doc(db, TEMPLATE_DOC_PATH[0], TEMPLATE_DOC_PATH[1]))
      .then((snap) => {
        const tpl = snap.exists() ? (snap.data().circuits as Circuit[]) : null
        setCircuits(tpl && tpl.length ? tpl : createStandardTemplate())
      })
      .catch(() => setCircuits(createStandardTemplate()))
      .finally(() => setLoading(false))
  }, [isAdmin])

  const totalSeconds = useMemo(() => circuits.reduce((s, c) => s + calcCircuitSeconds(c), 0), [circuits])

  const handleSave = async () => {
    setSaving(true)
    await setDoc(doc(db, TEMPLATE_DOC_PATH[0], TEMPLATE_DOC_PATH[1]), {
      circuits: cleanCircuits(circuits),
      updatedAt: Timestamp.now(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push('/admin/parcours-sportif')}
          className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800">Template de séance</h1>
          <p className="text-sm text-gray-500 truncate">Modèle chargé via le bouton « ↺ Template » dans le contenu d'une séance</p>
        </div>
        {/* Temps global */}
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 shrink-0">
          <ClockIcon className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-700">
            {formatSeconds(totalSeconds)} estimé
          </span>
        </div>
        {resetConfirm ? (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 shrink-0">
            <span className="text-xs font-medium text-orange-700">Repartir du modèle d'origine ?</span>
            <button onClick={() => setResetConfirm(false)}
              className="text-xs font-semibold text-gray-500 border border-gray-300 px-2 py-0.5 rounded-lg hover:bg-gray-50 transition">Non</button>
            <button onClick={() => { setCircuits(createStandardTemplate()); setResetConfirm(false) }}
              className="text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-lg hover:bg-orange-200 transition">Oui</button>
          </div>
        ) : (
          <button onClick={() => setResetConfirm(true)}
            className="flex items-center gap-1.5 border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-medium px-3 py-2 rounded-xl transition shrink-0">
            <ArrowPathIcon className="w-4 h-4" />
            Modèle d'origine
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0">
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer le template'}
        </button>
      </div>

      <CircuitsEditor circuits={circuits} setCircuits={setCircuits} exercices={exercices} />
    </div>
  )
}
