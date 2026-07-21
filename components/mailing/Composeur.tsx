"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { copyText } from "@/lib/clipboard";
import { enregistrerEnvoi } from "@/lib/mailingService";
import {
  MIN_PERSONNALISATION, QUOTA_JOUR, doublonSociete, peutContacter,
} from "@/lib/mailingModel";
import { renderMailHtml, renderMailTexte, sujetMail } from "@/lib/mailingRender";
import { downloadBrochurePDF } from "@/lib/brochurePdf";
import type { MailingMetier, Prospect } from "@/types";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

export default function Composeur({
  userId, prospects, metiers, optouts, envoyesAujourdhui, onToast,
}: {
  userId: string;
  prospects: Prospect[];
  metiers: MailingMetier[];
  optouts: Set<string>;
  envoyesAujourdhui: number;
  onToast: (m: string) => void;
}) {
  const [prospectId, setProspectId] = useState("");
  const [metierManuel, setMetierManuel] = useState("");
  const [perso, setPerso] = useState("");
  const [copie, setCopie] = useState(false);
  const [brochureEnCours, setBrochureEnCours] = useState(false);

  // Valeur propre au navigateur : `useSyncExternalStore` fournit un instantané
  // serveur distinct, ce qui évite l'écart d'hydratation autant que le setState
  // dans un effet.
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const eligibles = useMemo(
    () =>
      prospects
        .filter((p) => peutContacter(p, optouts).ok)
        .sort((a, b) => a.societe.localeCompare(b.societe)),
    [prospects, optouts],
  );

  const prospect = prospects.find((p) => p.id === prospectId) ?? null;

  // Le kit suit le métier du prospect ; le choix manuel n'est qu'une surcharge.
  // Dérivé plutôt que synchronisé par un effet : une seule source de vérité.
  const metierId = metierManuel || prospect?.metierId || "";
  const metier = metiers.find((m) => m.id === metierId) ?? null;

  const blocage = prospect ? peutContacter(prospect, optouts) : null;
  const doublon = prospect ? doublonSociete(prospect, prospects) : null;
  const quotaAtteint = envoyesAujourdhui >= QUOTA_JOUR;
  const persoOk = perso.trim().length >= MIN_PERSONNALISATION;
  const sectionsOk = (metier?.sections ?? []).some((s) => s.afficher && s.problemeMail?.trim());

  const ctx = prospect && metier && origin
    ? { metier, prospect, personnalisation: perso, origin }
    : null;

  const html = ctx ? renderMailHtml(ctx) : "";
  const texte = ctx ? renderMailTexte(ctx) : "";
  const sujet = prospect && metier ? sujetMail(metier, prospect) : "";

  // La personnalisation reste fortement conseillée mais n'est plus bloquante.
  const pret = !!ctx && sectionsOk && !!blocage?.ok && !quotaAtteint;

  const copierEtOuvrir = async () => {
    if (!ctx || !prospect) return;
    // Le presse-papier riche préserve la mise en forme au collage dans la
    // messagerie ; `mailto:` ne transporte que du texte et tronque les corps longs.
    let ok = false;
    try {
      if (navigator.clipboard && "write" in navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([texte], { type: "text/plain" }),
          }),
        ]);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = await copyText(texte);

    setCopie(ok);
    setTimeout(() => setCopie(false), 2500);
    window.location.href = `mailto:${encodeURIComponent(prospect.email)}?subject=${encodeURIComponent(sujet)}`;
  };

  const telechargerBrochure = async () => {
    if (!metier || !origin) return;
    setBrochureEnCours(true);
    try {
      await downloadBrochurePDF(metier, origin);
    } catch {
      onToast("La brochure n'a pas pu être générée.");
    } finally {
      setBrochureEnCours(false);
    }
  };

  const marquerEnvoye = async () => {
    if (!ctx || !prospect || !metier) return;
    await enregistrerEnvoi(
      {
        userId,
        prospectId: prospect.id,
        societe: prospect.societe,
        metier: metier.metier,
        type: (prospect.nbEnvois ?? 0) > 0 ? "relance" : "initial",
        objet: sujet,
        corpsHtml: html,          // figé : ne sera jamais recalculé depuis le kit
        personnalisation: perso.trim(),
        canal: "brouillon",
      },
      prospect,
    );
    onToast("Envoi consigné — message archivé tel qu'il est parti.");
    setProspectId("");
    setPerso("");
    setMetierManuel("");
  };

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="border rounded-xl bg-white p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Prospect ({eligibles.length} contactable{eligibles.length > 1 ? "s" : ""})
            </label>
            <select
              value={prospectId}
              onChange={(e) => { setProspectId(e.target.value); setPerso(""); setMetierManuel(""); }}
              className={inputCls}
            >
              <option value="">— Choisir —</option>
              {eligibles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.societe} — {p.email}
                  {p.ville ? ` (${p.ville})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kit métier</label>
            <select
              value={metierId}
              onChange={(e) => setMetierManuel(e.target.value)}
              className={inputCls}
            >
              <option value="">— Choisir —</option>
              {metiers.map((m) => (
                <option key={m.id} value={m.id}>{m.metier}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ligne de personnalisation <span className="text-gray-400">(recommandé)</span>
            </label>
            <textarea
              value={perso}
              onChange={(e) => setPerso(e.target.value)}
              rows={3}
              placeholder="Une phrase propre à cette entreprise : ce que tu as vu sur leur site, un chantier, une actualité…"
              className={inputCls}
            />
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-gray-500">
                Si tu ne peux rien écrire de spécifique, l&apos;entreprise ne mérite pas le message.
              </span>
              <span className={persoOk ? "text-green-600" : "text-gray-400"}>
                {perso.trim().length}/{MIN_PERSONNALISATION}
              </span>
            </div>
          </div>
        </div>

        {(blocage && !blocage.ok) && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">{blocage.raison}</div>
        )}
        {doublon && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Déjà contacté chez ce même employeur : <strong>{doublon.societe}</strong> ({doublon.email}).
            Écrire à plusieurs personnes d&apos;une même boîte est le réflexe qui fait basculer une
            prospection en spam perçu.
          </div>
        )}
        {quotaAtteint && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Plafond quotidien atteint ({QUOTA_JOUR} envois). Reprends demain.
          </div>
        )}
        {metier && !sectionsOk && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Ce kit n&apos;a aucun thème affiché avec une accroche mail. Complète-le dans « Kits métier ».
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={copierEtOuvrir}
            disabled={!pret}
            className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copie ? "Copié ✓ — colle dans le brouillon" : "Copier le message et ouvrir le brouillon"}
          </button>
          <button
            onClick={telechargerBrochure}
            disabled={!metier || brochureEnCours}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
          >
            {brochureEnCours ? "Génération…" : "Télécharger la brochure (PDF)"}
          </button>
          <button
            onClick={marquerEnvoye}
            disabled={!pret}
            className="px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Marquer comme envoyé
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          Le message est copié en HTML : colle-le dans le brouillon qui s&apos;ouvre, relis, envoie —
          puis reviens marquer l&apos;envoi pour l&apos;archiver.
        </p>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden flex flex-col">
        <div className="px-4 py-2.5 border-b">
          <div className="text-xs text-gray-500">Objet</div>
          <div className="text-sm font-medium truncate">{sujet || "—"}</div>
        </div>
        {ctx ? (
          <iframe
            title="Aperçu du mail"
            srcDoc={html}
            className="w-full flex-1 min-h-[32rem] bg-white"
            sandbox=""
          />
        ) : (
          <div className="px-4 py-16 text-center text-sm text-gray-500">
            Choisis un prospect et un kit métier pour voir l&apos;aperçu.
          </div>
        )}
      </div>
    </div>
  );
}
