'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPinIcon } from '@heroicons/react/24/outline'

interface Suggestion {
  label: string
  value: string
  adresse?: string
  ville?: string
  code_postal?: string
  lat?: number
  lng?: number
}

export interface SelectedAddress {
  adresse: string
  ville: string
  code_postal: string
  label: string
  lat?: number
  lng?: number
}

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectFull?: (data: SelectedAddress) => void
  placeholder?: string
}

export default function AdresseAutocomplete({ value, onChange, onSelectFull, placeholder }: Props) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Sync si value change depuis l'extérieur
  useEffect(() => {
    setQuery(value)
  }, [value])

  // Fermer si clic en dehors
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = async (q: string) => {
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
      )
      const data = await res.json()
      setSuggestions(
        data.features.map((f: any) => ({
          label: f.properties.label,
          value: f.properties.label,
          adresse: f.properties.name || f.properties.label,
          ville: f.properties.city || '',
          code_postal: f.properties.postcode || '',
          lat: f.geometry?.coordinates?.[1],
          lng: f.geometry?.coordinates?.[0],
        }))
      )
      setShowSuggestions(true)
    } catch {
      setSuggestions([])
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.value)
    onChange(suggestion.value)
    if (onSelectFull) {
      onSelectFull({
        adresse: suggestion.adresse ?? suggestion.value,
        ville: suggestion.ville ?? '',
        code_postal: suggestion.code_postal ?? '',
        label: suggestion.label,
        lat: suggestion.lat,
        lng: suggestion.lng,
      })
    }
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPinIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder || "Rechercher une adresse..."}
          className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 transition border-b border-gray-50 last:border-0"
            >
              📍 {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}