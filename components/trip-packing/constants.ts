import type { TripType } from '@/types'

export const TRIP_TYPES: { value: TripType; label: string; icon: string }[] = [
  { value: 'hotel',    label: 'Hôtel',     icon: '🏨' },
  { value: 'camping',  label: 'Camping',   icon: '⛺' },
  { value: 'airbnb',   label: 'Airbnb',    icon: '🏠' },
  { value: 'roadtrip', label: 'Road trip', icon: '🚐' },
  { value: 'cruise',   label: 'Croisière', icon: '🛳️' },
  { value: 'ski',      label: 'Ski',       icon: '🎿' },
  { value: 'city',     label: 'City trip', icon: '🏙️' },
  { value: 'beach',    label: 'Plage',     icon: '🏖️' },
  { value: 'other',    label: 'Autre',     icon: '🧳' },
]

export const TRIP_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b',
]

export const TRIP_EMOJIS = [
  '🧳', '🏖️', '⛺', '🎿', '🏔️', '🛳️',
  '🚐', '🏨', '🌴', '🎒', '✈️', '🗺️',
]

export function tripTypeLabel(type: TripType): string {
  return TRIP_TYPES.find(t => t.value === type)?.label ?? 'Autre'
}
