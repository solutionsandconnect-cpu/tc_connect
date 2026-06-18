'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { doc, getDoc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useExercices } from '@/hooks/useExercices'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/outline'
import CircuitsEditor from '@/components/parcours/CircuitsEditor'
import {
  type Circuit, TEMPLATE_DOC_PATH,
  emptyCircuit, createStandardTemplate, calcCircuitSeconds, formatSeconds, cleanCircuits,
} from '@/lib/parcoursContent'

export default function ContenuSeancePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { exercices } = useExercices()

  const [sessionTitle, setSessionTitle] = useState('')
  const [circuits, setCircuits] = useState<Circuit[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [templateConfirm, setTemplateConfirm] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      // Load session title
      const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
      if (sessionSnap.exists()) setSessionTitle(sessionSnap.data().title ?? '')

      // Load content if exists
      const contentSnap = await getDoc(doc(db, 'session_content', sessionId))
      if (contentSnap.exists()) {
        setCircuits(contentSnap.data().circuits ?? [])
      } else {
        setCircuits([emptyCircuit(1)])
      }
      setLoading(false)
    }
    load()
  }, [isAdmin, sessionId])

  const totalSeconds = useMemo(() => circuits.reduce((s, c) => s + calcCircuitSeconds(c), 0), [circuits])

  // Charge le template enregistré par l'admin (ou le template "usine" si aucun n'existe).
  const applyTemplate = async () => {
    setTemplateConfirm(false)
    try {
      const snap = await getDoc(doc(db, TEMPLATE_DOC_PATH[0], TEMPLATE_DOC_PATH[1]))
      const tpl = snap.exists() ? (snap.data().circuits as Circuit[]) : null
      setCircuits(tpl && tpl.length ? structuredClone(tpl) : createStandardTemplate())
    } catch {
      setCircuits(createStandardTemplate())
    }
  }

  const handleSave = async () => {
    setSaving(true)
    // Plus aucun contenu → on supprime carrément le document (pas de doc "vide" qui traîne)
    if (circuits.length === 0) {
      await deleteDoc(doc(db, 'session_content', sessionId)).catch(() => {})
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      return
    }
    await setDoc(doc(db, 'session_content', sessionId), {
      sessionId,
      circuits: cleanCircuits(circuits),
      updatedAt: Timestamp.now(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé.</p></div>
  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}`)}
          className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-800">Contenu de séance</h1>
          <p className="text-sm text-gray-500 truncate">{sessionTitle}</p>
        </div>
        {/* Temps global */}
        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-xl px-4 py-2 shrink-0">
          <ClockIcon className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-bold text-purple-700">
            {formatSeconds(totalSeconds)} estimé
          </span>
        </div>
        <button onClick={() => router.push(`/admin/parcours-sportif/${sessionId}/vue`)}
          className="flex items-center gap-1.5 border border-purple-200 text-purple-600 hover:bg-purple-50 text-sm font-medium px-3 py-2 rounded-xl transition shrink-0">
          <EyeIcon className="w-4 h-4" />
          Vue séance
        </button>
        {templateConfirm ? (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 shrink-0">
            <span className="text-xs font-medium text-orange-700">Remplacer le contenu ?</span>
            <button onClick={() => setTemplateConfirm(false)}
              className="text-xs font-semibold text-gray-500 border border-gray-300 px-2 py-0.5 rounded-lg hover:bg-gray-50 transition">Non</button>
            <button onClick={applyTemplate}
              className="text-xs font-semibold text-orange-700 bg-orange-100 border border-orange-300 px-2 py-0.5 rounded-lg hover:bg-orange-200 transition">Oui</button>
          </div>
        ) : (
          <button onClick={() => setTemplateConfirm(true)}
            className="flex items-center gap-1.5 border border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-medium px-3 py-2 rounded-xl transition shrink-0">
            ↺ Template
          </button>
        )}
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0">
          {saving ? 'Enregistrement...' : saved ? '✓ Enregistré' : 'Enregistrer'}
        </button>
      </div>

      <CircuitsEditor circuits={circuits} setCircuits={setCircuits} exercices={exercices} />
    </div>
  )
}
