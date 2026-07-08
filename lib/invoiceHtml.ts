import type { Facture, FactureItem, Company, EcheanceRef } from "@/types";

// ─── Utilitaires ───────────────────────────────────────────────────────────────

export function fmt(n: number) {
  const sign = n < 0 ? "-" : "";
  const [intStr, dec] = Math.abs(n).toFixed(2).split(".");
  const intFmt = intStr.replace(/\B(?=(\d{3})+(?!\d))/g, " "); // espace fine insécable
  return `${sign}${intFmt},${dec} €`;
}

function fmtDate(ts?: { seconds: number } | null) {
  if (!ts) return "—";
  return new Date(ts.seconds * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export function itemNetTotal(item: FactureItem): number {
  const gross = item.quantity * item.price;
  if (!item.discountType || !item.discountValue) return gross;
  if (item.discountType === "percent") return gross * (1 - item.discountValue / 100);
  return gross - item.discountValue;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return esc(s).replace(/\n/g, "<br/>");
}

function hexToRgb(hex: string): [number, number, number] | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null;
}

function darken(hex: string, factor: number): string {
  const rgb = hexToRgb(hex) ?? [37, 99, 235];
  const [r, g, b] = rgb.map((c) => Math.round(c * factor));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const recLabel = (r?: string) => (r === "mensuel" ? " /mois" : r === "annuel" ? " /an" : "");

// ─── Conversion markdown léger → HTML (pour les CGV) ─────────────────────────────

function mdInline(text: string): string {
  // échappe d'abord, puis applique le balisage
  let out = esc(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__(.+?)__/g, "<u>$1</u>");
  out = out.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
  return out;
}

function cgvToHtml(cgv: string): string {
  const lines = cgv.split(/\n/);
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };

  for (const raw of lines) {
    if (!raw.trim()) { closeList(); out.push('<div class="sp"></div>'); continue; }
    const spaces = raw.match(/^( {4})*/)?.[0].length ?? 0;
    const indent = Math.floor(spaces / 4) * 16;
    const content = raw.slice(spaces);

    // Puce = ligne commençant par « - », « * » ou « • » suivi d'un espace.
    const bullet = content.match(/^[-*•]\s+/);
    if (content.startsWith("## ")) {
      closeList();
      out.push(`<h3 class="cgv-h" style="margin-left:${indent}px">${mdInline(content.slice(3))}</h3>`);
    } else if (bullet) {
      if (!inList) { out.push(`<ul class="cgv-ul" style="margin-left:${indent}px">`); inList = true; }
      // Puce écrite en DUR (html2canvas ne rend pas les marqueurs list-style ●).
      out.push(`<li><span class="bul">•</span><span>${mdInline(content.slice(bullet[0].length))}</span></li>`);
    } else {
      closeList();
      out.push(`<p class="cgv-p" style="margin-left:${indent}px">${mdInline(content)}</p>`);
    }
  }
  closeList();
  return out.join("");
}

// ─── Feuille de style (calquée sur le devis Diambars, portée sous .invpdf) ──────

function buildStyle(primary: string): string {
  const primaryDk = darken(primary, 0.78);
  return `
  .invpdf, .invpdf *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .invpdf{
    --pri:${primary};--pri-dk:${primaryDk};--ink:#1b1f24;--muted:#5b6470;
    --line:#e3e7ec;--soft:#f6f8fa;--soft2:#fbfcfd;--ok:#1f8a4c;
    width:794px;background:#fff;color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    font-size:13px;line-height:1.5;padding:40px 46px 48px;
  }
  .invpdf .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
    border-bottom:3px solid var(--pri);padding-bottom:14px;margin-bottom:16px}
  .invpdf .brand{display:flex;flex-direction:column;gap:2px}
  .invpdf .logo{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:19px;letter-spacing:.3px}
  .invpdf .logo .mark{width:34px;height:34px;border-radius:8px;background:var(--pri);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;overflow:hidden}
  .invpdf .logo .mark.has-img{border-radius:50%;background:transparent}
  .invpdf .logo .mark img{width:100%;height:100%;object-fit:contain}
  .invpdf .brand .sub{color:var(--muted);font-size:11.5px;margin-top:2px}
  .invpdf .doc-meta{text-align:right;flex-shrink:0}
  .invpdf .doc-meta h1{font-size:23px;letter-spacing:1px;color:var(--pri);text-transform:uppercase;margin-bottom:6px}
  .invpdf .doc-meta-line{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6}
  .invpdf .doc-meta-line b{color:var(--ink)}
  .invpdf .chip{display:inline-block;margin-top:7px;padding:3px 10px;border-radius:20px;
    font-size:11px;font-weight:700;color:#fff}

  .invpdf .parties{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
  .invpdf .card{border:1px solid var(--line);border-radius:8px;padding:13px 16px;background:var(--soft2)}
  .invpdf .card .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--pri);
    font-weight:700;margin-bottom:6px}
  .invpdf .card .name{font-weight:700;font-size:14.5px}
  .invpdf .card .lines{color:var(--muted);font-size:12px;margin-top:3px}

  .invpdf h2.sec{font-size:12.5px;text-transform:uppercase;letter-spacing:1.1px;color:var(--ink);
    margin:18px 0 10px;padding-bottom:7px;border-bottom:1px solid var(--line);
    display:flex;align-items:center;gap:8px}
  .invpdf h2.sec .n{width:20px;height:20px;border-radius:50%;background:var(--pri);color:#fff;
    display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0}
  .invpdf h2.sec .extra{font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted);font-size:11px}
  .invpdf p.lead{color:var(--muted);margin-bottom:6px}

  .invpdf table{width:100%;border-collapse:collapse;font-size:12.5px}
  .invpdf .lines-tbl th{background:var(--ink);color:#fff;text-align:left;padding:9px 12px;font-size:10.5px;
    text-transform:uppercase;letter-spacing:.5px;font-weight:600}
  .invpdf .lines-tbl th.r,.invpdf .lines-tbl td.r{text-align:right;white-space:nowrap}
  .invpdf .lines-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  .invpdf .lines-tbl tr:nth-child(even) td{background:var(--soft2)}
  .invpdf .lines-tbl .desc small{display:block;color:var(--muted);font-size:11px;margin-top:3px;font-weight:400;white-space:normal}
  .invpdf .lines-tbl .desc b{font-size:13px}
  .invpdf .amt{font-weight:700;font-variant-numeric:tabular-nums}
  .invpdf .disc{color:var(--pri);font-weight:700}

  /* Ligne « plan de règlement (gauche) + totaux (droite) » côte à côte */
  .invpdf .sumrow{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:13px;flex-wrap:wrap}
  .invpdf .sumrow .totals{margin-top:0}
  .invpdf .sumrow .payplan{margin-top:0;max-width:340px;flex:0 1 340px}
  .invpdf .totals{margin-top:13px;display:flex;justify-content:flex-end}
  .invpdf .totals .box{width:340px;border:1px solid var(--line);border-radius:8px;overflow:hidden}
  .invpdf .totals .t-row{display:flex;justify-content:space-between;gap:10px;padding:8px 14px;font-size:12.5px;
    border-bottom:1px solid var(--line)}
  .invpdf .totals .t-row:last-child{border-bottom:0}
  .invpdf .totals .t-row span:last-child{font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
  .invpdf .totals .t-row.grand{background:var(--pri);color:#fff;font-size:14.5px}
  .invpdf .totals .t-row.grand span{font-weight:800}
  .invpdf .totals .t-row.next{background:var(--soft)}
  .invpdf .totals .t-row.disc-row span:last-child{color:var(--pri)}
  .invpdf .totals .t-row small{font-weight:400;color:var(--muted);font-size:10.5px}
  .invpdf .totals .t-row.grand small{color:rgba(255,255,255,.8)}

  .invpdf ul.check{list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:7px 22px}
  .invpdf ul.check li{position:relative;padding-left:24px;font-size:12.5px}
  .invpdf ul.check li::before{content:"\\2713";position:absolute;left:0;top:0;color:var(--ok);font-weight:800;
    background:#e7f5ec;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px}

  .invpdf .value{margin-top:16px;border:1px solid var(--pri);border-radius:10px;overflow:hidden}
  .invpdf .value .top{background:linear-gradient(100deg,var(--pri),var(--pri-dk));color:#fff;
    padding:13px 18px;display:flex;justify-content:space-between;align-items:center;gap:14px}
  .invpdf .value .top .t{font-weight:700;font-size:14px}
  .invpdf .value .top .t span{display:block;font-weight:400;font-size:11.5px;opacity:.88;margin-top:2px}
  .invpdf .value .top .fig{font-size:21px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums;text-align:right}
  .invpdf .value .top .fig small{display:block;font-size:9.5px;font-weight:500;opacity:.88;letter-spacing:.5px}
  .invpdf .value .body{padding:12px 18px;font-size:12px;color:var(--muted);background:#fff;line-height:1.5}
  .invpdf .value .body b{color:var(--ink)}
  .invpdf .value .body .stats{display:flex;gap:24px;flex-wrap:wrap;margin-top:10px}
  .invpdf .value .body .stats div{font-size:11px}
  .invpdf .value .body .stats b{display:block;font-size:16px;color:var(--pri)}

  .invpdf .subhead{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);
    font-weight:700;margin:16px 0 10px}
  .invpdf .twocol{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .invpdf .panel{border:1px solid var(--line);border-radius:8px;padding:13px 16px}
  .invpdf .panel h3{margin-bottom:8px;font-size:13px}
  .invpdf .panel ul{margin:0;padding-left:18px;color:var(--muted);font-size:12px}
  .invpdf .panel ul li{margin-bottom:4px}
  .invpdf .panel .reco{color:var(--ok);font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .invpdf .panel .price{font-weight:700;color:var(--ink);font-size:12px;margin-top:8px}

  /* Plan de règlement (présentation, n'impacte pas la facturation) */
  .invpdf .payplan{margin-top:14px;border:1px solid var(--pri);border-radius:8px;overflow:hidden;max-width:360px}
  .invpdf .payplan .pp-h{background:var(--soft);padding:8px 14px;font-size:10.5px;font-weight:700;
    text-transform:uppercase;letter-spacing:.6px;color:var(--pri);border-bottom:1px solid var(--line)}
  .invpdf .payplan .pp-row{display:flex;justify-content:space-between;gap:10px;padding:8px 14px;font-size:12.5px;border-bottom:1px solid var(--line)}
  .invpdf .payplan .pp-row:last-child{border-bottom:0}
  .invpdf .payplan .pp-row span:last-child{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .invpdf .payplan .pp-row.total{background:var(--soft);font-weight:700}

  /* Section « Évolution » (bloc Q/R + étapes chiffrées) */
  .invpdf .fut-head{display:flex;justify-content:space-between;align-items:center;gap:14px;
    background:var(--soft);border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:0 0 14px}
  .invpdf .fut-head .q{font-weight:700;font-size:13.5px}
  .invpdf .fut-head .q span{display:block;font-weight:400;font-size:12px;color:var(--muted);margin-top:3px}
  .invpdf .fut-head .a{font-weight:800;color:var(--ok);font-size:15px;white-space:nowrap}
  .invpdf .fut-step{border:1px solid var(--line);border-radius:8px;padding:11px 16px;margin-bottom:10px;
    display:flex;justify-content:space-between;align-items:center;gap:14px}
  .invpdf .fut-step .t b{font-size:13px}
  .invpdf .fut-step .t small{display:block;color:var(--muted);font-size:11.5px;margin-top:3px}
  .invpdf .fut-step .p{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--pri)}

  .invpdf .opt-tbl td{padding:9px 12px;border-bottom:1px solid var(--line);font-size:12px}
  .invpdf .opt-tbl tr:last-child td{border-bottom:0}
  .invpdf .opt-tbl td.r{text-align:right;white-space:nowrap;font-weight:600;font-variant-numeric:tabular-nums}
  .invpdf .opt-tbl .muted{color:var(--muted)}

  .invpdf .note{background:var(--soft);border-left:3px solid var(--pri);border-radius:0 8px 8px 0;
    padding:11px 16px;font-size:12px;color:var(--muted);margin-top:14px}
  .invpdf .note b{color:var(--ink)}

  .invpdf dl.mod div{display:grid;grid-template-columns:175px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)}
  .invpdf dl.mod div:last-child{border-bottom:0}
  .invpdf dl.mod dt{font-weight:700;font-size:12px}
  .invpdf dl.mod dd{color:var(--muted);font-size:12px}

  .invpdf .pay{margin-top:16px;border:1px solid var(--pri);background:#fff;border-radius:8px;padding:13px 16px}
  .invpdf .pay .lbl{font-size:11px;font-weight:700;color:var(--pri)}
  .invpdf .pay .num{font-size:14px;font-weight:800;margin-top:2px}
  .invpdf .pay .rib{font-size:12px;color:var(--ink);margin-top:8px}
  .invpdf .pay .rib b{color:var(--pri)}

  .invpdf .ech-bar{height:7px;border-radius:4px;background:#e5e7eb;overflow:hidden;margin:6px 0}
  .invpdf .ech-bar i{display:block;height:100%;background:var(--ink)}
  .invpdf .ech-legend{display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:8px}
  .invpdf .ech-legend .ok{color:var(--ok);font-weight:700}
  .invpdf .ech-legend .rest{color:var(--pri);font-weight:700}
  .invpdf .ech-row{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:6px;margin-bottom:5px;
    font-size:12px}
  .invpdf .ech-row.paid{background:#dcfce7}
  .invpdf .ech-row.wait{background:#fef3c7}
  .invpdf .ech-row .e-label{flex:1;font-weight:600}
  .invpdf .ech-row .e-date{color:var(--muted)}
  .invpdf .ech-row .e-stat{font-weight:700}
  .invpdf .ech-row.paid .e-stat{color:var(--ok)}
  .invpdf .ech-row.wait .e-stat{color:#b45309}
  .invpdf .ech-row .e-amt{width:90px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}

  .invpdf .sign{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin-top:16px}
  .invpdf .sign .b{border:1px solid var(--line);border-radius:8px;padding:11px 14px;min-height:96px}
  .invpdf .sign .b .role{font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:var(--pri);font-weight:700}
  .invpdf .sign .b .who{font-weight:700;margin-top:2px}
  .invpdf .sign .b .bag{font-size:11px;color:var(--muted);margin-top:2px}
  .invpdf .sign .b .ok{font-size:11px;color:var(--ok);font-weight:700;margin-top:12px}
  .invpdf .sign .b .ok small{display:block;color:var(--muted);font-weight:400;margin-top:2px}
  .invpdf .sign .b img.sig{max-width:100%;max-height:58px;margin-top:6px}

  .invpdf footer{margin-top:16px;padding-top:10px;border-top:1px solid var(--line);
    font-size:10.5px;color:var(--muted);text-align:center;line-height:1.6}

  .cgvpage{width:794px;background:#fff;color:#1b1f24;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  .cgvpage *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .cgvpage .cgv-head{background:${primary};color:#fff;padding:14px 46px;display:flex;
    justify-content:space-between;align-items:baseline}
  .cgvpage .cgv-head h2{font-size:16px;font-weight:800}
  .cgvpage .cgv-head .upd{font-size:11px;opacity:.85}
  .cgvpage .cgv-body{padding:24px 46px 40px;font-size:12px;line-height:1.55;color:#1b1f24}
  .cgvpage .cgv-h{font-size:13px;font-weight:700;margin:14px 0 5px}
  .cgvpage .cgv-p{margin:0 0 5px;text-align:justify}
  .cgvpage .cgv-ul{list-style:none;margin:0 0 7px;padding-left:6px}
  .cgvpage .cgv-ul li{margin-bottom:3px;display:flex;gap:7px;align-items:flex-start}
  .cgvpage .cgv-ul li .bul{flex:0 0 auto;color:${primary};line-height:inherit}
  .cgvpage .sp{height:6px}
  `;
}

// ─── Gabarit principal ──────────────────────────────────────────────────────────

export interface InvoiceHtmlAssets {
  logoDataUrl?: string | null;
  signatureDataUrl?: string | null;           // signature du CLIENT (apposée à la signature du devis)
  providerSignatureDataUrl?: string | null;   // signature du PRESTATAIRE (Société.signatureUrl)
}

export function buildInvoiceHtml(
  facture: Facture,
  company?: Company | null,
  assets: InvoiceHtmlAssets = {}
): { mainHtml: string; cgvHtml: string | null } {
  const isDevis = facture.type === "devis";
  const primary = company?.couleurPrimaire && hexToRgb(company.couleurPrimaire)
    ? company.couleurPrimaire
    : "#2563eb";
  const style = `<style>${buildStyle(primary)}</style>`;

  // ── Totaux ───────────────────────────────────────────────
  let grandTotal = 0, totalDiscount = 0, recurringYear1 = 0, recurringPerYear = 0, recurringMonthly = 0;
  for (const item of facture.items) {
    const gross = item.quantity * item.price;
    const net = itemNetTotal(item);
    grandTotal += net;
    totalDiscount += gross - net;
    if (item.recurrence === "mensuel") {
      recurringYear1 += net;
      const netMonthly = item.quantity ? net / item.quantity : net; // net par mois (remise incluse)
      recurringPerYear += netMonthly * 12;
      recurringMonthly += netMonthly;
    } else if (item.recurrence === "annuel") {
      recurringYear1 += net;
      recurringPerYear += net;
    }
  }
  const oneOff = grandTotal - recurringYear1;
  const hasDiscount = facture.items.some((i) => i.discountType && i.discountValue);
  const echeanceRef = facture.echeanceRef as EcheanceRef | undefined;
  const docDate = facture.date ?? facture.createdAt;

  // ── En-tête ──────────────────────────────────────────────
  const companyName = company?.nom ?? "Enezo";
  const mark = assets.logoDataUrl
    ? `<span class="mark has-img"><img src="${assets.logoDataUrl}" alt=""/></span>`
    : `<span class="mark">${esc((companyName[0] ?? "S").toUpperCase())}</span>`;
  // (Contact / SIRET / TVA déplacés dans la carte « Prestataire » ci-dessous.)
  const statusChip = (() => {
    let label: string, color: string;
    if (isDevis) {
      if (facture.status === "accepted") { label = "Accepté"; color = "#1f8a4c"; }
      else if (facture.status === "sent") { label = "Envoyé"; color = primary; }
      else if (facture.status === "rejected") { label = "Non validé"; color = "#b91c1c"; }
      else { label = "En attente"; color = "#6b7280"; }
    } else {
      if (facture.status === "paid") { label = "Payée"; color = "#1f8a4c"; }
      else if (facture.status === "encaissement") { label = "En cours d'encaissement"; color = "#6d28d9"; }
      else { label = "Impayée"; color = "#ea580c"; }
    }
    return `<div class="chip" style="background:${color}">${esc(label)}</div>`;
  })();

  // Méta (N°, date, validité) sur UNE ligne compacte, placée à gauche sous le logo :
  // l'en-tête est ainsi plus court → plus de chances que le détail + ses totaux tiennent
  // sur la même page. Le titre « Devis » + la pastille de statut restent à droite.
  const metaInline = [
    `N° <b>${esc(facture.number)}</b>`,
    `Date : <b>${fmtDate(docDate ?? null)}</b>`,
    isDevis ? `Validité : <b>${facture.validiteJours ?? 30} jours</b>` : "",
    !isDevis && facture.devisNumber ? `Réf. devis : <b>${esc(facture.devisNumber)}</b>` : "",
    // Réf. contrat = clé PARTAGÉE avec les autres documents (cahier des charges, contrats légaux) → fait le lien.
    facture.contratId ? `Réf : <b>${esc(facture.contratId.slice(0, 8))}</b>` : "",
  ].filter(Boolean).join(" &middot; ");

  const header = `
    <div class="head">
      <div class="brand">
        <span class="logo">${mark} ${esc(companyName)}</span>
        <div class="doc-meta-line">${metaInline}</div>
      </div>
      <div class="doc-meta">
        <h1>${isDevis ? "Devis" : "Facture"}</h1>
        ${statusChip}
      </div>
    </div>`;

  // ── Parties ──────────────────────────────────────────────
  const presAdresse = [
    company?.adresse,
    [company?.codePostal, company?.ville].filter(Boolean).join(" ").trim(),
  ].filter((x): x is string => !!x && !!x.trim()).map(esc).join(", ");
  const presLines = [
    company?.representant ? esc(company.representant) : "",
    presAdresse,
    [company?.email, company?.telephone].filter((x): x is string => !!x).map(esc).join(" · "),
    [company?.siret ? `SIRET ${company.siret}` : "", company?.tva ? `TVA ${company.tva}` : ""].filter((x): x is string => !!x).map(esc).join(" · "),
  ].filter(Boolean).join("<br/>");

  const clientNom = facture.factureNom || facture.clientName || "—";
  const cAdr = facture.factureAdresse || facture.clientAddress;
  const cCp = facture.factureCodePostal || facture.clientCodePostal;
  const cVille = facture.factureVille || facture.clientVille;
  const clientLines = [
    cAdr ? esc(cAdr) : "",
    [cCp, cVille].filter((x): x is string => !!x).map(esc).join(" "),
    [facture.factureEmail, facture.factureTelephone].filter((x): x is string => !!x).map(esc).join(" · "),
  ].filter(Boolean).join("<br/>");

  const parties = `
    <div class="parties">
      <div class="card">
        <div class="label">Prestataire</div>
        <div class="name">${esc(companyName)}</div>
        ${presLines ? `<div class="lines">${presLines}</div>` : ""}
      </div>
      <div class="card">
        <div class="label">${isDevis ? "Client" : "Facturé à"}</div>
        <div class="name">${esc(clientNom)}</div>
        ${clientLines ? `<div class="lines">${clientLines}</div>` : ""}
      </div>
    </div>`;

  // ── Sections numérotées ──────────────────────────────────
  let n = 0;
  const sec = (title: string, extra = "") =>
    `<h2 class="sec"><span class="n">${++n}</span> ${esc(title)}${extra ? ` <span class="extra">${extra}</span>` : ""}</h2>`;

  // Objet
  const objet = facture.objet
    ? `${sec("Objet du devis")}<p class="lead">${nl2br(facture.objet)}</p>`
    : "";

  // Tableau des lignes
  const tblHead = hasDiscount
    ? `<tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U.</th><th class="r">Remise</th><th class="r">Total</th></tr>`
    : `<tr><th>Désignation</th><th class="r">Qté</th><th class="r">P.U.</th><th class="r">Total</th></tr>`;
  const tblRows = facture.items.map((item) => {
    const net = itemNetTotal(item);
    const discCell = hasDiscount
      ? `<td class="r disc">${item.discountType && item.discountValue
          ? (item.discountType === "percent" ? `-${item.discountValue}%` : `-${fmt(item.discountValue)}`)
          : ""}</td>`
      : "";
    return `<tr>
      <td class="desc"><b>${esc(item.label || "—")}</b>${item.description ? `<small>${nl2br(item.description)}</small>` : ""}</td>
      <td class="r">${item.quantity}</td>
      <td class="r amt">${fmt(item.price)}${recLabel(item.recurrence)}</td>
      ${discCell}
      <td class="r amt">${fmt(net)}</td>
    </tr>`;
  }).join("");
  const table = `${sec("Détail de l'offre")}<table class="lines-tbl"><thead>${tblHead}</thead><tbody>${tblRows}</tbody></table>`;

  // Totaux
  const totalsRows: string[] = [];
  if (totalDiscount > 0) {
    totalsRows.push(`<div class="t-row"><span>Sous-total brut</span><span>${fmt(grandTotal + totalDiscount)}</span></div>`);
    totalsRows.push(`<div class="t-row disc-row"><span>Remises</span><span>-${fmt(totalDiscount)}</span></div>`);
  }
  if (!isDevis && echeanceRef) {
    const dejaRegle = echeanceRef.cumulPrecedent ?? (echeanceRef.count > 0 ? (grandTotal / echeanceRef.count) * echeanceRef.index : 0);
    const reste = grandTotal - dejaRegle - echeanceRef.montant;
    totalsRows.push(`<div class="t-row"><span>Montant total du marché</span><span>${fmt(grandTotal)}</span></div>`);
    totalsRows.push(`<div class="t-row grand"><span>Règlement actuel <small>(${echeanceRef.label} · ${echeanceRef.index + 1}/${echeanceRef.count})</small></span><span>${fmt(echeanceRef.montant)}</span></div>`);
    if (dejaRegle > 0) totalsRows.push(`<div class="t-row"><span>Déjà réglé précédemment</span><span>${fmt(dejaRegle)}</span></div>`);
    if (reste > 0.005) totalsRows.push(`<div class="t-row next"><span>Restera à régler ensuite</span><span>${fmt(reste)}</span></div>`);
  } else if (isDevis && recurringYear1 > 0) {
    if (oneOff > 0) totalsRows.push(`<div class="t-row"><span>Mise en service <small>(une seule fois)</small></span><span>${fmt(oneOff)}</span></div>`);
    // Valeur = total annuel (le client n'a pas à calculer), avec le détail /mois dans le libellé.
    if (recurringMonthly > 0) {
      totalsRows.push(`<div class="t-row"><span>Abonnement année 1 <small>(${fmt(recurringMonthly)}/mois × 12)</small></span><span>${fmt(recurringYear1)}</span></div>`);
    } else {
      totalsRows.push(`<div class="t-row"><span>Abonnement (année 1)</span><span>${fmt(recurringYear1)}</span></div>`);
    }
    totalsRows.push(`<div class="t-row grand"><span>Total année 1</span><span>${fmt(grandTotal)}</span></div>`);
    totalsRows.push(`<div class="t-row next"><span>Années suivantes <small>(abonnement seul)</small></span><span>${fmt(recurringPerYear)} / an</span></div>`);
  } else {
    totalsRows.push(`<div class="t-row grand"><span>Total</span><span>${fmt(grandTotal)}</span></div>`);
  }
  const totals = `<div class="totals"><div class="box">${totalsRows.join("")}</div></div>`;

  // Bandeau valeur (mis en avant juste sous les totaux)
  const vb = facture.valeurBanner;
  const valueBanner = vb && (vb.titre || vb.montant)
    ? `<div class="value">
        <div class="top">
          <div class="t">${esc(vb.titre ?? "")}${vb.sousTitre ? `<span>${esc(vb.sousTitre)}</span>` : ""}</div>
          ${vb.montant ? `<div class="fig">${esc(vb.montant)}${vb.mention ? `<small>${esc(vb.mention)}</small>` : ""}</div>` : ""}
        </div>
        ${(vb.texte || (vb.stats && vb.stats.length)) ? `<div class="body">
          ${vb.texte ? nl2br(vb.texte) : ""}
          ${vb.stats && vb.stats.length ? `<div class="stats">${vb.stats.map((s) => `<div><b>${esc(s.value)}</b>${esc(s.label)}</div>`).join("")}</div>` : ""}
        </div>` : ""}
      </div>`
    : "";

  const htNote = `<div class="note"><b>Montants en euros, nets de TVA.</b> TVA non applicable, article 293 B du CGI.</div>`;

  // Plan de règlement (présentation : à la mise en service → puis mensuel × 12). N'impacte pas la facturation.
  let payPlan = "";
  if (isDevis && recurringMonthly > 0) {
    const ppRows: string[] = [];
    if (oneOff > 0) ppRows.push(`<div class="pp-row"><span>À la mise en service</span><span>${fmt(oneOff)}</span></div>`);
    ppRows.push(`<div class="pp-row"><span>Puis, mensuellement (× 12)</span><span>${fmt(recurringMonthly)} / mois</span></div>`);
    ppRows.push(`<div class="pp-row total"><span>Total année 1</span><span>${fmt(grandTotal)}</span></div>`);
    payPlan = `<div class="payplan"><div class="pp-h">Plan de règlement</div>${ppRows.join("")}</div>`;
  }

  // Totaux + plan de règlement côte à côte : le plan occupe l'espace vide à gauche des
  // totaux (calés à droite). Sans plan (facture, ou devis sans abonnement) → totaux seuls.
  const sumBlock = payPlan ? `<div class="sumrow">${payPlan}${totals}</div>` : totals;

  // Référence de paiement (factures)
  let payRef = "";
  if (!isDevis) {
    const ribParts: string[] = [];
    if (company?.iban) ribParts.push(`<b>IBAN</b> ${esc(company.iban)}`);
    if (company?.bic) ribParts.push(`<b>BIC</b> ${esc(company.bic)}`);
    payRef = `<div class="pay">
      <div class="lbl">Référence à indiquer pour tout virement</div>
      <div class="num">${esc(facture.number)}</div>
      ${ribParts.length ? `<div class="rib">${ribParts.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>` : ""}
    </div>`;
  }

  // Échéancier : suivi de paiement (statuts payé/en attente) → uniquement sur une FACTURE.
  // Sur un devis, le « Plan de règlement » près des totaux suffit côté client ; les échéances
  // restent en base (non imprimées) pour la conversion en factures in-app.
  let echeancier = "";
  if (!isDevis && facture.echeances && facture.echeances.length > 0) {
    const paidTotal = facture.echeances.filter((e) => e.statut === "payé").reduce((s, e) => s + e.montant, 0);
    const pendingTotal = facture.echeances.filter((e) => e.statut !== "payé").reduce((s, e) => s + e.montant, 0);
    const progress = (!isDevis && grandTotal > 0)
      ? `<div class="ech-bar"><i style="width:${Math.min(100, (paidTotal / grandTotal) * 100).toFixed(1)}%"></i></div>
         <div class="ech-legend"><span class="ok">Reçu : ${fmt(paidTotal)}</span><span class="rest">Restant : ${fmt(pendingTotal)}</span></div>`
      : "";
    const rows = facture.echeances.map((e) => {
      const paid = e.statut === "payé";
      return `<div class="ech-row ${paid ? "paid" : "wait"}">
        <span class="e-label">${esc(e.label || fmtDate(e.date ?? null))}</span>
        <span class="e-date">${fmtDate(e.date ?? null)}</span>
        <span class="e-stat">${paid ? "Payé" : "En attente"}</span>
        <span class="e-amt">${fmt(e.montant)}</span>
      </div>`;
    }).join("");
    echeancier = `${sec("Échéancier de paiement")}${progress}${rows}`;
  }

  // Notes
  const notes = facture.notes
    ? `${sec("Notes")}<p class="lead">${nl2br(facture.notes)}</p>`
    : "";

  // Ce qui est inclus : panneaux titrés (2 colonnes) + checklist « modules livrés »
  const panels = (facture.inclusPanels ?? []).filter((p) => (p.titre ?? "").trim() || (p.items ?? []).some((i) => i.trim()));
  const checklist = (facture.inclus ?? []).filter((t) => t.trim());
  let inclus = "";
  if (panels.length || checklist.length) {
    let body = "";
    if (panels.length) {
      body += `<div class="twocol">${panels.map((p) =>
        `<div class="panel"><h3>${esc(p.titre)}</h3><ul>${(p.items ?? []).filter((i) => i.trim()).map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div>`
      ).join("")}</div>`;
    }
    if (checklist.length) {
      body += `${panels.length ? `<div class="subhead">Modules livrés</div>` : ""}<ul class="check">${checklist.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
    }
    inclus = `${sec("Ce qui est inclus")}${body}`;
  }

  // Options à la carte
  let options = "";
  if (facture.options && facture.options.length > 0) {
    const rows = facture.options.map((o) => {
      const price = o.prixMin != null && o.prixMax != null
        ? `${fmt(o.prixMin)} – ${fmt(o.prixMax)}`
        : o.prixMin != null ? fmt(o.prixMin) : "sur devis";
      return `<tr><td><b>${esc(o.label)}</b>${o.description ? ` <span class="muted">— ${esc(o.description)}</span>` : ""}</td><td class="r">${price}</td></tr>`;
    }).join("");
    options = `${sec("Options à la carte", "(hors devis — sur commande ultérieure)")}<table class="opt-tbl"><tbody>${rows}</tbody></table>`;
  }

  // Section « Évolution » (optionnelle : revente / white-label) — bloc structuré
  let evolution = "";
  const ev = facture.evolution;
  const evEtapes = (ev?.etapes ?? []).filter((e) => (e.titre ?? "").trim() || (e.description ?? "").trim());
  const evPanneaux = (ev?.panneaux ?? []).filter((p) => (p.titre ?? "").trim() || (p.items ?? []).some((i) => i.trim()));
  const evHasContent = !!ev && (!!ev.intro?.trim() || !!ev.qaQuestion?.trim() || evEtapes.length > 0 || evPanneaux.length > 0 || !!ev.tableau?.trim() || !!ev.note?.trim());
  if (ev && evHasContent) {
    const parts: string[] = [];
    if (ev.intro?.trim()) parts.push(`<p class="lead">${nl2br(ev.intro)}</p>`);
    if (ev.qaQuestion?.trim()) {
      parts.push(`<div class="fut-head"><div class="q">${esc(ev.qaQuestion)}${ev.qaDetail?.trim() ? `<span>${nl2br(ev.qaDetail)}</span>` : ""}</div>${ev.qaReponse?.trim() ? `<div class="a">${esc(ev.qaReponse)}</div>` : ""}</div>`);
    }
    for (const e of evEtapes) {
      parts.push(`<div class="fut-step"><div class="t"><b>${esc(e.titre)}</b>${e.description?.trim() ? `<small>${nl2br(e.description)}</small>` : ""}</div>${e.prix?.trim() ? `<div class="p">${esc(e.prix)}</div>` : ""}</div>`);
    }
    if (evPanneaux.length) {
      parts.push(`<div class="twocol">${evPanneaux.map((p) =>
        `<div class="panel">${p.reco ? `<div class="reco">★ Recommandé</div>` : ""}<h3>${esc(p.titre)}</h3><ul>${(p.items ?? []).filter((i) => i.trim()).map((i) => `<li>${esc(i)}</li>`).join("")}</ul>${p.prix?.trim() ? `<div class="price">${esc(p.prix)}</div>` : ""}</div>`
      ).join("")}</div>`);
    }
    if (ev.tableau?.trim()) {
      const lines = ev.tableau.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length) {
        const cells = (l: string) => l.split("|").map((c) => c.trim());
        const head = cells(lines[0]);
        const thead = `<tr>${head.map((c, i) => `<td class="${i === 0 ? "" : "r"}" style="font-weight:700;color:var(--ink)">${esc(c)}</td>`).join("")}</tr>`;
        const body = lines.slice(1).map((l) => `<tr>${cells(l).map((c, i) => `<td class="${i === 0 ? "" : "r"}">${esc(c)}</td>`).join("")}</tr>`).join("");
        parts.push(`<table class="opt-tbl"><tbody>${thead}${body}</tbody></table>`);
      }
    }
    if (ev.note?.trim()) parts.push(`<div class="note">${nl2br(ev.note)}</div>`);
    evolution = `${sec(ev.titre?.trim() || "Évolution possible", ev.tag?.trim() ? esc(ev.tag) : "")}${parts.join("")}`;
  }

  // Modalités
  const modalites = facture.modalites && facture.modalites.length > 0
    ? `${sec("Modalités")}<dl class="mod">${facture.modalites.map((m) => `<div><dt>${esc(m.label)}</dt><dd>${nl2br(m.value)}</dd></div>`).join("")}</dl>`
    : "";

  // Signature (devis)
  let sign = "";
  if (isDevis) {
    // Côté PRESTATAIRE : la signature de la société (si configurée) — JAMAIS « Bon pour accord » (c'est l'engagement du client).
    const providerSig = assets.providerSignatureDataUrl
      ? `<img class="sig" src="${assets.providerSignatureDataUrl}" alt=""/><div class="bag">Établi le ${fmtDate(docDate ?? null)}</div>`
      : `<div class="bag">Établi le ${fmtDate(docDate ?? null)}</div>`;
    // Côté CLIENT : c'est ICI qu'on trouve « Bon pour accord » + la signature une fois le devis signé.
    const clientSig = facture.signed
      ? (assets.signatureDataUrl
          ? `<img class="sig" src="${assets.signatureDataUrl}" alt=""/><div class="ok">Bon pour accord${facture.signedAt ? `<small>Signé le ${fmtDate(facture.signedAt)}</small>` : ""}</div>`
          : `<div class="ok">Bon pour accord — signé électroniquement${facture.signedAt ? `<small>le ${fmtDate(facture.signedAt)}</small>` : ""}</div>`)
      : `<div class="bag">« Bon pour accord » — date &amp; signature</div>`;
    sign = `<div class="sign">
      <div class="b">
        <div class="role">Le prestataire</div>
        <div class="who">${esc(companyName)}</div>
        ${providerSig}
      </div>
      <div class="b">
        <div class="role">Le client</div>
        <div class="who">${esc(clientNom)}</div>
        ${clientSig}
      </div>
    </div>`;
  }

  // Pied de page
  const footerRib = [company?.iban ? `IBAN ${esc(company.iban)}` : "", company?.bic ? `BIC ${esc(company.bic)}` : ""].filter(Boolean).join(" · ");
  const cgvDateFmt = company?.cgvDate
    ? new Date(company.cgvDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  // Mentions légales du pied : on retire la mention TVA/293 B (déjà affichée dans la
  // note sous les totaux) pour éviter le doublon. La date des CGV n'est pas répétée
  // ici (elle figure déjà sur la page CGV).
  const footerMentions = (company?.mentionsLegales ?? "")
    .split(/\n/)
    .filter((l) => !/tva non applicable|293\s*b/i.test(l))
    .join("\n")
    .trim();
  // Pied de page volontairement compact : pour un devis, le N° / la date / la validité sont déjà
  // affichés en tête du document → on ne les répète PAS ici (on garde juste la mention contractuelle).
  const footer = `<footer>
    ${esc(companyName)}${footerRib ? ` · ${footerRib}` : ""}${isDevis ? " · Document contractuel après signature." : `<br/>Facture N° ${esc(facture.number)} · ${fmtDate(docDate ?? null)}`}
    ${footerMentions ? `<br/>${nl2br(footerMentions)}` : ""}
  </footer>`;

  const mainHtml = `${style}<div class="invpdf">
    ${header}
    ${parties}
    ${objet}
    ${table}
    ${sumBlock}
    ${valueBanner}
    ${htNote}
    ${payRef}
    ${echeancier}
    ${notes}
    ${inclus}
    ${options}
    ${evolution}
    ${modalites}
    ${sign}
    ${footer}
  </div>`;

  // ── Page CGV ─────────────────────────────────────────────
  let cgvHtml: string | null = null;
  if (company?.cgv) {
    cgvHtml = `${style}<div class="cgvpage">
      <div class="cgv-head"><h2>Conditions Générales de Vente</h2>${cgvDateFmt ? `<span class="upd">Mise à jour le ${cgvDateFmt}</span>` : ""}</div>
      <div class="cgv-body">${cgvToHtml(company.cgv)}</div>
    </div>`;
  }

  return { mainHtml, cgvHtml };
}
