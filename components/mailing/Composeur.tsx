"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { copyText } from "@/lib/clipboard";
import { enregistrerEnvoi } from "@/lib/mailingService";
import {
  MIN_PERSONNALISATION, QUOTA_JOUR, STATUT_LABEL, STATUT_STYLE, doublonSociete, peutContacter,
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
  const [metierId, setMetierId] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  /** File d'envoi : ids figés au lancement, parcourus un par un. */
  const [file, setFile] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [perso, setPerso] = useState("");
  const [copie, setCopie] = useState(false);
  const [brochureEnCours, setBrochureEnCours] = useState(false);
  const [filtre, setFiltre] = useState<"tous" | "jamais" | "relance">("tous");
  const [recherche, setRecherche] = useState("");

  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );

  const metier = metiers.find((m) => m.id === metierId) ?? null;

  /** Contactables du kit choisi : un envoi groupé n'a de sens qu'à métier constant. */
  const eligibles = useMemo(
    () =>
      prospects
        .filter((p) => (metierId ? p.metierId === metierId : false))
        .filter((p) => peutContacter(p, optouts).ok)
        .sort((a, b) => a.societe.localeCompare(b.societe)),
    [prospects, metierId, optouts],
  );

  const affiches = useMemo(
    () =>
      eligibles.filter((p) => {
        const dejaContacte = (p.nbEnvois ?? 0) > 0;
        if (filtre === "jamais" && dejaContacte) return false;
        if (filtre === "relance" && !dejaContacte) return false;
        const q = recherche.trim().toLowerCase();
        if (q && !`${p.societe} ${p.email} ${p.ville ?? ""}`.toLowerCase().includes(q)) return false;
        return true;
      }),
    [eligibles, filtre, recherche],
  );

  const enFile = file.length > 0;
  const prospect = enFile ? prospects.find((p) => p.id === file[index]) ?? null : null;

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
  const pret = !!ctx && sectionsOk && !!blocage?.ok && !quotaAtteint;

  const basculer = (id: string) => {
    const n = new Set(selection);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelection(n);
  };

  const lancerFile = () => {
    const ids = eligibles.filter((p) => selection.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    setFile(ids);
    setIndex(0);
    setPerso("");
  };

  const suivant = () => {
    setPerso("");
    setCopie(false);
    if (index + 1 >= file.length) {
      setFile([]);
      setIndex(0);
      setSelection(new Set());
      onToast("File terminée.");
    } else {
      setIndex(index + 1);
    }
  };

  const copierEtOuvrir = async () => {
    if (!ctx || !prospect) return;
    // Le presse-papier riche préserve la mise en forme au collage ; `mailto:` ne
    // transporte que du texte et tronque les corps longs.
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
    // `assign()` plutôt qu'une affectation sur `location.href` : c'est équivalent,
    // mais la règle d'immutabilité du compilateur React interdit la seconde forme.
    window.location.assign(
      `mailto:${encodeURIComponent(prospect.email)}?subject=${encodeURIComponent(sujet)}`,
    );
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
        corpsHtml: html,          // figé : jamais recalculé depuis le kit
        personnalisation: perso.trim(),
        canal: "brouillon",
      },
      prospect,
    );
    suivant();
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

  /* ---------------------------------------------------------------- */
  /* Sélection                                                        */
  /* ---------------------------------------------------------------- */

  if (!enFile) {
    const restant = Math.max(0, QUOTA_JOUR - envoyesAujourdhui);
    const trop = selection.size > restant;
    // Aperçu du message tel qu'il partira : premier sélectionné, sinon premier
    // de la liste comme échantillon.
    const modele = eligibles.find((p) => selection.has(p.id)) ?? affiches[0] ?? null;
    const ctxModele = modele && metier && origin
      ? { metier, prospect: modele, personnalisation: "", origin }
      : null;

    return (
      <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="space-y-3">
        <div className="border rounded-xl bg-white p-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Kit métier</label>
          <select
            value={metierId}
            onChange={(e) => { setMetierId(e.target.value); setSelection(new Set()); }}
            className={inputCls}
          >
            <option value="">— Choisir un métier —</option>
            {metiers.map((m) => (
              <option key={m.id} value={m.id}>{m.metier}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-500 mt-1">
            Les envois se préparent par métier : le message vient du kit, il doit être le même
            pour toute la sélection.
          </p>
        </div>

        {metier && !sectionsOk && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Ce kit n&apos;a aucun thème affiché avec une accroche mail. Complète-le dans « Kits métier ».
          </div>
        )}

        {metierId && (
          <div className="border rounded-xl bg-white overflow-hidden">
            <div className="px-4 py-2.5 border-b space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-medium">
                  {affiches.length} affiché{affiches.length > 1 ? "s" : ""}
                  <span className="text-gray-400 font-normal"> sur {eligibles.length} contactables</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelection(new Set(affiches.slice(0, restant).map((p) => p.id)))}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Tout cocher (max {restant})
                  </button>
                  <button
                    onClick={() => setSelection(new Set())}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Vider
                  </button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher…"
                  className="flex-1 min-w-40 border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition"
                />
                {([
                  { k: "tous", l: "Tous" },
                  { k: "jamais", l: "Jamais contactés" },
                  { k: "relance", l: "À relancer" },
                ] as const).map((f) => (
                  <button
                    key={f.k}
                    onClick={() => setFiltre(f.k)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      filtre === f.k ? "bg-blue-600 text-white" : "border hover:bg-gray-50 text-gray-600"
                    }`}
                  >
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {affiches.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                {eligibles.length === 0
                  ? "Aucun prospect contactable pour ce métier — délai de relance non écoulé, quota épuisé, ou liste vide."
                  : "Aucun résultat avec ces filtres."}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y">
                {affiches.map((p) => {
                  const nb = p.nbEnvois ?? 0;
                  return (
                    <label key={p.id} className="flex items-start gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selection.has(p.id)}
                        onChange={() => basculer(p.id)}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{p.societe}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUT_STYLE[p.statut]}`}>
                            {STATUT_LABEL[p.statut]}
                          </span>
                          {nb > 0 ? (
                            <span
                              className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700"
                              title={`Dernier envoi le ${p.dernierEnvoiAt?.toDate().toLocaleDateString("fr-FR")}`}
                            >
                              {nb} envoi{nb > 1 ? "s" : ""} · relance
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700">
                              jamais contacté
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-500 truncate">
                          {p.email}
                          {p.ville ? ` · ${p.ville}` : ""}
                          {p.dernierEnvoiAt
                            ? ` · dernier envoi ${p.dernierEnvoiAt.toDate().toLocaleDateString("fr-FR")}`
                            : ""}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {trop && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Il ne reste que {restant} envoi(s) avant le plafond quotidien de {QUOTA_JOUR}.
            Réduis la sélection, ou termine demain.
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={telechargerBrochure}
            disabled={!metier || brochureEnCours}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
          >
            {brochureEnCours ? "Génération…" : "Brochure (PDF)"}
          </button>
          <button
            onClick={lancerFile}
            disabled={selection.size === 0 || quotaAtteint || !sectionsOk}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Préparer {selection.size || ""} envoi{selection.size > 1 ? "s" : ""}
          </button>
        </div>
      </div>

        <div className="border rounded-xl bg-white overflow-hidden flex flex-col lg:sticky lg:top-4">
          <div className="px-4 py-2.5 border-b">
            <div className="text-xs text-gray-500">
              Aperçu {modele ? `— ${modele.societe}` : ""}
            </div>
            <div className="text-sm font-medium truncate">
              {modele && metier ? sujetMail(metier, modele) : "Choisis un métier"}
            </div>
          </div>
          {ctxModele ? (
            <>
              <iframe
                title="Aperçu du mail"
                srcDoc={renderMailHtml(ctxModele)}
                className="w-full flex-1 min-h-[28rem] bg-white"
                sandbox=""
              />
              <div className="px-4 py-2 border-t text-[11px] text-gray-500">
                Aperçu sans personnalisation — tu l&apos;ajouteras prospect par prospect.
              </div>
            </>
          ) : (
            <div className="px-4 py-16 text-center text-sm text-gray-500">
              Sélectionne un kit métier pour voir le message.
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* File d'envoi                                                     */
  /* ---------------------------------------------------------------- */

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="border rounded-xl bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-gray-500">
                Envoi {index + 1} sur {file.length}
              </div>
              <div className="text-base font-semibold">{prospect?.societe}</div>
              <div className="text-xs text-gray-500">{prospect?.email}</div>
            </div>
            <button
              onClick={() => { setFile([]); setIndex(0); }}
              className="text-xs text-gray-500 hover:underline shrink-0"
            >
              Quitter la file
            </button>
          </div>

          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${(index / file.length) * 100}%` }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Ligne de personnalisation <span className="text-gray-400">(recommandé)</span>
            </label>
            <AutoTextarea
              value={perso}
              onChange={setPerso}
              minRows={3}
              placeholder="Une phrase propre à cette entreprise : ce que tu as vu sur leur site, un chantier, une actualité…"
              className={inputCls}
            />
            <div className="flex justify-between text-[11px] mt-1">
              <span className="text-gray-500">
                Si tu ne peux rien écrire de spécifique, passe au suivant.
              </span>
              <span className={persoOk ? "text-green-600" : "text-gray-400"}>
                {perso.trim().length}/{MIN_PERSONNALISATION}
              </span>
            </div>
          </div>
        </div>

        {blocage && !blocage.ok && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">{blocage.raison}</div>
        )}
        {doublon && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Déjà contacté chez ce même employeur : <strong>{doublon.societe}</strong>.
          </div>
        )}
        {quotaAtteint && (
          <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
            Plafond quotidien atteint ({QUOTA_JOUR} envois). Reprends demain.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={copierEtOuvrir}
            disabled={!pret}
            className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copie ? "Copié ✓ — colle dans le brouillon" : "Copier et ouvrir le brouillon"}
          </button>
          <button
            onClick={marquerEnvoye}
            disabled={!pret}
            className="px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Envoyé — suivant
          </button>
          <button
            onClick={suivant}
            className="px-4 py-2.5 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
          >
            Passer
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          « Envoyé — suivant » archive le message tel qu&apos;il est parti et enchaîne.
          « Passer » ne consigne rien.
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
          <div className="px-4 py-16 text-center text-sm text-gray-500">Aperçu indisponible.</div>
        )}
      </div>
    </div>
  );
}
