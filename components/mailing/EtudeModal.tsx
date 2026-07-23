"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { construirePromptRecherche, parserFicheEtude } from "@/lib/mailingPrompt";
import { enregistrerEtude, majInfosProspect, definirPromptLance } from "@/lib/mailingService";
import type { Prospect } from "@/types";

const ANGLE_LABEL: Record<"surcharge" | "circulation" | "inconnu", string> = {
  surcharge: "Surcharge du dirigeant",
  circulation: "Circulation de l'information",
  inconnu: "Indéterminé",
};

/** Libellé lisible de l'état « a un logiciel ? » (true / false / inconnu). */
function logicielTexte(aLogiciel: boolean | undefined, nom?: string): string | null {
  if (aLogiciel === true) return `A un logiciel${nom ? ` : ${nom}` : ""}`;
  if (aLogiciel === false) return "Pas de logiciel";
  if (nom) return `Logiciel : ${nom}`; // fiches anciennes : nom sans le booléen
  return null;
}

/** Libellé de l'état « responsable administratif dédié ? ». */
function adminTexte(r: boolean | undefined): string | null {
  if (r === true) return "Responsable administratif dédié";
  if (r === false) return "Pas d'admin dédié (le dirigeant gère tout)";
  return null;
}

const SITE_LABEL: Record<"pro" | "bancal" | "aucun", string> = {
  pro: "Site propre et pro",
  bancal: "Site bancal / à refaire",
  aucun: "Pas de site",
};

const inputCls =
  "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";
const labelCls = "block text-xs font-medium text-gray-600 mb-1";

// « Étudier cette entreprise » — trois voies :
//  1. copier le prompt ;
//  2. coller la réponse IA (parse automatique) ;
//  3. saisir/corriger à la main (entreprise qu'on connaît déjà).
export default function EtudeModal({
  prospect,
  onClose,
  onToast,
}: {
  prospect: Prospect;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [onglet, setOnglet] = useState<"prompt" | "coller" | "manuel">("prompt");
  const [copie, setCopie] = useState(false);
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [promptLance, setPromptLance] = useState(!!prospect.promptLanceAt);

  // Saisie manuelle — pré-remplie avec ce qui est déjà connu.
  const [dirigeantM, setDirigeantM] = useState(prospect.dirigeant ?? "");
  const [groupeM, setGroupeM] = useState(prospect.groupe ?? "");
  const [logicielM, setLogicielM] = useState<"" | "oui" | "non">(
    prospect.aLogiciel === true ? "oui" : prospect.aLogiciel === false ? "non" : prospect.logicielActuel ? "oui" : "",
  );
  const [logicielNomM, setLogicielNomM] = useState(prospect.logicielActuel ?? "");
  const [adminM, setAdminM] = useState<"" | "oui" | "non">(
    prospect.responsableAdmin === true ? "oui" : prospect.responsableAdmin === false ? "non" : "",
  );
  const [angleM, setAngleM] = useState<"" | "surcharge" | "circulation" | "inconnu">(prospect.angle ?? "");
  const [effectifReelM, setEffectifReelM] = useState(prospect.effectifReel ?? "");
  const [devM, setDevM] = useState<"" | "oui" | "non">(
    prospect.enDeveloppement === true ? "oui" : prospect.enDeveloppement === false ? "non" : "",
  );
  const [siteM, setSiteM] = useState<"" | "pro" | "bancal" | "aucun">(prospect.siteEtat ?? "");
  const [resumeM, setResumeM] = useState(prospect.etudeResume ?? "");

  const prompt = construirePromptRecherche(prospect);
  const fiche = useMemo(() => parserFicheEtude(texte), [texte]);
  const dejaEtudie = !!(
    prospect.etudeAt || prospect.dirigeant || prospect.personnalisation ||
    prospect.etudeResume || prospect.aLogiciel !== undefined
  );

  const marquerLance = async (lance: boolean) => {
    setPromptLance(lance);
    try {
      await definirPromptLance(prospect.id, lance);
    } catch {
      setPromptLance(!lance);
      onToast("Le marquage n'a pas pu être enregistré.");
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopie(true);
      onToast("Prompt copié — colle-le dans ton assistant IA.");
      if (!promptLance) void marquerLance(true);
    } catch {
      onToast("Copie impossible : sélectionne le texte à la main.");
    }
  };

  const enregistrer = async () => {
    if (!fiche) return;
    setEnCours(true);
    try {
      await enregistrerEtude(prospect, fiche);
      onToast("Fiche mise à jour depuis l'étude.");
      onClose();
    } catch {
      onToast("Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  };

  const enregistrerManuel = async () => {
    setEnCours(true);
    try {
      await majInfosProspect(prospect, {
        dirigeant: dirigeantM.trim() || null,
        groupe: groupeM.trim() || null,
        angle: angleM || null,
        etudeResume: resumeM.trim() || null,
        aLogiciel: logicielM === "oui" ? true : logicielM === "non" ? false : null,
        logicielActuel: logicielM === "oui" ? logicielNomM.trim() || null : null,
        responsableAdmin: adminM === "oui" ? true : adminM === "non" ? false : null,
        effectifReel: effectifReelM.trim() || null,
        enDeveloppement: devM === "oui" ? true : devM === "non" ? false : null,
        siteEtat: siteM || null,
      });
      onToast("Infos enregistrées sur la fiche.");
      onClose();
    } catch {
      onToast("Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  };

  const ongletCls = (actif: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
      actif ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
    }`;

  const logDeja = logicielTexte(prospect.aLogiciel, prospect.logicielActuel);
  const logFiche = fiche ? logicielTexte(fiche.aLogiciel, fiche.logicielActuel) : null;
  const adminDeja = adminTexte(prospect.responsableAdmin);
  const adminFiche = fiche ? adminTexte(fiche.responsableAdmin) : null;

  return (
    <Modal isOpen onClose={onClose} title={`Étudier ${prospect.societe}`} size="lg">
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button className={ongletCls(onglet === "prompt")} onClick={() => setOnglet("prompt")}>
            1 · Copier le prompt
          </button>
          <button className={ongletCls(onglet === "coller")} onClick={() => setOnglet("coller")}>
            2 · Coller le résultat
          </button>
          <button className={ongletCls(onglet === "manuel")} onClick={() => setOnglet("manuel")}>
            ✎ Saisie manuelle
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={promptLance} onChange={(e) => marquerLance(e.target.checked)} />
          J&apos;ai déjà lancé un prompt sur cette entreprise
          {prospect.promptLanceAt && (
            <span className="text-gray-400">
              (le {prospect.promptLanceAt.toDate().toLocaleDateString("fr-FR")})
            </span>
          )}
        </label>

        {dejaEtudie && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800 space-y-0.5">
            <div className="font-medium">Déjà connu — ce qui est enregistré :</div>
            {prospect.dirigeant && <div>👤 Dirigeant : {prospect.dirigeant}</div>}
            {prospect.groupe && <div>👥 Groupe : {prospect.groupe}</div>}
            {prospect.personnalisation && <div>✍ {prospect.personnalisation}</div>}
            {prospect.angle && <div>🎯 Angle : {ANGLE_LABEL[prospect.angle]}</div>}
            {logDeja && <div>🧩 {logDeja}</div>}
            {adminDeja && <div>🗂️ {adminDeja}</div>}
            {prospect.effectifReel && <div>👷 {prospect.effectifReel} salariés (réel)</div>}
            {prospect.enDeveloppement === true && <div>📈 En développement</div>}
            {prospect.siteEtat && <div>🌐 {SITE_LABEL[prospect.siteEtat]}</div>}
            {prospect.etudeResume && (
              <div className="whitespace-pre-wrap text-emerald-700">{prospect.etudeResume}</div>
            )}
          </div>
        )}

        {onglet === "prompt" && (
          <>
            <p className="text-xs text-gray-500">
              Copie ce prompt dans ton assistant IA (ChatGPT, Claude…). Il te renseigne sur
              l&apos;entreprise ET finit par un bloc récapitulatif que tu colleras dans
              l&apos;onglet 2 pour remplir la fiche automatiquement.
            </p>
            <textarea
              readOnly
              value={prompt}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full h-64 border rounded-lg px-3 py-2 text-xs font-mono leading-relaxed outline-none focus:border-blue-400 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
                Fermer
              </button>
              <button
                onClick={copier}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                {copie ? "Copié ✓" : "Copier le prompt"}
              </button>
            </div>
          </>
        )}

        {onglet === "coller" && (
          <>
            <p className="text-xs text-gray-500">
              Colle ici la réponse de l&apos;IA (le bloc <code>===ENEZO-FICHE===</code> suffit,
              mais tu peux coller toute la réponse). Vérifie l&apos;aperçu, puis enregistre.
            </p>
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Colle la réponse de l'assistant IA ici…"
              className="w-full h-40 border rounded-lg px-3 py-2 text-xs font-mono leading-relaxed outline-none focus:border-blue-400 resize-none"
            />

            {texte.trim() && !fiche && (
              <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
                Rien de reconnu. Vérifie que le bloc récapitulatif (entre
                <code> ===ENEZO-FICHE=== </code> et <code> ===FIN-FICHE=== </code>) est bien présent.
              </div>
            )}

            {fiche && (
              <div className="rounded-lg border px-3 py-2 text-xs space-y-1 bg-gray-50">
                <div className="font-medium text-gray-700">Aperçu — sera enregistré sur la fiche :</div>
                {fiche.dirigeant && (
                  <div><span className="text-gray-400">Dirigeant :</span> {fiche.dirigeant}</div>
                )}
                {fiche.groupe && (
                  <div><span className="text-gray-400">Groupe :</span> {fiche.groupe}</div>
                )}
                {fiche.personnalisation && (
                  <div><span className="text-gray-400">Personnalisation :</span> {fiche.personnalisation}</div>
                )}
                {fiche.angle && (
                  <div><span className="text-gray-400">Angle :</span> {ANGLE_LABEL[fiche.angle]}</div>
                )}
                {logFiche && (
                  <div><span className="text-gray-400">Logiciel :</span> {logFiche}</div>
                )}
                {adminFiche && (
                  <div><span className="text-gray-400">Admin :</span> {adminFiche}</div>
                )}
                {fiche.effectifReel && (
                  <div><span className="text-gray-400">Effectif réel :</span> {fiche.effectifReel}</div>
                )}
                {fiche.enDeveloppement === true && (
                  <div><span className="text-gray-400">Développement :</span> en croissance</div>
                )}
                {fiche.siteEtat && (
                  <div><span className="text-gray-400">Site :</span> {SITE_LABEL[fiche.siteEtat]}</div>
                )}
                {fiche.etudeResume && (
                  <div className="whitespace-pre-wrap">
                    <span className="text-gray-400">Fiche :</span> {fiche.etudeResume}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={enregistrer}
                disabled={!fiche || enCours}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enCours ? "Enregistrement…" : "Enregistrer sur la fiche"}
              </button>
            </div>
          </>
        )}

        {onglet === "manuel" && (
          <>
            <p className="text-xs text-gray-500">
              Pour une entreprise que tu connais déjà : renseigne à la main ce que tu sais.
              Laisse vide ce que tu ignores.
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Dirigeant</label>
                <input
                  value={dirigeantM}
                  onChange={(e) => setDirigeantM(e.target.value)}
                  placeholder="Nom de la personne"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Groupe / holding (si lié à d&apos;autres sociétés)</label>
                <input
                  value={groupeM}
                  onChange={(e) => setGroupeM(e.target.value)}
                  placeholder="Ex : Groupe BIBARD"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Angle du message</label>
                <select value={angleM} onChange={(e) => setAngleM(e.target.value as typeof angleM)} className={inputCls}>
                  <option value="">— Non défini —</option>
                  <option value="surcharge">Surcharge du dirigeant</option>
                  <option value="circulation">Circulation de l&apos;information</option>
                  <option value="inconnu">Indéterminé</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Logiciel de gestion ?</label>
                <select
                  value={logicielM}
                  onChange={(e) => setLogicielM(e.target.value as typeof logicielM)}
                  className={inputCls}
                >
                  <option value="">On ne sait pas</option>
                  <option value="oui">Oui, il en a un</option>
                  <option value="non">Non, pas de logiciel</option>
                </select>
              </div>
              {logicielM === "oui" && (
                <div>
                  <label className={labelCls}>Nom du logiciel (optionnel)</label>
                  <input
                    value={logicielNomM}
                    onChange={(e) => setLogicielNomM(e.target.value)}
                    placeholder="Ex : Batappli"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Responsable administratif dédié ?</label>
                <select value={adminM} onChange={(e) => setAdminM(e.target.value as typeof adminM)} className={inputCls}>
                  <option value="">On ne sait pas</option>
                  <option value="oui">Oui, une personne dédiée</option>
                  <option value="non">Non, le dirigeant gère tout</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>En développement ?</label>
                <select value={devM} onChange={(e) => setDevM(e.target.value as typeof devM)} className={inputCls}>
                  <option value="">On ne sait pas</option>
                  <option value="oui">Oui (recrutement, CA↑, rachat récent…)</option>
                  <option value="non">Non, rien de notable</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nombre de salariés réel</label>
                <input
                  value={effectifReelM}
                  onChange={(e) => setEffectifReelM(e.target.value)}
                  placeholder="Ex : 8"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>État du site web</label>
                <select value={siteM} onChange={(e) => setSiteM(e.target.value as typeof siteM)} className={inputCls}>
                  <option value="">On ne sait pas</option>
                  <option value="pro">Propre et pro</option>
                  <option value="bancal">Bancal / à refaire</option>
                  <option value="aucun">Pas de site</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Infos / fiche (effectif réel, organisation, notes…)</label>
              <textarea
                value={resumeM}
                onChange={(e) => setResumeM(e.target.value)}
                placeholder="Ex : 12 personnes, 8 sur le terrain. Le patron gère les devis le soir…"
                className="w-full h-28 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
                Annuler
              </button>
              <button
                onClick={enregistrerManuel}
                disabled={enCours}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enCours ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
