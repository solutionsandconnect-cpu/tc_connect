// Types et utilitaires partagés pour le contenu des séances de Parcours Sportif.
// Utilisés à la fois par l'éditeur de contenu d'une séance et par l'éditeur de template.

export interface Exercise {
  id: string
  name: string
  exerciceRefId?: string   // lien optionnel vers la base d'exercices
  tempsEffort: number      // secondes (ignoré pour AMRAP)
  recupEntreExos: number   // secondes (ignoré pour AMRAP)
  reps?: string            // répétitions texte libre (utilisé pour AMRAP)
  options?: string         // option à la baisse (version allégée)
  optionHausse?: string    // option à la hausse (version plus difficile)
  variant?: string         // variante si limitation physique
}

export interface Circuit {
  id: string
  name: string
  type?: 'standard' | 'amrap'
  nbTours: number
  recupEntreTours: number  // secondes
  dureeAmrap?: number      // secondes — durée totale si type AMRAP
  exercises: Exercise[]
}

// Document Firestore où est stocké le template modifiable par l'admin.
export const TEMPLATE_DOC_PATH = ['settings', 'parcours_sportif_template'] as const

export function newId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function emptyExercise(): Exercise {
  return { id: newId(), name: '', tempsEffort: 30, recupEntreExos: 10 }
}

export function emptyCircuit(index: number): Circuit {
  return {
    id: newId(),
    name: `Circuit ${index}`,
    nbTours: 3,
    recupEntreTours: 30,
    exercises: [emptyExercise()],
  }
}

// Template "usine" : sert de point de départ si aucun template n'a encore été enregistré par l'admin.
export function createStandardTemplate(): Circuit[] {
  return [
    {
      id: newId(),
      name: 'Circuit 1 - La Source (30-10)',
      nbTours: 2,
      recupEntreTours: 10,
      exercises: [
        { id: newId(), name: '', tempsEffort: 30, recupEntreExos: 10 },
        { id: newId(), name: '', tempsEffort: 30, recupEntreExos: 10 },
        { id: newId(), name: '', tempsEffort: 30, recupEntreExos: 10 },
        { id: newId(), name: '', tempsEffort: 30, recupEntreExos: 10 },
      ],
    },
    {
      id: newId(),
      name: 'Circuit 2 - Lomer (AMRAP)',
      type: 'amrap',
      nbTours: 1,
      recupEntreTours: 0,
      dureeAmrap: 300,
      exercises: [
        { id: newId(), name: '', tempsEffort: 0, recupEntreExos: 0, reps: '' },
        { id: newId(), name: '', tempsEffort: 0, recupEntreExos: 0, reps: '' },
        { id: newId(), name: 'Tour de course', tempsEffort: 0, recupEntreExos: 0, reps: '' },
      ],
    },
    {
      id: newId(),
      name: 'Circuit 3 - La Source (Tabata)',
      nbTours: 4,
      recupEntreTours: 0,
      exercises: [
        { id: newId(), name: '', tempsEffort: 20, recupEntreExos: 0 },
        { id: newId(), name: '', tempsEffort: 10, recupEntreExos: 0 },
        { id: newId(), name: '', tempsEffort: 20, recupEntreExos: 0 },
        { id: newId(), name: '', tempsEffort: 10, recupEntreExos: 0 },
      ],
    },
  ]
}

export function calcCircuitSeconds(c: Circuit): number {
  if (c.type === 'amrap') return c.dureeAmrap ?? 0
  if (c.exercises.length === 0) return 0
  const timePerTour = c.exercises.reduce((s, ex) => s + ex.tempsEffort + ex.recupEntreExos, 0)
  return timePerTour * c.nbTours + c.recupEntreTours * Math.max(0, c.nbTours - 1)
}

export function formatSeconds(sec: number): string {
  if (sec <= 0) return '0s'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}min`
  return `${m}min ${s}s`
}

// Normalise les circuits pour Firestore (qui refuse les undefined → on remplace par null).
export function cleanCircuits(circuits: Circuit[]) {
  return circuits.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type ?? null,
    nbTours: c.nbTours,
    recupEntreTours: c.recupEntreTours,
    dureeAmrap: c.dureeAmrap ?? null,
    exercises: c.exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      exerciceRefId: ex.exerciceRefId ?? null,
      tempsEffort: ex.tempsEffort,
      recupEntreExos: ex.recupEntreExos,
      reps: ex.reps ?? null,
      options: ex.options ?? null,
      optionHausse: ex.optionHausse ?? null,
      variant: ex.variant ?? null,
    })),
  }))
}
