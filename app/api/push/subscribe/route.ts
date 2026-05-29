import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, role_app } = await req.json()
    if (!subscription || !userId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }
    await getAdminDb().collection('push_subscriptions').doc(userId).set({
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
