// Visibilité des rendez-vous côté client.
//
// Un RDV « Non calé » est un créneau que le coach n'a pas encore arrêté :
// l'afficher au client lui ferait noter une date qui peut encore bouger.
//
// ⚠️ Le filtre s'applique en DEUX endroits — le hook `usePlanning` (pages
// /planning et /planning/[id]) et l'accueil, qui fait ses propres requêtes.
// D'où cette fonction partagée : dupliquer la règle, c'est se garantir qu'un
// des deux écrans finira par diverger.

export const ETAT_NON_CALE = 'Non calé'

/**
 * Le client peut-il voir ce rendez-vous ?
 *
 * Seul l'état EXPLICITEMENT « Non calé » masque le RDV. Un état absent reste
 * visible : beaucoup de rendez-vous anciens n'ont pas ce champ, et les faire
 * disparaître d'un coup du planning des clients serait pire que le problème
 * qu'on corrige.
 */
export function rdvVisiblePourClient(planning: unknown): boolean {
  const etat = (planning as { etat_planning_rdv?: string } | null)?.etat_planning_rdv
  return etat !== ETAT_NON_CALE
}
