"use client";

import { useMemo, useState } from "react";
import {
  analyserImport, decoderTexte, detecterColonnes, parseCsv,
  LIBELLE_ENCODAGE, LIBELLE_REJET,
  type ChampCible, type Encodage, type MotifRejet, type RapportImport,
} from "@/lib/mailingImport";
import { createProspectsBatch } from "@/lib/mailingService";
import type { MailingMetier, Prospect } from "@/types";
import { XMarkIcon } from "@heroicons/react/24/outline";

const CHAMPS: { k: ChampCible; l: string; requis?: boolean }[] = [
  { k: "societe", l: "Société", requis: true },
  { k: "email", l: "Email", requis: true },
  { k: "telephone", l: "Téléphone" },
  { k: "codePostal", l: "Code postal" },
  { k: "ville", l: "Ville" },
  { k: "metier", l: "Métier" },
  { k: "siret", l: "SIRET" },
  { k: "dateCreation", l: "Date de création" },
  { k: "dateEnvoi", l: "Date d'envoi réalisé" },
];

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

export default function ImportModal({
  userId, metiers, existants, optouts, onClose, onToast,
}: {
  userId: string;
  metiers: MailingMetier[];
  existants: Prospect[];
  optouts: Set<string>;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [lignes, setLignes] = useState<string[][] | null>(null);
  const [colonnes, setColonnes] = useState<Record<ChampCible, number> | null>(null);
  const [metierId, setMetierId] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [encodage, setEncodage] = useState<Encodage | null>(null);

  const entetes = lignes?.[0] ?? [];
  const metierChoisi = metiers.find((m) => m.id === metierId);

  const rapport: RapportImport | null = useMemo(() => {
    if (!lignes || !colonnes) return null;
    return analyserImport(lignes, colonnes, {
      userId,
      metierId: metierId || undefined,
      metierParDefaut: metierChoisi?.metier,
      metiers,
      existants,
      optouts,
    });
  }, [lignes, colonnes, userId, metierId, metierChoisi?.metier, metiers, existants, optouts]);

  const charger = async (file: File) => {
    setErreur(null);
    try {
      // Lecture en octets puis détection : lire en UTF-8 d'office abîmerait les
      // accents des exports Excel français (Windows-1252).
      const { texte, encodage } = decoderTexte(await file.arrayBuffer());
      const parsed = parseCsv(texte);
      if (parsed.length < 2) {
        setErreur("Le fichier ne contient aucune ligne de données.");
        return;
      }
      setEncodage(encodage);
      setLignes(parsed);
      setColonnes(detecterColonnes(parsed[0]));
    } catch {
      setErreur("Impossible de lire ce fichier. Attendu : un fichier CSV ou texte délimité.");
    }
  };

  const importer = async () => {
    if (!rapport || rapport.retenues.length === 0) return;
    setEnCours(true);
    try {
      const n = await createProspectsBatch(rapport.retenues.map((r) => r.brut));
      onToast(`${n} prospect${n > 1 ? "s" : ""} importé${n > 1 ? "s" : ""}.`);
      onClose();
    } catch {
      setErreur("L'import a échoué. Rien n'a été enregistré pour les lignes restantes.");
    } finally {
      setEnCours(false);
    }
  };

  const colonnesOk = colonnes && colonnes.societe >= 0 && colonnes.email >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-3xl my-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="font-semibold">Importer une liste de prospects</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {!lignes && (
            <>
              <label className="block border-2 border-dashed rounded-xl px-4 py-8 text-center cursor-pointer hover:border-blue-400 transition">
                <input
                  type="file"
                  accept=".csv,.txt,.tsv,text/csv,text/plain,text/tab-separated-values"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) charger(f); }}
                />
                <div className="text-sm font-medium">Choisir un fichier CSV</div>
                <div className="text-xs text-gray-500 mt-1">
                  Séparateur (`;` `,` tabulation) et encodage détectés automatiquement.
                  Colonnes minimales : société et email.
                </div>
                <div className="text-[11px] text-gray-400 mt-1">
                  Excel : « Enregistrer sous → CSV » suffit, quel que soit l&apos;encodage.
                  Les fichiers .xlsx ne sont pas lisibles directement.
                </div>
              </label>
              <p className="text-xs text-gray-500">
                Rien n&apos;est enregistré avant que tu aies vu le rapport d&apos;analyse.
              </p>
            </>
          )}

          {erreur && (
            <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{erreur}</div>
          )}

          {lignes && colonnes && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Kit métier par défaut
                </label>
                <select value={metierId} onChange={(e) => setMetierId(e.target.value)} className={inputCls}>
                  <option value="">— Aucun —</option>
                  {metiers.map((m) => (
                    <option key={m.id} value={m.id}>{m.metier}</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  La colonne « corps de métier » du fichier est rattachée automatiquement au kit
                  portant le même nom. Ce choix ne sert qu&apos;aux lignes sans correspondance.
                </p>
              </div>

              <div>
                <div className="text-xs font-medium text-gray-600 mb-1.5 flex flex-wrap items-baseline gap-x-2">
                  <span>Correspondance des colonnes ({entetes.length} détectées)</span>
                  {encodage && (
                    <span className="font-normal text-gray-400">
                      · encodage détecté : {LIBELLE_ENCODAGE[encodage]}
                    </span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {CHAMPS.map((c) => (
                    <div key={c.k} className="flex items-center gap-2">
                      <span className="text-xs w-32 shrink-0 text-gray-600">
                        {c.l}{c.requis && <span className="text-red-500"> *</span>}
                      </span>
                      <select
                        value={colonnes[c.k]}
                        onChange={(e) =>
                          setColonnes({ ...colonnes, [c.k]: Number(e.target.value) })
                        }
                        className="flex-1 border rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value={-1}>— non utilisée —</option>
                        {entetes.map((h, i) => (
                          <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {rapport && (
                <div className="border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="text-sm font-medium">
                      {rapport.retenues.length} ligne{rapport.retenues.length > 1 ? "s" : ""} retenue
                      {rapport.retenues.length > 1 ? "s" : ""}
                    </span>
                    <span className="text-sm text-gray-500">
                      sur {rapport.total} · {rapport.rejetees.length} écartée
                      {rapport.rejetees.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {rapport.rejetees.length > 0 && (
                    <div className="px-4 py-3 space-y-1">
                      {(Object.keys(rapport.parMotif) as MotifRejet[])
                        .filter((m) => rapport.parMotif[m] > 0)
                        .map((m) => (
                          <div key={m} className="flex justify-between text-xs">
                            <span className={m === "oppose" ? "text-red-600 font-medium" : "text-gray-600"}>
                              {LIBELLE_REJET[m]}
                            </span>
                            <span className="text-gray-500">{rapport.parMotif[m]}</span>
                          </div>
                        ))}
                    </div>
                  )}
                  {rapport.retenues.some((r) => r.generique) && (
                    <div className="px-4 py-2 text-[11px] text-gray-500 border-t">
                      {rapport.retenues.filter((r) => r.generique).length} adresse(s) générique(s)
                      (contact@, info@…) — importées, mais elles convertissent moins bien.
                    </div>
                  )}
                </div>
              )}

              {!colonnesOk && (
                <div className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">
                  Associe au minimum les colonnes <strong>Société</strong> et <strong>Email</strong>.
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={importer}
            disabled={!rapport || rapport.retenues.length === 0 || !colonnesOk || enCours}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enCours ? "Import…" : `Importer ${rapport?.retenues.length ?? 0} prospect(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
