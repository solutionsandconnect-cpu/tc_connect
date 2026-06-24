'use client'

import type { PilotageContrat } from '@/types'
import { computeTarif, stateFromEstimation, fmtEur } from '@/lib/pilotageEstimateur'

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'ok' | 'warn' | 'neutral' }) {
  const c = tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : 'text-gray-800'
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-white">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-lg font-bold ${c}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
    </div>
  )
}

const h3 = 'text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2'

// Fiche de négociation INTERNE (jamais montrée au client) : chiffres nets, planchers, leviers.
export function FicheNego({ contrat }: { contrat: PilotageContrat }) {
  const est =
    contrat.estimations?.find((e) => e.id === contrat.estimationSelectedId) ??
    contrat.estimations?.[0] ??
    contrat.estimation
  // Tarifs « normaux » (catalogue) et nets après remise (ce que le client paie / ce que tu encaisses).
  const prixSetupNormal = contrat.fraisMiseEnPlace ?? 0
  const prixAboNormal = contrat.abonnementMensuel ?? 0
  const remMS = (contrat.remiseMiseEnPlacePct ?? 0) / 100
  const remAbo = (contrat.remiseAbonnementPct ?? 0) / 100
  const prixSetup = Math.round(prixSetupNormal * (1 - remMS))
  const prixAbo = Math.round(prixAboNormal * (1 - remAbo))
  const remiseAn1 = (prixSetupNormal - prixSetup) + (prixAboNormal - prixAbo) * 12
  const options = (contrat.optionsDevis ?? []).filter((o) => (o.label ?? '').trim())
  const exclus = (contrat.projet?.horsPerimetre ?? []).filter((l) => l.trim())
  const ev = contrat.evolution
  const hasEvolution = !!(ev && (ev.intro?.trim() || ev.etapes?.length || ev.panneaux?.length || ev.tableau?.trim()))
  const optPrix = (o: typeof options[number]) =>
    o.prixMin != null && o.prixMax != null ? `${fmtEur(o.prixMin)} – ${fmtEur(o.prixMax)}` : o.prixMin != null ? fmtEur(o.prixMin) : 'sur devis'

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-2 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-red-800">
        <span className="shrink-0">🔒</span>
        <p><strong>Confidentiel — ne pas montrer au client.</strong> Tes chiffres nets, tes planchers et tes leviers pour le rendez-vous (recalculés depuis l&apos;estimation validée du contrat).</p>
      </div>

      <section>
        <h3 className={h3}>Offre proposée au client</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="Mise en service" value={fmtEur(prixSetup)} hint={remMS > 0 ? `tarif normal ${fmtEur(prixSetupNormal)} · −${Math.round(remMS * 100)}%` : undefined} />
          <Stat label="Abonnement" value={`${fmtEur(prixAbo)} /mois`} hint={remAbo > 0 ? `tarif normal ${fmtEur(prixAboNormal)} · −${Math.round(remAbo * 100)}%` : undefined} />
          <Stat label="Total année 1" value={fmtEur(prixSetup + prixAbo * 12)} hint={prixAbo > 0 ? `puis ${fmtEur(prixAbo * 12)} / an` : undefined} />
          {remiseAn1 > 0 && <Stat label="Remise accordée (an 1)" value={`− ${fmtEur(remiseAn1)}`} hint="ce que tu offres au client" tone="warn" />}
        </div>
      </section>

      {est ? (() => {
        const t = computeTarif(stateFromEstimation(est))
        const tauxCot = (est.urssafPct ?? 22) / 100
        const infraMois = contrat.coutFirebaseMensuel ?? est.infra ?? 0
        const netSetup = prixSetup * (1 - tauxCot)
        const netAboMois = prixAbo * (1 - tauxCot) - infraMois
        const margeFaible = prixAbo > 0 && netAboMois < prixAbo * 0.4
        // Comparatif « prix marché » : un freelance/agence facture au TJM marché et repart
        // de zéro (sans tes composants réutilisables → plus de jours, facteur 1,4).
        const round100 = (n: number) => Math.round(n / 100) * 100
        const freelanceLow = round100(t.joursTotal * 400)
        const freelanceHigh = round100(t.joursTotal * 1.4 * 600)
        const sousVendu = prixSetup > 0 && prixSetup < freelanceLow * 0.6
        return (
          <>
            <section>
              <h3 className={h3}>Tes chiffres réels (net)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Net mise en service" value={fmtEur(netSetup)} hint={`après cotisations (${Math.round(tauxCot * 100)} %)`} tone="ok" />
                <Stat label="Net abonnement /mois" value={fmtEur(netAboMois)} hint={`après cotisations + infra (${fmtEur(infraMois)}/mois)`} tone={margeFaible ? 'warn' : 'ok'} />
                <Stat label="Net année 1" value={fmtEur(netSetup + netAboMois * 12)} tone="ok" />
              </div>
              {margeFaible && <p className="text-[11px] text-amber-700 mt-1">⚠️ Marge récurrente faible : l&apos;infra mange une grosse part de l&apos;abonnement.</p>}
            </section>

            <section>
              <h3 className={h3}>Tes planchers (en dessous = à perte)</h3>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Coût de fabrication" value={fmtEur(t.creationBas)} hint="mise en service à prix coûtant (sans marge)" tone="warn" />
                <Stat label="Abonnement plancher" value={`${fmtEur(t.aboPlancher)} /mois`} hint="maintenance + infra + support, au coût" tone="warn" />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Marge de manœuvre : tu peux descendre jusqu&apos;à ~{fmtEur(t.creationBas)} (mise en service) et ~{fmtEur(t.aboPlancher)}/mois (abonnement) avant de travailler à perte.
              </p>
            </section>

            <section>
              <h3 className={h3}>Tes arguments (pour tenir le prix)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Stat label="Prix marché freelance/agence" value={`${fmtEur(freelanceLow)} – ${fmtEur(freelanceHigh)}`} hint={`à neuf, sans base réutilisable (~${Math.round(t.joursTotal)} j × 400–600 €/j)`} tone="ok" />
                {t.valeurAn > 0 && <Stat label="Valeur générée /an" value={`≈ ${fmtEur(t.valeurAn)}`} hint={t.paybackMois ? `rentabilisé en ~${Math.ceil(t.paybackMois)} mois` : 'pour le client'} tone="ok" />}
                <Stat label="Ta conception (au coût)" value={`${fmtEur(t.creationBas)} – ${fmtEur(t.setup)}`} hint="ce que ça t'a coûté à fabriquer" />
              </div>
              {sousVendu ? (
                <p className="text-[11px] text-amber-700 mt-1">
                  ⚠️ <strong>Tu te sous-vends</strong> : tu es à {fmtEur(prixSetup)} alors que le marché est à {fmtEur(freelanceLow)} – {fmtEur(freelanceHigh)}. Ta rapidité (IA + composants réutilisables) doit rester <strong>ta marge</strong>, pas une remise → tu peux monter ton prix. <strong>Ne dis jamais « un autre vous aurait pris 10× plus »</strong> au client (ça te fait passer pour bradé). Positionne-toi en valeur, proche du marché.
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-1">
                  <strong>Repère interne</strong> : le marché pour ce type d&apos;app est à {fmtEur(freelanceLow)} – {fmtEur(freelanceHigh)}. Avec le client, parle <strong>valeur</strong> (pas « moins cher ») et reste proche du marché. Le récurrent = hébergement + maintenance + support, pas une « location ».
                </p>
              )}
            </section>

            <section>
              <h3 className={h3}>Tes leviers de négociation</h3>
              <div className="space-y-3 text-sm text-gray-700">
                {options.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-600">Upsell — options à ressortir :</p>
                    <ul className="list-disc pl-5">{options.map((o, i) => <li key={i}>{o.label} <span className="text-gray-500">({optPrix(o)})</span></li>)}</ul>
                  </div>
                )}
                {exclus.length > 0 && (
                  <div>
                    <p className="font-medium text-gray-600">Hors-périmètre — vendable en plus si demandé :</p>
                    <ul className="list-disc pl-5">{exclus.map((l, i) => <li key={i}>{l}</li>)}</ul>
                  </div>
                )}
                <div>
                  <p className="font-medium text-gray-600">Contreparties à une remise (ne jamais brader « gratuitement ») :</p>
                  <ul className="list-disc pl-5">
                    <li>Engagement 24 mois au lieu de 12.</li>
                    <li>Paiement annuel d&apos;avance.</li>
                    <li>Étude de cas / témoignage / droit de mise en avant.</li>
                  </ul>
                </div>
              </div>
            </section>

            {hasEvolution && (
              <section>
                <h3 className={h3}>↗ Levier revente (potentiel additionnel pour toi){ev?.masqueDevis && <span className="ml-2 text-[10px] font-normal normal-case text-emerald-600">· masqué du devis</span>}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(ev?.etapes ?? []).filter((e) => (e.titre ?? '').trim()).map((e, i) => <Stat key={`e${i}`} label={e.titre} value={e.prix?.trim() || '—'} tone="ok" />)}
                  {(ev?.panneaux ?? []).filter((p) => (p.titre ?? '').trim()).map((p, i) => <Stat key={`p${i}`} label={`${p.reco ? '★ ' : ''}${p.titre}`} value={p.prix?.trim() || '—'} tone="ok" />)}
                </div>
                {ev?.tableau?.trim() && (() => {
                  const lines = ev.tableau.split(/\n/).map((l) => l.trim()).filter(Boolean)
                  if (!lines.length) return null
                  const cells = (l: string) => l.split('|').map((c) => c.trim())
                  const head = cells(lines[0])
                  return (
                    <div className="mt-2 overflow-x-auto">
                      <p className="text-[11px] font-medium text-gray-500 mb-1">Tarifs de revente indicatifs (ce que le client pourrait facturer à SES clients) :</p>
                      <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead><tr className="bg-gray-50">{head.map((c, i) => <th key={i} className={`px-3 py-1.5 text-xs font-semibold text-gray-600 ${i > 0 ? 'text-right' : 'text-left'}`}>{c}</th>)}</tr></thead>
                        <tbody>{lines.slice(1).map((l, ri) => <tr key={ri} className="border-t border-gray-100">{cells(l).map((c, ci) => <td key={ci} className={`px-3 py-1.5 ${ci > 0 ? 'text-right text-gray-700' : 'text-gray-800'}`}>{c}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  )
                })()}
                <p className="text-[11px] text-gray-500 mt-1">Si le client peut équiper d&apos;autres clients : c&apos;est un deal bien plus gros pour toi (industrialisation + licence / part du CA). À pousser s&apos;il a une ambition réseau.</p>
              </section>
            )}

            <section>
              <h3 className={h3}>Vigilance</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
                <li>Plafond micro-entreprise : <strong>77 700 €/an</strong> de CA (services) — surveille ton cumul annuel.</li>
                {infraMois > 0 && <li>Infra : {fmtEur(infraMois)}/mois → vérifie que l&apos;abonnement la couvre largement (sinon le récurrent ne rapporte presque rien).</li>}
                <li>TVA non applicable (franchise 293 B) : ne pas afficher de « HT » sur le devis.</li>
              </ul>
            </section>
          </>
        )
      })() : (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-3">
          Aucune estimation validée → pas de chiffres internes (net, planchers, valeur). Valide une estimation dans l&apos;onglet <strong>Calculateur</strong> pour activer la fiche complète.
        </div>
      )}
    </div>
  )
}
