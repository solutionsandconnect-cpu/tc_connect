import { InformationCircleIcon, ExclamationTriangleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import type { ParcoursIndication, ParcoursIndicationNiveau } from '@/types'
import { NIVEAU_INDICATION } from '@/lib/parcoursIndications'

const ICONS: Record<ParcoursIndicationNiveau, typeof InformationCircleIcon> = {
  info: InformationCircleIcon,
  avertissement: ExclamationTriangleIcon,
  urgent: ExclamationCircleIcon,
}

// Une indication peut être complète (Firestore) ou une ébauche pour la prévisualisation admin.
type IndicationLike = Pick<ParcoursIndication, 'titre' | 'message' | 'niveau'>

export function IndicationBanner({ indication, compact = false }: { indication: IndicationLike; compact?: boolean }) {
  const st = NIVEAU_INDICATION[indication.niveau]
  const Icon = ICONS[indication.niveau]
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${st.wrap}`}>
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${st.icon}`} />
      <div className="min-w-0">
        {indication.titre && (
          <p className={`font-semibold leading-snug ${compact ? 'text-xs' : 'text-sm'}`}>{indication.titre}</p>
        )}
        {indication.message && (
          <p className={`${compact ? 'text-[11px]' : 'text-xs'} leading-snug whitespace-pre-wrap opacity-90`}>{indication.message}</p>
        )}
      </div>
    </div>
  )
}

export function IndicationList({
  indications, compact = false, className = '',
}: { indications: ParcoursIndication[]; compact?: boolean; className?: string }) {
  if (indications.length === 0) return null
  return (
    <div className={`space-y-2 ${className}`}>
      {indications.map((i) => <IndicationBanner key={i.id} indication={i} compact={compact} />)}
    </div>
  )
}
