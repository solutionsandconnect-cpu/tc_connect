// Logique pure de l'estimateur de tarif (création sur-mesure, façon freelance).
// Partagée entre la page liste Pilotage et la fiche contrat (composant EstimateurTarif).
import { randomUUID } from '@/lib/uuid'
import type { PilotageEstimation, PilotageSettings } from '@/types'

export const round10 = (n: number) => Math.round(n / 10) * 10
export const round100 = (n: number) => Math.round(n / 100) * 100
export const fmtEur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

export type TailleKey = 'xs' | 's' | 'm' | 'l' | 'xl'
export const TAILLES: Record<TailleKey, { label: string; jours: number }> = {
  xs: { label: 'Très simple', jours: 0.5 },
  s:  { label: 'Simple',      jours: 1 },
  m:  { label: 'Moyenne',     jours: 3 },
  l:  { label: 'Complexe',    jours: 6 },
  xl: { label: 'Très grosse', jours: 12 },
}

export type Feature = { id: string; nom: string; taille: TailleKey }
export const DEFAULT_FEATURES: Feature[] = [
  { id: 'f1', nom: 'Cadrage & maquettes', taille: 'm' },
  { id: 'f2', nom: 'Authentification & comptes', taille: 's' },
  { id: 'f3', nom: 'Écran principal / tableau de bord', taille: 'm' },
  { id: 'f4', nom: 'Module métier principal (CRUD)', taille: 'l' },
  { id: 'f5', nom: 'Notifications / rappels', taille: 's' },
  { id: 'f6', nom: 'Back-office admin', taille: 'm' },
]

// Catégorie par défaut des fonctionnalités de base (quand elles ne viennent pas du catalogue)
export const CATEGORIES_FEATURE_DEFAUT: Record<string, string> = {
  'Cadrage & maquettes': 'Cadrage & conception',
  'Authentification & comptes': 'Comptes & accès',
  'Écran principal / tableau de bord': 'Interface',
  'Module métier principal (CRUD)': 'Métier',
  'Notifications / rappels': 'Notifications',
  'Back-office admin': 'Administration',
}

// Aides au survol (ℹ️) : ce que couvre concrètement chaque ligne de fonctionnalité.
// Couvre les fonctionnalités par défaut + les briques du catalogue par défaut.
export const FEATURE_AIDES: Record<string, string> = {
  'Cadrage & maquettes': 'Réunions de cadrage, définition du besoin et maquettes/wireframes des écrans avant de coder.',
  'Authentification & comptes': 'Inscription, connexion, mot de passe oublié et gestion du compte utilisateur.',
  'Écran principal / tableau de bord': "Page d'accueil qui agrège les infos de plusieurs modules : résumé, widgets, raccourcis, indicateurs.",
  'Module métier principal (CRUD)': "Le cœur de l'app : créer / lister / modifier / supprimer l'objet principal (formulaire, validation, liste, fiche détail, sauvegarde en base).",
  'Notifications / rappels': 'Notifications internes et/ou push, et rappels automatiques (e-mail ou dans l’app).',
  'Back-office admin': "Espace réservé à l'administrateur : gestion des comptes/rôles, configuration, contenu et modération.",
  'Gestion des rôles & droits': 'Définir qui a accès à quoi : rôles, permissions et restrictions par écran ou par action.',
  'Recherche & filtres': 'Barre de recherche et filtres pour retrouver rapidement les données dans les listes.',
  'Génération de PDF (devis, factures, rapports)': 'Création de documents PDF brandés (devis, factures, rapports) téléchargeables.',
  'Photos / pièces jointes': 'Ajout, stockage et affichage de photos ou de fichiers joints.',
  'Calendrier / planning': 'Vue calendrier/agenda avec création et affichage d’événements.',
  'Géolocalisation / carte': 'Affichage sur carte, position GPS, itinéraires.',
  'Signature électronique': 'Faire signer un document directement dans l’app (tracé tactile).',
  'Paiement en ligne (Stripe)': 'Encaissement de paiements ou d’abonnements via Stripe.',
  'Mode hors-ligne + synchro': 'Utilisation sans connexion, puis synchronisation des données au retour du réseau.',
  'Statistiques / tableau de bord': 'Graphiques et indicateurs agrégés à partir des données de l’app.',
  'Intégrations tierces (compta, Google Agenda, SMS…)': 'Connexion à des services externes (logiciel de compta, agenda, envoi de SMS…).',
  'Import / export Excel-CSV': 'Importer des données depuis Excel/CSV et exporter les données de l’app.',
  "Historique / journal d'activité": 'Trace des actions effectuées : qui a fait quoi, et quand.',
  'Reprise des données existantes': 'Récupérer et intégrer les données déjà présentes chez le client.',
  'Formation des utilisateurs': 'Sessions de prise en main et accompagnement des utilisateurs.',
  'Recette / tests avec le client': 'Phase de tests et de corrections avec le client avant la mise en production.',
  'Déploiement stores + comptes développeur': 'Publication sur App Store / Google Play : build, comptes développeur, soumission.',
  'RGPD (consentement, export des données)': 'Mise en conformité : consentement, export et suppression des données personnelles.',
}

// Catalogue par défaut (modèle initial — sert à amorcer ton catalogue personnel)
export const DEFAULT_CATALOGUE: { groupe: string; items: { nom: string; taille: TailleKey }[] }[] = [
  {
    groupe: 'Fonctionnelles',
    items: [
      { nom: 'Gestion des rôles & droits', taille: 'm' },
      { nom: 'Recherche & filtres', taille: 's' },
      { nom: 'Génération de PDF (devis, factures, rapports)', taille: 'm' },
      { nom: 'Photos / pièces jointes', taille: 's' },
      { nom: 'Calendrier / planning', taille: 'm' },
      { nom: 'Géolocalisation / carte', taille: 'm' },
      { nom: 'Signature électronique', taille: 's' },
      { nom: 'Paiement en ligne (Stripe)', taille: 'm' },
      { nom: 'Mode hors-ligne + synchro', taille: 'l' },
      { nom: 'Statistiques / tableau de bord', taille: 'm' },
      { nom: 'Intégrations tierces (compta, Google Agenda, SMS…)', taille: 'l' },
      { nom: 'Import / export Excel-CSV', taille: 's' },
      { nom: "Historique / journal d'activité", taille: 's' },
    ],
  },
  {
    groupe: "Souvent oubliées (mais facturables)",
    items: [
      { nom: 'Reprise des données existantes', taille: 'm' },
      { nom: 'Formation des utilisateurs', taille: 's' },
      { nom: 'Recette / tests avec le client', taille: 's' },
      { nom: 'Déploiement stores + comptes développeur', taille: 's' },
      { nom: 'RGPD (consentement, export des données)', taille: 's' },
    ],
  },
]

// État complet de l'estimateur (les entrées modifiables)
export interface EstimateurState {
  mode: 'metier' | 'revente'
  features: Feature[]
  tjm: number
  overheadPct: number
  bufferPct: number
  maintPct: number
  calcInfra: number
  supportH: number
  heuresGagnees: number
  coutHoraireClient: number
  partCaptee: number
  premiumRevente: number
  nbClientsFinaux: number
  prixReventeMensuel: number
  outilsMensuel: number   // coût mensuel des outils (ex : Claude Code) — dilué dans le prix
  joursFactures: number   // jours facturés / an
  urssafPct: number       // cotisations sociales (URSSAF) en % du CA — pour le net
  remiseSetupPct: number  // remise « tarif d'ami » sur la création / mise en service (%)
  remiseAboPct: number    // remise « tarif d'ami » sur l'abonnement (%)
}

export const DEFAULT_ESTIMATEUR_STATE: EstimateurState = {
  mode: 'metier',
  features: DEFAULT_FEATURES,
  tjm: 500, overheadPct: 20, bufferPct: 25, maintPct: 18, calcInfra: 20, supportH: 1,
  heuresGagnees: 4, coutHoraireClient: 35, partCaptee: 20,
  premiumRevente: 40, nbClientsFinaux: 30, prixReventeMensuel: 40,
  outilsMensuel: 100, joursFactures: 100, urssafPct: 24.6,
  remiseSetupPct: 0, remiseAboPct: 0,
}

// Snapshot persistable (sans les id de lignes) ⇆ état du composant
export function estimationFromState(s: EstimateurState): PilotageEstimation {
  return {
    mode: s.mode, tjm: s.tjm, overheadPct: s.overheadPct, bufferPct: s.bufferPct,
    maintPct: s.maintPct, infra: s.calcInfra, supportH: s.supportH,
    heuresGagnees: s.heuresGagnees, coutHoraireClient: s.coutHoraireClient, partCaptee: s.partCaptee,
    premiumRevente: s.premiumRevente, nbClientsFinaux: s.nbClientsFinaux, prixReventeMensuel: s.prixReventeMensuel,
    outilsMensuel: s.outilsMensuel, joursFactures: s.joursFactures, urssafPct: s.urssafPct,
    remiseSetupPct: s.remiseSetupPct, remiseAboPct: s.remiseAboPct,
    features: s.features.map(({ nom, taille }) => ({ nom, taille })),
  }
}

export function stateFromEstimation(e: PilotageEstimation): EstimateurState {
  return {
    mode: e.mode, tjm: e.tjm, overheadPct: e.overheadPct, bufferPct: e.bufferPct,
    maintPct: e.maintPct, calcInfra: e.infra, supportH: e.supportH,
    heuresGagnees: e.heuresGagnees, coutHoraireClient: e.coutHoraireClient, partCaptee: e.partCaptee,
    premiumRevente: e.premiumRevente, nbClientsFinaux: e.nbClientsFinaux, prixReventeMensuel: e.prixReventeMensuel,
    outilsMensuel: e.outilsMensuel ?? DEFAULT_ESTIMATEUR_STATE.outilsMensuel,
    joursFactures: e.joursFactures ?? DEFAULT_ESTIMATEUR_STATE.joursFactures,
    urssafPct: e.urssafPct ?? DEFAULT_ESTIMATEUR_STATE.urssafPct,
    remiseSetupPct: e.remiseSetupPct ?? 0,
    remiseAboPct: e.remiseAboPct ?? 0,
    features: e.features.map((f) => ({ id: randomUUID(), nom: f.nom, taille: f.taille })),
  }
}

// Valeurs par défaut depuis les réglages globaux (sans écraser les fonctionnalités si absentes)
export function stateFromSettings(s: PilotageSettings): EstimateurState {
  const base = { ...DEFAULT_ESTIMATEUR_STATE }
  if (s.tjm != null) base.tjm = s.tjm
  if (s.overheadPct != null) base.overheadPct = s.overheadPct
  if (s.bufferPct != null) base.bufferPct = s.bufferPct
  if (s.maintPct != null) base.maintPct = s.maintPct
  if (s.infra != null) base.calcInfra = s.infra
  if (s.supportH != null) base.supportH = s.supportH
  if (s.heuresGagnees != null) base.heuresGagnees = s.heuresGagnees
  if (s.coutHoraireClient != null) base.coutHoraireClient = s.coutHoraireClient
  if (s.partCaptee != null) base.partCaptee = s.partCaptee
  if (s.premiumRevente != null) base.premiumRevente = s.premiumRevente
  if (s.nbClientsFinaux != null) base.nbClientsFinaux = s.nbClientsFinaux
  if (s.prixReventeMensuel != null) base.prixReventeMensuel = s.prixReventeMensuel
  if (s.outilsMensuel != null) base.outilsMensuel = s.outilsMensuel
  if (s.joursFactures != null) base.joursFactures = s.joursFactures
  if (s.urssafPct != null) base.urssafPct = s.urssafPct
  if (s.features && s.features.length)
    base.features = s.features.map((f) => ({ id: randomUUID(), nom: f.nom, taille: f.taille }))
  return base
}

export interface TarifResult {
  revente: boolean
  joursDev: number
  joursTotal: number
  creationBas: number
  setup: number
  tauxHoraire: number
  outilsParJour: number    // part du coût des outils (Claude Code…) répartie sur une journée facturée
  valeurAn: number
  valeurMois: number
  maintMensuelle: number
  supportMensuel: number
  aboPlancher: number
  aboValeur: number
  abo: number
  aboBase: 'valeur' | 'cout'
  total1an: number
  total3ans: number
  pctRecurrent: number
  paybackMois: number | null
  // ── Net (ce qu'il te reste après cotisations URSSAF + frais récurrents) ──
  cotisationsSetup: number     // cotisations sur la création
  netSetup: number             // création nette de cotisations
  cotisationsAboMensuel: number // cotisations sur un mois d'abonnement
  netAboMensuel: number        // abonnement net /mois (− cotisations − infra)
  netAn1: number               // net par client sur 1 an
  netAn3: number               // net par client sur 3 ans
  // ── Remise « tarif d'ami » appliquée sur les PRIX (jamais sur les coûts/plancher) ──
  hasRemise: boolean
  setupNet: number             // création après remise
  aboNet: number               // abonnement /mois après remise
  total1anNet: number          // total an 1 après remise
  total3ansNet: number         // total 3 ans après remise
  paybackMoisNet: number | null // retour sur invest. client, calculé sur le prix remisé
  netSetupRemise: number       // ce qu'il te reste sur la création, après remise
  netAboMensuelRemise: number  // ce qu'il te reste /mois, après remise
  netAn1Remise: number         // net par client sur 1 an, après remise
  netAn3Remise: number         // net par client sur 3 ans, après remise
  remiseSetupEur: number       // montant remisé sur la création
  remiseAboEur: number         // montant remisé sur l'abonnement /mois
}

export function computeTarif(s: EstimateurState): TarifResult {
  const revente = s.mode === 'revente'
  const joursDev = s.features.reduce((acc, f) => acc + TAILLES[f.taille].jours, 0)
  const joursTotal = joursDev * (1 + s.overheadPct / 100)           // dev + frais de structure
  // Outils/abonnements (ex : Claude Code) dilués : leur coût annuel réparti sur les jours facturés,
  // ajouté au TJM pour la création → chaque projet en rembourse une part.
  const outilsParJour = s.joursFactures > 0 ? (s.outilsMensuel * 12) / s.joursFactures : 0
  const tjmEffectif = s.tjm + outilsParJour
  const creationBas = round100(joursTotal * tjmEffectif)            // sans marge d'incertitude
  // En revente : prime « droits commerciaux » sur la création
  const reventeMult = revente ? 1 + s.premiumRevente / 100 : 1
  const setup = round100(joursTotal * tjmEffectif * (1 + s.bufferPct / 100) * reventeMult)
  const tauxHoraire = Math.round(s.tjm / 7)                         // jour ≈ 7 h facturables

  // Valeur générée : métier = temps gagné ; revente = revenu du revendeur
  const valeurAn = revente
    ? s.nbClientsFinaux * s.prixReventeMensuel * 12
    : s.heuresGagnees * 52 * s.coutHoraireClient
  const valeurMois = valeurAn / 12

  // Abonnement / redevance : plancher (au coût) vs part de la valeur captée → on garde le + élevé
  const maintMensuelle = (setup * s.maintPct) / 100 / 12            // TMA : % du build /an → /mois
  const supportMensuel = s.supportH * tauxHoraire
  const aboPlancher = round10(maintMensuelle + s.calcInfra + supportMensuel)
  const aboValeur = round10((valeurAn * s.partCaptee) / 100 / 12)
  const abo = Math.max(aboPlancher, aboValeur)
  const aboBase: 'valeur' | 'cout' = aboValeur > aboPlancher ? 'valeur' : 'cout'

  const total1an = setup + abo * 12
  const total3ans = setup + abo * 36
  const pctRecurrent = total3ans > 0 ? Math.round(((abo * 36) / total3ans) * 100) : 0
  const paybackMois = valeurMois > 0 ? setup / valeurMois : null

  // Net : on retire les cotisations sociales (URSSAF, % du CA) et, pour le récurrent,
  // les frais d'infra réels (Firebase/Vercel) que tu paies chaque mois.
  const taux = s.urssafPct / 100
  const cotisationsSetup = setup * taux
  const netSetup = setup - cotisationsSetup
  const cotisationsAboMensuel = abo * taux
  const netAboMensuel = abo - cotisationsAboMensuel - s.calcInfra
  const netAn1 = netSetup + netAboMensuel * 12
  const netAn3 = netSetup + netAboMensuel * 36

  // Remise « tarif d'ami » : réduction pure sur les PRIX affichés (création + abo).
  // On ne touche pas aux coûts (maintenance, plancher) : une remise commerciale ne
  // baisse pas tes charges. Tous les indicateurs « après remise » découlent du prix remisé.
  const rS = Math.min(100, Math.max(0, s.remiseSetupPct || 0)) / 100
  const rA = Math.min(100, Math.max(0, s.remiseAboPct || 0)) / 100
  const hasRemise = rS > 0 || rA > 0
  const setupNet = round100(setup * (1 - rS))
  const aboNet = round10(abo * (1 - rA))
  const total1anNet = setupNet + aboNet * 12
  const total3ansNet = setupNet + aboNet * 36
  const paybackMoisNet = valeurMois > 0 ? setupNet / valeurMois : null
  const netSetupRemise = setupNet - setupNet * taux
  const netAboMensuelRemise = aboNet - aboNet * taux - s.calcInfra
  const netAn1Remise = netSetupRemise + netAboMensuelRemise * 12
  const netAn3Remise = netSetupRemise + netAboMensuelRemise * 36
  const remiseSetupEur = setup - setupNet
  const remiseAboEur = abo - aboNet

  return {
    revente, joursDev, joursTotal, creationBas, setup, tauxHoraire, outilsParJour,
    valeurAn, valeurMois, maintMensuelle, supportMensuel, aboPlancher, aboValeur, abo, aboBase,
    total1an, total3ans, pctRecurrent, paybackMois,
    cotisationsSetup, netSetup, cotisationsAboMensuel, netAboMensuel, netAn1, netAn3,
    hasRemise, setupNet, aboNet, total1anNet, total3ansNet, paybackMoisNet,
    netSetupRemise, netAboMensuelRemise, netAn1Remise, netAn3Remise, remiseSetupEur, remiseAboEur,
  }
}
