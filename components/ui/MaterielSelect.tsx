'use client'

import { useState, useEffect, useMemo } from 'react'
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

const MATERIEL_BASE = [
  'Sac', 'Tapis', 'Enceinte', 'Chrono', 'Elastiques', 'Bandes élastiques', 'Haltères',
]
const STORAGE_KEY = 'tc_materiel_custom'

function loadCustom(): string[] {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v ? JSON.parse(v) : []
  } catch { return [] }
}

function saveCustom(items: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch {}
}

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function MaterielSelect({ value, onChange }: Props) {
  const [customItems, setCustomItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setCustomItems(loadCustom())
  }, [])

  const allOptions = useMemo(() => {
    const base = [...MATERIEL_BASE, ...customItems]
    for (const v of value) {
      if (!base.includes(v)) base.push(v)
    }
    return base
  }, [customItems, value])

  const availableOptions = useMemo(() => {
    const unselected = allOptions.filter((o) => !value.includes(o))
    if (!search.trim()) return unselected
    return unselected.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
  }, [allOptions, value, search])

  const toggle = (item: string) => {
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item])
  }

  const addNew = () => {
    const trimmed = newItem.trim()
    if (!trimmed) return
    const updated = customItems.includes(trimmed) ? customItems : [...customItems, trimmed]
    setCustomItems(updated)
    saveCustom(updated)
    if (!value.includes(trimmed)) onChange([...value, trimmed])
    setNewItem('')
  }

  return (
    <div className="space-y-2.5">
      {/* Sélectionnés */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <span key={item} className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
              {item}
              <button type="button" onClick={() => toggle(item)} className="hover:bg-blue-700 rounded-full p-0.5 transition">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Recherche */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrer le matériel disponible..."
        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Options disponibles */}
      {availableOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto py-0.5">
          {availableOptions.map((item) => (
            <button key={item} type="button" onClick={() => toggle(item)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition">
              + {item}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic py-0.5">
          {search.trim() ? 'Aucun résultat' : value.length > 0 ? 'Tout est sélectionné' : ''}
        </p>
      )}

      {/* Ajouter */}
      <div className="flex gap-2 pt-0.5">
        <input type="text" value={newItem} onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNew())}
          placeholder="Nouveau matériel..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={addNew}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
