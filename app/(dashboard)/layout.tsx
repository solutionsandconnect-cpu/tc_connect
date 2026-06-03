'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { useAuth } from '@/context/AuthContext'
import { auth } from '@/lib/firebase'
import Navbar from '@/components/layout/Navbar'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import PushNotificationPrompt from '@/components/PushNotificationPrompt'
import { UserIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

type ImpersonationInfo = { adminName: string; targetName: string }

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentUser, loading } = useAuth()
  const router = useRouter()
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null)

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login')
    }
  }, [currentUser, loading, router])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tc_impersonation')
      if (stored) setImpersonation(JSON.parse(stored))
    } catch {}
  }, [])

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
    localStorage.removeItem('tc_impersonation')
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

      <main className={`lg:ml-64 pb-nav-safe lg:pb-0 min-h-screen overflow-x-hidden${impersonation ? ' pt-11' : ''}`}>
        <div className="px-4 py-6 min-w-0">
          {children}
        </div>
      </main>

      <PwaInstallPrompt />
      <PushNotificationPrompt />
    </div>
  )
}
