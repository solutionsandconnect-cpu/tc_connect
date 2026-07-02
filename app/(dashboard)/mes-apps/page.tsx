'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Timestamp } from 'firebase/firestore'
import { useAuth } from '@/context/AuthContext'
import { useMesApps, type MesApp } from '@/hooks/useMesApps'
import Modal from '@/components/ui/Modal'
import {
  PlusIcon, PencilIcon, TrashIcon, ArrowTopRightOnSquareIcon, RectangleStackIcon,
  MagnifyingGlassIcon, XMarkIcon,
} from '@heroicons/react/24/outline'

const EMPTY_FORM = { nom: '', url: '', client: '', description: '', tags: [] as string[], actif: true }

type FilterStatus = 'all' | 'online' | 'offline'

// Ajoute https:// si l'utilisateur a collé un lien sans protocole
const normalizeUrl = (raw: string) => {
  const u = raw.trim()
  if (!u) return ''
  return /^https?:\/\//i.test(u) ? u : `https://${u}`
}
// Domaine lisible pour l'affichage (ex. mon-app.vercel.app)
const prettyHost = (url: string) => {
  try { return new URL(url).host } catch { return url }
}

export default function MesAppsPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const { apps, loading, addApp, updateApp, deleteApp } = useMesApps()

  useEffect(() => {
    if (userProfile && !isAdmin) router.replace('/accueil')
  }, [userProfile, isAdmin, router])

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<MesApp | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [tagInput, setTagInput] = useState('')

  // Recherche & filtres
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterTags, setFilterTags] = useState<string[]>([])

  // Tous les tags existants (pour les puces de filtre)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    apps.forEach((a) => (a.tags ?? []).forEach((t) => set.add(t)))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [apps])

  const openAdd = () => {
    setEditItem(null)
    setForm({ ...EMPTY_FORM })
    setTagInput('')
    setShowModal(true)
  }

  const openEdit = (app: MesApp) => {
    setEditItem(app)
    setForm({
      nom: app.nom || '',
      url: app.url || '',
      client: app.client || '',
      description: app.description || '',
      tags: app.tags ?? [],
      actif: app.actif !== false,
    })
    setTagInput('')
    setShowModal(true)
  }

  const addTag = (raw: string) => {
    const t = raw.trim()
    if (!t) return
    if (!form.tags.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setForm((f) => ({ ...f, tags: [...f.tags, t] }))
    }
    setTagInput('')
  }
  const removeTag = (t: string) => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nom: form.nom.trim(),
        url: normalizeUrl(form.url),
        client: form.client.trim(),
        description: form.description.trim(),
        tags: form.tags,
        actif: form.actif,
      }
      if (editItem) {
        await updateApp(editItem.id, payload)
      } else {
        // Nouvelle app placée en fin de liste
        const maxOrdre = apps.reduce((m, a) => Math.max(m, a.ordre ?? 0), 0)
        await addApp({ ...payload, ordre: maxOrdre + 1, date_create: Timestamp.now() })
      }
      setShowModal(false)
    } finally {
      setSaving(false)
    }
  }

  // Liste filtrée (recherche + statut + tags)
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return apps.filter((a) => {
      if (filterStatus === 'online' && a.actif === false) return false
      if (filterStatus === 'offline' && a.actif !== false) return false
      if (filterTags.length > 0 && !filterTags.every((t) => (a.tags ?? []).includes(t))) return false
      if (s) {
        const hay = [a.nom, a.client, a.description, prettyHost(a.url), ...(a.tags ?? [])]
          .filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(s)) return false
      }
      return true
    })
  }, [apps, search, filterStatus, filterTags])

  const activeFilterCount = filterTags.length + (filterStatus !== 'all' ? 1 : 0)

  if (!userProfile || !isAdmin) return null

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mes apps</h1>
          <p className="text-sm text-gray-500">{apps.length} application{apps.length !== 1 ? 's' : ''} créée{apps.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <PlusIcon className="w-4 h-4" />
          Nouvelle app
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative mb-3">
        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, client, tag…"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filtre statut */}
      <div className="flex gap-1 mb-2 bg-white border border-gray-100 rounded-xl p-1">
        {(['all', 'online', 'offline'] as FilterStatus[]).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === s ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {s === 'all' ? 'Toutes' : s === 'online' ? 'En ligne' : 'Hors ligne'}
          </button>
        ))}
      </div>

      {/* Filtre tags */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3 items-center">
          {allTags.map((t) => {
            const on = filterTags.includes(t)
            return (
              <button key={t}
                onClick={() => setFilterTags((prev) => on ? prev.filter((x) => x !== t) : [...prev, t])}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${on ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                #{t}
              </button>
            )
          })}
          {activeFilterCount > 0 && (
            <button onClick={() => { setFilterTags([]); setFilterStatus('all') }}
              className="text-xs text-blue-600 hover:underline ml-1">
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : apps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <RectangleStackIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Aucune app enregistrée</p>
          <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
            + Ajouter une app
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">Aucun résultat</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((app) => (
            <div key={app.id}
              className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-sm font-semibold text-gray-800 truncate">{app.nom}</h2>
                  <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    app.actif !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {app.actif !== false ? 'En ligne' : 'Hors ligne'}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(app)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                    <PencilIcon className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setShowDeleteConfirm(app.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {app.client && <p className="text-xs text-gray-500 mb-1">Client : {app.client}</p>}
              {app.description && <p className="text-xs text-gray-400 mb-2 line-clamp-2">{app.description}</p>}

              {(app.tags ?? []).length > 0 && (
                <div className="flex gap-1 flex-wrap mb-2">
                  {(app.tags ?? []).map((t) => (
                    <button key={t} onClick={() => setFilterTags((prev) => prev.includes(t) ? prev : [...prev, t])}
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              <a href={app.url} target="_blank" rel="noopener noreferrer"
                className="mt-auto flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline truncate">
                <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{prettyHost(app.url)}</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Modal ajout / modification */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editItem ? "Modifier l'app" : 'Nouvelle app'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'app</label>
            <input type="text" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required placeholder="Ex : Diambars FC"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lien (Vercel ou autre)</label>
            <input type="text" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
              required inputMode="url" placeholder="mon-app.vercel.app"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">Le « https:// » est ajouté automatiquement si besoin.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client (optionnel)</label>
            <input type="text" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
              placeholder="Ex : Diambars FC"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags (optionnel)</label>
            {form.tags.length > 0 && (
              <div className="flex gap-1.5 flex-wrap mb-2">
                {form.tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} className="text-blue-400 hover:text-blue-700">
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
                placeholder="Ex : Next.js, sport, en cours…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => addTag(tagInput)}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                <PlusIcon className="w-4 h-4" />
              </button>
            </div>
            {allTags.filter((t) => !form.tags.some((x) => x.toLowerCase() === t.toLowerCase())).length > 0 && (
              <div className="flex gap-1.5 flex-wrap mt-2">
                {allTags.filter((t) => !form.tags.some((x) => x.toLowerCase() === t.toLowerCase())).map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition">
                    + {t}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Notes, stack, statut…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={form.actif} onChange={(e) => setForm({ ...form, actif: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            App en ligne
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition">
              {saving ? 'Enregistrement…' : editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={!!showDeleteConfirm} onClose={() => setShowDeleteConfirm(null)} title="Supprimer cette app ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Le lien sera retiré de la liste. Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={() => showDeleteConfirm && deleteApp(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}
