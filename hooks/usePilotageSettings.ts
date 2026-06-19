import { useEffect, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PilotageSettings } from '@/types'

// Document unique qui stocke les valeurs par défaut du calculateur
const SETTINGS_DOC = 'main'

export function usePilotageSettings() {
  const [settings, setSettings] = useState<PilotageSettings | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onSnapshot(
      doc(db, 'pilotage_settings', SETTINGS_DOC),
      (snap) => {
        setSettings(snap.exists() ? (snap.data() as PilotageSettings) : null)
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [])

  const saveSettings = (data: PilotageSettings) =>
    setDoc(doc(db, 'pilotage_settings', SETTINGS_DOC), data, { merge: true })

  return { settings, loading, saveSettings }
}
