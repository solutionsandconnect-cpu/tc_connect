'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/24/outline'

type Tab = 'creer' | 'connexion'

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') ?? '/accueil'
  const prefillEmail = searchParams.get('email') ?? ''
  const initialTab: Tab = searchParams.get('tab') === 'creer' ? 'creer' : 'connexion'

  const [tab, setTab] = useState<Tab>(initialTab)
  const { login, register, resetPassword } = useAuth()
  const router = useRouter()

  // Connexion
  const [loginEmail, setLoginEmail] = useState(prefillEmail)
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPwd, setShowLoginPwd] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // Créer un compte
  const [regEmail, setRegEmail] = useState(prefillEmail)
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')
  const [showRegPwd, setShowRegPwd] = useState(false)
  const [showRegConfirm, setShowRegConfirm] = useState(false)
  const [regError, setRegError] = useState('')
  const [emailExists, setEmailExists] = useState(false)
  const [regLoading, setRegLoading] = useState(false)

  // Dialog mot de passe oublié
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetLoading, setResetLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      await login(loginEmail, loginPassword)
      localStorage.removeItem('tc_impersonation')
      router.push(redirectTo)
    } catch {
      setLoginError('Email ou mot de passe incorrect')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')
    setEmailExists(false)
    if (regPassword !== regConfirm) {
      setRegError('Les mots de passe ne correspondent pas')
      return
    }
    if (regPassword.length < 6) {
      setRegError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setRegLoading(true)
    try {
      await register(regEmail, regPassword)
      localStorage.removeItem('tc_impersonation')
      router.push(redirectTo === '/accueil' ? '/profil?setup=1' : redirectTo)
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setRegError('Cette adresse email est déjà utilisée. Vous avez sûrement déjà un compte — utilisez « Récupérer mon mot de passe » pour le récupérer.')
        setEmailExists(true)
      } else {
        setRegError("Erreur lors de la création du compte")
      }
    } finally {
      setRegLoading(false)
    }
  }

  const handleSendReset = async () => {
    if (!resetEmail) {
      setResetError('Veuillez saisir votre adresse mail')
      return
    }
    setResetLoading(true)
    setResetError('')
    try {
      await resetPassword(resetEmail)
      setResetSent(true)
    } catch {
      setResetError("Impossible d'envoyer l'email de réinitialisation")
    } finally {
      setResetLoading(false)
    }
  }

  const openResetDialog = () => {
    setResetEmail(tab === 'connexion' ? loginEmail : regEmail)
    setResetSent(false)
    setResetError('')
    setShowResetDialog(true)
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center px-4">

      {/* Titre */}
      <p className="mt-8 mb-4 text-3xl font-bold text-gray-900 tracking-tight">
        TC Connect
      </p>

      {/* Card */}
      <div
        className="w-full mt-3 mb-3"
        style={{ maxWidth: 530 }}
      >
        {/* Toggle tab bar */}
        <div className="flex gap-3 px-4 mb-0">
          {(['connexion', 'creer'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold rounded-xl border-2 transition ${
                tab === t
                  ? 'bg-white border-gray-200 text-gray-900 shadow-sm'
                  : 'bg-gray-100 border-gray-200 text-gray-500'
              }`}
            >
              {t === 'connexion' ? 'Connexion' : 'Créer un compte'}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 pt-4 pb-4">

          {/* ── Créer un compte ── */}
          {tab === 'creer' && (
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <p className="text-2xl font-bold text-gray-900">Créer un compte</p>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="w-full border-2 border-gray-200 rounded-xl px-6 py-4 text-sm bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showRegPwd ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border-2 border-gray-200 rounded-xl px-6 py-4 pr-12 text-sm bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPwd(!showRegPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showRegPwd ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showRegConfirm ? 'text' : 'password'}
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border-2 border-gray-200 rounded-xl px-6 py-4 pr-12 text-sm bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegConfirm(!showRegConfirm)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showRegConfirm ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {regError && (
                <div className="text-center space-y-2">
                  <p className="text-red-500 text-sm">{regError}</p>
                  {emailExists && (
                    <button
                      type="button"
                      onClick={openResetDialog}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 underline"
                    >
                      Récupérer mon mot de passe
                    </button>
                  )}
                </div>
              )}

              <div className="flex justify-center mt-2">
                <button
                  type="submit"
                  disabled={regLoading}
                  style={{ width: 230, height: 52 }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-50"
                >
                  {regLoading ? 'Création...' : 'Créer un compte'}
                </button>
              </div>

            </form>
          )}

          {/* ── Connexion ── */}
          {tab === 'connexion' && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <p className="text-2xl font-bold text-gray-900">Content de vous revoir !</p>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  placeholder="votre@email.com"
                  className="w-full border-2 border-gray-200 rounded-xl px-6 py-4 text-sm bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Mot de passe</label>
                <div className="relative">
                  <input
                    type={showLoginPwd ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full border-2 border-gray-200 rounded-xl px-6 py-4 pr-12 text-sm bg-white focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPwd(!showLoginPwd)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showLoginPwd ? <EyeIcon className="w-5 h-5" /> : <EyeSlashIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}

              <div className="flex justify-center mt-2">
                <button
                  type="submit"
                  disabled={loginLoading}
                  style={{ width: 230, height: 52 }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-50"
                >
                  {loginLoading ? 'Connexion...' : 'Connexion'}
                </button>
              </div>

              <div className="flex justify-center mb-2">
                <button
                  type="button"
                  onClick={openResetDialog}
                  style={{ height: 44 }}
                  className="px-8 text-sm font-bold text-gray-700 bg-white border-2 border-white rounded-full hover:bg-gray-50 transition"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Liens légaux */}
      <div className="mt-2 mb-6 flex items-center gap-4 text-xs text-gray-400">
        <a href="/privacy-policy" className="hover:text-gray-600 hover:underline transition">Politique de confidentialité</a>
        <span>·</span>
        <a href="/terms" className="hover:text-gray-600 hover:underline transition">CGU</a>
      </div>

      {/* Dialog mot de passe oublié */}
      {showResetDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setShowResetDialog(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full mx-4"
            style={{ maxWidth: 500 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-2">
              <p className="text-xl font-bold text-gray-900">Modifier mon mot de passe</p>
              <button
                onClick={() => setShowResetDialog(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-blue-600 transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <p className="px-6 text-sm text-gray-500 pb-4">
              Nous vous enverrons un courriel contenant un lien pour réinitialiser votre mot de passe.
              Veuillez saisir ci-dessous l&apos;adresse mail associée à votre compte.
            </p>

            {/* Email field */}
            <div className="px-6 pb-2">
              <div className="border-2 border-gray-200 rounded-xl px-4 py-1 bg-white">
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Votre adresse mail"
                  className="w-full py-2 text-sm bg-transparent focus:outline-none text-gray-800 placeholder-gray-400"
                />
              </div>
            </div>

            {resetError && <p className="px-6 text-red-500 text-sm">{resetError}</p>}
            {resetSent && (
              <p className="px-6 text-green-600 text-sm">Email envoyé ! Vérifiez votre boîte mail ainsi que vos courriers indésirables.</p>
            )}

            {/* Button */}
            <div className="flex justify-end px-6 py-4">
              <button
                onClick={handleSendReset}
                disabled={resetLoading || resetSent}
                className="h-11 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition disabled:opacity-50"
              >
                {resetLoading ? 'Envoi...' : 'Envoi du lien'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
