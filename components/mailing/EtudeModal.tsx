"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { construirePromptRecherche, parserFicheEtude } from "@/lib/mailingPrompt";
import { enregistrerEtude, definirPromptLance } from "@/lib/mailingService";
import type { Prospect } from "@/types";

const ANGLE_LABEL: Record<"surcharge" | "circulation" | "inconnu", string> = {
  surcharge: "Surcharge du dirigeant",
  circulation: "Circulation de l'information",
  inconnu: "Indéterminé",
};

// « Étudier cette entreprise » — aller-retour avec un assistant IA :
//  1. on copie le prompt ;
//  2. on colle la réponse : l'app extrait le bloc récapitulatif et remplit la fiche.
export default function EtudeModal({
  prospect,
  onClose,
  onToast,
}: {
  prospect: Prospect;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [onglet, setOnglet] = useState<"prompt" | "coller">("prompt");
  const [copie, setCopie] = useState(false);
  const [texte, setTexte] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [promptLance, setPromptLance] = useState(!!prospect.promptLanceAt);

  const prompt = construirePromptRecherche(prospect);
  const fiche = useMemo(() => parserFicheEtude(texte), [texte]);
  const dejaEtudie = !!(prospect.etudeAt || prospect.personnalisation || prospect.etudeResume);

  // Marquer « prompt lancé » — optimiste côté UI, best-effort côté base.
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
      // Copier le prompt = le lancer : on coche tout seul (sans écraser un décochage manuel).
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

  const ongletCls = (actif: boolean) =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition ${
      actif ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
    }`;

  return (
    <Modal isOpen onClose={onClose} title={`Étudier ${prospect.societe}`} size="lg">
      <div className="space-y-3">
        <div className="flex gap-2">
          <button className={ongletCls(onglet === "prompt")} onClick={() => setOnglet("prompt")}>
            1 · Copier le prompt
          </button>
          <button className={ongletCls(onglet === "coller")} onClick={() => setOnglet("coller")}>
            2 · Coller le résultat
          </button>
        </div>

        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={promptLance}
            onChange={(e) => marquerLance(e.target.checked)}
          />
          J&apos;ai déjà lancé un prompt sur cette entreprise
          {prospect.promptLanceAt && (
            <span className="text-gray-400">
              (le {prospect.promptLanceAt.toDate().toLocaleDateString("fr-FR")})
            </span>
          )}
        </label>

        {dejaEtudie && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800 space-y-0.5">
            <div className="font-medium">Déjà étudié — ce qui est enregistré :</div>
            {prospect.personnalisation && <div>✍ {prospect.personnalisation}</div>}
            {prospect.angle && <div>🎯 Angle : {ANGLE_LABEL[prospect.angle]}</div>}
            {prospect.logicielActuel && <div>🧩 Logiciel : {prospect.logicielActuel}</div>}
            {prospect.etudeResume && (
              <div className="whitespace-pre-wrap text-emerald-700">{prospect.etudeResume}</div>
            )}
          </div>
        )}

        {onglet === "prompt" ? (
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
        ) : (
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
                {fiche.personnalisation && (
                  <div><span className="text-gray-400">Personnalisation :</span> {fiche.personnalisation}</div>
                )}
                {fiche.angle && (
                  <div><span className="text-gray-400">Angle :</span> {ANGLE_LABEL[fiche.angle]}</div>
                )}
                {fiche.logicielActuel && (
                  <div><span className="text-gray-400">Logiciel :</span> {fiche.logicielActuel}</div>
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
      </div>
    </Modal>
  );
}
