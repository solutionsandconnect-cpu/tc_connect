import { NextResponse } from 'next/server'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb } from '@/lib/firebaseAdmin'
import { normalizeEmail, safeId } from '@/lib/mailingModel'
import { sendPushToAdmins } from '@/lib/webpush'
import {
  infosDesinscription,
  masquerEmail,
  trouverProspectParToken,
} from '@/lib/desinscriptionServer'

// Désinscription publique — accès par jeton, sans compte.
// Le registre `mailing_optout` est volontairement distinct de `prospects` :
// supprimer un prospect ou réimporter une liste ne doit jamais faire réapparaître
// quelqu'un qui a demandé à ne plus être contacté.

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const infos = await infosDesinscription(token)
  if (!infos) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a expiré.' }, { status: 404 })
  }
  return NextResponse.json(infos)
}

/**
 * Prévient les admins (push + notification in-app) qu'un prospect s'est désinscrit,
 * et trace l'événement dans le journal `mailing_evenements` pour qu'il compte dans
 * le Suivi. Best-effort : une panne ici ne doit JAMAIS faire échouer l'opposition
 * elle-même, qui est la partie critique et déjà enregistrée à ce stade.
 */
async function notifierEtJournaliser(
  db: FirebaseFirestore.Firestore,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
) {
  const p = doc.data()
  const societe = (p.societe as string) || 'Un prospect'
  const emailMasque = masquerEmail((p.email as string) ?? '')
  const title = 'Désinscription prospection'
  const body = `${societe} (${emailMasque}) s'est retiré de la liste.`

  // 1. Journal — figé, alimente le Suivi et l'historique du prospect.
  const evt: Record<string, unknown> = {
    userId: p.userId,
    prospectId: doc.id,
    societe,
    type: 'desinscription',
    statutApres: 'oppose',
    observations: "Désinscription via le lien du mail (droit d'opposition RGPD).",
    createdAt: Timestamp.now(),
  }
  if (p.metier) evt.metier = p.metier
  if (p.statut) evt.statutAvant = p.statut
  if (p.dernierEnvoiAt?.toDate) {
    const jours = Math.round((Date.now() - p.dernierEnvoiAt.toDate().getTime()) / 86_400_000)
    evt.delaiDepuisEnvoi = Math.max(0, jours)
  }
  await db.collection('mailing_evenements').add(evt)

  // 2. Notifications — push à tous les appareils admin + entrée in-app par admin.
  await sendPushToAdmins({ title, body, url: '/mailing' })
  const adminsSnap = await db.collection('users').where('role_app', '==', 'Admin').get()
  await Promise.allSettled(
    adminsSnap.docs.map((a) =>
      db.collection('Notifications').add({
        refUsers: db.collection('users').doc(a.id),
        type_notification: 'MAILING_DESINSCRIPTION',
        notification: `${title} — ${body}`,
        etat_notification: 'Non lu',
        url: '/mailing',
        date_create: FieldValue.serverTimestamp(),
      }),
    ),
  )
}

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Lien invalide.' }, { status: 400 })

  const doc = await trouverProspectParToken(token)
  if (!doc) {
    return NextResponse.json({ error: 'Ce lien est invalide ou a expiré.' }, { status: 404 })
  }

  const db = getAdminDb()
  const p = doc.data()
  const email = normalizeEmail(p.email ?? '')
  if (!email) {
    return NextResponse.json({ error: 'Adresse introuvable.' }, { status: 400 })
  }

  // Idempotence : si déjà opposé, on ré-affirme l'opt-out mais on ne renotifie pas
  // (un double clic ou un re-chargement ne doit pas faire sonner deux fois).
  const dejaOppose = p.statut === 'oppose'

  // 1. Registre global d'abord : même si la mise à jour du prospect échoue,
  //    l'opposition est enregistrée et sera respectée par tout import futur.
  await db.collection('mailing_optout').doc(safeId(email)).set(
    {
      email,
      origine: 'lien',
      prospectId: doc.id,
      createdAt: new Date(),
    },
    { merge: true },
  )

  // 2. Puis le prospect, pour que l'état soit lisible dans l'outil.
  await doc.ref.update({ statut: 'oppose', updatedAt: new Date() })

  // 3. Enfin, alerte admin + journal — best-effort, jamais bloquant pour l'opt-out.
  if (!dejaOppose) {
    try {
      await notifierEtJournaliser(db, doc)
    } catch (err) {
      console.error('[desinscription] notification/journal échoués (opt-out déjà enregistré) :', err)
    }
  }

  return NextResponse.json({ ok: true })
}
