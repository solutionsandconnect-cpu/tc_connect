import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeEmail, safeId } from '@/lib/mailingModel'

// Désinscription publique — accès par jeton, sans compte.
// Le registre `mailing_optout` est volontairement distinct de `prospects` :
// supprimer un prospect ou réimporter une liste ne doit jamais faire réapparaître
// quelqu'un qui a demandé à ne plus être contacté.

/** Masque l'adresse : le jeton peut circuler, l'email n'a pas à être réaffiché en clair. */
function masquer(email: string): string {
  const [local, domaine] = normalizeEmail(email).split('@')
  if (!domaine) return '•••'
  const debut = local.slice(0, 2)
  return `${debut}${'•'.repeat(Math.max(1, local.length - 2))}@${domaine}`
}

async function trouverProspect(token: string) {
  const db = getAdminDb()
  const snap = await db.collection('prospects').where('optoutToken', '==', token).limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const doc = await trouverProspect(token)
  if (!doc) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a expiré.' }, { status: 404 })
  }

  const p = doc.data()
  return NextResponse.json({
    societe: p.societe ?? '',
    emailMasque: masquer(p.email ?? ''),
    dejaOppose: p.statut === 'oppose',
  })
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const doc = await trouverProspect(token)
  if (!doc) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a expiré.' }, { status: 404 })
  }

  const db = getAdminDb()
  const p = doc.data()
  const email = normalizeEmail(p.email ?? '')
  if (!email) {
    return NextResponse.json({ error: 'Adresse introuvable.' }, { status: 400 })
  }

  // 1. Registre global d'abord : même si la mise à jour du prospect échoue,
  //    l'opposition est enregistrée et sera respectée par tout import futur.
  await db.collection('mailing_optout').doc(safeId(email)).set(
    {
      email,
      origine: 'lien',
      prospectId: doc.id,
      createdAt: new Date(),
    },
    { merge: true },
  )

  // 2. Puis le prospect, pour que l'état soit lisible dans l'outil.
  await doc.ref.update({ statut: 'oppose', updatedAt: new Date() })

  return NextResponse.json({ ok: true })
}
