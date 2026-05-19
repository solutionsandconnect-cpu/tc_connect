'use client'

import { useParams, useRouter } from 'next/navigation'
import { useExercices } from '@/hooks/useExercices'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function DetailExercicePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { exercices } = useExercices()

  const exercice = exercices.find((e) => e.id === id)

  if (!exercice) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/exercices')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{exercice.nom_exercice}</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Partie prioritaire</span>
          <span className="font-medium text-gray-800">{exercice.partie_prioritaire || '—'}</span>
        </div>

        {exercice.Muscles && exercice.Muscles.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Muscles</p>
            <div className="flex flex-wrap gap-2">
              {exercice.Muscles.map((m) => (
                <span key={m} className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {exercice.Materiel && exercice.Materiel.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Matériel</p>
            <div className="flex flex-wrap gap-2">
              {exercice.Materiel.map((m) => (
                <span key={m} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {exercice.explications_commentees_exercice && (
          <div>
            <p className="text-sm text-gray-500 mb-2">Explications</p>
            <p className="text-sm text-gray-800 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
              {exercice.explications_commentees_exercice}
            </p>
          </div>
        )}

        {exercice.lien_exercice && (
          <div>
  <p className="text-sm text-gray-500 mb-2">Lien</p>
  
   <a href={exercice.lien_exercice}
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-blue-600 hover:underline break-all"
  >
    {exercice.lien_exercice}
  </a>
</div>
        )}

      </div>
    </div>
  )
}