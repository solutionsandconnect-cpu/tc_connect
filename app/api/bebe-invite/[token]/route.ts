import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { INVITES } from '@/lib/bebeInvite'

/**
 * GET — aperçu ANONYME d'une invitation (page /bebe-invitation/[token]).
 * N'expose que le strict nécessaire : prénom du bébé + nom de l'inviteur.
 * Aucune donnée de suivi (biberons, sommeil…) n'est accessible sans compte.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const snap = await getAdminDb().collection(INVITES).doc(token).get()
  if (!snap.exists) return NextResponse.json({ status: 'invalid' }, { status: 404 })

  const inv = snap.data()!
  const status = inv.usedAt ? 'used'
    : (inv.expiresAt?.toMillis?.() ?? 0) < Date.now() ? 'expired'
    : 'ok'

  return NextResponse.json({
    status,
    babyName: inv.babyName ?? '',
    inviterName: inv.createdByName ?? '',
  })
}
