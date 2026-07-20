"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Modal from "@/components/ui/Modal";
import { BookmarkIcon, DevicePhoneMobileIcon, ShareIcon } from "@heroicons/react/24/outline";
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

const A2HS_KEY = (route: string) => `a2hs-dismissed-${route}`;

/**
 * Bouton « Ajouter à l'écran d'accueil » propre à une app de la boutique.
 *
 * ⚠️ Aucun système d'exploitation ne permet à un site de créer le raccourci lui-même :
 *  - iOS n'expose AUCUNE API (ni `beforeinstallprompt`) → on ne peut qu'expliquer la manip ;
 *  - sur Android, la boîte d'installation de Chrome installe la PWA sur le `start_url`
 *    du manifest (/accueil), donc PAS un raccourci vers cette app → même traitement.
 * Ce bouton affiche donc la marche à suivre. Le raccourci pointe sur l'URL courante,
 * d'où l'importance d'être dans l'app au moment de l'ajout ; l'icône et le nom
 * viennent des métadonnées de la route (cf. lib/storeAppMetadata.ts).
 */
export function AddToHomeScreenButton({ appRoute }: { appRoute: string }) {
  const { apps } = useStoreApps();
  const app = apps.find((a) => a.route === appRoute);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop">("desktop");
  /** App ouverte depuis un raccourci déjà installé (mode plein écran). */
  const [standalone, setStandalone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (localStorage.getItem(A2HS_KEY(appRoute)) === "1") return } catch {}

    const ua = navigator.userAgent;
    setPlatform(/iphone|ipad|ipod/i.test(ua) ? "ios" : /android/i.test(ua) ? "android" : "desktop");
    // On reste VISIBLE en mode standalone : c'est justement là qu'on cherche le bouton,
    // alors qu'iOS n'y propose aucun menu Partager → la modale explique qu'il faut
    // repasser par le navigateur.
    setStandalone(window.matchMedia?.("(display-mode: standalone)").matches
      || (navigator as any).standalone === true);
    setVisible(true);
  }, [appRoute]);

  if (!visible || !app) return null;

  const nomRaccourci = (app.nomCourt || app.nom || "").trim();
  const dismiss = () => {
    setShowHelp(false);
    setVisible(false);
    try { localStorage.setItem(A2HS_KEY(appRoute), "1") } catch {}
  };

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        title="Ajouter cette app à l'écran d'accueil du téléphone"
        className="fixed right-4 bottom-[calc(7.25rem+env(safe-area-inset-bottom)+0.75rem)] sm:bottom-20 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm font-medium transition"
      >
        <DevicePhoneMobileIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Écran d&apos;accueil</span>
      </button>

      <Modal isOpen={showHelp} onClose={() => setShowHelp(false)} title="Ajouter à l'écran d'accueil" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Le raccourci ouvrira directement <strong className="text-gray-700">{app.nom}</strong>, en plein
            écran, sous le nom <strong className="text-gray-700">{nomRaccourci}</strong>.
          </p>

          {standalone ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-gray-700 space-y-2.5">
              <p className="font-semibold text-amber-800">À faire depuis le navigateur</p>
              <p>
                {platform === "ios"
                  ? "Vous êtes dans l'app installée, où iOS n'affiche aucun menu Partager : le raccourci ne peut être créé que depuis Safari."
                  : "Vous êtes dans l'app installée, où le menu du navigateur n'est pas accessible : le raccourci ne peut être créé que depuis le navigateur."}
              </p>
              <div className="flex flex-col gap-2 pt-0.5">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2500);
                    } catch { /* presse-papiers refusé */ }
                  }}
                  className="w-full bg-white border border-amber-300 text-amber-900 py-2 rounded-lg text-xs font-medium hover:bg-amber-100 transition"
                >
                  {copied ? "Lien copié — collez-le dans Safari" : "Copier le lien de cette app"}
                </button>
                <button
                  onClick={() => window.open(window.location.href, "_blank", "noopener")}
                  className="w-full bg-white border border-amber-300 text-amber-900 py-2 rounded-lg text-xs font-medium hover:bg-amber-100 transition"
                >
                  Ouvrir dans le navigateur
                </button>
              </div>
              <p className="text-amber-700">
                Puis, dans {platform === "ios" ? "Safari" : "le navigateur"} : Partager →{" "}
                <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
              </p>
            </div>
          ) : platform === "ios" && (
            <ol className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>
                Appuyez sur <ShareIcon className="w-4 h-4 text-blue-600 inline-block align-text-bottom" />{" "}
                <strong>Partager</strong> (en bas de Safari).
              </li>
              <li>Faites défiler et choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>.</li>
              <li>Validez avec <strong>Ajouter</strong>.</li>
            </ol>
          )}

          {!standalone && platform === "android" && (
            <ol className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-gray-700 space-y-1.5 list-decimal list-inside">
              <li>Ouvrez le menu <strong>⋮</strong> de Chrome (en haut à droite).</li>
              <li>Choisissez <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.</li>
              <li>Validez avec <strong>Ajouter</strong>.</li>
            </ol>
          )}

          {!standalone && platform === "desktop" && (
            <p className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-gray-700">
              Depuis un ordinateur, utilisez l&apos;icône d&apos;installation dans la barre d&apos;adresse
              de Chrome ou Edge. Pour un raccourci vers cette app en particulier, ouvrez plutôt
              cette page sur votre téléphone.
            </p>
          )}

          <p className="text-xs text-gray-400">
            À faire depuis cette page : le raccourci mémorise l&apos;adresse affichée au moment de l&apos;ajout.
          </p>

          <div className="flex gap-3">
            <button onClick={dismiss}
              className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition">
              Ne plus proposer
            </button>
            <button onClick={() => setShowHelp(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium transition">
              C&apos;est fait
            </button>
          </div>
        </div>
      </Modal>
    </>
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
        {showPin && <AddToHomeScreenButton appRoute={appRoute} />}
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
      {showPin && <AddToHomeScreenButton appRoute={appRoute} />}
    </>
  );
}
