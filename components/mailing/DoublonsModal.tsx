"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { fusionnerProspects, ignorerDoublon } from "@/lib/mailingService";
import { fichePrincipale, trouverDoublons, type PaireDoublon } from "@/lib/mailingDoublons";
import { libelleEffectif } from "@/lib/sirene";
import { STATUT_LABEL } from "@/lib/mailingModel";
import type { Prospect } from "@/types";

/** Colonne d'une fiche : ce qu'elle apporte doit sauter aux yeux. */
function Fiche({ p, principale }: { p: Prospect; principale: boolean }) {
  const ligne = (label: string, valeur?: string | null) => (
    <div className="flex gap-2 text-[11px]">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className={valeur ? "text-gray-700 break-all" : "text-gray-300"}>{valeur || "—"}</span>
    </div>
  );
  return (
    <div
      className={`rounded-lg border p-2.5 space-y-1 ${
        principale ? "border-blue-300 bg-blue-50/40" : "border-gray-200"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-xs font-semibold truncate">{p.societe}</span>
        {principale && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white shrink-0">
            conservée
          </span>
        )}
      </div>
      {ligne("Email", p.email)}
      {ligne("Téléphone", p.telephone)}
      {ligne("Ville", [p.codePostal, p.ville].filter(Boolean).join(" "))}
      {ligne("Métier", p.metier)}
      {ligne("SIRET", p.siret ?? p.siren)}
      {ligne("Effectif", p.effectifCode ? libelleEffectif(p.effectifCode) : "")}
      {ligne("Statut", STATUT_LABEL[p.statut])}
      {ligne("Envois", p.nbEnvois ? String(p.nbEnvois) : "")}
    </div>
  );
}

export default function DoublonsModal({
  prospects, onClose, onToast,
}: {
  prospects: Prospect[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [traites, setTraites] = useState(0);
  const [enCours, setEnCours] = useState(false);

  // Recalculé à chaque changement de `prospects` (le flux temps réel renvoie la
  // liste après chaque fusion) : les paires résolues disparaissent d'elles-mêmes.
  const paires = useMemo(() => trouverDoublons(prospects), [prospects]);
  const paire: PaireDoublon | undefined = paires[index];

  const suivant = () => setIndex((i) => (i + 1 < paires.length ? i + 1 : 0));

  const fusionner = async () => {
    if (!paire) return;
    const { garde, absorbe } = fichePrincipale(paire.a, paire.b);
    setEnCours(true);
    try {
      await fusionnerProspects(garde, absorbe);
      setTraites((n) => n + 1);
      onToast("Fiches fusionnées.");
      setIndex(0);
    } finally {
      setEnCours(false);
    }
  };

  const ignorer = async () => {
    if (!paire) return;
    setEnCours(true);
    try {
      await ignorerDoublon(paire.a, paire.b);
      setTraites((n) => n + 1);
      setIndex(0);
    } finally {
      setEnCours(false);
    }
  };

  const principale = paire ? fichePrincipale(paire.a, paire.b) : null;
  const historiqueDouble =
    !!paire && (paire.a.nbEnvois ?? 0) > 0 && (paire.b.nbEnvois ?? 0) > 0;

  return (
    <Modal isOpen onClose={onClose} title="Doublons potentiels" size="lg">
      {!paire ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {traites > 0
            ? `Terminé — ${traites} paire(s) traitée(s).`
            : "Aucun doublon potentiel : même code postal, même métier et nom proche."}
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm text-gray-600">
              {paires.length} paire(s) à examiner
            </span>
            <span className="text-[11px] text-gray-500">{paire.motif}</span>
          </div>

          {paire.apport.length > 0 && (
            <div className="text-[11px] text-green-700 bg-green-50 rounded-lg px-3 py-1.5 mb-2">
              La fusion apporterait : {paire.apport.join(", ")}.
            </div>
          )}

          {historiqueDouble && (
            <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
              <strong>Les deux fiches ont un historique d&apos;envoi.</strong> Les compteurs seront
              cumulés ({(paire.a.nbEnvois ?? 0) + (paire.b.nbEnvois ?? 0)} envois au total) et la
              date la plus récente conservée — c&apos;est ce qui pilote le délai de relance. Les
              messages archivés de la fiche absorbée, eux, ne peuvent pas être déplacés : ils restent
              consultables, rattachés à l&apos;ancienne fiche. Une note le consignera.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2">
            <Fiche p={paire.a} principale={principale?.garde.id === paire.a.id} />
            <Fiche p={paire.b} principale={principale?.garde.id === paire.b.id} />
          </div>

          <p className="text-[11px] text-gray-500 mt-2">
            La fiche conservée est celle qui porte l&apos;email : elle garde son jeton de
            désinscription. Elle se complète des champs vides de l&apos;autre ; un second email
            différent est recopié dans les notes plutôt qu&apos;écrasé.
          </p>

          <div className="flex flex-wrap justify-between gap-2 mt-5">
            <button
              onClick={suivant}
              disabled={enCours || paires.length < 2}
              className="px-3 py-2 rounded-lg text-sm border hover:bg-gray-50 transition disabled:opacity-40"
            >
              Voir la suivante
            </button>
            <div className="flex gap-2">
              <button
                onClick={ignorer}
                disabled={enCours}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition disabled:opacity-40"
              >
                Ce ne sont pas les mêmes
              </button>
              <button
                onClick={fusionner}
                disabled={enCours}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
              >
                {enCours ? "Fusion…" : "Fusionner"}
              </button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
