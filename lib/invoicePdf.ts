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

// ── Rendu HTML → PDF (html2canvas-pro, pagination par découpe A4) ───────────────

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
    const pageHpx = Math.floor(H * pxPerMm);
    let rendered = 0;
    let isFirst = firstPage;

    while (rendered < canvas.height - 1) {
      const sliceH = Math.min(pageHpx, canvas.height - rendered);
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
      doc.addImage(imgData, "JPEG", 0, 0, W, sliceH / pxPerMm);
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
