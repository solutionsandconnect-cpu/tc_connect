'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { db } from '@/lib/firebase'
import {
  collection, getDocs, addDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AppUser {
  id: string
  prenom?: string
  nom?: string
  email?: string
  photo_url?: string
  display_name?: string
  role_app?: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NouvelleDiscussionPage() {
  const router = useRouter()
  const { currentUser, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [users, setUsers] = useState<AppUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AppUser[]>([])
  const [objet, setObjet] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Charger tous les utilisateurs depuis collection `users`
  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'))
        const list: AppUser[] = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as AppUser))
          .filter((u) => u.id !== currentUser?.uid)
          .filter((u) => isAdmin || u.role_app === 'Admin')
        setUsers(list)
      } catch (e) {
        console.error('Erreur chargement utilisateurs:', e)
      } finally {
        setLoadingUsers(false)
      }
    }
    if (currentUser) loadUsers()
  }, [currentUser, isAdmin])

  const toggleSelect = (user: AppUser) => {
    setSelected((prev) => {
      const idx = prev.findIndex((u) => u.id === user.id)
      if (idx >= 0) return prev.filter((u) => u.id !== user.id)
      return [...prev, user]
    })
  }

  const isSelected = (user: AppUser) => selected.some((u) => u.id === user.id)

  const getUserDisplayName = (u: AppUser) => {
    return u.display_name || `${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.email || 'Utilisateur'
  }

  const getUserInitials = (u: AppUser) => {
    const name = getUserDisplayName(u)
    return name.slice(0, 2).toUpperCase()
  }

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase()
    if (!s) return true
    return (
      u.prenom?.toLowerCase().includes(s) ||
      u.nom?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.display_name?.toLowerCase().includes(s)
    )
  })

  const handleSubmit = async () => {
    if (!currentUser || !objet.trim() || !firstMessage.trim() || selected.length === 0) return
    setSending(true)
    try {
      const uid = currentUser.uid
      const participantsIds = [uid, ...selected.map((u) => u.id)]
      const nonLusIds = selected.map((u) => u.id)

      // Créer la discussion
      const discRef = await addDoc(collection(db, 'messagerie'), {
        objet_message: objet.trim(),
        date_create: serverTimestamp(),
        date_last_message: serverTimestamp(),
        participants_ids: participantsIds,
        non_lus_ids: nonLusIds,
        archives_par: [],
      })

      // Premier message
      await addDoc(collection(db, 'messagerie', discRef.id, 'messages_messagerie'), {
        ref_user: doc(db, 'usersapp', uid),
        message_text: firstMessage.trim(),
        date_create: serverTimestamp(),
        document_image_list: [],
        document_pdf_list: [],
        document_video_list: [],
      })

      router.push(`/messagerie/${discRef.id}`)
    } catch (e) {
      console.error('Erreur création discussion:', e)
      alert('Impossible de créer la discussion. Veuillez réessayer.')
    } finally {
      setSending(false)
    }
  }

  const canSubmit = selected.length > 0 && objet.trim().length > 0 && firstMessage.trim().length > 0

  if (!currentUser) return null

  return (
    <div className="pb-nav-safe">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/messagerie')}
          className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"
        >
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Nouvelle discussion</h1>
      </div>

      {/* Destinataires */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Destinataires
          {selected.length > 0 && (
            <span className="ml-2 text-xs text-blue-600 font-medium">
              {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
            </span>
          )}
        </h2>

        {/* Sélectionnés chips */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selected.map((u) => (
              <button
                key={u.id}
                onClick={() => toggleSelect(u)}
                className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1 text-xs font-medium hover:bg-blue-100 transition"
              >
                {getUserDisplayName(u)}
                <span className="text-blue-400 ml-0.5">×</span>
              </button>
            ))}
          </div>
        )}

        {/* Recherche */}
        <div className="relative mb-2">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un utilisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none focus:border-blue-400"
          />
        </div>

        {/* Liste */}
        {loadingUsers ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">Aucun utilisateur trouvé</p>
        ) : (
          <div className="max-h-52 overflow-y-auto space-y-1 -mx-1 px-1">
            {filteredUsers.map((u) => {
              const sel = isSelected(u)
              return (
                <button
                  key={u.id}
                  onClick={() => toggleSelect(u)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${
                    sel ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  {u.photo_url ? (
                    <img
                      src={u.photo_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-gray-200"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                      {getUserInitials(u)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${sel ? 'text-blue-700' : 'text-gray-800'}`}>
                      {getUserDisplayName(u)}
                    </p>
                    {u.email && (
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    )}
                  </div>
                  {sel && <CheckIcon className="w-4 h-4 text-blue-600 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Objet */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Objet *</label>
        <input
          type="text"
          placeholder="Objet de la discussion"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400"
        />
      </div>

      {/* Premier message */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Premier message *</label>
        <textarea
          placeholder="Écrivez votre premier message…"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-400 resize-none leading-relaxed"
        />
      </div>

      {/* Bouton envoyer */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || sending}
        className="w-full bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {sending ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Envoi en cours…
          </>
        ) : (
          'Envoyer'
        )}
      </button>
    </div>
  )
}
