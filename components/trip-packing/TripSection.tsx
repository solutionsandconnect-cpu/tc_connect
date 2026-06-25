'use client'

import { useState } from 'react'
import TripItem from './TripItem'
import { isItemDone } from '@/lib/tripsService'
import type { TripSection as TripSectionType, TripItem as TripItemType, TripMember } from '@/types'
import { memberCanToggle } from '@/lib/tripsService'
import { SUGGESTED_ITEMS } from './constants'
import {
  ChevronDownIcon, ChevronUpIcon, TrashIcon, PlusIcon, PencilIcon,
  CheckCircleIcon, XCircleIcon, DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'

type Filter = 'all' | 'todo' | 'done'

// Normalisation pour la recherche : minuscules + suppression des accents
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Props {
  section: TripSectionType
  nbJours: number | null
  members: TripMember[]
  tripId: string
  filter: Filter
  assigneeFilter: string
  search?: string
  collapsed?: boolean
  onToggleCollapse?: () => void
  isFirst: boolean
  isLast: boolean
  canEditSection?: boolean
  canAddItems?: boolean
  currentUserId?: string
  currentMember?: TripMember | null
  isOwner?: boolean
  photoMap?: Record<string, string>
  allItemNames?: string[]
  allSections?: { id: string; title: string }[]
  onCheckAll: () => void
  onUncheckAll: () => void
  onRename: (title: string) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
  onDuplicateSection: () => void
  onAddItem: (name: string) => void
  onUpdateItem: (itemId: string, patch: Partial<TripItemType>) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, dir: 'up' | 'down') => void
  onToggleItem: (itemId: string) => void
  onSetReady: (itemId: string, qty: number) => void
  onDuplicateItem: (itemId: string) => void
  onMoveItemToSection: (itemId: string, toSectionId: string) => void
}

export default function TripSection({
  section, nbJours, members, tripId, filter, assigneeFilter, search = '', collapsed = false, onToggleCollapse, isFirst, isLast,
  canEditSection = true, canAddItems = true, currentUserId = '', currentMember, isOwner = false, photoMap = {}, allItemNames = [], allSections = [],
  onCheckAll, onUncheckAll, onRename, onDelete, onMove, onDuplicateSection, onAddItem,
  onUpdateItem, onDeleteItem, onMoveItem, onToggleItem, onSetReady, onDuplicateItem, onMoveItemToSection,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)
  const [newItem, setNewItem] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1)
  const [confirmAction, setConfirmAction] = useState<'checkAll' | 'uncheckAll' | 'delete' | null>(null)

  const sortedItems = [...section.items].sort((a, b) => a.position - b.position)
  const total = sortedItems.length
  const done = sortedItems.filter(it => isItemDone(it, nbJours)).length

  const searchQ = norm(search.trim())
  // Si le titre de la section correspond, on affiche toute la section (sans filtrer ses articles par la recherche)
  const titleMatch = !!searchQ && norm(section.title).includes(searchQ)
  const visibleItems = sortedItems.filter(it => {
    // Filtre statut
    if (filter === 'todo' && isItemDone(it, nbJours)) return false
    if (filter === 'done' && !isItemDone(it, nbJours)) return false
    // Filtre responsable
    if (assigneeFilter === 'none' && it.assigneeId) return false
    if (assigneeFilter !== 'all' && assigneeFilter !== 'none' && it.assigneeId !== assigneeFilter) return false
    // Recherche (nom + note) — ignorée si le titre de la section correspond déjà
    if (searchQ && !titleMatch && !norm(it.name).includes(searchQ) && !(it.note && norm(it.note).includes(searchQ))) return false
    return true
  })

  // Pendant une recherche, on masque les sections sans correspondance (ni titre, ni article)
  if (searchQ && !titleMatch && visibleItems.length === 0) return null

  const commitTitle = () => {
    const v = titleDraft.trim()
    if (v && v !== section.title) onRename(v)
    else setTitleDraft(section.title)
    setEditing(false)
  }

  // Calcul des suggestions : prédéfinies + items existants de la liste, filtrées par saisie
  const currentSectionNames = new Set(section.items.map(it => it.name.toLowerCase()))
  const suggestions: string[] = (() => {
    const q = newItem.trim().toLowerCase()
    if (!q) return []
    const pool = [
      ...allItemNames.filter(n => !currentSectionNames.has(n.toLowerCase())),
      ...SUGGESTED_ITEMS.filter(n => !allItemNames.includes(n) && !currentSectionNames.has(n.toLowerCase())),
    ]
    const deduped = [...new Set(pool)]
    const starts = deduped.filter(n => n.toLowerCase().startsWith(q))
    const contains = deduped.filter(n => !n.toLowerCase().startsWith(q) && n.toLowerCase().includes(q))
    return [...starts, ...contains].slice(0, 6)
  })()

  const submitNewItem = (name?: string) => {
    const v = (name ?? newItem).trim()
    if (!v) return
    onAddItem(v)
    setNewItem('')
    setShowSuggestions(false)
    setSelectedSuggestion(-1)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedSuggestion(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedSuggestion(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedSuggestion >= 0 && suggestions[selectedSuggestion]) {
        submitNewItem(suggestions[selectedSuggestion])
      } else {
        submitNewItem()
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSelectedSuggestion(-1)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* En-tête section — toute la barre replie/déplie (sauf zones interactives) */}
      <div
        onClick={() => !editing && onToggleCollapse?.()}
        className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 cursor-pointer select-none"
      >
        {/* Indicateur replier (visuel — le clic est géré par la barre entière) */}
        <span className="p-0.5 text-gray-400 shrink-0" aria-hidden>
          {collapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
        </span>

        {/* Titre */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          {editing ? (
            <input
              autoFocus
              value={titleDraft}
              onClick={e => e.stopPropagation()}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') { setTitleDraft(section.title); setEditing(false) }
              }}
              className="flex-1 text-sm font-semibold border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-800 break-words min-w-0">{section.title}</h3>
              {canEditSection && (
                <button
                  onClick={e => { e.stopPropagation(); setTitleDraft(section.title); setEditing(true); setConfirmAction(null) }}
                  title="Renommer"
                  className="p-0.5 text-gray-300 hover:text-blue-500 transition shrink-0">
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Zone droite : confirmation OU actions normales */}
        {confirmAction ? (
          /* Confirmation inline */
          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-xs text-gray-600 font-medium">
              {confirmAction === 'checkAll' && 'Tout valider ?'}
              {confirmAction === 'uncheckAll' && 'Tout non valider ?'}
              {confirmAction === 'delete' && 'Supprimer la section ?'}
            </span>
            <button
              onClick={() => {
                if (confirmAction === 'checkAll') onCheckAll()
                else if (confirmAction === 'uncheckAll') onUncheckAll()
                else if (confirmAction === 'delete') onDelete()
                setConfirmAction(null)
              }}
              className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Oui
            </button>
            <button
              onClick={() => setConfirmAction(null)}
              className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
              <XCircleIcon className="w-3.5 h-3.5" /> Non
            </button>
          </div>
        ) : (
          /* Actions normales */
          <div className="flex items-center gap-1 shrink-0">
            {/* Badge progression */}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              total > 0 && done === total ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              {done}/{total}
            </span>

            {/* Tout valider */}
            {total > 0 && done < total && (
              <button
                onClick={e => { e.stopPropagation(); setConfirmAction('checkAll') }}
                title="Tout valider"
                className="text-[11px] font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 px-1.5 py-0.5 rounded-md transition">
                ✓ Tout
              </button>
            )}

            {/* Tout non valider */}
            {total > 0 && done > 0 && (
              <button
                onClick={e => { e.stopPropagation(); setConfirmAction('uncheckAll') }}
                title="Tout non valider"
                className="text-[11px] font-medium text-orange-600 border border-orange-200 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded-md transition">
                ✗ Tout
              </button>
            )}

            {/* Réordonnement + duplication + suppression */}
            {canEditSection && (
              <>
                <button onClick={e => { e.stopPropagation(); onDuplicateSection() }} aria-label="Dupliquer la section" title="Dupliquer la section"
                  className="p-1 text-gray-300 hover:text-blue-500 transition">
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); onMove('up') }} disabled={isFirst} aria-label="Monter"
                  className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
                  <ChevronUpIcon className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); onMove('down') }} disabled={isLast} aria-label="Descendre"
                  className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
                  <ChevronDownIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setConfirmAction('delete') }}
                  aria-label="Supprimer la section"
                  className="p-1 text-gray-300 hover:text-red-500 transition">
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {(!collapsed || !!searchQ) && (
        <div className="p-3 space-y-2">
          {visibleItems.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              {total === 0 ? 'Aucun check' : 'Aucun check dans ce filtre'}
            </p>
          ) : (
            visibleItems.map((item) => {
              // isFirst/isLast basés sur l'ordre réel (pas le filtre)
              const realIdx = sortedItems.findIndex(it => it.id === item.id)
              return (
                <TripItem
                  key={item.id}
                  item={item}
                  nbJours={nbJours}
                  members={members}
                  tripId={tripId}
                  photoMap={photoMap}
                  isFirst={realIdx === 0}
                  isLast={realIdx === sortedItems.length - 1}
                  canToggle={memberCanToggle(currentMember, isOwner, item.assigneeId, currentUserId)}
                  canEdit={canAddItems}
                  sectionId={section.id}
                  sections={allSections}
                  onToggle={() => onToggleItem(item.id)}
                  onSetReady={(qty) => onSetReady(item.id, qty)}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                  onDelete={() => onDeleteItem(item.id)}
                  onMove={(dir) => onMoveItem(item.id, dir)}
                  onDuplicate={() => onDuplicateItem(item.id)}
                  onMoveToSection={(toId) => onMoveItemToSection(item.id, toId)}
                />
              )
            })
          )}

          {/* Ajout d'article avec autocomplete */}
          {canAddItems && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newItem}
                  onChange={e => {
                    setNewItem(e.target.value)
                    setShowSuggestions(true)
                    setSelectedSuggestion(-1)
                  }}
                  onKeyDown={handleInputKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => { setShowSuggestions(false); setSelectedSuggestion(-1) }, 150)}
                  placeholder="Ajouter un check…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); submitNewItem(s) }}
                        className={`w-full text-left px-3 py-2 text-sm transition ${
                          i === selectedSuggestion
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
              <button onClick={() => submitNewItem()} disabled={!newItem.trim()} aria-label="Ajouter"
                className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
