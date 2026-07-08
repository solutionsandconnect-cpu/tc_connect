'use client'

import type { DevisEvolution, DevisEvolutionEtape, DevisEvolutionPanneau } from '@/types'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const lbl = 'block text-[11px] font-medium text-gray-600 mb-1'

// Modèle de départ générique (revente / licence) — chargé en 1 clic puis adapté.
export const DEFAULT_EVOLUTION: DevisEvolution = {
  titre: 'Évolution possible — revente / licence',
  tag: 'Informatif · non inclus',
  intro: "Question fréquente : « et si, demain, vous vouliez proposer cette solution à d'autres ? » La réponse ci-dessous est donnée à titre indicatif — ce volet ne fait pas partie du présent devis et pourra faire l'objet d'un devis dédié le moment venu.",
  qaQuestion: 'Est-ce techniquement possible ?',
  qaDetail: "La solution peut être industrialisée pour servir plusieurs clients (architecture multi-tenant), sans réécriture — seulement une phase d'industrialisation.",
  qaReponse: 'Oui ✓',
  etapes: [
    {
      titre: 'Industrialisation multi-clients',
      description: "Provisioning automatisé d'un nouveau client · isolation & sécurité renforcées · scalabilité (montée en charge, maîtrise des coûts) · facturation des abonnements · back-office revendeur.",
      prix: '10 000 – 18 000 €',
    },
  ],
  panneaux: [
    {
      titre: 'Licence + part sur le chiffre d\'affaires',
      reco: true,
      items: [
        "Droit d'entrée pour revendre la solution",
        'Puis un % sur chaque abonnement encaissé',
        'Revenus alignés sur les ventes — fort potentiel si le réseau grandit',
      ],
      prix: 'Licence 12 000 – 18 000 € + 20 à 30 % du CA',
    },
    {
      titre: 'Forfait par client déployé',
      items: [
        'Un forfait par client installé',
        '+ un petit mensuel par client (hébergement & maintenance)',
        'Simple & prévisible — gain plafonné par le nombre de clients',
      ],
      prix: '1 000 – 3 000 € / client + 50 – 150 € / client / mois',
    },
  ],
  tableau: 'Offre | Tarif indicatif\nFormule Essentiel | ~149 €/mois\nFormule Pro | ~299 €/mois\nMise en service par client | 500 – 1 500 €',
  note: "Dans tous les cas, Enezo conserve la propriété de la solution ; le client en devient revendeur / partenaire sous licence. Les tarifs sont indicatifs ; le modèle définitif est arrêté dans un devis distinct.",
}

// Éditeur de la section « Évolution » du devis (bloc structuré : intro, Q/R, étapes, panneaux, tableau, note).
export function EvolutionEditor({ value, onChange }: { value: DevisEvolution; onChange: (v: DevisEvolution) => void }) {
  const v = value
  const upd = (patch: Partial<DevisEvolution>) => onChange({ ...v, ...patch })

  const etapes = v.etapes ?? []
  const updEtape = (i: number, patch: Partial<DevisEvolutionEtape>) => upd({ etapes: etapes.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })

  const panneaux = v.panneaux ?? []
  const updPan = (i: number, patch: Partial<DevisEvolutionPanneau>) => upd({ panneaux: panneaux.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) })

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <span className="shrink-0 mt-0.5">💡</span>
        <div>
          <p><strong>À n&apos;utiliser que si le client peut revendre l&apos;app à d&apos;autres</strong> (revente / white-label, ex : une académie qui équiperait d&apos;autres clubs).</p>
          <p className="mt-1 text-amber-700">C&apos;est une <strong>section commerciale lue par le client</strong> — pas une note interne. Pour un devis PME classique (le client veut SON app), <strong>laisse tout vide</strong> : la section n&apos;apparaît pas sur le devis.</p>
        </div>
      </div>

      <label className="flex items-start gap-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 cursor-pointer select-none">
        <input type="checkbox" checked={!!v.masqueDevis} onChange={(e) => upd({ masqueDevis: e.target.checked })}
          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
        <span><strong>Masquer du devis</strong> — garde ces infos <strong>uniquement sur ta Fiche négo interne</strong> (le client ne les voit pas sur son devis). Pratique pour préparer ton argumentaire revente sans le montrer.</span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={lbl}>Titre de section</label><input className={inp} value={v.titre ?? ''} onChange={(e) => upd({ titre: e.target.value })} placeholder="Évolution possible" /></div>
        <div><label className={lbl}>Pastille</label><input className={inp} value={v.tag ?? ''} onChange={(e) => upd({ tag: e.target.value })} placeholder="Informatif · non inclus" /></div>
      </div>
      <div><label className={lbl}>Introduction</label><textarea rows={2} className={inp} value={v.intro ?? ''} onChange={(e) => upd({ intro: e.target.value })} placeholder="Paragraphe d'introduction…" /></div>

      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-600">Question / réponse (encadré)</p>
        <input className={inp} value={v.qaQuestion ?? ''} onChange={(e) => upd({ qaQuestion: e.target.value })} placeholder="Est-ce techniquement possible ?" />
        <textarea rows={2} className={inp} value={v.qaDetail ?? ''} onChange={(e) => upd({ qaDetail: e.target.value })} placeholder="Détail sous la question…" />
        <input className={`${inp} sm:max-w-[160px]`} value={v.qaReponse ?? ''} onChange={(e) => upd({ qaReponse: e.target.value })} placeholder="Oui ✓" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Étapes chiffrées</p>
        {etapes.map((e, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className={inp} value={e.titre} onChange={(ev) => updEtape(i, { titre: ev.target.value })} placeholder="Titre de l'étape" />
              <button onClick={() => upd({ etapes: etapes.filter((_, idx) => idx !== i) })} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0" title="Supprimer l'étape"><TrashIcon className="w-4 h-4" /></button>
            </div>
            <textarea rows={2} className={inp} value={e.description ?? ''} onChange={(ev) => updEtape(i, { description: ev.target.value })} placeholder="Description (optionnel)" />
            <input className={`${inp} sm:max-w-[240px]`} value={e.prix ?? ''} onChange={(ev) => updEtape(i, { prix: ev.target.value })} placeholder="Prix (ex : 10 000 – 18 000 €)" />
          </div>
        ))}
        <button onClick={() => upd({ etapes: [...etapes, { titre: '' }] })} className="flex items-center gap-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"><PlusIcon className="w-4 h-4" /> Ajouter une étape</button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-600">Panneaux (modèles / options en 2 colonnes)</p>
        {panneaux.map((p, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input className={inp} value={p.titre} onChange={(ev) => updPan(i, { titre: ev.target.value })} placeholder="Titre (ex : B1 — Licence + % CA)" />
              <button onClick={() => upd({ panneaux: panneaux.filter((_, idx) => idx !== i) })} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0" title="Supprimer le panneau"><TrashIcon className="w-4 h-4" /></button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none"><input type="checkbox" checked={!!p.reco} onChange={(ev) => updPan(i, { reco: ev.target.checked })} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /> Marquer « ★ Recommandé »</label>
            <textarea rows={3} className={inp} value={(p.items ?? []).join('\n')} onChange={(ev) => updPan(i, { items: ev.target.value.split('\n') })} placeholder="Un point par ligne…" />
            <input className={`${inp} sm:max-w-[300px]`} value={p.prix ?? ''} onChange={(ev) => updPan(i, { prix: ev.target.value })} placeholder="Prix (ex : Licence 12 000 € + 20 % du CA)" />
          </div>
        ))}
        <button onClick={() => upd({ panneaux: [...panneaux, { titre: '', items: [] }] })} className="flex items-center gap-1.5 text-sm font-medium text-blue-700 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition"><PlusIcon className="w-4 h-4" /> Ajouter un panneau</button>
      </div>

      <div>
        <label className={lbl}>Tableau de prix <span className="font-normal text-gray-400">— 1 ligne par rangée, cellules séparées par « | », 1ʳᵉ ligne = en-têtes</span></label>
        <textarea rows={4} className={`${inp} font-mono text-xs`} value={v.tableau ?? ''} onChange={(e) => upd({ tableau: e.target.value })}
          placeholder={'Offre | Europe | Afrique de l\'Ouest\nClub Essentiel | ~149 €/mois | ~38 – 76 €/mois\nClub Pro | ~299 €/mois | ~90 – 137 €/mois'} />
      </div>

      <div><label className={lbl}>Note de bas de section</label><textarea rows={2} className={inp} value={v.note ?? ''} onChange={(e) => upd({ note: e.target.value })} placeholder="Précision finale (ex : modèle arrêté dans un devis distinct)…" /></div>
    </div>
  )
}
