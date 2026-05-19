'use client'

import { useState, useMemo } from 'react'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useRouter } from 'next/navigation'
import { usePlanning } from '@/hooks/usePlanning'
import { useUsers } from '@/hooks/useUsers'
import { useUserDetails } from '@/hooks/useUserDetails'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import AdresseAutocomplete from '@/components/ui/AdresseAutocomplete'
import MaterielSelect from '@/components/ui/MaterielSelect'
import { formatDate, formatHeure, getEtatBadge, isSameDay } from '@/lib/planningUtils'
import {
  PlusIcon, ChevronLeftIcon, ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

// Constantes
const ETATS = ['Non calé', 'Calé', 'Annulé', 'Effectué']

const TYPES_RDV = [
  { groupe: 'TC', options: ['Séance', 'Programme', 'Rendez-vous informations', 'Rendez-vous bilan', 'Règlement TC', 'Séance en autonomie', 'Autre activité', 'Parcours sportif'] },
  { groupe: 'S&C', options: ['Rendez-vous infos S&C', 'Rendez-vous bilan S&C', 'Règlement S&C'] },
  { groupe: 'FFD', options: ['Détection', 'Règlement FFD'] },
  { groupe: 'EMF', options: ['Séminaire', 'Règlement EMF'] },
]

const MATERIEL_DEFAUT = ['Sac', 'Tapis', 'Enceinte', 'Chrono']

function getEtatBadgeLocal(etat: string) {
  switch (etat) {
    case 'Calé': return { label: 'Calé', variant: 'success' as const }
    case 'Non calé': return { label: 'Non calé', variant: 'warning' as const }
    case 'Annulé': return { label: 'Annulé', variant: 'danger' as const }
    case 'Effectué': return { label: 'Effectué', variant: 'info' as const }
    default: return { label: etat || '—', variant: 'gray' as const }
  }
}

// Formulaire vide
const emptyForm = {
  ref_client: '',
  date: '',
  heure_debut: '',
  heure_fin: '',
  adresse_rdv: '',
  etat_planning_rdv: 'Non calé',
  observations_rdv: '',
  type_planning: 'Séance',
  materiel: [] as string[],
  ref_database_user: '',
}

export default function PlanningPage() {
  const { currentUser } = useAuth()
  const { plannings, loading, addPlanning, updatePlanning, deletePlanning } = usePlanning()
  const { users } = useUsers()
  const router = useRouter()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [searchClient, setSearchClient] = useState('')
  const [form, setForm] = useState({ ...emptyForm, materiel: [...MATERIEL_DEFAUT] })

  // Abonnements du client sélectionné
  const { details: clientDetails } = useUserDetails(form.ref_client || undefined)

  // Filtrage clients par recherche
  const filteredUsers = useMemo(() => {
    if (!searchClient) return users
    const s = searchClient.toLowerCase()
    return users.filter((u) =>
      `${u.prenom} ${u.nom}`.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s)
    )
  }, [users, searchClient])

  // Quand on sélectionne un client — pré-remplir adresse
  const handleClientChange = (clientId: string) => {
    const client = users.find((u) => u.id === clientId)
    setForm({
      ...form,
      ref_client: clientId,
      adresse_rdv: (client as any)?.adresse_postale || form.adresse_rdv,
      ref_database_user: '',
    })
  }

  // Navigation semaine
  const startOfWeek = new Date(selectedDate)
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay() + 1)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    return d
  })

  const planningsDuJour = plannings.filter((p) =>
    p.date_planning && isSameDay(p.date_planning as any, selectedDate)
  )

  const openAdd = () => {
    setEditItem(null)
    setSearchClient('')
    setForm({
      ...emptyForm,
      date: selectedDate.toISOString().split('T')[0],
      materiel: [...MATERIEL_DEFAUT],
    })
    setShowModal(true)
  }

  const openEdit = (item: any, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditItem(item)
    setSearchClient('')
    const date = item.date_planning?.toDate()
    const debut = item.heure_planning_debut?.toDate()
    const fin = item.heure_planning_fin?.toDate()
    setForm({
      ref_client: item.ref_client?.id || '',
      date: date ? date.toISOString().split('T')[0] : '',
      heure_debut: debut
        ? `${String(debut.getHours()).padStart(2, '0')}:${String(debut.getMinutes()).padStart(2, '0')}`
        : '',
      heure_fin: fin
        ? `${String(fin.getHours()).padStart(2, '0')}:${String(fin.getMinutes()).padStart(2, '0')}`
        : '',
      adresse_rdv: item.adresse_rdv || '',
      etat_planning_rdv: item.etat_planning_rdv || 'Non calé',
      observations_rdv: item.observations_rdv || '',
      type_planning: item.type_planning || 'Séance',
      materiel: Array.isArray(item.materiel) ? item.materiel : item.materiel ? [item.materiel] : [...MATERIEL_DEFAUT],
      ref_database_user: item.refDatabaseUser?.id || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return

    const [year, month, day] = form.date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const [hDebut, mDebut] = form.heure_debut.split(':').map(Number)
    const [hFin, mFin] = form.heure_fin.split(':').map(Number)
    const dateDebut = new Date(dateObj)
    dateDebut.setHours(hDebut, mDebut, 0)
    const dateFin = new Date(dateObj)
    dateFin.setHours(hFin, mFin, 0)

    const payload: any = {
  ref_users: form.ref_client ? doc(db, 'users', form.ref_client) : null,
  rdv_cree_par: doc(db, 'users', currentUser.uid),  // ← le coach connecté
  date_planning: Timestamp.fromDate(dateObj),
  heure_planning_debut: Timestamp.fromDate(dateDebut),
  heure_planning_fin: Timestamp.fromDate(dateFin),
  adresse_rdv: form.adresse_rdv,
  etat_planning_rdv: form.etat_planning_rdv,
  observations_rdv: form.observations_rdv,
  type_planning: form.type_planning,
  materiel: form.materiel,
  rdv_pret: '',
  rdv_effectue: '',
  questionnaire_rempli: false,
  date_create: Timestamp.now(),
}

if (form.ref_database_user) {
  payload.refDatabaseUser = doc(db, 'database_users_details', form.ref_database_user)
}

    if (editItem) {
      await updatePlanning(editItem.id, payload)
    } else {
      await addPlanning(payload)
    }
    setShowModal(false)
  }

  const handleDelete = async (id: string) => {
    await deletePlanning(id)
    setShowDeleteConfirm(null)
  }

  return (
    <div>
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Planning</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <PlusIcon className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Navigation semaine */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 capitalize">
            {startOfWeek.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d) }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <ChevronRightIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isSelected = day.toDateString() === selectedDate.toDateString()
            const isToday = day.toDateString() === new Date().toDateString()
            const hasPlannings = plannings.some(
              (p) => p.date_planning && isSameDay(p.date_planning as any, day)
            )
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`flex flex-col items-center py-2 rounded-xl transition ${
                  isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <span className="text-xs">{day.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                <span className="text-sm font-semibold">{day.getDate()}</span>
                {hasPlannings && (
                  <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Liste RDV du jour */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {formatDate(Timestamp.fromDate(selectedDate))} — {planningsDuJour.length} RDV
        </h2>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Chargement...</div>
        ) : planningsDuJour.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
            <p className="text-gray-400 text-sm">Aucun RDV ce jour</p>
            <button onClick={openAdd} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
              + Ajouter un RDV
            </button>
          </div>
        ) : (
          planningsDuJour.map((item) => {
            const etat = getEtatBadgeLocal(item.etat_planning_rdv)
            const client = users.find((u) => u.id === (item as any).ref_client?.id)
            return (
              <div
                key={item.id}
                onClick={() => router.push(`/planning/${item.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 cursor-pointer hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-800">
                        {formatHeure(item.heure_planning_debut as any)} → {formatHeure(item.heure_planning_fin as any)}
                      </span>
                      <Badge label={etat.label} variant={etat.variant} />
                    </div>
                    {client && (
                      <p className="text-xs text-blue-600 font-medium">
                        👤 {client.prenom} {client.nom}
                      </p>
                    )}
                    {(item as any).type_planning && (
                      <p className="text-xs text-gray-500">{(item as any).type_planning}</p>
                    )}
                    {item.adresse_rdv && (
                      <p className="text-xs text-gray-400">📍 {item.adresse_rdv}</p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => openEdit(item, e)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(item.id) }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ── MODAL AJOUT / MODIFICATION ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Modifier le RDV' : 'Nouveau RDV'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Recherche + sélection client */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <div className="relative mb-2">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchClient}
                onChange={(e) => setSearchClient(e.target.value)}
                className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={form.ref_client}
              onChange={(e) => handleClientChange(e.target.value)}
              size={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Aucun client —</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom} {u.email ? `— ${u.email}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Abonnement — chargé depuis database_users_details */}
          {form.ref_client && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abonnement</label>
              {clientDetails.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucun abonnement trouvé pour ce client</p>
              ) : (
                <select
                  value={form.ref_database_user}
                  onChange={(e) => setForm({ ...form, ref_database_user: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sélectionner un abonnement —</option>
                  {clientDetails.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.titre_abo || d.categorie_prestation || d.type_suivi || 'Abonnement sans titre'}
                      {d.etat ? ` — ${d.etat}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Type de RDV */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de RDV</label>
            <select
              value={form.type_planning}
              onChange={(e) => setForm({ ...form, type_planning: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TYPES_RDV.map((groupe) => (
                <optgroup key={groupe.groupe} label={groupe.groupe}>
                  {groupe.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure début</label>
              <input
                type="time"
                value={form.heure_debut}
                onChange={(e) => setForm({ ...form, heure_debut: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
              <input
                type="time"
                value={form.heure_fin}
                onChange={(e) => setForm({ ...form, heure_fin: e.target.value })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Adresse avec autocomplétion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse
              {form.ref_client && users.find(u => u.id === form.ref_client) && (
                <span className="text-xs text-gray-400 ml-2">
                  (pré-remplie depuis le profil client)
                </span>
              )}
            </label>
            <AdresseAutocomplete
              value={form.adresse_rdv}
              onChange={(val) => setForm({ ...form, adresse_rdv: val })}
              placeholder="Rechercher une adresse..."
            />
          </div>

          {/* Matériel multi-choix */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Matériel</label>
            <MaterielSelect
              value={form.materiel}
              onChange={(val) => setForm({ ...form, materiel: val })}
            />
          </div>

          {/* État */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">État</label>
            <select
              value={form.etat_planning_rdv}
              onChange={(e) => setForm({ ...form, etat_planning_rdv: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {ETATS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Observations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea
              value={form.observations_rdv}
              onChange={(e) => setForm({ ...form, observations_rdv: e.target.value })}
              rows={3}
              placeholder="Notes, observations..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-medium transition"
            >
              {editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Supprimer ce RDV ?"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setShowDeleteConfirm(null)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  )
}