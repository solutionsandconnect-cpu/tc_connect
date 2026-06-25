'use client'

import { useState } from 'react'
import { useInvoices } from '@/hooks/useInvoices'
import { updateFacture } from '@/lib/facturationService'
import { fmtEur } from '@/lib/pilotageEstimateur'
import type { Facture } from '@/types'

// Multi-sélection des devis existants à rattacher à un contrat (lien `Facture.contratId`).
// Le rattachement est appliqué immédiatement (cocher = lier, décocher = délier) — indépendant
// d'un éventuel formulaire englobant. Réutilisable : modal d'édition contrat + page détail contrat.
export function DevisLinkPicker({ contratId, uid, clientId }: { contratId: string; uid: string; clientId?: string }) {
  const { invoices } = useInvoices(uid)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Devis de l'utilisateur (les factures arrivent ensuite par conversion, on ne lie que des devis).
  // Filtrés sur le client du contrat quand on le connaît (les avenants concernent le même client).
  const devis = invoices
    .filter((f) => f.type === 'devis')
    .filter((f) => !clientId || f.clientId === clientId)
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))

  const q = search.trim().toLowerCase()
  const visible = q
    ? devis.filter((d) => (d.number ?? '').toLowerCase().includes(q) || (d.clientName ?? '').toLowerCase().includes(q))
    : devis

  const toggle = async (d: Facture) => {
    const linkedHere = d.contratId === contratId
    setBusyId(d.id)
    try {
      await updateFacture(d.id, { contratId: linkedHere ? null : contratId })
    } catch (e) {
      console.error('[DevisLinkPicker] updateFacture', e)
    } finally {
      setBusyId(null)
    }
  }

  if (devis.length === 0) {
    return <p className="text-[11px] text-gray-400">Aucun devis {clientId ? 'pour ce client' : ''} à rattacher. Crée un devis (ou un « Devis lié ») pour qu'il apparaisse ici.</p>
  }

  return (
    <div className="space-y-2">
      {devis.length > 6 && (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un devis (n° ou client)…"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
        {visible.map((d) => {
          const linkedHere = d.contratId === contratId
          const linkedElsewhere = !!d.contratId && d.contratId !== contratId
          return (
            <label key={d.id} className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition ${linkedHere ? 'bg-blue-50/60' : 'hover:bg-gray-50'}`}>
              <input
                type="checkbox"
                checked={linkedHere}
                disabled={busyId === d.id}
                onChange={() => toggle(d)}
                className="w-4 h-4 accent-blue-600 shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 truncate">{d.number}</span>
                  <span className="text-xs text-gray-400 shrink-0">{fmtEur(d.total ?? 0)}</span>
                </span>
                <span className="block text-[11px] text-gray-400 truncate">
                  {d.clientName}
                  {linkedElsewhere && <span className="text-amber-600"> · déjà lié à un autre contrat</span>}
                </span>
              </span>
            </label>
          )
        })}
        {visible.length === 0 && <p className="text-[11px] text-gray-400 px-3 py-2">Aucun devis ne correspond.</p>}
      </div>
    </div>
  )
}
