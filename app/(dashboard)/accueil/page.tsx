'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection, query, where, orderBy,
  getDocs, getCountFromServer, doc, Timestamp, addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  CalendarIcon, BellIcon, UsersIcon,
  ClipboardDocumentListIcon, ChevronRightIcon,
  MapPinIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline'
import Badge from '@/components/ui/Badge'
import { formatHeure, getEtatBadge } from '@/lib/planningUtils'
import { navItems } from '@/components/layout/Navbar'

export default function AccueilPage() {
  const { currentUser, userProfile } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()
  const isAdmin = userProfile?.role_app === 'Admin'
  const droits = userProfile?.droits as any

  const [rdvAujourdhui, setRdvAujourdhui] = useState<any[]>([])
  const [totalClients, setTotalClients] = useState(0)
  const [totalSeances, setTotalSeances] = useState(0)
  const [prochainsRdv, setProchainsRdv] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    fetchStats()
    checkAndCreateNotifications()
  }, [currentUser])

  const checkAndCreateNotifications = async () => {
    if (!currentUser) return
    // Run at most once per hour per session to avoid expensive N+1 reads on every visit
    const KEY = 'tc_notif_check'
    const last = sessionStorage.getItem(KEY)
    if (last && Date.now() - parseInt(last) < 3_600_000) return
    sessionStorage.setItem(KEY, String(Date.now()))
    const userRef = doc(db, 'users', currentUser.uid)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    try {
      const rdvQ = query(
        collection(db, 'planning_pro'),
        where('ref_users', '==', userRef),
        where('etat_planning_rdv', '==', 'Effectué'),
        where('date_planning', '<', Timestamp.fromDate(today)),
        orderBy('date_planning', 'desc')
      )
      const rdvSnap = await getDocs(rdvQ)
      const allPastRdvs = rdvSnap.docs.map(d => ({ id: d.id, ...d.data() as any }))

      // Existing admin notifications (CR_RDV_MANQUANT + SEANCE_INCOMPLETE)
      const adminNotifSnap = await getDocs(query(
        collection(db, 'Notifications'),
        where('refUsers', '==', userRef),
        where('type_notification', 'in', ['CR_RDV_MANQUANT', 'SEANCE_INCOMPLETE'])
      ))
      const existingAdminByType = new Map<string, Set<string>>()
      adminNotifSnap.docs.forEach(d => {
        const { type_notification, ref_planning } = d.data() as any
        if (!existingAdminByType.has(type_notification)) existingAdminByType.set(type_notification, new Set())
        if (ref_planning?.id) existingAdminByType.get(type_notification)!.add(ref_planning.id)
      })

      for (const rdv of allPastRdvs) {
        const planningRef = doc(db, 'planning_pro', rdv.id)
        const dateStr = rdv.date_planning?.toDate().toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric',
        })

        // 1. Admin: CR manquant
        if (!rdv.observations_rdv && !existingAdminByType.get('CR_RDV_MANQUANT')?.has(rdv.id)) {
          await addDoc(collection(db, 'Notifications'), {
            refUsers: userRef,
            type_notification: 'CR_RDV_MANQUANT',
            notification: `Le compte rendu du RDV du ${dateStr} n'a pas été rempli.`,
            etat_notification: 'Non lu',
            date_create: Timestamp.now(),
            ref_planning: planningRef,
          })
        }

        // 2. Admin: séance incomplète
        if (!existingAdminByType.get('SEANCE_INCOMPLETE')?.has(rdv.id)) {
          const seancesSnap = await getDocs(query(
            collection(db, 'seance'),
            where('ref_planning', '==', planningRef)
          ))
          const hasIncomplete = seancesSnap.docs.some(d => ((d.data() as any).avancement_circuit ?? 0) < 1)
          if (hasIncomplete) {
            await addDoc(collection(db, 'Notifications'), {
              refUsers: userRef,
              type_notification: 'SEANCE_INCOMPLETE',
              notification: `La séance du ${dateStr} n'a pas été complétée dans son intégralité.`,
              etat_notification: 'Non lu',
              date_create: Timestamp.now(),
              ref_planning: planningRef,
            })
          }
        }

        // 3. Client: commentaire retour manquant (le lendemain)
        const rdvDate = rdv.date_planning?.toDate?.()
        if (!rdv.cr_rdv_client && rdvDate && rdvDate < yesterday && rdv.ref_client) {
          const clientRef = rdv.ref_client
          const clientNotifSnap = await getDocs(query(
            collection(db, 'Notifications'),
            where('refUsers', '==', clientRef),
            where('type_notification', '==', 'CR_CLIENT_MANQUANT'),
            where('ref_planning', '==', planningRef)
          ))
          if (clientNotifSnap.empty) {
            await addDoc(collection(db, 'Notifications'), {
              refUsers: clientRef,
              type_notification: 'CR_CLIENT_MANQUANT',
              notification: `Merci de partager votre retour sur la séance du ${dateStr}.`,
              etat_notification: 'Non lu',
              date_create: Timestamp.now(),
              ref_planning: planningRef,
            })
          }
        }
      }
    } catch {}
  }

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

    // Total clients — count only, no document reads
    const clientsSnap = await getCountFromServer(query(collection(db, 'users')))
    setTotalClients(clientsSnap.data().count)

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
          {greeting()} {userProfile?.prenom} 👋
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
        {isAdmin && (
          <StatCard
            label="Clients"
            value={totalClients}
            icon={<UsersIcon className="w-5 h-5" />}
            color="green"
            onClick={() => router.push('/equipes')}
          />
        )}
        {isAdmin && (
          <StatCard
            label="Séances créées"
            value={totalSeances}
            icon={<ClipboardDocumentListIcon className="w-5 h-5" />}
            color="purple"
            onClick={() => router.push('/seances')}
          />
        )}
      </div>

      {/* RDV du jour */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Aujourd'hui</h2>
          <button
            onClick={() => router.push('/planning')}
            className="group flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            Voir tout
            <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {rdvAujourdhui.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center space-y-3">
            <p className="text-gray-400 text-sm">Aucun RDV aujourd'hui</p>
            {isAdmin ? (
              <button
                onClick={() => router.push('/planning')}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                <CalendarIcon className="w-4 h-4" />
                Ajouter un RDV
              </button>
            ) : (
              <button
                onClick={() => router.push('/planning')}
                className="inline-flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
              >
                <CalendarIcon className="w-4 h-4" />
                Ajouter une activité
              </button>
            )}
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">📍 {rdv.adresse_rdv}</span>
                        <div className="flex items-center gap-2">
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(rdv.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50 transition"><MapPinIcon className="w-3 h-3" />Waze</a>
                          <a href={`https://maps.google.com/maps?q=${encodeURIComponent(rdv.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 transition"><GlobeAltIcon className="w-3 h-3" />Maps</a>
                        </div>
                      </div>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-400">📍 {rdv.adresse_rdv}</span>
                        <div className="flex items-center gap-2">
                          <a href={`https://waze.com/ul?q=${encodeURIComponent(rdv.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-sky-200 text-sky-700 hover:bg-sky-50 transition"><MapPinIcon className="w-3 h-3" />Waze</a>
                          <a href={`https://maps.google.com/maps?q=${encodeURIComponent(rdv.adresse_rdv)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 transition"><GlobeAltIcon className="w-3 h-3" />Maps</a>
                        </div>
                      </div>
                    )}
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Navigation rapide — visible sur mobile, pour les pages hors barre du bas */}
      {(() => {
        const mobileBarHrefs = ['/accueil', '/planning', '/notifications', '/messagerie', '/boutique', '/clients', '/profil']
        const extraItems = (navItems as any[]).filter((item) => {
          if (mobileBarHrefs.includes(item.href)) return false
          if (item.adminOnly && !isAdmin) return false
          if (!isAdmin && item.droit) {
            if (item.droit === 'exercices') return droits?.exercices === true
            return droits?.[item.droit] !== false
          }
          return true
        })
        if (extraItems.length === 0) return null
        return (
          <section className="lg:hidden">
            <h2 className="text-base font-semibold text-gray-700 mb-3">Navigation</h2>
            <div className="grid grid-cols-3 gap-3">
              {extraItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(item.href)}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md transition"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )
      })()}

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