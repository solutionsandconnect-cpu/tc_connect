// src/types/index.ts
// Types TypeScript mappés depuis les schémas Firestore de Flutter
// Chaque type correspond à une collection Firestore

import { Timestamp } from 'firebase/firestore'

// Rôles
export type RoleApp = 'Admin' | 'Utilisateur'

// Collection : users
export interface User {
  id: string
  email: string
  display_name: string
  photo_url: string
  uid: string
  created_time: Timestamp
  phone_number: string
  nom: string
  prenom: string
  actif: boolean
  role_app: RoleApp
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
  motiv_avant_seance: number
  activite_avant_seance: number
  alimentation_avant_seance: number
  commentaire_forme: string
  questionnaire_rempli: boolean
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
  ref_users: string
  num_circuit: number
  avancement_circuit: number
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
  ref_users: string
  notes: string
  date_create: Timestamp
  type_note: string
  date_max_note_active: Timestamp
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

// Collection : database_users_details
export interface DatabaseUsersDetails {
  id: string
  categorie_prestation: string
  type_suivi: string
  resume_suivi: string
  objectifs: string
  date_debut: Timestamp
  date_fin: Timestamp
  indications: string
  arret_suivi: string
  etat: string
}