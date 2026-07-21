"use client";

import { useMemo, useRef, useState } from "react";
import { getAuth } from "firebase/auth";
import Modal from "@/components/ui/Modal";
import { createProspectsBatch, type NouveauProspect } from "@/lib/mailingService";
import { isEmailGenerique, isEmailValide, normalizeEmail } from "@/lib/mailingModel";
import { CATEGORIES, departementDepuisCp, type FicheArtisan } from "@/lib/annuaire";
import {
  METIERS_NAF, libelleEffectif, rechercherParCriteres, type InfoEntreprise,
} from "@/lib/sirene";
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

/** Barre de recherche + filtres, partagée par les deux sources de résultats. */
function BarreFiltres<T extends string>({
  recherche, onRecherche, filtre, onFiltre, affiches, total, onToutCocher, onVider, filtres,
}: {
  recherche: string;
  onRecherche: (v: string) => void;
  filtre: T;
  onFiltre: (v: T) => void;
  affiches: number;
  total: number;
  onToutCocher: () => void;
  onVider: () => void;
  filtres: { k: T; l: string }[];
}) {
  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-sm font-medium">
          {affiches} affiché{affiches > 1 ? "s" : ""}
          <span className="text-gray-400 font-normal"> sur {total} trouvés</span>
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onToutCocher} className="text-xs text-blue-700 hover:underline">
            Tout cocher
          </button>
          <button onClick={onVider} className="text-xs text-gray-500 hover:underline">
            Vider
          </button>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
        <input
          value={recherche}
          onChange={(e) => onRecherche(e.target.value)}
          placeholder="Rechercher une société, une commune…"
          className="flex-1 min-w-40 border rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 transition"
        />
        {filtres.map((f) => (
          <button
            key={f.k}
            onClick={() => onFiltre(f.k)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              filtre === f.k ? "bg-blue-600 text-white" : "border hover:bg-gray-50 text-gray-600"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>
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
  const [categorieId, setCategorieId] = useState(16); // Plombier
  const [lieu, setLieu] = useState("");
  const [lieuResolu, setLieuResolu] = useState("");
  const [rayon, setRayon] = useState(50);
  const [departement, setDepartement] = useState("");
  const [metierId, setMetierId] = useState("");
  const [maxPages] = useState(10);

  const [source, setSource] = useState<"insee" | "annuaire">("insee");
  // Vide par défaut : un code en dur donnait l'illusion qu'un kit était déjà
  // appliqué, alors qu'il ne venait de nulle part.
  const [naf, setNaf] = useState("");
  // Aucun filtre par défaut : le code NAF étant déclaratif, beaucoup de petites
  // structures sont mal classées — filtrer d'emblée sur l'effectif en écarterait
  // encore davantage sans que ce soit visible.
  const [effectifMin, setEffectifMin] = useState(0);
  const [entreprises, setEntreprises] = useState<InfoEntreprise[]>([]);
  const [totalInsee, setTotalInsee] = useState(0);

  // Filtres appliqués aux RÉSULTATS, avant import.
  const [rechRes, setRechRes] = useState("");
  const [filtreRes, setFiltreRes] = useState<"tous" | "importables" | "effectif">("importables");

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

  /**
   * Statut d'une entreprise INSEE vis-à-vis de la base existante.
   * L'INSEE ne fournit pas d'email : la comparaison se fait donc sur le SIREN,
   * puis sur la raison sociale. Et une société dont un contact s'est opposé ne
   * doit jamais revenir par cette porte.
   */
  const etatConnu = (e: InfoEntreprise): "nouveau" | "deja" | "oppose" => {
    const nom = e.nom.trim().toLowerCase();
    const memes = existants.filter(
      (p) => (e.siren && p.siren === e.siren) || (nom && p.societe.trim().toLowerCase() === nom),
    );
    if (!memes.length) return "nouveau";
    if (memes.some((p) => p.statut === "oppose" || optouts.has(p.emailNormalise || normalizeEmail(p.email))))
      return "oppose";
    return "deja";
  };

  const dejaConnu = (e: InfoEntreprise) => etatConnu(e) !== "nouveau";

  const lancer = async () => {
    setErreur(null);
    abort.current = false;
    setEtat("liste");
    try {
      // Géocodage de la commune saisie : la recherche du site ne filtre RIEN
      // sans coordonnées — le seul nom de lieu renvoie zéro résultat.
      let lat: number | undefined, lng: number | undefined;
      if (lieu.trim()) {
        setProgres({ fait: 0, total: 1, libelle: "localisation…" });
        const g = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(lieu.trim())}&limit=1`,
        ).then((r) => (r.ok ? r.json() : null));
        const f = g?.features?.[0];
        if (!f) {
          setErreur(`Commune « ${lieu.trim()} » introuvable. Essaie un nom de ville ou un code postal.`);
          setEtat("reglages");
          return;
        }
        [lng, lat] = f.geometry.coordinates;
        setLieuResolu(f.properties.label);
      }

      // Une seule requête suffit : la page de recherche rend 150 fiches d'un coup.
      setProgres({ fait: 1, total: 1, libelle: "recherche…" });
      const { fiches: trouvees } = await appel({
        action: "recherche", categorieId, lat, lng, distance: rayon,
      });
      const urls: string[] = trouvees as string[];

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

  /** Résultats INSEE après recherche libre et filtre. */
  const entreprisesVues = useMemo(() => {
    const q = rechRes.trim().toLowerCase();
    return entreprises.filter((e) => {
      if (q && !`${e.nom} ${e.ville ?? ""} ${e.codePostal ?? ""} ${e.siren}`.toLowerCase().includes(q))
        return false;
      if (filtreRes === "importables" && etatConnu(e) !== "nouveau") return false;
      if (filtreRes === "effectif" && !e.effectifCode) return false;
      return true;
    });
    // `etatConnu` est recréé à chaque rendu ; ses vraies entrées sont `existants`
    // et `optouts`, qui figurent bien ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entreprises, rechRes, filtreRes, existants, optouts]);

  /** Fiches de l'annuaire après recherche libre. */
  const fichesVues = useMemo(() => {
    const q = rechRes.trim().toLowerCase();
    if (!q) return classees.ok;
    return classees.ok.filter((f) =>
      `${f.societe} ${f.email ?? ""} ${f.commune ?? ""} ${f.codePostal ?? ""}`.toLowerCase().includes(q),
    );
  }, [classees.ok, rechRes]);

  const importerInsee = async () => {
    const kit = metiers.find((m) => m.id === metierId);
    const items: NouveauProspect[] = entreprises
      // Second filet : même si une case était cochée d'une manière ou d'une
      // autre, rien de déjà connu ni d'opposé ne franchit l'import.
      .filter((e) => choisis.has(e.siren) && etatConnu(e) === "nouveau")
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
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Métier <span className="text-gray-400">(remplit les codes pour toi)</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {METIERS_NAF.map((m) => (
                      <button
                        key={m.naf}
                        onClick={() => setNaf(m.naf)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                          naf === m.naf ? "bg-blue-600 text-white" : "border text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Codes NAF <span className="text-gray-400">(ajustables)</span>
                  </label>
                  {/* Même composant que l'éditeur de kits : les codes s'ajoutent un
                      par un et s'affichent en pastilles, jamais en liste à virgules. */}
                  <ListeCodesNaf valeur={naf} onChange={setNaf} />
                  <p className="text-[11px] text-gray-500 mt-2">
                    Choisis un métier ci-dessus, ou saisis les codes à la main. Sélectionner un kit
                    plus bas reprend les siens. Plusieurs codes élargissent la recherche : la
                    plomberie donne 196 entreprises dans le Morbihan avec 43.22A et 43.22B, contre
                    87 avec le seul 43.22B.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Département</label>
                  <input value={departement} onChange={(e) => setDepartement(e.target.value)} placeholder="56" className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Effectif minimum</label>
                  {/* Crans alignés sur les bornes de tranches INSEE : un seuil
                      intermédiaire (5, 15…) serait arrondi et donnerait le même
                      résultat que le cran du dessous. */}
                  <select
                    value={effectifMin}
                    onChange={(e) => setEffectifMin(Number(e.target.value))}
                    className={inputCls}
                  >
                    <option value={0}>Aucun filtre</option>
                    <option value={3}>3 salariés et +</option>
                    <option value={10}>10 salariés et +</option>
                    <option value={20}>20 salariés et +</option>
                    <option value={50}>50 salariés et +</option>
                    <option value={100}>100 salariés et +</option>
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
                    // Le kit ne remplace les codes que s'il en a. Sinon on garde
                    // la saisie en cours — l'effacer détruirait le métier choisi
                    // en pastille — et un avertissement signale que la recherche
                    // ne portera PAS sur le métier du kit.
                    const n = metiers.find((m) => m.id === id)?.codesNaf?.trim();
                    if (n) setNaf(n);
                  }}
                />
              </div>
              {/* Le kit sélectionné n'a pas de codes : la recherche se fera sur
                  ceux affichés, qui ne correspondent pas forcément à son métier. */}
              {/* Espaces explicites via `{" "}` : le JSX les avale au passage à la
                  ligne autour d'une expression, d'où des « Paysagisten'a ». */}
              {metierId && !metiers.find((m) => m.id === metierId)?.codesNaf?.trim() && (
                <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2">
                  {`Le kit « ${metiers.find((m) => m.id === metierId)?.metier ?? ""} » n'a aucun code NAF.`}
                  {" "}
                  {naf.trim()
                    ? `La recherche portera sur les codes ci-dessus (${naf}), pas sur son métier.`
                    : "Choisis un métier ci-dessus ou saisis des codes, sinon la recherche ne donnera rien."}
                  {" "}
                  {"Vérifie qu'ils correspondent, ou renseigne les codes du kit."}
                </div>
              )}

              <div className="rounded-lg bg-amber-50 text-amber-800 text-xs px-3 py-2 leading-relaxed">
                {"L'INSEE ne publie "}
                <strong>aucune adresse email</strong>
                {". Ces prospects arriveront au statut « Email à trouver » et ne pourront pas être "}
                {"envoyés tant que tu n'auras pas complété leur fiche. Seules les sociétés "}
                <strong>encore en activité</strong>
                {" sont remontées, et le filtre par effectif aide à rester sous le plafond de "}
                {"pagination de l'API."}
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Métier</label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategorieId(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    categorieId === c.id ? "bg-blue-600 text-white" : "border text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Autour de</label>
              <input
                value={lieu}
                onChange={(e) => { setLieu(e.target.value); setLieuResolu(""); }}
                placeholder="Pénestin, Nantes, 44000…"
                className={inputCls}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Une commune ou un code postal. Un nom de département ne fonctionne pas.
                Laisse vide pour chercher dans toute la France.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Rayon</label>
              <select value={rayon} onChange={(e) => setRayon(Number(e.target.value))} className={inputCls}>
                {[20, 30, 50, 80, 120, 250].map((r) => (
                  <option key={r} value={r}>{r} km</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Filtrer sur un département <span className="text-gray-400">(facultatif)</span>
            </label>
            <input
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
              placeholder="56"
              className={inputCls}
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Affiné après extraction, sur le code postal de chaque fiche.
            </p>
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
              disabled={!categorieId}
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
            {etat === "liste" ? "Recherche" : "Lecture des fiches"} — {progres.libelle}
          </div>
          {lieuResolu && (
            <div className="text-[11px] text-gray-500 mb-2">
              Centre retenu : <strong>{lieuResolu}</strong> · rayon {rayon} km
            </div>
          )}
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
          <BarreFiltres
            recherche={rechRes}
            onRecherche={setRechRes}
            filtre={filtreRes}
            onFiltre={setFiltreRes}
            affiches={entreprisesVues.length}
            total={entreprises.length}
            onToutCocher={() =>
              setChoisis(new Set(entreprisesVues.filter((e) => etatConnu(e) === "nouveau").map((e) => e.siren)))
            }
            onVider={() => setChoisis(new Set())}
            filtres={[
              { k: "importables", l: "Importables" },
              { k: "effectif", l: "Effectif connu" },
              { k: "tous", l: "Tous" },
            ]}
          />

          <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y">
            {entreprisesVues.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                Aucun résultat avec ces filtres.
              </div>
            )}
            {entreprisesVues.map((e) => {
              const etat = etatConnu(e);
              // Déjà en base ou opposée : la case est verrouillée, pas seulement
              // décochée — sinon un clic distrait recréerait un doublon.
              const bloque = etat !== "nouveau";
              return (
                <label
                  key={e.siren}
                  className={`flex items-start gap-2 px-3 py-2 ${
                    bloque ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={bloque}
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
                      {etat === "deja" && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">déjà dans ta liste</span>
                      )}
                      {etat === "oppose" && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700">opposition enregistrée</span>
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

          {classees.ok.length > 0 && (
            <BarreFiltres
              recherche={rechRes}
              onRecherche={setRechRes}
              filtre={"tous" as const}
              onFiltre={() => {}}
              affiches={fichesVues.length}
              total={classees.ok.length}
              onToutCocher={() => setChoisis(new Set(fichesVues.map((f) => f.url)))}
              onVider={() => setChoisis(new Set())}
              filtres={[]}
            />
          )}

          {fichesVues.length === 0 ? (
            <div className="border rounded-xl px-4 py-8 text-center text-sm text-gray-500">
              {classees.ok.length === 0
                ? "Aucune fiche exploitable. Élargis le rayon ou retire le département."
                : "Aucun résultat pour cette recherche."}
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y">
              {fichesVues.map((f) => (
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
