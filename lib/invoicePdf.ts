import type { Facture, Company } from "@/types";
import { buildInvoiceHtml } from "./invoiceHtml";
import { htmlPagesToPdf } from "./htmlToPdf";

// itemNetTotal reste exporté ici pour ne pas casser les imports existants.
export { itemNetTotal } from "./invoiceHtml";

// ── Chargement d'image distante en data URL (évite le « taint » canvas) ─────────

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
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
  ".sumrow",           // ligne « plan de règlement + totaux » (insécable ensemble)
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

async function buildPDF(facture: Facture, company?: Company | null) {
  // Assets distants embarqués en data URL pour un rendu fiable.
  const [logoDataUrl, signatureDataUrl, providerSignatureDataUrl] = await Promise.all([
    company?.logoUrl ? fetchImageAsDataUrl(company.logoUrl) : Promise.resolve(null),
    facture.type === "devis" && facture.signed && facture.signatureUrl
      ? fetchImageAsDataUrl(facture.signatureUrl)
      : Promise.resolve(null),
    facture.type === "devis" && company?.signatureUrl
      ? fetchImageAsDataUrl(company.signatureUrl)
      : Promise.resolve(null),
  ]);

  const { mainHtml, cgvHtml } = buildInvoiceHtml(facture, company, { logoDataUrl, signatureDataUrl, providerSignatureDataUrl });

  // Pagination déléguée au moteur partagé (cf. lib/htmlToPdf.ts) — comportement
  // et sélecteurs identiques à la version précédente.
  return htmlPagesToPdf([mainHtml, cgvHtml], {
    targetSelector: ".invpdf, .cgvpage",
    breakSelector: BREAK_SELECTOR,
    sectionHeadSelector: "h2.sec",
  });
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
