'use client'

import { useState } from 'react'
import { useBeloteTeams } from '@/hooks/useBeloteTeams'
import { teamNameFromPlayers } from '@/lib/belote/firebase'
import type { BeloteTeam, BelotePlayer } from '@/lib/belote/types'
import { MagnifyingGlassIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface Props {
  label: string
  selected: BeloteTeam | null
  onSelect: (team: BeloteTeam | null) => void
  excludeId?: string | null      // empêche de choisir 2 fois la même équipe
}

export default function TeamSelector({ label, selected, onSelect, excludeId }: Props) {
  const { teams, loading, createTeam } = useBeloteTeams()
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{ p1: BelotePlayer; p2: BelotePlayer }>({
    p1: { firstName: '', lastName: '' },
    p2: { firstName: '', lastName: '' },
  })

  const filtered = teams
    .filter(t => t.id !== excludeId)
    .filter(t => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return t.name.toLowerCase().includes(q)
        || t.players.some(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    })
    .slice(0, 8)

  const handleCreate = async () => {
    if (!form.p1.firstName.trim() || !form.p2.firstName.trim()) return
    setSaving(true)
    try {
      const players = [form.p1, form.p2]
      const ref = await createTeam(players)
      const newTeam: BeloteTeam = {
        id: (ref as { id: string }).id,
        name: teamNameFromPlayers(players),
        players,
        // createdAt non utilisé à l'affichage immédiat
        createdAt: undefined as never,
      }
      onSelect(newTeam)
      setCreating(false)
      setForm({ p1: { firstName: '', lastName: '' }, p2: { firstName: '', lastName: '' } })
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  // Équipe déjà sélectionnée → chip
  if (selected) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center justify-between border-2 border-blue-300 bg-blue-50 rounded-xl px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-blue-800 truncate">{selected.name}</p>
            <p className="text-xs text-blue-500 truncate">
              {selected.players.map(p => `${p.firstName} ${p.lastName}`.trim()).join(' · ')}
            </p>
          </div>
          <button type="button" onClick={() => onSelect(null)} aria-label="Changer d'équipe"
            className="p-1 text-blue-400 hover:text-red-500 transition shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {!creating ? (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher une équipe ou un joueur…"
              className="w-full pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="max-h-52 overflow-y-auto border-t border-gray-100">
            {loading ? (
              <p className="text-sm text-gray-400 px-3 py-3">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-gray-400 px-3 py-3">Aucune équipe. Créez-en une ↓</p>
            ) : filtered.map(t => (
              <button key={t.id} type="button" onClick={() => onSelect(t)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0 transition">
                <p className="text-sm font-medium text-gray-800">{t.name}</p>
                <p className="text-xs text-gray-400">
                  {t.players.map(p => `${p.firstName} ${p.lastName}`.trim()).join(' · ')}
                </p>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setCreating(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border-t border-blue-100 transition">
            <PlusIcon className="w-4 h-4" /> Créer une équipe
          </button>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-3 space-y-3">
          {([['p1', 'Joueur 1'], ['p2', 'Joueur 2']] as const).map(([key, lbl]) => (
            <div key={key}>
              <p className="text-xs font-medium text-gray-500 mb-1">{lbl}</p>
              <input type="text" placeholder="NOM Prénom" value={form[key].firstName}
                onChange={e => setForm(f => ({ ...f, [key]: { firstName: e.target.value, lastName: '' } }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" onClick={() => setCreating(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="button" onClick={handleCreate}
              disabled={saving || !form.p1.firstName.trim() || !form.p2.firstName.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition">
              {saving ? '…' : 'Créer & sélectionner'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
