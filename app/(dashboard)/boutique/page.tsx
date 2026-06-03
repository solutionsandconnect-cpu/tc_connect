"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStoreApps } from "@/hooks/useStoreApps";
import { useMyStoreSubscriptions } from "@/hooks/useStoreSubscriptions";
import { usePendingSubscriptions } from "@/hooks/usePendingSubscriptions";
import { createStoreSubscription, listenAppReviews, upsertReview, deleteReview, updateSubWithEvent, notifyAdmins, orderRef, isSubExpired } from "@/lib/storeService";
import { doc, updateDoc, getDoc, Timestamp, collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { copyText } from "@/lib/clipboard";
import Modal from "@/components/ui/Modal";
import { DEFAULT_DROITS } from "@/types";
import type { StoreApp, StoreSubStatut, StoreReview, StoreSubscription } from "@/types";

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

  // RIB pour règlement par virement (apps payantes en attente)
  const [ribIban, setRibIban] = useState("");
  const [ribBic, setRibBic] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [commandeSub, setCommandeSub] = useState<StoreSubscription | null>(null);
  useEffect(() => {
    getDoc(doc(db, "settings", "boutique")).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.iban) setRibIban(d.iban);
        if (d.bic) setRibBic(d.bic);
      }
    }).catch(() => {});
  }, []);
  const copyField = async (value: string, key: string) => {
    await copyText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Check boutique access for non-admin
  const boutiqueAccess = isAdmin || (userProfile?.droits?.boutique ?? DEFAULT_DROITS.boutique);

  const shortcuts = userProfile?.accueilShortcuts ?? [];

  // Reviews state
  const [reviewAppId, setReviewAppId] = useState<string | null>(null);
  const [appReviews, setAppReviews] = useState<Record<string, StoreReview[]>>({});
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [savingReview, setSavingReview] = useState(false);

  // Charger les avis de toutes les apps (note moyenne + liste affichées sur chaque carte)
  const appIdsKey = apps.map(a => a.id).join(",");
  useEffect(() => {
    if (apps.length === 0) return;
    const unsubs = apps.map(a =>
      listenAppReviews(a.id, (reviews) => setAppReviews(prev => ({ ...prev, [a.id]: reviews })))
    );
    return () => unsubs.forEach(u => u && u());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIdsKey]);

  const visibleApps = apps.filter(app => {
    if (isAdmin) return true;
    if (!app.actif) return false;
    const uid = currentUser?.uid;
    if (uid && app.hiddenUserIds?.includes(uid)) return false;
    if (app.visibleUserIds && app.visibleUserIds.length > 0) return app.visibleUserIds.includes(uid ?? "");
    return true;
  });

  // On ignore les abonnements annulés (gardés pour l'historique admin) : l'utilisateur peut re-souscrire.
  const getMySub = (appId: string) =>
    subscriptions.find((s) => s.appId === appId && s.statut !== "cancelled") ?? null;

  // ── Filtres ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [filterTarif, setFilterTarif] = useState<"all" | "free" | "paid">("all");
  const [filterPinned, setFilterPinned] = useState(false);
  const [filterSub, setFilterSub] = useState<"all" | "subscribed" | "not">("all");
  const [filterRating, setFilterRating] = useState(0);

  const allTags = Array.from(new Set(visibleApps.flatMap(a => a.tags ?? []))).sort((a, b) => a.localeCompare(b, "fr"));

  const avgOf = (appId: string) => {
    const rv = appReviews[appId] ?? [];
    return rv.length > 0 ? rv.reduce((s, r) => s + r.rating, 0) / rv.length : 0;
  };

  const displayedApps = visibleApps.filter(app => {
    const q = search.toLowerCase().trim();
    if (q && !`${app.nom} ${app.shortDesc} ${app.description} ${(app.tags ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
    if (filterTag && !(app.tags ?? []).includes(filterTag)) return false;
    if (filterTarif === "free" && app.prix > 0) return false;
    if (filterTarif === "paid" && app.prix === 0) return false;
    if (filterPinned && !shortcuts.includes(app.id)) return false;
    if (filterSub === "subscribed" && getMySub(app.id)?.statut !== "active") return false;
    if (filterSub === "not" && getMySub(app.id)?.statut === "active") return false;
    if (filterRating > 0 && avgOf(app.id) < filterRating) return false;
    return true;
  });

  const activeFilterCount = [
    !!search, !!filterTag, filterTarif !== "all", filterPinned, filterSub !== "all", filterRating > 0,
  ].filter(Boolean).length;

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
        prix: app.prix,
        statut,
        dateDebut: Timestamp.now(),
        createdBy: currentUser.uid,
        events: [{ type: "created", date: Timestamp.now() }],
      });
      const who = userProfile?.display_name || currentUser.email || "Un utilisateur";
      const subMsg = isFree ? `${who} a souscrit à ${app.nom} (gratuit)` : `${who} souhaite accéder à ${app.nom}`;
      notifyAdmins(isFree ? "SOUSCRIPTION_BOUTIQUE" : "DEMANDE_BOUTIQUE", subMsg);
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAdmins: true,
          title: isFree ? "Nouvelle souscription gratuite" : "Nouvelle demande boutique",
          body: subMsg,
          url: "/boutique/admin",
        }),
      }).catch(() => {});
      showToast(isFree ? `Accès à "${app.nom}" activé !` : "Demande envoyée ! Nous traitons votre demande.");
    } catch {
      showToast("Erreur lors de la demande.", false);
    } finally {
      setRequesting(null);
    }
  };

  // Ouvre (ou crée) une discussion avec le coach à propos d'une app
  const handleMessageAboutApp = async (app: StoreApp) => {
    if (!currentUser) return;
    try {
      // Discussion déjà existante pour cette app ?
      const mineSnap = await getDocs(query(collection(db, "messagerie"), where("participants_ids", "array-contains", currentUser.uid)));
      const existing = mineSnap.docs.find((d) => (d.data() as any).appId === app.id);
      if (existing) { router.push(`/messagerie/${existing.id}`); return; }

      // Destinataires : les administrateurs (coachs)
      const adminSnap = await getDocs(query(collection(db, "users"), where("role_app", "==", "Admin")));
      const adminIds = adminSnap.docs.map((d) => d.id).filter((id) => id !== currentUser.uid);
      if (adminIds.length === 0) { showToast("Aucun destinataire disponible pour le moment.", false); return; }

      const discRef = await addDoc(collection(db, "messagerie"), {
        objet_message: `Question — ${app.nom}`,
        appId: app.id,
        service: "Boutique",
        date_create: serverTimestamp(),
        date_last_message: serverTimestamp(),
        participants_ids: [currentUser.uid, ...adminIds],
        non_lus_ids: adminIds,
        archives_par: [],
      });
      await addDoc(collection(db, "messagerie", discRef.id, "messages_messagerie"), {
        ref_user: doc(db, "usersapp", currentUser.uid),
        message_text: `Bonjour, j'aurais une ou plusieurs questions concernant l'application « ${app.nom} ».`,
        date_create: serverTimestamp(),
        document_image_list: [],
        document_pdf_list: [],
        document_video_list: [],
      });
      // Push aux coachs uniquement (pas d'entrée dans la section Notifications :
      // la discussion apparaît déjà comme non lue dans la Messagerie)
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toAdmins: true,
          title: "Nouvelle question boutique",
          body: `${userProfile?.display_name || currentUser.email || "Un utilisateur"} a une question sur "${app.nom}".`,
          url: `/messagerie/${discRef.id}`,
        }),
      }).catch(() => {});
      router.push(`/messagerie/${discRef.id}`);
    } catch (e) {
      console.error("[handleMessageAboutApp]", e);
      showToast("Impossible de créer la discussion.", false);
    }
  };

  const handleUnsubscribe = async (app: StoreApp) => {
    if (!currentUser) return;
    const sub = subscriptions.find(s => s.appId === app.id && s.statut !== "cancelled");
    if (!sub) return;
    if (!confirm(`Retirer votre accès à "${app.nom}" ? Vous pourrez à nouveau souscrire plus tard.`)) return;
    try {
      // On NE supprime PAS l'abonnement : on l'archive (statut "cancelled") pour garder une trace côté admin.
      await updateSubWithEvent(
        sub.id,
        { statut: "cancelled", archivedAt: Timestamp.now() },
        "unsubscribed",
      );
      // Retirer aussi le raccourci accueil éventuel
      if (shortcuts.includes(app.id)) {
        await updateDoc(doc(db, "users", currentUser.uid), { accueilShortcuts: shortcuts.filter(id => id !== app.id) });
      }
      notifyAdmins("DESABO_BOUTIQUE", `${userProfile?.display_name || currentUser.email || "Un utilisateur"} s'est désabonné de ${app.nom}`);
      showToast(`Accès à "${app.nom}" retiré.`);
    } catch {
      showToast("Erreur lors du désabonnement.", false);
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
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm("Supprimer cet avis ?")) return;
    try {
      await deleteReview(reviewId);
      showToast("Avis supprimé.");
    } catch {
      showToast("Erreur lors de la suppression.", false);
    }
  };

  const handleSaveReview = async () => {
    if (!currentUser || !reviewAppId) return;
    setSavingReview(true);
    try {
      const app = apps.find(a => a.id === reviewAppId);
      const isNew = !(appReviews[reviewAppId] ?? []).some(r => r.userUid === currentUser.uid);
      const auteur = userProfile?.display_name || currentUser.email || "Un utilisateur";
      await upsertReview({
        appId: reviewAppId,
        userUid: currentUser.uid,
        clientNom: userProfile?.display_name || currentUser.email || "—",
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || undefined,
      });
      // Notifier les admins (sauf si l'auteur est lui-même admin) : push + notification in-app
      if (!isAdmin) {
        const msg = `${auteur} a ${isNew ? "laissé" : "modifié"} un avis (${reviewForm.rating}/5) sur ${app?.nom ?? "une app"}`;
        notifyAdmins("AVIS_BOUTIQUE", msg);
        fetch("/api/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toAdmins: true,
            title: isNew ? "Nouvel avis boutique" : "Avis modifié",
            body: msg,
            url: "/boutique",
          }),
        }).catch(() => {});
      }
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
        <p className="text-sm text-gray-500">{"Vous n'avez pas accès à la boutique."}</p>
        <button onClick={() => router.push("/accueil")} className="text-sm text-blue-600 hover:underline">
          {"Retour à l'accueil"}
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

      {/* Règlement en attente (apps payantes en attente de validation) */}
      {(() => {
        const pendingPaid = subscriptions.filter((s) => {
          if (s.statut !== "pending") return false;
          const app = apps.find((a) => a.id === s.appId);
          return app ? app.prix > 0 : false;
        });
        if (pendingPaid.length === 0 || (!ribIban && !ribBic)) return null;
        return (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <div className="min-w-0">
                <p className="text-sm font-bold text-orange-800">
                  {pendingPaid.length === 1 ? "1 règlement en attente" : `${pendingPaid.length} règlements en attente`}
                </p>
                <p className="text-xs text-orange-600 mt-0.5">Réglez par virement bancaire pour activer votre accès. Nous validerons la souscription à réception.</p>
                <div className="mt-2 space-y-2">
                  {pendingPaid.map((s) => {
                    const app = apps.find((a) => a.id === s.appId);
                    const ref = orderRef(s.id);
                    return (
                      <div key={s.id} className="bg-white border border-orange-100 rounded-lg px-2.5 py-2">
                        <p className="text-xs font-medium text-orange-800">
                          {s.appNom}{app?.prix ? ` — ${app.prix.toLocaleString("fr-FR")} €` : ""}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[11px] text-gray-600">
                            Réf. virement : <span className="font-mono font-semibold text-gray-800">{ref}</span>
                          </span>
                          <button onClick={() => copyField(ref, `ref-${s.id}`)}
                            className="flex items-center gap-1 text-[10px] font-medium text-orange-700 border border-orange-300 bg-white px-2 py-0.5 rounded-lg hover:bg-orange-50 transition shrink-0">
                            {copiedKey === `ref-${s.id}` ? "✓ Copié" : "Copier réf."}
                          </button>
                        </div>
                        <button onClick={() => setCommandeSub(s)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline">
                          Voir le bon de commande
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-orange-100 p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Virement bancaire</p>
              {ribIban && (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-medium">IBAN</p>
                    <p className="text-sm font-mono text-gray-800 tracking-wide truncate">{ribIban.match(/.{1,4}/g)?.join(" ") ?? ribIban}</p>
                  </div>
                  <button onClick={() => copyField(ribIban, "iban")}
                    className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                    {copiedKey === "iban" ? "✓ Copié" : "Copier"}
                  </button>
                </div>
              )}
              {ribBic && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] text-gray-400 font-medium">BIC</p>
                    <p className="text-sm font-mono text-gray-800">{ribBic}</p>
                  </div>
                  <button onClick={() => copyField(ribBic, "bic")}
                    className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                    {copiedKey === "bic" ? "✓ Copié" : "Copier"}
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-400">Indiquez la <strong>référence de commande</strong> (CMD-…) en référence du virement — elle nous permet d&apos;identifier votre paiement et d&apos;activer l&apos;accès. Retrouvez votre bon de commande dans « Documents ».</p>
            </div>
          </div>
        );
      })()}

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

      {/* Barre de filtres */}
      {!loading && visibleApps.length > 0 && (
        <div className="mb-5 space-y-2">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une app…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex flex-wrap gap-2">
            {allTags.length > 0 && (
              <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Tous les tags</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <select value={filterTarif} onChange={e => setFilterTarif(e.target.value as "all" | "free" | "paid")}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Tous les tarifs</option>
              <option value="free">Gratuit</option>
              <option value="paid">Payant</option>
            </select>
            <select value={filterSub} onChange={e => setFilterSub(e.target.value as "all" | "subscribed" | "not")}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Souscrit ou non</option>
              <option value="subscribed">Souscrits</option>
              <option value="not">Non souscrits</option>
            </select>
            <select value={filterRating} onChange={e => setFilterRating(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-gray-600 outline-none focus:ring-2 focus:ring-blue-400">
              <option value={0}>Tous les avis</option>
              <option value={4}>4★ et +</option>
              <option value={3}>3★ et +</option>
              <option value={2}>2★ et +</option>
            </select>
            <button type="button" onClick={() => setFilterPinned(v => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-sm border transition ${filterPinned ? "bg-blue-600 text-white border-blue-600" : "border-gray-200 text-gray-600 hover:border-blue-300"}`}>
              📌 Épinglés
            </button>
            {activeFilterCount > 0 && (
              <button type="button"
                onClick={() => { setSearch(""); setFilterTag(""); setFilterTarif("all"); setFilterPinned(false); setFilterSub("all"); setFilterRating(0); }}
                className="px-2.5 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-500 transition">
                Réinitialiser
              </button>
            )}
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
      ) : displayedApps.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-3xl mb-2">🔍</p>
          <p className="text-sm">Aucune app ne correspond à ces filtres.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedApps.map((app) => {
            const sub = getMySub(app.id);
            // Un abonnement expiré (date de fin dépassée) est traité comme "suspendu" côté affichage,
            // même si le statut en base n'a pas encore été basculé.
            const effectiveStatut = sub ? (isSubExpired(sub) ? "suspended" : sub.statut) : null;
            const reviews = appReviews[app.id] ?? [];
            const myReview = reviews.find(r => r.userUid === currentUser?.uid);
            const avgRating = reviews.length > 0
              ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
              : null;
            return (
              <AppCard
                key={app.id}
                app={app}
                sub={effectiveStatut}
                isAdmin={isAdmin}
                requesting={requesting === app.id}
                isShortcutted={shortcuts.includes(app.id)}
                myReview={myReview ?? null}
                avgRating={avgRating}
                reviews={reviews}
                currentUid={currentUser?.uid ?? null}
                hasSub={!!sub}
                onRequest={() => handleRequest(app)}
                onAccess={() => app.route && router.push(app.route)}
                onToggleShortcut={() => handleToggleShortcut(app.id)}
                onReview={() => handleOpenReview(app.id)}
                onDeleteReview={handleDeleteReview}
                onUnsubscribe={() => handleUnsubscribe(app)}
                onMessage={() => handleMessageAboutApp(app)}
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

      {/* Modal Bon de commande (consultation directe depuis la boutique) */}
      <Modal isOpen={!!commandeSub} onClose={() => setCommandeSub(null)} title="Bon de commande" size="md">
        {commandeSub && (() => {
          const s = commandeSub;
          const app = apps.find((a) => a.id === s.appId);
          const ref = orderRef(s.id);
          const isPending = s.statut === "pending";
          const dateLabel = s.dateDebut?.toDate?.().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) ?? "—";
          const prix = app?.prix ?? s.prix ?? 0;
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl shrink-0">
                  {app?.icon ?? "🛍️"}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900">{s.appNom}</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUT_COLOR[s.statut]}`}>{STATUT_LABEL[s.statut]}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Référence de commande</span>
                  <span className="font-mono font-semibold text-gray-800">{ref}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Date de la demande</span>
                  <span className="text-gray-800">{dateLabel}</span>
                </div>
                {app && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-500">Formule</span>
                    <span className="text-gray-800">{PERIOD_LABEL[app.periodicite]}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500">Montant</span>
                  <span className="font-bold text-gray-900">{prix.toLocaleString("fr-FR")} €</span>
                </div>
              </div>

              {isPending && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-bold text-orange-800">Règlement par virement</p>
                  <p className="text-xs text-orange-600">
                    Effectuez un virement du montant ci-dessus en indiquant impérativement la <strong>référence de commande</strong>. Votre accès sera activé dès réception.
                  </p>
                  <div className="bg-white rounded-lg border border-orange-100 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-medium">Référence du virement</p>
                      <p className="text-sm font-mono font-semibold text-gray-800 truncate">{ref}</p>
                    </div>
                    <button onClick={() => copyField(ref, `cmd-ref`)}
                      className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                      {copiedKey === "cmd-ref" ? "✓ Copié" : "Copier"}
                    </button>
                  </div>
                  {ribIban && (
                    <div className="bg-white rounded-lg border border-orange-100 px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-400 font-medium">IBAN</p>
                        <p className="text-sm font-mono text-gray-800 truncate">{ribIban.match(/.{1,4}/g)?.join(" ") ?? ribIban}</p>
                      </div>
                      <button onClick={() => copyField(ribIban, "cmd-iban")}
                        className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                        {copiedKey === "cmd-iban" ? "✓ Copié" : "Copier"}
                      </button>
                    </div>
                  )}
                  {ribBic && (
                    <div className="bg-white rounded-lg border border-orange-100 px-3 py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium">BIC</p>
                        <p className="text-sm font-mono text-gray-800">{ribBic}</p>
                      </div>
                      <button onClick={() => copyField(ribBic, "cmd-bic")}
                        className="text-xs font-medium text-blue-600 border border-blue-200 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition shrink-0">
                        {copiedKey === "cmd-bic" ? "✓ Copié" : "Copier"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function AppCard({
  app, sub, isAdmin, requesting, isShortcutted, myReview, avgRating, reviews, currentUid, hasSub,
  onRequest, onAccess, onToggleShortcut, onReview, onDeleteReview, onUnsubscribe, onMessage,
}: {
  app: StoreApp;
  sub: StoreSubStatut | null;
  isAdmin: boolean;
  requesting: boolean;
  isShortcutted: boolean;
  myReview: StoreReview | null;
  avgRating: number | null;
  reviews: StoreReview[];
  currentUid: string | null;
  hasSub: boolean;
  onRequest: () => void;
  onAccess: () => void;
  onToggleShortcut: () => void;
  onReview: () => void;
  onDeleteReview: (reviewId: string) => void;
  onUnsubscribe: () => void;
  onMessage: () => void;
}) {
  const canAccess = sub === "active" || isAdmin;
  const isPending = sub === "pending";
  const isSuspended = sub === "suspended";
  const reviewCount = reviews.length;
  const [showDetails, setShowDetails] = useState(false);
  const [collapsed, setCollapsed] = useState(true); // card réduite par défaut

  // Mises à jour propres à CETTE app
  const upcoming = (app.changelogs ?? [])
    .filter(c => c.type === "upcoming")
    .sort((a, b) => (a.date?.seconds ?? 0) - (b.date?.seconds ?? 0));
  const updates = (app.changelogs ?? [])
    .filter(c => c.type === "update")
    .sort((a, b) => (b.date?.seconds ?? 0) - (a.date?.seconds ?? 0));
  const hasDetails = reviewCount > 0 || updates.length > 0;
  const hasLongDesc = !!app.description && app.description !== app.shortDesc;
  // Y a-t-il du contenu à révéler en développant la card ?
  const hasMore = hasLongDesc || (app.tags?.length ?? 0) > 0 || upcoming.length > 0 || hasDetails;

  return (
    <div className={`bg-white border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition ${!app.actif ? "opacity-60" : ""}`}>
      {/* Top */}
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center text-2xl shrink-0"
          style={{ backgroundColor: app.couleur + "20" }}
        >
          {app.iconUrl ? <img src={app.iconUrl} alt="" className="w-full h-full object-cover" /> : app.icon}
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
        {app.shortDesc && <p className="text-sm text-gray-500 mt-1 leading-relaxed">{app.shortDesc}</p>}
        {!collapsed && hasLongDesc && (
          // Toujours rendu en HTML : si la description contient des balises (gras, listes…)
          // elles sont interprétées ; sinon le texte brut est affiché (avec sauts de ligne).
          <div
            className="rich-content text-sm text-gray-600 mt-2 leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: /<[a-z][\s\S]*>/i.test(app.description!)
                ? app.description!
                : app.description!.replace(/\n/g, '<br>'),
            }}
          />
        )}
        {!collapsed && app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {app.tags.map((t) => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{t}</span>
            ))}
          </div>
        )}
        {hasMore && (
          <button
            onClick={(e) => { e.stopPropagation(); setCollapsed(v => !v); }}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {collapsed ? "En savoir plus" : "Réduire"}
          </button>
        )}
      </div>

      {/* Prochainement (mises à jour à venir, propres à l'app) */}
      {!collapsed && upcoming.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
          <p className="text-xs font-semibold text-blue-700 mb-1">🔜 Prochainement</p>
          <div className="space-y-1">
            {upcoming.slice(0, 3).map(c => (
              <div key={c.id}>
                <p className="text-xs font-medium text-gray-800">
                  {c.title}
                  {c.date?.seconds > 0 && (
                    <span className="font-normal text-blue-500 ml-1.5">
                      · {c.date.toDate?.().toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                    </span>
                  )}
                </p>
                {c.description && <p className="text-[11px] text-gray-500">{c.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* Détails : avis déposés + nouveautés passées */}
      {!collapsed && hasDetails && (
        <div>
          <button onClick={() => setShowDetails(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition">
            <svg className={`w-3.5 h-3.5 transition-transform ${showDetails ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showDetails ? "Masquer" : `Voir les avis${updates.length > 0 ? " et nouveautés" : ""}`}
          </button>

          {showDetails && (
            <div className="mt-2 space-y-3">
              {/* Nouveautés */}
              {updates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Nouveautés</p>
                  <div className="space-y-1.5">
                    {updates.slice(0, 5).map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <p className="text-xs font-medium text-gray-800">
                          {c.title}
                          {c.date?.seconds > 0 && (
                            <span className="font-normal text-gray-400 ml-1.5">
                              · {c.date.toDate?.().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                          )}
                        </p>
                        {c.description && <p className="text-[11px] text-gray-500 mt-0.5">{c.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Avis déposés */}
              {reviewCount > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1.5">Avis ({reviewCount})</p>
                  <div className="space-y-2">
                    {reviews.map(r => {
                      const canDelete = isAdmin || r.userUid === currentUid;
                      return (
                        <div key={r.id} className="border border-gray-100 rounded-lg px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-800 truncate">{r.clientNom}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs">{"⭐".repeat(r.rating)}</span>
                              {canDelete && (
                                <button onClick={(e) => { e.stopPropagation(); onDeleteReview(r.id); }}
                                  title="Supprimer l'avis" className="text-gray-300 hover:text-red-500 transition">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          {r.comment && <p className="text-[11px] text-gray-500 mt-0.5">{r.comment}</p>}
                          {r.createdAt?.seconds > 0 && (
                            <p className="text-[10px] text-gray-300 mt-0.5">
                              {r.createdAt.toDate?.().toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prix + action */}
      <div className="flex items-center justify-between pt-3 border-t gap-2">
        <div className="min-w-0">
          {app.prix === 0 ? (
            <span className="text-sm font-bold text-green-600">Gratuit</span>
          ) : (
            <span className="text-sm font-bold text-gray-900">
              {app.prix.toLocaleString("fr-FR")} €
              <span className="text-xs font-normal text-gray-400 ml-1">{PERIOD_LABEL[app.periodicite]}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
        {!isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); onMessage(); }}
            title="Poser une question au coach sur cette application"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm font-medium text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.83L3 20l1.17-3.5A7.9 7.9 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            <span className="hidden sm:inline">Une question ?</span>
          </button>
        )}
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

      {/* Se désabonner (utilisateur non-admin ayant une souscription) */}
      {!isAdmin && hasSub && (
        <button
          onClick={(e) => { e.stopPropagation(); onUnsubscribe(); }}
          className="text-xs text-gray-400 hover:text-red-500 transition self-start"
        >
          Se désabonner
        </button>
      )}
    </div>
  );
}
