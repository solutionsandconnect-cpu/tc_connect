"use client";

import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useMyStoreSubscriptions } from "@/hooks/useStoreSubscriptions";

/**
 * Retourne true si l'utilisateur est Admin OU a un abonnement actif
 * pour l'application dont la route correspond à `appRoute`.
 */
export function useStoreAccess(appRoute: string) {
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role_app === "Admin";
  const { apps, loading: loadingApps } = useStoreApps();
  const { subscriptions, loading: loadingSubs } = useMyStoreSubscriptions(currentUser?.uid);

  const loading = loadingApps || loadingSubs;

  if (isAdmin) return { hasAccess: true, loading: false, isAdmin: true, sub: null, limites: undefined as Record<string, number> | undefined };

  const app = apps.find((a) => a.route === appRoute);
  const nowMs = Date.now();
  const sub = app
    ? subscriptions.find(
        (s) =>
          s.appId === app.id &&
          s.statut === "active" &&
          // Accès illimité si pas de date de fin, sinon valable tant que la date n'est pas dépassée
          (!s.dateFin || (s.dateFin.toMillis?.() ?? 0) > nowMs)
      ) ?? null
    : null;

  return { hasAccess: !!sub, loading, isAdmin: false, sub, limites: sub?.limites };
}

/** Récupère une limite numérique depuis les limites d'un abonnement (par clés connues, sinon valeur unique). */
export function readLimit(limites: Record<string, number> | undefined, ...keys: string[]): number {
  if (!limites) return Infinity;
  for (const k of keys) {
    if (typeof limites[k] === "number") return limites[k];
  }
  const values = Object.values(limites);
  if (values.length === 1) return values[0]; // app à une seule limite → cas le plus courant
  return values.length ? Math.min(...values) : Infinity;
}
