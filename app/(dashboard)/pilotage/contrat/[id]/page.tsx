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
import { uploadBlob } from '@/lib/uploadImage'
import SignaturePad from '@/components/ui/SignaturePad'
import { generatePilotageDocPdf, PILOTAGE_DOC_TYPES, STATUT_DOC_LABELS } from '@/lib/pilotageDocPdf'
import { defaultLegalFields, legalFieldGroupsAll, type LegalFields } from '@/lib/pilotageLegalTemplates'
import { defaultProjetContent, DEFAULT_PLANNING_ETAPES, type ProjetContent } from '@/lib/pilotageProjetTemplates'
import { StringListEditor, FonctionsEditor, PlanningEditor, HorsPerimetreEditor, TachesEditor, TachesApercu, PlanningApercu, ProjetApercu } from '@/components/pilotage/ProjetUI'
import type { PilotageDocument, PilotageDocumentType } from '@/types'
import {
  ArrowLeftIcon, TrashIcon, PlusIcon, CheckIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, PencilIcon,
} from '@heroicons/react/24/outline'

const TABS = [
  { key: 'documents', label: 'Documents' },
  { key: 'projet', label: 'Contenu projet' },
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
  const { settings, saveSettings } = usePilotageSettings()
  // Étapes-types du planning (liste déroulante, persistées dans pilotage_settings et éditables)
  const etapesTypes = settings?.planningEtapes ?? DEFAULT_PLANNING_ETAPES
  const [etapesDraft, setEtapesDraft] = useState<string[] | null>(null)
  const etapesManaged = etapesDraft ?? etapesTypes
  const saveEtapes = () => { saveSettings({ planningEtapes: etapesManaged }); setEtapesDraft(null) }

  const [tab, setTab] = useState<TabKey>('documents')
  const [editing, setEditing] = useState(false)
  const [formProjet, setFormProjet] = useState<ProjetContent>(defaultProjetContent())
  const [formLegal, setFormLegal] = useState<LegalFields>(defaultLegalFields())
  const [newDocType, setNewDocType] = useState<PilotageDocumentType>('cahier_charges')
  const [signDoc, setSignDoc] = useState<PilotageDocument | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle')
  const hydratedFor = useRef<string | null>(null)

  const updP = (patch: Partial<ProjetContent>) => setFormProjet((p) => ({ ...p, ...patch }))
  const updL = (k: keyof LegalFields, v: string) => setFormLegal((f) => ({ ...f, [k]: v }))

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
      await updateContrat(contrat.id, { projet: formProjet, legal: formLegal })
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

  const createDoc = async () => {
    if (!contrat) return
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

  const handleSign = async (dataUrl: string) => {
    if (!signDoc || !currentUser) return
    try {
      const blob = await (await fetch(dataUrl)).blob()
      const url = await uploadBlob(blob, `users/${currentUser.uid}/pilotage_signatures/${signDoc.id}.png`)
      await updateDocument(signDoc.id, { signe: true, statut: 'signe', signeLe: Timestamp.now(), signatureUrl: url })
    } catch (e) { console.error('[pilotage sign]', e) }
    setSignDoc(null)
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
      </div>

      {/* Onglets — tout visible, pas de défilement ; reste en place au scroll */}
      <div className="flex flex-wrap gap-1 border-b border-gray-200 sticky top-0 bg-white z-10 pt-1">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => goTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenu de l'onglet */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        {tab === 'documents' && (
          <div className="space-y-4">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">Type de document</label>
                <select value={newDocType} onChange={(e) => setNewDocType(e.target.value as PilotageDocumentType)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <optgroup label="Documents projet">
                    {PILOTAGE_DOC_TYPES.filter((t) => t.famille === 'projet').map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Contrats légaux">
                    {PILOTAGE_DOC_TYPES.filter((t) => t.famille === 'legal').map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <button onClick={createDoc}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
                <PlusIcon className="w-4 h-4" /> Créer
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Aucun document pour ce contrat.</div>
            ) : (
              <div className="space-y-2">
                {documents.map((d) => (
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
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!d.signe && (
                        <button onClick={() => setSignDoc(d)} title="Signer"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                          <CheckIcon className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => generatePilotageDocPdf(d, { company, projet: formProjet, legal: formLegal })} title="Télécharger le PDF"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteDocument(d.id)} title="Supprimer"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-gray-400">
              Les documents projet (cahier des charges, bilan, besoins) partagent le <strong>contenu projet</strong> saisi sous l'onglet dédié. Le logo et les coordonnées viennent de ta société « {company?.nom ?? 'Solutions & Connect'} ». Pense à <strong>enregistrer</strong> le contenu avant d'exporter.
            </p>
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
                  <StringListEditor items={formProjet.livrables} onChange={(v) => updP({ livrables: v })} placeholder="Livrable…" />
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
          </div>
        )}

        {tab === 'planning' && (
          <div className="space-y-4">
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 mb-2">Le champ « Étape » propose une liste déroulante (tape pour filtrer, ou saisis librement). La date se calcule depuis la précédente + le délai en jours ; saisis une date à la main pour la <strong>fixer</strong>. Réordonne avec les flèches.</p>
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
            <EditBar editing={editing} onEdit={() => setEditing(true)} onCancel={cancelEdit} onSave={save} saveState={saveState} />
            {editing ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2.5">
                  <CheckIcon className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-purple-800">Une seule liste : pour chaque tâche, indique avec les pastilles si c'est à <strong>toi</strong> ou au <strong>client</strong> de la faire. Les tâches « client » alimentent le « Besoins client », toutes alimentent le « Bilan ».</p>
                </div>
                <TachesEditor items={formProjet.taches} onChange={(v) => updP({ taches: v })} />
              </div>
            ) : (
              <TachesApercu taches={formProjet.taches} onChange={(v) => persistProjet({ taches: v })} />
            )}
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
    </div>
  )
}
