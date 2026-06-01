import type { Facture, FactureItem, Company, EcheanceRef } from "@/types";

// ── Utilitaires ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const [intStr, dec] = Math.abs(n).toFixed(2).split(".");
  const intFmt = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${intFmt},${dec} €`;
}

function fmtDate(ts?: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

function hexToRgb(hex: string): [number, number, number] | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null;
}

export function itemNetTotal(item: FactureItem): number {
  const gross = item.quantity * item.price;
  if (!item.discountType || !item.discountValue) return gross;
  if (item.discountType === "percent") return gross * (1 - item.discountValue / 100);
  return gross - item.discountValue;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  // Canvas approach — works when CORS headers are present on the image host
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

  // Fetch fallback
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

// ── Générateur PDF ────────────────────────────────────────────────────────────

async function buildPDF(facture: Facture, company?: Company | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const isDevis = facture.type === "devis";
  const docLabel = isDevis ? "DEVIS" : "FACTURE";
  const W = 210;
  const margin = 20;
  const contentW = W - margin * 2;

  const blue: [number, number, number] = company?.couleurPrimaire
    ? (hexToRgb(company.couleurPrimaire) ?? [37, 99, 235])
    : [37, 99, 235];
  const gray: [number, number, number] = [107, 114, 128];
  const lightGray: [number, number, number] = [243, 244, 246];
  const dark: [number, number, number] = [17, 24, 39];
  const green: [number, number, number] = [22, 163, 74];
  const orange: [number, number, number] = blue;

  // ── Charger le logo ─────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  if (company?.logoUrl) {
    logoDataUrl = await fetchImageAsDataUrl(company.logoUrl);
  }

  // ── En-tête bandeau ─────────────────────────────────────────────
  doc.setFillColor(...blue);
  doc.rect(0, 0, W, 42, "F");

  // Logo ou initiales
  if (logoDataUrl) {
    try {
      const imgFmt = logoDataUrl.startsWith("data:image/jpeg") || logoDataUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, imgFmt, margin, 6, 24, 24);
    } catch { /* fallback to initials below */ }
  }
  if (!logoDataUrl && company?.nom) {
    doc.setFillColor(255, 255, 255, 0.2);
    doc.setFillColor(
      Math.min(255, blue[0] + 40),
      Math.min(255, blue[1] + 40),
      Math.min(255, blue[2] + 40)
    );
    doc.roundedRect(margin, 7, 22, 22, 3, 3, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(company.nom[0].toUpperCase(), margin + 11, 21, { align: "center" });
  }

  // Titre et numéro
  const titleX = company?.nom ? margin + 28 : margin;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(docLabel, titleX, 18);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`N° ${facture.number}`, titleX, 26);

  const docDate = facture.date ?? facture.createdAt;
  doc.text(`Date : ${fmtDate(docDate ?? null)}`, titleX, 32);

  if (isDevis) {
    doc.setFontSize(7);
    doc.text("Ce document est un devis et ne fait pas office de facture.", titleX, 38);
  }

  if (!isDevis && facture.devisNumber) {
    doc.setFontSize(8);
    doc.text(`Réf. devis : ${facture.devisNumber}`, titleX, 38);
  }

  // Infos société (haut droite)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  const coachLines = company
    ? [
        company.nom,
        [company.adresse, company.codePostal, company.ville].filter(Boolean).join(" "),
        company.email ?? "",
        company.telephone ?? "",
        company.siret ? `SIRET : ${company.siret}` : "",
        company.tva ? `TVA : ${company.tva}` : "",
      ].filter(Boolean)
    : ["Votre Structure", "Adresse — CP Ville", "contact@votre-email.fr", "SIRET : 000 000 000 00000"];

  let cy = 9;
  for (const line of coachLines) {
    doc.setFont("helvetica", line === coachLines[0] ? "bold" : "normal");
    doc.text(line, W - margin, cy, { align: "right" });
    cy += 4.8;
  }

  // ── Blocs client + statut ───────────────────────────────────────
  let y = 50;

  // Bloc client
  const clientH = 34;
  doc.setFillColor(...lightGray);
  doc.roundedRect(margin, y, contentW * 0.5, clientH, 2, 2, "F");

  doc.setTextColor(...dark);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURÉ À", margin + 4, y + 6);
  doc.setFontSize(11);
  doc.text(facture.factureNom || facture.clientName || "—", margin + 4, y + 14);

  let clientInfoY = y + 20;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...gray);
  const displayAdresse = facture.factureAdresse || facture.clientAddress;
  const displayCP = facture.factureCodePostal || facture.clientCodePostal;
  const displayVille = facture.factureVille || facture.clientVille;
  if (displayAdresse) {
    doc.text(displayAdresse, margin + 4, clientInfoY);
    clientInfoY += 4.5;
  }
  if (displayCP || displayVille) {
    doc.text([displayCP, displayVille].filter(Boolean).join(" "), margin + 4, clientInfoY);
    clientInfoY += 4.5;
  }

  // Bloc statut
  const statusLabels: Record<string, string> = {
    draft: "Brouillon", sent: "En attente", paid: "Payée",
    overdue: "En retard", cancelled: "Annulée", accepted: "Accepté",
  };
  const statusColors: Record<string, [number, number, number]> = {
    draft: gray, sent: blue, paid: green,
    overdue: [220, 38, 38], cancelled: [156, 163, 175], accepted: green,
  };
  const rightX = margin + contentW * 0.53;
  const statusColor = statusColors[facture.status] ?? gray;

  doc.setFillColor(...lightGray);
  doc.roundedRect(rightX, y, contentW * 0.47, clientH, 2, 2, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("STATUT", rightX + 4, y + 6);
  doc.setFontSize(13);
  doc.setTextColor(...statusColor);
  doc.text(statusLabels[facture.status] ?? facture.status, rightX + 4, y + 15);

  if (facture.devisRef && !isDevis) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text(`Issu du devis ${facture.devisNumber ?? facture.devisRef}`, rightX + 4, y + 22);
  }

  // ── Tableau prestations ─────────────────────────────────────────
  y += clientH + 10;

  // Colonnes : desc | qté | prix | remise | total
  const hasDiscount = facture.items.some((i) => i.discountType && i.discountValue);
  const cols = hasDiscount
    ? [contentW * 0.38, contentW * 0.09, contentW * 0.15, contentW * 0.13, contentW * 0.25]
    : [contentW * 0.50, contentW * 0.10, contentW * 0.17, contentW * 0.23];
  const headers = hasDiscount
    ? ["Description", "Qté", "Prix unit.", "Remise", "Total net"]
    : ["Description", "Qté", "Prix unit.", "Total"];

  doc.setFillColor(...blue);
  doc.rect(margin, y, contentW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  let cx = margin + 3;
  for (let i = 0; i < headers.length; i++) {
    if (i === 0) {
      doc.text(headers[i], cx, y + 5.5, { align: "left" });
    } else {
      doc.text(headers[i], cx + cols[i] / 2, y + 5.5, { align: "center" });
    }
    cx += cols[i];
  }

  y += 8;
  doc.setFontSize(8.5);
  let grandTotal = 0;
  let totalDiscount = 0;

  for (let i = 0; i < facture.items.length; i++) {
    const item = facture.items[i];
    const gross = item.quantity * item.price;
    const net = itemNetTotal(item);
    grandTotal += net;
    totalDiscount += gross - net;

    if (i % 2 === 0) {
      doc.setFillColor(249, 250, 251);
      doc.rect(margin, y, contentW, 8, "F");
    }

    cx = margin + 3;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    // Description (truncate if too long)
    const label = doc.splitTextToSize(item.label || "—", cols[0] - 6)[0];
    doc.text(label, cx, y + 5.5);
    cx += cols[0];

    doc.text(String(item.quantity), cx + cols[1] / 2, y + 5.5, { align: "center" });
    cx += cols[1];

    doc.text(fmt(item.price), cx + cols[2] / 2, y + 5.5, { align: "center" });
    cx += cols[2];

    if (hasDiscount) {
      if (item.discountType && item.discountValue) {
        doc.setTextColor(...orange);
        const dLabel = item.discountType === "percent"
          ? `-${item.discountValue}%`
          : `-${fmt(item.discountValue)}`;
        doc.text(dLabel, cx + cols[3] / 2, y + 5.5, { align: "center" });
        doc.setTextColor(...dark);
      }
      cx += cols[3];
    }

    doc.setFont("helvetica", "bold");
    doc.text(fmt(net), cx + cols[cols.length - 1] / 2, y + 5.5, { align: "center" });
    y += 8;
  }

  // Ligne séparateur
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentW, y);
  y += 5;

  // ── Bloc totaux ─────────────────────────────────────────────────
  const totalX = margin + contentW * 0.58;
  const totalW = contentW * 0.42;
  const echeanceRef = facture.echeanceRef as EcheanceRef | undefined;

  if (totalDiscount > 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text("Sous-total brut", totalX + 4, y + 5);
    doc.text(fmt(grandTotal + totalDiscount), totalX + totalW - 4, y + 5, { align: "right" });
    y += 6;
    doc.setTextColor(...orange);
    doc.text("Remises", totalX + 4, y + 5);
    doc.text(`-${fmt(totalDiscount)}`, totalX + totalW - 4, y + 5, { align: "right" });
    y += 6;
    doc.setDrawColor(230, 230, 230);
    doc.setLineWidth(0.2);
    doc.line(totalX, y, totalX + totalW, y);
    y += 3;
  }

  if (!isDevis && echeanceRef) {
    // Facture issue d'un devis à échéancier — affichage détaillé du règlement
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text("Montant total du marché", totalX + 4, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(fmt(grandTotal), totalX + totalW - 4, y + 5.5, { align: "right" });
    y += 9;

    // Règlement actuel
    doc.setFillColor(...blue);
    doc.roundedRect(totalX, y, totalW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("RÈGLEMENT ACTUEL", totalX + 4, y + 6);
    doc.setFontSize(7.5);
    doc.text(`${echeanceRef.label}  (${echeanceRef.index + 1}/${echeanceRef.count})`, totalX + 4, y + 11);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(fmt(echeanceRef.montant), totalX + totalW - 4, y + 10, { align: "right" });
    y += 19;

    // Déjà réglé avant cette échéance (cumul des échéances précédentes).
    // Fallback pour les anciennes factures sans cumulPrecedent : répartition équitable.
    const dejaRegle = echeanceRef.cumulPrecedent ?? (echeanceRef.count > 0 ? (grandTotal / echeanceRef.count) * echeanceRef.index : 0);
    if (dejaRegle > 0) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...gray);
      doc.text("Déjà réglé précédemment", totalX + 4, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(fmt(dejaRegle), totalX + totalW - 4, y + 5.5, { align: "right" });
      y += 8;
    }
    const reste = grandTotal - dejaRegle - echeanceRef.montant;
    if (reste > 0.005) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...orange);
      doc.text("Restera à régler ensuite", totalX + 4, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.text(fmt(reste), totalX + totalW - 4, y + 5.5, { align: "right" });
      y += 9;
    }
    y += 6;
  } else {
    doc.setFillColor(...blue);
    doc.roundedRect(totalX, y, totalW, 13, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL HT", totalX + 4, y + 9);
    doc.text(fmt(grandTotal), totalX + totalW - 4, y + 9, { align: "right" });
    y += 20;
  }

  // ── Référence de paiement (factures uniquement) ─────────────────
  if (!isDevis) {
    const hasRib = company?.iban || company?.bic;
    const boxH = hasRib ? 22 : 14;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setDrawColor(...blue);
    doc.setLineWidth(0.5);
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, y, contentW, boxH, 2, 2, "FD");
    // Titre + numéro facture
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...blue);
    doc.text("Référence à indiquer pour tout virement :", margin + 4, y + 5.5);
    doc.setFontSize(9.5);
    doc.text(facture.number, margin + 4, y + 11);
    // Info virement à droite
    // IBAN + BIC
    if (hasRib) {
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...blue);
      doc.text("Coordonnées bancaires :", margin + 4, y + 17.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...dark);
      const ribParts: string[] = [];
      if (company?.iban) ribParts.push(`IBAN : ${company.iban}`);
      if (company?.bic) ribParts.push(`BIC : ${company.bic}`);
      doc.text(ribParts.join("   "), margin + 46, y + 17.5);
    }
    y += boxH + 4;
  }

  // ── Échéancier ──────────────────────────────────────────────────
  if (facture.echeances && facture.echeances.length > 0) {
    const paid = facture.echeances.filter((e) => e.statut === "payé");
    const pending = facture.echeances.filter((e) => e.statut !== "payé");
    const paidTotal = paid.reduce((s, e) => s + e.montant, 0);
    const pendingTotal = pending.reduce((s, e) => s + e.montant, 0);

    // Add page break if needed
    if (y > 215) { doc.addPage(); y = 20; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Échéancier de paiement", margin, y);
    y += 5;

    // Progress bar — factures uniquement (sur un devis tout est toujours à 0€ réglé)
    if (grandTotal > 0 && !isDevis) {
      const barW = contentW;
      const paidW = barW * Math.min(1, paidTotal / grandTotal);
      doc.setFillColor(229, 231, 235);
      doc.roundedRect(margin, y, barW, 4, 2, 2, "F");
      if (paidW > 0) {
        doc.setFillColor(57, 58, 59);
        doc.roundedRect(margin, y, paidW, 4, 2, 2, "F");
      }
      y += 7;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...green);
      doc.text(`Reçu : ${fmt(paidTotal)}`, margin, y);
      doc.setTextColor(...orange);
      doc.text(`Restant : ${fmt(pendingTotal)}`, margin + contentW, y, { align: "right" });
      y += 6;
    }

    for (const ech of facture.echeances) {
      if (y > 265) { doc.addPage(); y = 20; }
      const isPaid = ech.statut === "payé";
      doc.setFillColor(isPaid ? 220 : 254, isPaid ? 252 : 243, isPaid ? 231 : 199);
      doc.roundedRect(margin, y, contentW, 7, 1, 1, "F");
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...dark);
      const echLabel = ech.label || fmtDate(ech.date ?? null);
      doc.text(echLabel, margin + 3, y + 4.8);
      doc.setFontSize(8);
      doc.text(fmtDate(ech.date ?? null), margin + contentW * 0.4, y + 4.8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(isPaid ? 22 : 180, isPaid ? 163 : 83, isPaid ? 74 : 9);
      doc.text(isPaid ? "Payé" : "En attente", margin + contentW * 0.65, y + 4.8);
      doc.setTextColor(...dark);
      doc.text(fmt(ech.montant), margin + contentW - 3, y + 4.8, { align: "right" });
      y += 8.5;
    }
    y += 4;
  }

  // ── Notes ───────────────────────────────────────────────────────
  if (facture.notes) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Notes :", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    const noteLines = doc.splitTextToSize(facture.notes, contentW);
    doc.text(noteLines, margin, y + 5);
    y += 5 + noteLines.length * 4.5 + 4;
  }

  // ── Section signature (devis uniquement) ────────────────────────
  if (isDevis) {
    if (y > 225) { doc.addPage(); y = 20; }
    const sigY = y;
    const sigBoxW = contentW * 0.58;
    const sigBoxH = 44;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, sigY, sigBoxW, sigBoxH, 2, 2, "S");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("BON POUR ACCORD", margin + 4, sigY + 7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    doc.text("Date et signature du client :", margin + 4, sigY + 13);
    if (facture.signed) {
      if (facture.signatureUrl) {
        const sigDataUrl = await fetchImageAsDataUrl(facture.signatureUrl);
        if (sigDataUrl) {
          try { doc.addImage(sigDataUrl, "PNG", margin + 4, sigY + 15, sigBoxW - 12, 20); } catch {}
        }
        if (facture.signedAt) {
          doc.setFontSize(7);
          doc.setTextColor(...gray);
          doc.text(`Signé le ${fmtDate(facture.signedAt)}`, margin + 4, sigY + 40);
        }
      } else if (facture.signedAt) {
        doc.setTextColor(...green);
        doc.setFont("helvetica", "bold");
        doc.text(`Signé électroniquement le ${fmtDate(facture.signedAt)}`, margin + 4, sigY + 25);
      }
    } else {
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(margin + 4, sigY + 36, margin + sigBoxW - 4, sigY + 36);
    }
    y = sigY + sigBoxH + 6;
  }

  // ── Pied de page page 1 ─────────────────────────────────────────
  const footerY = 283;
  if (company?.mentionsLegales) {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...gray);
    const lines = doc.splitTextToSize(company.mentionsLegales, contentW);
    doc.text(lines, margin, footerY - lines.length * 3.2 - 1);
  }
  doc.setFillColor(...blue);
  doc.rect(0, footerY, W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const ribInfo = [
    company?.iban ? `IBAN : ${company.iban}` : null,
    company?.bic ? `BIC : ${company.bic}` : null,
  ].filter(Boolean).join(" · ");
  const footerMain = company
    ? `${company.nom}${ribInfo ? ` · ${ribInfo}` : ""}`
    : "Merci de votre confiance.";
  doc.text(footerMain, W / 2, footerY + 5.5, { align: "center" });
  doc.setFontSize(7);
  if (company?.cgvDate) {
    const cgvDateFmt = new Date(company.cgvDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    doc.text(`Merci de votre confiance.`, margin, footerY + 10.5);
    doc.text(`Voir CGV mises à jour le ${cgvDateFmt}`, W - margin, footerY + 10.5, { align: "right" });
  } else {
    doc.text("Merci de votre confiance.", W / 2, footerY + 10.5, { align: "center" });
  }

  // ── Page 2 : CGV ────────────────────────────────────────────────
  if (company?.cgv) {
    doc.addPage();
    doc.setFillColor(...blue);
    doc.rect(0, 0, W, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Conditions Générales de Vente", margin, 11);
    if (company.cgvDate) {
      const cgvDateFmt2 = new Date(company.cgvDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Mise à jour le ${cgvDateFmt2}`, W - margin, 11, { align: "right" });
    }

    // ── Markdown helpers (bold, italic, underline, bullets, headings, tab) ──
    type CgvSeg = { text: string; bold: boolean; italic: boolean; underline: boolean };
    type CgvWord = { word: string; bold: boolean; italic: boolean; underline: boolean };

    const parseCgvInline = (text: string): CgvSeg[] => {
      const segs: CgvSeg[] = [];
      const re = /\*\*(.*?)\*\*|\*(.*?)\*|__(.*?)__/g;
      let last = 0; let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m.index > last) segs.push({ text: text.slice(last, m.index), bold: false, italic: false, underline: false });
        if (m[1] !== undefined) segs.push({ text: m[1], bold: true, italic: false, underline: false });
        else if (m[2] !== undefined) segs.push({ text: m[2], bold: false, italic: true, underline: false });
        else if (m[3] !== undefined) segs.push({ text: m[3], bold: false, italic: false, underline: true });
        last = re.lastIndex;
      }
      if (last < text.length) segs.push({ text: text.slice(last), bold: false, italic: false, underline: false });
      return segs.filter((s) => s.text.length > 0);
    };

    const segsToWords = (segs: CgvSeg[]): CgvWord[] => {
      const words: CgvWord[] = [];
      for (const seg of segs) {
        for (const part of seg.text.split(/\s+/)) {
          if (part) words.push({ word: part, bold: seg.bold, italic: seg.italic, underline: seg.underline });
        }
      }
      return words;
    };

    const fontStyle = (w: CgvWord) => w.bold && w.italic ? "bolditalic" : w.bold ? "bold" : w.italic ? "italic" : "normal";

    const wrapWords = (words: CgvWord[], maxW: number): CgvWord[][] => {
      doc.setFont("helvetica", "normal");
      const spW = doc.getTextWidth(" ");
      const lines: CgvWord[][] = [];
      let cur: CgvWord[] = []; let curW = 0;
      for (const w of words) {
        doc.setFont("helvetica", fontStyle(w));
        const wW = doc.getTextWidth(w.word);
        const addW = cur.length ? spW + wW : wW;
        if (cur.length && curW + addW > maxW + 0.1) {
          lines.push(cur); cur = [w]; curW = wW;
        } else {
          cur.push(w); curW += addW;
        }
      }
      if (cur.length) lines.push(cur);
      return lines;
    };

    const renderWords = (words: CgvWord[], x: number, y: number, maxW: number, isLast: boolean) => {
      if (!words.length) return;
      doc.setFont("helvetica", "normal");
      const spW = doc.getTextWidth(" ");
      if (isLast || words.length === 1) {
        let cx = x;
        for (let i = 0; i < words.length; i++) {
          doc.setFont("helvetica", fontStyle(words[i]));
          const wx = cx;
          doc.text(words[i].word, cx, y);
          const wW = doc.getTextWidth(words[i].word);
          if (words[i].underline) { doc.setDrawColor(...dark); doc.setLineWidth(0.2); doc.line(wx, y + 0.8, wx + wW, y + 0.8); }
          cx += wW + (i < words.length - 1 ? spW : 0);
        }
      } else {
        let totalW = 0;
        for (const w of words) { doc.setFont("helvetica", fontStyle(w)); totalW += doc.getTextWidth(w.word); }
        const gap = words.length > 1 ? (maxW - totalW) / (words.length - 1) : 0;
        let cx = x;
        for (let i = 0; i < words.length; i++) {
          doc.setFont("helvetica", fontStyle(words[i]));
          const wx = cx;
          doc.text(words[i].word, cx, y);
          const wW = doc.getTextWidth(words[i].word);
          if (words[i].underline) { doc.setDrawColor(...dark); doc.setLineWidth(0.2); doc.line(wx, y + 0.8, wx + wW, y + 0.8); }
          cx += wW + (i < words.length - 1 ? gap : 0);
        }
      }
    };

    let cgvY = 26;
    doc.setTextColor(...dark);
    doc.setFontSize(9);

    for (const rawLine of company.cgv.split(/\n/)) {
      if (!rawLine.trim()) { cgvY += 3; continue; }

      // Detect tab indentation (4 spaces per level)
      const spaces = rawLine.match(/^( {4})*/)?.[0].length ?? 0;
      const tabLevel = Math.floor(spaces / 4);
      const content = rawLine.slice(spaces);
      const tabIndent = tabLevel * 8;
      const lMargin = margin + tabIndent;
      const lW = contentW - tabIndent;

      if (content.startsWith("## ")) {
        if (cgvY > 275) { doc.addPage(); cgvY = 20; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const headLines = doc.splitTextToSize(content.slice(3), lW);
        for (const hl of headLines) {
          if (cgvY > 275) { doc.addPage(); cgvY = 20; }
          doc.text(hl, lMargin, cgvY);
          cgvY += 5.5;
        }
        cgvY += 1;
        doc.setFontSize(9);
      } else if (content.startsWith("- ")) {
        const bW = lW - 6;
        const bLines = wrapWords(segsToWords(parseCgvInline(content.slice(2))), bW);
        for (let li = 0; li < bLines.length; li++) {
          if (cgvY > 275) { doc.addPage(); cgvY = 20; }
          if (li === 0) { doc.setFont("helvetica", "normal"); doc.text("•", lMargin + 1.5, cgvY); }
          renderWords(bLines[li], lMargin + 6, cgvY, bW, true);
          cgvY += 5;
        }
      } else {
        const pLines = wrapWords(segsToWords(parseCgvInline(content)), lW);
        for (let li = 0; li < pLines.length; li++) {
          if (cgvY > 275) { doc.addPage(); cgvY = 20; }
          renderWords(pLines[li], lMargin, cgvY, lW, li === pLines.length - 1);
          cgvY += 5;
        }
      }
    }

    doc.setFillColor(...blue);
    doc.rect(0, 283, W, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(company.nom ?? "", W / 2, 290, { align: "center" });
  }

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
