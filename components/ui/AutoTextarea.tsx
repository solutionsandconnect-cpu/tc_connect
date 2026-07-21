'use client'

import { useEffect, useRef } from 'react'

/**
 * Champ texte non étirable qui grandit vers le bas au fil de la saisie
 * (retour à la ligne ou texte long) — pas de poignée de redimensionnement,
 * pas de barre de défilement interne, donc jamais de texte masqué.
 *
 * `minRows` fixe la hauteur de départ : avec `height: auto`, le navigateur
 * retombe sur la hauteur dictée par l'attribut `rows`, et `scrollHeight` ne
 * descend jamais en dessous — le minimum est donc respecté sans calcul manuel.
 */
export default function AutoTextarea({
  value, onChange, placeholder, className, minRows = 2, id,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  minRows?: number
  id?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      id={id}
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${className ?? ''} resize-none overflow-hidden block`}
    />
  )
}
