'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { uploadImage } from '@/lib/uploadImage'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import Modal from '@/components/ui/Modal'
import AdresseAutocomplete from '@/components/ui/AdresseAutocomplete'
import SuggestInput from '@/components/ui/SuggestInput'
import { PhoneInput } from '@/components/ui/PhoneInput'

const PROFESSIONS = [
  "Agriculteur", "Architecte", "Assistant maternel", "Auxiliaire de vie",
  "Avocat", "Cadre dirigeant", "Chef cuisinier", "Chef d'entreprise",
  "Chercheur", "Chômeur", "Chirurgien", "Comptable", "Consultant",
  "Dentiste", "Designer", "Développeur", "Directeur commercial",
  "Éducateur sportif", "Électricien", "Enseignant", "Entrepreneur",
  "Étudiant", "Formateur", "Graphiste", "Infirmier", "Ingénieur",
  "Journaliste", "Juriste", "Kinésithérapeute", "Logisticien",
  "Manager", "Médecin", "Militaire", "Ostéopathe", "Pharmacien",
  "Photographe", "Plombier", "Police / Gendarmerie", "Pompier",
  "Professeur", "Psychologue", "Retraité", "Sans emploi",
  "Technicien", "Traducteur", "Vétérinaire",
]
import {
  PencilIcon, ArrowRightOnRectangleIcon,
  UserCircleIcon, EnvelopeIcon, PhoneIcon, ShieldCheckIcon,
  BellIcon, MapPinIcon, DocumentTextIcon, TrashIcon,
  EyeIcon, EyeSlashIcon,
} from '@heroicons/react/24/outline'

const toUpperName = (s: string) => s.toUpperCase()
const toProperName = (s: string) =>
  s.split(/([\s-])/).map(p => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('')

export default function ProfilPage() {
  const { userProfile, currentUser, logout } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'
  const droits = userProfile?.droits
  const router = useRouter()
  const searchParams = useSearchParams()
  const { permission, subscribed, loading: pushLoading, checking: pushChecking, subscribe, unsubscribe } = usePushNotifications()

  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    if (searchParams.get('setup') === '1') setShowEditModal(true)
  }, [])
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showPwdCurrent, setShowPwdCurrent] = useState(false)
  const [showPwdNext, setShowPwdNext] = useState(false)
  const [showPwdConfirm, setShowPwdConfirm] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showEmailPwd, setShowEmailPwd] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: '', confirmEmail: '', currentPassword: '' })
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    prenom: userProfile?.prenom || '',
    nom: userProfile?.nom || '',
    indicatif_tel: (userProfile as any)?.indicatif_tel || '+33',
    phone_number: userProfile?.phone_number || '',
    genre: (userProfile as any)?.genre || '',
    date_naissance: '',
    adresse_postale: '',
    rue_adresse: '',
    ville_adresse: '',
    code_postale_adresse: '',
    profession: '',
    photo_url: userProfile?.photo_url || '',
    contactUrgenceNom: '',
    contactUrgenceTel: '',
    contactUrgenceRelation: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    const dnTs = form.date_naissance
      ? new Date(form.date_naissance + 'T00:00:00')
      : null
    await updateDoc(doc(db, 'users', currentUser.uid), {
      prenom: form.prenom,
      nom: form.nom,
      indicatif_tel: form.indicatif_tel,
      phone_number: form.phone_number,
      genre: form.genre,
      display_name: `${form.nom} ${form.prenom}`,
      date_naissance: dnTs,
      adresse_postale: form.adresse_postale,
      rue_adresse: form.rue_adresse,
      ville_adresse: form.ville_adresse,
      code_postale_adresse: form.code_postale_adresse,
      profession: form.profession,
      photo_url: form.photo_url,
      contactUrgenceNom: form.contactUrgenceNom,
      contactUrgenceTel: form.contactUrgenceTel,
      contactUrgenceRelation: form.contactUrgenceRelation,
    })
    setShowEditModal(false)
    setSuccessMsg('Profil mis à jour avec succès')
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handlePhotoUpload = async (file: File) => {
    setUploadingPhoto(true)
    try {
      const url = await uploadImage(file, `avatars/${currentUser!.uid}/${Date.now()}_${file.name}`)
      setForm((f) => ({ ...f, photo_url: url }))
    } catch {
      alert("Erreur lors de l'upload de la photo")
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (passwordForm.next !== passwordForm.confirm) {
      setErrorMsg('Les mots de passe ne correspondent pas')
      return
    }
    if (passwordForm.next.length < 6) {
      setErrorMsg('Le mot de passe doit faire au moins 6 caractères')
      return
    }
    try {
      if (!currentUser || !currentUser.email) return
      const credential = EmailAuthProvider.credential(currentUser.email, passwordForm.current)
      await reauthenticateWithCredential(currentUser, credential)
      await updatePassword(currentUser, passwordForm.next)
      setShowPasswordModal(false)
      setPasswordForm({ current: '', next: '', confirm: '' })
      setSuccessMsg('Mot de passe mis à jour')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch {
      setErrorMsg('Mot de passe actuel incorrect')
    }
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!currentUser || !currentUser.email) return

    // Validations locales avant d'appeler Firebase
    if (emailForm.newEmail === currentUser.email) {
      setErrorMsg("C'est déjà votre adresse email actuelle.")
      return
    }
    if (emailForm.newEmail !== emailForm.confirmEmail) {
      setErrorMsg('Les deux adresses email ne correspondent pas.')
      return
    }
    if (!emailForm.currentPassword) {
      setErrorMsg('Veuillez saisir votre mot de passe actuel.')
      return
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, emailForm.currentPassword)
      await reauthenticateWithCredential(currentUser, credential)
      const actionCodeSettings = {
        url: `${window.location.origin}/profil`,
        handleCodeInApp: false,
      }
      await verifyBeforeUpdateEmail(currentUser, emailForm.newEmail, actionCodeSettings)
      setShowEmailModal(false)
      setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' })
      setShowEmailPwd(false)
      setSuccessMsg("Email de vérification envoyé à votre nouvelle adresse. Vérifiez aussi vos courriers indésirables (spam). Le changement sera effectif après avoir cliqué le lien.")
      setTimeout(() => setSuccessMsg(''), 15000)
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setErrorMsg('Mot de passe incorrect. Veuillez vérifier votre saisie.')
      } else if (err?.code === 'auth/email-already-in-use') {
        setErrorMsg('Cette adresse email est déjà utilisée par un autre compte.')
      } else if (err?.code === 'auth/requires-recent-login') {
        setErrorMsg('Session expirée. Déconnectez-vous et reconnectez-vous puis réessayez.')
      } else if (err?.code === 'auth/invalid-email') {
        setErrorMsg('Adresse email invalide.')
      } else {
        setErrorMsg(`Erreur : ${err?.code ?? 'inconnue'}`)
      }
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const initials = `${userProfile?.prenom?.[0] || ''}${userProfile?.nom?.[0] || ''}`

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Colonne gauche ── */}
        <div className="space-y-4">

          {/* Carte identité */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center text-center">
            {(userProfile as any)?.photo_url ? (
              <img src={(userProfile as any).photo_url} alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200 mb-4" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-3xl mb-4">
                {initials}
              </div>
            )}
            <h2 className="text-xl font-bold text-gray-800">
              {userProfile?.prenom} {userProfile?.nom}
            </h2>
            <p className="text-sm text-gray-400 mt-2">{currentUser?.email}</p>
            {(isAdmin || droits?.modifierProfil !== false) && <button
              onClick={() => {
                const dn = (userProfile as any)?.date_naissance
                const dnDate = dn?.toDate ? dn.toDate() : dn ? new Date(dn) : null
                setForm({
                  prenom: userProfile?.prenom || '',
                  nom: userProfile?.nom || '',
                  indicatif_tel: (userProfile as any)?.indicatif_tel || '+33',
                  phone_number: userProfile?.phone_number || '',
                  genre: (userProfile as any)?.genre || '',
                  date_naissance: dnDate ? `${dnDate.getFullYear()}-${String(dnDate.getMonth()+1).padStart(2,'0')}-${String(dnDate.getDate()).padStart(2,'0')}` : '',
                  adresse_postale: (userProfile as any)?.adresse_postale || '',
                  rue_adresse: (userProfile as any)?.rue_adresse || '',
                  ville_adresse: (userProfile as any)?.ville_adresse || '',
                  code_postale_adresse: (userProfile as any)?.code_postale_adresse || '',
                  profession: (userProfile as any)?.profession || '',
                  photo_url: userProfile?.photo_url || '',
                  contactUrgenceNom: userProfile?.contactUrgenceNom || '',
                  contactUrgenceTel: userProfile?.contactUrgenceTel || '',
                  contactUrgenceRelation: userProfile?.contactUrgenceRelation || '',
                })
                setShowEditModal(true)
              }}
              className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition w-full justify-center"
            >
              <PencilIcon className="w-4 h-4" />
              Modifier le profil
            </button>}
          </div>

          {/* Liens légaux */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50">
              <DocumentTextIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600">Politique de confidentialité</span>
            </a>
            <a href="/terms" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50">
              <DocumentTextIcon className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600">Conditions générales d'utilisation</span>
            </a>
            <a href="/data-deletion" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition">
              <TrashIcon className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-sm text-red-500 font-medium">Supprimer mon compte</span>
            </a>
          </div>

          {/* Déconnexion */}
          <button
            onClick={handleLogout}
            className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-red-50 transition text-sm font-medium text-red-500"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Déconnexion
          </button>
        </div>

        {/* ── Colonne droite ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Informations de contact */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <UserCircleIcon className="w-4 h-4 text-blue-500" />
              Informations personnelles
            </h3>
            <div className="space-y-3">
              <InfoRow label="Prénom" value={userProfile?.prenom} />
              <InfoRow label="Nom" value={userProfile?.nom} />
              <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 flex items-center gap-1.5 shrink-0">
                  <EnvelopeIcon className="w-4 h-4 shrink-0" /> Email
                </span>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-800 font-medium truncate" title={currentUser?.email || ''}>{currentUser?.email || '—'}</span>
                  <button
                    onClick={() => { setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' }); setErrorMsg(''); setShowEmailPwd(false); setShowEmailModal(true) }}
                    className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition font-medium shrink-0"
                  >
                    Modifier
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 flex items-center gap-1.5">
                  <PhoneIcon className="w-4 h-4" /> Téléphone
                </span>
                <span className="text-sm text-gray-800 font-medium">{userProfile?.phone_number || '—'}</span>
              </div>
              {(userProfile as any)?.date_naissance && (
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Date de naissance</span>
                  <span className="text-sm text-gray-800 font-medium">
                    {(() => {
                      const d = (userProfile as any).date_naissance
                      const date = d?.toDate ? d.toDate() : new Date(d)
                      const today = new Date()
                      let age = today.getFullYear() - date.getFullYear()
                      const m = today.getMonth() - date.getMonth()
                      if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--
                      return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${age} ans`
                    })()}
                  </span>
                </div>
              )}
              {(userProfile as any)?.profession && (
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Profession</span>
                  <span className="text-sm text-gray-800 font-medium">{(userProfile as any).profession}</span>
                </div>
              )}
              {((userProfile as any)?.rue_adresse || (userProfile as any)?.adresse_postale) && (
                <div className="flex items-start justify-between py-2">
                  <span className="text-sm text-gray-500 flex items-center gap-1.5 shrink-0">
                    <MapPinIcon className="w-4 h-4" /> Adresse
                  </span>
                  <span className="text-sm text-gray-800 font-medium text-right">
                    {(userProfile as any).rue_adresse || (userProfile as any).adresse_postale}
                    {(userProfile as any).ville_adresse && `, ${(userProfile as any).ville_adresse}`}
                    {(userProfile as any).code_postale_adresse && ` ${(userProfile as any).code_postale_adresse}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Sécurité */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-4 h-4 text-orange-500" />
              Sécurité
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Méthode de connexion</span>
                <span className="text-sm text-gray-700 font-medium">Email / Mot de passe</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500">Mot de passe</span>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition font-medium"
                >
                  Modifier
                </button>
              </div>
              {currentUser?.metadata?.creationTime && (
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-500">Compte créé le</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {new Date(currentUser.metadata.creationTime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {currentUser?.metadata?.lastSignInTime && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">Dernière connexion</span>
                  <span className="text-sm text-gray-700 font-medium">
                    {new Date(currentUser.metadata.lastSignInTime).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Contact d'urgence */}
          {(userProfile?.contactUrgenceNom || userProfile?.contactUrgenceTel) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <PhoneIcon className="w-4 h-4 text-red-500" />
                Contact d'urgence
              </h3>
              <div className="space-y-3">
                {userProfile?.contactUrgenceNom && (
                  <InfoRow label="Nom" value={userProfile.contactUrgenceNom} />
                )}
                {userProfile?.contactUrgenceTel && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-500">Téléphone</span>
                    <a href={`tel:${userProfile.contactUrgenceTel}`}
                      className="text-sm text-blue-600 hover:underline font-medium">
                      {userProfile.contactUrgenceTel}
                    </a>
                  </div>
                )}
                {userProfile?.contactUrgenceRelation && (
                  <InfoRow label="Relation" value={userProfile.contactUrgenceRelation} />
                )}
              </div>
            </div>
          )}

          {/* Notifications push */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BellIcon className="w-4 h-4 text-blue-500" />
              Notifications push
            </h3>
            {pushChecking ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                Vérification…
              </div>
            ) : permission === 'denied' ? (
              <p className="text-sm text-red-500">Notifications bloquées dans les paramètres du navigateur.</p>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">{subscribed ? 'Notifications activées' : 'Notifications désactivées'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {subscribed ? "Vous recevez les notifications de l'app." : 'Activez pour recevoir des alertes.'}
                  </p>
                </div>
                <button
                  onClick={subscribed ? unsubscribe : subscribe}
                  disabled={pushLoading}
                  className={`text-sm font-medium px-4 py-2 rounded-xl transition ${
                    subscribed ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {pushLoading ? '…' : subscribed ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            )}
          </div>


        </div>
      </div>

      {/* Modal édition profil */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Modifier mes informations" size="sm">
        <form onSubmit={handleEditProfile} className="space-y-4">
          {/* Photo de profil */}
          <div className="flex flex-col items-center gap-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="relative group"
            >
              {form.photo_url ? (
                <img src={form.photo_url} alt="" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl border-2 border-gray-200">
                  {(form.prenom[0] || '') + (form.nom[0] || '')}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <PencilIcon className="w-5 h-5 text-white" />
              </div>
            </button>
            <p className="text-xs text-gray-400">
              {uploadingPhoto ? 'Upload en cours…' : 'Cliquer pour changer la photo'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
              <input type="text" value={form.prenom}
                onChange={(e) => setForm({ ...form, prenom: toProperName(e.target.value) })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
              <input type="text" value={form.nom}
                onChange={(e) => setForm({ ...form, nom: toUpperName(e.target.value) })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Genre</label>
            <div className="flex gap-3">
              {['Homme', 'Femme'].map((g) => (
                <button
                  key={g} type="button"
                  onClick={() => setForm({ ...form, genre: g })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${form.genre === g ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <PhoneInput
              indicatif={form.indicatif_tel}
              telephone={form.phone_number}
              onIndicatifChange={(v) => setForm({ ...form, indicatif_tel: v })}
              onTelephoneChange={(v) => setForm({ ...form, phone_number: v })}
              inputClassName="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              selectClassName="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shrink-0 w-[5.5rem]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de naissance</label>
            <input type="date" value={form.date_naissance}
              onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profession</label>
            <SuggestInput
              value={form.profession}
              onChange={(v) => setForm({ ...form, profession: v })}
              suggestions={PROFESSIONS}
              placeholder="Coach sportif, Kinésithérapeute..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <AdresseAutocomplete
              value={form.adresse_postale}
              onChange={(v) => setForm({ ...form, adresse_postale: v })}
              onSelectFull={(data) => setForm({ ...form, adresse_postale: data.label, rue_adresse: data.adresse, ville_adresse: data.ville, code_postale_adresse: data.code_postal })}
              placeholder="Rechercher une adresse..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
              <input type="text" value={form.ville_adresse}
                onChange={(e) => setForm({ ...form, ville_adresse: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
              <input type="text" value={form.code_postale_adresse}
                onChange={(e) => setForm({ ...form, code_postale_adresse: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact d'urgence</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet</label>
                <input type="text" value={form.contactUrgenceNom}
                  onChange={(e) => setForm({ ...form, contactUrgenceNom: e.target.value })}
                  placeholder="Ex : Marie Dupont"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input type="tel" value={form.contactUrgenceTel}
                    onChange={(e) => setForm({ ...form, contactUrgenceTel: e.target.value })}
                    placeholder="06 xx xx xx xx"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Relation</label>
                  <select value={form.contactUrgenceRelation}
                    onChange={(e) => setForm({ ...form, contactUrgenceRelation: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Choisir —</option>
                    {['Conjoint(e)', 'Parent', 'Enfant', 'Frère / Sœur', 'Ami(e)', 'Collègue', 'Autre'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
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

      {/* Modal changement mot de passe */}
      <Modal isOpen={showPasswordModal} onClose={() => { setShowPasswordModal(false); setErrorMsg(''); setShowPwdCurrent(false); setShowPwdNext(false); setShowPwdConfirm(false) }}
        title="Changer mon mot de passe" size="sm">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <div className="relative">
              <input type={showPwdCurrent ? 'text' : 'password'} value={passwordForm.current}
                onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPwdCurrent(!showPwdCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwdCurrent ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <div className="relative">
              <input type={showPwdNext ? 'text' : 'password'} value={passwordForm.next}
                onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPwdNext(!showPwdNext)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwdNext ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
            <div className="relative">
              <input type={showPwdConfirm ? 'text' : 'password'} value={passwordForm.confirm}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowPwdConfirm(!showPwdConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPwdConfirm ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowPasswordModal(false); setErrorMsg(''); setShowPwdCurrent(false); setShowPwdNext(false); setShowPwdConfirm(false) }}
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

      {/* Modal changement email */}
      <Modal isOpen={showEmailModal} onClose={() => { setShowEmailModal(false); setErrorMsg(''); setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' }); setShowEmailPwd(false) }}
        title="Changer mon adresse email" size="sm">
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <p className="text-sm text-gray-500">
            Un email de vérification sera envoyé à votre nouvelle adresse. Le changement sera effectif après avoir cliqué le lien.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouvelle adresse email</label>
            <input type="email" value={emailForm.newEmail}
              onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} required
              placeholder="nouvelle@email.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer la nouvelle adresse email</label>
            <input type="email" value={emailForm.confirmEmail}
              onChange={(e) => setEmailForm({ ...emailForm, confirmEmail: e.target.value })} required
              placeholder="nouvelle@email.com"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                emailForm.confirmEmail && emailForm.confirmEmail !== emailForm.newEmail
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300'
              }`} />
            {emailForm.confirmEmail && emailForm.confirmEmail !== emailForm.newEmail && (
              <p className="text-xs text-red-500 mt-1">Les adresses ne correspondent pas</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel (confirmation)</label>
            <div className="relative">
              <input type={showEmailPwd ? 'text' : 'password'} value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="button" onClick={() => setShowEmailPwd(!showEmailPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showEmailPwd ? <EyeIcon className="w-4 h-4" /> : <EyeSlashIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowEmailModal(false); setErrorMsg(''); setEmailForm({ newEmail: '', confirmEmail: '', currentPassword: '' }); setShowEmailPwd(false) }}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              Envoyer la vérification
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-800 font-medium">{value || '—'}</span>
    </div>
  )
}
