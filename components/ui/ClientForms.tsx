'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PencilIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import SuggestInput from '@/components/ui/SuggestInput'
import type { Objectif, AntecedentMedical, AntecedentSportif, MouvementDetail, ZoneCorporelle } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

export const SPORTS = [
  "Athlétisme", "Aviron", "Badminton", "Basketball", "Boxe",
  "Cardio", "Crossfit", "Cyclisme", "Danse", "Escalade",
  "Football", "Football américain", "Golf", "Gymnastique",
  "Handball", "Hockey", "Judo", "Karaté", "Kitesurf",
  "Musculation", "Natation", "Padel", "Pilates", "Randonnée",
  "Rugby", "Running / Course à pied", "Skateboard", "Ski alpin",
  "Ski de fond", "Snowboard", "Squash", "Stretching",
  "Surf", "Tennis", "Tennis de table", "Triathlon",
  "Vélo / Cyclisme", "Volley-ball", "Yoga", "Zumba",
]

export const NIVEAUX = ["Loisir", "Débutant", "Intermédiaire", "Confirmé", "Expert"]

export const TYPES_BLESSURE = [
  "Osseuse", "Tendineuse", "Musculaire", "Ligamentaire",
  "Neurologique", "Chronique / Maladie", "Autre",
]

export const PRIORITE_STYLE: Record<string, string> = {
  Primaire: "bg-blue-100 text-blue-700",
  Secondaire: "bg-teal-100 text-teal-700",
  Tertiaire: "bg-gray-100 text-gray-600",
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function parseFlexDate(s: string): Date | null {
  const t = s.trim()
  if (!t) return null
  if (/^\d{4}$/.test(t)) return new Date(parseInt(t), 0, 1)
  const my = t.match(/^(\d{1,2})\/(\d{4})$/)
  if (my) return new Date(parseInt(my[2]), parseInt(my[1]) - 1, 1)
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]))
  return null
}

export function calcArretSport(debut: string, fin: string): string {
  const d = parseFlexDate(debut)
  const f = parseFlexDate(fin)
  if (!d || !f || f <= d) return ""
  let years = f.getFullYear() - d.getFullYear()
  let months = f.getMonth() - d.getMonth()
  let days = f.getDate() - d.getDate()
  if (days < 0) { months--; days += new Date(f.getFullYear(), f.getMonth(), 0).getDate() }
  if (months < 0) { years--; months += 12 }
  if (years === 0 && months === 0) {
    return days <= 0 ? "" : `${days} jour${days > 1 ? "s" : ""}`
  }
  const parts: string[] = []
  if (years > 0) parts.push(`${years} an${years > 1 ? "s" : ""}`)
  if (months > 0) parts.push(`${months} mois`)
  return parts.join(" ")
}

// ── FlexDateInput ─────────────────────────────────────────────────────────────

type FlexDateMode = 'Année' | 'Mois' | 'Date'

function detectFlexMode(value: string): FlexDateMode {
  if (!value) return 'Année'
  if (/^\d{4}$/.test(value)) return 'Année'
  if (/^\d{1,2}\/\d{4}$/.test(value)) return 'Mois'
  return 'Date'
}

export function FlexDateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [mode, setMode] = React.useState<FlexDateMode>(() => detectFlexMode(value))

  const initParts = (v: string) => {
    const d = parseFlexDate(v)
    return {
      annee: d ? String(d.getFullYear()) : '',
      mo: d ? String(d.getMonth() + 1).padStart(2, '0') : '',
      yr: d ? String(d.getFullYear()) : '',
    }
  }
  const [annee, setAnnee] = React.useState(() => initParts(value).annee)
  const [moisMo, setMoisMo] = React.useState(() => initParts(value).mo)
  const [moisYr, setMoisYr] = React.useState(() => initParts(value).yr)

  const isoVal = React.useMemo(() => {
    const d = parseFlexDate(value)
    if (!d) return ''
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [value])

  const switchMode = (newMode: FlexDateMode) => {
    const d = parseFlexDate(value)
    setMode(newMode)
    if (newMode === 'Année') {
      const yr = d ? String(d.getFullYear()) : ''
      setAnnee(yr)
      if (yr) onChange(yr)
    } else if (newMode === 'Mois') {
      const mo = d ? String(d.getMonth() + 1).padStart(2, '0') : ''
      const yr = d ? String(d.getFullYear()) : ''
      setMoisMo(mo); setMoisYr(yr)
      if (mo && yr) onChange(`${mo}/${yr}`)
    } else {
      if (d) {
        const dy = String(d.getDate()).padStart(2, '0')
        const mo = String(d.getMonth() + 1).padStart(2, '0')
        onChange(`${dy}/${mo}/${d.getFullYear()}`)
      }
    }
  }

  const tabCls = (m: FlexDateMode) =>
    `flex-1 py-1 text-xs font-medium transition ${mode === m ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`

  return (
    <div className="space-y-1">
      <div className="flex rounded overflow-hidden border border-gray-200">
        {(['Année', 'Mois', 'Date'] as FlexDateMode[]).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)} className={tabCls(m)}>{m}</button>
        ))}
      </div>
      {mode === 'Année' && (
        <input type="number" min={1900} max={2100} placeholder="2018"
          value={annee}
          onChange={(e) => { setAnnee(e.target.value); if (/^\d{4}$/.test(e.target.value)) onChange(e.target.value); else if (!e.target.value) onChange('') }}
          className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
      )}
      {mode === 'Mois' && (
        <div className="flex gap-1">
          <select value={moisMo}
            onChange={(e) => { setMoisMo(e.target.value); if (e.target.value && moisYr) onChange(`${e.target.value}/${moisYr}`) }}
            className="flex-1 border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
            <option value="">Mois</option>
            {['01','02','03','04','05','06','07','08','09','10','11','12'].map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input type="number" min={1900} max={2100} placeholder="Année"
            value={moisYr}
            onChange={(e) => { setMoisYr(e.target.value); if (moisMo && /^\d{4}$/.test(e.target.value)) onChange(`${moisMo}/${e.target.value}`) }}
            className="w-24 border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
        </div>
      )}
      {mode === 'Date' && (
        <input type="date" value={isoVal}
          onChange={(e) => {
            if (!e.target.value) { onChange(''); return }
            const [y, m, d] = e.target.value.split('-')
            onChange(`${d}/${m}/${y}`)
          }}
          className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 min-w-0"
          style={{ minWidth: 0 }} />
      )}
    </div>
  )
}

// ── SearchableSelect ──────────────────────────────────────────────────────────

function SearchableSelect({ value, onChange, options, placeholder, allowEmpty, emptyLabel }: {
  value: string; onChange: (v: string) => void; options: string[]
  placeholder?: string; allowEmpty?: boolean; emptyLabel?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const allOptions = allowEmpty ? ['', ...options] : options
  const filtered = query
    ? allOptions.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : allOptions

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={open ? query : value}
        placeholder={open ? 'Rechercher...' : (placeholder || 'Sélectionner...')}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 bg-white"
      />
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 italic">Aucun résultat</p>
          ) : (
            filtered.map((o, i) => (
              <button key={i} type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm border-b border-gray-50 last:border-0 transition ${
                  o === value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-blue-50'
                }`}>
                {o || emptyLabel || '—'}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── ZonesCorporellesSelector ──────────────────────────────────────────────────

const CORPS_HIERARCHY: { partie: string; structures: string[] }[] = [
  { partie: 'Tête / Cou',           structures: ['Cervicales', 'Muscles cervicaux', 'Mâchoire (ATM)', 'Crâne', 'Nerf'] },
  { partie: 'Épaule',               structures: ['Coiffe des rotateurs', 'Tendon long biceps', 'Acromio-claviculaire', 'Capsule articulaire', 'Bourse sous-acromiale', 'Nerf'] },
  { partie: 'Omoplate',             structures: ['Scapula', 'Muscles péri-scapulaires'] },
  { partie: 'Bras',                 structures: ['Humérus', 'Biceps', 'Triceps', 'Muscle deltoïde'] },
  { partie: 'Coude',                structures: ["Épicondyle (tennis elbow)", "Épitrochlée (golf elbow)", 'Ligament collatéral', 'Olécrane / bursite', 'Nerf cubital'] },
  { partie: 'Avant-bras / Poignet', structures: ['Tendons fléchisseurs', 'Tendons extenseurs', 'Ligaments du carpe', 'Canal carpien (nerf médian)', 'Radius', 'Cubitus'] },
  { partie: 'Main / Doigts',        structures: ['Tendons', 'Ligaments', 'Métacarpes', 'Phalanges'] },
  { partie: 'Thorax / Côtes',       structures: ['Côtes', 'Sternum', 'Cartilage costal', 'Muscles intercostaux', 'Pectoraux'] },
  { partie: 'Colonne cervicale',    structures: ['Disques C1-C7', 'Hernie discale', 'Muscles paravertébraux', 'Nerf cervical'] },
  { partie: 'Colonne dorsale',      structures: ['Disques D1-D12', 'Muscles paravertébraux', 'Vertèbres'] },
  { partie: 'Colonne lombaire',     structures: ['Disque L1-L5', 'Hernie discale', 'Nerf sciatique', 'Nerf crural', 'Canal lombaire étroit', 'Muscles érecteurs du rachis'] },
  { partie: 'Sacrum / Bassin',      structures: ['Sacrum', 'Coccyx', 'Articulation sacro-iliaque', 'Pubis (pubalgie)'] },
  { partie: 'Abdomen',              structures: ['Grand droit', 'Obliques', 'Transverse', 'Hernie inguinale'] },
  { partie: 'Hanche',               structures: ['Articulation coxo-fémorale', 'Labrum acétabulaire', 'Psoas', 'Bursite trochantérienne', 'Muscles fessiers'] },
  { partie: 'Cuisse',               structures: ['Quadriceps', 'Ischio-jambiers', 'Adducteurs', 'Tractus ilio-tibial (TFL)'] },
  { partie: 'Genou',                structures: ['LCA', 'LCP', 'LLI', 'LLE', 'Ménisque médial', 'Ménisque latéral', 'Rotule', 'Tendon rotulien', 'Tendon quadricipital', 'Cartilage', 'Bourse'] },
  { partie: 'Jambe',                structures: ['Tibia', 'Péroné', 'Loge antérieure', 'Mollet (gastrocnémien)', 'Soléaire'] },
  { partie: 'Cheville',             structures: ['Ligament latéral externe (LLE)', 'Ligament deltoïde (médial)', "Tendon d'Achille", 'Syndesmose', 'Os'] },
  { partie: 'Pied',                 structures: ['Fascia plantaire', 'Métatarses', 'Os naviculaire', 'Tendons péroniers', 'Orteils'] },
]

export function zoneLabel(z: ZoneCorporelle) {
  return [z.partie, z.cote, z.structure].filter(Boolean).join(' · ')
}

export function ZonesCorporellesSelector({ value, onChange }: { value: ZoneCorporelle[]; onChange: (v: ZoneCorporelle[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [partie, setPartie] = useState('')
  const [cote, setCote] = useState('')
  const [structure, setStructure] = useState('')

  const currentDef = CORPS_HIERARCHY.find(h => h.partie === partie)

  const addZone = () => {
    if (!partie) return
    const zone: ZoneCorporelle = { partie, ...(cote ? { cote } : {}), ...(structure ? { structure } : {}) }
    onChange([...value, zone])
    setPartie(''); setCote(''); setStructure(''); setAdding(false)
  }

  return (
    <div className="space-y-2">
      {value.map((z, i) => (
        <div key={i} className="flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <span className="text-sm text-gray-700">{zoneLabel(z)}</span>
          <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
            className="p-1 text-gray-400 hover:text-red-500 transition shrink-0">
            <XMarkIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="border border-blue-300 rounded-lg p-3 space-y-2.5 bg-white">
          <div>
            <label className="block text-xs text-gray-500 mb-1">1. Partie du corps</label>
            <SearchableSelect
              value={partie}
              onChange={(v) => { setPartie(v); setCote(''); setStructure('') }}
              options={CORPS_HIERARCHY.map(h => h.partie)}
              placeholder="Rechercher une partie du corps..."
            />
          </div>

          {partie && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">2. Côté</label>
                <div className="flex gap-1.5">
                  {['Gauche', 'Droite', 'Bilatéral'].map(c => (
                    <button key={c} type="button" onClick={() => setCote(cote === c ? '' : c)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition ${cote === c ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {currentDef && currentDef.structures.length > 0 && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">3. Structure / tissu <span className="text-gray-400">(optionnel)</span></label>
                  <SearchableSelect
                    value={structure}
                    onChange={setStructure}
                    options={currentDef.structures}
                    placeholder="Rechercher une structure..."
                    allowEmpty
                    emptyLabel="Non précisé"
                  />
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setAdding(false); setPartie(''); setCote(''); setStructure('') }}
              className="flex-1 border rounded-lg py-1.5 text-xs text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={addZone} disabled={!partie}
              className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-blue-700 disabled:opacity-50 transition">+ Ajouter</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
          + Ajouter une zone
        </button>
      )}
    </div>
  )
}

// ── Legacy export (kept for file compatibility) ───────────────────────────────
export const BODY_ZONE_GROUPS: { category: string; zones: { id: string; label: string }[] }[] = [
  { category: 'Tête & Rachis', zones: [
    { id: 'tete_cou', label: 'Tête / Cou' },
    { id: 'nuque', label: 'Nuque / Cervicales' },
    { id: 'haut_dos', label: 'Haut du dos / Dorsales' },
    { id: 'lombaires', label: 'Lombaires' },
    { id: 'sacrum', label: 'Sacrum / Coccyx' },
  ]},
  { category: 'Épaule & Bras', zones: [
    { id: 'epaule_g', label: 'Épaule G' }, { id: 'epaule_d', label: 'Épaule D' },
    { id: 'omop_g', label: 'Omoplate G' }, { id: 'omop_d', label: 'Omoplate D' },
    { id: 'bras_g', label: 'Bras G' }, { id: 'bras_d', label: 'Bras D' },
    { id: 'coude_g', label: 'Coude G' }, { id: 'coude_d', label: 'Coude D' },
    { id: 'av_bras_g', label: 'Avant-bras G' }, { id: 'av_bras_d', label: 'Avant-bras D' },
    { id: 'poignet_g', label: 'Poignet G' }, { id: 'poignet_d', label: 'Poignet D' },
  ]},
  { category: 'Tronc & Abdomen', zones: [
    { id: 'thorax', label: 'Thorax / Pectoraux' },
    { id: 'sternum', label: 'Sternum / Côtes' },
    { id: 'abdomen', label: 'Abdomen' },
    { id: 'oblique_g', label: 'Oblique G' }, { id: 'oblique_d', label: 'Oblique D' },
  ]},
  { category: 'Hanche & Fessier', zones: [
    { id: 'hanches', label: 'Hanches / Bassin' },
    { id: 'fessier_g', label: 'Fessier G' }, { id: 'fessier_d', label: 'Fessier D' },
    { id: 'aine_g', label: 'Aine G' }, { id: 'aine_d', label: 'Aine D' },
  ]},
  { category: 'Cuisse & Jambe', zones: [
    { id: 'cuisse_g', label: 'Cuisse G' }, { id: 'cuisse_d', label: 'Cuisse D' },
    { id: 'ischio_g', label: 'Ischio G' }, { id: 'ischio_d', label: 'Ischio D' },
    { id: 'genou_g', label: 'Genou G' }, { id: 'genou_d', label: 'Genou D' },
    { id: 'tibia_g', label: 'Tibia G' }, { id: 'tibia_d', label: 'Tibia D' },
    { id: 'mollet_g', label: 'Mollet G' }, { id: 'mollet_d', label: 'Mollet D' },
    { id: 'cheville_g', label: 'Cheville G' }, { id: 'cheville_d', label: 'Cheville D' },
    { id: 'achille_g', label: 'Achille G' }, { id: 'achille_d', label: 'Achille D' },
    { id: 'pied_g', label: 'Pied G' }, { id: 'pied_d', label: 'Pied D' },
  ]},
]

export const BODY_ZONES = BODY_ZONE_GROUPS.flatMap(g => g.zones)

// kept for backward compat — use ZonesCorporellesSelector instead
export function BodyZoneSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter(z => z !== id))
    else onChange([...value, id])
  }
  return (
    <div className="space-y-2.5">
      {BODY_ZONE_GROUPS.map(({ category, zones }) => (
        <div key={category}>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{category}</p>
          <div className="flex flex-wrap gap-1.5">
            {zones.map(({ id, label }) => (
              <button key={id} type="button" onClick={() => toggle(id)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                  value.includes(id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600'
                }`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── MouvementsDetailSelector ──────────────────────────────────────────────────

const MOUVEMENTS_PRESET = [
  'Marche', 'Course', 'Saut / Impact', 'Position assise', 'Position debout',
  'Montée escaliers', 'Descente escaliers',
  'Flexion tronc', 'Extension tronc', 'Torsion tronc', 'Inclinaison latérale',
  'Élévation bras', 'Rotation épaule', 'Abduction épaule', 'Port de charge',
  'Flexion genou', 'Extension genou', 'Squat', 'Accroupissement',
  'Flexion hanche', 'Rotation hanche',
  'Rotation cervicale', 'Flexion cervicale', 'Extension cervicale',
]

export function MouvementsDetailSelector({ value, onChange }: { value: MouvementDetail[]; onChange: (v: MouvementDetail[]) => void }) {
  const [custom, setCustom] = React.useState('')

  const isSelected = (label: string) => value.some(m => m.label === label)

  const toggle = (label: string) => {
    if (isSelected(label)) onChange(value.filter(m => m.label !== label))
    else onChange([...value, { label, intensite: 5 }])
  }

  const setIntensity = (label: string, intensite: number) => {
    onChange(value.map(m => m.label === label ? { ...m, intensite } : m))
  }

  const addCustom = () => {
    const t = custom.trim()
    if (!t || isSelected(t)) { setCustom(''); return }
    onChange([...value, { label: t, intensite: 5 }])
    setCustom('')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {MOUVEMENTS_PRESET.map(m => (
          <button key={m} type="button" onClick={() => toggle(m)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              isSelected(m)
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-gray-300 text-gray-600 hover:border-orange-300 hover:text-orange-500'
            }`}>
            {m}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="space-y-2.5 border border-orange-200 rounded-lg p-3 bg-orange-50">
          <p className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">Intensité par mouvement</p>
          {value.map(m => (
            <div key={m.label} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-700 flex-1 min-w-0 truncate">{m.label}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-orange-600 font-bold w-8 text-right">{m.intensite}/10</span>
                  <button type="button" onClick={() => toggle(m.label)} className="text-gray-400 hover:text-red-500 leading-none text-base">×</button>
                </div>
              </div>
              <input type="range" min={0} max={10} value={m.intensite}
                onChange={(e) => setIntensity(m.label, Number(e.target.value))}
                className="w-full accent-orange-500" style={{ height: '6px' }} />
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" placeholder="Autre mouvement libre..."
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          className="flex-1 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 min-w-0" />
        <button type="button" onClick={addCustom}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 transition shrink-0">
          + Ajouter
        </button>
      </div>
    </div>
  )
}

// ── ObjectifsList ─────────────────────────────────────────────────────────────

export function ObjectifsList({ value, onChange, simple }: { value: Objectif[]; onChange: (v: Objectif[]) => void; simple?: boolean }) {
  const empty: Objectif = { texte: "", priorite: "Primaire", dateObjectif: "", donneeChiffree: "", commentaire: "" }
  const [form, setForm] = useState<Objectif>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)

  const submit = () => {
    if (!form.texte.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }

  const grouped = (["Primaire", "Secondaire", "Tertiaire"] as const).map((p) => ({
    label: p, items: value.map((o, i) => ({ o, i })).filter(({ o }) => o.priorite === p),
  })).filter(({ items }) => items.length > 0)

  return (
    <div className="space-y-3">
      {grouped.map(({ label, items }) => (
        <div key={label}>
          <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-1.5 ${PRIORITE_STYLE[label]}`}>{label}</div>
          <div className="space-y-1.5 pl-1">
            {items.map(({ o, i }) => (
              <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    {o.donneeChiffree && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{o.donneeChiffree}</span>}
                    {o.dateObjectif && <span className="text-xs text-gray-400">avant le {new Date(o.dateObjectif).toLocaleDateString("fr-FR")}</span>}
                  </div>
                  <p className="text-gray-800">{o.texte}</p>
                  {o.commentaire && <p className="text-xs text-gray-500 mt-0.5 italic">{o.commentaire}</p>}
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <button type="button" onClick={() => { setForm({ ...empty, ...o, dateObjectif: o.dateObjectif ?? "", donneeChiffree: o.donneeChiffree ?? "", commentaire: o.commentaire ?? "" }); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <input type="text" placeholder="Décrivez l'objectif..." value={form.texte} onChange={(e) => setForm((f) => ({ ...f, texte: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Catégorie</label>
              <select value={form.priorite} onChange={(e) => setForm((f) => ({ ...f, priorite: e.target.value as any }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                {(["Primaire", "Secondaire", "Tertiaire"] as const).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Donnée chiffrée</label>
              <input type="text" placeholder="Ex : 80 kg" value={form.donneeChiffree ?? ""} onChange={(e) => setForm((f) => ({ ...f, donneeChiffree: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div className="min-w-0">
              <label className="block text-xs text-gray-500 mb-1">Date objectif</label>
              <input type="date" value={form.dateObjectif ?? ""} onChange={(e) => setForm((f) => ({ ...f, dateObjectif: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400 min-w-0" style={{ minWidth: 0 }} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Commentaire</label>
            <textarea rows={2} placeholder="Notes ou contexte sur cet objectif..." value={form.commentaire ?? ""} onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter un objectif</button>
      )}
    </div>
  )
}

// ── AntecedentsMedicauxList ───────────────────────────────────────────────────

export function AntecedentsMedicauxList({ value, onChange }: { value: AntecedentMedical[]; onChange: (v: AntecedentMedical[]) => void }) {
  const empty: AntecedentMedical = {
    description: "", typeBlessure: "", estContreIndication: false, estChronique: false,
    cote: "", zonesCorps: [], anneeDebut: "", anneeFin: "", arretSport: "",
    douleurPresente: false, mouvementsDetail: [],
    operation: false, dateOperation: "",
  }
  const [form, setForm] = useState<AntecedentMedical>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const arretManual = useRef(false)

  const submit = () => {
    if (!form.description.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }

  const openEdit = (a: AntecedentMedical, i: number) => {
    arretManual.current = !!a.arretSport
    // Migrate legacy comma-separated mouvementsDouloureux → mouvementsDetail
    const detail: MouvementDetail[] = a.mouvementsDetail && a.mouvementsDetail.length > 0
      ? a.mouvementsDetail
      : (a.mouvementsDouloureux ? a.mouvementsDouloureux.split(', ').filter(Boolean).map(label => ({ label, intensite: a.gradeDouleur ?? 5 })) : [])
    setForm({
      ...empty, ...a,
      zonesCorps: (a.zonesCorps ?? []).map((z: any) =>
        typeof z === 'string' ? { partie: BODY_ZONES.find(bz => bz.id === z)?.label ?? z } : z
      ) as ZoneCorporelle[],
      mouvementsDetail: detail,
      dateOperation: a.dateOperation ?? "",
      anneeDebut: a.anneeDebut ?? (a as any).annee ?? "",
    })
    setEditIdx(i); setOpen(true)
  }

  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-sm ${a.estChronique ? "bg-orange-50 border-orange-200" : a.estContreIndication ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {a.typeBlessure && <span className="text-xs bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-medium">{a.typeBlessure}</span>}
              {a.estChronique && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Chronique</span>}
              {a.estContreIndication && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Contre-indication</span>}
              {a.operation && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Op.{a.dateOperation ? ` ${new Date(a.dateOperation).getFullYear()}` : ""}</span>}
              {(a.anneeDebut || (a as any).annee) && <span className="text-xs text-gray-400">{a.anneeDebut ?? (a as any).annee}{a.anneeFin ? ` → ${a.anneeFin}` : ""}</span>}
            </div>
            <p className="text-gray-800 font-medium">{a.description}</p>
            {a.douleurPresente && (
              (a.mouvementsDetail && a.mouvementsDetail.length > 0)
                ? <p className="text-xs text-red-600 mt-0.5">Douleur · {a.mouvementsDetail.map(m => `${m.label} (${m.intensite}/10)`).join(' · ')}</p>
                : <p className="text-xs text-red-600 mt-0.5">Douleur présente{a.gradeDouleur ? ` · ${a.gradeDouleur}/10` : ""}{a.mouvementsDouloureux ? ` · ${a.mouvementsDouloureux}` : ""}</p>
            )}
            {(a.zonesCorps ?? []).length > 0 && (
              <p className="text-xs text-blue-600 mt-0.5">
                {(a.zonesCorps ?? []).map((z: any) => typeof z === 'string' ? z : zoneLabel(z)).join(' | ')}
              </p>
            )}
            {a.arretSport && <p className="text-xs text-gray-400 mt-0.5">Arrêt sport : {a.arretSport}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => openEdit(a, i)} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
          <input type="text" placeholder="Nom / description (ex: Entorse cheville, Asthme, Lombalgie...)" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Type</label>
              <select value={form.typeBlessure ?? ""} onChange={(e) => setForm((f) => ({ ...f, typeBlessure: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                <option value="">— Choisir —</option>
                {TYPES_BLESSURE.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Côté</label>
              <select value={form.cote ?? ""} onChange={(e) => setForm((f) => ({ ...f, cote: e.target.value }))}
                className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                {["", "Gauche", "Droite", "Bilatéral", "Central", "N/A"].map((c) => <option key={c} value={c}>{c || "—"}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.estContreIndication ?? false} onChange={(e) => setForm((f) => ({ ...f, estContreIndication: e.target.checked }))} className="rounded" />
              Contre-indication
            </label>
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.estChronique ?? false} onChange={(e) => setForm((f) => ({ ...f, estChronique: e.target.checked }))} className="rounded" />
              Chronique / permanent
            </label>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">Date début</label>
                <FlexDateInput value={form.anneeDebut ?? ""}
                  onChange={(debut) => setForm((f) => {
                    const auto = calcArretSport(debut, f.anneeFin ?? "")
                    return { ...f, anneeDebut: debut, arretSport: arretManual.current ? f.arretSport : auto }
                  })} />
              </div>
              <div className="min-w-0">
                <label className="block text-xs text-gray-500 mb-1">Date fin <span className="text-gray-300">(vide = actif)</span></label>
                <FlexDateInput value={form.anneeFin ?? ""}
                  onChange={(fin) => setForm((f) => {
                    const auto = calcArretSport(f.anneeDebut ?? "", fin)
                    return { ...f, anneeFin: fin, arretSport: arretManual.current ? f.arretSport : auto }
                  })} />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Arrêt sport <span className="text-gray-300">(auto)</span></label>
              <input type="text" placeholder="3 mois" value={form.arretSport ?? ""}
                onChange={(e) => { arretManual.current = true; setForm((f) => ({ ...f, arretSport: e.target.value })) }}
                className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.operation ?? false} onChange={(e) => setForm((f) => ({ ...f, operation: e.target.checked }))} className="rounded" />
              Opération chirurgicale
            </label>
            {form.operation && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date d'opération</label>
                <input type="date" value={form.dateOperation ?? ""} onChange={(e) => setForm((f) => ({ ...f, dateOperation: e.target.value }))}
                  className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.douleurPresente ?? false} onChange={(e) => setForm((f) => ({ ...f, douleurPresente: e.target.checked }))} className="rounded" />
              Douleur encore présente
            </label>
            {form.douleurPresente && (
              <div className="space-y-2 pl-2 border-l-2 border-orange-300">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mouvements douloureux <span className="text-gray-400">(intensité par mouvement)</span></label>
                  <MouvementsDetailSelector
                    value={form.mouvementsDetail ?? []}
                    onChange={(v) => setForm((f) => ({ ...f, mouvementsDetail: v }))} />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Localisation (zones corporelles)</label>
            <ZonesCorporellesSelector value={(form.zonesCorps ?? []) as ZoneCorporelle[]} onChange={(v) => setForm((f) => ({ ...f, zonesCorps: v }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }}
              className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit}
              className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { arretManual.current = false; setForm(empty); setOpen(true) }}
          className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
          + Ajouter un antécédent / contre-indication
        </button>
      )}
    </div>
  )
}

// ── AntecedentsSportifsList ───────────────────────────────────────────────────

export function AntecedentsSportifsList({ value, onChange }: { value: AntecedentSportif[]; onChange: (v: AntecedentSportif[]) => void }) {
  const empty: AntecedentSportif = { sport: "", anneeDebut: "", anneeFin: "", niveau: "" }
  const [form, setForm] = useState<AntecedentSportif>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)

  const submit = () => {
    if (!form.sport.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }

  return (
    <div className="space-y-2">
      {value.map((a, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {(a.anneeDebut || a.anneeFin) && <span className="text-xs text-gray-400">{a.anneeDebut}{a.anneeDebut && a.anneeFin ? " → " : ""}{a.anneeFin}</span>}
              {a.niveau && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{a.niveau}</span>}
            </div>
            <p className="text-gray-800">{a.sport}</p>
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(a); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <SuggestInput value={form.sport} onChange={(v) => setForm((f) => ({ ...f, sport: v }))} suggestions={SPORTS} placeholder="Sport pratiqué..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Début</label>
              <input type="text" placeholder="2010" value={form.anneeDebut} onChange={(e) => setForm((f) => ({ ...f, anneeDebut: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fin</label>
              <input type="text" placeholder="2020 / En cours" value={form.anneeFin} onChange={(e) => setForm((f) => ({ ...f, anneeFin: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Niveau</label>
              <select value={form.niveau} onChange={(e) => setForm((f) => ({ ...f, niveau: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
                <option value="">—</option>
                {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter un antécédent sportif</button>
      )}
    </div>
  )
}
