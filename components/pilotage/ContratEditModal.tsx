'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { useClients } from '@/hooks/useClients'
import { useAbonnementsByClientId } from '@/hooks/useAbonnementsByClientId'
import { useInvoices } from '@/hooks/useInvoices'
import { usePilotageContrats } from '@/hooks/usePilotageContrats'
import Modal from '@/components/ui/Modal'
import SearchSelect from '@/components/ui/SearchSelect'
import { DevisLinkPicker } from '@/components/pilotage/DevisLinkPicker'
import { defaultSuivisPeriodiques } from '@/lib/pilotageSuivi'
import type { PilotageContrat, PilotageContratStatut } from '@/types'

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const num = (s: string) => { const n = Number(s.trim().replace(',', '.')); return s.trim() && Number.isFinite(n) ? n : null }

const DEVIS_STATUT_LABEL: Record<string, string> = {
  draft: 'Brouillon', pending: 'En attente', sent: 'Envoyé', paid: 'Payé',
  encaissement: 'À encaisser', overdue: 'En retard', cancelled: 'Annulé', accepted: 'Accepté', rejected: 'Non validé',
}

export type ContratForm = {
  clientId: string; clientNom: string
  abonnementId: string; abonnementTitre: string
  fraisMiseEnPlace: string; abonnementMensuel: string
  coutFirebaseMensuel: string; tjm: string; dateDebut: string; premiereAnnee: boolean
  tarifAnnee2Defini: boolean; statut: PilotageContratStatut; version: string; notes: string
  devisId: string; devisNumber: string
  dureeEngagementMois: string; preavisMois: string
  maquetteValideeLe: string
}
export const emptyContratForm: ContratForm = {
  clientId: '', clientNom: '', abonnementId: '', abonnementTitre: '',
  fraisMiseEnPlace: '', abonnementMensuel: '',
  coutFirebaseMensuel: '', tjm: '', dateDebut: '', premiereAnnee: true,
  tarifAnnee2Defini: false, statut: 'prospect', version: '1.0', notes: '',
  devisId: '', devisNumber: '',
  dureeEngagementMois: '', preavisMois: '',
  maquetteValideeLe: '',
}

function formFromContrat(c: PilotageContrat): ContratForm {
  return {
    clientId: c.clientId ?? '', clientNom: c.clientNom ?? '',
    abonnementId: c.abonnementId ?? '', abonnementTitre: c.abonnementTitre ?? '',
    fraisMiseEnPlace: c.fraisMiseEnPlace != null ? String(c.fraisMiseEnPlace) : '',
    abonnementMensuel: c.abonnementMensuel != null ? String(c.abonnementMensuel) : '',
    coutFirebaseMensuel: c.coutFirebaseMensuel != null ? String(c.coutFirebaseMensuel) : '',
    tjm: c.tjm != null ? String(c.tjm) : (c.estimation?.tjm != null ? String(c.estimation.tjm) : ''),
    dateDebut: c.dateDebut ? toLocalDate(c.dateDebut.toDate()) : '',
    premiereAnnee: c.premiereAnnee ?? false,
    tarifAnnee2Defini: c.tarifAnnee2Defini ?? false,
    statut: c.statut ?? 'actif', version: c.version ?? '1.0', notes: c.notes ?? '',
    devisId: c.devisId ?? '', devisNumber: c.devisNumber ?? '',
    dureeEngagementMois: c.dureeEngagementMois != null ? String(c.dureeEngagementMois) : '',
    preavisMois: c.preavisMois != null ? String(c.preavisMois) : '',
    maquetteValideeLe: c.maquetteValideeLe ?? '',
  }
}

// Modal d'ajout / édition d'un contrat Pilotage, partagé entre la page Pilotage et la page détail
// d'un contrat (pour pouvoir éditer en place, sans navigation). Autonome : gère son formulaire,
// la cascade client → abonnement → devis, le multi-rattachement de devis existants, et la sauvegarde.
export function ContratEditModal({
  isOpen, onClose, contrat, initialForm, createExtra, onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  contrat: PilotageContrat | null              // null = création
  initialForm?: ContratForm                    // pré-remplissage en création (ex. tarifs du calculateur)
  createExtra?: Partial<PilotageContrat>       // champs additionnels posés à la création (estimation, projet seedé)
  onSaved?: (id: string | null) => void
}) {
  const { currentUser } = useAuth()
  const { clients } = useClients()
  const { invoices } = useInvoices(currentUser?.uid ?? '')
  const { addContrat, updateContrat } = usePilotageContrats()

  const editId = contrat?.id ?? null
  const [form, setForm] = useState<ContratForm>(emptyContratForm)
  const [saving, setSaving] = useState(false)

  // (Ré)initialise le formulaire à l'ouverture seulement (pas à chaque changement de prop).
  const wasOpen = useRef(false)
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setForm(contrat ? formFromContrat(contrat) : (initialForm ?? emptyContratForm))
    }
    wasOpen.current = isOpen
  }, [isOpen, contrat, initialForm])

  const { abonnements: clientAbonnements } = useAbonnementsByClientId(form.clientId || undefined)
  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)),
    [clients])
  const devisDuClient = useMemo(
    () => invoices
      .filter((f) => f.type === 'devis' && f.clientId === form.clientId && (f.abonnementId ?? '') === form.abonnementId)
      .sort((a, b) => ((b.date ?? b.createdAt)?.seconds ?? 0) - ((a.date ?? a.createdAt)?.seconds ?? 0)),
    [invoices, form.clientId, form.abonnementId])

  // Remise du contrat (réglée dans le Calculateur, puis « Aligner ») : appliquée sur le devis.
  // Les champs prix ci-dessous sont donc le TARIF CATALOGUE (avant remise) — on affiche le net
  // pour éviter de saisir un prix déjà remisé qui serait re-remisé sur le devis.
  const remMS = contrat?.remiseMiseEnPlacePct ?? 0
  const remAbo = contrat?.remiseAbonnementPct ?? 0
  const netVal = (s: string, pct: number) => { const n = num(s); return n != null ? n * (1 - pct / 100) : null }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.clientNom.trim()) return
    setSaving(true)
    try {
      const payload = {
        clientId: form.clientId || null,
        clientNom: form.clientNom.trim(),
        abonnementId: form.abonnementId || null,
        abonnementTitre: form.abonnementTitre || null,
        fraisMiseEnPlace: num(form.fraisMiseEnPlace),
        abonnementMensuel: num(form.abonnementMensuel),
        coutFirebaseMensuel: num(form.coutFirebaseMensuel),
        tjm: num(form.tjm),
        dateDebut: form.dateDebut ? Timestamp.fromDate(new Date(form.dateDebut)) : null,
        premiereAnnee: form.premiereAnnee,
        tarifAnnee2Defini: form.tarifAnnee2Defini,
        statut: form.statut,
        version: form.version.trim() || '1.0',
        dureeEngagementMois: num(form.dureeEngagementMois),
        preavisMois: num(form.preavisMois),
        maquetteValideeLe: form.maquetteValideeLe || null,
        notes: form.notes.trim() || null,
        devisId: form.devisId || null,
        devisNumber: form.devisNumber || null,
      }
      let savedId: string | null = editId
      if (editId) {
        await updateContrat(editId, payload as Partial<PilotageContrat>)
      } else {
        const res = await addContrat({ suivisPeriodiques: defaultSuivisPeriodiques(), ...payload, ...(createExtra ?? {}) } as Omit<PilotageContrat, 'id' | 'createdAt'>)
        savedId = (res as { id?: string } | undefined)?.id ?? null
      }
      onSaved?.(savedId)
      onClose()
    } catch (err) { console.error('[ContratEditModal submit]', err) }
    setSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editId ? 'Modifier le contrat' : 'Nouveau contrat'}>
      <form onSubmit={submit} className="space-y-4">
        {/* Cascade : client (base clients) → abonnement → devis */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
          <SearchSelect
            value={form.clientId}
            placeholder="— Choisir un client —"
            searchPlaceholder="Rechercher par nom ou email…"
            emptyText={clients.length === 0 ? 'Aucun client' : 'Aucun résultat'}
            options={clientsTries.map((c) => ({
              value: c.id,
              label: `${c.nom ?? ''} ${c.prenom ?? ''}`.trim() || c.email || '—',
              sublabel: c.email || undefined,
            }))}
            onChange={(id) => {
              const c = clients.find((x) => x.id === id)
              setForm((f) => ({
                ...f,
                clientId: id,
                clientNom: c ? `${c.nom ?? ''} ${c.prenom ?? ''}`.trim() : '',
                abonnementId: '', abonnementTitre: '',
                devisId: '', devisNumber: '',
              }))
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Abonnement <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <SearchSelect
            value={form.abonnementId}
            disabled={!form.clientId}
            placeholder={form.clientId ? '— Sans abonnement —' : "Choisis d'abord un client"}
            searchPlaceholder="Rechercher un abonnement…"
            emptyText="Aucun abonnement"
            options={[
              { value: '', label: '— Sans abonnement —' },
              ...clientAbonnements.map((a) => ({
                value: a.id,
                label: (a.tarifLabel || a.titre || a.categorie || 'Abonnement') + (a.tarifUnitaire != null ? ` — ${fmtEur(a.tarifUnitaire)}` : ''),
                sublabel: a.categorie || undefined,
              })),
            ]}
            onChange={(id) => {
              const a = clientAbonnements.find((x) => x.id === id)
              const titre = a ? (a.tarifLabel || a.titre || a.categorie || 'Abonnement') : ''
              setForm((f) => ({ ...f, abonnementId: id, abonnementTitre: titre, devisId: '', devisNumber: '' }))
            }}
          />
          {form.clientId && clientAbonnements.length === 0 && (
            <p className="text-[11px] text-gray-400 mt-1">Ce client n'a aucun abonnement.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Devis relié <span className="text-gray-400 font-normal">(optionnel)</span></label>
          <SearchSelect
            value={form.devisId}
            disabled={!form.clientId}
            placeholder={form.clientId ? '— Aucun —' : 'Choisis un client'}
            searchPlaceholder="Rechercher un devis…"
            emptyText="Aucun devis"
            options={[
              { value: '', label: '— Aucun —' },
              ...devisDuClient.map((d) => ({ value: d.id, label: `${d.number} — ${fmtEur(d.total ?? 0)}`, sublabel: DEVIS_STATUT_LABEL[d.status] ?? d.status })),
            ]}
            onChange={(id) => {
              const d = devisDuClient.find((x) => x.id === id)
              setForm((f) => ({ ...f, devisId: id, devisNumber: d?.number ?? '' }))
            }}
          />
          <p className="text-[11px] text-gray-400 mt-1">
            {!form.clientId
              ? 'Choisis un client (puis son abonnement) pour voir les devis.'
              : devisDuClient.length === 0
                ? 'Aucun devis pour ce client / cet abonnement.'
                : 'Devis principal du deal (affiché sur la carte du contrat).'}
          </p>
        </div>

        {editId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Devis rattachés <span className="text-gray-400 font-normal">(plusieurs — avenants, devis déjà préparés)</span></label>
            <DevisLinkPicker contratId={editId} uid={currentUser?.uid ?? ''} clientId={form.clientId || undefined} />
            <p className="text-[11px] text-gray-400 mt-1">Coche les devis existants à rattacher à ce contrat ; ils apparaîtront dans ses Documents (et leurs factures aussi).</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mise en place (€){remMS > 0 && <span className="text-gray-400 font-normal"> — catalogue</span>}</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.fraisMiseEnPlace}
              onChange={(e) => setForm((f) => ({ ...f, fraisMiseEnPlace: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {remMS > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">tarif <span className="text-gray-500">catalogue</span> ; remise {remMS}% → <span className="text-rose-600 font-semibold">{(() => { const v = netVal(form.fraisMiseEnPlace, remMS); return v != null ? fmtEur(v) : '—' })()}</span> net sur le devis</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Abo /mois (€){remAbo > 0 && <span className="text-gray-400 font-normal"> — catalogue</span>}</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.abonnementMensuel}
              onChange={(e) => setForm((f) => ({ ...f, abonnementMensuel: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {remAbo > 0 && (
              <p className="text-[10px] text-gray-400 mt-0.5">tarif <span className="text-gray-500">catalogue</span> ; remise {remAbo}% → <span className="text-rose-600 font-semibold">{(() => { const v = netVal(form.abonnementMensuel, remAbo); return v != null ? `${fmtEur(v)}/mois` : '—' })()}</span> net</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Coût infra /mois (€)</label>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.coutFirebaseMensuel}
              onChange={(e) => setForm((f) => ({ ...f, coutFirebaseMensuel: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">TJM (€/jour)</label>
            <input type="number" inputMode="decimal" step="10" min="0" value={form.tjm}
              onChange={(e) => setForm((f) => ({ ...f, tjm: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">sert au prix des tâches « à facturer »</p>
          </div>
        </div>
        {(remMS > 0 || remAbo > 0) && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5">
            ⚠️ Une remise est appliquée sur le devis. Saisis ici le <strong>tarif catalogue (avant remise)</strong>, pas le prix déjà remisé — sinon la remise serait comptée deux fois. La remise se règle dans le <strong>Calculateur</strong> (puis « Aligner »).
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date de début</label>
            <input type="date" value={form.dateDebut} onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
            <select value={form.statut} onChange={(e) => setForm((f) => ({ ...f, statut: e.target.value as PilotageContratStatut }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="prospect">Prospect (à valider)</option>
              <option value="actif">Actif</option>
              <option value="pause">En pause</option>
              <option value="termine">Terminé</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Version du projet</label>
            <input type="text" value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
              placeholder="1.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">reprise par tous les documents générés (devis, cahier des charges, contrats…)</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Engagement (mois)</label>
            <input type="number" inputMode="numeric" step="1" min="0" value={form.dureeEngagementMois} placeholder="12"
              onChange={(e) => setForm((f) => ({ ...f, dureeEngagementMois: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Préavis (mois)</label>
            <input type="number" inputMode="numeric" step="1" min="0" value={form.preavisMois} placeholder="2"
              onChange={(e) => setForm((f) => ({ ...f, preavisMois: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <p className="col-span-2 text-[10px] text-gray-400 -mt-1">Sert au suivi reconduction / préavis (« À suivre »). Vide = défauts 12 mois d'engagement, 2 mois de préavis.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Maquette validée le</label>
          <input type="date" value={form.maquetteValideeLe} onChange={(e) => setForm((f) => ({ ...f, maquetteValideeLe: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[10px] text-gray-400 mt-0.5">Jalon qui gèle le périmètre : au-delà du forfait d'ajustements inclus, les nouvelles demandes passent en « à facturer ». Laisse vide tant que la maquette n'est pas validée.</p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.premiereAnnee} onChange={(e) => setForm((f) => ({ ...f, premiereAnnee: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
            Tarif « 1ère année »
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.tarifAnnee2Defini} onChange={(e) => setForm((f) => ({ ...f, tarifAnnee2Defini: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
            Tarif année 2 défini
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
