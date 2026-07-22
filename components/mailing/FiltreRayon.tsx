"use client";

import { useEffect, useState } from "react";
import { chargerDepartements, lireCache, type Point } from "@/lib/geoCp";
import { departementDuCp } from "@/lib/territoires";
import type { Prospect } from "@/types";

/** Code postal de référence par défaut : le sien. Modifiable dans le champ. */
export const CP_DEFAUT = "56760";

export const RAYONS = [10, 20, 30, 50, 100] as const;

/**
 * Filtre « autour de chez moi ».
 *
 * Les coordonnées viennent de geo.api.gouv.fr, chargées par département et
 * conservées dans le navigateur (cf. lib/geoCp.ts) : aucun prospect n'est
 * modifié en base, et le filtre reste instantané une fois le cache constitué.
 */
export function useRayon(prospects: Prospect[]) {
  const [cpRef, setCpRef] = useState(CP_DEFAUT);
  const [rayon, setRayon] = useState<number | null>(null);
  const [table, setTable] = useState<Record<string, Point>>({});
  const [chargement, setChargement] = useState<{ fait: number; total: number } | null>(null);

  useEffect(() => { setTable(lireCache()); }, []);

  const departements = [
    ...new Set(
      prospects
        .map((p) => departementDuCp(p.codePostal)?.code)
        .filter((c): c is string => !!c),
    ),
  ];
  const deptRef = departementDuCp(cpRef)?.code;
  if (deptRef && !departements.includes(deptRef)) departements.push(deptRef);

  const charger = async () => {
    setChargement({ fait: 0, total: departements.length });
    const maj = await chargerDepartements(departements, (fait, total) =>
      setChargement({ fait, total }),
    );
    setTable(maj);
    setChargement(null);
  };

  const origine = table[cpRef] ?? null;
  const pret = !!origine;

  /** Distance d'un prospect à l'origine, ou null si l'un des deux est inconnu. */
  const distance = (p: Prospect): number | null => {
    if (!origine || !p.codePostal) return null;
    const point = table[p.codePostal.trim()];
    if (!point) return null;
    const R = 6371;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(point.lat - origine.lat);
    const dLng = rad(point.lng - origine.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(origine.lat)) * Math.cos(rad(point.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  /** Un prospect sans coordonnées connues est ÉCARTÉ quand un rayon est actif :
   *  l'inclure « au cas où » viderait le filtre de son sens. */
  const dansRayon = (p: Prospect): boolean => {
    if (rayon === null) return true;
    const d = distance(p);
    return d !== null && d <= rayon;
  };

  return {
    cpRef, setCpRef, rayon, setRayon, pret, chargement, charger, distance, dansRayon,
    nbDepartements: departements.length,
  };
}

export default function FiltreRayon({
  cpRef, setCpRef, rayon, setRayon, pret, chargement, charger, nbDepartements,
}: ReturnType<typeof useRayon>) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs text-gray-500">Autour de</span>
      <input
        value={cpRef}
        onChange={(e) => setCpRef(e.target.value.replace(/\D/g, "").slice(0, 5))}
        inputMode="numeric"
        className="w-20 border rounded-lg px-2 py-1 text-xs outline-none focus:border-blue-400 transition"
        placeholder="56760"
      />

      {chargement ? (
        <span className="text-xs text-gray-500">
          Chargement des communes… {chargement.fait}/{chargement.total}
        </span>
      ) : pret ? (
        <>
          <button
            onClick={() => setRayon(null)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
              rayon === null ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
            }`}
          >
            Partout
          </button>
          {RAYONS.map((r) => (
            <button
              key={r}
              onClick={() => setRayon(r)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                rayon === r ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r} km
            </button>
          ))}
        </>
      ) : (
        <>
          <button
            onClick={charger}
            className="px-2.5 py-1 rounded-lg border text-[11px] font-medium hover:bg-gray-50 transition"
          >
            Activer le filtre par distance
          </button>
          <span className="text-[11px] text-gray-500">
            Charge une fois les communes de tes {nbDepartements} départements (données publiques,
            conservées dans ce navigateur).
          </span>
        </>
      )}
    </div>
  );
}
