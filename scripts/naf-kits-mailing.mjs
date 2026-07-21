// scripts/naf-kits-mailing.mjs
// Renseigne les codes NAF des kits métier du mailing.
// Codes vérifiés un par un contre l'API « Recherche d'entreprises » : aucun ne
// renvoie zéro entreprise active.
//
//   node scripts/naf-kits-mailing.mjs           → DRY-RUN
//   node scripts/naf-kits-mailing.mjs --apply    → écrit
//
// N'écrase QUE les kits sans codes : une saisie manuelle reste prioritaire.

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

// Correspondance métier → codes NAF.
// La plomberie en porte deux : un plombier-chauffagiste peut être immatriculé
// sous l'un ou l'autre. Les travaux publics couvrent plusieurs familles.
const NAF = {
  plomberie: '43.22A,43.22B',
  menuiserie: '43.32A',
  maconnerie: '43.99C',
  plaquiste: '43.31Z',
  paysagiste: '81.30Z',
  electricien: '43.21A',
  electricite: '43.21A',
  carreleur: '43.33Z',
  peintre: '43.34Z',
  couvreur: '43.91B',
  charpentier: '43.91A',
  terrassier: '43.12A',
  'travaux publics': '42.11Z,42.21Z,42.22Z,42.99Z,43.12A',
}

const cle = (s) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const env = loadEnv()
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeKey(env.FIREBASE_PRIVATE_KEY),
  }),
})
const db = admin.firestore()

console.log(`\n🎯 Projet : ${env.FIREBASE_PROJECT_ID}`)
console.log(`Mode : ${APPLY ? '✍️  APPLY' : '👀 DRY-RUN'}\n`)

const snap = await db.collection('mailing_metiers').get()
let maj = 0
for (const d of snap.docs) {
  const k = d.data()
  const actuel = (k.codesNaf ?? '').trim()
  const propose = NAF[cle(k.metier)]
  if (!propose) {
    console.log(`  ${String(k.metier).padEnd(18)} — pas de correspondance connue`)
    continue
  }
  if (actuel) {
    console.log(`  ${String(k.metier).padEnd(18)} déjà renseigné (${actuel}) — laissé tel quel`)
    continue
  }
  console.log(`  ${String(k.metier).padEnd(18)} → ${propose}`)
  if (APPLY) {
    await d.ref.update({ codesNaf: propose, updatedAt: admin.firestore.Timestamp.now() })
    maj++
  }
}
console.log(APPLY ? `\n✅ ${maj} kit(s) mis à jour.\n` : `\nRien écrit. Relance avec --apply.\n`)
process.exit(0)
