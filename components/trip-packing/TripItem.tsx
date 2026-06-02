'use client'

import { useState } from 'react'
import { qtyEffective } from '@/lib/tripsService'
import type { TripItem as TripItemType, TripMember } from '@/types'
import {
  CheckIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon,
  MinusIcon, PlusIcon,
} from '@heroicons/react/24/outline'

interface Props {
  item: TripItemType
  nbJours: number | null
  members: TripMember[]
  isFirst: boolean
  isLast: boolean
  onToggle: () => void
  onSetReady: (qty: number) => void
  onUpdate: (patch: Partial<TripItemType>) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
}

function memberLabel(m: TripMember): string {
  return [m.prenom, m.nom].filter(Boolean).join(' ') || m.email || m.uid.slice(0, 6)
}

export default function TripItem({
  item, nbJours, members, isFirst, isLast,
  onToggle, onSetReady, onUpdate, onDelete, onMove,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(item.name)

  const eff = qtyEffective(item, nbJours)
  const done = item.qtyReady >= eff

  const assignee = members.find(m => m.uid === item.assigneeId)

  const commitName = () => {
    const v = nameDraft.trim()
    if (v && v !== item.name) onUpdate({ name: v })
    else setNameDraft(item.name)
    setEditingName(false)
  }

  return (
    <div className={`rounded-xl border transition ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        {/* Flèches réordonnancement */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <button onClick={() => onMove('up')} disabled={isFirst} aria-label="Monter"
            className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove('down')} disabled={isLast} aria-label="Descendre"
            className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Checkbox rapide */}
        <button
          onClick={onToggle}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? 'Marquer comme à préparer' : 'Marquer comme prêt'}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
            done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'
          }`}
        >
          {done && <CheckIcon className="w-4 h-4" strokeWidth={3} />}
        </button>

        {/* Nom (double-clic pour renommer) */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(item.name); setEditingName(false) } }}
              className="w-full text-sm border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <p
              onDoubleClick={() => { setNameDraft(item.name); setEditingName(true) }}
              className={`text-sm truncate cursor-text ${done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}
              title="Double-cliquer pour renommer"
            >
              {item.name}
            </p>
          )}
          {(assignee || item.note) && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {assignee && (
                <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  {memberLabel(assignee)}
                </span>
              )}
              {item.note && <span className="text-[11px] text-gray-400 truncate">📝 {item.note}</span>}
            </div>
          )}
        </div>

        {/* Stepper qtyReady / qtyEffective */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onSetReady(item.qtyReady - 1)} disabled={item.qtyReady <= 0} aria-label="Moins"
            className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition">
            <MinusIcon className="w-3.5 h-3.5" />
          </button>
          <span className={`text-xs font-semibold tabular-nums min-w-[42px] text-center ${done ? 'text-green-600' : 'text-gray-700'}`}>
            {item.qtyReady}/{eff}
          </span>
          <button onClick={() => onSetReady(item.qtyReady + 1)} disabled={item.qtyReady >= eff} aria-label="Plus"
            className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition">
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Toggle panneau */}
        <button onClick={() => setExpanded(v => !v)} aria-label="Détails" aria-expanded={expanded}
          className="p-1 text-gray-400 hover:text-gray-600 shrink-0 transition">
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Panneau extensible */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/60 rounded-b-xl">
          {/* Note */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Note / commentaire</label>
            <input
              type="text"
              value={item.note ?? ''}
              onChange={e => onUpdate({ note: e.target.value })}
              placeholder="Ex : à acheter avant le départ…"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* qtyNeeded fixe */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Quantité fixe</label>
              <div className="flex items-center gap-1">
                <button onClick={() => onUpdate({ qtyNeeded: Math.max(1, item.qtyNeeded - 1) })} aria-label="Moins"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-8 text-center">{item.qtyNeeded}</span>
                <button onClick={() => onUpdate({ qtyNeeded: item.qtyNeeded + 1 })} aria-label="Plus"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              {item.multiplier > 0 && <p className="text-[10px] text-gray-400 mt-1">Ignoré (multiplicateur actif)</p>}
            </div>

            {/* multiplier / jour */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Par jour (×)</label>
              <div className="flex items-center gap-1">
                <button onClick={() => onUpdate({ multiplier: Math.max(0, Math.round(item.multiplier) - 1) })} aria-label="Moins"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-8 text-center">{item.multiplier || '—'}</span>
                <button onClick={() => onUpdate({ multiplier: Math.round(item.multiplier) + 1 })} aria-label="Plus"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              {item.multiplier > 0 && (
                <p className="text-[10px] text-blue-500 mt-1">
                  {nbJours ? `→ ${eff} pour ${nbJours} j` : 'Définir des dates'}
                </p>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">{"Qui s'en occupe"}</label>
            <select
              value={item.assigneeId ?? ''}
              onChange={e => onUpdate({ assigneeId: e.target.value || null })}
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">— Personne —</option>
              {members.map(m => <option key={m.uid} value={m.uid}>{memberLabel(m)}</option>)}
            </select>
          </div>

          {/* Supprimer */}
          <button onClick={onDelete}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition">
            <TrashIcon className="w-3.5 h-3.5" />
            Supprimer cet article
          </button>
        </div>
      )}
    </div>
  )
}
