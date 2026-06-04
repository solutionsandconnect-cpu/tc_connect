'use client'

import { useState, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { useUsers } from '@/hooks/useUsers'
import { useAuth } from '@/context/AuthContext'
import { shareTrip, removeMember, createInviteLink, revokeInviteLink, listenInviteLinks, updateMemberPermission } from '@/lib/tripsService'
import { useUserPhotoMap } from '@/hooks/useUserPhotoMap'
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
  check: { label: 'Peut cocher', desc: 'Cocher/décocher les éléments', icon: '✅' },
  view:  { label: 'Lecture seule', desc: 'Voir la liste, sans interaction', icon: '👁️' },
}

function getBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return ''
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

  // Formulaire email (non-admin)
  const [emailForm, setEmailForm] = useState({ prenom: '', nom: '', email: '' })
  const [emailError, setEmailError] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState<string | null>(null)

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
    const { prenom, nom, email } = emailForm
    if (!prenom.trim()) { setEmailError('Le prénom est obligatoire.'); return }
    if (!email.trim() || !email.includes('@')) { setEmailError('Adresse email invalide.'); return }
    setEmailError('')
    setEmailSending(true)
    try {
      if (!currentUser) throw new Error('Non connecté')
      const token = await createInviteLink(
        trip.id, 'check', currentUser.uid,
        `Pour ${prenom.trim()} ${nom.trim()}`.trim(),
        email.trim().toLowerCase(),
        nom.trim().toUpperCase(),
        prenom.trim(),
      )
      setEmailSent(`${getBaseUrl()}/c/${token}`)
      setEmailForm({ prenom: '', nom: '', email: '' })
    } catch { onError?.("Impossible de créer l'invitation.") }
    finally { setEmailSending(false) }
  }

  const handleRemove = async (uid: string) => {
    try { await removeMember(trip, uid) }
    catch { onError?.('Impossible de retirer ce membre.') }
  }

  const handlePermissionChange = async (uid: string, permission: TripMemberPermission) => {
    try { await updateMemberPermission(trip, uid, permission) }
    catch { onError?.('Impossible de modifier les droits.') }
  }

  const handleCheckModeChange = async (uid: string, checkMode: 'all' | 'assigned') => {
    const m = trip.members.find(x => x.uid === uid)
    if (!m) return
    try { await updateMemberPermission(trip, uid, m.permission ?? 'contributor', checkMode) }
    catch { onError?.('Impossible de modifier les droits.') }
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Partager la liste" size="md">
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
                          <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                          {m.email && <p className="text-[11px] text-gray-400 truncate">{m.email}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>{badge.label}</span>
                          {canEdit && (
                            <button
                              onClick={() => setExpandedMember(isExpanded ? null : m.uid)}
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
                            <button onClick={() => handleRemove(m.uid)} aria-label="Retirer"
                              className="p-1 text-gray-300 hover:text-red-500 transition">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && canEdit && (
                        <div className="px-3 py-3 border-t border-gray-100 bg-white space-y-3">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Rôle</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {(['admin', 'editor', 'contributor', 'viewer'] as TripMemberPermission[]).map(p => (
                                <button key={p} onClick={() => handlePermissionChange(m.uid, p)}
                                  className={`text-xs px-2.5 py-1.5 rounded-lg border transition text-left font-medium ${
                                    m.permission === p ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
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
                                <button key={mode} onClick={() => handleCheckModeChange(m.uid, mode)}
                                  className={`flex-1 text-xs px-2.5 py-1.5 rounded-lg border transition font-medium ${
                                    (m.checkMode ?? 'all') === mode ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                                  }`}>
                                  {mode === 'all' ? '✅ Tout le monde' : '👤 Ses propres items'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Inviter */}
            {isOwner && (
              isAdmin ? (
                /* Admin → recherche des utilisateurs existants */
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
              ) : (
                /* Non-admin → invitation par adresse email */
                <div className="border border-gray-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-gray-700">Inviter par adresse email</p>
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
                  {emailError && <p className="text-xs text-red-600">{emailError}</p>}
                  {emailSent ? (
                    <div className="space-y-2">
                      <p className="text-xs text-green-700 font-medium bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                        ✅ Lien créé — copiez-le et envoyez-le à la personne.
                      </p>
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <span className="text-xs text-gray-600 flex-1 truncate">{emailSent}</span>
                        <button onClick={() => { navigator.clipboard.writeText(emailSent); setEmailSent(null) }}
                          className="shrink-0 text-xs font-medium text-blue-600 hover:underline">
                          Copier
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={handleEmailInvite} disabled={emailSending}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-xl transition">
                      <EnvelopeIcon className="w-4 h-4" />
                      {emailSending ? 'Création…' : 'Créer le lien d\'invitation'}
                    </button>
                  )}
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Un lien personnel est généré. Copiez-le et envoyez-le à la personne par le moyen de votre choix. Son nom sera pré-rempli à l'ouverture.
                  </p>
                </div>
              )
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
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(PERMISSION_LABELS) as [TripPermission, typeof PERMISSION_LABELS[TripPermission]][]).map(([key, val]) => (
                    <button key={key} type="button" onClick={() => setNewLinkPerm(key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition ${
                        newLinkPerm === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-700 hover:border-blue-300'
                      }`}>
                      <span className="text-base">{val.icon}</span>
                      <div>
                        <p className="font-semibold">{val.label}</p>
                        <p className={`leading-tight ${newLinkPerm === key ? 'text-blue-100' : 'text-gray-400'}`}>{val.desc}</p>
                      </div>
                    </button>
                  ))}
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
                    <div key={link.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
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
