'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'

// Drapeau d'opt-out par compte : si l'utilisateur a explicitement désactivé les
// notifications, on ne les ré-active pas automatiquement à sa reconnexion.
const optOutKey = (uid: string) => `tc_push_optout_${uid}`

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Une souscription push est liée à la clé VAPID publique utilisée lors de sa création.
// Si la clé du serveur a changé depuis, l'ancienne souscription reste « valide » côté
// navigateur mais le push service rejette tout envoi signé avec la nouvelle clé (HTTP 403),
// et plus aucune notification n'arrive — sans jamais se réparer. On compare donc la clé de
// la souscription existante à la clé courante pour décider s'il faut re-souscrire.
function subscriptionMatchesKey(sub: PushSubscription, desired: Uint8Array): boolean {
  const raw = sub.options?.applicationServerKey
  if (!raw) return false
  const current = new Uint8Array(raw)
  if (current.length !== desired.length) return false
  for (let i = 0; i < current.length; i++) if (current[i] !== desired[i]) return false
  return true
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

  /** Enregistre l'abonnement push de cet appareil pour l'utilisateur courant.
   *  silent=true : ne demande PAS l'autorisation (réservé à la ré-activation auto
   *  quand l'autorisation OS est déjà accordée — donc sans interaction). */
  const registerDevice = async (silent: boolean): Promise<boolean> => {
    if (!currentUser) { if (!silent) setError('Vous devez être connecté.'); return false }

    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      if (!silent) {
        if (isIos() && !isStandalone()) setError("Sur iPhone, ajoutez d'abord l'app à l'écran d'accueil (Partager → « Sur l'écran d'accueil »), ouvrez-la depuis cette icône, puis réessayez.")
        else setError("Les notifications push ne sont pas supportées par ce navigateur.")
      }
      return false
    }
    if (isIos() && !isStandalone()) {
      if (!silent) setError("Ouvrez l'app depuis l'icône de l'écran d'accueil (pas dans Safari) pour activer les notifications.")
      return false
    }
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      if (!silent) setError("Configuration manquante : NEXT_PUBLIC_VAPID_PUBLIC_KEY n'est pas définie (à renseigner sur Vercel puis redéployer).")
      return false
    }

    // Autorisation : en mode silencieux on exige qu'elle soit déjà accordée (pas de prompt).
    let perm = Notification.permission
    if (perm !== 'granted') {
      if (silent) return false
      perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError(perm === 'denied'
          ? 'Autorisation refusée. Activez les notifications pour cette app dans Réglages iOS.'
          : "Autorisation non accordée.")
        return false
      }
    }

    let reg = await navigator.serviceWorker.getRegistration()
    if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const desiredKey = urlBase64ToUint8Array(vapidKey)
    // Si une souscription existe mais a été créée avec une autre clé VAPID, elle est
    // devenue muette (rejets 403 silencieux) → on la révoque pour en recréer une saine.
    let sub = await reg.pushManager.getSubscription()
    if (sub && !subscriptionMatchesKey(sub, desiredKey)) {
      try { await sub.unsubscribe() } catch {}
      sub = null
    }
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: desiredKey as any,
      })
    }

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
    return true
  }

  const subscribe = async () => {
    setError(null)
    setLoading(true)
    try {
      const ok = await registerDevice(false)
      if (ok && currentUser) {
        try { localStorage.removeItem(optOutKey(currentUser.uid)) } catch {}
      }
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
      // Marque l'opt-out pour ce compte → pas de ré-activation auto à la reconnexion
      try { localStorage.setItem(optOutKey(currentUser.uid), '1') } catch {}
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      const endpoint = sub?.endpoint
      if (sub) await sub.unsubscribe()
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        // endpoint → ne supprime que la souscription de CET appareil (les autres
        // appareils du compte gardent le push).
        body: JSON.stringify({ userId: currentUser.uid, endpoint }),
      })
      setSubscribed(false)
    } catch (err: any) {
      console.error('Push unsubscribe error:', err)
      setError(err?.message ? `Erreur : ${err.message}` : "Erreur lors de la désactivation.")
    } finally {
      setLoading(false)
    }
  }

  // ── Ré-activation automatique à la connexion ────────────────────────────────
  // Si l'autorisation OS est déjà accordée et que l'utilisateur n'a pas
  // explicitement désactivé, on ré-enregistre silencieusement cet appareil pour
  // le compte courant (utile après reconnexion : pas besoin de re-tapoter).
  const autoTriedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!currentUser) { autoTriedFor.current = null; return }
    if (autoTriedFor.current === currentUser.uid) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    let optedOut = false
    try { optedOut = localStorage.getItem(optOutKey(currentUser.uid)) === '1' } catch {}
    if (optedOut) return
    autoTriedFor.current = currentUser.uid
    registerDevice(true).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userProfile])

  return { permission, subscribed, loading, checking, error, subscribe, unsubscribe }
}
