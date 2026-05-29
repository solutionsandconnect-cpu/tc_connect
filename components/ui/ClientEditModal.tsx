'use client'

import React, { useState, useEffect } from 'react'
import { Timestamp, collection, addDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useClientNotes } from '@/hooks/useClientNotes'
import { createClient, updateClient } from '@/lib/clientService'
import AdresseAutocomplete from '@/components/ui/AdresseAutocomplete'
import SuggestInput from '@/components/ui/SuggestInput'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { TrashIcon, PencilIcon, MapPinIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import {
  SPORTS, NIVEAUX,
  ObjectifsList, AntecedentsMedicauxList, AntecedentsSportifsList,
} from '@/components/ui/ClientForms'
import type {
  Client, Objectif, AntecedentMedical, AntecedentSportif,
  MaterialItem, StructureItem, AutreCoachItem, SuiviPasse, PlanningSlot, ContactSupplementaire,
} from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const PROFESSIONS = [
  "Agriculteur", "Architecte", "Assistant maternel", "Auxiliaire de vie",
  "Avocat", "Cadre dirigeant", "Chef cuisinier", "Chef d'entreprise",
  "Chercheur", "Chômeur", "Chirurgien", "Comptable", "Consultant",
  "Dentiste", "Designer", "Développeur", "Directeur commercial",
  "Éducateur sportif", "Électricien", "Enseignant", "Entrepreneur",
  "Étudiant", "Formateur", "Graphiste", "Infirmier", "Ingénieur",
  "Journaliste", "Juriste", "Kinésithérapeute", "Logisticien",
  "Manager", "Médecin", "Militaire", "Ostéopathe", "Pharmacien",
  "Photographe", "Plombier", "Police / Gendarmerie", "Pompier",
  "Professeur", "Psychologue", "Retraité", "Sans emploi",
  "Technicien", "Traducteur", "Vétérinaire",
]

const SERVICES_SUIVIS = [
  "Kinésithérapeute", "Ostéopathe", "Médecin du sport", "Podologue",
  "Diététicien(ne)", "Nutritionniste", "Psychologue", "Prépa mentale",
  "Sophrologie", "Acupuncture", "Cardiologue", "Rhumatologue",
  "Chirurgien orthopédique", "Ergothérapeute", "Masseur", "Coach sportif",
]

const RELATIONS_URGENCE = ["Père", "Mère", "Conjoint(e)", "Frère", "Sœur", "Ami(e)", "Collègue", "Autre"]
const DECOUVERTE_OPTIONS = [
  "Instagram", "Facebook", "TikTok", "YouTube",
  "Google / Recherche en ligne", "Site web",
  "Bouche à oreille / Recommandation",
  "Événement sportif", "Presse / Magazine", "Autre",
]
const POSITIONS_TRAVAIL = ["Sédentaire (bureau)", "Debout / Piétinement", "Mixte", "Physique", "En déplacement"]
const JOURS_SEMAINE = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
const JOURS_TRAVAIL = [...JOURS_SEMAINE, "Variable"]

const NAP_CATEGORIES = [
  { id: "sedentaire",  label: "Sédentaire",          coef: 1.2,   desc: "Peu ou pas d'exercice · boulot de bureau" },
  { id: "leger",       label: "Légèrement actif",     coef: 1.375, desc: "Exercice léger 1–3 jours / semaine" },
  { id: "modere",      label: "Modérément actif",     coef: 1.55,  desc: "Exercice modéré 3–5 jours / semaine" },
  { id: "tres_actif",  label: "Très actif",           coef: 1.725, desc: "Exercice intense 6–7 jours / semaine" },
  { id: "extreme",     label: "Extrêmement actif",    coef: 1.9,   desc: "Exercice très intense + travail physique" },
]

// ── Utilities ─────────────────────────────────────────────────────────────────

function isNonDiffusible(s: string | undefined | null): boolean {
  return !s || s.includes("[NON-DIFFUSIBLE]")
}

export function toDateInput(ts?: { seconds: number } | null): string {
  if (!ts) return ""
  return new Date(ts.seconds * 1000).toISOString().split("T")[0]
}

export function fromDateInput(s: string): Timestamp | undefined {
  return s ? Timestamp.fromDate(new Date(s)) : undefined
}

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(address)}&limit=1`)
    const data = await res.json()
    const coords = data.features?.[0]?.geometry?.coordinates
    if (!coords) return null
    return { lat: coords[1], lng: coords[0] }
  } catch { return null }
}

async function calculateRoute(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<{ distanceKm: number; duration: string }> {
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`)
  const data = await res.json()
  const route = data.routes?.[0]
  if (!route) throw new Error("Pas de route trouvée")
  const km = Math.round(route.distance / 100) / 10
  const mins = Math.round(route.duration / 60)
  const duration = mins >= 60 ? `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}` : `${mins} min`
  return { distanceKm: km, duration }
}

async function lookupSiret(siret: string): Promise<{ nom?: string; adresse?: string } | null> {
  const clean = siret.replace(/[\s.]/g, "")
  if (clean.length !== 14) return null
  try {
    const res = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${clean}&per_page=1`)
    const data = await res.json()
    const r = data.results?.[0]
    if (!r) return null
    const rawNom = (r.nom_complet ?? r.nom_raison_sociale ?? "").trim()
    const nom = !isNonDiffusible(rawNom) ? rawNom : undefined
    const adresseParts = [r.siege?.adresse, r.siege?.code_postal, r.siege?.commune].filter((p) => p && !isNonDiffusible(p))
    const adresse = adresseParts.join(", ").trim() || undefined
    return { nom, adresse }
  } catch { return null }
}

function calcNap(q: { travail: string; sportFreq: string; sportIntens: string; mvtQuotidien: string }): string {
  let score = 0
  if (q.travail === "leger") score += 1
  else if (q.travail === "physique") score += 2
  if (q.sportFreq === "1-2") score += 1
  else if (q.sportFreq === "3-4") score += 2
  else if (q.sportFreq === "5+") score += 3
  if (q.sportIntens === "modere") score += 1
  else if (q.sportIntens === "intense") score += 2
  if (q.mvtQuotidien === "moyen") score += 1
  else if (q.mvtQuotidien === "beaucoup") score += 2
  if (score <= 1) return "sedentaire"
  if (score <= 3) return "leger"
  if (score <= 5) return "modere"
  if (score <= 7) return "tres_actif"
  return "extreme"
}

function toProperName(s: string) {
  return s.split(/([\s-])/).map((p) => /[\s-]/.test(p) ? p : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ClientForm = {
  prenom: string; nom: string; email: string; indicatif_tel: string; telephone: string; genre: string
  dateNaissance: string; adresse: string; ville: string; codePostal: string
  profession: string; sportPratique: string; niveauSportif: string; actif: boolean
  siret: string; nomEntreprise: string; adresseEntreprise: string
  objectifs: Objectif[]
  antecedentsMedicaux: AntecedentMedical[]
  antecedentsSportifs: AntecedentSportif[]
  materielItems: MaterialItem[]; structureItems: StructureItem[]; autreCoachItems: AutreCoachItem[]; suivisPassesItems: SuiviPasse[]
  contactUrgenceNom: string; contactUrgenceTel: string; contactUrgenceRelation: string
  lieuSeance: string; lieuSeanceLat: number | null; lieuSeanceLng: number | null
  distanceKm: number | null; tempsRouteSeance: string; nbSeancesMin: string; nbSeancesMax: string
  planningSlots: Record<string, PlanningSlot[]>; planningDispoSlots: Record<string, string[]>
  joursTravail: string[]; positionTravail: string; tempsRouteTravail: string; tempsTravailSemaine: string
  napCategorie: string
  decouverte: string[]
  pendingNotes: Array<{ texte: string; type_note: string; date_max?: string }>
  contactsSupplementaires: ContactSupplementaire[]
}

const EMPTY_CLIENT: ClientForm = {
  prenom: "", nom: "", email: "", indicatif_tel: "+33", telephone: "", genre: "", dateNaissance: "",
  adresse: "", ville: "", codePostal: "", profession: "", sportPratique: "",
  niveauSportif: "", actif: true, siret: "", nomEntreprise: "", adresseEntreprise: "",
  objectifs: [], antecedentsMedicaux: [], antecedentsSportifs: [],
  materielItems: [], structureItems: [], autreCoachItems: [], suivisPassesItems: [],
  contactUrgenceNom: "", contactUrgenceTel: "", contactUrgenceRelation: "",
  lieuSeance: "", lieuSeanceLat: null, lieuSeanceLng: null, distanceKm: null, tempsRouteSeance: "",
  nbSeancesMin: "", nbSeancesMax: "", planningSlots: {}, planningDispoSlots: {},
  joursTravail: [], positionTravail: "", tempsRouteTravail: "", tempsTravailSemaine: "",
  napCategorie: "", decouverte: [], pendingNotes: [], contactsSupplementaires: [],
}

type FormTab = "identite" | "sport" | "sante" | "conditions" | "notes"
const FORM_TABS_ALL: { key: FormTab; label: string; scHidden?: boolean }[] = [
  { key: "identite", label: "Identité" },
  { key: "sport", label: "Sport & Objectifs", scHidden: true },
  { key: "sante", label: "Santé", scHidden: true },
  { key: "conditions", label: "Conditions", scHidden: true },
  { key: "notes", label: "Notes" },
]

const inputCls = "w-full min-w-0 border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-400 transition"

// ── UI helpers ────────────────────────────────────────────────────────────────

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

export function ErrBox({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-600">{msg}</div>
}

export function ModalActions({ onCancel, onSubmit, saving, label }: { onCancel: () => void; onSubmit: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
      <button onClick={onCancel} className="flex-1 border rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Annuler</button>
      <button onClick={onSubmit} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
        {saving ? "Enregistrement..." : label}
      </button>
    </div>
  )
}

// ── Sub-list components ───────────────────────────────────────────────────────

function MaterialItemsList({ value, onChange }: { value: MaterialItem[]; onChange: (v: MaterialItem[]) => void }) {
  const empty: MaterialItem = { nom: "", localisation: "", observations: "" }
  const [form, setForm] = useState<MaterialItem>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const submit = () => {
    if (!form.nom.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }
  return (
    <div className="space-y-2">
      {value.map((m, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800">{m.nom}</p>
            {m.localisation && <p className="text-xs text-gray-500 mt-0.5">📍 {m.localisation}</p>}
            {m.observations && <p className="text-xs text-gray-400 italic mt-0.5">{m.observations}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(m); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <input type="text" placeholder="Ex : Haltères, Tapis, Vélo d'appartement..." value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input type="text" placeholder="Localisation (salle, domicile...)" value={form.localisation ?? ""} onChange={(e) => setForm((f) => ({ ...f, localisation: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <input type="text" placeholder="Observations..." value={form.observations ?? ""} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter du matériel</button>
      )}
    </div>
  )
}

function StructureItemsList({ value, onChange }: { value: StructureItem[]; onChange: (v: StructureItem[]) => void }) {
  const empty: StructureItem = { nom: "", adresse: "", observations: "" }
  const [form, setForm] = useState<StructureItem>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const submit = () => {
    if (!form.nom.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-800">{s.nom}</p>
            {s.adresse && <p className="text-xs text-gray-500 mt-0.5">📍 {s.adresse}</p>}
            {s.observations && <p className="text-xs text-gray-400 italic mt-0.5">{s.observations}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(s); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <input type="text" placeholder="Nom de la salle / structure..." value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <AdresseAutocomplete value={form.adresse ?? ""} onChange={(v) => setForm((f) => ({ ...f, adresse: v }))} onSelectFull={(data) => setForm((f) => ({ ...f, adresse: data.label }))} placeholder="Adresse de la structure..." />
          <input type="text" placeholder="Observations..." value={form.observations ?? ""} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter une structure</button>
      )}
    </div>
  )
}

function AutreCoachList({ value, onChange }: { value: AutreCoachItem[]; onChange: (v: AutreCoachItem[]) => void }) {
  const empty: AutreCoachItem = { service: "", nom: "", tel: "", mail: "", observations: "" }
  const [form, setForm] = useState<AutreCoachItem>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const submit = () => {
    if (!form.service?.trim() && !form.nom?.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {c.service && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">{c.service}</span>}
              {c.nom && <span className="font-medium text-gray-800">{c.nom}</span>}
            </div>
            {c.tel && <p className="text-xs text-gray-500 mt-0.5">📞 {c.tel}</p>}
            {c.mail && <p className="text-xs text-gray-500">✉ {c.mail}</p>}
            {c.observations && <p className="text-xs text-gray-400 italic mt-0.5">{c.observations}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(c); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Service / spécialité</label>
              <SuggestInput value={form.service ?? ""} onChange={(v) => setForm((f) => ({ ...f, service: v }))} suggestions={SERVICES_SUIVIS} placeholder="Kiné, ostéo..." className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom</label>
              <input type="text" value={form.nom ?? ""} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <input type="tel" value={form.tel ?? ""} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={form.mail ?? ""} onChange={(e) => setForm((f) => ({ ...f, mail: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
          </div>
          <input type="text" placeholder="Observations..." value={form.observations ?? ""} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter un suivi</button>
      )}
    </div>
  )
}

function SuivisPassesList({ value, onChange }: { value: SuiviPasse[]; onChange: (v: SuiviPasse[]) => void }) {
  const empty: SuiviPasse = { service: "", nom: "", tel: "", mail: "", observations: "" }
  const [form, setForm] = useState<SuiviPasse>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const submit = () => {
    if (!form.service?.trim() && !form.nom?.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-sm">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {c.service && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">{c.service}</span>}
              {c.nom && <span className="font-medium text-gray-800">{c.nom}</span>}
            </div>
            {c.tel && <p className="text-xs text-gray-500 mt-0.5">📞 {c.tel}</p>}
            {c.mail && <p className="text-xs text-gray-500">✉ {c.mail}</p>}
            {c.observations && <p className="text-xs text-gray-400 italic mt-0.5">{c.observations}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(c); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-amber-200 rounded-lg p-3 space-y-2 bg-amber-50">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Service / spécialité</label>
              <SuggestInput value={form.service ?? ""} onChange={(v) => setForm((f) => ({ ...f, service: v }))} suggestions={SERVICES_SUIVIS} placeholder="Kiné, coach, salle..." className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nom</label>
              <input type="text" value={form.nom ?? ""} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Téléphone</label>
              <input type="tel" value={form.tel ?? ""} onChange={(e) => setForm((f) => ({ ...f, tel: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input type="email" value={form.mail ?? ""} onChange={(e) => setForm((f) => ({ ...f, mail: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-amber-400" />
            </div>
          </div>
          <input type="text" placeholder="Période / observations..." value={form.observations ?? ""} onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-amber-400" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-amber-500 text-white rounded-lg py-1.5 text-sm hover:bg-amber-600 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-amber-400 hover:text-amber-500 transition">+ Ajouter un suivi passé</button>
      )}
    </div>
  )
}

function ContactsSupplementairesList({ value, onChange }: { value: ContactSupplementaire[]; onChange: (v: ContactSupplementaire[]) => void }) {
  const empty: ContactSupplementaire = { label: "", nom: "", prenom: "", adresse: "", codePostal: "", ville: "", telephone: "", email: "" }
  const [form, setForm] = useState<ContactSupplementaire>(empty)
  const [open, setOpen] = useState(false)
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const submit = () => {
    if (!form.nom?.trim() && !form.prenom?.trim()) return
    if (editIdx !== null) { onChange(value.map((v, i) => (i === editIdx ? form : v))); setEditIdx(null) }
    else onChange([...value, form])
    setForm(empty); setOpen(false)
  }
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-lg border text-sm">
          <div className="flex-1 min-w-0">
            {c.label && <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium mb-0.5 inline-block">{c.label}</span>}
            <p className="font-medium text-gray-800">{[c.nom, c.prenom].filter(Boolean).join(" ")}</p>
            {(c.adresse || c.codePostal || c.ville) && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-start gap-1">
                <MapPinIcon className="w-3 h-3 mt-0.5 shrink-0" />
                {[c.adresse, [c.codePostal, c.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
              </p>
            )}
            {c.telephone && <p className="text-xs text-gray-500 flex items-center gap-1"><PhoneIcon className="w-3 h-3 shrink-0" />{c.telephone}</p>}
            {c.email && <p className="text-xs text-gray-500 flex items-center gap-1"><EnvelopeIcon className="w-3 h-3 shrink-0" />{c.email}</p>}
          </div>
          <div className="flex gap-0.5 shrink-0">
            <button type="button" onClick={() => { setForm(c); setEditIdx(i); setOpen(true) }} className="p-1 text-gray-400 hover:text-blue-600 transition"><PencilIcon className="w-3.5 h-3.5" /></button>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500 transition"><TrashIcon className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="border border-indigo-200 rounded-lg p-3 space-y-2 bg-indigo-50">
          <input type="text" placeholder="Libellé (ex : Employeur, Société, Conjoint…)" value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Nom *" value={form.nom ?? ""} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
            <input type="text" placeholder="Prénom" value={form.prenom ?? ""} onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <AdresseAutocomplete
            value={form.adresse ?? ""}
            onChange={(v) => setForm((f) => ({ ...f, adresse: v }))}
            onSelectFull={(data) => setForm((f) => ({ ...f, adresse: data.adresse, codePostal: data.code_postal, ville: data.ville }))}
            placeholder="Adresse de facturation…"
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" placeholder="Code postal" value={form.codePostal ?? ""} onChange={(e) => setForm((f) => ({ ...f, codePostal: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
            <input type="text" placeholder="Ville" value={form.ville ?? ""} onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="tel" placeholder="Téléphone" value={form.telephone ?? ""} onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
            <input type="email" placeholder="Email" value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="w-full border rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setOpen(false); setEditIdx(null); setForm(empty) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={submit} className="flex-1 bg-indigo-600 text-white rounded-lg py-1.5 text-sm hover:bg-indigo-700 transition">{editIdx !== null ? "Modifier" : "Ajouter"}</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setForm(empty); setOpen(true) }} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition">
          + Ajouter des coordonnées de facturation
        </button>
      )}
    </div>
  )
}

function WeeklyPlanningSlots({ value, onChange, dispoSlots, onDispoChange }: {
  value: Record<string, PlanningSlot[]>; onChange: (v: Record<string, PlanningSlot[]>) => void;
  dispoSlots: Record<string, string[]>; onDispoChange: (v: Record<string, string[]>) => void;
}) {
  const [dispoInput, setDispoInput] = useState<Record<string, string>>({})
  const addSlot = (jour: string) => onChange({ ...value, [jour]: [...(value[jour] ?? []), { activite: "", heureDebut: "", duree: "" }] })
  const removeSlot = (jour: string, idx: number) => {
    const slots = (value[jour] ?? []).filter((_, i) => i !== idx)
    const next = { ...value }
    if (slots.length) next[jour] = slots; else delete next[jour]
    onChange(next)
  }
  const updateSlot = (jour: string, idx: number, field: keyof PlanningSlot, val: string) =>
    onChange({ ...value, [jour]: (value[jour] ?? []).map((s, i) => i === idx ? { ...s, [field]: val } : s) })
  const addDispo = (jour: string) => {
    const txt = (dispoInput[jour] ?? "").trim()
    if (!txt) return
    onDispoChange({ ...dispoSlots, [jour]: [...(dispoSlots[jour] ?? []), txt] })
    setDispoInput((p) => ({ ...p, [jour]: "" }))
  }
  const removeDispo = (jour: string, idx: number) => {
    const next = { ...dispoSlots, [jour]: (dispoSlots[jour] ?? []).filter((_, i) => i !== idx) }
    if (!next[jour].length) delete next[jour]
    onDispoChange(next)
  }
  return (
    <div className="space-y-2">
      {JOURS_SEMAINE.map((jour) => (
        <div key={jour} className="border rounded-xl p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">{jour}</span>
            <button type="button" onClick={() => addSlot(jour)} className="text-xs text-blue-600 hover:text-blue-800 font-medium transition">+ Activité</button>
          </div>
          {(value[jour] ?? []).length === 0 && (dispoSlots[jour] ?? []).length === 0 && <p className="text-xs text-gray-400 italic">Repos</p>}
          {(value[jour] ?? []).map((slot, idx) => (
            <div key={idx} className="flex gap-1.5 mb-1.5 items-center flex-wrap">
              <input type="time" value={slot.heureDebut ?? ""} onChange={(e) => updateSlot(jour, idx, "heureDebut", e.target.value)} className="w-24 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white shrink-0" />
              <input type="text" placeholder="Activité (coaching, running...)" value={slot.activite} onChange={(e) => updateSlot(jour, idx, "activite", e.target.value)} className="flex-1 min-w-[120px] border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white" />
              <input type="text" placeholder="Durée" value={slot.duree ?? ""} onChange={(e) => updateSlot(jour, idx, "duree", e.target.value)} className="w-16 border rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-400 bg-white" />
              <button type="button" onClick={() => removeSlot(jour, idx)} className="p-1 text-gray-400 hover:text-red-500 transition shrink-0"><TrashIcon className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          {/* Dispo pour séance */}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1.5">Dispo pour séance</p>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {(dispoSlots[jour] ?? []).map((d, idx) => (
                <span key={idx} className="flex items-center gap-1 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                  {d}
                  <button type="button" onClick={() => removeDispo(jour, idx)} className="text-green-500 hover:text-red-500 transition leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Ex : 7h-9h, après 18h..."
                value={dispoInput[jour] ?? ""}
                onChange={(e) => setDispoInput((p) => ({ ...p, [jour]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDispo(jour) } }}
                className="flex-1 border rounded-lg px-2 py-1 text-xs outline-none focus:border-green-400 bg-white"
              />
              <button type="button" onClick={() => addDispo(jour)} className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg hover:bg-green-700 transition">+</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function NapCalculator({ onApply }: { onApply: (napId: string) => void }) {
  const [q, setQ] = useState({ travail: "", sportFreq: "", sportIntens: "", mvtQuotidien: "" })
  const [show, setShow] = useState(false)
  const result = q.travail && q.sportFreq && q.sportIntens && q.mvtQuotidien ? calcNap(q) : null

  if (!show) return (
    <button type="button" onClick={() => setShow(true)} className="w-full text-xs text-blue-600 border border-dashed border-blue-200 rounded-lg py-2 hover:bg-blue-50 transition">
      Calculer le NAP par questionnaire
    </button>
  )

  type Opt = { val: string; label: string }
  const Radio = ({ name, opts, selected, onSelect }: { name: string; opts: Opt[]; selected: string; onSelect: (v: string) => void }) => (
    <div className="space-y-1">
      {opts.map((o) => (
        <label key={o.val} className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="radio" name={name} checked={selected === o.val} onChange={() => onSelect(o.val)} className="accent-blue-600" />
          {o.label}
        </label>
      ))}
    </div>
  )

  return (
    <div className="border border-blue-200 rounded-xl p-4 space-y-4 bg-blue-50">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Calculateur NAP</p>
        <button type="button" onClick={() => setShow(false)} className="text-xs text-gray-400 hover:text-gray-600">Fermer</button>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1.5">1. Activité professionnelle :</p>
        <Radio name="nap_travail" selected={q.travail} onSelect={(v) => setQ((qq) => ({ ...qq, travail: v }))} opts={[
          { val: "sedentaire", label: "Sédentaire (bureau, télétravail)" },
          { val: "leger", label: "Légèrement actif (debout, déplacements)" },
          { val: "physique", label: "Travail physique (chantier, sport professionnel…)" },
        ]} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1.5">2. Fréquence d'exercice par semaine :</p>
        <Radio name="nap_freq" selected={q.sportFreq} onSelect={(v) => setQ((qq) => ({ ...qq, sportFreq: v }))} opts={[
          { val: "0", label: "Jamais / rarement" },
          { val: "1-2", label: "1 à 2 fois" },
          { val: "3-4", label: "3 à 4 fois" },
          { val: "5+", label: "5 fois ou plus" },
        ]} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1.5">3. Intensité des séances :</p>
        <Radio name="nap_intens" selected={q.sportIntens} onSelect={(v) => setQ((qq) => ({ ...qq, sportIntens: v }))} opts={[
          { val: "leger", label: "Légère (marche, yoga, étirements)" },
          { val: "modere", label: "Modérée (vélo, natation, fitness)" },
          { val: "intense", label: "Intense (HIIT, course rapide, sports collectifs)" },
        ]} />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-700 mb-1.5">4. Activité quotidienne hors sport :</p>
        <Radio name="nap_mvt" selected={q.mvtQuotidien} onSelect={(v) => setQ((qq) => ({ ...qq, mvtQuotidien: v }))} opts={[
          { val: "peu", label: "Très sédentaire (voiture, ascenseur…)" },
          { val: "moyen", label: "Modérée (marche ~30 min/j)" },
          { val: "beaucoup", label: "Importante (vélo, marche >1h/j)" },
        ]} />
      </div>
      {result && (() => {
        const cat = NAP_CATEGORIES.find((n) => n.id === result)!
        return (
          <div className="bg-white rounded-xl p-3 border border-blue-200">
            <p className="text-xs text-gray-500 mb-0.5">Résultat suggéré :</p>
            <p className="text-sm font-semibold text-blue-700">{cat.label} <span className="font-normal text-gray-400">× {cat.coef}</span></p>
            <p className="text-xs text-gray-400 mt-0.5">{cat.desc}</p>
            <button type="button" onClick={() => { onApply(result); setShow(false) }}
              className="mt-2 w-full bg-blue-600 text-white text-xs rounded-lg py-1.5 hover:bg-blue-700 transition">
              Appliquer ce NAP
            </button>
          </div>
        )
      })()}
    </div>
  )
}

function getNoteTypeStyle(type: string) {
  switch (type) {
    case "Alerte": return { card: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700" }
    case "Bilan": return { card: "bg-sky-50 border-sky-200", badge: "bg-sky-100 text-sky-700" }
    case "Objectif": return { card: "bg-green-50 border-green-200", badge: "bg-green-100 text-green-700" }
    case "Observation": return { card: "bg-orange-50 border-orange-200", badge: "bg-orange-100 text-orange-700" }
    case "Absence/Vacances": return { card: "bg-purple-50 border-purple-200", badge: "bg-purple-100 text-purple-700" }
    default: return { card: "bg-gray-50 border-gray-200", badge: "bg-gray-100 text-gray-500" }
  }
}

function DecouverteSelector({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [custom, setCustom] = useState("")
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((x) => x !== opt) : [...value, opt])
  const addCustom = () => {
    const v = custom.trim()
    if (!v || value.includes(v)) { setCustom(""); return }
    onChange([...value, v])
    setCustom("")
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {DECOUVERTE_OPTIONS.map((opt) => (
          <button key={opt} type="button"
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              value.includes(opt)
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
            }`}>
            {opt}
          </button>
        ))}
      </div>
      {value.filter((v) => !DECOUVERTE_OPTIONS.includes(v)).map((v) => (
        <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-600 text-white border border-blue-600 mr-1.5">
          {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-blue-200">✕</button>
        </span>
      ))}
      <div className="flex gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom() } }}
          placeholder="Autre source…"
          className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim()}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition">
          +
        </button>
      </div>
    </div>
  )
}

function ClientNotesPanel({ clientId, linkedUserId, pendingNotes, onPendingChange }: {
  clientId: string | null; linkedUserId?: string
  pendingNotes?: Array<{ texte: string; type_note: string; date_max?: string }>
  onPendingChange?: (notes: Array<{ texte: string; type_note: string; date_max?: string }>) => void
}) {
  const { notes, loading, addNote, deleteNote } = useClientNotes(clientId ?? undefined, linkedUserId)
  const [addingNote, setAddingNote] = useState(false)
  const [noteForm, setNoteForm] = useState({ texte: "", type_note: "Observation", date_max: "", customType: "" })

  if (!clientId) {
    const pending = pendingNotes ?? []
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-400 italic">Ces notes seront enregistrées à la création du client.</p>
        {pending.map((n, i) => (
          <div key={i} className={`rounded-xl border p-3 ${getNoteTypeStyle(n.type_note).card}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${getNoteTypeStyle(n.type_note).badge}`}>{n.type_note}</span>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{n.texte}</p>
              </div>
              <button type="button" onClick={() => onPendingChange?.(pending.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {addingNote ? (
          <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
            <select value={noteForm.type_note} onChange={(e) => setNoteForm((f) => ({ ...f, type_note: e.target.value, customType: "" }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
              {["Observation", "Alerte", "Bilan", "Objectif", "Absence/Vacances", "Autre"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {noteForm.type_note === "Autre" && (
              <input type="text" placeholder="Type personnalisé..." value={noteForm.customType} onChange={(e) => setNoteForm((f) => ({ ...f, customType: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            )}
            <textarea rows={3} placeholder="Contenu de la note..." value={noteForm.texte} onChange={(e) => setNoteForm((f) => ({ ...f, texte: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expiration (optionnel)</label>
              <input type="date" value={noteForm.date_max} onChange={(e) => setNoteForm((f) => ({ ...f, date_max: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setAddingNote(false); setNoteForm({ texte: "", type_note: "Observation", date_max: "", customType: "" }) }} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
              <button type="button" onClick={() => {
                if (!noteForm.texte.trim()) return
                const finalType = noteForm.type_note === "Autre" && noteForm.customType.trim() ? noteForm.customType.trim() : noteForm.type_note
                onPendingChange?.([...pending, { texte: noteForm.texte, type_note: finalType, date_max: noteForm.date_max || undefined }])
                setNoteForm({ texte: "", type_note: "Observation", date_max: "", customType: "" }); setAddingNote(false)
              }} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">Ajouter</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingNote(true)} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter une note</button>
        )}
      </div>
    )
  }

  const handleAdd = async () => {
    if (!noteForm.texte.trim()) return
    const finalType = noteForm.type_note === "Autre" && noteForm.customType.trim() ? noteForm.customType.trim() : noteForm.type_note
    await addNote({
      ref_client: clientId,
      ...(linkedUserId ? { ref_users: doc(db, "users", linkedUserId) } : {}),
      notes: noteForm.texte,
      type_note: finalType,
      date_create: Timestamp.now(),
      date_max_note_active: noteForm.date_max ? Timestamp.fromDate(new Date(noteForm.date_max)) : null,
    } as any)
    setNoteForm({ texte: "", type_note: "Observation", date_max: "", customType: "" }); setAddingNote(false)
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="h-8 bg-gray-100 rounded animate-pulse" />
      ) : notes.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Aucune note pour ce client.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {notes.map((note) => {
            const s = getNoteTypeStyle(note.type_note)
            const expired = note.date_max_note_active ? (note.date_max_note_active as any).toDate() < new Date() : false
            return (
              <div key={note.id} className={`rounded-xl border p-3 ${expired ? "bg-white border-gray-200" : s.card}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${expired ? "bg-gray-100 text-gray-500" : s.badge}`}>{note.type_note}</span>
                      {note.date_create && <span className="text-xs text-gray-400">{(note.date_create as any).toDate().toLocaleDateString("fr-FR")}</span>}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.notes}</p>
                  </div>
                  <button type="button" onClick={() => deleteNote(note.id)} className="p-1 text-gray-400 hover:text-red-500 transition shrink-0"><TrashIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {addingNote ? (
        <div className="border border-blue-200 rounded-lg p-3 space-y-2 bg-blue-50">
          <select value={noteForm.type_note} onChange={(e) => setNoteForm((f) => ({ ...f, type_note: e.target.value, customType: "" }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400">
            {["Observation", "Alerte", "Bilan", "Objectif", "Absence/Vacances", "Autre"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {noteForm.type_note === "Autre" && (
            <input type="text" placeholder="Type personnalisé..." value={noteForm.customType} onChange={(e) => setNoteForm((f) => ({ ...f, customType: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          )}
          <textarea rows={3} placeholder="Contenu de la note..." value={noteForm.texte} onChange={(e) => setNoteForm((f) => ({ ...f, texte: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Expiration (optionnel)</label>
            <input type="date" value={noteForm.date_max} onChange={(e) => setNoteForm((f) => ({ ...f, date_max: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm outline-none focus:border-blue-400" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setAddingNote(false)} className="flex-1 border rounded-lg py-1.5 text-sm text-gray-600 hover:bg-gray-100 transition">Annuler</button>
            <button type="button" onClick={handleAdd} className="flex-1 bg-blue-600 text-white rounded-lg py-1.5 text-sm hover:bg-blue-700 transition">Ajouter</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAddingNote(true)} className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">+ Ajouter une note</button>
      )}
    </div>
  )
}

// ── Main ClientEditModal ──────────────────────────────────────────────────────

interface ClientEditModalProps {
  client: Client | null
  isOpen: boolean
  onClose: () => void
  onSaved?: () => void
  isSC?: boolean
}

export default function ClientEditModal({ client, isOpen, onClose, onSaved, isSC = false }: ClientEditModalProps) {
  const { currentUser, userProfile } = useAuth()
  const [form, setForm] = useState<ClientForm>(EMPTY_CLIENT)
  const [saving, setSaving] = useState(false)
  const [siretLoading, setSiretLoading] = useState(false)
  const [showEntreprise, setShowEntreprise] = useState(false)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState<FormTab>("identite")
  const [calcDistance, setCalcDistance] = useState(false)

  const setF = (f: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [f]: e.target.value }))

  useEffect(() => {
    if (!isOpen) return
    setError(""); setActiveTab("identite")
    if (!client) {
      setForm(EMPTY_CLIENT); setShowEntreprise(false); return
    }
    const cc = client as any
    let materielItems: MaterialItem[] = Array.isArray(cc.materielItems) ? cc.materielItems
      : cc.materielMaison ? [{ nom: cc.materielMaisonDetail || "Non précisé" }] : []
    let structureItems: StructureItem[] = Array.isArray(cc.structureItems) ? cc.structureItems
      : cc.structureRemiseForme ? [{ nom: cc.structureRemiseFormeDetail || "Non précisé" }] : []
    let autreCoachItems: AutreCoachItem[] = Array.isArray(cc.autreCoachItems) ? cc.autreCoachItems
      : cc.autreCoach ? [{ service: cc.autreCoachService, nom: cc.autreCoachNom, tel: cc.autreCoachTel, mail: cc.autreCoachMail }] : []
    let planningSlots: Record<string, PlanningSlot[]> = {}
    if (cc.planningSlots && typeof cc.planningSlots === "object") {
      planningSlots = cc.planningSlots
    } else if (cc.planningType && typeof cc.planningType === "object") {
      Object.entries(cc.planningType as Record<string, string>).forEach(([day, val]) => {
        if (val) planningSlots[day] = [{ activite: val, duree: "" }]
      })
    }
    let antecedentsMedicaux: AntecedentMedical[] = Array.isArray(cc.antecedentsMedicaux) ? cc.antecedentsMedicaux : []
    if (Array.isArray(cc.contraindicationsList)) {
      const existing = new Set(antecedentsMedicaux.map((a) => a.description))
      cc.contraindicationsList.forEach((ci: any) => {
        if (!existing.has(ci.description)) antecedentsMedicaux.push({ description: ci.description, anneeDebut: ci.annee, cote: ci.cote, estContreIndication: true })
      })
    }
    setForm({
      prenom: client.prenom ?? "", nom: client.nom ?? "", email: client.email ?? "", indicatif_tel: (client as any).indicatif_tel ?? "+33", telephone: client.telephone ?? "", genre: (client as any).genre ?? "",
      dateNaissance: toDateInput(client.dateNaissance ?? null), adresse: client.adresse ?? "",
      ville: client.ville ?? "", codePostal: client.codePostal ?? "", profession: client.profession ?? "",
      sportPratique: client.sportPratique ?? "", niveauSportif: client.niveauSportif ?? "", actif: client.actif,
      siret: cc.siret ?? "", nomEntreprise: cc.nomEntreprise ?? "", adresseEntreprise: cc.adresseEntreprise ?? "",
      objectifs: cc.objectifs ?? [], antecedentsMedicaux, antecedentsSportifs: cc.antecedentsSportifs ?? [],
      materielItems, structureItems, autreCoachItems, suivisPassesItems: cc.suivisPassesItems ?? [],
      contactUrgenceNom: client.contactUrgenceNom ?? "", contactUrgenceTel: client.contactUrgenceTel ?? "", contactUrgenceRelation: cc.contactUrgenceRelation ?? "",
      lieuSeance: cc.lieuSeance ?? "", lieuSeanceLat: cc.lieuSeanceLat ?? null, lieuSeanceLng: cc.lieuSeanceLng ?? null,
      distanceKm: cc.distanceKm ?? null, tempsRouteSeance: cc.tempsRouteSeance ?? "",
      nbSeancesMin: cc.nbSeancesMin?.toString() ?? cc.nbSeancesParSemaine?.toString() ?? "",
      nbSeancesMax: cc.nbSeancesMax?.toString() ?? "",
      planningSlots, planningDispoSlots: cc.planningDispoSlots ?? {},
      joursTravail: cc.joursTravail ?? [], positionTravail: cc.positionTravail ?? "", tempsRouteTravail: cc.tempsRouteTravail ?? "", tempsTravailSemaine: cc.tempsTravailSemaine ?? "",
      napCategorie: cc.napCategorie ?? "",
      decouverte: Array.isArray(cc.decouverte) ? cc.decouverte : cc.decouverte ? [cc.decouverte] : [],
      pendingNotes: [],
      contactsSupplementaires: Array.isArray(cc.contactsSupplementaires) ? cc.contactsSupplementaires : [],
    })
    setShowEntreprise(!!(cc.siret || cc.nomEntreprise || cc.adresseEntreprise))
  }, [isOpen, client?.id])

  useEffect(() => {
    const clean = form.siret.replace(/[\s.]/g, "")
    if (clean.length !== 14) { setSiretLoading(false); return }
    let cancelled = false
    setSiretLoading(true)
    lookupSiret(clean).then((r) => {
      if (cancelled) return
      setSiretLoading(false)
      if (r) setForm((p) => ({ ...p, nomEntreprise: p.nomEntreprise || r.nom || "", adresseEntreprise: p.adresseEntreprise || r.adresse || "" }))
    })
    return () => { cancelled = true }
  }, [form.siret])

  const handleCalculateDistance = async () => {
    if (!form.lieuSeanceLat || !form.lieuSeanceLng) return
    setCalcDistance(true)
    try {
      const coachAddr = (userProfile as any)?.adresse_postale || (userProfile as any)?.rue_adresse
      if (!coachAddr) throw new Error("Adresse coach introuvable (configurez votre profil)")
      const coachCoords = await geocodeAddress(coachAddr)
      if (!coachCoords) throw new Error("Impossible de géolocaliser l'adresse du coach")
      const { distanceKm, duration } = await calculateRoute(coachCoords.lat, coachCoords.lng, form.lieuSeanceLat, form.lieuSeanceLng)
      setForm((f) => ({ ...f, distanceKm, tempsRouteSeance: duration }))
    } catch (e: any) {
      alert(e.message ?? "Erreur lors du calcul de la distance")
    } finally {
      setCalcDistance(false)
    }
  }

  const handleSubmit = async () => {
    if (!(form.nom ?? "").trim()) return setError("Le nom est requis.")
    setSaving(true)
    try {
      const f = form
      const data: any = {
        userId: currentUser!.uid,
        prenom: (f.prenom ?? "").trim(), nom: (f.nom ?? "").trim(),
        email: f.email || undefined, indicatif_tel: f.indicatif_tel || undefined, telephone: f.telephone || undefined, genre: f.genre || undefined,
        dateNaissance: fromDateInput(f.dateNaissance),
        adresse: f.adresse || undefined, ville: f.ville || undefined, codePostal: f.codePostal || undefined,
        profession: f.profession || undefined, sportPratique: f.sportPratique || undefined, niveauSportif: f.niveauSportif || undefined,
        actif: f.actif,
        siret: f.siret || undefined, nomEntreprise: f.nomEntreprise || undefined, adresseEntreprise: f.adresseEntreprise || undefined,
        objectifs: f.objectifs.length ? f.objectifs : undefined,
        antecedentsMedicaux: f.antecedentsMedicaux.length ? f.antecedentsMedicaux : undefined,
        antecedentsSportifs: f.antecedentsSportifs.length ? f.antecedentsSportifs : undefined,
        materielItems: f.materielItems.length ? f.materielItems : undefined,
        structureItems: f.structureItems.length ? f.structureItems : undefined,
        autreCoachItems: f.autreCoachItems.length ? f.autreCoachItems : undefined,
        suivisPassesItems: f.suivisPassesItems.length ? f.suivisPassesItems : undefined,
        contactUrgenceNom: f.contactUrgenceNom || undefined, contactUrgenceTel: f.contactUrgenceTel || undefined, contactUrgenceRelation: f.contactUrgenceRelation || undefined,
        lieuSeance: f.lieuSeance || undefined, lieuSeanceLat: f.lieuSeanceLat ?? undefined, lieuSeanceLng: f.lieuSeanceLng ?? undefined,
        distanceKm: f.distanceKm ?? undefined, tempsRouteSeance: f.tempsRouteSeance || undefined,
        nbSeancesMin: f.nbSeancesMin ? Number(f.nbSeancesMin) : undefined,
        nbSeancesMax: f.nbSeancesMax ? Number(f.nbSeancesMax) : undefined,
        planningSlots: Object.keys(f.planningSlots).length ? f.planningSlots : undefined,
        planningDispoSlots: Object.keys(f.planningDispoSlots).length ? f.planningDispoSlots : undefined,
        joursTravail: f.joursTravail.length ? f.joursTravail : undefined,
        positionTravail: f.positionTravail || undefined, tempsRouteTravail: f.tempsRouteTravail || undefined, tempsTravailSemaine: f.tempsTravailSemaine || undefined,
        napCategorie: f.napCategorie || undefined,
        decouverte: f.decouverte.length ? f.decouverte : undefined,
        contactsSupplementaires: f.contactsSupplementaires.length ? f.contactsSupplementaires : undefined,
      }
      if (client) {
        await updateClient(client.id, data)
      } else {
        const { id: newId } = await createClient(data)
        if (newId && f.pendingNotes.length) {
          await Promise.all(f.pendingNotes.map((n) => addDoc(collection(db, "notes_historique"), {
            ref_client: newId, notes: n.texte, type_note: n.type_note, date_create: Timestamp.now(),
            date_max_note_active: n.date_max ? Timestamp.fromDate(new Date(n.date_max)) : null,
          })))
        }
      }
      onClose(); onSaved?.()
    } catch (e) {
      console.error("[ClientEditModal]", e)
      setError("Erreur lors de l'enregistrement.")
    } finally { setSaving(false) }
  }

  // Lock body scroll when modal is open to prevent iOS pan/rubber-band on modal
  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" style={{ touchAction: 'none' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[92vh]" style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' } as React.CSSProperties}>
        {/* Header sticky */}
        <div className="px-4 sm:px-6 pt-5 sm:pt-6 pb-0 border-b shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{client ? "Modifier le client" : "Nouveau client"}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="flex overflow-x-auto gap-1 -mb-px">
            {FORM_TABS_ALL.filter((t) => !isSC || !t.scHidden).map((t) => (
              <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                className={`shrink-0 px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition whitespace-nowrap ${activeTab === t.key ? "border-blue-600 text-blue-700 bg-blue-50" : "border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body scrollable */}
        <div className="overflow-y-auto overflow-x-hidden flex-1 px-4 sm:px-6 py-4 sm:py-5" style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' } as React.CSSProperties}>
          <div className="space-y-5">

            {/* ── TAB: IDENTITÉ ── */}
            {activeTab === "identite" && <>
              <Section title="Identité">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Prénom"><input className={inputCls} placeholder="Jean (optionnel pour sociétés)" value={form.prenom ?? ""} onChange={(e) => setForm((p) => ({ ...p, prenom: toProperName(e.target.value) }))} /></Field>
                  <Field label="Nom *"><input className={inputCls} placeholder="DUPONT ou nom de la société" value={form.nom ?? ""} onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value.toUpperCase() }))} /></Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Email"><input type="email" className={inputCls} value={form.email} onChange={setF("email")} /></Field>
                  <Field label="Téléphone">
                    <PhoneInput
                      indicatif={form.indicatif_tel}
                      telephone={form.telephone}
                      onIndicatifChange={(v) => setForm((p) => ({ ...p, indicatif_tel: v }))}
                      onTelephoneChange={(v) => setForm((p) => ({ ...p, telephone: v }))}
                      inputClassName={inputCls}
                      selectClassName="border rounded-lg px-2 py-2.5 text-sm outline-none focus:border-blue-400 bg-white shrink-0 w-[5.5rem]"
                    />
                  </Field>
                </div>
                <Field label="Genre">
                  <div className="flex gap-2">
                    {['Homme', 'Femme'].map((g) => (
                      <button key={g} type="button"
                        onClick={() => setForm((p) => ({ ...p, genre: p.genre === g ? '' : g }))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${form.genre === g ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                        {g}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Date de naissance"><input type="date" className={`${inputCls} min-w-0`} style={{ minWidth: 0 }} value={form.dateNaissance} onChange={setF("dateNaissance")} /></Field>
                  <Field label="Profession">
                    <SuggestInput className={inputCls} placeholder="Ex : Ingénieur" value={form.profession} onChange={(v) => setForm((p) => ({ ...p, profession: v }))} suggestions={PROFESSIONS} />
                  </Field>
                </div>
              </Section>

              <Section title="Découverte">
                <Field label="Comment a-t-il/elle découvert vos services ?">
                  <DecouverteSelector
                    value={form.decouverte}
                    onChange={(v) => setForm((p) => ({ ...p, decouverte: v }))}
                  />
                </Field>
              </Section>

              <Section title="Adresse">
                <Field label="Rue">
                  <AdresseAutocomplete
                    value={form.adresse}
                    onChange={(v) => setForm((p) => ({ ...p, adresse: v }))}
                    onSelectFull={(data) => setForm((p) => ({
                      ...p, adresse: data.adresse, ville: data.ville, codePostal: data.code_postal,
                      lieuSeance: p.lieuSeance || data.label,
                      lieuSeanceLat: p.lieuSeance ? p.lieuSeanceLat : (data.lat ?? null),
                      lieuSeanceLng: p.lieuSeance ? p.lieuSeanceLng : (data.lng ?? null),
                    }))}
                    placeholder="123 rue de la Paix"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Code postal"><input className={inputCls} value={form.codePostal} onChange={setF("codePostal")} /></Field>
                  <Field label="Ville"><input className={inputCls} value={form.ville} onChange={setF("ville")} /></Field>
                </div>
              </Section>

              <Section title="Coordonnées de facturation alternatives">
                <p className="text-xs text-gray-400 -mt-1">Employeur, conjoint, société… à sélectionner lors de la création d'une facture.</p>
                <ContactsSupplementairesList
                  value={form.contactsSupplementaires}
                  onChange={(v) => setForm((p) => ({ ...p, contactsSupplementaires: v }))}
                />
              </Section>

              <Section title="Entreprise">
                {!showEntreprise ? (
                  <button type="button" onClick={() => setShowEntreprise(true)}
                    className="w-full border border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition">
                    + Ajouter des informations entreprise
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="SIRET">
                        <input className={inputCls} placeholder="123 456 789 00012" value={form.siret}
                          onChange={(e) => setForm((p) => ({ ...p, siret: e.target.value }))} />
                      </Field>
                      <Field label="Nom de l'entreprise">
                        <input className={inputCls} value={form.nomEntreprise} onChange={setF("nomEntreprise")}
                          placeholder={siretLoading ? "Recherche en cours…" : form.siret.replace(/[\s.]/g, "").length === 14 && !form.nomEntreprise ? "Non diffusible / introuvable" : ""} />
                      </Field>
                    </div>
                    <Field label="Adresse de l'entreprise">
                      <AdresseAutocomplete value={form.adresseEntreprise} onChange={(v) => setForm((p) => ({ ...p, adresseEntreprise: v }))} onSelectFull={(data) => setForm((p) => ({ ...p, adresseEntreprise: data.label }))} placeholder="Adresse du siège..." />
                    </Field>
                    <button type="button" onClick={() => { setShowEntreprise(false); setForm((p) => ({ ...p, siret: "", nomEntreprise: "", adresseEntreprise: "" })) }}
                      className="text-xs text-gray-400 hover:text-red-500 transition">
                      Retirer les informations entreprise
                    </button>
                  </div>
                )}
              </Section>

              <Section title="Statut compte">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Client actif</div>
                    <div className="text-xs text-gray-400">Désactiver pour archiver sans supprimer</div>
                  </div>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, actif: !f.actif }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.actif ? "bg-blue-600" : "bg-gray-200"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.actif ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              </Section>
            </>}

            {/* ── TAB: SPORT & OBJECTIFS ── */}
            {activeTab === "sport" && <>
              <Section title="Profil sportif">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Sport pratiqué">
                    <SuggestInput className={inputCls} placeholder="Ex : Running, CrossFit" value={form.sportPratique} onChange={(v) => setForm((p) => ({ ...p, sportPratique: v }))} suggestions={SPORTS} />
                  </Field>
                  <Field label="Niveau">
                    <select className={inputCls} value={form.niveauSportif} onChange={setF("niveauSportif")}>
                      <option value="">— Sélectionner —</option>
                      {NIVEAUX.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                </div>
              </Section>
              <Section title="Antécédents sportifs">
                <AntecedentsSportifsList value={form.antecedentsSportifs} onChange={(v) => setForm((p) => ({ ...p, antecedentsSportifs: v }))} />
              </Section>
              <Section title="Objectifs">
                <ObjectifsList value={form.objectifs} onChange={(v) => setForm((p) => ({ ...p, objectifs: v }))} />
              </Section>
              <Section title="Matériel de remise en forme">
                <MaterialItemsList value={form.materielItems} onChange={(v) => setForm((p) => ({ ...p, materielItems: v }))} />
              </Section>
              <Section title="Structures de remise en forme">
                <StructureItemsList value={form.structureItems} onChange={(v) => setForm((p) => ({ ...p, structureItems: v }))} />
              </Section>
              <Section title="Autres suivis (kiné, prépa mentale…)">
                <AutreCoachList value={form.autreCoachItems} onChange={(v) => setForm((p) => ({ ...p, autreCoachItems: v }))} />
              </Section>
              <Section title="Suivis déjà réalisés (anciens coachs, salles, nutritionnistes…)">
                <p className="text-xs text-gray-400 -mt-1 mb-2">Suivis ou accès qui ne sont plus actifs actuellement.</p>
                <SuivisPassesList value={form.suivisPassesItems} onChange={(v) => setForm((p) => ({ ...p, suivisPassesItems: v }))} />
              </Section>
            </>}

            {/* ── TAB: SANTÉ ── */}
            {activeTab === "sante" && <>
              <Section title="Antécédents médicaux & Contre-indications">
                <p className="text-xs text-gray-400 -mt-1 mb-2">Incluez ici blessures, maladies chroniques et contre-indications. Cochez « contre-indication » si l'élément limite les exercices.</p>
                <AntecedentsMedicauxList value={form.antecedentsMedicaux} onChange={(v) => setForm((p) => ({ ...p, antecedentsMedicaux: v }))} />
              </Section>
            </>}

            {/* ── TAB: CONDITIONS ── */}
            {activeTab === "conditions" && <>
              <Section title="Séances">
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Séances / semaine</label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-xs text-gray-500 shrink-0">Min</span>
                      <input type="number" min={1} max={14} className={inputCls} value={form.nbSeancesMin} onChange={setF("nbSeancesMin")} placeholder="—" />
                    </div>
                    <span className="text-gray-300 shrink-0">–</span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-xs text-gray-500 shrink-0">Max</span>
                      <input type="number" min={1} max={14} className={inputCls} value={form.nbSeancesMax} onChange={setF("nbSeancesMax")} placeholder="—" />
                    </div>
                  </div>
                </div>
                <Field label="Lieu de séance">
                  <div className="space-y-1.5">
                    <AdresseAutocomplete value={form.lieuSeance} onChange={(v) => setForm((p) => ({ ...p, lieuSeance: v }))} onSelectFull={(data) => setForm((p) => ({ ...p, lieuSeance: data.label, lieuSeanceLat: data.lat ?? null, lieuSeanceLng: data.lng ?? null }))} placeholder="Adresse du lieu de séance..." />
                    {form.adresse && !form.lieuSeance && (
                      <button type="button" onClick={() => setForm((p) => ({ ...p, lieuSeance: p.adresse, lieuSeanceLat: null, lieuSeanceLng: null }))}
                        className="text-xs text-blue-600 hover:text-blue-800 transition">
                        Utiliser l'adresse personnelle ({form.adresse})
                      </button>
                    )}
                  </div>
                </Field>
                {form.lieuSeanceLat && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handleCalculateDistance} disabled={calcDistance}
                      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition disabled:opacity-60">
                      {calcDistance ? "Calcul en cours..." : "📍 Calculer la distance"}
                    </button>
                    {form.distanceKm != null && (
                      <span className="text-sm text-gray-700">
                        <span className="font-semibold">{form.distanceKm} km</span>
                        {form.tempsRouteSeance && <span className="text-gray-400"> · {form.tempsRouteSeance}</span>}
                      </span>
                    )}
                  </div>
                )}
              </Section>
              <Section title="Planning type hebdomadaire">
                <p className="text-xs text-gray-400 -mt-1 mb-2">Indiquez toutes les activités prévues sur la semaine type, pas uniquement les séances avec vous.</p>
                <WeeklyPlanningSlots value={form.planningSlots} onChange={(v) => setForm((p) => ({ ...p, planningSlots: v }))} dispoSlots={form.planningDispoSlots} onDispoChange={(v) => setForm((p) => ({ ...p, planningDispoSlots: v }))} />
              </Section>
              <Section title="Niveau d'Activité Physique (NAP)">
                <p className="text-xs text-gray-400 -mt-1 mb-2">Le NAP est un coefficient multiplicateur utilisé pour estimer les besoins énergétiques réels du client.</p>
                <div className="space-y-1.5 mb-3">
                  {NAP_CATEGORIES.map((n) => (
                    <button key={n.id} type="button" onClick={() => setForm((p) => ({ ...p, napCategorie: p.napCategorie === n.id ? "" : n.id }))}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition ${form.napCategorie === n.id ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-gray-200 hover:border-blue-300"}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={`text-sm font-medium ${form.napCategorie === n.id ? "text-white" : "text-gray-800"}`}>{n.label}</span>
                          <p className={`text-xs mt-0.5 ${form.napCategorie === n.id ? "text-blue-100" : "text-gray-400"}`}>{n.desc}</p>
                        </div>
                        <span className={`text-sm font-bold shrink-0 ml-2 ${form.napCategorie === n.id ? "text-white" : "text-gray-500"}`}>× {n.coef}</span>
                      </div>
                    </button>
                  ))}
                </div>
                <NapCalculator onApply={(id) => setForm((p) => ({ ...p, napCategorie: id }))} />
              </Section>
              <Section title="Conditions de travail">
                {form.profession && (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700 -mt-1 mb-1">
                    <span className="font-medium">Profession :</span>
                    <span>{form.profession}</span>
                  </div>
                )}
                <Field label="Jours travaillés">
                  <div className="flex flex-wrap gap-1.5">
                    {JOURS_TRAVAIL.map((j) => (
                      <button key={j} type="button"
                        onClick={() => setForm((p) => ({ ...p, joursTravail: p.joursTravail.includes(j) ? p.joursTravail.filter((x) => x !== j) : [...p.joursTravail, j] }))}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${form.joursTravail.includes(j) ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                        {j === "Variable" ? "Variable" : j.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Position au travail">
                    <select className={inputCls} value={form.positionTravail} onChange={setF("positionTravail")}>
                      <option value="">— Sélectionner —</option>
                      {POSITIONS_TRAVAIL.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field label="Temps de route (A/R)"><input className={inputCls} placeholder="Ex : 30 min" value={form.tempsRouteTravail} onChange={setF("tempsRouteTravail")} /></Field>
                </div>
                <Field label="Temps de travail moyen / semaine"><input className={inputCls} placeholder="Ex : 40h, 35h..." value={form.tempsTravailSemaine} onChange={setF("tempsTravailSemaine")} /></Field>
              </Section>
            </>}

            {/* ── TAB: NOTES & URGENCE ── */}
            {activeTab === "notes" && <>
              {!isSC && (
                <Section title="Contact d'urgence">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Nom"><input className={inputCls} placeholder="Marie Dupont" value={form.contactUrgenceNom} onChange={setF("contactUrgenceNom")} /></Field>
                    <Field label="Téléphone"><input type="tel" className={inputCls} value={form.contactUrgenceTel} onChange={setF("contactUrgenceTel")} /></Field>
                  </div>
                  <Field label="Relation">
                    <select className={inputCls} value={form.contactUrgenceRelation} onChange={setF("contactUrgenceRelation")}>
                      <option value="">— Sélectionner —</option>
                      {RELATIONS_URGENCE.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                </Section>
              )}
              <Section title="Notes internes">
                <ClientNotesPanel
                  clientId={client?.id ?? null}
                  linkedUserId={client?.linkedUserId}
                  pendingNotes={form.pendingNotes}
                  onPendingChange={(n) => setForm((p) => ({ ...p, pendingNotes: n }))}
                />
              </Section>
            </>}

          </div>

          {error && <ErrBox msg={error} />}
          <ModalActions onCancel={onClose} onSubmit={handleSubmit} saving={saving} label={client ? "Enregistrer" : "Créer"} />
        </div>
      </div>
    </div>
  )
}
