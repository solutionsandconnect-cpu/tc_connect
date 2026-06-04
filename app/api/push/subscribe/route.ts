import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, role_app } = await req.json()
    if (!subscription || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    const db = getAdminDb()

    // Un endpoint d'appareil ne doit appartenir qu'à UN seul utilisateur.
    // On retire cet endpoint des éventuels autres comptes (ex. compte précédent
    // connecté sur le même téléphone) avant de l'attribuer à l'utilisateur courant.
    const endpoint: string | undefined = subscription?.endpoint
    if (endpoint) {
      const dupes = await db.collection('push_subscriptions')
        .where('subscription.endpoint', '==', endpoint)
        .get()
      await Promise.allSettled(
        dupes.docs
          .filter(d => d.id !== userId)
          .map(d => d.ref.delete())
      )
    }

    await db.collection('push_subscriptions').doc(userId).set({
      subscription,
      userId,
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
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    await getAdminDb().collection('push_subscriptions').doc(userId).delete()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
