import { infosDesinscription } from '@/lib/desinscriptionServer'
import DesinscriptionClient from './DesinscriptionClient'

// Lecture faite au rendu SERVEUR (Firestore Admin) : la page arrive déjà remplie,
// en un seul aller-retour. `force-dynamic` car l'état d'opposition est vivant et
// propre au jeton — jamais de mise en cache.
export const dynamic = 'force-dynamic'

export default async function DesinscriptionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const infos = token ? await infosDesinscription(token) : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gray-50">
      <div className="w-full max-w-md bg-white border rounded-2xl shadow-sm px-6 py-8">
        <DesinscriptionClient token={token} infos={infos} />
      </div>
    </div>
  )
}
