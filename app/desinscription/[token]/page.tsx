'use client'

import { use, useEffect, useState } from 'react'
import { CheckCircleIcon, NoSymbolIcon } from '@heroicons/react/24/outline'

type Infos = { societe: string; emailMasque: string; dejaOppose: boolean }

export default function DesinscriptionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const [infos, setInfos] = useState<Infos | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)
  const [fait, setFait] = useState(false)

  useEffect(() => {
    let annule = false
    void (async () => {
      try {
        const res = await fetch(`/api/desinscription/${token}`)
        const data = await res.json()
        if (annule) return
        if (!res.ok) { setErreur(data.error ?? 'Lien invalide.'); return }
        setInfos(data)
        if (data.dejaOppose) setFait(true)
      } catch {
        if (!annule) setErreur('Impossible de charger cette page. Réessayez dans un instant.')
      }
    })()
    return () => { annule = true }
  }, [token])

  const confirmer = async () => {
    setEnCours(true)
    try {
      const res = await fetch(`/api/desinscription/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setErreur(data.error ?? 'Échec de la désinscription.'); return }
      setFait(true)
    } catch {
      setErreur('Échec de la désinscription. Réessayez dans un instant.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm px-6 py-8">
        {erreur ? (
          <div className="text-center">
            <NoSymbolIcon className="w-10 h-10 mx-auto text-gray-300 mb-3" />
            <h1 className="text-lg font-semibold mb-1">Lien invalide</h1>
            <p className="text-sm text-gray-500">{erreur}</p>
          </div>
        ) : fait ? (
          <div className="text-center">
            <CheckCircleIcon className="w-10 h-10 mx-auto text-green-600 mb-3" />
            <h1 className="text-lg font-semibold mb-2">C&apos;est fait</h1>
            <p className="text-sm text-gray-600">
              Votre adresse {infos ? <strong>{infos.emailMasque}</strong> : null} a été retirée
              définitivement de notre liste de prospection. Vous ne recevrez plus aucun message,
              même si votre entreprise réapparaît dans un annuaire.
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Pour toute demande relative à vos données : contact@enezo.fr
            </p>
          </div>
        ) : !infos ? (
          <div className="text-center text-sm text-gray-500 py-6">Chargement…</div>
        ) : (
          <>
            <h1 className="text-lg font-semibold mb-2">Ne plus recevoir de messages</h1>
            <p className="text-sm text-gray-600 mb-1">
              Vous êtes sur le point de retirer l&apos;adresse <strong>{infos.emailMasque}</strong>
              {infos.societe ? <> (<strong>{infos.societe}</strong>)</> : null} de notre liste de
              prospection.
            </p>
            <p className="text-sm text-gray-600 mb-5">
              Ce retrait est définitif : votre adresse est conservée dans un registre d&apos;opposition
              dont le seul rôle est d&apos;empêcher tout nouveau contact.
            </p>
            <button
              onClick={confirmer}
              disabled={enCours}
              className="w-full px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black transition disabled:opacity-50"
            >
              {enCours ? 'Enregistrement…' : 'Confirmer — ne plus me contacter'}
            </button>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Enezo — pour toute demande relative à vos données : contact@enezo.fr
            </p>
          </>
        )}
      </div>
    </div>
  )
}
