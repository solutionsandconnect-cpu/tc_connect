'use client'

// Éditeurs & aperçu du « contenu projet » d'un contrat Pilotage.
// Extraits pour être partagés entre la page /pilotage et la page dédiée /pilotage/contrat/[id].
import { useEffect, useRef, useState } from 'react'
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { ProjetFonction, ProjetPlanning, ProjetTache, ProjetContent } from '@/types'
import { RESPONSABLES_PLANNING, recalcPlanning, HORS_PERIMETRE_DEFAUT, DEFAULT_PLANNING_ETAPES } from '@/lib/pilotageProjetTemplates'
import Modal from '@/components/ui/Modal'

const inputCls = 'flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
const delBtn = 'p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition shrink-0'
const addBtn = 'flex items-center gap-1 text-xs font-medium text-blue-700 hover:bg-blue-50 px-2 py-1 rounded-lg transition'

// Statut d'une étape de planning dérivé de la date (passée = faite) → couleur du point de la timeline.
function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function planningDotColor(dateIso: string, today: string): string {
  if (!dateIso) return 'bg-gray-200'
  if (dateIso < today) return 'bg-emerald-500'  // passée → faite
  if (dateIso === today) return 'bg-amber-400'  // aujourd'hui
  return 'bg-gray-300'                            // à venir
}
// Date ISO calculée à partir d'aujourd'hui (+ jours / + mois) — pour la date par défaut et les chips rapides
function isoFromToday(days: number, months = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  d.setDate(d.getDate() + days)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const DATE_CHIPS = [
  { l: '+1 j', days: 1, months: 0 },
  { l: '+7 j', days: 7, months: 0 },
  { l: '+2 sem', days: 14, months: 0 },
  { l: '+1 mois', days: 0, months: 1 },
] as const

export function StringListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2">
          <input value={v} placeholder={placeholder} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} className={inputCls} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={delBtn}><TrashIcon className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className={addBtn}><PlusIcon className="w-3.5 h-3.5" /> Ajouter</button>
    </div>
  )
}

export function FonctionsEditor({ items, onChange }: { items: ProjetFonction[]; onChange: (v: ProjetFonction[]) => void }) {
  const upd = (i: number, patch: Partial<ProjetFonction>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="space-y-1.5">
      {items.map((f, i) => (
        <div key={i} className="flex gap-2">
          <input value={f.categorie} placeholder="Catégorie" onChange={(e) => upd(i, { categorie: e.target.value })} className="w-1/3 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={f.description} placeholder="Description" onChange={(e) => upd(i, { description: e.target.value })} className={inputCls} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className={delBtn}><TrashIcon className="w-4 h-4" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { categorie: '', description: '' }])} className={addBtn}><PlusIcon className="w-3.5 h-3.5" /> Ajouter</button>
    </div>
  )
}

// Combobox « Étape » : saisie libre + suggestions filtrées, dropdown stylé (pas de datalist natif)
function EtapeCombobox({ value, onChange, options, autoFocus, className }: {
  value: string; onChange: (v: string) => void; options: string[]; autoFocus?: boolean; className?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])
  const q = value.trim().toLowerCase()
  const exact = options.some((o) => o.toLowerCase() === q)
  const filtered = (!q || exact) ? options : options.filter((o) => o.toLowerCase().includes(q))
  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <input autoFocus={autoFocus} value={value} placeholder="Étape"
        onChange={(e) => { onChange(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        className="w-full border border-gray-300 rounded-lg pl-2 pr-7 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <button type="button" tabIndex={-1} onClick={() => setOpen((v) => !v)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && filtered.length > 0 && (
        <div className="absolute z-30 left-0 mt-1 min-w-full w-max max-w-[18rem] bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.map((o) => (
              <button key={o} type="button" onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-sm whitespace-nowrap hover:bg-blue-50 transition ${value === o ? 'text-blue-700 font-medium bg-blue-50/60' : 'text-gray-700'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function PlanningEditor({ items, onChange, etapesTypes }: { items: ProjetPlanning[]; onChange: (v: ProjetPlanning[]) => void; etapesTypes?: string[] }) {
  // Toute modification repasse par recalcPlanning : les dates en aval suivent les délais (sauf étapes ancrées).
  const commit = (next: ProjetPlanning[]) => onChange(recalcPlanning(next))
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
  const etapes = etapesTypes ?? DEFAULT_PLANNING_ETAPES
  const upd = (i: number, patch: Partial<ProjetPlanning>) => commit(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= items.length) return
    const next = items.slice()
    ;[next[i], next[j]] = [next[j], next[i]]
    commit(next)
  }
  return (
    <div className="space-y-2">
      {items.map((p, i) => {
        const isLast = i === items.length - 1
        const auto = i > 0 && !p.ancre // date calculée automatiquement depuis l'étape précédente
        return (
          <div key={i} className="border border-gray-100 rounded-lg p-2 space-y-1.5">
            <div className="flex gap-2 flex-wrap items-center">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronUpIcon className="w-4 h-4" /></button>
                <button type="button" onClick={() => move(i, 1)} disabled={isLast} className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronDownIcon className="w-4 h-4" /></button>
              </div>
              <EtapeCombobox value={p.etape} onChange={(v) => upd(i, { etape: v })} options={etapes} className="w-40 shrink-0" />
              <input value={p.description} placeholder="Description" onChange={(e) => upd(i, { description: e.target.value })} className={inputCls} />
              {confirmDel === i ? (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="text-[11px] text-gray-500">Supprimer ?</span>
                  <button type="button" onClick={() => { commit(items.filter((_, j) => j !== i)); setConfirmDel(null) }} className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition">Oui</button>
                  <button type="button" onClick={() => setConfirmDel(null)} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded-lg transition">Non</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmDel(i)} className={delBtn}><TrashIcon className="w-4 h-4" /></button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap items-center pl-6">
              <div className="flex items-center gap-1">
                <input type="date" value={p.date} onChange={(e) => upd(i, { date: e.target.value, ancre: i > 0 ? true : undefined })} className={`w-36 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${auto ? 'border-gray-200 text-gray-500 bg-gray-50' : 'border-gray-300'}`} />
                {i === 0 ? <span className="text-[10px] text-gray-400">début</span>
                  : p.ancre ? <button type="button" title="Revenir au calcul automatique" onClick={() => upd(i, { ancre: false })} className="text-[10px] text-blue-600 hover:underline">fixée ✕</button>
                  : <span className="text-[10px] text-gray-400">auto</span>}
              </div>
              {!isLast && (
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  <input type="number" min={0} value={p.dureeJours ?? ''} placeholder="0" onChange={(e) => upd(i, { dureeJours: e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value, 10) || 0) })} className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  jours avant la suivante
                </label>
              )}
              <div className="flex items-center gap-1">
                {RESPONSABLES_PLANNING.map((r) => {
                  const on = p.responsable === r
                  return (
                    <button key={r} type="button" onClick={() => upd(i, { responsable: on ? '' : r })}
                      className={`text-xs px-2 py-1 rounded-full border transition ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>{r}</button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
      <button type="button" onClick={() => commit([...items, { etape: '', description: '', date: '', dureeJours: 7, ancre: false, responsable: '' }])} className={addBtn}><PlusIcon className="w-3.5 h-3.5" /> Ajouter une étape</button>
    </div>
  )
}

export function HorsPerimetreEditor({ items, onChange }: { items: string[]; onChange: (v: string[]) => void }) {
  const customs = items.filter((i) => !HORS_PERIMETRE_DEFAUT.includes(i))
  const toggle = (p: string) => onChange(items.includes(p) ? items.filter((x) => x !== p) : [...items, p])
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {HORS_PERIMETRE_DEFAUT.map((p) => {
          const on = items.includes(p)
          return (
            <button key={p} type="button" onClick={() => toggle(p)}
              className={`text-xs px-2.5 py-1 rounded-full border text-left transition ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>
              {on ? '✓ ' : '+ '}{p}
            </button>
          )
        })}
      </div>
      {customs.length > 0 && (
        <div className="space-y-1.5">
          {customs.map((v) => (
            <div key={v} className="flex gap-2">
              <input value={v} onChange={(e) => onChange(items.map((x) => (x === v ? e.target.value : x)))} className={inputCls} />
              <button type="button" onClick={() => onChange(items.filter((x) => x !== v))} className={delBtn}><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onChange([...items, ''])} className={addBtn}><PlusIcon className="w-3.5 h-3.5" /> Ajouter une exclusion libre</button>
    </div>
  )
}

// Normalise une date saisie librement (21/11, 21/11/2026…) vers AAAA-MM-JJ si possible
export function toIsoDate(s: string): string {
  const v = s.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(v)
  if (m) {
    const d = m[1].padStart(2, '0'), mo = m[2].padStart(2, '0')
    let y = m[3] ?? String(new Date().getFullYear())
    if (y.length === 2) y = '20' + y
    return `${y}-${mo}-${d}`
  }
  return ''
}

// Sélecteur « pour qui » d'une tâche : Moi (S&C) ou Client
const POUR_OPTS = [
  { key: 'sc', label: 'Moi', on: 'bg-blue-600 border-blue-600 text-white' },
  { key: 'client', label: 'Client', on: 'bg-amber-500 border-amber-500 text-white' },
] as const

function PourChips({ value, onChange }: { value: 'client' | 'sc'; onChange: (v: 'client' | 'sc') => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {POUR_OPTS.map((p) => {
        const active = value === p.key
        return (
          <button key={p.key} type="button" onClick={() => onChange(p.key)}
            className={`text-xs px-2 py-1 rounded-full border transition ${active ? p.on : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>{p.label}</button>
        )
      })}
    </div>
  )
}

const FILTRES_POUR = [{ k: 'tous', l: 'Tous' }, { k: 'sc', l: 'Moi' }, { k: 'client', l: 'Client' }] as const

// Statut de facturation d'une tâche : Inclus (gratuit) / Maintenance (abo) / À facturer (évolution payante)
type Facturation = 'inclus' | 'maintenance' | 'facturer'
const FACTURATION_OPTS = [
  { k: 'inclus', l: 'Inclus', title: 'Compris dans le devis (gratuit)', on: 'bg-emerald-500 border-emerald-500 text-white' },
  { k: 'maintenance', l: 'Maint.', title: 'Couvert par la maintenance / abonnement', on: 'bg-slate-500 border-slate-500 text-white' },
  { k: 'facturer', l: 'Facturer', title: 'Évolution payante — à facturer en plus', on: 'bg-rose-500 border-rose-500 text-white' },
] as const

function FacturationChips({ value, onChange }: { value?: Facturation; onChange: (v?: Facturation) => void }) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      {FACTURATION_OPTS.map((f) => {
        const on = value === f.k
        return (
          <button key={f.k} type="button" title={f.title} onClick={() => onChange(on ? undefined : f.k)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition ${on ? f.on : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'}`}>{f.l}</button>
        )
      })}
    </div>
  )
}

// Badge (lecture seule) du statut de facturation
const FAC_BADGE: Record<Facturation, { l: string; c: string }> = {
  inclus: { l: 'Inclus', c: 'bg-emerald-100 text-emerald-700' },
  maintenance: { l: 'Maint.', c: 'bg-slate-100 text-slate-600' },
  facturer: { l: 'À facturer', c: 'bg-rose-100 text-rose-700' },
}

// Taux horaire facturable (jour ≈ 7 h, comme l'estimateur) et prix proposé d'une tâche « à facturer »
export const tauxHoraireFromTjm = (tjm: number) => Math.round(tjm / 7)
export function prixFacture(t: ProjetTache, tauxHoraire: number): number | null {
  if (t.facturation !== 'facturer' || !t.tempsH) return null
  return Math.round(t.tempsH * tauxHoraire)
}

// Tâche en retard : date passée et non terminée
export const estEnRetard = (t: ProjetTache, today: string) => !!t.date && t.date < today && !t.fait

// Filtres par date des tâches
const FILTRES_DATE = [
  { k: 'toutes', l: 'Toutes' },
  { k: 'retard', l: 'En retard' },
  { k: 'passe', l: 'Passé' },
  { k: 'aujourdhui', l: "Aujourd'hui" },
  { k: 'demain', l: 'Demain' },
  { k: 'semaine', l: '7 jours' },
  { k: 'mois', l: '30 jours' },
  { k: 'avenir', l: 'À venir' },
  { k: 'sansdate', l: 'Sans date' },
] as const
type FiltreDate = typeof FILTRES_DATE[number]['k']
function matchDateFilter(t: ProjetTache, f: FiltreDate): boolean {
  const today = isoFromToday(0)
  if (f === 'toutes') return true
  if (f === 'sansdate') return !t.date
  if (f === 'retard') return estEnRetard(t, today)
  if (f === 'passe') return !!t.date && t.date < today    // toute échéance passée (terminée ou non)
  if (f === 'aujourdhui') return t.date === today
  if (f === 'demain') return t.date === isoFromToday(1)
  if (f === 'semaine') return !!t.date && t.date >= today && t.date <= isoFromToday(7)
  if (f === 'mois') return !!t.date && t.date >= today && t.date <= isoFromToday(30)
  if (f === 'avenir') return !!t.date && t.date > today
  return true
}

// Formulaire d'ajout de tâches (uniquement : une tâche ou collage en masse). La modification se fait dans la liste lecture seule.
export function TacheAjoutForm({ items, onChange, tauxHoraire = 71 }: { items: ProjetTache[]; onChange: (v: ProjetTache[]) => void; tauxHoraire?: number }) {
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState(isoFromToday(0))
  const [newPour, setNewPour] = useState<'client' | 'sc'>('sc')
  const [newFact, setNewFact] = useState<Facturation | undefined>('inclus')
  const [newTempsH, setNewTempsH] = useState('')
  const addOne = () => {
    const d = newDesc.trim()
    if (!d) return
    const t: ProjetTache = { description: d, date: newDate, fait: false, pour: newPour }
    if (newFact) t.facturation = newFact
    if (newFact === 'facturer' && newTempsH) t.tempsH = Math.max(0, parseFloat(newTempsH) || 0)
    onChange([t, ...items])
    setNewDesc(''); setNewDate(isoFromToday(0)); setNewTempsH('')
  }
  const [bulk, setBulk] = useState('')
  const [bulkPour, setBulkPour] = useState<'client' | 'sc'>('sc')
  const [bulkFact, setBulkFact] = useState<Facturation | undefined>('inclus')
  const [bulkTempsH, setBulkTempsH] = useState('')
  const addBulk = () => {
    const tempsH = bulkFact === 'facturer' && bulkTempsH ? Math.max(0, parseFloat(bulkTempsH) || 0) : undefined
    const rows: ProjetTache[] = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [desc, date] = l.split('|').map((s) => s.trim())
      return { description: desc, date: toIsoDate(date || '') || isoFromToday(0), fait: false, pour: bulkPour, facturation: bulkFact, tempsH }
    })
    if (rows.length) onChange([...items, ...rows])
    setBulk('')
  }
  return (
    <div className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-3">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={newDesc} placeholder="Nouvelle tâche…" autoFocus onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOne() } }}
          className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <PourChips value={newPour} onChange={setNewPour} />
        <FacturationChips value={newFact} onChange={setNewFact} />
        {newFact === 'facturer' && (
          <span className="flex items-center gap-1.5 shrink-0">
            <input type="number" min={0} step={0.5} value={newTempsH} placeholder="h" title="Temps estimé (heures)"
              onChange={(e) => setNewTempsH(e.target.value)}
              className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {newTempsH && <span className="text-[11px] font-medium text-rose-600">≈ {Math.round((parseFloat(newTempsH) || 0) * tauxHoraire)} €</span>}
          </span>
        )}
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
          className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <div className="flex items-center gap-1">
          {DATE_CHIPS.map((c) => (
            <button key={c.l} type="button" onClick={() => setNewDate(isoFromToday(c.days, c.months))}
              className="text-[11px] px-2 py-1 rounded-full border border-gray-300 bg-white text-gray-600 hover:border-blue-400 transition">{c.l}</button>
          ))}
        </div>
        <button type="button" onClick={addOne} disabled={!newDesc.trim()}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition shrink-0">
          <PlusIcon className="w-4 h-4" /> Ajouter
        </button>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-[11px] font-medium text-indigo-700 list-none flex items-center gap-1.5">
          <span className="inline-block transition group-open:rotate-90">▸</span> Ajout rapide (colle plusieurs lignes)
        </summary>
        <div className="mt-2 space-y-1.5">
          <p className="text-[11px] text-gray-400">Ces réglages s'appliquent à <strong>toutes</strong> les lignes collées (tu ajustes ensuite chaque tâche si besoin).</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-2">Pour : <PourChips value={bulkPour} onChange={setBulkPour} /></span>
            <span className="flex items-center gap-2">Statut : <FacturationChips value={bulkFact} onChange={setBulkFact} /></span>
            {bulkFact === 'facturer' && (
              <span className="flex items-center gap-1.5">
                <input type="number" min={0} step={0.5} value={bulkTempsH} placeholder="h" title="Temps par tâche (heures)"
                  onChange={(e) => setBulkTempsH(e.target.value)}
                  className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {bulkTempsH && <span className="text-[11px] font-medium text-rose-600">≈ {Math.round((parseFloat(bulkTempsH) || 0) * tauxHoraire)} € / tâche</span>}
              </span>
            )}
          </div>
          <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder={'Une tâche par ligne. Date en option après « | » (sinon aujourd\'hui).\nEx :\nEnvoyer la maquette | 21/11\nCréer la base de données\nFormation utilisateurs | 30/03'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <button type="button" onClick={addBulk} disabled={!bulk.trim()}
            className="flex items-center gap-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition">
            <PlusIcon className="w-3.5 h-3.5" /> Ajouter ces lignes
          </button>
        </div>
      </details>
    </div>
  )
}

// Vue lecture seule des tâches : recherche + filtres + sections, avec édition/suppression par ligne (sauvegarde immédiate via onChange)
export function TachesApercu({ taches, onChange, tauxHoraire = 71 }: { taches: ProjetTache[]; onChange?: (v: ProjetTache[]) => void; tauxHoraire?: number }) {
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'client' | 'sc'>('tous')
  const [filtreDate, setFiltreDate] = useState<FiltreDate>('toutes')
  const today = isoFromToday(0)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<ProjetTache | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const [confirmFait, setConfirmFait] = useState<number | null>(null)
  if (!taches || taches.length === 0)
    return <p className="text-sm text-gray-400 text-center py-10">Aucune tâche pour l'instant.<br />Clique sur « Modifier » pour en ajouter.</p>

  const q = search.trim().toLowerCase()
  const indexed = taches.map((t, idx) => ({ t, idx }))
    .filter(({ t }) => (filtre === 'tous' || (t.pour ?? 'sc') === filtre) && matchDateFilter(t, filtreDate) && (!q || t.description.toLowerCase().includes(q)))
  const todo = indexed.filter(({ t }) => !t.fait)
  const done = indexed.filter(({ t }) => t.fait)
  const nbRetard = taches.filter((t) => estEnRetard(t, today)).length

  const toggleFait = (idx: number) => onChange?.(taches.map((x, j) => (j === idx ? { ...x, fait: !x.fait } : x)))
  const startEdit = (idx: number) => { setEditIdx(idx); setDraft({ ...taches[idx] }); setConfirmIdx(null) }
  const saveEdit = () => { if (editIdx === null || !draft) return; onChange?.(taches.map((x, j) => (j === editIdx ? draft : x))); setEditIdx(null); setDraft(null) }
  const del = (idx: number) => { onChange?.(taches.filter((_, j) => j !== idx)); setConfirmIdx(null) }

  const row = ({ t, idx }: { t: ProjetTache; idx: number }) => {
    if (editIdx === idx && draft) return (
      <div key={idx} className="flex flex-wrap gap-2 items-center py-1.5">
        <input autoFocus value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <PourChips value={draft.pour ?? 'sc'} onChange={(v) => setDraft({ ...draft, pour: v })} />
        <FacturationChips value={draft.facturation} onChange={(v) => setDraft({ ...draft, facturation: v })} />
        {draft.facturation === 'facturer' && (
          <span className="flex items-center gap-1.5 shrink-0">
            <input type="number" min={0} step={0.5} value={draft.tempsH ?? ''} placeholder="h" title="Temps estimé (heures)"
              onChange={(e) => setDraft({ ...draft, tempsH: e.target.value === '' ? undefined : Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {prixFacture(draft, tauxHoraire) != null && <span className="text-[11px] font-medium text-rose-600">≈ {prixFacture(draft, tauxHoraire)} €</span>}
            <label className="flex items-center gap-1 text-[11px] text-gray-500"><input type="checkbox" checked={!!draft.facturee} onChange={(e) => setDraft({ ...draft, facturee: e.target.checked })} className="w-3.5 h-3.5 accent-emerald-600" /> facturée</label>
          </span>
        )}
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={saveEdit} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition">Enregistrer</button>
        <button type="button" onClick={() => { setEditIdx(null); setDraft(null) }} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition">Annuler</button>
      </div>
    )
    const prix = prixFacture(t, tauxHoraire)
    return (
      <div key={idx} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 py-1.5 border-b border-gray-50 last:border-0">
        <button type="button" onClick={() => { if (!onChange) return; if (t.fait) toggleFait(idx); else setConfirmFait(idx) }} disabled={!onChange} title={t.fait ? 'Marquer à faire' : 'Marquer terminée'}
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition ${t.fait ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 enabled:hover:border-emerald-400'}`}>
          {t.fait && <CheckIcon className="w-3 h-3" />}
        </button>
        <span className={`flex-1 min-w-[120px] text-sm ${t.fait ? 'text-gray-400' : 'text-gray-700'}`}>{t.description || '—'}</span>
        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${(t.pour ?? 'sc') === 'client' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{(t.pour ?? 'sc') === 'client' ? 'Client' : 'Moi'}</span>
        {t.facturation && (t.facturee
          ? <span className="text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 bg-gray-100 text-gray-400">✓ facturée</span>
          : <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${FAC_BADGE[t.facturation].c}`}>{FAC_BADGE[t.facturation].l}</span>)}
        {!t.facturee && prix != null && <span className="text-[10px] font-medium text-rose-600 shrink-0">≈ {prix} €</span>}
        {estEnRetard(t, today) && <span className="text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 bg-rose-100 text-rose-700">En retard</span>}
        {t.date && <span className="text-xs text-gray-400 tabular-nums shrink-0">{fmtDateFr(t.date)}</span>}
        {onChange && (confirmIdx === idx ? (
          <span className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => del(idx)} className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition">Oui</button>
            <button type="button" onClick={() => setConfirmIdx(null)} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded-lg transition">Non</button>
          </span>
        ) : (
          <span className="flex items-center gap-0.5 shrink-0">
            <button type="button" onClick={() => startEdit(idx)} title="Modifier cette ligne" className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => setConfirmIdx(idx)} title="Supprimer cette ligne" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2 items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une tâche…"
            className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex items-center gap-1 shrink-0">
            {FILTRES_POUR.map((f) => (
              <button key={f.k} type="button" onClick={() => setFiltre(f.k)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${filtre === f.k ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>{f.l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[11px] text-gray-400 mr-1">Échéance :</span>
          {FILTRES_DATE.map((f) => {
            const isRetard = f.k === 'retard'
            return (
              <button key={f.k} type="button" onClick={() => setFiltreDate(f.k)}
                className={`text-xs px-2.5 py-1 rounded-full border transition ${filtreDate === f.k ? (isRetard ? 'bg-rose-500 border-rose-500 text-white' : 'bg-gray-800 border-gray-800 text-white') : isRetard && nbRetard > 0 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                {f.l}{isRetard && nbRetard > 0 ? ` (${nbRetard})` : ''}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">À faire ({todo.length})</p>
        {todo.length === 0 ? <p className="text-xs text-gray-400">Aucune.</p> : <div>{todo.map(row)}</div>}
      </div>
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 uppercase tracking-wide list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> Terminées ({done.length})
          </summary>
          <div className="mt-1">{done.map(row)}</div>
        </details>
      )}
      {confirmFait !== null && (
        <Modal isOpen onClose={() => setConfirmFait(null)} title="Marquer comme terminée ?" size="sm">
          <p className="text-sm text-gray-600 mb-4">« <strong>{taches[confirmFait]?.description || '—'}</strong> » sera marquée comme <strong>terminée</strong>.</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setConfirmFait(null)} className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">Annuler</button>
            <button type="button" onClick={() => { toggleFait(confirmFait); setConfirmFait(null) }} className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">Oui, terminée</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Aperçu lecture seule du contenu projet (vue « propre & pro ») ──
export function fmtDateFr(s: string): string {
  if (!s) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s
}
const respColor = (r: string) =>
  r === 'Client' ? 'bg-amber-100 text-amber-700'
    : r === 'Développeur' ? 'bg-blue-100 text-blue-700'
    : 'bg-purple-100 text-purple-700'

// Vue lecture seule du planning (timeline) avec édition/suppression par ligne (sauvegarde immédiate via onChange)
export function PlanningApercu({ planning, onChange, etapesTypes }: { planning: ProjetPlanning[]; onChange?: (v: ProjetPlanning[]) => void; etapesTypes?: string[] }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<ProjetPlanning | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const etapes = etapesTypes ?? DEFAULT_PLANNING_ETAPES
  if (!planning || planning.length === 0)
    return <p className="text-sm text-gray-400 text-center py-10">Aucune étape pour l'instant.<br />Clique sur « Modifier » pour en ajouter.</p>
  const today = todayIso()
  const startEdit = (i: number) => { setEditIdx(i); setDraft({ ...planning[i] }); setConfirmIdx(null) }
  const saveEdit = () => { if (editIdx === null || !draft) return; onChange?.(recalcPlanning(planning.map((x, j) => (j === editIdx ? draft : x)))); setEditIdx(null); setDraft(null) }
  const del = (i: number) => { onChange?.(recalcPlanning(planning.filter((_, j) => j !== i))); setConfirmIdx(null) }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Passée</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Aujourd'hui</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" /> À venir</span>
      </div>
      <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
      {planning.map((s, i) => {
        if (editIdx === i && draft) return (
          <li key={i} className="ml-4 relative border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
            <div className="flex gap-2 flex-wrap items-center">
              <EtapeCombobox value={draft.etape} onChange={(v) => setDraft({ ...draft, etape: v })} options={etapes} autoFocus className="w-40" />
              <input value={draft.description} placeholder="Description" onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value, ancre: i > 0 ? true : undefined })} className="w-36 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex items-center gap-1">
                {RESPONSABLES_PLANNING.map((r) => {
                  const on = draft.responsable === r
                  return <button key={r} type="button" onClick={() => setDraft({ ...draft, responsable: on ? '' : r })} className={`text-xs px-2 py-1 rounded-full border transition ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>{r}</button>
                })}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setEditIdx(null); setDraft(null) }} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition">Annuler</button>
              <button type="button" onClick={saveEdit} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition">Enregistrer</button>
            </div>
          </li>
        )
        return (
          <li key={i} className="ml-4 relative">
            <span title={s.date ? (s.date < today ? 'Passée' : s.date === today ? "Aujourd'hui" : 'À venir') : undefined}
              className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${planningDotColor(s.date, today)}`} />
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-800">{s.etape || '—'}</p>
                {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.responsable && <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${respColor(s.responsable)}`}>{s.responsable}</span>}
                {s.date && <span className="text-xs text-gray-500 tabular-nums">{fmtDateFr(s.date)}</span>}
                {onChange && (confirmIdx === i ? (
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => del(i)} className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition">Oui</button>
                    <button type="button" onClick={() => setConfirmIdx(null)} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded-lg transition">Non</button>
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5">
                    <button type="button" onClick={() => startEdit(i)} title="Modifier cette ligne" className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setConfirmIdx(i)} title="Supprimer cette ligne" className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
            </div>
          </li>
        )
      })}
      </ol>
    </div>
  )
}

function ApercuTitle({ t }: { t: string }) {
  return <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{t}</h3>
}

export type ApercuSection = 'contexte' | 'fonctionnalites' | 'livrables' | 'horsPerimetre' | 'planning'

export function ProjetApercu({ projet, only }: { projet?: ProjetContent; only?: ApercuSection[] }) {
  const n = (a?: unknown[]) => a?.length ?? 0
  const show = (s: ApercuSection) => !only || only.includes(s)
  const nonEmpty = (s: ApercuSection): boolean => {
    if (!projet) return false
    if (s === 'contexte') return !!projet.contexte?.trim()
    if (s === 'fonctionnalites') return n(projet.fonctionnalites) > 0
    if (s === 'livrables') return n(projet.livrables) > 0
    if (s === 'horsPerimetre') return n(projet.horsPerimetre) > 0
    return n(projet.planning) > 0
  }
  const allSections: ApercuSection[] = ['contexte', 'fonctionnalites', 'livrables', 'horsPerimetre', 'planning']
  const today = todayIso()
  const visible = allSections.filter((s) => show(s) && nonEmpty(s))
  if (!projet || visible.length === 0)
    return <p className="text-sm text-gray-400 text-center py-10">Rien à afficher pour l'instant.<br />Clique sur « Modifier » pour remplir.</p>
  const p = projet
  return (
    <div className="space-y-6">
      {show('contexte') && nonEmpty('contexte') && (
        <section><ApercuTitle t="Contexte" /><p className="text-sm text-gray-700 whitespace-pre-wrap">{p.contexte}</p></section>
      )}
      {show('fonctionnalites') && nonEmpty('fonctionnalites') && (
        <section><ApercuTitle t="Fonctionnalités" />
          <ul className="space-y-1.5">
            {p.fonctionnalites.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                {f.categorie && <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 h-fit">{f.categorie}</span>}
                <span className="text-gray-700">{f.description}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {show('livrables') && nonEmpty('livrables') && (
        <section><ApercuTitle t="Livrables" />
          <ul className="space-y-1 text-sm text-gray-700">
            {p.livrables.map((l, i) => <li key={i} className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>{l}</li>)}
          </ul>
        </section>
      )}
      {show('horsPerimetre') && nonEmpty('horsPerimetre') && (
        <section><ApercuTitle t="Hors-périmètre" />
          <ul className="space-y-1 text-sm text-gray-500">
            {p.horsPerimetre.map((l, i) => <li key={i} className="flex gap-2"><span className="text-gray-300 shrink-0">✕</span>{l}</li>)}
          </ul>
        </section>
      )}
      {show('planning') && nonEmpty('planning') && (
        <section><ApercuTitle t="Planning prévisionnel" />
          <ol className="relative border-l border-gray-200 ml-1.5 space-y-3">
            {p.planning.map((s, i) => (
              <li key={i} className="ml-4 relative">
                <span className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${planningDotColor(s.date, today)}`} />
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.etape || '—'}</p>
                    {s.description && <p className="text-xs text-gray-500">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.responsable && <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${respColor(s.responsable)}`}>{s.responsable}</span>}
                    {s.date && <span className="text-xs text-gray-500 tabular-nums">{fmtDateFr(s.date)}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
