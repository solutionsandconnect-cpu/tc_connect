import { after } from 'next/server'
import { serialize } from '@/lib/espacePortal'

// Lien public de signature d'un devis de facturation (Teddy Coaching, etc.) —
// version « légère » de l'espace client, scopée à UN devis (pas de contrat Pilotage).
// Token au niveau de la facture (Facture.signToken). Lecture/écriture via Admin SDK.

type Db = FirebaseFirestore.Firestore
type Snap = FirebaseFirestore.DocumentSnapshot

// Borne de sécurité : une signature canvas PNG fait quelques dizaines de Ko.
const MAX_SIGNATURE_BYTES = 700 * 1024

// Champs « prestataire » publics (sans danger à exposer sur un devis).
const COMPANY_FIELDS = [
  'nom', 'adresse', 'codePostal', 'ville', 'email', 'telephone', 'representant',
  'siret', 'tva', 'iban', 'bic', 'logoUrl', 'couleurPrimaire', 'cgv', 'cgvDate',
] as const

// Construit le payload public (devis assaini + société) pour la page de signature.
export async function buildDevisPayload(db: Db, fdoc: Snap) {
  const f = fdoc.data()!
  const devis = { id: fdoc.id, ...f }

  let company: Record<string, unknown> | null = null
  const companyId = f.companyId as string | undefined
  if (companyId) {
    const compSnap = await db.collection('companies').doc(companyId).get()
    if (compSnap.exists) {
      const raw = compSnap.data()!
      company = { id: compSnap.id }
      for (const k of COMPANY_FIELDS) if (raw[k] !== undefined) company[k] = raw[k]
    }
  }

  return { devis: serialize(devis), company }
}

// Signe le devis (accès par lien public). Stocke la signature en data URL
// (compatible invoiceHtml/invoicePdf), passe le devis en « accepté », et notifie
// l'admin (push + in-app) APRÈS la réponse → signature instantanée côté client.
export async function signFactureDevis(
  db: Db, fdoc: Snap, signatureDataUrl: string, origin: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!signatureDataUrl || !signatureDataUrl.startsWith('data:image/')) {
    return { status: 400, body: { error: 'Signature manquante ou invalide.' } }
  }
  if (signatureDataUrl.length > MAX_SIGNATURE_BYTES) {
    return { status: 413, body: { error: 'Signature trop volumineuse.' } }
  }

  const f = fdoc.data()!
  if (f.type !== 'devis') return { status: 403, body: { error: "Ce document n'est pas un devis." } }
  if (f.signed) return { status: 200, body: { ok: true, alreadySigned: true } }

  const signedAt = new Date()
  await fdoc.ref.update({
    signed: true, signedAt, signatureUrl: signatureDataUrl, status: 'accepted', updatedAt: signedAt,
  })

  const who = f.clientName || 'Un client'
  const number = f.number ?? ''
  after(async () => {
    try {
      await fetch(`${origin}/api/push/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true, persist: true, type: 'DEVIS_SIGNE',
          title: 'Devis signé en ligne',
          body: `${who} a signé le devis ${number}.`.trim(),
          url: `/facturation/${fdoc.id}`,
        }),
      })
    } catch { /* la signature a réussi même si la notif échoue */ }
  })

  return { status: 200, body: { ok: true, signed: true } }
}
