'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, query, where, onSnapshot,
  doc, getDoc, updateDoc, DocumentReference, Timestamp,
  arrayUnion, arrayRemove,
} from 'firebase/firestore'
import {
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  ArchiveBoxArrowDownIcon,
  ArrowUturnLeftIcon,
  FunnelIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawDiscussion {
  id: string
  objet_message: string
  service?: string
  type_discussion?: string
  date_create: Timestamp
  date_last_message?: Timestamp
  // Ancien format
  user_create?: DocumentReference
  user_destinataire?: DocumentReference
  etat_message_expediteur?: boolean
  etat_message_destinataire?: boolean
  archive_expediteur?: boolean
  archive_destinataire?: boolean
  // Nouveau format
  participants_ids?: string[]
  non_lus_ids?: string[]
  archives_par?: string[]
}

interface ResolvedDiscussion extends RawDiscussion {
  displayName: string
  photoUrl?: string
  isGroupe: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUnread(d: RawDiscussion, uid: string, userRef: DocumentReference): boolean {
  // Nouveau format
  if (d.non_lus_ids !== undefined) {
    return d.non_lus_ids.includes(uid)
  }
  // Ancien format : créateur
  if (d.user_create?.id === uid) return d.etat_message_expediteur === false
  // Ancien format : destinataire
  if (d.user_destinataire?.id === uid) return d.etat_message_destinataire === false
  return false
}

function isArchived(d: RawDiscussion, uid: string): boolean {
  if (d.archives_par !== undefined) return d.archives_par.includes(uid)
  if (d.archive_expediteur !== undefined && d.user_create?.id === uid) return d.archive_expediteur
  if (d.archive_destinataire !== undefined && d.user_destinataire?.id === uid) return d.archive_destinataire
  return false
}

function formatRelativeDate(ts: Timestamp | undefined): string {
  if (!ts) return ''
  const date = ts.toDate()
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffCalDays = Math.round((todayStart.getTime() - dateStart.getTime()) / (1000 * 60 * 60 * 24))

  if (diffCalDays === 0) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffCalDays === 1) return 'Hier'
  if (diffCalDays < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' })
  }
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ─── Resolve display name ──────────────────────────────────────────────────────

function resolveName(data: any): string {
  return (data.prenom || data.nom)
    ? `${data.prenom ?? ''} ${data.nom ?? ''}`.trim()
    : (data.display_name || 'Utilisateur')
}

async function resolveDiscussion(
  d: RawDiscussion,
  uid: string,
): Promise<ResolvedDiscussion> {
  const isGroupe = !!(d.participants_ids && d.participants_ids.length > 2)

  // Nouveau format groupe
  if (d.participants_ids !== undefined) {
    if (isGroupe) {
      return { ...d, displayName: d.service || 'Groupe', isGroupe: true }
    }
    // Discussion directe avec 2 participants
    const otherId = d.participants_ids.find((id) => id !== uid)
    if (otherId) {
      for (const coll of ['usersapp', 'users'] as const) {
        try {
          const snap = await getDoc(doc(db, coll, otherId))
          if (snap.exists()) {
            const data = snap.data()
            return { ...d, displayName: resolveName(data), photoUrl: data.photo_url || undefined, isGroupe: false }
          }
        } catch {}
      }
    }
    return { ...d, displayName: 'Discussion', isGroupe: false }
  }

  // Ancien format 1-à-1
  const otherRef = d.user_create?.id === uid ? d.user_destinataire : d.user_create
  if (otherRef) {
    try {
      const snap = await getDoc(otherRef)
      if (snap.exists()) {
        const data = snap.data()
        return { ...d, displayName: resolveName(data), photoUrl: data.photo_url || undefined, isGroupe: false }
      }
    } catch {}
  }
  return { ...d, displayName: d.objet_message || 'Discussion', isGroupe: false }
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({
  discussion,
  unread,
}: {
  discussion: ResolvedDiscussion
  unread: boolean
}) {
  return (
    <div className="relative shrink-0">
      {discussion.isGroupe ? (
        <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center">
          <UserGroupIcon className="w-6 h-6 text-blue-500" />
        </div>
      ) : discussion.photoUrl ? (
        <img
          src={discussion.photoUrl}
          alt=""
          className="w-11 h-11 rounded-full object-cover border border-gray-200"
        />
      ) : (
        <div className="w-11 h-11 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold">
          {discussion.displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      {unread && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'toutes' | 'nonlues' | 'archivees'

export default function MessageriePage() {
  const router = useRouter()
  const { currentUser, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [discussions, setDiscussions] = useState<ResolvedDiscussion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('toutes')

  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null)

  // Admin participant filter
  const [participantOptions, setParticipantOptions] = useState<{ id: string; name: string }[]>([])
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [showParticipantFilter, setShowParticipantFilter] = useState(false)
  const participantFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!currentUser) return

    const uid = currentUser.uid
    const userRef = doc(db, 'usersapp', uid)

    // Map globale pour merger les 3 listeners
    const rawMap = new Map<string, RawDiscussion>()
    const initialized = { u1: false, u2: false, u3: false }
    let timeoutId: ReturnType<typeof setTimeout>

    const sort = (arr: ResolvedDiscussion[]) =>
      [...arr].sort((a, b) => {
        const ta = (a.date_last_message ?? a.date_create)?.toMillis() ?? 0
        const tb = (b.date_last_message ?? b.date_create)?.toMillis() ?? 0
        return tb - ta
      })

    const applyMap = async () => {
      const all = Array.from(rawMap.values())
      // Show immediately with objet_message as placeholder (no async)
      const quick: ResolvedDiscussion[] = all.map((d) => ({
        ...d,
        displayName: d.service || d.objet_message || 'Discussion',
        isGroupe: !!(d.participants_ids && d.participants_ids.length > 2),
        photoUrl: undefined,
      }))
      setDiscussions(sort(quick))
      setLoading(false)
      // Resolve real names in background
      const resolved = await Promise.all(all.map((d) => resolveDiscussion(d, uid)))
      setDiscussions(sort(resolved))
    }

    const checkInit = () => {
      if (initialized.u1 && initialized.u2 && initialized.u3) {
        clearTimeout(timeoutId)
        applyMap()
      }
    }

    // Listener 1 : user_create
    const qCreate = query(
      collection(db, 'messagerie'),
      where('user_create', '==', userRef)
    )
    const unsub1 = onSnapshot(qCreate, (snap) => {
      snap.docs.forEach((d) => rawMap.set(d.id, { id: d.id, ...d.data() } as RawDiscussion))
      initialized.u1 = true
      checkInit()
      if (initialized.u2 && initialized.u3) applyMap()
    }, () => { initialized.u1 = true; checkInit() })

    // Listener 2 : user_destinataire
    const qDest = query(
      collection(db, 'messagerie'),
      where('user_destinataire', '==', userRef)
    )
    const unsub2 = onSnapshot(qDest, (snap) => {
      snap.docs.forEach((d) => rawMap.set(d.id, { id: d.id, ...d.data() } as RawDiscussion))
      initialized.u2 = true
      checkInit()
      if (initialized.u1 && initialized.u3) applyMap()
    }, () => { initialized.u2 = true; checkInit() })

    // Listener 3 : participants_ids
    const qParticipants = query(
      collection(db, 'messagerie'),
      where('participants_ids', 'array-contains', uid)
    )
    const unsub3 = onSnapshot(qParticipants, (snap) => {
      snap.docs.forEach((d) => rawMap.set(d.id, { id: d.id, ...d.data() } as RawDiscussion))
      initialized.u3 = true
      checkInit()
      if (initialized.u1 && initialized.u2) applyMap()
    }, () => { initialized.u3 = true; checkInit() })

    // Fallback 5s
    timeoutId = setTimeout(() => {
      initialized.u1 = true
      initialized.u2 = true
      initialized.u3 = true
      applyMap()
    }, 5000)

    return () => {
      unsub1()
      unsub2()
      unsub3()
      clearTimeout(timeoutId)
    }
  }, [currentUser])

  // Resolve participant names for admin filter
  useEffect(() => {
    if (!isAdmin || !currentUser || discussions.length === 0) return
    const uid = currentUser.uid
    const allIds = new Set<string>()
    discussions.forEach((d) => {
      d.participants_ids?.forEach((id) => { if (id !== uid) allIds.add(id) })
      if (d.user_create?.id && d.user_create.id !== uid) allIds.add(d.user_create.id)
      if (d.user_destinataire?.id && d.user_destinataire.id !== uid) allIds.add(d.user_destinataire.id)
    })
    Promise.all(Array.from(allIds).map(async (id) => {
      for (const coll of ['users', 'usersapp'] as const) {
        try {
          const snap = await getDoc(doc(db, coll, id))
          if (snap.exists()) {
            const data = snap.data()
            const name = (data.prenom || data.nom)
              ? `${data.prenom ?? ''} ${data.nom ?? ''}`.trim()
              : (data.display_name || id)
            return { id, name }
          }
        } catch {}
      }
      return { id, name: id }
    })).then((opts) => {
      setParticipantOptions(opts.sort((a, b) => a.name.localeCompare(b.name, 'fr')))
    })
  }, [discussions, isAdmin, currentUser])

  // Close participant filter on outside click
  useEffect(() => {
    if (!showParticipantFilter) return
    const handler = (e: MouseEvent) => {
      if (participantFilterRef.current && !participantFilterRef.current.contains(e.target as Node)) {
        setShowParticipantFilter(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showParticipantFilter])

  const toggleArchive = async (d: ResolvedDiscussion) => {
    if (!currentUser) return
    const uid = currentUser.uid
    const archived = isArchived(d, uid)
    try {
      await updateDoc(doc(db, 'messagerie', d.id), {
        archives_par: archived ? arrayRemove(uid) : arrayUnion(uid),
      })
    } catch {}
  }

  if (!currentUser) return null

  const uid = currentUser.uid
  const userRef = doc(db, 'usersapp', uid)

  const nonLuesCount = discussions.filter((d) => isUnread(d, uid, userRef)).length
  const archiveesCount = discussions.filter((d) => isArchived(d, uid)).length

  const filtered = discussions.filter((d) => {
    const unread = isUnread(d, uid, userRef)
    const archived = isArchived(d, uid)

    if (activeTab === 'nonlues' && !unread) return false
    if (activeTab === 'archivees' && !archived) return false
    if (activeTab === 'toutes' && archived) return false

    if (isAdmin && selectedParticipants.length > 0) {
      const inDisc = selectedParticipants.some((id) =>
        d.participants_ids?.includes(id) ||
        d.user_create?.id === id ||
        d.user_destinataire?.id === id
      )
      if (!inDisc) return false
    }

    if (search.trim()) {
      const s = search.toLowerCase()
      return (
        d.objet_message?.toLowerCase().includes(s) ||
        d.displayName?.toLowerCase().includes(s) ||
        d.service?.toLowerCase().includes(s)
      )
    }
    return true
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'toutes', label: 'Toutes', count: discussions.filter((d) => !isArchived(d, uid)).length },
    { key: 'nonlues', label: 'Non lues', count: nonLuesCount },
    { key: 'archivees', label: 'Archivées', count: archiveesCount },
  ]

  return (
    <div className="pb-nav-safe">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Messagerie</h1>
          {nonLuesCount > 0 && (
            <p className="text-sm text-blue-600 mt-0.5">{nonLuesCount} non lue{nonLuesCount > 1 ? 's' : ''}</p>
          )}
        </div>
        <button
          onClick={() => router.push('/messagerie/nouveau')}
          className="flex items-center gap-2 bg-blue-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition"
        >
          <PlusIcon className="w-4 h-4" />
          Nouveau
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-3">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une discussion…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-400"
        />
      </div>

      {/* Filtre par client (admin uniquement) */}
      {isAdmin && participantOptions.length > 0 && (
        <div className="relative mb-3" ref={participantFilterRef}>
          <button
            onClick={() => setShowParticipantFilter((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
              selectedParticipants.length > 0
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <FunnelIcon className="w-3.5 h-3.5" />
            {selectedParticipants.length > 0
              ? `${selectedParticipants.length} client${selectedParticipants.length > 1 ? 's' : ''} sélectionné${selectedParticipants.length > 1 ? 's' : ''}`
              : 'Filtrer par client'}
          </button>
          {showParticipantFilter && (
            <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-2xl shadow-xl w-64 max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700">Filtrer par client</p>
                {selectedParticipants.length > 0 && (
                  <button
                    onClick={() => setSelectedParticipants([])}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Effacer
                  </button>
                )}
              </div>
              {participantOptions.map((opt) => {
                const selected = selectedParticipants.includes(opt.id)
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      setSelectedParticipants((prev) =>
                        selected ? prev.filter((id) => id !== opt.id) : [...prev, opt.id]
                      )
                    }
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-gray-50 transition ${selected ? 'text-blue-700 font-medium' : 'text-gray-700'}`}
                  >
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                      {selected && <XMarkIcon className="w-3 h-3 text-white" />}
                    </span>
                    {opt.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Filtres chips */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition ${
              activeTab === tab.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                activeTab === tab.key && tab.key === 'nonlues'
                  ? 'bg-red-500 text-white'
                  : activeTab === tab.key
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
          <ChatBubbleLeftRightIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {activeTab === 'nonlues'
              ? 'Aucune discussion non lue'
              : activeTab === 'archivees'
              ? 'Aucune discussion archivée'
              : search
              ? 'Aucun résultat'
              : 'Aucune discussion'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((d) => {
            const unread = isUnread(d, uid, userRef)
            const archived = isArchived(d, uid)
            const ts = d.date_last_message ?? d.date_create
            return (
              <div
                key={d.id}
                onClick={() => router.push(`/messagerie/${d.id}`)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border shadow-sm text-left transition hover:shadow-md cursor-pointer ${
                  unread
                    ? 'bg-blue-50 border-blue-100'
                    : 'bg-white border-gray-100'
                }`}
              >
                <Avatar discussion={d} unread={unread} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`text-sm truncate ${unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                      {d.displayName}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{formatRelativeDate(ts)}</span>
                  </div>
                  <p className={`text-xs truncate ${unread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                    {d.objet_message}
                  </p>
                </div>
                {unread && (
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); archived ? toggleArchive(d) : setConfirmArchiveId(d.id) }}
                  title={archived ? 'Désarchiver' : 'Archiver'}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition shrink-0"
                >
                  {archived
                    ? <ArrowUturnLeftIcon className="w-4 h-4" />
                    : <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                  }
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Confirmation archivage */}
      {confirmArchiveId && (() => {
        const d = discussions.find((x) => x.id === confirmArchiveId)
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
              <div>
                <p className="text-base font-semibold text-gray-800">Archiver cette discussion ?</p>
                {d && <p className="text-sm text-gray-500 mt-1 truncate">{d.displayName}</p>}
              </div>
              <p className="text-sm text-gray-600">La discussion sera masquée de la liste principale. Vous pourrez la retrouver dans l'onglet Archivées.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmArchiveId(null)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm hover:bg-gray-50 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={() => { if (d) toggleArchive(d); setConfirmArchiveId(null) }}
                  className="flex-1 bg-gray-700 text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition"
                >
                  Archiver
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
