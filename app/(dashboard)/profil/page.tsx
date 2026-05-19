'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { doc, updateDoc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import Modal from '@/components/ui/Modal'
import { PencilIcon, ArrowRightOnRectangleIcon, KeyIcon } from '@heroicons/react/24/outline'

export default function ProfilPage() {
  const { userProfile, currentUser, logout } = useAuth()
  const router = useRouter()

  const [showEditModal, setShowEditModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [form, setForm] = useState({
    prenom: userProfile?.prenom || '',
    nom: userProfile?.nom || '',
    phone_number: userProfile?.phone_number || '',
  })

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    await updateDoc(doc(db, 'users', currentUser.uid), {
      prenom: form.prenom,
      nom: form.nom,
      phone_number: form.phone_number,
      display_name: `${form.prenom} ${form.nom}`,
    })
    setShowEditModal(false)
    setSuccessMsg('Profil mis à jour avec succès')
    setTimeout(() => setSuccessMsg(''), 3000)
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

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold text-gray-800">Mon profil</h1>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {successMsg}
        </div>
      )}

      {/* Carte profil */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl">
            {userProfile?.prenom?.[0]}{userProfile?.nom?.[0]}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {userProfile?.prenom} {userProfile?.nom}
            </h2>
            <p className="text-sm text-gray-500">{userProfile?.email}</p>
            <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full mt-1 inline-block">
              {userProfile?.role_app || 'Utilisateur'}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Prénom</span>
            <span className="text-gray-800 font-medium">{userProfile?.prenom || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Nom</span>
            <span className="text-gray-800 font-medium">{userProfile?.nom || '—'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-50">
            <span className="text-gray-500">Email</span>
            <span className="text-gray-800 font-medium">{userProfile?.email || '—'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Téléphone</span>
            <span className="text-gray-800 font-medium">{userProfile?.phone_number || '—'}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={() => {
            setForm({
              prenom: userProfile?.prenom || '',
              nom: userProfile?.nom || '',
              phone_number: userProfile?.phone_number || '',
            })
            setShowEditModal(true)
          }}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
        >
          <PencilIcon className="w-5 h-5 text-blue-500" />
          Modifier mes informations
        </button>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition text-sm font-medium text-gray-700"
        >
          <KeyIcon className="w-5 h-5 text-orange-500" />
          Changer mon mot de passe
        </button>

        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-100 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-red-50 transition text-sm font-medium text-red-500"
        >
          <ArrowRightOnRectangleIcon className="w-5 h-5" />
          Déconnexion
        </button>
      </div>

      {/* Modal édition profil */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Modifier mes informations"
        size="sm"
      >
        <form onSubmit={handleEditProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
            <input
              type="text"
              value={form.prenom}
              onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <input
              type="text"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal changement mot de passe */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => { setShowPasswordModal(false); setErrorMsg('') }}
        title="Changer mon mot de passe"
        size="sm"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={passwordForm.next}
              onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowPasswordModal(false); setErrorMsg('') }}
              className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}