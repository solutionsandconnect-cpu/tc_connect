'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useRPE } from '@/hooks/useRPE'
import { useNotes } from '@/hooks/useNotes'
import Badge from '@/components/ui/Badge'
import {
  ArrowLeftIcon, UserIcon, ChartBarIcon, DocumentTextIcon,
} from '@heroicons/react/24/outline'

export default function DetailJoueurPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [joueur, setJoueur] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { rpeList } = useRPE(id)

  useEffect(() => {
    const fetchJoueur = async () => {
      const snap = await getDoc(doc(db, 'joueurs', id))
      if (snap.exists()) setJoueur({ id: snap.id, ...snap.data() })
      setLoading(false)
    }
    fetchJoueur()
  }, [id])

  const avgRPE = rpeList.length
    ? Math.round(rpeList.reduce((acc, r) => acc + r.rpe, 0) / rpeList.length * 10) / 10
    : null

  const totalCharge = rpeList.reduce((acc, r) => acc + (r.charge_entrainement || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!joueur) return <p className="text-gray-400 text-center py-10">Joueur introuvable</p>

  return (
    <div className="space-y-6">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          {joueur.prenom_joueur} {joueur.nom_joueur}
        </h1>
      </div>

      {/* Infos principales */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
            <UserIcon className="w-7 h-7" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 text-lg">
              {joueur.prenom_joueur} {joueur.nom_joueur}
            </h2>
            {joueur.mail_joueur && (
              <p className="text-sm text-gray-500">{joueur.mail_joueur}</p>
            )}
            <div className="flex gap-2 mt-1">
              <Badge
                label={joueur.type || 'Joueur'}
                variant={joueur.type === 'Staff' ? 'info' : 'gray'}
              />
              {joueur.type_staff && (
                <Badge label={joueur.type_staff} variant="info" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats RPE */}
      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-blue-500" />
          Charge d'entraînement
        </h2>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{rpeList.length}</p>
            <p className="text-xs text-gray-500 mt-1">Séances</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{avgRPE ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-1">RPE moyen</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{totalCharge}</p>
            <p className="text-xs text-gray-500 mt-1">Charge totale UA</p>
          </div>
        </div>

        {/* Historique RPE */}
        {rpeList.length > 0 && (
          <div className="space-y-2">
            {rpeList.slice(0, 5).map((rpe) => (
              <div
                key={rpe.id}
                className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-xs text-gray-500">
                    {(rpe.date as any)?.toDate().toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    Durée : {rpe.temps} min
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-800">{rpe.rpe}<span className="text-xs text-gray-400">/10</span></p>
                  <p className="text-xs text-gray-400">{rpe.charge_entrainement} UA</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}