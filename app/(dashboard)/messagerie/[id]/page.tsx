'use client'

import { use, useState, useEffect, useRef, useCallback, useMemo, CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db, storage } from '@/lib/firebase'
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  doc, getDoc, getDocs, serverTimestamp, DocumentReference,
  Timestamp, arrayRemove, arrayUnion,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  ArrowLeftIcon, PaperAirplaneIcon, UserGroupIcon,
  PaperClipIcon, XMarkIcon, DocumentIcon, MagnifyingGlassIcon,
  UserPlusIcon, PhotoIcon, ArrowDownTrayIcon,
  ChevronLeftIcon, ChevronRightIcon, InformationCircleIcon,
} from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawMessage {
  id: string
  ref_user: DocumentReference
  message_text: string
  date_create: Timestamp | null
  edited?: boolean
  document_image_list?: string[]
  document_pdf_list?: string[]
  document_video_list?: string[]
}

interface ResolvedMessage extends RawMessage {
  authorName: string
  authorPhoto?: string
}

interface Discussion {
  id: string
  objet_message?: string
  participants_ids?: string[]
  non_lus_ids?: string[]
  user_create?: DocumentReference
  user_destinataire?: DocumentReference
  etat_message_expediteur?: boolean
  etat_message_destinataire?: boolean
  archives_par?: string[]
  read_by?: Record<string, Timestamp>
}

interface UserInfo {
  uid: string
  name: string
  photo?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(ts: Timestamp | null): string {
  if (!ts) return ''
  return ts.toDate().toLocaleString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function formatReadAt(ts: Timestamp): string {
  const d = ts.toDate()
  const isToday = d.toDateString() === new Date().toDateString()
  if (isToday) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fileEmoji(file: File) {
  if (file.type.startsWith('image/')) return '🖼️'
  if (file.type.startsWith('video/')) return '🎥'
  return '📄'
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ m, isMe, onImageClick, canEdit, onEdit, readBy, participants, myUid }: {
  m: ResolvedMessage
  isMe: boolean
  onImageClick: (url: string) => void
  canEdit?: boolean
  onEdit?: (m: ResolvedMessage) => void
  readBy?: Record<string, Timestamp>
  participants?: UserInfo[]
  myUid?: string
}) {
  const [showReadInfo, setShowReadInfo] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const images = m.document_image_list?.filter(Boolean) ?? []
  const videos = m.document_video_list?.filter(Boolean) ?? []
  const pdfs = m.document_pdf_list?.filter(Boolean) ?? []
  const initials = m.authorName.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  // Participants (hors moi) qui ont lu ce message : leur readAt >= date_create du message
  const readers = useMemo(() => {
    if (!isMe || !readBy || !participants || !m.date_create) return []
    return participants
      .filter((p) => {
        if (p.uid === myUid) return false
        const readAt = readBy[p.uid]
        if (!readAt) return false
        return readAt.toMillis() >= m.date_create!.toMillis()
      })
      .map((p) => ({ ...p, readAt: readBy[p.uid] }))
  }, [isMe, readBy, participants, m.date_create, myUid])

  // Fermeture du popover au clic extérieur
  useEffect(() => {
    if (!showReadInfo) return
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setShowReadInfo(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReadInfo])

  const handleInfoClick = () => {
    if (showReadInfo) { setShowReadInfo(false); return }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const approxHeight = readers.length * 44 + 48
      const showAbove = rect.top > approxHeight + 16
      const style: CSSProperties = {
        position: 'fixed',
        zIndex: 200,
        right: `${Math.max(8, window.innerWidth - rect.right)}px`,
        ...(showAbove
          ? { bottom: `${window.innerHeight - rect.top + 6}px` }
          : { top: `${rect.bottom + 6}px` }),
      }
      setPopoverStyle(style)
    }
    setShowReadInfo(true)
  }

  return (
    <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      {!isMe && (
        <div className="shrink-0 w-7 h-7 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center self-end mb-5">
          {m.authorPhoto
            ? <img src={m.authorPhoto} alt="" className="w-full h-full object-cover" />
            : <span className="text-[10px] font-bold text-blue-600">{initials}</span>}
        </div>
      )}
      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
        {!isMe && <span className="text-xs text-gray-500 mb-1 ml-1">{m.authorName}</span>}
        <div className="space-y-1.5">
        {images.map((url, i) => (
          <button key={i} type="button" onClick={() => onImageClick(url)} className="block hover:opacity-90 transition">
            <img src={url} alt="" className="rounded-2xl max-w-full max-h-56 object-cover" />
          </button>
        ))}
        {videos.map((url, i) => (
          <video key={i} src={url} controls className="rounded-2xl max-w-full max-h-56" />
        ))}
        {pdfs.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 px-3 py-2 rounded-2xl text-sm border ${isMe ? 'bg-blue-500 text-white border-blue-400' : 'bg-white text-gray-700 border-gray-200 shadow-sm'}`}>
            <DocumentIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">Document PDF</span>
          </a>
        ))}
        {m.message_text ? (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isMe
              ? 'bg-blue-600 text-white rounded-br-sm'
              : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm shadow-sm'
          }`}>
            {m.message_text}{m.edited ? <span className={`ml-1.5 text-[10px] ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>(modifié)</span> : null}
          </div>
        ) : null}
        </div>
        <div className="flex items-center gap-2 mt-1 mx-1">
          <span className="text-[10px] text-gray-400">{formatDateTime(m.date_create)}</span>
          {isMe && canEdit && !m.edited && !!m.message_text && onEdit && (
            <button onClick={() => onEdit(m)} className="text-[10px] text-gray-400 hover:text-blue-500 transition">
              Modifier
            </button>
          )}
          {/* Indicateur de lecture — avatars visibles + bouton détail */}
          {isMe && readers.length > 0 && (
            <div className="flex items-center gap-1">
              {/* Mini-avatars visibles sans clic */}
              <div className="flex -space-x-1.5">
                {readers.slice(0, 3).map((r) => (
                  <div key={r.uid} className="w-4 h-4 rounded-full ring-1 ring-white overflow-hidden bg-blue-100 flex items-center justify-center shrink-0">
                    {r.photo
                      ? <img src={r.photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-[7px] font-bold text-blue-600">{r.name.charAt(0).toUpperCase()}</span>}
                  </div>
                ))}
                {readers.length > 3 && (
                  <div className="w-4 h-4 rounded-full ring-1 ring-white bg-gray-200 flex items-center justify-center shrink-0">
                    <span className="text-[7px] font-bold text-gray-500">+{readers.length - 3}</span>
                  </div>
                )}
              </div>
              {/* Bouton info */}
              <button
                ref={buttonRef}
                onClick={handleInfoClick}
                className="text-blue-400 hover:text-blue-600 transition"
                title="Détails de lecture"
              >
                <InformationCircleIcon className="w-3.5 h-3.5" />
              </button>
              {/* Popover positionné en fixed pour ne jamais passer derrière le header */}
              {showReadInfo && popoverStyle && (
                <div ref={popoverRef} style={popoverStyle} className="bg-white rounded-xl shadow-xl border border-gray-100 p-3 min-w-[180px] max-w-[220px]">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Lu par</p>
                  <div className="space-y-2.5">
                    {readers.map((r) => (
                      <div key={r.uid} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-100 shrink-0 overflow-hidden flex items-center justify-center">
                          {r.photo
                            ? <img src={r.photo} alt="" className="w-full h-full object-cover" />
                            : <span className="text-[9px] font-bold text-blue-600">{r.name.charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate leading-tight">{r.name}</p>
                          <p className="text-[10px] text-gray-400 leading-tight">{r.readAt ? formatReadAt(r.readAt) : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function Lightbox({ urls, index, onClose, onNav }: {
  urls: string[]
  index: number
  onClose: () => void
  onNav: (i: number) => void
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onNav(Math.max(0, index - 1))
      if (e.key === 'ArrowRight') onNav(Math.min(urls.length - 1, index + 1))
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, onNav, index, urls.length])

  return (
    <div className="fixed inset-0 z-[100] bg-black/92 flex items-center justify-center" onClick={onClose}>
      <div className="relative flex items-center justify-center w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/30 rounded-full z-10 transition">
          <XMarkIcon className="w-6 h-6" />
        </button>
        {/* Download / open */}
        <a href={urls[index]} target="_blank" rel="noopener noreferrer" download
          className="absolute top-4 left-4 p-2 text-white/80 hover:text-white bg-black/30 rounded-full z-10 transition">
          <ArrowDownTrayIcon className="w-6 h-6" />
        </a>
        {/* Image */}
        <img src={urls[index]} alt="" className="max-w-[92vw] max-h-[88vh] object-contain rounded-xl select-none" />
        {/* Prev */}
        {urls.length > 1 && (
          <>
            <button onClick={() => onNav(Math.max(0, index - 1))} disabled={index === 0}
              className="absolute left-3 p-2.5 text-white bg-black/40 rounded-full hover:bg-black/60 transition disabled:opacity-20">
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <button onClick={() => onNav(Math.min(urls.length - 1, index + 1))} disabled={index === urls.length - 1}
              className="absolute right-3 p-2.5 text-white bg-black/40 rounded-full hover:bg-black/60 transition disabled:opacity-20">
              <ChevronRightIcon className="w-5 h-5" />
            </button>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full select-none">
              {index + 1} / {urls.length}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Media panel ──────────────────────────────────────────────────────────────

function MediaPanel({ messages, onClose, onImageClick }: {
  messages: ResolvedMessage[]
  onClose: () => void
  onImageClick: (urls: string[], index: number) => void
}) {
  const images = useMemo(() => messages.flatMap((m) => m.document_image_list?.filter(Boolean) ?? []), [messages])
  const videos = useMemo(() => messages.flatMap((m) => m.document_video_list?.filter(Boolean) ?? []), [messages])
  const pdfs = useMemo(() => messages.flatMap((m) => m.document_pdf_list?.filter(Boolean) ?? []), [messages])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">Médias partagés</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {images.length === 0 && videos.length === 0 && pdfs.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-12">Aucun média partagé</p>
          )}

          {images.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Photos · {images.length}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {images.map((url, i) => (
                  <button key={i} type="button" onClick={() => onImageClick(images, i)}
                    className="aspect-square rounded-xl overflow-hidden hover:opacity-85 transition">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Vidéos · {videos.length}
              </p>
              <div className="space-y-3">
                {videos.map((url, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-gray-100">
                    <video src={url} controls className="w-full max-h-52" />
                    <div className="flex justify-end px-3 py-2 bg-gray-50">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline font-medium">
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        Télécharger
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pdfs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Documents · {pdfs.length}
              </p>
              <div className="space-y-2">
                {pdfs.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition">
                    <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                      <DocumentIcon className="w-5 h-5 text-red-500" />
                    </div>
                    <span className="flex-1 text-sm text-gray-700">Document {i + 1}</span>
                    <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Participants modal ───────────────────────────────────────────────────────

function ParticipantsModal({
  participants,
  currentUid,
  discussionId,
  isNewFormat,
  isAdmin,
  onClose,
}: {
  participants: UserInfo[]
  currentUid: string
  discussionId: string
  isNewFormat: boolean
  isAdmin: boolean
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [allUsers, setAllUsers] = useState<UserInfo[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [busy, setBusy] = useState(false)

  const participantUids = new Set(participants.map((p) => p.uid))

  useEffect(() => {
    getDocs(collection(db, 'users'))
      .then((snap) => {
        setAllUsers(snap.docs.map((d) => {
          const data = d.data()
          return {
            uid: d.id,
            name: data.display_name || `${data.prenom ?? ''} ${data.nom ?? ''}`.trim() || 'Utilisateur',
            photo: data.photo_url || undefined,
          }
        }))
      })
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  const filtered = search.trim()
    ? allUsers.filter((u) =>
        !participantUids.has(u.uid) &&
        u.name.toLowerCase().includes(search.toLowerCase())
      )
    : []

  const addParticipant = async (user: UserInfo) => {
    if (busy || participantUids.has(user.uid)) return
    setBusy(true)
    try {
      await updateDoc(doc(db, 'messagerie', discussionId), {
        participants_ids: arrayUnion(user.uid),
      })
    } catch {}
    setBusy(false)
  }

  const removeParticipant = async (uid: string) => {
    if (uid === currentUid || busy) return
    setBusy(true)
    try {
      await updateDoc(doc(db, 'messagerie', discussionId), {
        participants_ids: arrayRemove(uid),
        non_lus_ids: arrayRemove(uid),
      })
    } catch {}
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[80dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">
            Participants ({participants.length})
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Current participants */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
              Dans cette discussion
            </p>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.uid} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0 overflow-hidden">
                    {p.photo
                      ? <img src={p.photo} alt="" className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-blue-600">{p.name.charAt(0).toUpperCase()}</span>}
                  </div>
                  <span className="flex-1 text-sm text-gray-800 min-w-0 truncate">
                    {p.name}{p.uid === currentUid ? ' (vous)' : ''}
                  </span>
                  {isNewFormat && isAdmin && p.uid !== currentUid && (
                    <button
                      onClick={() => removeParticipant(p.uid)}
                      disabled={busy}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition shrink-0">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add participants (admin only) */}
          {isNewFormat && isAdmin && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">
                Ajouter un participant
              </p>
              <div className="relative mb-3">
                <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400"
                />
              </div>
              {loadingUsers ? (
                <p className="text-xs text-gray-400 text-center py-3">Chargement...</p>
              ) : search.trim() && filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
              ) : (
                <div className="space-y-1 max-h-44 overflow-y-auto">
                  {filtered.map((u) => (
                    <button key={u.uid} onClick={() => addParticipant(u)} disabled={busy}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition text-left">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {u.photo
                          ? <img src={u.photo} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-bold text-gray-500">{u.name.charAt(0).toUpperCase()}</span>}
                      </div>
                      <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">{u.name}</span>
                      <UserPlusIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DiscussionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { currentUser, userProfile } = useAuth()

  const [discussion, setDiscussion] = useState<Discussion | null>(null)
  const [messages, setMessages] = useState<ResolvedMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [editingMsg, setEditingMsg] = useState<ResolvedMessage | null>(null)
  const [editText, setEditText] = useState('')
  const [loading, setLoading] = useState(true)

  const [participants, setParticipants] = useState<UserInfo[]>([])
  const [showParticipants, setShowParticipants] = useState(false)
  const [showMediaPanel, setShowMediaPanel] = useState(false)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)

  const allImages = useMemo(
    () => messages.flatMap((m) => m.document_image_list?.filter(Boolean) ?? []),
    [messages]
  )

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const authorCache = useRef<Map<string, { name: string; photo?: string }>>(new Map())
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resolveUid = useCallback(async (uid: string): Promise<{ name: string; photo?: string }> => {
    const cached = authorCache.current.get(uid)
    if (cached) return cached
    for (const coll of ['usersapp', 'users'] as const) {
      try {
        const snap = await getDoc(doc(db, coll, uid))
        if (snap.exists()) {
          const data = snap.data()
          const result = {
            name: (data.prenom || data.nom)
              ? `${data.prenom ?? ''} ${data.nom ?? ''}`.trim()
              : (data.display_name || 'Utilisateur'),
            photo: data.photo_url || undefined,
          }
          authorCache.current.set(uid, result)
          return result
        }
      } catch {}
    }
    return { name: 'Utilisateur' }
  }, [])

  const resolveAuthor = useCallback(
    async (ref: DocumentReference) => resolveUid(ref.id),
    [resolveUid]
  )

  const markAsRead = useCallback(async () => {
    if (!currentUser || !discussion) return
    const uid = currentUser.uid
    try {
      // Toujours enregistrer l'horodatage de lecture pour les accusés de réception
      const updates: Record<string, any> = { [`read_by.${uid}`]: serverTimestamp() }
      if (discussion.participants_ids !== undefined) {
        if (discussion.non_lus_ids?.includes(uid)) {
          updates.non_lus_ids = arrayRemove(uid)
        }
      } else {
        if (discussion.user_create?.id === uid && discussion.etat_message_expediteur === false) {
          updates.etat_message_expediteur = true
        } else if (discussion.user_destinataire?.id === uid && discussion.etat_message_destinataire === false) {
          updates.etat_message_destinataire = true
        }
      }
      await updateDoc(doc(db, 'messagerie', id), updates)
    } catch {}
  }, [currentUser, discussion, id])

  // Charger discussion
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'messagerie', id), (snap) => {
      if (snap.exists()) setDiscussion({ id: snap.id, ...snap.data() } as Discussion)
    })
    return unsub
  }, [id])

  // Résoudre participants
  const participantsKey = [
    discussion?.participants_ids?.join(','),
    discussion?.user_create?.id,
    discussion?.user_destinataire?.id,
  ].join('|')

  useEffect(() => {
    if (!discussion) return
    const uids: string[] = []
    if (discussion.participants_ids) {
      uids.push(...discussion.participants_ids)
    } else {
      if (discussion.user_create?.id) uids.push(discussion.user_create.id)
      if (discussion.user_destinataire?.id) uids.push(discussion.user_destinataire.id)
    }
    Promise.all(uids.map(async (u) => ({ uid: u, ...(await resolveUid(u)) }))).then(setParticipants)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantsKey, resolveUid])

  useEffect(() => {
    if (discussion) markAsRead()
  }, [discussion?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-redimensionnement du champ de saisie (grandit en hauteur, sans scrollbar quand c'est court)
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    el.style.overflowY = el.scrollHeight > 120 ? 'auto' : 'hidden'
  }, [text])

  // Charger messages
  useEffect(() => {
    const q = query(
      collection(db, 'messagerie', id, 'messages_messagerie'),
      orderBy('date_create', 'asc')
    )
    const unsub = onSnapshot(q, async (snap) => {
      const raws = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RawMessage))
      const resolved: ResolvedMessage[] = await Promise.all(
        raws.map(async (m) => {
          const author = await resolveAuthor(m.ref_user)
          return { ...m, authorName: author.name, authorPhoto: author.photo }
        })
      )
      setMessages(resolved)
      setLoading(false)
    })
    return unsub
  }, [id, resolveAuthor])

  // Scroll bas + marquer lu
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (discussion && messages.length > 0) markAsRead()
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    const canSend = text.trim() || pendingFiles.length > 0
    if (!currentUser || !canSend || sending) return
    const uid = currentUser.uid
    const trimmed = text.trim()
    const filesToSend = [...pendingFiles]
    setText('')
    setPendingFiles([])
    setSending(true)
    try {
      // Upload fichiers avant création du message
      let allImages: string[] = []
      let allVideos: string[] = []
      let allPdfs: string[] = []
      if (filesToSend.length > 0) {
        const uploadKey = Date.now().toString()
        const uploaded = await Promise.all(
          filesToSend.map(async (file) => {
            const ext = file.name.split('.').pop() || 'bin'
            const path = `messagerie/${id}/${uploadKey}/${Math.random().toString(36).slice(2)}.${ext}`
            const sRef = storageRef(storage, path)
            await uploadBytes(sRef, file)
            const url = await getDownloadURL(sRef)
            return { url, type: file.type }
          })
        )
        allImages = uploaded.filter((r) => r.type.startsWith('image/')).map((r) => r.url)
        allVideos = uploaded.filter((r) => r.type.startsWith('video/')).map((r) => r.url)
        allPdfs = uploaded.filter((r) => !r.type.startsWith('image/') && !r.type.startsWith('video/')).map((r) => r.url)
      }

      await addDoc(collection(db, 'messagerie', id, 'messages_messagerie'), {
        ref_user: doc(db, 'usersapp', uid),
        message_text: trimmed,
        date_create: serverTimestamp(),
        document_image_list: allImages,
        document_pdf_list: allPdfs,
        document_video_list: allVideos,
      })

      const updateData: Record<string, any> = { date_last_message: serverTimestamp() }
      if (discussion?.participants_ids !== undefined) {
        const others = (discussion.participants_ids ?? []).filter((p) => p !== uid)
        updateData.non_lus_ids = others
      } else {
        if (discussion?.user_create?.id === uid) {
          updateData.etat_message_destinataire = false
        } else {
          updateData.etat_message_expediteur = false
        }
      }
      await updateDoc(doc(db, 'messagerie', id), updateData)

      // Push notifications aux autres participants
      const notifRecipients = discussion?.participants_ids !== undefined
        ? (discussion.participants_ids ?? []).filter((p) => p !== uid)
        : [discussion?.user_create?.id, discussion?.user_destinataire?.id].filter((p): p is string => !!p && p !== uid)
      const senderName = userProfile?.prenom || userProfile?.display_name || 'Quelqu\'un'
      const msgPreview = trimmed ? trimmed.slice(0, 60) : '(fichier joint)'
      notifRecipients.forEach((recipientId) => {
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: recipientId,
            persist: true,
            type: 'MESSAGERIE',
            title: `${senderName} — Messagerie`,
            body: msgPreview,
            url: `/messagerie/${id}`,
          }),
        }).catch(() => {})
      })
    } catch (e) {
      console.error('Erreur envoi message:', e)
      setText(trimmed)
      setPendingFiles(filesToSend)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleSend() }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    setPendingFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  if (!currentUser) return null
  const uid = currentUser.uid
  const isAdmin = userProfile?.role_app === 'Admin'
  const isNewFormat = discussion?.participants_ids !== undefined

  // Édition d'un message : possible UNE seule fois, tant qu'aucun destinataire n'a lu
  // (un admin peut toujours modifier). Lecture = retiré de non_lus_ids.
  const otherIds = (discussion?.participants_ids ?? []).filter((p) => p !== uid)
  const noneHaveRead = otherIds.length > 0 && otherIds.every((p) => (discussion?.non_lus_ids ?? []).includes(p))
  const canEditMessages = isAdmin || noneHaveRead

  const saveEditedMessage = async () => {
    if (!editingMsg) return
    const newText = editText.trim()
    if (!newText) return
    try {
      await updateDoc(doc(db, 'messagerie', id, 'messages_messagerie', editingMsg.id), {
        message_text: newText,
        edited: true,
      })
    } catch (e) {
      console.error('[edit message]', e)
    }
    setEditingMsg(null)
    setEditText('')
  }

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-0 lg:left-64 flex flex-col pb-nav-safe lg:pb-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
          <button
            onClick={() => router.push('/messagerie')}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-800 truncate">
              {discussion?.objet_message || 'Discussion'}
            </h1>
            {participants.length > 0 && (
              <p className="text-xs text-gray-400 truncate leading-tight">
                {participants.map((p) => p.name).join(', ')}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowMediaPanel(true)}
            className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition shrink-0 relative"
            title="Médias partagés"
          >
            <PhotoIcon className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={() => setShowParticipants(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition shrink-0"
          >
            <UserGroupIcon className="w-4 h-4 text-gray-600" />
            <span className="text-xs font-semibold text-gray-600">{participants.length}</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Aucun message. Soyez le premier !</p>
          ) : (
            messages.map((m) => (
              <MessageBubble key={m.id} m={m} isMe={m.ref_user?.id === uid}
                canEdit={canEditMessages}
                onEdit={(msg) => { setEditingMsg(msg); setEditText(msg.message_text) }}
                onImageClick={(url) => {
                  const idx = allImages.indexOf(url)
                  setLightbox({ urls: allImages, index: Math.max(0, idx) })
                }}
                readBy={discussion?.read_by}
                participants={participants}
                myUid={uid}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Fichiers en attente */}
        {pendingFiles.length > 0 && (
          <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-2 flex gap-2 flex-wrap">
            {pendingFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2.5 py-1.5 max-w-[150px]">
                <span className="text-sm">{fileEmoji(f)}</span>
                <span className="text-xs text-gray-700 truncate">{f.name}</span>
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-gray-400 hover:text-red-500 transition"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Zone saisie */}
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition shrink-0"
          >
            <PaperClipIcon className="w-5 h-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrire… (Ctrl+Entrée pour envoyer)"
            rows={1}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none leading-relaxed overflow-y-hidden"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={(!text.trim() && pendingFiles.length === 0) || sending}
            className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-40 shrink-0"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Participants modal */}
      {showParticipants && (
        <ParticipantsModal
          participants={participants}
          currentUid={uid}
          discussionId={id}
          isNewFormat={isNewFormat}
          isAdmin={isAdmin}
          onClose={() => setShowParticipants(false)}
        />
      )}

      {/* Modal édition d'un message */}
      {editingMsg && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onClick={() => setEditingMsg(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Modifier le message</h3>
            <p className="text-xs text-gray-400 mb-3">Modifiable une seule fois{isAdmin ? '' : " (tant que personne ne l'a lu)"}.</p>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditingMsg(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition">
                Annuler
              </button>
              <button onClick={saveEditedMessage} disabled={!editText.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media panel */}
      {showMediaPanel && (
        <MediaPanel
          messages={messages}
          onClose={() => setShowMediaPanel(false)}
          onImageClick={(urls, index) => {
            setShowMediaPanel(false)
            setLightbox({ urls, index })
          }}
        />
      )}

      {/* Lightbox */}
      {lightbox && (
        <Lightbox
          urls={lightbox.urls}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNav={(i) => setLightbox((l) => l ? { ...l, index: i } : null)}
        />
      )}
    </>
  )
}
