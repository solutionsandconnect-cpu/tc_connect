"use client";

import Link from "next/link";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookmarkIcon } from "@heroicons/react/24/outline";
import { BookmarkIcon as BookmarkSolidIcon } from "@heroicons/react/24/solid";
import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useStoreAccess } from "@/hooks/useStoreAccess";

interface Props {
  appRoute: string;
  children: React.ReactNode;
  /** Affiche le bouton flottant « Épingler à l'accueil » (par défaut oui — à désactiver sur les sous-pages). */
  showPin?: boolean;
  /** Accès accordé même sans abonnement (ex. co-parent invité sur un bébé partagé :
   *  le partage est inclus dans l'abonnement du parent qui invite). */
  bypass?: boolean;
}

/** Bouton flottant pour épingler/retirer l'app de l'accueil.
 *  hiddenOnMobile=true → caché sur mobile (<sm), toujours visible sur desktop */
export function PinAppButton({ appRoute, hiddenOnMobile = false }: { appRoute: string; hiddenOnMobile?: boolean }) {
  const { currentUser, userProfile } = useAuth();
  const { apps } = useStoreApps();
  const app = apps.find((a) => a.route === appRoute);
  if (!app || !currentUser) return null;

  const shortcuts: string[] = (userProfile as any)?.accueilShortcuts ?? [];
  const pinned = shortcuts.includes(app.id);

  const toggle = async () => {
    const next = pinned ? shortcuts.filter((id) => id !== app.id) : [...shortcuts, app.id];
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { accueilShortcuts: next });
    } catch { /* silencieux */ }
  };

  return (
    <button
      onClick={toggle}
      title={pinned ? "Retirer de l'accueil" : "Épingler sur l'accueil"}
      className={`fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] sm:bottom-6 z-40 items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border text-sm font-medium transition ${
        hiddenOnMobile ? "hidden sm:flex" : "flex"
      } ${
        pinned ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      }`}
    >
      {pinned ? <BookmarkSolidIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
      <span className="hidden sm:inline">{pinned ? "Épinglée" : "Épingler"}</span>
    </button>
  );
}

/** Bouton épingler inline (pour usage dans une sidebar, sans position fixed) */
export function PinButtonInline({ appRoute }: { appRoute: string }) {
  const { currentUser, userProfile } = useAuth()
  const { apps } = useStoreApps()
  const app = apps.find((a) => a.route === appRoute)
  if (!app || !currentUser) return null
  const shortcuts: string[] = (userProfile as any)?.accueilShortcuts ?? []
  const pinned = shortcuts.includes(app.id)
  const toggle = async () => {
    const next = pinned ? shortcuts.filter((id) => id !== app.id) : [...shortcuts, app.id]
    try { await updateDoc(doc(db, "users", currentUser.uid), { accueilShortcuts: next }) }
    catch { /* silencieux */ }
  }
  return (
    <button onClick={toggle}
      className={`w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border transition mt-2 ${
        pinned ? 'bg-blue-50 text-blue-600 border-blue-200' : 'text-gray-500 border-gray-200 hover:bg-gray-50'
      }`}>
      {pinned ? <BookmarkSolidIcon className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
      {pinned ? 'Épinglée sur l\'accueil' : 'Épingler sur l\'accueil'}
    </button>
  )
}

export function StoreGate({ appRoute, children, showPin = true, bypass = false }: Props) {
  const { hasAccess, loading } = useStoreAccess(appRoute);

  if (bypass) {
    return (
      <>
        {children}
        {showPin && <PinAppButton appRoute={appRoute} />}
      </>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Accès non activé</h2>
          <p className="text-sm text-gray-500 mb-6">
            Cette fonctionnalité est disponible via la boutique. Contactez nous ou activez votre accès depuis la boutique.
          </p>
          <Link
            href="/boutique"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            Voir la boutique
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showPin && <PinAppButton appRoute={appRoute} />}
    </>
  );
}
