'use client'

import { useState } from 'react'
import { CheckCircleIcon, NoSymbolIcon } from '@heroicons/react/24/outline'
import type { InfosDesinscription } from '@/lib/desinscriptionServer'

// Les infos (société, email masqué, état) sont lues côté SERVEUR et injectées ici :
// plus de `fetch` au montage ni de spinner « Chargement… » (l'endpoint est rarement
// sollicité, donc quasi toujours froid — le double aller-retour était très lent).
// Seule l'action de confirmation reste un appel réseau.
export default function DesinscriptionClient({
  token,
  infos,
}: {
  token: string
  infos: InfosDesinscription | null
}) {
  const [erreur, setErreur] = useState<string | null>(
    infos ? null : 'Ce lien est invalide ou a expiré.',
  )
  const [enCours, setEnCours] = useState(false)
  const [fait, setFait] = useState(!!infos?.dejaOppose)

  const confirmer = async () => {
    setEnCours(true)
    try {
      const res = await fetch(`/api/desinscription/${token}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setErreur(data.error ?? 'Échec de la désinscription.')
        return
      }
      setFait(true)
    } catch {
      setErreur('Échec de la désinscription. Réessayez dans un instant.')
    } finally {
      setEnCours(false)
    }
  }

  if (erreur) {
    return (
      <div className="text-center">
        <NoSymbolIcon className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <h1 className="text-lg font-semibold mb-1">Lien invalide</h1>
        <p className="text-sm text-gray-500">{erreur}</p>
      </div>
    )
  }

  if (fait) {
    return (
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
    )
  }

  // À ce stade `infos` est nécessairement présent (sinon `erreur` aurait court-circuité).
  return (
    <>
      <h1 className="text-lg font-semibold mb-2">Ne plus recevoir de messages</h1>
      <p className="text-sm text-gray-600 mb-1">
        Vous êtes sur le point de retirer l&apos;adresse <strong>{infos!.emailMasque}</strong>
        {infos!.societe ? <> (<strong>{infos!.societe}</strong>)</> : null} de notre liste de
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
  )
}
