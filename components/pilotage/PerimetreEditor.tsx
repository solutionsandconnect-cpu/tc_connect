'use client'

import { useState } from 'react'
import type { DevisOption } from '@/types'
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, PencilIcon, CheckIcon } from '@heroicons/react/24/outline'

// Élément de la liste unifiée « hors périmètre / option ». Édité en un seul endroit,
// puis réparti à la persistance : type 'exclu' → projet.horsPerimetre ; 'option' → optionsDevis.
export type PerimetreItem = { label: string; type: 'exclu' | 'option'; description?: string; prixMin?: number; prixMax?: number }

export function splitPerimetre(items: PerimetreItem[]): { horsPerimetre: string[]; options: DevisOption[] } {
  const horsPerimetre = items.filter((i) => i.type === 'exclu' && i.label.trim()).map((i) => i.label.trim())
  const options: DevisOption[] = items
    .filter((i) => i.type === 'option' && i.label.trim())
    .map((i) => ({ label: i.label.trim(), description: i.description?.trim() || undefined, prixMin: i.prixMin, prixMax: i.prixMax }))
  return { horsPerimetre, options }
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const fmtPrice = (it: PerimetreItem) =>
  it.prixMin != null && it.prixMax != null ? `${it.prixMin} – ${it.prixMax} €` : it.prixMin != null ? `${it.prixMin} €` : 'sur devis'

// Champs d'édition d'une ligne (réutilisés pour l'édition inline ET le formulaire d'ajout).
function RowFields({ value, onPatch }: { value: PerimetreItem; onPatch: (patch: Partial<PerimetreItem>) => void }) {
  return (
    <>
      <input className={inp} value={value.label} placeholder="Intitulé…" onChange={(e) => onPatch({ label: e.target.value })} />
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button type="button" onClick={() => onPatch({ type: 'exclu' })} className={`px-3 py-1 transition ${value.type === 'exclu' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Hors périmètre</button>
          <button type="button" onClick={() => onPatch({ type: 'option' })} className={`px-3 py-1 transition ${value.type === 'option' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Option (devis)</button>
        </div>
        <span className="text-[11px] text-gray-400">{value.type === 'exclu' ? '→ cahier des charges' : '→ devis'}</span>
      </div>
      {value.type === 'option' && (
        <>
          <textarea rows={2} className={`${inp} resize-none`} value={value.description ?? ''} placeholder="Description (optionnel)" onChange={(e) => onPatch({ description: e.target.value })} />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Prix</span>
            <input type="number" placeholder="min €" value={value.prixMin ?? ''} onChange={(e) => onPatch({ prixMin: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-xs text-gray-400">à</span>
            <input type="number" placeholder="max € (optionnel)" value={value.prixMax ?? ''} onChange={(e) => onPatch({ prixMax: e.target.value === '' ? undefined : Number(e.target.value) })}
              className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-xs text-gray-400">vide = « sur devis »</span>
          </div>
        </>
      )}
    </>
  )
}

export function PerimetreEditor({ items, onChange, onCommit }: {
  items: PerimetreItem[]
  onChange: (next: PerimetreItem[]) => void  // édition inline live (frappe) — pas de sauvegarde
  onCommit: (next: PerimetreItem[]) => void  // sauvegarde (ajout · « Terminer » · suppression · réordre)
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<PerimetreItem>({ label: '', type: 'exclu' })

  const upd = (i: number, patch: Partial<PerimetreItem>) => items.map((it, idx) => (idx === i ? { ...it, ...patch } : it))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    onCommit(next)
  }
  const addDraft = () => {
    if (!draft.label.trim()) return
    onCommit([...items, draft])
    setDraft({ label: '', type: 'exclu' })
    setAdding(false)
  }

  return (
    <div className="space-y-2">
      {items.map((it, i) => editIdx === i ? (
        <div key={i} className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50/30">
          <RowFields value={it} onPatch={(patch) => onChange(upd(i, patch))} />
          <div className="flex justify-end">
            <button onClick={() => { onCommit(items); setEditIdx(null) }}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition">
              <CheckIcon className="w-4 h-4" /> Terminer
            </button>
          </div>
        </div>
      ) : (
        <div key={i} className={`flex items-start gap-2 border border-gray-200 border-l-4 rounded-lg p-3 ${it.type === 'exclu' ? 'border-l-amber-400 bg-amber-50/30' : 'border-l-blue-400 bg-blue-50/30'}`}>
          <div className="flex flex-col shrink-0 -my-0.5">
            <button onClick={() => move(i, -1)} disabled={i === 0} title="Monter"
              className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300 transition"><ChevronUpIcon className="w-4 h-4" /></button>
            <button onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Descendre"
              className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:hover:text-gray-300 transition"><ChevronDownIcon className="w-4 h-4" /></button>
          </div>
          <span className={`shrink-0 mt-0.5 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${it.type === 'exclu' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{it.type === 'exclu' ? 'Hors périmètre' : 'Option'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{it.label || <span className="text-gray-400">Sans titre</span>}</p>
            {it.type === 'option' && it.description && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{it.description}</p>}
          </div>
          {it.type === 'option' && <span className="text-sm font-semibold text-gray-700 shrink-0 whitespace-nowrap">{fmtPrice(it)}</span>}
          <button onClick={() => setEditIdx(i)} className="p-1.5 text-gray-300 hover:text-blue-600 transition shrink-0" title="Modifier la ligne"><PencilIcon className="w-4 h-4" /></button>
          <button onClick={() => { onCommit(items.filter((_, idx) => idx !== i)); setEditIdx(null) }} className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0" title="Supprimer la ligne"><TrashIcon className="w-4 h-4" /></button>
        </div>
      ))}

      {adding ? (
        <div className="border border-dashed border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50/30">
          <p className="text-xs font-medium text-gray-600">Nouvelle ligne</p>
          <RowFields value={draft} onPatch={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          <div className="flex items-center gap-2">
            <button onClick={addDraft} disabled={!draft.label.trim()}
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition">
              <PlusIcon className="w-4 h-4" /> Ajouter
            </button>
            <button onClick={() => { setAdding(false); setDraft({ label: '', type: 'exclu' }) }} className="text-sm font-medium text-gray-500 hover:text-gray-700 px-2 py-1.5 transition">Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
          <PlusIcon className="w-4 h-4" /> Ajouter une ligne
        </button>
      )}
    </div>
  )
}
