// Brochure de prospection en PDF.
// Passe par le même moteur que les devis/factures (html2canvas-pro + jsPDF,
// pagination aux frontières de blocs) plutôt que par l'impression navigateur,
// qui ajoutait ses propres en-têtes, marges et coupes arbitraires.

import { htmlPagesToPdf } from '@/lib/htmlToPdf'
import { fetchImageAsDataUrl } from '@/lib/invoicePdf'
import { EXPEDITEUR_ENEZO, renderBrochureHtml, type Expediteur } from '@/lib/mailingRender'
import type { MailingMetier } from '@/types'

function slug(s: string): string {
  return (s || 'brochure')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function build(metier: MailingMetier, origin: string, expediteur?: Expediteur) {
  const exp = expediteur ?? EXPEDITEUR_ENEZO
  // Le logo doit être embarqué : html2canvas ne capture pas une image distante
  // (et un canvas « tainted » ferait échouer toute la génération).
  const logoDataUrl = await fetchImageAsDataUrl(
    exp.logoUrl ?? `${origin.replace(/\/+$/, '')}/enezo-logo-full.png`,
  )
  const html = renderBrochureHtml({ metier, origin, expediteur: exp, logoDataUrl })
  return htmlPagesToPdf([html], {
    targetSelector: '.brochure',
    // Un thème ne doit jamais être coupé en deux ; à défaut on coupe entre deux
    // puces plutôt qu'au milieu d'une ligne de texte.
    breakSelector: '.theme, .intro, footer, .btext',
    sectionHeadSelector: '.theme-head',
  })
}

export async function downloadBrochurePDF(
  metier: MailingMetier, origin: string, expediteur?: Expediteur,
): Promise<void> {
  const doc = await build(metier, origin, expediteur)
  doc.save(`brochure-${slug(metier.metier)}.pdf`)
}

export async function generateBrochurePDFBlob(
  metier: MailingMetier, origin: string, expediteur?: Expediteur,
): Promise<Blob> {
  const doc = await build(metier, origin, expediteur)
  return doc.output('blob') as Blob
}
