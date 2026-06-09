import type { TripType } from '@/types'

export const TRIP_TYPES: { value: TripType; label: string; icon: string }[] = [
  // Voyage
  { value: 'vacances', label: 'Vacances',   icon: '🌴' },
  { value: 'hotel',    label: 'Hôtel',      icon: '🏨' },
  { value: 'camping',  label: 'Camping',    icon: '⛺' },
  { value: 'airbnb',   label: 'Airbnb',     icon: '🏡' },
  { value: 'roadtrip', label: 'Road trip',  icon: '🚐' },
  { value: 'cruise',   label: 'Croisière',  icon: '🛳️' },
  { value: 'ski',      label: 'Ski',        icon: '🎿' },
  { value: 'city',     label: 'City trip',  icon: '🏙️' },
  { value: 'beach',    label: 'Plage',      icon: '🏖️' },
  // Général
  { value: 'shopping', label: 'Courses',    icon: '🛒' },
  { value: 'event',    label: 'Événement',  icon: '🎉' },
  { value: 'home',     label: 'Maison',     icon: '🏠' },
  { value: 'work',     label: 'Travail',    icon: '💼' },
  { value: 'sport',    label: 'Sport',      icon: '🏋️' },
  { value: 'other',    label: 'Autre',      icon: '📋' },
]

export const TRIP_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

export const TRIP_EMOJIS = [
  // Génériques
  '📋', '✅', '🎯', '📝', '⭐', '🔔', '💡', '🎉', '🛒', '💼',
  // Voyages
  '🧳', '✈️', '🗺️', '🛳️', '🚐', '🏨', '⛺', '🎿', '🏖️', '🌴', '🏔️', '🎒',
]

export function tripTypeLabel(type: TripType): string {
  return TRIP_TYPES.find(t => t.value === type)?.label ?? (type || 'Autre')
}

/** Noms de sections suggérés */
export const SUGGESTED_SECTIONS: string[] = [
  'Vêtements', 'Chaussures', 'Sous-vêtements', 'Manteaux & Vestes',
  'Hygiène', 'Trousse de toilette', 'Médicaments & Santé',
  'Électronique', 'Câbles & Chargeurs', 'Appareils photo & Vidéo',
  'Documents', 'Administratif', 'Papiers importants',
  'Alimentation', 'Courses', 'Nourriture & Boissons', 'Cuisine & Vaisselle',
  'Sport & Activités', 'Matériel de camping', 'Équipement outdoor',
  'Bébé & Enfants', 'Animaux', 'Jouets & Loisirs',
  'Maison & Entretien', 'Jardinage', 'Bricolage',
  'Travail & Bureau', 'Fournitures de bureau',
  'Transport & Déplacements', 'Voiture',
  'Divertissement', 'Livres & Musique',
  'Cadeaux', 'Souvenirs',
  'À acheter', 'À faire avant le départ', 'À vérifier',
  'Urgent', 'Optionnel',
]

/** Items suggérés par défaut pour l'autocomplete dans les sections */
export const SUGGESTED_ITEMS: string[] = [
  // Courses / Alimentation
  'Lait', 'Œufs', 'Pain', 'Beurre', 'Fromage', 'Yaourts', 'Crème fraîche',
  'Poulet', 'Bœuf haché', 'Poisson', 'Jambon', 'Saumon',
  'Pâtes', 'Riz', 'Farine', 'Semoule', 'Quinoa',
  'Tomates', 'Salade', 'Oignons', 'Pommes de terre', 'Carottes', 'Courgettes',
  'Champignons', 'Poivrons', 'Brocolis', 'Épinards', 'Ail',
  'Pommes', 'Bananes', 'Oranges', 'Fraises', 'Raisins', 'Citrons',
  'Huile d\'olive', 'Sel', 'Poivre', 'Sucre', 'Miel', 'Sauce tomate',
  'Café', 'Thé', 'Eau', 'Jus d\'orange', 'Lait végétal',
  'Bière', 'Vin', 'Chocolat', 'Biscuits', 'Chips',
  // Hygiène / Maison
  'Shampooing', 'Après-shampooing', 'Gel douche', 'Savon',
  'Dentifrice', 'Brosse à dents', 'Déodorant', 'Rasoir',
  'Papier toilette', 'Coton', 'Mouchoirs',
  'Lessive', 'Liquide vaisselle', 'Essuie-tout', 'Sacs poubelle', 'Éponges',
  // Voyage / Packing
  'Passeport', 'Carte d\'identité', 'Billet', 'Réservation hôtel',
  'Valise', 'Vêtements', 'Chaussures', 'Pyjama',
  'Chargeur', 'Adaptateur', 'Écouteurs', 'Batterie externe',
  'Médicaments', 'Trousse de toilette', 'Crème solaire', 'Répulsif insectes',
  'Lunettes de soleil', 'Maillot de bain', 'Serviette de plage',
  'Guide de voyage', 'Monnaie locale', 'Assurance voyage',
  // Travail / Bureau
  'Ordinateur', 'Câble chargeur', 'Clé USB', 'Souris', 'Casque audio',
  'Bloc-notes', 'Stylos', 'Carte de visite', 'Documents', 'Présentation',
  'Badge', 'Agenda',
  // Maison / Tâches
  'Faire la vaisselle', 'Passer l\'aspirateur', 'Faire les lits',
  'Sortir les poubelles', 'Arroser les plantes', 'Repassage',
  'Nettoyer la salle de bain', 'Nettoyer la cuisine', 'Vider le lave-vaisselle',
  // Événement / Fête
  'Invitations', 'Décoration', 'Gâteau', 'Bougies', 'Ballons',
  'Boissons', 'Nourriture', 'Serviettes', 'Assiettes jetables',
  'Musique', 'Photos', 'Cadeaux', 'Sacs cadeaux',
  // Sport / Activité
  'Chaussures de sport', 'Tenue de sport', 'Gourde', 'Serviette',
  'Ballon', 'Casque', 'Protections', 'Raquette', 'Sac de sport',
]
