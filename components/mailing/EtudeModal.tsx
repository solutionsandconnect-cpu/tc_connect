"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { construirePromptRecherche } from "@/lib/mailingPrompt";
import type { Prospect } from "@/types";

// « Étudier cette entreprise » : le même prompt de recherche que dans le composeur,
// mais accessible directement depuis la liste des prospects, avant même de préparer
// un envoi. On le copie pour le coller dans un assistant IA.
export default function EtudeModal({
  prospect,
  onClose,
  onToast,
}: {
  prospect: Prospect;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [copie, setCopie] = useState(false);
  const prompt = construirePromptRecherche(prospect);

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopie(true);
      onToast("Prompt copié — colle-le dans ton assistant IA.");
    } catch {
      onToast("Copie impossible : sélectionne le texte à la main.");
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Étudier ${prospect.societe}`} size="lg">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Copie ce prompt dans ton assistant IA (ChatGPT, Claude…) pour te renseigner sur
          l&apos;entreprise avant de la contacter : taille et organisation réelles, santé
          économique, avis clients, outillage. Il exige des sources et interdit d&apos;inventer.
        </p>
        <textarea
          readOnly
          value={prompt}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full h-72 border rounded-lg px-3 py-2 text-xs font-mono leading-relaxed outline-none focus:border-blue-400 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
          >
            Fermer
          </button>
          <button
            onClick={copier}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            {copie ? "Copié ✓" : "Copier le prompt"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
