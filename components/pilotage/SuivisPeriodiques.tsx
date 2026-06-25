'use client'

import { PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import type { SuiviPeriodique } from '@/types'
import { defaultSuivisPeriodiques, prochainSuivi } from '@/lib/pilotageSuivi'
import { randomUUID } from '@/lib/uuid'

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fmtFr = (d: Date) => d.toLocaleDateString('fr-FR')
const dOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const daysTo = (d: Date) => Math.round((dOnly(d).getTime() - dOnly(new Date()).getTime()) / 86_400_000)

// Éditeur des suivis périodiques d'un contrat (relevé quota, révision tarifaire…). Phase 2 du Pilotage.
// Liste générique configurable : libellé + intervalle (mois) + « fait le » → l'échéance se recalcule seule.
export default function SuivisPeriodiques({
  suivis, anchor, onChange,
}: {
  suivis: SuiviPeriodique[]
  anchor: Date              // ancre par défaut (date de début du contrat) si « dernier fait » vide
  onChange: (next: SuiviPeriodique[]) => void
}) {
  const update = (id: string, patch: Partial<SuiviPeriodique>) =>
    onChange(suivis.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  const remove = (id: string) => onChange(suivis.filter((s) => s.id !== id))
  const add = () => onChange([...suivis, { id: randomUUID(), label: '', intervalleMois: 3 }])

  if (suivis.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-sm text-gray-500">Aucun suivi récurrent configuré.</p>
        <p className="text-xs text-gray-400 max-w-md mx-auto">Programme des rappels périodiques (relevé du quota d'utilisateurs, révision tarifaire annuelle…) : l'échéance revient automatiquement à chaque fois que tu coches « Fait ».</p>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => onChange(defaultSuivisPeriodiques())}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition">
            Ajouter les suivis par défaut
          </button>
          <button type="button" onClick={add}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
            <PlusIcon className="w-4 h-4" /> Suivi vierge
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Rappels récurrents internes. L'échéance se calcule depuis « dernier fait » (ou la date de début du contrat) + l'intervalle.
        Coche <strong>« Fait aujourd'hui »</strong> à chaque relevé : la prochaine échéance se décale toute seule. Apparaît dans « À suivre » à ≤ 7 j.
      </p>

      <div className="space-y-2">
        {suivis.map((s) => {
          const prochain = prochainSuivi(s, anchor)
          const to = daysTo(prochain)
          const badge = to < 0
            ? { txt: `En retard de ${-to} j`, cls: 'bg-rose-100 text-rose-700' }
            : to <= 7
              ? { txt: to === 0 ? "Aujourd'hui" : `Dans ${to} j`, cls: 'bg-amber-100 text-amber-700' }
              : { txt: `Dans ${to} j`, cls: 'bg-gray-100 text-gray-500' }
          return (
            <div key={s.id} className="border border-gray-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <input type="text" value={s.label} placeholder="Libellé du suivi"
                  onChange={(e) => update(s.id, { label: e.target.value })}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <span className={`shrink-0 text-[11px] font-medium px-2 py-1 rounded-full ${badge.cls}`}>{badge.txt}</span>
                <button type="button" onClick={() => remove(s.id)} title="Supprimer ce suivi"
                  className="shrink-0 p-1.5 text-gray-400 hover:text-rose-600 transition">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-500">Tous les (mois)</span>
                  <input type="number" inputMode="numeric" min="1" step="1" value={s.intervalleMois}
                    onChange={(e) => update(s.id, { intervalleMois: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-500">Dernier fait le</span>
                  <input type="date" value={s.dernierFait ?? ''}
                    onChange={(e) => update(s.id, { dernierFait: e.target.value || undefined })}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </label>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-gray-500">Prochaine échéance</span>
                  <span className="text-sm text-gray-700 py-1.5">{fmtFr(prochain)}</span>
                </div>
                <button type="button" onClick={() => update(s.id, { dernierFait: ymd(new Date()) })}
                  className="ml-auto flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition">
                  <CheckIcon className="w-4 h-4" /> Fait aujourd'hui
                </button>
              </div>
              <input type="text" value={s.note ?? ''} placeholder="Note (ex. dernier relevé : 142 / 150 utilisateurs)"
                onChange={(e) => update(s.id, { note: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )
        })}
      </div>

      <button type="button" onClick={add}
        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
        <PlusIcon className="w-4 h-4" /> Ajouter un suivi
      </button>
    </div>
  )
}
