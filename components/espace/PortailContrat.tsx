'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Facture, Company } from '@/types'
import { buildInvoiceHtml } from '@/lib/invoiceHtml'
import { downloadInvoicePDF } from '@/lib/invoicePdf'
import SignaturePad from '@/components/ui/SignaturePad'
import {
  CheckCircleIcon, ArrowDownTrayIcon, PencilSquareIcon, DocumentTextIcon,
  DocumentDuplicateIcon, MapIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'

export interface ContratSummary {
  id: string
  clientNom: string
  statut: string
  version: string | null
  appNom: string | null
  dateDebut: { seconds: number } | null
}
export interface ProjetView {
  contexte: string
  fonctionnalites: { categorie: string; description: string }[]
  livrables: string[]
  horsPerimetre: string[]
  planning: { etape: string; description: string; date: string; dureeJours?: number; responsable: string }[]
}
export interface DocView {
  id: string
  titre?: string
  version?: string
  statut?: string
  pdfUrl?: string
  pdfNom?: string
  signe?: boolean
  pdfGeneeLe: { seconds: number } | null
}
export interface PortalData {
  contrat: ContratSummary
  company: (Company & Record<string, unknown>) | null
  devis: Facture[]
  factures: Facture[]
  documents: DocView[]
  projet: ProjetView
  primaryDevisId: string | null
}

type TabKey = 'devis' | 'projet' | 'documents' | 'factures'

const STATUT_DEVIS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'En attente de votre signature', cls: 'bg-amber-100 text-amber-700' },
  pending: { label: 'En attente de votre signature', cls: 'bg-amber-100 text-amber-700' },
  accepted: { label: 'Accepté', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Refusé', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500' },
}
const STATUT_FACTURE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-600' },
  sent: { label: 'Envoyée', cls: 'bg-blue-100 text-blue-700' },
  pending: { label: 'En attente', cls: 'bg-amber-100 text-amber-700' },
  encaissement: { label: 'En attente de règlement', cls: 'bg-amber-100 text-amber-700' },
  paid: { label: 'Payée', cls: 'bg-green-100 text-green-700' },
  overdue: { label: 'En retard', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulée', cls: 'bg-gray-100 text-gray-500' },
}

function fmtMontant(n: number): string {
  return (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}
function fmtDateStr(s?: string): string {
  if (!s) return ''
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function todayIso(): string { return new Date().toISOString().slice(0, 10) }

interface Props {
  data: PortalData
  // Signe un devis : doit lever une erreur en cas d'échec, et rafraîchir les données côté parent en cas de succès.
  onSign: (devisId: string, signatureDataUrl: string) => Promise<void>
  banner?: React.ReactNode
  headerRight?: React.ReactNode
}

export default function PortailContrat({ data, onSign, banner, headerRight }: Props) {
  const [tab, setTab] = useState<TabKey | null>(null)
  const [selectedDevisId, setSelectedDevisId] = useState<string | null>(data.primaryDevisId ?? data.devis[0]?.id ?? null)
  const [signModal, setSignModal] = useState(false)
  const [signing, setSigning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const primary = data.company?.couleurPrimaire || '#2563eb'

  // Le devis principal est-il signé ? → une fois validé, le « Suivi du projet » passe en premier.
  const primarySigned = useMemo(() => {
    const d = data.devis.find((x) => x.id === data.primaryDevisId) ?? data.devis[0]
    return !!d?.signed
  }, [data])

  const tabs = useMemo<{ key: TabKey; label: string; Icon: typeof DocumentTextIcon }[]>(() => {
    const devisTab = data.devis.length ? [{ key: 'devis' as TabKey, label: 'Devis', Icon: DocumentTextIcon }] : []
    const pj = data.projet
    const projetTab = (pj.contexte || pj.fonctionnalites.length || pj.planning.length || pj.livrables.length)
      ? [{ key: 'projet' as TabKey, label: 'Suivi du projet', Icon: MapIcon }] : []
    const docTab = data.documents.length ? [{ key: 'documents' as TabKey, label: 'Documents', Icon: DocumentDuplicateIcon }] : []
    const facTab = data.factures.length ? [{ key: 'factures' as TabKey, label: 'Factures', Icon: BanknotesIcon }] : []
    // Devis signé → Suivi du projet d'abord ; sinon Devis d'abord.
    return primarySigned
      ? [...projetTab, ...devisTab, ...docTab, ...facTab]
      : [...devisTab, ...projetTab, ...docTab, ...facTab]
  }, [data, primarySigned])

  useEffect(() => { if (tab === null) setTab(tabs[0]?.key ?? null) }, [tab, tabs])

  const selectedDevis = useMemo(
    () => data.devis.find((d) => d.id === selectedDevisId) ?? null,
    [data, selectedDevisId]
  )
  const preview = useMemo(() => {
    if (!selectedDevis) return { mainHtml: '', cgvHtml: null as string | null }
    return buildInvoiceHtml(selectedDevis, data.company ?? null, {
      logoDataUrl: data.company?.logoUrl ?? null,
      signatureDataUrl: selectedDevis.signatureUrl ?? null,
    })
  }, [selectedDevis, data])

  const canSign = !!selectedDevis && !selectedDevis.signed
    && !['accepted', 'rejected', 'cancelled'].includes(selectedDevis.status)

  const downloadFacture = async (f: Facture) => {
    setBusyId(f.id)
    try { await downloadInvoicePDF(f, data.company ?? null) }
    catch { setToast('Erreur lors de la génération du PDF.') }
    finally { setBusyId(null) }
  }

  const handleSign = async (signatureDataUrl: string) => {
    if (!selectedDevis) return
    setSigning(true)
    try {
      await onSign(selectedDevis.id, signatureDataUrl)
      setSignModal(false)
      setToast('Merci ! Votre devis est signé. Le prestataire en est informé.')
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de la signature.')
    } finally {
      setSigning(false)
    }
  }

  const companyName = data.company?.nom || 'Solutions & Connect'

  return (
    <div className="min-h-screen bg-gray-50">
      {signModal && selectedDevis && (
        <SignaturePad
          title="Signer le devis"
          subtitle="Dessinez votre signature ci-dessous pour accepter le devis."
          consentLabel={`Bon pour accord : je reconnais avoir pris connaissance du devis ${selectedDevis.number}${selectedDevis.total ? ` d'un montant de ${fmtMontant(selectedDevis.total)}` : ''} et j'en accepte le contenu ainsi que les conditions.`}
          busy={signing}
          onConfirm={handleSign}
          onCancel={() => !signing && setSignModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {data.company?.logoUrl
            ? <img src={data.company.logoUrl} alt="" className="w-9 h-9 object-contain rounded-lg" />
            : <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ backgroundColor: primary }}>{companyName.charAt(0)}</div>}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{companyName}</h1>
            <p className="text-xs text-gray-500">Espace client</p>
          </div>
          {headerRight}
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {banner}

        {/* Résumé du projet */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Votre projet</p>
          <h2 className="text-lg font-bold text-gray-900 mt-0.5">{data.contrat.appNom || data.contrat.clientNom}</h2>
          {data.contrat.appNom && <p className="text-sm text-gray-500">{data.contrat.clientNom}</p>}
          {data.contrat.version && <p className="text-xs text-gray-400 mt-1">Version {data.contrat.version}</p>}
        </div>

        {/* Onglets */}
        {tabs.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {tabs.map(({ key, label, Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-xl whitespace-nowrap transition border ${tab === key ? 'text-white border-transparent' : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50'}`}
                style={tab === key ? { backgroundColor: primary } : undefined}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        )}

        {/* ── Devis ── */}
        {tab === 'devis' && (
          data.devis.length === 0 ? <Empty>Aucun devis n'est disponible pour le moment.</Empty> : (
            <div className="space-y-3">
              {data.devis.length > 1 && (
                <div className="space-y-2">
                  {data.devis.map((d) => {
                    const st = STATUT_DEVIS[d.status] ?? { label: d.status, cls: 'bg-gray-100 text-gray-600' }
                    const isSel = d.id === selectedDevisId
                    return (
                      <button key={d.id} onClick={() => setSelectedDevisId(d.id)}
                        className={`w-full text-left bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition ${isSel ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-100 hover:border-gray-200'}`}>
                        <DocumentTextIcon className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">Devis {d.number}</p>
                          <p className="text-xs text-gray-500">{fmtMontant(d.total)}</p>
                        </div>
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${d.signed ? 'bg-green-100 text-green-700' : st.cls}`}>
                          {d.signed ? 'Signé' : st.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedDevis && (
                <>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    {selectedDevis.signed ? (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm font-medium">
                        <CheckCircleIcon className="w-5 h-5 shrink-0" />
                        Devis signé. Merci ! Le prestataire en a été informé.
                      </div>
                    ) : canSign ? (
                      <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-medium">
                        Relisez le devis ci-dessous, puis signez-le pour valider.
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2 mt-3">
                      <button onClick={() => downloadFacture(selectedDevis)} disabled={busyId === selectedDevis.id}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 px-3.5 py-2 rounded-xl transition">
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        {busyId === selectedDevis.id ? 'Préparation…' : 'Télécharger le PDF'}
                      </button>
                      {selectedDevis.signed ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 bg-gray-100 border border-gray-200 px-3.5 py-2 rounded-xl cursor-not-allowed">
                          <CheckCircleIcon className="w-4 h-4" /> Devis signé
                        </span>
                      ) : canSign ? (
                        <button onClick={() => setSignModal(true)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white px-3.5 py-2 rounded-xl transition hover:opacity-90"
                          style={{ backgroundColor: primary }}>
                          <PencilSquareIcon className="w-4 h-4" /> Signer le devis
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-gray-100 rounded-2xl border border-gray-200 p-3 sm:p-6 overflow-x-auto space-y-4">
                    <div className="w-max mx-auto bg-white shadow-lg rounded-sm overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: preview.mainHtml }} />
                    {preview.cgvHtml && (
                      <div className="w-max mx-auto bg-white shadow-lg rounded-sm overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: preview.cgvHtml }} />
                    )}
                  </div>
                </>
              )}
            </div>
          )
        )}

        {/* ── Suivi du projet ── */}
        {tab === 'projet' && (
          <div className="space-y-4">
            {data.projet.contexte && (
              <Card title="Contexte">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{data.projet.contexte}</p>
              </Card>
            )}
            {data.projet.planning.length > 0 && (
              <Card title="Avancement">
                <ol className="space-y-3">
                  {data.projet.planning.map((step, i) => {
                    const today = todayIso()
                    const done = step.date && step.date < today
                    const isToday = step.date === today
                    const dot = done ? 'bg-green-500' : isToday ? 'bg-amber-500' : 'bg-gray-300'
                    return (
                      <li key={i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`w-3 h-3 rounded-full mt-1 ${dot}`} />
                          {i < data.projet.planning.length - 1 && <span className="w-px flex-1 bg-gray-200 mt-1" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-semibold ${done ? 'text-gray-500' : 'text-gray-900'}`}>{step.etape}</p>
                            {step.date && <span className="text-xs text-gray-400 shrink-0">{fmtDateStr(step.date)}</span>}
                          </div>
                          {step.description && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}
            {data.projet.fonctionnalites.length > 0 && (
              <Card title="Fonctionnalités">
                <ul className="space-y-1.5">
                  {data.projet.fonctionnalites.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      <span>{f.description}{f.categorie ? <span className="text-gray-400"> · {f.categorie}</span> : null}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {data.projet.livrables.length > 0 && (
              <Card title="Livrables">
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {data.projet.livrables.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </Card>
            )}
            {data.projet.horsPerimetre.length > 0 && (
              <Card title="Non compris dans la prestation">
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-500">
                  {data.projet.horsPerimetre.map((l, i) => <li key={i}>{l}</li>)}
                </ul>
              </Card>
            )}
          </div>
        )}

        {/* ── Documents ── */}
        {tab === 'documents' && (
          data.documents.length === 0 ? <Empty>Aucun document n'est disponible pour le moment.</Empty> : (
            <div className="space-y-2">
              {data.documents.map((doc) => (
                <a key={doc.id} href={doc.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50/40 px-4 py-3 transition">
                  <DocumentDuplicateIcon className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{doc.titre || 'Document'}</p>
                    <p className="text-xs text-gray-500">{doc.version ? `Version ${doc.version}` : ''}{doc.signe ? ' · Signé' : ''}</p>
                  </div>
                  <ArrowDownTrayIcon className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              ))}
            </div>
          )
        )}

        {/* ── Factures ── */}
        {tab === 'factures' && (
          data.factures.length === 0 ? <Empty>Aucune facture pour le moment.</Empty> : (
            <div className="space-y-2">
              {data.factures.map((f) => {
                const st = STATUT_FACTURE[f.status] ?? { label: f.status, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <div key={f.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
                    <BanknotesIcon className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">Facture {f.number}</p>
                      <p className="text-xs text-gray-500">{fmtMontant(f.total)}</p>
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                    <button onClick={() => downloadFacture(f)} disabled={busyId === f.id} title="Télécharger le PDF"
                      className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-50 transition shrink-0">
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )
        )}

        <p className="text-center text-[11px] text-gray-400 pt-2">Espace sécurisé — {companyName}</p>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]">
          <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg flex items-start gap-2">
            <span className="flex-1">{toast}</span>
            <button onClick={() => setToast('')} className="text-gray-400 hover:text-white">✕</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">{title}</p>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
      <p className="text-gray-400 text-sm">{children}</p>
    </div>
  )
}
