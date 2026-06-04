'use client'

import { StoreGate } from '@/components/ui/StoreGate'
import TripPackingLayout from '@/components/trip-packing/TripPackingLayout'
import { useStoreAccess } from '@/hooks/useStoreAccess'
import { useTrips } from '@/hooks/useTrips'

export default function TripsPage() {
  const { hasAccess, loading: accessLoading } = useStoreAccess('/trips')
  const { trips, loading: tripsLoading } = useTrips()

  if (accessLoading || tripsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Abonné (ou admin) → accès complet (création autorisée)
  if (hasAccess) {
    return <TripPackingLayout canCreate />
  }

  // Pas d'abonnement mais membre d'au moins une liste partagée → accès invité
  // (consultation/participation selon ses droits, mais pas de création de liste)
  if (trips.length > 0) {
    return <TripPackingLayout canCreate={false} />
  }

  // Ni abonnement ni liste partagée → écran boutique
  return (
    <StoreGate appRoute="/trips" showPin={false}>
      <TripPackingLayout />
    </StoreGate>
  )
}
