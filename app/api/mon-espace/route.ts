import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import { resolveClientId } from '@/lib/monEspace'

// Liste des contrats rattachés au compte connecté (via Client.linkedUserId / User.linkedClientId).
export async function GET(req: Request) {
  const idToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!idToken) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })

  const auth = getAdminAuth()
  const db = getAdminDb()

  let uid: string
  try {
    uid = (await auth.verifyIdToken(idToken)).uid
  } catch {
    return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
  }

  const clientId = await resolveClientId(uid)
  if (!clientId) return NextResponse.json({ contrats: [] })

  const snap = await db.collection('pilotage_contrats').where('clientId', '==', clientId).get()
  const contrats = snap.docs.map((d) => {
    const c = d.data()

    // Libellé du projet. On NE retombe PAS sur `clientNom` : deux contrats d'un même
    // client afficheraient alors le même titre, impossible de les distinguer.
    const titre =
      c.charte?.nomApp ??
      c.charte?.nomProjet ??
      c.appNom ??
      (typeof c.projet === 'string' && c.projet.trim() ? c.projet.trim() : null) ??
      (typeof c.abonnementTitre === 'string' && c.abonnementTitre.trim() ? c.abonnementTitre.trim() : null) ??
      'Projet'

    // Repères toujours présents pour différencier deux contrats : n° de devis + date.
    const ts = c.dateDebut ?? c.createdAt
    const date = ts?.toDate ? ts.toDate().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null
    const sousTitre = [c.devisNumber ? `Devis ${c.devisNumber}` : null, date].filter(Boolean).join(' · ')

    return {
      id: d.id,
      titre,
      sousTitre,
      clientNom: c.clientNom ?? '',
      statut: c.statut ?? 'actif',
    }
  })

  return NextResponse.json({ contrats })
}
