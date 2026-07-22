"use client";

import { useState } from "react";
import { createMetier, deleteMetier, updateMetier } from "@/lib/mailingService";
import { NB_THEMES_MAIL_DEFAUT, makeToken } from "@/lib/mailingModel";
import { Timestamp } from "firebase/firestore";
import Modal from "@/components/ui/Modal";
import AutoTextarea from "@/components/ui/AutoTextarea";
import ListeCodesNaf from "@/components/mailing/ListeCodesNaf";
import { uploadBlob } from "@/lib/uploadImage";
import { generateBrochurePDFBlob } from "@/lib/brochurePdf";
import type { MailingMetier, MailingSection } from "@/types";
import {
  ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon,
} from "@heroicons/react/24/outline";

const inputCls = "w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 transition";

/**
 * Liste d'items ajoutés un par un.
 * Remplace la saisie « une par ligne » dans un textarea : elle rendait le retour
 * à la ligne impossible (la ligne vide était filtrée à la frappe) et ne montrait
 * pas ce que chaque ligne devenait dans la brochure.
 * Les items vides sont tolérés pendant la saisie et nettoyés à l'enregistrement.
 */
function ListeEditable({
  items, onChange, placeholder, ajouter,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  ajouter: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <span className="mt-2.5 text-gray-300 text-xs select-none">{i + 1}.</span>
          <AutoTextarea
            value={item}
            onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))}
            minRows={1}
            placeholder={placeholder}
            className={inputCls}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
            title="Retirer"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ""])}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed text-xs font-medium text-gray-600 hover:bg-white hover:border-solid transition"
      >
        <PlusIcon className="w-3.5 h-3.5" /> {ajouter}
      </button>
    </div>
  );
}

function sectionVide(ordre: number): MailingSection {
  return {
    id: makeToken().slice(0, 12),
    ordre,
    theme: "",
    problemeMail: "",
    solutionMail: "",
    problemesBrochure: [],
    solutionsBrochure: [],
    afficher: true,
    important: false,
  };
}

export default function KitEditor({
  userId, metiers, onToast,
}: {
  userId: string;
  metiers: MailingMetier[];
  onToast: (m: string) => void;
}) {
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [nouveauNom, setNouveauNom] = useState("");
  const [aSupprimer, setASupprimer] = useState<MailingMetier | null>(null);
  const [enCours, setEnCours] = useState(false);
  const selection = metiers.find((x) => x.id === selectionId) ?? null;

  const nomDejaPris = metiers.some(
    (m) => m.metier.trim().toLowerCase() === nouveauNom.trim().toLowerCase(),
  );
  const nomValide = nouveauNom.trim().length >= 2 && !nomDejaPris;

  const creer = async () => {
    if (!nomValide) return;
    setEnCours(true);
    try {
      const { id } = await createMetier({
        userId,
        metier: nouveauNom.trim(),
        problematiques: "",
        objet: "",
        sections: [],
        nbThemesMail: NB_THEMES_MAIL_DEFAUT,
        actif: true,
      });
      setSelectionId(id);
      setCreation(false);
      setNouveauNom("");
      onToast("Kit métier créé.");
    } finally {
      setEnCours(false);
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    setEnCours(true);
    try {
      await deleteMetier(aSupprimer.id);
      if (selectionId === aSupprimer.id) setSelectionId(null);
      setASupprimer(null);
      onToast("Kit supprimé.");
    } finally {
      setEnCours(false);
    }
  };

  // `[&>*]:min-w-0` : sans ça, la colonne `1fr` prend la largeur de son contenu
  // le plus long (textes d'aide, codes NAF) au lieu de le contraindre, et
  // l'éditeur déborde de l'écran en mobile.
  return (
    <div className="grid lg:grid-cols-[16rem_1fr] gap-4 [&>*]:min-w-0">
      <div>
        <button
          onClick={() => { setNouveauNom(""); setCreation(true); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
        >
          <PlusIcon className="w-4 h-4" /> Nouveau métier
        </button>
        <div className="border rounded-xl bg-white divide-y overflow-hidden">
          {metiers.length === 0 && (
            <div className="px-3 py-6 text-center text-xs text-gray-500">
              Aucun kit. Un kit = les problématiques et les réponses d&apos;un métier.
            </div>
          )}
          {metiers.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectionId(m.id)}
              className={`w-full text-left px-3 py-2.5 transition ${
                selectionId === m.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="text-sm font-medium truncate">{m.metier}</div>
              <div className="text-[11px] text-gray-500">
                {(m.sections ?? []).length} thème{(m.sections ?? []).length > 1 ? "s" : ""}
              </div>
            </button>
          ))}
        </div>
      </div>

      {!selection ? (
        <div className="border rounded-xl px-4 py-12 text-center text-sm text-gray-500 bg-white">
          Sélectionne un métier, ou crées-en un.
        </div>
      ) : (
        // `key` réinitialise le brouillon au changement de kit : l'état d'édition
        // n'est plus synchronisé par un effet, et les mises à jour du listener
        // Firestore n'écrasent pas une saisie en cours.
        <KitForm
          key={selection.id}
          metier={selection}
          onToast={onToast}
          onSupprimer={() => setASupprimer(selection)}
        />
      )}

      <Modal
        isOpen={creation}
        onClose={() => setCreation(false)}
        title="Nouveau corps de métier"
        size="sm"
      >
        <p className="text-sm text-gray-500 mb-3">
          Un kit regroupe les problématiques d&apos;un métier et les réponses que tu y apportes.
          Tu pourras le compléter juste après.
        </p>
        <input
          autoFocus
          value={nouveauNom}
          onChange={(e) => setNouveauNom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && nomValide) creer(); }}
          placeholder="ex. Menuiserie"
          className={inputCls}
        />
        {nomDejaPris && (
          <p className="text-xs text-amber-700 mt-1.5">Un kit porte déjà ce nom.</p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={() => setCreation(false)}
            className="px-4 py-2 rounded-lg text-sm border hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={creer}
            disabled={!nomValide || enCours}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enCours ? "Création…" : "Créer le kit"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={!!aSupprimer}
        onClose={() => setASupprimer(null)}
        title="Supprimer ce kit ?"
        size="sm"
      >
        <p className="text-sm text-gray-600">
          Le kit <strong>{aSupprimer?.metier}</strong> et ses{" "}
          {(aSupprimer?.sections ?? []).length} thème
          {(aSupprimer?.sections ?? []).length > 1 ? "s" : ""} seront supprimés.
          Les prospects rattachés à ce métier, eux, sont conservés.
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
            disabled={enCours}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-40"
          >
            {enCours ? "Suppression…" : "Supprimer"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function KitForm({
  metier, onToast, onSupprimer,
}: {
  metier: MailingMetier;
  onToast: (m: string) => void;
  onSupprimer: () => void;
}) {
  // Les champs texte sont normalisés à l'ouverture : `cleanForFirestore` retire
  // les chaînes vides à l'écriture, donc un kit fraîchement créé revient sans
  // `objet` ni `problematiques`. Sans ce repli, l'input passe de non contrôlé à
  // contrôlé à la première frappe.
  const [brouillon, setBrouillon] = useState<MailingMetier>(() => ({
    ...metier,
    objet: metier.objet ?? "",
    problematiques: metier.problematiques ?? "",
    mailScene: metier.mailScene ?? "",
    mailExemples: metier.mailExemples ?? "",
    mailQuestion: metier.mailQuestion ?? "",
    nbThemesMail: metier.nbThemesMail ?? NB_THEMES_MAIL_DEFAUT,
    sections: (metier.sections ?? []).map((s) => ({
      ...s,
      theme: s.theme ?? "",
      problemeMail: s.problemeMail ?? "",
      solutionMail: s.solutionMail ?? "",
      problemesBrochure: s.problemesBrochure ?? [],
      solutionsBrochure: s.solutionsBrochure ?? [],
    })),
  }));
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const [enregistre, setEnregistre] = useState(false);
  const [brochureEnCours, setBrochureEnCours] = useState(false);
  const [apercu, setApercu] = useState(false);

  /** Le brouillon diffère-t-il de ce qui est en base ? */
  const modifie =
    (brouillon.codesNaf ?? "") !== (metier.codesNaf ?? "") ||
    (brouillon.objet ?? "") !== (metier.objet ?? "") ||
    (brouillon.problematiques ?? "") !== (metier.problematiques ?? "") ||
    (brouillon.mailScene ?? "") !== (metier.mailScene ?? "") ||
    (brouillon.mailExemples ?? "") !== (metier.mailExemples ?? "") ||
    (brouillon.mailQuestion ?? "") !== (metier.mailQuestion ?? "") ||
    (brouillon.nbThemesMail ?? NB_THEMES_MAIL_DEFAUT) !== (metier.nbThemesMail ?? NB_THEMES_MAIL_DEFAUT) ||
    (brouillon.metier ?? "") !== (metier.metier ?? "") ||
    JSON.stringify(brouillon.sections) !== JSON.stringify(metier.sections ?? []);

  // Le kit a-t-il changé depuis la dernière génération ? Même logique que le PDF
  // de devis, qui se marque périmé quand la signature arrive après coup.
  const obsolete =
    !!metier.brochureUrl &&
    (metier.updatedAt?.toMillis() ?? 0) > (metier.brochureGenereeAt?.toMillis() ?? 0);

  const genererBrochure = async () => {
    setBrochureEnCours(true);
    try {
      const blob = await generateBrochurePDFBlob(metier, window.location.origin);
      // Même chemin à chaque fois : Storage écrase, pas d'accumulation de versions.
      const url = await uploadBlob(blob, `users/${metier.userId}/brochures/${metier.id}.pdf`);
      await updateMetier(metier.id, {
        brochureUrl: url,
        brochureGenereeAt: Timestamp.now(),
      });
      onToast("Brochure générée et stockée.");
    } catch {
      onToast("La brochure n'a pas pu être générée.");
    } finally {
      setBrochureEnCours(false);
    }
  };

  const enregistrer = async () => {
    await updateMetier(brouillon.id, {
      metier: brouillon.metier,
      problematiques: brouillon.problematiques,
      objet: brouillon.objet,
      mailScene: brouillon.mailScene ?? "",
      mailExemples: brouillon.mailExemples ?? "",
      mailQuestion: brouillon.mailQuestion ?? "",
      codesNaf: brouillon.codesNaf ?? "",
      nbThemesMail: brouillon.nbThemesMail,
      // Les lignes laissées vides pendant la saisie sont écartées ici plutôt que
      // pendant la frappe, sinon on ne peut pas créer un item avant de l'écrire.
      sections: brouillon.sections.map((s, i) => ({
        ...s,
        ordre: i,
        problemesBrochure: (s.problemesBrochure ?? []).filter((t) => t.trim()),
        solutionsBrochure: (s.solutionsBrochure ?? []).filter((t) => t.trim()),
      })),
    });
    setEnregistre(true);
    setTimeout(() => setEnregistre(false), 2000);
    onToast("Kit enregistré.");
  };

  const majSection = (id: string, patch: Partial<MailingSection>) => {
    setBrouillon((b) => ({
      ...b,
      sections: b.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const deplacer = (index: number, delta: number) => {
    setBrouillon((b) => {
      const arr = [...b.sections];
      const cible = index + delta;
      if (cible < 0 || cible >= arr.length) return b;
      [arr[index], arr[cible]] = [arr[cible], arr[index]];
      return { ...b, sections: arr.map((s, i) => ({ ...s, ordre: i })) };
    });
  };

  const basculer = (id: string) => {
    setOuvertes((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <div className="space-y-4">
      <div className="border rounded-xl bg-white p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">Corps de métier</label>
            <input
              value={brouillon.metier}
              onChange={(e) => setBrouillon({ ...brouillon, metier: e.target.value })}
              className={inputCls}
            />
          </div>
          <button
            onClick={onSupprimer}
            className="mt-6 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
            title="Supprimer ce kit"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Objet du mail</label>
          <input
            value={brouillon.objet}
            onChange={(e) => setBrouillon({ ...brouillon, objet: e.target.value })}
            placeholder="ex. Gagner du temps sur vos devis et vos chantiers"
            className={inputCls}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            <code>{"{societe}"}</code> est remplacé par le nom de l&apos;entreprise.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Problématiques du métier
          </label>
          <AutoTextarea
            value={brouillon.problematiques}
            onChange={(v) => setBrouillon({ ...brouillon, problematiques: v })}
            minRows={2}
            placeholder="ex. entre les devis sur chantier, le suivi des poses et les relances clients"
            className={inputCls}
          />
          <p className="text-[11px] text-gray-500 mt-1">
            S&apos;insère dans la phrase : « gérer une entreprise de {brouillon.metier || "…"} implique
            de jongler <em>…</em> ».
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Codes NAF du métier
          </label>
          <ListeCodesNaf
            valeur={brouillon.codesNaf ?? ""}
            onChange={(v) => setBrouillon({ ...brouillon, codesNaf: v })}
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Un métier en couvre souvent plusieurs : la plomberie, par exemple, se répartit entre
            43.22A (eau et gaz) et 43.22B (chauffage et climatisation). Ces codes servent à deux
            choses — retrouver le SIRET d&apos;un prospect depuis son nom, et lister les entreprises
            d&apos;un département dans l&apos;onglet Annuaire.
          </p>
        </div>

        {/* Format court : tant que les 3 champs ne sont pas tous remplis, le kit
            continue de produire l'ancien mail (cf. estMailCourt). */}
        <div className="border rounded-xl p-4 bg-gray-50/60 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">Mail court (premier contact)</span>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                brouillon.mailScene?.trim() && brouillon.mailExemples?.trim() && brouillon.mailQuestion?.trim()
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {brouillon.mailScene?.trim() && brouillon.mailExemples?.trim() && brouillon.mailQuestion?.trim()
                ? "actif"
                : "inactif — ancien format"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 -mt-1">
            Les trois champs vont ensemble : remplis, ils remplacent les thèmes ci-dessous par un mail
            court. Laissés vides, le kit envoie le format d&apos;origine. Un premier contact obtient
            plus de réponses court, avec une seule scène concrète et une question à la fin — les thèmes
            restent utilisés par la brochure et les relances.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              La scène <span className="text-gray-400">— ce qu&apos;il vit, dans ses mots</span>
            </label>
            <AutoTextarea
              value={brouillon.mailScene ?? ""}
              onChange={(v) => setBrouillon({ ...brouillon, mailScene: v })}
              minRows={3}
              placeholder="ex. Ce qui revient le plus souvent : le planning de la semaine refait le dimanche soir, et le téléphone qui sonne toute la journée depuis les chantiers…"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Les exemples <span className="text-gray-400">— des illustrations, pas un catalogue</span>
            </label>
            <AutoTextarea
              value={brouillon.mailExemples ?? ""}
              onChange={(v) => setBrouillon({ ...brouillon, mailExemples: v })}
              minRows={3}
              placeholder="ex. Je crée des outils sur mesure, et aucun ne se ressemble : chez l'un c'est le planning sur le téléphone, chez un autre le suivi du matériel…"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              La question finale <span className="text-gray-400">— on doit pouvoir y répondre en une ligne</span>
            </label>
            <AutoTextarea
              value={brouillon.mailQuestion ?? ""}
              onChange={(v) => setBrouillon({ ...brouillon, mailQuestion: v })}
              minRows={2}
              placeholder="ex. Est-ce que c'est ça qui vous prend le plus de temps en ce moment, ou c'est ailleurs que ça coince ?"
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Thèmes retenus dans le mail
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={brouillon.nbThemesMail ?? NB_THEMES_MAIL_DEFAUT}
            onChange={(e) => setBrouillon({ ...brouillon, nbThemesMail: Number(e.target.value) || 1 })}
            className="w-24 border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Les thèmes marqués « important » passent en premier. La brochure, elle, déroule tout.
          </p>
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-medium">Thèmes ({brouillon.sections.length})</span>
          <button
            onClick={() =>
              setBrouillon((b) => ({ ...b, sections: [...b.sections, sectionVide(b.sections.length)] }))
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-gray-50 transition"
          >
            <PlusIcon className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>

        {brouillon.sections.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Aucun thème. Un thème = une problématique et sa réponse.
          </div>
        )}

        <div className="divide-y">
          {brouillon.sections.map((s, i) => (
            <div key={s.id}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex flex-col">
                  <button
                    onClick={() => deplacer(i, -1)}
                    disabled={i === 0}
                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25"
                  >
                    <ChevronUpIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deplacer(i, 1)}
                    disabled={i === brouillon.sections.length - 1}
                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-25"
                  >
                    <ChevronDownIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button onClick={() => basculer(s.id)} className="flex-1 min-w-0 text-left">
                  <div className="text-sm font-medium truncate">
                    {s.theme || <span className="text-gray-400">Thème sans titre</span>}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{s.problemeMail}</div>
                </button>
                {s.important && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-700">
                    important
                  </span>
                )}
                {!s.afficher && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-500">
                    masqué
                  </span>
                )}
                <button
                  onClick={() =>
                    setBrouillon((b) => ({ ...b, sections: b.sections.filter((x) => x.id !== s.id) }))
                  }
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>

              {ouvertes.has(s.id) && (
                <div className="px-4 pb-4 space-y-3 bg-gray-50/60">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Titre du thème</label>
                    <input
                      value={s.theme}
                      onChange={(e) => majSection(s.id, { theme: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mail — problème (💢)
                      </label>
                      <AutoTextarea
                        value={s.problemeMail}
                        onChange={(v) => majSection(s.id, { problemeMail: v })}
                        minRows={2}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Mail — réponse (👉)
                      </label>
                      <AutoTextarea
                        value={s.solutionMail}
                        onChange={(v) => majSection(s.id, { solutionMail: v })}
                        minRows={2}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Brochure — problématiques
                      </label>
                      <ListeEditable
                        items={s.problemesBrochure ?? []}
                        onChange={(v) => majSection(s.id, { problemesBrochure: v })}
                        placeholder="ex. Les devis se perdent entre le chantier et le bureau"
                        ajouter="Ajouter une problématique"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Brochure — réponses
                      </label>
                      <ListeEditable
                        items={s.solutionsBrochure ?? []}
                        onChange={(v) => majSection(s.id, { solutionsBrochure: v })}
                        placeholder="ex. Devis créé et signé sur place, depuis le téléphone"
                        ajouter="Ajouter une réponse"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.afficher}
                        onChange={(e) => majSection(s.id, { afficher: e.target.checked })}
                      />
                      Afficher ce thème
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={s.important}
                        onChange={(e) => majSection(s.id, { important: e.target.checked })}
                      />
                      Important (remonte dans le mail)
                    </label>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-xl bg-white p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium">Brochure PDF</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {!metier.brochureUrl
                ? "Pas encore générée."
                : obsolete
                  ? "⚠️ Le kit a été modifié depuis : la brochure stockée est périmée."
                  : `Générée le ${metier.brochureGenereeAt?.toDate().toLocaleDateString("fr-FR")}.`}
            </div>
          </div>
          <div className="flex gap-2">
            {metier.brochureUrl && (
              <button
                onClick={() => setApercu(true)}
                className="px-3 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
              >
                Aperçu
              </button>
            )}
            <button
              onClick={genererBrochure}
              disabled={brochureEnCours}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition disabled:opacity-40 ${
                obsolete || !metier.brochureUrl
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border hover:bg-gray-50"
              }`}
            >
              {brochureEnCours ? "Génération…" : metier.brochureUrl ? "Régénérer" : "Générer"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Le PDF est stocké une fois : le composeur le réutilise au lieu de le recalculer à
          chaque prospect. Régénérer écrase la version précédente.
        </p>
      </div>

      {apercu && metier.brochureUrl && (
        <Modal isOpen onClose={() => setApercu(false)} title={`Brochure — ${metier.metier}`} size="lg">
          <iframe
            src={metier.brochureUrl}
            title="Brochure"
            className="w-full h-[70vh] border rounded-lg bg-gray-50"
          />
          <div className="flex justify-end mt-3">
            <a
              href={metier.brochureUrl}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 rounded-lg border text-sm font-medium hover:bg-gray-50 transition"
            >
              Ouvrir dans un onglet
            </a>
          </div>
        </Modal>
      )}

      {/* Le brouillon ne part en base qu'à l'enregistrement : sans ce rappel,
          on peut changer de kit et perdre sa saisie sans s'en apercevoir. */}
      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-gradient-to-t from-white via-white py-3">
        {modifie && (
          <span className="text-xs text-amber-700 font-medium">
            Modifications non enregistrées
          </span>
        )}
        <button
          onClick={enregistrer}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
            modifie
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "border text-gray-500 hover:bg-gray-50"
          }`}
        >
          {enregistre ? "Enregistré ✓" : "Enregistrer le kit"}
        </button>
      </div>
    </div>
  );
}
