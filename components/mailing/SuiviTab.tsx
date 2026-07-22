"use client";

import { useMemo, useState } from "react";
import { departementDuCp } from "@/lib/territoires";
import {
  DELAI_RELANCE_JOURS, MAX_RELANCES, STATUT_LABEL, STATUT_STYLE, peutContacter,
} from "@/lib/mailingModel";
import { effectifMinimum, libelleEffectif } from "@/lib/sirene";
import type { MailingEvenement, MailingMetier, Prospect } from "@/types";

/**
 * Nombre de contactés en dessous duquel un taux de réponse ne veut rien dire.
 * Volontairement bas (on parle de prospection artisanale, pas de statistiques) :
 * il sert à écarter le « 1 sur 2 = 50 % » qui ferait basculer toute la stratégie.
 */
const SEUIL_FIABILITE = 15;

const TYPE_LABEL: Record<MailingEvenement["type"], string> = {
  envoi: "Envoi",
  statut: "Statut",
  note: "Note",
  promotion: "Promotion",
  annulation: "Envoi annulé",
};

function fmtDate(ts?: { toDate: () => Date }): string {
  if (!ts) return "";
  return ts.toDate().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export default function SuiviTab({
  prospects, metiers, evenements, optouts,
}: {
  prospects: Prospect[];
  metiers: MailingMetier[];
  evenements: MailingEvenement[];
  optouts: Set<string>;
}) {
  const [niveau, setNiveau] = useState<"region" | "departement">("region");

  /** Par métier : ce que la photo des statuts courants ne peut pas montrer seule. */
  const parMetier = useMemo(() => {
    const lignes = metiers.map((m) => {
      const liste = prospects.filter((p) => p.metierId === m.id);
      const envoyes = liste.filter((p) => (p.nbEnvois ?? 0) > 0).length;
      const repondus = liste.filter((p) => p.statut === "repondu").length;
      const refus = liste.filter((p) => p.statut === "pas_interesse").length;
      return {
        id: m.id, metier: m.metier, total: liste.length, envoyes, repondus, refus,
        taux: envoyes ? Math.round((repondus / envoyes) * 100) : 0,
      };
    });
    const orphelins = prospects.filter((p) => !p.metierId);
    if (orphelins.length) {
      const envoyes = orphelins.filter((p) => (p.nbEnvois ?? 0) > 0).length;
      const repondus = orphelins.filter((p) => p.statut === "repondu").length;
      lignes.push({
        id: "_sans", metier: "Sans métier", total: orphelins.length, envoyes, repondus,
        refus: orphelins.filter((p) => p.statut === "pas_interesse").length,
        taux: envoyes ? Math.round((repondus / envoyes) * 100) : 0,
      });
    }
    return lignes.filter((l) => l.total > 0).sort((a, b) => b.envoyes - a.envoyes);
  }, [prospects, metiers]);

  /** Délai moyen entre l'envoi et la réponse — figé à l'écriture de l'événement. */
  const delaiMoyen = useMemo(() => {
    const delais = evenements
      .filter((e) => e.statutApres === "repondu" && typeof e.delaiDepuisEnvoi === "number")
      .map((e) => e.delaiDepuisEnvoi as number);
    if (!delais.length) return null;
    return Math.round((delais.reduce((a, b) => a + b, 0) / delais.length) * 10) / 10;
  }, [evenements]);

  /** Relançables : délai écoulé, quota de relances non épuisé, pas d'opposition. */
  const aRelancer = useMemo(
    () =>
      prospects
        .filter((p) => p.statut === "envoye" || p.statut === "relance")
        .filter((p) => peutContacter(p, optouts).ok)
        .sort((a, b) => (a.dernierEnvoiAt?.toMillis() ?? 0) - (b.dernierEnvoiAt?.toMillis() ?? 0)),
    [prospects, optouts],
  );

  /** Répartition géographique, au niveau choisi. */
  const parTerritoire = useMemo(() => {
    const par = new Map<string, { total: number; envoyes: number; repondus: number }>();
    for (const p of prospects) {
      const d = departementDuCp(p.codePostal);
      if (!d) continue;
      const cle = niveau === "region" ? d.region : `${d.code} ${d.nom}`;
      const e = par.get(cle) ?? { total: 0, envoyes: 0, repondus: 0 };
      e.total++;
      if ((p.nbEnvois ?? 0) > 0) e.envoyes++;
      if (p.statut === "repondu" || p.statut === "interesse") e.repondus++;
      par.set(cle, e);
    }
    return [...par.entries()]
      .map(([cle, v]) => ({
        cle, ...v,
        taux: v.envoyes ? Math.round((v.repondus / v.envoyes) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [prospects, niveau]);

  /**
   * Répartition par taille d'entreprise (tranche d'effectif INSEE).
   *
   * L'hypothèse à vérifier : le besoin d'outil naît au moment où l'entreprise
   * passe un cap (plannings, devis et chantiers que le carnet ne tient plus).
   * Ce tableau dit lequel de tes segments répond réellement — après quoi les
   * imports INSEE se ciblent dessus.
   *
   * « Non renseigné » est une ligne comme une autre : ce sont les prospects non
   * enrichis, la masquer donnerait l'illusion d'une base complète.
   */
  const parTaille = useMemo(() => {
    const par = new Map<string, { total: number; envoyes: number; repondus: number }>();
    for (const p of prospects) {
      const cle = p.effectifCode ?? "NN";
      const e = par.get(cle) ?? { total: 0, envoyes: 0, repondus: 0 };
      e.total++;
      if ((p.nbEnvois ?? 0) > 0) e.envoyes++;
      if (p.statut === "repondu" || p.statut === "interesse") e.repondus++;
      par.set(cle, e);
    }
    return [...par.entries()]
      .map(([code, v]) => ({
        code,
        libelle: libelleEffectif(code === "NN" ? undefined : code),
        ...v,
        taux: v.envoyes ? Math.round((v.repondus / v.envoyes) * 100) : 0,
        // Un taux calculé sur une poignée d'envois n'est pas un taux : 1 réponse
        // sur 3 afficherait « 33 % » et orienterait toute la prospection à tort.
        fiable: v.envoyes >= SEUIL_FIABILITE,
      }))
      // Par taille croissante, « non renseigné » rejeté à la fin.
      .sort((a, b) =>
        a.code === "NN" ? 1 : b.code === "NN" ? -1 : effectifMinimum(a.code) - effectifMinimum(b.code),
      );
  }, [prospects]);

  /** Regroupement par logiciel déjà en place, insensible à la casse. */
  const logiciels = useMemo(() => {
    const par = new Map<string, Prospect[]>();
    for (const p of prospects) {
      const nom = p.logicielActuel?.trim();
      if (!nom) continue;
      const cle = nom.toLowerCase();
      const liste = par.get(cle) ?? [];
      liste.push(p);
      par.set(cle, liste);
    }
    return [...par.entries()]
      .map(([, liste]) => [liste[0].logicielActuel!.trim(), liste] as [string, Prospect[]])
      .sort((a, b) => b[1].length - a[1].length);
  }, [prospects]);

  /** En attente : envoyés mais le délai de relance n'est pas encore écoulé. */
  const enAttente = prospects.filter(
    (p) => (p.statut === "envoye" || p.statut === "relance") && !peutContacter(p, optouts).ok,
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { l: "Délai moyen de réponse", v: delaiMoyen === null ? "—" : `${delaiMoyen} j` },
          { l: "À relancer", v: aRelancer.length },
          { l: `En attente (< ${DELAI_RELANCE_JOURS} j)`, v: enAttente },
          { l: "Événements journalisés", v: evenements.length },
        ].map((s) => (
          <div key={s.l} className="border rounded-xl px-3 py-2.5 bg-white">
            <div className="text-xs text-gray-500">{s.l}</div>
            <div className="text-lg font-semibold">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">Par corps de métier</div>
        {parMetier.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Aucun prospect pour l&apos;instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left font-medium px-4 py-2">Métier</th>
                  <th className="text-right font-medium px-3 py-2">Prospects</th>
                  <th className="text-right font-medium px-3 py-2">Contactés</th>
                  <th className="text-right font-medium px-3 py-2">Réponses</th>
                  <th className="text-right font-medium px-3 py-2">Refus</th>
                  <th className="text-right font-medium px-4 py-2">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parMetier.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 font-medium">{l.metier}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.total}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.envoyes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.repondus}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.refus}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {l.envoyes ? `${l.taux} %` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2.5 border-t text-[11px] text-gray-500">
          Le taux se lit sur les contactés, pas sur les prospects — un métier peu contacté n&apos;a
          pas de taux significatif.
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-baseline justify-between">
          <span className="text-sm font-medium">Par taille d&apos;entreprise</span>
          <span className="text-xs text-gray-500">tranche d&apos;effectif INSEE</span>
        </div>
        {parTaille.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Aucun prospect pour l&apos;instant.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left font-medium px-4 py-2">Taille</th>
                  <th className="text-right font-medium px-3 py-2">Prospects</th>
                  <th className="text-right font-medium px-3 py-2">Contactés</th>
                  <th className="text-right font-medium px-3 py-2">Réponses</th>
                  <th className="text-right font-medium px-4 py-2">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parTaille.map((l) => (
                  <tr key={l.code} className={l.code === "NN" ? "text-gray-400" : undefined}>
                    <td className="px-4 py-2 font-medium">{l.libelle}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.total}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.envoyes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.repondus}</td>
                    <td className="px-4 py-2 text-right">
                      {!l.envoyes ? (
                        <span className="text-gray-400">—</span>
                      ) : l.fiable ? (
                        <span className="font-semibold">{l.taux} %</span>
                      ) : (
                        <span
                          className="text-gray-400 font-normal"
                          title={`Seulement ${l.envoyes} contacté${l.envoyes > 1 ? "s" : ""} : trop peu pour conclure.`}
                        >
                          {l.taux} %<span className="text-[10px]"> (peu fiable)</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2.5 border-t text-[11px] text-gray-500">
          Un taux n&apos;est affiché en clair qu&apos;à partir de {SEUIL_FIABILITE} contactés : en
          dessous, une seule réponse suffirait à faire croire à un bon segment. « Non renseigné » =
          prospects pas encore passés par « Enrichir ».
        </div>
      </div>

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b flex items-baseline justify-between">
          <span className="text-sm font-medium">À relancer</span>
          <span className="text-xs text-gray-500">
            délai écoulé, {MAX_RELANCES} relances maximum
          </span>
        </div>
        {aRelancer.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Rien à relancer — soit le délai n&apos;est pas écoulé, soit le quota est épuisé.
          </div>
        ) : (
          <div className="divide-y">
            {aRelancer.slice(0, 15).map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.societe}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {p.metier ? `${p.metier} · ` : ""}
                    dernier envoi le {fmtDate(p.dernierEnvoiAt ?? undefined)}
                    {(p.nbEnvois ?? 0) > 1 ? ` · ${(p.nbEnvois ?? 1) - 1} relance(s)` : ""}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUT_STYLE[p.statut]}`}>
                  {STATUT_LABEL[p.statut]}
                </span>
              </div>
            ))}
            {aRelancer.length > 15 && (
              <div className="px-4 py-2 text-[11px] text-gray-500">
                +{aRelancer.length - 15} autre(s) — affichage limité aux 15 plus anciens.
              </div>
            )}
          </div>
        )}
      </div>

      {parTerritoire.length > 0 && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-baseline justify-between">
            <span className="text-sm font-medium">Par territoire</span>
            <button
              onClick={() => setNiveau(niveau === "region" ? "departement" : "region")}
              className="text-xs text-blue-700 hover:underline"
            >
              {niveau === "region" ? "Voir par département" : "Voir par région"}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left font-medium px-4 py-2">
                    {niveau === "region" ? "Région" : "Département"}
                  </th>
                  <th className="text-right font-medium px-3 py-2">Prospects</th>
                  <th className="text-right font-medium px-3 py-2">Contactés</th>
                  <th className="text-right font-medium px-3 py-2">Réponses</th>
                  <th className="text-right font-medium px-4 py-2">Taux</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parTerritoire.map((l) => (
                  <tr key={l.cle}>
                    <td className="px-4 py-2 font-medium">{l.cle}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.total}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.envoyes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{l.repondus}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {l.envoyes ? `${l.taux} %` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t text-[11px] text-gray-500">
            Territoire déduit du code postal. Les prospects sans code postal ne sont pas comptés.
          </div>
        </div>
      )}

      {logiciels.length > 0 && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b flex items-baseline justify-between">
            <span className="text-sm font-medium">Logiciels rencontrés</span>
            <span className="text-xs text-gray-500">contre quoi tu te positionnes</span>
          </div>
          <div className="divide-y">
            {logiciels.map(([nom, liste]) => (
              <div key={nom} className="px-4 py-2.5 flex items-baseline gap-3">
                <span className="text-sm font-medium min-w-[8rem]">{nom}</span>
                <span className="text-xs text-gray-500 flex-1 truncate">
                  {liste.map((p) => p.societe).join(" · ")}
                </span>
                <span className="text-sm font-semibold">{liste.length}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t text-[11px] text-gray-500">
            Ces entreprises ont la douleur et le budget : elles ont déjà payé pour un outil.
            Elles redeviennent intéressantes le jour où le leur les freine.
          </div>
        </div>
      )}

      <div className="border rounded-xl bg-white overflow-hidden">
        <div className="px-4 py-3 border-b text-sm font-medium">Journal récent</div>
        {evenements.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-gray-500">
            Rien encore. Chaque envoi, changement de statut et note s&apos;inscrira ici.
          </div>
        ) : (
          <div className="divide-y">
            {evenements.slice(0, 30).map((e) => (
              <div key={e.id} className="px-4 py-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{e.societe}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
                    {TYPE_LABEL[e.type]}
                  </span>
                  {e.statutAvant && e.statutApres && e.statutAvant !== e.statutApres && (
                    <span className="text-[11px] text-gray-500">
                      {STATUT_LABEL[e.statutAvant]} → {STATUT_LABEL[e.statutApres]}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400 ml-auto">{fmtDate(e.createdAt)}</span>
                </div>
                {e.observations && (
                  <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{e.observations}</div>
                )}
                {typeof e.delaiDepuisEnvoi === "number" && e.type !== "envoi" && (
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    {e.delaiDepuisEnvoi} j après le dernier envoi
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
