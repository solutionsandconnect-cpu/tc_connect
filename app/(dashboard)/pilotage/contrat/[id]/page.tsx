'use client'

// Page dédiée d'un contrat Pilotage : Documents · Contenu projet · Mentions légales · Tâches · Aperçu.
// Remplace l'ancien « modal dans un modal » (Documents → Infos) par un écran plein, propre.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { usePilotageContrats } from '@/hooks/usePilotageContrats'
import { useClients } from '@/hooks/useClients'
import { useCompanies } from '@/hooks/useCompanies'
import { usePilotageDocuments } from '@/hooks/usePilotageDocuments'
import { usePilotageSettings } from '@/hooks/usePilotageSettings'
import { uploadBlob, deleteImage } from '@/lib/uploadImage'
import SignaturePad from '@/components/ui/SignaturePad'
import Modal from '@/components/ui/Modal'
import { generatePilotageDocPdf, PILOTAGE_DOC_TYPES, STATUT_DOC_LABELS } from '@/lib/pilotageDocPdf'
import { buildDevisFromContrat } from '@/lib/pilotageDevis'
import { createFacture } from '@/lib/facturationService'
import { defaultLegalFields, legalFieldGroupsAll, type LegalFields } from '@/lib/pilotageLegalTemplates'
import { defaultProjetContent, DEFAULT_PLANNING_ETAPES, DEFAULT_PLANNING_TEMPLATE, generatePlanningFromTemplate, type ProjetContent } from '@/lib/pilotageProjetTemplates'
import { StringListEditor, FonctionsEditor, PlanningEditor, HorsPerimetreEditor, TacheAjoutForm, TachesApercu, PlanningApercu, ProjetApercu, tauxHoraireFromTjm, prixFacture, estEnRetard } from '@/components/pilotage/ProjetUI'
import { CharteEditor, CharteApercu, defaultCharte } from '@/components/pilotage/CharteUI'
import EstimateurTarif from '@/components/pilotage/EstimateurTarif'
import { computeTarif, stateFromEstimation, fmtEur, type TarifResult } from '@/lib/pilotageEstimateur'
import { randomUUID } from '@/lib/uuid'
import type { PilotageContrat, PilotageDocument, PilotageDocumentType, ChartGraphique, PilotageEstimation, SavedEstimation, DevisOption } from '@/types'
import {
  ArrowLeftIcon, TrashIcon, PlusIcon, CheckIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, PencilIcon,
  EyeIcon, ArrowPathIcon,
} from '@heroicons/react/24/outline'

const TABS = [
  { key: 'documents', label: 'Documents' },
  { key: 'calculateur', label: 'Calculateur' },
  { key: 'projet', label: 'Contenu projet' },
  { key: 'charte', label: 'Charte & cadrage' },
  { key: 'planning', label: 'Planning' },
  { key: 'legal', label: 'Mentions légales' },
  { key: 'taches', label: 'Tâches' },
  { key: 'apercu', label: 'Aperçu' },
] as const
type TabKey = typeof TABS[number]['key']

// Sous-titre + ouverture par défaut de chaque section légale (accordéon)
function legalGroupMeta(titre: string): { sub: string; open: boolean } {
  if (titre.startsWith('Prestataire')) return { sub: 'Tes infos — pré-remplies depuis ta Société', open: false }
  if (titre === 'Client') return { sub: 'Pré-rempli depuis la fiche client', open: false }
  if (titre.startsWith('Conditions')) return { sub: 'Contrat de prestation de services', open: true }
  if (titre.startsWith('RGPD')) return { sub: 'Accord DPA — si l’app traite des données personnelles', open: false }
  if (titre.startsWith('Licence')) return { sub: 'Contrat de licence / cession de droits', open: false }
  return { sub: '', open: false }
}

// Barre d'action d'un onglet éditable : lecture seule → « Modifier » → « Annuler » / « Enregistrer »
function EditBar({ editing, onEdit, onCancel, onSave, saveState }: {
  editing: boolean; onEdit: () => void; onCancel: () => void; onSave: () => void; saveState: 'idle' | 'saving' | 'done'
}) {
  if (editing) return (
    <div className="flex items-center justify-end gap-2">
      <button onClick={onCancel} className="text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition">Annuler</button>
      <button onClick={onSave} disabled={saveState === 'saving'}
        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition">
        {saveState === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  )
  return (
    <div className="flex items-center justify-between gap-2">
      {saveState === 'done'
        ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckIcon className="w-3.5 h-3.5" /> Enregistré</span>
        : <span />}
      <button onClick={onEdit}
        className="flex items-center gap-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-1.5 rounded-lg transition">
        <PencilIcon className="w-4 h-4" /> Modifier
      </button>
    </div>
  )
}

// Lecture seule des mentions légales (n'affiche que les champs renseignés)
function LegalApercu({ legal }: { legal: LegalFields }) {
  const groups = legalFieldGroupsAll()
    .map((g) => ({ titre: g.titre, champs: g.champs.filter((ch) => (legal[ch.key] ?? '').trim()) }))
    .filter((g) => g.champs.length > 0)
  if (groups.length === 0)
    return <p className="text-sm text-gray-400 text-center py-10">Aucune mention renseignée.<br />Clique sur « Modifier » pour remplir.</p>
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.titre}>
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{g.titre}</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {g.champs.map((ch) => (
              <div key={ch.key} className={ch.multiline ? 'sm:col-span-2' : ''}>
                <dt className="text-[11px] text-gray-400">{ch.label}</dt>
                <dd className="text-sm text-gray-700 whitespace-pre-wrap">{legal[ch.key]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

export default function ContratPage() {
  const router = useRouter()
  const params = useParams()
  const id = String(params?.id ?? '')
  const { userProfile, currentUser } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const { contrats, loading, updateContrat } = usePilotageContrats()
  const { clients } = useClients()
  const { companies } = useCompanies()
  const company = useMemo(
    () => companies.find((c) => (c.nom ?? '').toLowerCase().includes('solutions')) ?? companies[0] ?? null,
    [companies])
  const contrat = useMemo(() => contrats.find((c) => c.id === id) ?? null, [contrats, id])
  const { documents, addDocument, updateDocument, deleteDocument } = usePilotageDocuments(id)

  // Génère un devis de prestation pré-rempli depuis le contrat, puis ouvre la fiche devis.
  const [genDevis, setGenDevis] = useState(false)
  const generateDevis = async () => {
    if (!contrat || !currentUser) return
    setGenDevis(true)
    try {
      const client = clients.find((c) => c.id === contrat.clientId) ?? null
      const payload = buildDevisFromContrat(contrat, {
        userId: currentUser.uid,
        client,
        companyId: company?.id,
        companyNom: company?.nom,
      })
      const ref = await createFacture(payload)
      router.push(`/facturation/${ref.id}`)
    } catch (e) {
      console.error('[generateDevis]', e)
      setGenDevis(false)
    }
  }
  const { settings, saveSettings } = usePilotageSettings()
  // Étapes-types du planning (liste déroulante, persistées dans pilotage_settings et éditables)
  const etapesTypes = settings?.planningEtapes ?? DEFAULT_PLANNING_ETAPES
  const [etapesDraft, setEtapesDraft] = useState<string[] | null>(null)
  const etapesManaged = etapesDraft ?? etapesTypes
  const saveEtapes = () => { saveSettings({ planningEtapes: etapesManaged }); setEtapesDraft(null) }
  // Modèle de planning : génération en un clic + enregistrement du planning courant comme modèle
  const planningTemplate = settings?.planningTemplate?.length ? settings.planningTemplate : DEFAULT_PLANNING_TEMPLATE
  const [genConfirm, setGenConfirm] = useState(false)
  const [modeleSaved, setModeleSaved] = useState(false)
  const [showAjout, setShowAjout] = useState(false)   // onglet Tâches : afficher le formulaire d'ajout
  const todayStr = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const doGenerate = () => { updP({ planning: generatePlanningFromTemplate(planningTemplate, todayStr()) }); setGenConfirm(false) }
  const onGenerate = () => { if (formProjet.planning.length > 0) setGenConfirm(true); else doGenerate() }
  const savePlanningModele = () => { saveSettings({ planningTemplate: formProjet.planning.map((s) => ({ ...s, date: '', ancre: undefined })) }); setModeleSaved(true); setTimeout(() => setModeleSaved(false), 2000) }

  const [tab, setTab] = useState<TabKey>('documents')
  const [editing, setEditing] = useState(false)
  const [formProjet, setFormProjet] = useState<ProjetContent>(defaultProjetContent())
  const [formLegal, setFormLegal] = useState<LegalFields>(defaultLegalFields())
  const [formCharte, setFormCharte] = useState<ChartGraphique>(defaultCharte())
  const [formOptions, setFormOptions] = useState<DevisOption[]>([])
  // Options à la carte du devis (hors flux Modifier/Enregistrer)
  const persistOptions = async (next: DevisOption[]) => {
    setFormOptions(next)
    if (contrat) { try { await updateContrat(contrat.id, { optionsDevis: next } as Partial<PilotageContrat>) } catch (e) { console.error('[options persist]', e) } }
  }
  const updOpt = (i: number, patch: Partial<DevisOption>) => setFormOptions((p) => p.map((x, idx) => idx === i ? { ...x, ...patch } : x))
  const saveOpts = () => { if (contrat) updateContrat(contrat.id, { optionsDevis: formOptions } as Partial<PilotageContrat>).catch((e) => console.error('[options persist]', e)) }
  // Formulaire d'ajout d'une option (champs vidés après ajout)
  const [optDraft, setOptDraft] = useState<DevisOption>({ label: '' })
  const [editOptIdx, setEditOptIdx] = useState<number | null>(null) // option en cours d'édition (lecture seule par défaut)
  const addOption = () => {
    if (!optDraft.label.trim()) return
    persistOptions([...formOptions, { ...optDraft, label: optDraft.label.trim() }])
    setOptDraft({ label: '' })
  }
  const fmtOptPrice = (o: DevisOption) =>
    o.prixMin != null && o.prixMax != null ? `${o.prixMin} – ${o.prixMax} €`
      : o.prixMin != null ? `${o.prixMin} €` : 'sur devis'
  const [newDocType, setNewDocType] = useState<PilotageDocumentType>('cahier_charges')
  const [signDoc, setSignDoc] = useState<PilotageDocument | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle')
  const hydratedFor = useRef<string | null>(null)

  const updP = (patch: Partial<ProjetContent>) => setFormProjet((p) => ({ ...p, ...patch }))
  const updL = (k: keyof LegalFields, v: string) => setFormLegal((f) => ({ ...f, [k]: v }))
  // Taux horaire (TJM ÷ 7) — TJM saisi sur le contrat en priorité, sinon estimation rattachée, sinon réglage global
  const tauxHoraire = tauxHoraireFromTjm(contrat?.tjm ?? contrat?.estimation?.tjm ?? settings?.tjm ?? 500)
  const aFacturer = (formProjet.taches ?? []).filter((t) => t.facturation === 'facturer' && !t.facturee)
  const totalAFacturer = aFacturer.reduce((s, t) => s + (prixFacture(t, tauxHoraire) ?? 0), 0)
  const aujourdhui = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
  const enRetard = (formProjet.taches ?? []).filter((t) => estEnRetard(t, aujourdhui))

  // (Ré)initialise les formulaires depuis le contrat enregistré (prestataire = société, client = fiche client, puis sauvegardé)
  const resetForms = useCallback(() => {
    if (!contrat) return
    const cli = clients.find((x) => x.id === contrat.clientId)
    const clientAdresse = cli?.adresseEntreprise || [cli?.adresse, cli?.codePostal, cli?.ville].filter(Boolean).join(', ')
    const clientRepresentant = cli?.representantEntreprise || [cli?.prenom, cli?.nom].filter(Boolean).join(' ').trim()
    const prestaAdresse = [company?.adresse, company?.codePostal, company?.ville].filter(Boolean).join(', ')
    const prefill = defaultLegalFields({
      prestataireNom: company?.nom || 'Solutions & Connect',
      prestataireSiret: company?.siret || '',
      prestataireAdresse: prestaAdresse,
      prestataireEmail: company?.email || 'solutionsandconnect@gmail.com',
      prestataireTel: company?.telephone || '+33 6 79 40 82 54',
      prestataireRepresentant: company?.representant || '',
      clientNom: cli?.nomEntreprise || contrat.clientNom || '',
      clientAdresse,
      clientSiret: cli?.siret || '',
      clientRepresentant,
      date: new Date().toLocaleDateString('fr-FR'),
      prixCreation: contrat.fraisMiseEnPlace != null ? String(contrat.fraisMiseEnPlace) : '',
      prixAbo: contrat.abonnementMensuel != null ? String(contrat.abonnementMensuel) : '',
    })
    const saved = contrat.legal
    if (saved) for (const k of Object.keys(saved) as (keyof LegalFields)[]) { if (saved[k]) prefill[k] = saved[k] }
    setFormLegal(prefill)
    setFormProjet(contrat.projet ? defaultProjetContent(contrat.projet) : defaultProjetContent())
    setFormCharte(contrat.charte ? defaultCharte(contrat.charte) : defaultCharte())
    setFormOptions(contrat.optionsDevis ?? [])
  }, [contrat, clients, company])

  // Onglet initial depuis ?tab=… (lu côté client pour éviter une frontière Suspense)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t && TABS.some((x) => x.key === t)) setTab(t as TabKey)
  }, [])

  // Hydrate les formulaires une fois le contrat chargé
  useEffect(() => {
    if (!contrat || hydratedFor.current === contrat.id) return
    resetForms()
    hydratedFor.current = contrat.id
  }, [contrat, resetForms])

  // Changement d'onglet : retour en lecture seule, on annule les modifications non enregistrées
  const goTab = (k: TabKey) => { setEditing(false); resetForms(); setTab(k) }
  const cancelEdit = () => { resetForms(); setEditing(false) }

  const save = async () => {
    if (!contrat) return
    setSaveState('saving')
    try {
      await updateContrat(contrat.id, { projet: formProjet, legal: formLegal, charte: formCharte })
      setEditing(false)
      setSaveState('done'); setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) { console.error('[contrat save]', e); setSaveState('idle') }
  }

  // Édition/suppression d'une seule ligne depuis la lecture seule : on met à jour et on enregistre tout de suite.
  const persistProjet = async (patch: Partial<ProjetContent>) => {
    const next = { ...formProjet, ...patch }
    setFormProjet(next)
    if (contrat) { try { await updateContrat(contrat.id, { projet: next }) } catch (e) { console.error('[contrat persist]', e) } }
  }

  // Un seul document de chaque type par contrat : on masque les types déjà créés.
  const usedTypes = useMemo(() => new Set(documents.map((d) => d.type)), [documents])
  const availableDocTypes = useMemo(() => PILOTAGE_DOC_TYPES.filter((t) => !usedTypes.has(t.value)), [usedTypes])
  // Garde le type sélectionné valide (parmi ceux encore disponibles)
  useEffect(() => {
    if (availableDocTypes.length === 0) return
    if (!availableDocTypes.some((t) => t.value === newDocType)) setNewDocType(availableDocTypes[0].value)
  }, [availableDocTypes, newDocType])

  const createDoc = async () => {
    if (!contrat || usedTypes.has(newDocType)) return
    const meta = PILOTAGE_DOC_TYPES.find((t) => t.value === newDocType)
    await addDocument({
      contratId: contrat.id,
      clientNom: contrat.clientNom ?? '',
      type: newDocType,
      titre: `${meta?.label ?? 'Document'}${contrat.clientNom ? ' — ' + contrat.clientNom : ''}`,
      version: '1.0',
      statut: 'brouillon',
    } as Omit<PilotageDocument, 'id' | 'createdAt'>)
  }

  // ── PDF : génération → stockage Storage → ouverture/téléchargement ──
  const [pdfBusy, setPdfBusy] = useState<string | null>(null)
  const [delDoc, setDelDoc] = useState<PilotageDocument | null>(null)

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  // Génère (ou régénère) le PDF, le stocke sur le contrat et le télécharge.
  const genererPdf = async (d: PilotageDocument) => {
    if (!currentUser) return
    setPdfBusy(d.id)
    try {
      const { blob, filename } = await generatePilotageDocPdf(d, { company, projet: formProjet, legal: formLegal, charte: formCharte })
      const url = await uploadBlob(blob, `users/${currentUser.uid}/pilotage_pdf/${d.contratId}/${d.id}.pdf`)
      await updateDocument(d.id, { pdfUrl: url, pdfNom: filename, pdfGeneeLe: Timestamp.now() })
      triggerDownload(blob, filename)
    } catch (e) { console.error('[pilotage pdf]', e) }
    setPdfBusy(null)
  }

  // Ouvre le PDF déjà stocké, sans en régénérer un.
  const ouvrirPdf = (d: PilotageDocument) => { if (d.pdfUrl) window.open(d.pdfUrl, '_blank', 'noopener,noreferrer') }

  // Suppression d'un document (après confirmation) : enlève aussi PDF + signature du Storage.
  const confirmDeleteDoc = async () => {
    const target = delDoc
    if (!target) return
    setDelDoc(null)
    try {
      await Promise.all([target.pdfUrl, target.signatureUrl].filter(Boolean).map((u) => deleteImage(u as string)))
      await deleteDocument(target.id)
    } catch (e) { console.error('[pilotage doc delete]', e) }
  }

  const handleSign = async (dataUrl: string) => {
    if (!signDoc || !currentUser) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const url = await uploadBlob(blob, `users/${currentUser.uid}/pilotage_signatures/${signDoc.id}.png`)
      await updateDocument(signDoc.id, { signe: true, statut: 'signe', signeLe: Timestamp.now(), signatureUrl: url })
    } catch (e) { console.error('[pilotage sign]', e) }
    setSignDoc(null)
  }

  // Upload d'un fichier de charte (logo, image…) vers Storage
  const uploadCharteFile = async (file: File) => {
    if (!currentUser || !contrat) throw new Error('Contexte manquant')
    const safe = file.name.replace(/[^a-z0-9._-]/gi, '_')
    const url = await uploadBlob(file, `users/${currentUser.uid}/pilotage_charte/${contrat.id}/${Date.now()}-${safe}`)
    return { name: file.name, url }
  }

  // ── Onglet Calculateur : plusieurs estimations nommées + sélection « validée » ──
  const [estEditingId, setEstEditingId] = useState<string | null>(null) // null = liste ; 'new' ou id = édition
  const [estLabel, setEstLabel] = useState('')
  const [estSeed, setEstSeed] = useState<PilotageEstimation | null>(null)
  const [estLive, setEstLive] = useState<{ est: PilotageEstimation; tarif: TarifResult } | null>(null)
  const [delEstId, setDelEstId] = useState<string | null>(null)

  const estimations: SavedEstimation[] = contrat?.estimations ?? []
  const estSelectedId = contrat?.estimationSelectedId ?? null

  // Migration douce : ancienne estimation unique → liste (une seule fois)
  const migratedEst = useRef(false)
  useEffect(() => {
    if (migratedEst.current || !contrat) return
    if (!contrat.estimations && contrat.estimation) {
      migratedEst.current = true
      const id = randomUUID()
      updateContrat(contrat.id, {
        estimations: [{ id, label: 'Estimation initiale', ...contrat.estimation }],
        estimationSelectedId: contrat.estimationSelectedId ?? id,
      } as Partial<PilotageContrat>).catch((e) => console.error('[pilotage est migrate]', e))
    }
  }, [contrat])

  const newEst = () => { setEstEditingId('new'); setEstLabel(''); setEstSeed(null); setEstLive(null) }
  const editEst = (e: SavedEstimation) => { setEstEditingId(e.id); setEstLabel(e.label); setEstSeed(e); setEstLive(null) }
  const cancelEst = () => { setEstEditingId(null); setEstLive(null) }

  const saveEst = async () => {
    if (!contrat || !estLive) return
    const label = estLabel.trim() || `Estimation ${estimations.length + 1}`
    let next: SavedEstimation[]
    let selId = estSelectedId
    if (estEditingId === 'new') {
      const id = randomUUID()
      next = [...estimations, { id, label, ...estLive.est }]
      if (!selId) selId = id   // première estimation → validée par défaut
    } else {
      next = estimations.map((e) => (e.id === estEditingId ? { id: e.id, label, ...estLive.est } : e))
    }
    try {
      await updateContrat(contrat.id, { estimations: next, estimationSelectedId: selId ?? null } as Partial<PilotageContrat>)
      setEstEditingId(null); setEstLive(null)
    } catch (e) { console.error('[pilotage est save]', e) }
  }

  // « Valider » : ne change QUE le TJM du contrat (utilisé pour le prix des tâches à facturer)
  const validerEst = async (e: SavedEstimation) => {
    if (!contrat) return
    try { await updateContrat(contrat.id, { estimationSelectedId: e.id, tjm: e.tjm } as Partial<PilotageContrat>) }
    catch (err) { console.error('[pilotage est select]', err) }
  }

  const confirmDeleteEst = async () => {
    if (!contrat || !delEstId) return
    const id = delEstId; setDelEstId(null)
    const next = estimations.filter((e) => e.id !== id)
    const selId = estSelectedId === id ? (next[0]?.id ?? null) : estSelectedId
    try { await updateContrat(contrat.id, { estimations: next, estimationSelectedId: selId } as Partial<PilotageContrat>) }
    catch (err) { console.error('[pilotage est delete]', err) }
  }

  // Optionnel : aligner les autres chiffres du contrat sur l'estimation validée
  const alignerContrat = async (e: SavedEstimation) => {
    if (!contrat) return
    const t = computeTarif(stateFromEstimation(e))
    try { await updateContrat(contrat.id, { fraisMiseEnPlace: t.setup, abonnementMensuel: t.abo, coutFirebaseMensuel: e.infra } as Partial<PilotageContrat>) }
    catch (err) { console.error('[pilotage est align]', err) }
  }

  if (!isAdmin) return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé.</p></div>
  if (!contrat) {
    return loading
      ? <div className="text-center py-20 text-gray-400">Chargement…</div>
      : (
        <div className="text-center py-20">
          <p className="text-gray-400 mb-4">Contrat introuvable.</p>
          <button onClick={() => router.push('/pilotage')} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg transition">
            <ArrowLeftIcon className="w-4 h-4" /> Retour au pilotage
          </button>
        </div>
      )
  }

  return (
    <div className="space-y-5 pb-24">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/pilotage')} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition shrink-0">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-800 truncate">{contrat.clientNom || 'Contrat'}</h1>
            <p className="text-xs text-gray-400">Documents · contenu projet · mentions légales</p>
          </div>
        </div>
        <button onClick={generateDevis} disabled={genDevis}
          title="Crée un devis de prestation pré-rempli depuis ce contrat (objet, lignes, inclus, options, modalités)"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition shrink-0">
          <PlusIcon className="w-4 h-4" /> {genDevis ? 'Génération…' : 'Générer un devis'}
        </button>
      </div>

      {/* Onglets — une seule ligne : défilement latéral sur mobile (desktop : tout tient), reste en place au scroll vertical */}
      <div className="flex flex-nowrap gap-1 border-b border-gray-200 sticky top-0 bg-white z-10 pt-1 overflow-x-auto overflow-y-hidden touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => goTab(t.key)}
            className={`shrink-0 px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
        {tab === 'documents' && (
          <div className="space-y-4">
            {availableDocTypes.length === 0 ? (
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                Tous les types de documents ont été créés pour ce contrat. Chaque document n'existe qu'en un seul exemplaire (modifie-le ou régénère son PDF ci-dessous).
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="w-full sm:flex-1 sm:min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Type de document</label>
                  <select value={newDocType} onChange={(e) => setNewDocType(e.target.value as PilotageDocumentType)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {(['projet', 'legal'] as const).map((fam) => {
                      const opts = availableDocTypes.filter((t) => t.famille === fam)
                      if (opts.length === 0) return null
                      return (
                        <optgroup key={fam} label={fam === 'projet' ? 'Documents projet' : 'Contrats légaux'}>
                          {opts.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </optgroup>
                      )
                    })}
                  </select>
                </div>
                <button onClick={createDoc}
                  className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition w-full sm:w-auto shrink-0">
                  <PlusIcon className="w-4 h-4" /> Créer
                </button>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Aucun document pour ce contrat.</div>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => {
                  // PDF obsolète : le contenu du contrat a changé après la dernière génération
                  const pdfStale = !!d.pdfUrl && !!d.pdfGeneeLe && (contrat.updatedAt?.toMillis?.() ?? 0) > d.pdfGeneeLe.toMillis()
                  return (
                  <div key={d.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.titre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">v{d.version}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          d.statut === 'signe' ? 'bg-green-100 text-green-700'
                            : d.statut === 'finalise' ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}>{STATUT_DOC_LABELS[d.statut] ?? d.statut}</span>
                        {d.pdfUrl && !pdfStale && (
                          <span className="text-[10px] text-gray-400">
                            PDF {d.pdfGeneeLe ? 'du ' + new Date(d.pdfGeneeLe.toMillis()).toLocaleDateString('fr-FR') : 'prêt'}
                          </span>
                        )}
                        {pdfStale && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Contenu modifié — à régénérer
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!d.signe && (
                        <button onClick={() => setSignDoc(d)} title="Signer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      )}
                      {d.pdfUrl ? (
                        <>
                          <button onClick={() => ouvrirPdf(d)} title="Ouvrir le PDF"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => genererPdf(d)} disabled={pdfBusy === d.id} title="Mettre à jour le PDF (régénérer)"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-40">
                            <ArrowPathIcon className={`w-4 h-4 ${pdfBusy === d.id ? 'animate-spin' : ''}`} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => genererPdf(d)} disabled={pdfBusy === d.id} title="Générer le PDF"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-40">
                          <ArrowDownTrayIcon className={`w-4 h-4 ${pdfBusy === d.id ? 'animate-pulse' : ''}`} />
                        </button>
                      )}
                      <button onClick={() => setDelDoc(d)} title="Supprimer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  )
                })}
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Les documents projet (cahier des charges, bilan, besoins) partagent le <strong>contenu projet</strong> saisi sous l'onglet dédié. Le logo et les coordonnées viennent de ta société « {company?.nom ?? 'Solutions & Connect'} ». Le PDF généré est <strong>conservé</strong> : <strong>Ouvrir</strong> ré-affiche le même fichier, <strong>Mettre à jour</strong> le régénère depuis le contenu actuel (pense à <strong>enregistrer</strong> tes modifications avant).
            </p>
          </div>
        )}

        {tab === 'calculateur' && (
          <div className="space-y-4">
            {estEditingId === null ? (
              <>
                {/* Alerte : l'estimation validée n'est pas alignée avec les chiffres du contrat */}
                {(() => {
                  const sel = estimations.find((e) => e.id === estSelectedId)
                  if (!sel) return null
                  const t = computeTarif(stateFromEstimation(sel))
                  const diffs: string[] = []
                  if ((contrat.fraisMiseEnPlace ?? null) !== t.setup) diffs.push(`création contrat ${contrat.fraisMiseEnPlace != null ? fmtEur(contrat.fraisMiseEnPlace) : '—'} ≠ estimation ${fmtEur(t.setup)}`)
                  if ((contrat.abonnementMensuel ?? null) !== t.abo) diffs.push(`abonnement contrat ${contrat.abonnementMensuel != null ? fmtEur(contrat.abonnementMensuel) : '—'} ≠ estimation ${fmtEur(t.abo)}`)
                  if ((contrat.coutFirebaseMensuel ?? null) !== sel.infra) diffs.push(`coût infra contrat ${contrat.coutFirebaseMensuel != null ? fmtEur(contrat.coutFirebaseMensuel) : '—'} ≠ estimation ${fmtEur(sel.infra)}`)
                  if (diffs.length === 0) return null
                  return (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                      <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p>L'estimation validée <strong>« {sel.label} »</strong> n'est pas identique aux chiffres saisis sur le contrat (seul le <strong>TJM</strong> est repris). Pour info :</p>
                        <ul className="list-disc ml-4 mt-1 space-y-0.5 text-amber-700">{diffs.map((d, i) => <li key={i}>{d}</li>)}</ul>
                        <button onClick={() => alignerContrat(sel)} className="mt-1.5 text-[11px] font-medium text-amber-800 underline hover:no-underline">Aligner les chiffres du contrat sur cette estimation</button>
                      </div>
                    </div>
                  )
                })()}

                {estimations.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Aucune estimation. Crée-en une pour chiffrer ce contrat — tu peux en enregistrer plusieurs (ex. « client final » et « revendeur ») et comparer.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {estimations.map((e) => {
                      const t = computeTarif(stateFromEstimation(e))
                      const sel = e.id === estSelectedId
                      return (
                        <div key={e.id} className={`rounded-xl p-3 border ${sel ? 'border-blue-300 bg-blue-50/40' : 'border-gray-100'}`}>
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800">{e.label}</p>
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${e.mode === 'revente' ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'}`}>{e.mode === 'revente' ? 'Revendeur' : 'Client final'}</span>
                                {sel && <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white"><CheckIcon className="w-3 h-3" /> Validée</span>}
                              </div>
                              <p className="text-[11px] text-gray-500 mt-1">
                                TJM <strong>{fmtEur(e.tjm)}</strong> · création <strong>{fmtEur(t.setup)}</strong> · {e.mode === 'revente' ? 'redevance' : 'abonnement'} <strong>{fmtEur(t.abo)}</strong>/mois
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!sel && (
                                <button onClick={() => validerEst(e)} title="Valider (pilote le TJM des tâches)"
                                  className="text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition">Valider</button>
                              )}
                              <button onClick={() => editEst(e)} title="Modifier"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"><PencilIcon className="w-4 h-4" /></button>
                              <button onClick={() => setDelEstId(e.id)} title="Supprimer"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button onClick={newEst}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                    <PlusIcon className="w-4 h-4" /> Nouvelle estimation
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  <strong>Valider</strong> une estimation fixe le <strong>TJM</strong> utilisé pour chiffrer les tâches « à facturer ». Les autres chiffres du contrat (frais, abonnement, infra) ne changent pas automatiquement — une alerte s'affiche s'ils diffèrent.
                </p>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'estimation</label>
                  <input value={estLabel} onChange={(e) => setEstLabel(e.target.value)} placeholder="ex : Client final, Revendeur…"
                    className="w-full sm:max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <EstimateurTarif
                  key={estEditingId}
                  initial={estSeed}
                  defaults={settings}
                  onChange={(est, t) => setEstLive({ est, tarif: t })}
                  footer={(
                    <div className="mt-3 flex items-center gap-2">
                      <button onClick={cancelEst}
                        className="text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition">Annuler</button>
                      <button onClick={saveEst} disabled={!estLive}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition">
                        <CheckIcon className="w-4 h-4" /> {estEditingId === 'new' ? 'Enregistrer l\'estimation' : 'Enregistrer les modifications'}
                      </button>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        )}

        {tab === 'projet' && (
          <div className="space-y-4">
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Contexte</p>
                  <textarea rows={3} value={formProjet.contexte} onChange={(e) => updP({ contexte: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Fonctionnalités</p>
                  <p className="text-[11px] text-gray-400 mb-2">Ce que l'app <em>fait</em>, regroupé par thème. La <strong>catégorie</strong> = le module fonctionnel ; la description = le comportement concret.</p>
                  <FonctionsEditor items={formProjet.fonctionnalites} onChange={(v) => updP({ fonctionnalites: v })} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Livrables</p>
                  <p className="text-[11px] text-gray-400 mb-2">Ce que le client <strong>reçoit concrètement</strong> (≠ fonctionnalités).</p>
                  <StringListEditor items={formProjet.livrables} onChange={(v) => updP({ livrables: v })} placeholder="Livrable…" reorderable />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Hors-périmètre <span className="font-normal normal-case text-gray-400">— apparaît sur le cahier des charges</span></p>
                  <p className="text-[11px] text-gray-400 mb-2">Ce qui n'est <strong>pas compris</strong> dans le prix. Coche les exclusions qui s'appliquent.</p>
                  <HorsPerimetreEditor items={formProjet.horsPerimetre} onChange={(v) => updP({ horsPerimetre: v })} />
                </div>
              </div>
            ) : (
              <ProjetApercu projet={formProjet} only={['contexte', 'fonctionnalites', 'livrables', 'horsPerimetre']} />
            )}

            {/* Options à la carte proposées sur le devis de prestation */}
            <details className="border border-gray-200 rounded-xl">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700 select-none">
                Options à la carte du devis
                <span className="ml-1 text-xs text-gray-400">({formOptions.length}) — chiffrées, hors total</span>
              </summary>
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500">Propositions supplémentaires affichées sur le devis (ex : module vidéo, publication stores…), non comptées dans le total. Reprises automatiquement par « Générer un devis ».</p>

                {/* Options déjà créées — lecture seule par défaut (crayon = modifier) */}
                {formOptions.length > 0 && (
                  <div className="space-y-2">
                    {formOptions.map((o, i) => editOptIdx === i ? (
                      <div key={i} className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50/30">
                        <input value={o.label} onChange={(e) => updOpt(i, { label: e.target.value })}
                          placeholder="Intitulé de l'option" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <textarea value={o.description ?? ''} onChange={(e) => updOpt(i, { description: e.target.value })}
                          rows={2} placeholder="Description (optionnel)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-gray-500">Prix</span>
                          <input type="number" value={o.prixMin ?? ''} onChange={(e) => updOpt(i, { prixMin: e.target.value === '' ? undefined : Number(e.target.value) })}
                            placeholder="min €" className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="text-xs text-gray-400">à</span>
                          <input type="number" value={o.prixMax ?? ''} onChange={(e) => updOpt(i, { prixMax: e.target.value === '' ? undefined : Number(e.target.value) })}
                            placeholder="max € (optionnel)" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <span className="text-xs text-gray-400">vide = « sur devis »</span>
                        </div>
                        <div className="flex justify-end">
                          <button onClick={() => { saveOpts(); setEditOptIdx(null) }}
                            className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition">
                            <CheckIcon className="w-4 h-4" /> Terminer
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={i} className="flex items-start gap-2 border border-gray-200 rounded-lg p-3 bg-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{o.label || <span className="text-gray-400">Sans titre</span>}</p>
                          {o.description && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{o.description}</p>}
                        </div>
                        <span className="text-sm font-semibold text-gray-700 shrink-0 whitespace-nowrap">{fmtOptPrice(o)}</span>
                        <button onClick={() => setEditOptIdx(i)} className="p-1.5 text-gray-300 hover:text-blue-600 transition shrink-0" title="Modifier l'option"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => { persistOptions(formOptions.filter((_, idx) => idx !== i)); setEditOptIdx(null) }} className="p-1.5 text-gray-300 hover:text-red-500 transition shrink-0" title="Supprimer l'option"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Section d'ajout — vidée après « Ajouter » */}
                <div className="border border-dashed border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50/30">
                  <p className="text-xs font-medium text-gray-600">Nouvelle option</p>
                  <input value={optDraft.label} onChange={(e) => setOptDraft((d) => ({ ...d, label: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                    placeholder="Intitulé de l'option" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <textarea value={optDraft.description ?? ''} onChange={(e) => setOptDraft((d) => ({ ...d, description: e.target.value }))}
                    rows={2} placeholder="Description (optionnel)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500">Prix</span>
                    <input type="number" value={optDraft.prixMin ?? ''} onChange={(e) => setOptDraft((d) => ({ ...d, prixMin: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      placeholder="min €" className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-xs text-gray-400">à</span>
                    <input type="number" value={optDraft.prixMax ?? ''} onChange={(e) => setOptDraft((d) => ({ ...d, prixMax: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      placeholder="max € (optionnel)" className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-xs text-gray-400">vide = « sur devis »</span>
                  </div>
                  <button onClick={addOption} disabled={!optDraft.label.trim()}
                    className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition">
                    <PlusIcon className="w-4 h-4" /> Ajouter
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}

        {tab === 'charte' && (
          <div className="space-y-4">
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? <CharteEditor value={formCharte} onChange={setFormCharte} onUpload={uploadCharteFile} /> : <CharteApercu value={formCharte} />}
          </div>
        )}

        {tab === 'planning' && (
          <div className="space-y-4">
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 mb-2">Le champ « Étape » propose une liste déroulante (tape pour filtrer, ou saisis librement). La date se calcule depuis la précédente + le délai en jours ; saisis une date à la main pour la <strong>fixer</strong>. Réordonne avec les flèches.</p>
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                  {genConfirm ? (
                    <span className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                      Remplacer le planning actuel ?
                      <button type="button" onClick={doGenerate} className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1.5 rounded-lg transition">Oui, générer</button>
                      <button type="button" onClick={() => setGenConfirm(false)} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition">Annuler</button>
                    </span>
                  ) : (
                    <button type="button" onClick={onGenerate} className="flex items-center justify-center gap-1.5 text-xs font-medium text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition w-full sm:w-auto">
                      <PlusIcon className="w-3.5 h-3.5" /> Générer un planning type
                    </button>
                  )}
                  <button type="button" onClick={savePlanningModele} className="text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition w-full sm:w-auto">
                    {modeleSaved ? '✓ Modèle enregistré' : 'Enregistrer ce planning comme modèle'}
                  </button>
                </div>
                <PlanningEditor items={formProjet.planning} onChange={(v) => updP({ planning: v })} etapesTypes={etapesTypes} />
                <details className="group pt-2">
                  <summary className="cursor-pointer text-[11px] font-medium text-indigo-700 list-none flex items-center gap-1.5">
                    <span className="inline-block transition group-open:rotate-90">▸</span> Gérer les étapes-types (liste déroulante)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-[11px] text-gray-400">Ces étapes alimentent la liste déroulante du champ « Étape », pour tous tes contrats.</p>
                    <StringListEditor items={etapesManaged} onChange={setEtapesDraft} placeholder="Étape-type…" />
                    {etapesDraft && (
                      <button type="button" onClick={saveEtapes}
                        className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition">
                        Enregistrer la liste
                      </button>
                    )}
                  </div>
                </details>
              </div>
            ) : (
              <PlanningApercu planning={formProjet.planning} onChange={(v) => persistProjet({ planning: v })} etapesTypes={etapesTypes} />
            )}
          </div>
        )}

        {tab === 'legal' && (
          <div className="space-y-4">
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">Modèles types — <strong>à faire valider par un juriste</strong>. Champs vides → « [à compléter] » dans le PDF.</p>
                </div>
                {legalFieldGroupsAll().map((grp) => {
                  const meta = legalGroupMeta(grp.titre)
                  return (
                    <details key={grp.titre} open={meta.open} className="group border border-gray-200 rounded-xl overflow-hidden">
                      <summary className="cursor-pointer list-none flex items-center gap-2.5 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition">
                        <span className="inline-block text-gray-400 transition group-open:rotate-90">▸</span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-700">{grp.titre}</span>
                          {meta.sub && <span className="block text-[11px] text-gray-400">{meta.sub}</span>}
                        </span>
                      </summary>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-t border-gray-100">
                        {grp.champs.map((ch) => (
                          <div key={ch.key} className={ch.multiline ? 'sm:col-span-2' : ''}>
                            <label className="block text-[11px] font-medium text-gray-600 mb-1">{ch.label}</label>
                            {ch.multiline ? (
                              <textarea rows={2} value={formLegal[ch.key]} placeholder={ch.placeholder}
                                onChange={(e) => updL(ch.key, e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            ) : (
                              <input type="text" value={formLegal[ch.key]} placeholder={ch.placeholder}
                                onChange={(e) => updL(ch.key, e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            )}
                            {ch.help && <p className="text-[10px] text-gray-400 mt-0.5">{ch.help}</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  )
                })}
              </div>
            ) : (
              <LegalApercu legal={formLegal} />
            )}
          </div>
        )}

        {tab === 'taches' && (
          <div className="space-y-4">
            <details className="group bg-indigo-50/50 border border-indigo-100 rounded-xl">
              <summary className="cursor-pointer list-none flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-indigo-800">
                <span className="inline-block text-indigo-400 transition group-open:rotate-90">▸</span> Une demande du client : inclus, maintenance ou à facturer ?
              </summary>
              <div className="px-3 pb-3 text-xs text-indigo-900/80 space-y-1.5">
                <p>✅ <strong>Inclus</strong> (gratuit) : ajustements de la maquette validée, corrections de bugs, retouches mineures dans le périmètre.</p>
                <p>🔧 <strong>Maintenance</strong> (déjà payé via l'abo) : petites évolutions récurrentes, mises à jour techniques, support.</p>
                <p>💶 <strong>À facturer</strong> (en plus) : nouvelle fonctionnalité hors périmètre validé. Mets la pastille « Facturer » sur la tâche + le temps → le prix est proposé, puis facture-la dans ta section <strong>Facturation</strong> et coche « facturée ».</p>
              </div>
            </details>
            {enRetard.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>{enRetard.length} tâche{enRetard.length > 1 ? 's' : ''} en retard</strong> (échéance dépassée, non terminée). Filtre « En retard » pour les voir, puis avance-les ou décale la date.
                </p>
              </div>
            )}
            {aFacturer.length > 0 && (
              <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <ExclamationTriangleIcon className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-xs text-rose-800">
                  <strong>{aFacturer.length} évolution{aFacturer.length > 1 ? 's' : ''} à facturer</strong>{totalAFacturer > 0 ? <> · ≈ <strong>{totalAFacturer} €</strong></>: null} — pense à les ajouter dans ta section <strong>Facturation</strong>, puis coche « facturée ».
                </p>
              </div>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowAjout((v) => !v)}
                className={`flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg transition ${showAjout ? 'border border-gray-300 text-gray-600 hover:bg-gray-50' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {showAjout ? 'Fermer' : <><PlusIcon className="w-4 h-4" /> Ajouter une tâche</>}
              </button>
            </div>
            {showAjout && <TacheAjoutForm items={formProjet.taches} onChange={(v) => persistProjet({ taches: v })} tauxHoraire={tauxHoraire} />}
            <p className="text-[11px] text-gray-400">Modifie chaque tâche directement dans la liste (statut, Moi/Client, date, facturation, terminée…). Les changements sont enregistrés automatiquement.</p>
            <TachesApercu taches={formProjet.taches} onChange={(v) => persistProjet({ taches: v })} tauxHoraire={tauxHoraire} />
          </div>
        )}

        {tab === 'apercu' && <ProjetApercu projet={formProjet} only={['contexte', 'fonctionnalites', 'livrables', 'horsPerimetre', 'planning']} />}
      </div>

      {signDoc && (
        <SignaturePad
          title={`Signer — ${signDoc.titre}`}
          subtitle="Dessinez ci-dessous ou importez une image de signature."
          onConfirm={handleSign}
          onCancel={() => setSignDoc(null)}
        />
      )}

      <Modal isOpen={!!delDoc} onClose={() => setDelDoc(null)} title="Supprimer le document" size="sm">
        <p className="text-sm text-gray-600">
          Supprimer définitivement <strong>{delDoc?.titre}</strong> ? Le PDF généré et la signature éventuelle seront aussi effacés. Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDelDoc(null)}
            className="text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition">Annuler</button>
          <button onClick={confirmDeleteDoc}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg transition">
            <TrashIcon className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!delEstId} onClose={() => setDelEstId(null)} title="Supprimer l'estimation" size="sm">
        <p className="text-sm text-gray-600">
          Supprimer définitivement l'estimation <strong>{estimations.find((e) => e.id === delEstId)?.label}</strong> ? Cette action est irréversible.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setDelEstId(null)}
            className="text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-4 py-1.5 rounded-lg transition">Annuler</button>
          <button onClick={confirmDeleteEst}
            className="flex items-center gap-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg transition">
            <TrashIcon className="w-4 h-4" /> Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}
