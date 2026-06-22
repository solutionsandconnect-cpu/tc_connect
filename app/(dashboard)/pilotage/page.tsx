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
import { randomUUID } from '@/lib/uuid'
import type { PilotageContrat, PilotageContratStatut, PilotageEstimation } from '@/types'
import {
  PlusIcon, PencilIcon, TrashIcon, DocumentTextIcon,
  ExclamationTriangleIcon, PresentationChartLineIcon, CalculatorIcon,
  ArrowDownTrayIcon, CheckIcon, EyeIcon,
} from '@heroicons/react/24/outline'

// Plafond micro-entreprise (prestations de services / BNC) — à ajuster si le barème change
const PLAFOND = 77700

// ── Estimateur de tarif (création sur-mesure, façon freelance) ──
// On découpe l'app en fonctionnalités → effort en jours, puis prix = jours × TJM
// + frais de structure + marge d'incertitude. La maintenance récurrente se déduit
// en % du coût de création (standard freelance : 15–20 %/an).
const round10 = (n: number) => Math.round(n / 10) * 10
const round100 = (n: number) => Math.round(n / 100) * 100

type TailleKey = 'xs' | 's' | 'm' | 'l' | 'xl'
const TAILLES: Record<TailleKey, { label: string; jours: number }> = {
  xs: { label: 'Très simple', jours: 0.5 },
  s:  { label: 'Simple',      jours: 1 },
  m:  { label: 'Moyenne',     jours: 3 },
  l:  { label: 'Complexe',    jours: 6 },
  xl: { label: 'Très grosse', jours: 12 },
}

type Feature = { id: string; nom: string; taille: TailleKey }
const DEFAULT_FEATURES: Feature[] = [
  { id: 'f1', nom: 'Cadrage & maquettes', taille: 'm' },
  { id: 'f2', nom: 'Authentification & comptes', taille: 's' },
  { id: 'f3', nom: 'Écran principal / tableau de bord', taille: 'm' },
  { id: 'f4', nom: 'Module métier principal (CRUD)', taille: 'l' },
  { id: 'f5', nom: 'Notifications / rappels', taille: 's' },
  { id: 'f6', nom: 'Back-office admin', taille: 'm' },
]

// Catégorie par défaut des fonctionnalités de base (quand elles ne viennent pas du catalogue)
const CATEGORIES_FEATURE_DEFAUT: Record<string, string> = {
  'Cadrage & maquettes': 'Cadrage & conception',
  'Authentification & comptes': 'Comptes & accès',
  'Écran principal / tableau de bord': 'Interface',
  'Module métier principal (CRUD)': 'Métier',
  'Notifications / rappels': 'Notifications',
  'Back-office admin': 'Administration',
}

// Catalogue par défaut (modèle initial — sert à amorcer ton catalogue personnel)
const DEFAULT_CATALOGUE: { groupe: string; items: { nom: string; taille: TailleKey }[] }[] = [
  {
    groupe: 'Fonctionnelles',
    items: [
      { nom: 'Gestion des rôles & droits', taille: 'm' },
      { nom: 'Recherche & filtres', taille: 's' },
      { nom: 'Génération de PDF (devis, factures, rapports)', taille: 'm' },
      { nom: 'Photos / pièces jointes', taille: 's' },
      { nom: 'Calendrier / planning', taille: 'm' },
      { nom: 'Géolocalisation / carte', taille: 'm' },
      { nom: 'Signature électronique', taille: 's' },
      { nom: 'Paiement en ligne (Stripe)', taille: 'm' },
      { nom: 'Mode hors-ligne + synchro', taille: 'l' },
      { nom: 'Statistiques / tableau de bord', taille: 'm' },
      { nom: 'Intégrations tierces (compta, Google Agenda, SMS…)', taille: 'l' },
      { nom: 'Import / export Excel-CSV', taille: 's' },
      { nom: "Historique / journal d'activité", taille: 's' },
    ],
  },
  {
    groupe: "Souvent oubliées (mais facturables)",
    items: [
      { nom: 'Reprise des données existantes', taille: 'm' },
      { nom: 'Formation des utilisateurs', taille: 's' },
      { nom: 'Recette / tests avec le client', taille: 's' },
      { nom: 'Déploiement stores + comptes développeur', taille: 's' },
      { nom: 'RGPD (consentement, export des données)', taille: 's' },
    ],
  },
]

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
  coutFirebaseMensuel: string; dateDebut: string; premiereAnnee: boolean
  tarifAnnee2Defini: boolean; statut: PilotageContratStatut; notes: string
  devisId: string; devisNumber: string
}
const emptyForm: Form = {
  clientId: '', clientNom: '', abonnementId: '', abonnementTitre: '',
  fraisMiseEnPlace: '', abonnementMensuel: '',
  coutFirebaseMensuel: '', dateDebut: '', premiereAnnee: true,
  tarifAnnee2Defini: false, statut: 'actif', notes: '',
  devisId: '', devisNumber: '',
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
  const seedProjet = () => {
    const groupeParNom = new Map(catalogueItems.map((it) => [it.nom, it.groupe?.trim() || '']))
    const categorie = (nom: string) => groupeParNom.get(nom) || CATEGORIES_FEATURE_DEFAUT[nom] || ''
    return defaultProjetContent({
      fonctionnalites: features.map((f) => ({ categorie: categorie(f.nom), description: f.nom })),
      livrables: [...LIVRABLES_DEFAUT],
    })
  }

  // ── Estimation rattachée au contrat : snapshot des entrées du calculateur ──
  const currentEstimation = (): PilotageEstimation => ({
    mode, tjm, overheadPct, bufferPct, maintPct, infra: calcInfra, supportH,
    heuresGagnees, coutHoraireClient, partCaptee,
    premiumRevente, nbClientsFinaux, prixReventeMensuel,
    features: features.map(({ nom, taille }) => ({ nom, taille })),
  })
  // Contrat dont on rejoue/ajuste l'estimation dans le calculateur
  const [linkedContrat, setLinkedContrat] = useState<PilotageContrat | null>(null)
  // Estimation à enregistrer à la création d'un contrat « avec ces tarifs »
  const [pendingEstimation, setPendingEstimation] = useState<PilotageEstimation | null>(null)
  const estimateurRef = useRef<HTMLDetailsElement>(null)
  const loadEstimation = (c: PilotageContrat) => {
    const e = c.estimation
    if (!e) return
    setMode(e.mode); setTjm(e.tjm); setOverheadPct(e.overheadPct); setBufferPct(e.bufferPct)
    setMaintPct(e.maintPct); setCalcInfra(e.infra); setSupportH(e.supportH)
    setHeuresGagnees(e.heuresGagnees); setCoutHoraireClient(e.coutHoraireClient); setPartCaptee(e.partCaptee)
    setPremiumRevente(e.premiumRevente); setNbClientsFinaux(e.nbClientsFinaux); setPrixReventeMensuel(e.prixReventeMensuel)
    setFeatures(e.features.map((f) => ({ id: randomUUID(), nom: f.nom, taille: f.taille })))
    setLinkedContrat(c)
    setTimeout(() => estimateurRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
  const updateLinkedContrat = async () => {
    if (!linkedContrat) return
    await updateContrat(linkedContrat.id, {
      estimation: currentEstimation(),
      fraisMiseEnPlace: tarif.setup,
      abonnementMensuel: tarif.abo,
      coutFirebaseMensuel: calcInfra,
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

  // Estimateur de tarif (création sur-mesure)
  const [features, setFeatures] = useState<Feature[]>(DEFAULT_FEATURES)
  const [tjm, setTjm] = useState(500)              // taux journalier moyen €
  const [overheadPct, setOverheadPct] = useState(20) // frais de structure %
  const [bufferPct, setBufferPct] = useState(25)     // marge d'incertitude %
  const [maintPct, setMaintPct] = useState(18)       // maintenance /an, % du build
  const [calcInfra, setCalcInfra] = useState(20)     // coût infra €/mois
  const [supportH, setSupportH] = useState(1)        // support h/mois
  // Valeur côté client (ce que l'app lui rapporte)
  const [heuresGagnees, setHeuresGagnees] = useState(4)          // h/sem gagnées pour le client
  const [coutHoraireClient, setCoutHoraireClient] = useState(35) // coût horaire chargé côté client
  const [partCaptee, setPartCaptee] = useState(20)               // % de la valeur que tu captes
  // Mode de l'app : métier (client final) ou revente (revendeur / marque blanche)
  const [mode, setMode] = useState<'metier' | 'revente'>('metier')
  const [premiumRevente, setPremiumRevente] = useState(40)       // % en plus sur la création (droits commerciaux)
  const [nbClientsFinaux, setNbClientsFinaux] = useState(30)     // clients finaux visés par le revendeur
  const [prixReventeMensuel, setPrixReventeMensuel] = useState(40) // prix de revente /client final /mois

  // Analyse inversée : à partir de ce qui a été facturé, déduire le taux réalisé
  const [revCreation, setRevCreation] = useState(0)   // montant création facturé (€)
  const [revAbo, setRevAbo] = useState(0)             // abonnement mensuel facturé (€)
  const [revJours, setRevJours] = useState(0)         // jours réellement passés sur la création
  const [revSupportH, setRevSupportH] = useState(0)   // heures de support réelles /mois
  const analyse = useMemo(() => {
    const tjmReel = revJours > 0 ? revCreation / revJours : null
    const tauxHoraireReel = tjmReel != null ? tjmReel / 7 : null
    const aboAn = revAbo * 12
    const tauxHoraireRecurrent = revSupportH > 0 ? revAbo / revSupportH : null
    const verdict = tjmReel == null ? null : tjmReel < 400 ? 'bas' : tjmReel <= 650 ? 'marche' : 'haut'
    return { tjmReel, tauxHoraireReel, aboAn, tauxHoraireRecurrent, verdict }
  }, [revCreation, revAbo, revJours, revSupportH])

  const [showCatalogue, setShowCatalogue] = useState(false)
  const [editCatalogue, setEditCatalogue] = useState(false)
  const { items: catalogueItems, addItem: addCatItem, updateItem: updCatItem, deleteItem: delCatItem } = usePilotageCatalogue()

  const addFeature = () => setFeatures((f) => [...f, { id: randomUUID(), nom: '', taille: 'm' }])
  const updFeature = (id: string, patch: Partial<Feature>) =>
    setFeatures((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const delFeature = (id: string) => setFeatures((f) => f.filter((x) => x.id !== id))
  const addFromCatalogue = (nom: string, taille: TailleKey) =>
    setFeatures((f) =>
      f.some((x) => x.nom.trim().toLowerCase() === nom.toLowerCase())
        ? f
        : [...f, { id: randomUUID(), nom, taille }])

  // Catalogue groupé (par « groupe », dans l'ordre d'apparition)
  const catalogueGroupes = useMemo(() => {
    const map = new Map<string, typeof catalogueItems>()
    for (const it of catalogueItems) {
      const g = it.groupe?.trim() || 'Autres'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(it)
    }
    return Array.from(map, ([groupe, items]) => ({ groupe, items }))
  }, [catalogueItems])

  // Amorce le catalogue personnel avec les briques par défaut
  const seedCatalogue = async () => {
    for (const grp of DEFAULT_CATALOGUE)
      for (const it of grp.items)
        await addCatItem({ nom: it.nom, taille: it.taille, groupe: grp.groupe })
  }

  // Valeurs par défaut persistées (modifiables quand tu veux)
  const { settings, saveSettings } = usePilotageSettings()
  const [hydrated, setHydrated] = useState(false)
  const [savingDefaults, setSavingDefaults] = useState<'idle' | 'saving' | 'done'>('idle')
  useEffect(() => {
    if (!settings || hydrated) return
    if (settings.tjm != null) setTjm(settings.tjm)
    if (settings.overheadPct != null) setOverheadPct(settings.overheadPct)
    if (settings.bufferPct != null) setBufferPct(settings.bufferPct)
    if (settings.maintPct != null) setMaintPct(settings.maintPct)
    if (settings.infra != null) setCalcInfra(settings.infra)
    if (settings.supportH != null) setSupportH(settings.supportH)
    if (settings.heuresGagnees != null) setHeuresGagnees(settings.heuresGagnees)
    if (settings.coutHoraireClient != null) setCoutHoraireClient(settings.coutHoraireClient)
    if (settings.partCaptee != null) setPartCaptee(settings.partCaptee)
    if (settings.premiumRevente != null) setPremiumRevente(settings.premiumRevente)
    if (settings.nbClientsFinaux != null) setNbClientsFinaux(settings.nbClientsFinaux)
    if (settings.prixReventeMensuel != null) setPrixReventeMensuel(settings.prixReventeMensuel)
    if (settings.features && settings.features.length)
      setFeatures(settings.features.map((f) => ({ id: randomUUID(), nom: f.nom, taille: f.taille })))
    setHydrated(true)
  }, [settings, hydrated])

  const saveDefaults = async () => {
    setSavingDefaults('saving')
    try {
      await saveSettings({
        tjm, overheadPct, bufferPct, maintPct,
        infra: calcInfra, supportH,
        heuresGagnees, coutHoraireClient, partCaptee,
        premiumRevente, nbClientsFinaux, prixReventeMensuel,
        features: features.map(({ nom, taille }) => ({ nom, taille })),
      })
      setSavingDefaults('done')
      setTimeout(() => setSavingDefaults('idle'), 2000)
    } catch (err) {
      console.error('[pilotage settings]', err)
      setSavingDefaults('idle')
    }
  }

  const tarif = useMemo(() => {
    const revente = mode === 'revente'
    const joursDev = features.reduce((s, f) => s + TAILLES[f.taille].jours, 0)
    const joursTotal = joursDev * (1 + overheadPct / 100)         // dev + frais de structure
    const creationBas = round100(joursTotal * tjm)                 // sans marge d'incertitude
    // En revente : prime « droits commerciaux » sur la création (tu livres un produit à commercialiser)
    const reventeMult = revente ? 1 + premiumRevente / 100 : 1
    const setup = round100(joursTotal * tjm * (1 + bufferPct / 100) * reventeMult)
    const tauxHoraire = Math.round(tjm / 7)                        // jour ≈ 7 h facturables

    // Valeur générée :
    //  - métier  : temps gagné pour le client final
    //  - revente : revenu de revente du revendeur (nb clients × prix × 12)
    const valeurAn = revente
      ? nbClientsFinaux * prixReventeMensuel * 12
      : heuresGagnees * 52 * coutHoraireClient
    const valeurMois = valeurAn / 12

    // Abonnement / redevance : plancher (au coût) vs part de la valeur captée → on garde le + élevé
    const maintMensuelle = (setup * maintPct) / 100 / 12          // TMA : % du build /an → /mois
    const supportMensuel = supportH * tauxHoraire
    const aboPlancher = round10(maintMensuelle + calcInfra + supportMensuel)
    const aboValeur = round10((valeurAn * partCaptee) / 100 / 12)
    const abo = Math.max(aboPlancher, aboValeur)
    const aboBase = aboValeur > aboPlancher ? 'valeur' : 'cout'

    // Vision long terme : le récurrent est le cœur du modèle
    const total3ans = setup + abo * 36
    const pctRecurrent = total3ans > 0 ? Math.round(((abo * 36) / total3ans) * 100) : 0
    const paybackMois = valeurMois > 0 ? setup / valeurMois : null // mois pour rentabiliser la création

    return {
      revente, joursDev, joursTotal, creationBas, setup, tauxHoraire,
      valeurAn, valeurMois,
      maintMensuelle, supportMensuel, aboPlancher, aboValeur, abo, aboBase,
      total3ans, pctRecurrent, paybackMois,
    }
  }, [mode, features, tjm, overheadPct, bufferPct, maintPct, calcInfra, supportH, heuresGagnees, coutHoraireClient, partCaptee, premiumRevente, nbClientsFinaux, prixReventeMensuel])

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
  const openAdd = () => { setEditId(null); setPendingEstimation(null); setForm(emptyForm); setShowModal(true) }
  const openAddWithPricing = () => {
    setEditId(null)
    setPendingEstimation(currentEstimation())  // on attache le calcul courant au futur contrat
    setForm({
      ...emptyForm,
      abonnementMensuel: String(tarif.abo),
      fraisMiseEnPlace: String(tarif.setup),
      coutFirebaseMensuel: String(calcInfra),
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
        dateDebut: form.dateDebut ? Timestamp.fromDate(new Date(form.dateDebut)) : null,
        premiereAnnee: form.premiereAnnee,
        tarifAnnee2Defini: form.tarifAnnee2Defini,
        statut: form.statut,
        notes: form.notes.trim() || null,
        devisId: form.devisId || null,
        devisNumber: form.devisNumber || null,
      }
      // À la création « avec ces tarifs » : on enregistre le snapshot du calcul + un contenu projet amorcé.
      const extra = !editId && pendingEstimation ? { estimation: pendingEstimation, projet: seedProjet() } : {}
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
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <PlusIcon className="w-4 h-4" /> Nouveau contrat
        </button>
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
        <p className="text-xs text-gray-400 mb-3 mt-2">
          Découpe l'app en fonctionnalités et estime l'effort de chacune. Le prix se calcule façon freelance :
          jours × TJM + frais de structure + marge d'incertitude. La maintenance se déduit en % du coût de création.
        </p>

        {/* Mode : app métier (client final) vs app à revendre (revendeur / marque blanche) */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 mb-1">
          {([
            { key: 'metier', label: 'App métier (client final)' },
            { key: 'revente', label: 'App à revendre (revendeur)' },
          ] as const).map((m) => (
            <button key={m.key} type="button" onClick={() => setMode(m.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
                mode === m.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          {mode === 'revente'
            ? 'Tu livres une app que ton client va revendre (marque blanche). Tu factures une prime de droits commerciaux + une part du revenu de revente.'
            : 'Tu livres une app utilisée par le client lui-même. Le prix s\'appuie sur le temps qu\'elle lui fait gagner.'}
        </p>

        {/* Liste des fonctionnalités */}
        <div className="space-y-2">
          {features.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <input type="text" value={f.nom} placeholder="Nom de la fonctionnalité"
                onChange={(e) => updFeature(f.id, { nom: e.target.value })}
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={f.taille} onChange={(e) => updFeature(f.id, { taille: e.target.value as TailleKey })}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {(Object.keys(TAILLES) as TailleKey[]).map((k) => (
                  <option key={k} value={k}>{TAILLES[k].label} · {TAILLES[k].jours} j</option>
                ))}
              </select>
              <button type="button" onClick={() => delFeature(f.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={addFeature}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition">
              <PlusIcon className="w-3.5 h-3.5" /> Ajouter une ligne vide
            </button>
            <button type="button" onClick={() => setShowCatalogue((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition">
              <PlusIcon className="w-3.5 h-3.5" /> {showCatalogue ? 'Masquer le catalogue' : 'Ajouter depuis le catalogue'}
            </button>
          </div>
        </div>

        {/* Catalogue de briques (personnalisable, stocké dans Firestore) */}
        {showCatalogue && (
          <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[11px] text-indigo-700/70">
                {editCatalogue
                  ? 'Modifie, ajoute ou supprime tes briques. Les changements sont enregistrés automatiquement.'
                  : 'Clique pour ajouter une brique (taille modifiable ensuite). Les déjà ajoutées sont grisées.'}
              </p>
              {catalogueItems.length > 0 && (
                <button type="button" onClick={() => setEditCatalogue((v) => !v)}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded-lg transition shrink-0">
                  <PencilIcon className="w-3 h-3" /> {editCatalogue ? 'Terminé' : 'Gérer le catalogue'}
                </button>
              )}
            </div>

            {catalogueItems.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[11px] text-gray-500 mb-2">Ton catalogue est vide.</p>
                <button type="button" onClick={seedCatalogue}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition">
                  <PlusIcon className="w-3.5 h-3.5" /> Démarrer avec les briques par défaut
                </button>
              </div>
            ) : editCatalogue ? (
              /* ── Mode édition ── */
              <div className="space-y-1.5">
                {catalogueItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-1.5 flex-wrap">
                    <input type="text" defaultValue={it.nom} placeholder="Nom de la brique"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.nom) updCatItem(it.id, { nom: v }) }}
                      className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="text" defaultValue={it.groupe} placeholder="Groupe"
                      onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.groupe) updCatItem(it.id, { groupe: v }) }}
                      className="w-24 shrink-0 border border-gray-300 rounded-lg px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <select defaultValue={it.taille} title="Complexité / durée"
                      onChange={(e) => updCatItem(it.id, { taille: e.target.value as TailleKey })}
                      className="shrink-0 border border-gray-300 rounded-lg px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      {(Object.keys(TAILLES) as TailleKey[]).map((k) => (
                        <option key={k} value={k}>{TAILLES[k].label} · {TAILLES[k].jours}j</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => delCatItem(it.id)}
                      className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button"
                  onClick={() => addCatItem({ nom: 'Nouvelle brique', taille: 'm', groupe: catalogueItems[catalogueItems.length - 1]?.groupe ?? 'Fonctionnelles' })}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded-lg transition">
                  <PlusIcon className="w-3 h-3" /> Ajouter une brique au catalogue
                </button>
              </div>
            ) : (
              /* ── Mode sélection (puces) ── */
              catalogueGroupes.map((grp) => (
                <div key={grp.groupe}>
                  <p className="text-[11px] font-semibold text-indigo-800 mb-1.5">{grp.groupe}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.items.map((it) => {
                      const deja = features.some((x) => x.nom.trim().toLowerCase() === it.nom.toLowerCase())
                      return (
                        <button key={it.id} type="button" disabled={deja}
                          onClick={() => addFromCatalogue(it.nom, it.taille)}
                          className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition ${
                            deja
                              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default'
                              : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                          }`}>
                          {deja ? '✓' : <PlusIcon className="w-3 h-3" />} {it.nom}
                          <span className="text-[10px] text-gray-400">· {TAILLES[it.taille].jours}j</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Paramètres */}
        <details className="mt-4 group">
          <summary className="cursor-pointer text-xs font-medium text-blue-700 list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> À quoi servent ces réglages ?
          </summary>
          <div className="mt-2 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
            <p><strong>TJM</strong> : ton taux par jour. Repère France ≈ 400–650 €/j.</p>
            <p><strong>Frais de structure</strong> : le temps non-codé (réunions, gestion, déploiement). En général <strong>+20 %</strong> sur les jours de dev.</p>
            <p><strong>Marge d'incertitude</strong> : coussin contre la sous-estimation — on sous-estime toujours. <strong>+20 à 30 %</strong>. Si tout va bien, c'est de la marge en plus.</p>
            <p><strong>Maintenance /an</strong> : sert à calculer l'abonnement (corrections + petites évolutions + maj techniques). Standard : <strong>15–20 % du prix de création par an</strong>.</p>
            <p><strong>Coût infra /mois</strong> : ce que tu paies chaque mois pour faire tourner l'app (hébergement, Firebase…). S'ajoute au plancher de l'abonnement.</p>
            <p><strong>Support (h/mois)</strong> : heures d'assistance que tu prévois chaque mois. Valorisées à <strong>TJM ÷ 7</strong> (un jour ≈ 7 h facturables) ≈ <strong>{fmtEur(tarif.tauxHoraire)}/h</strong> actuellement. Ça s'ajoute aussi au plancher de l'abonnement.</p>
          </div>
        </details>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          {([
            { label: 'TJM (€/jour)', val: tjm, set: setTjm, hint: 'ton taux journalier', step: 25, min: 0 },
            { label: 'Frais de structure (%)', val: overheadPct, set: setOverheadPct, hint: 'gestion, réunions, tests, mise en prod', step: 5, min: 0 },
            { label: "Marge d'incertitude (%)", val: bufferPct, set: setBufferPct, hint: 'imprévus / sous-estimation', step: 5, min: 0 },
            { label: 'Maintenance /an (%)', val: maintPct, set: setMaintPct, hint: 'du coût de création (std 15–20)', step: 1, min: 0 },
            { label: 'Coût infra /mois (€)', val: calcInfra, set: setCalcInfra, hint: 'Firebase estimé', step: 1, min: 0 },
            { label: 'Support (h/mois)', val: supportH, set: setSupportH, hint: `assistance · ${fmtEur(tarif.tauxHoraire)}/h (TJM÷7)`, step: 0.5, min: 0 },
          ] as const).map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">{f.label}</label>
              <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>

        {/* Valeur — selon le mode (métier = temps gagné ; revente = revenu du revendeur) */}
        {mode === 'metier' ? (
        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-xs font-semibold text-amber-800 mb-1">Valeur générée pour le client</p>
          <p className="text-[11px] text-amber-700/70 mb-2">
            Le bon prix ne dépend pas de ton temps mais de ce que l'app rapporte au client. Estime-le ici.
          </p>
          <details className="mb-3 group">
            <summary className="cursor-pointer text-[11px] font-medium text-amber-800 list-none flex items-center gap-1.5">
              <span className="inline-block transition group-open:rotate-90">▸</span> Comment estimer ces chiffres ?
            </summary>
            <div className="mt-2 text-[11px] text-amber-900/80 bg-white/70 border border-amber-100 rounded-lg p-3 space-y-1.5">
              <p>Tu ne devines pas : tu <strong>demandes au client</strong> (c'est le rôle du cadrage). Pas besoin d'être précis, une estimation à la louche suffit.</p>
              <p><strong>Temps gagné/sem</strong> : « combien de temps tu passes aujourd'hui sur [ce que l'app remplace] ? » (ex : devis à la main = ~5h/sem).</p>
              <p><strong>Coût horaire client</strong> : la <em>valeur</em> de son heure, pas son salaire. Patron artisan ≈ 50–80 € (ce qu'il facture) ; salarié ≈ 30–50 €.</p>
              <p><strong>Part captée</strong> : tu prends <strong>10–25 %</strong> de la valeur créée. Le client doit clairement y gagner — c'est pour ça qu'il dit oui.</p>
              <p className="text-amber-700/70">💡 La vraie valeur est souvent plus que le temps gagné : moins d'erreurs, encaissement plus rapide, plus de chantiers signés.</p>
            </div>
          </details>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              { label: 'Temps gagné (h/sem)', val: heuresGagnees, set: setHeuresGagnees, hint: 'pour le client', step: 0.5, min: 0 },
              { label: 'Coût horaire client (€)', val: coutHoraireClient, set: setCoutHoraireClient, hint: 'coût chargé de son heure', step: 5, min: 0 },
              { label: 'Part de valeur captée (%)', val: partCaptee, set: setPartCaptee, hint: 'ta part (std 10–25)', step: 5, min: 0 },
            ] as const).map((f) => (
              <div key={f.label}>
                <label className="block text-[11px] font-medium text-amber-800/80 mb-1">{f.label}</label>
                <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                  onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                  className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
                <p className="text-[10px] text-amber-700/50 mt-0.5">{f.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-800 mt-3">
            → L'app rapporte ~ <strong>{fmtEur(tarif.valeurAn)}/an</strong> au client ({fmtEur(tarif.valeurMois)}/mois).
          </p>
        </div>
        ) : (
        <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
          <p className="text-xs font-semibold text-violet-800 mb-1">Valeur de revente</p>
          <p className="text-[11px] text-violet-700/70 mb-2">
            Ton client revend l'app (marque blanche) à SES clients. Sa valeur, c'est le chiffre d'affaires qu'il en tire — pas du temps gagné.
          </p>
          <details className="mb-3 group">
            <summary className="cursor-pointer text-[11px] font-medium text-violet-800 list-none flex items-center gap-1.5">
              <span className="inline-block transition group-open:rotate-90">▸</span> Comment estimer ces chiffres ?
            </summary>
            <div className="mt-2 text-[11px] text-violet-900/80 bg-white/70 border border-violet-100 rounded-lg p-3 space-y-1.5">
              <p><strong>Clients finaux</strong> : combien de clients le revendeur compte servir avec ton app (sa cible réaliste).</p>
              <p><strong>Prix de revente</strong> : ce qu'il facture chaque client final /mois.</p>
              <p><strong>Prime droits de revente</strong> : tu livres un produit à commercialiser, pas un outil interne → <strong>+30 à 50 %</strong> sur la création (et fais signer une licence / cession de droits claire).</p>
              <p><strong>Part de revenu captée</strong> : ta redevance = une part de SON revenu récurrent (royalty), std <strong>15–25 %</strong>. Il reste largement gagnant — c'est pour ça qu'il accepte.</p>
              <p className="text-violet-700/70">⚠️ Cadre juridiquement : qui possède le code ? licence d'exploitation ? exclusivité ? Ça aussi, ça se facture.</p>
            </div>
          </details>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {([
              { label: 'Clients finaux (nb)', val: nbClientsFinaux, set: setNbClientsFinaux, hint: 'cible du revendeur', step: 1, min: 0 },
              { label: 'Prix de revente /mois (€)', val: prixReventeMensuel, set: setPrixReventeMensuel, hint: 'par client final', step: 5, min: 0 },
              { label: 'Prime droits de revente (%)', val: premiumRevente, set: setPremiumRevente, hint: 'sur la création (std 30–50)', step: 5, min: 0 },
              { label: 'Part de revenu captée (%)', val: partCaptee, set: setPartCaptee, hint: 'ta royalty (std 15–25)', step: 5, min: 0 },
            ] as const).map((f) => (
              <div key={f.label}>
                <label className="block text-[11px] font-medium text-violet-800/80 mb-1">{f.label}</label>
                <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                  onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                  className="w-full border border-violet-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <p className="text-[10px] text-violet-700/50 mt-0.5">{f.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-violet-800 mt-3">
            → Le revendeur encaisse ~ <strong>{fmtEur(tarif.valeurAn)}/an</strong> ({fmtEur(tarif.valeurMois)}/mois) en revendant à {nbClientsFinaux} clients à {fmtEur(prixReventeMensuel)}/mois.
          </p>
        </div>
        )}

        {/* Résultat principal : le récurrent (cœur du modèle) */}
        <div className="mt-4 rounded-xl bg-blue-600 text-white p-4 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-blue-100">{tarif.revente ? 'Redevance /mois — ta part du revenu de revente' : 'Abonnement conseillé /mois — le cœur de ton modèle'}</p>
              <p className="text-3xl font-bold">{fmtEur(tarif.abo)}</p>
            </div>
            <div className="text-right text-[11px] text-blue-100 leading-relaxed">
              <p>plancher au coût : <strong className="text-white">{fmtEur(tarif.aboPlancher)}</strong></p>
              <p>part de la valeur ({partCaptee}%) : <strong className="text-white">{fmtEur(tarif.aboValeur)}</strong></p>
              <p className="mt-0.5">→ retenu : {tarif.aboBase === 'valeur' ? 'la valeur' : 'le plancher'}</p>
            </div>
          </div>
          <p className="text-[11px] text-blue-100/80 mt-2 border-t border-white/15 pt-2">
            On garde le + élevé entre ton coût (maintenance {fmtEur(tarif.maintMensuelle)} + infra {fmtEur(calcInfra)} + support {fmtEur(tarif.supportMensuel)}) et une part de la valeur créée — jamais en dessous du plancher.
          </p>
          {tarif.aboBase === 'cout' && tarif.aboValeur > 0 && (
            <p className="text-[11px] text-amber-200 bg-amber-900/30 rounded-lg px-2.5 py-1.5 mt-2">
              💡 Ta part de la valeur ({fmtEur(tarif.aboValeur)}/mois) est <strong>sous ton plancher coût</strong> ({fmtEur(tarif.aboPlancher)}) — c'est donc lui qui s'applique, et changer {tarif.revente ? 'le prix de revente' : 'la valeur'} ne déplace pas encore le total. Monte {tarif.revente ? 'le prix de revente, le nombre de clients' : 'la valeur'} ou ta part captée pour que la valeur prenne le dessus.
            </p>
          )}
        </div>

        {/* Création (one-shot) + vision 3 ans */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs text-emerald-700/70">{tarif.revente ? 'Création (forfait, droits de revente inclus)' : 'Création (forfait, one-shot)'}</p>
            <p className="text-2xl font-bold text-emerald-700">{fmtEur(tarif.setup)}</p>
            <p className="text-[11px] text-emerald-600/70 mt-0.5">fourchette {fmtEur(tarif.creationBas)} – {fmtEur(tarif.setup)}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              {tarif.joursDev.toFixed(1)} j dev → {tarif.joursTotal.toFixed(1)} j × {fmtEur(tjm)}/j, +{bufferPct}% d'incertitude{tarif.revente ? `, +${premiumRevente}% droits` : ''}
            </p>
            {tarif.paybackMois != null && tarif.paybackMois > 0 && (
              <p className="text-[10px] text-emerald-700 mt-1">Rentabilisé {tarif.revente ? 'par le revendeur' : 'par le client'} en ~{Math.ceil(tarif.paybackMois)} mois</p>
            )}
          </div>
          <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
            <p className="text-xs text-indigo-700/70">Valeur du contrat sur 3 ans</p>
            <p className="text-2xl font-bold text-indigo-700">{fmtEur(tarif.total3ans)}</p>
            <p className="text-[10px] text-gray-500 mt-1">création {fmtEur(tarif.setup)} + abo × 36 mois</p>
            <p className="text-[10px] text-indigo-700 mt-1"><strong>{tarif.pctRecurrent}%</strong> vient du récurrent — c'est ton fossé, pas le build.</p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
          <ExclamationTriangleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            {tarif.revente
              ? <>En revente, tu vends un <strong>actif que ton client va commercialiser</strong> : prends une prime sur la création <strong>et</strong> une part récurrente de ses revenus (royalty). Cadre les droits par écrit (licence, propriété du code, exclusivité).</>
              : <>Repère : TJM freelance dev en France ≈ <strong>400–650 €/jour</strong>. Mais facture à la <strong>valeur</strong>, pas à ton temps : si l'app rapporte gros au client, le prix juste monte — peu importe que l'IA t'ait fait gagner du temps.</>}
          </p>
        </div>

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

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
            <p className="text-xs text-emerald-700/70">TJM réalisé (création)</p>
            <p className="text-2xl font-bold text-emerald-700">{analyse.tjmReel != null ? fmtEur(analyse.tjmReel) : '—'}</p>
            <p className="text-[10px] text-gray-500 mt-1">
              {analyse.tauxHoraireReel != null ? `≈ ${fmtEur(analyse.tauxHoraireReel)}/h (jour ÷ 7)` : 'saisis les jours passés'}
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
          <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs text-blue-700/70">Récurrent</p>
            <p className="text-2xl font-bold text-blue-700">{fmtEur(analyse.aboAn)}<span className="text-sm font-medium text-blue-700/60">/an</span></p>
            <p className="text-[10px] text-gray-500 mt-1">
              {analyse.tauxHoraireRecurrent != null
                ? `≈ ${fmtEur(analyse.tauxHoraireRecurrent)}/h de support (abo ÷ heures)`
                : 'abonnement × 12'}
            </p>
          </div>
        </div>
      </details>

      {/* Prévisionnel (d'après tes contrats) */}
      <p className="text-xs text-gray-400 -mb-1">Prévisionnel — d'après tes contrats actifs. Distinct de ton CA réel (qui vient de ta facturation).</p>

      {/* Vue d'ensemble */}
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
                <button onClick={() => router.push(`/pilotage/contrat/${c.id}?tab=apercu`)}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition">
                  <EyeIcon className="w-3.5 h-3.5" /> Aperçu
                </button>
                {c.estimation && (
                  <button onClick={() => loadEstimation(c)}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition">
                    <CalculatorIcon className="w-3.5 h-3.5" /> Estimation
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
                ...devisDuClient.map((d) => ({ value: d.id, label: `${d.number} — ${fmtEur(d.total ?? 0)}` })),
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
          <div className="grid grid-cols-3 gap-3">
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
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible (n'affecte pas tes factures).</p>
        <div className="flex gap-3">
          <button onClick={() => setDeleteId(null)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
          <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">Supprimer</button>
        </div>
      </Modal>

    </div>
  )
}
