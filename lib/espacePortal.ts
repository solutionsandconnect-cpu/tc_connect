import { after } from 'next/server'

// Construction du payload « espace client » (portail public). Partagé par
// /api/espace/[token] (accès par lien) et /api/mon-espace/[contratId] (accès par compte).
// Tout est ASSAINI : on n'expose JAMAIS les données internes du contrat
// (estimation, marge, TJM, coûts d'infra, fiche négo…). Lecture via Admin SDK.

type Db = FirebaseFirestore.Firestore
type Raw = FirebaseFirestore.DocumentData
type Snap = FirebaseFirestore.DocumentSnapshot

// Borne de sécurité : une signature canvas PNG fait quelques dizaines de Ko.
const MAX_SIGNATURE_BYTES = 700 * 1024

// Types de documents légaux que le CLIENT peut signer depuis son espace.
// (CGV exclues : elles figurent sur les devis/factures, pas en document séparé.)
export const SIGNABLE_DOC_TYPES = ['prestation', 'dpa_rgpd', 'licence'] as const

// Signe un devis appartenant à un contrat donné (accès par lien OU par compte).
// Stocke la signature en data URL (compatible invoiceHtml/invoicePdf), passe le devis
// en « accepté », et notifie l'admin (push). Renvoie { status, body } prêt pour la réponse HTTP.
export async function signDevisForContrat(
  db: Db, cdoc: Snap, devisId: string, signatureDataUrl: string, origin: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!devisId || !signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
    return { status: 400, body: { error: 'Signature manquante ou invalide.' } }
  }
  if (signatureDataUrl.length > MAX_SIGNATURE_BYTES) {
    return { status: 413, body: { error: 'Signature trop volumineuse.' } }
  }

  const c = cdoc.data()!
  const devisRef = db.collection('factures').doc(devisId)
  const devisSnap = await devisRef.get()
  if (!devisSnap.exists) return { status: 404, body: { error: 'Devis introuvable.' } }
  const devis = devisSnap.data()!

  const belongs = devis.contratId === cdoc.id || devisId === c.devisId
  if (!belongs || devis.type !== 'devis') {
    return { status: 403, body: { error: 'Ce devis ne correspond pas à ce contrat.' } }
  }
  if (devis.signed) return { status: 200, body: { ok: true, alreadySigned: true } }

  const signedAt = new Date()
  await devisRef.update({
    signed: true, signedAt, signatureUrl: signatureDataUrl, status: 'accepted', updatedAt: signedAt,
  })

  // Notif admin (in-app + push) APRÈS la réponse → ne bloque pas le client (signature instantanée).
  const who = c.clientNom || devis.clientName || 'Un client'
  const number = devis.number ?? ''
  after(async () => {
    try {
      await fetch(`${origin}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true, persist: true, type: 'PILOTAGE_DEVIS_SIGNE',
          title: 'Devis signé en ligne',
          body: `${who} a signé le devis ${number}.`.trim(),
          url: `/facturation/${devisId}`,
        }),
      })
    } catch { /* la signature a réussi même si la notif échoue */ }
  })

  return { status: 200, body: { ok: true, signed: true } }
}

// Signe un document légal (contrat de prestation, DPA/RGPD, licence) côté CLIENT depuis
// l'espace. La signature du prestataire est posée par défaut (Company.signatureUrl) ; on ne
// stocke ici que la signature du client (data URL, case « roleB » du PDF). La copie stockée
// (pdfUrl) est marquée à régénérer côté admin ; le PDF signé immédiat est produit dans le navigateur du client.
export async function signDocForContrat(
  db: Db, cdoc: Snap, docId: string, signatureDataUrl: string, origin: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!docId || !signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
    return { status: 400, body: { error: 'Signature manquante ou invalide.' } }
  }
  if (signatureDataUrl.length > MAX_SIGNATURE_BYTES) {
    return { status: 413, body: { error: 'Signature trop volumineuse.' } }
  }

  const docRef = db.collection('pilotage_documents').doc(docId)
  const dsnap = await docRef.get()
  if (!dsnap.exists) return { status: 404, body: { error: 'Document introuvable.' } }
  const doc = dsnap.data()!

  if (doc.contratId !== cdoc.id) {
    return { status: 403, body: { error: 'Ce document ne correspond pas à ce contrat.' } }
  }
  if (!SIGNABLE_DOC_TYPES.includes(doc.type)) {
    return { status: 403, body: { error: "Ce document n'est pas signable." } }
  }
  if (doc.clientSigne) return { status: 200, body: { ok: true, alreadySigned: true } }

  const c = cdoc.data()!
  const signedAt = new Date()
  await docRef.update({
    clientSigne: true, clientSigneLe: signedAt, clientSignatairePar: c.clientNom || null,
    clientSignatureUrl: signatureDataUrl, statut: 'signe',
    pdfReflectsSignature: false, // la copie stockée sera régénérée à la prochaine ouverture admin
    updatedAt: signedAt,
  })

  const who = c.clientNom || 'Un client'
  const titre = doc.titre || 'un document'
  after(async () => {
    try {
      await fetch(`${origin}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true, persist: true, type: 'PILOTAGE_DOC_SIGNE',
          title: 'Document signé en ligne',
          body: `${who} a signé « ${titre} ».`,
          url: `/pilotage/contrat/${cdoc.id}`,
        }),
      })
    } catch { /* la signature a réussi même si la notif échoue */ }
  })

  return { status: 200, body: { ok: true, signed: true } }
}

// Convertit récursivement les Timestamp admin (_seconds) ET client (seconds) en { seconds }.
export function serialize(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v._seconds === 'number' || typeof v.seconds === 'number') {
      const seconds = (v._seconds ?? v.seconds) as number
      const nanoseconds = (v._nanoseconds ?? v.nanoseconds ?? 0) as number
      return { seconds, nanoseconds }
    }
    if (Array.isArray(value)) return value.map(serialize)
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v)) out[k] = serialize(val)
    return out
  }
  return value
}

// Champs « prestataire » publics affichés sur chaque devis (sans danger à exposer).
const COMPANY_FIELDS = [
  'nom', 'adresse', 'codePostal', 'ville', 'email', 'telephone', 'representant',
  'siret', 'tva', 'iban', 'bic', 'logoUrl', 'signatureUrl', 'couleurPrimaire', 'cgv', 'cgvDate',
] as const

const DOC_FIELDS = ['type', 'titre', 'version', 'statut', 'pdfUrl', 'pdfNom', 'signe'] as const

const tsMs = (f: Raw) =>
  (f.date?._seconds ?? f.date?.seconds ?? f.createdAt?._seconds ?? f.createdAt?.seconds ?? 0) as number

export async function buildPortalPayload(db: Db, cdoc: Snap) {
  const c = cdoc.data()!

  // Devis rattachés (Facture.contratId) + le devis principal (contrat.devisId)
  const facSnap = await db.collection('factures').where('contratId', '==', cdoc.id).get()
  const devisRaw: { id: string; data: Raw }[] = facSnap.docs
    .filter((d) => d.data().type === 'devis')
    .map((d) => ({ id: d.id, data: d.data() }))

  if (c.devisId && !devisRaw.find((d) => d.id === c.devisId)) {
    const main = await db.collection('factures').doc(c.devisId).get()
    if (main.exists && main.data()!.type === 'devis') devisRaw.push({ id: main.id, data: main.data()! })
  }
  devisRaw.sort((a, b) => {
    if (a.id === c.devisId) return -1
    if (b.id === c.devisId) return 1
    return tsMs(b.data) - tsMs(a.data)
  })
  const devis = devisRaw.map((d) => ({ id: d.id, ...d.data }))

  // Company (depuis le devis principal)
  const companyId = (devisRaw[0]?.data.companyId as string | undefined) ?? undefined
  let company: Record<string, unknown> | null = null
  if (companyId) {
    const compSnap = await db.collection('companies').doc(companyId).get()
    if (compSnap.exists) {
      const raw = compSnap.data()!
      company = { id: compSnap.id }
      for (const f of COMPANY_FIELDS) if (raw[f] !== undefined) company[f] = raw[f]
    }
  }

  // Factures (type 'facture')
  const factures = facSnap.docs
    .filter((d) => d.data().type === 'facture')
    .map((d) => ({ id: d.id, data: d.data() as Raw }))
    .sort((a, b) => tsMs(b.data) - tsMs(a.data))
    .map((d) => ({ id: d.id, ...d.data }))

  // Documents générés (uniquement ceux dont le PDF a été stocké → pdfUrl Storage)
  const docSnap = await db.collection('pilotage_documents').where('contratId', '==', cdoc.id).get()
  const documents = docSnap.docs
    .filter((d) => d.data().pdfUrl)
    .map((d) => {
      const r = d.data()
      const o: Record<string, unknown> = { id: d.id, pdfGeneeLe: serialize(r.pdfGeneeLe) ?? null }
      for (const f of DOC_FIELDS) if (r[f] !== undefined) o[f] = r[f]
      o.clientSigne = !!r.clientSigne
      if (r.clientSigneLe) o.clientSigneLe = serialize(r.clientSigneLe)
      // Signable par le client = contrat légal AVEC un instantané de rendu (posé à la génération admin).
      const isSignable = (SIGNABLE_DOC_TYPES as readonly string[]).includes(r.type) && !!r.renderSnapshot
      o.signable = isSignable
      if (isSignable) {
        o.renderSnapshot = serialize(r.renderSnapshot)   // { legal, projetContexte } → régénération à l'identique
        o.clientNom = c.clientNom ?? ''
        o.version = c.version ?? r.version ?? null        // version au niveau contrat (comme la génération admin)
      }
      return o
    })
    .sort((a, b) => ((b.pdfGeneeLe as { seconds?: number })?.seconds ?? 0) - ((a.pdfGeneeLe as { seconds?: number })?.seconds ?? 0))

  // Périmètre projet (client-facing). Les `taches` sont ASSAINIES : on retire le
  // statut de facturation interne (facturation/tempsH/facturee) et on ne garde que
  // description/date/fait/pour ('client' = le client, 'sc' = Enezo).
  const p = (c.projet ?? {}) as Raw
  const taches = Array.isArray(p.taches)
    ? (p.taches as Raw[]).map((t) => ({
        description: t.description ?? '',
        date: t.date ?? '',
        fait: !!t.fait,
        pour: t.pour === 'client' ? 'client' : 'sc',
      }))
    : []
  const projet = {
    contexte: p.contexte ?? '',
    fonctionnalites: p.fonctionnalites ?? [],
    livrables: p.livrables ?? [],
    horsPerimetre: p.horsPerimetre ?? [],
    planning: p.planning ?? [],
    taches,
  }

  // Résumé du contrat (whitelist — AUCUNE donnée interne)
  const contrat = {
    id: cdoc.id,
    clientNom: c.clientNom ?? '',
    statut: c.statut ?? 'actif',
    version: c.version ?? null,
    appNom: c.charte?.nomApp ?? c.charte?.nomProjet ?? c.appNom ?? null,
    dateDebut: serialize(c.dateDebut) ?? null,
  }

  return {
    contrat,
    company,
    devis: serialize(devis),
    factures: serialize(factures),
    documents,
    projet,
    primaryDevisId: c.devisId ?? devis[0]?.id ?? null,
  }
}
