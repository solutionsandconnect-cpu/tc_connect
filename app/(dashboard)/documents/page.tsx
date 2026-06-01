'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/context/AuthContext'
import { useUsers } from '@/hooks/useUsers'
import { useRouter } from 'next/navigation'
import { uploadImage, deleteImage } from '@/lib/uploadImage'
import {
  FolderOpenIcon, DocumentTextIcon, ArrowTopRightOnSquareIcon,
  ClipboardDocumentListIcon, ArrowRightIcon, MagnifyingGlassIcon,
  ArrowUpTrayIcon, TrashIcon, ShareIcon,
} from '@heroicons/react/24/outline'
import type { FactureStatus, FactureType } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type DocCategory = 'facturation' | 'questionnaire' | 'shared'

interface BaseDoc {
  id: string
  category: DocCategory
  title: string
  date: number
  dateLabel: string
}

interface FactureDoc extends BaseDoc {
  category: 'facturation'
  docType: FactureType
  status: FactureStatus
  total: number
  pdfUrl: string
}

interface QuestionnaireDoc extends BaseDoc {
  category: 'questionnaire'
  planningId: string
  indiceHooper?: number
}

interface SharedDoc extends BaseDoc {
  category: 'shared'
  fileUrl: string
  uploadedBy: string
}

type AnyDoc = FactureDoc | QuestionnaireDoc | SharedDoc

type TabKey = 'tous' | DocCategory

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<FactureStatus, string> = {
  draft: 'Brouillon', pending: 'En attente', sent: 'Envoyé', paid: 'Payée',
  overdue: 'En retard', cancelled: 'Annulée', accepted: 'Accepté', rejected: 'Non validé',
}
const STATUS_COLOR: Record<FactureStatus, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-orange-100 text-orange-700',
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMoney(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

function toMs(ts: any): number {
  if (!ts) return 0
  if (ts?.seconds) return ts.seconds * 1000
  if (ts instanceof Date) return ts.getTime()
  return 0
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FactureCard({ doc: d }: { doc: FactureDoc }) {
  return (
    <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-blue-200 hover:shadow-sm transition">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${d.docType === 'facture' ? 'bg-blue-50' : 'bg-purple-50'}`}>
        <DocumentTextIcon className={`w-5 h-5 ${d.docType === 'facture' ? 'text-blue-500' : 'text-purple-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{d.title}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[d.status]}`}>
            {STATUS_LABEL[d.status]}
          </span>
          <span className="text-xs text-gray-400">{d.docType === 'facture' ? 'Facture' : 'Devis'}</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{d.dateLabel}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-gray-900">{fmtMoney(d.total)}</span>
        <a
          href={d.pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Télécharger le PDF"
          className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition"
          onClick={(e) => e.stopPropagation()}
        >
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          PDF
        </a>
      </div>
    </div>
  )
}

function QuestionnaireCard({ doc: d, router }: { doc: QuestionnaireDoc; router: ReturnType<typeof useRouter> }) {
  const hooperColor = d.indiceHooper == null ? 'text-gray-400'
    : d.indiceHooper <= 12 ? 'text-green-600'
    : d.indiceHooper <= 18 ? 'text-orange-500'
    : 'text-red-600'

  return (
    <button
      onClick={() => router.push(`/questionnaire/${d.planningId}`)}
      className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-blue-200 hover:shadow-sm transition group text-left"
    >
      <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
        <ClipboardDocumentListIcon className="w-5 h-5 text-teal-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{d.title}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 text-teal-700">
            Questionnaire de forme
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <p className="text-xs text-gray-400">{d.dateLabel}</p>
          {d.indiceHooper != null && (
            <p className={`text-xs font-semibold ${hooperColor}`}>
              Indice Hooper : {d.indiceHooper}/40
            </p>
          )}
        </div>
      </div>
      <ArrowRightIcon className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition shrink-0" />
    </button>
  )
}

function SharedDocCard({ doc: d }: { doc: SharedDoc }) {
  return (
    <a
      href={d.fileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-4 hover:border-indigo-200 hover:shadow-sm transition group"
    >
      <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
        <ShareIcon className="w-5 h-5 text-indigo-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{d.title}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
            Document partagé
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{d.dateLabel}</p>
      </div>
      <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition shrink-0" />
    </a>
  )
}

function DocCard({ doc: d, router }: { doc: AnyDoc; router: ReturnType<typeof useRouter> }) {
  if (d.category === 'facturation') return <FactureCard doc={d} />
  if (d.category === 'questionnaire') return <QuestionnaireCard doc={d} router={router} />
  return <SharedDocCard doc={d} />
}

// ── Admin upload panel ────────────────────────────────────────────────────────

interface AdminSharedDoc {
  id: string
  targetUserId: string
  targetUserName: string
  nom: string
  fileUrl: string
  createdAt: any
}

function AdminPanel({ adminUid }: { adminUid: string }) {
  const { users } = useUsers()
  const fileRef = useRef<HTMLInputElement>(null)

  const [targetUserId, setTargetUserId] = useState('')
  const [nom, setNom] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [sharedDocs, setSharedDocs] = useState<AdminSharedDoc[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)

  const utilisateurs = users.filter((u) => u.role_app === 'Utilisateur')

  useEffect(() => {
    async function loadShared() {
      setLoadingDocs(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'shared_documents'), where('uploadedBy', '==', adminUid))
        )
        setSharedDocs(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as AdminSharedDoc))
            .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
        )
      } catch (e) {
        console.error('[AdminPanel]', e)
      }
      setLoadingDocs(false)
    }
    loadShared()
  }, [adminUid])

  const handleUpload = async () => {
    if (!targetUserId || !nom.trim() || !file) {
      setError('Veuillez sélectionner un utilisateur, un nom et un fichier.')
      return
    }
    setError('')
    setUploading(true)
    try {
      const targetUser = utilisateurs.find((u) => u.uid === targetUserId)
      const targetUserName = targetUser
        ? `${targetUser.prenom ?? ''} ${targetUser.nom ?? ''}`.trim() || targetUser.display_name || targetUser.email
        : targetUserId
      const path = `shared_documents/${adminUid}/${Date.now()}_${file.name}`
      const fileUrl = await uploadImage(file, path)
      const docRef = await addDoc(collection(db, 'shared_documents'), {
        uploadedBy: adminUid,
        targetUserId,
        targetUserName,
        nom: nom.trim(),
        fileUrl,
        mimeType: file.type || undefined,
        createdAt: Timestamp.now(),
      })
      setSharedDocs((prev) => [{
        id: docRef.id, targetUserId, targetUserName, nom: nom.trim(), fileUrl, createdAt: Timestamp.now(),
      }, ...prev])
      setNom('')
      setTargetUserId('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      console.error('[AdminPanel upload]', e)
      setError('Erreur lors de l\'upload. Réessayez.')
    }
    setUploading(false)
  }

  const handleDelete = async (docId: string, fileUrl: string) => {
    if (!confirm('Supprimer ce document ?')) return
    try {
      await deleteDoc(doc(db, 'shared_documents', docId))
      await deleteImage(fileUrl)
      setSharedDocs((prev) => prev.filter((d) => d.id !== docId))
    } catch (e) {
      console.error('[AdminPanel delete]', e)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <ArrowUpTrayIcon className="w-4 h-4 text-blue-500" />
          Partager un document
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Utilisateur destinataire</label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              <option value="">Sélectionner un utilisateur…</option>
              {utilisateurs.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {`${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || u.display_name || u.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nom du document</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Contrat de suivi, Bilan nutritionnel…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fichier (PDF, image…)</label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 file:mr-3 file:text-xs file:font-medium file:border-0 file:bg-blue-50 file:text-blue-700 file:rounded-lg file:px-2 file:py-1"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            {uploading ? 'Upload en cours…' : 'Partager le document'}
          </button>
        </div>
      </div>

      {/* List of shared docs grouped by user */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accès par utilisateur ({sharedDocs.length} document{sharedDocs.length !== 1 ? 's' : ''})
        </h2>
        {loadingDocs ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : sharedDocs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Aucun document partagé pour l'instant.</p>
        ) : (() => {
          // Group by targetUserId
          const groups = sharedDocs.reduce<Record<string, { name: string; docs: AdminSharedDoc[] }>>((acc, d) => {
            if (!acc[d.targetUserId]) acc[d.targetUserId] = { name: d.targetUserName, docs: [] };
            acc[d.targetUserId].docs.push(d);
            return acc;
          }, {});
          return (
            <div className="space-y-4">
              {Object.entries(groups).map(([uid, { name, docs: userDocs }]) => (
                <div key={uid} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-indigo-600">{name[0]?.toUpperCase() ?? '?'}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{name}</span>
                    <span className="ml-auto text-xs text-gray-400">{userDocs.length} doc{userDocs.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {userDocs.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                        <ShareIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.nom}</p>
                          <p className="text-xs text-gray-400">{fmtDate(toMs(d.createdAt))}</p>
                        </div>
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 text-gray-400 hover:text-blue-600 transition shrink-0">
                          <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                        </a>
                        <button onClick={() => handleDelete(d.id, d.fileUrl)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition shrink-0">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'tous',          label: 'Tous',            icon: FolderOpenIcon },
  { key: 'facturation',   label: 'Facturation',     icon: DocumentTextIcon },
  { key: 'questionnaire', label: 'Questionnaires',  icon: ClipboardDocumentListIcon },
  { key: 'shared',        label: 'Partagés',        icon: ShareIcon },
]

export default function DocumentsPage() {
  const { currentUser, userProfile } = useAuth()
  const router = useRouter()
  const isAdmin = userProfile?.role_app === 'Admin'

  const [docs, setDocs] = useState<AnyDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('tous')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!currentUser || !userProfile) return
    if (isAdmin) { setLoading(false); return }

    async function load() {
      setLoading(true)
      const all: AnyDoc[] = []

      try {
        // ── 1. Factures/devis — deux méthodes selon les droits Firestore ─────
        const pushFacture = (d: any) => {
          const data = d.data ? d.data() : d
          if (!data.pdfUrl || data.status === 'draft' || data.status === 'cancelled') return
          const ms = toMs(data.date ?? data.createdAt)
          all.push({
            id: d.id,
            category: 'facturation',
            docType: data.type as FactureType,
            title: data.number,
            date: ms,
            dateLabel: fmtDate(ms),
            status: data.status as FactureStatus,
            total: data.total ?? 0,
            pdfUrl: data.pdfUrl,
          } satisfies FactureDoc)
        }

        // Méthode A : query directe par clientLinkedUserId (pas besoin d'accès à clients)
        try {
          const snap = await getDocs(
            query(collection(db, 'factures'), where('clientLinkedUserId', '==', currentUser!.uid))
          )
          snap.docs.forEach(pushFacture)
        } catch {
          // Méthode B : via collection clients (fallback si règles le permettent)
          try {
            const clientsSnap = await getDocs(
              query(collection(db, 'clients'), where('linkedUserId', '==', currentUser!.uid))
            )
            for (const c of clientsSnap.docs) {
              const snap = await getDocs(query(collection(db, 'factures'), where('clientId', '==', c.id)))
              snap.docs.forEach(pushFacture)
            }
          } catch (e) {
            console.warn('[DocumentsPage] factures non accessibles', e)
          }
        }

        // ── 2. Questionnaires remplis ────────────────────────────────────────
        const qSnap = await getDocs(
          query(
            collection(db, 'planning_pro'),
            where('ref_users', '==', doc(db, 'users', currentUser!.uid)),
            where('questionnaire_rempli', '==', true),
          )
        )
        qSnap.docs.forEach((d) => {
          const data = d.data() as any
          const ms = toMs(data.date_planning)
          all.push({
            id: d.id,
            category: 'questionnaire',
            planningId: d.id,
            title: `Séance du ${fmtDate(ms)}`,
            date: ms,
            dateLabel: fmtDate(ms),
            indiceHooper: data.indice_hooper ?? (
              data.qualite_sommeil && data.niveau_fatigue && data.niveau_courbatures && data.quantite_stress
                ? (data.qualite_sommeil + data.niveau_fatigue + data.niveau_courbatures + data.quantite_stress)
                : undefined
            ),
          } satisfies QuestionnaireDoc)
        })

        // ── 3. Documents partagés par l'admin ────────────────────────────────
        const sSnap = await getDocs(
          query(collection(db, 'shared_documents'), where('targetUserId', '==', currentUser!.uid))
        )
        sSnap.docs.forEach((d) => {
          const data = d.data() as any
          const ms = toMs(data.createdAt)
          all.push({
            id: d.id,
            category: 'shared',
            title: data.nom ?? 'Document',
            date: ms,
            dateLabel: fmtDate(ms),
            fileUrl: data.fileUrl,
            uploadedBy: data.uploadedBy,
          } satisfies SharedDoc)
        })

      } catch (e) {
        console.error('[DocumentsPage]', e)
      }

      all.sort((a, b) => b.date - a.date)
      setDocs(all)
      setLoading(false)
    }

    load()
  }, [currentUser, userProfile, isAdmin])

  const visibleTabs = useMemo(() => {
    const sharedCount = docs.filter((d) => d.category === 'shared').length
    return TABS.filter((t) => t.key !== 'shared' || sharedCount > 0)
  }, [docs])

  const visible = useMemo(() => {
    const byTab = tab === 'tous' ? docs : docs.filter((d) => d.category === tab)
    if (!search.trim()) return byTab
    const q = search.toLowerCase()
    return byTab.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      d.dateLabel.toLowerCase().includes(q) ||
      (d.category === 'facturation' && STATUS_LABEL[(d as FactureDoc).status].toLowerCase().includes(q))
    )
  }, [docs, tab, search])

  const counts = useMemo(() => ({
    tous: docs.length,
    facturation: docs.filter((d) => d.category === 'facturation').length,
    questionnaire: docs.filter((d) => d.category === 'questionnaire').length,
    shared: docs.filter((d) => d.category === 'shared').length,
  }), [docs])

  return (
    <div className="p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
          <FolderOpenIcon className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isAdmin ? 'Partage de documents' : 'Mes documents'}
          </h1>
          <p className="text-sm text-gray-500">
            {isAdmin ? 'Partagez des documents avec vos utilisateurs' : 'Tous vos documents partagés par votre coach'}
          </p>
        </div>
      </div>

      {/* Admin view */}
      {isAdmin ? (
        <AdminPanel adminUid={currentUser!.uid} />
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
            {visibleTabs.map((t) => {
              const Icon = t.icon
              const count = counts[t.key]
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition ${
                    tab === t.key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{t.label}</span>
                  {count > 0 && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${
                      tab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Search */}
          {!loading && docs.length > 3 && (
            <div className="relative mb-4">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un document..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpenIcon className="w-12 h-12 text-gray-300 mb-3" />
              {docs.length === 0 ? (
                <>
                  <p className="text-gray-500 font-medium">Aucun document disponible</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Vos documents apparaîtront ici une fois partagés par votre coach
                  </p>
                </>
              ) : (
                <p className="text-gray-500 font-medium">Aucun document dans cette catégorie</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((d) => <DocCard key={`${d.category}-${d.id}`} doc={d} router={router} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
