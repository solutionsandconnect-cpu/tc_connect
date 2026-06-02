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

export async function POST(req: NextRequest) {
  try {
    const { userId, toAdmins, title, body, url, persist, type } = await req.json()
    const payload = { title: title || 'TC Connect', body: body || '', url }

    if (toAdmins) {
      await sendPushToAdmins(payload)
      if (persist) await persistForAdmins(payload.title, payload.body, url, type)
    } else if (userId) {
      await sendPushToUser(userId, payload)
    } else {
      return NextResponse.json({ error: 'userId or toAdmins required' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
