'use client'

import { useState, useEffect } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import Modal from '@/components/ui/Modal'
import SuggestInput from '@/components/ui/SuggestInput'
import { Section, Field, ErrBox, ModalActions, toDateInput, fromDateInput } from '@/components/ui/ClientEditModal'
import { ObjectifsList } from '@/components/ui/ClientForms'
import { useCompanies } from '@/hooks/useCompanies'
import { createAbonnement, updateAbonnement } from '@/lib/abonnementService'
import type { Abonnement, AbonnementEtat, Objectif } from '@/types'

// ── Constantes ────────────────────────────────────────────────────────────────

export const CATEGORIES_ABO = ['Teddy Coaching', 'FFD', 'EMF', 'S&C']

export const TYPE_SUIVI_OPTIONS: Record<string, string[]> = {
  'Teddy Coaching': ['Coaching', "Plan d'entrainement", "Coaching + Plan d'entrainement", 'Parcours Sportif', 'Testing', 'Suivi collectif à distance', 'Programme 20 minutes - 1 Objectif', 'Boutique TC'],
  'FFD': ['Détection', 'Suivi de joueurs', "Pack d'accompagnement FFD", 'Formation FFD'],
  'EMF': ['Formation EMF'],
  'S&C': ['Solutions & Connect', 'Acces TC-Connect'],
}

const ETAT_OPTIONS: AbonnementEtat[] = ['Prospect', 'Actif', 'Inactif']

const RAISONS_ARRET_SUIVI = [
  'Objectif atteint', 'Raisons financières', 'Manque de temps', 'Déménagement',
  'Changement de coach', 'Blessure / Problème de santé', 'Raison médicale',
  'Reprise autonome', 'Pause temporaire', 'Insatisfaction', 'Fin de contrat',
  'Non-renouvellement client', 'Décès', 'Autre',
]

const NOTE_TYPES = ['Observation', 'Alerte', 'Bilan', 'Objectif', 'Absence/Vacances', 'Autre']

function getNoteStyle(type: string) {
  switch (type) {
    case 'Alerte':         return { card: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-700' }
    case 'Bilan':          return { card: 'bg-sky-50 border-sky-200',    badge: 'bg-sky-100 text-sky-700' }
    case 'Objectif':       return { card: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' }
    case 'Observation':    return { card: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700' }
    default:               return { card: 'bg-gray-50 border-gray-200',  badge: 'bg-gray-100 text-gray-500' }
  }
}

const inputCls = 'w-full border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition'

type AboNoteItem = { texte: string; type_note: string }

type AboForm = {
  categorie: string; companyId: string; typeSuivi: string
  dateDebut: string; dateFin: string; etat: AbonnementEtat
  objectifs: Objectif[]; resumeSuivi: string; indications: string
  notesInternes: AboNoteItem[]; arretSuivi: string
}

const EMPTY: AboForm = {
  categorie: '', companyId: '', typeSuivi: '',
  dateDebut: '', dateFin: '', etat: 'Actif',
  objectifs: [], resumeSuivi: '', indications: '',
  notesInternes: [], arretSuivi: '',
}

// ── Sous-composant notes ──────────────────────────────────────────────────────

function AboNotesPanel({ value, onChange }: { value: AboNoteItem[]; onChange: (v: AboNoteItem[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [noteForm, setNoteForm] = useState({ texte: '', type_note: 'Observation' })
  return (
    <div className="space-y-3">
      {value.map((n, i) => {
        const s = getNoteStyle(n.type_note)
        return (
          <div key={i} className={`rounded-xl border p-3 ${s.card}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${s.badge}`}>{n.type_note}</span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.texte}</p>
              </div>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      })}
      {adding ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <select value={noteForm.type_note} onChange={(e) => setNoteForm((f) => ({ ...f, type_note: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
            {NOTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <textarea rows={3} placeholder="Contenu de la note..." value={noteForm.texte} onChange={(e) => setNoteForm((f) => ({ ...f, texte: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAdding(false); setNoteForm({ texte: '', type_note: 'Observation' }) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={() => { if (!noteForm.texte.trim()) return; onChange([...value, { texte: noteForm.texte, type_note: noteForm.type_note }]); setNoteForm({ texte: '', type_note: 'Observation' }); setAdding(false) }} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">Ajouter</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter une note</button>
      )}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved?: (id: string, etat: AbonnementEtat, arretSuivi?: string, resumeSuivi?: string) => void
  clientId: string
  userId: string
  editing?: Abonnement | null
  defaultCompanyId?: string
  defaultObjectifs?: Objectif[]
}

export function AbonnementModal({ isOpen, onClose, onSaved, clientId, userId, editing, defaultCompanyId, defaultObjectifs }: Props) {
  const { companies } = useCompanies()
  const [form, setForm] = useState<AboForm>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setError('')
    if (editing) {
      setForm({
        categorie: editing.categorie,
        companyId: editing.companyId ?? '',
        typeSuivi: editing.typeSuivi ?? '',
        dateDebut: toDateInput(editing.dateDebut ?? null),
        dateFin: toDateInput(editing.dateFin ?? null),
        etat: (['Prospect', 'Actif', 'Inactif'].includes(editing.etat) ? editing.etat : 'Actif') as AbonnementEtat,
        objectifs: Array.isArray(editing.objectifs) ? editing.objectifs : [],
        resumeSuivi: editing.resumeSuivi ?? '',
        indications: editing.indications ?? '',
        notesInternes: Array.isArray((editing as any).notesInternes) ? (editing as any).notesInternes : [],
        arretSuivi: (editing as any).arretSuivi ?? '',
      })
    } else {
      const co = defaultCompanyId ?? companies.find((c) => c.nom.toLowerCase().includes('teddy'))?.id ?? companies[0]?.id ?? ''
      setForm({ ...EMPTY, companyId: co, objectifs: defaultObjectifs ?? [] })
    }
  }, [isOpen, editing?.id])

  const set = (f: keyof Pick<AboForm, 'categorie' | 'companyId' | 'typeSuivi' | 'dateDebut' | 'dateFin' | 'etat' | 'resumeSuivi' | 'indications'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [f]: e.target.value }))

  const submit = async () => {
    if (!form.categorie.trim()) return setError('La catégorie est requise.')
    setSaving(true)
    try {
      const company = companies.find((c) => c.id === form.companyId)
      const base = {
        userId, clientId,
        companyId: form.companyId || undefined,
        companyNom: company?.nom || undefined,
        categorie: form.categorie,
        typeSuivi: form.typeSuivi || undefined,
        dateDebut: fromDateInput(form.dateDebut),
        dateFin: fromDateInput(form.dateFin),
        etat: form.etat,
        objectifs: form.objectifs.length ? form.objectifs : undefined,
        resumeSuivi: form.resumeSuivi || undefined,
        indications: form.indications || undefined,
        notesInternes: form.notesInternes.length ? form.notesInternes : undefined,
        arretSuivi: form.arretSuivi || undefined,
      }
      if (editing) {
        await updateAbonnement(editing.id, base)
        onSaved?.(editing.id, form.etat, form.arretSuivi || undefined, form.resumeSuivi || undefined)
      } else {
        const ref = await createAbonnement(base as Omit<Abonnement, 'id' | 'createdAt' | 'updatedAt'>)
        onSaved?.(ref.id, form.etat, form.arretSuivi || undefined, form.resumeSuivi || undefined)
      }
      onClose()
    } catch {
      setError("Erreur lors de l'enregistrement.")
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal title={editing ? "Modifier l'abonnement" : 'Nouvel abonnement'} onClose={onClose} isOpen size="lg">
      <div className="space-y-5">
        <Section title="Prestation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Catégorie *">
              <select className={inputCls} value={form.categorie} onChange={(e) => { setForm((p) => ({ ...p, categorie: e.target.value, typeSuivi: '' })) }}>
                <option value="">— Choisir —</option>
                {CATEGORIES_ABO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Société">
              <select className={inputCls} value={form.companyId} onChange={set('companyId')}>
                <option value="">— Aucune —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Type de suivi">
            <SuggestInput
              value={form.typeSuivi}
              onChange={(v) => setForm((p) => ({ ...p, typeSuivi: v }))}
              suggestions={TYPE_SUIVI_OPTIONS[form.categorie] ?? []}
              placeholder={form.categorie ? 'Choisir ou saisir...' : 'Sélectionner d\'abord une catégorie'}
              className={inputCls}
            />
          </Field>
        </Section>

        <Section title="Période & état">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Date début">
              <input type="date" className={inputCls} value={form.dateDebut}
                onChange={(e) => {
                  const d = e.target.value
                  setForm((p) => {
                    const next = { ...p, dateDebut: d }
                    if (d && !p.dateFin && !editing) {
                      const dt = new Date(d)
                      dt.setMonth(dt.getMonth() + 3)
                      next.dateFin = dt.toISOString().slice(0, 10)
                    }
                    return next
                  })
                }}
              />
            </Field>
            <Field label={<span>Date fin max. <span className="text-gray-300 font-normal">(échéance)</span></span>}>
              <input type="date" className={inputCls} value={form.dateFin} onChange={set('dateFin')} />
              {form.dateDebut && (
                <div className="flex gap-1 mt-1 flex-wrap">
                  {([['1m', 1], ['3m', 3], ['6m', 6], ['1an', 12]] as [string, number][]).map(([label, months]) => (
                    <button key={label} type="button"
                      onClick={() => { const dt = new Date(form.dateDebut); dt.setMonth(dt.getMonth() + months); setForm((p) => ({ ...p, dateFin: dt.toISOString().slice(0, 10) })) }}
                      className="text-xs px-1.5 py-0.5 rounded bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500 transition">
                      +{label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label="État">
              <select className={inputCls} value={form.etat} onChange={set('etat')}>
                {ETAT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Suivi">
          <Field label="Objectifs">
            <ObjectifsList value={form.objectifs} onChange={(v) => setForm((p) => ({ ...p, objectifs: v }))} simple={form.categorie !== 'Teddy Coaching'} />
          </Field>
          <Field label="Résumé du suivi">
            <textarea rows={3} className={inputCls + ' resize-none'} placeholder="Bilan général du suivi, progression, remarques..." value={form.resumeSuivi} onChange={set('resumeSuivi')} />
          </Field>
          <Field label="Indications / Recommandations">
            <textarea rows={2} className={inputCls + ' resize-none'} value={form.indications} onChange={set('indications')} />
          </Field>
          <Field label={<span>Raison de non reconduction <span className="text-gray-300 font-normal">(optionnel)</span></span>}>
            <SuggestInput value={form.arretSuivi} onChange={(v) => setForm((p) => ({ ...p, arretSuivi: v }))} suggestions={RAISONS_ARRET_SUIVI} placeholder="Ex : Objectif atteint, déménagement..." className={inputCls} />
          </Field>
        </Section>

        <Section title="Notes internes">
          <AboNotesPanel value={form.notesInternes} onChange={(v) => setForm((p) => ({ ...p, notesInternes: v }))} />
        </Section>

        {error && <ErrBox msg={error} />}
        <ModalActions onCancel={onClose} onSubmit={submit} saving={saving} label={editing ? 'Enregistrer' : 'Créer'} />
      </div>
    </Modal>
  )
}
