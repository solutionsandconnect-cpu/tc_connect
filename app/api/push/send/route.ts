import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUser, sendPushToAdmins } from '@/lib/webpush'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

// Persiste une notification dans la collection Notifications pour chaque admin,
// afin qu'elle apparaisse dans la section "Notifications" de l'app.
async function persistForAdmins(title: string, body: string, url?: string, type = 'PARCOURS') {
  const db = getAdminDb()
  const adminsSnap = await db.collection('users').where('role_app', '==', 'Admin').get()
  await Promise.allSettled(adminsSnap.docs.map((adminDoc) =>
    db.collection('Notifications').add({
      refUsers: db.collection('users').doc(adminDoc.id),
      type_notification: type,
      notification: body ? `${title} — ${body}` : title,
      etat_notification: 'Non lu',
      url: url ?? null,
      date_create: FieldValue.serverTimestamp(),
    })
  ))
}

// Réserve atomiquement une clé d'envoi pour éviter les doublons entre appareils.
// Retourne true si l'envoi doit avoir lieu, false si une notification identique a déjà été émise.
// (localStorage côté client ne suffit pas : il est propre à chaque appareil/navigateur.)
async function claimDedupe(dedupeKey: string): Promise<boolean> {
  const db = getAdminDb()
  try {
    // create() échoue si le document existe déjà → garde-fou atomique, sûr en cas de course.
    await db.collection('notif_dedupe').doc(dedupeKey).create({
      createdAt: FieldValue.serverTimestamp(),
    })
    return true
  } catch (err: any) {
    // Code 6 = ALREADY_EXISTS : une autre session a déjà envoyé cette notification.
    if (err?.code === 6 || /already exists/i.test(err?.message ?? '')) return false
    throw err
  }
}

// Persiste une notification pour un utilisateur précis (section "Notifications" de son app).
async function persistForUser(userId: string, title: string, body: string, url?: string, type = 'PARCOURS') {
  const db = getAdminDb()
  await db.collection('Notifications').add({
    refUsers: db.collection('users').doc(userId),
    type_notification: type,
    notification: body ? `${title} — ${body}` : title,
    etat_notification: 'Non lu',
    url: url ?? null,
    date_create: FieldValue.serverTimestamp(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { userId, toAdmins, title, body, url, persist, type, dedupeKey } = await req.json()
    const payload = { title: title || 'TC Connect', body: body || '', url }

    // Déduplication inter-appareils : si cette clé a déjà été émise, on n'envoie rien.
    if (dedupeKey) {
      const shouldSend = await claimDedupe(String(dedupeKey))
      if (!shouldSend) return NextResponse.json({ ok: true, deduped: true })
    }

    if (toAdmins) {
      await sendPushToAdmins(payload)
      if (persist) await persistForAdmins(payload.title, payload.body, url, type)
    } else if (userId) {
      await sendPushToUser(userId, payload)
      if (persist) await persistForUser(userId, payload.title, payload.body, url, type)
    } else {
      return NextResponse.json({ error: 'userId or toAdmins required' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
