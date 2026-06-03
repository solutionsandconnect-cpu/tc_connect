'use client'

import { useEffect, useState } from 'react'
import { ArrowDownTrayIcon, XMarkIcon, ShareIcon } from '@heroicons/react/24/outline'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'pwa-install-dismissed'

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [showIosHelp, setShowIosHelp] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Déjà installée (mode standalone) → rien à proposer
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as any).standalone === true
    if (standalone) return
    // Déjà masquée par l'utilisateur
    try { if (localStorage.getItem(DISMISS_KEY) === '1') return } catch {}

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIos(ios)

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    // iOS Safari n'émet pas beforeinstallprompt → on affiche un bandeau d'aide
    if (ios) setVisible(true)

    const onInstalled = () => dismiss()
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBip)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch {}
  }

  const install = async () => {
    if (deferred) {
      await deferred.prompt()
      try { await deferred.userChoice } catch {}
      setDeferred(null)
      dismiss()
    } else if (isIos) {
      setShowIosHelp((v) => !v)
    }
  }

  if (!visible) return null

  return (
    <div className="fixed inset-x-0 bottom-24 lg:bottom-4 z-[55] px-3 pointer-events-none">
      <div className="pointer-events-auto mx-auto max-w-md bg-white border border-gray-200 shadow-lg rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <ArrowDownTrayIcon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Installer TC Connect</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Ajoutez l&apos;app à votre écran d&apos;accueil pour une vraie expérience d&apos;application et recevoir les notifications.
            </p>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-300 hover:text-gray-500 transition shrink-0" title="Plus tard">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {showIosHelp && isIos && (
          <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-gray-700 space-y-1.5">
            <p className="flex items-center gap-1.5">
              1. Appuyez sur <ShareIcon className="w-4 h-4 text-blue-600 inline" /> <strong>Partager</strong> (en bas de Safari)
            </p>
            <p>2. Faites défiler et choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong></p>
            <p>3. Validez avec <strong>Ajouter</strong> — l&apos;app apparaît sur votre écran d&apos;accueil.</p>
          </div>
        )}

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={install}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            {isIos ? (showIosHelp ? 'Masquer les étapes' : "Comment installer ?") : "Installer l'app"}
          </button>
          <button onClick={dismiss} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2 transition">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}
