"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { fusionnerProspects } from "@/lib/mailingService";
import type { Prospect } from "@/types";

// Fusion OPTIONNELLE de fiches liées de MÊME métier. On choisit la fiche
// principale (elle garde ses infos et complète ce qui lui manque depuis les
// autres — email compris) ; les autres sont absorbées puis supprimées.
export default function FusionModal({
  groupe,
  onClose,
  onToast,
}: {
  groupe: Prospect[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  // Principal par défaut : la 1re fiche AVEC email (pour rester joignable), sinon la 1re.
  const defaut = groupe.find((p) => p.email?.trim())?.id ?? groupe[0]?.id ?? "";
  const [principalId, setPrincipalId] = useState(defaut);
  const [enCours, setEnCours] = useState(false);

  const principal = groupe.find((p) => p.id === principalId) ?? groupe[0];
  const absorbes = groupe.filter((p) => p.id !== principalId);
  const envoisEnJeu = absorbes.some((p) => (p.nbEnvois ?? 0) > 0);

  const fusionner = async () => {
    if (!principal) return;
    setEnCours(true);
    try {
      // Séquentiel : chaque absorbée est fusionnée dans le principal.
      for (const absorbe of absorbes) {
        await fusionnerProspects(principal, absorbe);
      }
      onToast(`${absorbes.length + 1} fiches fusionnées en une.`);
      onClose();
    } catch {
      onToast("La fusion a échoué.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Fusionner les fiches liées" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Choisis la fiche à <strong>conserver</strong>. Elle garde ses infos et récupère celles qui
          lui manquent depuis les autres (email inclus). Les autres fiches sont supprimées.
        </p>

        <div className="border rounded-xl divide-y">
          {groupe.map((p) => {
            const aEmail = !!p.email?.trim();
            const etudie = !!(p.etudeAt || p.dirigeant || p.etudeResume);
            return (
              <label
                key={p.id}
                className={`flex items-start gap-2 px-3 py-2 cursor-pointer transition ${
                  p.id === principalId ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="principal"
                  checked={p.id === principalId}
                  onChange={() => setPrincipalId(p.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{p.societe}</span>
                    {p.id === principalId && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-600 text-white">
                        conservée
                      </span>
                    )}
                    {aEmail ? (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700">
                        email
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-50 text-amber-700">
                        sans email
                      </span>
                    )}
                    {etudie && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-violet-50 text-violet-700">
                        étudié
                      </span>
                    )}
                    {(p.nbEnvois ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700">
                        {p.nbEnvois} envoi{(p.nbEnvois ?? 0) > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {p.email || "—"}
                    {p.metier ? ` · ${p.metier}` : ""}
                    {p.ville ? ` · ${p.ville}` : ""}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {envoisEnJeu && (
          <p className="text-xs text-amber-700">
            Des envois seront cumulés sur la fiche conservée, mais les messages archivés
            restent rattachés à l&apos;ancienne fiche (limite technique connue).
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={fusionner}
            disabled={enCours || groupe.length < 2}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enCours ? "Fusion…" : `Fusionner en 1 fiche`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
