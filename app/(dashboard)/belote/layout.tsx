import type { Metadata } from 'next'
import { storeAppMetadata } from '@/lib/storeAppMetadata'

/** Icône + nom du raccourci « Ajouter à l'écran d'accueil » pour cette app. */
export async function generateMetadata(): Promise<Metadata> {
  return storeAppMetadata('/belote', 'Belote')
}

export default function BeloteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
