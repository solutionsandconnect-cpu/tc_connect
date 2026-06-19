'use client'

import { useEffect, useRef, useState } from 'react'

export interface SearchSelectOption {
  value: string
  label: string
  sublabel?: string
}

interface Props {
  value: string
  options: SearchSelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
}

// Liste déroulante avec barre de recherche intégrée (combobox léger, sans dépendance).
export default function SearchSelect({
  value,
  options,
  onChange,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Rechercher…',
  emptyText = 'Aucun résultat',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Une valeur vide = aucune sélection → on affiche le placeholder
  const selected = value ? options.find((o) => o.value === value) : undefined

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel ?? ''}`.toLowerCase().includes(q))
    : options

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`w-full border rounded-lg px-3 py-2 flex items-center justify-between gap-2 text-sm transition ${
          disabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
            : open
              ? 'border-blue-400 ring-2 ring-blue-100 bg-white'
              : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <span className={`truncate text-left ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full px-2 py-1.5 text-sm outline-none placeholder-gray-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-5 text-sm text-gray-400 text-center">{emptyText}</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value || '__empty'}
                  type="button"
                  onClick={() => choose(o.value)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition ${value === o.value ? 'bg-blue-50' : ''}`}
                >
                  <div className="text-sm text-gray-900">{o.label}</div>
                  {o.sublabel && <div className="text-xs text-gray-500 mt-0.5">{o.sublabel}</div>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
