'use client'

import { StoreGate } from '@/components/ui/StoreGate'
import TripPackingLayout from '@/components/trip-packing/TripPackingLayout'

export default function TripsPage() {
  return (
    <StoreGate appRoute="/trips">
      <TripPackingLayout />
    </StoreGate>
  )
}
