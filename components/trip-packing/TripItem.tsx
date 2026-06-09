'use client'

import { useState, useRef } from 'react'
import { qtyEffective } from '@/lib/tripsService'
import { uploadImage } from '@/lib/uploadImage'
import { randomUUID } from '@/lib/uuid'
import type { TripItem as TripItemType, TripMember, TripAttachment } from '@/types'
import {
  CheckIcon, ChevronDownIcon, ChevronUpIcon, TrashIcon,
  MinusIcon, PlusIcon, CalendarIcon, LinkIcon, PhotoIcon, PaperClipIcon,
  CheckCircleIcon, XCircleIcon, DocumentDuplicateIcon, PencilIcon,
} from '@heroicons/react/24/outline'

interface SectionOption { id: string; title: string }

interface Props {
  item: TripItemType
  nbJours: number | null
  members: TripMember[]
  tripId: string
  photoMap?: Record<string, string>
  isFirst: boolean
  isLast: boolean
  canToggle?: boolean
  canEdit?: boolean
  sectionId?: string
  sections?: SectionOption[]
  onToggle: () => void
  onSetReady: (qty: number) => void
  onUpdate: (patch: Partial<TripItemType>) => void
  onDelete: () => void
  onMove: (dir: 'up' | 'down') => void
  onDuplicate?: () => void
  onMoveToSection?: (toSectionId: string) => void
}

function memberLabel(m: TripMember): string {
  return [m.prenom, m.nom].filter(Boolean).join(' ') || m.email || m.uid.slice(0, 6)
}

function dueDateInfo(dueDate?: string | null): { label: string; color: string } | null {
  if (!dueDate) return null
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000)
  if (diffDays < 0) return { label: 'En retard', color: 'text-red-600 bg-red-50 border-red-200' }
  if (diffDays === 0) return { label: "Aujourd'hui", color: 'text-orange-600 bg-orange-50 border-orange-200' }
  if (diffDays <= 3) return { label: `Dans ${diffDays} j`, color: 'text-orange-500 bg-orange-50 border-orange-200' }
  if (diffDays <= 5) return { label: `Dans ${diffDays} j`, color: 'text-amber-600 bg-amber-50 border-amber-200' }
  return { label: due.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), color: 'text-gray-500 bg-gray-50 border-gray-200' }
}

function exportToCalendar(name: string, dueDate: string) {
  const d = dueDate.replace(/-/g, '')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CheckConnect//FR',
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${d}`,
    `SUMMARY:✅ ${name}`,
    `DESCRIPTION:CheckConnect — à faire avant le ${new Date(dueDate + 'T00:00:00').toLocaleDateString('fr-FR')}`,
    `UID:${dueDate}-${Math.random().toString(36).slice(2)}@checkconnect`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${name}.ics`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function TripItem({
  item, nbJours, members, tripId, photoMap = {}, isFirst, isLast,
  canToggle = true, canEdit = true, sectionId, sections = [],
  onToggle, onSetReady, onUpdate, onDelete, onMove, onDuplicate, onMoveToSection,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(item.name)
  const [linkDraft, setLinkDraft] = useState('')
  const [addingLink, setAddingLink] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const otherSections = sections.filter(s => s.id !== sectionId)
  const photoRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const eff = qtyEffective(item, nbJours)
  const done = item.qtyReady >= eff

  const assignee = members.find(m => m.uid === item.assigneeId)

  const commitName = () => {
    const v = nameDraft.trim()
    if (v && v !== item.name) onUpdate({ name: v })
    else setNameDraft(item.name)
    setEditingName(false)
  }

  const addAttachment = (att: TripAttachment) => {
    onUpdate({ attachments: [...(item.attachments ?? []), att] })
  }
  const removeAttachment = (id: string) => {
    onUpdate({ attachments: (item.attachments ?? []).filter(a => a.id !== id) })
  }

  const handleAddLink = () => {
    const url = linkDraft.trim()
    if (!url) return
    const withProtocol = url.startsWith('http') ? url : `https://${url}`
    addAttachment({ id: randomUUID(), type: 'link', url: withProtocol, name: url })
    setLinkDraft(''); setAddingLink(false)
  }

  const handleUpload = async (file: File, type: 'photo' | 'file') => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `checklist_items/${tripId}/${item.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const url = await uploadImage(file, path)
      addAttachment({ id: randomUUID(), type, url, name: file.name, mimeType: file.type })
    } catch { /* silencieux */ }
    finally { setUploading(false) }
  }

  return (
    <div className={`rounded-xl border transition ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'}`}>
      {/* Toute la ligne est cliquable pour expand — sauf checkbox, flèches et quantité */}
      <div
        onClick={() => !editingName && setExpanded(v => !v)}
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
      >
        {/* Flèches réordonnancement — stopPropagation */}
        <div className="flex flex-col gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove('up')} disabled={isFirst} aria-label="Monter"
            className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onMove('down')} disabled={isLast} aria-label="Descendre"
            className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Checkbox — stopPropagation */}
        <button
          onClick={e => { e.stopPropagation(); canToggle && onToggle() }}
          role="checkbox"
          aria-checked={done}
          aria-label={done ? 'Marquer comme à préparer' : 'Marquer comme prêt'}
          className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${
            done ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'
          } ${canToggle ? 'hover:border-green-400 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
        >
          {done && <CheckIcon className="w-4 h-4" strokeWidth={3} />}
        </button>

        {/* Nom (crayon pour renommer) */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameDraft(item.name); setEditingName(false) } }}
              className="w-full text-sm border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <p className={`text-sm truncate ${done ? 'line-through text-gray-400' : 'text-gray-800 font-medium'}`}>
                {item.name}
              </p>
              {canEdit && (
                <button
                  onClick={e => { e.stopPropagation(); setNameDraft(item.name); setEditingName(true) }}
                  title="Renommer"
                  className="p-0.5 text-gray-300 hover:text-blue-500 transition shrink-0">
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
          {(assignee || item.note || item.dueDate) && (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {assignee && (
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  {(photoMap[assignee.uid] || assignee.photoUrl)
                    ? <img src={photoMap[assignee.uid] || assignee.photoUrl} alt={memberLabel(assignee)} className="w-3.5 h-3.5 rounded-full object-cover" />
                    : <span className="w-3.5 h-3.5 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-[8px] font-bold">{memberLabel(assignee)[0]}</span>
                  }
                  {memberLabel(assignee)}
                </span>
              )}
              {item.dueDate && (() => {
                const info = dueDateInfo(item.dueDate)
                return info ? (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${info.color}`}>
                    📅 {info.label}
                  </span>
                ) : null
              })()}
              {item.note && <span className="text-[11px] text-gray-400 truncate">📝 {item.note}</span>}
            </div>
          )}
        </div>

        {/* Stepper qtyReady / qtyEffective — stopPropagation */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => onSetReady(item.qtyReady - 1)} disabled={item.qtyReady <= 0} aria-label="Moins"
            className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition">
            <MinusIcon className="w-3.5 h-3.5" />
          </button>
          <span className={`text-xs font-semibold tabular-nums min-w-[42px] text-center ${done ? 'text-green-600' : 'text-gray-700'}`}>
            {item.qtyReady}/{eff}
          </span>
          <button onClick={() => onSetReady(item.qtyReady + 1)} disabled={item.qtyReady >= eff} aria-label="Plus"
            className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition">
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Indicateur expand (pas un bouton — la ligne entière gère le clic) */}
        <span className="p-1 text-gray-400 shrink-0" aria-hidden>
          <ChevronDownIcon className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </span>
      </div>

      {/* Panneau extensible */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 space-y-3 bg-gray-50/60 rounded-b-xl">
          {/* Date limite */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Date limite</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={item.dueDate ?? ''}
                onChange={e => onUpdate({ dueDate: e.target.value || null })}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {item.dueDate && (
                <button
                  type="button"
                  onClick={() => exportToCalendar(item.name, item.dueDate!)}
                  title="Ajouter à mon agenda"
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition shrink-0"
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  Agenda
                </button>
              )}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">Note / commentaire</label>
            <input
              type="text"
              value={item.note ?? ''}
              onChange={e => onUpdate({ note: e.target.value })}
              placeholder="Ex : précisions, lien, remarque…"
              className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* qtyNeeded fixe */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Quantité fixe</label>
              <div className="flex items-center gap-1">
                <button onClick={() => onUpdate({ qtyNeeded: Math.max(1, item.qtyNeeded - 1) })} aria-label="Moins"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-8 text-center">{item.qtyNeeded}</span>
                <button onClick={() => onUpdate({ qtyNeeded: item.qtyNeeded + 1 })} aria-label="Plus"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              {item.multiplier > 0 && <p className="text-[10px] text-gray-400 mt-1">Ignoré (multiplicateur actif)</p>}
            </div>

            {/* multiplier / jour */}
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Par jour (×)</label>
              <div className="flex items-center gap-1">
                <button onClick={() => onUpdate({ multiplier: item.multiplier <= 1 ? 0 : item.multiplier - 0.5 })} aria-label="Moins"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <MinusIcon className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-semibold tabular-nums w-8 text-center">{item.multiplier || '—'}</span>
                <button onClick={() => onUpdate({ multiplier: item.multiplier < 1 ? 1 : item.multiplier + 0.5 })} aria-label="Plus"
                  className="w-7 h-7 rounded-md bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center transition">
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              {item.multiplier > 0 && (
                <p className="text-[10px] text-blue-500 mt-1">
                  {nbJours ? `→ ${eff} pour ${nbJours} j` : 'Définir des dates'}
                </p>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-1">{"Qui s'en occupe"}</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button"
                onClick={() => onUpdate({ assigneeId: null })}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                  !item.assigneeId ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}>
                — Personne
              </button>
              {members.map(m => {
                const name = memberLabel(m)
                const active = item.assigneeId === m.uid
                const photo = photoMap[m.uid] || m.photoUrl
                return (
                  <button key={m.uid} type="button"
                    onClick={() => onUpdate({ assigneeId: m.uid })}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition ${
                      active ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}>
                    {photo
                      ? <img src={photo} alt={name} className="w-4 h-4 rounded-full object-cover" />
                      : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${active ? 'bg-blue-400 text-white' : 'bg-blue-100 text-blue-700'}`}>{name[0]}</span>
                    }
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pièces jointes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-medium text-gray-500">Pièces jointes</label>
              {uploading && <span className="text-[10px] text-blue-500">Chargement…</span>}
            </div>

            {/* Boutons d'ajout */}
            <div className="flex gap-1.5 flex-wrap mb-2">
              <button type="button" onClick={() => setAddingLink(v => !v)}
                className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg transition">
                <LinkIcon className="w-3.5 h-3.5" /> Lien
              </button>
              <button type="button" onClick={() => photoRef.current?.click()}
                className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg transition">
                <PhotoIcon className="w-3.5 h-3.5" /> Photo
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg transition">
                <PaperClipIcon className="w-3.5 h-3.5" /> Fichier
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'photo'); e.target.value = '' }} />
              <input ref={fileRef} type="file" accept="*/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f, 'file'); e.target.value = '' }} />
            </div>

            {/* Saisie de lien */}
            {addingLink && (
              <div className="flex gap-1.5 mb-2">
                <input type="url" value={linkDraft} onChange={e => setLinkDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddLink() }}
                  placeholder="https://… ou teddycoaching.fr"
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={handleAddLink} disabled={!linkDraft.trim()}
                  className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-2.5 py-1.5 rounded-lg transition">
                  OK
                </button>
              </div>
            )}

            {/* Liste des pièces jointes */}
            {(item.attachments ?? []).length > 0 && (
              <div className="space-y-1">
                {(item.attachments ?? []).map(att => (
                  <div key={att.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                    <span className="text-base shrink-0">
                      {att.type === 'photo' ? '🖼️' : att.type === 'link' ? '🔗' : '📄'}
                    </span>
                    {att.type === 'photo' ? (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 min-w-0">
                        <img src={att.url} alt={att.name} className="h-14 w-auto rounded object-contain" />
                      </a>
                    ) : (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex-1 min-w-0 text-xs text-blue-600 hover:underline truncate">
                        {att.name || att.url}
                      </a>
                    )}
                    <button type="button" onClick={() => removeAttachment(att.id)}
                      className="p-1 text-gray-300 hover:text-red-500 transition shrink-0">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Déplacer vers une autre section */}
          {canEdit && otherSections.length > 0 && onMoveToSection && (
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Déplacer vers une section</label>
              <select
                value=""
                onChange={e => { if (e.target.value) onMoveToSection(e.target.value) }}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">Choisir une section…</option>
                {otherSections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
          )}

          {/* Actions : dupliquer + supprimer */}
          {canEdit && (
            <div className="flex items-center gap-3 pt-1">
              {onDuplicate && !confirmDelete && (
                <button onClick={onDuplicate}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition">
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                  Dupliquer
                </button>
              )}
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">Supprimer ce check ?</span>
                  <button onClick={onDelete}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 transition">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Oui
                  </button>
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                    <XCircleIcon className="w-3.5 h-3.5" /> Non
                  </button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition">
                  <TrashIcon className="w-3.5 h-3.5" />
                  Supprimer ce check
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
