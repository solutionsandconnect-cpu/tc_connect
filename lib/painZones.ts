// Zones de douleur du questionnaire de forme (avant séance).
// Partagé entre le formulaire (app/questionnaire) et l'affichage (planning détail).

export const ZONES_DOULEUR: { id: string; label: string }[] = [
  { id: 'tete_cou', label: 'Tête / Cou' }, { id: 'nuque', label: 'Nuque' },
  { id: 'epaule_g', label: 'Épaule G' }, { id: 'epaule_d', label: 'Épaule D' },
  { id: 'thorax', label: 'Thorax' }, { id: 'bras_g', label: 'Bras G' },
  { id: 'bras_d', label: 'Bras D' }, { id: 'av_bras_g', label: 'Avant-bras G' },
  { id: 'av_bras_d', label: 'Avant-bras D' }, { id: 'abdomen', label: 'Abdomen' },
  { id: 'lombaires', label: 'Lombaires' }, { id: 'hanches', label: 'Hanches' },
  { id: 'fessier_g', label: 'Fessier G' }, { id: 'fessier_d', label: 'Fessier D' },
  { id: 'cuisse_g', label: 'Cuisse G' }, { id: 'cuisse_d', label: 'Cuisse D' },
  { id: 'genou_g', label: 'Genou G' }, { id: 'genou_d', label: 'Genou D' },
  { id: 'mollet_g', label: 'Mollet G' }, { id: 'mollet_d', label: 'Mollet D' },
]

export const zoneDouleurLabel = (id: string) =>
  ZONES_DOULEUR.find((z) => z.id === id)?.label ?? id
