import { NextResponse } from 'next/server'
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin'
import {
  ANNUAIRE_BASE, extraireFiche, extraireLiensFiches, urlCategorie, type FicheArtisan,
} from '@/lib/annuaire'

// Extraction de l'annuaire des artisans, côté serveur.
//
// Serveur et pas navigateur pour deux raisons : le site n'autorise pas les
// appels cross-origin, et le débit doit être maîtrisé au même endroit pour
// tout le monde.
//
// Chaque appel est volontairement COURT (une page de liste, ou un petit lot de
// fiches) : une fonction serverless a un temps d'exécution plafonné, et un
// balayage complet le dépasserait. C'est le client qui enchaîne les appels et
// affiche la progression.

/** Identification honnête : l'administrateur du site peut nous joindre ou nous bloquer. */
const UA = 'Enezo-prospection/1.0 (+https://enezo.fr; contact@enezo.fr)'

/** Pause entre deux requêtes d'un même lot, pour ne pas marteler le site. */
const DELAI_MS = 400

/** Plafond par appel : au-delà, le risque de dépassement du temps d'exécution grandit. */
const MAX_FICHES_PAR_APPEL = 6

async function exigerAdmin(req: Request): Promise<string | null> {
  const entete = req.headers.get('authorization') ?? ''
  const token = entete.startsWith('Bearer ') ? entete.slice(7) : ''
  if (!token) return 'Jeton manquant.'
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    const snap = await getAdminDb().collection('users').doc(decoded.uid).get()
    if (!snap.exists || snap.data()?.role_app !== 'Admin') return 'Accès réservé à l\'administrateur.'
    return null
  } catch {
    return 'Jeton invalide.'
  }
}

async function recuperer(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

export async function POST(req: Request) {
  const refus = await exigerAdmin(req)
  if (refus) return NextResponse.json({ error: refus }, { status: 403 })

  let corps: { action?: string; metier?: string; page?: number; urls?: string[] }
  try {
    corps = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  /* --- Liste des fiches d'une page de catégorie --- */
  if (corps.action === 'liste') {
    const metier = (corps.metier ?? '').trim().toLowerCase()
    if (!/^[a-z0-9-]+$/.test(metier)) {
      return NextResponse.json({ error: 'Métier invalide.' }, { status: 400 })
    }
    const page = Math.max(1, Math.min(500, Number(corps.page) || 1))
    try {
      const html = await recuperer(urlCategorie(metier, page))
      return NextResponse.json({ fiches: extraireLiensFiches(html) })
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Échec de la récupération.' },
        { status: 502 },
      )
    }
  }

  /* --- Détail d'un petit lot de fiches --- */
  if (corps.action === 'fiches') {
    const urls = (corps.urls ?? [])
      // Le serveur ne récupère QUE des fiches de l'annuaire : sans ce filtre,
      // la route deviendrait un proxy vers n'importe quelle URL.
      .filter((u) => typeof u === 'string' && u.startsWith(`${ANNUAIRE_BASE}/artisan/`))
      .slice(0, MAX_FICHES_PAR_APPEL)

    if (!urls.length) return NextResponse.json({ error: 'Aucune URL exploitable.' }, { status: 400 })

    const resultats: (FicheArtisan & { erreur?: string })[] = []
    for (let i = 0; i < urls.length; i++) {
      try {
        const fiche = extraireFiche(await recuperer(urls[i]), urls[i])
        if (fiche) resultats.push(fiche)
      } catch (e) {
        resultats.push({
          url: urls[i], societe: '',
          erreur: e instanceof Error ? e.message : 'Échec',
        })
      }
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, DELAI_MS))
    }
    return NextResponse.json({ resultats })
  }

  return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 })
}
