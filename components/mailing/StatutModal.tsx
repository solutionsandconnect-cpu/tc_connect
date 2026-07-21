"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { STATUT_AIDE } from "@/lib/mailingModel";
import type { Prospect, ProspectStatut } from "@/types";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

/**
 * Saisie de l'observation qui accompagne un changement de statut (ou une note
 * simple). C'est le champ qui a le plus de valeur dans le journal : « pas
 * intéressé » sans raison ne t'apprend rien six mois plus tard.
 */
export default function StatutModal({
  prospect, statutCible, labels, onValider, onClose,
}: {
  prospect: Prospect;
  /** Absent = note libre sans changement de statut. */
  statutCible?: ProspectStatut;
  labels: Record<ProspectStatut, string>;
  onValider: (observations: string, logiciel: string) => Promise<void>;
  onClose: () => void;
}) {
  const [observations, setObservations] = useState("");
  const [logiciel, setLogiciel] = useState(prospect.logicielActuel ?? "");
  const [enCours, setEnCours] = useState(false);

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
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Quel logiciel ? <span className="text-gray-400">(très utile)</span>
          </label>
          <input
            value={logiciel}
            onChange={(e) => setLogiciel(e.target.value)}
            placeholder="ex. Batappli, EBP, Excel partagé, un AppSheet maison…"
            className={inputCls}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Savoir ce qu&apos;ils utilisent te dit contre quoi tu te positionnes — et lesquels
            valent la peine d&apos;être revus.
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
