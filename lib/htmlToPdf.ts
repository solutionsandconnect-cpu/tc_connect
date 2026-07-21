// Moteur générique HTML → PDF (html2canvas-pro + jsPDF), avec pagination aux
// frontières de blocs. Extrait de `invoicePdf.ts` pour être partagé avec la
// brochure de prospection : la logique de coupe (pas de texte tranché en deux,
// pas de titre orphelin, pas de page blanche finale) est trop subtile pour être
// dupliquée.

export interface HtmlToPdfOptions {
  /** Nœud à capturer dans chaque page HTML fournie. */
  targetSelector: string
  /** Blocs « atomiques » : la coupe ne tombe qu'à leur frontière basse. */
  breakSelector: string
  /**
   * Titres de section. Une section qui déborde de la page courante est repoussée
   * en haut de la suivante — évite un titre seul en bas de page.
   */
  sectionHeadSelector?: string
  /** Marge haute des pages de continuation, en mm. */
  contPadMm?: number
  /** Marge basse de toutes les pages, en mm. */
  bottomPadMm?: number
}

function collectBreakpoints(target: HTMLElement, scale: number, selector: string): number[] {
  const topRef = target.getBoundingClientRect().top
  const set = new Set<number>()
  target.querySelectorAll(selector).forEach((el) => {
    const bottom = (el as HTMLElement).getBoundingClientRect().bottom - topRef
    if (bottom > 0) set.add(Math.round(bottom * scale))
  })
  return Array.from(set).sort((a, b) => a - b)
}

function collectSections(
  target: HTMLElement, scale: number, selector?: string,
): { top: number; bottom: number }[] {
  if (!selector) return []
  const topRef = target.getBoundingClientRect().top
  const heads = Array.from(target.querySelectorAll(selector)) as HTMLElement[]
  const docBottom = target.getBoundingClientRect().bottom - topRef
  return heads.map((h, i) => {
    const top = h.getBoundingClientRect().top - topRef
    const bottom = heads[i + 1] ? heads[i + 1].getBoundingClientRect().top - topRef : docBottom
    return { top: Math.round(top * scale), bottom: Math.round(bottom * scale) }
  })
}

/**
 * Rend une suite de documents HTML en un seul PDF A4.
 * Les entrées vides sont ignorées (les CGV d'une facture sont optionnelles).
 */
export async function htmlPagesToPdf(
  pages: (string | null | undefined)[], opts: HtmlToPdfOptions,
): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf')
  const html2canvas = (await import('html2canvas-pro')).default

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const CONT_PAD_MM = opts.contPadMm ?? 12
  const BOTTOM_PAD_MM = opts.bottomPadMm ?? 10

  // Conteneur rendu à (0,0) MAIS derrière le contenu (z-index négatif) : invisible
  // pour l'utilisateur, tout en restant dans la zone capturée par html2canvas.
  // (Une position hors-écran type left:-10000px fait que le clone tombe hors du
  //  canvas de capture → image vide.)
  const host = document.createElement('div')
  host.style.position = 'absolute'
  host.style.left = '0'
  host.style.top = '0'
  host.style.width = '794px' // ≈ 210 mm @ 96 dpi
  host.style.background = '#ffffff'
  host.style.zIndex = '-9999'
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)

  const SCALE = 2

  const addHtmlPages = async (html: string, firstPage: boolean): Promise<void> => {
    host.innerHTML = html
    const target = host.querySelector(opts.targetSelector) as HTMLElement | null
    if (!target) return
    // Laisse le navigateur calculer la mise en page (et décoder les data URLs).
    await new Promise((r) => setTimeout(r, 60))

    const canvas = await html2canvas(target, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
      windowHeight: target.scrollHeight,
    })

    if (!canvas.width || !canvas.height) {
      throw new Error('Rendu PDF vide (html2canvas a renvoyé un canvas de taille nulle)')
    }
    const pxPerMm = canvas.width / W
    const totalH = canvas.height
    const breaks = collectBreakpoints(target, SCALE, opts.breakSelector)
    const sections = collectSections(target, SCALE, opts.sectionHeadSelector)

    // Hauteur RÉELLE du contenu = dernière ligne non-blanche. Évite d'émettre une page
    // finale entièrement vide quand le conteneur a du blanc résiduel en bas.
    const contentH = (() => {
      const sctx = canvas.getContext('2d')
      if (!sctx) return totalH
      const pageHpx = Math.ceil(H * pxPerMm)
      const scanH = Math.min(totalH, Math.ceil(pageHpx * 1.5))
      const top = totalH - scanH
      let data: Uint8ClampedArray
      try { data = sctx.getImageData(0, top, canvas.width, scanH).data }
      catch { return totalH } // canvas inaccessible (taint) → on ne touche à rien
      const w = canvas.width
      for (let row = scanH - 1; row >= 0; row--) {
        const base = row * w * 4
        for (let i = 0; i < w; i++) {
          const p = base + i * 4
          if (data[p] < 250 || data[p + 1] < 250 || data[p + 2] < 250) return top + row + 1
        }
      }
      return top
    })()

    let rendered = 0
    let isFirst = firstPage

    while (rendered < contentH - 1) {
      const isCont = rendered > 0
      const topPadMm = isCont ? CONT_PAD_MM : 0
      const usableHpx = Math.floor((H - topPadMm - BOTTOM_PAD_MM) * pxPerMm)
      const maxCut = rendered + usableHpx
      let cut: number
      if (maxCut >= contentH) {
        cut = contentH
      } else {
        // Plus basse frontière sûre qui tient dans la page.
        // (rendered + 8 px : garantit qu'on avance, même si un bloc démarre la page.)
        const fit = breaks.filter((b) => b > rendered + 8 && b <= maxCut)
        cut = fit.length ? fit[fit.length - 1] : maxCut

        // Section qui démarre dans la page mais déborde : on la repousse entière en
        // haut de la suivante, sauf si trop de place serait gâchée ici.
        const maxWaste = usableHpx * 0.33
        const splitSection = sections.find(
          (s) =>
            s.top > rendered + 8 && s.top < maxCut && s.bottom > maxCut &&
            s.bottom - s.top <= usableHpx &&
            usableHpx - (s.top - rendered) <= maxWaste,
        )
        if (splitSection) cut = splitSection.top
      }
      const sliceH = Math.min(cut, contentH) - rendered
      if (sliceH <= 0) break

      const pageCanvas = document.createElement('canvas')
      pageCanvas.width = canvas.width
      pageCanvas.height = sliceH
      const ctx = pageCanvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height)
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
      }
      const imgData = pageCanvas.toDataURL('image/jpeg', 0.95)
      if (!isFirst) doc.addPage()
      isFirst = false
      doc.addImage(imgData, 'JPEG', 0, topPadMm, W, sliceH / pxPerMm)
      rendered += sliceH
    }
  }

  let premiere = true
  for (const html of pages) {
    if (!html) continue
    await addHtmlPages(html, premiere)
    premiere = false
  }

  document.body.removeChild(host)
  return doc
}
