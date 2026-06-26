'use client'

import { useRef, useState } from 'react'

interface Props {
  title?: string
  subtitle?: string
  onConfirm: (dataUrl: string) => void
  onCancel: () => void
  consentLabel?: string   // si fourni, une case à cocher (ex. « Bon pour accord ») devient obligatoire avant de confirmer
  busy?: boolean          // envoi en cours → désactive les boutons (anti double-clic / double-envoi)
}

// Pavé de signature réutilisable (dessin ou import d'image). Renvoie un dataURL PNG.
export default function SignaturePad({ title = 'Signature', subtitle = 'Dessinez ci-dessous ou importez une image de signature.', onConfirm, onCancel, consentLabel, busy = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStroke, setHasStroke] = useState(false)
  const [consent, setConsent] = useState(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    e.preventDefault()
    setDrawing(true)
    lastPos.current = getPos(e, canvas)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !lastPos.current) return
    e.preventDefault()
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasStroke(true)
  }

  const endDraw = () => { setDrawing(false); lastPos.current = null }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
  }

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      const img = new Image()
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height, 1)
        const w = img.width * scale
        const h = img.height * scale
        ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)
        setHasStroke(true)
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-0.5">{title}</h2>
        <p className="text-xs text-gray-500 mb-4">{subtitle}</p>
        <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50 cursor-crosshair select-none">
          <canvas
            ref={canvasRef}
            width={600}
            height={180}
            className="w-full touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>
        <div className="flex items-center gap-3 mt-2">
          <button onClick={clear} className="text-xs text-gray-400 hover:text-red-500 transition underline">Effacer</button>
          <label className="text-xs text-blue-600 hover:text-blue-800 transition underline cursor-pointer">
            Importer une image
            <input type="file" accept="image/*" className="hidden" onChange={importFile} />
          </label>
        </div>
        {consentLabel && (
          <label className="flex items-start gap-2.5 mt-4 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
            />
            <span className="text-xs text-gray-700 leading-relaxed">{consentLabel}</span>
          </label>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} disabled={busy} className="flex-1 border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition">Annuler</button>
          <button
            onClick={() => { const c = canvasRef.current; if (c && hasStroke && (!consentLabel || consent) && !busy) onConfirm(c.toDataURL('image/png')) }}
            disabled={busy || !hasStroke || (!!consentLabel && !consent)}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg py-2.5 text-sm font-semibold transition"
          >
            {busy ? 'Signature en cours…' : '✓ Confirmer la signature'}
          </button>
        </div>
      </div>
    </div>
  )
}
