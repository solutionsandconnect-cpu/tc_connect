'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/** iOS (iPhone/iPad) hors mode "installé à l'écran d'accueil" : le push n'est pas disponible. */
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}
function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as any).standalone === true
}

export function usePushNotifications() {
  const { currentUser, userProfile } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission)
    const checkSub = async () => {
      if (!('serviceWorker' in navigator)) { setChecking(false); return }
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setSubscribed(!!sub)
      } catch {}
      setChecking(false)
    }
    checkSub()
  }, [])

  const subscribe = async () => {
    setError(null)
    if (!currentUser) { setError('Vous devez être connecté.'); return }

    // 1. Support du navigateur
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      // Cas iOS le plus fréquent : app pas (encore) ajoutée à l'écran d'accueil
      if (isIos() && !isStandalone()) {
        setError("Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil (Partager → « Sur l'écran d'accueil »), ouvrez-la depuis cette icône, puis réessayez.")
      } else {
        setError("Les notifications push ne sont pas supportées par ce navigateur.")
      }
      return
    }
    // iOS installé mais via Safari onglet → standalone requis
    if (isIos() && !isStandalone()) {
      setError("Ouvrez l'app depuis l'icône de l'écran d'accueil (pas dans Safari) pour activer les notifications.")
      return
    }
    // 2. Clé VAPID publique présente (sinon = variable non définie sur Vercel au build)
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      setError("Configuration manquante : NEXT_PUBLIC_VAPID_PUBLIC_KEY n'est pas définie (à renseigner sur Vercel puis redéployer).")
      return
    }

    setLoading(true)
    try {
      // 3. Autorisation (doit être déclenchée par un tap)
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError(perm === 'denied'
          ? 'Autorisation refusée. Activez les notifications pour cette app dans Réglages iOS.'
          : "Autorisation non accordée.")
        return
      }

      // 4. Service worker prêt (on l'enregistre au besoin)
      let reg = await navigator.serviceWorker.getRegistration()
      if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // 5. Abonnement push
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as any,
      })

      // 6. Enregistrement côté serveur
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userId: currentUser.uid,
          role_app: userProfile?.role_app ?? 'Utilisateur',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Échec enregistrement serveur (HTTP ${res.status}).`)
      }
      setSubscribed(true)
    } catch (err: any) {
      console.error('Push subscribe error:', err)
      setError(err?.message ? `Erreur : ${err.message}` : "Erreur lors de l'activation des notifications.")
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!currentUser) return
    setError(null)
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.uid }),
      })
      setSubscribed(false)
    } catch (err: any) {
      console.error('Push unsubscribe error:', err)
      setError(err?.message ? `Erreur : ${err.message}` : "Erreur lors de la désactivation.")
    } finally {
      setLoading(false)
    }
  }

  return { permission, subscribed, loading, checking, error, subscribe, unsubscribe }
}
