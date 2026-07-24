"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import AutoTextarea from "@/components/ui/AutoTextarea";
import { definirMailPerso } from "@/lib/mailingService";
import { ANGLES, anglesDe, angleLabel } from "@/lib/mailingModel";
import type { MailingMetier, MailPerso, Prospect } from "@/types";

/**
 * Réécriture du mail court POUR UN PROSPECT.
 *
 * On édite les blocs (objet, scène, exemples, question), pas le mail entier :
 * le HTML reste généré par `mailingRender` en tableaux compatibles Outlook, et
 * l'archive `mailing_envois` continue de figer exactement ce qui est parti.
 *
 * Ce qu'on a appris de l'entreprise pendant l'étude est affiché au-dessus des
 * champs : sans ça, on réécrit de mémoire, et l'étude ne sert à rien.
 */
export default function AdapterMailModal({
  prospect, metier, onClose, onToast,
}: {
  prospect: Prospect;
  metier: MailingMetier;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const perso = prospect.mailPerso;
  const [objet, setObjet] = useState(perso?.objet ?? metier.objet ?? "");
  const [scene, setScene] = useState(perso?.scene ?? metier.mailScene ?? "");
  const [exemples, setExemples] = useState(perso?.exemples ?? metier.mailExemples ?? "");
  const [question, setQuestion] = useState(perso?.question ?? metier.mailQuestion ?? "");
  const [enCours, setEnCours] = useState(false);

  const inputCls =
    "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  const enregistrer = async () => {
    setEnCours(true);
    try {
      const maj: MailPerso = { objet, scene, exemples, question };
      await definirMailPerso(prospect.id, maj);
      onToast("Mail adapté à " + prospect.societe + ".");
      onClose();
    } catch {
      onToast("Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  };

  const revenirAuKit = async () => {
    setEnCours(true);
    try {
      await definirMailPerso(prospect.id, null);
      onToast("Retour au mail du métier.");
      onClose();
    } catch {
      onToast("Opération impossible.");
    } finally {
      setEnCours(false);
    }
  };

  // Signaux de l'étude, affichés tels quels — c'est la matière à réutiliser
  const signaux: string[] = [
    prospect.dirigeant ? `Dirigeant : ${prospect.dirigeant}` : "",
    prospect.dirigeantAge ? `Âge : ${prospect.dirigeantAge}` : "",
    prospect.effectifReel ? `${prospect.effectifReel} salariés` : "",
    prospect.responsableAdmin === true ? "Responsable administratif dédié" : "",
    prospect.responsableAdmin === false ? "Pas d'admin dédié (le patron gère tout)" : "",
    prospect.aLogiciel === true ? `Logiciel en place${prospect.logicielActuel ? ` : ${prospect.logicielActuel}` : ""}` : "",
    prospect.aLogiciel === false ? "Aucun logiciel de gestion" : "",
    prospect.enDeveloppement ? "En développement (recrutement, croissance)" : "",
    prospect.siteEtat === "bancal" ? "Site web à refaire" : "",
    prospect.siteEtat === "aucun" ? "Pas de site web" : "",
    prospect.groupe ? `Groupe : ${prospect.groupe}` : "",
  ].filter(Boolean);

  // Tous les angles retenus par l'étude : autant de prises pour ce mail et les relances
  const angles = anglesDe(prospect);

  return (
    <Modal isOpen onClose={onClose} title={`Adapter le mail — ${prospect.societe}`} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Ces blocs remplacent ceux du kit <strong>{metier.metier}</strong> pour cette entreprise
          uniquement, en envoi comme en relance. Un bloc laissé vide retombe sur le kit.
        </p>

        {/* Ce que l'étude a appris */}
        {(signaux.length > 0 || angles.length > 0 || prospect.etudeResume) && (
          <div className="border rounded-lg bg-gray-50/70 p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700">Ce que tu sais d&apos;eux</p>
            {angles.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-700">
                  Angles retenus, du plus fort au moins fort — garde les autres pour les relances :
                </p>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  {angles.map((id) => {
                    const def = ANGLES.find((a) => a.id === id);
                    return (
                      <li key={id}>
                        <strong>{angleLabel(id)}</strong>
                        {def && <span className="text-gray-500"> — {def.quoi}</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {signaux.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {signaux.map((s, i) => (
                  <span key={i} className="text-[11px] bg-white border rounded-full px-2 py-0.5 text-gray-700">
                    {s}
                  </span>
                ))}
              </div>
            )}
            {prospect.etudeResume && (
              <pre className="text-[11px] leading-relaxed bg-white border rounded-lg p-2.5 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-gray-700">
                {prospect.etudeResume}
              </pre>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Objet</label>
          <input value={objet} onChange={(e) => setObjet(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            La scène <span className="text-gray-400">— la situation qu&apos;ils reconnaissent</span>
          </label>
          <AutoTextarea value={scene} onChange={setScene} minRows={4} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Les exemples <span className="text-gray-400">— ce que ça change concrètement</span>
          </label>
          <AutoTextarea value={exemples} onChange={setExemples} minRows={4} className={inputCls} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            La question finale <span className="text-gray-400">— sans elle, aucune raison de répondre</span>
          </label>
          <AutoTextarea value={question} onChange={setQuestion} minRows={2} className={inputCls} />
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          {perso && (
            <button onClick={revenirAuKit} disabled={enCours}
              className="flex-1 border border-amber-300 text-amber-700 py-2.5 rounded-xl text-sm hover:bg-amber-50 transition">
              Revenir au mail du métier
            </button>
          )}
          <button onClick={enregistrer} disabled={enCours}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition">
            {enCours ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
