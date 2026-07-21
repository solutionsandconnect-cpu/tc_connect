"use client";

import { useMemo, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import Modal from "@/components/ui/Modal";
import { createProspectsBatch, type NouveauProspect } from "@/lib/mailingService";
import { isEmailGenerique, isEmailValide, normalizeEmail } from "@/lib/mailingModel";
import { departementDepuisCp, type FicheArtisan } from "@/lib/annuaire";
import { libelleEffectif, rechercherParCriteres, type InfoEntreprise } from "@/lib/sirene";
import ListeCodesNaf from "@/components/mailing/ListeCodesNaf";
import type { MailingMetier, Prospect } from "@/types";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

/**
 * Choix du kit en pastilles plutôt qu'en menu déroulant : avec quelques métiers,
 * tout est visible d'un coup d'œil et on voit lesquels ont des codes NAF — ce
 * qu'un menu fermé ne montre jamais.
 */
function ChoixKit({
  metiers, valeur, onChange, montrerNaf,
}: {
  metiers: MailingMetier[];
  valeur: string;
  onChange: (id: string) => void;
  montrerNaf?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange("")}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
          valeur === "" ? "bg-blue-600 text-white" : "border text-gray-600 hover:bg-gray-50"
        }`}
      >
        Aucun
      </button>
      {metiers.map((m) => {
        const actif = valeur === m.id;
        const nb = (m.codesNaf ?? "").split(",").filter((c) => c.trim()).length;
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              actif ? "bg-blue-600 text-white" : "border text-gray-700 hover:bg-gray-50"
            }`}
          >
            {m.metier}
            {montrerNaf && (
              <span className={`ml-1.5 text-[11px] ${actif ? "text-blue-100" : "text-gray-400"}`}>
                {nb ? `${nb} NAF` : "sans NAF"}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

type Etat = "reglages" | "liste" | "fiches" | "fini";

/** Le client orchestre : chaque appel serveur reste court (limite d'exécution). */
const FICHES_PAR_APPEL = 6;

export default function AnnuaireModal({
  userId, metiers, existants, optouts, onClose, onToast,
}: {
  userId: string;
  metiers: MailingMetier[];
  existants: Prospect[];
  optouts: Set<string>;
  onClose: () => void;
  onToast: (m: string) => void;
}) {
  const [metierSlug, setMetierSlug] = useState("plombier");
  const [departement, setDepartement] = useState("44");
  const [metierId, setMetierId] = useState("");
  const [maxPages, setMaxPages] = useState(10);

  const [source, setSource] = useState<"insee" | "annuaire">("insee");
  // Vide par défaut : un code en dur donnait l'illusion qu'un kit était déjà
  // appliqué, alors qu'il ne venait de nulle part.
  const [naf, setNaf] = useState("");
  const [effectifMin, setEffectifMin] = useState(3);
  const [entreprises, setEntreprises] = useState<InfoEntreprise[]>([]);
  const [totalInsee, setTotalInsee] = useState(0);

  const [etat, setEtat] = useState<Etat>("reglages");
  const [progres, setProgres] = useState({ fait: 0, total: 0, libelle: "" });
  const [fiches, setFiches] = useState<FicheArtisan[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const abort = useRef(false);

  const appel = async (corps: Record<string, unknown>) => {
    const token = await getAuth().currentUser?.getIdToken();
    const res = await fetch("/api/annuaire", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(corps),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  };

  /** INSEE : pas d'email, mais un volume sans commune mesure avec l'annuaire. */
  const lancerInsee = async () => {
    setErreur(null);
    abort.current = false;
    setEtat("fiches");
    try {
      const out: InfoEntreprise[] = [];
      let total = 0;
      for (let page = 1; page <= maxPages && !abort.current; page++) {
        const r = await rechercherParCriteres({
          naf, departement: departement.trim() || undefined, effectifMin, page,
        });
        total = r.total;
        setProgres({ fait: page, total: Math.min(maxPages, r.totalPages), libelle: `page ${page}` });
        if (!r.resultats.length) break;
        out.push(...r.resultats.filter((e) => !out.some((x) => x.siren === e.siren)));
        if (page >= r.totalPages) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      setTotalInsee(total);
      setEntreprises(out);
      setChoisis(new Set(out.filter((e) => e.etat !== "C" && !dejaConnu(e)).map((e) => e.siren)));
      setEtat("fini");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de la recherche.");
      setEtat("reglages");
    }
  };

  const dejaConnu = (e: InfoEntreprise) =>
    existants.some((p) => p.siren === e.siren || p.societe.trim().toLowerCase() === e.nom.trim().toLowerCase());

  const lancer = async () => {
    setErreur(null);
    abort.current = false;
    setEtat("liste");
    try {
      // 1. Parcours des pages de la catégorie jusqu'à épuisement.
      const urls: string[] = [];
      for (let page = 1; page <= maxPages && !abort.current; page++) {
        setProgres({ fait: page, total: maxPages, libelle: `page ${page}` });
        const { fiches: trouvees } = await appel({ action: "liste", metier: metierSlug, page });
        const nouvelles = (trouvees as string[]).filter((u) => !urls.includes(u));
        // Deux pages identiques = fin de la pagination, inutile d'insister.
        if (!nouvelles.length) break;
        urls.push(...nouvelles);
      }

      // 2. Détail de chaque fiche, par petits lots.
      setEtat("fiches");
      const out: FicheArtisan[] = [];
      for (let i = 0; i < urls.length && !abort.current; i += FICHES_PAR_APPEL) {
        const lot = urls.slice(i, i + FICHES_PAR_APPEL);
        setProgres({ fait: i, total: urls.length, libelle: `${i}/${urls.length} fiches` });
        const { resultats } = await appel({ action: "fiches", urls: lot });
        out.push(...(resultats as FicheArtisan[]).filter((f) => f.societe));
      }

      setFiches(out);
      // Présélection : uniquement ce qui est réellement exploitable.
      setChoisis(new Set(out.filter((f) => retenu(f)).map((f) => f.url)));
      setEtat("fini");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Échec de l'extraction.");
      setEtat("reglages");
    }
  };

  const dep = departement.trim();

  /** Une fiche n'est exploitable que si elle a un email valide, hors opposition. */
  const retenu = (f: FicheArtisan) => {
    if (!f.email || !isEmailValide(f.email)) return false;
    if (optouts.has(normalizeEmail(f.email))) return false;
    if (existants.some((p) => (p.emailNormalise || normalizeEmail(p.email)) === normalizeEmail(f.email!))) return false;
    if (dep && departementDepuisCp(f.codePostal) !== dep) return false;
    return true;
  };

  const classees = useMemo(() => {
    const ok: FicheArtisan[] = [], hors: FicheArtisan[] = [], sansMail: FicheArtisan[] = [];
    const deja: FicheArtisan[] = [], depInconnu: FicheArtisan[] = [];
    for (const f of fiches) {
      const norm = f.email ? normalizeEmail(f.email) : "";
      if (!f.email || !isEmailValide(f.email)) sansMail.push(f);
      else if (optouts.has(norm) || existants.some((p) => (p.emailNormalise || normalizeEmail(p.email)) === norm)) deja.push(f);
      // Sans code postal, le département est indéterminable. Ces fiches sont
      // isolées plutôt que rangées dans « hors département » : elles sont
      // peut-être bonnes, c'est à l'utilisateur de trancher.
      else if (dep && !departementDepuisCp(f.codePostal)) depInconnu.push(f);
      else if (dep && departementDepuisCp(f.codePostal) !== dep) hors.push(f);
      else ok.push(f);
    }
    return { ok, hors, sansMail, deja, depInconnu };
  }, [fiches, dep, optouts, existants]);

  const importer = async () => {
    const aImporter = fiches.filter((f) => choisis.has(f.url) && f.email);
    if (!aImporter.length) return;
    const kit = metiers.find((m) => m.id === metierId);
    const items: NouveauProspect[] = aImporter.map((f) => ({
      userId,
      societe: f.societe,
      email: normalizeEmail(f.email!),
      telephone: f.telephone,
      codePostal: f.codePostal,
      ville: f.commune,
      metier: kit?.metier ?? f.metier,
      metierId: metierId || undefined,
      // Traçabilité : l'URL de la fiche d'origine, que le passage par Sheets perdait.
      origine: f.url,
    }));
    const n = await createProspectsBatch(items);
    onToast(`${n} prospect(s) importé(s) depuis l'annuaire.`);
    onClose();
  };

  const importerInsee = async () => {
    const kit = metiers.find((m) => m.id === metierId);
    const items: NouveauProspect[] = entreprises
      .filter((e) => choisis.has(e.siren))
      .map((e) => ({
        userId,
        societe: e.nom,
        // Email volontairement vide : le statut « email_manquant » empêche tout
        // envoi tant que la fiche n'est pas complétée.
        email: "",
        statut: "email_manquant" as const,
        codePostal: e.codePostal,
        ville: e.ville,
        metier: kit?.metier,
        metierId: metierId || undefined,
        siret: e.siret,
        siren: e.siren,
        effectifCode: e.effectifCode,
        effectifAnnee: e.effectifAnnee,
        effectifDeLEntreprise: e.effectifDeLEntreprise,
        activiteNaf: e.activiteNaf,
        etatEntreprise: e.etat,
        origine: "Annuaire des entreprises (INSEE)",
      }));
    const n = await createProspectsBatch(items);
    onToast(`${n} prospect(s) importé(s) — email à compléter.`);
    onClose();
  };

  const basculer = (url: string) => {
    const n = new Set(choisis);
    if (n.has(url)) n.delete(url); else n.add(url);
    setChoisis(n);
  };

  return (
    <Modal isOpen onClose={onClose} title="Extraire depuis l'annuaire des artisans" size="lg">
      {etat === "reglages" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([
              { k: "insee", l: "INSEE", d: "Toutes les entreprises, sans email" },
              { k: "annuaire", l: "levraiartisan.fr", d: "Peu d'entreprises, avec email" },
            ] as const).map((s) => (
              <button
                key={s.k}
                onClick={() => setSource(s.k)}
                className={`flex-1 text-left px-3 py-2 rounded-lg border transition ${
                  source === s.k ? "border-blue-500 bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="text-sm font-medium">{s.l}</div>
                <div className="text-[11px] text-gray-500">{s.d}</div>
              </button>
            ))}
          </div>

          {source === "insee" ? (
            <>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Codes NAF</label>
                  {/* Même composant que l'éditeur de kits : les codes s'ajoutent un
                      par un et s'affichent en pastilles, jamais en liste à virgules. */}
                  <ListeCodesNaf valeur={naf} onChange={setNaf} />
                  <p className="text-[11px] text-gray-500 mt-2">
                    Repris du kit métier si tu en choisis un. Plusieurs codes élargissent la
                    recherche : la plomberie donne 196 entreprises dans le Morbihan avec 43.22A
                    et 43.22B, contre 87 avec le seul 43.22B.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Département</label>
                  <input value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="56" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effectif minimum</label>
                  <select
                    value={effectifMin}
                    onChange={(e) => setEffectifMin(Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value={0}>Aucun filtre</option>
                    <option value={1}>1 salarié et +</option>
                    <option value={3}>3 salariés et +</option>
                    <option value={6}>6 salariés et +</option>
                    <option value={10}>10 salariés et +</option>
                    <option value={20}>20 salariés et +</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Kit métier appliqué
                </label>
                <ChoixKit
                  metiers={metiers}
                  valeur={metierId}
                  montrerNaf
                  onChange={(id) => {
                    setMetierId(id);
                    // Synchronisation systématique : ne rien faire quand le kit
                    // choisi n'a pas de codes laissait ceux du kit précédent,
                    // et « Aucun » ne nettoyait pas non plus.
                    setNaf(metiers.find((m) => m.id === id)?.codesNaf?.trim() ?? "");
                  }}
                />
              </div>
              <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2">
                L&apos;INSEE ne publie <strong>aucune adresse email</strong>. Ces prospects arriveront
                au statut « Email à trouver » et ne pourront pas être envoyés tant que tu n&apos;auras
                pas complété leur fiche. Le filtre par effectif sert aussi à rester sous le plafond de
                pagination de l&apos;API.
              </div>
              {erreur && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{erreur}</div>}
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
                  Annuler
                </button>
                <button
                  onClick={lancerInsee}
                  disabled={!naf.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
                >
                  Rechercher
                </button>
              </div>
            </>
          ) : (
          <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Métier (annuaire)</label>
              <input
                value={metierSlug}
                onChange={(e) => setMetierSlug(e.target.value)}
                placeholder="plombier"
                className={inputCls}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Tel qu&apos;il apparaît dans l&apos;URL : plombier, carreleur, macon…
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Département</label>
              <input
                value={departement}
                onChange={(e) => setDepartement(e.target.value)}
                placeholder="44"
                className={inputCls}
              />
              <p className="text-[11px] text-gray-500 mt-1">Vide = tous.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Pages à parcourir</label>
              <input
                type="number"
                min={1}
                max={100}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value) || 1)}
                className={inputCls}
              />
              <p className="text-[11px] text-gray-500 mt-1">10 fiches par page.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Kit métier appliqué</label>
            <ChoixKit metiers={metiers} valeur={metierId} onChange={setMetierId} />
          </div>

          <p className="text-[11px] text-gray-500">
            Le département est déduit du code postal de chaque fiche : l&apos;annuaire ne filtre pas
            côté serveur. Prévois large sur le nombre de pages, puis affine ici.
          </p>

          {erreur && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{erreur}</div>}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
              Annuler
            </button>
            <button
              onClick={lancer}
              disabled={!metierSlug.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              Lancer l&apos;extraction
            </button>
          </div>
          </>
          )}
        </div>
      )}

      {(etat === "liste" || etat === "fiches") && (
        <>
          <div className="text-sm text-gray-600 mb-2">
            {etat === "liste" ? "Recensement des fiches" : "Lecture des fiches"} — {progres.libelle}
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${progres.total ? (progres.fait / progres.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Les requêtes sont espacées volontairement pour ne pas surcharger le site.
          </p>
          <div className="flex justify-end mt-5">
            <button
              onClick={() => { abort.current = true; }}
              className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
            >
              Arrêter
            </button>
          </div>
        </>
      )}

      {etat === "fini" && source === "insee" && (
        <>
          <div className="text-sm text-gray-600 mb-3">
            {entreprises.length} entreprise(s) récupérée(s)
            {totalInsee > entreprises.length && (
              <span className="text-gray-400"> sur {totalInsee} annoncées — augmente les pages ou affine l&apos;effectif</span>
            )}
          </div>
          <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y">
            {entreprises.map((e) => {
              const connu = dejaConnu(e);
              return (
                <label
                  key={e.siren}
                  className={`flex items-start gap-2 px-3 py-2 cursor-pointer ${connu ? "opacity-50" : "hover:bg-gray-50"}`}
                >
                  <input
                    type="checkbox"
                    checked={choisis.has(e.siren)}
                    onChange={() => {
                      const n = new Set(choisis);
                      if (n.has(e.siren)) n.delete(e.siren); else n.add(e.siren);
                      setChoisis(n);
                    }}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{e.nom}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                        {libelleEffectif(e.effectifCode)}
                      </span>
                      {e.etat === "C" && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">cessée</span>
                      )}
                      {connu && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">déjà connu</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {e.codePostal} {e.ville}
                      {e.activiteNaf ? ` · NAF ${e.activiteNaf}` : ""} · SIREN {e.siren}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
              Fermer
            </button>
            <button
              onClick={importerInsee}
              disabled={choisis.size === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              Importer {choisis.size} prospect(s)
            </button>
          </div>
        </>
      )}

      {etat === "fini" && source === "annuaire" && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { l: "Exploitables", v: classees.ok.length },
              { l: "Hors dép.", v: classees.hors.length },
              { l: "Sans email", v: classees.sansMail.length },
              { l: "Déjà connus", v: classees.deja.length },
            ].map((s) => (
              <div key={s.l} className="border rounded-xl px-3 py-2">
                <div className="text-xs text-gray-500">{s.l}</div>
                <div className="text-lg font-semibold">{s.v}</div>
              </div>
            ))}
          </div>

          {classees.depInconnu.length > 0 && (
            <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2 mb-3">
              {classees.depInconnu.length} fiche(s) sans adresse exploitable : département
              indéterminable, donc non présélectionnées. Coche-les à la main si elles
              t&apos;intéressent —{" "}
              {classees.depInconnu.slice(0, 4).map((f) => f.societe).join(", ")}
              {classees.depInconnu.length > 4 ? "…" : ""}
            </div>
          )}

          {classees.ok.length === 0 ? (
            <div className="border rounded-xl px-4 py-8 text-center text-sm text-gray-500">
              Aucune fiche exploitable. Élargis le nombre de pages ou retire le département.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y">
              {classees.ok.map((f) => (
                <label key={f.url} className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={choisis.has(f.url)}
                    onChange={() => basculer(f.url)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{f.societe}</div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {f.email}
                      {f.commune ? ` · ${f.codePostal} ${f.commune}` : ""}
                      {f.telephone ? ` · ${f.telephone}` : ""}
                      {f.email && isEmailGenerique(f.email) ? " · générique" : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
              Fermer
            </button>
            <button
              onClick={importer}
              disabled={choisis.size === 0}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
            >
              Importer {choisis.size} prospect(s)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
