'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Navbar from '@/components/layout/Navbar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentUser, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login')
    }
  }, [currentUser, loading, router])

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
      {/* Navbar latérale sur desktop, bottom bar sur mobile */}
      <Navbar />
      {/* Contenu principal */}
      <main className="lg:ml-64 pb-20 lg:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}