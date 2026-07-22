"use client";

import { useMemo, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import { appliquerEnrichissement } from "@/lib/mailingService";
import { libelleEffectif, rechercherLot, type ResultatRecherche } from "@/lib/sirene";
import type { MailingMetier, Prospect } from "@/types";

// L'enrichissement se fait en DEUX temps, de durées comparables : interroger
// l'API, puis écrire les résultats en base un par un. Les distinguer n'est pas
// cosmétique — sans ça, la barre reste pleine et figée pendant toute la seconde
// phase, et on croit l'app plantée (constaté sur le premier vrai passage).
type Etat = "pret" | "recherche" | "ecriture" | "fini";

export default function EnrichirModal({
  prospects, metiers, onClose, onToast,
}: {
  prospects: Prospect[];
  metiers: MailingMetier[];
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [etat, setEtat] = useState<Etat>("pret");
  const [progres, setProgres] = useState({ fait: 0, total: 0 });
  const [resultats, setResultats] = useState<ResultatRecherche[]>([]);
  const [sansCodePostal, setSansCodePostal] = useState<ResultatRecherche[]>([]);
  const [appliques, setAppliques] = useState(0);
  const abort = useRef<AbortController | null>(null);

  // On ne retouche pas ce qui est déjà enrichi : l'API est lente et la donnée
  // INSEE ne bouge pas d'un jour à l'autre.
  const cibles = useMemo(
    () => prospects.filter((p) => !p.siren && p.societe?.trim()),
    [prospects],
  );

  const lancer = async () => {
    setEtat("recherche");
    setProgres({ fait: 0, total: cibles.length });
    abort.current = new AbortController();

    const parId = new Map(prospects.map((p) => [p.id, p]));
    const res = await rechercherLot(
      cibles.map((p) => ({
        id: p.id,
        societe: p.societe,
        codePostal: p.codePostal,
        codesNaf: metiers.find((m) => m.id === p.metierId)?.codesNaf,
      })),
      (fait, total) => setProgres({ fait, total }),
      abort.current.signal,
    );

    // Application automatique réservée aux correspondances UNIQUES **et**
    // géographiquement contraintes.
    //
    // ⚠️ Sans code postal, la recherche porte sur la France entière : un nom
    // même très particulier y trouve souvent UN seul homonyme, à 800 km. C'est
    // ainsi qu'un artisan de Trédion (56) s'est retrouvé enrichi avec une
    // société de Fort-de-France — et son code postal réécrit en 97200, puisque
    // l'enrichissement complète les champs vides. 28 prospects sur 547 avaient
    // atterri hors zone. Un candidat unique non contraint n'est donc PAS une
    // correspondance sûre : il part avec les cas à trancher.
    const aCodePostal = (id: string) => !!parId.get(id)?.codePostal?.trim();
    const aEcrire = res.filter((r) => r.candidats.length === 1 && aCodePostal(r.prospectId));
    const nonContraints = res.filter(
      (r) => r.candidats.length === 1 && !aCodePostal(r.prospectId),
    );
    setSansCodePostal(nonContraints);
    setEtat("ecriture");
    setProgres({ fait: 0, total: aEcrire.length });

    let n = 0;
    for (const r of aEcrire) {
      const p = parId.get(r.prospectId);
      if (!p) continue;
      try {
        await appliquerEnrichissement(p, r.candidats[0]);
        n++;
      } catch {
        /* le prospect reste non enrichi, il ressortira au prochain passage */
      }
      setProgres({ fait: n, total: aEcrire.length });
    }
    setAppliques(n);
    setResultats(res);
    setEtat("fini");
    onToast(`${n} prospect(s) enrichi(s).`);
  };

  const ambigus = resultats.filter((r) => r.candidats.length > 1);
  const introuvables = resultats.filter((r) => r.candidats.length === 0 && !r.erreur);
  const erreurs = resultats.filter((r) => r.erreur);

  return (
    <Modal isOpen onClose={onClose} title="Enrichir depuis l'annuaire des entreprises" size="lg">
      {etat === "pret" && (
        <>
          <p className="text-sm text-gray-600">
            {cibles.length === 0
              ? "Tous les prospects ayant une société sont déjà enrichis."
              : `${cibles.length} prospect(s) sans données INSEE vont être recherchés par nom et code postal.`}
          </p>
          <ul className="text-xs text-gray-500 mt-3 space-y-1 list-disc pl-4">
            <li>
              Seules les correspondances <strong>uniques</strong> sont appliquées automatiquement.
              Les cas ambigus te seront listés.
            </li>
            <li>
              Le filtrage utilise les <strong>codes NAF</strong> du kit métier — renseigne-les pour
              de bien meilleurs résultats.
            </li>
            <li>
              Environ 0,2 s par prospect pour respecter le débit de l&apos;API publique, soit
              ~{Math.ceil((cibles.length * 0.2) / 60)} min pour cette liste.
            </li>
          </ul>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
              Annuler
            </button>
            <button
              onClick={lancer}
              disabled={cibles.length === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              Lancer la recherche
            </button>
          </div>
        </>
      )}

      {(etat === "recherche" || etat === "ecriture") && (
        <>
          <div className="text-sm text-gray-600 mb-2">
            {etat === "recherche"
              ? `Étape 1/2 — recherche dans l'annuaire : ${progres.fait}/${progres.total}`
              : `Étape 2/2 — enregistrement des résultats : ${progres.fait}/${progres.total}`}
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full transition-all ${etat === "recherche" ? "bg-blue-600" : "bg-green-600"}`}
              style={{ width: `${progres.total ? (progres.fait / progres.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            {etat === "recherche"
              ? "Une pause est respectée entre chaque requête pour ne pas saturer l'API publique."
              : "Écriture en base, un prospect à la fois. Ce qui est déjà enregistré est acquis : "
                + "si tu fermes, relancer reprendra simplement les prospects restants."}
          </p>
          {/* Le bouton n'est proposé qu'en phase 1 : l'AbortController ne pilote
              que les requêtes, il n'aurait aucun effet sur la boucle d'écriture —
              l'afficher laisserait croire à une action qui n'existe pas. */}
          {etat === "recherche" && (
            <div className="flex justify-end mt-5">
              <button
                onClick={() => abort.current?.abort()}
                className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
              >
                Arrêter
              </button>
            </div>
          )}
        </>
      )}

      {etat === "fini" && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: "Enrichis", v: appliques },
              { l: "À trancher", v: ambigus.length },
              { l: "Introuvables", v: introuvables.length },
            ].map((s) => (
              <div key={s.l} className="border rounded-xl px-3 py-2">
                <div className="text-xs text-gray-500">{s.l}</div>
                <div className="text-lg font-semibold">{s.v}</div>
              </div>
            ))}
          </div>

          {ambigus.length > 0 && (
            <div className="border rounded-xl overflow-hidden mb-3">
              <div className="px-3 py-2 bg-gray-50 text-xs font-medium">
                Plusieurs candidats — à choisir sur la fiche du prospect
              </div>
              <div className="divide-y max-h-56 overflow-y-auto">
                {ambigus.map((r) => (
                  <div key={r.prospectId} className="px-3 py-2">
                    <div className="text-xs font-medium">{r.societe}</div>
                    <div className="text-[11px] text-gray-500">
                      {r.candidats.length} candidats :{" "}
                      {r.candidats.slice(0, 3).map((c) => `${c.nom} (${libelleEffectif(c.effectifCode)})`).join(" · ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {introuvables.length > 0 && (
            <div className="border rounded-xl overflow-hidden mb-3">
              <div className="px-3 py-2 bg-gray-50 text-xs font-medium">
                Introuvables — nom trop éloigné du registre, ou société radiée
              </div>
              <div className="px-3 py-2 text-[11px] text-gray-500 max-h-32 overflow-y-auto">
                {introuvables.map((r) => r.societe).join(" · ")}
              </div>
            </div>
          )}

          {sansCodePostal.length > 0 && (
            <div className="border border-amber-200 rounded-xl overflow-hidden mb-3">
              <div className="px-3 py-2 bg-amber-50 text-xs font-medium text-amber-800">
                {sansCodePostal.length}{" "}
                candidat(s) unique(s) NON appliqué(s) — prospect sans code postal
              </div>
              <div className="px-3 py-2 text-[11px] text-gray-600">
                Sans code postal, la recherche porte sur toute la France : le seul résultat trouvé
                peut être un homonyme à l&apos;autre bout du pays. Complète le code postal sur la
                fiche, puis relance l&apos;enrichissement.
              </div>
              <div className="px-3 pb-2 text-[11px] text-gray-500 max-h-32 overflow-y-auto">
                {sansCodePostal.map((r) => r.societe).join(" · ")}
              </div>
            </div>
          )}

          {erreurs.length > 0 && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2 mb-3">
              {/* Espace explicite : au passage à la ligne, JSX avale celui qui suit
                  une accolade — d'où le « 12appel(s) » constaté. */}
              {erreurs.length}{" "}
              appel(s) en erreur — relance l&apos;enrichissement pour les reprendre.
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Fermer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
