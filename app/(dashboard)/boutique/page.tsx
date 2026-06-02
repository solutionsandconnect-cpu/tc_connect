"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useMyStoreSubscriptions } from "@/hooks/useStoreSubscriptions";
import { usePendingSubscriptions } from "@/hooks/usePendingSubscriptions";
import { createStoreSubscription, listenAppReviews, upsertReview } from "@/lib/storeService";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_DROITS } from "@/types";
import type { StoreApp, StoreSubStatut, StoreReview } from "@/types";

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

  // Check boutique access for non-admin
  const boutiqueAccess = isAdmin || (userProfile?.droits?.boutique ?? DEFAULT_DROITS.boutique);

  const shortcuts = userProfile?.accueilShortcuts ?? [];

  // Reviews state
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const [appReviews, setAppReviews] = useState<Record<string, StoreReview[]>>({});
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [savingReview, setSavingReview] = useState(false);

  const loadReviews = useCallback((appId: string) => {
    if (appReviews[appId] !== undefined) return;
    return listenAppReviews(appId, (reviews) => {
      setAppReviews(prev => ({ ...prev, [appId]: reviews }));
    });
  }, [appReviews]);

  useEffect(() => {
    // Pre-load reviews for active apps
    const activeSubs = subscriptions.filter(s => s.statut === "active");
    const unsubs: (() => void)[] = [];
    activeSubs.forEach(s => {
      const unsub = listenAppReviews(s.appId, (reviews) => {
        setAppReviews(prev => ({ ...prev, [s.appId]: reviews }));
      });
      if (unsub) unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions.length]);

  const visibleApps = apps.filter(app => {
    if (isAdmin) return true;
    if (!app.actif) return false;
    const uid = currentUser?.uid;
    if (uid && app.hiddenUserIds?.includes(uid)) return false;
    if (app.visibleUserIds && app.visibleUserIds.length > 0) return app.visibleUserIds.includes(uid ?? "");
    return true;
  });

  // Aggregate changelogs across all active apps
  const allChangelogs = apps
    .filter(app => app.actif || isAdmin)
    .flatMap(app => (app.changelogs ?? []).map(c => ({
      ...c,
      appNom: app.nom,
      appIcon: app.icon,
      appCouleur: app.couleur,
    })));
  const recentUpdates = allChangelogs
    .filter(c => c.type === "update")
    .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0))
    .slice(0, 5);
  const upcoming = allChangelogs
    .filter(c => c.type === "upcoming")
    .sort((a, b) => (a.date?.seconds ?? 0) - (b.date?.seconds ?? 0));
  const hasChangelogs = recentUpdates.length > 0 || upcoming.length > 0;

  const getMySub = (appId: string) =>
    subscriptions.find((s) => s.appId === appId) ?? null;

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleRequest = async (app: StoreApp) => {
    if (!currentUser) return;
    setRequesting(app.id);
    // Les apps gratuites sont activées directement, les payantes passent en attente
    const isFree = app.prix === 0;
    const statut = isFree ? "active" : "pending";
    try {
      await createStoreSubscription({
        appId: app.id,
        appNom: app.nom,
        clientNom: userProfile?.display_name || currentUser.email || "—",
        clientEmail: currentUser.email ?? undefined,
        userUid: currentUser.uid,
        statut,
        dateDebut: Timestamp.now(),
        createdBy: currentUser.uid,
      });
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAdmins: true,
          title: isFree ? "Nouvelle souscription gratuite" : "Nouvelle demande boutique",
          body: isFree
            ? `${userProfile?.display_name || currentUser.email || "Un utilisateur"} a souscrit à ${app.nom} (gratuit)`
            : `${userProfile?.display_name || currentUser.email || "Un utilisateur"} souhaite accéder à ${app.nom}`,
          url: "/boutique/admin",
        }),
      }).catch(() => {});
      showToast(isFree ? `Accès à "${app.nom}" activé !` : "Demande envoyée ! Votre coach traitera votre demande.");
    } catch {
      showToast("Erreur lors de la demande.", false);
    } finally {
      setRequesting(null);
    }
  };

  const handleToggleShortcut = async (appId: string) => {
    if (!currentUser) return;
    const next = shortcuts.includes(appId)
      ? shortcuts.filter(id => id !== appId)
      : [...shortcuts, appId];
    await updateDoc(doc(db, "users", currentUser.uid), { accueilShortcuts: next });
  };

  const handleOpenReview = (appId: string) => {
    const myReview = (appReviews[appId] ?? []).find(r => r.userUid === currentUser?.uid);
    setReviewForm({ rating: myReview?.rating ?? 5, comment: myReview?.comment ?? "" });
    setReviewAppId(appId);
    loadReviews(appId);
  };

  const handleSaveReview = async () => {
    if (!currentUser || !reviewAppId) return;
    setSavingReview(true);
    try {
      const app = apps.find(a => a.id === reviewAppId);
      await upsertReview({
        appId: reviewAppId,
        userUid: currentUser.uid,
        clientNom: userProfile?.display_name || currentUser.email || "—",
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || undefined,
      });
      showToast(`Avis pour "${app?.nom ?? ""}" enregistré.`);
      setReviewAppId(null);
    } catch {
      showToast("Erreur lors de l'enregistrement.", false);
    } finally {
      setSavingReview(false);
    }
  };

  if (!loading && !boutiqueAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-4xl">🔒</p>
        <p className="text-gray-700 font-semibold">Accès non autorisé</p>
        <p className="text-sm text-gray-500">Vous n'avez pas accès à la boutique.</p>
        <button onClick={() => router.push("/accueil")} className="text-sm text-blue-600 hover:underline">
          Retour à l'accueil
        </button>
      </div>
    );
  }

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

      {/* Changelogs */}
      {hasChangelogs && (
        <div className="mb-8 space-y-4">
          {recentUpdates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Mises à jour récentes</h2>
              <div className="space-y-2">
                {recentUpdates.map(c => (
                  <div key={c.id} className="flex items-start gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                    <span className="text-xl shrink-0">{c.appIcon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-gray-500">{c.appNom}</span>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">
                          {c.date?.toDate?.().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{c.title}</p>
                      {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">À venir</h2>
              <div className="space-y-2">
                {upcoming.map(c => (
                  <div key={c.id} className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                    <span className="text-xl shrink-0">{c.appIcon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium text-blue-700">{c.appNom}</span>
                        {c.date?.seconds > 0 && (
                          <>
                            <span className="text-blue-200">·</span>
                            <span className="text-xs text-blue-500">
                              {c.date.toDate?.().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{c.title}</p>
                      {c.description && <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
            const reviews = appReviews[app.id] ?? [];
            const myReview = reviews.find(r => r.userUid === currentUser?.uid);
            const avgRating = reviews.length > 0
              ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
              : null;
            return (
              <AppCard
                key={app.id}
                app={app}
                sub={sub ? sub.statut : null}
                isAdmin={isAdmin}
                requesting={requesting === app.id}
                isShortcutted={shortcuts.includes(app.id)}
                myReview={myReview ?? null}
                avgRating={avgRating}
                reviewCount={reviews.length}
                onRequest={() => handleRequest(app)}
                onAccess={() => app.route && router.push(app.route)}
                onToggleShortcut={() => handleToggleShortcut(app.id)}
                onReview={() => handleOpenReview(app.id)}
              />
            );
          })}
        </div>
      )}
      {/* Modal avis */}
      {reviewAppId && (() => {
        const app = apps.find(a => a.id === reviewAppId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setReviewAppId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Évaluer {app?.nom}</h2>
                <button onClick={() => setReviewAppId(null)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-2">Note</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                      className={`text-2xl transition-transform ${n <= reviewForm.rating ? "scale-110" : "opacity-30"}`}>
                      ⭐
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Commentaire (optionnel)</p>
                <textarea rows={3} value={reviewForm.comment}
                  onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                  placeholder="Votre avis sur cette app…"
                  className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setReviewAppId(null)} className="flex-1 border rounded-lg py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">Annuler</button>
                <button onClick={handleSaveReview} disabled={savingReview}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg py-2.5 text-sm font-semibold transition">
                  {savingReview ? "…" : "Publier"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function AppCard({
  app, sub, isAdmin, requesting, isShortcutted, myReview, avgRating, reviewCount,
  onRequest, onAccess, onToggleShortcut, onReview,
}: {
  app: StoreApp;
  sub: StoreSubStatut | null;
  isAdmin: boolean;
  requesting: boolean;
  isShortcutted: boolean;
  myReview: StoreReview | null;
  avgRating: number | null;
  reviewCount: number;
  onRequest: () => void;
  onAccess: () => void;
  onToggleShortcut: () => void;
  onReview: () => void;
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
          {canAccess && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleShortcut(); }}
              title={isShortcutted ? "Retirer de l'accueil" : "Épingler sur l'accueil"}
              className={`mt-0.5 w-7 h-7 flex items-center justify-center rounded-lg transition text-base ${isShortcutted ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-300 hover:text-gray-500"}`}
            >
              📌
            </button>
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

      {/* Avis */}
      {(avgRating !== null || canAccess) && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {avgRating !== null ? (
              <>
                <span className="text-sm">{"⭐".repeat(Math.round(avgRating))}</span>
                <span className="text-xs text-gray-500 font-medium">{avgRating}/5</span>
                <span className="text-xs text-gray-400">({reviewCount} avis)</span>
              </>
            ) : (
              <span className="text-xs text-gray-400">Aucun avis</span>
            )}
          </div>
          {canAccess && (
            <button onClick={(e) => { e.stopPropagation(); onReview(); }}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${myReview ? "border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {myReview ? "Mon avis ⭐" : "Évaluer"}
            </button>
          )}
        </div>
      )}

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
