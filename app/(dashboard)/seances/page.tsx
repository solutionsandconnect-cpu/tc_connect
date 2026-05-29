'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useSeances } from '@/hooks/useSeances'
import { useUsers } from '@/hooks/useUsers'
import {
  ClipboardDocumentListIcon, ChevronDownIcon, ChevronUpIcon, ChevronRightIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'

interface PlanningInfo {
  id: string
  date_planning?: any
  type_planning?: string
  ref_client?: any
}

export default function SeancesPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { seances, loading } = useSeances()
  const { users } = useUsers()

  const [planningInfos, setPlanningInfos] = useState<Record<string, PlanningInfo>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [filterEtat, setFilterEtat] = useState<'tous' | 'en_cours' | 'termines'>('tous')
  const [filterClient, setFilterClient] = useState('')
  const [filterDate, setFilterDate] = useState<'tous' | 'avenir' | 'mois' | 'passe'>('tous')

  // Fetch planning metadata for each unique ref_planning
  useEffect(() => {
    const uniqueIds = [
      ...new Set(
        seances.map((s: any) => s.ref_planning?.id).filter(Boolean) as string[]
      ),
    ]
    const toFetch = uniqueIds.filter(id => !(id in planningInfos))
    if (toFetch.length === 0) return

    Promise.all(
      toFetch.map(async id => {
        try {
          const snap = await getDoc(doc(db, 'planning_pro', id))
          if (snap.exists()) return { id: snap.id, ...snap.data() } as PlanningInfo
        } catch {}
        return { id } as PlanningInfo
      })
    ).then(results => {
      setPlanningInfos(prev => {
        const next = { ...prev }
        results.forEach(p => { if (p) next[p.id] = p })
        return next
      })
    })
  }, [seances])

  // Group seances by ref_planning.id
  const { groups, standalone } = useMemo(() => {
    const byPlanning: Record<string, any[]> = {}
    const standalone: any[] = []

    seances.forEach(s => {
      const pId = (s as any).ref_planning?.id
      if (pId) {
        if (!byPlanning[pId]) byPlanning[pId] = []
        byPlanning[pId].push(s)
      } else {
        standalone.push(s)
      }
    })

    Object.values(byPlanning).forEach(g =>
      g.sort((a, b) => (a.num_circuit ?? 0) - (b.num_circuit ?? 0))
    )

    const groups = Object.entries(byPlanning).sort(([aId], [bId]) => {
      const aS = planningInfos[aId]?.date_planning?.seconds ?? 0
      const bS = planningInfos[bId]?.date_planning?.seconds ?? 0
      return bS - aS
    })

    return { groups, standalone }
  }, [seances, planningInfos])

  const getClient = (refClient: any) => {
    const clientId = typeof refClient === 'string' ? refClient : refClient?.id
    if (!clientId) return null
    return users.find(u => u.id === clientId) ?? null
  }

  const getClientName = (refClient: any) => {
    const u = getClient(refClient)
    return u ? [u.nom, u.prenom].filter(Boolean).join(" ") : null
  }

  const formatDate = (ts: any) => {
    const d = ts?.toDate?.()
    if (!d) return '—'
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  }

  const isGroupTermine = (circuits: any[]) => circuits.every(c => (c.avancement_circuit ?? 0) >= 1)

  const clientOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { id: string; name: string }[] = []
    Object.values(planningInfos).forEach(info => {
      const cId = typeof info.ref_client === 'string' ? info.ref_client : (info.ref_client as any)?.id
      if (cId && !seen.has(cId)) {
        seen.add(cId)
        const u = users.find(u => u.id === cId)
        if (u) opts.push({ id: cId, name: [u.nom, u.prenom].filter(Boolean).join(" ") })
      }
    })
    return opts.sort((a, b) => a.name.localeCompare(b.name))
  }, [planningInfos, users])

  const matchesDateFilter = (info: PlanningInfo | undefined) => {
    if (filterDate === 'tous') return true
    const d = info?.date_planning?.toDate?.()
    if (!d) return true
    const now = new Date(); now.setHours(0, 0, 0, 0)
    if (filterDate === 'avenir') return d >= now
    if (filterDate === 'passe') return d < now
    if (filterDate === 'mois') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    return true
  }

  const matchesSearch = (s: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.type_seance?.toLowerCase().includes(q) || s.partie_seance?.toLowerCase().includes(q)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Séances</h1>
      </div>

      <input
        type="text"
        placeholder="Rechercher..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* État chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {(['tous', 'en_cours', 'termines'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterEtat(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              filterEtat === f
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'tous' ? 'Tous' : f === 'en_cours' ? 'En cours' : 'Terminés'}
          </button>
        ))}
      </div>

      {/* Date chips */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {(['tous', 'avenir', 'mois', 'passe'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterDate(f)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              filterDate === f
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f === 'tous' ? 'Toutes dates' : f === 'avenir' ? 'À venir' : f === 'mois' ? 'Ce mois' : 'Passées'}
          </button>
        ))}
      </div>

      {/* Client filter */}
      {clientOptions.length > 1 && (
        <select
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Tous les clients</option>
          {clientOptions.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : seances.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ClipboardDocumentListIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune séance</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Grouped by planning */}
          {groups.map(([planningId, circuits]) => {
            const info = planningInfos[planningId]
            const isOpen = expanded[planningId] === true
            const clientObj = getClient(info?.ref_client)
            const clientName = clientObj ? [clientObj.nom, clientObj.prenom].filter(Boolean).join(" ") : null
            const filtered = circuits.filter(matchesSearch)
            if (filtered.length === 0 && search) return null
            if (filterEtat === 'termines' && !isGroupTermine(circuits)) return null
            if (filterEtat === 'en_cours' && isGroupTermine(circuits)) return null
            if (filterClient) {
              const cId = typeof info?.ref_client === 'string' ? info.ref_client : (info?.ref_client as any)?.id
              if (cId !== filterClient) return null
            }
            if (!matchesDateFilter(info)) return null

            return (
              <div key={planningId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

                {/* Planning group header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpanded(e => ({ ...e, [planningId]: !isOpen }))}
                  onKeyDown={(e) => e.key === 'Enter' && setExpanded(prev => ({ ...prev, [planningId]: !isOpen }))}
                  className="w-full flex items-center justify-between p-4 text-left cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 capitalize">
                        {formatDate(info?.date_planning)}
                      </span>
                      {info?.type_planning && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          {info.type_planning}
                        </span>
                      )}
                    </div>
                    {clientName && (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {clientObj?.photo_url ? (
                          <img src={clientObj.photo_url} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-[9px] shrink-0">
                            {(clientObj?.prenom?.[0] ?? clientName[0] ?? '').toUpperCase()}
                          </div>
                        )}
                        <p className="text-xs text-gray-500">{clientName}</p>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">{circuits.length} circuit(s)</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/planning/${planningId}`) }}
                      className="text-xs text-blue-600 border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                    >
                      RDV
                    </button>
                    {isOpen
                      ? <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                      : <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>

                {isOpen && (
                  <div>
                    <div className="border-t border-gray-50 divide-y divide-gray-50">
                      {(search ? filtered : circuits).map(seance => (
                        <div
                          key={seance.id}
                          onClick={() => router.push(`/seances/${seance.id}?planningId=${planningId}`)}
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {seance.num_circuit != null && (
                                <span className="text-xs font-bold text-gray-400 w-5 shrink-0">C{seance.num_circuit}</span>
                              )}
                              <span className="text-sm font-semibold text-gray-800">{seance.type_seance}</span>
                              {(seance.avancement_circuit ?? 0) >= 1 && (
                                <span className="text-xs text-green-600 font-medium">✓</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 pl-7">
                              {seance.partie_seance} · {seance.nb_tours} tour(s) · Récup {seance.recup_tours}s
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                            {isAdmin && (
                              <button
                                onClick={() => router.push(`/seances/${seance.id}?planningId=${planningId}`)}
                                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition"
                              >
                                <PencilIcon className="w-3 h-3" />Modifier
                              </button>
                            )}
                            <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="px-4 py-3 border-t border-gray-50">
                      <button
                        onClick={() => router.push(`/seances/apercu/${planningId}`)}
                        className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                      >
                        ▶ Voir / Lancer la séance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Circuits sans RDV */}
          {standalone.filter(matchesSearch).length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpanded(e => ({ ...e, __standalone: !(e.__standalone !== false) }))}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-700">Circuits sans RDV</p>
                  <p className="text-xs text-gray-400">{standalone.length} circuit(s)</p>
                </div>
                {expanded.__standalone === false
                  ? <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                  : <ChevronUpIcon className="w-4 h-4 text-gray-400" />
                }
              </button>

              {expanded.__standalone === true && (
                <div className="border-t border-gray-50 divide-y divide-gray-50">
                  {standalone.filter(matchesSearch).map(seance => (
                    <div
                      key={seance.id}
                      onClick={() => router.push(`/seances/${seance.id}`)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-800">{seance.type_seance}</p>
                        <p className="text-xs text-gray-500">{seance.partie_seance} · {seance.nb_tours} tour(s)</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        {isAdmin && (
                          <button
                            onClick={() => router.push(`/seances/${seance.id}`)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Modifier
                          </button>
                        )}
                        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
