'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timestamp, doc, collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { usePlanning } from '@/hooks/usePlanning'
import { useSeances } from '@/hooks/useSeances'
import { useUsers } from '@/hooks/useUsers'
import { useNotes } from '@/hooks/useNotes'
import { useUserDetails } from '@/hooks/useUserDetails'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import AdresseAutocomplete from '@/components/ui/AdresseAutocomplete'
import MaterielSelect from '@/components/ui/MaterielSelect'
import {
  ArrowLeftIcon, PencilIcon, TrashIcon,
  ClipboardDocumentListIcon, PlusIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { formatDate, formatHeure } from '@/lib/planningUtils'
import { useAuth } from '@/context/AuthContext'

const ETATS = ['Non calé', 'Calé', 'Annulé', 'Effectué']
const TYPES_SEANCE = ['Musculation','Cardio','Circuit training','HIIT','Stretching','Technique','Mixte','Autre']
const PARTIES_SEANCE = ['Échauffement','Corps de séance','Retour au calme','Séance complète']
const TYPES_RDV = [
  { groupe: 'TC', options: ['Séance','Programme','Rendez-vous informations','Rendez-vous bilan','Règlement TC','Séance en autonomie','Autre activité','Parcours sportif'] },
  { groupe: 'S&C', options: ['Rendez-vous infos S&C','Rendez-vous bilan S&C','Règlement S&C'] },
  { groupe: 'FFD', options: ['Détection','Règlement FFD'] },
  { groupe: 'EMF', options: ['Séminaire','Règlement EMF'] },
]

const QUESTIONS_FORME = [
  { key: 'qualite_sommeil', label: 'Sommeil', question: 'Qualité de sommeil de la nuit dernière ?', labels: ['Très très bonne','Très bonne','Bonne','Moyenne','Mauvaise','Très mauvaise','Très très mauvaise'] },
  { key: 'niveau_fatigue', label: 'Fatigue', question: 'Niveau de fatigue actuel ?', labels: ['Très très faible','Très faible','Faible','Moyen','Élevé','Très élevé','Très très élevé'] },
  { key: 'niveau_courbatures', label: 'Courbatures', question: 'Niveau de courbatures / douleurs ?', labels: ['Très très faible','Très faible','Faible','Moyen','Élevé','Très élevé','Très très élevé'] },
  { key: 'quantite_stress', label: 'Stress', question: 'Quantité de stress actuelle ?', labels: ['Très très faible','Très faible','Faible','Moyen','Élevée','Très élevée','Très très élevée'] },
  { key: 'motiv_avant_seance', label: 'Motivation', question: 'Motivation avant séance ?', labels: ['Pas motivé','Peu motivé','Moyennement motivé','Motivé','Très motivé'] },
  { key: 'activite_avant_seance', label: 'Activité', question: 'Activité physique ces derniers jours ?', labels: ['Passif / Rien fait','Peu actif','Moyennement actif','Actif','Très actif'] },
  { key: 'alimentation_avant_seance', label: 'Alimentation', question: 'Alimentation ces derniers jours ?', labels: ["Que des excès","Beaucoup d'excès","Quelques excès","Très très peu d'excès","Aucun excès / Nutrition hyper saine"] },
]

function getEtatBadgeLocal(etat: string) {
  switch (etat) {
    case 'Calé': return { label: 'Calé', variant: 'success' as const }
    case 'Non calé': return { label: 'Non calé', variant: 'warning' as const }
    case 'Annulé': return { label: 'Annulé', variant: 'danger' as const }
    case 'Effectué': return { label: 'Effectué', variant: 'info' as const }
    default: return { label: etat || '—', variant: 'gray' as const }
  }
}

export default function DetailPlanningPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { currentUser } = useAuth()
  const { plannings, updatePlanning, deletePlanning } = usePlanning()
  const { seances, addSeance } = useSeances(id)
  const { users } = useUsers()
  const { notes } = useNotes()

  // Planning + client — déclarés en premier
  const planning = plannings.find((p) => p.id === id)
  const clientId = (planning as any)?.ref_client?.id
    || (planning as any)?.ref_client?.path?.split('/').pop()
  const client = users.find((u) => u.id === clientId)
  const { details: clientDetails } = useUserDetails(clientId)

  // Notes client — après clientId
  const notesClient = notes.filter((n) => {
    const refId = typeof n.ref_users === 'string'
      ? n.ref_users
      : (n.ref_users as any)?.id
    return refId === clientId
  })
  const notesActives = notesClient.filter((n) => {
    if (!n.date_max_note_active) return true
    return (n.date_max_note_active as any).toDate() >= new Date()
  })

  // Derniers RDV effectués
  const [derniersRdv, setDerniersRdv] = useState<any[]>([])
  useEffect(() => {
    if (!clientId) return
    const fetchDerniers = async () => {
      const q = query(
        collection(db, 'planning_pro'),
        where('ref_client', '==', doc(db, 'users', clientId)),
        where('etat_planning_rdv', '==', 'Effectué'),
        orderBy('date_planning', 'desc')
      )
      try {
        const snap = await getDocs(q)
        setDerniersRdv(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r: any) => r.id !== id)
            .slice(0, 5)
        )
      } catch {}
    }
    fetchDerniers()
  }, [clientId, id])

  // Modals
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSeanceModal, setShowSeanceModal] = useState(false)
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false)
  const [showQuestionnaireDirectModal, setShowQuestionnaireDirectModal] = useState(false)
  const [showPlanifModal, setShowPlanifModal] = useState(false)

  // States
  const [intensitePlanifiee, setIntensitePlanifiee] = useState(1)

  const [form, setForm] = useState({
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
    cr_rdv_moi: '',
    cr_rdv_client: '',
  })

  const [seanceForm, setSeanceForm] = useState({
    type_seance: 'Musculation',
    partie_seance: 'Corps de séance',
    observations_seance: '',
    nb_tours: 1,
    recup_tours: 60,
  })

  const [questionnaireForm, setQuestionnaireForm] = useState({
    qualite_sommeil: 1,
    niveau_fatigue: 1,
    niveau_courbatures: 1,
    quantite_stress: 1,
    motiv_avant_seance: 1,
    activite_avant_seance: 1,
    alimentation_avant_seance: 1,
    commentaire_forme: '',
  })

  // Handlers
  const openEdit = () => {
    if (!planning) return
    const date = (planning.date_planning as any)?.toDate()
    const debut = (planning.heure_planning_debut as any)?.toDate()
    const fin = (planning.heure_planning_fin as any)?.toDate()
    setForm({
      ref_client: clientId || '',
      date: date ? `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` : '',
      heure_debut: debut ? `${String(debut.getHours()).padStart(2,'0')}:${String(debut.getMinutes()).padStart(2,'0')}` : '',
      heure_fin: fin ? `${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}` : '',
      adresse_rdv: planning.adresse_rdv || '',
      etat_planning_rdv: planning.etat_planning_rdv || 'Non calé',
      observations_rdv: planning.observations_rdv || '',
      type_planning: (planning as any).type_planning || 'Séance',
      materiel: Array.isArray((planning as any).materiel) ? (planning as any).materiel : (planning as any).materiel ? [(planning as any).materiel] : [],
      ref_database_user: (planning as any).refDatabaseUser?.id || '',
      cr_rdv_moi: (planning as any).cr_rdv_moi || '',
      cr_rdv_client: (planning as any).cr_rdv_client || '',
    })
    setShowEditModal(true)
  }

  const openQuestionnaireDirect = () => {
    if (!planning) return
    setQuestionnaireForm({
      qualite_sommeil: (planning as any).qualite_sommeil || 1,
      niveau_fatigue: (planning as any).niveau_fatigue || 1,
      niveau_courbatures: (planning as any).niveau_courbatures || 1,
      quantite_stress: (planning as any).quantite_stress || 1,
      motiv_avant_seance: (planning as any).motiv_avant_seance || 1,
      activite_avant_seance: (planning as any).activite_avant_seance || 1,
      alimentation_avant_seance: (planning as any).alimentation_avant_seance || 1,
      commentaire_forme: (planning as any).commentaire_forme || '',
    })
    setShowQuestionnaireDirectModal(true)
  }

  const openPlanif = () => {
    setIntensitePlanifiee((planning as any)?.intensite_seance_planifiee || 1)
    setShowPlanifModal(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    const [year, month, day] = form.date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const [hDebut, mDebut] = form.heure_debut.split(':').map(Number)
    const [hFin, mFin] = form.heure_fin.split(':').map(Number)
    const dateDebut = new Date(dateObj); dateDebut.setHours(hDebut, mDebut, 0)
    const dateFin = new Date(dateObj); dateFin.setHours(hFin, mFin, 0)

    const payload: any = {
      date_planning: Timestamp.fromDate(dateObj),
      heure_planning_debut: Timestamp.fromDate(dateDebut),
      heure_planning_fin: Timestamp.fromDate(dateFin),
      adresse_rdv: form.adresse_rdv,
      etat_planning_rdv: form.etat_planning_rdv,
      observations_rdv: form.observations_rdv,
      type_planning: form.type_planning,
      materiel: form.materiel,
      cr_rdv_moi: form.cr_rdv_moi,
      cr_rdv_client: form.cr_rdv_client,
    }
    if (form.ref_client) payload.ref_client = doc(db, 'users', form.ref_client)
    if (form.ref_database_user) payload.refDatabaseUser = doc(db, 'database_users_details', form.ref_database_user)

    await updatePlanning(id, payload)
    setShowEditModal(false)
  }

  const handleDelete = async () => {
    await deletePlanning(id)
    router.push('/planning')
  }

  const handleEtatChange = async (etat: string) => {
    await updatePlanning(id, { etat_planning_rdv: etat } as any)
  }

  const handleAddSeance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    await addSeance({
      ...seanceForm,
      nb_tours: Number(seanceForm.nb_tours),
      recup_tours: Number(seanceForm.recup_tours),
      ref_planning: doc(db, 'planning_pro', id) as any,
      ref_users: doc(db, 'users', currentUser.uid) as any,
      num_circuit: 1,
      avancement_circuit: 0,
    })
    setShowSeanceModal(false)
  }

  const handleSubmitQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault()
    await updatePlanning(id, { ...questionnaireForm, questionnaire_rempli: true } as any)
    setShowQuestionnaireDirectModal(false)
  }

  const handleSavePlanif = async () => {
    await updatePlanning(id, { intensite_seance_planifiee: intensitePlanifiee } as any)
    setShowPlanifModal(false)
  }

  const handleSendSMS = () => {
    const lien = `${window.location.origin}/questionnaire/${id}`
    const message = `Bonjour, merci de remplir votre questionnaire de forme avant notre séance : ${lien}`
    window.open(`sms:?body=${encodeURIComponent(message)}`, '_blank')
  }

  if (!planning) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const etat = getEtatBadgeLocal(planning.etat_planning_rdv)

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/planning')} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-800">Détail du RDV</h1>
          <p className="text-sm text-gray-500 capitalize">{formatDate(planning.date_planning as any)}</p>
        </div>
        <button onClick={openEdit} className="p-2 rounded-lg hover:bg-gray-100 transition text-blue-600">
          <PencilIcon className="w-5 h-5" />
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="p-2 rounded-lg hover:bg-red-50 transition text-red-500">
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Infos RDV */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        {client && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Client</span>
            <span className="text-sm font-semibold text-blue-600">👤 {client.prenom} {client.nom}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Horaire</span>
          <span className="text-sm font-semibold text-gray-800">
            {formatHeure(planning.heure_planning_debut as any)} → {formatHeure(planning.heure_planning_fin as any)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">État</span>
          <Badge label={etat.label} variant={etat.variant} />
        </div>
        {(planning as any).type_planning && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Type</span>
            <span className="text-sm text-gray-800">{(planning as any).type_planning}</span>
          </div>
        )}
        {planning.adresse_rdv && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Adresse</span>
            <span className="text-sm text-gray-800 text-right max-w-[60%]">📍 {planning.adresse_rdv}</span>
          </div>
        )}
        {Array.isArray((planning as any).materiel) && (planning as any).materiel.length > 0 && (
          <div>
            <span className="text-sm text-gray-500 block mb-1">Matériel</span>
            <div className="flex flex-wrap gap-1">
              {(planning as any).materiel.map((m: string) => (
                <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{m}</span>
              ))}
            </div>
          </div>
        )}
        {planning.observations_rdv && (
          <div>
            <span className="text-sm text-gray-500 block mb-1">Observations</span>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{planning.observations_rdv}</p>
          </div>
        )}
        {(planning as any).cr_rdv_moi && (
          <div>
            <span className="text-sm text-gray-500 block mb-1">Commentaire coach</span>
            <p className="text-sm text-gray-800 bg-blue-50 rounded-lg p-3">{(planning as any).cr_rdv_moi}</p>
          </div>
        )}
        {(planning as any).cr_rdv_client && (
          <div>
            <span className="text-sm text-gray-500 block mb-1">Commentaire client</span>
            <p className="text-sm text-gray-800 bg-green-50 rounded-lg p-3">{(planning as any).cr_rdv_client}</p>
          </div>
        )}
      </div>

      {/* Changement rapide d'état */}
      <div>
        <p className="text-sm font-semibold text-gray-600 mb-2">Changer l'état</p>
        <div className="flex flex-wrap gap-2">
          {ETATS.map((e) => (
            <button key={e} onClick={() => handleEtatChange(e)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                planning.etat_planning_rdv === e
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Questionnaire de forme */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Questionnaire de forme</p>
            {(planning as any).questionnaire_rempli
              ? <p className="text-xs text-green-600 mt-0.5 font-medium">✓ Rempli</p>
              : <p className="text-xs text-orange-500 mt-0.5">⏳ Non rempli</p>
            }
          </div>
          <div className="flex gap-2">
            {(planning as any).questionnaire_rempli && (
              <button onClick={() => setShowQuestionnaireModal(true)}
                className="text-xs text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition">
                Voir
              </button>
            )}
            <button onClick={openQuestionnaireDirect}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition">
              Remplir
            </button>
            <button onClick={handleSendSMS}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition">
              SMS
            </button>
          </div>
        </div>
      </div>

      {/* Planification séance */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700">Planification séance</p>
            {(planning as any).intensite_seance_planifiee
              ? <p className="text-xs text-blue-600 mt-0.5">Intensité planifiée : {(planning as any).intensite_seance_planifiee}/10</p>
              : <p className="text-xs text-gray-400 mt-0.5">Non planifiée</p>
            }
          </div>
          <button onClick={openPlanif}
            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition">
            Planifier
          </button>
        </div>
      </div>

      {/* Notes client */}
      {clientId && notesClient.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Notes client
            {notesActives.length > 0 && (
              <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                {notesActives.length} active(s)
              </span>
            )}
          </h2>
          <div className="space-y-2">
            {notesClient.slice(0, 3).map((note) => {
              const isActive = !note.date_max_note_active ||
                (note.date_max_note_active as any).toDate() >= new Date()
              return (
                <div key={note.id}
                  className={`rounded-xl border p-3 ${isActive ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isActive ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>
                      {note.type_note}
                    </span>
                    {isActive && <span className="text-xs text-orange-600 font-medium">● Active</span>}
                  </div>
                  <p className="text-sm text-gray-800">{note.notes}</p>
                </div>
              )
            })}
            {notesClient.length > 3 && (
              <button onClick={() => router.push('/notes')} className="text-xs text-blue-600 hover:underline">
                Voir toutes les notes ({notesClient.length})
              </button>
            )}
          </div>
        </section>
      )}

      {/* Séances associées */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-700">Séances ({seances.length})</h2>
          <button onClick={() => setShowSeanceModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition">
            <PlusIcon className="w-3.5 h-3.5" />
            Créer une séance
          </button>
        </div>
        {seances.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
            <ClipboardDocumentListIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucune séance liée à ce RDV</p>
          </div>
        ) : (
          <div className="space-y-2">
            {seances.map((seance) => (
              <div key={seance.id} onClick={() => router.push(`/seances/${seance.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{seance.type_seance}</p>
                  <p className="text-xs text-gray-500">{seance.partie_seance} · {seance.nb_tours} tour(s)</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Derniers RDV effectués */}
      {derniersRdv.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Derniers RDV effectués avec {client?.prenom}
          </h2>
          <div className="space-y-2">
            {derniersRdv.map((rdv) => (
              <div key={rdv.id} onClick={() => router.push(`/planning/${rdv.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between cursor-pointer hover:shadow-md transition">
                <div>
                  <p className="text-sm font-semibold text-gray-800">
                    {rdv.date_planning?.toDate().toLocaleDateString('fr-FR', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatHeure(rdv.heure_planning_debut)} → {formatHeure(rdv.heure_planning_fin)}
                    {rdv.type_planning ? ` · ${rdv.type_planning}` : ''}
                  </p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── MODALS ── */}

      {/* Modal modification RDV */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier le RDV" size="lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de RDV</label>
            <select value={form.type_planning} onChange={(e) => setForm({ ...form, type_planning: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TYPES_RDV.map((groupe) => (
                <optgroup key={groupe.groupe} label={groupe.groupe}>
                  {groupe.options.map((o) => <option key={o} value={o}>{o}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début</label>
              <input type="time" value={form.heure_debut} onChange={(e) => setForm({ ...form, heure_debut: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
              <input type="time" value={form.heure_fin} onChange={(e) => setForm({ ...form, heure_fin: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <AdresseAutocomplete value={form.adresse_rdv} onChange={(val) => setForm({ ...form, adresse_rdv: val })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Matériel</label>
            <MaterielSelect value={form.materiel} onChange={(val) => setForm({ ...form, materiel: val })} />
          </div>
          {clientDetails.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abonnement</label>
              <select value={form.ref_database_user} onChange={(e) => setForm({ ...form, ref_database_user: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— Sélectionner —</option>
                {clientDetails.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.titre_abo || d.categorie_prestation || 'Abonnement sans titre'}
                    {d.etat ? ` — ${d.etat}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">État</label>
            <select value={form.etat_planning_rdv} onChange={(e) => setForm({ ...form, etat_planning_rdv: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ETATS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={form.observations_rdv} onChange={(e) => setForm({ ...form, observations_rdv: e.target.value })}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire coach</label>
            <textarea value={form.cr_rdv_moi} onChange={(e) => setForm({ ...form, cr_rdv_moi: e.target.value })}
              rows={2} placeholder="Votre compte-rendu..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire client</label>
            <textarea value={form.cr_rdv_client} onChange={(e) => setForm({ ...form, cr_rdv_client: e.target.value })}
              rows={2} placeholder="Retour du client..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowEditModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal planification */}
      <Modal isOpen={showPlanifModal} onClose={() => setShowPlanifModal(false)} title="Planification séance" size="lg">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Définissez l'intensité prévue pour cette séance (RPE planifié).</p>
          <p className="text-sm font-semibold text-gray-700">
            Intensité prévue : <span className="text-blue-600">{intensitePlanifiee}/10</span>
          </p>
          <div className="space-y-2">
            {['1 — Très très facile','2 — Très facile','3 — Facile','4 — Je sens un effort','5 — Ça commence à être dur','6 — Ça devient bien dur','7 — Dur','8 — Très dur','9 — Très très dur','10 — Tellement dur que je vais arrêter'].map((label, i) => {
              const val = i + 1
              return (
                <button key={val} type="button" onClick={() => setIntensitePlanifiee(val)}
                  className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition border ${
                    intensitePlanifiee === val
                      ? 'bg-blue-600 text-white border-blue-600 font-medium'
                      : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowPlanifModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button onClick={handleSavePlanif}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal création séance */}
      <Modal isOpen={showSeanceModal} onClose={() => setShowSeanceModal(false)} title="Créer une séance">
        <form onSubmit={handleAddSeance} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de séance</label>
            <select value={seanceForm.type_seance} onChange={(e) => setSeanceForm({ ...seanceForm, type_seance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TYPES_SEANCE.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partie de séance</label>
            <select value={seanceForm.partie_seance} onChange={(e) => setSeanceForm({ ...seanceForm, partie_seance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PARTIES_SEANCE.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nb tours</label>
              <input type="number" min={1} value={seanceForm.nb_tours}
                onChange={(e) => setSeanceForm({ ...seanceForm, nb_tours: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Récup (sec)</label>
              <input type="number" min={0} value={seanceForm.recup_tours}
                onChange={(e) => setSeanceForm({ ...seanceForm, recup_tours: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={seanceForm.observations_seance}
              onChange={(e) => setSeanceForm({ ...seanceForm, observations_seance: e.target.value })}
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowSeanceModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Créer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal voir questionnaire */}
      <Modal isOpen={showQuestionnaireModal} onClose={() => setShowQuestionnaireModal(false)} title="Questionnaire de forme" size="lg">
        <div className="space-y-3">
          {[
            { label: 'Sommeil', key: 'qualite_sommeil' },
            { label: 'Fatigue', key: 'niveau_fatigue' },
            { label: 'Courbatures', key: 'niveau_courbatures' },
            { label: 'Stress', key: 'quantite_stress' },
            { label: 'Motivation', key: 'motiv_avant_seance' },
            { label: 'Activité', key: 'activite_avant_seance' },
            { label: 'Alimentation', key: 'alimentation_avant_seance' },
          ].map((item) => {
            const val = (planning as any)[item.key]
            const color = val <= 2 ? 'text-green-600' : val <= 4 ? 'text-orange-500' : 'text-red-500'
            return (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className={`text-sm font-bold ${color}`}>{val || '—'}</span>
              </div>
            )
          })}
          {(planning as any).commentaire_forme && (
            <div className="pt-2">
              <p className="text-sm text-gray-500 mb-1">Commentaire</p>
              <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3">{(planning as any).commentaire_forme}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal remplir questionnaire */}
      <Modal isOpen={showQuestionnaireDirectModal} onClose={() => setShowQuestionnaireDirectModal(false)} title="Questionnaire de forme" size="lg">
        <form onSubmit={handleSubmitQuestionnaire} className="space-y-5">
          {QUESTIONS_FORME.map((q) => (
            <div key={q.key}>
              <p className="text-sm font-semibold text-gray-700 mb-1">{q.label}</p>
              <p className="text-xs text-gray-500 mb-2">{q.question}</p>
              <div className="flex flex-wrap gap-2">
                {q.labels.map((label, i) => {
                  const val = i + 1
                  const isSelected = (questionnaireForm as any)[q.key] === val
                  return (
                    <button key={val} type="button"
                      onClick={() => setQuestionnaireForm({ ...questionnaireForm, [q.key]: val })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                        isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {val} — {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire</label>
            <textarea value={questionnaireForm.commentaire_forme}
              onChange={(e) => setQuestionnaireForm({ ...questionnaireForm, commentaire_forme: e.target.value })}
              rows={3} placeholder="Maladie, douleurs ciblées..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowQuestionnaireDirectModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Supprimer ce RDV ?" size="sm">
        <p className="text-sm text-gray-600 mb-4">Cette action est irréversible.</p>
        <div className="flex gap-3">
          <button onClick={() => setShowDeleteConfirm(false)}
            className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
          <button onClick={handleDelete}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition">
            Supprimer
          </button>
        </div>
      </Modal>

    </div>
  )
}