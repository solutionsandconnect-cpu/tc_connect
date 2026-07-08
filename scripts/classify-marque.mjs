// scripts/classify-marque.mjs
// Phase 0 « une app, deux portes » — classe les fiches `clients` par marque.
//
// Un client est « enezo » (activité dev) s'il porte AU MOINS un de ces signaux :
//   1. référencé par un contrat Pilotage         (pilotage_contrats.clientId)
//   2. une facture/devis liée à un contrat        (factures.contratId + clientId)
//   3. un abonnement de catégorie « S&C »         (abonnements.categorie === 'S&C')
//   4. un abonnement dont la société = Solutions/Enezo (abonnements.companyNom)
// Tous les autres restent « coaching » (= valeur par défaut, non écrite).
//
// Écriture MINIMALE : on ne pose `marque:'enezo'` que sur les clients enezo (+ leurs
// comptes users liés). Les clients coaching gardent le champ absent (= coaching par défaut).
//
// Usage :
//   node scripts/classify-marque.mjs           → DRY-RUN (n'écrit rien, affiche le plan)
//   node scripts/classify-marque.mjs --apply    → applique les écritures
//
// ⚠️ Cible la PROD (creds .env.local). En dry-run d'abord, on valide la liste, puis --apply.

import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

const APPLY = process.argv.includes('--apply')

// ── Charge .env.local (sans dépendance dotenv) ──────────────────────────────────
function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  const env = {}
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    env[m[1]] = v
  }
  return env
}

function normalizeKey(raw) {
  let key = (raw ?? '').trim()
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1)
  key = key.replace(/\\r/g, '').replace(/\\n/g, '\n').replace(/\r/g, '')
  if (!key.endsWith('\n')) key += '\n'
  return key
}

const env = loadEnv()
const projectId = env.FIREBASE_PROJECT_ID
admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeKey(env.FIREBASE_PRIVATE_KEY),
  }),
})
const db = admin.firestore()

const isEnezoCompany = (nom) => {
  const n = (nom ?? '').toLowerCase().replace(/[&\s]/g, '')
  return n.includes('solutions') || n.includes('enezo')
}

async function main() {
  console.log(`\n🎯 Projet Firebase ciblé : ${projectId}`)
  console.log(`Mode : ${APPLY ? '✍️  APPLY (écriture)' : '👀 DRY-RUN (lecture seule)'}\n`)

  // Signaux → set d'ids clients enezo, avec la raison
  const reasons = new Map() // clientId -> Set(raisons)
  const addReason = (id, why) => {
    if (!id) return
    if (!reasons.has(id)) reasons.set(id, new Set())
    reasons.get(id).add(why)
  }

  const [contrats, factures, abos, clientsSnap, usersSnap] = await Promise.all([
    db.collection('pilotage_contrats').get(),
    db.collection('factures').get(),
    db.collection('abonnements').get(),
    db.collection('clients').get(),
    db.collection('users').get(),
  ])

  contrats.forEach((d) => addReason(d.data().clientId, 'contrat Pilotage'))
  factures.forEach((d) => { const f = d.data(); if (f.contratId) addReason(f.clientId, 'facture liée à un contrat') })
  abos.forEach((d) => {
    const a = d.data()
    if (a.categorie === 'S&C' || a.categorie === 'Enezo') addReason(a.clientId, `abonnement catégorie ${a.categorie}`)
    else if (isEnezoCompany(a.companyNom)) addReason(a.clientId, `abonnement société « ${a.companyNom} »`)
  })

  const enezoIds = new Set(reasons.keys())

  // ── Rapport clients ───────────────────────────────────────────────────────────
  const toChange = [] // clients à passer enezo (actuellement != enezo)
  const alreadyOk = []
  const conflicts = [] // marqués enezo en base mais aucun signal (info)

  clientsSnap.forEach((d) => {
    const c = d.data()
    const current = c.marque
    const nom = [c.nom, c.prenom].filter(Boolean).join(' ') || d.id
    if (enezoIds.has(d.id)) {
      if (current === 'enezo') alreadyOk.push({ id: d.id, nom })
      else toChange.push({ id: d.id, nom, current: current ?? '(absent=coaching)', why: [...reasons.get(d.id)] })
    } else if (current === 'enezo') {
      conflicts.push({ id: d.id, nom })
    }
  })

  console.log(`📊 ${clientsSnap.size} clients au total`)
  console.log(`   • ${enezoIds.size} identifiés « enezo » par signal`)
  console.log(`   • ${alreadyOk.length} déjà marqués enezo (rien à faire)`)
  console.log(`   • ${toChange.length} à passer en enezo`)
  console.log(`   • ${clientsSnap.size - enezoIds.size} restent coaching (défaut, non écrit)\n`)

  if (toChange.length) {
    console.log('➡️  Clients qui passeront « enezo » :')
    for (const c of toChange) console.log(`   - ${c.nom.padEnd(32)} [${c.id}]  (${c.current})  ← ${c.why.join(', ')}`)
    console.log('')
  }
  if (conflicts.length) {
    console.log('⚠️  Marqués « enezo » en base mais SANS signal (vérifier, laissés tels quels) :')
    for (const c of conflicts) console.log(`   - ${c.nom} [${c.id}]`)
    console.log('')
  }

  // Comptes users liés à un client enezo → à propager
  const usersToChange = []
  usersSnap.forEach((d) => {
    const u = d.data()
    if (u.linkedClientId && enezoIds.has(u.linkedClientId) && u.marque !== 'enezo') {
      usersToChange.push({ id: d.id, nom: u.display_name || u.email || d.id })
    }
  })
  console.log(`👤 ${usersToChange.length} compte(s) user lié(s) à un client enezo à propager :`)
  for (const u of usersToChange) console.log(`   - ${u.nom} [${u.id}]`)
  console.log('')

  if (!APPLY) {
    console.log('👀 DRY-RUN terminé — aucune écriture. Relance avec --apply pour appliquer.\n')
    return
  }

  // ── Écriture (batch) ────────────────────────────────────────────────────────────
  let batch = db.batch(), n = 0, written = 0
  const flush = async () => { if (n) { await batch.commit(); written += n; batch = db.batch(); n = 0 } }
  for (const c of toChange) { batch.update(db.doc(`clients/${c.id}`), { marque: 'enezo' }); if (++n >= 400) await flush() }
  for (const u of usersToChange) { batch.update(db.doc(`users/${u.id}`), { marque: 'enezo' }); if (++n >= 400) await flush() }
  await flush()
  console.log(`✍️  Écriture terminée : ${written} document(s) mis à jour.\n`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
