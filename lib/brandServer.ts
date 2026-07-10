// lib/brandServer.ts
// Résolution de la marque par le DOMAINE (host), côté SERVEUR uniquement (headers()).
// Utilisé par les pages d'entrée publiques (login, pages légales) : ces pages reflètent
// TOUJOURS le domaine, indépendamment de la connexion ou d'un choix in-app.
import { headers } from 'next/headers'
import { hostToBrand, type Brand } from '@/lib/brand'

/** Marque résolue par le host de la requête. Défaut coaching (jamais Enezo par accident). */
export async function getServerBrand(): Promise<Brand> {
  const hdrs = await headers()
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
  return hostToBrand(host) === 'enezo' ? 'enezo' : 'coaching'
}

/** Nom commercial de l'app selon le domaine : « Enezo » sur Enezo, « TC Connect » ailleurs. */
export async function getAppName(): Promise<string> {
  return (await getServerBrand()) === 'enezo' ? 'Enezo' : 'TC Connect'
}
