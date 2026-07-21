"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { getClients } from "@/lib/clientService";
import {
  promouvoirEnClient, rattacherAClient, suggererClient, type SuggestionClient,
} from "@/lib/mailingService";
import type { Client, Prospect } from "@/types";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

const etiquette = (c: Client) =>
  (c.nomEntreprise?.trim() || `${c.prenom ?? ""} ${c.nom ?? ""}`.trim() || "Sans nom");

/**
 * Promotion d'un prospect vers le CRM.
 * Le rapprochement automatique ne suffit pas : un client peut être enregistré
 * avec une autre adresse que celle du prospect, et rien ne correspond alors.
 * On propose donc une suggestion, mais c'est l'utilisateur qui tranche entre
 * rattacher à une fiche existante et en créer une.
 */
export default function PromotionModal({
  prospect, userId, onClose, onFait, onToast,
}: {
  prospect: Prospect;
  userId: string;
  onClose: () => void;
  onFait: (clientId: string) => void;
  onToast: (m: string) => void;
}) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestionClient | null>(null);
  const [recherche, setRecherche] = useState("");
  const [choisi, setChoisi] = useState<string>("");
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    void (async () => {
      try {
        const liste = await getClients(userId);
        if (annule) return;
        setClients(liste);
        const s = await suggererClient(prospect, liste);
        if (!annule && s) { setSuggestion(s); setChoisi(s.clientId); }
      } catch {
        if (!annule) setClients([]);
      }
    })();
    return () => { annule = true; };
  }, [userId, prospect]);

  const filtres = useMemo(() => {
    if (!clients) return [];
    const q = recherche.trim().toLowerCase();
    const base = q
      ? clients.filter((c) =>
          `${etiquette(c)} ${c.email ?? ""} ${c.ville ?? ""}`.toLowerCase().includes(q))
      : clients;
    return base.slice(0, 40);
  }, [clients, recherche]);

  const valider = async () => {
    setEnCours(true);
    try {
      if (choisi) {
        await rattacherAClient(prospect, choisi);
        onToast("Prospect rattaché à la fiche client existante.");
        onFait(choisi);
      } else {
        const { clientId } = await promouvoirEnClient(prospect, userId);
        onToast("Nouvelle fiche client créée.");
        onFait(clientId);
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Promouvoir en client" size="lg">
      <div className="rounded-lg bg-gray-50 px-3 py-2 mb-3">
        <div className="text-sm font-medium">{prospect.societe}</div>
        <div className="text-xs text-gray-500">
          {prospect.email || "sans email"}
          {prospect.ville ? ` · ${prospect.ville}` : ""}
          {prospect.siret ? ` · SIRET ${prospect.siret}` : ""}
        </div>
      </div>

      {clients === null ? (
        <div className="py-8 text-center text-sm text-gray-500">Chargement des clients…</div>
      ) : (
        <>
          {suggestion ? (
            <div className="rounded-lg bg-blue-50 text-blue-800 text-xs px-3 py-2 mb-3">
              Rapprochement proposé —{" "}
              <strong>{etiquette(clients.find((c) => c.id === suggestion.clientId)!)}</strong>
              {` (${suggestion.raison}). Vérifie avant de valider.`}
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 text-gray-600 text-xs px-3 py-2 mb-3">
              Aucun client ne correspond automatiquement. Cherche-le ci-dessous s&apos;il existe
              déjà sous une autre adresse, sinon crée une nouvelle fiche.
            </div>
          )}

          <label className="block text-xs font-medium text-gray-600 mb-1">
            Rattacher à un client existant
          </label>
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher par nom, email, ville…"
            className={inputCls}
          />

          <div className="border rounded-lg mt-2 max-h-56 overflow-y-auto divide-y">
            <button
              onClick={() => setChoisi("")}
              className={`w-full text-left px-3 py-2 text-sm transition ${
                choisi === "" ? "bg-green-50 text-green-800 font-medium" : "hover:bg-gray-50"
              }`}
            >
              Créer une nouvelle fiche client
              <div className="text-[11px] text-gray-500 font-normal">
                À choisir si ce prospect n&apos;existe pas encore dans tes clients.
              </div>
            </button>
            {filtres.map((c) => (
              <button
                key={c.id}
                onClick={() => setChoisi(c.id)}
                className={`w-full text-left px-3 py-2 transition ${
                  choisi === c.id ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-medium truncate">
                  {etiquette(c)}
                  {suggestion?.clientId === c.id && (
                    <span className="ml-2 text-[10px] text-blue-700">proposé</span>
                  )}
                </div>
                <div className="text-[11px] text-gray-500 truncate">
                  {c.email || "sans email"}
                  {c.ville ? ` · ${c.ville}` : ""}
                </div>
              </button>
            ))}
            {recherche.trim() && filtres.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-gray-500">Aucun client trouvé.</div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
              Annuler
            </button>
            <button
              onClick={valider}
              disabled={enCours}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              {enCours
                ? "Enregistrement…"
                : choisi
                  ? "Rattacher à ce client"
                  : "Créer la fiche client"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
