'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Timestamp, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useTeams } from '@/hooks/useTeams'
import { StoreGate } from '@/components/ui/StoreGate'
import { useJoueurs } from '@/hooks/useJoueurs'
import { useStoreAccess, readLimit } from '@/hooks/useStoreAccess'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { ArrowLeftIcon, PlusIcon, UserIcon, PencilIcon, TrashIcon, ChartBarIcon, CameraIcon } from '@heroicons/react/24/outline'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { uploadImage } from '@/lib/uploadImage'

const TYPES = ['Joueur', 'Staff']
const TYPES_STAFF = ['Entraîneur', 'Préparateur physique', 'Médecin', 'Kiné', 'Autre']

export default function DetailEquipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { teams, updateTeam } = useTeams()
  const { joueurs, loading, addJoueur, updateJoueur, deleteJoueur } = useJoueurs(id)

  const { isAdmin, limites } = useStoreAccess('/equipes')
  // Limite "nombre de joueurs/staff max par équipe" (Joueur ou Staff = 1 dans tous les cas)
  const maxJoueurs = readLimit(limites, 'maxJoueurs', 'joueurs', 'players', 'max_joueurs', 'joueur', 'effectif')
  const playerLimitReached = !isAdmin && joueurs.length >= maxJoueurs
  const [limitError, setLimitError] = useState('')

  const team = teams.find((t) => t.id === id)

  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const [form, setForm] = useState({
    prenom_joueur: '',
    nom_joueur: '',
    mail_joueur: '',
    indicatif_tel: '+33',
    tel_joueur: '',
    date_naissance: '',
    numero_joueur: '',
    poste_joueur: '',
    observations_joueur: '',
    type: 'Joueur',
    type_staff: '',
  })

  const emptyForm = {
    prenom_joueur: '', nom_joueur: '', mail_joueur: '', indicatif_tel: '+33', tel_joueur: '',
    date_naissance: '', numero_joueur: '', poste_joueur: '', observations_joueur: '',
    type: 'Joueur', type_staff: '',
  }

  const openAdd = () => {
    if (playerLimitReached) {
      setLimitError(`Votre formule permet ${maxJoueurs} membre${maxJoueurs > 1 ? 's' : ''} maximum par équipe (joueurs + staff). Contactez un administrateur pour en ajouter.`)
      setTimeout(() => setLimitError(''), 5000)
      return
    }
    setEditItem(null)
    setForm(emptyForm)
    setPhotoFile(null)
    setShowModal(true)
  }

  const openEdit = (joueur: any) => {
    setEditItem(joueur)
    setPhotoFile(null)
    const dn = joueur.date_naissance?.toDate?.()
    setForm({
      prenom_joueur: joueur.prenom_joueur || '',
      nom_joueur: joueur.nom_joueur || '',
      mail_joueur: joueur.mail_joueur || '',
      indicatif_tel: joueur.indicatif_tel || '+33',
      tel_joueur: joueur.tel_joueur || '',
      date_naissance: dn ? `${dn.getFullYear()}-${String(dn.getMonth()+1).padStart(2,'0')}-${String(dn.getDate()).padStart(2,'0')}` : '',
      numero_joueur: joueur.numero_joueur?.toString() || '',
      poste_joueur: joueur.poste_joueur || '',
      observations_joueur: joueur.observations_joueur || '',
      type: joueur.type || 'Joueur',
      type_staff: joueur.type_staff || '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhotoUploading(true)
    try {
      let photoUrl = editItem?.photo_url ?? undefined
      if (photoFile) {
        const path = `joueurs/${id}/${editItem?.id ?? Date.now()}_${photoFile.name}`
        photoUrl = await uploadImage(photoFile, path)
      }
      const dnDate = form.date_naissance ? Timestamp.fromDate(new Date(form.date_naissance + 'T00:00:00')) : null
      const cleanForm: any = {
        prenom_joueur: form.prenom_joueur,
        nom_joueur: form.nom_joueur,
        mail_joueur: form.mail_joueur,
        indicatif_tel: form.indicatif_tel,
        tel_joueur: form.tel_joueur,
        date_naissance: dnDate ?? undefined,
        numero_joueur: form.numero_joueur ? Number(form.numero_joueur) : null,
        poste_joueur: form.poste_joueur,
        observations_joueur: form.observations_joueur,
        type: form.type,
        type_staff: form.type_staff,
        ...(photoUrl ? { photo_url: photoUrl } : {}),
      }
      if (editItem) {
        await updateJoueur(editItem.id, cleanForm)
      } else {
        if (playerLimitReached) { setShowModal(false); return } // sécurité : limite atteinte
        await addJoueur({
          ...cleanForm,
          equiperef: doc(db, 'team', id),
          create_date: Timestamp.now(),
          iduserref: null,
        } as any)
      }
      setShowModal(false)
      setPhotoFile(null)
    } finally {
      setPhotoUploading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !team) return
    setLogoUploading(true)
    try {
      const url = await uploadImage(file, `teams/${id}/logo_${file.name}`)
      await updateTeam(id, { logo: url })
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  const joueursList = joueurs.filter((j) => j.type === 'Joueur')
  const staffList = joueurs.filter((j) => j.type === 'Staff')

  return (
    <StoreGate appRoute="/equipes">
    <div>
      {/* En-tête — flex-wrap : sur mobile, les boutons passent en pleine largeur sous le titre */}
      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push('/equipes')}
          className="p-2 rounded-lg hover:bg-gray-100 transition shrink-0"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        {/* Logo équipe */}
        <label className="relative cursor-pointer group shrink-0">
          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
          <div className="w-12 h-12 rounded-xl border-2 border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 group-hover:border-blue-400 transition">
            {team?.logo
              ? <img src={team.logo} alt="logo" className="w-full h-full object-cover" />
              : <span className="text-lg font-bold text-gray-400">{team?.nom_equipe?.[0] ?? '?'}</span>
            }
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow">
            {logoUploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CameraIcon className="w-3 h-3 text-white" />
            }
          </div>
        </label>

        <div className="flex-1 min-w-0 basis-32">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">{team?.nom_equipe || '...'}</h1>
          <p className="text-sm text-gray-500 truncate">{team?.sport}</p>
        </div>

        {/* Boutons : pleine largeur (wrap) sur mobile, inline à partir de sm */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => router.push(`/equipes/${id}/seances`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
          >
            <ChartBarIcon className="w-4 h-4 shrink-0" />
            Charges
          </button>
          <button
            onClick={openAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            Ajouter
          </button>
        </div>
      </div>

      {limitError && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">{limitError}</p>
      )}
      {!isAdmin && Number.isFinite(maxJoueurs) && (
        <p className="mb-4 text-xs text-gray-400">{joueurs.length}/{maxJoueurs} membre{maxJoueurs > 1 ? 's' : ''} (joueurs + staff)</p>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Chargement...</div>
      ) : (
        <div className="space-y-6">
          {/* Joueurs */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Joueurs ({joueursList.length})
            </h2>
            {joueursList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun joueur</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {joueursList.map((j) => (
                  <JoueurCard
                    key={j.id}
                    joueur={j}
                    onEdit={() => openEdit(j)}
                    onDelete={() => setShowDeleteConfirm(j.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Staff */}
          <section>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Staff ({staffList.length})
            </h2>
            {staffList.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun staff</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {staffList.map((j) => (
                  <JoueurCard
                    key={j.id}
                    joueur={j}
                    onEdit={() => openEdit(j)}
                    onDelete={() => setShowDeleteConfirm(j.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? 'Modifier' : 'Ajouter un membre'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="flex justify-center">
            <label className="relative cursor-pointer group">
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
              <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 group-hover:border-blue-400 transition">
                {photoFile
                  ? <img src={URL.createObjectURL(photoFile)} alt="" className="w-full h-full object-cover" />
                  : editItem?.photo_url
                    ? <img src={editItem.photo_url} alt="" className="w-full h-full object-cover" />
                    : <UserIcon className="w-8 h-8 text-gray-300" />
                }
              </div>
              <div className="absolute bottom-0 right-0 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow border-2 border-white">
                <CameraIcon className="w-3.5 h-3.5 text-white" />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.prenom_joueur}
                onChange={(e) => setForm({ ...form, prenom_joueur: e.target.value })}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input type="text" value={form.nom_joueur}
                onChange={(e) => setForm({ ...form, nom_joueur: e.target.value })}
                required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {form.type === 'Staff' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
              <select value={form.type_staff} onChange={(e) => setForm({ ...form, type_staff: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">-- Choisir --</option>
                {TYPES_STAFF.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}

          {form.type === 'Joueur' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° maillot</label>
                <input type="number" min={1} value={form.numero_joueur}
                  onChange={(e) => setForm({ ...form, numero_joueur: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Poste</label>
                <input type="text" value={form.poste_joueur}
                  onChange={(e) => setForm({ ...form, poste_joueur: e.target.value })}
                  placeholder="Ex: Attaquant"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
            <input type="date" value={form.date_naissance}
              onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.mail_joueur}
              onChange={(e) => setForm({ ...form, mail_joueur: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <PhoneInput
              indicatif={form.indicatif_tel}
              telephone={form.tel_joueur}
              onIndicatifChange={(v) => setForm({ ...form, indicatif_tel: v })}
              onTelephoneChange={(v) => setForm({ ...form, tel_joueur: v })}
              inputClassName="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              selectClassName="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0 w-[5.5rem]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={form.observations_joueur}
              onChange={(e) => setForm({ ...form, observations_joueur: e.target.value })}
              rows={2} placeholder="Notes, blessures, informations particulières..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
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
              disabled={photoUploading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition"
            >
              {photoUploading ? 'Upload…' : editItem ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal
        isOpen={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Supprimer ce membre ?"
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
            onClick={() => showDeleteConfirm && deleteJoueur(showDeleteConfirm).then(() => setShowDeleteConfirm(null))}
            className="flex-1 bg-red-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition"
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
    </StoreGate>
  )
}

function JoueurCard({
  joueur,
  onEdit,
  onDelete,
}: {
  joueur: any
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  return (
    <div
      onClick={() => router.push(`/joueurs/${joueur.id}`)}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 cursor-pointer hover:shadow-md transition"
    >
      <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-500 shrink-0">
        {joueur.photo_url
          ? <img src={joueur.photo_url} alt="" className="w-full h-full object-cover" />
          : <UserIcon className="w-5 h-5" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {joueur.numero_joueur && (
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">#{joueur.numero_joueur}</span>
          )}
          <p className="text-sm font-semibold text-gray-800 truncate">
            {joueur.prenom_joueur} {joueur.nom_joueur}
          </p>
        </div>
        {joueur.poste_joueur && (
          <p className="text-xs text-gray-500 mt-0.5">{joueur.poste_joueur}</p>
        )}
        {joueur.mail_joueur && (
          <p className="text-xs text-gray-400 truncate">{joueur.mail_joueur}</p>
        )}
        {joueur.tel_joueur && (
          <p className="text-xs text-gray-400">{joueur.tel_joueur}</p>
        )}
        {joueur.type_staff && (
          <Badge label={joueur.type_staff} variant="info" />
        )}
        {joueur.observations_joueur && (
          <p className="text-xs text-amber-600 mt-0.5 truncate">⚠ {joueur.observations_joueur}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 items-end" onClick={(e) => e.stopPropagation()}>
        <button onClick={onEdit} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 transition">
          <PencilIcon className="w-3 h-3" />Modifier
        </button>
        <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 text-red-500 bg-red-50 hover:bg-red-100 transition">
          <TrashIcon className="w-3 h-3" />Supprimer
        </button>
      </div>
    </div>
  )
}