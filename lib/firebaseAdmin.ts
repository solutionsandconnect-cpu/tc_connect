import * as admin from 'firebase-admin'

/**
 * Normalise une clé privée Firebase fournie via variable d'environnement.
 * Gère les cas fréquents (surtout sur Vercel) :
 *  - guillemets simples/doubles entourant la valeur,
 *  - `\n` littéraux à reconvertir en vrais retours à la ligne,
 *  - `\r` parasites et absence de retour à la ligne final.
 */
function normalizePrivateKey(raw?: string): string | undefined {
  if (!raw) return undefined
  let key = raw.trim()
  // Retire d'éventuels guillemets entourant toute la valeur
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '')
  if (!key.endsWith('\n')) key += '\n'
  return key
}

function getAdminApp() {
  if (admin.apps.length > 0) return admin.apps[0]!

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin SDK env vars missing (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)')
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
}

export function getAdminAuth() {
  return admin.auth(getAdminApp())
}

export function getAdminDb() {
  return admin.firestore(getAdminApp())
}
