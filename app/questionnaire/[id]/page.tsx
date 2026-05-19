'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const QUESTIONS = [
  {
    key: 'qualite_sommeil',
    label: 'Sommeil',
    question: 'Comment évaluez-vous votre qualité de sommeil de la nuit dernière ?',
    labels: [
      '1 — Très très bonne',
      '2 — Très bonne',
      '3 — Bonne',
      '4 — Moyenne',
      '5 — Mauvaise',
      '6 — Très mauvaise',
      '7 — Très très mauvaise',
    ],
  },
  {
    key: 'niveau_fatigue',
    label: 'Fatigue',
    question: 'Comment évaluez-vous votre niveau de fatigue actuel ?',
    labels: [
      '1 — Très très faible',
      '2 — Très faible',
      '3 — Faible',
      '4 — Moyen',
      '5 — Élevé',
      '6 — Très élevé',
      '7 — Très très élevé',
    ],
  },
  {
    key: 'niveau_courbatures',
    label: 'Courbatures',
    question: 'Comment évaluez-vous le niveau actuel de vos courbatures (ou douleurs physiques) ?',
    labels: [
      '1 — Très très faible',
      '2 — Très faible',
      '3 — Faible',
      '4 — Moyen',
      '5 — Élevé',
      '6 — Très élevé',
      '7 — Très très élevé',
    ],
  },
  {
    key: 'quantite_stress',
    label: 'Stress',
    question: 'Comment évaluez-vous votre quantité de stress actuelle ?',
    labels: [
      '1 — Très très faible',
      '2 — Très faible',
      '3 — Faible',
      '4 — Moyen',
      '5 — Élevée',
      '6 — Très élevée',
      '7 — Très très élevée',
    ],
  },
  {
    key: 'motiv_avant_seance',
    label: 'Motivation',
    question: "Comment évaluez-vous votre motivation à l'idée de faire la séance ?",
    labels: [
      '1 — Pas motivé',
      '2 — Peu motivé',
      '3 — Moyennement motivé',
      '4 — Motivé',
      '5 — Très motivé',
    ],
    max: 5,
  },
  {
    key: 'activite_avant_seance',
    label: 'Activité',
    question: 'Comment évaluez-vous votre niveau d\'activité physique ces derniers jours ?',
    labels: [
      '1 — Passif / Rien fait',
      '2 — Peu actif',
      '3 — Moyennement actif',
      '4 — Actif',
      '5 — Très actif',
    ],
    max: 5,
  },
  {
    key: 'alimentation_avant_seance',
    label: 'Alimentation',
    question: 'Comment évaluez-vous votre alimentation ces derniers jours ?',
    labels: [
      "1 — Que des excès",
      "2 — Beaucoup d'excès",
      "3 — Quelques excès",
      "4 — Très très peu d'excès",
      '5 — Aucun excès / Nutrition hyper saine',
    ],
    max: 5,
  },
]

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>()
  const [planning, setPlanning] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<Record<string, number>>({
    qualite_sommeil: 1,
    niveau_fatigue: 1,
    niveau_courbatures: 1,
    quantite_stress: 1,
    motiv_avant_seance: 1,
    activite_avant_seance: 1,
    alimentation_avant_seance: 1,
  })
  const [commentaire, setCommentaire] = useState('')

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'planning_pro', id))
      if (snap.exists()) {
        const data = snap.data()
        setPlanning({ id: snap.id, ...data })
        // Pré-remplir si déjà rempli
        if (data.questionnaire_rempli) {
          setSubmitted(true)
        }
        setForm({
          qualite_sommeil: data.qualite_sommeil || 1,
          niveau_fatigue: data.niveau_fatigue || 1,
          niveau_courbatures: data.niveau_courbatures || 1,
          quantite_stress: data.quantite_stress || 1,
          motiv_avant_seance: data.motiv_avant_seance || 1,
          activite_avant_seance: data.activite_avant_seance || 1,
          alimentation_avant_seance: data.alimentation_avant_seance || 1,
        })
        setCommentaire(data.commentaire_forme || '')
      }
      setLoading(false)
    }
    fetch()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await updateDoc(doc(db, 'planning_pro', id), {
      ...form,
      commentaire_forme: commentaire,
      questionnaire_rempli: true,
    })
    setSubmitted(true)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!planning) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Questionnaire introuvable.</p>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Merci !</h2>
          <p className="text-gray-500 text-sm">
            Votre questionnaire de forme a bien été enregistré. Votre coach en a été informé.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">TC Connect</h1>
          <h2 className="text-lg font-semibold text-gray-800 mt-2">États de Forme</h2>
          <p className="text-sm text-gray-500 mt-2">
            Merci de remplir ce formulaire concernant vos états de forme.
            Pour chaque section, sélectionnez la réponse qui vous semble la plus appropriée.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {QUESTIONS.map((q) => {
            const max = q.max || 7
            return (
              <div key={q.key} className="bg-white rounded-2xl shadow-sm p-5">
                <h3 className="font-semibold text-gray-800 mb-1">{q.label}</h3>
                <p className="text-sm text-gray-500 mb-4">{q.question}</p>

                <div className="space-y-2">
                  {q.labels.map((label, i) => {
                    const val = i + 1
                    const isSelected = form[q.key] === val
                    return (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setForm({ ...form, [q.key]: val })}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-medium'
                            : 'bg-gray-50 text-gray-700 border-gray-100 hover:bg-gray-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Commentaire libre */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Commentaire</h3>
            <p className="text-sm text-gray-500 mb-3">
              Avez-vous d'autres choses à dire ? (Maladie, douleurs ciblées...)
            </p>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
              placeholder="Optionnel..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {submitting ? 'Envoi...' : 'Envoyer mon questionnaire'}
          </button>
        </form>
      </div>
    </div>
  )
}