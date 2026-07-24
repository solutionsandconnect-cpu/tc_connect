'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/context/AuthContext'
import { shareTrip, removeMember, createInviteLink, revokeInviteLink, updateInviteLink, listenInviteLinks, updateMemberPermission, addGuestParticipant } from '@/lib/tripsService'
import { useUserPhotoMap } from '@/hooks/useUserPhotoMap'
import { boutiqueLinkOrigin } from '@/lib/brand'
import type { Trip, InviteLink, TripPermission, TripMemberPermission } from '@/types'
import { MagnifyingGlassIcon, XMarkIcon, LinkIcon, TrashIcon, ClipboardDocumentIcon, EnvelopeIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'

interface Props {
  isOpen: boolean
  onClose: () => void
  trip: Trip
  isOwner: boolean
  onError?: (msg: string) => void
}

const PERMISSION_LABELS: Record<TripPermission, { label: string; desc: string; icon: string }> = {
  view:  { label: 'Lecture seule', desc: 'Voir la CheckConnect, sans interaction', icon: '👁️' },
  check: { label: 'Peut cocher', desc: 'Cocher / décocher les éléments', icon: '✅' },
  edit:  { label: 'Peut modifier', desc: 'Ajouter / éditer items & sections', icon: '✏️' },
}

/**
 * Origine des liens d'invitation PARTAGEABLES : toujours le domaine Enezo
 * (la boutique — donc CheckConnect — est rattachée à Enezo), quel que soit le
 * domaine depuis lequel on génère le lien. Cf. `boutiqueLinkOrigin`.
 */
function getBaseUrl(): string {
  return boutiqueLinkOrigin()
}

export default function ShareModal({ isOpen, onClose, trip, isOwner, onError }: Props) {
  const { currentUser, userProfile } = useAuth()
  const { users } = useUsers()
  const photoMap = useUserPhotoMap()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [tab, setTab] = useState<'members' | 'links'>('members')
  const [search, setSearch] = useState('')
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([])
  const [newLinkPerm, setNewLinkPerm] = useState<TripPermission>('check')
  const [newLinkLabel, setNewLinkLabel] = useState('')
  const [creatingLink, setCreatingLink] = useState(false)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  // Brouillon des droits du membre en cours d'édition (sauvegarde explicite)
  const [memberDraft, setMemberDraft] = useState<{ permission: TripMemberPermission; checkMode: 'all' | 'assigned' } | null>(null)
  const [savingMember, setSavingMember] = useState(false)
  const [savedMember, setSavedMember] = useState(false)

  // Formulaire email (non-admin)
  const [emailForm, setEmailForm] = useState({ prenom: '', nom: '', email: '', permission: 'check' as TripPermission })
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState<{ url: string; hasAccount: boolean; name: string; email: string } | null>(null)

  useEffect(() => {
    if (!isOpen || !isOwner) return
    return listenInviteLinks(trip.id, setInviteLinks)
  }, [isOpen, isOwner, trip.id])

  // ── Admin : recherche utilisateurs existants ──────────────────────────────────
  const memberIds = new Set(trip.memberIds)
  const candidates = users
    .filter(u => { const id = u.uid ?? u.id; return id && !memberIds.has(id) })
    .filter(u => {
      const q = search.toLowerCase().trim()
      if (!q) return false
      return [u.nom, u.prenom].filter(Boolean).join(' ').toLowerCase().includes(q)
        || (u.email?.toLowerCase().includes(q) ?? false)
    })
    .slice(0, 6)

  const handleAddAdmin = async (uid: string) => {
    const user = users.find(u => (u.uid ?? u.id) === uid)
    if (!user) return
    try {
      await shareTrip(trip, { ...user, uid: user.uid ?? user.id })
      setSearch('')
    } catch { onError?.("Impossible d'ajouter ce membre.") }
  }

  // ── Non-admin : invite par email ──────────────────────────────────────────────
  const handleEmailInvite = async () => {
    const { prenom, nom, email, permission } = emailForm
    if (!prenom.trim()) { setEmailError('Le prénom est obligatoire.'); return }
    if (!email.trim() || !email.includes('@')) { setEmailError('Adresse email invalide.'); return }
    setEmailError('')
    setEmailSending(true)
    try {
      if (!currentUser) throw new Error('Non connecté')
      const emailLower = email.trim().toLowerCase()
      const token = await createInviteLink(
        trip.id, permission, currentUser.uid,
        `Pour ${prenom.trim()} ${nom.trim()}`.trim(),
        emailLower,
        nom.trim().toUpperCase(),
        prenom.trim(),
      )
      const path = `/c/${token}`
      const url = `${getBaseUrl()}${path}` // lien envoyé à la personne (domaine Enezo)

      // La personne a-t-elle un compte TC Connect ? (lookup par email exact)
      const invited = users.find(u => u.email?.toLowerCase() === emailLower)
      if (invited) {
        // Compte existant → ajout direct comme membre (apparaît dans Gérer + assignable)
        try { await shareTrip(trip, { ...invited, uid: invited.uid ?? invited.id }) } catch {}
        // Notification in-app automatique (push + section Notifications)
        fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: invited.uid ?? invited.id,
            title: '✅ Invitation à une CheckConnect',
            body: `${userProfile?.prenom ?? 'Quelqu\'un'} vous a partagé la CheckConnect « ${trip.name} ».`,
            // Navigation INTERNE (la personne a déjà un compte) → chemin relatif,
            // pour ne pas la faire sortir de son propre domaine.
            url: path,
            persist: true,
            type: 'CheckConnect_Invitation',
          }),
        }).catch(() => {})
      } else {
        // Pas de compte → participant invité (sans compte) ajouté à la liste,
        // pour qu'il apparaisse dans « Gérer », les participants, et « Qui s'en occupe ».
        try { await addGuestParticipant(trip, { id: `guest:${token}`, nom: nom.trim().toUpperCase(), prenom: prenom.trim(), email: emailLower, permission }) } catch {}
      }

      setEmailSent({ url, hasAccount: !!invited, name: `${prenom.trim()} ${nom.trim()}`.trim(), email: emailLower })
      setEmailForm({ prenom: '', nom: '', email: '', permission: 'check' })
    } catch { onError?.("Impossible de créer l'invitation.") }
    finally { setEmailSending(false) }
  }

  // Partage natif du lien (Web Share API si dispo, sinon copie)
  const shareInviteLink = async (url: string, name: string) => {
    const text = `Rejoins la CheckConnect « ${trip.name} » : ${url}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Invitation CheckConnect', text, url }); return } catch { /* annulé */ }
    }
    navigator.clipboard.writeText(url).catch(() => {})
  }

  const handleRemove = async (uid: string) => {
    try { await removeMember(trip, uid) }
    catch { onError?.('Impossible de retirer ce membre.') }
  }

  // ── Liens de partage ──────────────────────────────────────────────────────────
  const handleCreateLink = async () => {
    if (!currentUser) return
    setCreatingLink(true)
    try {
      const token = await createInviteLink(trip.id, newLinkPerm, currentUser.uid, newLinkLabel.trim() || undefined)
      setNewLinkLabel('')
      copyLink(token)
    } catch { onError?.('Impossible de créer le lien.') }
    finally { setCreatingLink(false) }
  }

  const copyLink = (token: string) => {
    const url = `${getBaseUrl()}/c/${token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2500)
    })
  }

  const handleRevoke = async (token: string) => {
    try { await revokeInviteLink(token) }
    catch { onError?.('Impossible de révoquer ce lien.') }
  }

  const handleUpdateLinkPerm = async (token: string, permission: TripPermission) => {
    try { await updateInviteLink(token, permission) }
    catch { onError?.('Impossible de modifier les droits du lien.') }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Partager la CheckConnect" size="md">
      <div className="space-y-4">
        {/* Onglets */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setTab('members')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'members' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            👥 Membres
          </button>
          <button onClick={() => setTab('links')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'links' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            🔗 Lien libre
          </button>
        </div>

        {/* ── Onglet Membres ── */}
        {tab === 'members' && (
          <>
            {/* Liste des membres actuels */}
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Participants ({trip.members.length})</p>
              <div className="space-y-1.5">
                {trip.members.map(m => {
                  const name = [m.prenom, m.nom].filter(Boolean).join(' ') || m.email || m.uid.slice(0, 6)
                  const initials = name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase()
                  const isExpanded = expandedMember === m.uid
                  const perm = m.role === 'owner' ? 'owner' : (m.permission ?? 'contributor')
                  const permLabels: Record<string, { label: string; color: string }> = {
                    owner:       { label: 'Propriétaire', color: 'bg-blue-100 text-blue-700' },
                    admin:       { label: 'Admin',         color: 'bg-purple-100 text-purple-700' },
                    editor:      { label: 'Éditeur',       color: 'bg-green-100 text-green-700' },
                    contributor: { label: 'Contributeur',  color: 'bg-gray-100 text-gray-600' },
                    viewer:      { label: 'Lecteur',        color: 'bg-orange-100 text-orange-600' },
                  }
                  const badge = permLabels[perm]
                  const canEdit = (isOwner || userProfile?.role_app === 'Admin') && m.role !== 'owner'
                  return (
                    <div key={m.uid} className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-gray-50">
                        {(photoMap[m.uid] || m.photoUrl)
                          ? <img src={photoMap[m.uid] || m.photoUrl} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                          : <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">{initials || '?'}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {name}
                            {m.isGuest && <span className="ml-1.5 text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">invité</span>}
                          </p>
                          {m.email && <p className="text-[11px] text-gray-400 truncate">{m.email}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                          {canEdit && (
                            <button
                              onClick={() => {
                                if (isExpanded) { setExpandedMember(null); setMemberDraft(null) }
                                else {
                                  setExpandedMember(m.uid)
                                  setMemberDraft({ permission: (m.permission ?? 'contributor') as TripMemberPermission, checkMode: m.checkMode ?? 'all' })
                                  setSavedMember(false)
                                }
                              }}
                              title="Gérer les droits"
                              className={`p-1.5 rounded-lg transition ${
                                isExpanded
                                  ? 'bg-blue-100 text-blue-600'
                                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}>
                              <Cog6ToothIcon className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit && (
                            confirmRemove === m.uid ? (
                              <div className="flex items-center gap-1">
                                <button onClick={() => { handleRemove(m.uid); setConfirmRemove(null) }}
                                  title="Confirmer le retrait"
                                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition">
                                  Retirer
                                </button>
                                <button onClick={() => setConfirmRemove(null)}
                                  title="Annuler"
                                  className="p-1 text-gray-400 hover:text-gray-600 transition">
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmRemove(m.uid)} aria-label="Retirer"
                                className="p-1 text-gray-300 hover:text-red-500 transition">
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {isExpanded && canEdit && memberDraft && (
                        <div className="px-3 py-3 border-t border-gray-100 bg-white space-y-3">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Rôle</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(['admin', 'editor', 'contributor', 'viewer'] as TripMemberPermission[]).map(p => (
                                <button key={p} onClick={() => { setMemberDraft(d => d && ({ ...d, permission: p })); setSavedMember(false) }}
                                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition text-left font-medium ${
                                    memberDraft.permission === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                                  }`}>
                                  {permLabels[p].label}
                                  <span className="block text-[10px] font-normal opacity-70 mt-0.5">
                                    {p === 'admin' && 'Droits complets'}
                                    {p === 'editor' && 'Sections, items, partage'}
                                    {p === 'contributor' && 'Ajouter des items'}
                                    {p === 'viewer' && 'Lecture seule'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Peut cocher</p>
                            <div className="flex gap-2">
                              {(['all', 'assigned'] as const).map(mode => (
                                <button key={mode} onClick={() => { setMemberDraft(d => d && ({ ...d, checkMode: mode })); setSavedMember(false) }}
                                  className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border transition font-medium ${
                                    memberDraft.checkMode === mode ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                                  }`}>
                                  {mode === 'all' ? '✅ Tout le monde' : '👤 Ses propres items'}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* Enregistrer */}
                          <button
                            onClick={async () => {
                              setSavingMember(true)
                              try {
                                await updateMemberPermission(trip, m.uid, memberDraft.permission, memberDraft.checkMode)
                                // Invité sans compte : son accès passe par le lien → on
                                // synchronise la permission du lien avec son nouveau rôle.
                                if (m.isGuest && m.uid.startsWith('guest:')) {
                                  const token = m.uid.slice('guest:'.length)
                                  const linkPerm: TripPermission =
                                    (memberDraft.permission === 'admin' || memberDraft.permission === 'editor') ? 'edit'
                                    : memberDraft.permission === 'viewer' ? 'view'
                                    : 'check'
                                  await updateInviteLink(token, linkPerm)
                                }
                                setSavedMember(true)
                                setTimeout(() => { setExpandedMember(null); setMemberDraft(null); setSavedMember(false) }, 800)
                              } catch { onError?.('Impossible d\'enregistrer les droits.') }
                              finally { setSavingMember(false) }
                            }}
                            disabled={savingMember}
                            className={`w-full text-sm font-medium py-2 rounded-xl transition ${
                              savedMember ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60'
                            }`}>
                            {savedMember ? '✓ Enregistré' : savingMember ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Inviter */}
            {isOwner && (
              <>
              {isAdmin && (
                /* Admin → recherche des utilisateurs existants (ajout direct) */
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Ajouter un utilisateur TC Connect</p>
                  <div className="relative">
                    <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher par nom ou email…"
                      className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                  </div>
                  {search.trim() && (
                    <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50 overflow-hidden">
                      {candidates.length === 0 ? (
                        <p className="text-sm text-gray-400 px-3 py-2 italic">Aucun utilisateur trouvé</p>
                      ) : candidates.map(u => (
                        <button key={u.uid ?? u.id} onClick={() => handleAddAdmin(u.uid ?? u.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition">
                          <span className="text-sm text-gray-800">{[u.prenom, u.nom].filter(Boolean).join(' ') || u.email}</span>
                          {u.email && <span className="text-xs text-gray-400">{u.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Invitation par lien (avec email pré-rempli) — pour tous */}
                <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-700">Inviter une personne (par lien)</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Prénom *</label>
                      <input type="text" value={emailForm.prenom}
                        onChange={e => setEmailForm(f => ({ ...f, prenom: e.target.value }))}
                        placeholder="Julie"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1">Nom</label>
                      <input type="text" value={emailForm.nom}
                        onChange={e => setEmailForm(f => ({ ...f, nom: e.target.value }))}
                        placeholder="MARTIN"
                        className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Adresse email *</label>
                    <div className="relative">
                      <EnvelopeIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="email" value={emailForm.email}
                        onChange={e => setEmailForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="julie@exemple.fr"
                        className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                  {/* Droits accordés */}
                  <div>
                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Droits accordés</label>
                    <div className="space-y-1.5">
                      {(['view', 'check', 'edit'] as TripPermission[]).map(key => {
                        const val = PERMISSION_LABELS[key]
                        return (
                          <button key={key} type="button" onClick={() => setEmailForm(f => ({ ...f, permission: key }))}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs text-left transition ${
                              emailForm.permission === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                            }`}>
                            <span className="text-base">{val.icon}</span>
                            <div className="flex-1">
                              <p className="font-semibold">{val.label}</p>
                              <p className={`leading-tight ${emailForm.permission === key ? 'text-blue-100' : 'text-gray-400'}`}>{val.desc}</p>
                            </div>
                            {emailForm.permission === key && <span className="text-sm">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {emailError && <p className="text-xs text-red-600">{emailError}</p>}

                  {emailSent ? (
                    <div className="space-y-2.5">
                      <p className={`text-xs font-medium rounded-lg px-2.5 py-2 border ${
                        emailSent.hasAccount
                          ? 'text-green-700 bg-green-50 border-green-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                        {emailSent.hasAccount
                          ? `✅ ${emailSent.name} a un compte TC Connect : une notification lui a été envoyée. Vous pouvez aussi lui transmettre le lien ci-dessous.`
                          : `ℹ️ ${emailSent.name} n'a pas de compte. Transmettez-lui le lien ci-dessous (SMS, email, Messenger…).`}
                      </p>
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-gray-600 flex-1 truncate">{emailSent.url}</span>
                        <button onClick={() => navigator.clipboard.writeText(emailSent.url)}
                          className="shrink-0 text-xs font-medium text-blue-600 hover:underline">Copier</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => shareInviteLink(emailSent.url, emailSent.name)}
                          className="flex items-center justify-center gap-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 rounded-lg py-2 transition">
                          📤 Partager
                        </button>
                        <a href={`mailto:${emailSent.email}?subject=${encodeURIComponent(`CheckConnect « ${trip.name} »`)}&body=${encodeURIComponent(`Bonjour ${emailSent.name},\n\nJe te partage la CheckConnect « ${trip.name} » sur Enezo :\n${emailSent.url}\n`)}`}
                          className="flex items-center justify-center gap-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 rounded-lg py-2 transition">
                          ✉️ Email
                        </a>
                        <a href={`sms:?&body=${encodeURIComponent(`CheckConnect « ${trip.name} » : ${emailSent.url}`)}`}
                          className="flex items-center justify-center gap-1 text-xs font-medium border border-gray-200 hover:bg-gray-50 rounded-lg py-2 transition">
                          💬 SMS
                        </a>
                      </div>
                      <button onClick={() => setEmailSent(null)}
                        className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">Inviter une autre personne</button>
                    </div>
                  ) : (
                    <button onClick={handleEmailInvite} disabled={emailSending}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition">
                      <EnvelopeIcon className="w-4 h-4" />
                      {emailSending ? 'Création…' : 'Valider et générer l\'invitation'}
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Si la personne a déjà un compte TC Connect (même email), elle est notifiée directement dans l'app. Sinon, transmettez-lui le lien — son nom sera pré-rempli à l'ouverture.
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Onglet Lien libre ── */}
        {tab === 'links' && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
              Lien sans identité pré-remplie — partagez à n'importe qui sans préciser de nom.
            </div>

            {isOwner && (
              <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                <p className="text-xs font-semibold text-gray-700">Nouveau lien</p>
                <div className="space-y-1.5">
                  {(['view', 'check', 'edit'] as TripPermission[]).map((key) => {
                    const val = PERMISSION_LABELS[key]
                    return (
                      <button key={key} type="button" onClick={() => setNewLinkPerm(key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs text-left transition ${
                          newLinkPerm === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                        }`}>
                        <span className="text-base">{val.icon}</span>
                        <div className="flex-1">
                          <p className="font-semibold">{val.label}</p>
                          <p className={`leading-tight ${newLinkPerm === key ? 'text-blue-100' : 'text-gray-400'}`}>{val.desc}</p>
                        </div>
                        {newLinkPerm === key && <span className="text-sm">✓</span>}
                      </button>
                    )
                  })}
                </div>
                <input type="text" value={newLinkLabel} onChange={e => setNewLinkLabel(e.target.value)}
                  placeholder="Libellé optionnel (ex : Accès partagé)"
                  maxLength={40}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button onClick={handleCreateLink} disabled={creatingLink}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-xl transition">
                  <LinkIcon className="w-4 h-4" />
                  {creatingLink ? 'Génération…' : 'Générer le lien (copié automatiquement)'}
                </button>
              </div>
            )}

            {/* Tous les liens actifs (email + libres) */}
            {inviteLinks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Liens actifs ({inviteLinks.length})</p>
                {inviteLinks.map(link => {
                  const perm = PERMISSION_LABELS[link.permission]
                  const url = `${getBaseUrl()}/c/${link.id}`
                  const isCopied = copiedToken === link.id
                  const displayName = link.prenom || link.nom
                    ? `${link.prenom ?? ''} ${link.nom ?? ''}`.trim()
                    : null
                  return (
                    <div key={link.id} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg shrink-0">{link.inviteEmail ? '📧' : (perm?.icon ?? '🔗')}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">
                            {displayName || link.label || perm?.label || 'Lien partagé'}
                          </p>
                          <p className="text-[11px] text-gray-400 truncate">
                            {link.inviteEmail || url}
                          </p>
                        </div>
                        <button onClick={() => copyLink(link.id)} aria-label="Copier"
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition shrink-0">
                          <ClipboardDocumentIcon className={`w-4 h-4 ${isCopied ? 'text-green-500' : ''}`} />
                        </button>
                        {isOwner && (
                          <button onClick={() => handleRevoke(link.id)} aria-label="Révoquer"
                            className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {/* Modifier les droits du lien (même après partage) */}
                      {isOwner && (
                        <div className="flex items-center gap-1.5 pl-7">
                          <span className="text-[11px] text-gray-400">Droits :</span>
                          <select
                            value={link.permission}
                            onChange={e => handleUpdateLinkPerm(link.id, e.target.value as TripPermission)}
                            className="flex-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
                            {(['view', 'check', 'edit'] as TripPermission[]).map(k => (
                              <option key={k} value={k}>{PERMISSION_LABELS[k].icon} {PERMISSION_LABELS[k].label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-2 italic">Aucun lien actif.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
