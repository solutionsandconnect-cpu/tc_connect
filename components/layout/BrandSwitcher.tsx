'use client'

// Sélecteur « changer d'espace » (comptes multi-univers) — dropdown workspace.
// Réutilisé dans la sidebar (Navbar) et en haut de l'Accueil sur mobile.

import { useEffect, useRef, useState } from 'react'
import { ChevronUpDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { BRANDS, type Brand } from '@/lib/brand'

// Logo de la marque (fichier dans /public, cf. BRANDS[b].logo).
export function BrandMark({ b, className = 'w-5 h-5' }: { b: Brand; className?: string }) {
  return <img src={BRANDS[b].logo} alt="" className={`${className} object-contain shrink-0`} />
}

// Bouton = espace actif (logo + nom + chevron) ; menu = liste des espaces avec coche.
export function BrandSwitcher({ brands, active, onSelect, openUp = false, className = '' }: {
  brands: Brand[]; active: Brand; onSelect: (b: Brand) => void; openUp?: boolean; className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
      >
        <BrandMark b={active} />
        <span className="flex-1 text-left truncate">{BRANDS[active].nom}</span>
        <ChevronUpDownIcon className="w-4 h-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 ${
            openUp ? 'bottom-full mb-1' : 'top-full mt-1'
          }`}
        >
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              role="option"
              aria-selected={b === active}
              onClick={() => { onSelect(b); setOpen(false) }}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-sm text-left transition ${
                b === active ? 'bg-gray-50 text-gray-900 font-semibold' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <BrandMark b={b} />
              <span className="flex-1 truncate">{BRANDS[b].nom}</span>
              {b === active && (
                <CheckIcon
                  className="w-4 h-4 shrink-0"
                  // Or sous Enezo (accent rare), primaire ailleurs — cf. --brand-accent (globals.css).
                  style={{ color: 'var(--brand-accent, var(--color-blue-600))' }}
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
