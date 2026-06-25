'use client'

import { useMemo, useState } from 'react'
import { ServerStackIcon } from '@heroicons/react/24/outline'
import type { InfraInputs } from '@/types'

// Tarifs Firebase (plan Blaze) — ordres de grandeur publics, facturés en $ (≈ € pour une estimation).
// Firestore : free 50k lectures/j, 20k écritures/j, 1 Gio stockage. Au-delà : 0,06 $/100k lectures, 0,18 $/100k écritures.
// Cloud Storage : free 5 Go stockés + 1 Go/j de téléchargement. Au-delà : 0,026 $/Go/mois stocké, 0,12 $/Go téléchargé.
const RATE = {
  read: 0.06 / 100_000,
  write: 0.18 / 100_000,
  storageGo: 0.026,
  egressGo: 0.12,
}
const FREE = {
  readsMois: 50_000 * 30,
  writesMois: 20_000 * 30,
  storageGo: 5,
  egressGoMois: 1 * 30,
}

const fmt = (n: number) =>
  n < 1 ? '< 1 €' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

type Champ = { key: keyof typeof DEFAULTS; label: string; hint: string; step: number }

const DEFAULTS = {
  users: 50,
  sessionsMois: 30,
  lecturesSession: 60,
  ecrituresSession: 5,
  stockageFichiersGo: 2,
  stockageVideoGo: 0,
  bandePassanteSessionMo: 3,
  vercelMensuel: 7,   // hébergement web Vercel : part du plan Pro (~19 €) amortie + buffer (éditable)
}

const CHAMPS: Champ[] = [
  { key: 'users', label: 'Utilisateurs actifs / mois', hint: 'qui ouvrent vraiment l’app — ex : 50', step: 5 },
  { key: 'sessionsMois', label: 'Ouvertures / utilisateur / mois', hint: 'nombre réel — ex : 30 = ~1×/jour ouvré', step: 1 },
  { key: 'lecturesSession', label: 'Lectures de données / session', hint: 'docs chargés / écran — ex : 60', step: 5 },
  { key: 'ecrituresSession', label: 'Écritures / session', hint: 'saisies créées/modifiées — ex : 5', step: 1 },
  { key: 'stockageFichiersGo', label: 'Stockage fichiers/photos (Go)', hint: 'total cumulé', step: 1 },
  { key: 'stockageVideoGo', label: 'Stockage vidéo (Go)', hint: 'poste lourd si analyse vidéo', step: 5 },
  { key: 'bandePassanteSessionMo', label: 'Téléchargé / session (Mo)', hint: 'images/vidéos servies', step: 1 },
]

// Repères « combien mettre » par champ (affichés dans l'aide dépliable).
const AIDE: { champ: string; desc: string; exemples: [string, string][] }[] = [
  { champ: 'Utilisateurs actifs / mois', desc: 'Personnes différentes qui ouvrent vraiment l’app dans le mois.', exemples: [['Petite structure', '20 – 50'], ['Centre de formation', '50 – 150'], ['Grosse structure', '200+']] },
  { champ: 'Ouvertures / utilisateur / mois', desc: 'À quelle fréquence chacun ouvre l’app (nombre réel).', exemples: [['Occasionnel (hebdo)', '4 – 8'], ['Régulier (~1×/jour)', '20 – 30'], ['Intensif (plusieurs ×/jour)', '40 – 90']] },
  { champ: 'Lectures de données / session', desc: 'Éléments chargés à l’ouverture (chaque ligne d’une liste = 1).', exemples: [['App simple', '10 – 30'], ['Listes + détails', '40 – 80'], ['Tableaux de bord riches', '100 – 200+']] },
  { champ: 'Écritures / session', desc: 'Enregistrements créés/modifiés par visite.', exemples: [['Consultation surtout', '0 – 2'], ['Saisie régulière', '3 – 8'], ['Saisie intensive', '10 – 20']] },
  { champ: 'Stockage fichiers/photos (Go)', desc: 'Total CUMULÉ des fichiers/photos (pas par session).', exemples: [['Pas de média', '0'], ['Quelques docs/photos', '1 – 5 Go'], ['Beaucoup de photos', '10 – 50+ Go']] },
  { champ: 'Stockage vidéo (Go)', desc: '⚠️ Laisse 0 : la vidéo va sur un service séparé (R2), pas Firebase. Voir « Vidéo » ci-dessous.', exemples: [] },
  { champ: 'Téléchargé / session (Mo)', desc: 'Média (images/fichiers) servis à chaque ouverture. 1 photo ≈ 0,2–0,5 Mo.', exemples: [['Surtout texte / listes', '0,5 – 1 Mo'], ['Quelques photos (courant)', '2 – 5 Mo'], ['Beaucoup d’images', '5 – 20 Mo'], ['Vidéo', '50 – 500+ Mo']] },
]

export default function InfraCostEstimator(
  { initial, onCommit }: { initial?: Partial<InfraInputs>; onCommit?: (inputs: InfraInputs, central: number) => void } = {},
) {
  const [v, setV] = useState<InfraInputs>({ ...DEFAULTS, ...(initial ?? {}) })
  const set = (k: keyof typeof DEFAULTS, val: number) => setV((p) => ({ ...p, [k]: Math.max(0, val) }))

  const r = useMemo(() => {
    const sessions = v.users * v.sessionsMois
    const reads = sessions * v.lecturesSession
    const writes = sessions * v.ecrituresSession
    const stockageGo = v.stockageFichiersGo + v.stockageVideoGo
    const egressGo = (sessions * v.bandePassanteSessionMo) / 1024

    const cRead = Math.max(0, reads - FREE.readsMois) * RATE.read
    const cWrite = Math.max(0, writes - FREE.writesMois) * RATE.write
    const cStorage = Math.max(0, stockageGo - FREE.storageGo) * RATE.storageGo
    const cEgress = Math.max(0, egressGo - FREE.egressGoMois) * RATE.egressGo
    const firebaseTotal = cRead + cWrite + cStorage + cEgress
    const vercel = Math.max(0, v.vercelMensuel ?? 0)   // coût FIXE : ajouté hors fourchette ×0.6/×1.6
    const total = firebaseTotal + vercel

    const sousFree = total < 0.5
    return {
      reads, writes, stockageGo, egressGo,
      lignes: [
        { l: 'Firestore — lectures', c: cRead, d: `${(reads / 1_000_000).toFixed(1)} M/mois` },
        { l: 'Firestore — écritures', c: cWrite, d: `${(writes / 1_000_000).toFixed(2)} M/mois` },
        { l: 'Stockage fichiers/vidéo', c: cStorage, d: `${stockageGo.toFixed(0)} Go` },
        { l: 'Bande passante (téléchargement)', c: cEgress, d: `${egressGo.toFixed(0)} Go/mois` },
        { l: 'Hébergement web (Vercel)', c: vercel, d: 'forfait /mois' },
      ],
      total,
      bas: firebaseTotal * 0.6 + vercel,
      haut: firebaseTotal * 1.6 + vercel,
      sousFree,
    }
  }, [v])

  return (
    <details className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-semibold text-gray-700">
        <span className="inline-block transition group-open:rotate-90 text-gray-400">▸</span>
        <ServerStackIcon className="w-4 h-4 text-orange-600" /> Estimation des coûts d’infrastructure (Firebase)
      </summary>
      <p className="text-xs text-gray-400 mb-4 mt-2">
        Indicatif — fourchette large. Saisis des valeurs <strong>moyennes</strong> pour un ordre de grandeur du coût mensuel d’hébergement. Toutes les valeurs sont des <strong>nombres réels</strong> (ex : 30 ouvertures = ~1×/jour, <em>pas</em> 30 000).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CHAMPS.map((f) => (
          <div key={f.key}>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">{f.label}</label>
            <input type="number" inputMode="decimal" step={f.step} min={0} value={v[f.key]}
              onChange={(e) => set(f.key, Number(e.target.value) || 0)}
              onBlur={() => onCommit?.(v, r.total)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 max-w-xs">
        <label className="block text-[11px] font-medium text-gray-600 mb-1">Hébergement web — Vercel (€/mois)</label>
        <input type="number" inputMode="decimal" step={1} min={0} value={v.vercelMensuel ?? 0}
          onChange={(e) => set('vercelMensuel', Number(e.target.value) || 0)}
          onBlur={() => onCommit?.(v, r.total)}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <p className="text-[10px] text-gray-400 mt-0.5">Coût <strong>fixe</strong> — part du plan <strong>Vercel Pro</strong> (~19 €) amortie entre tes apps + buffer. ⚠️ Hobby = non-commercial ; une app cliente = Pro requis.</p>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800 select-none">ⓘ Aide — combien mettre dans chaque champ ?</summary>
        <div className="mt-2 space-y-3">
          {AIDE.map((a) => (
            <div key={a.champ}>
              <p className="text-[11px] font-semibold text-gray-700">{a.champ}</p>
              <p className="text-[11px] text-gray-500">{a.desc}</p>
              {a.exemples.length > 0 && (
                <table className="w-full text-[11px] border border-gray-200 rounded-lg overflow-hidden mt-1">
                  <tbody>
                    {a.exemples.map(([l, v], i) => (
                      <tr key={i} className={i ? 'border-t border-gray-100' : ''}>
                        <td className="px-2 py-1 text-gray-700">{l}</td>
                        <td className="px-2 py-1 text-right text-gray-700 whitespace-nowrap">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer text-[11px] font-medium text-gray-600 hover:text-gray-800 select-none">ⓘ Vidéo : pourquoi à part, et combien ça coûte (Cloudflare R2)</summary>
        <div className="mt-2 text-[11px] text-gray-600 space-y-2">
          <p>La vidéo est lourde, et sur Firebase <strong>chaque visionnage coûte</strong> (bande passante) → vite cher. On la met donc sur un service séparé où les <strong>visionnages sont gratuits</strong> : <strong>Cloudflare R2</strong>. Firebase garde juste le lien ; R2 garde le fichier.</p>
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
            <thead><tr className="bg-gray-50">
              <th className="px-2 py-1 text-left font-semibold text-gray-600">Vidéos stockées (R2)</th>
              <th className="px-2 py-1 text-right font-semibold text-gray-600">Coût / mois</th>
            </tr></thead>
            <tbody>
              <tr className="border-t border-gray-100"><td className="px-2 py-1">10 Go</td><td className="px-2 py-1 text-right">gratuit</td></tr>
              <tr className="border-t border-gray-100"><td className="px-2 py-1">100 Go</td><td className="px-2 py-1 text-right whitespace-nowrap">~1,5 $ <span className="text-gray-400">(≈ 1,4 €)</span></td></tr>
              <tr className="border-t border-gray-100"><td className="px-2 py-1">360 Go (~1 an d’usage)</td><td className="px-2 py-1 text-right whitespace-nowrap">~5 $ <span className="text-gray-400">(≈ 4,6 €)</span></td></tr>
              <tr className="border-t border-gray-100"><td className="px-2 py-1">1 To</td><td className="px-2 py-1 text-right whitespace-nowrap">~15 $ <span className="text-gray-400">(≈ 14 €)</span></td></tr>
              <tr className="border-t border-gray-100"><td className="px-2 py-1">Visionnages (peu importe le nombre)</td><td className="px-2 py-1 text-right">0 $</td></tr>
            </tbody>
          </table>
          <p><strong>À facturer au client :</strong> ton coût (~5–15 $/mois, ≈ 5–14 €) <strong>× 3 à 5 de marge</strong> → un <strong>« Module vidéo » ~30–50 €/mois</strong>, en option à part de l’abonnement.</p>
          <p className="text-[10px] text-gray-400">Tarifs Cloudflare R2 facturés en dollars ; conversion € indicative (taux ~0,92 €/$).</p>
        </div>
      </details>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 sm:col-span-1">
          <p className="text-xs text-orange-700/70">Coût estimé /mois</p>
          {r.sousFree ? (
            <>
              <p className="text-2xl font-bold text-green-600">~ 0 €</p>
              <p className="text-[10px] text-gray-500 mt-1">Sous le palier gratuit Firebase. L’abonnement n’a <strong>pas</strong> à couvrir d’infra ici → fixe-le sur ta <strong>valeur</strong> (maintenance, support, disponibilité).</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-orange-700">{fmt(r.bas)} – {fmt(r.haut)}</p>
              <p className="text-[10px] text-gray-500 mt-1">central ≈ {fmt(r.total)}/mois · soit {fmt(r.total * 12)}/an</p>
              <div className="mt-2 pt-2 border-t border-orange-200">
                <p className="text-xs text-orange-700/70">Abonnement minimum conseillé <span className="text-orange-700/50">(infra ×3 – ×5)</span></p>
                <p className="text-lg font-bold text-orange-800">{fmt(r.total * 3)} – {fmt(r.total * 5)} <span className="text-xs font-normal">/mois</span></p>
                <p className="text-[10px] text-gray-500 mt-0.5">pour couvrir l’infra avec marge (cotisations, support, aléas)</p>
              </div>
            </>
          )}
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:col-span-2">
          <p className="text-xs text-gray-500 mb-2">Détail (poste par poste)</p>
          <div className="space-y-1">
            {r.lignes.map((ln) => (
              <div key={ln.l} className="flex items-center justify-between text-[11px]">
                <span className="text-gray-600">{ln.l} <span className="text-gray-400">· {ln.d}</span></span>
                <span className={`font-medium ${ln.c < 0.5 ? 'text-green-600' : 'text-gray-800'}`}>{ln.c < 0.5 ? 'gratuit' : fmt(ln.c)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed bg-green-50 border border-green-100 rounded-lg px-3 py-2">
        💡 <strong>À ton échelle</strong> (quelques dizaines à centaines d’utilisateurs), c’est <strong>quasi toujours ~0 €</strong> — sauf si l’app stocke/diffuse de la <strong>vidéo</strong> ou beaucoup de médias. C’est le seul poste à surveiller sérieusement.
      </p>
      <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
        Tarifs Firebase plan Blaze (facturé en $, ≈ € ici). <strong>Authentification</strong> et <strong>notifications push (FCM)</strong> sont gratuites (hors SMS/OTP). L’<strong>hébergement web Vercel</strong> est désormais compté via le champ dédié ci-dessus (plan <strong>Pro requis</strong> pour une app commerciale ; les CRON eux-mêmes sont inclus/négligeables). La <strong>vidéo</strong> est le poste qui fait grimper la facture (stockage + bande passante) — ajuste-le en priorité.
      </p>
    </details>
  )
}
