import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebaseAdmin'

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const db = getAdminDb()

  const linkSnap = await db.collection('inviteLinks').doc(token).get()
  if (!linkSnap.exists) {
    return NextResponse.json({ error: 'Lien invalide ou expiré.' }, { status: 404 })
  }

  const { tripId, permission, label, inviteEmail, nom, prenom } = linkSnap.data()!
  const tripSnap = await db.collection('trips').doc(tripId).get()
  if (!tripSnap.exists) {
    return NextResponse.json({ error: 'Liste introuvable.' }, { status: 404 })
  }

  const tripData = tripSnap.data()!
  return NextResponse.json({
    tripId,
    permission,
    label: label ?? '',
    inviteEmail: inviteEmail ?? '',
    nom: nom ?? '',
    prenom: prenom ?? '',
    trip: {
      id: tripSnap.id,
      name: tripData.name,
      icon: tripData.icon,
      color: tripData.color,
      type: tripData.type,
      dateFrom: tripData.dateFrom ?? null,
      dateTo: tripData.dateTo ?? null,
      sections: tripData.sections ?? [],
    },
  })
}
