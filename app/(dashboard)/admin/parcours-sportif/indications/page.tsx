'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useParcoursIndications } from '@/hooks/useParcoursIndications'
import {
  NIVEAU_INDICATION, toDateInput, fromDateInput, fmtPlage, statutIndication,
} from '@/lib/parcoursIndications'
import { IndicationBanner } from '@/components/parcours/IndicationBanner'
import type { ParcoursIndication, ParcoursIndicationNiveau } from '@/types'
import Modal from '@/components/ui/Modal'
import {
  ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, MegaphoneIcon,
  ChevronUpIcon, ChevronDownIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

interface SessionLite { id: string; title: string; date: Timestamp }

const NIVEAUX: ParcoursIndicationNiveau[] = ['info', 'avertissement', 'urgent']

function emptyForm() {
  return {
    titre: '', message: '',
    niveau: 'avertissement' as ParcoursIndicationNiveau,
    portee: 'global' as 'global' | 'session',
    sessionId: '',
    surSeances: true,
    dateDebut: '', dateFin: '',
  }
}

const STATUT_CHIP: Record<'active' | 'à venir' | 'expirée', string> = {
  active: 'bg-green-100 text-green-700',
  'à venir': 'bg-blue-100 text-blue-700',
  expirée: 'bg-gray-100 text-gray-500',
}

export default function ParcoursIndicationsPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const { indications, loading, addIndication, updateIndication, deleteIndication, reorderIndications } = useParcoursIndications()
  const [sessions, setSessions] = useState<SessionLite[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // Filtres & recherche
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState<'toutes' | 'active' | 'à venir' | 'expirée'>('toutes')

  useEffect(() => {
    const q = query(collection(db, 'sessions'), orderBy('date', 'asc'))
    return onSnapshot(q,
      (snap) => setSessions(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SessionLite, 'id'>) }))),
      () => setSessions([]),
    )
  }, [])

  if (!isAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  }

  const sessionLabel = (id?: string | null) => {
    const s = sessions.find((x) => x.id === id)
    return s
      ? `${s.title} · ${s.date.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Séance supprimée'
  }

  const isFiltering = search.trim() !== '' || statutFilter !== 'toutes'
  const q = search.trim().toLowerCase()
  const filtered = indications.filter((i) => {
    if (statutFilter !== 'toutes' && statutIndication(i) !== statutFilter) return false
    if (q && !(`${i.titre} ${i.message}`.toLowerCase().includes(q))) return false
    return true
  })

  // Réordonnancement (uniquement sur la liste complète, non filtrée)
  const move = async (id: string, dir: -1 | 1) => {
    const ids = indications.map((x) => x.id)
    const i = ids.indexOf(id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    await reorderIndications(ids)
  }

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true) }
  const openEdit = (i: ParcoursIndication) => {
    setEditId(i.id)
    setForm({
      titre: i.titre, message: i.message, niveau: i.niveau,
      portee: i.portee, sessionId: i.sessionId ?? '',
      surSeances: i.surSeances !== false,
      dateDebut: toDateInput(i.dateDebut), dateFin: toDateInput(i.dateFin),
    })
    setError(''); setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titre.trim() && !form.message.trim()) { setError('Ajoutez au moins un titre ou un message.'); return }
    if (!form.dateDebut || !form.dateFin) { setError("Renseignez les dates de début et de fin d'affichage."); return }
    if (fromDateInput(form.dateDebut).toMillis() > fromDateInput(form.dateFin, true).toMillis()) {
      setError('La date de fin doit être après la date de début.'); return
    }
    if (form.portee === 'session' && !form.sessionId) {
      setError('Sélectionnez la séance concernée (ou choisissez « Tout le parcours »).'); return
    }
    setSaving(true)
    try {
      const payload = {
        titre: form.titre.trim(),
        message: form.message.trim(),
        niveau: form.niveau,
        portee: form.portee,
        sessionId: form.portee === 'session' ? form.sessionId : null,
        surSeances: form.portee === 'global' ? form.surSeances : true,
        dateDebut: fromDateInput(form.dateDebut),
        dateFin: fromDateInput(form.dateFin, true),
      }
      if (editId) await updateIndication(editId, payload)
      else await addIndication({ ...payload, ordre: indications.length, createdAt: Timestamp.now() })
      setShowForm(false)
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/admin/parcours-sportif')} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Indications — Parcours Sportif</h1>
            <p className="text-sm text-gray-500">Annonces affichées aux visiteurs (alerte météo, changement de lieu…)</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <PlusIcon className="w-4 h-4" />
          Nouvelle indication
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
        Une indication s'affiche entre sa <strong>date de début</strong> et sa <strong>date de fin</strong>. En portée
        <strong> « Tout le parcours »</strong>, elle apparaît sur la page publique pendant cette période <em>et</em> sur
        chaque séance dont la date tombe dans cette plage (donc aussi au moment de réserver cette date). En portée
        <strong> « Une séance précise »</strong>, elle n'apparaît que sur la séance choisie.
      </div>

      {!loading && indications.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher dans les indications…"
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 overflow-x-auto">
            {([
              { key: 'toutes', label: 'Toutes' },
              { key: 'active', label: 'Actives' },
              { key: 'à venir', label: 'À venir' },
              { key: 'expirée', label: 'Passées' },
            ] as const).map((o) => (
              <button key={o.key} type="button" onClick={() => setStatutFilter(o.key)}
                className={`text-xs font-medium px-3 py-1.5 rounded-md transition whitespace-nowrap ${
                  statutFilter === o.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isFiltering && indications.length > 0 && (
        <p className="text-[11px] text-gray-400 -mt-2">Réorganisation par glisser possible uniquement sans filtre ni recherche (onglet « Toutes »).</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : indications.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <MegaphoneIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucune indication</p>
          <p className="text-sm text-gray-400 mt-1">Créez-en une pour informer les visiteurs (ex : alerte canicule).</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <MagnifyingGlassIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun résultat</p>
          <p className="text-sm text-gray-400 mt-1">Aucune indication ne correspond à ce filtre ou cette recherche.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((i, idx) => {
            const st = NIVEAU_INDICATION[i.niveau]
            const statut = statutIndication(i)
            return (
              <div key={i.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.chip}`}>{st.label}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUT_CHIP[statut]}`}>{statut}</span>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {i.portee === 'global'
                        ? (i.surSeances === false ? 'En haut de la page seulement' : 'Tout le parcours')
                        : sessionLabel(i.sessionId)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isFiltering && (
                      <div className="flex flex-col mr-1">
                        <button type="button" onClick={() => move(i.id, -1)} disabled={idx === 0} title="Monter"
                          className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronUpIcon className="w-4 h-4" /></button>
                        <button type="button" onClick={() => move(i.id, 1)} disabled={idx === filtered.length - 1} title="Descendre"
                          className="text-gray-300 enabled:text-gray-500 enabled:hover:text-blue-600 disabled:opacity-40"><ChevronDownIcon className="w-4 h-4" /></button>
                      </div>
                    )}
                    <button onClick={() => openEdit(i)} title="Modifier"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmDel(i.id)} title="Supprimer"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3"><IndicationBanner indication={i} /></div>
                <p className="text-[11px] text-gray-400 mt-2">Affichée : {fmtPlage(i.dateDebut, i.dateFin)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Formulaire création / édition */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? 'Modifier l\'indication' : 'Nouvelle indication'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
            <input type="text" value={form.titre}
              onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
              placeholder="Ex : Alerte canicule"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea value={form.message} rows={3}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Ex : En raison des fortes chaleurs, la séance du 25 juin pourrait être annulée. Surveillez vos messages."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Niveau</label>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {NIVEAUX.map((n) => (
                <button key={n} type="button" onClick={() => setForm((f) => ({ ...f, niveau: n }))}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
                    form.niveau === n ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {NIVEAU_INDICATION[n].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Portée</label>
            <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
              {([
                { key: 'global', label: 'Tout le parcours' },
                { key: 'session', label: 'Une séance précise' },
              ] as const).map((p) => (
                <button key={p.key} type="button" onClick={() => setForm((f) => ({ ...f, portee: p.key }))}
                  className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
                    form.portee === p.key ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>
            {form.portee === 'session' && (
              <select value={form.sessionId}
                onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}
                className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Choisir une séance —</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>{sessionLabel(s.id)}</option>
                ))}
              </select>
            )}
          </div>

          {form.portee === 'global' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Où l'afficher ?</label>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                {([
                  { val: true, label: 'Partout' },
                  { val: false, label: 'En haut de la page seulement' },
                ] as const).map((o) => (
                  <button key={String(o.val)} type="button" onClick={() => setForm((f) => ({ ...f, surSeances: o.val }))}
                    className={`text-xs font-medium px-3 py-1.5 rounded-md transition ${
                      form.surSeances === o.val ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                <strong>Partout</strong> : bandeau d'accueil + sur chaque séance dont la date tombe dans la plage.
                <strong> En haut seulement</strong> : uniquement le bandeau d'accueil (idéal pour une annonce générale type « Nouvelles dates à venir »).
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début d'affichage</label>
              <input type="date" value={form.dateDebut}
                onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin d'affichage</label>
              <input type="date" value={form.dateFin}
                onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Aperçu */}
          {(form.titre.trim() || form.message.trim()) && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Aperçu</p>
              <IndicationBanner indication={{ titre: form.titre.trim(), message: form.message.trim(), niveau: form.niveau }} />
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
              {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Créer l\'indication'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation de suppression */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Supprimer l'indication ?" size="sm">
        <p className="text-sm text-gray-600">Cette indication ne sera plus affichée aux visiteurs. Cette action est définitive.</p>
        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={async () => { if (confirmDel) await deleteIndication(confirmDel); setConfirmDel(null) }}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            Supprimer
          </button>
          <button onClick={() => setConfirmDel(null)}
            className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
        </div>
      </Modal>
    </div>
  )
}
