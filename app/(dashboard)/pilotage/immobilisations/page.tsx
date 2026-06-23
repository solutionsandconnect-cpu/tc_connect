'use client'

import { useMemo, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { usePilotageImmobilisations } from '@/hooks/usePilotageImmobilisations'
import { usePilotageSettings } from '@/hooks/usePilotageSettings'
import Modal from '@/components/ui/Modal'
import type { PilotageImmobilisation } from '@/types'
import {
  ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, ComputerDesktopIcon,
} from '@heroicons/react/24/outline'

const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

// Modèles d'achat fréquents (durée d'amortissement usuelle en années)
const MODELES: { label: string; dureeAns: number }[] = [
  { label: 'Ordinateur portable / PC', dureeAns: 3 },
  { label: 'Smartphone / tablette', dureeAns: 2 },
  { label: 'Écran / périphériques', dureeAns: 3 },
  { label: 'Mobilier de bureau', dureeAns: 10 },
  { label: 'Logiciel / licence', dureeAns: 1 },
]

function emptyForm() {
  return { label: '', montant: '', dateAchat: '', dureeAns: '3' }
}

export default function PilotageImmobilisationsPage() {
  const router = useRouter()
  const { userProfile } = useAuth()
  const isAdmin = userProfile?.role_app === 'Admin'

  const { items, loading, addItem, updateItem, deleteItem } = usePilotageImmobilisations()
  const { settings, saveSettings } = usePilotageSettings()
  const joursFactures = settings?.joursFactures ?? 100

  const [tauxEconomie, setTauxEconomie] = useState(30) // taux d'économie estimé si passage au réel (%)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  // Calculs d'amortissement (linéaire)
  const calc = useMemo(() => {
    const now = Date.now()
    const rows = items.map((it) => {
      const amortAnnuel = it.dureeAns > 0 ? it.montant / it.dureeAns : 0
      const amortMensuel = amortAnnuel / 12
      let pctAmorti: number | null = null
      let valeurResiduelle: number | null = null
      if (it.dateAchat) {
        const annees = (now - new Date(it.dateAchat).getTime()) / (365.25 * 24 * 3600 * 1000)
        const part = it.dureeAns > 0 ? Math.min(1, Math.max(0, annees / it.dureeAns)) : 1
        pctAmorti = Math.round(part * 100)
        valeurResiduelle = Math.max(0, it.montant * (1 - part))
      }
      return { it, amortAnnuel, amortMensuel, pctAmorti, valeurResiduelle }
    })
    const totalInvesti = items.reduce((s, it) => s + it.montant, 0)
    const totalAmortAnnuel = rows.reduce((s, r) => s + r.amortAnnuel, 0)
    const totalAmortMensuel = totalAmortAnnuel / 12
    const coutParJour = joursFactures > 0 ? totalAmortAnnuel / joursFactures : 0
    const economieReel = totalAmortAnnuel * (tauxEconomie / 100)
    return { rows, totalInvesti, totalAmortAnnuel, totalAmortMensuel, coutParJour, economieReel }
  }, [items, joursFactures, tauxEconomie])

  if (!isAdmin) {
    return <div className="flex items-center justify-center py-20"><p className="text-gray-500">Accès réservé aux administrateurs.</p></div>
  }

  const openCreate = () => { setEditId(null); setForm(emptyForm()); setError(''); setShowForm(true) }
  const openEdit = (it: PilotageImmobilisation) => {
    setEditId(it.id)
    setForm({ label: it.label, montant: String(it.montant), dateAchat: it.dateAchat ?? '', dureeAns: String(it.dureeAns) })
    setError(''); setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const montant = Number(form.montant)
    const dureeAns = Number(form.dureeAns)
    if (!form.label.trim()) { setError('Donne un nom à cet achat.'); return }
    if (!(montant > 0)) { setError('Indique un montant valide.'); return }
    if (!(dureeAns > 0)) { setError("Indique une durée d'amortissement (en années)."); return }
    setSaving(true)
    try {
      const payload = {
        label: form.label.trim(),
        montant,
        dateAchat: form.dateAchat || null,
        dureeAns,
      }
      if (editId) await updateItem(editId, payload)
      else await addItem({ ...payload, createdAt: Timestamp.now() })
      setShowForm(false)
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/pilotage')} className="p-2 rounded-lg hover:bg-gray-100 transition">
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <ComputerDesktopIcon className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Immobilisations / matériel</h1>
              <p className="text-sm text-gray-500">Répartis le coût de tes achats (PC, écran…) dans le temps</p>
            </div>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
          <PlusIcon className="w-4 h-4" /> Ajouter un achat
        </button>
      </div>

      {/* Réglages */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Jours facturés / an</label>
          <input type="number" inputMode="decimal" min={1} value={joursFactures}
            onChange={(e) => saveSettings({ joursFactures: Math.max(1, Number(e.target.value) || 0) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[10px] text-gray-400 mt-0.5">Sert à répartir le coût du matériel par jour facturé (partagé avec le calculateur).</p>
        </div>
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm p-3">
          <label className="block text-[11px] font-medium text-gray-600 mb-1">Taux d'économie au réel (%)</label>
          <input type="number" inputMode="decimal" min={0} step={1} value={tauxEconomie}
            onChange={(e) => setTauxEconomie(Math.max(0, Number(e.target.value) || 0))}
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <p className="text-[10px] text-gray-400 mt-0.5">Cotisations + impôt que tu économiserais sur l'amortissement SI tu étais au régime réel (estimation).</p>
        </div>
      </div>

      {/* Totaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Total investi</p>
          <p className="text-2xl font-bold text-gray-900">{fmtEur(calc.totalInvesti)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Coût réparti / an</p>
          <p className="text-2xl font-bold text-gray-900">{fmtEur(calc.totalAmortAnnuel)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{fmtEur(calc.totalAmortMensuel)}/mois</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Coût / jour facturé</p>
          <p className="text-2xl font-bold text-gray-900">{fmtEur(calc.coutParJour)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">à ajouter à ton coût/jour</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 mb-1">Économie /an si réel</p>
          <p className="text-2xl font-bold text-emerald-700">{fmtEur(calc.economieReel)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">au taux {tauxEconomie}%</p>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <ComputerDesktopIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucun achat enregistré</p>
          <p className="text-sm text-gray-400 mt-1">Ajoute ton matériel (PC, écran, mobilier…) pour voir ce qu'il te coûte vraiment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calc.rows.map(({ it, amortAnnuel, amortMensuel, pctAmorti, valeurResiduelle }) => (
            <div key={it.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-800">{it.label}</p>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{fmtEur(it.montant)}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">sur {it.dureeAns} an{it.dureeAns > 1 ? 's' : ''}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Coût réparti : <strong>{fmtEur(amortAnnuel)}/an</strong> ({fmtEur(amortMensuel)}/mois)
                  {it.dateAchat && pctAmorti != null && (
                    <> · acheté le {new Date(it.dateAchat).toLocaleDateString('fr-FR')} · amorti à <strong>{pctAmorti}%</strong> · valeur restante ≈ <strong>{fmtEur(valeurResiduelle ?? 0)}</strong></>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openEdit(it)} title="Modifier"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setConfirmDel(it.id)} title="Supprimer"
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Aide à décider : micro vs réel */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 space-y-3">
        <p className="text-xs font-semibold text-amber-800">Micro-entreprise ou régime réel : qu'est-ce que ça change ?</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="bg-white/70 rounded-lg border border-amber-100 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">En micro-entreprise (ton régime)</p>
            <p className="text-xs text-gray-600">
              Tu <strong>ne peux pas déduire</strong> tes achats : le régime applique déjà un <strong>abattement forfaitaire de 34 %</strong> (BNC) sur ton chiffre d'affaires, censé couvrir tous tes frais.
            </p>
            <p className="text-xs text-gray-600">
              Tes {fmtEur(calc.totalInvesti)} d'achats ne réduisent donc <strong>ni tes cotisations ni ton impôt</strong>. Cet outil sert à savoir ce que ce matériel te coûte vraiment (≈ <strong>{fmtEur(calc.totalAmortMensuel)}/mois</strong>, soit <strong>{fmtEur(calc.coutParJour)}/jour facturé</strong>) pour le réintégrer dans ton prix.
            </p>
          </div>
          <div className="bg-white/70 rounded-lg border border-amber-100 p-3 space-y-1.5">
            <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">Si tu passais au régime réel</p>
            <p className="text-xs text-gray-600">
              Tu <strong>amortirais</strong> chaque achat sur sa durée de vie et déduirais ≈ <strong>{fmtEur(calc.totalAmortAnnuel)}/an</strong> de ton bénéfice → économie estimée ≈ <strong>{fmtEur(calc.economieReel)}/an</strong> (au taux {tauxEconomie}%).
            </p>
            <p className="text-xs text-gray-600">
              Le réel n'est intéressant que si <strong>l'ensemble de tes frais réels dépasse l'abattement de 34 %</strong> de ton CA. C'est un choix global (tous tes frais), à valider avec un comptable.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400">
          Amortissement linéaire (montant ÷ durée). Estimation indicative — fais valider ton régime fiscal par un expert-comptable.
        </p>
      </div>

      {/* Formulaire */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editId ? "Modifier l'achat" : 'Ajouter un achat'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Désignation</label>
            <input type="text" value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Ex : MacBook Pro 14&quot;"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {MODELES.map((m) => (
                <button key={m.label} type="button"
                  onClick={() => setForm((f) => ({ ...f, label: f.label || m.label, dureeAns: String(m.dureeAns) }))}
                  className="text-[11px] px-2 py-1 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition">
                  {m.label} · {m.dureeAns} an{m.dureeAns > 1 ? 's' : ''}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€ TTC)</label>
              <input type="number" inputMode="decimal" min={0} step={10} value={form.montant}
                onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durée (années)</label>
              <input type="number" inputMode="decimal" min={1} step={1} value={form.dureeAns}
                onChange={(e) => setForm((f) => ({ ...f, dureeAns: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date d'achat <span className="font-normal text-gray-400">(optionnel)</span></label>
            <input type="date" value={form.dateAchat}
              onChange={(e) => setForm((f) => ({ ...f, dateAchat: e.target.value }))}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-[11px] text-gray-400 mt-0.5">Permet de voir la part déjà amortie et la valeur restante.</p>
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
              {saving ? 'Enregistrement…' : editId ? 'Enregistrer' : 'Ajouter'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Annuler
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation suppression */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Supprimer cet achat ?" size="sm">
        <p className="text-sm text-gray-600">Cette ligne sera retirée de tes immobilisations. Action définitive.</p>
        <div className="flex items-center gap-3 mt-4">
          <button onClick={async () => { if (confirmDel) await deleteItem(confirmDel); setConfirmDel(null) }}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition">
            Supprimer
          </button>
          <button onClick={() => setConfirmDel(null)}
            className="border border-gray-300 text-gray-600 px-5 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
            Annuler
          </button>
        </div>
      </Modal>
    </div>
  )
}
