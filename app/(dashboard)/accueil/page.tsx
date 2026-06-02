'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection, query, where, orderBy,
  getDocs, doc, Timestamp, addDoc, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import {
  CalendarIcon, BellIcon, ChevronRightIcon,
  MapPinIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline'
import Badge from '@/components/ui/Badge'
import { formatHeure, getEtatBadge } from '@/lib/planningUtils'
import { navItems } from '@/components/layout/Navbar'
import { useStoreApps } from '@/hooks/useStoreApps'
import { listenStoreSubscriptions, updateStoreSubscription } from '@/lib/storeService'

// Ajoute une période (mensuel = +1 mois, annuel = +1 an) à un timestamp ms
function addPeriodMs(fromMs: number, periodicite: string): number {
  const d = new Date(fromMs)
  if (periodicite === 'annuel') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

export default function AccueilPage() {
  const { currentUser, userProfile } = useAuth()
  const { unreadCount } = useNotifications()
  const router = useRouter()
  const isAdmin = userProfile?.role_app === 'Admin'
  const droits = userProfile?.droits as any

  const [rdvAujourdhui, setRdvAujourdhui] = useState<any[]>([])
  const [prochainsRdv, setProchainsRdv] = useState<any[]>([])

  const { apps: storeApps } = useStoreApps()
  const shortcutAppIds = userProfile?.accueilShortcuts ?? []
  const shortcutApps = storeApps.filter(app => shortcutAppIds.includes(app.id) && !!app.route)
  const [allStoreSubs, setAllStoreSubs] = useState<any[]>([])
  const [pendingEcheances, setPendingEcheances] = useState<{ devis: any; echeance: any; index: number; daysLeft: number | null }[]>([])
  const [seanceAccessAlerts, setSeanceAccessAlerts] = useState<{ client: any; type: 'to_configure' | 'expiring_soon' | 'expired' | 'to_restore' }[]>([])
  const [loading, setLoading] = useState(true)

  // Souscriptions boutique (admin uniquement → évite l'erreur de permission côté utilisateur)
  useEffect(() => {
    if (!currentUser || !isAdmin) return
    const unsub = listenStoreSubscriptions(setAllStoreSubs)
    return unsub
  }, [currentUser, isAdmin])

  useEffect(() => {
    if (!currentUser) return
    fetchStats()
    checkAndCreateNotifications()
  }, [currentUser])

  useEffect(() => {
    if (!currentUser || !isAdmin) return
    getDocs(query(
      collection(db, 'factures'),
      where('userId', '==', currentUser.uid),
      where('type', '==', 'devis'),
      where('status', '==', 'accepted'),
    )).then((snap) => {
      const pending: { devis: any; echeance: any; index: number; daysLeft: number | null }[] = []
      snap.docs.forEach((d) => {
        const devis = { id: d.id, ...d.data() as any }
        if (!devis.echeances || devis.echeances.length === 0) return
        const already = (devis.convertedToFactureIds ?? (devis.convertedToFactureId ? [devis.convertedToFactureId] : [])).length
        devis.echeances.slice(already).forEach((ech: any, i: number) => {
          const daysLeft = ech.date ? Math.round((ech.date.toMillis() - Date.now()) / 86400000) : null
          if (daysLeft === null || daysLeft <= 7) {
            pending.push({ devis, echeance: ech, index: already + i, daysLeft })
          }
        })
      })
      pending.sort((a, b) => (a.echeance.date?.toMillis() ?? 0) - (b.echeance.date?.toMillis() ?? 0))
      setPendingEcheances(pending)
    }).catch(() => {})
  }, [currentUser, isAdmin])

  // Alertes accès séances pour les clients avec abonnements inactifs
  useEffect(() => {
    if (!currentUser || !isAdmin) return
    ;(async () => {
      try {
        const now = Date.now()
        const in7days = now + 7 * 86400000
        // Charger tous les clients avec un linkedUserId (compte app)
        const clientsSnap = await getDocs(query(
          collection(db, 'clients'),
          where('userId', '==', currentUser.uid),
        ))
        const linkedClients = clientsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() as any }))
          .filter((c) => c.linkedUserId)
        if (linkedClients.length === 0) return

        // Abonnements par clientId
        const abosSnap = await getDocs(query(collection(db, 'abonnements'), where('userId', '==', currentUser.uid)))
        const abosByClient: Record<string, any[]> = {}
        abosSnap.docs.forEach((d) => {
          const a = d.data() as any
          if (!abosByClient[a.clientId]) abosByClient[a.clientId] = []
          abosByClient[a.clientId].push(a)
        })

        // Clients ayant au moins une vraie séance (collection seance, pas les simples RDV)
        const seancesSnap = await getDocs(query(collection(db, 'seance')))
        const userIdsWithSeances = new Set<string>()
        seancesSnap.docs.forEach((d) => {
          const uid = (d.data() as any).ref_users?.id
          if (uid) userIdsWithSeances.add(uid)
        })

        const alerts: { client: any; type: 'to_configure' | 'expiring_soon' | 'expired' | 'to_restore' }[] = []
        for (const client of linkedClients) {
          const hasSeances = userIdsWithSeances.has(client.linkedUserId)
          if (!hasSeances) continue // pas de séances en ligne → pas concerné par l'accès séances

          const abos = abosByClient[client.id] ?? []
          const hasActif = abos.some((a) => a.etat === 'Actif')
          const hasInactif = abos.some((a) => a.etat === 'Inactif')
          const expiry = client.seanceAccessExpiry?.toMillis?.() ?? null

          if (hasActif && expiry !== null) {
            // Abonnement redevenu actif mais une date butoire est encore configurée
            alerts.push({ client, type: 'to_restore' })
          } else if (!hasActif && hasInactif) {
            if (expiry === null) {
              alerts.push({ client, type: 'to_configure' })
            } else if (expiry < now) {
              alerts.push({ client, type: 'expired' })
            } else if (expiry <= in7days) {
              alerts.push({ client, type: 'expiring_soon' })
            }
          }
        }
        setSeanceAccessAlerts(alerts)
      } catch {}
    })()
  }, [currentUser, isAdmin])

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

    try {
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

    } catch {}

    setLoading(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bonjour'
    if (h < 18) return 'Bon après-midi'
    return 'Bonsoir'
  }

  // Rappels de paiement : souscriptions actives d'apps payantes dont l'échéance approche
  const nowMs = Date.now()
  const paymentAlerts = isAdmin
    ? allStoreSubs
        .filter((s) => s.statut === 'active')
        .map((s) => {
          const app = storeApps.find((a) => a.id === s.appId)
          if (!app || app.prix <= 0 || app.periodicite === 'unique') return null
          const baseMs = s.nextPaymentDate?.toMillis?.()
            ?? (s.dateDebut?.toMillis ? addPeriodMs(s.dateDebut.toMillis(), app.periodicite) : null)
          if (!baseMs) return null
          const daysLeft = Math.round((baseMs - nowMs) / 86400000)
          if (daysLeft > 7) return null
          return { sub: s, app, dueMs: baseMs, daysLeft }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.dueMs - b.dueMs) as { sub: any; app: any; dueMs: number; daysLeft: number }[]
    : []

  const validatePayment = async (alert: { sub: any; app: any; dueMs: number }) => {
    const next = addPeriodMs(alert.dueMs, alert.app.periodicite)
    await updateStoreSubscription(alert.sub.id, {
      nextPaymentDate: Timestamp.fromMillis(next),
      lastPaymentAt: Timestamp.now(),
    })
  }

  const facturerSub = (alert: { sub: any; app: any }) => {
    const params = new URLSearchParams()
    if (alert.sub.clientId) params.set('clientId', alert.sub.clientId)
    params.set('label', alert.app.nom)
    params.set('prix', String(alert.app.prix))
    router.push(`/facturation/create?${params.toString()}`)
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
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      {/* Raccourcis boutique */}
      {shortcutApps.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">Mes raccourcis</h2>
          <div className="grid grid-cols-3 gap-3">
            {shortcutApps.map(app => (
              <button
                key={app.id}
                onClick={() => router.push(app.route!)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:shadow-md transition"
              >
                <div
                  className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center text-xl"
                  style={{ backgroundColor: app.couleur + '20' }}
                >
                  {(app as any).iconUrl ? <img src={(app as any).iconUrl} alt="" className="w-full h-full object-cover" /> : app.icon}
                </div>
                <span className="text-xs font-medium text-gray-700 text-center leading-tight">{app.nom}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* RAPPELS DE PAIEMENT BOUTIQUE — admin uniquement */}
      {isAdmin && paymentAlerts.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-500">💳</span>
            <p className="text-sm font-semibold text-purple-800">
              {paymentAlerts.length} paiement{paymentAlerts.length > 1 ? 's' : ''} boutique à valider
            </p>
          </div>
          <div className="space-y-1.5">
            {paymentAlerts.map((a) => {
              const overdue = a.daysLeft < 0
              const tag = overdue ? `en retard de ${-a.daysLeft}j` : a.daysLeft === 0 ? "aujourd'hui" : `dans ${a.daysLeft}j`
              return (
                <div key={a.sub.id} className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-lg bg-white/60 border border-purple-100">
                  <span className="text-gray-700 truncate min-w-0">
                    <span className="font-medium">{a.sub.clientNom || '—'}</span>
                    <span className="text-gray-400 mx-1">·</span>{a.app.nom}
                    <span className="text-gray-400 mx-1">·</span>{a.app.prix} €
                    <span className={`ml-1 ${overdue ? 'text-red-600' : 'text-purple-600'}`}>· {tag}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button onClick={() => facturerSub(a)} className="text-blue-600 hover:underline">Facturer</button>
                    <button onClick={() => validatePayment(a)} className="text-green-600 hover:underline">Payé ✓</button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ALERTE ÉCHÉANCES À ÉMETTRE — admin uniquement */}
      {isAdmin && pendingEcheances.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-500">⚠</span>
            <p className="text-sm font-semibold text-orange-800">
              {pendingEcheances.length} facture{pendingEcheances.length > 1 ? 's' : ''} à émettre (échéancier)
            </p>
          </div>
          <div className="space-y-1.5">
            {pendingEcheances.map(({ devis, echeance, index, daysLeft }) => {
              const label = echeance.label || `Règlement ${index + 1}/${devis.echeances.length}`
              const dateStr = echeance.date
                ? echeance.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                : '—'
              const tag = daysLeft === null ? '' : daysLeft < 0 ? ` · en retard de ${-daysLeft}j` : daysLeft === 0 ? ' · aujourd\'hui' : ` · dans ${daysLeft}j`
              return (
                <div key={`${devis.id}-${index}`}
                  onClick={() => router.push('/facturation?tab=devis')}
                  className="flex items-center justify-between gap-2 text-xs py-1.5 px-2 rounded-lg bg-white/60 border border-orange-100 cursor-pointer hover:bg-white transition">
                  <span className="text-gray-700 truncate">
                    <span className="font-medium">{devis.clientName || '—'}</span>
                    <span className="text-gray-400 mx-1">·</span>{label}
                    <span className="text-gray-400 mx-1">·</span>{dateStr}
                    {tag && <span className="text-orange-600">{tag}</span>}
                  </span>
                  <span className="text-blue-600 shrink-0 hover:underline">Facturation →</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ALERTES ACCÈS SÉANCES — admin uniquement */}
      {isAdmin && seanceAccessAlerts.length > 0 && (
        <div className="space-y-2">
          {seanceAccessAlerts.map(({ client, type }) => {
            const name = `${(client.nom ?? '').toUpperCase()} ${client.prenom ?? ''}`.trim()
            const expiry = client.seanceAccessExpiry?.toDate?.()?.toLocaleDateString('fr-FR') ?? null
            const set3months = async () => {
              const d = new Date(); d.setMonth(d.getMonth() + 3)
              await updateDoc(doc(db, 'clients', client.id), { seanceAccessExpiry: Timestamp.fromDate(d) })
              setSeanceAccessAlerts((prev) => prev.map((a) => a.client.id === client.id ? { ...a, client: { ...a.client, seanceAccessExpiry: Timestamp.fromDate(d) }, type: 'expiring_soon' as const } : a))
            }
            const clearExpiry = async () => {
              await updateDoc(doc(db, 'clients', client.id), { seanceAccessExpiry: null })
              setSeanceAccessAlerts((prev) => prev.filter((a) => a.client.id !== client.id))
            }

            if (type === 'to_configure') return (
              <div key={client.id} className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-blue-500 text-sm shrink-0">⏱</span>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">{name} — Accès séances à configurer</p>
                    <p className="text-xs text-blue-600">Abonnement inactif · aucune date butoire définie</p>
                  </div>
                </div>
                <button onClick={set3months} className="shrink-0 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap">
                  Définir 3 mois
                </button>
              </div>
            )
            if (type === 'expiring_soon') return (
              <div key={client.id} className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-orange-500 text-sm shrink-0">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-orange-800">{name} — Accès séances expire bientôt</p>
                    <p className="text-xs text-orange-600">Date butoire : {expiry}</p>
                  </div>
                </div>
                <button onClick={clearExpiry} className="shrink-0 text-xs border border-orange-300 text-orange-700 hover:bg-orange-100 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap">
                  Rétablir
                </button>
              </div>
            )
            if (type === 'expired') return (
              <div key={client.id} className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-sm shrink-0">🔒</span>
                  <div>
                    <p className="text-sm font-semibold text-red-800">{name} — Accès séances expiré</p>
                    <p className="text-xs text-red-600">Expiration : {expiry} · l'accès est automatiquement bloqué</p>
                  </div>
                </div>
                <button onClick={clearExpiry} className="shrink-0 text-xs border border-red-300 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap">
                  Rétablir l'accès
                </button>
              </div>
            )
            if (type === 'to_restore') return (
              <div key={client.id} className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <div className="flex items-start gap-2">
                  <span className="text-green-500 text-sm shrink-0">✅</span>
                  <div>
                    <p className="text-sm font-semibold text-green-800">{name} — Abonnement redevenu actif</p>
                    <p className="text-xs text-green-600">Une date butoire est encore configurée ({expiry}) · pensez à la supprimer</p>
                  </div>
                </div>
                <button onClick={clearExpiry} className="shrink-0 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap">
                  Rétablir l'accès
                </button>
              </div>
            )
            return null
          })}
        </div>
      )}

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
        // Boutique excluded from grid for non-admin (it's in their bottom bar), but kept for admin (bottom bar hides it via nonAdminOnly)
        const mobileBarHrefs = isAdmin
          ? ['/accueil', '/planning', '/notifications', '/messagerie', '/clients', '/profil']
          : ['/accueil', '/planning', '/notifications', '/messagerie', '/boutique', '/clients', '/profil']
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