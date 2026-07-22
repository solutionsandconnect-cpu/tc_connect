"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import { fusionnerProspects, ignorerDoublon, oublierDoublonIgnore } from "@/lib/mailingService";
import { fichePrincipale, trouverDoublons, type PaireDoublon } from "@/lib/mailingDoublons";
import { libelleEffectif } from "@/lib/sirene";
import { STATUT_LABEL } from "@/lib/mailingModel";
import type { Prospect } from "@/types";

/** Colonne d'une fiche : ce qu'elle apporte doit sauter aux yeux. */
function Fiche({
  p, principale, onChoisir,
}: {
  p: Prospect;
  principale: boolean;
  onChoisir: () => void;
}) {
  const ligne = (label: string, valeur?: string | null) => (
    <div className="flex gap-2 text-[11px]">
      <span className="text-gray-400 w-20 shrink-0">{label}</span>
      <span className={valeur ? "text-gray-700 break-all" : "text-gray-300"}>{valeur || "—"}</span>
    </div>
  );
  return (
    <div
      className={`rounded-lg border p-2.5 space-y-1 ${
        principale ? "border-blue-400 bg-blue-50/50" : "border-gray-200"
      }`}
    >
      {/* La fiche conservée est PROPOSÉE, pas imposée : sur deux fiches
          partielles, l'utilisateur sait parfois mieux laquelle fait référence. */}
      <label className="flex items-center gap-1.5 mb-1 cursor-pointer">
        <input type="radio" checked={principale} onChange={onChoisir} className="shrink-0" />
        <span className="text-xs font-semibold truncate">{p.societe}</span>
        {principale && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-600 text-white shrink-0">
            conservée
          </span>
        )}
      </label>
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
  /** Choix explicite de la fiche à conserver. Null = proposition automatique. */
  const [choixGarde, setChoixGarde] = useState<string | null>(null);

  /** Vue courante : paires à examiner, ou paires déjà écartées à la main. */
  const [vue, setVue] = useState<"actives" | "ignorees">("actives");

  // Recalculé à chaque changement de `prospects` (le flux temps réel renvoie la
  // liste après chaque fusion) : les paires résolues disparaissent d'elles-mêmes.
  const toutes = useMemo(() => trouverDoublons(prospects), [prospects]);
  const actives = toutes.filter((p) => !p.ignoree);
  const ignorees = toutes.filter((p) => p.ignoree);
  const paires = vue === "actives" ? actives : ignorees;
  const paire: PaireDoublon | undefined = paires[index];

  // Changer de paire remet la proposition automatique : un choix fait sur une
  // paire n'a aucun sens sur la suivante.
  const suivant = () => {
    setChoixGarde(null);
    setIndex((i) => (i + 1 < paires.length ? i + 1 : 0));
  };

  const fusionner = async () => {
    if (!paire) return;
    const { garde, absorbe } = fusionOrientee;
    setEnCours(true);
    try {
      await fusionnerProspects(garde, absorbe);
      setTraites((n) => n + 1);
      onToast("Fiches fusionnées.");
      setChoixGarde(null);
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
      setChoixGarde(null);
      setIndex(0);
    } finally {
      setEnCours(false);
    }
  };

  /** Remet une paire écartée dans la file à examiner. */
  const remettre = async () => {
    if (!paire) return;
    setEnCours(true);
    try {
      await oublierDoublonIgnore(paire.a, paire.b);
      onToast("Paire remise à examiner.");
      setChoixGarde(null);
      setIndex(0);
    } finally {
      setEnCours(false);
    }
  };

  /** Sens de la fusion : le choix de l'utilisateur prime sur la proposition. */
  const fusionOrientee = (() => {
    const defaut = paire ? fichePrincipale(paire.a, paire.b) : null;
    if (!paire || !defaut) return { garde: paire?.a as Prospect, absorbe: paire?.b as Prospect };
    if (choixGarde === paire.a.id) return { garde: paire.a, absorbe: paire.b };
    if (choixGarde === paire.b.id) return { garde: paire.b, absorbe: paire.a };
    return defaut;
  })();
  const historiqueDouble =
    !!paire && (paire.a.nbEnvois ?? 0) > 0 && (paire.b.nbEnvois ?? 0) > 0;

  return (
    <Modal isOpen onClose={onClose} title="Doublons potentiels" size="lg">
      {/* Les paires écartées restent accessibles : « ce ne sont pas les mêmes »
          doit pouvoir se corriger, surtout après un enchaînement rapide. */}
      {ignorees.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {([
            { k: "actives", l: "À examiner", n: actives.length },
            { k: "ignorees", l: "Écartées", n: ignorees.length },
          ] as const).map((v) => (
            <button
              key={v.k}
              onClick={() => { setVue(v.k); setIndex(0); setChoixGarde(null); }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                vue === v.k ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {v.l}
              <span className={`ml-1.5 ${vue === v.k ? "text-blue-100" : "text-gray-400"}`}>
                {v.n}
              </span>
            </button>
          ))}
        </div>
      )}

      {!paire ? (
        <div className="py-8 text-center text-sm text-gray-500">
          {vue === "ignorees"
            ? "Aucune paire écartée."
            : traites > 0
              ? `Terminé — ${traites} paire(s) traitée(s).`
              : "Aucun doublon potentiel : même code postal, même métier et nom proche."}
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm text-gray-600">
              {paires.length} paire(s) {vue === "actives" ? "à examiner" : "écartée(s)"}
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
            <Fiche
              p={paire.a}
              principale={fusionOrientee.garde.id === paire.a.id}
              onChoisir={() => setChoixGarde(paire.a.id)}
            />
            <Fiche
              p={paire.b}
              principale={fusionOrientee.garde.id === paire.b.id}
              onChoisir={() => setChoixGarde(paire.b.id)}
            />
          </div>

          <p className="text-[11px] text-gray-500 mt-2">
            La fiche conservée est proposée par défaut (celle qui porte l&apos;email, pour garder son
            jeton de désinscription) — <strong>coche l&apos;autre si tu préfères la garder</strong>.
            Elle se complète des champs vides de la seconde, qui est ensuite supprimée. Un second
            email différent est recopié dans les notes plutôt qu&apos;écrasé.
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
              {vue === "actives" ? (
                <button
                  onClick={ignorer}
                  disabled={enCours}
                  className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Ce ne sont pas les mêmes
                </button>
              ) : (
                <button
                  onClick={remettre}
                  disabled={enCours}
                  className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition disabled:opacity-40"
                >
                  Remettre à examiner
                </button>
              )}
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
