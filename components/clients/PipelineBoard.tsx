'use client'

import { useMemo, useState } from 'react'
import type { Client } from '@/types'

export type PipelineStage = 'nouveau' | 'contacte' | 'rdv' | 'devis' | 'nego' | 'signe' | 'perdu'

export const PIPELINE_STAGES: { key: PipelineStage; label: string; dot: string; head: string }[] = [
  { key: 'nouveau', label: 'Nouveau', dot: 'bg-gray-400', head: 'text-gray-600' },
  { key: 'contacte', label: 'Contacté', dot: 'bg-sky-500', head: 'text-sky-700' },
  { key: 'rdv', label: 'RDV', dot: 'bg-indigo-500', head: 'text-indigo-700' },
  { key: 'devis', label: 'Devis envoyé', dot: 'bg-amber-500', head: 'text-amber-700' },
  { key: 'nego', label: 'Négociation', dot: 'bg-orange-500', head: 'text-orange-700' },
  { key: 'signe', label: 'Signé', dot: 'bg-green-500', head: 'text-green-700' },
  { key: 'perdu', label: 'Perdu', dot: 'bg-red-400', head: 'text-red-600' },
]
const STAGE_LABEL: Record<PipelineStage, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s.label]),
) as Record<PipelineStage, string>

function clientName(c: Client): string {
  return [c.nom, c.prenom].filter(Boolean).join(' ').trim() || 'Client'
}
function stageOf(c: Client): PipelineStage {
  return (c.pipelineStage as PipelineStage) ?? 'nouveau'
}

interface Props {
  clients: Client[]
  search?: string
  onOpen: (client: Client) => void
  onMove: (client: Client, stage: PipelineStage) => void
}

export default function PipelineBoard({ clients, search, onOpen, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<PipelineStage | null>(null)

  // Sont dans le pipeline : les prospects + tout client déjà placé sur une étape (gagné/perdu inclus).
  const pipelineClients = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase()
    return clients.filter((c) => {
      const inPipeline = c.statut === 'Prospect' || !!c.pipelineStage
      if (!inPipeline) return false
      if (!q) return true
      return [c.nom, c.prenom, c.email, c.nomEntreprise].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [clients, search])

  const byStage = useMemo(() => {
    const map: Record<PipelineStage, Client[]> = {
      nouveau: [], contacte: [], rdv: [], devis: [], nego: [], signe: [], perdu: [],
    }
    for (const c of pipelineClients) map[stageOf(c)].push(c)
    for (const k of Object.keys(map) as PipelineStage[]) {
      map[k].sort((a, b) => (b.pipelineUpdatedAt?.seconds ?? 0) - (a.pipelineUpdatedAt?.seconds ?? 0))
    }
    return map
  }, [pipelineClients])

  const drop = (stage: PipelineStage) => {
    const c = clients.find((x) => x.id === dragId)
    setDragId(null); setOverStage(null)
    if (c && stageOf(c) !== stage) onMove(c, stage)
  }

  if (pipelineClients.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm py-14 text-center">
        <p className="text-gray-400 text-sm">Aucun prospect dans le pipeline.</p>
        <p className="text-gray-400 text-xs mt-1">Les clients au statut « Prospect » apparaissent ici automatiquement.</p>
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {PIPELINE_STAGES.map((s) => {
        const cards = byStage[s.key]
        const isOver = overStage === s.key
        return (
          <div
            key={s.key}
            onDragOver={(e) => { e.preventDefault(); setOverStage(s.key) }}
            onDragLeave={() => setOverStage((v) => (v === s.key ? null : v))}
            onDrop={() => drop(s.key)}
            className={`shrink-0 w-60 rounded-xl border transition ${isOver ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200 bg-gray-50'}`}
          >
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-200/70 sticky top-0">
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              <span className={`text-sm font-semibold ${s.head}`}>{s.label}</span>
              <span className="ml-auto text-xs text-gray-400">{cards.length}</span>
            </div>

            <div className="p-2 space-y-2 min-h-[80px]">
              {cards.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragId(c.id)}
                  onDragEnd={() => { setDragId(null); setOverStage(null) }}
                  onClick={() => onOpen(c)}
                  className={`bg-white rounded-lg border border-gray-100 shadow-sm px-3 py-2.5 cursor-pointer hover:border-blue-300 transition ${dragId === c.id ? 'opacity-50' : ''}`}
                >
                  <p className="text-sm font-semibold text-gray-800 truncate">{clientName(c)}</p>
                  {(c.nomEntreprise || c.email) && (
                    <p className="text-xs text-gray-500 truncate">{c.nomEntreprise || c.email}</p>
                  )}
                  {/* Repli (mobile / sans drag) : changer l'étape via un select */}
                  <select
                    value={s.key}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onMove(c, e.target.value as PipelineStage)}
                    className="mt-2 w-full text-xs border border-gray-200 rounded-md px-1.5 py-1 text-gray-600 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {PIPELINE_STAGES.map((o) => (
                      <option key={o.key} value={o.key}>{STAGE_LABEL[o.key]}</option>
                    ))}
                  </select>
                </div>
              ))}
              {cards.length === 0 && (
                <p className="text-[11px] text-gray-300 text-center py-3">Déposez ici</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
