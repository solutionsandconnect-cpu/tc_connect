// scripts/import-kits-mailing.mjs
// Reprend les kits métier du mailing depuis les exports AppSheet (docs/*.csv)
// et les écrit dans la collection `mailing_metiers`.
//
// Structure des exports, telle qu'observée dans les données réelles :
//   ParametresMailing        : 1 ligne = 1 corps de métier (+ ses problématiques)
//   DetailsParametresMailing : 1 ligne = 1 paire problème/solution
//     · « Détails de cette partie (1) » porte le THÈME et sert de clé de regroupement
//       (il n'y a PAS de colonne « Thème de la section » ni de compteur : c'étaient
//        des colonnes calculées AppSheet, absentes de l'export) ;
//     · (2)/(3) = problème / réponse, appariés ligne à ligne → colonnes de la brochure ;
//     · (5)/(6) = accroche du mail, présentes sur UNE seule ligne par thème ;
//     · « Brochure ou mail » sépare les deux usages, comme dans les gabarits d'origine.
//
// Usage :
//   node scripts/import-kits-mailing.mjs           → DRY-RUN (n'écrit rien)
//   node scripts/import-kits-mailing.mjs --apply    → écrit
//
// ⚠️ Cible la PROD (creds .env.local). Les kits portant le même nom de métier
//    sont ÉCRASÉS (choix explicite : les kits actuels sont des tests).

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

/** Parseur CSV : guillemets, `""` échappés, sauts de ligne dans les champs. */
function parseCsv(texte) {
  const s = texte.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const lignes = []
  let champ = '', ligne = [], dansGuillemets = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (dansGuillemets) {
      if (c === '"') { if (s[i + 1] === '"') { champ += '"'; i++ } else dansGuillemets = false }
      else champ += c
    } else if (c === '"') dansGuillemets = true
    else if (c === ',') { ligne.push(champ); champ = '' }
    else if (c === '\n') { ligne.push(champ); champ = ''; if (ligne.some(v => v.trim())) lignes.push(ligne); ligne = [] }
    else champ += c
  }
  ligne.push(champ)
  if (ligne.some(v => v.trim())) lignes.push(ligne)
  return lignes.map(l => l.map(v => v.trim()))
}

function lireCsv(nom) {
  const lignes = parseCsv(readFileSync(new URL(`../docs/${nom}`, import.meta.url), 'utf8'))
  const entetes = lignes[0]
  return lignes.slice(1).map(l => Object.fromEntries(entetes.map((h, i) => [h, l[i] ?? ''])))
}

function jeton() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8)
}

/* ------------------------------------------------------------------ */

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

function construireKits() {
  const params = lireCsv('TC Connect - ParametresMailing.csv')
  const details = lireCsv('TC Connect - DetailsParametresMailing.csv')

  const parRef = new Map()
  for (const d of details) {
    const ref = d['IDParametresMailingRef']
    if (!parRef.has(ref)) parRef.set(ref, [])
    parRef.get(ref).push(d)
  }

  return params.map(p => {
    const id = p['IDParametresMailing']
    const lignes = parRef.get(id) ?? []

    // Regroupement par thème, dans l'ordre d'apparition du fichier.
    const themes = new Map()
    for (const l of lignes) {
      const theme = (l['Détails de cette partie (1)'] || '').trim()
      if (!theme) continue
      if (!themes.has(theme)) themes.set(theme, [])
      themes.get(theme).push(l)
    }

    const sections = [...themes.entries()].map(([theme, rs], i) => {
      const accroche = rs.find(r => (r['Détails de cette partie (5)'] || '').trim())
      // La brochure ne prend que les lignes marquées « Brochure », exactement
      // comme le faisait le gabarit AppSheet d'origine.
      const bro = rs.filter(
        r => r['Brochure ou mail'] === 'Brochure' && (r['Détails de cette partie (2)'] || '').trim(),
      )
      return {
        id: jeton(),
        ordre: i,
        theme,
        problemeMail: (accroche?.['Détails de cette partie (5)'] || '').trim(),
        solutionMail: (accroche?.['Détails de cette partie (6)'] || '').trim(),
        problemesBrochure: bro.map(r => (r['Détails de cette partie (2)'] || '').trim()).filter(Boolean),
        solutionsBrochure: bro.map(r => (r['Détails de cette partie (3)'] || '').trim()).filter(Boolean),
        afficher: rs.some(r => r['Afficher ou Masquer'] === 'Afficher'),
        important: rs.some(r => r['Important ou non'] === 'Important'),
      }
    })

    return {
      sourceId: id,
      metier: (p['Corps de métier'] || '').trim(),
      problematiques: (p['Problématiques du métier (mots clés en phrase)'] || '').trim(),
      sections,
    }
  })
}

async function trouverAdmin() {
  const snap = await db.collection('users').where('role_app', '==', 'Admin').get()
  const uids = snap.docs.map(d => d.id)
  if (uids.length !== 1) {
    throw new Error(`${uids.length} compte(s) Admin trouvé(s) — impossible de choisir automatiquement.`)
  }
  return uids[0]
}

async function main() {
  console.log(`\n🎯 Projet Firebase ciblé : ${projectId}`)
  console.log(`Mode : ${APPLY ? '✍️  APPLY (écriture)' : '👀 DRY-RUN (lecture seule)'}\n`)

  const kits = construireKits()
  const userId = await trouverAdmin()
  console.log(`Compte propriétaire : ${userId}\n`)

  const existants = await db.collection('mailing_metiers').where('userId', '==', userId).get()
  const parNom = new Map(
    existants.docs.map(d => [String(d.data().metier ?? '').trim().toLowerCase(), d.id]),
  )

  for (const k of kits) {
    const nbPaires = k.sections.reduce((n, s) => n + s.problemesBrochure.length, 0)
    const sansAccroche = k.sections.filter(s => !s.problemeMail).length
    const cible = parNom.get(k.metier.toLowerCase())
    console.log(
      `  ${k.metier.padEnd(16)} ${String(k.sections.length).padStart(2)} thèmes · ` +
      `${String(nbPaires).padStart(3)} paires brochure · ` +
      (sansAccroche ? `⚠️  ${sansAccroche} thème(s) sans accroche mail · ` : '') +
      (cible ? 'ÉCRASE l\'existant' : 'création'),
    )
    if (!k.sections.length) console.log(`      ⚠️  aucun contenu dans l'export — kit créé vide`)
  }

  if (!APPLY) {
    console.log('\nRien n\'a été écrit. Relance avec --apply pour appliquer.\n')
    return
  }

  let crees = 0, ecrases = 0
  for (const k of kits) {
    const donnees = {
      userId,
      metier: k.metier,
      problematiques: k.problematiques,
      objet: '',
      codesNaf: '',
      nbThemesMail: 3,
      sections: k.sections,
      actif: true,
      updatedAt: admin.firestore.Timestamp.now(),
    }
    const cible = parNom.get(k.metier.toLowerCase())
    if (cible) {
      await db.collection('mailing_metiers').doc(cible).set(donnees, { merge: true })
      ecrases++
    } else {
      await db.collection('mailing_metiers').add({
        ...donnees,
        createdAt: admin.firestore.Timestamp.now(),
      })
      crees++
    }
  }
  console.log(`\n✅ ${crees} kit(s) créé(s), ${ecrases} écrasé(s).\n`)
}

main().then(() => process.exit(0)).catch(e => { console.error('\n❌', e.message, '\n'); process.exit(1) })
