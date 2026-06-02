'use client'

import { useState } from 'react'
import TripItem from './TripItem'
import { isItemDone } from '@/lib/tripsService'
import type { TripSection as TripSectionType, TripItem as TripItemType, TripMember } from '@/types'
import {
  ChevronDownIcon, ChevronUpIcon, TrashIcon, PlusIcon,
} from '@heroicons/react/24/outline'

type Filter = 'all' | 'todo' | 'done'

interface Props {
  section: TripSectionType
  nbJours: number | null
  members: TripMember[]
  filter: Filter
  assigneeFilter: string
  isFirst: boolean
  isLast: boolean
  onRename: (title: string) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
  onAddItem: (name: string) => void
  onUpdateItem: (itemId: string, patch: Partial<TripItemType>) => void
  onDeleteItem: (itemId: string) => void
  onMoveItem: (itemId: string, dir: 'up' | 'down') => void
  onToggleItem: (itemId: string) => void
  onSetReady: (itemId: string, qty: number) => void
}

export default function TripSection({
  section, nbJours, members, filter, assigneeFilter, isFirst, isLast,
  onRename, onDelete, onMove, onAddItem,
  onUpdateItem, onDeleteItem, onMoveItem, onToggleItem, onSetReady,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(section.title)
  const [newItem, setNewItem] = useState('')

  const sortedItems = [...section.items].sort((a, b) => a.position - b.position)
  const total = sortedItems.length
  const done = sortedItems.filter(it => isItemDone(it, nbJours)).length

  const visibleItems = sortedItems.filter(it => {
    // Filtre statut
    if (filter === 'todo' && isItemDone(it, nbJours)) return false
    if (filter === 'done' && !isItemDone(it, nbJours)) return false
    // Filtre responsable
    if (assigneeFilter === 'none' && it.assigneeId) return false
    if (assigneeFilter !== 'all' && assigneeFilter !== 'none' && it.assigneeId !== assigneeFilter) return false
    return true
  })

  const commitTitle = () => {
    const v = titleDraft.trim()
    if (v && v !== section.title) onRename(v)
    else setTitleDraft(section.title)
    setEditing(false)
  }

  const submitNewItem = () => {
    const v = newItem.trim()
    if (!v) return
    onAddItem(v)
    setNewItem('')
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête section */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
        <button onClick={() => setCollapsed(c => !c)} aria-label="Replier"
          className="p-0.5 text-gray-400 hover:text-gray-600 transition shrink-0">
          {collapsed ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') { setTitleDraft(section.title); setEditing(false) } }}
              className="w-full text-sm font-semibold border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <h3
              onDoubleClick={() => { setTitleDraft(section.title); setEditing(true) }}
              className="text-sm font-semibold text-gray-800 truncate cursor-text"
              title="Double-cliquer pour renommer"
            >
              {section.title}
            </h3>
          )}
        </div>

        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
          total > 0 && done === total ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {done}/{total}
        </span>

        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onMove('up')} disabled={isFirst} aria-label="Monter la section"
            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove('down')} disabled={isLast} aria-label="Descendre la section"
            className="p-1 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} aria-label="Supprimer la section"
            className="p-1 text-gray-300 hover:text-red-500 transition">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {visibleItems.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">
              {total === 0 ? 'Aucun article' : 'Aucun article dans ce filtre'}
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
                  isFirst={realIdx === 0}
                  isLast={realIdx === sortedItems.length - 1}
                  onToggle={() => onToggleItem(item.id)}
                  onSetReady={(qty) => onSetReady(item.id, qty)}
                  onUpdate={(patch) => onUpdateItem(item.id, patch)}
                  onDelete={() => onDeleteItem(item.id)}
                  onMove={(dir) => onMoveItem(item.id, dir)}
                />
              )
            })
          )}

          {/* Ajout d'article */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitNewItem() }}
              placeholder="Ajouter un article…"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button onClick={submitNewItem} disabled={!newItem.trim()} aria-label="Ajouter"
              className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition shrink-0">
              <PlusIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
