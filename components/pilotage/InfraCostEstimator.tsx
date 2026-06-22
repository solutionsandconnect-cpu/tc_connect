'use client'

import { useMemo, useState } from 'react'
import { ServerStackIcon } from '@heroicons/react/24/outline'

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
  sessionsMois: 20,
  lecturesSession: 30,
  ecrituresSession: 5,
  stockageFichiersGo: 2,
  stockageVideoGo: 0,
  bandePassanteSessionMo: 3,
}

const CHAMPS: Champ[] = [
  { key: 'users', label: 'Utilisateurs actifs / mois', hint: 'qui ouvrent vraiment l’app', step: 5 },
  { key: 'sessionsMois', label: 'Ouvertures / utilisateur / mois', hint: 'sessions mensuelles', step: 1 },
  { key: 'lecturesSession', label: 'Lectures de données / session', hint: 'docs chargés à l’ouverture', step: 5 },
  { key: 'ecrituresSession', label: 'Écritures / session', hint: 'enregistrements créés/modifiés', step: 1 },
  { key: 'stockageFichiersGo', label: 'Stockage fichiers/photos (Go)', hint: 'total cumulé', step: 1 },
  { key: 'stockageVideoGo', label: 'Stockage vidéo (Go)', hint: 'poste lourd si analyse vidéo', step: 5 },
  { key: 'bandePassanteSessionMo', label: 'Téléchargé / session (Mo)', hint: 'images/vidéos servies', step: 1 },
]

export default function InfraCostEstimator() {
  const [v, setV] = useState({ ...DEFAULTS })
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
    const total = cRead + cWrite + cStorage + cEgress

    const sousFree = total < 0.5
    return {
      reads, writes, stockageGo, egressGo,
      lignes: [
        { l: 'Firestore — lectures', c: cRead, d: `${(reads / 1_000_000).toFixed(1)} M/mois` },
        { l: 'Firestore — écritures', c: cWrite, d: `${(writes / 1_000_000).toFixed(2)} M/mois` },
        { l: 'Stockage fichiers/vidéo', c: cStorage, d: `${stockageGo.toFixed(0)} Go` },
        { l: 'Bande passante (téléchargement)', c: cEgress, d: `${egressGo.toFixed(0)} Go/mois` },
      ],
      total,
      bas: total * 0.6,
      haut: total * 1.6,
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
        Indicatif — fourchette large. Saisis des valeurs <strong>moyennes</strong> pour avoir un ordre de grandeur du coût mensuel d’hébergement à prévoir (ou à refacturer au client).
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CHAMPS.map((f) => (
          <div key={f.key}>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">{f.label}</label>
            <input type="number" inputMode="decimal" step={f.step} min={0} value={v[f.key]}
              onChange={(e) => set(f.key, Number(e.target.value) || 0)}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
            <p className="text-[10px] text-gray-400 mt-0.5">{f.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="rounded-xl bg-orange-50 border border-orange-100 p-4 sm:col-span-1">
          <p className="text-xs text-orange-700/70">Coût estimé /mois</p>
          {r.sousFree ? (
            <>
              <p className="text-2xl font-bold text-green-600">~ 0 €</p>
              <p className="text-[10px] text-gray-500 mt-1">Dans le palier gratuit Firebase. Prévoir ~0 € tant que l’usage reste à ce niveau.</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-orange-700">{fmt(r.bas)} – {fmt(r.haut)}</p>
              <p className="text-[10px] text-gray-500 mt-1">central ≈ {fmt(r.total)}/mois · soit {fmt(r.total * 12)}/an</p>
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

      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
        Tarifs Firebase plan Blaze (facturé en $, ≈ € ici). <strong>Authentification</strong> et <strong>notifications push (FCM)</strong> sont gratuites (hors SMS/OTP). L’<strong>hébergement du site</strong> (Vercel/Firebase Hosting) n’est pas compté ici : souvent gratuit pour un petit trafic. La <strong>vidéo</strong> est le poste qui fait grimper la facture (stockage + bande passante) — ajuste-le en priorité.
      </p>
    </details>
  )
}
