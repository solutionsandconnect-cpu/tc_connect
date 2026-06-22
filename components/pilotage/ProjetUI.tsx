'use client'

// Éditeurs & aperçu du « contenu projet » d'un contrat Pilotage.
// Extraits pour être partagés entre la page /pilotage et la page dédiée /pilotage/contrat/[id].
import { useState } from 'react'
import { PlusIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, CheckIcon, PencilIcon } from '@heroicons/react/24/outline'
import type { ProjetFonction, ProjetPlanning, ProjetTache, ProjetContent } from '@/types'
import { RESPONSABLES_PLANNING, recalcPlanning, HORS_PERIMETRE_DEFAUT } from '@/lib/pilotageProjetTemplates'

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

export function PlanningEditor({ items, onChange }: { items: ProjetPlanning[]; onChange: (v: ProjetPlanning[]) => void }) {
  // Toute modification repasse par recalcPlanning : les dates en aval suivent les délais (sauf étapes ancrées).
  const commit = (next: ProjetPlanning[]) => onChange(recalcPlanning(next))
  const [confirmDel, setConfirmDel] = useState<number | null>(null)
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
              <input value={p.etape} placeholder="Étape" onChange={(e) => upd(i, { etape: e.target.value })} className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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

export function TachesEditor({ items, onChange }: { items: ProjetTache[]; onChange: (v: ProjetTache[]) => void }) {
  const upd = (i: number, patch: Partial<ProjetTache>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  // Formulaire d'ajout (en haut), une seule liste : chaque tâche indique qui la réalise (Moi / Client).
  const [newDesc, setNewDesc] = useState('')
  const [newDate, setNewDate] = useState('')
  const [newPour, setNewPour] = useState<'client' | 'sc'>('sc')
  const addOne = () => {
    const d = newDesc.trim()
    if (!d) return
    onChange([{ description: d, date: newDate, fait: false, pour: newPour }, ...items]) // ajoutée en tête
    setNewDesc(''); setNewDate('')  // on garde « pour » sélectionné pour enchaîner
  }
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'client' | 'sc'>('tous')
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  const [bulk, setBulk] = useState('')
  const [bulkPour, setBulkPour] = useState<'client' | 'sc'>('sc')
  const addBulk = () => {
    const rows = bulk.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
      const [desc, date] = l.split('|').map((s) => s.trim())
      return { description: desc, date: toIsoDate(date || ''), fait: false, pour: bulkPour }
    })
    if (rows.length) onChange([...items, ...rows])
    setBulk('')
  }

  const q = search.trim().toLowerCase()
  const indexed = items.map((t, idx) => ({ t, idx }))
    .filter(({ t }) => filtre === 'tous' || (t.pour ?? 'sc') === filtre)
    .filter(({ t }) => !q || t.description.toLowerCase().includes(q))
  const todo = indexed.filter(({ t }) => !t.fait)
  const done = indexed.filter(({ t }) => t.fait)

  const renderRow = (t: ProjetTache, idx: number) => (
    <div key={idx} className="flex flex-wrap gap-2 items-center">
      <button type="button" onClick={() => upd(idx, { fait: !t.fait })} title={t.fait ? 'Marquer à faire' : 'Marquer terminée'}
        className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition ${t.fait ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-emerald-400'}`}>
        {t.fait && <CheckIcon className="w-3 h-3" />}
      </button>
      <input value={t.description} placeholder="Description" onChange={(e) => upd(idx, { description: e.target.value })}
        className={`flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${t.fait ? 'text-gray-400' : ''}`} />
      <PourChips value={t.pour ?? 'sc'} onChange={(v) => upd(idx, { pour: v })} />
      <input type="date" value={t.date} onChange={(e) => upd(idx, { date: e.target.value })} className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      {confirmIdx === idx ? (
        <span className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-gray-500">Supprimer ?</span>
          <button type="button" onClick={() => { onChange(items.filter((_, j) => j !== idx)); setConfirmIdx(null) }} className="text-xs font-medium text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-lg transition">Oui</button>
          <button type="button" onClick={() => setConfirmIdx(null)} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2 py-1 rounded-lg transition">Non</button>
        </span>
      ) : (
        <button type="button" onClick={() => setConfirmIdx(idx)} className={delBtn}><TrashIcon className="w-4 h-4" /></button>
      )}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Formulaire d'ajout — en haut */}
      <div className="flex flex-wrap gap-2 items-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-2">
        <input value={newDesc} placeholder="Nouvelle tâche…" onChange={(e) => setNewDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOne() } }}
          className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <PourChips value={newPour} onChange={setNewPour} />
        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)}
          className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={addOne} disabled={!newDesc.trim()}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-3 py-1.5 rounded-lg transition shrink-0">
          <PlusIcon className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {/* Recherche + filtre par responsable */}
      {items.length > 0 && (
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
      )}

      {/* À faire */}
      {items.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">À faire ({todo.length})</p>
          {todo.length === 0 ? <p className="text-xs text-gray-400">Aucune.</p> : todo.map(({ t, idx }) => renderRow(t, idx))}
        </div>
      )}

      {/* Terminées (repliable) */}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[11px] font-semibold text-gray-500 uppercase tracking-wide list-none flex items-center gap-1.5">
            <span className="inline-block transition group-open:rotate-90">▸</span> Terminées ({done.length})
          </summary>
          <div className="space-y-1.5 mt-1.5">{done.map(({ t, idx }) => renderRow(t, idx))}</div>
        </details>
      )}

      {/* Ajout rapide (plusieurs lignes) */}
      <details className="group">
        <summary className="cursor-pointer text-[11px] font-medium text-indigo-700 list-none flex items-center gap-1.5">
          <span className="inline-block transition group-open:rotate-90">▸</span> Ajout rapide (colle plusieurs lignes)
        </summary>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">Pour : <PourChips value={bulkPour} onChange={setBulkPour} /></div>
          <textarea rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder={'Une tâche par ligne. Date en option après « | ».\nEx :\nEnvoyer la maquette | 21/11\nCréer la base de données\nFormation utilisateurs | 30/03'}
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
export function TachesApercu({ taches, onChange }: { taches: ProjetTache[]; onChange?: (v: ProjetTache[]) => void }) {
  const [search, setSearch] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'client' | 'sc'>('tous')
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<ProjetTache | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
  if (!taches || taches.length === 0)
    return <p className="text-sm text-gray-400 text-center py-10">Aucune tâche pour l'instant.<br />Clique sur « Modifier » pour en ajouter.</p>

  const q = search.trim().toLowerCase()
  const indexed = taches.map((t, idx) => ({ t, idx }))
    .filter(({ t }) => (filtre === 'tous' || (t.pour ?? 'sc') === filtre) && (!q || t.description.toLowerCase().includes(q)))
  const todo = indexed.filter(({ t }) => !t.fait)
  const done = indexed.filter(({ t }) => t.fait)

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
        <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
          className="w-36 shrink-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="button" onClick={saveEdit} className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1.5 rounded-lg transition">Enregistrer</button>
        <button type="button" onClick={() => { setEditIdx(null); setDraft(null) }} className="text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg transition">Annuler</button>
      </div>
    )
    return (
      <div key={idx} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
        <button type="button" onClick={() => toggleFait(idx)} disabled={!onChange} title={t.fait ? 'Marquer à faire' : 'Marquer terminée'}
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border-2 transition ${t.fait ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 enabled:hover:border-emerald-400'}`}>
          {t.fait && <CheckIcon className="w-3 h-3" />}
        </button>
        <span className={`flex-1 text-sm ${t.fait ? 'text-gray-400' : 'text-gray-700'}`}>{t.description || '—'}</span>
        <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${(t.pour ?? 'sc') === 'client' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{(t.pour ?? 'sc') === 'client' ? 'Client' : 'Moi'}</span>
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
export function PlanningApercu({ planning, onChange }: { planning: ProjetPlanning[]; onChange?: (v: ProjetPlanning[]) => void }) {
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [draft, setDraft] = useState<ProjetPlanning | null>(null)
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null)
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
              <input autoFocus value={draft.etape} placeholder="Étape" onChange={(e) => setDraft({ ...draft, etape: e.target.value })} className="w-28 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
