"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { STATUT_AIDE } from "@/lib/mailingModel";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { MailingLogiciel, Prospect, ProspectStatut } from "@/types";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

/**
 * Saisie de l'observation qui accompagne un changement de statut (ou une note
 * simple). C'est le champ qui a le plus de valeur dans le journal : « pas
 * intéressé » sans raison ne t'apprend rien six mois plus tard.
 */
export default function StatutModal({
  prospect, statutCible, labels, logiciels, onAjouterLogiciel, onSupprimerLogiciel,
  onValider, onClose,
}: {
  prospect: Prospect;
  /** Absent = note libre sans changement de statut. */
  statutCible?: ProspectStatut;
  labels: Record<ProspectStatut, string>;
  logiciels: MailingLogiciel[];
  onAjouterLogiciel: (nom: string) => Promise<void>;
  onSupprimerLogiciel: (id: string) => Promise<void>;
  onValider: (observations: string, logiciel: string) => Promise<void>;
  onClose: () => void;
}) {
  const [observations, setObservations] = useState("");
  const [logiciel, setLogiciel] = useState(prospect.logicielActuel ?? "");
  const [nouveau, setNouveau] = useState("");
  const [enCours, setEnCours] = useState(false);

  const nouveauValide =
    nouveau.trim().length >= 2 &&
    !logiciels.some((l) => l.nom.trim().toLowerCase() === nouveau.trim().toLowerCase());

  const ajouter = async () => {
    if (!nouveauValide) return;
    const nom = nouveau.trim();
    await onAjouterLogiciel(nom);
    setLogiciel(nom);   // le logiciel qu'on vient d'ajouter est celui du prospect
    setNouveau("");
  };

  const valider = async () => {
    setEnCours(true);
    try {
      await onValider(observations.trim(), logiciel.trim());
      onClose();
    } finally {
      setEnCours(false);
    }
  };

  const opposition = statutCible === "oppose" || statutCible === "bounce";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={statutCible ? "Changer le statut" : "Ajouter une note"}
      size="sm"
    >
      <div className="text-sm text-gray-600 mb-3">
        <strong>{prospect.societe}</strong>
        {statutCible && (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {labels[prospect.statut]}
            </span>
            <span className="text-gray-400">→</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {labels[statutCible]}
            </span>
          </div>
        )}
      </div>

      {statutCible && (
        <p className="text-[11px] text-gray-500 mb-3 -mt-1">{STATUT_AIDE[statutCible]}</p>
      )}

      {statutCible === "a_un_logiciel" && (
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Quel logiciel ? <span className="text-gray-400">(très utile)</span>
          </label>

          {logiciels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {logiciels.map((l) => {
                const actif = logiciel.trim().toLowerCase() === l.nom.toLowerCase();
                return (
                  <span
                    key={l.id}
                    className={`inline-flex items-center rounded-lg text-xs font-medium transition ${
                      actif ? "bg-blue-600 text-white" : "border text-gray-700"
                    }`}
                  >
                    <button
                      onClick={() => setLogiciel(actif ? "" : l.nom)}
                      className="pl-2.5 py-1.5 hover:opacity-80"
                    >
                      {l.nom}
                    </button>
                    <button
                      onClick={() => onSupprimerLogiciel(l.id)}
                      title="Retirer du référentiel"
                      className={`px-1.5 py-1.5 rounded-r-lg ${
                        actif ? "hover:bg-blue-700" : "hover:bg-red-50 hover:text-red-600"
                      }`}
                    >
                      <XMarkIcon className="w-3.5 h-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
              placeholder="Ajouter : Batappli, EBP, Excel partagé…"
              className={inputCls}
            />
            <button
              onClick={ajouter}
              disabled={!nouveauValide}
              className="shrink-0 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ajouter
            </button>
          </div>
          {nouveau.trim() && !nouveauValide && (
            <p className="text-[11px] text-amber-700 mt-1">Ce logiciel est déjà dans la liste.</p>
          )}
          <p className="text-[11px] text-gray-500 mt-1.5">
            Une liste fermée plutôt qu&apos;une saisie libre : sans elle, « Batappli » et
            « batappli » compteraient comme deux outils et fausseraient tes statistiques.
            Retirer un logiciel d&apos;ici ne l&apos;efface pas des prospects qui le mentionnent.
          </p>
        </div>
      )}

      <label className="block text-xs font-medium text-gray-600 mb-1">
        Observations {statutCible && <span className="text-gray-400">(facultatif)</span>}
      </label>
      <AutoTextarea
        value={observations}
        onChange={setObservations}
        minRows={3}
        placeholder="ex. rappelle en septembre · déjà équipé chez un concurrent · a demandé une démo"
        className={inputCls}
      />

      {opposition && (
        <p className="text-xs text-amber-700 mt-2">
          Cette adresse rejoindra le registre d&apos;opposition : elle ne pourra plus jamais être
          recontactée, ni réimportée.
        </p>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
          Annuler
        </button>
        <button
          onClick={valider}
          disabled={enCours || (!statutCible && !observations.trim())}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </Modal>
  );
}
