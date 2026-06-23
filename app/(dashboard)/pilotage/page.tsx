'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { useInvoices } from '@/hooks/useInvoices'
import { usePilotageContrats } from '@/hooks/usePilotageContrats'
import { usePilotageCatalogue } from '@/hooks/usePilotageCatalogue'
import { usePilotageSettings } from '@/hooks/usePilotageSettings'
import { useClients } from '@/hooks/useClients'
import { useAbonnementsByClientId } from '@/hooks/useAbonnementsByClientId'
import { defaultProjetContent, LIVRABLES_DEFAUT } from '@/lib/pilotageProjetTemplates'
import Modal from '@/components/ui/Modal'
import SearchSelect from '@/components/ui/SearchSelect'
import InfraCostEstimator from '@/components/pilotage/InfraCostEstimator'
import EstimateurTarif from '@/components/pilotage/EstimateurTarif'
import { CATEGORIES_FEATURE_DEFAUT, type TarifResult } from '@/lib/pilotageEstimateur'
import { randomUUID } from '@/lib/uuid'
import type { PilotageContrat, PilotageContratStatut, PilotageEstimation } from '@/types'
import {
  PlusIcon, PencilIcon, TrashIcon, DocumentTextIcon,
  ExclamationTriangleIcon, PresentationChartLineIcon, CalculatorIcon,
  ArrowDownTrayIcon, CheckIcon, EyeIcon, ComputerDesktopIcon,
} from '@heroicons/react/24/outline'

// Plafond micro-entreprise (prestations de services / BNC) — à ajuster si le barème change
const PLAFOND = 77700

// L'estimateur (constantes, calcul, état) vit dans lib/pilotageEstimateur.ts
// et le composant components/pilotage/EstimateurTarif.tsx (partagé avec la fiche contrat).

const STATUT_LABELS: Record<PilotageContratStatut, string> = {
  actif: 'Actif', pause: 'En pause', termine: 'Terminé',
}
const STATUT_COLORS: Record<PilotageContratStatut, string> = {
  actif: 'bg-green-100 text-green-700',
  pause: 'bg-orange-100 text-orange-700',
  termine: 'bg-gray-100 text-gray-500',
}

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const toLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const monthsSince = (ts: Timestamp) => {
  const d = ts.toDate(); const n = new Date()
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth())
}

type Form = {
  clientId: string; clientNom: string
  abonnementId: string; abonnementTitre: string
  fraisMiseEnPlace: string; abonnementMensuel: string
  coutFirebaseMensuel: string; tjm: string; dateDebut: string; premiereAnnee: boolean
  tarifAnnee2Defini: boolean; statut: PilotageContratStatut; notes: string
  devisId: string; devisNumber: string
}
const emptyForm: Form = {
  clientId: '', clientNom: '', abonnementId: '', abonnementTitre: '',
  fraisMiseEnPlace: '', abonnementMensuel: '',
  coutFirebaseMensuel: '', tjm: '', dateDebut: '', premiereAnnee: true,
  tarifAnnee2Defini: false, statut: 'actif', notes: '',
  devisId: '', devisNumber: '',
}

// Libellés de statut d'un devis (mêmes que la section Facturation)
const DEVIS_STATUT_LABEL: Record<string, string> = {
  draft: 'Brouillon', pending: 'En attente', sent: 'Envoyé', paid: 'Payé',
  encaissement: 'À encaisser', overdue: 'En retard', cancelled: 'Annulé', accepted: 'Accepté', rejected: 'Non validé',
}

export default function PilotagePage() {
  const router = useRouter()
  const { currentUser, userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { invoices } = useInvoices(currentUser?.uid ?? '')
  const { contrats, loading, addContrat, updateContrat, deleteContrat } = usePilotageContrats()
  const { clients } = useClients()

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Amorce le contenu projet depuis l'estimateur (fonctionnalités) + valeurs par défaut.
  // La catégorie est reprise du catalogue (groupe de la brique) quand la fonctionnalité y figure.
  const seedProjet = (est: PilotageEstimation) => {
    const groupeParNom = new Map(catalogueItems.map((it) => [it.nom, it.groupe?.trim() || '']))
    const categorie = (nom: string) => groupeParNom.get(nom) || CATEGORIES_FEATURE_DEFAUT[nom] || ''
    return defaultProjetContent({
      fonctionnalites: est.features.map((f) => ({ categorie: categorie(f.nom), description: f.nom })),
      livrables: [...LIVRABLES_DEFAUT],
    })
  }

  // Contrat dont on rejoue/ajuste l'estimation dans le calculateur
  const [linkedContrat, setLinkedContrat] = useState<PilotageContrat | null>(null)
  // Estimation à enregistrer à la création d'un contrat « avec ces tarifs »
  const [pendingEstimation, setPendingEstimation] = useState<PilotageEstimation | null>(null)
  const estimateurRef = useRef<HTMLDetailsElement>(null)
  const loadEstimation = (c: PilotageContrat) => {
    if (!c.estimation) return
    setSeedEst(c.estimation)
    setSeedNonce((n) => n + 1)   // déclenche la ré-hydratation du composant
    setLinkedContrat(c)
    setTimeout(() => estimateurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const updateLinkedContrat = async () => {
    if (!linkedContrat || !live) return
    await updateContrat(linkedContrat.id, {
      estimation: live.est,
      fraisMiseEnPlace: live.tarif.setup,
      abonnementMensuel: live.tarif.abo,
      coutFirebaseMensuel: live.est.infra,
    } as Partial<PilotageContrat>)
    setLinkedContrat(null)
  }

  // Cascade client → abonnement → devis pour le formulaire de contrat
  const { abonnements: clientAbonnements } = useAbonnementsByClientId(form.clientId || undefined)
  const clientsTries = useMemo(
    () => [...clients].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`)),
    [clients])
  const devisDuClient = useMemo(
    () => invoices
      .filter((f) => f.type === 'devis' && f.clientId === form.clientId && (f.abonnementId ?? '') === form.abonnementId)
      .sort((a, b) => ((b.date ?? b.createdAt)?.seconds ?? 0) - ((a.date ?? a.createdAt)?.seconds ?? 0)),
    [invoices, form.clientId, form.abonnementId])

  // Estimateur : état « live » remonté par le composant <EstimateurTarif> + graine de ré-hydratation
  const [live, setLive] = useState<{ est: PilotageEstimation; tarif: TarifResult } | null>(null)
  const [seedEst, setSeedEst] = useState<PilotageEstimation | null>(null)
  const [seedNonce, setSeedNonce] = useState(0)

  // Analyse inversée : à partir de ce qui a été facturé, déduire le taux réalisé
  const [revCreation, setRevCreation] = useState(0)   // montant création facturé (€)
  const [revAbo, setRevAbo] = useState(0)             // abonnement mensuel facturé (€)
  const [revJours, setRevJours] = useState(0)         // jours réellement passés sur la création
  const [revSupportH, setRevSupportH] = useState(0)   // heures de support réelles /mois
  const [revMoisAbo1, setRevMoisAbo1] = useState(12)  // nb de mensualités facturées la 1ère année (souvent 11 si l'abo démarre le mois après la création)
  const analyse = useMemo(() => {
    const tjmReel = revJours > 0 ? revCreation / revJours : null
    const tauxHoraireReel = tjmReel != null ? tjmReel / 7 : null
    const aboAn = revAbo * 12
    const totalAn1 = revCreation + revAbo * revMoisAbo1   // total encaissé la 1ère année = création + N mensualités
    const tauxHoraireRecurrent = revSupportH > 0 ? revAbo / revSupportH : null
    const verdict = tjmReel == null ? null : tjmReel < 400 ? 'bas' : tjmReel <= 650 ? 'marche' : 'haut'
    return { tjmReel, tauxHoraireReel, aboAn, totalAn1, tauxHoraireRecurrent, verdict }
  }, [revCreation, revAbo, revJours, revSupportH, revMoisAbo1])

  const { items: catalogueItems } = usePilotageCatalogue()

  // Valeurs par défaut persistées (modifiables quand tu veux)
  const { settings, saveSettings } = usePilotageSettings()
  const [savingDefaults, setSavingDefaults] = useState<'idle' | 'saving' | 'done'>('idle')

  const saveDefaults = async () => {
    if (!live) return
    setSavingDefaults('saving')
    try {
      const e = live.est
      await saveSettings({
        tjm: e.tjm, overheadPct: e.overheadPct, bufferPct: e.bufferPct, maintPct: e.maintPct,
        infra: e.infra, supportH: e.supportH,
        heuresGagnees: e.heuresGagnees, coutHoraireClient: e.coutHoraireClient, partCaptee: e.partCaptee,
        premiumRevente: e.premiumRevente, nbClientsFinaux: e.nbClientsFinaux, prixReventeMensuel: e.prixReventeMensuel,
        outilsMensuel: e.outilsMensuel, joursFactures: e.joursFactures,
        features: e.features,
      })
      setSavingDefaults('done')
      setTimeout(() => setSavingDefaults('idle'), 2000)
    } catch (err) {
      console.error('[pilotage settings]', err)
      setSavingDefaults('idle')
    }
  }

  const num = (s: string) => { const n = Number(s.trim().replace(',', '.')); return s.trim() && Number.isFinite(n) ? n : null }

  // ── Calculs ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = contrats.filter((c) => c.statut === 'actif')
    const mrr = actifs.reduce((s, c) => s + (c.abonnementMensuel ?? 0), 0)
    const couts = actifs.reduce((s, c) => s + (c.coutFirebaseMensuel ?? 0), 0)
    const marge = mrr - couts
    const now = new Date()
    const caYear = invoices
      .filter((f) => (f.type ?? 'facture') === 'facture' && f.status === 'paid')
      .filter((f) => { const ts = f.date ?? f.createdAt; return ts && new Date(ts.seconds * 1000).getFullYear() === now.getFullYear() })
      .reduce((s, f) => s + (f.total ?? 0), 0)
    // Projection annualisée à partir du CA RÉEL uniquement (jamais les contrats → pas de double comptage)
    const moisEcoules = now.getMonth() + 1
    const projection = moisEcoules > 0 ? (caYear / moisEcoules) * 12 : caYear
    return {
      actifs, mrr, couts, marge, arr: mrr * 12, caYear, projection,
      pctReel: Math.min(100, (caYear / PLAFOND) * 100),
      pctProj: Math.min(100, (projection / PLAFOND) * 100),
    }
  }, [contrats, invoices])

  const alertes = useMemo(() => {
    const out: { tone: 'warn' | 'danger'; text: string }[] = []
    for (const c of stats.actifs) {
      if (c.premiereAnnee && !c.tarifAnnee2Defini)
        out.push({ tone: 'warn', text: `${c.clientNom} : tarif année 2 non défini.` })
      if (c.premiereAnnee && c.dateDebut && monthsSince(c.dateDebut) >= 10)
        out.push({ tone: 'warn', text: `${c.clientNom} : 1ère année bientôt terminée — revoir le tarif.` })
      if (c.abonnementMensuel != null && (c.abonnementMensuel - (c.coutFirebaseMensuel ?? 0)) <= 0)
        out.push({ tone: 'danger', text: `${c.clientNom} : marge nulle ou négative.` })
    }
    if (stats.projection > PLAFOND * 0.8)
      out.push({ tone: 'warn', text: `Tu approches le plafond micro (projection ${fmtEur(stats.projection)} / ${fmtEur(PLAFOND)}). Anticipe le passage en société.` })
    return out
  }, [stats])

  // ── Actions ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditId(null); setPendingEstimation(null); setForm({ ...emptyForm, tjm: String(live?.est.tjm ?? 500) }); setShowModal(true) }
  const openAddWithPricing = () => {
    if (!live) return
    setEditId(null)
    setPendingEstimation(live.est)  // on attache le calcul courant au futur contrat
    setForm({
      ...emptyForm,
      abonnementMensuel: String(live.tarif.abo),
      fraisMiseEnPlace: String(live.tarif.setup),
      coutFirebaseMensuel: String(live.est.infra),
      tjm: String(live.est.tjm),
    })
    setShowModal(true)
  }
  const openEdit = (c: PilotageContrat) => {
    setEditId(c.id)
    setPendingEstimation(c.estimation ?? null)
    setForm({
      clientId: c.clientId ?? '', clientNom: c.clientNom ?? '',
      abonnementId: c.abonnementId ?? '', abonnementTitre: c.abonnementTitre ?? '',
      fraisMiseEnPlace: c.fraisMiseEnPlace != null ? String(c.fraisMiseEnPlace) : '',
      abonnementMensuel: c.abonnementMensuel != null ? String(c.abonnementMensuel) : '',
      coutFirebaseMensuel: c.coutFirebaseMensuel != null ? String(c.coutFirebaseMensuel) : '',
      tjm: c.tjm != null ? String(c.tjm) : (c.estimation?.tjm != null ? String(c.estimation.tjm) : ''),
      dateDebut: c.dateDebut ? toLocalDate(c.dateDebut.toDate()) : '',
      premiereAnnee: c.premiereAnnee ?? false,
      tarifAnnee2Defini: c.tarifAnnee2Defini ?? false,
      statut: c.statut ?? 'actif', notes: c.notes ?? '',
      devisId: c.devisId ?? '', devisNumber: c.devisNumber ?? '',
    })
    setShowModal(true)
  }

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
        notes: form.notes.trim() || null,
        devisId: form.devisId || null,
        devisNumber: form.devisNumber || null,
      }
      // À la création « avec ces tarifs » : on enregistre le snapshot du calcul + un contenu projet amorcé.
      const extra = !editId && pendingEstimation ? { estimation: pendingEstimation, projet: seedProjet(pendingEstimation) } : {}
      if (editId) await updateContrat(editId, payload as Partial<PilotageContrat>)
      else await addContrat({ ...payload, ...extra } as Omit<PilotageContrat, 'id' | 'createdAt'>)
      setShowModal(false)
    } catch (err) { console.error('[pilotage submit]', err) }
    setSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try { await deleteContrat(deleteId) } catch (err) { console.error('[pilotage delete]', err) }
    setDeleteId(null)
  }

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé.</p></div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
            <PresentationChartLineIcon className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Pilotage</h1>
            <p className="text-sm text-gray-500">Tes contrats, ton revenu récurrent et ta marge</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => router.push('/pilotage/immobilisations')}
            className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium px-3 py-2 rounded-lg transition"
            title="Immobilisations / matériel">
            <ComputerDesktopIcon className="w-4 h-4" /> Immobilisations
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <PlusIcon className="w-4 h-4" /> Nouveau contrat
          </button>
        </div>
      </div>

      {/* Estimateur de tarif (création sur-mesure) */}
      <details ref={estimateurRef} open className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="inline-block transition group-open:rotate-90 text-gray-400">▸</span>
          <CalculatorIcon className="w-4 h-4 text-blue-600" /> Estimateur de tarif (création sur-mesure)
        </summary>
        {linkedContrat && (
          <div className="flex items-center justify-between gap-2 flex-wrap bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 mt-2">
            <p className="text-xs text-blue-800">
              Tu ajustes l'estimation de <strong>{linkedContrat.clientNom || 'ce contrat'}</strong>. Modifie les valeurs ci-dessous, puis enregistre.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={updateLinkedContrat}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
                <CheckIcon className="w-3.5 h-3.5" /> Mettre à jour le contrat
              </button>
              <button onClick={() => setLinkedContrat(null)}
                className="text-xs font-medium text-blue-700 hover:underline">Détacher</button>
            </div>
          </div>
        )}
        <EstimateurTarif
          initial={seedEst}
          seedNonce={seedNonce}
          defaults={settings}
          onChange={(est, t) => setLive({ est, tarif: t })}
          footer={(
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button onClick={openAddWithPricing}
                className="flex items-center gap-2 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                <PlusIcon className="w-4 h-4" /> Créer un contrat avec ces tarifs
              </button>
              <button onClick={saveDefaults} disabled={savingDefaults === 'saving'}
                className="flex items-center gap-2 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition disabled:opacity-50">
                {savingDefaults === 'done' ? (
                  <><CheckIcon className="w-4 h-4 text-green-600" /> Enregistré</>
                ) : savingDefaults === 'saving' ? (
                  'Enregistrement…'
                ) : (
                  <><ArrowDownTrayIcon className="w-4 h-4" /> Enregistrer comme valeurs par défaut</>
                )}
              </button>
            </div>
          )}
        />
      </details>

      {/* Analyse inversée — d'un contrat déjà signé vers le taux réalisé */}
      <details open className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="inline-block transition group-open:rotate-90 text-gray-400">▸</span>
          <CalculatorIcon className="w-4 h-4 text-emerald-600" /> Analyse d'un contrat signé (calcul inversé)
        </summary>
        <p className="text-xs text-gray-400 mb-4 mt-2">
          Tu connais déjà ce que tu as facturé ? Saisis-le pour voir à combien ça revient en taux journalier/horaire réel.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: 'Création facturée (€)', val: revCreation, set: setRevCreation, hint: '1ère échéance / mise en place', step: 50, min: 0 },
            { label: 'Abonnement facturé /mois (€)', val: revAbo, set: setRevAbo, hint: 'mensuel récurrent', step: 10, min: 0 },
            { label: 'Mensualités (1ʳᵉ année)', val: revMoisAbo1, set: setRevMoisAbo1, hint: 'souvent 11 (abo le mois après)', step: 1, min: 0 },
            { label: 'Jours réellement passés', val: revJours, set: setRevJours, hint: 'sur la création', step: 0.5, min: 0 },
            { label: 'Support réel (h/mois)', val: revSupportH, set: setRevSupportH, hint: 'temps mensuel passé', step: 0.5, min: 0 },
          ] as const).map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">{f.label}</label>
              <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {/* 1) Ce que vaut ton temps sur la création */}
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs text-emerald-700/70">TJM réalisé (création)</p>
            <p className="text-2xl font-bold text-emerald-700">{analyse.tjmReel != null ? fmtEur(analyse.tjmReel) : '—'}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              {analyse.tauxHoraireReel != null ? `≈ ${fmtEur(analyse.tauxHoraireReel)}/h · création ÷ jours (paiement unique)` : 'saisis les jours passés'}
            </p>
            {analyse.verdict && (
              <p className={`text-[10px] mt-1 font-medium ${
                analyse.verdict === 'bas' ? 'text-red-600' : analyse.verdict === 'haut' ? 'text-green-600' : 'text-gray-500'
              }`}>
                {analyse.verdict === 'bas'
                  ? 'Sous le marché (400–650 €/j) — tu te sous-vends.'
                  : analyse.verdict === 'haut'
                    ? 'Au-dessus du marché — très bien joué.'
                    : 'Dans la fourchette marché (400–650 €/j).'}
              </p>
            )}
          </div>
          {/* 2) Le récurrent en rythme de croisière (année pleine) */}
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs text-blue-700/70">Récurrent — année pleine</p>
            <p className="text-2xl font-bold text-blue-700">{fmtEur(analyse.aboAn)}<span className="text-sm font-medium text-blue-700/60">/an</span></p>
            <p className="text-[10px] text-gray-500 mt-1">
              12 mensualités (rythme de croisière, année 2+).{analyse.tauxHoraireRecurrent != null ? ` ≈ ${fmtEur(analyse.tauxHoraireRecurrent)}/h de support.` : ''}
            </p>
          </div>
          {/* 3) Total réellement encaissé la 1ère année (création + N mensualités) */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-xs text-indigo-700/70">Total encaissé — 1ʳᵉ année</p>
            <p className="text-2xl font-bold text-indigo-700">{fmtEur(analyse.totalAn1)}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              Création + {revMoisAbo1} mensualité{revMoisAbo1 > 1 ? 's' : ''} : {fmtEur(revCreation)} + {revMoisAbo1} × {fmtEur(revAbo)}.
            </p>
          </div>
        </div>
      </details>

      {/* Estimateur de coûts d'infra (Firebase) — indicatif */}
      <InfraCostEstimator />

      {/* Prévisionnel (d'après tes contrats) */}
      <div className="space-y-2">
        <p className="text-xs text-gray-400">Prévisionnel — d'après tes contrats actifs. Distinct de ton CA réel (qui vient de ta facturation).</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'MRR (récurrent /mois)', value: fmtEur(stats.mrr), color: 'text-gray-900', sub: `${stats.actifs.length} client${stats.actifs.length !== 1 ? 's' : ''} actif${stats.actifs.length !== 1 ? 's' : ''}` },
            { label: 'ARR projeté (/an)', value: fmtEur(stats.arr), color: 'text-blue-600', sub: 'MRR × 12' },
            { label: 'Coûts infra /mois', value: fmtEur(stats.couts), color: 'text-orange-600', sub: 'Firebase estimé' },
            { label: 'Marge /mois', value: fmtEur(stats.marge), color: stats.marge >= 0 ? 'text-green-600' : 'text-red-600', sub: 'MRR − coûts' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">
          <strong>MRR</strong> (Monthly Recurring Revenue) = revenu <strong>récurrent mensuel</strong> = somme des abonnements de tes contrats actifs. <strong>ARR</strong> (Annual Recurring Revenue) = le même sur un an (MRR × 12).
        </p>
      </div>

      {/* Jauge plafond */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
          <h2 className="text-sm font-semibold text-gray-700">Plafond micro-entreprise</h2>
          <span className="text-xs text-gray-400">Plafond {fmtEur(PLAFOND)} (prestations de services)</span>
        </div>
        <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
          {/* Projection (clair) */}
          <div className="absolute inset-y-0 left-0 bg-indigo-200" style={{ width: `${stats.pctProj}%` }} />
          {/* CA réel (foncé) */}
          <div className="absolute inset-y-0 left-0 bg-indigo-500" style={{ width: `${stats.pctReel}%` }} />
          {/* Seuil 80% */}
          <div className="absolute inset-y-0 w-px bg-red-400" style={{ left: '80%' }} title="80 %" />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />CA encaissé {new Date().getFullYear()} : <strong>{fmtEur(stats.caYear)}</strong></span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-200 inline-block" />Projection annualisée : <strong>{fmtEur(stats.projection)}</strong></span>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          <strong>Projection annualisée</strong> = ton CA encaissé ramené à l'année entière (CA actuel ÷ mois écoulés × 12) — une estimation de ton CA de fin d'année si tu gardes ce rythme. Basé uniquement sur ta facturation réelle (factures payées) ; tes contrats ne sont pas ajoutés ici — pas de double comptage.
        </p>
      </div>

      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="space-y-2">
          {alertes.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm border ${a.tone === 'danger' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Liste des contrats */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Contrats ({contrats.length})</h2>
        {loading ? (
          <div className="text-center py-10 text-gray-400">Chargement…</div>
        ) : contrats.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <PresentationChartLineIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Aucun contrat. Ajoute ton premier client.</p>
            <button onClick={openAdd}
              className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
              <PlusIcon className="w-4 h-4" /> Nouveau contrat
            </button>
          </div>
        ) : contrats.map((c) => {
          const marge = (c.abonnementMensuel ?? 0) - (c.coutFirebaseMensuel ?? 0)
          return (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{c.clientNom}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUT_COLORS[c.statut]}`}>{STATUT_LABELS[c.statut]}</span>
                    {c.premiereAnnee && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">1ère année</span>}
                  </div>
                  {(c.abonnementTitre || c.appNom) && <p className="text-xs text-gray-400 mt-0.5">{c.abonnementTitre || c.appNom}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"><PencilIcon className="w-4 h-4" /></button>
                  <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><TrashIcon className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                {[
                  { l: 'Mise en place', v: c.fraisMiseEnPlace != null ? fmtEur(c.fraisMiseEnPlace) : '—' },
                  { l: 'Abonnement /mois', v: c.abonnementMensuel != null ? fmtEur(c.abonnementMensuel) : '—' },
                  { l: 'Coût infra /mois', v: c.coutFirebaseMensuel != null ? fmtEur(c.coutFirebaseMensuel) : '—' },
                  { l: 'Marge /mois', v: fmtEur(marge), color: marge >= 0 ? 'text-green-600' : 'text-red-600' },
                ].map((x) => (
                  <div key={x.l}>
                    <p className="text-[10px] text-gray-400">{x.l}</p>
                    <p className={`text-sm font-semibold ${x.color ?? 'text-gray-800'}`}>{x.v}</p>
                  </div>
                ))}
              </div>
              {c.notes && <p className="text-xs text-gray-500 mt-2 whitespace-pre-wrap">{c.notes}</p>}
              {(() => {
                const taches = c.projet?.taches ?? []
                const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                const nFact = taches.filter((t) => t.facturation === 'facturer' && !t.facturee).length
                const nRetard = taches.filter((t) => t.date && t.date < today && !t.fait).length
                if (!nFact && !nRetard) return null
                return (
                  <div className="flex flex-col gap-1 mt-2 text-xs font-medium">
                    {nRetard > 0 && <div className="flex items-center gap-1.5 text-amber-700"><ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" /><span>{nRetard} tâche{nRetard > 1 ? 's' : ''} en retard</span></div>}
                    {nFact > 0 && <div className="flex items-center gap-1.5 text-rose-700"><ExclamationTriangleIcon className="w-3.5 h-3.5 shrink-0" /><span>{nFact} évolution{nFact > 1 ? 's' : ''} à facturer</span></div>}
                  </div>
                )
              })()}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
                <button onClick={() => router.push(`/pilotage/contrat/${c.id}`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition">
                  <DocumentTextIcon className="w-3.5 h-3.5" /> Documents
                </button>
                <button onClick={() => router.push(`/pilotage/contrat/${c.id}?tab=taches`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-purple-700 border border-purple-200 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition">
                  <CheckIcon className="w-3.5 h-3.5" /> Tâches
                </button>
                <button onClick={() => router.push(`/pilotage/contrat/${c.id}?tab=calculateur`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                  <CalculatorIcon className="w-3.5 h-3.5" /> Calculateur
                </button>
                <button onClick={() => router.push(`/pilotage/contrat/${c.id}?tab=apercu`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition">
                  <EyeIcon className="w-3.5 h-3.5" /> Aperçu
                </button>
                {c.estimation && (
                  <button onClick={() => loadEstimation(c)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                    <CalculatorIcon className="w-3.5 h-3.5" /> Rejouer ici
                  </button>
                )}
                {c.devisId && (
                  <button onClick={() => router.push(`/facturation/${c.devisId}`)}
                    className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition">
                    <DocumentTextIcon className="w-3.5 h-3.5" /> Devis {c.devisNumber || 'relié'}
                  </button>
                )}
                <button onClick={() => router.push('/facturation')}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                  <DocumentTextIcon className="w-3.5 h-3.5" /> Aller à la facturation
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal ajout / édition */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Modifier le contrat' : 'Nouveau contrat'}>
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
                  : 'Relie le devis correspondant (source de vérité du deal).'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mise en place (€)</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={form.fraisMiseEnPlace}
                onChange={(e) => setForm((f) => ({ ...f, fraisMiseEnPlace: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Abo /mois (€)</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={form.abonnementMensuel}
                onChange={(e) => setForm((f) => ({ ...f, abonnementMensuel: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                <option value="actif">Actif</option>
                <option value="pause">En pause</option>
                <option value="termine">Terminé</option>
              </select>
            </div>
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
            <button type="button" onClick={() => setShowModal(false)} disabled={saving}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Supprimer ce contrat ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Action <strong>irréversible</strong> : le contrat et <strong>tout son contenu</strong> (tâches, planning, contenu projet, mentions légales et documents générés) seront supprimés. Tes factures ne sont pas affectées.</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
          <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">Supprimer</button>
        </div>
      </Modal>

    </div>
  )
}
