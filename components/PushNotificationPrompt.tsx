'use client'

import { useEffect, useState } from 'react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { BellAlertIcon, XMarkIcon } from '@heroicons/react/24/outline'

// sessionStorage → le bandeau réapparaît à la prochaine session tant que les notifs ne sont pas activées
const DISMISS_KEY = 'push-prompt-dismissed'
// localStorage → l'utilisateur a demandé à ne plus jamais voir le bandeau
const NEVER_KEY = 'push-prompt-never'

export default function PushNotificationPrompt() {
  const { permission, subscribed, checking, loading, error, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true)
  const [never, setNever] = useState(true)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
    try { setNever(localStorage.getItem(NEVER_KEY) === '1') } catch { setNever(false) }
    setStandalone(
      window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as any).standalone === true,
    )
  }, [])

  // Conditions pour NE PAS afficher
  if (checking) return null
  if (subscribed && permission === 'granted') return null   // déjà activées
  if (permission === 'denied') return null                  // refus explicite → réglages requis, on n'insiste pas
  if (never) return null                                    // « Ne pas redemander »
  if (dismissed) return null
  // On n'invite à activer les notifs qu'une fois l'app installée (sur iOS le push l'exige ;
  // tant que ce n'est pas installé, c'est le bandeau « Installer l'app » qui s'affiche).
  if (!standalone) return null

  const dismiss = () => {
    setDismissed(true)
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  const dismissForever = () => {
    setNever(true)
    try { localStorage.setItem(NEVER_KEY, '1') } catch {}
  }

  return (
    <div className="fixed inset-x-0 bottom-24 lg:bottom-4 z-[55] px-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-white border border-gray-200 shadow-lg rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <BellAlertIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Activer les notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Ne ratez aucun message, rappel de RDV ou information de votre coach.
            </p>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-300 hover:text-gray-500 transition shrink-0" title="Plus tard">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 mt-2 leading-relaxed bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={subscribe}
            disabled={loading}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition disabled:opacity-60"
          >
            <BellAlertIcon className="w-4 h-4" />
            {loading ? 'Activation…' : 'Activer les notifications'}
          </button>
          <button onClick={dismiss} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 transition">
            Plus tard
          </button>
        </div>

        <div className="flex items-center justify-center mt-1.5">
          <button onClick={dismissForever} className="text-[11px] text-gray-400 hover:text-gray-600 transition">
            Ne pas redemander
          </button>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-1">
          Vous pourrez les activer à tout moment depuis votre Profil.
        </p>
      </div>
    </div>
  )
}
