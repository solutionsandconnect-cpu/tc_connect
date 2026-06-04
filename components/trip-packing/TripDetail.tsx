'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useTripDetail } from '@/hooks/useTripDetail'
import { useUserPhotoMap } from '@/hooks/useUserPhotoMap'
import { tripProgress, nbJoursOf, saveAsTemplate, resetTripReady, deleteTrip, archiveTrip, memberCan, memberCanToggle } from '@/lib/tripsService'
import { tripTypeLabel, SUGGESTED_SECTIONS } from './constants'
import TripProgressBar from './TripProgressBar'
import TripSection from './TripSection'
import TripModal from './modals/TripModal'
import ShareModal from './modals/ShareModal'
import Modal from '@/components/ui/Modal'
import {
  PencilIcon, ShareIcon, BookmarkIcon, ArrowPathIcon, TrashIcon, PlusIcon, ChevronLeftIcon,
  CheckCircleIcon, ArchiveBoxIcon, ArchiveBoxArrowDownIcon,
} from '@heroicons/react/24/outline'

type Filter = 'all' | 'todo' | 'done'

interface Props {
  tripId: string
  onDeleted: () => void
  onBack?: () => void
  notify: (msg: string, ok?: boolean) => void
}

function fmtDate(d?: Date): string {
  return d ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''
}

export default function TripDetail({ tripId, onDeleted, onBack, notify }: Props) {
  const { currentUser, userProfile } = useAuth()
  const photoMap = useUserPhotoMap()
  const owner = currentUser && userProfile ? { ...userProfile, uid: currentUser.uid } : null
  const {
    trip, loading,
    addSection, renameSection, deleteSection, moveSection, duplicateSection,
    addItem, updateItem, deleteItem, moveItem, toggleItem, setReady,
    duplicateItem, moveItemToSection,
    checkAllInSection, uncheckAllInSection, checkAllItems,
  } = useTripDetail(tripId)

  const [filter, setFilter] = useState<Filter>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [newSection, setNewSection] = useState('')
  const [showSectionSuggestions, setShowSectionSuggestions] = useState(false)
  const [selectedSectionSuggestion, setSelectedSectionSuggestion] = useState(-1)
  const [showEdit, setShowEdit] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCheckAll, setConfirmCheckAll] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!trip) {
    return <div className="text-center py-20 text-gray-400 text-sm">CheckConnect introuvable.</div>
  }

  const isOwner = trip.ownerId === currentUser?.uid
  const currentMember = trip.members.find(m => m.uid === currentUser?.uid) ?? null
  // Un administrateur de la liste a les mêmes droits que le créateur.
  const isManager = isOwner || currentMember?.permission === 'admin'
  const canAddSections = memberCan(currentMember, isOwner, 'addSections')
  const canAddItems = memberCan(currentMember, isOwner, 'addItems')
  const canShare = memberCan(currentMember, isOwner, 'share')
  const canManage = memberCan(currentMember, isOwner, 'manageMembers') || isOwner
  const nbJours = nbJoursOf(trip)
  const progress = tripProgress(trip)
  const allSortedSections = [...trip.sections].sort((a, b) => a.position - b.position)
  const sortedSections = sectionFilter === 'all'
    ? allSortedSections
    : allSortedSections.filter(s => s.id === sectionFilter)

  const dFrom = trip.dateFrom?.toDate?.()
  const dTo = trip.dateTo?.toDate?.()

  const handleSaveTemplate = async () => {
    if (!owner) return
    setBusy(true)
    try {
      await saveAsTemplate(owner, trip)
      notify('Modèle enregistré ✓')
    } catch { notify('Erreur lors de la sauvegarde du modèle.', false) }
    finally { setBusy(false) }
  }

  const handleReset = async () => {
    setBusy(true)
    try { await resetTripReady(trip); notify('CheckConnect réinitialisée ✓') }
    catch { notify('Erreur lors de la réinitialisation.', false) }
    finally { setBusy(false); setConfirmReset(false) }
  }

  const handleDelete = async () => {
    setBusy(true)
    try { await deleteTrip(trip.id); notify('CheckConnect supprimée'); onDeleted() }
    catch { notify('Erreur lors de la suppression.', false) }
    finally { setBusy(false); setConfirmDelete(false) }
  }

  const existingSectionNames = trip?.sections.map(s => s.title.toLowerCase()) ?? []
  const sectionSuggestions: string[] = (() => {
    const q = newSection.trim().toLowerCase()
    if (!q) return []
    const filtered = SUGGESTED_SECTIONS.filter(
      s => !existingSectionNames.includes(s.toLowerCase()) &&
        (s.toLowerCase().startsWith(q) || s.toLowerCase().includes(q))
    )
    const starts = filtered.filter(s => s.toLowerCase().startsWith(q))
    const contains = filtered.filter(s => !s.toLowerCase().startsWith(q))
    return [...starts, ...contains].slice(0, 6)
  })()

  const submitSection = (name?: string) => {
    const v = (name ?? newSection).trim()
    if (!v) return
    addSection(v).catch(() => notify('Erreur lors de l\'ajout de la section.', false))
    setNewSection('')
    setShowSectionSuggestions(false)
    setSelectedSectionSuggestion(-1)
  }

  const handleSectionKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSectionSuggestion(i => Math.min(i + 1, sectionSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSectionSuggestion(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      submitSection(selectedSectionSuggestion >= 0 ? sectionSuggestions[selectedSectionSuggestion] : undefined)
    }
    else if (e.key === 'Escape') { setShowSectionSuggestions(false); setSelectedSectionSuggestion(-1) }
  }

  const wrap = (p: Promise<unknown>) => p.catch(() => notify('Une erreur est survenue.', false))

  return (
    <div className="space-y-5">
      {/* En-tête */}
      <div>
        {/* Barre mobile avec retour intégré */}
        {onBack && (
          <div className="lg:hidden flex items-center gap-2 mb-3 -mx-1">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-blue-600 font-medium text-sm py-1.5 px-2 rounded-xl hover:bg-blue-50 transition active:scale-95"
            >
              <ChevronLeftIcon className="w-5 h-5" strokeWidth={2.5} />
              Mes CheckConnect
            </button>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: trip.color + '20' }}>
            {trip.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-800">{trip.name}</h1>
              {trip.isTemplate && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Modèle</span>}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {tripTypeLabel(trip.type)}
              {dFrom && dTo && ` · ${fmtDate(dFrom)} → ${fmtDate(dTo)}`}
              {nbJours && ` · ${nbJours} jour${nbJours > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-3">
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <PencilIcon className="w-3.5 h-3.5" /> Modifier
          </button>
          {!trip.isTemplate && (canShare || canManage) && (
            <button onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <ShareIcon className="w-3.5 h-3.5" /> Partager{trip.members.length > 1 ? ` (${trip.members.length})` : ''}
            </button>
          )}
          {isManager && !trip.isTemplate && (
            <button onClick={handleSaveTemplate} disabled={busy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <BookmarkIcon className="w-3.5 h-3.5" /> Sauver comme modèle
            </button>
          )}
          {!trip.isTemplate && (
            <button onClick={() => setConfirmCheckAll(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Tout cocher
            </button>
          )}
          {!trip.isTemplate && (
            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <ArrowPathIcon className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          {isManager && !trip.isTemplate && (
            <button onClick={() => wrap(archiveTrip(trip.id, !trip.archived))}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                trip.archived
                  ? 'border-blue-200 text-blue-600 hover:bg-blue-50'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              {trip.archived
                ? <><ArchiveBoxArrowDownIcon className="w-3.5 h-3.5" /> Désarchiver</>
                : <><ArchiveBoxIcon className="w-3.5 h-3.5" /> Archiver</>
              }
            </button>
          )}
          {/* Suppression de la liste entière : réservée au créateur (contrainte règles Firestore) */}
          {isOwner && (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
              <TrashIcon className="w-3.5 h-3.5" /> Supprimer
            </button>
          )}
        </div>
      </div>

      {/* Participants */}
      {trip.members.length > 1 && (
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {trip.members.slice(0, 5).map(m => {
              const name = [m.prenom, m.nom].filter(Boolean).join(' ') || m.email || '?'
              const initials = name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
              const photo = photoMap[m.uid] || m.photoUrl
              return photo ? (
                <img key={m.uid} src={photo} alt={name} title={name}
                  className="w-7 h-7 rounded-full object-cover border-2 border-white shrink-0" />
              ) : (
                <div key={m.uid} title={name}
                  className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 border-2 border-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {initials}
                </div>
              )
            })}
            {trip.members.length > 5 && (
              <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 border-2 border-white flex items-center justify-center text-[10px] font-bold">
                +{trip.members.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400">{trip.members.length} participant{trip.members.length > 1 ? 's' : ''}</span>
          {canManage && (
            <button onClick={() => setShowShare(true)}
              className="text-xs text-blue-600 hover:underline font-medium">
              Gérer
            </button>
          )}
        </div>
      )}

      {/* Progression (pas pour les modèles vierges) */}
      {!trip.isTemplate && progress.total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <TripProgressBar {...progress} />
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {([['all', 'Tous'], ['todo', 'À faire'], ['done', 'Faits']] as [Filter, string][]).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === k ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Filtre par section */}
        {allSortedSections.length > 1 && (
          <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">Toutes les sections</option>
            {allSortedSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        )}

        {/* Filtre par responsable */}
        {trip.members.length > 1 && (
          <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="all">Tout le monde</option>
            {trip.members.map(m => (
              <option key={m.uid} value={m.uid}>{[m.prenom, m.nom].filter(Boolean).join(' ') || m.email || m.uid.slice(0, 6)}</option>
            ))}
            <option value="none">Non assigné</option>
          </select>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {sortedSections.map((section, i) => (
          <TripSection
            key={section.id}
            section={section}
            nbJours={nbJours}
            members={trip.members}
            tripId={trip.id}
            filter={filter}
            assigneeFilter={assigneeFilter}
            isFirst={i === 0}
            isLast={i === sortedSections.length - 1}
            canEditSection={canAddSections}
            canAddItems={canAddItems}
            currentUserId={currentUser?.uid ?? ''}
            currentMember={currentMember}
            isOwner={isOwner}
            photoMap={photoMap}
            allItemNames={trip.sections.flatMap(s => s.items.map(it => it.name))}
            allSections={allSortedSections.map(s => ({ id: s.id, title: s.title }))}
            onRename={(t) => wrap(renameSection(section.id, t))}
            onDelete={() => wrap(deleteSection(section.id))}
            onMove={(dir) => wrap(moveSection(section.id, dir))}
            onDuplicateSection={() => wrap(duplicateSection(section.id))}
            onCheckAll={() => wrap(checkAllInSection(section.id))}
            onUncheckAll={() => wrap(uncheckAllInSection(section.id))}
            onAddItem={(n) => wrap(addItem(section.id, n))}
            onUpdateItem={(id, patch) => wrap(updateItem(section.id, id, patch))}
            onDeleteItem={(id) => wrap(deleteItem(section.id, id))}
            onMoveItem={(id, dir) => wrap(moveItem(section.id, id, dir))}
            onToggleItem={(id) => wrap(toggleItem(section.id, id))}
            onSetReady={(id, qty) => wrap(setReady(section.id, id, qty))}
            onDuplicateItem={(id) => wrap(duplicateItem(section.id, id))}
            onMoveItemToSection={(id, toId) => wrap(moveItemToSection(section.id, id, toId))}
          />
        ))}

        {/* Ajout de section (droits requis) */}
        {canAddSections && (
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-dashed border-gray-200 p-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={newSection}
                onChange={e => { setNewSection(e.target.value); setShowSectionSuggestions(true); setSelectedSectionSuggestion(-1) }}
                onKeyDown={handleSectionKeyDown}
                onFocus={() => setShowSectionSuggestions(true)}
                onBlur={() => setTimeout(() => { setShowSectionSuggestions(false); setSelectedSectionSuggestion(-1) }, 150)}
                placeholder="Nouvelle section (ex : Vêtements, Courses, Documents…)"
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {showSectionSuggestions && sectionSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {sectionSuggestions.map((s, i) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); submitSection(s) }}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        i === selectedSectionSuggestion
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => submitSection()} disabled={!newSection.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition shrink-0">
              <PlusIcon className="w-4 h-4" /> Section
            </button>
          </div>
        )}
      </div>

      {/* Modales */}
      <TripModal isOpen={showEdit} onClose={() => setShowEdit(false)} trip={trip} />
      <ShareModal isOpen={showShare} onClose={() => setShowShare(false)} trip={trip} isOwner={isManager} onError={(m) => notify(m, false)} />

      <Modal isOpen={confirmCheckAll} onClose={() => setConfirmCheckAll(false)} title="Tout cocher" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Valider <strong>tous les éléments</strong> de la CheckConnect comme prêts ?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmCheckAll(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
            <button onClick={() => { wrap(checkAllItems()); setConfirmCheckAll(false) }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium transition">Tout cocher</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmReset} onClose={() => setConfirmReset(false)} title="Réinitialiser la CheckConnect" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Remettre toutes les quantités prêtes à 0 ? La structure (sections/articles) est conservée.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmReset(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
            <button onClick={handleReset} disabled={busy} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">Réinitialiser</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={confirmDelete} onClose={() => setConfirmDelete(false)} title="Supprimer la CheckConnect" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Supprimer <strong>{trip.name}</strong> et tous ses éléments ? Cette action est irréversible.</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">Annuler</button>
            <button onClick={handleDelete} disabled={busy} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">Supprimer</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
