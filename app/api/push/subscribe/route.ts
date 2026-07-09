import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getAdminDb } from '@/lib/firebaseAdmin'

// Id de document déterministe PAR APPAREIL = hash de l'endpoint push.
// Avant, le doc était indexé par userId → un seul appareil pouvait recevoir le
// push (chaque enregistrement écrasait le précédent). Désormais un compte peut
// avoir PLUSIEURS souscriptions (une par appareil), et un même appareil qui se
// ré-abonne écrase SON propre doc (pas d'accumulation de doublons).
function deviceDocId(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, role_app } = await req.json()
    const endpoint: string | undefined = subscription?.endpoint
    if (!subscription || !userId || !endpoint) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const db = getAdminDb()
    const docId = deviceDocId(endpoint)

    // Un endpoint d'appareil ne doit appartenir qu'à UN seul compte à la fois.
    // On purge les autres docs portant le même endpoint (ancien schéma indexé
    // par userId, ou compte précédent connecté sur ce téléphone) avant d'écrire
    // le nôtre — sinon on enverrait deux fois vers le même appareil.
    const dupes = await db.collection('push_subscriptions')
      .where('subscription.endpoint', '==', endpoint)
      .get()
    await Promise.allSettled(
      dupes.docs.filter(d => d.id !== docId).map(d => d.ref.delete())
    )

    await db.collection('push_subscriptions').doc(docId).set({
      subscription,
      userId,
      endpoint,
      role_app: role_app ?? 'Utilisateur',
      updatedAt: new Date(),
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId, endpoint } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    const db = getAdminDb()
    if (endpoint) {
      // Désactivation sur CET appareil uniquement : les autres appareils du
      // compte continuent de recevoir le push.
      await db.collection('push_subscriptions').doc(deviceDocId(endpoint)).delete().catch(() => {})
    } else {
      // Compat (endpoint absent) : on retire toutes les souscriptions du compte.
      const snap = await db.collection('push_subscriptions').where('userId', '==', userId).get()
      await Promise.allSettled(snap.docs.map(d => d.ref.delete()))
    }
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
