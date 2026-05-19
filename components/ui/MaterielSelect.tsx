'use client'

import { useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'

const MATERIEL_OPTIONS = [
  'Sac', 'Tapis', 'Enceinte', 'Chrono',
  'Elastiques', 'Bande élastiques', 'Haltères'
]

interface Props {
  value: string[]
  onChange: (value: string[]) => void
}

export default function MaterielSelect({ value, onChange }: Props) {
  const [custom, setCustom] = useState('')

  const toggle = (item: string) => {
    if (value.includes(item)) {
      onChange(value.filter((v) => v !== item))
    } else {
      onChange([...value, item])
    }
  }

  const addCustom = () => {
    const trimmed = custom.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setCustom('')
  }

  // Tous les items = options fixes + items custom non présents dans les options fixes
  const allOptions = [
    ...MATERIEL_OPTIONS,
    ...value.filter((v) => !MATERIEL_OPTIONS.includes(v))
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {allOptions.map((item) => {
          const isSelected = value.includes(item)
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              {item}
            </button>
          )
        })}
      </div>
      {/* Ajout libre */}
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
          placeholder="Autre matériel..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={addCustom}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}