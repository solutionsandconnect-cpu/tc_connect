'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut, signInWithCustomToken } from 'firebase/auth'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { auth, db } from '@/lib/firebase'
import Navbar from '@/components/layout/Navbar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { UserIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

type ImpersonationInfo = { adminName: string; targetName: string; adminToken?: string }

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentUser, loading, userProfile } = useAuth()
  const router = useRouter()
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null)

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login')
    }
  }, [currentUser, loading, router])

  // Vérifie les abonnements à renouveler (admin) dès l'ouverture de l'app — une fois par jour.
  useEffect(() => {
    if (!currentUser || userProfile?.role_app !== 'Admin') return
    const today = new Date().toISOString().split('T')[0]
    const KEY = `tc_abo_notif_${currentUser.uid}`
    // Garde-fou local (évite un appel réseau inutile sur le même appareil dans la journée).
    // La déduplication réelle entre appareils est assurée côté serveur via dedupeKey.
    if (localStorage.getItem(KEY) === today) return
    ;(async () => {
      try {
        const [abosSnap, clientsSnap] = await Promise.all([
          getDocs(query(collection(db, 'abonnements'), where('userId', '==', currentUser.uid))),
          getDocs(query(collection(db, 'clients'), where('userId', '==', currentUser.uid))),
        ])
        // Mêmes exclusions que l'affichage de la rubrique Clients : on ignore les abos
        // dont le client est supprimé (orphelin) ou désactivé (actif === false).
        const activeClientIds = new Set(
          clientsSnap.docs.filter(d => (d.data() as any).actif !== false).map(d => d.id)
        )
        const in30 = Date.now() + 15 * 86400000
        const now = Date.now()
        const expiring = abosSnap.docs
          .map(d => d.data() as any)
          .filter(a => a.etat === 'Actif' && a.dateFin && a.dateFin.toMillis() <= in30 && activeClientIds.has(a.clientId))
        if (expiring.length === 0) return
        const overdue = expiring.filter(a => a.dateFin.toMillis() < now)
        const soon = expiring.filter(a => a.dateFin.toMillis() >= now)
        const msg = [
          overdue.length ? `${overdue.length} abonnement${overdue.length > 1 ? 's' : ''} expiré${overdue.length > 1 ? 's' : ''}` : '',
          soon.length ? `${soon.length} abonnement${soon.length > 1 ? 's' : ''} expire${soon.length > 1 ? 'nt' : ''} sous 15 j` : '',
        ].filter(Boolean).join(' · ')
        await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.uid,
            persist: true,
            type: 'ABONNEMENT',
            title: 'Abonnements à renouveler',
            body: msg,
            url: '/clients',
            dedupeKey: `abo_${currentUser.uid}_${today}`,
          }),
        })
        localStorage.setItem(KEY, today)
      } catch { /* silencieux */ }
    })()
  }, [currentUser, userProfile])

  // Rattache les listes CheckConnect invitées par email à ce compte (une fois par session).
  useEffect(() => {
    if (!currentUser) return
    const KEY = `cc_claim_${currentUser.uid}`
    try { if (sessionStorage.getItem(KEY)) return } catch {}
    ;(async () => {
      try {
        const idToken = await currentUser.getIdToken()
        await fetch('/api/invite/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })
        try { sessionStorage.setItem(KEY, '1') } catch {}
      } catch { /* silencieux */ }
    })()
  }, [currentUser])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_impersonation')
      if (stored) setImpersonation(JSON.parse(stored))
    } catch {}
  }, [])

  // Déconnecte cet appareil si sa session a été révoquée (ex. changement de mot de passe
  // sur un autre appareil → ce token devient invalide à la prochaine actualisation).
  useEffect(() => {
    let lastCheck = 0
    const checkSession = async () => {
      const u = auth.currentUser
      if (!u) return
      // Throttle : au plus une vérification réseau toutes les 5 min (le token est valide ~1h)
      if (Date.now() - lastCheck < 5 * 60 * 1000) return
      lastCheck = Date.now()
      try { await u.getIdToken(true) }
      catch {
        await signOut(auth).catch(() => {})
        router.push('/login')
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') checkSession() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [router])

  // Remet la pastille (badge d'icône) à zéro quand l'app est ouverte / revient au premier plan
  useEffect(() => {
    const clearBadge = () => {
      try { (navigator as any).clearAppBadge?.() } catch {}
      try { navigator.serviceWorker?.controller?.postMessage('clear-badge') } catch {}
    }
    clearBadge()
    const onVisible = () => { if (document.visibilityState === 'visible') clearBadge() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const quitImpersonation = async () => {
    const adminToken = impersonation?.adminToken
    localStorage.removeItem('tc_impersonation')
    setImpersonation(null) // masque le bandeau immédiatement (le layout ne se remonte pas au retour)
    if (adminToken) {
      try {
        await signInWithCustomToken(auth, adminToken)
        router.push('/accueil')
        return
      } catch { /* token expiré, retour login */ }
    }
    await signOut(auth)
    router.push('/login')
  }

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Bandeau impersonation */}
      {impersonation && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2 text-sm font-medium min-w-0">
            <UserIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">
              Mode impersonation — vous naviguez en tant que{' '}
              <strong>{impersonation.targetName}</strong>
            </span>
          </div>
          <button
            onClick={quitImpersonation}
            className="flex items-center gap-1.5 shrink-0 ml-3 text-xs font-semibold bg-white/25 hover:bg-white/40 px-3 py-1.5 rounded-lg transition"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            Quitter
          </button>
        </div>
      )}

      <Navbar />

      <main className={`lg:ml-64 pb-nav-safe lg:pb-0 min-h-screen overflow-x-clip${impersonation ? ' pt-11' : ''}`}>
        <div className="px-4 py-6 min-w-0">
          {children}
        </div>
      </main>

      <PwaInstallPrompt />
      <PushNotificationPrompt />
    </div>
  )
}
