'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'

function ImpersonateContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const adminToken = searchParams.get('adminToken')
  const targetName = searchParams.get('targetName')
  const adminName = searchParams.get('adminName')

  useEffect(() => {
    if (!token) {
      router.replace('/users')
      return
    }
    signInWithCustomToken(auth, token)
      .then(() => {
        localStorage.setItem('tc_impersonation', JSON.stringify({
          adminName: adminName ?? 'Admin',
          targetName: targetName ?? 'Utilisateur',
          adminToken: adminToken ?? '',
        }))
        router.replace('/accueil')
      })
      .catch((err) => {
        console.error('[impersonate]', err)
        router.replace('/users')
      })
  }, [token, targetName, adminName, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-amber-700">Connexion au compte en cours…</p>
      </div>
    </div>
  )
}

export default function ImpersonatePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ImpersonateContent />
    </Suspense>
  )
}
