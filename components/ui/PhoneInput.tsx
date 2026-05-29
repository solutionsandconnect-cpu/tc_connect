'use client'

import { useState, useEffect, useRef } from 'react'

export const INDICATIFS = [
  { code: '+33',  flag: '🇫🇷', pays: 'France' },
  { code: '+32',  flag: '🇧🇪', pays: 'Belgique' },
  { code: '+41',  flag: '🇨🇭', pays: 'Suisse' },
  { code: '+352', flag: '🇱🇺', pays: 'Luxembourg' },
  { code: '+377', flag: '🇲🇨', pays: 'Monaco' },
  { code: '+1',   flag: '🇺🇸', pays: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', pays: 'Royaume-Uni' },
  { code: '+49',  flag: '🇩🇪', pays: 'Allemagne' },
  { code: '+34',  flag: '🇪🇸', pays: 'Espagne' },
  { code: '+39',  flag: '🇮🇹', pays: 'Italie' },
  { code: '+351', flag: '🇵🇹', pays: 'Portugal' },
  { code: '+31',  flag: '🇳🇱', pays: 'Pays-Bas' },
  { code: '+212', flag: '🇲🇦', pays: 'Maroc' },
  { code: '+213', flag: '🇩🇿', pays: 'Algérie' },
  { code: '+216', flag: '🇹🇳', pays: 'Tunisie' },
  { code: '+225', flag: '🇨🇮', pays: "Côte d'Ivoire" },
  { code: '+221', flag: '🇸🇳', pays: 'Sénégal' },
  { code: '+237', flag: '🇨🇲', pays: 'Cameroun' },
]

export function buildWhatsAppUrl(indicatif: string, telephone: string, message?: string): string {
  const cleaned = telephone.replace(/[\s().+-]/g, '')
  const prefix = (indicatif || '+33').replace('+', '')
  const url = `https://wa.me/${prefix}${cleaned}`
  return message ? `${url}?text=${message}` : url
}

interface PhoneInputProps {
  indicatif: string
  telephone: string
  onIndicatifChange: (v: string) => void
  onTelephoneChange: (v: string) => void
  inputClassName?: string
  selectClassName?: string
  placeholder?: string
}

export function PhoneInput({
  indicatif,
  telephone,
  onIndicatifChange,
  onTelephoneChange,
  inputClassName,
  placeholder,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [customCode, setCustomCode] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const knownEntry = INDICATIFS.find((c) => c.code === indicatif)
  const selected = knownEntry || { code: indicatif || '+33', flag: '🌍', pays: 'Autre' }

  const filtered = search.trim()
    ? INDICATIFS.filter(
        (c) =>
          c.pays.toLowerCase().includes(search.toLowerCase()) ||
          c.code.includes(search)
      )
    : INDICATIFS

  // "Use this code" row when search looks like an unknown phone code
  const searchLooksLikeCode = /^\+?\d+$/.test(search.trim())
  const customSearchCode = search.trim().startsWith('+') ? search.trim() : search.trim() ? `+${search.trim()}` : ''
  const showUseRow = searchLooksLikeCode && customSearchCode && !INDICATIFS.some((c) => c.code === customSearchCode)

  const applyCustomCode = (raw: string) => {
    const code = raw.trim().startsWith('+') ? raw.trim() : `+${raw.trim()}`
    if (code.length > 1) {
      onIndicatifChange(code)
      setOpen(false)
      setCustomCode('')
    }
  }

  useEffect(() => {
    if (!open) { setSearch(''); setCustomCode(''); return }
    setTimeout(() => searchRef.current?.focus(), 30)
    const handler = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const base = 'border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="flex gap-2">
      {/* Flag button + dropdown */}
      <div ref={wrapperRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`${base} bg-white flex items-center gap-1 px-2 min-w-[3.5rem] justify-center`}
          title={`${selected.flag} ${selected.code} ${selected.pays}`}
        >
          <span className="text-xl leading-none">{selected.flag}</span>
          <svg className="w-3 h-3 text-gray-400 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[26rem]">
            {/* Search */}
            <div className="p-2 border-b border-gray-100 shrink-0">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Pays ou code (+261…)"
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400"
              />
            </div>

            {/* Country list */}
            <div className="overflow-y-auto flex-1">
              {showUseRow && (
                <button
                  type="button"
                  onClick={() => { onIndicatifChange(customSearchCode); setOpen(false) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-blue-50 transition text-left border-b border-gray-100"
                >
                  <span className="text-lg">🌍</span>
                  <span className="text-blue-600 font-mono text-xs w-10 shrink-0">{customSearchCode}</span>
                  <span className="text-blue-600 min-w-0 truncate font-medium">Utiliser ce code</span>
                </button>
              )}
              {filtered.length === 0 && !showUseRow && (
                <p className="text-xs text-gray-400 text-center py-4">Aucun résultat</p>
              )}
              {filtered.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => { onIndicatifChange(c.code); setOpen(false) }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 transition text-left ${c.code === indicatif ? 'bg-blue-50' : ''}`}
                >
                  <span className="text-lg">{c.flag}</span>
                  <span className="text-gray-500 w-10 shrink-0 font-mono text-xs">{c.code}</span>
                  <span className="text-gray-700 min-w-0 truncate">{c.pays}</span>
                </button>
              ))}
            </div>

            {/* Always-visible manual entry */}
            <div className="border-t border-gray-100 px-3 py-2.5 shrink-0 bg-gray-50">
              <p className="text-[11px] text-gray-400 mb-1.5">Indicatif personnalisé :</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="+261"
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 font-mono bg-white"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); applyCustomCode(customCode) }
                  }}
                />
                <button
                  type="button"
                  onClick={() => applyCustomCode(customCode)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Phone number input */}
      <input
        type="tel"
        value={telephone}
        onChange={(e) => onTelephoneChange(e.target.value)}
        placeholder={placeholder || '06 12 34 56 78'}
        className={inputClassName || `flex-1 ${base}`}
      />
    </div>
  )
}
