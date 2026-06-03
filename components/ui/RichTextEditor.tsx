'use client'

import { useRef, useEffect } from 'react'

const COLORS = ['#111827', '#dc2626', '#ea580c', '#16a34a', '#2563eb', '#7c3aed']

function isHtml(s: string) {
  return /<[a-z][\s\S]*>/i.test(s)
}

function ToolbarButton({ onClick, children, title }: { onClick: () => void; children: React.ReactNode; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()} // garde la sélection dans l'éditeur
      onClick={onClick}
      className="min-w-[28px] h-7 px-1.5 flex items-center justify-center rounded text-sm text-gray-600 hover:bg-gray-200 transition"
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 170,
}: {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Synchronise le contenu quand il change de l'extérieur (ouverture du modal),
  // sans réécrire pendant la saisie (sinon le curseur saute).
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const html = isHtml(value) ? value : (value || '').replace(/\n/g, '<br>')
    if (el.innerHTML !== html) el.innerHTML = html
  }, [value])

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }

  const empty = !value || value === '<br>' || value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === ''

  return (
    <div className="border rounded-lg overflow-hidden focus-within:border-blue-400 transition">
      {/* Barre d'outils */}
      <div className="flex items-center gap-0.5 flex-wrap border-b bg-gray-50 px-1.5 py-1">
        <ToolbarButton onClick={() => exec('bold')} title="Gras"><span className="font-bold">G</span></ToolbarButton>
        <ToolbarButton onClick={() => exec('italic')} title="Italique"><span className="italic font-serif">I</span></ToolbarButton>
        <ToolbarButton onClick={() => exec('underline')} title="Souligné"><span className="underline">S</span></ToolbarButton>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarButton onClick={() => exec('insertUnorderedList')} title="Liste à puces">• ≣</ToolbarButton>
        <ToolbarButton onClick={() => exec('insertOrderedList')} title="Liste numérotée">1.</ToolbarButton>
        <span className="w-px h-5 bg-gray-200 mx-1" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title="Couleur du texte"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('foreColor', c)}
            className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="w-px h-5 bg-gray-200 mx-1" />
        <ToolbarButton onClick={() => exec('removeFormat')} title="Effacer la mise en forme">✕ format</ToolbarButton>
      </div>

      {/* Zone éditable */}
      <div className="relative">
        {empty && placeholder && (
          <div className="absolute top-2.5 left-3 text-sm text-gray-400 pointer-events-none">{placeholder}</div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={() => onChange(ref.current?.innerHTML ?? '')}
          className="rich-content w-full px-3 py-2.5 text-sm outline-none overflow-y-auto"
          style={{ minHeight }}
        />
      </div>
    </div>
  )
}
