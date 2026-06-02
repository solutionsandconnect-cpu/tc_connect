'use client'

import type { PainPoint } from '@/types'
import { ZONES_DOULEUR } from '@/lib/painZones'

// Sélecteur de zones de douleur : boutons (toggle) + curseur d'intensité.
// Utilisé dans le questionnaire client et le modal "Modifier" côté coach.
export default function PainZoneSelector({ value, onChange }: { value: PainPoint[]; onChange: (v: PainPoint[]) => void }) {
  const selMap = Object.fromEntries(value.map((p) => [p.zone, p]))

  const toggle = (id: string) => {
    if (selMap[id]) onChange(value.filter((p) => p.zone !== id))
    else onChange([...value, { zone: id, intensite: 5, type: '' }])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ZONES_DOULEUR.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => toggle(id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              selMap[id]
                ? 'bg-red-500 text-white border-red-500'
                : 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="space-y-2 mt-2">
          {value.map((p) => {
            const lbl = ZONES_DOULEUR.find((z) => z.id === p.zone)?.label ?? p.zone
            return (
              <div key={p.zone} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-800 flex-1 font-medium">{lbl}</span>
                <input type="range" min={1} max={10} value={p.intensite}
                  onChange={(e) => onChange(value.map((x) => x.zone === p.zone ? { ...x, intensite: Number(e.target.value) } : x))}
                  className="w-24 accent-red-500" />
                <span className="text-xs text-red-600 font-semibold w-10 text-right">{p.intensite}/10</span>
                <button type="button" onClick={() => onChange(value.filter((x) => x.zone !== p.zone))}
                  className="text-gray-400 hover:text-red-500 text-sm ml-1">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
