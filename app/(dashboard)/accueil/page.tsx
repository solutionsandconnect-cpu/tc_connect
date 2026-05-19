'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection, query, where, orderBy,
  getDocs, doc, Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  CalendarIcon, BellIcon, UsersIcon,
  ClipboardDocumentListIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import Badge from '@/components/ui/Badge'
import { formatHeure, getEtatBadge } from '@/lib/planningUtils'

export default function AccueilPage() {
  const { currentUser, userProfile } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()

  const [rdvAujourdhui, setRdvAujourdhui] = useState<any[]>([])
  const [totalClients, setTotalClients] = useState(0)
  const [totalSeances, setTotalSeances] = useState(0)
  const [prochainsRdv, setProchainsRdv] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    fetchStats()
  }, [currentUser])

  const fetchStats = async () => {
    if (!currentUser) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const in7days = new Date(today)
    in7days.setDate(in7days.getDate() + 7)

    const userRef = doc(db, 'users', currentUser.uid)

    // RDV d'aujourd'hui
    const rdvQuery = query(
      collection(db, 'planning_pro'),
      where('ref_users', '==', userRef),
      where('date_planning', '>=', Timestamp.fromDate(today)),
      where('date_planning', '<', Timestamp.fromDate(tomorrow)),
      orderBy('date_planning', 'asc')
    )
    const rdvSnap = await getDocs(rdvQuery)
    setRdvAujourdhui(rdvSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

    // Prochains RDV (7 jours)
    const prochainsQuery = query(
      collection(db, 'planning_pro'),
      where('ref_users', '==', userRef),
      where('date_planning', '>=', Timestamp.fromDate(tomorrow)),
      where('date_planning', '<', Timestamp.fromDate(in7days)),
      orderBy('date_planning', 'asc')
    )
    const prochainsSnap = await getDocs(prochainsQuery)
    setProchainsRdv(prochainsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))

    // Total clients (users actifs)
    const clientsQuery = query(collection(db, 'users'))
    const clientsSnap = await getDocs(clientsQuery)
    setTotalClients(clientsSnap.size)

    // Total séances
    const seancesQuery = query(
      collection(db, 'seance'),
      where('ref_users', '==', userRef)
    )
    const seancesSnap = await getDocs(seancesQuery)
    setTotalSeances(seancesSnap.size)

    setLoading(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">
          {greeting()}, {userProfile?.prenom} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
          })}
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="RDV aujourd'hui"
          value={rdvAujourdhui.length}
          icon={<CalendarIcon className="w-5 h-5" />}
          color="blue"
          onClick={() => router.push('/planning')}
        />
        <StatCard
          label="Notifications"
          value={unreadCount}
          icon={<BellIcon className="w-5 h-5" />}
          color="orange"
          onClick={() => router.push('/notifications')}
        />
        <StatCard
          label="Clients"
          value={totalClients}
          icon={<UsersIcon className="w-5 h-5" />}
          color="green"
          onClick={() => router.push('/equipes')}
        />
        <StatCard
          label="Séances créées"
          value={totalSeances}
          icon={<ClipboardDocumentListIcon className="w-5 h-5" />}
          color="purple"
          onClick={() => router.push('/seances')}
        />
      </div>

      {/* RDV du jour */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Aujourd'hui</h2>
          <button
            onClick={() => router.push('/planning')}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            Voir tout <ChevronRightIcon className="w-3 h-3" />
          </button>
        </div>

        {rdvAujourdhui.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <p className="text-gray-400 text-sm">Aucun RDV aujourd'hui</p>
            <button
              onClick={() => router.push('/planning')}
              className="mt-2 text-blue-600 text-sm font-medium hover:underline"
            >
              + Ajouter un RDV
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {rdvAujourdhui.map((rdv) => {
              const etat = getEtatBadge(rdv.etat_planning_rdv)
              return (
                <div
                  key={rdv.id}
                  onClick={() => router.push(`/planning/${rdv.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {formatHeure(rdv.heure_planning_debut)} → {formatHeure(rdv.heure_planning_fin)}
                      </span>
                      <Badge label={etat.label} variant={etat.variant} />
                    </div>
                    {rdv.adresse_rdv && (
                      <p className="text-xs text-gray-400">📍 {rdv.adresse_rdv}</p>
                    )}
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Prochains RDV */}
      {prochainsRdv.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-gray-700">
              Les 7 prochains jours
            </h2>
          </div>
          <div className="space-y-2">
            {prochainsRdv.slice(0, 5).map((rdv) => {
              const etat = getEtatBadge(rdv.etat_planning_rdv)
              return (
                <div
                  key={rdv.id}
                  onClick={() => router.push(`/planning/${rdv.id}`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400 capitalize">
                        {rdv.date_planning?.toDate().toLocaleDateString('fr-FR', {
                          weekday: 'short', day: 'numeric', month: 'short'
                        })}
                      </span>
                      <Badge label={etat.label} variant={etat.variant} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatHeure(rdv.heure_planning_debut)} → {formatHeure(rdv.heure_planning_fin)}
                    </p>
                    {rdv.adresse_rdv && (
                      <p className="text-xs text-gray-400">📍 {rdv.adresse_rdv}</p>
                    )}
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </div>
              )
            })}
          </div>
        </section>
      )}

    </div>
  )
}

function StatCard({
  label, value, icon, color, onClick,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'green' | 'orange' | 'purple'
  onClick: () => void
}) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:shadow-md transition w-full"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </button>
  )
}