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

// Statuts pour lesquels la souscription est définitivement invalide → on la supprime
// (l'appareil en recréera une saine au prochain passage) :
//  404/410 = endpoint expiré ou désinscrit ;
//  403/401 = signature VAPID refusée (souscription liée à une ANCIENNE clé publique).
const DEAD_STATUS = new Set([401, 403, 404, 410])

async function deliver(ref: FirebaseFirestore.DocumentReference, subscription: any, payload: PushPayload) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
  } catch (err: any) {
    const code = err?.statusCode
    if (DEAD_STATUS.has(code)) {
      await ref.delete().catch(() => {})
      console.warn(`[push] souscription supprimée (HTTP ${code}) : ${ref.path}`)
    } else {
      // Avant, toute erreur ≠ 410/404 était avalée en silence → pannes invisibles.
      console.error(`[push] échec d'envoi (${ref.path}) :`, code ?? err?.message ?? err)
    }
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const db = getAdminDb()
  const ref = db.collection('push_subscriptions').doc(userId)
  const snap = await ref.get()
  if (!snap.exists) return
  await deliver(ref, snap.data()!.subscription, payload)
}

export async function sendPushToAdmins(payload: PushPayload) {
  const db = getAdminDb()
  let docs = (await db.collection('push_subscriptions').where('role_app', '==', 'Admin').get()).docs
  if (docs.length === 0) {
    // Fallback : filtrer côté client si la requête d'égalité ne renvoie rien.
    const all = await db.collection('push_subscriptions').get()
    docs = all.docs.filter(d => d.data().role_app === 'Admin')
  }
  await Promise.allSettled(docs.map(d => deliver(d.ref, d.data().subscription, payload)))
}
