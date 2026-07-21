"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  listenMetiers, listenProspects, listenOptouts, listenEvenements,
  updateProspect, deleteProspect, ajouterOptout, promouvoirEnClient, journaliser,
  modifierNote, supprimerNote,
} from "@/lib/mailingService";
import AutoTextarea from "@/components/ui/AutoTextarea";
import {
  QUOTA_JOUR, peutContacter, isEmailGenerique, STATUT_LABEL, STATUT_STYLE,
} from "@/lib/mailingModel";
import Modal from "@/components/ui/Modal";
import { libelleEffectif } from "@/lib/sirene";
import ImportModal from "@/components/mailing/ImportModal";
import ProspectModal from "@/components/mailing/ProspectModal";
import StatutModal from "@/components/mailing/StatutModal";
import EnrichirModal from "@/components/mailing/EnrichirModal";
import AnnuaireModal from "@/components/mailing/AnnuaireModal";
import SuiviTab from "@/components/mailing/SuiviTab";
import KitEditor from "@/components/mailing/KitEditor";
import Composeur from "@/components/mailing/Composeur";
import type {
  MailingEvenement, MailingMetier, MailingOptout, Prospect, ProspectStatut,
} from "@/types";
import {
  ArrowUpTrayIcon, PaperAirplaneIcon, RectangleStackIcon, UsersIcon, TrashIcon, PlusIcon,
  PencilIcon, ClockIcon, ChartBarIcon, ChatBubbleLeftEllipsisIcon, BuildingOffice2Icon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

type Onglet = "prospects" | "kits" | "composer" | "suivi";

/** Repères visuels du journal : quatre natures d'événement, quatre couleurs. */
const EVT_LABEL: Record<MailingEvenement["type"], string> = {
  envoi: "ENVOI",
  statut: "STATUT",
  note: "NOTE",
  promotion: "CLIENT",
};

const EVT_STYLE: Record<MailingEvenement["type"], string> = {
  envoi: "bg-blue-100 text-blue-700",
  statut: "bg-indigo-100 text-indigo-700",
  note: "bg-amber-100 text-amber-800",
  promotion: "bg-green-100 text-green-700",
};

/**
 * Compteurs des onglets, mémorisés d'une visite à l'autre.
 * Les listeners Firestore mettent un instant à répondre : sans ce cache, les
 * badges apparaîtraient vides puis sauteraient à leur valeur. On affiche donc
 * la dernière valeur connue jusqu'à l'arrivée des données réelles.
 */
type Compteurs = { prospects: number; kits: number; contactables: number; evenements: number };

const cleCompteurs = (uid: string) => `mailing:compteurs:${uid}`;

/**
 * Renvoie la chaîne BRUTE du stockage, pas l'objet analysé.
 * `useSyncExternalStore` compare les instantanés par identité : rendre un objet
 * fraîchement analysé à chaque appel produit une nouvelle référence à chaque
 * rendu, donc une boucle infinie. Une chaîne, elle, se compare par valeur.
 */
function lireCompteursBrut(uid: string): string | null {
  if (!uid || typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(cleCompteurs(uid));
  } catch {
    return null;
  }
}

function fmtDateHeure(ts?: { toDate: () => Date } | null): string {
  if (!ts) return "—";
  return ts.toDate().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function MailingPage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role_app === "Admin";

  const [onglet, setOnglet] = useState<Onglet>("prospects");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [metiers, setMetiers] = useState<MailingMetier[]>([]);
  const [optouts, setOptouts] = useState<Set<string>>(new Set());
  const [optoutDocs, setOptoutDocs] = useState<MailingOptout[]>([]);
  const [importOuvert, setImportOuvert] = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [enrichOuvert, setEnrichOuvert] = useState(false);
  const [annuaireOuvert, setAnnuaireOuvert] = useState(false);
  /** Les listeners ont-ils répondu ? Distingue « vide » de « pas encore chargé ». */
  const [charge, setCharge] = useState(false);
  const [aEditer, setAEditer] = useState<Prospect | null>(null);
  const [evenements, setEvenements] = useState<MailingEvenement[]>([]);
  const [statutEnCours, setStatutEnCours] = useState<
    { prospect: Prospect; cible?: ProspectStatut } | null
  >(null);
  const [historique, setHistorique] = useState<string | null>(null);
  const [noteEnEdition, setNoteEnEdition] = useState<{ id: string; texte: string } | null>(null);
  const [noteASupprimer, setNoteASupprimer] = useState<string | null>(null);
  const [filtreStatut, setFiltreStatut] = useState<ProspectStatut | "tous">("tous");
  const [filtreMetier, setFiltreMetier] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");
  const [aSupprimer, setASupprimer] = useState<Prospect | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile && !isAdmin) router.replace("/accueil");
  }, [userProfile, isAdmin, router]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const u1 = listenProspects(currentUser.uid, (p) => { setProspects(p); setCharge(true); });
    const u2 = listenMetiers(currentUser.uid, setMetiers);
    const u3 = listenOptouts((set, docs) => { setOptouts(set); setOptoutDocs(docs); });
    const u4 = listenEvenements(currentUser.uid, setEvenements);
    return () => { u1(); u2(); u3(); u4(); };
  }, [currentUser?.uid]);

  const notifier = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  /** Envois du jour : déduit des prospects (un envoi par prospect et par jour). */
  const envoyesAujourdhui = useMemo(() => {
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    return prospects.filter(
      (p) => p.dernierEnvoiAt && p.dernierEnvoiAt.toDate() >= debut,
    ).length;
  }, [prospects]);

  const stats = useMemo(() => {
    const envoyes = prospects.filter((p) => (p.nbEnvois ?? 0) > 0).length;
    const repondus = prospects.filter((p) => p.statut === "repondu").length;
    return {
      total: prospects.length,
      aContacter: prospects.filter((p) => p.statut === "a_contacter").length,
      envoyes,
      repondus,
      taux: envoyes ? Math.round((repondus / envoyes) * 100) : 0,
    };
  }, [prospects]);

  const compteursVifs = useMemo<Compteurs>(
    () => ({
      prospects: prospects.length,
      kits: metiers.length,
      contactables: prospects.filter((p) => peutContacter(p, optouts).ok).length,
      evenements: evenements.length,
    }),
    [prospects, metiers, optouts, evenements],
  );

  // Instantané du navigateur : `useSyncExternalStore` fournit un rendu serveur
  // distinct, ce qui évite l'écart d'hydratation sans setState dans un effet.
  const cacheBrut = useSyncExternalStore(
    () => () => {},
    () => lireCompteursBrut(currentUser?.uid ?? ""),
    () => null,
  );

  // L'analyse est faite ici, une seule fois par valeur stockée.
  const cache = useMemo<Compteurs | null>(() => {
    if (!cacheBrut) return null;
    try {
      return JSON.parse(cacheBrut) as Compteurs;
    } catch {
      return null;
    }
  }, [cacheBrut]);

  const compteurs = charge ? compteursVifs : cache;

  // Écriture du cache : mise à jour d'un système externe, le rôle même d'un effet.
  useEffect(() => {
    if (!charge || !currentUser?.uid) return;
    try {
      window.localStorage.setItem(cleCompteurs(currentUser.uid), JSON.stringify(compteursVifs));
    } catch {
      /* quota plein ou stockage désactivé : les badges restent simplement vifs */
    }
  }, [charge, currentUser?.uid, compteursVifs]);

  const listeFiltree = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return prospects.filter((p) => {
      if (filtreStatut !== "tous" && p.statut !== filtreStatut) return false;
      if (filtreMetier !== "tous" && (p.metierId ?? "") !== filtreMetier) return false;
      if (q && !`${p.societe} ${p.email} ${p.ville ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prospects, filtreStatut, filtreMetier, recherche]);

  const appliquerStatut = async (
    p: Prospect, statut: ProspectStatut, observations: string, logiciel: string,
  ) => {
    // Le nom du logiciel part aussi dans le journal : le champ courant peut
    // changer plus tard, l'événement garde ce qui était vrai ce jour-là.
    const noteLogiciel =
      statut === "a_un_logiciel" && logiciel ? `Logiciel en place : ${logiciel}` : "";
    const obs = [noteLogiciel, observations].filter(Boolean).join(" — ");
    // Journalisé AVANT la mise à jour : `journaliser` lit `dernierEnvoiAt` sur le
    // prospect pour figer le délai de réponse, et l'ancien statut pour la transition.
    await journaliser(p, {
      type: "statut",
      statutAvant: p.statut,
      statutApres: statut,
      observations: obs || undefined,
    });
    await updateProspect(p.id, {
      statut,
      ...(statut === "a_un_logiciel" ? { logicielActuel: logiciel } : {}),
    });
    // Une opposition doit rejoindre le registre global, sinon elle ne survit pas
    // à la suppression du prospect ni à un ré-import de la liste.
    if (statut === "oppose") {
      await ajouterOptout(p.email, "manuel", p.id);
      notifier("Opposition enregistrée dans le registre global.");
    } else if (statut === "bounce") {
      await ajouterOptout(p.email, "bounce", p.id);
      notifier("Adresse en erreur — ajoutée au registre.");
    } else {
      notifier("Statut mis à jour.");
    }
  };

  const ajouterNote = async (p: Prospect, observations: string) => {
    await journaliser(p, { type: "note", observations });
    notifier("Note ajoutée au journal.");
  };

  const promouvoir = async (p: Prospect) => {
    if (!currentUser?.uid) return;
    const { clientId } = await promouvoirEnClient(p, currentUser.uid);
    notifier("Prospect promu en client — visible dans le pipeline CRM.");
    router.push(`/clients?id=${clientId}`);
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    await deleteProspect(aSupprimer.id);
    setASupprimer(null);
    notifier("Prospect supprimé. Une éventuelle opposition reste enregistrée.");
  };

  if (!userProfile || !isAdmin) return null;

  const quotaAtteint = envoyesAujourdhui >= QUOTA_JOUR;

  return (
    <div className="min-h-screen">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium bg-green-600 text-white">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold">Mailing</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Prospection par corps de métier — un message ciblé, en petits volumes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-3 py-2 rounded-lg text-sm ${
              quotaAtteint ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-600"
            }`}
            title="Plafond quotidien : le volume est la première cause de dérive en spam."
          >
            {`${envoyesAujourdhui}/${QUOTA_JOUR} aujourd'hui`}
          </div>
          <button
            onClick={() => setAnnuaireOuvert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
            title="Extraire des artisans depuis l'annuaire public"
          >
            <MagnifyingGlassIcon className="w-4 h-4" /> Annuaire
          </button>
          <button
            onClick={() => setEnrichOuvert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
            title="Compléter effectif, activité et état depuis l'annuaire public des entreprises"
          >
            <BuildingOffice2Icon className="w-4 h-4" /> Enrichir
          </button>
          <button
            onClick={() => setAjoutOuvert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
          >
            <PlusIcon className="w-4 h-4" /> Ajouter un prospect
          </button>
          <button
            onClick={() => setImportOuvert(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            <ArrowUpTrayIcon className="w-4 h-4" /> Importer une liste
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
        {[
          { l: "Prospects", v: stats.total },
          { l: "À contacter", v: stats.aContacter },
          { l: "Contactés", v: stats.envoyes },
          { l: "Réponses", v: stats.repondus },
          { l: "Taux de réponse", v: `${stats.taux} %` },
        ].map((s) => (
          <div key={s.l} className="border rounded-xl px-3 py-2.5 bg-white">
            <div className="text-xs text-gray-500">{s.l}</div>
            <div className="text-lg font-semibold">{s.v}</div>
          </div>
        ))}
      </div>

      {/* La bordure vit sur le conteneur externe : le conteneur défilant peut
          ainsi bloquer l'axe vertical (`overflow-x: auto` force sinon
          `overflow-y: auto`, d'où un scroll haut/bas parasite) sans rogner le
          soulignement de l'onglet actif. */}
      <div className="border-b mb-4">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden -mb-px">
        {([
          { k: "prospects", l: "Prospects", icon: UsersIcon, n: compteurs?.prospects },
          { k: "kits", l: "Kits métier", icon: RectangleStackIcon, n: compteurs?.kits },
          { k: "composer", l: "Composer", icon: PaperAirplaneIcon, n: compteurs?.contactables },
          // Pas de compteur sur Suivi : un nombre d'événements n'apprend rien.
          { k: "suivi", l: "Suivi", icon: ChartBarIcon, n: undefined },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setOnglet(t.k)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              onglet === t.k
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.l}
            {typeof t.n === "number" && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  onglet === t.k ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {t.n}
              </span>
            )}
          </button>
        ))}
        </div>
      </div>

      {onglet === "prospects" && (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher une société, un email, une ville…"
              className="flex-1 min-w-48 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
            />
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value as ProspectStatut | "tous")}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="tous">Tous les statuts</option>
              {(Object.keys(STATUT_LABEL) as ProspectStatut[]).map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
            <select
              value={filtreMetier}
              onChange={(e) => setFiltreMetier(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="tous">Tous les métiers</option>
              {metiers.map((m) => (
                <option key={m.id} value={m.id}>{m.metier}</option>
              ))}
            </select>
          </div>

          {listeFiltree.length === 0 ? (
            <div className="border rounded-xl px-4 py-10 text-center text-sm text-gray-500 bg-white">
              Aucun prospect. Commence par importer une liste CSV.
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden bg-white divide-y">
              {listeFiltree.map((p) => {
                const blocage = peutContacter(p, optouts);
                return (
                  <div key={p.id} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{p.societe}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUT_STYLE[p.statut]}`}>
                          {STATUT_LABEL[p.statut]}
                        </span>
                        {p.effectifCode && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700"
                            title={`Tranche INSEE${p.effectifAnnee ? ` (${p.effectifAnnee})` : ""}${
                              p.effectifDeLEntreprise ? " — au niveau de l'entreprise" : ""
                            }`}
                          >
                            {libelleEffectif(p.effectifCode)}
                          </span>
                        )}
                        {p.logicielActuel && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] bg-purple-50 text-purple-700"
                            title="Logiciel déjà en place"
                          >
                            {p.logicielActuel}
                          </span>
                        )}
                        {p.etatEntreprise === "C" && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-100 text-red-700">
                            société cessée
                          </span>
                        )}
                        {isEmailGenerique(p.email) && (
                          <span
                            className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500"
                            title="Adresse générique : joignable, mais moins bien ciblée qu'une adresse nominative."
                          >
                            générique
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {p.email}
                        {p.metier ? ` · ${p.metier}` : ""}
                        {p.ville ? ` · ${p.ville}` : ""}
                        {(p.nbEnvois ?? 0) > 0 ? ` · ${p.nbEnvois} envoi${(p.nbEnvois ?? 0) > 1 ? "s" : ""}` : ""}
                      </div>
                      {!blocage.ok && (
                        <div className="text-[11px] text-amber-700 mt-0.5">{blocage.raison}</div>
                      )}
                    </div>

                    <select
                      value={p.statut}
                      onChange={(e) =>
                        setStatutEnCours({ prospect: p, cible: e.target.value as ProspectStatut })
                      }
                      className="border rounded-lg px-2 py-1.5 text-xs"
                    >
                      {(Object.keys(STATUT_LABEL) as ProspectStatut[]).map((s) => (
                        <option key={s} value={s}>{STATUT_LABEL[s]}</option>
                      ))}
                    </select>

                    {p.statut === "repondu" && !p.clientId && (
                      <button
                        onClick={() => promouvoir(p)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition"
                      >
                        Promouvoir en client
                      </button>
                    )}

                    <button
                      onClick={() => setStatutEnCours({ prospect: p })}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Ajouter une note"
                    >
                      <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setHistorique(historique === p.id ? null : p.id)}
                      className={`p-1.5 rounded-lg transition ${
                        historique === p.id
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                      }`}
                      title="Historique"
                    >
                      <ClockIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAEditer(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                      title="Modifier"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setASupprimer(p)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Supprimer"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>

                    {historique === p.id && (
                      <div className="w-full mt-1.5 pl-3 border-l-2 border-blue-100 space-y-1.5">
                        {/* Repères toujours disponibles, même pour les prospects
                            antérieurs au journal : eux n'ont aucun événement. */}
                        <div className="text-[11px] text-gray-500 pb-0.5">
                          Créé le {fmtDateHeure(p.createdAt)}
                          {p.dernierEnvoiAt ? (
                            <>
                              {" · "}
                              {(p.nbEnvois ?? 0) > 1 ? "dernier envoi le " : "envoyé le "}
                              <span className="text-gray-700">{fmtDateHeure(p.dernierEnvoiAt)}</span>
                              {(p.nbEnvois ?? 0) > 1 ? ` (${p.nbEnvois} envois)` : ""}
                            </>
                          ) : (
                            <span className="text-gray-400"> · jamais contacté</span>
                          )}
                        </div>
                        {/* Note saisie sur la fiche avant que les notes ne passent
                            au journal : affichée ici pour ne pas la perdre. */}
                        {p.notes?.trim() && (
                          <div className="text-[11px]">
                            <span className="text-gray-400">Note de la fiche</span>
                            <div className="text-gray-600 whitespace-pre-wrap">{p.notes}</div>
                          </div>
                        )}
                        {evenements.filter((e) => e.prospectId === p.id).length === 0 && !p.notes?.trim() ? (
                          <div className="text-[11px] text-gray-400">
                            Aucun événement — le journal a démarré après la création de ce prospect.
                          </div>
                        ) : (
                          evenements
                            .filter((e) => e.prospectId === p.id)
                            .map((e) => (
                              <div key={e.id} className="flex items-start gap-2">
                                <span
                                  className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${EVT_STYLE[e.type]}`}
                                >
                                  {EVT_LABEL[e.type]}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-baseline gap-1.5 flex-wrap text-[11px]">
                                    {e.type === "statut" && e.statutAvant && e.statutApres && (
                                      <span className="flex items-center gap-1">
                                        <span className={`px-1.5 py-0.5 rounded-full ${STATUT_STYLE[e.statutAvant]}`}>
                                          {STATUT_LABEL[e.statutAvant]}
                                        </span>
                                        <span className="text-gray-300">→</span>
                                        <span className={`px-1.5 py-0.5 rounded-full font-medium ${STATUT_STYLE[e.statutApres]}`}>
                                          {STATUT_LABEL[e.statutApres]}
                                        </span>
                                      </span>
                                    )}
                                    <span className="text-gray-400">
                                      {e.createdAt?.toDate().toLocaleDateString("fr-FR", {
                                        day: "2-digit", month: "2-digit", year: "2-digit",
                                      })}
                                    </span>
                                    {typeof e.delaiDepuisEnvoi === "number" && e.type !== "envoi" && (
                                      <span className="text-gray-400">
                                        {`· J+${e.delaiDepuisEnvoi} après l'envoi`}
                                      </span>
                                    )}
                                    {/* Seules les notes sont modifiables : les faits
                                        sont verrouillés côté règles Firestore. */}
                                    {e.type === "note" && (
                                      <span className="ml-auto flex gap-2">
                                        <button
                                          onClick={() => setNoteEnEdition({ id: e.id, texte: e.observations ?? "" })}
                                          className="text-blue-600 hover:underline"
                                        >
                                          modifier
                                        </button>
                                        <button
                                          onClick={() => setNoteASupprimer(e.id)}
                                          className="text-red-600 hover:underline"
                                        >
                                          supprimer
                                        </button>
                                      </span>
                                    )}
                                  </div>
                                  {e.observations && (
                                    <div className="text-[11px] text-gray-700 whitespace-pre-wrap mt-0.5 bg-gray-50 rounded px-2 py-1">
                                      {e.observations}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {optoutDocs.length > 0 && (
            <div className="mt-5 border rounded-xl px-4 py-3 bg-white">
              <div className="text-sm font-medium mb-1">
                Registre d&apos;opposition — {optoutDocs.length} adresse{optoutDocs.length > 1 ? "s" : ""}
              </div>
              <p className="text-xs text-gray-500">
                Global et permanent : ces adresses sont écartées automatiquement à chaque import,
                même si elles reviennent dans un nouveau fichier.
              </p>
            </div>
          )}
        </>
      )}

      {onglet === "kits" && (
        <KitEditor userId={currentUser?.uid ?? ""} metiers={metiers} onToast={notifier} />
      )}

      {onglet === "composer" && (
        <Composeur
          userId={currentUser?.uid ?? ""}
          prospects={prospects}
          metiers={metiers}
          optouts={optouts}
          envoyesAujourdhui={envoyesAujourdhui}
          onToast={notifier}
        />
      )}

      <Modal
        isOpen={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        title="Supprimer ce prospect ?"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          <strong>{aSupprimer?.societe}</strong> sera retiré de la liste de prospection.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Si ce contact s&apos;était opposé, son opposition reste enregistrée dans le registre :
          il ne réapparaîtra pas lors d&apos;un prochain import.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => setASupprimer(null)}
            className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={supprimer}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {onglet === "suivi" && (
        <SuiviTab
          prospects={prospects}
          metiers={metiers}
          evenements={evenements}
          optouts={optouts}
        />
      )}

      <Modal
        isOpen={!!noteEnEdition}
        onClose={() => setNoteEnEdition(null)}
        title="Modifier la note"
        size="sm"
      >
        <AutoTextarea
          value={noteEnEdition?.texte ?? ""}
          onChange={(v) => setNoteEnEdition((n) => (n ? { ...n, texte: v } : n))}
          minRows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition"
        />
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setNoteEnEdition(null)} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={async () => {
              if (!noteEnEdition?.texte.trim()) return;
              await modifierNote(noteEnEdition.id, noteEnEdition.texte.trim());
              setNoteEnEdition(null);
              notifier("Note modifiée.");
            }}
            disabled={!noteEnEdition?.texte.trim()}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40"
          >
            Enregistrer
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={!!noteASupprimer}
        onClose={() => setNoteASupprimer(null)}
        title="Supprimer cette note ?"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Seule la note disparaît. Les envois et changements de statut du journal restent intacts —
          ils ne sont pas modifiables, par choix.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setNoteASupprimer(null)} className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition">
            Annuler
          </button>
          <button
            onClick={async () => {
              if (!noteASupprimer) return;
              await supprimerNote(noteASupprimer);
              setNoteASupprimer(null);
              notifier("Note supprimée.");
            }}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {statutEnCours && (
        <StatutModal
          prospect={statutEnCours.prospect}
          statutCible={statutEnCours.cible}
          labels={STATUT_LABEL}
          onClose={() => setStatutEnCours(null)}
          onValider={async (obs, logiciel) => {
            if (statutEnCours.cible) {
              await appliquerStatut(statutEnCours.prospect, statutEnCours.cible, obs, logiciel);
            } else {
              await ajouterNote(statutEnCours.prospect, obs);
            }
          }}
        />
      )}

      {annuaireOuvert && (
        <AnnuaireModal
          userId={currentUser?.uid ?? ""}
          metiers={metiers}
          existants={prospects}
          optouts={optouts}
          onClose={() => setAnnuaireOuvert(false)}
          onToast={notifier}
        />
      )}

      {enrichOuvert && (
        <EnrichirModal
          prospects={prospects}
          metiers={metiers}
          onClose={() => setEnrichOuvert(false)}
          onToast={notifier}
        />
      )}

      {(ajoutOuvert || aEditer) && (
        <ProspectModal
          // `key` réinitialise les champs entre deux prospects édités d'affilée.
          key={aEditer?.id ?? "nouveau"}
          userId={currentUser?.uid ?? ""}
          metiers={metiers}
          existants={prospects}
          optouts={optouts}
          prospect={aEditer}
          onClose={() => { setAjoutOuvert(false); setAEditer(null); }}
          onToast={notifier}
        />
      )}

      {importOuvert && (
        <ImportModal
          userId={currentUser?.uid ?? ""}
          metiers={metiers}
          existants={prospects}
          optouts={optouts}
          onClose={() => setImportOuvert(false)}
          onToast={notifier}
        />
      )}
    </div>
  );
}
