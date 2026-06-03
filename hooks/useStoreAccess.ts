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

  if (isAdmin) return { hasAccess: true, loading: false };

  const app = apps.find((a) => a.route === appRoute);
  const nowMs = Date.now();
  const hasAccess = !!app && subscriptions.some(
    (s) =>
      s.appId === app.id &&
      s.statut === "active" &&
      // Accès illimité si pas de date de fin, sinon valable tant que la date n'est pas dépassée
      (!s.dateFin || (s.dateFin.toMillis?.() ?? 0) > nowMs)
  );

  return { hasAccess, loading };
}
