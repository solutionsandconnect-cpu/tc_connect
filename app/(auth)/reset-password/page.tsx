'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      await resetPassword(email)
      setMessage('Email de réinitialisation envoyé. Vérifiez votre boîte mail.')
    } catch {
      setError('Impossible d\'envoyer l\'email. Vérifiez l\'adresse saisie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">TC Connect</h1>
          <p className="text-gray-500 mt-2">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-8">
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {message && <p className="text-green-500 text-sm text-center">{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>

          </form>

          <div className="mt-4 text-center">
            <a href="/login" className="text-sm text-blue-500 hover:underline">
              Retour à la connexion
            </a>
          </div>
        </div>

      </div>
    </div>
  )
}