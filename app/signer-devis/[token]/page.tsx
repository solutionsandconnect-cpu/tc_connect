'use client'

import { use, useCallback, useEffect, useMemo, useState } from 'react'
import type { Facture, Company } from '@/types'
import { buildInvoiceHtml } from '@/lib/invoiceHtml'
import { downloadInvoicePDF } from '@/lib/invoicePdf'
import SignaturePad from '@/components/ui/SignaturePad'
import {
  CheckCircleIcon, ArrowDownTrayIcon, PencilSquareIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

function fmtMontant(n: number): string {
  return (n ?? 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

export default function SignerDevisPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [devis, setDevis] = useState<Facture | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signModal, setSignModal] = useState(false)
  const [signing, setSigning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/devis-public/${token}`)
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Lien invalide.'); return }
      setDevis(d.devis)
      setCompany(d.company)
    } catch {
      setError('Impossible de charger le devis.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const preview = useMemo(() => {
    if (!devis) return { mainHtml: '', cgvHtml: null as string | null }
    return buildInvoiceHtml(devis, company, {
      logoDataUrl: company?.logoUrl ?? null,
      signatureDataUrl: devis.signatureUrl ?? null,
    })
  }, [devis, company])

  const primary = company?.couleurPrimaire || '#2563eb'
  const companyName = company?.nom || 'Devis'
  const canSign = !!devis && !devis.signed
    && !['accepted', 'rejected', 'cancelled'].includes(devis.status)

  const handleSign = async (signatureDataUrl: string) => {
    setSigning(true)
    try {
      const res = await fetch(`/api/devis-public/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureDataUrl }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erreur')
      setSignModal(false)
      setToast('Merci ! Votre devis est signé. Le prestataire en est informé.')
      load()  // rafraîchit en arrière-plan (ne bloque pas la fermeture du modal)
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Erreur lors de la signature.')
    } finally {
      setSigning(false)
    }
  }

  const handleDownload = async () => {
    if (!devis) return
    setDownloading(true)
    try { await downloadInvoicePDF(devis, company) }
    catch { setToast('Erreur lors de la génération du PDF.') }
    finally { setDownloading(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !devis) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <DocumentTextIcon className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-lg font-bold text-gray-800 mb-1">Lien indisponible</p>
        <p className="text-sm text-gray-500">{error || 'Ce lien est expiré ou introuvable.'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {signModal && (
        <SignaturePad
          title="Signer le devis"
          subtitle="Dessinez votre signature ci-dessous pour accepter le devis."
          consentLabel={`Bon pour accord : je reconnais avoir pris connaissance du devis ${devis.number}${devis.total ? ` d'un montant de ${fmtMontant(devis.total)}` : ''} et j'en accepte le contenu ainsi que les conditions.`}
          busy={signing}
          onConfirm={handleSign}
          onCancel={() => !signing && setSignModal(false)}
        />
      )}

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {company?.logoUrl
            ? <img src={company.logoUrl} alt="" className="w-9 h-9 object-contain rounded-full" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: primary }}>{companyName.charAt(0)}</div>}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{companyName}</h1>
            <p className="text-xs text-gray-500">Devis {devis.number}</p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5 space-y-4">
        {/* Bandeau d'action */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          {devis.signed ? (
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
            <button onClick={handleDownload} disabled={downloading}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 px-3.5 py-2 rounded-xl transition">
              <ArrowDownTrayIcon className="w-4 h-4" />
              {downloading ? 'Préparation…' : 'Télécharger le PDF'}
            </button>
            {devis.signed ? (
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

        {/* Aperçu du devis (allure de feuille A4, fidèle au PDF) — page principale + page CGV */}
        <div className="bg-gray-100 rounded-2xl border border-gray-200 p-3 sm:p-6 overflow-x-auto space-y-4">
          <div className="w-max mx-auto bg-white shadow-lg rounded-sm overflow-hidden"
            dangerouslySetInnerHTML={{ __html: preview.mainHtml }} />
          {preview.cgvHtml && (
            <div className="w-max mx-auto bg-white shadow-lg rounded-sm overflow-hidden"
              dangerouslySetInnerHTML={{ __html: preview.cgvHtml }} />
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 pt-2">Document sécurisé — {companyName}</p>
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
