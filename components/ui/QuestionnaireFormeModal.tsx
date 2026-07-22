"use client";

// Questionnaire d'état de forme d'avant-séance (indice de Hooper).
//
// Extrait en composant parce qu'il se remplit désormais depuis DEUX écrans : la
// fiche du RDV, et l'aperçu d'une séance en autonomie — où faire sortir le
// client de sa séance pour aller le remplir ailleurs cassait le parcours.

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Modal from "@/components/ui/Modal";
import PainZoneSelector from "@/components/ui/PainZoneSelector";
import type { PainPoint } from "@/types";

export const QUESTIONS_FORME = [
  {
    key: "qualite_sommeil", label: "Sommeil",
    question: "Qualité de sommeil de la nuit dernière ?",
    labels: ["1 — Très très bonne", "2 — Très bonne", "3 — Bonne", "4 — Moyenne", "5 — Mauvaise", "6 — Très mauvaise", "7 — Très très mauvaise"],
  },
  {
    key: "niveau_fatigue", label: "Fatigue",
    question: "Niveau de fatigue actuel ?",
    labels: ["1 — Très très faible", "2 — Très faible", "3 — Faible", "4 — Moyen", "5 — Élevé", "6 — Très élevé", "7 — Très très élevé"],
  },
  {
    key: "niveau_courbatures", label: "Courbatures",
    question: "Niveau de courbatures / douleurs ?",
    labels: ["1 — Très très faible", "2 — Très faible", "3 — Faible", "4 — Moyen", "5 — Élevé", "6 — Très élevé", "7 — Très très élevé"],
  },
  {
    key: "quantite_stress", label: "Stress",
    question: "Quantité de stress actuelle ?",
    labels: ["1 — Très très faible", "2 — Très faible", "3 — Faible", "4 — Moyen", "5 — Élevée", "6 — Très élevée", "7 — Très très élevée"],
  },
  {
    key: "motivation_avant_seance", label: "Motivation",
    question: "Motivation à l'idée de faire la séance ?",
    labels: ["1 — Pas motivé", "2 — Peu motivé", "3 — Moyennement motivé", "4 — Motivé", "5 — Très motivé"],
  },
  {
    key: "activite_derniers_jours", label: "Activité",
    question: "Activité physique ces derniers jours ?",
    labels: ["1 — Passif / Rien fait", "2 — Peu actif", "3 — Moyennement actif", "4 — Actif", "5 — Très actif"],
  },
  {
    key: "alimentation_derniers_jours", label: "Alimentation",
    question: "Alimentation ces derniers jours ?",
    labels: ["1 — Que des excès", "2 — Beaucoup d'excès", "3 — Quelques excès", "4 — Très très peu d'excès", "5 — Aucun excès / Nutrition hyper saine"],
  },
] as const;

/** Les 4 premières questions composent l'indice de Hooper (somme sur 28). */
const CLES_HOOPER = ["qualite_sommeil", "niveau_fatigue", "niveau_courbatures", "quantite_stress"] as const;

export interface ReponsesForme {
  qualite_sommeil: number;
  niveau_fatigue: number;
  niveau_courbatures: number;
  quantite_stress: number;
  motivation_avant_seance: number;
  activite_derniers_jours: number;
  alimentation_derniers_jours: number;
  infos_complementaire_avant_seance_client: string;
  douleurs: PainPoint[];
}

export function reponsesDepuisPlanning(p: Record<string, unknown> | null | undefined): ReponsesForme {
  const n = (k: string) => (typeof p?.[k] === "number" ? (p[k] as number) : 1);
  return {
    qualite_sommeil: n("qualite_sommeil"),
    niveau_fatigue: n("niveau_fatigue"),
    niveau_courbatures: n("niveau_courbatures"),
    quantite_stress: n("quantite_stress"),
    motivation_avant_seance: n("motivation_avant_seance"),
    activite_derniers_jours: n("activite_derniers_jours"),
    alimentation_derniers_jours: n("alimentation_derniers_jours"),
    infos_complementaire_avant_seance_client:
      (p?.infos_complementaire_avant_seance_client as string) ?? "",
    douleurs: Array.isArray(p?.douleurs) ? (p.douleurs as PainPoint[]) : [],
  };
}

export default function QuestionnaireFormeModal({
  isOpen, planningId, initial, onClose, onSaved,
}: {
  isOpen: boolean;
  planningId: string;
  initial: ReponsesForme;
  onClose: () => void;
  /** Appelé après écriture réussie — permet de rafraîchir l'écran appelant. */
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<ReponsesForme>(initial);
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnCours(true);
    try {
      const indice_hooper = CLES_HOOPER.reduce((s, k) => s + form[k], 0);
      await updateDoc(doc(db, "planning_pro", planningId), {
        ...form,
        indice_hooper,
        questionnaire_rempli: true,
      });
      onSaved?.();
      onClose();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Questionnaire de forme" size="lg">
      <form onSubmit={soumettre} className="space-y-5">
        {QUESTIONS_FORME.map((q) => (
          <div key={q.key}>
            <p className="text-sm font-semibold text-gray-700 mb-1">{q.label}</p>
            <p className="text-xs text-gray-500 mb-2">{q.question}</p>
            <div className="flex flex-wrap gap-2">
              {q.labels.map((label, i) => {
                const val = i + 1;
                const choisi = form[q.key] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, [q.key]: val }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                      choisi
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Douleurs</label>
          <p className="text-xs text-gray-500 mb-2">
            Touchez les zones concernées puis ajustez l&apos;intensité.
          </p>
          <PainZoneSelector
            value={form.douleurs}
            onChange={(v) => setForm((prev) => ({ ...prev, douleurs: v }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
          <textarea
            value={form.infos_complementaire_avant_seance_client}
            onChange={(e) => {
              const v = e.target.value;
              setForm((prev) => ({ ...prev, infos_complementaire_avant_seance_client: v }));
            }}
            rows={3}
            placeholder="Maladie, douleurs ciblées..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={enCours}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-60"
          >
            {enCours ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
