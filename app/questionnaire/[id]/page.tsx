'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PainPoint } from '@/types'
import { ZONES_DOULEUR } from '@/lib/painZones'

function PainBodySelector({ value, onChange }: { value: PainPoint[]; onChange: (v: PainPoint[]) => void }) {
  const selMap = Object.fromEntries(value.map(p => [p.zone, p]))

  const toggle = (id: string) => {
    if (selMap[id]) onChange(value.filter(p => p.zone !== id))
    else onChange([...value, { zone: id, intensite: 5, type: '' }])
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {ZONES_DOULEUR.map(({ id, label }) => (
          <button key={id} type="button" onClick={() => toggle(id)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              selMap[id]
                ? 'bg-red-500 text-white border-red-500'
                : 'border-gray-300 text-gray-600 hover:border-red-300 hover:text-red-500'
            }`}>
            {label}
          </button>
        ))}
      </div>
      {value.length > 0 && (
        <div className="space-y-2 mt-2">
          {value.map((p) => {
            const lbl = ZONES_DOULEUR.find(z => z.id === p.zone)?.label ?? p.zone
            return (
              <div key={p.zone} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <span className="text-sm text-gray-800 flex-1 font-medium">{lbl}</span>
                <input type="range" min={1} max={10} value={p.intensite}
                  onChange={(e) => onChange(value.map(x => x.zone === p.zone ? { ...x, intensite: Number(e.target.value) } : x))}
                  className="w-24 accent-red-500" />
                <span className="text-xs text-red-600 font-semibold w-10 text-right">{p.intensite}/10</span>
                <button type="button" onClick={() => onChange(value.filter(x => x.zone !== p.zone))}
                  className="text-gray-400 hover:text-red-500 text-sm ml-1">✕</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
    key: 'motivation_avant_seance',
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
    key: 'activite_derniers_jours',
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
    key: 'alimentation_derniers_jours',
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
  const router = useRouter()
  const [planning, setPlanning] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<Record<string, number>>({
    qualite_sommeil: 1,
    niveau_fatigue: 1,
    niveau_courbatures: 1,
    quantite_stress: 1,
    motivation_avant_seance: 1,
    activite_derniers_jours: 1,
    alimentation_derniers_jours: 1,
  })
  const [commentaire, setCommentaire] = useState('')
  const [douleurs, setDouleurs] = useState<PainPoint[]>([])

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'planning_pro', id))
      if (snap.exists()) {
        const data = snap.data()
        setPlanning({ id: snap.id, ...data })
        setForm({
          qualite_sommeil: data.qualite_sommeil || 1,
          niveau_fatigue: data.niveau_fatigue || 1,
          niveau_courbatures: data.niveau_courbatures || 1,
          quantite_stress: data.quantite_stress || 1,
          motivation_avant_seance: data.motivation_avant_seance || 1,
          activite_derniers_jours: data.activite_derniers_jours || 1,
          alimentation_derniers_jours: data.alimentation_derniers_jours || 1,
        })
        setCommentaire(data.infos_complementaire_avant_seance_client || '')
        setDouleurs(data.douleurs ?? [])
      }
      setLoading(false)
    }
    fetch()
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const indice_hooper =
      (form.qualite_sommeil || 0) +
      (form.niveau_fatigue || 0) +
      (form.niveau_courbatures || 0) +
      (form.quantite_stress || 0)
    try {
      await updateDoc(doc(db, 'planning_pro', id), {
        qualite_sommeil: form.qualite_sommeil,
        niveau_fatigue: form.niveau_fatigue,
        niveau_courbatures: form.niveau_courbatures,
        quantite_stress: form.quantite_stress,
        motivation_avant_seance: form.motivation_avant_seance,
        activite_derniers_jours: form.activite_derniers_jours,
        alimentation_derniers_jours: form.alimentation_derniers_jours,
        infos_complementaire_avant_seance_client: commentaire,
        douleurs: douleurs.length ? douleurs : [],
        questionnaire_rempli: true,
        indice_hooper,
      })
      setSubmitted(true)
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title: 'Questionnaire rempli',
          body: 'Un client vient de remplir son questionnaire de forme.',
          url: `/planning/${id}`,
        }),
      }).catch(() => {})
    } catch (err: any) {
      alert(`Erreur : ${err?.message ?? 'inconnue'}`)
    } finally {
      setSubmitting(false)
    }
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

  // Déterminer si la modification est autorisée :
  // - Questionnaire pas encore rempli → toujours éditable (premier remplissage)
  // - Questionnaire déjà rempli + admin a défini une date future → éditable
  // - Questionnaire déjà rempli + pas de permission → lecture seule
  const alreadyFilled = !!(planning.questionnaire_rempli || planning.indice_hooper != null)
  const editableUntil: Date | null = planning.questionnaire_editable_until?.toDate?.() ?? null
  const canEdit = !alreadyFilled || (editableUntil !== null && editableUntil > new Date())

  // ── Vue lecture seule ──────────────────────────────────────────────────────
  if (alreadyFilled && !canEdit) {
    const indiceHooper = planning.indice_hooper ?? null
    const hooperColor = indiceHooper == null ? 'text-gray-500'
      : indiceHooper <= 12 ? 'text-green-600'
      : indiceHooper <= 18 ? 'text-orange-500'
      : 'text-red-600'
    const dateLabel = planning.date_planning
      ? new Date(planning.date_planning.seconds * 1000).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
      : ''

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto space-y-5">

          {/* Retour */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour
          </button>

          {/* En-tête */}
          <div className="text-center">
            <p className="text-sm text-gray-500 capitalize">{dateLabel}</p>
            <h1 className="text-xl font-bold text-gray-800 mt-1">Questionnaire de forme</h1>
          </div>

          {/* Indice Hooper */}
          {indiceHooper != null && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Indice Hooper</p>
              <p className={`text-3xl font-bold ${hooperColor}`}>{indiceHooper}<span className="text-sm font-normal text-gray-400">/28</span></p>
              <p className="text-xs text-gray-400 mt-1">
                {indiceHooper <= 12 ? '✓ Très bien récupéré' : indiceHooper <= 18 ? '⚠ Récupération modérée' : '⛔ Mauvaise récupération'}
              </p>
            </div>
          )}

          {/* Réponses */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            {QUESTIONS.map((q) => {
              const val: number = (form as any)[q.key] ?? 0
              const labelAnswer = val > 0 ? (q.labels[val - 1] ?? `${val}`) : '—'
              return (
                <div key={q.key}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{q.label}</p>
                  <p className="text-sm font-medium text-gray-800">{labelAnswer}</p>
                </div>
              )
            })}
          </div>

          {/* Informations complémentaires */}
          {commentaire && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Infos complémentaires</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{commentaire}</p>
            </div>
          )}

          {/* Douleurs */}
          {douleurs.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Douleurs signalées</p>
              <div className="flex flex-wrap gap-1.5">
                {douleurs.map((d, i) => (
                  <span key={i} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border ${
                    d.intensite >= 7 ? 'bg-red-50 border-red-200 text-red-700' :
                    d.intensite >= 4 ? 'bg-orange-50 border-orange-200 text-orange-700' :
                    'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}>
                    {d.zone}{d.type ? ` · ${d.type}` : ''}
                    <span className="font-bold">{d.intensite}/10</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Ce questionnaire est en lecture seule.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Retour
          </button>
        </div>
        <div className="flex items-center justify-center">
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
          <button
            onClick={() => setSubmitted(false)}
            className="mt-4 text-xs text-blue-500 hover:underline"
          >
            Modifier mes réponses
          </button>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Retour */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition mb-6"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Retour
        </button>

        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600">TC Connect</h1>
          <h2 className="text-lg font-semibold text-gray-800 mt-2">États de Forme</h2>
          <p className="text-sm text-gray-500 mt-2">
            Merci de remplir ce formulaire concernant vos états de forme.
            Pour chaque section, sélectionnez la réponse qui vous semble la plus appropriée.
          </p>
        </div>

        {planning.questionnaire_rempli && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 text-sm text-blue-700">
            Vos réponses sont déjà enregistrées. Vous pouvez les modifier ci-dessous.
          </div>
        )}

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

          {/* Douleurs / localisation */}
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Douleurs</h3>
            <p className="text-sm text-gray-500 mb-4">Avez-vous des douleurs en ce moment ? Touchez les zones concernées sur le schéma.</p>
            <PainBodySelector value={douleurs} onChange={setDouleurs} />
          </div>

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