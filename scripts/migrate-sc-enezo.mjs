// scripts/migrate-sc-enezo.mjs
// Rebrand « Solutions & Connect » / « S&C » → « Enezo » sur les DONNÉES prod.
// Réécrit les valeurs stockées (le code lecteur reste tolérant aux 2 formes pendant la transition) :
//   1. abonnements.categorie   : 'S&C'                       → 'Enezo'
//   2. abonnements.companyNom  : « Solutions & Connect » (≈) → 'Enezo'   (laisse « Acces TC-Connect »)
//   3. abonnements.type_suivi  : « Solutions & Connect » (≈) → 'Enezo'   (laisse « Acces TC-Connect »)
//   4. planning_pro.type_planning : remplace le morceau 'S&C' → 'Enezo'  (« Rendez-vous infos S&C » → « … Enezo »)
//
// Usage :
//   node scripts/migrate-sc-enezo.mjs           → DRY-RUN (n'écrit rien, montre le plan)
//   node scripts/migrate-sc-enezo.mjs --apply    → applique
//
// ⚠️ Cible la PROD (creds .env.local). Dry-run d'abord, on valide, puis --apply.

import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'

const APPLY = process.argv.includes('--apply')

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

// companyNom « Solutions & Connect » (variantes espaces/&) — mais PAS « Acces TC-Connect ».
const isSolutionsCompany = (nom) => {
  const n = (nom ?? '').toLowerCase().replace(/[&\s]/g, '')
  return n.includes('solutions')
}

async function main() {
  console.log(`\n🎯 Projet Firebase ciblé : ${projectId}`)
  console.log(`Mode : ${APPLY ? '✍️  APPLY (écriture)' : '👀 DRY-RUN (lecture seule)'}\n`)

  const [abos, plannings, companies] = await Promise.all([
    db.collection('abonnements').get(),
    db.collection('planning_pro').get(),
    db.collection('companies').get(),
  ])

  // ── Fiche(s) Société (companies) : nom + email — c'est ce qui s'imprime sur factures/contrats ──
  const compUpdates = []
  companies.forEach((d) => {
    const c = d.data()
    const changes = {}
    if (isSolutionsCompany(c.nom)) changes.nom = 'Enezo'
    if ((c.email ?? '').toLowerCase() === 'solutionsandconnect@gmail.com') changes.email = 'contact@enezo.fr'
    if (Object.keys(changes).length) compUpdates.push({ id: d.id, changes, before: { nom: c.nom, email: c.email } })
  })
  console.log(`🏢 Sociétés (companies) : ${companies.size} au total, ${compUpdates.length} à modifier`)
  for (const u of compUpdates) console.log(`        [${u.id}] nom « ${u.before.nom} » → « ${u.changes.nom ?? u.before.nom} »` + (u.changes.email ? ` ; email → ${u.changes.email}` : ''))
  console.log('')

  // ── Abonnements ────────────────────────────────────────────────────────────────
  const aboUpdates = [] // { id, changes:{}, before:{} }
  const catCount = {}
  const compCount = {}
  const suiviCount = {}
  abos.forEach((d) => {
    const a = d.data()
    const changes = {}
    if (a.categorie === 'S&C') { changes.categorie = 'Enezo'; catCount['S&C'] = (catCount['S&C'] || 0) + 1 }
    if (isSolutionsCompany(a.companyNom)) { changes.companyNom = 'Enezo'; compCount[a.companyNom] = (compCount[a.companyNom] || 0) + 1 }
    if (isSolutionsCompany(a.type_suivi)) { changes.type_suivi = 'Enezo'; suiviCount[a.type_suivi] = (suiviCount[a.type_suivi] || 0) + 1 }
    if (Object.keys(changes).length) aboUpdates.push({ id: d.id, changes, before: { categorie: a.categorie, companyNom: a.companyNom, type_suivi: a.type_suivi } })
  })

  console.log(`📦 Abonnements : ${abos.size} au total, ${aboUpdates.length} à modifier`)
  console.log(`   • categorie 'S&C' → 'Enezo' : ${catCount['S&C'] || 0}`)
  console.log(`   • companyNom → 'Enezo' :`)
  for (const [k, n] of Object.entries(compCount)) console.log(`        « ${k} » : ${n}`)
  console.log(`   • type_suivi → 'Enezo' :`)
  for (const [k, n] of Object.entries(suiviCount)) console.log(`        « ${k} » : ${n}`)
  console.log('')

  // ── Plannings (type_planning) ────────────────────────────────────────────────────
  const plUpdates = []
  const typeCount = {}
  plannings.forEach((d) => {
    const t = d.data().type_planning
    if (typeof t === 'string' && t.includes('S&C')) {
      const nt = t.split('S&C').join('Enezo')
      plUpdates.push({ id: d.id, before: t, after: nt })
      typeCount[t] = (typeCount[t] || 0) + 1
    }
  })
  console.log(`🗓️  Plannings : ${plannings.size} au total, ${plUpdates.length} type_planning à réécrire`)
  for (const [k, n] of Object.entries(typeCount)) console.log(`        « ${k} » → « ${k.split('S&C').join('Enezo')} » : ${n}`)
  console.log('')

  if (!APPLY) {
    console.log('👀 DRY-RUN terminé — aucune écriture. Relance avec --apply pour appliquer.\n')
    return
  }

  // ── Écriture (batch) ──────────────────────────────────────────────────────────────
  let batch = db.batch(), n = 0, written = 0
  const flush = async () => { if (n) { await batch.commit(); written += n; batch = db.batch(); n = 0 } }
  for (const u of aboUpdates) { batch.update(db.doc(`abonnements/${u.id}`), u.changes); if (++n >= 400) await flush() }
  for (const u of plUpdates) { batch.update(db.doc(`planning_pro/${u.id}`), { type_planning: u.after }); if (++n >= 400) await flush() }
  for (const u of compUpdates) { batch.update(db.doc(`companies/${u.id}`), u.changes); if (++n >= 400) await flush() }
  await flush()
  console.log(`✍️  Écriture terminée : ${written} document(s) mis à jour.\n`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
