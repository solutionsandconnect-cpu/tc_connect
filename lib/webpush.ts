import webpush from 'web-push'
import { getAdminDb } from '@/lib/firebaseAdmin'

// web-push exige un "subject" au format mailto: ou https: — on normalise un email nu.
const rawSubject = process.env.VAPID_EMAIL || ''
const vapidSubject = /^(mailto:|https?:)/.test(rawSubject) ? rawSubject : `mailto:${rawSubject}`

webpush.setVapidDetails(
  vapidSubject,
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
