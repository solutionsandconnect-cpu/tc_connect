'use client'

import { useUsers } from './useUsers'

/** Retourne un dictionnaire uid → photo_url pour tous les utilisateurs TC Connect. */
export function useUserPhotoMap(): Record<string, string> {
  const { users } = useUsers()
  const map: Record<string, string> = {}
  for (const u of users) {
    const uid = u.uid ?? (u as any).id
    if (uid && u.photo_url) map[uid] = u.photo_url
  }
  return map
}
