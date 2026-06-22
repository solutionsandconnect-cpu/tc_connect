import type { PilotageDocument, PilotageDocumentType, Company, ChartGraphique } from '@/types'
import { buildLegalDoc, defaultLegalFields, type LegalFields } from '@/lib/pilotageLegalTemplates'
import { emptyProjetContent, projetSections, type ProjetContent } from '@/lib/pilotageProjetTemplates'

// Charge une image distante en dataURL (pour logo / signature dans le PDF)
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const viaCanvas = await new Promise<string | null>((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    const timer = setTimeout(() => resolve(null), 6000)
    img.onload = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 300
        canvas.height = img.naturalHeight || 300
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch { resolve(null) }
    }
    img.onerror = () => { clearTimeout(timer); resolve(null) }
    img.src = url
  })
  if (viaCanvas) return viaCanvas
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// Référentiel des types de documents (projet & légaux)
export const PILOTAGE_DOC_TYPES: {
  value: PilotageDocumentType
  label: string
  famille: 'projet' | 'legal'
  titrePdf: string
}[] = [
  { value: 'cahier_charges', label: 'Cahier des charges', famille: 'projet', titrePdf: 'Cahier des Charges' },
  { value: 'besoins_client', label: 'Besoins client', famille: 'projet', titrePdf: 'Besoins informations client' },
  { value: 'bilan', label: "Bilan d'avancement", famille: 'projet', titrePdf: 'Avancement projet' },
  { value: 'prestation', label: 'Contrat de prestation', famille: 'legal', titrePdf: 'Contrat de prestation de services' },
  { value: 'dpa_rgpd', label: 'Accord RGPD (DPA)', famille: 'legal', titrePdf: 'Accord de sous-traitance RGPD (DPA)' },
  { value: 'licence', label: 'Licence / cession de droits', famille: 'legal', titrePdf: 'Contrat de licence / cession de droits' },
  // 'cgv' volontairement absent : tes CGV figurent déjà sur tes devis/factures (pas de doublon)
]

export const STATUT_DOC_LABELS: Record<string, string> = {
  brouillon: 'Brouillon', finalise: 'Finalisé', signe: 'Signé',
}

export function pilotageDocTypeLabel(t: PilotageDocumentType) {
  return PILOTAGE_DOC_TYPES.find((x) => x.value === t)?.label ?? t
}

// Générateur PDF brandé S&C (logo + coordonnées société ; contenu projet partagé par le contrat)
export async function generatePilotageDocPdf(
  docu: PilotageDocument,
  opts: { company?: Company | null; projet?: ProjetContent | null; legal?: LegalFields | null; charte?: ChartGraphique | null } = {},
): Promise<{ blob: Blob; filename: string }> {
  const company = opts.company
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  // Le PDF n'est plus téléchargé directement : on renvoie le blob + le nom de fichier.
  // L'appelant décide de le stocker (Storage) et/ou de le télécharger.
  const finalize = (name: string) => {
    const safe = (name || 'document').replace(/[^a-z0-9]+/gi, '_')
    return { blob: pdf.output('blob') as Blob, filename: `SC_${safe}_v${docu.version || '1.0'}.pdf` }
  }
  const W = 210, margin = 18
  const teal: [number, number, number] = [21, 89, 110]
  const dark: [number, number, number] = [17, 24, 39]
  const gray: [number, number, number] = [107, 114, 128]
  const light: [number, number, number] = [243, 244, 246]
  const setText = (c: [number, number, number]) => pdf.setTextColor(c[0], c[1], c[2])
  const setFill = (c: [number, number, number]) => pdf.setFillColor(c[0], c[1], c[2])
  const setDraw = (c: [number, number, number]) => pdf.setDrawColor(c[0], c[1], c[2])

  // Coordonnées de pied de page (société si dispo, sinon valeurs S&C)
  const fNom = company?.nom || 'Solutions & Connect'
  const fTel = company?.telephone || '+33 6 79 40 82 54'
  const fEmail = company?.email || 'solutionsandconnect@gmail.com'
  const footerLine = `${fTel}  ·  ${fEmail}  ·  © ${new Date().getFullYear()} ${fNom}`

  // Logo + signature (chargés une fois)
  const logoData = company?.logoUrl ? await fetchImageAsDataUrl(company.logoUrl) : null
  const signData = docu.signatureUrl ? await fetchImageAsDataUrl(docu.signatureUrl) : null
  const drawLogo = () => {
    if (!logoData) return
    try {
      const props = pdf.getImageProperties(logoData)
      const r = Math.min(30 / props.width, 16 / props.height)
      pdf.addImage(logoData, 'PNG', margin, 8, props.width * r, props.height * r)
    } catch { /* logo ignoré si illisible */ }
  }

  const meta = PILOTAGE_DOC_TYPES.find((x) => x.value === docu.type)
  let y = 18

  // ── Contrats légaux : rendu multi-pages avec articles ──
  if (meta?.famille === 'legal') {
    const fields = defaultLegalFields((opts.legal ?? docu.contenu ?? {}) as Partial<LegalFields>)
    const legal = buildLegalDoc(docu.type, fields)
    if (legal) {
      const maxY = 272, lineH = 5, contentW = W - margin * 2
      const footer = () => {
        setDraw(light); pdf.line(margin, 280, W - margin, 280)
        setText(teal); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8)
        pdf.text(fNom, W / 2, 285, { align: 'center' })
        setText(gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
        pdf.text(footerLine, W / 2, 288.5, { align: 'center' })
      }
      const ensure = (h: number) => { if (y + h > maxY) { footer(); pdf.addPage(); y = 20 } }
      const para = (txt: string, o: { bold?: boolean; size?: number; gap?: number; color?: [number, number, number] } = {}) => {
        pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size ?? 10); setText(o.color ?? dark)
        const lns = pdf.splitTextToSize(txt, contentW) as string[]
        for (const ln of lns) { ensure(lineH); pdf.text(ln, margin, y); y += lineH }
        y += o.gap ?? 2
      }
      drawLogo()
      y = 20
      para(legal.titre, { bold: true, size: 16 }); y += 2
      if (docu.clientNom) para(`Projet ${docu.clientNom}`, { color: gray, size: 11 })
      y += 3
      legal.intro.forEach((p) => para(p))
      y += 2
      legal.articles.forEach((a) => {
        ensure(lineH * 3)
        para(a.titre, { bold: true, size: 11, gap: 1, color: teal })
        a.paragraphes.forEach((p) => para(p))
        y += 1
      })
      y += 4
      legal.cloture.forEach((p) => para(p, { gap: 3 }))
      if (signData) {
        try {
          const sp = pdf.getImageProperties(signData)
          const r = Math.min(45 / sp.width, 22 / sp.height)
          ensure(sp.height * r + 4)
          pdf.addImage(signData, 'PNG', margin, y, sp.width * r, sp.height * r)
          y += sp.height * r + 2
        } catch { /* signature ignorée si illisible */ }
        setText(gray); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8)
        const when = docu.signeLe ? ' le ' + new Date(docu.signeLe.toMillis()).toLocaleDateString('fr-FR') : ''
        ensure(5); pdf.text(`Signé${docu.signatairePar ? ' par ' + docu.signatairePar : ''}${when}.`, margin, y)
      }
      footer()
      return finalize(docu.titre || meta.label)
    }
  }

  // ── Documents projet : info + sections (objectifs, fonctionnalités, planning…) ──
  if (meta?.famille === 'projet') {
    // Contenu partagé porté par le contrat (saisi une seule fois)
    const c = { ...emptyProjetContent(), ...(opts.projet ?? {}) }
    const cfg = projetSections(docu.type)
    const red: [number, number, number] = [155, 28, 28]
    const border: [number, number, number] = [210, 213, 219]
    const maxY = 272, contentW = W - margin * 2
    const footer = () => {
      setDraw(light); pdf.line(margin, 280, W - margin, 280)
      setText(teal); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8)
      pdf.text(fNom, W / 2, 285, { align: 'center' })
      setText(gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7)
      pdf.text(footerLine, W / 2, 288.5, { align: 'center' })
    }
    const ensure = (h: number) => { if (y + h > maxY) { footer(); pdf.addPage(); y = 18 } }

    type Cell = { text?: string; w: number; align?: 'left' | 'center'; bold?: boolean; fill?: [number, number, number]; color?: [number, number, number]; check?: boolean }
    const drawRow = (cells: Cell[]) => {
      pdf.setFontSize(9)
      const pad = 2
      let maxLines = 1
      cells.forEach((cell) => {
        if (cell.check === undefined) {
          const lns = pdf.splitTextToSize(cell.text ?? '', cell.w - pad * 2) as string[]
          maxLines = Math.max(maxLines, lns.length)
        }
      })
      const h = Math.max(7, maxLines * 4.2 + 2.5)
      ensure(h)
      let x = margin
      cells.forEach((cell) => {
        if (cell.fill) { setFill(cell.fill); pdf.rect(x, y, cell.w, h, 'F') }
        setDraw(border); pdf.rect(x, y, cell.w, h)
        if (cell.check !== undefined) {
          const bs = 3.4, bx = x + cell.w / 2 - bs / 2, by = y + h / 2 - bs / 2
          setDraw([130, 130, 130]); pdf.rect(bx, by, bs, bs)
          if (cell.check) {
            setDraw(teal); pdf.setLineWidth(0.5)
            pdf.line(bx + 0.6, by + 1.8, bx + 1.3, by + 2.6)
            pdf.line(bx + 1.3, by + 2.6, bx + 2.8, by + 0.7)
            pdf.setLineWidth(0.2)
          }
        } else {
          pdf.setFont('helvetica', cell.bold ? 'bold' : 'normal'); setText(cell.color ?? dark)
          const lns = pdf.splitTextToSize(cell.text ?? '', cell.w - pad * 2) as string[]
          const center = cell.align === 'center'
          pdf.text(lns, center ? x + cell.w / 2 : x + pad, y + 4.6, { align: center ? 'center' : 'left' })
        }
        x += cell.w
      })
      y += h
    }
    const band = (title: string, color: [number, number, number]) => {
      ensure(9)
      y += 2
      setFill(color); pdf.rect(margin, y, contentW, 7, 'F')
      setText([255, 255, 255]); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5)
      pdf.text(title, W / 2, y + 4.8, { align: 'center' })
      y += 7
    }
    const para = (txt: string, o: { bold?: boolean; size?: number } = {}) => {
      pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size ?? 10); setText(o.bold ? dark : gray)
      const lns = pdf.splitTextToSize(txt, contentW) as string[]
      for (const ln of lns) { ensure(5); pdf.text(ln, margin, y); y += 5 }
    }
    const emptyRow = () => drawRow([{ text: '[à compléter]', w: contentW, align: 'center', color: gray }])
    const fmtD = (d: string) => { const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return mm ? `${mm[3]}/${mm[2]}/${mm[1]}` : (d || '') }

    // Titre
    drawLogo()
    y = 18
    setText(dark); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18)
    pdf.text(meta.titrePdf, W / 2, y, { align: 'center' }); y += 7
    if (docu.clientNom) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); setText(gray); pdf.text(`Projet ${docu.clientNom}`, W / 2, y, { align: 'center' }) }
    y += 8

    // Tableau infos
    const infoRows: [string, string][] = [
      ['Nom du projet', docu.clientNom || '—'],
      ['Date', new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })],
      ['Prestataire', fNom],
      ['Version', docu.version || '1.0'],
      ['Réf', docu.id.slice(0, 8)],
    ]
    infoRows.forEach(([l, v]) => drawRow([
      { text: l, w: 55, fill: teal, color: [255, 255, 255], bold: true },
      { text: v, w: contentW - 55, fill: light },
    ]))
    y += 4

    if (cfg.contexte) {
      para('Contexte', { bold: true, size: 11 }); y += 1
      para(c.contexte || '[à compléter]'); y += 2
    }

    // ── Charte & cadrage (cahier des charges) ──
    const ch = opts.charte
    const hasCharte = !!ch && (
      (ch.objectifs?.length ?? 0) > 0 || ch.typeProjet || ch.nomApp || ch.publicCible ||
      ch.usersMin != null || ch.usersMax != null || (ch.plateformes?.length ?? 0) > 0 || ch.domaine ||
      (ch.langues?.length ?? 0) > 0 || (ch.couleurs?.length ?? 0) > 0 || (ch.typographie?.length ?? 0) > 0 ||
      (ch.ton?.length ?? 0) > 0 || (ch.liens?.length ?? 0) > 0 || (ch.contraintes?.length ?? 0) > 0 ||
      !!ch.notes || !!ch.logo?.url
    )
    if (cfg.charte && ch && hasCharte) {
      const hexToRgb = (hex: string): [number, number, number] | null => {
        const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
        if (!m) return null
        const n = parseInt(m[1], 16)
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      }
      const typeLabel = !ch.typeProjet ? '' : ch.typeProjet === 'autre' ? (ch.typeAutre || 'Autre') : ch.typeProjet === 'site_web' ? 'Site web' : 'Application'
      const PLAT: Record<string, string> = { ios: 'iOS', android: 'Android', web: 'Web' }
      const plats = (ch.plateformes ?? []).map((p) => PLAT[p] ?? p).join(', ')
      const users = ch.usersMin != null || ch.usersMax != null ? `${ch.usersMin ?? '?'} – ${ch.usersMax ?? '?'} utilisateurs` : ''

      band('Charte & cadrage', dark)

      if ((ch.objectifs?.length ?? 0) > 0) {
        para('Objectifs du projet', { bold: true, size: 10 }); y += 1
        ch.objectifs!.forEach((o) => drawRow([{ text: '•  ' + o, w: contentW }]))
        y += 1
      }

      // Logo (image du projet/app, distincte du logo S&C en en-tête)
      if (ch.logo?.url) {
        const logoCharte = await fetchImageAsDataUrl(ch.logo.url)
        if (logoCharte) {
          try {
            const lp = pdf.getImageProperties(logoCharte)
            const rr = Math.min(40 / lp.width, 22 / lp.height)
            const w = lp.width * rr, h = lp.height * rr
            ensure(h + 4)
            para('Logo', { bold: true, size: 10 })
            pdf.addImage(logoCharte, 'PNG', margin, y, w, h)
            y += h + 3
          } catch { /* logo charte ignoré si illisible */ }
        }
      }

      // Caractéristiques (clé / valeur)
      const kv = ([
        ['Type de projet', typeLabel],
        ["Nom de l'application", ch.nomApp ?? ''],
        ['Public cible', ch.publicCible ?? ''],
        ['Utilisateurs envisagés', users],
        ['Plateformes', plats],
        ['Domaine souhaité', ch.domaine ?? ''],
        ['Langues', (ch.langues ?? []).join(', ')],
        ['Typographie(s)', (ch.typographie ?? []).join(', ')],
        ['Ton / style', (ch.ton ?? []).join(', ')],
      ] as [string, string][]).filter(([, v]) => v)
      kv.forEach(([l, v]) => drawRow([
        { text: l, w: 55, fill: teal, color: [255, 255, 255], bold: true },
        { text: v, w: contentW - 55, fill: light },
      ]))

      // Couleurs (pastilles)
      if ((ch.couleurs?.length ?? 0) > 0) {
        y += 2
        para('Couleurs', { bold: true, size: 10 }); y += 1
        ch.couleurs!.forEach((co) => {
          ensure(8)
          const rgb = hexToRgb(co.hex)
          if (rgb) { setFill(rgb); setDraw(border); pdf.rect(margin, y + 0.5, 6, 5, 'FD') }
          setText(dark); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
          pdf.text(`${co.label || 'Couleur'}   ${co.hex || ''}`, margin + 9, y + 4.5)
          y += 8
        })
      }

      // Listes
      if ((ch.contraintes?.length ?? 0) > 0) {
        y += 1; para('Contraintes & spécifications techniques', { bold: true, size: 10 }); y += 1
        ch.contraintes!.forEach((l) => drawRow([{ text: '•  ' + l, w: contentW }]))
      }
      if ((ch.liens?.length ?? 0) > 0) {
        y += 1; para('Liens / références', { bold: true, size: 10 }); y += 1
        ch.liens!.forEach((l) => drawRow([{ text: '•  ' + l, w: contentW }]))
      }
      if (ch.notes) {
        y += 2; para('Notes / contraintes de marque', { bold: true, size: 10 }); y += 1
        para(ch.notes)
      }
      y += 2
    }

    if (cfg.fonctionnalites) {
      band('Fonctionnalités', dark)
      if (c.fonctionnalites.length === 0) emptyRow()
      else c.fonctionnalites.forEach((f) => drawRow([{ text: f.categorie, w: 65, bold: true }, { text: f.description, w: contentW - 65 }]))
    }
    if (cfg.livrables) {
      band('Livrables', dark)
      if (c.livrables.length === 0) emptyRow()
      else c.livrables.forEach((l) => drawRow([{ text: l, w: contentW, align: 'center' }]))
    }
    if (cfg.horsPerimetre && (c.horsPerimetre?.length ?? 0) > 0) {
      band('Hors-périmètre (non compris)', dark)
      c.horsPerimetre.forEach((l) => drawRow([{ text: '•  ' + l, w: contentW }]))
    }
    if (cfg.planning) {
      band('Planning prévisionnel', red)
      drawRow([
        { text: 'Étape', w: 32, fill: red, color: [255, 255, 255], bold: true, align: 'center' },
        { text: 'Description', w: contentW - 32 - 28 - 38, fill: red, color: [255, 255, 255], bold: true, align: 'center' },
        { text: 'Date', w: 28, fill: red, color: [255, 255, 255], bold: true, align: 'center' },
        { text: 'Responsable', w: 38, fill: red, color: [255, 255, 255], bold: true, align: 'center' },
      ])
      if (c.planning.length === 0) emptyRow()
      else c.planning.forEach((p) => drawRow([
        { text: p.etape, w: 32 },
        { text: p.description, w: contentW - 32 - 28 - 38 },
        { text: fmtD(p.date), w: 28, align: 'center' },
        { text: p.responsable, w: 38, align: 'center' },
      ]))
    }
    const tachesTable = (titre: string, list: ProjetContent['taches']) => {
      band(titre, dark)
      drawRow([
        { text: 'Fait', w: 14, fill: [55, 65, 81], color: [255, 255, 255], bold: true, align: 'center' },
        { text: 'Description', w: contentW - 14 - 30, fill: [55, 65, 81], color: [255, 255, 255], bold: true, align: 'center' },
        { text: 'Date', w: 30, fill: [55, 65, 81], color: [255, 255, 255], bold: true, align: 'center' },
      ])
      if (list.length === 0) emptyRow()
      else list.forEach((t) => drawRow([
        { w: 14, check: t.fait },
        { text: t.description, w: contentW - 14 - 30 },
        { text: fmtD(t.date), w: 30, align: 'center' },
      ]))
    }
    const taches = c.taches ?? []
    if (cfg.tachesClient) tachesTable('Tâches à réaliser par le client', taches.filter((t) => t.pour === 'client'))
    if (cfg.tachesSC) tachesTable(`Tâches de ${fNom}`, taches.filter((t) => (t.pour ?? 'sc') === 'sc'))

    footer()
    return finalize(docu.titre || meta.label)
  }

  // Titre
  drawLogo()
  setText(dark); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(18)
  pdf.text(meta?.titrePdf ?? docu.titre, W / 2, y, { align: 'center' })
  y += 7
  if (docu.clientNom) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(12); setText(gray)
    pdf.text(`Projet ${docu.clientNom}`, W / 2, y, { align: 'center' })
  }
  y += 10

  // Tableau infos
  const rows: [string, string][] = [
    ['Client / projet', docu.clientNom || '—'],
    ['Type de document', meta?.label ?? docu.type],
    ['Version', docu.version || '1.0'],
    ['Statut', STATUT_DOC_LABELS[docu.statut] ?? docu.statut],
    ['Date', new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['Réf', docu.id.slice(0, 8)],
    ['Prestataire', fNom],
  ]
  const labelW = 55, rowH = 8
  pdf.setFontSize(10)
  rows.forEach((r) => {
    setFill(teal); pdf.rect(margin, y, labelW, rowH, 'F')
    setFill(light); pdf.rect(margin + labelW, y, W - margin * 2 - labelW, rowH, 'F')
    setText([255, 255, 255]); pdf.setFont('helvetica', 'bold'); pdf.text(r[0], margin + 3, y + 5.5)
    setText(dark); pdf.setFont('helvetica', 'normal'); pdf.text(r[1], margin + labelW + 3, y + 5.5)
    y += rowH
  })
  y += 12

  // Corps (placeholder en attendant les éditeurs par type)
  setText(dark); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12)
  pdf.text('Contenu', margin, y); y += 7
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); setText(gray)
  const placeholder = meta?.famille === 'legal'
    ? 'Le contenu juridique détaillé de ce document (modèle type) sera intégré à la prochaine étape. Ceci est la structure de base, prête à être remplie.'
    : 'Le contenu structuré de ce document (objectifs, fonctionnalités, planning, tâches…) sera intégré à la prochaine étape. Ceci est la structure de base.'
  const lines = pdf.splitTextToSize(placeholder, W - margin * 2) as string[]
  pdf.text(lines, margin, y); y += lines.length * 5 + 8

  if (docu.statut === 'signe') {
    setText(dark); pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9)
    const when = docu.signeLe ? ' le ' + new Date(docu.signeLe.toMillis()).toLocaleDateString('fr-FR') : ''
    const who = docu.signatairePar ? ' par ' + docu.signatairePar : ''
    pdf.text(`Document signé${who}${when}.`, margin, y)
  }

  // Pied de page
  const footY = 285
  setDraw(light); pdf.line(margin, footY - 4, W - margin, footY - 4)
  setText(teal); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
  pdf.text(fNom, W / 2, footY, { align: 'center' })
  setText(gray); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8)
  pdf.text(footerLine, W / 2, footY + 4, { align: 'center' })

  return finalize(docu.titre || meta?.label || 'document')
}
