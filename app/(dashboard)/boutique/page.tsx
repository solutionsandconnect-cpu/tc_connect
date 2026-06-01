"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useMyStoreSubscriptions } from "@/hooks/useStoreSubscriptions";
import { usePendingSubscriptions } from "@/hooks/usePendingSubscriptions";
import { createStoreSubscription } from "@/lib/storeService";
import type { StoreApp, StoreSubStatut } from "@/types";
import { Timestamp } from "firebase/firestore";

const STATUT_LABEL: Record<StoreSubStatut, string> = {
  active: "Actif",
  pending: "En attente",
  suspended: "Suspendu",
  cancelled: "Annulé",
};

const STATUT_COLOR: Record<StoreSubStatut, string> = {
  active: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  suspended: "bg-red-100 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
};

const PERIOD_LABEL: Record<StoreApp["periodicite"], string> = {
  mensuel: "/mois",
  annuel: "/an",
  unique: "paiement unique",
};

export default function BoutiquePage() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const isAdmin = userProfile?.role_app === "Admin";
  const { apps, loading } = useStoreApps();
  const { subscriptions } = useMyStoreSubscriptions(currentUser?.uid);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const pendingCount = usePendingSubscriptions();

  const visibleApps = isAdmin ? apps : apps.filter((a) => a.actif);

  const getMySub = (appId: string) =>
    subscriptions.find((s) => s.appId === appId) ?? null;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRequest = async (app: StoreApp) => {
    if (!currentUser) return;
    setRequesting(app.id);
    try {
      await createStoreSubscription({
        appId: app.id,
        appNom: app.nom,
        clientNom: userProfile?.display_name || currentUser.email || "—",
        clientEmail: currentUser.email ?? undefined,
        userUid: currentUser.uid,
        statut: "pending",
        dateDebut: Timestamp.now(),
        createdBy: currentUser.uid,
      });
      // Notifier l'admin par push
      fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAdmins: true,
          title: 'Nouvelle demande boutique',
          body: `${userProfile?.display_name || currentUser.email || 'Un utilisateur'} souhaite accéder à ${app.nom}`,
          url: '/boutique/admin',
        }),
      }).catch(() => {});
      showToast("Demande envoyée ! Votre coach traitera votre demande.");
    } catch {
      showToast("Erreur lors de la demande.", false);
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition ${toast.ok ? "bg-green-500" : "bg-red-500"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Boutique</h1>
          <p className="text-sm text-gray-500 mt-0.5">Découvrez et activez nos outils exclusifs</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => router.push("/boutique/admin")}
            className="relative flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Gérer le store
            {pendingCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Mes accès actifs */}
      {subscriptions.filter((s) => s.statut === "active").length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Mes accès actifs</h2>
          <div className="flex flex-wrap gap-2">
            {subscriptions
              .filter((s) => s.statut === "active")
              .map((s) => {
                const app = apps.find((a) => a.id === s.appId);
                return (
                  <button
                    key={s.id}
                    onClick={() => app?.route && router.push(app.route)}
                    className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm font-medium text-green-700 hover:bg-green-100 transition"
                  >
                    <span>{app?.icon ?? "📦"}</span>
                    <span>{s.appNom}</span>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Grille des apps */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-2xl p-5 animate-pulse space-y-3">
              <div className="w-12 h-12 bg-gray-100 rounded-xl" />
              <div className="h-4 bg-gray-100 rounded w-2/3" />
              <div className="h-3 bg-gray-100 rounded w-full" />
              <div className="h-3 bg-gray-100 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : visibleApps.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏪</p>
          <p className="text-sm">Aucune application disponible pour le moment.</p>
          {isAdmin && (
            <button onClick={() => router.push("/boutique/admin")} className="mt-4 text-sm text-blue-600 hover:underline">
              Ajouter votre première application →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleApps.map((app) => {
            const sub = getMySub(app.id);
            return (
              <AppCard
                key={app.id}
                app={app}
                sub={sub ? sub.statut : null}
                isAdmin={isAdmin}
                requesting={requesting === app.id}
                onRequest={() => handleRequest(app)}
                onAccess={() => app.route && router.push(app.route)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function AppCard({
  app, sub, isAdmin, requesting, onRequest, onAccess,
}: {
  app: StoreApp;
  sub: StoreSubStatut | null;
  isAdmin: boolean;
  requesting: boolean;
  onRequest: () => void;
  onAccess: () => void;
}) {
  const canAccess = sub === "active" || isAdmin;
  const isPending = sub === "pending";
  const isSuspended = sub === "suspended";

  return (
    <div className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition ${!app.actif ? "opacity-60" : ""}`}>
      {/* Top */}
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ backgroundColor: app.couleur + "20" }}
        >
          {app.icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          {!app.actif && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactif</span>
          )}
          {sub && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_COLOR[sub]}`}>
              {STATUT_LABEL[sub]}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex-1">
        <h3 className="font-semibold text-gray-900 text-base">{app.nom}</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{app.shortDesc}</p>
        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {app.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
            ))}
          </div>
        )}
      </div>

      {/* Prix + action */}
      <div className="flex items-center justify-between pt-3 border-t">
        <div>
          {app.prix === 0 ? (
            <span className="text-sm font-bold text-green-600">Gratuit</span>
          ) : (
            <span className="text-sm font-bold text-gray-900">
              {app.prix.toLocaleString("fr-FR")} €
              <span className="text-xs font-normal text-gray-400 ml-1">{PERIOD_LABEL[app.periodicite]}</span>
            </span>
          )}
        </div>
        {canAccess ? (
          <button
            onClick={onAccess}
            disabled={!app.route}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Accéder
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        ) : isPending ? (
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
            En attente…
          </span>
        ) : isSuspended ? (
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200">
            Suspendu
          </span>
        ) : (
          <button
            onClick={onRequest}
            disabled={requesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
          >
            {requesting ? "…" : "Souscrire"}
          </button>
        )}
      </div>
    </div>
  );
}
