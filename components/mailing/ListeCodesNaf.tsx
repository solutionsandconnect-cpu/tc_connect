"use client";

import { useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

/**
 * Codes NAF ajoutés un par un, affichés en pastilles.
 * Stockés en interne sous forme « 43.22A,43.22B » — c'est le format attendu par
 * l'API entreprises — mais jamais saisis comme tels.
 */
export default function ListeCodesNaf({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  const codes = valeur.split(",").map((c) => c.trim()).filter(Boolean);
  const [saisie, setSaisie] = useState("");

  /** Accepte « 4322B », « 43.22b », « 43 22 B » et normalise en « 43.22B ». */
  const normaliser = (brut: string): string | null => {
    const c = brut.toUpperCase().replace(/[^0-9A-Z]/g, "");
    const m = c.match(/^(\d{2})(\d{2})([A-Z])?$/);
    return m ? `${m[1]}.${m[2]}${m[3] ?? ""}` : null;
  };

  const code = normaliser(saisie);
  const valide = !!code && !codes.includes(code);

  const ajouter = () => {
    if (!valide || !code) return;
    onChange([...codes, code].join(","));
    setSaisie("");
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ajouter(); } }}
          placeholder="ex. 43.22B"
          className={inputCls}
        />
        <button
          onClick={ajouter}
          disabled={!valide}
          className="shrink-0 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Ajouter
        </button>
      </div>
      {saisie.trim() && !code && (
        <p className="text-[11px] text-amber-700 mt-1">
          Format attendu : deux chiffres, deux chiffres, une lettre — comme 43.22B.
        </p>
      )}
      {saisie.trim() && code && codes.includes(code) && (
        <p className="text-[11px] text-amber-700 mt-1">{code} est déjà dans la liste.</p>
      )}
      {codes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {codes.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
            >
              {c}
              <button
                onClick={() => onChange(codes.filter((x) => x !== c).join(","))}
                className="p-0.5 rounded-full hover:bg-blue-100 transition"
                title="Retirer"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

