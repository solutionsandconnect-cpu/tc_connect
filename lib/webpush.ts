import webpush from 'web-push'
import { getAdminDb } from '@/lib/firebaseAdmin'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export type PushPayload = { title: string; body: string; url?: string }

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const db = getAdminDb()
  const snap = await db.collection('push_subscriptions').doc(userId).get()
  if (!snap.exists) return
  const { subscription } = snap.data()!
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await db.collection('push_subscriptions').doc(userId).delete()
    }
  }
}

export async function sendPushToAdmins(payload: PushPayload) {
  const db = getAdminDb()
  const snap = await db.collection('push_subscriptions').where('role_app', '==', 'Admin').get()
  if (snap.empty) {
    // Fallback : envoyer à toutes les subscriptions marquées admin
    const all = await db.collection('push_subscriptions').get()
    const admins = all.docs.filter(d => d.data().role_app === 'Admin')
    await Promise.allSettled(admins.map(d => _send(d.ref, d.data().subscription, payload)))
  } else {
    await Promise.allSettled(snap.docs.map(d => _send(d.ref, d.data().subscription, payload)))
  }
}

async function _send(ref: FirebaseFirestore.DocumentReference, subscription: any, payload: PushPayload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) await ref.delete()
  }
}
