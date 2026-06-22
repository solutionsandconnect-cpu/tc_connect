// src/types/index.ts
// Types TypeScript mappés depuis les schémas Firestore de Flutter
// Chaque type correspond à une collection Firestore

import { Timestamp } from 'firebase/firestore'

// Rôles
export type RoleApp = 'Admin' | 'Utilisateur'

// Droits d'accès par module (pour les Utilisateurs)
export interface Droits {
  planning: boolean        // Accès au planning et aux RDVs
  seances: boolean         // Accès aux séances et exercices
  notifications: boolean   // Accès aux notifications
  questionnaire: boolean   // Remplir questionnaire de forme + bilan séance (RPE, commentaire)
  compteRendu: boolean     // Voir le compte rendu du coach sur les RDVs
  exercices: boolean       // Bibliothèque d'exercices (opt-in)
  modifierProfil: boolean  // Modifier ses informations personnelles
  boutique: boolean        // Accès à la boutique
  parcoursSportif: boolean // Accès aux Parcours Sportifs (Mes Parcours)
}

export const DEFAULT_DROITS: Droits = {
  planning: true,
  seances: true,
  notifications: true,
  questionnaire: true,
  compteRendu: true,
  exercices: false,       // opt-in : désactivé par défaut
  modifierProfil: true,
  boutique: true,
  parcoursSportif: true,
}

// Collection : users
export interface User {
  id: string
  email: string
  display_name: string
  photo_url: string
  uid: string
  created_time: Timestamp
  phone_number: string
  indicatif_tel?: string
  nom: string
  prenom: string
  actif: boolean
  role_app: RoleApp
  droits?: Droits
  // Contact d'urgence (éditable depuis le profil)
  contactUrgenceNom?: string
  contactUrgenceTel?: string
  contactUrgenceRelation?: string
  lastLoginAt?: Timestamp
  accueilShortcuts?: string[]
  documentsSeenAt?: Timestamp
}

// Collection : team
export interface Team {
  id: string
  userref: string
  nom_equipe: string
  sport: string
  create_date: Timestamp
  logo: string
}

// Collection : joueurs
export interface Joueur {
  id: string
  equiperef: string
  iduserref: string
  create_date: Timestamp
  type: string
  type_staff: string
  mail_joueur: string
  prenom_joueur: string
  nom_joueur: string
  date_naissance: Timestamp
}

// Collection : planning_pro
export interface PlanningPro {
  id: string
  ref_users: string
  date_planning: Timestamp
  heure_planning_debut: Timestamp
  heure_planning_fin: Timestamp
  etat_planning_rdv: string
  adresse_rdv: string
  rdv_pret: string
  rdv_effectue: string
  observations_rdv: string
  // Questionnaire de forme
  qualite_sommeil: number
  niveau_fatigue: number
  niveau_courbatures: number
  quantite_stress: number
  motivation_avant_seance: number
  activite_derniers_jours: number
  alimentation_derniers_jours: number
  infos_complementaires_avant_seance_client: string
  questionnaire_rempli: boolean
  douleurs?: PainPoint[]
}

// Collection : seance
export interface Seance {
  id: string
  ref_planning: string
  partie_seance: string
  type_seance: string
  observations_seance: string
  nb_tours: number
  recup_tours: number
  tps_recup_exo_default?: number
  type_effort_exo_default?: string
  tps_effort_exo_default?: number
  ref_users: string
  num_circuit: number
  avancement_circuit: number
  nb_exercice: number
  intensite_circuit?: number
  intensite_circuit_planifie?: number
  date_create?: any
}

// Collection : programme_seance
export interface ProgrammeSeance {
  id: string
  ref_seance: string
  exercice: string
  explication_exercice: string
  type_effort: string
  effort: number
  recup_effort: number
  tempo_phase1: number
  tempo_phase2: number
  tempo_phase3: number
  charges?: number[]          // Charge par tour [tour1, tour2, ...]
  notes_utilisateur?: string
  nb_serie_effectuee?: number
  num_exercice?: number
  alerte_exercice?: string
  raison_alerte_exercice?: string
  intensite_exercice?: string
}

// Collection : exercices
export interface Exercice {
  id: string
  partie_prioritaire: string
  nom_exercice: string
  image_exercice: string
  video_exercice: string
  lien_exercice: string
  explications_commentees_exercice: string
  Materiel: string[]
  Muscles: string[]
}

// Collection : rpe
export interface RPE {
  id: string
  joueurref: string
  date: Timestamp
  rpe: number
  temps: number
  date_create: Timestamp
  charge_entrainement: number
  charge_aigue: number
  charge_chronique: number
  rcac: number
}

// Collection : notes_historique
export interface NoteHistorique {
  id: string
  ref_users?: any              // DocumentReference | null
  ref_client?: string          // ID direct dans la collection clients
  notes: string
  date_create: Timestamp
  type_note: string
  date_max_note_active?: Timestamp | null
}

// Collection : parcours_notes (notes sur les participants du parcours sportif)
export interface ParcoursNoteApplication {
  sessionId: string
  sessionTitle?: string
  sessionDate?: Timestamp | null
  registrationId: string
  amount: number
  appliedAt: Timestamp
}

export interface ParcoursNote {
  id: string
  participantKey: string        // clé du participant (email ou nom|prénom)
  participantName?: string      // nom dénormalisé pour affichage
  type_note: string
  notes: string
  montant?: number | null       // montant initial pour les paiements anticipés
  montantMethode?: 'cash' | 'transfer' | null // moyen de paiement de l'avance (pour les stats)
  montantConsomme?: number      // montant déjà appliqué à des séances (Option C)
  applications?: ParcoursNoteApplication[] // historique des applications
  date_create: Timestamp
  date_max_note_active?: Timestamp | null
}

// Champs des contrats légaux (portés par le contrat, réutilisés par les documents officiels)
export interface LegalFields {
  prestataireNom: string
  prestataireStatut: string
  prestataireSiret: string
  prestataireAdresse: string
  prestataireEmail: string
  prestataireTel: string
  prestataireRepresentant: string
  clientNom: string
  clientRepresentant: string
  clientAdresse: string
  clientSiret: string
  date: string
  lieu: string
  objet: string
  prixCreation: string
  prixAbo: string
  donneesTraitees: string
  finalites: string
  personnesConcernees: string
  dureeConservation: string
  sousTraitantsUlterieurs: string
  etendueDroits: string
  exclusivite: string
  territoire: string
  duree: string
  // Forfait d'ajustements inclus après validation de la maquette (clause du contrat de prestation)
  ajustementsInclus: string
  // Avenant (lot d'évolutions hors périmètre, facturé en plus)
  avenantObjet: string
  avenantPrix: string
  avenantDelai: string
}

// Contenu structuré « projet » (partagé par le contrat, réutilisé par les documents)
export interface ProjetFonction { categorie: string; description: string }
export interface ProjetPlanning {
  etape: string
  description: string
  date: string            // date résolue (AAAA-MM-JJ) ; statut dérivé de la date (passée = faite)
  dureeJours?: number     // délai en jours jusqu'à l'étape suivante (cascade)
  ancre?: boolean         // true = date fixée à la main (non recalculée)
  responsable: string     // 'Développeur' | 'Client' | 'Les deux' (chips ; texte libre toléré pour l'existant)
}
export interface ProjetTache { description: string; date: string; fait: boolean; pour: 'client' | 'sc' } // pour = qui réalise la tâche (client ou moi/S&C)
export interface ProjetContent {
  contexte: string
  fonctionnalites: ProjetFonction[]
  livrables: string[]
  horsPerimetre: string[]   // ce qui n'est PAS compris dans la prestation
  planning: ProjetPlanning[]
  taches: ProjetTache[]     // liste unique ; chaque tâche indique si elle est « pour » le client ou pour moi
}

// Snapshot des entrées du calculateur de tarif, attaché au contrat pour pouvoir rouvrir/ajuster le calcul.
export interface PilotageEstimationFeature { nom: string; taille: 'xs' | 's' | 'm' | 'l' | 'xl' }
export interface PilotageEstimation {
  mode: 'metier' | 'revente'
  tjm: number
  overheadPct: number
  bufferPct: number
  maintPct: number
  infra: number
  supportH: number
  heuresGagnees: number
  coutHoraireClient: number
  partCaptee: number
  premiumRevente: number
  nbClientsFinaux: number
  prixReventeMensuel: number
  features: PilotageEstimationFeature[]
}

// Collection : pilotage_contrats (pilotage de l'activité — contrats clients pro)
export type PilotageContratStatut = 'actif' | 'pause' | 'termine'

export interface PilotageContrat {
  id: string
  clientId?: string | null      // client relié (collection clients)
  clientNom: string             // nom du client / entreprise
  abonnementId?: string | null  // abonnement relié (collection abonnements)
  abonnementTitre?: string | null // libellé de l'abonnement relié (affichage)
  appNom?: string               // (déprécié) ancienne « app vendue »
  fraisMiseEnPlace?: number     // frais ponctuels au démarrage
  abonnementMensuel?: number    // revenu récurrent /mois
  coutFirebaseMensuel?: number  // coût d'infra estimé /mois (pour la marge)
  dateDebut?: Timestamp
  premiereAnnee?: boolean       // tarif « 1ère année » → à revoir ensuite
  tarifAnnee2Defini?: boolean   // le tarif année 2 a-t-il été décidé ?
  devisId?: string | null       // devis validé relié (source de vérité du deal)
  devisNumber?: string | null   // numéro du devis relié (affichage)
  statut: PilotageContratStatut
  notes?: string
  projet?: ProjetContent       // contenu projet partagé (rempli une fois, réutilisé par les documents)
  legal?: LegalFields          // infos des documents officiels (prestataire, client, RGPD, licence…)
  estimation?: PilotageEstimation // snapshot du calculateur de tarif (pour rouvrir/ajuster le calcul)
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// Collection : pilotage_catalogue (briques de fonctionnalités réutilisables pour l'estimateur)
export interface PilotageCatalogueItem {
  id: string
  nom: string
  taille: 'xs' | 's' | 'm' | 'l' | 'xl'  // mappe sur TAILLES (jours d'effort)
  groupe: string                          // ex : « Fonctionnelles », « Souvent oubliées »
  createdAt: Timestamp
}

// Collection : pilotage_documents (documents projet & contrats légaux reliés à un contrat)
export type PilotageDocumentType =
  | 'cahier_charges' | 'besoins_client' | 'bilan'   // documents projet
  | 'prestation' | 'dpa_rgpd' | 'cgv' | 'licence' | 'avenant'   // contrats légaux

export type PilotageDocumentStatut = 'brouillon' | 'finalise' | 'signe'

export interface PilotageDocument {
  id: string
  contratId: string
  clientNom?: string
  type: PilotageDocumentType
  titre: string
  version: string
  statut: PilotageDocumentStatut
  contenu?: Record<string, unknown>   // données structurées (remplies aux phases suivantes)
  signe?: boolean
  signeLe?: Timestamp | null
  signatairePar?: string | null
  signatureUrl?: string | null        // image de la signature (Storage)
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// Collection : pilotage_settings (valeurs par défaut du calculateur de tarif)
export interface PilotageSettings {
  tjm?: number
  overheadPct?: number
  bufferPct?: number
  maintPct?: number
  infra?: number
  supportH?: number
  heuresGagnees?: number
  coutHoraireClient?: number
  partCaptee?: number
  // Mode « app à revendre » (revendeur / marque blanche)
  premiumRevente?: number      // % en plus sur la création (droits commerciaux)
  nbClientsFinaux?: number     // clients finaux visés par le revendeur
  prixReventeMensuel?: number  // prix de revente par client final /mois
  // Liste de fonctionnalités de départ du calculateur (durée/complexité par défaut)
  features?: { nom: string; taille: 'xs' | 's' | 'm' | 'l' | 'xl' }[]
  // Étapes-types proposées dans le planning prévisionnel (liste déroulante éditable)
  planningEtapes?: string[]
  // Modèle de planning prévisionnel (généré en un clic, éditable) — dates ignorées, recalculées à la génération
  planningTemplate?: ProjetPlanning[]
}

// Collection : Notifications
export interface Notification {
  id: string
  refUsers: string
  type_notification: string
  notification: string
  etat_notification: string
  date_create: Timestamp
  date_lecture: Timestamp
  date_declenchement: Timestamp
  action_via_planning: string
  type_vue_pour_cond_action: string
  url?: string
  ref_planning?: any
}

// Collection : calendrier_team
export interface CalendrierTeam {
  id: string
  teamref: string
  date: Timestamp
  heure_debut: Timestamp
  heure_fin: Timestamp
  event: string
  create_date: Timestamp
}

// Collection : seances_equipe
export interface SeanceEquipe {
  id: string
  teamId: string
  date: Timestamp
  heureDebut?: string        // "HH:MM"
  type: 'Entraînement' | 'Match' | 'Physique' | 'Technique' | 'Tactique' | 'Récupération'
  dureeMin: number           // durée prévue en minutes
  notes?: string
  statut: 'planifiée' | 'terminée' | 'annulée'
  joueurIds: string[]        // IDs des joueurs participants
  hoopers: Record<string, {  // clé = joueurId
    sommeil: number; fatigue: number; courbatures: number; stress: number
    indiceHooper: number; submittedAt: Timestamp
  }>
  rpes: Record<string, {     // clé = joueurId
    rpe: number; dureeMin: number; charge: number; submittedAt: Timestamp
  }>
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// Collection : database_users_details (Flutter app — ne pas modifier)
export interface DatabaseUsersDetails {
  id: string
  refUsers?: string
  titre_abo?: string
  categorie_prestation: string
  type_suivi: string
  resume_suivi: string
  objectifs: string
  date_debut?: Timestamp
  date_fin?: Timestamp
  indications: string
  arret_suivi: string
  etat: string
}

// ─── Système de facturation (collections indépendantes) ──────────────────────

// ─── Sous-types fiche client ─────────────────────────────────────────────────

export interface Objectif {
  texte: string
  priorite: 'Primaire' | 'Secondaire' | 'Tertiaire'
  dateObjectif?: string
  donneeChiffree?: string
  commentaire?: string
}

export interface MouvementDetail {
  label: string
  intensite: number   // 0-10
}

export interface ZoneCorporelle {
  partie: string       // ex : "Épaule", "Genou"
  cote?: string        // "Gauche" | "Droite" | "Bilatéral"
  structure?: string   // ex : "LCA", "Coiffe des rotateurs"
}

export interface AntecedentMedical {
  description: string
  typeBlessure?: string          // 'Osseuse' | 'Tendineuse' | 'Musculaire' | 'Ligamentaire' | 'Neurologique' | 'Chronique / Maladie' | 'Autre'
  estContreIndication?: boolean  // contre-indication pour les exercices
  estChronique?: boolean         // condition permanente (asthme, diabète...)
  cote?: string                  // legacy global side (kept for backward compat)
  zonesCorps?: ZoneCorporelle[]  // zones anatomiques avec côté et structure
  anneeDebut?: string
  anneeFin?: string              // vide si toujours présent
  arretSport?: string            // ex: "3 mois", "6 semaines"
  douleurPresente?: boolean
  mouvementsDetail?: MouvementDetail[]   // mouvements douloureux avec intensité par mouvement
  // Legacy — kept for backward-compat reading of old Firestore docs
  gradeDouleur?: number          // 0-10 (remplacé par intensite dans mouvementsDetail)
  mouvementsDouloureux?: string  // comma-separated (remplacé par mouvementsDetail)
  operation?: boolean
  dateOperation?: string         // ISO date
  // Legacy
  annee?: string
}

export interface AntecedentSportif {
  sport: string
  anneeDebut: string
  anneeFin: string
  niveau: string
}

export interface MaterialItem {
  nom: string
  localisation?: string
  observations?: string
}

export interface StructureItem {
  nom: string
  adresse?: string
  observations?: string
}

export interface AutreCoachItem {
  service?: string
  nom?: string
  tel?: string
  mail?: string
  observations?: string
}

export interface SuiviPasse {
  service?: string
  nom?: string
  tel?: string
  mail?: string
  observations?: string
}

export interface PlanningSlot {
  activite: string
  heureDebut?: string
  duree?: string
}

// Legacy — kept for backward-compat reading of old Firestore docs
export interface ContraindicationItem {
  description: string
  annee: string
  gravite: string
  cote: string
}

export interface ContactSupplementaire {
  label?: string        // ex: "Employeur", "Conjoint", "Société"
  nom?: string
  prenom?: string
  adresse?: string
  codePostal?: string
  ville?: string
  telephone?: string
  email?: string
  factureParDefaut?: boolean   // utiliser ces coordonnées par défaut pour la facturation
}

// Collection : clients (indépendant de Firebase Auth)
export interface Client {
  id: string
  userId: string            // UID du coach propriétaire
  prenom: string
  nom: string
  email?: string
  telephone?: string
  indicatif_tel?: string
  genre?: string
  dateNaissance?: Timestamp
  adresse?: string
  ville?: string
  codePostal?: string
  profession?: string
  sportPratique?: string
  niveauSportif?: string    // Loisir / Débutant / Intermédiaire / Confirmé / Expert
  // Champs structurés
  objectifs?: Objectif[]
  antecedentsMedicaux?: AntecedentMedical[]
  antecedentsSportifs?: AntecedentSportif[]
  // Équipement & services (nouvelle structure tableau)
  materielItems?: MaterialItem[]
  structureItems?: StructureItem[]
  autreCoachItems?: AutreCoachItem[]
  suivisPassesItems?: SuiviPasse[]
  // Contact d'urgence
  contactUrgenceNom?: string
  contactUrgenceTel?: string
  contactUrgenceRelation?: string
  // Logistique séances
  lieuSeance?: string
  lieuSeanceLat?: number
  lieuSeanceLng?: number
  distanceKm?: number
  tempsRouteSeance?: string
  nbSeancesParSemaine?: number
  nbSeancesMin?: number
  nbSeancesMax?: number
  planningSlots?: Record<string, PlanningSlot[]>
  planningDispoSlots?: Record<string, string[]>
  // Conditions de vie
  joursTravail?: string[]
  positionTravail?: string
  tempsRouteTravail?: string
  tempsTravailSemaine?: string
  // NAP
  napCategorie?: string
  // Commercial
  statut?: 'Prospect' | 'Actif' | 'Inactif'
  commentConnuCoach?: string
  // Entreprise
  siret?: string
  nomEntreprise?: string
  adresseEntreprise?: string
  representantEntreprise?: string   // nom du représentant légal (pour les contrats)
  // Contacts supplémentaires (facturation alternative)
  contactsSupplementaires?: ContactSupplementaire[]
  // Legacy (rétrocompat lectures anciennes données Firestore)
  contraindicationsList?: ContraindicationItem[]
  materielMaison?: boolean
  materielMaisonDetail?: string
  structureRemiseForme?: boolean
  structureRemiseFormeDetail?: string
  autreCoach?: boolean
  autreCoachNom?: string
  autreCoachTel?: string
  autreCoachMail?: string
  autreCoachService?: string
  planningType?: Record<string, string>
  objectifsPrincipaux?: string
  antecedentsMedicauxLegacy?: string
  contraindications?: string
  notes?: string
  linkedUserId?: string           // Lien optionnel vers collection users (compte app)
  seanceAccessExpiry?: Timestamp  // Date d'expiration d'accès aux séances en ligne (après arrêt)
  actif: boolean
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// Collection : companies (sociétés de facturation)
export interface Company {
  id: string
  userId: string            // UID du coach propriétaire
  nom: string
  adresse?: string
  codePostal?: string
  ville?: string
  email?: string
  telephone?: string
  representant?: string      // nom du représentant légal (pour les contrats)
  siret?: string
  tva?: string
  iban?: string
  bic?: string
  logoUrl?: string
  mentionsLegales?: string
  couleurPrimaire?: string  // ex : "#2563eb"
  cgv?: string              // Conditions générales de vente (texte complet)
  cgvDate?: string          // Date de mise à jour des CGV (ex : "2024-01-15")
  createdAt: Timestamp
}

// ─── Douleurs (questionnaire de forme) ───────────────────────────────────────
export interface PainPoint {
  zone: string           // ex: "genou_g", "lombaires"
  intensite: number      // 0-10
  type: string           // ex: "Pincement", "Brûlure", "Élancement"
}

// Collection : abonnements
export type AbonnementEtat = 'Prospect' | 'Actif' | 'Inactif' | 'En attente' | 'Terminé' | 'Suspendu'

export interface Abonnement {
  id: string
  userId: string            // UID du coach
  clientId: string
  companyId?: string
  companyNom?: string
  titre?: string            // kept for backward compat
  categorie: string         // 'Teddy Coaching' | 'FFD' | 'EMF' | 'S&C'
  typeSuivi?: string        // kept for backward compat
  frequence?: string
  tarifUnitaire?: number
  tarifLabel?: string
  dateDebut?: Timestamp
  dateFin?: Timestamp
  etat: AbonnementEtat
  nbSeancesTotal?: number
  objectifs?: Objectif[]
  resumeSuivi?: string      // kept for backward compat
  indications?: string
  contraindications?: string // kept for backward compat
  notes?: string             // kept for backward compat
  notesInternes?: Array<{ texte: string; type_note: string }>
  arretSuivi?: string   // raison de non reconduction (écrit aussi dans database_users_details.arret_suivi)
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// Collection : factures
export type FactureStatus = 'draft' | 'pending' | 'sent' | 'paid' | 'encaissement' | 'overdue' | 'cancelled' | 'accepted' | 'rejected'
export type FactureType = 'facture' | 'devis'

export interface FactureItem {
  label: string
  quantity: number
  price: number
  discountType?: 'percent' | 'amount'
  discountValue?: number
}

export interface Echeance {
  date: Timestamp
  montant: number
  statut: 'en_attente' | 'payé'
  label?: string
}

export interface EcheanceRef {
  label: string    // libellé de l'échéance (ex : "Acompte 50%")
  montant: number  // montant de cette échéance uniquement
  index: number    // 0-based
  count: number    // nombre total d'échéances du devis
  cumulPrecedent?: number  // somme des échéances précédentes (déjà réglées avant celle-ci)
}

export interface Facture {
  id: string
  userId: string
  clientId: string
  clientName: string
  companyId?: string
  companyNom?: string
  abonnementId?: string
  abonnementTitre?: string
  number: string
  status: FactureStatus
  type: FactureType
  items: FactureItem[]
  total: number
  echeances?: Echeance[]
  echeanceRef?: EcheanceRef  // présent sur les factures issues d'un devis à échéancier
  notes?: string
  date?: Timestamp                  // Date d'émission du document (modifiable)
  dateEcheance?: Timestamp          // Date de paiement prévue (échéancier uniquement)
  devisRef?: string                 // ID du devis d'origine
  devisNumber?: string              // Numéro du devis d'origine
  signed?: boolean                  // Devis signé électroniquement
  signedAt?: Timestamp
  signatureUrl?: string              // URL Firebase Storage de l'image de signature
  pdfUrl?: string                    // URL Firebase Storage du PDF généré
  convertedToFactureId?: string      // Facture créée depuis ce devis (legacy single)
  convertedToFactureIds?: string[]   // Toutes les factures créées depuis ce devis
  clientLinkedUserId?: string          // Firebase Auth UID du client (pour requêtes côté utilisateur)
  clientAddress?: string
  clientVille?: string
  clientCodePostal?: string
  // Coordonnées de facturation (override si différent du client)
  factureNom?: string
  factureAdresse?: string
  factureCodePostal?: string
  factureVille?: string
  factureEmail?: string
  paymentDate?: Timestamp
  paymentMethod?: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ─── URSSAF ───────────────────────────────────────────────────────────────────

export interface UrssafPeriode {
  id: string
  userId: string
  annee: number
  mois: number            // 1-12
  taux: number            // taux de cotisations en % (ex: 24.2)
  declare: boolean
  dateDeclaration?: Timestamp
  regle: boolean
  dateReglement?: Timestamp
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// ─── Boutique / Store ─────────────────────────────────────────────────────────

export interface StoreApp {
  id: string
  nom: string
  shortDesc: string        // accroche courte pour la carte
  description: string      // texte long
  icon: string             // emoji (fallback si pas de logo image)
  iconUrl?: string         // logo image (URL Firebase Storage) — prioritaire sur l'emoji
  couleur: string          // hex e.g. "#6366f1"
  prix: number
  periodicite: 'mensuel' | 'annuel' | 'unique'
  actif: boolean
  ordre: number
  route?: string           // route interne e.g. "/boutique/belote"
  tags?: string[]
  visibleUserIds?: string[]
  hiddenUserIds?: string[]
  changelogs?: StoreChangelog[]
  limitesConfig?: StoreLimiteConfig[]
  createdBy: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface StoreReview {
  id: string
  appId: string
  userUid: string
  clientNom: string
  rating: number           // 1-5
  comment?: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

export interface StoreChangelog {
  id: string
  title: string
  description?: string
  type: 'update' | 'upcoming'
  date: Timestamp
}

export interface StoreLimiteConfig {
  key: string
  label: string
  defaultValue: number
}

export type StoreSubStatut = 'active' | 'suspended' | 'cancelled' | 'pending'

export type StoreSubEventType =
  | 'created'        // demande de souscription
  | 'activated'      // accès validé / activé par l'admin
  | 'renewed'        // paiement validé / renouvelé
  | 'reminder'       // relance envoyée
  | 'suspended'      // suspendu (échéance dépassée ou admin)
  | 'cancelled'      // annulé / arrêté
  | 'unsubscribed'   // désabonnement par l'utilisateur
  | 'archived'       // archivé (retiré des alertes)
  | 'cleaned'        // données purgées

export interface StoreSubEvent {
  type: StoreSubEventType
  date: Timestamp
  note?: string
}

export interface StoreSubscription {
  id: string
  appId: string
  appNom: string
  clientId?: string
  clientNom: string
  clientEmail?: string
  userUid?: string         // UID TC Connect — pour contrôle d'accès
  prix?: number            // tarif au moment de la commande (apps payantes)
  statut: StoreSubStatut
  dateDebut: Timestamp
  dateFin?: Timestamp | null
  factureId?: string
  factureNumber?: string
  notes?: string
  limites?: Record<string, number>
  nextPaymentDate?: Timestamp | null   // prochaine échéance de paiement (apps payantes)
  lastPaymentAt?: Timestamp | null      // dernier paiement validé
  archivedAt?: Timestamp | null         // date d'archivage (abonnement terminé/arrêté)
  dataCleanedAt?: Timestamp | null      // date de purge des données de l'utilisateur (après archivage)
  events?: StoreSubEvent[]              // historique complet (demande, validation, ...)
  createdBy: string
  createdAt: Timestamp
  updatedAt?: Timestamp
}

// ─── Suivi Bébé ───────────────────────────────────────────────────────────────

/** Document Firestore : babies/{babyId} */
export interface Bebe {
  id: string
  name: string
  birthDate: Timestamp
  members: string[]
  createdBy: string
  createdAt: Timestamp
  /** Photo du bébé (URL Firebase Storage) */
  photoUrl?: string
  /** Sommeil en cours — défini au "Start", supprimé au "Réveillé !" */
  activeSleep?: { startTime: Timestamp } | null

  // ── Arrivée du bébé (faire-part) ──────────────────────────────────────────
  /** Sexe — sert à accorder les messages ({ne} → né/née) */
  sex?: 'boy' | 'girl'
  /** Poids de naissance en grammes (ex : 3450) */
  birthWeightG?: number
  /** Taille de naissance en cm (ex : 50) */
  birthHeightCm?: number
  /** Heure de naissance "HH:MM" */
  birthTime?: string
  /** Modèles de message d'annonce, assignables aux contacts */
  arrivalTemplates?: ArrivalTemplate[]
}

/** Modèle de message d'annonce de naissance (stocké sur le doc bébé) */
export interface ArrivalTemplate {
  id: string
  label: string
  /** Corps avec variables : {prenom} {poids} {taille} {date} {heure} {ne} {sexe} */
  body: string
}

/** Document Firestore : babies/{babyId}/contacts/{contactId} */
export interface BebeContact {
  id: string
  name: string
  /** Indicatif pays, ex : "+33" */
  indicatif: string
  telephone: string
  /** Modèle de message assigné (id d'un ArrivalTemplate) */
  templateId?: string
  createdAt: Timestamp
  /** Date d'envoi du message (null/absent = pas encore envoyé) */
  sentAt?: Timestamp | null
  /** Canal utilisé pour l'envoi */
  sentVia?: 'sms' | 'whatsapp' | null
}

export type BebeEventType = 'bottle' | 'diaper' | 'sleep' | 'meds'

/** Document Firestore : babies/{babyId}/events/{eventId} */
export interface BebeEvent {
  id: string
  type: BebeEventType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
  timestamp: Timestamp
  createdBy: string
}

// ─── CheckConnect (listes / checklists) ────────────────────────────────────────

export type TripType =
  | 'vacances'
  | 'hotel' | 'camping' | 'airbnb' | 'roadtrip' | 'cruise'
  | 'ski' | 'city' | 'beach'
  | 'shopping' | 'event' | 'home' | 'work' | 'sport'
  | 'other'
  | (string & {})

export type TripRole = 'owner' | 'member'
export type TripPermission = 'view' | 'check' | 'edit'  // niveaux d'accès des liens de partage publics
export type TripMemberPermission = 'admin' | 'editor' | 'contributor' | 'viewer'

export interface TripAttachment {
  id: string
  type: 'link' | 'photo' | 'file'
  url: string
  name?: string
  mimeType?: string
}

export interface InviteLink {
  id: string          // = token (Firestore doc id)
  tripId: string
  permission: TripPermission
  label?: string
  inviteEmail?: string   // email pré-renseigné (partage par email)
  nom?: string           // NOM pré-renseigné
  prenom?: string        // prénom pré-renseigné
  createdAt: unknown     // Timestamp côté client, { _seconds } côté Admin
  createdBy: string
}

/** Membre d'une liste CheckConnect */
export interface TripMember {
  uid: string         // uid du compte, ou "guest:<token>" pour un invité sans compte
  role: TripRole
  permission?: TripMemberPermission
  checkMode?: 'all' | 'assigned'
  isGuest?: boolean   // invité par email, sans compte TC Connect (encore)
  nom?: string
  prenom?: string
  email?: string
  photoUrl?: string   // photo de profil TC Connect (dénormalisée)
}

export interface TripItem {
  id: string
  name: string
  qtyNeeded: number              // quantité fixe nécessaire
  qtyReady: number               // quantité déjà prête
  multiplier: number             // si > 0 : qtyEffective = ceil(multiplier × nbJours)
  note?: string
  assigneeId?: string | null     // uid du membre responsable
  dueDate?: string | null        // date limite ISO (YYYY-MM-DD)
  attachments?: TripAttachment[]
  position: number
}

export interface TripSection {
  id: string
  title: string
  position: number
  items: TripItem[]
}

/** Document Firestore : trips/{tripId} */
export interface Trip {
  id: string
  name: string
  type: TripType
  icon: string
  color: string
  dateFrom?: Timestamp | null
  dateTo?: Timestamp | null
  isTemplate: boolean
  archived?: boolean
  favoritedBy?: string[]         // UIDs des membres qui ont mis en favori
  ownerId: string
  memberIds: string[]
  members: TripMember[]
  sections: TripSection[]
  createdAt: Timestamp
  updatedAt?: Timestamp
}
