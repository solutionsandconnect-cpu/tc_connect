import type { Facture, Company } from "@/types";
import { buildInvoiceHtml } from "./invoiceHtml";

// itemNetTotal reste exporté ici pour ne pas casser les imports existants.
export { itemNetTotal } from "./invoiceHtml";

// ── Chargement d'image distante en data URL (évite le « taint » canvas) ─────────

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  const canvasResult = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 6000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
  if (canvasResult) return canvasResult;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Points de coupe « propres » pour la pagination ──────────────────────────────
// On ne coupe jamais en plein milieu d'un texte : seulement au bas d'un bloc
// « atomique » (ligne de tableau, paragraphe, item de liste, encadré…). Les titres
// de section sont volontairement EXCLUS pour éviter un titre orphelin en bas de page
// (la coupe tombe alors avant le titre, qui part en haut de la page suivante avec
// son contenu). Renvoie une liste triée d'offsets Y en pixels canvas.
const BREAK_SELECTOR = [
  "tbody tr",          // lignes du tableau de prestations
  ".totals",           // bloc totaux (encadré insécable)
  ".value",            // bandeau valeur (insécable : sa base seule est un point de coupe)
  ".twocol",           // panneaux « inclus » 2 colonnes (insécables ensemble)
  "ul.check > li",     // checklist « modules livrés »
  ".opt-tbl tr",       // lignes du tableau d'options
  "dl.mod > div",      // lignes de modalités
  ".ech-row",          // lignes d'échéancier
  ".pay",              // encart référence de paiement
  ".note",             // encarts de note
  "p.lead",            // objet / notes
  ".sign",             // bloc signatures (insécable)
  "footer",            // pied de page (insécable)
  ".cgv-p",            // paragraphes CGV
  ".cgv-ul > li",      // items de liste CGV
].join(",");

function collectBreakpoints(target: HTMLElement, scale: number): number[] {
  const topRef = target.getBoundingClientRect().top;
  const set = new Set<number>();
  target.querySelectorAll(BREAK_SELECTOR).forEach((el) => {
    const bottom = (el as HTMLElement).getBoundingClientRect().bottom - topRef;
    if (bottom > 0) set.add(Math.round(bottom * scale));
  });
  return Array.from(set).sort((a, b) => a - b);
}

// Délimite chaque section numérotée (du titre `h2.sec` au titre suivant) en px canvas.
// Sert à repousser une section entière en haut de la page suivante quand elle ne
// tient pas dans l'espace restant (et qu'elle tiendrait sur une page seule).
function collectSections(target: HTMLElement, scale: number): { top: number; bottom: number }[] {
  const topRef = target.getBoundingClientRect().top;
  const heads = Array.from(target.querySelectorAll("h2.sec")) as HTMLElement[];
  const docBottom = target.getBoundingClientRect().bottom - topRef;
  return heads.map((h, i) => {
    const top = h.getBoundingClientRect().top - topRef;
    const bottom = heads[i + 1] ? heads[i + 1].getBoundingClientRect().top - topRef : docBottom;
    return { top: Math.round(top * scale), bottom: Math.round(bottom * scale) };
  });
}

// ── Rendu HTML → PDF (html2canvas-pro, pagination aux frontières de blocs) ──────

async function buildPDF(facture: Facture, company?: Company | null) {
  const { jsPDF } = await import("jspdf");
  const html2canvas = (await import("html2canvas-pro")).default;

  // Assets distants embarqués en data URL pour un rendu fiable.
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    company?.logoUrl ? fetchImageAsDataUrl(company.logoUrl) : Promise.resolve(null),
    facture.type === "devis" && facture.signed && facture.signatureUrl
      ? fetchImageAsDataUrl(facture.signatureUrl)
      : Promise.resolve(null),
  ]);

  const { mainHtml, cgvHtml } = buildInvoiceHtml(facture, company, { logoDataUrl, signatureDataUrl });

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;

  // Conteneur rendu à (0,0) MAIS derrière le contenu (z-index négatif) : invisible
  // pour l'utilisateur, tout en restant dans la zone capturée par html2canvas.
  // (Une position hors-écran type left:-10000px fait que le clone tombe hors du
  //  canvas de capture → image vide.)
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.left = "0";
  host.style.top = "0";
  host.style.width = "794px"; // ≈ 210 mm @ 96 dpi
  host.style.background = "#ffffff";
  host.style.zIndex = "-9999";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const SCALE = 2;

  const addHtmlPages = async (html: string, firstPage: boolean): Promise<void> => {
    host.innerHTML = html;
    const target = host.querySelector(".invpdf, .cgvpage") as HTMLElement | null;
    if (!target) return;
    // Laisse le navigateur calculer la mise en page (et décoder les data URLs).
    await new Promise((r) => setTimeout(r, 60));

    const canvas = await html2canvas(target, {
      scale: SCALE,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      x: 0,
      y: 0,
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
      windowHeight: target.scrollHeight,
    });

    if (!canvas.width || !canvas.height) {
      throw new Error("Rendu PDF vide (html2canvas a renvoyé un canvas de taille nulle)");
    }
    const pxPerMm = canvas.width / W;
    const totalH = canvas.height;
    // Frontières sûres + délimitation des sections (avant réutilisation du host).
    const breaks = collectBreakpoints(target, SCALE);
    const sections = collectSections(target, SCALE);
    const CONT_PAD_MM = 12;   // marge haute des pages de continuation (sinon contenu collé au bord)
    const BOTTOM_PAD_MM = 12; // marge basse de toutes les pages (sinon contenu collé en bas)
    let rendered = 0;
    let isFirst = firstPage;

    while (rendered < totalH - 1) {
      // Page de continuation = ne démarre pas au haut naturel du document (qui, lui,
      // a déjà sa propre marge interne). On lui réserve une marge haute ; et une marge
      // basse sur toutes les pages.
      const isCont = rendered > 0;
      const topPadMm = isCont ? CONT_PAD_MM : 0;
      const usableHpx = Math.floor((H - topPadMm - BOTTOM_PAD_MM) * pxPerMm);
      const maxCut = rendered + usableHpx;
      let cut: number;
      if (maxCut >= totalH) {
        // Dernier morceau : tout le reste tient sur une page.
        cut = totalH;
      } else {
        // On cherche la plus basse frontière sûre qui tient dans la page.
        // (rendered + 8 px : garantit qu'on avance, même si un bloc démarre la page.)
        const fit = breaks.filter((b) => b > rendered + 8 && b <= maxCut);
        cut = fit.length ? fit[fit.length - 1] : maxCut; // sinon coupe nette (bloc + grand qu'une page)

        // Si une nouvelle section démarre dans cette page mais déborde, et qu'elle
        // tiendrait entière sur une page seule, on la repousse en haut de la suivante
        // (la coupe tombe juste avant son titre → pas de section coupée en deux).
        // MAIS seulement si peu de place serait gâchée sur la page courante : pour une
        // grande section qui démarre haut, on préfère la couper proprement entre lignes
        // (remplit la page) plutôt que de laisser une demi-page blanche.
        const maxWaste = usableHpx * 0.33;
        const splitSection = sections.find(
          (s) =>
            s.top > rendered + 8 && s.top < maxCut && s.bottom > maxCut &&
            s.bottom - s.top <= usableHpx &&
            usableHpx - (s.top - rendered) <= maxWaste,
        );
        if (splitSection) cut = splitSection.top;
      }
      const sliceH = Math.min(cut, totalH) - rendered;
      if (sliceH <= 0) break;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      }
      const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
      if (!isFirst) doc.addPage();
      isFirst = false;
      doc.addImage(imgData, "JPEG", 0, topPadMm, W, sliceH / pxPerMm);
      rendered += sliceH;
    }
  };

  await addHtmlPages(mainHtml, true);
  if (cgvHtml) await addHtmlPages(cgvHtml, false);

  document.body.removeChild(host);
  return doc;
}

export async function downloadInvoicePDF(facture: Facture, company?: Company | null) {
  const doc = await buildPDF(facture, company);
  const isDevis = facture.type === "devis";
  doc.save(`${isDevis ? "devis" : "facture"}-${facture.number}.pdf`);
}

export async function generateInvoicePDFBlob(facture: Facture, company?: Company | null): Promise<Blob> {
  const doc = await buildPDF(facture, company);
  return doc.output("blob") as Blob;
}
