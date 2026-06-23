'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { TrashIcon, PlusIcon, PencilIcon, ExclamationTriangleIcon, InformationCircleIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { randomUUID } from '@/lib/uuid'
import { usePilotageCatalogue } from '@/hooks/usePilotageCatalogue'
import type { PilotageEstimation, PilotageSettings } from '@/types'
import {
  TAILLES, DEFAULT_CATALOGUE, DEFAULT_ESTIMATEUR_STATE, FEATURE_AIDES, computeTarif, estimationFromState,
  stateFromEstimation, stateFromSettings, fmtEur,
  type TailleKey, type Feature, type EstimateurState, type TarifResult,
} from '@/lib/pilotageEstimateur'

interface Props {
  initial?: PilotageEstimation | null     // estimation à rejouer/ajuster
  seedNonce?: number                       // change → ré-hydrate depuis `initial`
  defaults?: PilotageSettings | null       // valeurs par défaut globales (si pas d'`initial`)
  onChange?: (estimation: PilotageEstimation, tarif: TarifResult) => void
  footer?: React.ReactNode                 // boutons d'action spécifiques à la page
}

export default function EstimateurTarif({ initial, seedNonce, defaults, onChange, footer }: Props) {
  const init = useRef<EstimateurState>(initial ? stateFromEstimation(initial) : DEFAULT_ESTIMATEUR_STATE).current

  const [mode, setMode] = useState<'metier' | 'revente'>(init.mode)
  const [features, setFeatures] = useState<Feature[]>(init.features)
  const [tjm, setTjm] = useState(init.tjm)
  const [overheadPct, setOverheadPct] = useState(init.overheadPct)
  const [bufferPct, setBufferPct] = useState(init.bufferPct)
  const [maintPct, setMaintPct] = useState(init.maintPct)
  const [calcInfra, setCalcInfra] = useState(init.calcInfra)
  const [supportH, setSupportH] = useState(init.supportH)
  const [heuresGagnees, setHeuresGagnees] = useState(init.heuresGagnees)
  const [coutHoraireClient, setCoutHoraireClient] = useState(init.coutHoraireClient)
  const [partCaptee, setPartCaptee] = useState(init.partCaptee)
  const [premiumRevente, setPremiumRevente] = useState(init.premiumRevente)
  const [nbClientsFinaux, setNbClientsFinaux] = useState(init.nbClientsFinaux)
  const [prixReventeMensuel, setPrixReventeMensuel] = useState(init.prixReventeMensuel)
  const [outilsMensuel, setOutilsMensuel] = useState(init.outilsMensuel)
  const [joursFactures, setJoursFactures] = useState(init.joursFactures)
  const [urssafPct, setUrssafPct] = useState(init.urssafPct)

  const applyState = (st: EstimateurState) => {
    setMode(st.mode); setFeatures(st.features); setTjm(st.tjm); setOverheadPct(st.overheadPct)
    setBufferPct(st.bufferPct); setMaintPct(st.maintPct); setCalcInfra(st.calcInfra); setSupportH(st.supportH)
    setHeuresGagnees(st.heuresGagnees); setCoutHoraireClient(st.coutHoraireClient); setPartCaptee(st.partCaptee)
    setPremiumRevente(st.premiumRevente); setNbClientsFinaux(st.nbClientsFinaux); setPrixReventeMensuel(st.prixReventeMensuel)
    setOutilsMensuel(st.outilsMensuel); setJoursFactures(st.joursFactures); setUrssafPct(st.urssafPct)
  }

  // Applique les valeurs par défaut globales une seule fois (si pas d'estimation initiale fournie)
  const defaultsApplied = useRef(false)
  useEffect(() => {
    if (initial || defaultsApplied.current || !defaults) return
    defaultsApplied.current = true
    applyState(stateFromSettings(defaults))
  }, [defaults, initial])

  // Ré-hydrate depuis `initial` quand le parent bump `seedNonce`
  const lastNonce = useRef(seedNonce)
  useEffect(() => {
    if (seedNonce === lastNonce.current) return
    lastNonce.current = seedNonce
    if (initial) applyState(stateFromEstimation(initial))
  }, [seedNonce, initial])

  const s: EstimateurState = useMemo(() => ({
    mode, features, tjm, overheadPct, bufferPct, maintPct, calcInfra, supportH,
    heuresGagnees, coutHoraireClient, partCaptee, premiumRevente, nbClientsFinaux, prixReventeMensuel,
    outilsMensuel, joursFactures, urssafPct,
  }), [mode, features, tjm, overheadPct, bufferPct, maintPct, calcInfra, supportH,
    heuresGagnees, coutHoraireClient, partCaptee, premiumRevente, nbClientsFinaux, prixReventeMensuel,
    outilsMensuel, joursFactures, urssafPct])

  const tarif = useMemo(() => computeTarif(s), [s])

  // ── Repères « parlants » pour juger l'offre ──
  const eurParJourCreation = tarif.joursTotal > 0 ? tarif.setup / tarif.joursTotal : 0
  const clientsPourMrr = (cible: number) => (tarif.abo > 0 ? Math.ceil(cible / tarif.abo) : null)
  const pctValeurPayee = tarif.valeurMois > 0 ? Math.round((tarif.abo / tarif.valeurMois) * 100) : null
  const aboParJourOuvre = tarif.abo / 22
  const deal = pctValeurPayee == null ? null
    : pctValeurPayee <= 30 ? { label: 'très bon deal pour lui', cls: 'text-green-600' }
    : pctValeurPayee <= 60 ? { label: 'deal correct', cls: 'text-amber-600' }
    : { label: 'prix élevé vs valeur — soigne ton argumentaire', cls: 'text-orange-600' }
  const tauxHoraireEffectif = tarif.joursTotal > 0 ? tarif.setup / (tarif.joursTotal * 7) : 0
  const moisRattrapage = tarif.abo > 0 ? Math.ceil(tarif.setup / tarif.abo) : null
  const roi3ans = tarif.total3ans > 0 && tarif.valeurAn > 0 ? (tarif.valeurAn * 3) / tarif.total3ans : null
  const heuresMois = mode === 'metier' ? (heuresGagnees * 52) / 12 : 0
  const coutHeureRecup = heuresMois > 0 && tarif.abo > 0 ? tarif.abo / heuresMois : null

  // Remonte l'estimation courante + le calcul au parent (sans boucle : onChange via ref)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => { onChangeRef.current?.(estimationFromState(s), tarif) }, [s, tarif])

  // Catalogue de briques (Firestore)
  const { items: catalogueItems, addItem: addCatItem, updateItem: updCatItem, deleteItem: delCatItem } = usePilotageCatalogue()
  const [showCatalogue, setShowCatalogue] = useState(false)
  const [editCatalogue, setEditCatalogue] = useState(false)

  const addFeature = () => setFeatures((f) => [...f, { id: randomUUID(), nom: '', taille: 'm' }])
  const updFeature = (id: string, patch: Partial<Feature>) =>
    setFeatures((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const delFeature = (id: string) => setFeatures((f) => f.filter((x) => x.id !== id))
  const moveFeature = (i: number, dir: -1 | 1) =>
    setFeatures((f) => {
      const j = i + dir
      if (j < 0 || j >= f.length) return f
      const next = f.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const addFromCatalogue = (nom: string, taille: TailleKey) =>
    setFeatures((f) =>
      f.some((x) => x.nom.trim().toLowerCase() === nom.toLowerCase())
        ? f
        : [...f, { id: randomUUID(), nom, taille }])

  const catalogueGroupes = useMemo(() => {
    const map = new Map<string, typeof catalogueItems>()
    for (const it of catalogueItems) {
      const g = it.groupe?.trim() || 'Autres'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(it)
    }
    return Array.from(map, ([groupe, items]) => ({ groupe, items }))
  }, [catalogueItems])

  const seedCatalogue = async () => {
    for (const grp of DEFAULT_CATALOGUE)
      for (const it of grp.items)
        await addCatItem({ nom: it.nom, taille: it.taille, groupe: grp.groupe })
  }

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3 mt-2">
        Découpe l'app en fonctionnalités et estime l'effort de chacune. Le prix se calcule façon freelance :
        jours × TJM + frais de structure + marge d'incertitude. La maintenance se déduit en % du coût de création.
      </p>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5">
        <InformationCircleIcon className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-800/90 leading-relaxed">
          Les jours saisis = <strong>l'effort de référence / la valeur</strong> du travail, pas ton temps réel.
          Ta vitesse avec l'IA est <strong>ta marge</strong>, pas une remise à faire au client.
        </p>
      </div>

      {/* Mode : app métier (client final) vs app à revendre (revendeur / marque blanche) */}
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 mb-1">
        {([
          { key: 'metier', label: 'App métier (client final)' },
          { key: 'revente', label: 'App à revendre (revendeur)' },
        ] as const).map((m) => (
          <button key={m.key} type="button" onClick={() => setMode(m.key)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
              mode === m.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        {mode === 'revente'
          ? 'Tu livres une app que ton client va revendre (marque blanche). Tu factures une prime de droits commerciaux + une part du revenu de revente.'
          : 'Tu livres une app utilisée par le client lui-même. Le prix s\'appuie sur le temps qu\'elle lui fait gagner.'}
      </p>

      {/* Liste des fonctionnalités */}
      <div className="space-y-2">
        {features.map((f, i) => (
          <div key={f.id} className="flex items-center gap-2">
            <div className="flex flex-col shrink-0">
              <button type="button" onClick={() => moveFeature(i, -1)} disabled={i === 0}
                title="Monter"
                className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronUpIcon className="w-4 h-4" /></button>
              <button type="button" onClick={() => moveFeature(i, 1)} disabled={i === features.length - 1}
                title="Descendre"
                className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronDownIcon className="w-4 h-4" /></button>
            </div>
            {FEATURE_AIDES[f.nom.trim()] && (
              <InformationCircleIcon className="w-4 h-4 text-gray-300 hover:text-blue-500 shrink-0 cursor-help" title={FEATURE_AIDES[f.nom.trim()]} />
            )}
            <input type="text" value={f.nom} placeholder="Nom de la fonctionnalité"
              onChange={(e) => updFeature(f.id, { nom: e.target.value })}
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={f.taille} onChange={(e) => updFeature(f.id, { taille: e.target.value as TailleKey })}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {(Object.keys(TAILLES) as TailleKey[]).map((k) => (
                <option key={k} value={k}>{TAILLES[k].label} · {TAILLES[k].jours} j</option>
              ))}
            </select>
            <button type="button" onClick={() => delFeature(f.id)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={addFeature}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition">
            <PlusIcon className="w-3.5 h-3.5" /> Ajouter une ligne vide
          </button>
          <button type="button" onClick={() => setShowCatalogue((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 px-2 py-1 rounded-lg transition">
            <PlusIcon className="w-3.5 h-3.5" /> {showCatalogue ? 'Masquer le catalogue' : 'Ajouter depuis le catalogue'}
          </button>
        </div>
      </div>

      {/* Catalogue de briques (personnalisable, stocké dans Firestore) */}
      {showCatalogue && (
        <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-indigo-700/70">
              {editCatalogue
                ? 'Modifie, ajoute ou supprime tes briques. Les changements sont enregistrés automatiquement.'
                : 'Clique pour ajouter une brique (taille modifiable ensuite). Les déjà ajoutées sont grisées.'}
            </p>
            {catalogueItems.length > 0 && (
              <button type="button" onClick={() => setEditCatalogue((v) => !v)}
                className="flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded-lg transition shrink-0">
                <PencilIcon className="w-3 h-3" /> {editCatalogue ? 'Terminé' : 'Gérer le catalogue'}
              </button>
            )}
          </div>

          {catalogueItems.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-[11px] text-gray-500 mb-2">Ton catalogue est vide.</p>
              <button type="button" onClick={seedCatalogue}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg transition">
                <PlusIcon className="w-3.5 h-3.5" /> Démarrer avec les briques par défaut
              </button>
            </div>
          ) : editCatalogue ? (
            /* ── Mode édition ── */
            <div className="space-y-1.5">
              {catalogueItems.map((it) => (
                <div key={it.id} className="flex items-center gap-1.5 flex-wrap">
                  <input type="text" defaultValue={it.nom} placeholder="Nom de la brique"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.nom) updCatItem(it.id, { nom: v }) }}
                    className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input type="text" defaultValue={it.groupe} placeholder="Groupe"
                    onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.groupe) updCatItem(it.id, { groupe: v }) }}
                    className="w-24 shrink-0 border border-gray-300 rounded-lg px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <select defaultValue={it.taille} title="Complexité / durée"
                    onChange={(e) => updCatItem(it.id, { taille: e.target.value as TailleKey })}
                    className="shrink-0 border border-gray-300 rounded-lg px-1.5 py-1 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {(Object.keys(TAILLES) as TailleKey[]).map((k) => (
                      <option key={k} value={k}>{TAILLES[k].label} · {TAILLES[k].jours}j</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => delCatItem(it.id)}
                    className="p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => addCatItem({ nom: 'Nouvelle brique', taille: 'm', groupe: catalogueItems[catalogueItems.length - 1]?.groupe ?? 'Fonctionnelles' })}
                className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded-lg transition">
                <PlusIcon className="w-3 h-3" /> Ajouter une brique au catalogue
              </button>
            </div>
          ) : (
            /* ── Mode sélection (puces) ── */
            catalogueGroupes.map((grp) => (
              <div key={grp.groupe}>
                <p className="text-[11px] font-semibold text-indigo-800 mb-1.5">{grp.groupe}</p>
                <div className="flex flex-wrap gap-1.5">
                  {grp.items.map((it) => {
                    const deja = features.some((x) => x.nom.trim().toLowerCase() === it.nom.toLowerCase())
                    return (
                      <button key={it.id} type="button" disabled={deja}
                        onClick={() => addFromCatalogue(it.nom, it.taille)}
                        className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition ${
                          deja
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default'
                            : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                        }`}>
                        {deja ? '✓' : <PlusIcon className="w-3 h-3" />} {it.nom}
                        <span className="text-[10px] text-gray-400">· {TAILLES[it.taille].jours}j</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Paramètres */}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs font-medium text-blue-700 list-none flex items-center gap-1.5">
          <span className="inline-block transition group-open:rotate-90">▸</span> À quoi servent ces réglages ?
        </summary>
        <div className="mt-2 text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-1.5">
          <p><strong>TJM</strong> : ton taux par jour. Repère France ≈ 400–650 €/j.</p>
          <p><strong>Frais de structure</strong> : le <strong>temps</strong> non-codé (réunions, gestion, déploiement, tests). En général <strong>+20 %</strong> sur les jours de dev. ⚠️ N'y mets PAS le coût de tes outils (Claude Code…) : ils ont leur propre champ « Outils / abonnements » — sinon tu les comptes deux fois.</p>
          <p><strong>Marge d'incertitude</strong> : coussin contre la sous-estimation — on sous-estime toujours. <strong>+20 à 30 %</strong>. Si tout va bien, c'est de la marge en plus.</p>
          <p><strong>Maintenance /an</strong> : sert à calculer l'abonnement (corrections + petites évolutions + maj techniques). Standard : <strong>15–20 % du prix de création par an</strong>.</p>
          <p><strong>Coût infra /mois</strong> : ce que tu paies chaque mois pour faire tourner l'app (hébergement, Firebase…). S'ajoute au plancher de l'abonnement.</p>
          <p><strong>Support (h/mois)</strong> : heures d'assistance que tu prévois chaque mois. Valorisées à <strong>TJM ÷ 7</strong> (un jour ≈ 7 h facturables) ≈ <strong>{fmtEur(tarif.tauxHoraire)}/h</strong> actuellement. Ça s'ajoute aussi au plancher de l'abonnement.</p>
          <p><strong>Outils / abonnements</strong> : tes coûts mensuels d'outils (ex : Claude Code 100 €/mois). Répartis sur tes « jours facturés / an », ils ajoutent une petite part au TJM pour que <strong>chaque projet les rembourse</strong>. Mets à jour le montant ici si ton forfait évolue.</p>
          <p><strong>Jours facturés / an</strong> : combien de jours tu factures réellement dans l'année (souvent 100–150). Sert à répartir le coût des outils par jour facturé.</p>
          <p><strong>Cotisations URSSAF (%)</strong> : tes charges sociales en % de ce que tu encaisses (micro-entreprise BNC ≈ 24,6 % en 2026). Sert à estimer ce qu'il te reste <strong>net</strong> dans l'encart « Pour t'aider à juger ». Ajuste selon ton régime (et ajoute l'impôt si tu es au versement libératoire).</p>
        </div>
      </details>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
        {([
          { label: 'TJM (€/jour)', val: tjm, set: setTjm, hint: 'ton taux journalier', step: 25, min: 0 },
          { label: 'Frais de structure (%)', val: overheadPct, set: setOverheadPct, hint: 'gestion, réunions, tests, mise en prod', step: 5, min: 0 },
          { label: "Marge d'incertitude (%)", val: bufferPct, set: setBufferPct, hint: 'imprévus / sous-estimation', step: 5, min: 0 },
          { label: 'Maintenance /an (%)', val: maintPct, set: setMaintPct, hint: 'du coût de création (std 15–20)', step: 1, min: 0 },
          { label: 'Coût infra /mois (€)', val: calcInfra, set: setCalcInfra, hint: 'Firebase estimé', step: 1, min: 0 },
          { label: 'Support (h/mois)', val: supportH, set: setSupportH, hint: `assistance · ${fmtEur(tarif.tauxHoraire)}/h (TJM÷7)`, step: 0.5, min: 0 },
          { label: 'Outils / abonnements (€/mois)', val: outilsMensuel, set: setOutilsMensuel, hint: 'ex : Claude Code — dilué dans le prix', step: 10, min: 0 },
          { label: 'Jours facturés / an', val: joursFactures, set: setJoursFactures, hint: 'pour répartir le coût des outils', step: 5, min: 0 },
          { label: 'Cotisations URSSAF (%)', val: urssafPct, set: setUrssafPct, hint: 'micro-BNC ~24,6% en 2026 — sert au net', step: 0.1, min: 0 },
        ] as const).map((f) => (
          <div key={f.label}>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">{f.label}</label>
            <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
              onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
          </div>
        ))}
      </div>
      {outilsMensuel > 0 && joursFactures > 0 && (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 leading-relaxed">
          🛠️ <strong>Coût de tes outils (ex : Claude Code), déjà inclus — rien à reporter ailleurs.</strong><br />
          Calcul : {fmtEur(outilsMensuel)}/mois × 12 ÷ {joursFactures} jours facturés/an = ≈ <strong>{fmtEur(tarif.outilsParJour)}/jour</strong> ajouté au <strong>TJM</strong>. Sur cette estimation, ça gonfle la création d'environ <strong>{fmtEur(tarif.outilsParJour * tarif.joursTotal)}</strong> (et donc un peu la maintenance, qui est un % de la création). C'est <strong>fondu dans les prix ci-dessous</strong> et invisible pour le client.<br />
          <span className="text-gray-400">« Jours facturés / an » = le nombre de jours que tu factures réellement dans l'année (souvent 100–150). Il sert juste à répartir le coût des outils : plus tu factures de jours, plus la part par jour est petite.</span>
        </div>
      )}

      {/* Valeur — selon le mode (métier = temps gagné ; revente = revenu du revendeur) */}
      {mode === 'metier' ? (
      <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <p className="text-xs font-semibold text-amber-800 mb-1">Valeur générée pour le client</p>
        <p className="text-[11px] text-amber-700/70 mb-2">
          Le bon prix ne dépend pas de ton temps mais de ce que l'app rapporte au client. Estime-le ici.
        </p>
        <details className="mb-3 group">
          <summary className="cursor-pointer text-[11px] font-medium text-amber-800 list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> Comment estimer ces chiffres ?
          </summary>
          <div className="mt-2 text-[11px] text-amber-900/80 bg-white/70 border border-amber-100 rounded-lg p-3 space-y-1.5">
            <p>Tu ne devines pas : tu <strong>demandes au client</strong> (c'est le rôle du cadrage). Pas besoin d'être précis, une estimation à la louche suffit.</p>
            <p><strong>Temps gagné/sem</strong> : « combien de temps tu passes aujourd'hui sur [ce que l'app remplace] ? » (ex : devis à la main = ~5h/sem).</p>
            <p><strong>Coût horaire client</strong> : la <em>valeur</em> de son heure, pas son salaire. Patron artisan ≈ 50–80 € (ce qu'il facture) ; salarié ≈ 30–50 €.</p>
            <p><strong>Part captée</strong> : tu prends <strong>10–25 %</strong> de la valeur créée. Le client doit clairement y gagner — c'est pour ça qu'il dit oui.</p>
            <p className="text-amber-700/70">💡 La vraie valeur est souvent plus que le temps gagné : moins d'erreurs, encaissement plus rapide, plus de chantiers signés.</p>
          </div>
        </details>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {([
            { label: 'Temps gagné (h/sem)', val: heuresGagnees, set: setHeuresGagnees, hint: 'pour le client', step: 0.5, min: 0 },
            { label: 'Coût horaire client (€)', val: coutHoraireClient, set: setCoutHoraireClient, hint: 'coût chargé de son heure', step: 5, min: 0 },
            { label: 'Part de valeur captée (%)', val: partCaptee, set: setPartCaptee, hint: 'ta part (std 10–25)', step: 5, min: 0 },
          ] as const).map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium text-amber-800/80 mb-1">{f.label}</label>
              <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                className="w-full border border-amber-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500" />
              <p className="text-[10px] text-amber-700/50 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-amber-800 mt-3">
          → L'app rapporte ~ <strong>{fmtEur(tarif.valeurAn)}/an</strong> au client ({fmtEur(tarif.valeurMois)}/mois).
        </p>
      </div>
      ) : (
      <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
        <p className="text-xs font-semibold text-violet-800 mb-1">Valeur de revente</p>
        <p className="text-[11px] text-violet-700/70 mb-2">
          Ton client revend l'app (marque blanche) à SES clients. Sa valeur, c'est le chiffre d'affaires qu'il en tire — pas du temps gagné.
        </p>
        <details className="mb-3 group">
          <summary className="cursor-pointer text-[11px] font-medium text-violet-800 list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> Comment estimer ces chiffres ?
          </summary>
          <div className="mt-2 text-[11px] text-violet-900/80 bg-white/70 border border-violet-100 rounded-lg p-3 space-y-1.5">
            <p><strong>Clients finaux</strong> : combien de clients le revendeur compte servir avec ton app (sa cible réaliste).</p>
            <p><strong>Prix de revente</strong> : ce qu'il facture chaque client final /mois.</p>
            <p><strong>Prime droits de revente</strong> : tu livres un produit à commercialiser, pas un outil interne → <strong>+30 à 50 %</strong> sur la création (et fais signer une licence / cession de droits claire).</p>
            <p><strong>Part de revenu captée</strong> : ta redevance = une part de SON revenu récurrent (royalty), std <strong>15–25 %</strong>. Il reste largement gagnant — c'est pour ça qu'il accepte.</p>
            <p className="text-violet-700/70">⚠️ Cadre juridiquement : qui possède le code ? licence d'exploitation ? exclusivité ? Ça aussi, ça se facture.</p>
          </div>
        </details>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([
            { label: 'Clients finaux (nb)', val: nbClientsFinaux, set: setNbClientsFinaux, hint: 'cible du revendeur', step: 1, min: 0 },
            { label: 'Prix de revente /mois (€)', val: prixReventeMensuel, set: setPrixReventeMensuel, hint: 'par client final', step: 5, min: 0 },
            { label: 'Prime droits de revente (%)', val: premiumRevente, set: setPremiumRevente, hint: 'sur la création (std 30–50)', step: 5, min: 0 },
            { label: 'Part de revenu captée (%)', val: partCaptee, set: setPartCaptee, hint: 'ta royalty (std 15–25)', step: 5, min: 0 },
          ] as const).map((f) => (
            <div key={f.label}>
              <label className="block text-[11px] font-medium text-violet-800/80 mb-1">{f.label}</label>
              <input type="number" inputMode="decimal" step={f.step} min={f.min} value={f.val}
                onChange={(e) => f.set(Math.max(f.min, Number(e.target.value) || 0))}
                className="w-full border border-violet-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <p className="text-[10px] text-violet-700/50 mt-0.5">{f.hint}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-violet-800 mt-3">
          → Le revendeur encaisse ~ <strong>{fmtEur(tarif.valeurAn)}/an</strong> ({fmtEur(tarif.valeurMois)}/mois) en revendant à {nbClientsFinaux} clients à {fmtEur(prixReventeMensuel)}/mois.
        </p>
      </div>
      )}

      {/* Résultat principal : le récurrent (cœur du modèle) */}
      <div className="mt-4 rounded-xl bg-blue-600 text-white p-4 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-blue-100">{tarif.revente ? 'Redevance /mois — ta part du revenu de revente' : 'Abonnement conseillé /mois — le cœur de ton modèle'}</p>
            <p className="text-3xl font-bold">{fmtEur(tarif.abo)}</p>
          </div>
          <div className="text-right text-[11px] text-blue-100 leading-relaxed">
            <p>plancher au coût : <strong className="text-white">{fmtEur(tarif.aboPlancher)}</strong></p>
            <p>part de la valeur ({partCaptee}%) : <strong className="text-white">{fmtEur(tarif.aboValeur)}</strong></p>
            <p className="mt-0.5">→ retenu : {tarif.aboBase === 'valeur' ? 'la valeur' : 'le plancher'}</p>
          </div>
        </div>
        <p className="text-[11px] text-blue-100/80 mt-2 border-t border-white/15 pt-2">
          On garde le + élevé entre ton coût (maintenance {fmtEur(tarif.maintMensuelle)} + infra {fmtEur(calcInfra)} + support {fmtEur(tarif.supportMensuel)}) et une part de la valeur créée — jamais en dessous du plancher.
        </p>
        {tarif.aboBase === 'cout' && tarif.aboValeur > 0 && (
          <div className="text-[11px] text-amber-100 bg-amber-900/30 rounded-lg px-2.5 py-2 mt-2 leading-relaxed space-y-1.5">
            <p className="font-semibold text-amber-50">💡 Pourquoi changer la valeur ne fait pas bouger le prix ?</p>
            <p>Ton abonnement est toujours <strong>le plus élevé</strong> de ces deux montants :</p>
            <p>
              • ce que l'app te coûte à entretenir chaque mois (maintenance + infra + support) — c'est ton <strong>« plancher au coût »</strong> : <strong>{fmtEur(tarif.aboPlancher)}</strong><br />
              • la part que tu prends sur ce qu'elle rapporte au client — c'est ta <strong>« part de la valeur »</strong> : <strong>{fmtEur(tarif.aboValeur)}</strong>
            </p>
            <p>
              Ici le coût ({fmtEur(tarif.aboPlancher)}) est plus haut que la valeur ({fmtEur(tarif.aboValeur)}), donc <strong>c'est le coût qui fixe le prix</strong>. Tant que ta part de la valeur reste en dessous, {tarif.revente ? 'changer le prix de revente ou le nombre de clients' : 'changer la valeur'} ne modifie pas l'abonnement affiché.
            </p>
            <p>
              Pour que ce soit <strong>la valeur</strong> qui décide du prix (et qu'il monte) : augmente {tarif.revente ? 'le prix de revente, le nombre de clients' : 'la valeur générée'} ou ta <strong>part captée (%)</strong> jusqu'à dépasser {fmtEur(tarif.aboPlancher)}.
            </p>
          </div>
        )}
      </div>

      {/* Création (one-shot) + vision 3 ans */}
      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-4">
          <p className="text-xs text-emerald-700/70">{tarif.revente ? 'Création (forfait, droits de revente inclus)' : 'Création (forfait, one-shot)'}</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtEur(tarif.setup)}</p>
          <p className="text-[11px] text-emerald-600/70 mt-0.5">fourchette {fmtEur(tarif.creationBas)} – {fmtEur(tarif.setup)}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            {tarif.joursDev.toFixed(1)} j dev → {tarif.joursTotal.toFixed(1)} j × {fmtEur(tjm)}/j, +{bufferPct}% d'incertitude{tarif.revente ? `, +${premiumRevente}% droits` : ''}
          </p>
          {tarif.paybackMois != null && tarif.paybackMois > 0 && (
            <p className="text-[10px] text-emerald-700 mt-1">Rentabilisé {tarif.revente ? 'par le revendeur' : 'par le client'} en ~{Math.ceil(tarif.paybackMois)} mois</p>
          )}
        </div>
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
          <p className="text-xs text-indigo-700/70">Valeur du contrat</p>
          <div className="flex items-end gap-4 mt-0.5 flex-wrap">
            <div>
              <p className="text-2xl font-bold text-indigo-700">{fmtEur(tarif.total3ans)}</p>
              <p className="text-[10px] text-gray-500">sur 3 ans · création + abo × 36 mois</p>
            </div>
            <div>
              <p className="text-lg font-bold text-indigo-600/90">{fmtEur(tarif.total1an)}</p>
              <p className="text-[10px] text-gray-500">sur 1 an (court terme) · création + abo × 12</p>
            </div>
          </div>
          <p className="text-[10px] text-indigo-700 mt-1.5"><strong>{tarif.pctRecurrent}%</strong> vient du récurrent (sur 3 ans) — c'est ton fossé, pas le build.</p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
        <ExclamationTriangleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500">
          {tarif.revente
            ? <>En revente, tu vends un <strong>actif que ton client va commercialiser</strong> : prends une prime sur la création <strong>et</strong> une part récurrente de ses revenus (royalty). Cadre les droits par écrit (licence, propriété du code, exclusivité).</>
            : <>Repère : TJM freelance dev en France ≈ <strong>400–650 €/jour</strong>. Mais facture à la <strong>valeur</strong>, pas à ton temps : si l'app rapporte gros au client, le prix juste monte — peu importe que l'IA t'ait fait gagner du temps.</>}
        </p>
      </div>

      {/* Aide à la lecture — « est-ce un bon deal, pour toi et pour le client ? » */}
      <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5 mb-2">
          <InformationCircleIcon className="w-4 h-4" /> Pour t'aider à juger
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Pour toi */}
          <div className="bg-white/70 rounded-lg border border-emerald-100 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Pour toi</p>
            <p className="text-xs text-gray-600">
              Création : <strong>{fmtEur(tarif.setup)}</strong> pour ~{tarif.joursTotal.toFixed(1)} j → soit ≈ <strong>{fmtEur(eurParJourCreation)}/jour</strong> facturé.
              <span className="text-gray-400"> Repère freelance France : 400–650 €/j.</span>
            </p>
            <p className="text-xs text-gray-600">
              Si l'IA te fait réaliser ces {tarif.joursTotal.toFixed(1)} j plus vite, ton gain réel par jour grimpe d'autant — c'est <strong>ta marge</strong>, pas une remise à faire.
            </p>
            <p className="text-xs text-gray-600">
              Récurrent : <strong>{fmtEur(tarif.abo)}/mois</strong> par client → <strong>{fmtEur(tarif.abo * 5)}/mois</strong> avec 5 clients, <strong>{fmtEur(tarif.abo * 10)}/mois</strong> avec 10.
            </p>
            {clientsPourMrr(2000) != null && (
              <p className="text-xs text-gray-600">
                Pour <strong>~2 000 €/mois</strong> de revenu récurrent : il te faut ~<strong>{clientsPourMrr(2000)} clients</strong> sur ce modèle.
              </p>
            )}
            <p className="text-xs text-gray-600">
              Soit un <strong>taux horaire</strong> d'environ <strong>{fmtEur(tauxHoraireEffectif)}/h</strong> sur la création (un jour ≈ 7 h facturables).
            </p>
            {moisRattrapage != null && (
              <p className="text-xs text-gray-600">
                L'abonnement <strong>rattrape le prix de la création</strong> en ~<strong>{moisRattrapage} mois</strong> : ensuite, c'est le récurrent qui fait le gros du revenu de ce client.
              </p>
            )}
            <p className="text-xs text-gray-600">
              Ce client te rapporte <strong>{fmtEur(tarif.total3ans)}</strong> sur 3 ans ({fmtEur(tarif.setup)} de création + {fmtEur(tarif.abo)}/mois).
            </p>
            <p className="text-xs text-gray-700 bg-emerald-100/60 rounded-md px-2 py-1.5">
              <strong>Ce qu'il te reste (net)</strong> : ≈ <strong>{fmtEur(tarif.netSetup)}</strong> sur la création + ≈ <strong>{fmtEur(tarif.netAboMensuel)}/mois</strong> par client — après cotisations ({urssafPct}%) et infra ({fmtEur(calcInfra)}/mois). Détail ci-dessous.
            </p>
          </div>

          {/* Pour le client */}
          <div className="bg-white/70 rounded-lg border border-emerald-100 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Pour le client</p>
            {pctValeurPayee == null ? (
              <p className="text-xs text-gray-500">
                Renseigne la « valeur générée » plus haut pour voir si le prix est intéressant pour lui (sinon on ne juge que tes coûts).
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  L'app lui rapporte ≈ <strong>{fmtEur(tarif.valeurMois)}/mois</strong> ; il paie <strong>{fmtEur(tarif.abo)}/mois</strong> → il garde ≈ <strong>{fmtEur(Math.max(0, tarif.valeurMois - tarif.abo))}/mois</strong>.
                </p>
                <p className="text-xs text-gray-600">
                  Il ne reverse que <strong>{pctValeurPayee}%</strong> de ce que l'app lui rapporte{deal ? <> — <span className={`font-semibold ${deal.cls}`}>{deal.label}</span></> : null}.
                </p>
              </>
            )}
            {tarif.paybackMois != null && tarif.paybackMois > 0 && (
              <p className="text-xs text-gray-600">
                Il rembourse la création en ~<strong>{Math.ceil(tarif.paybackMois)} mois</strong>{tarif.paybackMois <= 6 ? ' (très vite)' : tarif.paybackMois <= 12 ? ' (dans l\'année)' : ''}.
              </p>
            )}
            {roi3ans != null && (
              <p className="text-xs text-gray-600">
                Sur 3 ans, pour <strong>1 €</strong> qu'il met, il en récupère ≈ <strong>{roi3ans.toFixed(1)} €</strong> de valeur.
              </p>
            )}
            {coutHeureRecup != null && (
              <p className="text-xs text-gray-600">
                Concrètement : il récupère ~<strong>{Math.round(heuresMois)} h/mois</strong> pour {fmtEur(tarif.abo)} → l'heure regagnée lui revient à <strong>{fmtEur(coutHeureRecup)}/h</strong>, contre {fmtEur(coutHoraireClient)}/h que vaut son temps.
              </p>
            )}
            <p className="text-xs text-gray-600">
              L'abonnement représente ≈ <strong>{fmtEur(aboParJourOuvre)}/jour ouvré</strong> pour lui.
            </p>
          </div>
        </div>

        <details className="mt-3 group">
          <summary className="cursor-pointer text-[11px] font-medium text-emerald-800 list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> D'autres repères pour situer ton offre
          </summary>
          <div className="mt-2 grid sm:grid-cols-2 gap-3">
            {/* Objectifs de revenu */}
            <div className="bg-white/70 rounded-lg border border-emerald-100 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Combien de clients pour vivre du récurrent ?</p>
              {clientsPourMrr(1000) != null ? (
                <p className="text-xs text-gray-600">
                  Nombre de clients comme celui-ci pour atteindre :<br />
                  • <strong>1 000 €/mois</strong> → ~{clientsPourMrr(1000)} clients<br />
                  • <strong>3 000 €/mois</strong> → ~{clientsPourMrr(3000)} clients<br />
                  • <strong>5 000 €/mois</strong> → ~{clientsPourMrr(5000)} clients
                </p>
              ) : (
                <p className="text-xs text-gray-500">Renseigne un abonnement pour estimer le nombre de clients.</p>
              )}
              <p className="text-xs text-gray-600">
                Revenu récurrent par client : <strong>{fmtEur(tarif.abo * 12)}/an</strong> (hors création).
              </p>
            </div>

            {/* Comparaisons */}
            <div className="bg-white/70 rounded-lg border border-emerald-100 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Comparaisons</p>
              {outilsMensuel > 0 && tarif.total1an > 0 && (
                <p className="text-xs text-gray-600">
                  Tes outils (Claude Code…) te coûtent <strong>{fmtEur(outilsMensuel * 12)}/an</strong> ; rien qu'avec ce client (1re année : {fmtEur(tarif.total1an)}), tu les rembourses <strong>{Math.floor(tarif.total1an / (outilsMensuel * 12))}×</strong>.
                </p>
              )}
              {coutHeureRecup != null && (
                <p className="text-xs text-gray-600">
                  Faire faire ces ~{Math.round(heuresMois)} h/mois par un salarié lui coûterait ≈ <strong>{fmtEur(heuresMois * coutHoraireClient)}/mois</strong> ; ton app les lui rend pour <strong>{fmtEur(tarif.abo)}/mois</strong>.
                </p>
              )}
              <p className="text-xs text-gray-600">
                À <strong>{fmtEur(tarif.abo)}/mois</strong>, tu es dans la fourchette des logiciels métier (souvent 30–150 €/mois) — sauf que le tien est <strong>sur-mesure</strong>, pas générique.
              </p>
            </div>
          </div>

          {/* Du brut au net */}
          <div className="mt-3 bg-white/70 rounded-lg border border-emerald-100 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Du brut au net (ce qu'il te reste vraiment)</p>
            <p className="text-xs text-gray-600">
              Création : {fmtEur(tarif.setup)} − cotisations {urssafPct}% ({fmtEur(tarif.cotisationsSetup)}) = <strong>{fmtEur(tarif.netSetup)}</strong> net.
            </p>
            <p className="text-xs text-gray-600">
              Abonnement : {fmtEur(tarif.abo)}/mois − cotisations ({fmtEur(tarif.cotisationsAboMensuel)}) − infra Firebase/Vercel ({fmtEur(calcInfra)}) = <strong>{fmtEur(tarif.netAboMensuel)}/mois</strong> net.
            </p>
            <p className="text-xs text-gray-600">
              Net par client : <strong>{fmtEur(tarif.netAn1)}</strong> sur 1 an · <strong>{fmtEur(tarif.netAn3)}</strong> sur 3 ans.
            </p>
            {outilsMensuel > 0 && (
              <p className="text-[11px] text-gray-400">
                Tes outils (Claude…) {fmtEur(outilsMensuel)}/mois sont un coût global partagé entre tous tes clients, déjà dilué dans le prix de création — donc pas redéduit ici pour ne pas le compter deux fois.
              </p>
            )}
            <p className="text-[11px] text-gray-400">
              Estimation indicative — hors impôt sur le revenu (sauf si tu intègres le versement libératoire dans le % URSSAF) et hors TVA (franchise en base micro).
            </p>
          </div>
        </details>
      </div>

      {footer}
    </div>
  )
}
